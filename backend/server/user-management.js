const { db, auth } = require('./firebase-admin');
const admin = require('firebase-admin');
const MAX_REPORT_SAMPLE = 50;
let lastUserSyncReport = null;

function summarizeIdList(list) {
    return {
        total: list.length,
        sample: list.slice(0, MAX_REPORT_SAMPLE)
    };
}

/**
 * User Management Functions for Firebase Admin SDK
 */

/**
 * User Management Functions for Firebase Admin SDK
 */

/**
 * Get all users from Firebase Auth
 */
async function getAllUsers() {
    try {
        const listUsersResult = await auth.listUsers(1000); // Max 1000 users per call
        return listUsersResult.users.map(user => ({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            emailVerified: user.emailVerified,
            disabled: user.disabled,
            creationTime: user.metadata.creationTime,
            lastSignInTime: user.metadata.lastSignInTime,
            providerData: user.providerData
        }));
    } catch (error) {
        throw error;
    }
}

/**
 * Get user by UID from Firebase Auth
 */
async function getUserByUid(uid) {
    try {
        const userRecord = await auth.getUser(uid);
        return {
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
            emailVerified: userRecord.emailVerified,
            disabled: userRecord.disabled,
            creationTime: userRecord.metadata.creationTime,
            lastSignInTime: userRecord.metadata.lastSignInTime,
            providerData: userRecord.providerData
        };
    } catch (error) {
        throw error;
    }
}

/**
 * Initialize user documents (users + entitlements) in a single transaction
 * This ensures atomicity and prevents race conditions
 */
async function initializeUser(uid, userDataOverrides = {}) {
    try {
        const authUser = await getUserByUid(uid);
        const nowIso = new Date().toISOString();
        
        return await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(uid);
            const entitlementsRef = db.collection('entitlements').doc(uid);
            
            // Get both documents in parallel
            const [userDoc, entitlementsDoc] = await Promise.all([
                transaction.get(userRef),
                transaction.get(entitlementsRef)
            ]);
            
            const userExists = userDoc.exists;
            const entitlementsExist = entitlementsDoc.exists;
            
            // If both exist, return early (idempotency)
            if (userExists && entitlementsExist) {
                return {
                    created: false,
                    updated: false,
                    unchanged: true,
                    user: userDoc.data(),
                    entitlements: entitlementsDoc.data()
                };
            }
            
            // Prepare user document
            const existingUserData = userExists ? userDoc.data() : null;
            const userDocToWrite = {
                email: authUser.email,
                displayName: authUser.displayName || (authUser.email ? authUser.email.split('@')[0] : ''),
                emailVerified: authUser.emailVerified,
                disabled: authUser.disabled,
                lastActive: authUser.lastSignInTime || existingUserData?.lastActive || nowIso,
                ...userDataOverrides
            };
            
            if (!userExists) {
                userDocToWrite.createdAt = authUser.creationTime || nowIso;
                if (userDocToWrite.plan === undefined) {
                    userDocToWrite.plan = 'free';
                }
                // Note: free_specs_remaining is now managed by user_credits collection
                // Keep it for backward compatibility but don't set it here
                // It will be migrated to user_credits.balances.free
            } else {
                userDocToWrite.createdAt = existingUserData?.createdAt || authUser.creationTime || nowIso;
            }
            
            // Remove undefined values
            Object.keys(userDocToWrite).forEach((key) => {
                if (userDocToWrite[key] === undefined) {
                    delete userDocToWrite[key];
                }
            });
            
            // Write user document
            if (!userExists) {
                transaction.set(userRef, userDocToWrite);
            } else if (Object.keys(userDocToWrite).length > 0) {
                transaction.update(userRef, userDocToWrite);
            }
            
            // Initialize user_credits using new system (outside transaction for now)
            // Note: This will be handled by credits-v2-service which uses its own transaction
            
            // For backward compatibility, still create entitlements document if it doesn't exist
            // but don't set spec_credits (that's now in user_credits)
            if (!entitlementsExist) {
                const entitlementsDocToWrite = {
                    userId: uid,
                    unlimited: false,
                    can_edit: false,
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                };
                transaction.set(entitlementsRef, entitlementsDocToWrite);
            }
            
            // Get final entitlements data (for backward compatibility)
            const finalEntitlements = entitlementsExist 
                ? entitlementsDoc.data() 
                : { userId: uid, unlimited: false, can_edit: false };
            
            // Initialize user_credits if it doesn't exist (after transaction)
            // This needs to be done outside the transaction because credits-v2-service uses its own transactions
            const result = {
                created: !userExists || !entitlementsExist || !creditsExist,
                updated: userExists && entitlementsExist && Object.keys(userDocToWrite).length > 0,
                unchanged: userExists && entitlementsExist && creditsExist && Object.keys(userDocToWrite).length === 0,
                user: { ...(existingUserData || {}), ...userDocToWrite },
                entitlements: finalEntitlements
            };
            
            // Initialize credits after transaction commits
            if (!creditsExist) {
                // Use credits-v2-service to initialize (will be done after transaction)
                result._needsCreditsInit = true;
                result._isNewUser = !userExists;
            }
            
            return result;
        });
        
        // Initialize user_credits if needed (after transaction)
        if (result._needsCreditsInit) {
            try {
                const creditsV2Service = require('./credits-v2-service');
                const credits = await creditsV2Service.getUserCredits(uid);
                
                // Grant 1 free credit to new users
                if (result._isNewUser) {
                    await creditsV2Service.grantCredits(uid, 1, 'promotion', {
                        reason: 'New user welcome credit',
                        creditType: 'free'
                    });
                }
            } catch (creditsError) {
                // Log but don't fail - credits will be initialized on first access
                console.error(`[user-management] Error initializing credits for ${uid}:`, creditsError);
            }
        }
        
        return result;
    } catch (error) {
        throw error;
    }
}

async function ensureEntitlementDocument(uid, overrides = {}) {
    const entitlementsRef = db.collection('entitlements').doc(uid);
    const snapshot = await entitlementsRef.get();
    const isNew = !snapshot.exists;

    // If entitlements already exist, don't modify spec_credits unless explicitly overridden
    if (!isNew) {
        const existingData = snapshot.data();
        const dataToWrite = { ...overrides };
        
        // Don't modify spec_credits if it's not in overrides and entitlements already exist
        if (!('spec_credits' in overrides)) {
            // Preserve existing spec_credits
            delete dataToWrite.spec_credits;
        }
        
        Object.keys(dataToWrite).forEach((key) => {
            if (dataToWrite[key] === undefined) {
                delete dataToWrite[key];
            }
        });

        if (Object.keys(dataToWrite).length > 0) {
            dataToWrite.updated_at = admin.firestore.FieldValue.serverTimestamp();
            await entitlementsRef.set(dataToWrite, { merge: true });
        }

        return {
            created: false,
            updated: Object.keys(dataToWrite).length > 0,
            unchanged: Object.keys(dataToWrite).length === 0,
            data: { ...existingData, ...dataToWrite }
        };
    }

    // Entitlements don't exist - check if this is a new user
    // Check if user was created recently (within last 5 minutes) to determine if it's a new user
    const userRef = db.collection('users').doc(uid);
    const userSnapshot = await userRef.get();
    
    let isNewUser = false;
    if (!userSnapshot.exists) {
        isNewUser = true;
    } else {
        const userData = userSnapshot.data();
        if (userData.createdAt) {
            const createdAt = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt);
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            isNewUser = createdAt > fiveMinutesAgo;
        }
    }
    
    // Credits are only given during registration in auth.html
    // But if this is a new user and entitlements don't exist, give 1 credit as fallback
    const defaultData = {
        userId: uid,
        spec_credits: isNewUser ? 1 : 0,
        unlimited: false,
        can_edit: false
    };

    const dataToWrite = { ...defaultData, ...overrides };

    Object.keys(dataToWrite).forEach((key) => {
        if (dataToWrite[key] === undefined) {
            delete dataToWrite[key];
        }
    });

    dataToWrite.updated_at = admin.firestore.FieldValue.serverTimestamp();
    await entitlementsRef.set(dataToWrite, { merge: true });

    return {
        created: true,
        updated: false,
        unchanged: false,
        data: dataToWrite
    };
}

/**
 * Sync all users - create Firestore documents for users who don't have them
 */
async function syncAllUsers(options = {}) {
    const {
        ensureEntitlements: shouldEnsureEntitlements = true,
        includeDataCollections = true,
        dryRun = false,
        recordResult = !options.dryRun
    } = options;

    try {
        const startedAt = Date.now();
        const runAt = new Date().toISOString();
        const authUsers = await getAllUsers();

        const summary = {
            runAt,
            durationMs: 0,
            totalAuth: authUsers.length,
            created: 0,
            updated: 0,
            unchanged: 0,
            entitlementsCreated: 0,
            entitlementsUpdated: 0,
            errors: 0,
            errorDetails: [],
            potentialCreates: 0,
            potentialEntitlementCreates: 0
        };

        if (!dryRun) {
            // Process users in batches for better performance
            const BATCH_SIZE = 50; // Process 50 users at a time
            const batches = [];
            for (let i = 0; i < authUsers.length; i += BATCH_SIZE) {
                batches.push(authUsers.slice(i, i + BATCH_SIZE));
            }

            for (const batch of batches) {
                // Process batch in parallel
                await Promise.all(batch.map(async (user) => {
                    try {
                        // Use initializeUser for atomicity (creates both users and entitlements)
                        const result = await initializeUser(user.uid);
                        
                        if (result.created) {
                            summary.created += 1;
                            // Check if entitlements were created (they should be if user was created)
                            if (result.entitlements) {
                                summary.entitlementsCreated += 1;
                            }
                        } else if (result.updated) {
                            summary.updated += 1;
                        } else {
                            summary.unchanged += 1;
                        }

                        // If entitlements weren't created by initializeUser, ensure them
                        if (shouldEnsureEntitlements && !result.entitlements) {
                            const entitlementResult = await ensureEntitlementDocument(user.uid);
                            if (entitlementResult.created) {
                                summary.entitlementsCreated += 1;
                            } else if (entitlementResult.updated) {
                                summary.entitlementsUpdated += 1;
                            }
                        }
                    } catch (error) {
                        summary.errors += 1;
                        summary.errorDetails.push({
                            uid: user.uid,
                            email: user.email || null,
                            message: error.message
                        });
                    }
                }));
            }
        }

        const authUserIds = new Set(authUsers.map((user) => user.uid));

        const firestoreUsersSnapshot = await db.collection('users').get();
        const firestoreUsers = firestoreUsersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const firestoreUserIds = new Set(firestoreUsers.map((user) => user.id));

        const entitlementsSnapshot = await db.collection('entitlements').get();
        const entitlementIds = new Set(entitlementsSnapshot.docs.map((doc) => doc.id));

        const authWithoutFirestore = [...authUserIds].filter((id) => !firestoreUserIds.has(id));
        const firestoreWithoutAuth = [...firestoreUserIds].filter((id) => !authUserIds.has(id));
        const missingEntitlements = [...authUserIds].filter((id) => !entitlementIds.has(id));

        summary.firestoreTotal = firestoreUsersSnapshot.size;
        summary.entitlementsTotal = entitlementsSnapshot.size;
        summary.inconsistencies = {
            authWithoutFirestore: summarizeIdList(authWithoutFirestore),
            firestoreWithoutAuth: summarizeIdList(firestoreWithoutAuth),
            missingEntitlements: summarizeIdList(missingEntitlements)
        };

        if (includeDataCollections) {
            const specsSnapshot = await db.collection('specs').get();
            const appsSnapshot = await db.collection('apps').get();
            const marketSnapshot = await db.collection('marketResearch').get();

            const dataUserIds = new Set();
            [...specsSnapshot.docs, ...appsSnapshot.docs, ...marketSnapshot.docs].forEach((doc) => {
                const data = doc.data();
                if (data && data.userId) {
                    dataUserIds.add(data.userId);
                }
            });

            const dataWithoutAuth = [...dataUserIds].filter((id) => !authUserIds.has(id));

            summary.collectionStats = {
                specs: specsSnapshot.size,
                apps: appsSnapshot.size,
                marketResearch: marketSnapshot.size
            };
            summary.inconsistencies.dataWithoutAuth = summarizeIdList(dataWithoutAuth);
        }

        if (dryRun) {
            summary.potentialCreates = authWithoutFirestore.length;
            summary.potentialEntitlementCreates = missingEntitlements.length;
            summary.unchanged = authUsers.length;
        }

        if (summary.errorDetails.length > MAX_REPORT_SAMPLE) {
            summary.errorDetails = summary.errorDetails.slice(0, MAX_REPORT_SAMPLE);
        }

        summary.durationMs = Date.now() - startedAt;

        if (recordResult) {
            lastUserSyncReport = summary;
        }

        return summary;
    } catch (error) {
        throw error;
    }
}

/**
 * Get user statistics
 */
async function getUserStats() {
    try {
        // Get users from Auth
        const authUsers = await getAllUsers();
        
        // Get users from Firestore
        const firestoreUsersSnapshot = await db.collection('users').get();
        const firestoreUsers = firestoreUsersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Get data from other collections
        const specsSnapshot = await db.collection('specs').get();
        const appsSnapshot = await db.collection('apps').get();
        const marketSnapshot = await db.collection('marketResearch').get();
        
        const authUserIds = new Set(authUsers.map(u => u.uid));
        const firestoreUserIds = new Set(firestoreUsers.map(u => u.id));
        const dataUserIds = new Set();
        
        // Collect all userIds from data collections
        [...specsSnapshot.docs, ...appsSnapshot.docs, ...marketSnapshot.docs].forEach(doc => {
            const data = doc.data();
            if (data.userId) {
                dataUserIds.add(data.userId);
            }
        });
        
        // Find inconsistencies
        const authWithoutFirestore = [...authUserIds].filter(id => !firestoreUserIds.has(id));
        const firestoreWithoutAuth = [...firestoreUserIds].filter(id => !authUserIds.has(id));
        const dataWithoutUsers = [...dataUserIds].filter(id => !authUserIds.has(id));
        
        return {
            auth: {
                total: authUsers.length,
                verified: authUsers.filter(u => u.emailVerified).length,
                disabled: authUsers.filter(u => u.disabled).length
            },
            firestore: {
                total: firestoreUsers.length
            },
            data: {
                specs: specsSnapshot.size,
                apps: appsSnapshot.size,
                marketResearch: marketSnapshot.size,
                total: specsSnapshot.size + appsSnapshot.size + marketSnapshot.size
            },
            inconsistencies: {
                authWithoutFirestore: authWithoutFirestore.length,
                firestoreWithoutAuth: firestoreWithoutAuth.length,
                dataWithoutUsers: dataWithoutUsers.length,
                authWithoutFirestoreIds: authWithoutFirestore,
                firestoreWithoutAuthIds: firestoreWithoutAuth,
                dataWithoutUsersIds: dataWithoutUsers
            }
        };
    } catch (error) {
        throw error;
    }
}

function getLastUserSyncReport() {
    return lastUserSyncReport;
}

/**
 * Clean up orphaned data - remove data that references non-existent users
 */
async function cleanupOrphanedData() {
    try {
        
        const authUserIds = new Set((await getAllUsers()).map(u => u.uid));
        
        let cleanedSpecs = 0;
        let cleanedApps = 0;
        let cleanedMarket = 0;
        
        // Clean specs
        const specsSnapshot = await db.collection('specs').get();
        for (const doc of specsSnapshot.docs) {
            const data = doc.data();
            if (data.userId && !authUserIds.has(data.userId)) {
                await db.collection('specs').doc(doc.id).delete();
                cleanedSpecs++;
            }
        }
        
        // Clean apps
        const appsSnapshot = await db.collection('apps').get();
        for (const doc of appsSnapshot.docs) {
            const data = doc.data();
            if (data.userId && !authUserIds.has(data.userId)) {
                await db.collection('apps').doc(doc.id).delete();
                cleanedApps++;
            }
        }
        
        // Clean market research
        const marketSnapshot = await db.collection('marketResearch').get();
        for (const doc of marketSnapshot.docs) {
            const data = doc.data();
            if (data.userId && !authUserIds.has(data.userId)) {
                await db.collection('marketResearch').doc(doc.id).delete();
                cleanedMarket++;
            }
        }
        
        
        return {
            cleanedSpecs,
            cleanedApps,
            cleanedMarket,
            total: cleanedSpecs + cleanedApps + cleanedMarket
        };
    } catch (error) {
        throw error;
    }
}

/**
 * Delete user completely (from Auth and Firestore)
 */
async function deleteUser(uid) {
    try {
        // Delete user from Firebase Auth
        await auth.deleteUser(uid);
        
        // Delete user document from Firestore
        await db.collection('users').doc(uid).delete();
        
        // Delete all user's data
        const batch = db.batch();
        
        // Delete specs
        const specsSnapshot = await db.collection('specs').where('userId', '==', uid).get();
        specsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        
        // Delete apps
        const appsSnapshot = await db.collection('apps').where('userId', '==', uid).get();
        appsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        
        // Delete market research
        const marketSnapshot = await db.collection('marketResearch').where('userId', '==', uid).get();
        marketSnapshot.docs.forEach(doc => batch.delete(doc.ref));
        
        // Delete user tools
        const userToolsRef = db.collection('userTools').doc(uid);
        const userToolsDoc = await userToolsRef.get();
        if (userToolsDoc.exists) {
            batch.delete(userToolsRef);
        }
        
        await batch.commit();
        
        return true;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    getAllUsers,
    getUserByUid,
    ensureEntitlementDocument,
    initializeUser,
    syncAllUsers,
    getUserStats,
    getLastUserSyncReport,
    cleanupOrphanedData,
    deleteUser
};
