import { test, expect } from '@playwright/test';

const viewports = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 }
];

test('overview ready banner names both stages and the next click', async ({ page }) => {
  await page.goto('/pages/spec-viewer.html');
  await page.addStyleTag({ url: '/assets/css/pages/spec-viewer.css' });
  await page.evaluate(() => {
    const box = document.getElementById('approval-container');
    box.hidden = false;
    box.removeAttribute('aria-hidden');
    box.classList.remove('hidden');
    box.style.display = 'flex';
  });

  const banner = page.locator('#approval-container');
  const cta = page.getByRole('button', { name: 'Generate the full spec' });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Step 1 of 2 complete. Overview is ready.');
    await expect(banner).toContainText('Overview');
    await expect(banner).toContainText('Full spec');
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(40);
    const bannerOverflow = await banner.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(bannerOverflow).toBeLessThanOrEqual(1);
  }
});
