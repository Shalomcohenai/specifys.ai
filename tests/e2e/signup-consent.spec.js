import { test, expect } from '@playwright/test';

test('signup marketing is optional and privacy opens the real page', async ({ page }) => {
  await page.goto('/pages/auth.html', { waitUntil: 'domcontentloaded' });
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.locator('#register-tab').click();
    await page.evaluate(() => document.getElementById('register-form').classList.add('active'));
    const newsletter = page.locator('#newsletter-subscription');
    const privacy = page.locator('#privacy-policy-agreement');
    await expect(newsletter).toBeVisible();
    await expect(newsletter).not.toBeChecked();
    await expect(privacy).not.toBeChecked();
    await expect(privacy).toHaveAttribute('required', '');
    const link = page.locator('#privacy-policy-link');
    await expect(link).toHaveAttribute('href', '/pages/privacy.html');
    await expect(link).toHaveAttribute('target', '_blank');
    const box = await link.boundingBox();
    expect(box.height).toBeGreaterThan(0);
  }
});
