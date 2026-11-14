import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('admin dashboard does not ship the dummy test@example.com placeholder', async () => {
  const html = await readFile(new URL('../../../pages/new-admin-dashboard.html', import.meta.url), 'utf8');
  assert.equal(html.includes('test@example.com'), false);
  assert.match(html, /id="test-email-input"/);
  assert.match(html, /Recipient Email Address/);
});
