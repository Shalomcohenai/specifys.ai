import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function headerNarrow(css) {
  const pad = css.indexOf('padding: 8px 8px;');
  assert.ok(pad >= 0, 'expected the 480px header padding');
  const start = css.lastIndexOf('@media (max-width: 480px)', pad);
  assert.ok(start >= 0, 'expected a 480px header query');
  return css.slice(start, pad + 1200);
}

test('narrow header keeps the centered wordmark and shortens the login control', async () => {
  for (const rel of [
    'assets/css/layout/_header.scss',
    'assets/css/layout/_header.css',
    'assets/css/main-compiled.css'
  ]) {
    const css = await readFile(new URL('../../../' + rel, import.meta.url), 'utf8');
    const block = headerNarrow(css);
    assert.doesNotMatch(block, /position:\s*static/);
    assert.match(block, /\.auth-btn\s*\{[^}]*padding:\s*8px 0/s);
    assert.match(block, /white-space:\s*nowrap/);
  }
  const scss = await readFile(new URL('../../../assets/css/layout/_header.scss', import.meta.url), 'utf8');
  assert.match(scss, /\.header-center\s*\{[^}]*position:\s*absolute/s);
});
