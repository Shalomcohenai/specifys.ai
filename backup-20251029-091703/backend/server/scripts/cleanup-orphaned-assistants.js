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
  console.log('🚀 Starting cleanup of orphaned assistants...\n');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not set in environment');
    process.exit(1);
  }
  
  const openaiStorage = new OpenAIStorageService(process.env.OPENAI_API_KEY);
  
  try {
    // Get all specs
    const specsSnapshot = await db.collection('specs').get();
    console.log(`📊 Found ${specsSnapshot.size} specs to process\n`);
    
    let cleanedCount = 0;
    let skippedCount = 0;
    
    for (const specDoc of specsSnapshot.docs) {
      const specData = specDoc.data();
      const specId = specDoc.id;
      
      console.log(`\n📝 Processing spec: ${specId}`);
      
      if (!specData.openaiAssistantId && !specData.openaiFileId) {
        console.log(`   ⏭️  No OpenAI resources to clean`);
        skippedCount++;
        continue;
      }
      
      if (specData.openaiAssistantId) {
        console.log(`   🗑️  Deleting assistant: ${specData.openaiAssistantId}`);
        try {
          await openaiStorage.deleteAssistant(specData.openaiAssistantId);
          console.log(`   ✅ Assistant deleted`);
        } catch (error) {
          console.log(`   ⚠️  Failed to delete assistant: ${error.message}`);
        }
      }
      
      if (specData.openaiFileId) {
        console.log(`   🗑️  Deleting file: ${specData.openaiFileId}`);
        try {
          await openaiStorage.deleteFile(specData.openaiFileId);
          console.log(`   ✅ File deleted`);
        } catch (error) {
          console.log(`   ⚠️  Failed to delete file: ${error.message}`);
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
        console.log(`   ✅ Firebase updated`);
        cleanedCount++;
      } catch (error) {
        console.log(`   ⚠️  Failed to update Firebase: ${error.message}`);
      }
    }
    
    console.log(`\n\n✨ Cleanup complete!`);
    console.log(`   📊 Total specs: ${specsSnapshot.size}`);
    console.log(`   🧹 Cleaned: ${cleanedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`\n💡 Next time you open a chat, new assistants will be created with the updated implementation.\n`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanupOrphanedAssistants()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

