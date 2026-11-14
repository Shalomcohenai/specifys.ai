import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');

test('homepage names the spec sections and the two generation stages', () => {
  assert.match(home, /id="what-you-get"/);
  assert.match(home, /A spec, also called a PRD/);
  assert.match(home, /<strong>Overview<\/strong>/);
  assert.match(home, /<strong>Technical<\/strong>/);
  assert.match(home, /<strong>Market research<\/strong>/);
  assert.match(home, /<strong>Design<\/strong>/);
  assert.match(home, /<strong>Architecture<\/strong>/);
  assert.match(home, /<strong>GEO &amp; SEO<\/strong>/);
  assert.match(home, /<strong>Prompts<\/strong>/);
  assert.match(home, /second step is a separate click/);
  assert.doesNotMatch(home, /each stage is a section/);
});

test('creation flow introduces the deliverable before the chat', () => {
  const hintAt = home.indexOf('id="lbDeliverableHint"');
  const chatAt = home.indexOf('id="lbChatScroll"');
  assert.ok(hintAt > 0);
  assert.ok(chatAt > hintAt);
  assert.match(home, /A spec is a PRD/);
});
