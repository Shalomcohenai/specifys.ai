import { test, expect } from '@playwright/test';

test('the pricing comparison scrolls sideways and the button stays off the last row', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.setContent(`<!doctype html>
    <main id="main-content">
      <section class="plan-compare">
        <div class="plan-compare-scroll" tabindex="0">
          <table class="plan-compare-table">
            <thead>
              <tr><th scope="col">Feature</th><th scope="col">Free</th><th scope="col">Pro</th></tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Create a spec</th>
                <td>1 credit, used when the spec is created</td>
                <td id="pro-cell">Unlimited specifications</td>
              </tr>
              <tr>
                <th scope="row">Edit specifications</th>
                <td>Not included</td>
                <td>Included</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
    <button class="icon-btn scroll-to-top is-parked" id="scrollToTop" aria-label="Scroll to top">Top</button>`);
  await page.addStyleTag({ path: 'assets/css/pages/pricing.css' });
  await page.addStyleTag({ content: `
    .icon-btn.scroll-to-top { position: fixed; width: 44px; height: 44px; min-width: 44px; min-height: 44px; bottom: 16px; left: 16px; }
    .scroll-to-top.is-parked { transform: translateY(calc(100% + 24px)); pointer-events: none; }
  ` });
  const scroller = page.locator('.plan-compare-scroll');
  const metrics = await scroller.evaluate((el) => ({
    scroll: el.scrollWidth,
    client: el.clientWidth
  }));
  expect(metrics.scroll).toBeGreaterThan(metrics.client);
  const full = await page.locator('#pro-cell').evaluate((el) => el.textContent);
  expect(full).toBe('Unlimited specifications');
  await scroller.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  const button = page.locator('#scrollToTop');
  const box = await button.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  const overlaps = await page.evaluate(() => {
    const row = document.querySelector('tbody tr:last-child th').getBoundingClientRect();
    const btn = document.getElementById('scrollToTop').getBoundingClientRect();
    return !(btn.bottom < row.top || btn.top > row.bottom || btn.right < row.left || btn.left > row.right);
  });
  expect(overlaps).toBe(false);
});
