const { db, admin } = require('../firebase-admin');
const OpenAIStorageService = require('../openai-storage-service');
require('dotenv').config();

/**
 * Migration script to upload all existing specs to OpenAI
 * Usage: npm run migrate-to-openai
 */
async function migrateAllSpecs() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY is not set in environment variables');
    console.log('Please set OPENAI_API_KEY in your .env file');
    process.exit(1);
  }

  const openaiStorage = new OpenAIStorageService(process.env.OPENAI_API_KEY);
  
  try {
    console.log('🚀 Starting migration of specs to OpenAI...');
    console.log('⏳ This may take a while depending on the number of specs...\n');
    
    // Get all specs that haven't been uploaded yet
    const specsSnapshot = await db.collection('specs')
      .where('uploadedToOpenAI', '==', false)
      .get();
    
    // If no specs need migration, check for any specs at all
    if (specsSnapshot.empty) {
      const allSpecsSnapshot = await db.collection('specs').count().get();
      if (allSpecsSnapshot.data().count === 0) {
        console.log('ℹ️  No specs found in database');
        process.exit(0);
      }
      
      const alreadyUploaded = await db.collection('specs')
        .where('uploadedToOpenAI', '==', true)
        .count()
        .get();
      
      console.log(`✅ All ${alreadyUploaded.data().count} specs are already uploaded to OpenAI`);
      process.exit(0);
    }
    
    console.log(`📊 Found ${specsSnapshot.size} specs to migrate\n`);
    
    let successCount = 0;
    let errorCount = 0;
    let errorDetails = [];
    
    for (const doc of specsSnapshot.docs) {
      const specData = doc.data();
      const specId = doc.id;
      
      try {
        const currentNum = successCount + errorCount + 1;
        console.log(`[${currentNum}/${specsSnapshot.size}] Migrating spec ${specId}...`);
        
        // Upload to OpenAI
        const fileId = await openaiStorage.uploadSpec(specId, specData);
        
        // Update Firebase
        await db.collection('specs').doc(specId).update({
          openaiFileId: fileId,
          uploadedToOpenAI: true,
          openaiUploadTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        successCount++;
        console.log(`  ✓ Success (file ID: ${fileId})\n`);
        
        // Rate limiting - wait 1 second between uploads to avoid hitting API limits
        if (currentNum < specsSnapshot.size) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        errorCount++;
        const errorMsg = `  ✗ Failed: ${error.message}`;
        console.error(errorMsg);
        errorDetails.push({ specId, error: error.message });
        
        // Store error in Firebase
        try {
          await db.collection('specs').doc(specId).update({
            openaiUploadError: error.message
          });
        } catch (updateError) {
          console.error('  ⚠ Failed to store error in database:', updateError.message);
        }
        
        console.log(''); // Empty line for readability
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary');
    console.log('='.repeat(50));
    console.log(`Total specs processed: ${specsSnapshot.size}`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`Success rate: ${((successCount / specsSnapshot.size) * 100).toFixed(2)}%`);
    
    if (errorCount > 0) {
      console.log('\n' + '❌ Error Details:');
      errorDetails.forEach(({ specId, error }) => {
        console.log(`  - Spec ID: ${specId}`);
        console.log(`    Error: ${error}`);
      });
    }
    
    console.log('\n✅ Migration completed');
    
  } catch (error) {
    console.error('\n❌ Migration failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
migrateAllSpecs()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Migration error:', error);
    process.exit(1);
  });

