/**
 * Migration Script: Add newsletter subscription fields to all existing users
 * 
 * This script:
 * 1. Adds newsletterSubscribed: true to all existing users (as requested)
 * 2. Adds emailPreferences object with default values
 * 
 * Usage:
 *   node scripts/migrate-newsletter-fields.js
 * 
 * Dry run (preview changes without applying):
 *   DRY_RUN=true node scripts/migrate-newsletter-fields.js
 */

const path = require('path');
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
    // Try to use default credentials (for local development with gcloud CLI)
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'specify-ai'
    });
  }
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error.message);
  process.exit(1);
}

const db = admin.firestore();
const isDryRun = process.env.DRY_RUN === 'true';

async function migrateUsers() {
  console.log('\n🔄 Starting newsletter fields migration...\n');
  
  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be applied\n');
  }
  
  try {
    // Get all users
    console.log('📋 Fetching all users from Firestore...');
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('ℹ️  No users found in database');
      return;
    }
    
    console.log(`✅ Found ${usersSnapshot.size} users\n`);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process each user
    for (const doc of usersSnapshot.docs) {
      const userId = doc.id;
      const userData = doc.data();
      
      // Check if user already has newsletter fields
      const hasNewsletterSubscribed = userData.newsletterSubscribed !== undefined;
      const hasEmailPreferences = userData.emailPreferences !== undefined;
      
      if (hasNewsletterSubscribed && hasEmailPreferences) {
        console.log(`⏭️  Skipping user ${userId} (${userData.email || 'no email'}) - already has newsletter fields`);
        skipped++;
        continue;
      }
      
      // Prepare update data
      const updateData = {};
      
      if (!hasNewsletterSubscribed) {
        // Set newsletterSubscribed to true for all existing users (as requested)
        updateData.newsletterSubscribed = true;
      }
      
      if (!hasEmailPreferences) {
        // Set default email preferences
        updateData.emailPreferences = {
          newsletter: true,        // Subscribe to weekly newsletter
          updates: true,           // Receive product updates
          specNotifications: true, // Receive notifications when specs are created
          marketing: true          // Receive marketing emails
        };
      }
      
      if (isDryRun) {
        console.log(`[DRY RUN] Would update user ${userId} (${userData.email || 'no email'}):`);
        console.log(`  - newsletterSubscribed: ${updateData.newsletterSubscribed !== undefined ? updateData.newsletterSubscribed : 'unchanged'}`);
        console.log(`  - emailPreferences: ${updateData.emailPreferences ? JSON.stringify(updateData.emailPreferences) : 'unchanged'}`);
        updated++;
      } else {
        try {
          await db.collection('users').doc(userId).update(updateData);
          console.log(`✅ Updated user ${userId} (${userData.email || 'no email'})`);
          updated++;
        } catch (error) {
          console.error(`❌ Error updating user ${userId}:`, error.message);
          errors++;
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`   Total users: ${usersSnapshot.size}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);
    
    if (isDryRun) {
      console.log('\n⚠️  This was a DRY RUN - no changes were applied');
      console.log('   To apply changes, run: node scripts/migrate-newsletter-fields.js');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.stack);
    process.exit(1);
  }
}

// Run migration
migrateUsers()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

