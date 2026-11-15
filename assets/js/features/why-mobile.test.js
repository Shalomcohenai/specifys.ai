import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the Why page shows the first screen immediately and keeps the preview out of tab order', async () => {
  const html = await readFile(new URL('../../../pages/why.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../css/pages/why.css', import.meta.url), 'utf8');
  assert.match(html, /questions-box-preview[^>]*\sinert/);
  assert.doesNotMatch(html, /<h4>Questions<\/h4>/);
  assert.match(html, /<h3>Questions<\/h3>/);
  assert.match(css, /data-section="0"\] \.section-title/);
  assert.doesNotMatch(css, /opacity:\s*0\s*!important/);
});
