#!/usr/bin/env node

/**
 * Cleanup Orphaned Assistants Script
 * 
 * This script cleans up all existing OpenAI assistants and files
 * to start fresh with the new implementation.
 * 
 * Run with: node backend/server/scripts/cleanup-orphaned-assistants.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { db, admin } = require('../firebase-admin');
const OpenAIStorageService = require('../openai-storage-service');

async function cleanupOrphanedAssistants() {

  
  if (!process.env.OPENAI_API_KEY) {

    process.exit(1);
  }
  
  const openaiStorage = new OpenAIStorageService(process.env.OPENAI_API_KEY);
  
  try {
    // Get all specs
    const specsSnapshot = await db.collection('specs').get();

    
    let cleanedCount = 0;
    let skippedCount = 0;
    
    for (const specDoc of specsSnapshot.docs) {
      const specData = specDoc.data();
      const specId = specDoc.id;
      

      
      if (!specData.openaiAssistantId && !specData.openaiFileId) {

        skippedCount++;
        continue;
      }
      
      if (specData.openaiAssistantId) {

        try {
          await openaiStorage.deleteAssistant(specData.openaiAssistantId);

        } catch (error) {

        }
      }
      
      if (specData.openaiFileId) {

        try {
          await openaiStorage.deleteFile(specData.openaiFileId);

        } catch (error) {

        }
      }
      
      // Clear from Firebase
      try {
        await db.collection('specs').doc(specId).update({
          openaiAssistantId: admin.firestore.FieldValue.delete(),
          openaiFileId: admin.firestore.FieldValue.delete(),
          uploadedToOpenAI: false,
          openaiUploadTimestamp: admin.firestore.FieldValue.delete()
        });

        cleanedCount++;
      } catch (error) {

      }
    }
    





    
  } catch (error) {

    process.exit(1);
  }
}

// Run cleanup
cleanupOrphanedAssistants()
  .then(() => {

    process.exit(0);
  })
  .catch((error) => {

    process.exit(1);
  });

