/**
 * Script to check spec owner
 * Usage: node backend/scripts/check-spec.js SPEC_ID
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

if (!specId) {
  console.error('❌ Please provide spec ID');
  console.log('Usage: node backend/scripts/check-spec.js SPEC_ID');
  process.exit(1);
}

async function checkSpec() {
  try {
    console.log(`📋 Checking spec: ${specId}`);
    
    const specRef = db.collection('specs').doc(specId);
    const specDoc = await specRef.get();
    
    if (!specDoc.exists) {
      console.log('❌ Spec not found');
      process.exit(1);
    }
    
    const data = specDoc.data();
    console.log('✅ Spec data:');
    console.log('   → Title:', data.title);
    console.log('   → UserId:', data.userId);
    console.log('   → UserName:', data.userName);
    console.log('   → IsPublic:', data.isPublic);
    console.log('   → CreatedAt:', data.createdAt?.toDate?.() || data.createdAt);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkSpec();

