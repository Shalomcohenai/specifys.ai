/**
 * Create V3 Collections Script
 * 
 * This script ensures that V3 collections exist in Firestore
 * Collections are created automatically in Firestore when first written to,
 * but this script creates placeholder documents to ensure they exist
 * 
 * Usage: node backend/scripts/create-v3-collections.js [--dry-run]
 */

const { db, admin } = require('../server/firebase-admin');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

if (isDryRun) {
  console.log('🔍 DRY RUN MODE - No changes will be made\n');
}

/**
 * Create a placeholder document in a collection to ensure it exists
 */
async function ensureCollectionExists(collectionName) {
  try {
    const placeholderId = '_placeholder';
    const placeholderRef = db.collection(collectionName).doc(placeholderId);
    const placeholderDoc = await placeholderRef.get();
    
    if (placeholderDoc.exists) {
      console.log(`✅ Collection '${collectionName}' already exists`);
      return { exists: true, created: false };
    }
    
    if (!isDryRun) {
      // Create placeholder document
      await placeholderRef.set({
        _type: 'collection_placeholder',
        _created_at: admin.firestore.FieldValue.serverTimestamp(),
        _note: 'This document ensures the collection exists. It can be safely deleted.'
      });
      console.log(`✅ Created placeholder in collection '${collectionName}'`);
    } else {
      console.log(`🔍 Would create placeholder in collection '${collectionName}'`);
    }
    
    return { exists: false, created: !isDryRun };
  } catch (error) {
    console.error(`❌ Error ensuring collection '${collectionName}' exists:`, error.message);
    return { exists: false, created: false, error: error.message };
  }
}

/**
 * Delete placeholder documents (optional cleanup)
 */
async function deletePlaceholders(collectionName) {
  try {
    const placeholderRef = db.collection(collectionName).doc('_placeholder');
    const placeholderDoc = await placeholderRef.get();
    
    if (placeholderDoc.exists) {
      if (!isDryRun) {
        await placeholderRef.delete();
        console.log(`🗑️  Deleted placeholder from '${collectionName}'`);
      } else {
        console.log(`🔍 Would delete placeholder from '${collectionName}'`);
      }
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error deleting placeholder from '${collectionName}':`, error.message);
    return false;
  }
}

/**
 * Main function
 */
async function createCollections() {
  console.log('🚀 Creating V3 Collections');
  console.log('='.repeat(50));
  console.log('Collections to create:');
  console.log('  - user_credits_v3');
  console.log('  - subscriptions_v3');
  console.log('  - credit_ledger_v3');
  console.log('');
  
  const collections = [
    'user_credits_v3',
    'subscriptions_v3',
    'credit_ledger_v3'
  ];
  
  const results = {
    total: collections.length,
    created: 0,
    existed: 0,
    errors: 0
  };
  
  for (const collectionName of collections) {
    console.log(`\n📦 Processing: ${collectionName}`);
    console.log('─'.repeat(50));
    
    const result = await ensureCollectionExists(collectionName);
    
    if (result.error) {
      results.errors++;
    } else if (result.created) {
      results.created++;
    } else if (result.exists) {
      results.existed++;
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary');
  console.log('='.repeat(50));
  console.log(`Total collections: ${results.total}`);
  console.log(`✅ Created: ${results.created}`);
  console.log(`✓ Already existed: ${results.existed}`);
  console.log(`❌ Errors: ${results.errors}`);
  
  if (isDryRun) {
    console.log('\n🔍 This was a DRY RUN - no changes were made');
    console.log('   Run without --dry-run to create collections');
  } else {
    console.log('\n✅ Collections created successfully!');
    console.log('\n💡 Note: Placeholder documents can be safely deleted.');
    console.log('   They were only created to ensure collections exist.');
  }
  
  // Optional: Ask if user wants to delete placeholders
  if (!isDryRun && results.created > 0) {
    console.log('\n🗑️  Placeholder documents were created.');
    console.log('   You can delete them manually or they will be overwritten when real data is written.');
  }
  
  process.exit(results.errors > 0 ? 1 : 0);
}

// Run
createCollections();

