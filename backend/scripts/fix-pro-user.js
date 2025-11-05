/**
 * Fix Pro User Script
 * 
 * Usage: node backend/scripts/fix-pro-user.js USER_ID
 * 
 * This script fixes a Pro user whose entitlements were not properly set
 * due to the batch.update bug in enableProSubscription
 */

const { db, admin } = require('../server/firebase-admin');

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
        const entDoc = await db.collection('entitlements').doc(uid).get();
        
        if (!userDoc.exists) {
            console.error('❌ User not found!');
            process.exit(1);
        }
        
        console.log('User plan:', userDoc.data().plan);
        console.log('Entitlements:', entDoc.exists() ? entDoc.data() : 'Document not found');
        
        // Fix the user
        console.log('\n🔧 Applying fixes...\n');
        const batch = db.batch();
        
        // Update user plan
        const userRef = db.collection('users').doc(uid);
        batch.update(userRef, { 
            plan: 'pro',
            last_entitlement_sync_at: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('✓ Set user plan to "pro"');
        
        // Fix entitlements using set with merge (the correct way)
        const entRef = db.collection('entitlements').doc(uid);
        batch.set(entRef, {
            unlimited: true,
            can_edit: true,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log('✓ Set unlimited=true and can_edit=true');
        
        await batch.commit();
        console.log('\n✅ Pro user fixed successfully!');
        
        // Verify
        console.log('\n📋 New State:');
        const newUserDoc = await userRef.get();
        const newEntDoc = await entRef.get();
        console.log('User plan:', newUserDoc.data().plan);
        console.log('Entitlements:', newEntDoc.data());
        
        console.log('\n✅ Done! User should now see "pro" in the credits display.');
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Error fixing Pro user:', error);
        process.exit(1);
    }
}

fixProUser(userId);

