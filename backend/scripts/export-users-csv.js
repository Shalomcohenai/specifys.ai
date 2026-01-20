/**
 * Export Users to CSV
 * 
 * This script exports all users from Firestore to a CSV file
 * 
 * Usage:
 *   node backend/scripts/export-users-csv.js
 * 
 * Output:
 *   users-export-YYYY-MM-DD-HHmmss.csv in the backend/scripts directory
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
const backendEnvPath = path.join(__dirname, '..', '.env');
const rootEnvPath = path.join(__dirname, '..', '..', '.env');
const serverEnvPath = path.join(__dirname, '..', 'server', '.env');

let loadedEnvPath = null;

if (dotenv.config({ path: backendEnvPath }).parsed) {
  loadedEnvPath = backendEnvPath;
  console.log(`✅ Loaded .env from: ${backendEnvPath}`);
} else if (dotenv.config({ path: rootEnvPath }).parsed) {
  loadedEnvPath = rootEnvPath;
  console.log(`✅ Loaded .env from: ${rootEnvPath}`);
} else if (dotenv.config({ path: serverEnvPath }).parsed) {
  loadedEnvPath = serverEnvPath;
  console.log(`✅ Loaded .env from: ${serverEnvPath}`);
} else {
  dotenv.config();
  console.log('⚠️  Using default .env lookup');
}

// Initialize Firebase Admin
const admin = require('firebase-admin');

let serviceAccount;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE) {
    serviceAccount = require(path.join(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT_KEY_FILE));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id || 'specify-ai'
    });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id || 'specify-ai'
    });
  } else {
    serviceAccount = require(path.join(__dirname, '..', 'firebase-service-account.json'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || 'specify-ai'
    });
  }
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error.message);
  process.exit(1);
}

const db = admin.firestore();

/**
 * Escape CSV field (handle commas, quotes, and newlines)
 */
function escapeCsvField(field) {
  if (field === null || field === undefined) {
    return '';
  }
  
  const str = String(field);
  
  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

/**
 * Format date to ISO string
 */
function formatDate(timestamp) {
  if (!timestamp) return '';
  
  // Handle Firestore Timestamp
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  
  // Handle regular Date
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  
  // Handle string or number
  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    return new Date(timestamp).toISOString();
  }
  
  return '';
}

async function exportUsersToCsv() {
  try {
    console.log('📊 Starting user export...\n');
    
    // Get all users from Firestore
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('⚠️  No users found in Firestore');
      return;
    }
    
    console.log(`✅ Found ${usersSnapshot.size} users\n`);
    
    // Define CSV columns
    const headers = [
      'User ID',
      'Email',
      'Display Name',
      'Plan',
      'Newsletter Subscribed',
      'Email Preferences (Newsletter)',
      'Email Preferences (Operational)',
      'Email Preferences (Marketing)',
      'Created At',
      'Updated At',
      'Last Login'
    ];
    
    // Create CSV rows
    const rows = [headers.map(escapeCsvField).join(',')];
    
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      
      const row = [
        doc.id, // User ID
        escapeCsvField(userData.email || ''),
        escapeCsvField(userData.displayName || ''),
        escapeCsvField(userData.plan || 'free'),
        escapeCsvField(userData.newsletterSubscribed !== false ? 'Yes' : 'No'),
        escapeCsvField(userData.emailPreferences?.newsletter !== false ? 'Yes' : 'No'),
        escapeCsvField(userData.emailPreferences?.operational !== false ? 'Yes' : 'No'),
        escapeCsvField(userData.emailPreferences?.marketing !== false ? 'Yes' : 'No'),
        formatDate(userData.createdAt),
        formatDate(userData.updatedAt),
        formatDate(userData.lastLoginAt)
      ];
      
      rows.push(row.join(','));
    }
    
    // Generate filename with timestamp
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5); // YYYY-MM-DDTHHmmss
    const filename = `users-export-${timestamp}.csv`;
    const filepath = path.join(__dirname, filename);
    
    // Write CSV file
    const csvContent = rows.join('\n');
    fs.writeFileSync(filepath, csvContent, 'utf8');
    
    console.log(`✅ Export completed successfully!`);
    console.log(`📁 File saved to: ${filepath}`);
    console.log(`📊 Total users exported: ${usersSnapshot.size}`);
    
  } catch (error) {
    console.error('❌ Error exporting users:', error);
    process.exit(1);
  }
}

// Run the export
exportUsersToCsv()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
