import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../../', import.meta.url);

async function read(rel) {
  return readFile(new URL(rel, root), 'utf8');
}

test('pricing headings do not skip a level and subscribe names match the visible labels', async () => {
  const html = await read('pages/pricing.html');
  assert.equal(html.includes('<h4'), false);
  assert.match(html, /<h1[\s>]/);
  assert.match(html, /<h2[\s>]/);
  assert.match(html, /<h3[\s>]/);

  const buttons = [...html.matchAll(/<button\b[^>]*class="[^"]*(?:pro-hero-cta|pro-footer-cta-btn)[^"]*"[^>]*>[\s\S]*?<span class="btn-text">([^<]+)<\/span>/g)];
  assert.equal(buttons.length, 2);
  for (const match of buttons) {
    const tag = match[0];
    const visible = match[1].trim();
    const aria = tag.match(/aria-label="([^"]*)"/);
    if (aria) {
      assert.ok(aria[1].includes(visible), `${visible} missing from accessible name`);
    }
    assert.ok(visible.length > 0);
  }
});

test('pricing orange text on white and white text on orange use the accessible orange', async () => {
  const css = await read('assets/css/pages/pricing.css');
  assert.match(css, /\.pro-hero-badge\s*\{[^}]*background:\s*#B33A00/s);
  assert.match(css, /\.pro-hero-amount\s*\{[^}]*color:\s*#B33A00/s);
  assert.match(css, /\.pricing-page \.btn-primary\s*\{[^}]*background:\s*#B33A00/s);
  assert.match(css, /\.pricing-page \.pro-footer-cta-btn\s*\{[^}]*color:\s*#B33A00/s);
  assert.equal(/color:\s*#(?:999|888|666)\b/.test(css), false);
  assert.match(css, /optimize_lcp|font-family:\s*-apple-system/);
});

test('pricing page defers the heavy shell the homepage already uses for LCP', async () => {
  const html = await read('pages/pricing.html');
  assert.match(html, /optimize_lcp:\s*true/);
  const css = await read('assets/css/pages/pricing.css');
  assert.equal(/animation:\s*pro-fade-up/.test(css), false);
  assert.equal(/animation:\s*pro-badge-in/.test(css), false);
});
