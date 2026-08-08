#!/usr/bin/env node
/**
 * Verify Living Brief Enter-to-send on localhost.
 * Usage: node backend/scripts/verify-living-brief-enter.js [frontendUrl]
 */
const { spawnSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

const BASE = process.argv[2] || 'http://127.0.0.1:4000';
const root = path.resolve(__dirname, '../..');

function assert(name, cond, detail) {
  if (!cond) {
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`ok    ${name}`);
  return true;
}

function waitForUrl(url, attempts = 60) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const tick = () => {
      n += 1;
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) return resolve(true);
        if (n >= attempts) return reject(new Error(`Bad status ${res.statusCode} for ${url}`));
        setTimeout(tick, 500);
      });
      req.on('error', () => {
        if (n >= attempts) return reject(new Error(`Not reachable: ${url}`));
        setTimeout(tick, 500);
      });
    };
    tick();
  });
}

function staticChecks() {
  console.log('\n== Static checks ==\n');
  const indexHtml = fs.readFileSync(path.join(root, '_site/index.html'), 'utf8');
  const jsPathSite = path.join(root, '_site/assets/js/features/planning/living-brief.js');
  const jsPathSrc = path.join(root, 'assets/js/features/planning/living-brief.js');
  const js = fs.readFileSync(fs.existsSync(jsPathSite) ? jsPathSite : jsPathSrc, 'utf8');

  assert('form#lbComposerForm in built HTML', indexHtml.includes('id="lbComposerForm"'));
  assert('lbInput is growable textarea', /<textarea[^>]*id="lbInput"/.test(indexHtml));
  assert('inline onsubmit wired', /LivingBrief\.sendFromForm/.test(indexHtml));
  assert('JS exposes sendFromForm', js.includes('sendFromForm'));
  assert('JS auto-grows composer', js.includes('autoGrowInput'));
  assert('JS Enter-to-send on textarea', js.includes("e.key !== 'Enter'") || js.includes("e.key === 'Enter'"));
  assert('JS does not set send.disabled', !/send\.disabled\s*=/.test(js));
}

async function apiCheck() {
  console.log('\n== API check ==\n');
  const candidates = ['http://127.0.0.1:10000', 'http://127.0.0.1:3000', 'http://127.0.0.1:5000'];
  let base = null;
  for (const c of candidates) {
    try {
      await waitForUrl(c + '/api/health', 6);
      base = c;
      break;
    } catch (_) {
      /* next */
    }
  }
  if (!base) {
    console.log('skip  backend not ready');
    return;
  }
  console.log(`backend: ${base}`);
  const res = await fetch(`${base}/api/planning/living-brief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Web SaaS with Stripe then onboard then pay' }],
      draft: {}
    })
  });
  const data = await res.json().catch(() => ({}));
  assert('POST /api/planning/living-brief', res.ok && data.success, `status=${res.status}`);
  assert('reply present', typeof data.reply === 'string' && data.reply.length > 5);
}

function browserCheck() {
  console.log('\n== Browser Enter check ==\n');
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-enter-'));
  const runner = path.join(work, 'run.mjs');
  fs.writeFileSync(
    path.join(work, 'package.json'),
    JSON.stringify({ name: 'lb-enter-check', private: true, type: 'module' })
  );
  fs.writeFileSync(
    runner,
    `
import { chromium } from 'playwright';

const BASE = process.env.LB_BASE || 'http://127.0.0.1:4000';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e && e.message ? e.message : e)));

await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
await page.evaluate(() => {
  const m = document.getElementById('accessCodeModal');
  if (m) {
    m.setAttribute('aria-hidden', 'true');
    m.classList.remove('active');
    m.style.display = 'none';
  }
});

await page.evaluate(async () => {
  if (typeof window.__specifysEnsureIdleScripts === 'function') {
    await window.__specifysEnsureIdleScripts();
  }
});

await page.evaluate(() => {
  if (typeof showPlanningInterface === 'function') showPlanningInterface();
});

await page.waitForSelector('#livingBrief', { state: 'visible', timeout: 20000 });
await page.waitForFunction(() => !!(window.LivingBrief && window.LivingBrief.sendFromForm), null, { timeout: 20000 });
await page.evaluate(() => window.LivingBrief.init());
await page.waitForSelector('#lbInput', { state: 'visible', timeout: 10000 });

const meta = await page.evaluate(() => {
  const el = document.getElementById('lbInput');
  const form = document.getElementById('lbComposerForm');
  return {
    tag: el && el.tagName,
    hasOnsubmit: !!(form && form.getAttribute('onsubmit')),
    livingBrief: typeof window.LivingBrief
  };
});

await page.fill('#lbInput', 'Web SaaS inbox for founders with Stripe and auth');
await page.focus('#lbInput');
await page.keyboard.press('Enter');

await page.waitForFunction(() => document.querySelectorAll('#lbMessages .lb-msg--user').length >= 1, null, {
  timeout: 15000
});

const after = await page.evaluate(() => {
  const el = document.getElementById('lbInput');
  const users = Array.from(document.querySelectorAll('#lbMessages .lb-msg--user .lb-bubble')).map((n) =>
    (n.textContent || '').trim()
  );
  return { value: el ? el.value : null, users, height: el ? el.style.height : null };
});

await browser.close();

if (meta.tag !== 'TEXTAREA') {
  console.error('FAIL meta', JSON.stringify({ meta, after, pageErrors }));
  process.exit(1);
}
if (!after.users.some((u) => /SaaS inbox/i.test(u))) {
  console.error('FAIL no user message', JSON.stringify({ meta, after, pageErrors }));
  process.exit(1);
}
if (after.value !== '') {
  console.error('FAIL input not cleared', JSON.stringify({ meta, after, pageErrors }));
  process.exit(1);
}
console.log('ok    TEXTAREA composer');
console.log('ok    Enter created user message');
console.log('ok    input cleared after send');
`
  );

  let r = spawnSync('npm', ['install', 'playwright@1.49.0', '--no-save', '--no-package-lock'], {
    cwd: work,
    encoding: 'utf8',
    timeout: 180000
  });
  if (r.status !== 0) {
    console.error(r.stdout, r.stderr);
    throw new Error('npm install playwright failed');
  }
  r = spawnSync('npx', ['playwright', 'install', 'chromium'], {
    cwd: work,
    encoding: 'utf8',
    timeout: 180000
  });
  if (r.status !== 0) {
    console.error(r.stdout, r.stderr);
    throw new Error('playwright install chromium failed');
  }
  r = spawnSync('node', [runner], {
    cwd: work,
    encoding: 'utf8',
    env: { ...process.env, LB_BASE: BASE },
    timeout: 120000
  });
  process.stdout.write(r.stdout || '');
  process.stderr.write(r.stderr || '');
  if (r.status !== 0) throw new Error(`browser check failed (exit ${r.status})`);
}

async function main() {
  console.log(`Frontend: ${BASE}`);
  await waitForUrl(BASE + '/', 80);
  // Ensure _site has latest source HTML if jekyll hasn't regenerated yet
  const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  if (src.includes('sendFromForm') && !fs.readFileSync(path.join(root, '_site/index.html'), 'utf8').includes('sendFromForm')) {
    console.log('note  rebuilding jekyll so _site matches source…');
    const build = spawnSync('bundle', ['exec', 'jekyll', 'build'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 120000
    });
    if (build.status !== 0) console.error(build.stderr || build.stdout);
  }
  staticChecks();
  await apiCheck();
  browserCheck();
  if (process.exitCode) {
    console.error('\nFAILED\n');
    process.exit(process.exitCode);
  }
  console.log('\nAll Enter-send checks passed\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
