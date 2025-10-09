#!/usr/bin/env node

/**
 * One-time script to sync all users from Firebase Auth to Firestore
 * This creates user documents in the 'users' collection for all existing users
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// Using the same configuration as the backend
const firebaseConfig = {
    apiKey: "AIzaSyB9hr0IWM4EREzkKDxBxYoYinV6LJXWXV4",
    authDomain: "specify-ai.firebaseapp.com",
    projectId: "specify-ai",
    storageBucket: "specify-ai.firebasestorage.app",
    messagingSenderId: "734278787482",
    appId: "1:734278787482:web:0e312fb6f197e849695a23",
    measurementId: "G-4YR9LK63MR"
};

// Initialize admin with default credentials
// Make sure you're logged in with: firebase login
admin.initializeApp({
    projectId: firebaseConfig.projectId
});

const auth = admin.auth();
const db = admin.firestore();

async function syncAllUsers() {
    console.log('🔄 Starting user sync process...\n');
    
    try {
        // Get all users from Firebase Auth
        const listUsersResult = await auth.listUsers(1000); // Max 1000 users
        console.log(`📊 Found ${listUsersResult.users.length} users in Firebase Auth\n`);
        
        let synced = 0;
        let alreadyExists = 0;
        let errors = 0;
        
        // Process each user
        for (const user of listUsersResult.users) {
            try {
                const userRef = db.collection('users').doc(user.uid);
                const userDoc = await userRef.get();
                
                if (!userDoc.exists) {
                    // Create new user document
                    await userRef.set({
                        email: user.email,
                        displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'Unknown'),
                        emailVerified: user.emailVerified,
                        createdAt: user.metadata.creationTime,
                        lastActive: user.metadata.lastSignInTime || user.metadata.creationTime,
                        newsletterSubscription: false
                    });
                    
                    console.log(`✅ Created user document for: ${user.email}`);
                    synced++;
                } else {
                    console.log(`ℹ️  User already exists: ${user.email}`);
                    alreadyExists++;
                }
            } catch (error) {
                console.error(`❌ Error syncing user ${user.email}:`, error.message);
                errors++;
            }
        }
        
        console.log('\n═══════════════════════════════════════');
        console.log('📊 Sync Summary:');
        console.log('═══════════════════════════════════════');
        console.log(`✅ Successfully synced: ${synced}`);
        console.log(`ℹ️  Already existed: ${alreadyExists}`);
        console.log(`❌ Errors: ${errors}`);
        console.log(`📊 Total processed: ${listUsersResult.users.length}`);
        console.log('═══════════════════════════════════════\n');
        
        if (synced > 0) {
            console.log('🎉 User sync completed successfully!');
            console.log('💡 Now refresh your Admin Dashboard to see all users.\n');
        } else if (alreadyExists === listUsersResult.users.length) {
            console.log('✅ All users were already synced!');
            console.log('💡 Your Admin Dashboard should already show all users.\n');
        }
        
    } catch (error) {
        console.error('❌ Fatal error during sync:', error);
        console.log('\n💡 Common issues:');
        console.log('1. Make sure you ran: firebase login');
        console.log('2. Make sure you have admin access to the project');
        console.log('3. Check your internet connection\n');
        process.exit(1);
    }
}

// Run the sync
syncAllUsers()
    .then(() => {
        console.log('✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });

