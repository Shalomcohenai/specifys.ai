import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

const skip = fs.readFileSync(new URL('../../css/core/_base.scss', import.meta.url), 'utf8');
const auth = fs.readFileSync(new URL('../../../pages/auth.html', import.meta.url), 'utf8');
const pricing = fs.readFileSync(new URL('../../../pages/pricing.html', import.meta.url), 'utf8');
const viewer = fs.readFileSync(new URL('../../../pages/spec-viewer.html', import.meta.url), 'utf8');

test('the skip link uses a dark orange that clears 4.5:1 with white', () => {
  const rule = skip.slice(skip.indexOf('.skip-to-main {'), skip.indexOf('.skip-to-main:focus'));
  assert.match(rule, /background:\s*#9A3412/);
  assert.doesNotMatch(rule, /#FF6B35/);
});

test('auth is indexable and button names match their visible labels', () => {
  assert.match(auth, /meta name="robots" content="index, follow"/);
  assert.match(auth, /meta name="description"/);
  assert.match(auth, />\s*Continue with Google\s*</);
  assert.doesNotMatch(auth, /aria-label="Continue with Google authentication"/);
  assert.doesNotMatch(auth, /aria-label="Subscribe to newsletter/);
});

test('pricing compares Free and Pro at the existing price', () => {
  assert.match(pricing, /Free and Pro/);
  assert.match(pricing, /\$1\.99\/mo/);
  assert.match(pricing, /Database Design/);
  assert.match(pricing, /Export to Cursor/);
  assert.match(pricing, /Unlimited specifications/);
  assert.match(pricing, /1 credit, used when the spec is created/);
  assert.match(pricing, /\$1\.99\/mo/);
  assert.equal((pricing.match(/\$\d+\.\d+/g) || []).every((price) => price === '$1.99'), true);
});

test('the two-step spec copy says what the credit pays for', () => {
  assert.match(viewer, /Step 1 of 2 complete\. Overview is ready\./);
  assert.match(viewer, /One credit is used when the spec is created/);
  assert.match(viewer, /Generating the full spec does not use a second credit/);
});
