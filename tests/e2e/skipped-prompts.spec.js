import { test, expect } from '@playwright/test';

test('skipped prompt steps stay collapsed on desktop and mobile', async ({ page }) => {
  await page.goto('/');
  const html = await page.evaluate(async () => {
    const mod = await import('/assets/js/features/spec-viewer/modules/EnrichedStageRenderers.js');
    return mod.renderEnrichedPrompts({
      fullPrompt: [
        'STAGE 1: Foundation\n## Goal\nBuild the booking page.\n',
        'STAGE 3: Auth\n## Goal\nSkipped: not in scope. The product has no accounts.\n',
        'STAGE 5: AI\n## Goal\nSkipped: not in scope.\n'
      ].join('\n')
    });
  });
  await page.setContent(`<main style="max-width:720px;margin:16px auto;font-family:sans-serif">${html}</main>`);
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(page.getByText('Build the booking page.')).toBeVisible();
    const summary = page.locator('.prompt-skipped summary');
    await expect(summary).toHaveText('2 steps skipped. They are not in this product.');
    await expect(page.locator('.prompt-ticket-card')).toHaveCount(1);
    const overflow = await page.evaluate(() => document.querySelector('main').scrollWidth - document.querySelector('main').clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
