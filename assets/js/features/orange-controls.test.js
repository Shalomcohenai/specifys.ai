import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(rel) {
  return readFile(new URL('../../../' + rel, import.meta.url), 'utf8');
}

test('filled controls with white text use the accessible orange token', async () => {
  const buttons = await read('assets/css/components/buttons.css');
  const header = await read('assets/css/main-compiled.css');
  const home = await read('assets/css/pages/index.css');
  assert.match(buttons, /\.btn-primary \{[^}]*background:\s*var\(--orange-control, #B33A00\)/s);
  assert.match(header, /--orange-control:\s*#B33A00/);
  assert.match(header, /\.credits-container \{[^}]*background:\s*var\(--orange-control, #B33A00\)/s);
  assert.match(home, /\.send-btn \{[^}]*background:\s*var\(--orange-control, #B33A00\)/s);
  assert.match(home, /\.hero-cta-button-new \{[^}]*background-color:\s*#B33A00/s);
});

test('decorative logo orange stays #FF6B35', async () => {
  const header = await read('assets/css/layout/_header.scss');
  const home = await read('assets/css/pages/index.css');
  assert.match(header, /\.logo-dot \{[^}]*color:\s*#FF6B35/s);
  assert.match(home, /body \.logo-dot \{[^}]*color:\s*#FF6B35/s);
  const variables = await read('assets/css/core/_variables.scss');
  assert.match(variables, /--primary-color:\s*#FF6B35/);
  assert.match(variables, /--orange-control:\s*#B33A00/);
});
