/**
 * Script to fix subscription IDs for existing Pro users
 * 
 * This script:
 * 1. Finds all Pro users in user_credits_v3 or subscriptions_v3
 * 2. For each user, tries to find the correct subscription ID from:
 *    - Order ID → Fetch order from Lemon API → Get subscription ID
 *    - Email → Search subscriptions by email
 *    - Customer ID → Search subscriptions by customer ID
 * 3. Updates the subscription ID if found
 * 
 * Usage:
 *   node backend/scripts/fix-subscription-ids.js [--dry-run] [--userId=<userId>]
 * 
 * Options:
 *   --dry-run: Only show what would be updated, don't actually update
 *   --userId=<userId>: Only fix a specific user
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables - try multiple paths
const fs = require('fs');
const backendEnvPath = path.join(__dirname, '..', '.env');
const rootEnvPath = path.join(__dirname, '..', '..', '.env');
const serverEnvPath = path.join(__dirname, '..', 'server', '.env');

if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
  console.log(`Loaded .env from: ${backendEnvPath}`);
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
  console.log(`Loaded .env from: ${rootEnvPath}`);
} else if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
  console.log(`Loaded .env from: ${serverEnvPath}`);
} else {
  dotenv.config();
  console.log('Using default .env lookup');
}

// Use Firebase Admin from server module (handles initialization)
const { admin, db } = require('../server/firebase-admin');

// Get API key from environment
const apiKey = process.env.LEMON_SQUEEZY_API_KEY || process.env.LEMON_API_KEY;
const storeId = process.env.LEMON_SQUEEZY_STORE_ID;

if (!apiKey) {
  console.error('❌ Error: LEMON_SQUEEZY_API_KEY environment variable is required');
  console.error('\n📝 To run this script:');
  console.error('   1. Set LEMON_SQUEEZY_API_KEY in your .env file, or');
  console.error('   2. Export it: export LEMON_SQUEEZY_API_KEY=your_key');
  console.error('   3. Or run on Render with environment variables set');
  console.error('\n💡 Note: API keys are usually stored in Render environment variables, not in .env files');
  process.exit(1);
}

const fetch = globalThis.fetch || require('node-fetch');

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const userIdArg = args.find(arg => arg.startsWith('--userId='));
const specificUserId = userIdArg ? userIdArg.split('=')[1] : null;

if (dryRun) {
  console.log('🔍 DRY RUN MODE - No changes will be made\n');
}

/**
 * Fetch subscription ID from Lemon order API
 */
async function getSubscriptionIdFromOrder(orderId) {
  try {
    const orderUrl = `https://api.lemonsqueezy.com/v1/orders/${encodeURIComponent(orderId)}`;
    const response = await fetch(orderUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      return null;
    }

    const orderData = await response.json();
    const attributes = orderData?.data?.attributes || {};
    const relationships = orderData?.data?.relationships || {};

    // Try to find subscription ID
    return attributes.subscription_id ||
           attributes.subscriptionId ||
           relationships?.subscription?.data?.id ||
           relationships?.subscription_id?.data?.id ||
           null;
  } catch (error) {
    console.error(`  ⚠️  Failed to fetch order ${orderId}:`, error.message);
    return null;
  }
}

/**
 * Search subscriptions by email
 */
async function findSubscriptionByEmail(email) {
  try {
    const url = `https://api.lemonsqueezy.com/v1/subscriptions?filter[customer_email]=${encodeURIComponent(email)}&page[size]=5`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const subscriptions = Array.isArray(data?.data) ? data.data : [];
    
    // Find active subscription
    const activeSub = subscriptions.find(sub => 
      sub.attributes?.status === 'active' || 
      sub.attributes?.status === 'on_trial' ||
      sub.attributes?.status === 'past_due'
    );
    
    return activeSub ? activeSub.id.toString() : (subscriptions[0]?.id?.toString() || null);
  } catch (error) {
    console.error(`  ⚠️  Failed to search by email ${email}:`, error.message);
    return null;
  }
}

/**
 * Search subscriptions by customer ID
 */
async function findSubscriptionByCustomerId(customerId) {
  try {
    const url = `https://api.lemonsqueezy.com/v1/subscriptions?filter[customer_id]=${encodeURIComponent(customerId)}&page[size]=5`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const subscriptions = Array.isArray(data?.data) ? data.data : [];
    
    // Find active subscription
    const activeSub = subscriptions.find(sub => 
      sub.attributes?.status === 'active' || 
      sub.attributes?.status === 'on_trial' ||
      sub.attributes?.status === 'past_due'
    );
    
    return activeSub ? activeSub.id.toString() : (subscriptions[0]?.id?.toString() || null);
  } catch (error) {
    console.error(`  ⚠️  Failed to search by customer ID ${customerId}:`, error.message);
    return null;
  }
}

/**
 * Verify subscription ID is valid
 */
async function verifySubscriptionId(subscriptionId) {
  try {
    const url = `https://api.lemonsqueezy.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Fix subscription ID for a single user
 */
async function fixUserSubscriptionId(userId) {
  console.log(`\n📋 Processing user: ${userId}`);
  
  try {
    // Get user data
    const subscriptionsV3Doc = await db.collection('subscriptions_v3').doc(userId).get();
    const creditsV3Doc = await db.collection('user_credits_v3').doc(userId).get();
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!subscriptionsV3Doc.exists && !creditsV3Doc.exists) {
      console.log('  ⏭️  Skipping: No subscription data found');
      return { skipped: true, reason: 'No subscription data' };
    }

    const subscriptionsV3Data = subscriptionsV3Doc.exists ? subscriptionsV3Doc.data() : {};
    const creditsV3Data = creditsV3Doc.exists ? creditsV3Doc.data() : {};
    const userData = userDoc.exists ? userDoc.data() : {};

    // Get current subscription ID
    const currentSubscriptionId = 
      subscriptionsV3Data?.lemon_subscription_id ||
      creditsV3Data?.subscription?.lemonSubscriptionId ||
      null;

    console.log(`  📝 Current subscription ID: ${currentSubscriptionId || 'null'}`);

    // Verify current subscription ID
    if (currentSubscriptionId) {
      const isValid = await verifySubscriptionId(currentSubscriptionId);
      if (isValid) {
        console.log('  ✅ Current subscription ID is valid');
        return { skipped: true, reason: 'Subscription ID is valid' };
      } else {
        console.log('  ❌ Current subscription ID is invalid');
      }
    }

    // Try to find correct subscription ID
    let correctSubscriptionId = null;
    let source = null;

    // Method 1: Try order ID
    const orderId = 
      subscriptionsV3Data?.last_order_id ||
      subscriptionsV3Data?.metadata?.lastOrderId ||
      creditsV3Data?.subscription?.orderId ||
      null;

    if (orderId) {
      console.log(`  🔍 Trying order ID: ${orderId}`);
      correctSubscriptionId = await getSubscriptionIdFromOrder(orderId);
      if (correctSubscriptionId) {
        source = 'order';
        console.log(`  ✅ Found subscription ID from order: ${correctSubscriptionId}`);
      }
    }

    // Method 2: Try email
    if (!correctSubscriptionId) {
      const email = userData?.email || subscriptionsV3Data?.user_email || null;
      if (email) {
        console.log(`  🔍 Trying email: ${email}`);
        correctSubscriptionId = await findSubscriptionByEmail(email);
        if (correctSubscriptionId) {
          source = 'email';
          console.log(`  ✅ Found subscription ID from email: ${correctSubscriptionId}`);
        }
      }
    }

    // Method 3: Try customer ID
    if (!correctSubscriptionId) {
      const customerId = 
        subscriptionsV3Data?.lemon_customer_id ||
        userData?.lemon_customer_id ||
        subscriptionsV3Data?.metadata?.lemonCustomerId ||
        null;
      
      if (customerId) {
        console.log(`  🔍 Trying customer ID: ${customerId}`);
        correctSubscriptionId = await findSubscriptionByCustomerId(customerId);
        if (correctSubscriptionId) {
          source = 'customer_id';
          console.log(`  ✅ Found subscription ID from customer ID: ${correctSubscriptionId}`);
        }
      }
    }

    if (!correctSubscriptionId) {
      console.log('  ❌ Could not find subscription ID');
      return { skipped: true, reason: 'Subscription ID not found' };
    }

    // Verify the found subscription ID
    const isValid = await verifySubscriptionId(correctSubscriptionId);
    if (!isValid) {
      console.log(`  ❌ Found subscription ID ${correctSubscriptionId} is invalid`);
      return { skipped: true, reason: 'Found subscription ID is invalid' };
    }

    console.log(`  ✅ Verified subscription ID: ${correctSubscriptionId} (from ${source})`);

    // Update subscription ID
    if (dryRun) {
      console.log(`  🔍 [DRY RUN] Would update subscription ID to: ${correctSubscriptionId}`);
      return { updated: false, dryRun: true, subscriptionId: correctSubscriptionId, source };
    }

    const updates = {};

    // Update subscriptions_v3
    if (subscriptionsV3Doc.exists) {
      updates.subscriptions_v3 = true;
      await db.collection('subscriptions_v3').doc(userId).update({
        lemon_subscription_id: correctSubscriptionId,
        last_synced_at: admin.firestore.FieldValue.serverTimestamp(),
        last_synced_source: 'manual_fix_script',
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('  ✅ Updated subscriptions_v3');
    }

    // Update user_credits_v3
    if (creditsV3Doc.exists) {
      updates.user_credits_v3 = true;
      await db.collection('user_credits_v3').doc(userId).update({
        'subscription.lemonSubscriptionId': correctSubscriptionId,
        'subscription.lastSyncedAt': admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('  ✅ Updated user_credits_v3');
    }

    console.log(`  ✅ Successfully updated subscription ID to: ${correctSubscriptionId}`);
    return { updated: true, subscriptionId: correctSubscriptionId, source, updates };

  } catch (error) {
    console.error(`  ❌ Error processing user ${userId}:`, error.message);
    return { error: error.message };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting subscription ID fix script\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'UPDATE'}`);
  if (specificUserId) {
    console.log(`Target user: ${specificUserId}\n`);
  } else {
    console.log('Target: All Pro users\n');
  }

  try {
    if (specificUserId) {
      // Fix specific user
      const result = await fixUserSubscriptionId(specificUserId);
      console.log('\n✅ Done!');
      console.log('Result:', result);
    } else {
      // Find all Pro users
      console.log('📊 Finding all Pro users...\n');
      
      const subscriptionsV3Snapshot = await db.collection('subscriptions_v3')
        .select()
        .get();
      
      const userIds = new Set();
      
      subscriptionsV3Snapshot.docs.forEach(doc => {
        userIds.add(doc.id);
      });

      // Also check user_credits_v3 for users with subscriptions
      const creditsV3Snapshot = await db.collection('user_credits_v3')
        .where('subscription.status', 'in', ['active', 'trial', 'past_due', 'paused'])
        .select()
        .get();
      
      creditsV3Snapshot.docs.forEach(doc => {
        userIds.add(doc.id);
      });

      const userIdsArray = Array.from(userIds);
      console.log(`Found ${userIdsArray.length} Pro users\n`);

      const results = {
        total: userIdsArray.length,
        updated: 0,
        skipped: 0,
        errors: 0
      };

      for (const userId of userIdsArray) {
        const result = await fixUserSubscriptionId(userId);
        
        if (result.updated) {
          results.updated++;
        } else if (result.error) {
          results.errors++;
        } else {
          results.skipped++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      console.log('\n📊 Summary:');
      console.log(`  Total users: ${results.total}`);
      console.log(`  Updated: ${results.updated}`);
      console.log(`  Skipped: ${results.skipped}`);
      console.log(`  Errors: ${results.errors}`);
      
      if (dryRun) {
        console.log('\n🔍 This was a DRY RUN - no changes were made');
        console.log('   Run without --dry-run to apply updates');
      } else {
        console.log('\n✅ Done!');
      }
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

