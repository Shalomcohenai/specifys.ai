import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the homepage preview names the RelayDesk spec and keeps 14px tabs', async () => {
  const html = await readFile(new URL('../../../index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../css/pages/index.css', import.meta.url), 'utf8');
  assert.match(html, /See the RelayDesk spec/);
  assert.doesNotMatch(html, />See more</);
  assert.match(css, /\.browser-window-tab\s*\{[^}]*font-size:\s*14px/);
  assert.doesNotMatch(css, /\.browser-window-tab\s*\{[^}]*font-size:\s*9\.6px/);
  assert.doesNotMatch(css, /\.browser-window-tab\s*\{[^}]*font-size:\s*10\.4px/);
});
