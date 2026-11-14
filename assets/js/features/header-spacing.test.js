import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function narrowBlock(css) {
  const marker = '.header-center {\n    position: static;';
  const alt = '.header-center {\n    position: static;';
  let at = css.indexOf(marker);
  if (at < 0) at = css.indexOf(alt);
  assert.ok(at >= 0, 'expected a static header-center rule');
  const before = css.slice(Math.max(0, at - 900), at);
  assert.match(before, /@media \(max-width: 480px\)/);
  return css.slice(at, at + 220);
}

test('narrow header keeps the wordmark out of the login control', async () => {
  for (const rel of [
    'assets/css/layout/_header.scss',
    'assets/css/main-compiled.css'
  ]) {
    const css = await readFile(new URL('../../../' + rel, import.meta.url), 'utf8');
    const block = await narrowBlock(css);
    assert.match(block, /position:\s*static/);
    assert.match(block, /padding-inline:\s*8px/);
  }
  const scss = await readFile(new URL('../../../assets/css/layout/_header.scss', import.meta.url), 'utf8');
  const media = scss.slice(scss.indexOf('@media (max-width: 480px)'));
  assert.match(media, /gap:\s*12px/);
  assert.match(media, /\.header-left\s*\{[^}]*flex:\s*0 0 auto/s);
});
