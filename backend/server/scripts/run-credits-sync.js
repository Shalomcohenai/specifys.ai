#!/usr/bin/env node

/**
 * Manual script to run credits sync
 * Usage:
 *   node run-credits-sync.js [--dry-run] [--limit=N]
 */

const path = require('path');
const { syncAllUsersCredits } = require('../credits-sync-service');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function main() {
  const args = process.argv.slice(2);
  
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  console.log('='.repeat(60));
  console.log('Credits Sync Script');
  console.log('='.repeat(60));
  console.log(`Dry Run: ${dryRun ? 'YES' : 'NO'}`);
  console.log(`Limit: ${limit || 'All users'}`);
  console.log('='.repeat(60));
  console.log('');

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made');
    console.log('');
  }

  try {
    const report = await syncAllUsersCredits({
      dryRun,
      batchSize: 50,
      limit
    });

    console.log('');
    console.log('='.repeat(60));
    console.log('Sync Report');
    console.log('='.repeat(60));
    console.log(`Total Users: ${report.totalUsers}`);
    console.log(`Processed: ${report.processed}`);
    console.log(`Fixed: ${report.fixed}`);
    console.log(`Credits Fixed: ${report.creditsFixed}`);
    console.log(`Subscriptions Fixed: ${report.subscriptionsFixed}`);
    console.log(`Errors: ${report.errors}`);
    console.log('');
    
    if (report.usersWithIssues.length > 0) {
      console.log('Users with Issues:');
      report.usersWithIssues.slice(0, 10).forEach(user => {
        console.log(`  - ${user.userId}: ${user.errors.join(', ')}`);
      });
      if (report.usersWithIssues.length > 10) {
        console.log(`  ... and ${report.usersWithIssues.length - 10} more`);
      }
    }

    console.log('');
    console.log('✅ Sync completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

