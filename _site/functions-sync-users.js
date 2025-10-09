/**
 * Firebase Cloud Function to sync all users from Auth to Firestore
 * Deploy this to Firebase Functions and call it from the Admin Dashboard
 * 
 * To deploy:
 * 1. Create a functions folder: mkdir -p functions
 * 2. Copy this file: cp functions-sync-users.js functions/index.js
 * 3. Create package.json in functions folder
 * 4. Run: cd functions && npm install firebase-admin firebase-functions
 * 5. Deploy: firebase deploy --only functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// Callable function that can be invoked from the client
exports.syncAllUsers = functions.https.onCall(async (data, context) => {
    // Check if the user is authenticated and is an admin
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const adminEmails = [
        'specifysai@gmail.com',
        'admin@specifys.ai',
        'shalom@specifys.ai'
    ];

    if (!adminEmails.includes(context.auth.token.email.toLowerCase())) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can sync users');
    }

    console.log('🔄 Admin user syncing all users:', context.auth.token.email);

    try {
        const auth = admin.auth();
        const db = admin.firestore();

        // Get all users from Firebase Auth
        const listUsersResult = await auth.listUsers(1000);
        console.log(`Found ${listUsersResult.users.length} users in Firebase Auth`);

        let synced = 0;
        let alreadyExists = 0;
        let errors = 0;

        // Process each user
        for (const user of listUsersResult.users) {
            try {
                const userRef = db.collection('users').doc(user.uid);
                const userDoc = await userRef.get();

                if (!userDoc.exists) {
                    await userRef.set({
                        email: user.email,
                        displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'Unknown'),
                        emailVerified: user.emailVerified,
                        createdAt: user.metadata.creationTime,
                        lastActive: user.metadata.lastSignInTime || user.metadata.creationTime,
                        newsletterSubscription: false
                    });
                    synced++;
                } else {
                    alreadyExists++;
                }
            } catch (error) {
                console.error(`Error syncing user ${user.email}:`, error);
                errors++;
            }
        }

        const result = {
            success: true,
            synced,
            alreadyExists,
            errors,
            total: listUsersResult.users.length
        };

        console.log('✅ Sync completed:', result);
        return result;

    } catch (error) {
        console.error('❌ Fatal error during sync:', error);
        throw new functions.https.HttpsError('internal', 'Failed to sync users: ' + error.message);
    }
});

