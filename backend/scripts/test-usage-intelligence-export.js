/**
 * Test Usage Intelligence export end-to-end:
 *  1) Direct Firestore → ZIP (writeUsageDumpToFile)
 *  2) Async job lifecycle (start → poll → file ready)
 *  3) Mini HTTP server exercising the same job API the admin UI uses
 *
 * Usage:
 *   node backend/scripts/test-usage-intelligence-export.js
 *   node backend/scripts/test-usage-intelligence-export.js --days=1
 *   node backend/scripts/test-usage-intelligence-export.js --days=7 --max=500
 *   node backend/scripts/test-usage-intelligence-export.js --all --max=1000
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');
const express = require('express');

require('../server/firebase-admin');

const {
  writeUsageDumpToFile,
  startExportJob,
  getExportJob,
  getExportJobFile,
  seedProductReleases,
  listProductReleases,
  EXPORT_SOURCES,
  ALL_DATES_FROM
} = require('../server/usage-intelligence-service');

function parseArgs(argv) {
  const opts = { days: 1, all: false, max: 500, redactPii: true };
  for (const arg of argv) {
    if (arg === '--all') opts.all = true;
    else if (arg.startsWith('--days=')) opts.days = parseInt(arg.split('=')[1], 10) || 1;
    else if (arg.startsWith('--max=')) opts.max = parseInt(arg.split('=')[1], 10) || 500;
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForJob(jobId, { timeoutMs = 5 * 60 * 1000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const job = getExportJob(jobId);
    assert(job, `Job ${jobId} disappeared`);
    process.stdout.write(`   status=${job.status}${job.progress ? ` (${job.progress})` : ''}          \r`);
    if (job.status === 'ready' || job.status === 'error') {
      process.stdout.write('\n');
      return job;
    }
    await sleep(500);
  }
  throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
}

async function httpJson(base, method, urlPath, body) {
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) { json = { raw: text }; }
  return { status: res.status, json, headers: res.headers };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const outDir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  const to = new Date();
  const from = opts.all
    ? new Date(ALL_DATES_FROM)
    : new Date(Date.now() - opts.days * 24 * 60 * 60 * 1000);

  console.log('══ Usage Intelligence export test ══');
  console.log(`Sources: ${EXPORT_SOURCES.length}`);
  console.log(`Mode: ${opts.all ? 'all dates' : `last ${opts.days} day(s)`}`);
  console.log(`Range: ${from.toISOString()} → ${to.toISOString()}`);
  console.log(`maxPerCollection: ${opts.max}`);

  // ── Step 1: seed + direct ZIP ──────────────────────────────────────
  console.log('\n[1/3] Direct writeUsageDumpToFile…');
  await seedProductReleases({ email: 'test-script@local' });
  const releases = await listProductReleases();
  assert(releases.length > 0, 'Expected product_releases after seed');

  const zipPath = path.join(outDir, `usage-dump-test-${stamp}.zip`);
  const t0 = Date.now();
  const direct = await writeUsageDumpToFile(zipPath, {
    from: from.toISOString(),
    to: to.toISOString(),
    all: opts.all,
    redactPii: opts.redactPii,
    maxPerCollection: opts.max
  });
  const directStat = fs.statSync(zipPath);
  console.log(`   OK ${direct.filename} (${directStat.size} bytes) in ${Date.now() - t0}ms`);
  assert(directStat.size > 22, 'Direct ZIP too small');

  // ── Step 2: async job (in-process) ─────────────────────────────────
  console.log('\n[2/3] Async job lifecycle (in-process)…');
  const jobView = startExportJob(
    {
      from: from.toISOString(),
      to: to.toISOString(),
      all: opts.all,
      redactPii: opts.redactPii,
      maxPerCollection: opts.max
    },
    { email: 'test-script@local' }
  );
  assert(jobView?.id, 'startExportJob did not return id');
  assert(jobView.status === 'queued' || jobView.status === 'running', `Unexpected initial status ${jobView.status}`);
  console.log(`   started job ${jobView.id}`);

  const finished = await waitForJob(jobView.id);
  assert(finished.status === 'ready', `Job failed: ${finished.error || finished.status}`);
  assert(finished.bytes > 22, 'Job ZIP too small');

  const fileInfo = getExportJobFile(jobView.id);
  assert(fileInfo?.filePath && fs.existsSync(fileInfo.filePath), 'Job file missing on disk');
  console.log(`   OK job ready (${finished.bytes} bytes) → ${fileInfo.filename}`);

  // ── Step 3: HTTP job API (same contract as admin UI) ───────────────
  console.log('\n[3/3] HTTP job API (mini server)…');
  const app = express();
  app.use(express.json());
  app.post('/api/admin/usage-intelligence/export/jobs', (req, res) => {
    try {
      const job = startExportJob(req.body || {}, { email: 'http-test@local' });
      res.status(202).json({ success: true, job });
    } catch (err) {
      res.status(err.code === 'INVALID_INPUT' ? 400 : 500).json({
        success: false,
        error: { message: err.message }
      });
    }
  });
  app.get('/api/admin/usage-intelligence/export/jobs/:jobId', (req, res) => {
    const job = getExportJob(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: { message: 'not found' } });
    res.json({ success: true, job });
  });
  app.get('/api/admin/usage-intelligence/export/jobs/:jobId/download', (req, res) => {
    const info = getExportJobFile(req.params.jobId);
    if (!info) return res.status(404).json({ success: false, error: { message: 'not found' } });
    if (!info.filePath || info.job.status !== 'ready') {
      return res.status(409).json({ success: false, error: { message: `not ready: ${info.job.status}` } });
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${info.filename}"`);
    fs.createReadStream(info.filePath).pipe(res);
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  try {
    const start = await httpJson(base, 'POST', '/api/admin/usage-intelligence/export/jobs', {
      from: from.toISOString(),
      to: to.toISOString(),
      all: opts.all,
      redactPii: opts.redactPii,
      maxPerCollection: opts.max
    });
    assert(start.status === 202, `Expected 202, got ${start.status}: ${JSON.stringify(start.json)}`);
    const httpJobId = start.json.job.id;
    console.log(`   POST jobs → 202 job=${httpJobId}`);

    let ready = null;
    for (let i = 0; i < 600; i++) {
      await sleep(500);
      const st = await httpJson(base, 'GET', `/api/admin/usage-intelligence/export/jobs/${httpJobId}`);
      assert(st.status === 200, `Status poll failed: ${st.status}`);
      process.stdout.write(`   poll status=${st.json.job.status}          \r`);
      if (st.json.job.status === 'ready' || st.json.job.status === 'error') {
        process.stdout.write('\n');
        ready = st.json.job;
        break;
      }
    }
    assert(ready, 'HTTP job poll timed out');
    assert(ready.status === 'ready', `HTTP job error: ${ready.error}`);

    const dlRes = await fetch(`${base}/api/admin/usage-intelligence/export/jobs/${httpJobId}/download`);
    assert(dlRes.ok, `Download failed: HTTP ${dlRes.status}`);
    const ct = dlRes.headers.get('content-type') || '';
    assert(ct.includes('zip') || ct.includes('octet-stream'), `Bad content-type: ${ct}`);
    const buf = Buffer.from(await dlRes.arrayBuffer());
    assert(buf.length > 22, 'Downloaded ZIP too small');
    assert(buf[0] === 0x50 && buf[1] === 0x4b, 'Downloaded file is not a ZIP (missing PK header)');

    const httpZipPath = path.join(outDir, `usage-dump-http-${stamp}.zip`);
    fs.writeFileSync(httpZipPath, buf);
    console.log(`   GET download → ${buf.length} bytes OK`);

    // Validate ZIP has manifest
    const extractDir = path.join(outDir, `usage-dump-http-${stamp}-extracted`);
    fs.mkdirSync(extractDir, { recursive: true });
    execSync(`unzip -o -q "${httpZipPath}" -d "${extractDir}"`, { stdio: 'pipe' });
    assert(fs.existsSync(path.join(extractDir, 'manifest.json')), 'manifest.json missing');
    assert(fs.existsSync(path.join(extractDir, 'users.jsonl')), 'users.jsonl missing');
    const manifest = JSON.parse(fs.readFileSync(path.join(extractDir, 'manifest.json'), 'utf8'));
    assert(manifest.type === 'specifys-usage-intelligence-raw-dump', 'bad manifest type');
    console.log(`   manifest files: ${manifest.files.length}, total rows: ${manifest.files.reduce((n, f) => n + (f.rows || 0), 0)}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('\n✅ ALL TESTS PASSED — async job export works end-to-end');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ TEST FAILED');
  console.error(err.stack || err.message || err);
  process.exit(1);
});
