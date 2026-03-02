/**
 * Fix Pro User Script
 * 
 * Usage: node backend/scripts/fix-pro-user.js USER_ID
 * 
 * This script fixes a Pro user whose user_credits were not properly set
 */

const { db, admin } = require('../server/firebase-admin');
const creditsV3Service = require('../server/credits-v3-service');

const userId = process.argv[2];

if (!userId) {
    console.error('❌ Error: Please provide a user ID');
    console.log('Usage: node backend/scripts/fix-pro-user.js USER_ID');
    process.exit(1);
}

async function fixProUser(uid) {
    try {
        console.log(`\n🔧 Fixing Pro user: ${uid}`);
        console.log('================================\n');
        
        // Check current state
        console.log('📋 Current State:');
        const userDoc = await db.collection('users').doc(uid).get();
        const creditsDoc = await db.collection('user_credits_v3').doc(uid).get();
        
        if (!userDoc.exists) {
            console.error('❌ User not found!');
            process.exit(1);
        }
        
        console.log('User plan:', userDoc.data().plan);
        console.log('User credits:', creditsDoc.exists() ? creditsDoc.data() : 'Document not found');
        
        // Fix the user
        console.log('\n🔧 Applying fixes...\n');
        
        // Update user plan
        const userRef = db.collection('users').doc(uid);
        await userRef.update({ 
            plan: 'pro',
            last_entitlement_sync_at: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('✓ Set user plan to "pro"');
        
        // Fix user_credits_v3 using enableProSubscription
        await creditsV3Service.enableProSubscription(uid, {
            plan: 'pro',
            subscriptionStatus: 'active'
        });
        console.log('✓ Enabled Pro subscription in user_credits_v3');
        
        console.log('\n✅ Pro user fixed successfully!');
        
        // Verify
        console.log('\n📋 New State:');
        const newUserDoc = await userRef.get();
        const newCreditsDoc = await db.collection('user_credits_v3').doc(uid).get();
        console.log('User plan:', newUserDoc.data().plan);
        console.log('User credits:', newCreditsDoc.exists() ? newCreditsDoc.data() : 'Document not found');
        
        console.log('\n✅ Done! User should now see "Unlimited" in the credits display.');
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Error fixing Pro user:', error);
        process.exit(1);
    }
}

fixProUser(userId);

