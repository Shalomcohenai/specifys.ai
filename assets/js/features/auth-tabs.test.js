import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('auth queues gtag and does not put tabpanel on the login form', async () => {
  const html = await readFile(new URL('../../../pages/auth.html', import.meta.url), 'utf8');
  assert.match(html, /requestIdleCallback\(loadGtag/);
  assert.match(html, /dataLayer\.push/);
  assert.doesNotMatch(html, /id="login-form"[^>]*role="tabpanel"/);
  assert.match(html, /id="login-panel" role="tabpanel"/);
});
