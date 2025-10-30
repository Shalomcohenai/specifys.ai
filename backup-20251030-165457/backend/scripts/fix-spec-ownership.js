/**
 * Script to fix spec ownership
 * Usage: node backend/scripts/fix-spec-ownership.js SPEC_ID NEW_USER_ID
 */

const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

if (admin.apps.length === 0) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE) {
      const serviceAccount = require(`../${process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE}`);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || 'specify-ai',
      });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || 'specify-ai',
      });
    } else {
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'specify-ai'
      });
    }
  } catch (error) {
    console.error('Failed to initialize:', error);
    process.exit(1);
  }
}

const db = admin.firestore();
const specId = process.argv[2];
const option = process.argv[3]; // 'public' or user ID

if (!specId) {
  console.error('❌ Please provide spec ID');
  console.log('Usage: node backend/scripts/fix-spec-ownership.js SPEC_ID [public|NEW_USER_ID]');
  process.exit(1);
}

async function fixSpec() {
  try {
    console.log(`📋 Fixing spec: ${specId}`);
    
    const specRef = db.collection('specs').doc(specId);
    const specDoc = await specRef.get();
    
    if (!specDoc.exists) {
      console.log('❌ Spec not found');
      process.exit(1);
    }
    
    const data = specDoc.data();
    console.log('✅ Current spec data:');
    console.log('   → UserId:', data.userId);
    console.log('   → IsPublic:', data.isPublic);
    
    if (option === 'public') {
      // Mark as public
      await specRef.update({
        isPublic: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Spec marked as public!');
    } else if (option) {
      // Transfer ownership
      await specRef.update({
        userId: option,
        userName: 'Updated User',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✅ Spec ownership transferred to: ${option}`);
    } else {
      console.log('\nOptions:');
      console.log('  1. Mark as public: node backend/scripts/fix-spec-ownership.js SPEC_ID public');
      console.log('  2. Transfer ownership: node backend/scripts/fix-spec-ownership.js SPEC_ID NEW_USER_ID');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixSpec();

