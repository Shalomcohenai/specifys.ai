/**
 * Pure resolver for legacy Specifys.ai URLs.
 * Returns a path to 301 to, or null to serve the request unchanged.
 */

const ARTICLES_INDEX = '/blog/';

const STOP_TOKENS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'your', 'how',
  'are', 'its', 'via', 'over', 'than', 'about', 'after', 'before', 'when',
  'what', 'who', 'new', 'top', 'key', 'out', 'per', 'not', 'but', 'you'
]);

export function normalizePath(pathname) {
  let path = pathname || '/';
  try {
    path = decodeURIComponent(path);
  } catch {
    // keep the raw path
  }
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1 && path.endsWith('/')) {
    const leaf = path.slice(0, -1).split('/').pop() || '';
    if (leaf.includes('.')) path = path.replace(/\/+$/, '');
  } else if (path !== '/') {
    const leaf = path.split('/').pop() || '';
    if (!leaf.includes('.')) path = `${path}/`;
  }
  return path;
}

export function tokensForSlug(slug) {
  return String(slug || '')
    .toLowerCase()
    .split('-')
    .filter((token) => token.length >= 3 && !STOP_TOKENS.has(token));
}

/**
 * Closest published post when the slug is not exact.
 * Requires a token of length >= 6 that appears on exactly one post,
 * so generic words like "coding" cannot pick an arbitrary article.
 */
export function closestPostPath(slug, posts, tokenFreq) {
  const tokens = tokensForSlug(slug);
  if (!tokens.length || !Array.isArray(posts)) return null;

  const ranked = [];
  for (const post of posts) {
    const postTokens = post.tokens || [];
    const shared = tokens.filter((token) => postTokens.includes(token));
    if (!shared.length) continue;
    const uniqueHits = shared.filter((token) => token.length >= 6 && tokenFreq[token] === 1);
    if (!uniqueHits.length) continue;
    const union = new Set([...tokens, ...postTokens]).size;
    ranked.push({
      path: post.path,
      uniqueHits: uniqueHits.length,
      shared: shared.length,
      score: union ? shared.length / union : 0
    });
  }

  if (!ranked.length) return null;
  ranked.sort((a, b) => b.uniqueHits - a.uniqueHits || b.shared - a.shared || b.score - a.score);
  const best = ranked[0];
  const second = ranked[1];
  if (!second) return best.path;
  if (best.uniqueHits > second.uniqueHits) return best.path;
  if (best.score - second.score >= 0.08) return best.path;
  return null;
}

function articleDestination(slug, map) {
  const key = String(slug || '').trim().toLowerCase();
  if (!key) return ARTICLES_INDEX;
  if (map.articleSlugs && map.articleSlugs[key]) return map.articleSlugs[key];
  return closestPostPath(key, map.posts, map.tokenFreq || {}) || ARTICLES_INDEX;
}

/**
 * @param {string} pathname
 * @param {URLSearchParams} searchParams
 * @param {object} map
 * @returns {string|null}
 */
export function resolveLegacyUrl(pathname, searchParams, map) {
  const path = normalizePath(pathname);
  const params = searchParams || new URLSearchParams();

  if (path === '/article.html' || path === '/pages/article.html') {
    return articleDestination(params.get('slug'), map);
  }

  if (path === '/academy/guide.html') {
    const id = (params.get('guide') || '').trim();
    if (!id) return null;
    if (map.guides && map.guides[id]) return map.guides[id];
    if (map.guideSlugs && map.guideSlugs[id]) return map.guideSlugs[id];
    return null;
  }

  if (path === '/blog.html' || path === '/pages/articles.html' || path === '/articles.html') {
    return ARTICLES_INDEX;
  }
  if (path === '/index.html') return '/';
  if (path === '/pages/academy' || path === '/pages/academy/') return '/academy.html';

  const blogHtml = path.match(/^\/blog\/([^/]+)\.html$/);
  if (blogHtml) return articleDestination(blogHtml[1], map);

  const dated = path.match(/^\/(\d{4})\/(\d{2})\/(\d{2})\/([^/]+)\/$/);
  if (dated) {
    const destination = articleDestination(dated[4], map);
    if (destination === path) return null;
    return destination;
  }

  return null;
}
