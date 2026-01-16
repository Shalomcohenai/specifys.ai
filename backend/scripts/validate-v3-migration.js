/**
 * Validation Script: Compare V2 and V3 Credits Data
 * 
 * This script validates that the migration from V2 to V3 was successful
 * by comparing data between the two systems
 * 
 * Usage: node backend/scripts/validate-v3-migration.js [--user-id=USER_ID]
 */

const { db } = require('../server/firebase-admin');
const { logger } = require('../server/logger');

const args = process.argv.slice(2);
const userIdArg = args.find(arg => arg.startsWith('--user-id='));
const specificUserId = userIdArg ? userIdArg.split('=')[1] : null;

/**
 * Normalize subscription status for comparison
 */
function normalizeStatus(status) {
  if (!status || typeof status !== 'string') return 'none';
  const normalized = status.trim().toLowerCase();
  if (normalized === 'paid') {
    return 'active';
  }
  return normalized;
}

/**
 * Calculate total credits from balances
 */
function calculateTotal(balances) {
  if (!balances) return 0;
  return (balances.paid || 0) + (balances.free || 0) + (balances.bonus || 0);
}

/**
 * Get subscription type and status from V2 data
 */
function getV2SubscriptionInfo(creditsV2, subscriptionsV2) {
  // Priority: subscriptions collection > user_credits.subscription > users.plan
  if (subscriptionsV2 && subscriptionsV2.status) {
    const normalizedStatus = normalizeStatus(subscriptionsV2.status);
    const isActive = normalizedStatus === 'active' || normalizedStatus === 'on_trial';
    const isProProduct = subscriptionsV2.product_key === 'pro_monthly' || 
                        subscriptionsV2.product_key === 'pro_yearly' ||
                        subscriptionsV2.product_type === 'subscription';
    
    if (isActive && isProProduct) {
      return {
        type: 'pro',
        status: normalizedStatus,
        source: 'subscriptions_collection'
      };
    }
  }
  
  if (creditsV2.subscription) {
    const sub = creditsV2.subscription;
    const subType = sub.type || 'none';
    const subStatus = normalizeStatus(sub.status || 'none');
    
    if (subType === 'pro' && (subStatus === 'active' || subStatus === 'paid')) {
      return {
        type: 'pro',
        status: subStatus === 'paid' ? 'active' : subStatus,
        source: 'user_credits'
      };
    }
  }
  
  return {
    type: 'none',
    status: 'none',
    source: 'none'
  };
}

/**
 * Validate a single user
 */
async function validateUser(userId) {
  try {
    // Read V2 data
    const creditsV2Ref = db.collection('user_credits').doc(userId);
    const subscriptionsV2Ref = db.collection('subscriptions').doc(userId);
    
    const [creditsV2Doc, subscriptionsV2Doc] = await Promise.all([
      creditsV2Ref.get(),
      subscriptionsV2Ref.get()
    ]);
    
    if (!creditsV2Doc.exists) {
      return {
        userId,
        status: 'skipped',
        reason: 'no_v2_credits'
      };
    }
    
    const creditsV2 = creditsV2Doc.data();
    const subscriptionsV2 = subscriptionsV2Doc.exists ? subscriptionsV2Doc.data() : null;
    
    // Read V3 data
    const creditsV3Ref = db.collection('user_credits_v3').doc(userId);
    const creditsV3Doc = await creditsV3Ref.get();
    
    if (!creditsV3Doc.exists) {
      return {
        userId,
        status: 'error',
        reason: 'no_v3_credits',
        v2Exists: true
      };
    }
    
    const creditsV3 = creditsV3Doc.data();
    
    // Compare data
    const discrepancies = [];
    
    // Compare balances
    const v2Total = calculateTotal(creditsV2.balances);
    const v3Total = calculateTotal(creditsV3.balances);
    
    if (v2Total !== v3Total) {
      discrepancies.push({
        field: 'balances.total',
        v2: v2Total,
        v3: v3Total
      });
    }
    
    if (creditsV2.balances?.paid !== creditsV3.balances?.paid) {
      discrepancies.push({
        field: 'balances.paid',
        v2: creditsV2.balances?.paid || 0,
        v3: creditsV3.balances?.paid || 0
      });
    }
    
    if (creditsV2.balances?.free !== creditsV3.balances?.free) {
      discrepancies.push({
        field: 'balances.free',
        v2: creditsV2.balances?.free || 0,
        v3: creditsV3.balances?.free || 0
      });
    }
    
    if (creditsV2.balances?.bonus !== creditsV3.balances?.bonus) {
      discrepancies.push({
        field: 'balances.bonus',
        v2: creditsV2.balances?.bonus || 0,
        v3: creditsV3.balances?.bonus || 0
      });
    }
    
    // Compare subscription
    const v2SubInfo = getV2SubscriptionInfo(creditsV2, subscriptionsV2);
    const v3SubType = creditsV3.subscription?.type || 'none';
    const v3SubStatus = normalizeStatus(creditsV3.subscription?.status || 'none');
    
    if (v2SubInfo.type !== v3SubType) {
      discrepancies.push({
        field: 'subscription.type',
        v2: v2SubInfo.type,
        v3: v3SubType,
        v2Source: v2SubInfo.source
      });
    }
    
    if (v2SubInfo.status !== v3SubStatus) {
      discrepancies.push({
        field: 'subscription.status',
        v2: v2SubInfo.status,
        v3: v3SubStatus,
        v2Source: v2SubInfo.source
      });
    }
    
    // Compare permissions
    const v2CanCreateUnlimited = creditsV2.permissions?.canCreateUnlimited || false;
    const v3CanCreateUnlimited = creditsV3.permissions?.canCreateUnlimited || false;
    
    if (v2CanCreateUnlimited !== v3CanCreateUnlimited) {
      discrepancies.push({
        field: 'permissions.canCreateUnlimited',
        v2: v2CanCreateUnlimited,
        v3: v3CanCreateUnlimited
      });
    }
    
    return {
      userId,
      status: discrepancies.length === 0 ? 'valid' : 'discrepancy',
      discrepancies,
      v2Total,
      v3Total,
      v2Subscription: v2SubInfo,
      v3Subscription: {
        type: v3SubType,
        status: v3SubStatus
      }
    };
    
  } catch (error) {
    return {
      userId,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Main validation function
 */
async function validate() {
  console.log('🔍 Starting V2 to V3 Validation');
  console.log('================================\n');
  
  try {
    let results = {
      total: 0,
      valid: 0,
      discrepancies: 0,
      errors: 0,
      skipped: 0,
      details: []
    };
    
    if (specificUserId) {
      // Validate single user
      console.log(`📌 Validating specific user: ${specificUserId}\n`);
      results.total = 1;
      const result = await validateUser(specificUserId);
      
      if (result.status === 'valid') {
        results.valid++;
      } else if (result.status === 'discrepancy') {
        results.discrepancies++;
      } else if (result.status === 'skipped') {
        results.skipped++;
      } else {
        results.errors++;
      }
      
      results.details.push(result);
    } else {
      // Validate all users
      console.log('📋 Fetching all users from user_credits_v3 collection...\n');
      const creditsV3Snapshot = await db.collection('user_credits_v3').get();
      results.total = creditsV3Snapshot.size;
      
      console.log(`Found ${results.total} users to validate\n`);
      
      // Process in batches
      const batchSize = 10;
      const docs = creditsV3Snapshot.docs;
      
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = docs.slice(i, i + batchSize);
        const batchPromises = batch.map(doc => validateUser(doc.id));
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(result => {
          if (result.status === 'valid') {
            results.valid++;
          } else if (result.status === 'discrepancy') {
            results.discrepancies++;
          } else if (result.status === 'skipped') {
            results.skipped++;
          } else {
            results.errors++;
          }
          
          results.details.push(result);
        });
        
        console.log(`\n📊 Progress: ${Math.min(i + batchSize, docs.length)}/${docs.length} users validated`);
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Validation Summary');
    console.log('='.repeat(50));
    console.log(`Total users: ${results.total}`);
    console.log(`✅ Valid: ${results.valid}`);
    console.log(`⚠️  Discrepancies: ${results.discrepancies}`);
    console.log(`⏭️  Skipped: ${results.skipped}`);
    console.log(`❌ Errors: ${results.errors}`);
    
    // Show discrepancies
    if (results.discrepancies > 0) {
      console.log('\n⚠️  Discrepancies found:');
      results.details
        .filter(r => r.status === 'discrepancy')
        .forEach(r => {
          console.log(`\n   User: ${r.userId}`);
          r.discrepancies.forEach(d => {
            console.log(`     - ${d.field}: V2=${d.v2}, V3=${d.v3}${d.v2Source ? ` (V2 source: ${d.v2Source})` : ''}`);
          });
        });
    }
    
    // Show errors
    if (results.errors > 0) {
      console.log('\n❌ Errors:');
      results.details
        .filter(r => r.status === 'error')
        .forEach(r => {
          console.log(`   - ${r.userId}: ${r.error || r.reason}`);
        });
    }
    
    console.log('\n✅ Validation completed!');
    
    process.exit(results.discrepancies > 0 || results.errors > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ Validation failed:', error);
    process.exit(1);
  }
}

// Run validation
validate();

