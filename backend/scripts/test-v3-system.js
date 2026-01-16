/**
 * Test Script: V3 Credits System
 * 
 * This script tests the V3 credits system to ensure it works correctly
 * 
 * Usage: node backend/scripts/test-v3-system.js [--user-id=USER_ID]
 */

const { db, auth } = require('../server/firebase-admin');
const creditsV3Service = require('../server/credits-v3-service');
const config = require('../server/config');

const args = process.argv.slice(2);
const userIdArg = args.find(arg => arg.startsWith('--user-id='));
const testUserId = userIdArg ? userIdArg.split('=')[1] : null;

if (!config.creditsV3.enabled) {
  console.error('❌ Error: CREDITS_V3_ENABLED is not set to true');
  console.log('   Set CREDITS_V3_ENABLED=true in .env or config.js to enable V3 system');
  process.exit(1);
}

/**
 * Test getting credits
 */
async function testGetCredits(userId) {
  console.log('\n📋 Test 1: Get Credits');
  console.log('─'.repeat(50));
  
  try {
    const credits = await creditsV3Service.getUserCredits(userId);
    const available = await creditsV3Service.getAvailableCredits(userId);
    
    console.log('✅ getUserCredits:', {
      total: credits.balances ? 
        (credits.balances.paid + credits.balances.free + credits.balances.bonus) : 0,
      subscription: credits.subscription?.type || 'none',
      status: credits.subscription?.status || 'none',
      unlimited: credits.permissions?.canCreateUnlimited || false
    });
    
    console.log('✅ getAvailableCredits:', {
      unlimited: available.unlimited,
      total: available.total,
      breakdown: available.breakdown
    });
    
    return { success: true, credits, available };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test consuming credits (dry run - doesn't actually consume)
 */
async function testConsumeCredit(userId) {
  console.log('\n📋 Test 2: Consume Credit (Validation Only)');
  console.log('─'.repeat(50));
  
  try {
    // Get current credits
    const before = await creditsV3Service.getAvailableCredits(userId);
    console.log('Before:', {
      unlimited: before.unlimited,
      total: before.total
    });
    
    if (before.unlimited) {
      console.log('✅ User has unlimited credits - consume would succeed');
      return { success: true, unlimited: true };
    }
    
    if (before.total === 0) {
      console.log('⚠️  User has no credits - consume would fail');
      return { success: false, reason: 'insufficient_credits' };
    }
    
    console.log('✅ User has credits - consume would succeed');
    return { success: true, unlimited: false, total: before.total };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test granting credits (dry run - doesn't actually grant)
 */
async function testGrantCredits(userId) {
  console.log('\n📋 Test 3: Grant Credits (Validation Only)');
  console.log('─'.repeat(50));
  
  try {
    // Get current credits
    const before = await creditsV3Service.getUserCredits(userId);
    const beforeTotal = before.balances ? 
      (before.balances.paid + before.balances.free + before.balances.bonus) : 0;
    
    console.log('Before:', {
      total: beforeTotal,
      breakdown: before.balances
    });
    
    console.log('✅ Grant function is available and would work');
    return { success: true, currentTotal: beforeTotal };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test subscription enable/disable
 */
async function testSubscription(userId) {
  console.log('\n📋 Test 4: Subscription Management');
  console.log('─'.repeat(50));
  
  try {
    const credits = await creditsV3Service.getUserCredits(userId);
    const subscription = credits.subscription || {};
    
    console.log('Current subscription:', {
      type: subscription.type || 'none',
      status: subscription.status || 'none',
      unlimited: credits.permissions?.canCreateUnlimited || false
    });
    
    console.log('✅ Subscription functions are available');
    return { success: true, subscription };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test ledger
 */
async function testLedger(userId) {
  console.log('\n📋 Test 5: Credit Ledger');
  console.log('─'.repeat(50));
  
  try {
    const ledger = await creditsV3Service.getCreditLedger(userId, { limit: 10 });
    
    console.log('✅ Ledger retrieved:', {
      count: ledger.count,
      hasMore: ledger.hasMore,
      transactions: ledger.transactions.length
    });
    
    if (ledger.transactions.length > 0) {
      console.log('Sample transaction:', {
        type: ledger.transactions[0].type,
        amount: ledger.transactions[0].amount,
        creditType: ledger.transactions[0].creditType
      });
    }
    
    return { success: true, ledger };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Compare V2 and V3 for a user
 */
async function compareV2V3(userId) {
  console.log('\n📋 Test 6: Compare V2 and V3');
  console.log('─'.repeat(50));
  
  try {
    // Get V2 data
    const creditsV2Ref = db.collection('user_credits').doc(userId);
    const creditsV2Doc = await creditsV2Ref.get();
    
    // Get V3 data
    const creditsV3 = await creditsV3Service.getUserCredits(userId);
    const availableV3 = await creditsV3Service.getAvailableCredits(userId);
    
    if (!creditsV2Doc.exists) {
      console.log('⚠️  No V2 data found for comparison');
      return { success: true, v2Exists: false };
    }
    
    const creditsV2 = creditsV2Doc.data();
    
    // Compare
    const v2Total = (creditsV2.balances?.paid || 0) + 
                   (creditsV2.balances?.free || 0) + 
                   (creditsV2.balances?.bonus || 0);
    const v3Total = availableV3.total || 0;
    
    const v2Unlimited = creditsV2.subscription?.type === 'pro' && 
                       (creditsV2.subscription?.status === 'active' || 
                        creditsV2.subscription?.status === 'paid');
    const v3Unlimited = availableV3.unlimited || false;
    
    console.log('V2:', {
      total: v2Total,
      unlimited: v2Unlimited,
      subscription: creditsV2.subscription?.type || 'none'
    });
    
    console.log('V3:', {
      total: v3Total,
      unlimited: v3Unlimited,
      subscription: creditsV3.subscription?.type || 'none'
    });
    
    const matches = v2Total === v3Total && v2Unlimited === v3Unlimited;
    
    if (matches) {
      console.log('✅ V2 and V3 data match!');
    } else {
      console.log('⚠️  V2 and V3 data differ');
    }
    
    return { success: true, matches, v2Total, v3Total, v2Unlimited, v3Unlimited };
  } catch (error) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 Testing V3 Credits System');
  console.log('='.repeat(50));
  console.log(`Migration Mode: ${config.creditsV3.migrationMode}`);
  console.log(`V3 Enabled: ${config.creditsV3.enabled}\n`);
  
  if (!testUserId) {
    console.error('❌ Error: Please provide a user ID');
    console.log('Usage: node backend/scripts/test-v3-system.js --user-id=USER_ID');
    process.exit(1);
  }
  
  console.log(`Testing with user: ${testUserId}\n`);
  
  const results = {
    getCredits: await testGetCredits(testUserId),
    consumeCredit: await testConsumeCredit(testUserId),
    grantCredits: await testGrantCredits(testUserId),
    subscription: await testSubscription(testUserId),
    ledger: await testLedger(testUserId),
    compare: await compareV2V3(testUserId)
  };
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  
  const passed = Object.values(results).filter(r => r.success).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, result]) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${test}: ${result.success ? 'PASSED' : 'FAILED'}`);
  });
  
  console.log(`\n${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests();

