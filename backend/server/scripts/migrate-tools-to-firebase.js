/**
 * Migration Script - Tools JSON to Firestore
 * Run this script once to migrate all tools from JSON to Firebase
 * 
 * Usage:
 *   node migrate-tools-to-firebase.js [--dry-run] [--skip-existing]
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const backendEnvPath = path.join(__dirname, '../..', '.env');
const rootEnvPath = path.join(__dirname, '../../../', '.env');

if (require('fs').existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
} else if (require('fs').existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

const { migrateTools } = require('../tools-migration-service');
const { logger } = require('../logger');

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipExisting = !args.includes('--no-skip-existing');
  
  console.log('\n=== Tools Migration Script ===\n');
  console.log('Options:');
  console.log(`  Dry Run: ${dryRun ? 'YES (no changes will be saved)' : 'NO (will save to Firestore)'}`);
  console.log(`  Skip Existing: ${skipExisting ? 'YES' : 'NO'}`);
  console.log('');
  
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be saved to Firestore\n');
  } else {
    console.log('⚠️  LIVE MODE - Changes will be saved to Firestore\n');
    console.log('Press Ctrl+C within 5 seconds to cancel...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  try {
    const result = await migrateTools({ dryRun, skipExisting });
    
    console.log('\n=== Migration Results ===\n');
    console.log(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Request ID: ${result.requestId}`);
    console.log('');
    
    if (result.success) {
      const { results } = result;
      console.log('Summary:');
      console.log(`  Total tools: ${results.total}`);
      console.log(`  Validated: ${results.validated}`);
      console.log(`  Created: ${results.created}`);
      console.log(`  Updated: ${results.updated}`);
      console.log(`  Skipped: ${results.skipped}`);
      console.log(`  Errors: ${results.errors.length}`);
      console.log('');
      
      if (results.errors.length > 0) {
        console.log('Errors:');
        results.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. Tool #${error.index} (${error.name}):`);
          if (error.errors) {
            error.errors.forEach(err => console.log(`     - ${err}`));
          } else {
            console.log(`     - ${error.error}`);
          }
        });
        console.log('');
      }
      
      if (dryRun) {
        console.log('ℹ️  This was a dry run. Run without --dry-run to actually migrate.');
      } else {
        console.log('✅ Migration completed successfully!');
      }
    } else {
      console.log('Error:');
      console.log(`  ${result.error.message}`);
      if (result.error.stack) {
        console.log('\nStack trace:');
        console.log(result.error.stack);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Fatal error:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the script
main().then(() => {
  console.log('\n=== Script completed ===\n');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Unhandled error:');
  console.error(error);
  process.exit(1);
});

