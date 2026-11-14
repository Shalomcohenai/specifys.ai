import { test, expect } from '@playwright/test';

test('a chopped user flow renders as one readable step', async ({ page }) => {
  await page.goto('/');
  const html = await page.evaluate(async () => {
    const mod = await import('/assets/js/features/spec-viewer/modules/EnrichedOverviewRenderer.js');
    return mod.renderDetailedUserFlowRail([
      'An appointment-booking app for small businesses like barbers',
      'salons',
      'with reminders',
      'payments'
    ]);
  });
  await page.setContent(`<main style="max-width:720px;margin:16px auto;font-family:sans-serif">${html}</main>`);
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole('list', { name: 'Detailed user flow' })).toBeVisible();
    await expect(page.locator('.user-flow-rail-step')).toHaveCount(1);
    await expect(page.locator('.user-flow-rail-detail')).toContainText('barbers salons');
    const overflow = await page.evaluate(() => document.querySelector('main').scrollWidth - document.querySelector('main').clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
