/**
 * Check User Entitlements Script
 * 
 * Usage: node backend/scripts/check-user-entitlements.js USER_ID
 * 
 * This script provides a detailed report of a user's entitlements and status
 */

const { db } = require('../server/firebase-admin');

const userId = process.argv[2];

if (!userId) {
    console.error('❌ Error: Please provide a user ID');
    console.log('Usage: node backend/scripts/check-user-entitlements.js USER_ID');
    process.exit(1);
}

async function checkUser(uid) {
    try {
        console.log('\n📊 User Status Report');
        console.log('==========================================');
        console.log('User ID:', uid);
        console.log('==========================================\n');
        
        // Get user document
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists) {
            console.error('❌ User not found!');
            process.exit(1);
        }
        
        const userData = userDoc.data();
        
        // Get entitlements
        const entDoc = await db.collection('entitlements').doc(uid).get();
        const entData = entDoc.exists() ? entDoc.data() : null;
        
        // Get subscription
        const subDoc = await db.collection('subscriptions').doc(uid).get();
        const subData = subDoc.exists() ? subDoc.data() : null;
        
        // Display results
        console.log('👤 User Document:');
        console.log('─────────────────────────────────────────');
        console.log('  Email:', userData.email || 'N/A');
        console.log('  Display Name:', userData.displayName || 'N/A');
        console.log('  Plan:', userData.plan || 'free');
        console.log('  Free Specs Remaining:', userData.free_specs_remaining !== undefined ? userData.free_specs_remaining : 'Not set (defaults to 1)');
        console.log('  Created:', userData.createdAt || 'N/A');
        console.log('  Last Active:', userData.lastActive || 'N/A');
        
        console.log('\n💳 Entitlements:');
        console.log('─────────────────────────────────────────');
        if (entData) {
            console.log('  Unlimited:', entData.unlimited ? '✅ YES (Pro User)' : '❌ NO');
            console.log('  Can Edit:', entData.can_edit ? '✅ YES' : '❌ NO');
            console.log('  Spec Credits:', entData.spec_credits || 0);
            console.log('  Preserved Credits:', entData.preserved_credits || 0);
            console.log('  Updated At:', entData.updated_at ? entData.updated_at.toDate().toISOString() : 'N/A');
        } else {
            console.log('  ❌ No entitlements document found!');
        }
        
        console.log('\n📅 Subscription:');
        console.log('─────────────────────────────────────────');
        if (subData) {
            console.log('  Status:', subData.status || 'N/A');
            console.log('  Lemon Subscription ID:', subData.lemon_subscription_id || 'N/A');
            console.log('  Product ID:', subData.product_id || 'N/A');
            console.log('  Variant ID:', subData.variant_id || 'N/A');
            console.log('  Current Period End:', subData.current_period_end ? subData.current_period_end.toDate().toISOString() : 'N/A');
            console.log('  Cancel at Period End:', subData.cancel_at_period_end ? 'YES' : 'NO');
        } else {
            console.log('  ⚪ No active subscription');
        }
        
        // Summary
        console.log('\n📈 Summary:');
        console.log('─────────────────────────────────────────');
        
        let userType = 'Unknown';
        let canCreateSpecs = false;
        let remaining = 0;
        
        if (entData && entData.unlimited) {
            userType = '⭐ PRO USER (Unlimited)';
            canCreateSpecs = true;
            remaining = '∞';
        } else if (entData && entData.spec_credits > 0) {
            userType = '💰 CREDIT USER';
            canCreateSpecs = true;
            remaining = entData.spec_credits;
        } else if (userData.free_specs_remaining > 0) {
            userType = '🆓 FREE USER';
            canCreateSpecs = true;
            remaining = userData.free_specs_remaining;
        } else {
            userType = '❌ DEPLETED USER';
            canCreateSpecs = false;
            remaining = 0;
        }
        
        console.log('  User Type:', userType);
        console.log('  Can Create Specs:', canCreateSpecs ? '✅ YES' : '❌ NO');
        console.log('  Remaining:', remaining);
        
        // Recommendations
        console.log('\n💡 Recommendations:');
        console.log('─────────────────────────────────────────');
        
        if (userData.plan === 'pro' && (!entData || !entData.unlimited)) {
            console.log('  ⚠️  WARNING: User plan is "pro" but unlimited is not true!');
            console.log('  → Run: node backend/scripts/fix-pro-user.js', uid);
        }
        
        if (!entDoc.exists()) {
            console.log('  ⚠️  WARNING: No entitlements document exists!');
            console.log('  → This should be created automatically on user creation');
        }
        
        if (entData && entData.unlimited && !subData) {
            console.log('  ℹ️  INFO: User has unlimited access but no subscription record');
            console.log('  → This might be a manually granted Pro access');
        }
        
        console.log('\n✅ Check completed!\n');
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Error checking user:', error);
        process.exit(1);
    }
}

checkUser(userId);

