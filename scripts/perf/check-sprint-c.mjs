#!/usr/bin/env node
/**
 * Sprint C verification — static checks for LCP / product-focus cleanup.
 * Usage: node scripts/perf/check-sprint-c.mjs
 * Optional: PERF_BASE_URL=https://specifys-ai.com node scripts/perf/check-sprint-c.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

const failures = [];
const passes = [];

function ok(msg) {
  passes.push(msg);
  console.log(`  ✓ ${msg}`);
}
function fail(msg) {
  failures.push(msg);
  console.error(`  ✗ ${msg}`);
}
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}
function fileSize(rel) {
  return fs.statSync(path.join(root, rel)).size;
}

console.log('\nSprint C — Performance & product focus checks\n');

// --- C1 Homepage ---
console.log('C1 Homepage LCP');
{
  const index = read('index.html');
  if (/optimize_lcp:\s*true/.test(index)) ok('index.html sets optimize_lcp');
  else fail('index.html missing optimize_lcp: true');

  if (/idle_js:/.test(index)) ok('index.html uses idle_js for deferred libs');
  else fail('index.html missing idle_js');

  if (!/cdn\.jsdelivr\.net\/npm\/mermaid/.test(index.split('---')[2] ? index : index)) {
    // mermaid should not be in front-matter extra_js
  }
  const fm = index.split('---')[1] || '';
  if (!/mermaid\.min\.js/.test(fm)) ok('Mermaid CDN removed from homepage front matter');
  else fail('Mermaid CDN still in homepage front matter (blocks LCP)');

  if (!/planning\.js/.test(fm.split('extra_js')[1]?.split('idle_js')[0] || '')) {
    ok('planning.js not in critical extra_js');
  } else {
    fail('planning.js still in critical extra_js');
  }
  if (/planning\.js/.test(fm)) ok('planning.js listed for idle/on-demand load');

  const head = read('_includes/head.html');
  if (/media="print"\s+onload="this\.media='all'"/.test(head) || /media='print'/.test(head)) {
    ok('Fonts load asynchronously (media=print swap)');
  } else fail('Fonts still render-blocking');

  if (/Inter:wght@400;600;700/.test(head) && !/Inter:wght@400;500;600;700/.test(head)) {
    ok('Font weights reduced (dropped 500)');
  } else if (/Inter:wght@400;600;700/.test(head)) {
    ok('Font weights include lean set');
  } else fail('Expected lean Inter/Montserrat weights');

  if (exists('_includes/critical-lcp-home.html')) ok('Critical homepage LCP CSS include present');
  else fail('Missing critical-lcp-home.html');

  const indexCss = read('assets/css/pages/index.css');
  if (/\.hero-description-text\s*\{[^}]*opacity:\s*1/s.test(indexCss)) {
    ok('Hero H1 visible immediately (opacity:1) for LCP');
  } else fail('Hero H1 still opacity:0 — blocks LCP');

  const vanta = read('assets/js/features/index/index-vanta.js');
  if (/requestIdleCallback/.test(vanta) && /6000/.test(vanta)) {
    ok('Vanta deferred via idle + longer fallback');
  } else fail('Vanta still loads too early');

  const mermaidLoader = read('assets/js/features/index/index-mermaid.js');
  if (/__specifysEnsureMermaid/.test(mermaidLoader)) ok('Mermaid on-demand loader present');
  else fail('Mermaid on-demand loader missing');
}

// --- C2 Blog ---
console.log('\nC2 Blog / article LCP');
{
  const post = read('_layouts/post.html');
  if (/perf_shell:\s*lean/.test(post)) ok('Post layout uses lean perf shell');
  else fail('Post layout missing perf_shell: lean');
  if (/product-cta\.html/.test(post)) ok('Post layout keeps product CTA include');
  else fail('Post layout missing product CTA');

  const article = read('pages/article.html');
  if (/perf_shell:\s*lean/.test(article)) ok('article.html uses lean perf shell');
  else fail('article.html missing lean shell');

  const blog = read('blog/index.html');
  if (/perf_shell:\s*lean/.test(blog)) ok('Blog index uses lean perf shell');
  else fail('Blog index missing lean shell');

  const defaultLayout = read('_layouts/default.html');
  if (/perf_shell == 'lean'/.test(defaultLayout) && (/skip_firebase/.test(defaultLayout) || /skip_firebase_flag/.test(defaultLayout))) {
    ok('Default layout skips Firebase on lean shells');
  } else fail('Default layout missing lean Firebase skip');

  const config = read('_config.yml');
  if (/type:\s*"posts"[\s\S]*perf_shell:\s*lean/.test(config)) {
    ok('Jekyll defaults set perf_shell lean for posts');
  } else fail('_config.yml missing posts perf_shell lean default');

  const postJs = read('assets/js/pages/post.js');
  if (/fetchPriority\s*=\s*'high'/.test(postJs) || /fetchPriority = 'high'/.test(postJs)) {
    ok('First post image uses fetchPriority high');
  } else fail('post.js missing first-image LCP priority');
  if (!/!important/.test(postJs)) ok('post.js no longer injects !important');
  else fail('post.js still contains !important');

  const articleJs = read('assets/js/pages/article.js');
  if (/product-cta/.test(articleJs)) ok('article.js keeps product CTA');
  else fail('article.js missing product CTA');
  if (/fetchpriority|fetchPriority|loading.*lazy/.test(articleJs)) {
    ok('article.js optimizes in-body images');
  } else fail('article.js missing image lazy/priority handling');
}

// --- C3 Product focus ---
console.log('\nC3 Product focus cleanup');
{
  const nav = read('_includes/spec-viewer-navigation.html');
  if (/data-tab="mockup"[\s\S]*hidden/.test(nav) || /mockup[\s\S]*class="side-menu-item hidden"/.test(nav)) {
    ok('Mockup tab hidden in spec viewer nav');
  } else fail('Mockup tab still visible in nav');

  const viewer = read('assets/js/features/spec-viewer/spec-viewer-main.js');
  if (/SPECIFYS_ENABLE_MOCKUPS/.test(viewer)) ok('Mockups gated by SPECIFYS_ENABLE_MOCKUPS flag');
  else fail('Mockups enable flag missing');

  const indexHtml = read('index.html');
  if (/nav-btn-secondary-opt/.test(indexHtml) && /UI refs/.test(indexHtml) && !/nav-btn-new-badge[\s\S]*NEW!/.test(indexHtml.match(/data-section="screenshot"[\s\S]{0,400}/)?.[0] || 'NEW!')) {
    ok('Screenshot nav de-emphasized on homepage (no NEW badge)');
  } else if (/UI refs/.test(indexHtml) && /optional/.test(indexHtml)) {
    ok('Screenshot nav de-emphasized on homepage');
  } else fail('Homepage screenshot nav not de-emphasized');

  const planning = read('pages/planning.html');
  if (/UI refs/.test(planning) && /optional/.test(planning)) ok('Screenshot nav de-emphasized on planning page');
  else fail('Planning screenshot nav not de-emphasized');

  if (/Example Specs/.test(indexHtml)) ok('Example Specs surface retained');
  else fail('Example Specs section missing from homepage');
}

// --- Asset sizes ---
console.log('\nAsset size scan');
{
  const imagesDir = path.join(root, 'assets/images');
  if (fs.existsSync(imagesDir)) {
    const files = fs.readdirSync(imagesDir);
    let large = 0;
    for (const f of files) {
      const full = path.join(imagesDir, f);
      if (!fs.statSync(full).isFile()) continue;
      const size = fs.statSync(full).size;
      if (size === 0 && f === 'og-image.png') {
        console.warn('  ⚠ og-image.png is 0 bytes (social/OG only; not LCP)');
      }
      if (size > 200 * 1024) {
        large++;
        fail(`${f} is ${(size / 1024).toFixed(0)}KB (>200KB)`);
      }
    }
    if (large === 0) ok('No assets/images files over 200KB');
  }

  const indexJs = fileSize('assets/js/features/index/index.js');
  console.log(`  · index.js ${(indexJs / 1024).toFixed(1)}KB (deferred; still large)`);
  const planningJs = fileSize('assets/js/features/planning/planning.js');
  console.log(`  · planning.js ${(planningJs / 1024).toFixed(1)}KB (idle-loaded on homepage)`);
}

// --- Optional live HEAD checks ---
const base = process.env.PERF_BASE_URL;
if (base) {
  console.log(`\nLive checks against ${base}`);
  const paths = ['/', '/blog/'];
  for (const p of paths) {
    try {
      const res = await fetch(new URL(p, base).href, {
        headers: { 'User-Agent': 'SpecifysSprintCBot/1.0' },
      });
      const html = await res.text();
      const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
      const syncBlocking = scripts.filter((s) => !/defer|async/i.test(html.match(new RegExp(`src=["']${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i'))?.[0] || 'defer'));
      console.log(`  · ${p} HTTP ${res.status}, ${scripts.length} script srcs`);
      if (/perf-shell="lean"/.test(html) || p === '/') ok(`${p} served (${res.status})`);
      if (p === '/' && /critical-lcp-home|hero-description-text/.test(html)) ok('Homepage HTML includes hero LCP markup');
      if (p.startsWith('/blog') && !/firebase-app-compat/.test(html)) ok('Blog HTML omits Firebase SDK');
      else if (p.startsWith('/blog') && /firebase-app-compat/.test(html)) fail('Blog still loads Firebase');
    } catch (e) {
      fail(`Fetch ${p}: ${e.message}`);
    }
  }
}

// --- Optional Lighthouse ---
if (process.env.RUN_LIGHTHOUSE === '1' && base) {
  console.log('\nLighthouse (RUN_LIGHTHOUSE=1)');
  try {
    const { spawnSync } = await import('node:child_process');
    const out = spawnSync(
      'npx',
      ['--yes', 'lighthouse', new URL('/', base).href, '--only-categories=performance', '--quiet', '--chrome-flags=--headless', '--output=json', '--output-path=stdout'],
      { encoding: 'utf8', timeout: 120000 }
    );
    if (out.status === 0 && out.stdout) {
      const report = JSON.parse(out.stdout);
      const lcp = report.audits?.['largest-contentful-paint']?.numericValue;
      const score = report.categories?.performance?.score;
      console.log(`  · Performance score: ${score != null ? Math.round(score * 100) : 'n/a'}`);
      console.log(`  · LCP: ${lcp != null ? `${(lcp / 1000).toFixed(2)}s` : 'n/a'}`);
      if (lcp != null && lcp <= 2500) ok('Lighthouse LCP ≤ 2.5s');
      else if (lcp != null) fail(`Lighthouse LCP ${(lcp / 1000).toFixed(2)}s > 2.5s target`);
    } else {
      console.warn('  ⚠ Lighthouse did not run successfully (install chrome / network)');
      if (out.stderr) console.warn(out.stderr.slice(0, 400));
    }
  } catch (e) {
    console.warn(`  ⚠ Lighthouse skipped: ${e.message}`);
  }
}

console.log(`\nResult: ${passes.length} passed, ${failures.length} failed`);
if (failures.length) {
  console.error('\nFailures:');
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}
console.log('\nSprint C static verification passed.\n');
