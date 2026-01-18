/**
 * Migration Script: Add total field to existing user_credits_v3 documents
 * 
 * This script calculates and adds the `total` field to all existing documents
 * in the user_credits_v3 collection that don't have it yet.
 * 
 * Usage:
 *   node backend/scripts/migrate-total-field.js
 * 
 * Environment:
 *   - GOOGLE_APPLICATION_CREDENTIALS must be set
 *   - Or use Firebase Admin SDK with service account
 */

// Use the same Firebase initialization as the server
const { db, admin } = require('../server/firebase-admin');

/**
 * Calculate total from balances
 */
function calculateTotal(balances) {
  return (balances?.paid || 0) + (balances?.free || 0) + (balances?.bonus || 0);
}

/**
 * Migrate total field for all user_credits_v3 documents
 */
async function migrateTotalField() {
  console.log('🚀 Starting migration: Adding total field to user_credits_v3 documents...\n');

  try {
    const creditsRef = db.collection('user_credits_v3');
    const snapshot = await creditsRef.get();

    if (snapshot.empty) {
      console.log('✅ No documents found in user_credits_v3 collection');
      return;
    }

    console.log(`📊 Found ${snapshot.size} documents to process\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500; // Firestore batch limit

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        const docId = doc.id;

        // Check if total field already exists and is correct
        if (data.total !== undefined) {
          const calculatedTotal = calculateTotal(data.balances);
          if (data.total === calculatedTotal) {
            skipped++;
            continue; // Already has correct total
          }
          // If total exists but is incorrect, we'll update it
        }

        // Calculate total from balances
        const total = calculateTotal(data.balances);

        // Add to batch
        batch.update(doc.ref, { total });
        batchCount++;

        // Commit batch if it reaches the limit
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`✅ Committed batch of ${batchCount} updates`);
          updated += batchCount;
          batchCount = 0;
        }
      } catch (error) {
        console.error(`❌ Error processing document ${doc.id}:`, error.message);
        errors++;
      }
    }

    // Commit remaining updates
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ Committed final batch of ${batchCount} updates`);
      updated += batchCount;
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Updated: ${updated} documents`);
    console.log(`   ⏭️  Skipped: ${skipped} documents (already have correct total)`);
    console.log(`   ❌ Errors: ${errors} documents`);
    console.log(`   📝 Total processed: ${snapshot.size} documents\n`);

    if (errors === 0) {
      console.log('✅ Migration completed successfully!');
    } else {
      console.log('⚠️  Migration completed with errors. Please review the errors above.');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  migrateTotalField()
    .then(() => {
      console.log('\n✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateTotalField };

