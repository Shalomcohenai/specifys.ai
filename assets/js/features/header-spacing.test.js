import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

test('narrow header shows a full Log in label and compiles the menu from Sass', async () => {
  const scss = await readFile(new URL('../../../assets/css/layout/_header.scss', import.meta.url), 'utf8');
  assert.match(scss, /\.header-center\s*\{[^}]*position:\s*absolute/s);
  assert.match(scss, /\.auth-label-short\s*\{[^}]*display:\s*inline/s);
  assert.match(scss, /\.header-menu-toggle\s*\{[^}]*min-width:\s*44px/s);
  assert.doesNotMatch(scss, /50%\s*-\s*78px/);
  assert.doesNotMatch(scss, /overflow:\s*hidden/);

  const scssPath = fileURLToPath(new URL('../../../assets/css/main.scss', import.meta.url));
  const compiled = sass.compile(scssPath, {
    style: 'expanded',
    loadPaths: [path.dirname(scssPath)],
    silenceDeprecations: ['import']
  }).css;
  assert.match(compiled, /\.header-menu-toggle\s*\{[^}]*min-width:\s*44px/s);
  assert.match(compiled, /\.thematic-header\.nav-open \.header-nav\s*\{[^}]*display:\s*flex/s);
  assert.match(compiled, /\.auth-label-short\s*\{[^}]*display:\s*inline/s);
  assert.match(compiled, /header\.thematic-header > \.header-center\s*\{[^}]*position:\s*static/s);
  assert.doesNotMatch(compiled, /50%\s*-\s*78px/);
});
