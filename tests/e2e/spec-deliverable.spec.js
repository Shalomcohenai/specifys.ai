import { test, expect } from '@playwright/test';

const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 }
];

test('homepage explains what a spec contains', async ({ page }) => {
  await page.goto('/index.html');
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const section = page.locator('#what-you-get');
    await expect(section).toBeVisible();
    await expect(section).toContainText('What a spec is');
    await expect(section).toContainText('Overview');
    await expect(section).toContainText('Prompts');
    await expect(section).toContainText('GEO & SEO');
    await expect(section).toContainText('separate click');
    await expect(section).toContainText('See a sample spec');
    const sample = section.getByRole('link', { name: 'See a sample spec' });
    await expect(sample).toHaveAttribute('href', '/pages/demo-spec.html');
    const hint = page.locator('#lbDeliverableHint');
    await expect(hint).toContainText('A spec is a PRD');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
