import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');

test('homepage names the spec sections and the two generation stages', () => {
  assert.match(home, /id="what-you-get"/);
  assert.match(home, /The plan you get from one brief/);
  assert.match(home, /class="deliverable-card-title">Overview</);
  assert.match(home, /class="deliverable-card-title">Technical</);
  assert.match(home, /class="deliverable-card-title">Market research</);
  assert.match(home, /class="deliverable-card-title">Design</);
  assert.match(home, /Stack, API, and architecture/);
  assert.match(home, /class="deliverable-card-title">GEO &amp; SEO</);
  assert.match(home, /class="deliverable-card-title">Prompts</);
  assert.match(home, /A separate click/);
  assert.match(home, /href="\/pages\/demo-spec\.html"/);
  assert.doesNotMatch(home, /each stage is a section/);
  assert.doesNotMatch(home, /You do not fill out a form first/);
});

test('creation flow introduces the deliverable before the chat', () => {
  const hintAt = home.indexOf('id="lbDeliverableHint"');
  const chatAt = home.indexOf('id="lbChatScroll"');
  assert.ok(hintAt > 0);
  assert.ok(chatAt > hintAt);
  assert.match(home, /A spec is a PRD/);
});
