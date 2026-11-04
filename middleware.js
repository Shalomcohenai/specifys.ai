import { next } from '@vercel/functions';
import map from './assets/data/seo-redirects.mjs';
import { resolveLegacyUrl } from './scripts/seo/resolve-legacy.mjs';

const SITE = 'https://www.specifys-ai.com';

export const config = {
  matcher: [
    '/article.html',
    '/pages/article.html',
    '/academy/guide.html',
    '/blog/:slug.html',
    '/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})/:slug*'
  ]
};

export default function middleware(request) {
  const url = new URL(request.url);
  const destination = resolveLegacyUrl(url.pathname, url.searchParams, map);
  if (!destination) return next();

  const target = new URL(destination, SITE);
  return new Response(null, {
    status: 301,
    headers: {
      Location: target.toString(),
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
