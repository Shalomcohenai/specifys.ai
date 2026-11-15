import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

const demo = fs.readFileSync(new URL('../../../pages/demo-spec.html', import.meta.url), 'utf8');
const why = fs.readFileSync(new URL('../../../pages/why.html', import.meta.url), 'utf8');
const engine = fs.readFileSync(new URL('./spec-viewer/modules/DiagramEngine.js', import.meta.url), 'utf8');
const booking = fs.readFileSync(new URL('../../../assets/data/example-specs/booking.json', import.meta.url), 'utf8');

test('the demo page does not load Mermaid up front', () => {
  assert.doesNotMatch(demo, /mermaid\.min\.js/);
  assert.doesNotMatch(demo, /requires_libs:[\s\S]*- mermaid/);
  assert.match(engine, /IntersectionObserver/);
  assert.match(engine, /LibraryLoader\?\.loadMermaid/);
});

test('the why page loads Mermaid when the diagram is in view', () => {
  assert.match(why, /IntersectionObserver/);
  assert.match(why, /why-page-planning-flow-mermaid/);
  assert.doesNotMatch(why, /startOnLoad: true/);
});

test('example diagrams do not use a node id that contains a space', () => {
  assert.match(booking, /ServicePackages\[\\?"CRUD \/macros\\?"\]/);
  assert.doesNotMatch(booking, /Service packages\[/);
  for (const name of ['ai-saas.json', 'marketplace.json', 'social.json', 'booking.json']) {
    const text = fs.readFileSync(new URL(`../../../assets/data/example-specs/${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /[A-Za-z] [A-Za-z]+\[/);
  }
});
