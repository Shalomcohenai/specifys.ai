import fs from 'fs';
import { test, expect } from '@playwright/test';

test('the Visit Website tip stays inside the card, under the category title', async ({ page }) => {
  const html = fs.readFileSync('tools/map/vibe-coding-tools-map.html', 'utf8');
  const block = html.match(/\.tool-tooltip\s*\{[^}]+\}/)[0];
  await page.setViewportSize({ width: 390, height: 800 });
  await page.setContent(`<!doctype html>
    <h2 id="category">Prompt-to-App Builders</h2>
    <div class="tool-card">
      <div class="tool-name">Bolt.new</div>
      <span class="tool-tooltip" style="visibility:visible;opacity:1">Visit Website</span>
    </div>
    <style>
      .tool-card { position: relative; min-height: 180px; padding: 15px; }
      ${block}
      .tool-tooltip { visibility: visible; opacity: 1; }
    </style>`);
  const boxes = await page.evaluate(() => {
    const heading = document.getElementById('category').getBoundingClientRect();
    const card = document.querySelector('.tool-card').getBoundingClientRect();
    const tip = document.querySelector('.tool-tooltip').getBoundingClientRect();
    return { heading, card, tip };
  });
  expect(boxes.tip.top).toBeGreaterThanOrEqual(boxes.heading.bottom - 1);
  expect(boxes.tip.top).toBeGreaterThanOrEqual(boxes.card.top - 1);
  expect(boxes.tip.bottom).toBeLessThanOrEqual(boxes.card.bottom + 1);
});
