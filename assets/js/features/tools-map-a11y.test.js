import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the tools map paints without a blocking font and keeps the tooltip inside the card', async () => {
  const html = await readFile(new URL('../../../tools/map/vibe-coding-tools-map.html', import.meta.url), 'utf8');
  const jsx = await readFile(new URL('../../../tools/map/tools-map-app.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /display=block/);
  assert.doesNotMatch(html, /background:\s*#f5f5f5\s*!important/);
  assert.match(html, /bottom:\s*52px/);
  assert.doesNotMatch(html, /top:\s*-30px/);
  assert.doesNotMatch(jsx, /Open \$\{tool\.name\} website/);
  assert.match(jsx, /visually-hidden/);
});
