import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the demo defers third parties and the user-flow rail wraps', async () => {
  const page = await readFile(new URL('../../../pages/demo-spec.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../css/pages/spec-viewer.css', import.meta.url), 'utf8');
  const demoCss = await readFile(new URL('../../css/pages/demo-spec.css', import.meta.url), 'utf8');
  const stepper = await readFile(new URL('../../../tests/e2e/generation-stepper.spec.js', import.meta.url), 'utf8');
  assert.match(page, /defer_gtag:\s*true/);
  assert.match(page, /defer_firebase:\s*true/);
  assert.doesNotMatch(page, /highlight\.min\.js/);
  assert.match(css, /flex-wrap:\s*wrap/);
  assert.match(css, /background:\s*#B33A00/);
  assert.doesNotMatch(stepper, /spec-viewer\.html/);
  assert.doesNotMatch(stepper, /style\.display\s*=\s*'flex'/);
  assert.match(demoCss, /\.spec-content\.active\s*\{[^}]*min-height:\s*720px/s);
  assert.match(demoCss, /Montserrat Fallback/);
  assert.match(demoCss, /\.demo-example-switcher\s*\{[^}]*min-height:\s*44px/s);
});
