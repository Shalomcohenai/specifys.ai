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
 * Create or update user document in Firestore
 */
async function createOrUpdateUserDocument(uid, userData = {}) {
    try {
        const userDocRef = db.collection('users').doc(uid);
        const existingSnapshot = await userDocRef.get();
        const existingData = existingSnapshot.exists ? existingSnapshot.data() : null;

        const authUser = await getUserByUid(uid);
        const nowIso = new Date().toISOString();

        const docToWrite = {
            email: authUser.email,
            displayName: authUser.displayName || (authUser.email ? authUser.email.split('@')[0] : ''),
            emailVerified: authUser.emailVerified,
            disabled: authUser.disabled,
            lastActive: authUser.lastSignInTime || existingData?.lastActive || nowIso,
            ...userData
        };

        if (!existingSnapshot.exists) {
            docToWrite.createdAt = authUser.creationTime || nowIso;
            if (docToWrite.plan === undefined) {
                docToWrite.plan = 'free';
            }
            if (typeof docToWrite.free_specs_remaining !== 'number') {
                docToWrite.free_specs_remaining = 1;
            }
        } else {
            docToWrite.createdAt = existingData?.createdAt || authUser.creationTime || nowIso;
        }

        Object.keys(docToWrite).forEach((key) => {
            if (docToWrite[key] === undefined) {
                delete docToWrite[key];
            }
        });

        if (Object.keys(docToWrite).length === 0) {
            return {
                user: existingData,
                created: false,
                updated: false,
                unchanged: true,
                changes: {}
            };
        }

        await userDocRef.set(docToWrite, { merge: true });

        const mergedData = { ...(existingData || {}), ...docToWrite };
        const changes = {};

        if (existingData) {
            for (const key of Object.keys(docToWrite)) {
                const before = existingData[key];
                const after = mergedData[key];
                if (JSON.stringify(before) !== JSON.stringify(after)) {
                    changes[key] = {
                        before: before ?? null,
                        after
                    };
                }
            }
        }

        const created = !existingSnapshot.exists;
        const updated = existingSnapshot.exists && Object.keys(changes).length > 0;
        const unchanged = existingSnapshot.exists && !updated;

        return {
            user: mergedData,
            created,
            updated,
            unchanged,
            changes
        };
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

    // Entitlements don't exist - create with 0 credits
    // Credits are only given during registration in auth.html
    const defaultData = {
        userId: uid,
        spec_credits: 0,
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
            for (const user of authUsers) {
                try {
                    const docResult = await createOrUpdateUserDocument(user.uid);
                    if (docResult.created) {
                        summary.created += 1;
                    } else if (docResult.updated) {
                        summary.updated += 1;
                    } else {
                        summary.unchanged += 1;
                    }

                    if (shouldEnsureEntitlements) {
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
    createOrUpdateUserDocument,
    ensureEntitlementDocument,
    syncAllUsers,
    getUserStats,
    getLastUserSyncReport,
    cleanupOrphanedData,
    deleteUser
};
