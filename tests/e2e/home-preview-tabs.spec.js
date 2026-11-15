import { test, expect } from '@playwright/test';

test('homepage preview tabs stay 14px and scroll at phone and tablet widths', async ({ page }) => {
  await page.setContent(`<!doctype html>
    <div class="browser-window-frame" style="width: 350px">
      <div class="browser-window-tabbar">
        <div class="browser-window-tabs" role="tablist">
          <button class="browser-window-tab">Overview</button>
          <button class="browser-window-tab" id="market">Market Research</button>
          <button class="browser-window-tab">Design</button>
          <button class="browser-window-tab active">Diagrams</button>
          <button class="browser-window-tab">Prompts</button>
        </div>
        <a class="browser-window-tab browser-window-tab-see-more" href="/pages/demo-spec.html?example=relaydesk">See the RelayDesk spec</a>
      </div>
    </div>`);
  await page.addStyleTag({ path: 'assets/css/pages/index.css' });

  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 800 });
    const market = page.locator('#market');
    const fontSize = await market.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(13.9);
    const clipped = await market.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(clipped).toBe(false);
    await expect(page.getByRole('link', { name: 'See the RelayDesk spec' })).toBeVisible();
  }
});
