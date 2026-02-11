/**
 * Migration: Sync Pro users (users.plan === 'pro') to user_credits_v3
 *
 * Ensures every user with plan === 'pro' in the users collection has
 * user_credits_v3.subscription.type === 'pro' and status active/paid,
 * so /api/v3/credits returns unlimited: true and they are not blocked from mockup/edit.
 *
 * Usage: node backend/scripts/migrate-pro-users-to-v3.js [--dry-run]
 *
 * Options:
 *   --dry-run  Only list users that would be updated, do not write.
 */

const { db } = require('../server/firebase-admin');
const creditsV3Service = require('../server/credits-v3-service');

const CREDITS_COLLECTION_V3 = 'user_credits_v3';
const USERS_COLLECTION = 'users';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

if (isDryRun) {
  console.log('🔍 DRY RUN – no changes will be written\n');
}

function isProActiveInV3(creditsDoc) {
  if (!creditsDoc || !creditsDoc.exists) return false;
  const data = creditsDoc.data();
  const sub = data && data.subscription;
  if (!sub || sub.type !== 'pro') return false;
  const status = (sub.status || '').toLowerCase();
  return status === 'active' || status === 'paid';
}

async function run() {
  console.log('Fetching users with plan === "pro"...\n');
  const usersSnap = await db.collection(USERS_COLLECTION).where('plan', '==', 'pro').get();
  const proUserIds = usersSnap.docs.map(d => d.id);
  console.log(`Found ${proUserIds.length} user(s) with plan === "pro".\n`);

  if (proUserIds.length === 0) {
    console.log('Nothing to migrate.');
    process.exit(0);
    return;
  }

  const toFix = [];
  const noV3Doc = [];

  for (const userId of proUserIds) {
    const creditsDoc = await db.collection(CREDITS_COLLECTION_V3).doc(userId).get();
    if (!creditsDoc.exists) {
      noV3Doc.push(userId);
      continue;
    }
    if (!isProActiveInV3(creditsDoc)) {
      toFix.push(userId);
    }
  }

  if (noV3Doc.length > 0) {
    console.log(`⚠️  ${noV3Doc.length} Pro user(s) have no user_credits_v3 document (will still get Pro via frontend fallback):`);
    noV3Doc.forEach(uid => console.log(`   - ${uid}`));
    console.log('');
  }

  if (toFix.length === 0) {
    console.log('✅ All Pro users with a V3 credits doc already have subscription.type=pro and status active/paid. Nothing to update.');
    process.exit(0);
    return;
  }

  console.log(`📋 Pro users to fix in V3 (subscription not pro/active): ${toFix.length}\n`);

  let ok = 0;
  let err = 0;

  for (const userId of toFix) {
    try {
      if (!isDryRun) {
        await creditsV3Service.enableProSubscription(userId, {
          subscriptionStatus: 'active',
          subscriptionId: null,
          productKey: 'migration-pro-sync',
          productName: 'Pro (migration sync)'
        });
      }
      console.log(`${isDryRun ? '[DRY RUN] Would fix' : '✓ Fixed'} ${userId}`);
      ok++;
    } catch (e) {
      console.error(`✗ Error for ${userId}:`, e.message);
      err++;
    }
  }

  console.log('');
  if (isDryRun) {
    console.log(`[DRY RUN] Would have updated ${ok} user(s). Run without --dry-run to apply.`);
  } else {
    console.log(`Done. Updated: ${ok}, errors: ${err}.`);
  }
  process.exit(err > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
