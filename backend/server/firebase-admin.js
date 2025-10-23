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
    
} catch (error) {
    console.error('❌ Firebase Admin SDK initialization failed:', error.message);
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
