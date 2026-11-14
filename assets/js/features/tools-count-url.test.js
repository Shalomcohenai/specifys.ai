import test from 'node:test';
import assert from 'node:assert/strict';

import './tools-count-url.js';

const resolveToolsCountUrl = globalThis.resolveToolsCountUrl;

test('tools count uses the configured API base, not a relative Vercel path', () => {
  const url = resolveToolsCountUrl({
    getApiBaseUrl: () => 'https://specifys-ai-backend.onrender.com/'
  });
  assert.equal(url, 'https://specifys-ai-backend.onrender.com/api/tools/count');
  assert.equal(url.startsWith('/api/'), false);
});

test('tools count falls back through BACKEND_URL then the Render host', () => {
  assert.equal(
    resolveToolsCountUrl({ BACKEND_URL: 'https://example.test/' }),
    'https://example.test/api/tools/count'
  );
  assert.equal(
    resolveToolsCountUrl({}),
    'https://specifys-ai-backend.onrender.com/api/tools/count'
  );
});

test('homepage script calls the resolver instead of a relative fetch', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('./index/index.js', import.meta.url), 'utf8');
  assert.match(src, /resolveToolsCountUrl/);
  assert.equal(/fetch\(\s*['"]\/api\/tools\/count\/?['"]\s*\)/.test(src), false);
});
