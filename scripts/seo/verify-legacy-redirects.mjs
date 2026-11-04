/**
 * Assert legacy URL resolution and that the sitemap only lists canonical www URLs.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveLegacyUrl } from './resolve-legacy.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/seo-redirects.json'), 'utf8'));
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');

const failures = [];

function check(name, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures.push(`${name}\n  expected ${expected}\n  actual   ${actual}`);
}

function resolve(pathname, query = '') {
  return resolveLegacyUrl(pathname, new URLSearchParams(query), map);
}

const rocmai = '/2026/07/28/amds-rocmai-ai-driven-development-tools-for-developers/';
const opus = '/2026/02/10/claude-opus-46-revolutionizes-lovables-app-development-with-21-efficiency-boost/';
const gemini = '/2026/02/10/googles-antigravity-and-gemini-cli-redefining-developer-workflows-in-2026/';
const gpt = '/2025/12/15/openais-gpt-52-redefining-ais-role-in-coding-and-professional-tasks/';
const assistants = '/2025/01/19/ai-coding-assistants-2025/';
const article8 = '/2025/09/26/article8/';
const outage = '/2026/03/03/claude-code-faces-major-outage-amid-surging-demand-a-new-challenge-for-anthropics-vibe-coding-tool/';

check('amd legacy slug', resolve('/article.html', 'slug=amds-rocmai-unveils-ai-driven-tools-to-supercharge-developer-workflows'), rocmai);
check('opus slug', resolve('/article.html', 'slug=claude-opus-46-revolutionizes-lovables-app-development-with-21-efficiency-boost'), opus);
check('gemini slug', resolve('/article.html', 'slug=googles-antigravity-and-gemini-cli-redefining-developer-workflows-in-2026'), gemini);
check('unknown slug', resolve('/article.html', 'slug=zzzz-not-a-real-article'), '/blog/');
check('empty slug', resolve('/article.html', ''), '/blog/');
check('filename date gpt', resolve('/2025/12/16/openais-gpt-52-redefining-ais-role-in-coding-and-professional-tasks/'), gpt);
check('canonical gpt', resolve('/2025/12/15/openais-gpt-52-redefining-ais-role-in-coding-and-professional-tasks/'), null);
check('assistants canonical', resolve(assistants), null);
check('article8 canonical', resolve(article8), null);
check('blog html article8', resolve('/blog/article8.html'), article8);
check('blog html assistants', resolve('/blog/ai-coding-assistants-2025.html'), assistants);
check('duplicate downtime', resolve('/2026/03/03/anthropics-claude-code-downtime-unpacking-the-ripples-in-ai-coding/'), outage);
check('missing dated slug', resolve('/2024/01/01/zzzz-not-a-real-article/'), '/blog/');

const guideId = Object.keys(map.guides)[0];
const guidePath = map.guides[guideId];
check('guide id', resolve('/academy/guide.html', `guide=${guideId}`), guidePath);
check('guide slug', resolve('/academy/guide.html', 'guide=what-is-vibe-coding'), '/academy/guides/what-is-vibe-coding/');
check('unknown guide stays', resolve('/academy/guide.html', 'guide=not-a-real-guide-id'), null);

const redirectSources = new Set(vercel.redirects.map((rule) => rule.source));
if (!redirectSources.has('/2025/12/16/openais-gpt-52-redefining-ais-role-in-coding-and-professional-tasks/')) {
  failures.push('vercel.json missing filename-date redirect for gpt-5.2');
}
if (!redirectSources.has('/blog/ai-coding-assistants-2025.html')) {
  failures.push('vercel.json missing /blog/ai-coding-assistants-2025.html');
}
if (vercel.redirects.some((rule) => rule.source === '/article.html')) {
  failures.push('article.html query redirects must stay in middleware so the slug query is not appended');
}
if (vercel.trailingSlash !== true) failures.push('trailingSlash should be true');
if ((vercel.rewrites || []).some((rule) => rule.source === '/sitemap.xml')) {
  failures.push('sitemap.xml must be the static canonical file, not a backend rewrite');
}

const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
const canonical = new Set(map.posts.map((post) => `https://www.specifys-ai.com${post.path}`));
for (const loc of locs) {
  if (!loc.startsWith('https://www.specifys-ai.com')) failures.push(`non-www sitemap loc ${loc}`);
  if (loc.includes('article.html') || loc.includes('guide.html?')) failures.push(`legacy sitemap loc ${loc}`);
  if (/\/20\d{2}\/\d{2}\/\d{2}\//.test(loc) && !canonical.has(loc)) {
    failures.push(`sitemap date URL is not a canonical post: ${loc}`);
  }
  if (/\/20\d{2}\/\d{2}\/\d{2}\/[^/]+$/.test(loc) || /\/academy\/guides\/[^/]+$/.test(loc)) {
    failures.push(`sitemap directory URL missing trailing slash: ${loc}`);
  }
}
if (locs.some((loc) => loc.includes('anthropics-claude-code-downtime'))) {
  failures.push('sitemap still lists the duplicate downtime URL');
}

if (failures.length) {
  console.error(failures.join('\n\n'));
  process.exit(1);
}
console.log(`legacy redirects ok (${locs.length} sitemap urls, ${vercel.redirects.length} path redirects, ${Object.keys(map.guides).length} guide ids)`);
