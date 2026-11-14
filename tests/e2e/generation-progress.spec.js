import { test, expect } from '@playwright/test';

test('homepage and spec viewer state an honest generation time', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`);
  await expect(page.locator('.value-number-value', { hasText: 'about 3 to 5 min' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('8 to 10 min');
  await expect(page.locator('body')).not.toContainText('~4 min');

  const viewer = await page.request.get(`${baseURL}/pages/spec-viewer.html`);
  expect(viewer.ok()).toBeTruthy();
  const html = await viewer.text();
  expect(html).toContain('Generate full spec');
  expect(html).toContain('about 3 to 5 minutes');
  expect(html).not.toContain('8 to 10');
  expect(html).toContain('spec-viewer/spec-generation-progress.js');
  expect(html).not.toContain('/assets/js/features/spec-generation-progress.js');
});
