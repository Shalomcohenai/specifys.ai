const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables - try multiple paths
const backendEnvPath = path.join(__dirname, '..', '.env');
const rootEnvPath = path.join(__dirname, '..', '..', '.env');
const serverEnvPath = path.join(__dirname, '.env');

if (fs.existsSync(backendEnvPath)) {
    dotenv.config({ path: backendEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(serverEnvPath)) {
    dotenv.config({ path: serverEnvPath });
} else {
    // Fallback to default lookup
    dotenv.config();
}

// Initialize Firebase Admin SDK
let app;

try {
    // Check if Firebase Admin is already initialized
    if (admin.apps.length === 0) {
        // Initialize with service account key (recommended for production)
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE) {
            const serviceAccount = require(`../${process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE}`);
            app = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: process.env.FIREBASE_PROJECT_ID || 'specify-ai',
                storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'specify-ai.appspot.com'
            });
        } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            app = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: process.env.FIREBASE_PROJECT_ID || 'specify-ai',
                storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'specify-ai.appspot.com'
            });
        } else if (fs.existsSync(path.join(__dirname, '../firebase-service-account.json'))) {
            // Auto-detect local service account file for development
            const serviceAccount = require('../firebase-service-account.json');
            app = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id || 'specify-ai',
                storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`
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
    console.error('[firebase-admin] Error initializing Firebase Admin SDK:', error.message);
    console.error('[firebase-admin] Error stack:', error.stack);
    // Log what we tried to use
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        console.error('[firebase-admin] FIREBASE_SERVICE_ACCOUNT_KEY exists but failed to initialize');
    } else {
        console.error('[firebase-admin] FIREBASE_SERVICE_ACCOUNT_KEY not found in environment');
    }
    // Don't throw here - let the app start and handle errors at runtime
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
