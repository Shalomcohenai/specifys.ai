const { db, auth } = require('./firebase-admin');
const admin = require('firebase-admin');
const { recordUserRegistration } = require('./admin-activity-service');
const config = require('./config');
const creditsV3Service = require('./credits-v3-service');
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
 * Determine if user is new based on Firebase Auth metadata and credits state
 * @param {string} uid - User ID
 * @param {Object} authUser - Firebase Auth user data (with creationTime)
 * @param {Object} credits - Current credits data (or null if doesn't exist)
 * @param {boolean|null} isNewUserFromClient - Client-provided flag (optional)
 * @returns {boolean} - True if user is new
 * 
 * @deprecated This function is kept for backward compatibility.
 * In initializeUser, we now determine isNewUser directly from document existence.
 */
function determineIfNewUser(uid, authUser, credits, isNewUserFromClient) {
    // Priority 1: Client-provided flag (most reliable) - ALWAYS trust this
    if (isNewUserFromClient === true) {
        return true;
    }
    if (isNewUserFromClient === false) {
        return false;
    }
    
    // Priority 2: Check if credits don't exist (definitely new user)
    if (!credits) {
        return true;
    }
    
    // Priority 3: Check if credits exist but are empty and user was created recently
    const totalCredits = (credits.balances?.paid || 0) + 
                         (credits.balances?.free || 0) + 
                         (credits.balances?.bonus || 0);
    
    if (totalCredits === 0 && authUser.creationTime) {
        const creationTime = authUser.creationTime instanceof Date 
            ? authUser.creationTime 
            : new Date(authUser.creationTime);
        const now = new Date();
        const minutesSinceCreation = (now - creationTime) / (1000 * 60);
        
        // If user was created in last 10 minutes and has no credits, likely new user
        if (minutesSinceCreation <= 10) {
            return true;
        }
    }
    
    return false;
}

/**
 * Initialize user documents (users + user_credits) in a single transaction
 * This ensures atomicity and prevents race conditions
 */
async function initializeUser(uid, userDataOverrides = {}, isNewUserFromClient = null) {
    const startTime = Date.now();
    console.log(`[user-management] ========== START initializeUser ==========`);
    console.log(`[user-management] User ${uid}: Starting initialization`);
    console.log(`[user-management] User ${uid}: isNewUserFromClient=${isNewUserFromClient}, hasOverrides=${Object.keys(userDataOverrides).length > 0}`);
    
    try {
        console.log(`[user-management] User ${uid}: Step 1 - Getting auth user from Firebase Auth...`);
        const authUser = await getUserByUid(uid);
        console.log(`[user-management] User ${uid}: Auth user retrieved - email=${authUser.email}, creationTime=${authUser.creationTime}`);
        
        const nowIso = new Date().toISOString();
        
        console.log(`[user-management] User ${uid}: Step 2 - Using credits V3 service (eager-loaded at startup)`);
        
        // Store authUser.creationTime for use inside transaction
        const authCreationTime = authUser.creationTime ? (authUser.creationTime instanceof Date ? authUser.creationTime : new Date(authUser.creationTime)) : null;
        
        console.log(`[user-management] User ${uid}: Step 3 - Starting Firestore transaction...`);
        const result = await db.runTransaction(async (transaction) => {
            console.log(`[user-management] User ${uid}: Inside transaction - Getting document references...`);
            const userRef = db.collection('users').doc(uid);
            const creditsRef = db.collection('user_credits_v3').doc(uid);
            
            // Get user and credits documents in parallel
            console.log(`[user-management] User ${uid}: Inside transaction - Fetching documents (users, user_credits_v3)...`);
            const docPromises = [
                transaction.get(userRef),
                transaction.get(creditsRef)
            ];
            const docs = await Promise.all(docPromises);
            const userDoc = docs[0];
            const creditsDoc = docs[1];
            
            const userExists = userDoc.exists;
            const creditsExist = creditsDoc.exists;
            
            console.log(`[user-management] User ${uid}: Documents fetched - userExists=${userExists}, creditsExist=${creditsExist}`);
            
            // Determine if this is a new user - prioritize isNewUserFromClient flag
            // If both documents exist, user is definitely not new (unless client explicitly says otherwise)
            const isNewUser = isNewUserFromClient === true || (!userExists || !creditsExist);
            console.log(`[user-management] User ${uid}: Determining isNewUser - isNewUserFromClient=${isNewUserFromClient}, calculated isNewUser=${isNewUser}`);
            
            // If all documents exist AND user is NOT new (client didn't say it's new), check if welcome credit was granted
            // This optimization prevents unnecessary processing for existing users, but still checks for welcome credit
            // Optimization: return early only if user is fully initialized
            if (userExists && creditsExist && isNewUserFromClient !== true) {
                const existingCredits = creditsDoc.data();
                // Use total from document (single source of truth), fallback to calculation for backward compatibility
                const existingTotal = existingCredits.total !== undefined 
                    ? existingCredits.total 
                    : ((existingCredits.balances?.paid || 0) + (existingCredits.balances?.free || 0) + (existingCredits.balances?.bonus || 0));
                const welcomeCreditGranted = existingCredits.metadata?.welcomeCreditGranted || false;
                
                // Check if user was created recently (within last 10 minutes) and doesn't have welcome credit
                // This handles cases where user was created but welcome credit wasn't granted
                const userData = userDoc.data();
                // Try multiple sources for creation time: userData.createdAt, authUser.creationTime
                let userCreatedAt = null;
                if (userData.createdAt) {
                    userCreatedAt = userData.createdAt.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt);
                } else if (authCreationTime) {
                    userCreatedAt = authCreationTime;
                }
                const isRecentlyCreated = userCreatedAt && (Date.now() - userCreatedAt.getTime()) < 10 * 60 * 1000; // 10 minutes
                
                // If user is recently created and doesn't have welcome credit, grant it
                // Also check if total is 0 OR if welcomeCreditGranted is false (handles edge cases)
                if (isRecentlyCreated && !welcomeCreditGranted && existingTotal === 0) {
                    console.log(`[user-management] User ${uid}: ⚠️ RECENTLY CREATED USER - Credits exist but welcome credit not granted, granting now`);
                    transaction.update(creditsRef, {
                        'balances.free': admin.firestore.FieldValue.increment(1),
                        'total': admin.firestore.FieldValue.increment(1),
                        'metadata.welcomeCreditGranted': true,
                        'metadata.lastCreditGrant': admin.firestore.FieldValue.serverTimestamp(),
                        'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    const updatedCredits = {
                        ...existingCredits,
                        balances: {
                            ...existingCredits.balances,
                            free: (existingCredits.balances?.free || 0) + 1
                        },
                        total: existingTotal + 1,
                        metadata: {
                            ...existingCredits.metadata,
                            welcomeCreditGranted: true,
                            lastCreditGrant: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }
                    };
                    
                    console.log(`[user-management] User ${uid}: ✅ WELCOME CREDIT GRANTED - Updated credits for recently created user`);
                    return {
                        created: false,
                        updated: true,
                        unchanged: false,
                        user: userData,
                        credits: updatedCredits,
                        _needsCreditsInit: false,
                        _isNewUser: false
                    };
                }
                
                // User is fully initialized and welcome credit already granted (or user is not new), return early
                console.log(`[user-management] User ${uid}: All documents exist and user is NOT new (isNewUserFromClient !== true), returning existing data`);
                const result = {
                    created: false,
                    updated: false,
                    unchanged: true,
                    user: userData,
                    credits: existingCredits,
                    _needsCreditsInit: false,
                    _isNewUser: false
                };
                console.log(`[user-management] User ${uid}: Returning early - user already fully initialized`);
                return result;
            }
            
            // If we reach here, either:
            // 1. Some documents don't exist (new user)
            // 2. All documents exist BUT isNewUserFromClient === true (race condition - need to check/update credits)
            // Continue to process user documents and credits below
            
            // Prepare user document
            console.log(`[user-management] User ${uid}: Step 4 - Preparing user document...`);
            const existingUserData = userExists ? userDoc.data() : null;
            
            // Always update lastActive if user signs in (use lastSignInTime from Auth)
            // If no lastSignInTime, use existing lastActive or current time
            const lastActiveValue = authUser.lastSignInTime 
                ? (authUser.lastSignInTime instanceof Date 
                    ? authUser.lastSignInTime.toISOString() 
                    : new Date(authUser.lastSignInTime).toISOString())
                : (existingUserData?.lastActive || nowIso);
            
            const userDocToWrite = {
                email: authUser.email,
                displayName: authUser.displayName || (authUser.email ? authUser.email.split('@')[0] : ''),
                emailVerified: authUser.emailVerified,
                disabled: authUser.disabled,
                lastActive: lastActiveValue,
                ...userDataOverrides
            };
            
            if (!userExists) {
                console.log(`[user-management] User ${uid}: Creating NEW user document`);
                userDocToWrite.createdAt = authUser.creationTime || nowIso;
                if (userDocToWrite.plan === undefined) {
                    userDocToWrite.plan = 'free';
                }
                // Note: free_specs_remaining is deprecated - credits are now managed in user_credits_v3 collection
                // Do not set free_specs_remaining here - use user_credits_v3 as single source of truth
            } else {
                console.log(`[user-management] User ${uid}: Updating EXISTING user document`);
                userDocToWrite.createdAt = existingUserData?.createdAt || authUser.creationTime || nowIso;
                // Ensure lastActive is always updated for existing users when they sign in
                if (authUser.lastSignInTime) {
                    userDocToWrite.lastActive = lastActiveValue;
                }
            }
            
            // Remove undefined values
            Object.keys(userDocToWrite).forEach((key) => {
                if (userDocToWrite[key] === undefined) {
                    delete userDocToWrite[key];
                }
            });
            
            console.log(`[user-management] User ${uid}: User document prepared - email=${userDocToWrite.email}, plan=${userDocToWrite.plan}`);
            
            // Write user document
            if (!userExists) {
                console.log(`[user-management] User ${uid}: Writing NEW user document to Firestore...`);
                transaction.set(userRef, userDocToWrite);
                console.log(`[user-management] User ${uid}: User document SET in transaction`);
            } else if (Object.keys(userDocToWrite).length > 0) {
                console.log(`[user-management] User ${uid}: Updating EXISTING user document in Firestore...`);
                transaction.update(userRef, userDocToWrite);
                console.log(`[user-management] User ${uid}: User document UPDATED in transaction`);
            } else {
                console.log(`[user-management] User ${uid}: No changes to user document, skipping write`);
            }
            
            console.log(`[user-management] User ${uid}: Step 5 - Handling user_credits document...`);
            console.log(`[user-management] User ${uid}: Document status - userExists=${userExists}, creditsExist=${creditsExist}, isNewUser=${isNewUser}`);
            
            // Initialize user_credits atomically in transaction
            let finalCredits = null;
            if (!creditsExist) {
                console.log(`[user-management] User ${uid}: user_credits document does NOT exist, creating...`);
                // If this is a new user (explicitly marked or missing documents), give welcome credit
                if (isNewUser) {
                    console.log(`[user-management] User ${uid}: Calling getInitialCreditsForNewUser() to create credits with 1 free credit...`);
                    const initialCredits = creditsV3Service.getInitialCreditsForNewUser(uid);
                    console.log(`[user-management] User ${uid}: Initial credits structure created - free=${initialCredits.balances.free}, paid=${initialCredits.balances.paid}, bonus=${initialCredits.balances.bonus}`);
                    transaction.set(creditsRef, initialCredits);
                    finalCredits = initialCredits;
                    console.log(`[user-management] User ${uid}: ✅ NEW USER - user_credits SET in transaction with 1 free welcome credit`);
                } else {
                    console.log(`[user-management] User ${uid}: NOT a new user, calling getDefaultCredits() to create credits with 0 credits...`);
                    // Fallback: create default credits (0 credits) for existing users
                    const defaultCredits = creditsV3Service.getDefaultCredits(uid);
                    console.log(`[user-management] User ${uid}: Default credits structure created - free=${defaultCredits.balances.free}, paid=${defaultCredits.balances.paid}, bonus=${defaultCredits.balances.bonus}`);
                    transaction.set(creditsRef, defaultCredits);
                    finalCredits = defaultCredits;
                    console.log(`[user-management] User ${uid}: ⚠️ EXISTING USER - user_credits SET in transaction with 0 credits (fallback)`);
                }
            } else {
                console.log(`[user-management] User ${uid}: user_credits document already exists, checking if update needed...`);
                finalCredits = creditsDoc.data();
                const existingTotal = (finalCredits.balances?.paid || 0) + (finalCredits.balances?.free || 0) + (finalCredits.balances?.bonus || 0);
                const welcomeCreditGranted = finalCredits.metadata?.welcomeCreditGranted || false;
                console.log(`[user-management] User ${uid}: Existing credits - total=${existingTotal}, breakdown=`, finalCredits.balances, `welcomeCreditGranted=${welcomeCreditGranted}, isNewUser=${isNewUser}, isNewUserFromClient=${isNewUserFromClient}`);
                
                // If this is a new user (explicitly marked by client), ensure they have welcome credit
                // This handles race conditions where documents were created before credits were granted
                if (isNewUser && !welcomeCreditGranted) {
                    // New user but welcome credit not granted - grant it now
                    console.log(`[user-management] User ${uid}: ⚠️ NEW USER DETECTED - Credits exist but welcome credit not granted, updating to give welcome credit`);
                    console.log(`[user-management] User ${uid}: Current total=${existingTotal}, will grant 1 free credit`);
                    
                    // Update existing credits to grant welcome credit
                    transaction.update(creditsRef, {
                        'balances.free': admin.firestore.FieldValue.increment(1),
                        'total': admin.firestore.FieldValue.increment(1),
                        'metadata.welcomeCreditGranted': true,
                        'metadata.lastCreditGrant': admin.firestore.FieldValue.serverTimestamp(),
                        'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    // Update finalCredits to reflect the change
                    finalCredits = {
                        ...finalCredits,
                        balances: {
                            ...finalCredits.balances,
                            free: (finalCredits.balances?.free || 0) + 1
                        },
                        total: existingTotal + 1,
                        metadata: {
                            ...finalCredits.metadata,
                            welcomeCreditGranted: true,
                            lastCreditGrant: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }
                    };
                    
                    console.log(`[user-management] User ${uid}: ✅ WELCOME CREDIT GRANTED - Updated credits to grant 1 free welcome credit`);
                    console.log(`[user-management] User ${uid}: Updated credits - total=${existingTotal + 1}, breakdown=`, finalCredits.balances);
                } else if (isNewUser && welcomeCreditGranted && existingTotal === 0) {
                    // Edge case: welcome credit was marked as granted but credits are 0
                    // This shouldn't happen, but handle it gracefully
                    console.log(`[user-management] User ${uid}: ⚠️ EDGE CASE - New user with welcomeCreditGranted=true but total=0, granting credit anyway`);
                    transaction.update(creditsRef, {
                        'balances.free': admin.firestore.FieldValue.increment(1),
                        'total': admin.firestore.FieldValue.increment(1),
                        'metadata.lastCreditGrant': admin.firestore.FieldValue.serverTimestamp(),
                        'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    finalCredits = {
                        ...finalCredits,
                        balances: {
                            ...finalCredits.balances,
                            free: (finalCredits.balances?.free || 0) + 1
                        },
                        total: existingTotal + 1,
                        metadata: {
                            ...finalCredits.metadata,
                            lastCreditGrant: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }
                    };
                    
                    console.log(`[user-management] User ${uid}: ✅ EDGE CASE FIXED - Granted 1 free credit`);
                } else {
                    console.log(`[user-management] User ${uid}: Credits already properly initialized, no update needed`);
                }
            }

            console.log(`[user-management] User ${uid}: Step 6 - Building result object...`);
            const result = {
                created: !userExists || !creditsExist,
                updated: userExists && creditsExist && Object.keys(userDocToWrite).length > 0,
                unchanged: userExists && creditsExist && Object.keys(userDocToWrite).length === 0,
                user: { ...(existingUserData || {}), ...userDocToWrite },
                credits: finalCredits,
                _needsCreditsInit: false, // Credits already initialized in transaction
                _isNewUser: isNewUser
            };
            
            // Use total from document (single source of truth), fallback to calculation for backward compatibility
            const totalCreditsInResult = result.credits 
                ? (result.credits.total !== undefined 
                    ? result.credits.total 
                    : ((result.credits.balances?.paid || 0) + (result.credits.balances?.free || 0) + (result.credits.balances?.bonus || 0)))
                : 0;
            
            console.log(`[user-management] User ${uid}: Result object built - created=${result.created}, updated=${result.updated}, unchanged=${result.unchanged}, isNewUser=${result._isNewUser}, totalCredits=${totalCreditsInResult}`);
            console.log(`[user-management] User ${uid}: Transaction complete, isNewUser=${isNewUser}, creditsCreated=${!creditsExist}`);
            console.log(`[user-management] User ${uid}: About to commit transaction...`);
            
            return result;
        });
        
        const transactionTime = Date.now() - startTime;
        console.log(`[user-management] User ${uid}: ✅ Transaction committed successfully in ${transactionTime}ms`);
        
        // Credits are now initialized atomically in the transaction above
        // No need for post-transaction credit initialization
        console.log(`[user-management] User ${uid}: Step 8 - Processing transaction result...`);
        console.log(`[user-management] After transaction for user ${uid}: result exists:`, !!result, 'result._isNewUser:', result?._isNewUser, 'creditsCreated:', !!result?.credits);
        
        // Ensure _isNewUser is never null in the final result
        if (result && result._isNewUser === null) {
            console.log(`[user-management] User ${uid}: ⚠️ WARNING - result._isNewUser is null, applying fallback logic...`);
            result._isNewUser = isNewUserFromClient === true || false;
            console.log(`[user-management] User ${uid}: Fallback applied - result._isNewUser set to ${result._isNewUser}`);
        }
        
        // Record activity for new user registration (welcome email is sent from user-routes.js to avoid duplicates)
        if (result && result._isNewUser === true) {
            const userEmail = authUser.email || result.user?.email || null;
            const displayName = authUser.displayName || result.user?.displayName || userEmail?.split('@')[0] || uid;
            
            // Record user registration (non-blocking)
            recordUserRegistration(uid, userEmail, displayName, {
                plan: result.user?.plan || 'free'
            }).catch(err => {
                console.error(`[user-management] Failed to record user registration activity:`, err);
            });
            
            // NOTE: Welcome email is now sent from user-routes.js (/api/users/initialize)
            // to avoid duplicate emails. This ensures only one welcome email is sent per new user.
        }
        
        // Log credits info for debugging
        if (result && result.credits) {
            const totalCredits = (result.credits.balances?.paid || 0) + 
                                (result.credits.balances?.free || 0) + 
                                (result.credits.balances?.bonus || 0);
            console.log(`[user-management] User ${uid}: Final credits summary - total=${totalCredits}, breakdown=`, JSON.stringify(result.credits.balances));
            console.log(`[user-management] User ${uid}: welcomeCreditGranted=${result.credits.metadata?.welcomeCreditGranted || false}`);
        } else {
            console.log(`[user-management] User ${uid}: ⚠️ WARNING - result.credits is missing!`);
        }
        
        const totalTime = Date.now() - startTime;
        console.log(`[user-management] User ${uid}: ========== END initializeUser (SUCCESS) - Total time: ${totalTime}ms ==========`);
        console.log(`[user-management] User ${uid}: Returning result - created=${result.created}, isNewUser=${result._isNewUser}, hasCredits=${!!result.credits}`);
        
        return result;
    } catch (error) {
        const totalTime = Date.now() - startTime;
        // Log error with context
        console.error(`[user-management] ========== ERROR in initializeUser for ${uid} (after ${totalTime}ms) ==========`);
        console.error(`[user-management] User ${uid}: ERROR occurred during initialization`);
        console.error(`[user-management] User ${uid}: Error type:`, error.constructor.name);
        console.error(`[user-management] User ${uid}: Error message:`, error.message);
        console.error(`[user-management] User ${uid}: Error stack:`, error.stack);
        console.error(`[user-management] User ${uid}: Input parameters - isNewUserFromClient=${isNewUserFromClient}, hasOverrides=${Object.keys(userDataOverrides || {}).length > 0}`);
        // Re-throw error - don't swallow it
        throw error;
    }
}

// ensureEntitlementDocument removed - no longer using entitlements collection

/**
 * Sync all users - create Firestore documents for users who don't have them
 */
async function syncAllUsers(options = {}) {
    const {
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
            errors: 0,
            errorDetails: [],
            potentialCreates: 0
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
                        // Use initializeUser for atomicity (creates users and user_credits)
                        const result = await initializeUser(user.uid);
                        
                        if (result.created) {
                            summary.created += 1;
                        } else if (result.updated) {
                            summary.updated += 1;
                        } else {
                            summary.unchanged += 1;
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

        const authWithoutFirestore = [...authUserIds].filter((id) => !firestoreUserIds.has(id));
        const firestoreWithoutAuth = [...firestoreUserIds].filter((id) => !authUserIds.has(id));

        summary.firestoreTotal = firestoreUsersSnapshot.size;
        summary.inconsistencies = {
            authWithoutFirestore: summarizeIdList(authWithoutFirestore),
            firestoreWithoutAuth: summarizeIdList(firestoreWithoutAuth)
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
    initializeUser,
    syncAllUsers,
    getUserStats,
    getLastUserSyncReport,
    cleanupOrphanedData,
    deleteUser
};
