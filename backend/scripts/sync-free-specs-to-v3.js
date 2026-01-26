/**
 * Sync Script: Migrate free_specs_remaining from users collection to user_credits_v3
 * 
 * This script migrates data from users.free_specs_remaining to user_credits_v3.balances.free
 * to ensure single source of truth for credits.
 * 
 * Usage: node backend/scripts/sync-free-specs-to-v3.js [--dry-run]
 * 
 * Options:
 *   --dry-run: Show what would be synced without actually syncing
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables - same logic as firebase-admin.js
const backendEnvPath = path.join(__dirname, '..', '.env');
const rootEnvPath = path.join(__dirname, '..', '..', '.env');
const serverEnvPath = path.join(__dirname, '..', 'server', '.env');

if (fs.existsSync(backendEnvPath)) {
    dotenv.config({ path: backendEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(serverEnvPath)) {
    dotenv.config({ path: serverEnvPath });
} else {
    dotenv.config();
}

// Initialize Firebase Admin - same logic as firebase-admin.js
if (!admin.apps.length) {
  try {
    // Try service account key file from env
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE) {
      const serviceAccount = require(path.join(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id || 'specify-ai'
      });
    } 
    // Try service account key from env (JSON string)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id || 'specify-ai'
      });
    } 
    // Try local service account file
    else if (fs.existsSync(path.join(__dirname, '../firebase-service-account.json'))) {
      const serviceAccount = require('../firebase-service-account.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id || 'specify-ai'
      });
    } 
    // Try default credentials (GOOGLE_APPLICATION_CREDENTIALS)
    else {
      console.log('⚠️  No service account file found, trying default credentials...');
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'specify-ai'
      });
    }
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error.message);
    console.error('Please ensure you have one of:');
    console.error('  1. FIREBASE_SERVICE_ACCOUNT_KEY_FILE environment variable');
    console.error('  2. FIREBASE_SERVICE_ACCOUNT_KEY environment variable (JSON string)');
    console.error('  3. firebase-service-account.json file in backend/ directory');
    console.error('  4. GOOGLE_APPLICATION_CREDENTIALS environment variable');
    process.exit(1);
  }
}

const db = admin.firestore();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

// Collections
const USERS_COLLECTION = 'users';
const CREDITS_COLLECTION_V3 = 'user_credits_v3';

/**
 * Calculate total credits from balances
 */
function calculateTotal(balances) {
  return (balances.paid || 0) + (balances.free || 0) + (balances.bonus || 0);
}

/**
 * Sync free_specs_remaining for a single user
 */
async function syncUserCredits(userId, freeSpecsRemaining) {
  const creditsRef = db.collection(CREDITS_COLLECTION_V3).doc(userId);
  const creditsDoc = await creditsRef.get();
  
  if (!creditsDoc.exists) {
    // Create new user_credits_v3 document
    const newCredits = {
      userId: userId,
      balances: {
        paid: 0,
        free: freeSpecsRemaining,
        bonus: 0
      },
      total: freeSpecsRemaining,
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
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        migratedFrom: null,
        migrationTimestamp: null,
        lastCreditGrant: null,
        lastCreditConsume: null,
        welcomeCreditGranted: false,
        syncedFromFreeSpecsRemaining: true,
        syncTimestamp: admin.firestore.FieldValue.serverTimestamp()
      }
    };
    
    if (!isDryRun) {
      await creditsRef.set(newCredits);
    }
    
    return {
      action: 'created',
      previousFree: 0,
      newFree: freeSpecsRemaining,
      newTotal: freeSpecsRemaining
    };
  }
  
  // Update existing document
  const existingCredits = creditsDoc.data();
  const currentFree = existingCredits.balances?.free || 0;
  
  // Only update if free_specs_remaining is greater than current free balance
  // This ensures we don't overwrite credits that were already migrated or granted
  if (freeSpecsRemaining > currentFree) {
    const newFree = freeSpecsRemaining;
    const currentPaid = existingCredits.balances?.paid || 0;
    const currentBonus = existingCredits.balances?.bonus || 0;
    const newTotal = calculateTotal({
      paid: currentPaid,
      free: newFree,
      bonus: currentBonus
    });
    
    if (!isDryRun) {
      await creditsRef.update({
        'balances.free': newFree,
        total: newTotal,
        'metadata.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
        'metadata.syncedFromFreeSpecsRemaining': true,
        'metadata.syncTimestamp': admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    return {
      action: 'updated',
      previousFree: currentFree,
      newFree: newFree,
      newTotal: newTotal
    };
  }
  
  // Already synced or no update needed
  return {
    action: 'skipped',
      reason: freeSpecsRemaining <= currentFree ? 'already_synced' : 'no_update_needed',
      currentFree: currentFree,
      freeSpecsRemaining: freeSpecsRemaining
  };
}

/**
 * Main sync function
 */
async function syncAllUsers() {
  console.log('\n🚀 Starting sync: free_specs_remaining → user_credits_v3.balances.free\n');
  
  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }
  
  const stats = {
    total: 0,
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: []
  };
  
  try {
    // Get all users with free_specs_remaining > 0
    console.log('📋 Fetching users with free_specs_remaining > 0...');
    const usersSnapshot = await db.collection(USERS_COLLECTION)
      .where('free_specs_remaining', '>', 0)
      .get();
    
    stats.total = usersSnapshot.size;
    console.log(`✅ Found ${stats.total} users with free_specs_remaining > 0\n`);
    
    if (stats.total === 0) {
      console.log('✅ No users to sync. All done!');
      return stats;
    }
    
    // Process users in batches
    const BATCH_SIZE = 50;
    const batches = [];
    for (let i = 0; i < usersSnapshot.docs.length; i += BATCH_SIZE) {
      batches.push(usersSnapshot.docs.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`📦 Processing ${batches.length} batch(es) of up to ${BATCH_SIZE} users each...\n`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} users)...`);
      
      await Promise.all(batch.map(async (userDoc) => {
        const userId = userDoc.id;
        const userData = userDoc.data();
        const freeSpecsRemaining = typeof userData.free_specs_remaining === 'number' 
          ? userData.free_specs_remaining 
          : 0;
        
        if (freeSpecsRemaining <= 0) {
          return;
        }
        
        try {
          stats.processed++;
          const result = await syncUserCredits(userId, freeSpecsRemaining);
          
          if (result.action === 'created') {
            stats.created++;
            console.log(`  ✅ [${userId}] Created user_credits_v3 with ${result.newFree} free credits`);
          } else if (result.action === 'updated') {
            stats.updated++;
            console.log(`  ✅ [${userId}] Updated: ${result.previousFree} → ${result.newFree} free credits (total: ${result.newTotal})`);
          } else {
            stats.skipped++;
            console.log(`  ⏭️  [${userId}] Skipped: ${result.reason} (current: ${result.currentFree}, users: ${result.freeSpecsRemaining})`);
          }
        } catch (error) {
          stats.errors++;
          stats.errorDetails.push({
            userId: userId,
            email: userData.email || null,
            error: error.message
          });
          console.error(`  ❌ [${userId}] Error: ${error.message}`);
        }
      }));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Sync Summary');
    console.log('='.repeat(60));
    console.log(`Total users found: ${stats.total}`);
    console.log(`Processed: ${stats.processed}`);
    console.log(`Created: ${stats.created}`);
    console.log(`Updated: ${stats.updated}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    
    if (stats.errorDetails.length > 0) {
      console.log('\n❌ Errors:');
      stats.errorDetails.slice(0, 10).forEach((error, index) => {
        console.log(`  ${index + 1}. [${error.userId}] ${error.email || 'N/A'}: ${error.error}`);
      });
      if (stats.errorDetails.length > 10) {
        console.log(`  ... and ${stats.errorDetails.length - 10} more errors`);
      }
    }
    
    if (isDryRun) {
      console.log('\n⚠️  This was a DRY RUN - No changes were made');
      console.log('Run without --dry-run to apply changes');
    } else {
      console.log('\n✅ Sync completed successfully!');
    }
    
    return stats;
  } catch (error) {
    console.error('\n❌ Fatal error during sync:', error);
    throw error;
  }
}

// Run the sync
if (require.main === module) {
  syncAllUsers()
    .then((stats) => {
      process.exit(stats.errors > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { syncAllUsers, syncUserCredits };

