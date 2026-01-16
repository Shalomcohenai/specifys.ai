/**
 * Cleanup Script: Remove V2 Credits System
 * 
 * ⚠️  WARNING: This script permanently deletes V2 collections!
 * 
 * This script should ONLY be run after:
 * 1. V3 system has been tested and verified
 * 2. All data has been migrated successfully
 * 3. V3 has been running in production for sufficient time
 * 4. Explicit approval from the user
 * 
 * Usage: node backend/scripts/cleanup-v2-system.js --confirm-delete
 * 
 * Options:
 *   --confirm-delete: Required flag to confirm deletion
 *   --dry-run: Run without making changes (validation only)
 *   --backup: Create backup before deletion (recommended)
 */

const { db, admin } = require('../server/firebase-admin');
const { logger } = require('../server/logger');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const needsConfirmation = args.includes('--confirm-delete');
const shouldBackup = args.includes('--backup') || !isDryRun; // Always backup unless dry-run

if (!needsConfirmation && !isDryRun) {
  console.error('❌ Error: --confirm-delete flag is required to delete V2 collections');
  console.log('\n⚠️  WARNING: This will permanently delete:');
  console.log('   - user_credits collection');
  console.log('   - subscriptions collection');
  console.log('   - credit_ledger collection');
  console.log('\nUsage: node backend/scripts/cleanup-v2-system.js --confirm-delete [--backup]');
  console.log('       node backend/scripts/cleanup-v2-system.js --dry-run (validation only)');
  process.exit(1);
}

if (isDryRun) {
  console.log('🔍 DRY RUN MODE - No changes will be made\n');
}

/**
 * Create backup of a collection
 */
async function backupCollection(collectionName, outputPath) {
  console.log(`📦 Backing up ${collectionName}...`);
  
  try {
    const snapshot = await db.collection(collectionName).get();
    const documents = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      // Convert Firestore Timestamps to ISO strings for JSON
      const serialized = JSON.parse(JSON.stringify(data, (key, value) => {
        if (value && typeof value.toDate === 'function') {
          return { _firestore_timestamp: value.toDate().toISOString() };
        }
        if (value && value.seconds) {
          return { _firestore_timestamp: new Date(value.seconds * 1000).toISOString() };
        }
        return value;
      }));
      documents.push({
        id: doc.id,
        data: serialized
      });
    });
    
    const backup = {
      collection: collectionName,
      timestamp: new Date().toISOString(),
      count: documents.length,
      documents: documents
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(backup, null, 2));
    console.log(`✅ Backed up ${documents.length} documents to ${outputPath}`);
    
    return backup;
  } catch (error) {
    console.error(`❌ Error backing up ${collectionName}:`, error.message);
    throw error;
  }
}

/**
 * Delete a collection (by deleting all documents)
 */
async function deleteCollection(collectionName) {
  console.log(`🗑️  Deleting ${collectionName}...`);
  
  try {
    const snapshot = await db.collection(collectionName).get();
    const batchSize = 500; // Firestore batch limit
    const batches = [];
    let currentBatch = db.batch();
    let count = 0;
    
    snapshot.forEach(doc => {
      currentBatch.delete(doc.ref);
      count++;
      
      if (count % batchSize === 0) {
        batches.push(currentBatch);
        currentBatch = db.batch();
      }
    });
    
    // Add remaining batch
    if (count % batchSize !== 0) {
      batches.push(currentBatch);
    }
    
    if (!isDryRun) {
      // Execute all batches
      for (const batch of batches) {
        await batch.commit();
      }
    }
    
    console.log(`✅ ${isDryRun ? 'Would delete' : 'Deleted'} ${count} documents from ${collectionName}`);
    return count;
  } catch (error) {
    console.error(`❌ Error deleting ${collectionName}:`, error.message);
    throw error;
  }
}

/**
 * Verify V3 system is active
 */
async function verifyV3System() {
  console.log('🔍 Verifying V3 system...\n');
  
  try {
    // Check if V3 collections exist and have data
    const v3CreditsSnapshot = await db.collection('user_credits_v3').limit(1).get();
    const v3LedgerSnapshot = await db.collection('credit_ledger_v3').limit(1).get();
    
    if (v3CreditsSnapshot.empty) {
      console.warn('⚠️  Warning: user_credits_v3 collection is empty');
      return false;
    }
    
    console.log('✅ V3 collections exist and have data');
    return true;
  } catch (error) {
    console.error('❌ Error verifying V3 system:', error.message);
    return false;
  }
}

/**
 * Get collection statistics
 */
async function getCollectionStats(collectionName) {
  try {
    const snapshot = await db.collection(collectionName).count().get();
    return snapshot.data().count;
  } catch (error) {
    console.error(`Error getting stats for ${collectionName}:`, error.message);
    return 0;
  }
}

/**
 * Main cleanup function
 */
async function cleanup() {
  console.log('🧹 V2 Credits System Cleanup');
  console.log('='.repeat(50));
  console.log('⚠️  WARNING: This will permanently delete V2 collections!\n');
  
  try {
    // Verify V3 system
    const v3Active = await verifyV3System();
    if (!v3Active && !isDryRun) {
      console.error('\n❌ V3 system verification failed. Aborting cleanup.');
      process.exit(1);
    }
    
    // Get statistics
    console.log('\n📊 Collection Statistics:');
    console.log('─'.repeat(50));
    
    const stats = {
      user_credits: await getCollectionStats('user_credits'),
      subscriptions: await getCollectionStats('subscriptions'),
      credit_ledger: await getCollectionStats('credit_ledger')
    };
    
    console.log(`user_credits: ${stats.user_credits} documents`);
    console.log(`subscriptions: ${stats.subscriptions} documents`);
    console.log(`credit_ledger: ${stats.credit_ledger} documents`);
    
    const totalDocs = stats.user_credits + stats.subscriptions + stats.credit_ledger;
    console.log(`\nTotal: ${totalDocs} documents to delete`);
    
    if (totalDocs === 0) {
      console.log('\n✅ No documents to delete. V2 collections are already empty.');
      process.exit(0);
    }
    
    // Create backup directory
    let backupDir = null;
    if (shouldBackup && !isDryRun) {
      backupDir = path.join(__dirname, '..', 'backups', `v2-cleanup-${Date.now()}`);
      fs.mkdirSync(backupDir, { recursive: true });
      console.log(`\n📦 Backup directory: ${backupDir}`);
    }
    
    // Backup collections
    if (shouldBackup && !isDryRun) {
      console.log('\n📦 Creating backups...');
      console.log('─'.repeat(50));
      
      if (stats.user_credits > 0) {
        await backupCollection('user_credits', path.join(backupDir, 'user_credits.json'));
      }
      if (stats.subscriptions > 0) {
        await backupCollection('subscriptions', path.join(backupDir, 'subscriptions.json'));
      }
      if (stats.credit_ledger > 0) {
        await backupCollection('credit_ledger', path.join(backupDir, 'credit_ledger.json'));
      }
      
      console.log('\n✅ Backups created successfully');
    }
    
    // Delete collections
    console.log('\n🗑️  Deleting collections...');
    console.log('─'.repeat(50));
    
    const deleted = {
      user_credits: 0,
      subscriptions: 0,
      credit_ledger: 0
    };
    
    if (stats.user_credits > 0) {
      deleted.user_credits = await deleteCollection('user_credits');
    }
    
    if (stats.subscriptions > 0) {
      deleted.subscriptions = await deleteCollection('subscriptions');
    }
    
    if (stats.credit_ledger > 0) {
      deleted.credit_ledger = await deleteCollection('credit_ledger');
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Cleanup Summary');
    console.log('='.repeat(50));
    console.log(`user_credits: ${deleted.user_credits} ${isDryRun ? 'would be deleted' : 'deleted'}`);
    console.log(`subscriptions: ${deleted.subscriptions} ${isDryRun ? 'would be deleted' : 'deleted'}`);
    console.log(`credit_ledger: ${deleted.credit_ledger} ${isDryRun ? 'would be deleted' : 'deleted'}`);
    
    if (shouldBackup && !isDryRun && backupDir) {
      console.log(`\n📦 Backups saved to: ${backupDir}`);
    }
    
    if (isDryRun) {
      console.log('\n🔍 This was a DRY RUN - no changes were made');
      console.log('   Run with --confirm-delete to perform actual deletion');
    } else {
      console.log('\n✅ Cleanup completed!');
      console.log('⚠️  V2 collections have been permanently deleted.');
      console.log('   Make sure V3 system is working correctly before proceeding.');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanup();

