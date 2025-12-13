/**
 * Migration Script: Old Credits System → New Credits System
 * 
 * This script migrates data from the old credits system to the new unified system:
 * - entitlements + users.free_specs_remaining → user_credits
 * - credits_transactions → credit_ledger
 * 
 * Usage: node backend/scripts/migrate-credits-system.js [--dry-run] [--backup-only]
 * 
 * Options:
 *   --dry-run: Show what would be migrated without actually migrating
 *   --backup-only: Only create backups, don't migrate
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
const isBackupOnly = args.includes('--backup-only');

// Collections
const OLD_ENTITLEMENTS_COLLECTION = 'entitlements';
const OLD_TRANSACTIONS_COLLECTION = 'credits_transactions';
const OLD_USERS_COLLECTION = 'users';
const NEW_CREDITS_COLLECTION = 'user_credits';
const NEW_LEDGER_COLLECTION = 'credit_ledger';
const BACKUP_COLLECTION = 'credits_migration_backup';

/**
 * Create backup of old collections
 */
async function createBackup() {
  console.log('\n📦 Creating backups...');
  
  const backupData = {
    timestamp: admin.firestore.Timestamp.now(),
    entitlements: {},
    transactions: {},
    users: {}
  };
  
  // Backup entitlements
  console.log('  Backing up entitlements...');
  const entitlementsSnapshot = await db.collection(OLD_ENTITLEMENTS_COLLECTION).get();
  entitlementsSnapshot.forEach(doc => {
    backupData.entitlements[doc.id] = doc.data();
  });
  console.log(`  ✅ Backed up ${entitlementsSnapshot.size} entitlements`);
  
  // Backup transactions
  console.log('  Backing up transactions...');
  const transactionsSnapshot = await db.collection(OLD_TRANSACTIONS_COLLECTION).get();
  transactionsSnapshot.forEach(doc => {
    backupData.transactions[doc.id] = doc.data();
  });
  console.log(`  ✅ Backed up ${transactionsSnapshot.size} transactions`);
  
  // Backup users (only credit-related fields)
  console.log('  Backing up users (credit fields only)...');
  const usersSnapshot = await db.collection(OLD_USERS_COLLECTION).get();
  usersSnapshot.forEach(doc => {
    const userData = doc.data();
    const userBackup = {};
    if (typeof userData.free_specs_remaining === 'number') {
      userBackup.free_specs_remaining = userData.free_specs_remaining;
    }
    if (userData.plan) {
      userBackup.plan = userData.plan;
    }
    if (userData.createdAt) {
      userBackup.createdAt = userData.createdAt;
    }
    if (Object.keys(userBackup).length > 0) {
      backupData.users[doc.id] = userBackup;
    }
  });
  console.log(`  ✅ Backed up ${usersSnapshot.size} users`);
  
  // Clean backup data - remove undefined values
  const cleanBackupData = JSON.parse(JSON.stringify(backupData));
  
  // Save backup to Firestore
  const backupRef = db.collection(BACKUP_COLLECTION).doc(`backup_${Date.now()}`);
  await backupRef.set(cleanBackupData);
  console.log(`  ✅ Backup saved to ${BACKUP_COLLECTION}/${backupRef.id}`);
  
  // Also save to local file
  const backupFilePath = path.join(__dirname, `credits_backup_${Date.now()}.json`);
  fs.writeFileSync(backupFilePath, JSON.stringify(cleanBackupData, null, 2));
  console.log(`  ✅ Backup saved to ${backupFilePath}`);
  
  return cleanBackupData;
}

/**
 * Migrate entitlements + users → user_credits
 */
async function migrateUserCredits(backupData) {
  console.log('\n🔄 Migrating user credits...');
  
  const entitlementsSnapshot = await db.collection(OLD_ENTITLEMENTS_COLLECTION).get();
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  
  const batch = db.batch();
  let batchCount = 0;
  const BATCH_SIZE = 500;
  
  for (const entitlementsDoc of entitlementsSnapshot.docs) {
    try {
      const userId = entitlementsDoc.id;
      const entitlements = entitlementsDoc.data();
      
      // Get user data
      const userDoc = await db.collection(OLD_USERS_COLLECTION).doc(userId).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      
      // Calculate balances
      const paid = typeof entitlements.spec_credits === 'number' ? entitlements.spec_credits : 0;
      const free = typeof userData.free_specs_remaining === 'number' ? userData.free_specs_remaining : 0;
      const bonus = 0; // Start with 0 bonus credits
      
      // Determine subscription
      const isUnlimited = entitlements.unlimited === true;
      const subscriptionType = isUnlimited ? 'pro' : 'none';
      const subscriptionStatus = isUnlimited ? 'active' : 'none';
      
      // Check if subscription document exists
      let subscriptionExpiresAt = null;
      if (isUnlimited) {
        const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
        if (subscriptionDoc.exists) {
          const subData = subscriptionDoc.data();
          subscriptionExpiresAt = subData.current_period_end || null;
        }
      }
      
      // Create user_credits document
      const newCreditsDoc = {
        userId: userId,
        balances: {
          paid: paid,
          free: free,
          bonus: bonus
        },
        subscription: {
          type: subscriptionType,
          status: subscriptionStatus,
          expiresAt: subscriptionExpiresAt,
          preservedCredits: typeof entitlements.preserved_credits === 'number' 
            ? entitlements.preserved_credits 
            : 0
        },
        permissions: {
          canEdit: entitlements.can_edit === true,
          canCreateUnlimited: isUnlimited
        },
        metadata: {
          createdAt: entitlements.updated_at || admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastCreditGrant: null,
          lastCreditConsume: null,
          migratedFrom: 'old_system',
          migrationTimestamp: admin.firestore.FieldValue.serverTimestamp()
        }
      };
      
      // Check if already exists
      const existingDoc = await db.collection(NEW_CREDITS_COLLECTION).doc(userId).get();
      if (existingDoc.exists) {
        console.log(`  ⚠️  User ${userId} already has user_credits document, skipping`);
        skipped++;
        continue;
      }
      
      if (isDryRun) {
        console.log(`  [DRY RUN] Would migrate user ${userId}: paid=${paid}, free=${free}, unlimited=${isUnlimited}`);
        migrated++;
      } else {
        const creditsRef = db.collection(NEW_CREDITS_COLLECTION).doc(userId);
        batch.set(creditsRef, newCreditsDoc);
        batchCount++;
        
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`  ✅ Migrated batch of ${batchCount} users`);
          batchCount = 0;
        }
        
        migrated++;
      }
    } catch (error) {
      console.error(`  ❌ Error migrating user ${entitlementsDoc.id}:`, error.message);
      errors++;
    }
  }
  
  // Commit remaining batch
  if (!isDryRun && batchCount > 0) {
    await batch.commit();
    console.log(`  ✅ Migrated final batch of ${batchCount} users`);
  }
  
  console.log(`\n  📊 Migration Summary:`);
  console.log(`     ✅ Migrated: ${migrated}`);
  console.log(`     ⚠️  Skipped: ${skipped}`);
  console.log(`     ❌ Errors: ${errors}`);
}

/**
 * Migrate credits_transactions → credit_ledger
 */
async function migrateTransactions(backupData) {
  console.log('\n🔄 Migrating transactions...');
  
  const transactionsSnapshot = await db.collection(OLD_TRANSACTIONS_COLLECTION).get();
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  
  const batch = db.batch();
  let batchCount = 0;
  const BATCH_SIZE = 500;
  
  for (const transactionDoc of transactionsSnapshot.docs) {
    try {
      const transactionId = transactionDoc.id;
      const transaction = transactionDoc.data();
      
      // Check if already exists
      const existingDoc = await db.collection(NEW_LEDGER_COLLECTION).doc(transactionId).get();
      if (existingDoc.exists) {
        console.log(`  ⚠️  Transaction ${transactionId} already exists, skipping`);
        skipped++;
        continue;
      }
      
      // Map old type to new type
      const typeMap = {
        'grant': 'grant',
        'consume': 'consume',
        'refund': 'refund'
      };
      const newType = typeMap[transaction.type] || transaction.type;
      
      // Map old source to new source type
      const sourceTypeMap = {
        'admin': 'admin',
        'lemon_squeezy': 'purchase',
        'free_trial': 'promotion',
        'unlimited': 'spec_creation'
      };
      const sourceType = sourceTypeMap[transaction.source] || 'admin';
      
      // Determine credit type
      let creditType = 'paid';
      if (transaction.metadata?.creditType) {
        creditType = transaction.metadata.creditType === 'unlimited' ? 'paid' : transaction.metadata.creditType;
      } else if (transaction.source === 'free_trial') {
        creditType = 'free';
      }
      
      // Calculate balanceAfter (if available in metadata)
      const balanceAfter = {
        paid: 0,
        free: 0,
        bonus: 0
      };
      
      if (transaction.metadata?.remaining !== null && transaction.metadata?.remaining !== undefined) {
        // Try to infer from metadata
        if (creditType === 'paid') {
          balanceAfter.paid = transaction.metadata.remaining;
        } else if (creditType === 'free') {
          balanceAfter.free = transaction.metadata.remaining;
        }
      }
      
      // Create new ledger entry
      const newLedgerEntry = {
        id: transactionId,
        userId: transaction.userId,
        type: newType,
        amount: Math.abs(transaction.amount || 0),
        creditType: creditType,
        source: {
          type: sourceType,
          orderId: transaction.orderId || null,
          specId: transaction.specId || null,
          reason: transaction.metadata?.reason || null
        },
        balanceAfter: balanceAfter,
        metadata: {
          originalTransactionId: transaction.metadata?.originalTransactionId || null,
          expiresAt: null,
          notes: `Migrated from old system: ${transaction.source}`
        },
        timestamp: transaction.timestamp || transaction.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        createdAt: transaction.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        migratedFrom: 'old_system',
        migrationTimestamp: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (isDryRun) {
        console.log(`  [DRY RUN] Would migrate transaction ${transactionId}: type=${newType}, creditType=${creditType}`);
        migrated++;
      } else {
        const ledgerRef = db.collection(NEW_LEDGER_COLLECTION).doc(transactionId);
        batch.set(ledgerRef, newLedgerEntry);
        batchCount++;
        
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`  ✅ Migrated batch of ${batchCount} transactions`);
          batchCount = 0;
        }
        
        migrated++;
      }
    } catch (error) {
      console.error(`  ❌ Error migrating transaction ${transactionDoc.id}:`, error.message);
      errors++;
    }
  }
  
  // Commit remaining batch
  if (!isDryRun && batchCount > 0) {
    await batch.commit();
    console.log(`  ✅ Migrated final batch of ${batchCount} transactions`);
  }
  
  console.log(`\n  📊 Migration Summary:`);
  console.log(`     ✅ Migrated: ${migrated}`);
  console.log(`     ⚠️  Skipped: ${skipped}`);
  console.log(`     ❌ Errors: ${errors}`);
}

/**
 * Validate migration
 */
async function validateMigration() {
  console.log('\n✅ Validating migration...');
  
  // Count old vs new
  const oldEntitlementsCount = (await db.collection(OLD_ENTITLEMENTS_COLLECTION).get()).size;
  const newCreditsCount = (await db.collection(NEW_CREDITS_COLLECTION).get()).size;
  
  const oldTransactionsCount = (await db.collection(OLD_TRANSACTIONS_COLLECTION).get()).size;
  const newLedgerCount = (await db.collection(NEW_LEDGER_COLLECTION).get()).size;
  
  console.log(`  Entitlements: ${oldEntitlementsCount} → user_credits: ${newCreditsCount}`);
  console.log(`  Transactions: ${oldTransactionsCount} → credit_ledger: ${newLedgerCount}`);
  
  // Sample validation
  const sampleCredits = await db.collection(NEW_CREDITS_COLLECTION).limit(5).get();
  console.log(`\n  Sample migrated credits:`);
  sampleCredits.forEach(doc => {
    const data = doc.data();
    console.log(`    ${doc.id}: paid=${data.balances.paid}, free=${data.balances.free}, subscription=${data.subscription.type}`);
  });
  
  if (oldEntitlementsCount > 0 && newCreditsCount === 0) {
    console.error('  ❌ Validation failed: No credits migrated!');
    return false;
  }
  
  console.log('  ✅ Validation passed');
  return true;
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Credits System Migration Script');
  console.log('=====================================\n');
  
  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }
  
  if (isBackupOnly) {
    console.log('📦 BACKUP ONLY MODE - Only creating backups\n');
  }
  
  try {
    // Step 1: Create backup
    const backupData = await createBackup();
    
    if (isBackupOnly) {
      console.log('\n✅ Backup complete. Exiting (--backup-only mode)');
      return;
    }
    
    // Step 2: Migrate user credits
    await migrateUserCredits(backupData);
    
    // Step 3: Migrate transactions
    await migrateTransactions(backupData);
    
    // Step 4: Validate
    if (!isDryRun) {
      await validateMigration();
    }
    
    console.log('\n✅ Migration complete!');
    console.log('\n⚠️  IMPORTANT:');
    console.log('   1. Verify the migrated data before switching to the new system');
    console.log('   2. Keep the old collections until you confirm everything works');
    console.log('   3. Test the new system thoroughly before deleting old data');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  main().then(() => {
    process.exit(0);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main, createBackup, migrateUserCredits, migrateTransactions, validateMigration };
