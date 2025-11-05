const { db, admin } = require('../firebase-admin');
const OpenAIStorageService = require('../openai-storage-service');
require('dotenv').config();

/**
 * Migration script to upload all existing specs to OpenAI
 * Usage: npm run migrate-to-openai
 */
async function migrateAllSpecs() {
  if (!process.env.OPENAI_API_KEY) {


    process.exit(1);
  }

  const openaiStorage = new OpenAIStorageService(process.env.OPENAI_API_KEY);
  
  try {


    
    // Get all specs that haven't been uploaded yet
    const specsSnapshot = await db.collection('specs')
      .where('uploadedToOpenAI', '==', false)
      .get();
    
    // If no specs need migration, check for any specs at all
    if (specsSnapshot.empty) {
      const allSpecsSnapshot = await db.collection('specs').count().get();
      if (allSpecsSnapshot.data().count === 0) {

        process.exit(0);
      }
      
      const alreadyUploaded = await db.collection('specs')
        .where('uploadedToOpenAI', '==', true)
        .count()
        .get();
      

      process.exit(0);
    }
    

    
    let successCount = 0;
    let errorCount = 0;
    let errorDetails = [];
    
    for (const doc of specsSnapshot.docs) {
      const specData = doc.data();
      const specId = doc.id;
      
      try {
        const currentNum = successCount + errorCount + 1;

        
        // Upload to OpenAI
        const fileId = await openaiStorage.uploadSpec(specId, specData);
        
        // Update Firebase
        await db.collection('specs').doc(specId).update({
          openaiFileId: fileId,
          uploadedToOpenAI: true,
          openaiUploadTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        successCount++;

        
        // Rate limiting - wait 1 second between uploads to avoid hitting API limits
        if (currentNum < specsSnapshot.size) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        errorCount++;
        const errorMsg = `  ✗ Failed: ${error.message}`;

        errorDetails.push({ specId, error: error.message });
        
        // Store error in Firebase
        try {
          await db.collection('specs').doc(specId).update({
            openaiUploadError: error.message
          });
        } catch (updateError) {

        }
        

      }
    }
    







    
    if (errorCount > 0) {

      errorDetails.forEach(({ specId, error }) => {


      });
    }
    

    
  } catch (error) {


    process.exit(1);
  }
}

// Run migration
migrateAllSpecs()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {

    process.exit(1);
  });

