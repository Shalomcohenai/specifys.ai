/**
 * Script to mark a demo spec as public using isPublic flag
 * Run with: node backend/scripts/mark-demo-spec.js
 */

const admin = require('firebase-admin');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
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
    console.error('❌ Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const db = admin.firestore();
const DEMO_SPEC_ID = 'iAzaUwtSW3qvcW87lICL';

async function markDemoSpecAsPublic() {
  try {
    console.log(`📝 Marking spec ${DEMO_SPEC_ID} as public...`);
    
    const specRef = db.collection('specs').doc(DEMO_SPEC_ID);
    const specDoc = await specRef.get();
    
    if (!specDoc.exists) {
      console.error('❌ Spec not found!');
      process.exit(1);
    }
    
    await specRef.update({
      isPublic: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Successfully marked demo spec as public!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error marking demo spec:', error);
    process.exit(1);
  }
}

// Run the script
markDemoSpecAsPublic();

