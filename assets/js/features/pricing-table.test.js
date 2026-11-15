import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the pricing table scrolls and the scroll button parks off the text', async () => {
  const css = await readFile(new URL('../../css/pages/pricing.css', import.meta.url), 'utf8');
  const scss = await readFile(new URL('../../css/components/_icons.scss', import.meta.url), 'utf8');
  const html = await readFile(new URL('../../../pages/pricing.html', import.meta.url), 'utf8');
  assert.match(css, /\.plan-compare-scroll\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(css, /min-width:\s*560px/);
  assert.doesNotMatch(css, /display:\s*block/);
  assert.match(html, /class="plan-compare-scroll"/);
  assert.match(scss, /\.scroll-to-top\.is-parked/);
  assert.match(scss, /min-width:\s*44px/);
});
