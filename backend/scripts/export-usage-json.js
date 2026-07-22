/**
 * Export full Specifys usage intelligence dump to a single JSON file
 * (bypasses admin UI / Cloudflare — talks to Firestore directly).
 *
 * Usage:
 *   node backend/scripts/export-usage-json.js
 *   node backend/scripts/export-usage-json.js --out=/Users/you/Desktop/dump.json
 *   node backend/scripts/export-usage-json.js --max=100000 --redact
 *
 * Also writes a ZIP of JSONL next to the JSON.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

require('../server/firebase-admin');

const {
  writeUsageDumpToFile,
  seedProductReleases,
  ALL_DATES_FROM
} = require('../server/usage-intelligence-service');

function parseArgs(argv) {
  const opts = {
    out: null,
    max: 100000,
    redact: false,
    from: ALL_DATES_FROM,
    to: new Date().toISOString()
  };
  for (const arg of argv) {
    if (arg.startsWith('--out=')) opts.out = arg.slice(6);
    else if (arg.startsWith('--max=')) opts.max = parseInt(arg.split('=')[1], 10) || 100000;
    else if (arg === '--redact') opts.redact = true;
    else if (arg.startsWith('--from=')) opts.from = arg.slice(7);
    else if (arg.startsWith('--to=')) opts.to = arg.slice(5);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(outDir, { recursive: true });

  const zipPath = path.join(outDir, `usage-full-${stamp}.zip`);
  const jsonPath = opts.out
    ? path.resolve(opts.out)
    : path.join(outDir, `usage-full-${stamp}.json`);

  console.log('1) Seeding product_releases…');
  await seedProductReleases({ email: 'export-script@local' });

  console.log(`2) Building ZIP ${opts.from} → ${opts.to}…`);
  const t0 = Date.now();
  const result = await writeUsageDumpToFile(zipPath, {
    from: opts.from,
    to: opts.to,
    all: true,
    redactPii: opts.redact,
    maxPerCollection: opts.max
  });
  console.log(`   ZIP ready (${Date.now() - t0}ms): ${zipPath}`);

  console.log('3) Building single JSON…');
  const extractDir = path.join(outDir, `usage-full-${stamp}-extracted`);
  fs.mkdirSync(extractDir, { recursive: true });
  execSync(`unzip -o -q "${zipPath}" -d "${extractDir}"`);

  const manifest = JSON.parse(fs.readFileSync(path.join(extractDir, 'manifest.json'), 'utf8'));
  const collections = {};
  let total = 0;
  for (const f of fs.readdirSync(extractDir)) {
    if (!f.endsWith('.jsonl')) continue;
    const key = f.replace(/\.jsonl$/, '');
    const lines = fs.readFileSync(path.join(extractDir, f), 'utf8').split('\n').filter(Boolean);
    collections[key] = lines.map((line) => {
      try { return JSON.parse(line); } catch { return { _raw: line }; }
    });
    total += collections[key].length;
    console.log(`   ${key}: ${collections[key].length}`);
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    range: { from: opts.from, to: opts.to },
    note: 'Full Specifys usage intelligence raw dump for external analysis',
    manifest,
    collections
  };

  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(payload));
  const mb = (fs.statSync(jsonPath).size / 1024 / 1024).toFixed(2);

  console.log('\n✅ Done');
  console.log(`   Records: ${total}`);
  console.log(`   JSON: ${jsonPath} (${mb} MB)`);
  console.log(`   ZIP:  ${zipPath}`);
  console.log(`   Filename from service: ${result.filename}`);
}

main().catch((err) => {
  console.error('❌ Export failed:', err.stack || err.message || err);
  process.exit(1);
});
