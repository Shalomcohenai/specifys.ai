/**
 * Build the legacy URL map from _posts, academy guide ids, and refresh
 * vercel.json path redirects. Query redirects stay in middleware so the
 * slug/guide query string is not appended to the canonical URL.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tokensForSlug } from './resolve-legacy.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const POSTS_DIR = path.join(ROOT, '_posts');
const GUIDES_DIR = path.join(ROOT, '_guides');
const IDS_PATH = path.join(ROOT, 'assets/data/academy-guide-ids.json');
const MAP_PATH = path.join(ROOT, 'assets/data/seo-redirects.mjs');
const LEGACY_JSON_PATH = path.join(ROOT, 'assets/data/seo-redirects.json');
const VERCEL_PATH = path.join(ROOT, 'vercel.json');

const STATIC_REDIRECTS = [
  ['/index.html', '/'],
  ['/blog.html', '/blog/'],
  ['/pages/articles.html', '/blog/'],
  ['/articles.html', '/blog/'],
  ['/pages/academy', '/academy.html'],
  ['/pages/academy/', '/academy.html']
];

function readFrontMatter(content) {
  if (!content.startsWith('---')) return '';
  const end = content.indexOf('\n---', 3);
  return end === -1 ? '' : content.slice(3, end);
}

function field(front, name) {
  const match = front.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'));
  if (!match) return '';
  return match[1].trim().replace(/^['"]|['"]$/g, '');
}

function toPath(urlOrPath) {
  if (!urlOrPath) return '';
  let value = urlOrPath.trim();
  value = value.replace(/^https?:\/\/(?:www\.)?specifys-ai\.com/i, '');
  if (!value.startsWith('/')) value = `/${value}`;
  if (!value.endsWith('/') && !value.split('/').pop().includes('.')) value = `${value}/`;
  return value;
}

function loadPosts() {
  const files = fs.readdirSync(POSTS_DIR).filter((name) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(name));
  return files.map((fileName) => {
    const match = fileName.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/);
    const [, fileYear, fileMonth, fileDay, slug] = match;
    const content = fs.readFileSync(path.join(POSTS_DIR, fileName), 'utf8');
    const front = readFrontMatter(content);
    const date = field(front, 'date');
    const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const [year, month, day] = dateMatch
      ? [dateMatch[1], dateMatch[2], dateMatch[3]]
      : [fileYear, fileMonth, fileDay];
    const served = `/${year}/${month}/${day}/${slug}/`;
    const filenamePath = `/${fileYear}/${fileMonth}/${fileDay}/${slug}/`;
    const declared = toPath(field(front, 'canonical_url'));
    const noindex = /noindex/i.test(field(front, 'robots'));
    const alias = Boolean(declared && declared !== served);
    return {
      slug,
      served,
      filenamePath,
      declared: declared || served,
      alias,
      noindex,
      tokens: tokensForSlug(slug)
    };
  });
}

function loadGuides() {
  const guideFiles = new Set(
    fs.readdirSync(GUIDES_DIR)
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.replace(/\.md$/, ''))
  );
  const ids = JSON.parse(fs.readFileSync(IDS_PATH, 'utf8'));
  const guides = {};
  const guideSlugs = {};
  for (const entry of ids) {
    if (!entry.id || !entry.slug || !guideFiles.has(entry.slug)) continue;
    const destination = `/academy/guides/${entry.slug}/`;
    guides[entry.id] = destination;
    guideSlugs[entry.slug] = destination;
  }
  return { guides, guideSlugs };
}

function buildMap(posts, guideData) {
  const canonicalPosts = posts.filter((post) => !post.alias);
  const canonicalPaths = new Set(canonicalPosts.map((post) => post.served));
  const articleSlugs = {};
  const pathRedirects = [];

  for (const post of posts) {
    const destination = post.alias && canonicalPaths.has(post.declared) ? post.declared : post.served;
    articleSlugs[post.slug] = destination;
    const sources = new Set([
      `/blog/${post.slug}.html`,
      post.filenamePath,
      post.served
    ]);
    for (const source of sources) {
      if (source !== destination) pathRedirects.push([source, destination]);
    }
  }

  const tokenFreq = {};
  for (const post of canonicalPosts) {
    for (const token of new Set(post.tokens)) {
      tokenFreq[token] = (tokenFreq[token] || 0) + 1;
    }
  }

  return {
    articleSlugs,
    posts: canonicalPosts.map((post) => ({
      slug: post.slug,
      path: post.served,
      tokens: post.tokens
    })),
    tokenFreq,
    guides: guideData.guides,
    guideSlugs: guideData.guideSlugs,
    pathRedirects
  };
}

function redirectEntry(source, destination) {
  return { source, destination, statusCode: 301 };
}

function writeVercel(pathRedirects) {
  const vercel = JSON.parse(fs.readFileSync(VERCEL_PATH, 'utf8'));
  const seen = new Set();
  const redirects = [];
  for (const [source, destination] of [...STATIC_REDIRECTS, ...pathRedirects]) {
    if (!source || !destination || source === destination || seen.has(source)) continue;
    seen.add(source);
    redirects.push(redirectEntry(source, destination));
  }
  redirects.sort((a, b) => a.source.localeCompare(b.source));
  vercel.trailingSlash = true;
  vercel.redirects = redirects;
  if (Array.isArray(vercel.rewrites)) {
    vercel.rewrites = vercel.rewrites.filter((rule) => rule.source !== '/sitemap.xml');
    if (vercel.rewrites.length === 0) delete vercel.rewrites;
  }
  fs.writeFileSync(VERCEL_PATH, `${JSON.stringify(vercel, null, 2)}\n`);
  return redirects.length;
}

function writeMap(map) {
  // Plain ESM so Vercel's middleware bundler can import it. Import attributes
  // (`with { type: 'json' }`) fail that bundler with "Expected ';' but found 'with'".
  const source = `/**\n * Generated by scripts/seo/build-legacy-redirects.mjs. Do not edit.\n */\nexport default ${JSON.stringify(map, null, 2)};\n`;
  fs.mkdirSync(path.dirname(MAP_PATH), { recursive: true });
  fs.writeFileSync(MAP_PATH, source);
  if (fs.existsSync(LEGACY_JSON_PATH)) fs.unlinkSync(LEGACY_JSON_PATH);
}

function main() {
  const posts = loadPosts();
  const guideData = loadGuides();
  const map = buildMap(posts, guideData);
  writeMap(map);
  const count = writeVercel(map.pathRedirects);
  const aliasCount = posts.filter((post) => post.alias).length;
  console.log(`posts ${posts.length}, aliases ${aliasCount}, guides ${Object.keys(map.guides).length}, vercel redirects ${count}`);
}

main();
