import fs from 'fs';
import { test, expect } from '@playwright/test';

test('login is a tab panel, not a form role, and gtag waits for interaction', async ({ page }) => {
  await page.setContent(fs.readFileSync('pages/auth.html', 'utf8'), { waitUntil: 'domcontentloaded' });
  const loginForm = page.locator('#login-form');
  await expect(loginForm).not.toHaveAttribute('role', 'tabpanel');
  await expect(page.locator('#login-panel')).toHaveAttribute('role', 'tabpanel');
  await expect(page.locator('#register-panel')).toBeHidden();
  await page.getByRole('tab', { name: 'Register' }).click();
  await expect(page.locator('#register-panel')).toBeVisible();
  await expect(page.locator('#login-panel')).toBeHidden();
  const queued = await page.evaluate(() => (window.dataLayer || []).some((entry) => entry && entry[0] === 'config'));
  expect(queued).toBe(true);
  await page.locator('body').dispatchEvent('pointerdown');
  await expect.poll(async () => page.locator('script[src*="googletagmanager"]').count()).toBeGreaterThan(0);
});
