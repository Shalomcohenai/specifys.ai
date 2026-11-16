import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function visibleNameContained(html) {
  const buttons = html.match(/<a\b[^>]*class="[^"]*\bbtn\b[^"]*"[^>]*>[\s\S]*?<\/a>/g) || [];
  const misses = [];
  for (const tag of buttons) {
    const label = tag.match(/aria-label="([^"]*)"/);
    if (!label) continue;
    const text = tag.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
    const name = label[1].toLowerCase();
    if (!name.includes(text)) misses.push({ text, name });
  }
  return misses;
}

test('why and how cards are real lists and names include the visible text', async () => {
  const why = await readFile(new URL('../../../pages/why.html', import.meta.url), 'utf8');
  const how = await readFile(new URL('../../../pages/how.html', import.meta.url), 'utf8');
  const whyCss = await readFile(new URL('../../css/pages/why.css', import.meta.url), 'utf8');
  const howCss = await readFile(new URL('../../css/pages/how.css', import.meta.url), 'utf8');

  assert.doesNotMatch(why, /<article[^>]*\brole="listitem"/);
  assert.doesNotMatch(how, /<article[^>]*\brole="listitem"/);
  assert.match(why, /<ul class="spec-cards-showcase-orange"/);
  assert.match(how, /<ul class="tools-grid">/);
  assert.match(how, /<\/ul>\s*<\/section>\s*$/);
  assert.doesNotMatch(why, /aria-label="Current question"/);
  assert.match(whyCss, /\.spec-cards-showcase-orange\s*\{[^}]*list-style:\s*none/s);
  assert.match(howCss, /\.tools-grid\s*\{[^}]*list-style:\s*none/s);
  assert.deepEqual(visibleNameContained(why), []);
  assert.deepEqual(visibleNameContained(how), []);
});
