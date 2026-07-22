/**
 * Test Usage Intelligence raw export end-to-end (Firestore → ZIP).
 *
 * Usage:
 *   node backend/scripts/test-usage-intelligence-export.js
 *   node backend/scripts/test-usage-intelligence-export.js --days=7
 *   node backend/scripts/test-usage-intelligence-export.js --days=30
 *   node backend/scripts/test-usage-intelligence-export.js --all
 *   node backend/scripts/test-usage-intelligence-export.js --max=500
 *
 * Exit code 0 = ZIP written and validated. Non-zero = failure.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Ensure firebase-admin is initialized via the shared module (loads .env)
require('../server/firebase-admin');

const {
  writeUsageDumpToFile,
  seedProductReleases,
  listProductReleases,
  EXPORT_SOURCES,
  ALL_DATES_FROM
} = require('../server/usage-intelligence-service');

function parseArgs(argv) {
  const opts = { days: 7, all: false, max: 2000, redactPii: true };
  for (const arg of argv) {
    if (arg === '--all') opts.all = true;
    else if (arg.startsWith('--days=')) opts.days = parseInt(arg.split('=')[1], 10) || 7;
    else if (arg.startsWith('--max=')) opts.max = parseInt(arg.split('=')[1], 10) || 2000;
    else if (arg === '--no-redact') opts.redactPii = false;
  }
  return opts;
}

function assert(condition, message) {
  if (!condition) {
    const err = new Error(message);
    err.code = 'ASSERT';
    throw err;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const outDir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const zipPath = path.join(outDir, `usage-dump-test-${stamp}.zip`);
  const extractDir = path.join(outDir, `usage-dump-test-${stamp}-extracted`);

  console.log('── Usage Intelligence export test ──');
  console.log(`Sources: ${EXPORT_SOURCES.length} collections`);
  console.log(`Mode: ${opts.all ? 'all dates' : `last ${opts.days} days`}`);
  console.log(`maxPerCollection: ${opts.max}`);
  console.log(`Output: ${zipPath}`);

  console.log('\n1) Seeding product_releases (idempotent)…');
  const seedResults = await seedProductReleases({ email: 'test-script@local' });
  const created = seedResults.filter((r) => r.status === 'created').length;
  const skipped = seedResults.filter((r) => r.status === 'skipped').length;
  console.log(`   seed: ${created} created, ${skipped} skipped`);

  console.log('2) Listing releases…');
  const releases = await listProductReleases();
  console.log(`   releases: ${releases.length}`);
  assert(releases.length > 0, 'Expected at least one product_release after seed');

  const to = new Date();
  const from = opts.all
    ? new Date(ALL_DATES_FROM)
    : new Date(Date.now() - opts.days * 24 * 60 * 60 * 1000);

  console.log(`3) Building ZIP (${from.toISOString()} → ${to.toISOString()})…`);
  const started = Date.now();
  const result = await writeUsageDumpToFile(zipPath, {
    from: from.toISOString(),
    to: to.toISOString(),
    all: opts.all,
    redactPii: opts.redactPii,
    maxPerCollection: opts.max
  });
  const elapsedMs = Date.now() - started;
  const stat = fs.statSync(zipPath);
  console.log(`   wrote ${result.filename} (${stat.size} bytes) in ${elapsedMs}ms`);
  assert(stat.size > 22, 'ZIP file is empty or too small');

  console.log('4) Validating ZIP contents…');
  fs.mkdirSync(extractDir, { recursive: true });
  try {
    execSync(`unzip -o -q "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' });
  } catch (e) {
    throw new Error(`Failed to unzip: ${e.message}`);
  }

  const manifestPath = path.join(extractDir, 'manifest.json');
  assert(fs.existsSync(manifestPath), 'manifest.json missing from ZIP');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(manifest.type === 'specifys-usage-intelligence-raw-dump', 'Bad manifest type');
  assert(Array.isArray(manifest.files) && manifest.files.length > 0, 'manifest.files empty');

  const requiredFiles = [
    'users.jsonl',
    'page_views.jsonl',
    'analytics_events.jsonl',
    'product_releases.jsonl',
    'specs_summary.jsonl',
    'manifest.json'
  ];
  for (const name of requiredFiles) {
    assert(fs.existsSync(path.join(extractDir, name)), `Missing ${name} in ZIP`);
  }

  const usersLines = fs.readFileSync(path.join(extractDir, 'users.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean);
  console.log(`   users.jsonl rows: ${usersLines.length}`);
  assert(usersLines.length > 0, 'users.jsonl is empty — expected at least one user');

  const releaseLines = fs.readFileSync(path.join(extractDir, 'product_releases.jsonl'), 'utf8')
    .split('\n')
    .filter(Boolean);
  console.log(`   product_releases.jsonl rows: ${releaseLines.length}`);
  assert(releaseLines.length > 0, 'product_releases.jsonl is empty');

  console.log('\n── Per-file stats ──');
  let totalRows = 0;
  for (const f of manifest.files) {
    totalRows += f.rows || 0;
    const flag = f.error ? ` ERROR=${f.error}` : '';
    const trunc = f.truncated ? ' truncated' : '';
    const fb = f.usedFallback ? ' fallback' : '';
    console.log(`   ${f.file}: ${f.rows} rows${trunc}${fb}${flag}`);
  }
  console.log(`\nTotal rows: ${totalRows}`);
  assert(totalRows > 0, 'Export produced zero rows across all collections');

  console.log('\n✅ Usage Intelligence export test PASSED');
  console.log(`   ZIP: ${zipPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Usage Intelligence export test FAILED');
  console.error(err.stack || err.message || err);
  process.exit(1);
});
