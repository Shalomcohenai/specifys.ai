const { db, auth } = require('./firebase-admin');

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
        console.error('Error getting users:', error);
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
        console.error(`Error getting user ${uid}:`, error);
        throw error;
    }
}

/**
 * Create or update user document in Firestore
 */
async function createOrUpdateUserDocument(uid, userData = {}) {
    try {
        const userDocRef = db.collection('users').doc(uid);
        
        // Get current user data from Auth
        const authUser = await getUserByUid(uid);
        
        const userDoc = {
            email: authUser.email,
            displayName: authUser.displayName || authUser.email.split('@')[0],
            emailVerified: authUser.emailVerified,
            disabled: authUser.disabled,
            createdAt: authUser.creationTime,
            lastActive: authUser.lastSignInTime || new Date().toISOString(),
            ...userData // Allow overriding with custom data
        };
        
        await userDocRef.set(userDoc, { merge: true });
        console.log(`✅ User document created/updated for ${uid}`);
        
        return userDoc;
    } catch (error) {
        console.error(`Error creating/updating user document for ${uid}:`, error);
        throw error;
    }
}

/**
 * Sync all users - create Firestore documents for users who don't have them
 */
async function syncAllUsers() {
    try {
        console.log('🔄 Starting user sync process...');
        
        const authUsers = await getAllUsers();
        console.log(`Found ${authUsers.length} users in Firebase Auth`);
        
        let synced = 0;
        let alreadyExists = 0;
        let errors = 0;
        
        for (const user of authUsers) {
            try {
                const userDocRef = db.collection('users').doc(user.uid);
                const userDoc = await userDocRef.get();
                
                if (!userDoc.exists) {
                    await createOrUpdateUserDocument(user.uid);
                    synced++;
                    console.log(`✅ Created user document for ${user.email}`);
                } else {
                    // Update existing user with latest data
                    await createOrUpdateUserDocument(user.uid);
                    alreadyExists++;
                    console.log(`🔄 Updated user document for ${user.email}`);
                }
            } catch (error) {
                console.error(`❌ Failed to sync user ${user.email}:`, error.message);
                errors++;
            }
        }
        
        console.log(`🎉 Sync completed!`);
        console.log(`- New user documents created: ${synced}`);
        console.log(`- Existing user documents updated: ${alreadyExists}`);
        console.log(`- Errors: ${errors}`);
        
        return {
            total: authUsers.length,
            synced,
            alreadyExists,
            errors
        };
    } catch (error) {
        console.error('Error during user sync:', error);
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
        console.error('Error getting user stats:', error);
        throw error;
    }
}

/**
 * Clean up orphaned data - remove data that references non-existent users
 */
async function cleanupOrphanedData() {
    try {
        console.log('🧹 Starting orphaned data cleanup...');
        
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
                console.log(`🗑️ Deleted orphaned spec: ${doc.id}`);
            }
        }
        
        // Clean apps
        const appsSnapshot = await db.collection('apps').get();
        for (const doc of appsSnapshot.docs) {
            const data = doc.data();
            if (data.userId && !authUserIds.has(data.userId)) {
                await db.collection('apps').doc(doc.id).delete();
                cleanedApps++;
                console.log(`🗑️ Deleted orphaned app: ${doc.id}`);
            }
        }
        
        // Clean market research
        const marketSnapshot = await db.collection('marketResearch').get();
        for (const doc of marketSnapshot.docs) {
            const data = doc.data();
            if (data.userId && !authUserIds.has(data.userId)) {
                await db.collection('marketResearch').doc(doc.id).delete();
                cleanedMarket++;
                console.log(`🗑️ Deleted orphaned market research: ${doc.id}`);
            }
        }
        
        console.log(`🎉 Cleanup completed!`);
        console.log(`- Orphaned specs deleted: ${cleanedSpecs}`);
        console.log(`- Orphaned apps deleted: ${cleanedApps}`);
        console.log(`- Orphaned market research deleted: ${cleanedMarket}`);
        
        return {
            cleanedSpecs,
            cleanedApps,
            cleanedMarket,
            total: cleanedSpecs + cleanedApps + cleanedMarket
        };
    } catch (error) {
        console.error('Error during cleanup:', error);
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
        
        console.log(`✅ User ${uid} completely deleted`);
        return true;
    } catch (error) {
        console.error(`Error deleting user ${uid}:`, error);
        throw error;
    }
}

module.exports = {
    getAllUsers,
    getUserByUid,
    createOrUpdateUserDocument,
    syncAllUsers,
    getUserStats,
    cleanupOrphanedData,
    deleteUser
};
