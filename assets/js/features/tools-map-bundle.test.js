import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

const page = fs.readFileSync(new URL('../../../tools/map/vibe-coding-tools-map.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../../../tools/map/tools-map-app.jsx', import.meta.url), 'utf8');
const bundle = fs.readFileSync(new URL('../../../tools/map/tools-map.bundle.js', import.meta.url), 'utf8');
const tools = JSON.parse(fs.readFileSync(new URL('../../../tools/map/tools.json', import.meta.url), 'utf8'));

test('the tools map ships a prebuilt bundle and does not compile React in the browser', () => {
  assert.doesNotMatch(page, /unpkg\.com/);
  assert.doesNotMatch(page, /text\/babel/);
  assert.doesNotMatch(page, /react\.development/);
  assert.match(page, /tools-map\.bundle\.js/);
  assert.match(page, /defer_firebase: true/);
  assert.match(page, /defer_gtag: true/);
  assert.match(app, /\/tools\/map\/tools\.json/);
  assert.doesNotMatch(app, /\/api\/tools/);
  assert.doesNotMatch(bundle, /\/api\/tools/);
  assert.doesNotMatch(bundle, /react\.development/);
});

test('filter and card controls declare a 44px minimum tap size', () => {
  assert.match(page, /\.category-filter button \{[\s\S]*min-height: 44px/);
  assert.match(page, /\.show-more-btn \{[\s\S]*min-height: 44px/);
  assert.match(page, /\.add-to-list-btn \{[\s\S]*min-height: 44px/);
});

test('confirmed 404 tools are marked and the rest stay linked', () => {
  const hidden = tools.filter((tool) => tool.unavailable);
  assert.ok(hidden.length >= 20);
  assert.ok(hidden.some((tool) => tool.name === 'Google Jules'));
  assert.ok(hidden.some((tool) => tool.name === 'Nuvio'));
  const lovable = tools.find((tool) => tool.name === 'Lovable.dev');
  assert.equal(lovable.unavailable, undefined);
  const snap = tools.find((tool) => tool.name === 'SnapLogic MCP Server');
  assert.equal(snap.unavailable, undefined);
});
