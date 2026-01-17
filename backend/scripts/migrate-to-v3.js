/**
 * Migration Script: V2 to V3 Credits System
 * 
 * This script migrates data from the old credits system (v2) to the new system (v3)
 * 
 * Usage: node backend/scripts/migrate-to-v3.js [--dry-run] [--user-id=USER_ID]
 * 
 * Options:
 *   --dry-run: Run without making changes (validation only)
 *   --user-id=USER_ID: Migrate only a specific user
 */

const { db, admin } = require('../server/firebase-admin');
const { logger } = require('../server/logger');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const userIdArg = args.find(arg => arg.startsWith('--user-id='));
const specificUserId = userIdArg ? userIdArg.split('=')[1] : null;

if (isDryRun) {
  console.log('🔍 DRY RUN MODE - No changes will be made\n');
}

/**
 * Normalize subscription status: "paid" means active
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
 * Convert Firestore Timestamp to Date or keep as is
 */
function toDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000);
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  return null;
}

/**
 * Migrate a single user from V2 to V3
 */
async function migrateUser(userId) {
  try {
    console.log(`\n📦 Migrating user: ${userId}`);
    
    // Read V2 data
    const creditsV2Ref = db.collection('user_credits').doc(userId);
    const subscriptionsV2Ref = db.collection('subscriptions').doc(userId);
    
    const [creditsV2Doc, subscriptionsV2Doc] = await Promise.all([
      creditsV2Ref.get(),
      subscriptionsV2Ref.get()
    ]);
    
    if (!creditsV2Doc.exists) {
      console.log(`⚠️  No user_credits document found for ${userId}, skipping...`);
      return { skipped: true, reason: 'no_credits_doc' };
    }
    
    const creditsV2 = creditsV2Doc.data();
    const subscriptionsV2 = subscriptionsV2Doc.exists ? subscriptionsV2Doc.data() : null;
    
    // Check if already migrated (but allow re-migration to update with improved logic)
    const creditsV3Ref = db.collection('user_credits_v3').doc(userId);
    const creditsV3Doc = await creditsV3Ref.get();
    
    // Note: We allow re-migration to update users with improved logic
    // (e.g., fixing Pro users with missing product_key)
    if (creditsV3Doc.exists) {
      const v3Data = creditsV3Doc.data();
      if (v3Data.metadata && v3Data.metadata.migratedFrom === 'v2') {
        console.log(`🔄 User ${userId} already migrated, re-migrating with improved logic...`);
        // Continue with migration to update with improved logic
      }
    }
    
    // Build V3 structure
    const v3Credits = {
      userId: userId,
      balances: {
        paid: creditsV2.balances?.paid || 0,
        free: creditsV2.balances?.free || 0,
        bonus: creditsV2.balances?.bonus || 0
      },
      subscription: {
        type: 'none',
        status: 'none',
        expiresAt: null,
        preservedCredits: 0,
        lemonSubscriptionId: null,
        lastSyncedAt: null,
        productKey: null,
        productName: null,
        billingInterval: null,
        renewsAt: null,
        endsAt: null,
        cancelAtPeriodEnd: false
      },
      permissions: {
        canEdit: false,
        canCreateUnlimited: false
      },
      metadata: {
        createdAt: creditsV2.metadata?.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        migratedFrom: 'v2',
        migrationTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        lastCreditGrant: creditsV2.metadata?.lastCreditGrant || null,
        lastCreditConsume: creditsV2.metadata?.lastCreditConsume || null,
        welcomeCreditGranted: creditsV2.metadata?.welcomeCreditGranted || false
      }
    };
    
    // Migrate subscription data
    // Priority: subscriptions collection > user_credits.subscription > users.plan
    let subscriptionSource = 'none';
    
    // First, check user.plan to know if user should be Pro
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const isProUser = userData && (userData.plan === 'pro' || userData.plan === 'Pro');
    
    if (subscriptionsV2 && subscriptionsV2.status) {
      // Use subscriptions collection as primary source
      const normalizedStatus = normalizeStatus(subscriptionsV2.status);
      const isActive = normalizedStatus === 'active' || normalizedStatus === 'on_trial' || normalizedStatus === 'paid';
      
      // Check if it's a Pro product by:
      // 1. Explicit product_key/product_type
      // 2. OR if user.plan is 'pro' AND status is active (fallback for missing product_key)
      const isProProduct = subscriptionsV2.product_key === 'pro_monthly' || 
                          subscriptionsV2.product_key === 'pro_yearly' ||
                          subscriptionsV2.product_type === 'subscription' ||
                          (isProUser && isActive); // Fallback: if user is Pro and subscription is active
      
      if (isActive && isProProduct) {
        v3Credits.subscription = {
          type: 'pro',
          status: normalizedStatus === 'paid' ? 'active' : normalizedStatus,
          expiresAt: subscriptionsV2.current_period_end ? toDate(subscriptionsV2.current_period_end) : 
                    (subscriptionsV2.renews_at ? toDate(subscriptionsV2.renews_at) : null),
          preservedCredits: creditsV2.subscription?.preservedCredits || 0,
          lemonSubscriptionId: subscriptionsV2.lemon_subscription_id || null,
          lastSyncedAt: subscriptionsV2.last_synced_at || admin.firestore.FieldValue.serverTimestamp(),
          productKey: subscriptionsV2.product_key || null,
          productName: subscriptionsV2.product_name || null,
          billingInterval: subscriptionsV2.billing_interval || null,
          renewsAt: subscriptionsV2.renews_at ? toDate(subscriptionsV2.renews_at) : null,
          endsAt: subscriptionsV2.ends_at ? toDate(subscriptionsV2.ends_at) : null,
          cancelAtPeriodEnd: subscriptionsV2.cancel_at_period_end || false
        };
        v3Credits.permissions = {
          canEdit: true,
          canCreateUnlimited: true
        };
        subscriptionSource = 'subscriptions_collection';
      }
    } else if (creditsV2.subscription) {
      // Fallback to user_credits.subscription
      const sub = creditsV2.subscription;
      const subType = sub.type || 'none';
      const subStatus = normalizeStatus(sub.status || 'none');
      
      if (subType === 'pro' && (subStatus === 'active' || subStatus === 'paid')) {
        v3Credits.subscription = {
          type: 'pro',
          status: subStatus === 'paid' ? 'active' : subStatus,
          expiresAt: sub.expiresAt ? toDate(sub.expiresAt) : null,
          preservedCredits: sub.preservedCredits || 0,
          lemonSubscriptionId: sub.lemonSubscriptionId || null,
          lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
          productKey: sub.productKey || null,
          productName: sub.productName || null,
          billingInterval: sub.billingInterval || null,
          renewsAt: sub.renewsAt ? toDate(sub.renewsAt) : null,
          endsAt: sub.endsAt ? toDate(sub.endsAt) : null,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd || false
        };
        v3Credits.permissions = {
          canEdit: true,
          canCreateUnlimited: true
        };
        subscriptionSource = 'user_credits';
      }
    }
    
    // Check user.plan as final fallback (if no subscription data found)
    if (v3Credits.subscription.type === 'none' && isProUser) {
      // Try to get subscription data from subscriptions_v2 even if status was missing
      if (subscriptionsV2) {
        const normalizedStatus = normalizeStatus(subscriptionsV2.status || 'active');
        v3Credits.subscription = {
          type: 'pro',
          status: normalizedStatus === 'paid' ? 'active' : normalizedStatus,
          expiresAt: subscriptionsV2.current_period_end ? toDate(subscriptionsV2.current_period_end) : 
                    (subscriptionsV2.renews_at ? toDate(subscriptionsV2.renews_at) : null),
          preservedCredits: creditsV2.subscription?.preservedCredits || 0,
          lemonSubscriptionId: subscriptionsV2.lemon_subscription_id || null,
          lastSyncedAt: subscriptionsV2.last_synced_at || admin.firestore.FieldValue.serverTimestamp(),
          productKey: subscriptionsV2.product_key || null,
          productName: subscriptionsV2.product_name || null,
          billingInterval: subscriptionsV2.billing_interval || null,
          renewsAt: subscriptionsV2.renews_at ? toDate(subscriptionsV2.renews_at) : null,
          endsAt: subscriptionsV2.ends_at ? toDate(subscriptionsV2.ends_at) : null,
          cancelAtPeriodEnd: subscriptionsV2.cancel_at_period_end || false
        };
        subscriptionSource = 'users.plan+subscriptions';
      } else {
        v3Credits.subscription = {
          type: 'pro',
          status: 'active',
          expiresAt: null,
          preservedCredits: creditsV2.subscription?.preservedCredits || 0,
          lemonSubscriptionId: null,
          lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
          productKey: null,
          productName: null,
          billingInterval: null,
          renewsAt: null,
          endsAt: null,
          cancelAtPeriodEnd: false
        };
        subscriptionSource = 'users.plan';
      }
      v3Credits.permissions = {
        canEdit: true,
        canCreateUnlimited: true
      };
    }
    
    // Migrate subscription to subscriptions_v3 (archive)
    if (subscriptionsV2) {
      const v3Subscription = {
        ...subscriptionsV2,
        userId: userId,
        last_synced_at: subscriptionsV2.last_synced_at || admin.firestore.FieldValue.serverTimestamp(),
        last_synced_source: subscriptionsV2.last_synced_source || 'migration',
        last_synced_mode: subscriptionsV2.last_synced_mode || 'live',
        migrated_at: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (!isDryRun) {
        const subscriptionsV3Ref = db.collection('subscriptions_v3').doc(userId);
        await subscriptionsV3Ref.set(v3Subscription, { merge: true });
      }
    }
    
    // Save V3 credits
    if (!isDryRun) {
      await creditsV3Ref.set(v3Credits);
      console.log(`✅ Migrated user ${userId} (subscription source: ${subscriptionSource})`);
    } else {
      console.log(`🔍 Would migrate user ${userId} (subscription source: ${subscriptionSource})`);
      console.log(`   Subscription: ${v3Credits.subscription.type} / ${v3Credits.subscription.status}`);
      console.log(`   Credits: paid=${v3Credits.balances.paid}, free=${v3Credits.balances.free}, bonus=${v3Credits.balances.bonus}`);
    }
    
    return {
      success: true,
      userId,
      subscriptionSource,
      subscriptionType: v3Credits.subscription.type,
      subscriptionStatus: v3Credits.subscription.status,
      balances: v3Credits.balances
    };
    
  } catch (error) {
    console.error(`❌ Error migrating user ${userId}:`, error.message);
    return {
      success: false,
      userId,
      error: error.message
    };
  }
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('🚀 Starting V2 to V3 Migration');
  console.log('================================\n');
  
  try {
    let results = {
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
      details: []
    };
    
    if (specificUserId) {
      // Migrate single user
      console.log(`📌 Migrating specific user: ${specificUserId}\n`);
      results.total = 1;
      const result = await migrateUser(specificUserId);
      
      if (result.success) {
        results.migrated++;
        results.details.push(result);
      } else if (result.skipped) {
        results.skipped++;
        results.details.push(result);
      } else {
        results.errors++;
        results.details.push(result);
      }
    } else {
      // Migrate all users
      console.log('📋 Fetching all users from user_credits collection...\n');
      const creditsV2Snapshot = await db.collection('user_credits').get();
      results.total = creditsV2Snapshot.size;
      
      console.log(`Found ${results.total} users to migrate\n`);
      
      // Process in batches to avoid memory issues
      const batchSize = 10;
      const docs = creditsV2Snapshot.docs;
      
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = docs.slice(i, i + batchSize);
        const batchPromises = batch.map(doc => migrateUser(doc.id));
        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(result => {
          if (result.success) {
            results.migrated++;
            results.details.push(result);
          } else if (result.skipped) {
            results.skipped++;
            results.details.push(result);
          } else {
            results.errors++;
            results.details.push(result);
          }
        });
        
        console.log(`\n📊 Progress: ${Math.min(i + batchSize, docs.length)}/${docs.length} users processed`);
      }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary');
    console.log('='.repeat(50));
    console.log(`Total users: ${results.total}`);
    console.log(`✅ Migrated: ${results.migrated}`);
    console.log(`⏭️  Skipped: ${results.skipped}`);
    console.log(`❌ Errors: ${results.errors}`);
    
    if (results.errors > 0) {
      console.log('\n❌ Errors:');
      results.details
        .filter(r => !r.success && !r.skipped)
        .forEach(r => {
          console.log(`   - ${r.userId}: ${r.error}`);
        });
    }
    
    if (isDryRun) {
      console.log('\n🔍 This was a DRY RUN - no changes were made');
      console.log('   Run without --dry-run to perform actual migration');
    } else {
      console.log('\n✅ Migration completed!');
    }
    
    process.exit(results.errors > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate();

