import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

test('orange text uses the 7:1 token and bright orange stays decorative', async () => {
  const variables = await readFile(new URL('../../css/core/_variables.scss', import.meta.url), 'utf8');
  assert.match(variables, /--orange-text:\s*#9A3412/);
  assert.match(variables, /--primary-color:\s*#FF6B35/);
  const why = await readFile(new URL('../../css/pages/why.css', import.meta.url), 'utf8');
  assert.match(why, /\.section-title\s*\{[^}]*color:\s*var\(--orange-text, #9A3412\)/s);
  assert.match(why, /\.section-subtitle\s*\{[^}]*color:\s*var\(--orange-text, #9A3412\)/s);
  const compiled = sass.compile(fileURLToPath(new URL('../../css/main.scss', import.meta.url)), {
    style: 'expanded',
    silenceDeprecations: ['import']
  }).css;
  assert.match(compiled, /--orange-text:\s*#9A3412/);
  assert.match(compiled, /h2\s*\{[^}]*color:\s*var\(--orange-text\)/s);
  assert.match(compiled, /a\s*\{[^}]*color:\s*var\(--orange-text\)/s);
});
