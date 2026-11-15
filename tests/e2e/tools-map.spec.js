import { test, expect } from '@playwright/test';

test('tools map renders from tools.json without calling /api/tools', async ({ page }) => {
  const apiHits = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/tools')) apiHits.push(request.url());
  });
  await page.goto('/tools/map/vibe-coding-tools-map.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    document.getElementById('root').setAttribute('data-tools-url', '/tools/map/tools.json');
  });
  await page.addScriptTag({ url: '/tools/map/tools-map.bundle.js' });
  await expect(page.getByText('Bolt.new', { exact: true }).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Google Jules', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Nuvio', { exact: true })).toHaveCount(0);
  const filter = page.locator('.category-filter button').first();
  const box = await filter.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(apiHits).toEqual([]);
});
