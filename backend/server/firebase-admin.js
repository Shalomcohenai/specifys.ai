const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin SDK
let app;

try {
    // Check if Firebase Admin is already initialized
    if (admin.apps.length === 0) {
        // Initialize with service account key (recommended for production)
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            app = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: process.env.FIREBASE_PROJECT_ID || 'specify-ai',
                storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'specify-ai.firebasestorage.app'
            });
        } else {
            // For development - initialize with default credentials
            // Make sure to set GOOGLE_APPLICATION_CREDENTIALS environment variable
            app = admin.initializeApp({
                projectId: process.env.FIREBASE_PROJECT_ID || 'specify-ai'
            });
        }
    } else {
        app = admin.app();
    }
    
    console.log('✅ Firebase Admin SDK initialized successfully');
} catch (error) {
    console.error('❌ Firebase Admin SDK initialization failed:', error.message);
    console.log('Make sure you have:');
    console.log('1. Set FIREBASE_SERVICE_ACCOUNT_KEY environment variable, OR');
    console.log('2. Set GOOGLE_APPLICATION_CREDENTIALS to your service account key file, OR');
    console.log('3. Run "firebase login" and "gcloud auth application-default login"');
}

const db = admin.firestore();
const auth = admin.auth();

// Export Firebase Admin services
module.exports = {
    admin,
    app,
    db,
    auth
};
