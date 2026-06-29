#!/usr/bin/env node
/**
 * SEO audit for CI — validates sitemap, llms.txt, and page guardrails.
 * Run: node scripts/seo-audit.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const errors = [];
const warnings = [];

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function extractSitemapLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

function extractStaticUrlsFromGenerator() {
  const src = read('backend/server/sitemap-generator.js');
  const block = src.match(/const staticPages = \[([\s\S]*?)\];/);
  if (!block) return [];
  return [...block[1].matchAll(/loc: `\$\{baseUrl\}([^`]+)`/g)].map((m) => `https://specifys-ai.com${m[1]}`);
}

function checkNoindexInSitemap() {
  const noindexPages = [
    '/pages/auth.html',
    '/pages/profile.html',
    '/pages/spec-viewer.html',
    '/pages/articles.html',
    '/academy/guide.html',
    '/academy/category.html'
  ];
  const sitemap = read('sitemap.xml');
  const locs = extractSitemapLocs(sitemap);
  for (const fragment of noindexPages) {
    if (locs.some((loc) => loc.includes(fragment))) {
      errors.push(`Sitemap contains noindex URL fragment: ${fragment}`);
    }
  }
}

function checkStaticUrlsInSitemap() {
  const staticUrls = extractStaticUrlsFromGenerator();
  const locs = new Set(extractSitemapLocs(read('sitemap.xml')));
  for (const url of staticUrls) {
    if (!locs.has(url)) {
      errors.push(`Missing from sitemap: ${url}`);
    }
  }
}

function checkLlmsCoverage() {
  const llms = read('llms.txt');
  const staticUrls = extractStaticUrlsFromGenerator();
  const hubUrls = staticUrls.filter((u) =>
    u.includes('/pages/compare') ||
    u.includes('/pages/guides') ||
    u.includes('/pages/integrations') ||
    u.includes('/pages/for-ai-assistants') ||
    u.includes('/pages/mcp.html')
  );
  for (const url of hubUrls) {
    if (!llms.includes(url.replace('https://specifys-ai.com', ''))) {
      warnings.push(`llms.txt missing link to ${url}`);
    }
  }
}

function checkSingleH1(pages) {
  for (const pagePath of pages) {
    const full = path.join(ROOT, pagePath);
    if (!fs.existsSync(full)) continue;
    const html = fs.readFileSync(full, 'utf8');
    const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
    if (h1Count > 1) {
      warnings.push(`${pagePath}: ${h1Count} H1 tags (prefer 1)`);
    }
  }
}

function checkPostsInSitemap() {
  const postsDir = path.join(ROOT, '_posts');
  if (!fs.existsSync(postsDir)) return;
  const locs = new Set(extractSitemapLocs(read('sitemap.xml')));
  const files = fs.readdirSync(postsDir).filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f));
  let missing = 0;
  for (const file of files) {
    const m = file.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/);
    if (!m) continue;
    const url = `https://specifys-ai.com/${m[1]}/${m[2]}/${m[3]}/${m[4]}/`;
    if (!locs.has(url)) missing += 1;
  }
  if (missing > 0) {
    errors.push(`${missing} Jekyll posts missing from sitemap.xml — run node backend/scripts/generate-sitemap.js`);
  }
}

function checkIndexNowKeyFile() {
  const keyFile = path.join(ROOT, 'specifysai-indexnow-key.txt');
  if (!fs.existsSync(keyFile)) {
    warnings.push('Missing specifysai-indexnow-key.txt for IndexNow');
    return;
  }
  const key = fs.readFileSync(keyFile, 'utf8').trim();
  if (!key || key.includes('REPLACE')) {
    warnings.push('IndexNow key file contains placeholder');
  }
}

checkNoindexInSitemap();
checkStaticUrlsInSitemap();
checkLlmsCoverage();
checkPostsInSitemap();
checkIndexNowKeyFile();
checkSingleH1([
  'index.html',
  'pages/about.html',
  'pages/how.html',
  'pages/why.html',
  'pages/pricing.html',
  'pages/compare.html',
  'pages/guides/vibe-coding.html'
]);

console.log('SEO audit\n=========');
if (warnings.length) {
  console.log('\nWarnings:');
  warnings.forEach((w) => console.log(`  ⚠ ${w}`));
}
if (errors.length) {
  console.log('\nErrors:');
  errors.forEach((e) => console.log(`  ✗ ${e}`));
  process.exit(1);
}
console.log('\n✓ SEO audit passed');
if (warnings.length) process.exit(0);
