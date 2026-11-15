import { test, expect } from '@playwright/test';

const fixture = `<!doctype html>
  <ol class="user-flow-rail">
    <li class="user-flow-rail-step">
      <div class="user-flow-rail-track"><span class="user-flow-rail-node"><span class="user-flow-rail-index">1</span></span><span class="user-flow-rail-line"></span></div>
      <div class="user-flow-rail-content"><h3 class="user-flow-rail-title">Capture the inbound request</h3><p class="user-flow-rail-detail">The operator files the customer message.</p></div>
    </li>
    <li class="user-flow-rail-step">
      <div class="user-flow-rail-track"><span class="user-flow-rail-node"><span class="user-flow-rail-index">2</span></span><span class="user-flow-rail-line"></span></div>
      <div class="user-flow-rail-content"><h3 class="user-flow-rail-title">Route it to the right queue</h3><p class="user-flow-rail-detail">Rules pick a team.</p></div>
    </li>
    <li class="user-flow-rail-step">
      <div class="user-flow-rail-track"><span class="user-flow-rail-node"><span class="user-flow-rail-index">3</span></span></div>
      <div class="user-flow-rail-content"><h3 class="user-flow-rail-title">Reply and close the loop</h3><p class="user-flow-rail-detail">The customer gets the answer.</p></div>
    </li>
  </ol>`;

test('user-flow titles stay inside their columns on a phone and on a wide screen', async ({ page }) => {
  await page.setContent(fixture);
  await page.addStyleTag({ path: 'assets/css/pages/spec-viewer.css' });

  await page.setViewportSize({ width: 390, height: 800 });
  const direction = await page.locator('.user-flow-rail').evaluate((el) => getComputedStyle(el).flexDirection);
  expect(direction).toBe('column');

  await page.setViewportSize({ width: 1440, height: 900 });
  const wide = await page.locator('.user-flow-rail').evaluate((el) => getComputedStyle(el).flexWrap);
  expect(wide).toBe('wrap');
  const title = page.locator('.user-flow-rail-title').first();
  const clipped = await title.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
  expect(clipped).toBe(false);
  const contrast = await page.locator('.user-flow-rail-node').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(contrast).toBe('rgb(179, 58, 0)');
});
