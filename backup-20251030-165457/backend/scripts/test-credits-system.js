/**
 * Credits System Tests
 * 
 * Usage: node backend/scripts/test-credits-system.js
 * 
 * This script runs comprehensive tests on the credits system
 */

const { db, admin } = require('../server/firebase-admin');
const { 
    grantCredits, 
    enableProSubscription, 
    revokeProSubscription,
    consumeSpecCredit,
    checkUserCanCreateSpec,
    getUserEntitlements
} = require('../server/entitlement-service');

// Test counters
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

// Test scenarios
const tests = {
    async testNewUser() {
        console.log('\n🧪 Test 1: New User Creation');
        console.log('────────────────────────────────────');
        const testUserId = 'test_user_' + Date.now();
        
        try {
            // Create user
            const userRef = db.collection('users').doc(testUserId);
            await userRef.set({
                email: 'test@example.com',
                plan: 'free',
                free_specs_remaining: 1,
                displayName: 'Test User'
            });
            
            // Create entitlements
            const entRef = db.collection('entitlements').doc(testUserId);
            await entRef.set({
                spec_credits: 0,
                unlimited: false,
                can_edit: false,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
            
            // Verify
            const entDoc = await entRef.get();
            const entData = entDoc.data();
            
            assert(entDoc.exists, 'Entitlements document should exist');
            assert(entData.spec_credits === 0, 'Should have 0 spec credits');
            assert(entData.unlimited === false, 'Should not have unlimited');
            assert(entData.can_edit === false, 'Should not be able to edit');
            
            // Test getUserEntitlements
            const entitlements = await getUserEntitlements(testUserId);
            assert(entitlements.user.free_specs_remaining === 1, 'Should have 1 free spec');
            assert(entitlements.entitlements.spec_credits === 0, 'Should have 0 purchased credits');
            
            console.log('✅ New user created successfully');
            console.log('   - Free specs: 1');
            console.log('   - Spec credits: 0');
            console.log('   - Unlimited: false');
            
            // Cleanup
            await userRef.delete();
            await entRef.delete();
            
            return true;
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            // Cleanup on error
            try {
                await db.collection('users').doc(testUserId).delete();
                await db.collection('entitlements').doc(testUserId).delete();
            } catch (e) {}
            return false;
        }
    },
    
    async testPurchaseCredits() {
        console.log('\n🧪 Test 2: Purchase Credits');
        console.log('────────────────────────────────────');
        const testUserId = 'test_purchase_' + Date.now();
        
        try {
            // Create user
            await db.collection('users').doc(testUserId).set({
                email: 'test@example.com',
                plan: 'free',
                free_specs_remaining: 1
            });
            
            // Create entitlements
            await db.collection('entitlements').doc(testUserId).set({
                spec_credits: 0,
                unlimited: false,
                can_edit: false
            });
            
            // Grant credits (simulate purchase)
            const success = await grantCredits(testUserId, 3, 'test_order_123', 'test_variant');
            assert(success, 'grantCredits should succeed');
            
            // Verify
            const entDoc = await db.collection('entitlements').doc(testUserId).get();
            const entData = entDoc.data();
            
            assert(entData.spec_credits === 3, 'Should have 3 spec credits');
            
            // Check purchases collection
            const purchases = await db.collection('purchases')
                .where('userId', '==', testUserId)
                .get();
                
            assert(!purchases.empty, 'Purchase record should exist');
            assert(purchases.docs[0].data().credits_granted === 3, 'Purchase should show 3 credits');
            
            console.log('✅ Credits purchased successfully');
            console.log('   - Credits added: 3');
            console.log('   - Purchase record created: ✓');
            
            // Cleanup
            await db.collection('users').doc(testUserId).delete();
            await db.collection('entitlements').doc(testUserId).delete();
            for (const doc of purchases.docs) {
                await doc.ref.delete();
            }
            
            return true;
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            // Cleanup
            try {
                await db.collection('users').doc(testUserId).delete();
                await db.collection('entitlements').doc(testUserId).delete();
            } catch (e) {}
            return false;
        }
    },
    
    async testProUpgrade() {
        console.log('\n🧪 Test 3: Pro Upgrade (with preserved credits)');
        console.log('────────────────────────────────────');
        const testUserId = 'test_pro_' + Date.now();
        
        try {
            // Create user with credits
            await db.collection('users').doc(testUserId).set({
                email: 'test@example.com',
                plan: 'free',
                free_specs_remaining: 0
            });
            
            await db.collection('entitlements').doc(testUserId).set({
                spec_credits: 5,  // User has 5 purchased credits
                unlimited: false,
                can_edit: false
            });
            
            // Upgrade to Pro
            const futureDate = new Date();
            futureDate.setMonth(futureDate.getMonth() + 1);
            
            const success = await enableProSubscription(testUserId, 'test_sub_123', futureDate);
            assert(success, 'enableProSubscription should succeed');
            
            // Verify
            const userDoc = await db.collection('users').doc(testUserId).get();
            const entDoc = await db.collection('entitlements').doc(testUserId).get();
            const subDoc = await db.collection('subscriptions').doc(testUserId).get();
            
            assert(userDoc.data().plan === 'pro', 'User plan should be "pro"');
            assert(entDoc.data().unlimited === true, 'Should have unlimited access');
            assert(entDoc.data().can_edit === true, 'Should be able to edit');
            assert(subDoc.exists, 'Subscription record should exist');
            
            console.log('✅ Pro upgrade successful');
            console.log('   - Plan: pro');
            console.log('   - Unlimited: true');
            console.log('   - Can edit: true');
            console.log('   - Subscription created: ✓');
            
            // Cleanup
            await db.collection('users').doc(testUserId).delete();
            await db.collection('entitlements').doc(testUserId).delete();
            await db.collection('subscriptions').doc(testUserId).delete();
            
            return true;
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            // Cleanup
            try {
                await db.collection('users').doc(testUserId).delete();
                await db.collection('entitlements').doc(testUserId).delete();
                await db.collection('subscriptions').doc(testUserId).delete();
            } catch (e) {}
            return false;
        }
    },
    
    async testProDowngrade() {
        console.log('\n🧪 Test 4: Pro Downgrade');
        console.log('────────────────────────────────────');
        const testUserId = 'test_downgrade_' + Date.now();
        
        try {
            // Create Pro user
            await db.collection('users').doc(testUserId).set({
                email: 'test@example.com',
                plan: 'pro',
                free_specs_remaining: 0
            });
            
            await db.collection('entitlements').doc(testUserId).set({
                spec_credits: 0,
                unlimited: true,
                can_edit: true
            });
            
            await db.collection('subscriptions').doc(testUserId).set({
                status: 'active',
                lemon_subscription_id: 'test_sub_123'
            });
            
            // Downgrade
            const success = await revokeProSubscription(testUserId);
            assert(success, 'revokeProSubscription should succeed');
            
            // Verify
            const userDoc = await db.collection('users').doc(testUserId).get();
            const entDoc = await db.collection('entitlements').doc(testUserId).get();
            const subDoc = await db.collection('subscriptions').doc(testUserId).get();
            
            assert(userDoc.data().plan === 'free', 'User plan should be "free"');
            assert(entDoc.data().unlimited === false, 'Should not have unlimited');
            assert(entDoc.data().can_edit === false, 'Should not be able to edit');
            assert(subDoc.data().status === 'cancelled', 'Subscription should be cancelled');
            
            console.log('✅ Pro downgrade successful');
            console.log('   - Plan: free');
            console.log('   - Unlimited: false');
            console.log('   - Can edit: false');
            console.log('   - Subscription cancelled: ✓');
            
            // Cleanup
            await db.collection('users').doc(testUserId).delete();
            await db.collection('entitlements').doc(testUserId).delete();
            await db.collection('subscriptions').doc(testUserId).delete();
            
            return true;
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            // Cleanup
            try {
                await db.collection('users').doc(testUserId).delete();
                await db.collection('entitlements').doc(testUserId).delete();
                await db.collection('subscriptions').doc(testUserId).delete();
            } catch (e) {}
            return false;
        }
    },
    
    async testConsumeCredit() {
        console.log('\n🧪 Test 5: Consume Credit (Priority Hierarchy)');
        console.log('────────────────────────────────────');
        const testUserId = 'test_consume_' + Date.now();
        
        try {
            // Create user with both free specs and purchased credits
            await db.collection('users').doc(testUserId).set({
                email: 'test@example.com',
                plan: 'free',
                free_specs_remaining: 1
            });
            
            await db.collection('entitlements').doc(testUserId).set({
                spec_credits: 3,
                unlimited: false,
                can_edit: false
            });
            
            // Consume credit - should use free spec first
            const success = await consumeSpecCredit(testUserId);
            assert(success, 'consumeSpecCredit should succeed');
            
            // Verify - free spec should be 0, purchased credits should still be 3
            const userDoc = await db.collection('users').doc(testUserId).get();
            const entDoc = await db.collection('entitlements').doc(testUserId).get();
            
            assert(userDoc.data().free_specs_remaining === 0, 'Free specs should be 0');
            assert(entDoc.data().spec_credits === 3, 'Purchased credits should still be 3');
            
            console.log('✅ Credit consumed (free spec used first)');
            console.log('   - Free specs: 0 (was 1)');
            console.log('   - Purchased credits: 3 (unchanged)');
            
            // Consume again - should use purchased credit
            const success2 = await consumeSpecCredit(testUserId);
            assert(success2, 'Second consumeSpecCredit should succeed');
            
            const entDoc2 = await db.collection('entitlements').doc(testUserId).get();
            assert(entDoc2.data().spec_credits === 2, 'Purchased credits should now be 2');
            
            console.log('✅ Second credit consumed (purchased credit used)');
            console.log('   - Purchased credits: 2 (was 3)');
            
            // Cleanup
            await db.collection('users').doc(testUserId).delete();
            await db.collection('entitlements').doc(testUserId).delete();
            
            return true;
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            // Cleanup
            try {
                await db.collection('users').doc(testUserId).delete();
                await db.collection('entitlements').doc(testUserId).delete();
            } catch (e) {}
            return false;
        }
    },
    
    async testEntitlementsAPI() {
        console.log('\n🧪 Test 6: Entitlements API & Hierarchy');
        console.log('────────────────────────────────────');
        const testUserId = 'test_api_' + Date.now();
        
        try {
            // Test 1: Pro user
            await db.collection('users').doc(testUserId).set({
                email: 'test@example.com',
                plan: 'pro',
                free_specs_remaining: 0
            });
            
            await db.collection('entitlements').doc(testUserId).set({
                spec_credits: 0,
                unlimited: true,
                can_edit: true
            });
            
            const check1 = await checkUserCanCreateSpec(testUserId);
            assert(check1.canCreate === true, 'Pro user should be able to create');
            assert(check1.creditsRemaining === 'unlimited', 'Should show unlimited');
            
            console.log('✅ Pro user check passed');
            console.log('   - Can create: true');
            console.log('   - Credits: unlimited');
            
            // Test 2: User with purchased credits
            await db.collection('users').doc(testUserId).update({
                plan: 'free'
            });
            
            await db.collection('entitlements').doc(testUserId).update({
                spec_credits: 5,
                unlimited: false,
                can_edit: false
            });
            
            const check2 = await checkUserCanCreateSpec(testUserId);
            assert(check2.canCreate === true, 'User with credits should be able to create');
            assert(check2.creditsRemaining === 5, 'Should show 5 credits');
            
            console.log('✅ Credit user check passed');
            console.log('   - Can create: true');
            console.log('   - Credits: 5');
            
            // Test 3: Free user
            await db.collection('entitlements').doc(testUserId).update({
                spec_credits: 0
            });
            
            await db.collection('users').doc(testUserId).update({
                free_specs_remaining: 1
            });
            
            const check3 = await checkUserCanCreateSpec(testUserId);
            assert(check3.canCreate === true, 'Free user should be able to create');
            assert(check3.creditsRemaining === 1, 'Should show 1 free spec');
            
            console.log('✅ Free user check passed');
            console.log('   - Can create: true');
            console.log('   - Free specs: 1');
            
            // Test 4: Depleted user
            await db.collection('users').doc(testUserId).update({
                free_specs_remaining: 0
            });
            
            const check4 = await checkUserCanCreateSpec(testUserId);
            assert(check4.canCreate === false, 'Depleted user should not be able to create');
            assert(check4.creditsRemaining === 0, 'Should show 0 credits');
            
            console.log('✅ Depleted user check passed');
            console.log('   - Can create: false');
            console.log('   - Credits: 0');
            
            // Cleanup
            await db.collection('users').doc(testUserId).delete();
            await db.collection('entitlements').doc(testUserId).delete();
            
            return true;
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            // Cleanup
            try {
                await db.collection('users').doc(testUserId).delete();
                await db.collection('entitlements').doc(testUserId).delete();
            } catch (e) {}
            return false;
        }
    }
};

// Run all tests
(async () => {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  🚀 Credits System Tests               ║');
    console.log('╚════════════════════════════════════════╝');
    
    const startTime = Date.now();
    
    for (const [name, testFn] of Object.entries(tests)) {
        testsRun++;
        try {
            const result = await testFn();
            if (result) {
                testsPassed++;
            } else {
                testsFailed++;
            }
        } catch (error) {
            console.error(`\n❌ ${name} failed with exception:`, error.message);
            testsFailed++;
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  📊 Test Results                       ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`\nTests Run:    ${testsRun}`);
    console.log(`Tests Passed: ${testsPassed} ✅`);
    console.log(`Tests Failed: ${testsFailed} ${testsFailed > 0 ? '❌' : ''}`);
    console.log(`Duration:     ${duration}s`);
    console.log(`Success Rate: ${((testsPassed / testsRun) * 100).toFixed(1)}%`);
    
    if (testsFailed === 0) {
        console.log('\n🎉 All tests passed successfully!');
        process.exit(0);
    } else {
        console.log('\n⚠️  Some tests failed. Please review the output above.');
        process.exit(1);
    }
})();

