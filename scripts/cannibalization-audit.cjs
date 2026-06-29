#!/usr/bin/env node
/**
 * Detect potential keyword cannibalization in _posts/.
 * Groups posts by normalized title tokens; flags clusters with 2+ posts.
 * Run: node scripts/cannibalization-audit.js
 */

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '..', '_posts');
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'in', 'on', 'for', 'to', 'of', 'with', 'how', 'is', 'are', 'vs']);

function tokenize(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function signature(title) {
  const tokens = tokenize(title);
  return tokens.slice(0, 5).sort().join('-');
}

function parseFrontMatter(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const title = (match[1].match(/^title:\s*"?([^"\n]+)"?/m) || [])[1];
  const canonical = (match[1].match(/^canonical_url:\s*(\S+)/m) || [])[1];
  const date = (match[1].match(/^date:\s*(\S+)/m) || [])[1];
  return { title, canonical_url: canonical, date };
}

const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
const clusters = new Map();

for (const file of files) {
  const meta = parseFrontMatter(path.join(POSTS_DIR, file));
  if (!meta.title) continue;
  const sig = signature(meta.title);
  if (!clusters.has(sig)) clusters.set(sig, []);
  clusters.get(sig).push({ file, ...meta });
}

const duplicates = [...clusters.entries()].filter(([, posts]) => posts.length > 1);

console.log(`Cannibalization audit — ${files.length} posts, ${duplicates.length} potential clusters\n`);

for (const [sig, posts] of duplicates.sort((a, b) => b[1].length - a[1].length).slice(0, 25)) {
  console.log(`Cluster: ${sig} (${posts.length} posts)`);
  posts.forEach((p) => console.log(`  - ${p.date || '?'} ${p.title}`));
  console.log('');
}

if (duplicates.length > 0) {
  console.log('Recommendation: pick one canonical post per cluster; 301 or noindex the rest.');
}
