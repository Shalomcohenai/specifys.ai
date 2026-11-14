import path from 'path';
import { test, expect } from '@playwright/test';

test('the share banner and toast sit above the bottom tab bar', async ({ page }) => {
  await page.setContent(`
    <div id="specNavBottom" style="position:fixed;left:0;right:0;bottom:12px;height:64px;background:#fff;z-index:125;">Tabs</div>
    <div class="share-prompt-banner is-visible" id="share-prompt-banner">
      <div class="share-prompt-banner-inner"><strong>Share your spec</strong></div>
    </div>
  `);
  await page.addScriptTag({ path: path.resolve('assets/js/features/share-prompt/share-prompt-modal.js') });
  await page.addScriptTag({ path: path.resolve('assets/js/features/spec-viewer/spec-viewer-main.js') });

  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const banner = page.locator('#share-prompt-banner');
    await expect(banner).toBeVisible();
    const boxes = await page.evaluate(() => {
      const bannerBox = document.getElementById('share-prompt-banner').getBoundingClientRect();
      const navBox = document.getElementById('specNavBottom').getBoundingClientRect();
      return { bannerBottom: bannerBox.bottom, bannerTop: bannerBox.top, navTop: navBox.top };
    });
    expect(boxes.bannerTop).toBeLessThan(120);
    expect(boxes.bannerBottom).toBeLessThan(boxes.navTop);

    await page.evaluate(() => showNotification('Export ready', 'success'));
    const toast = page.locator('.notification').last();
    await expect(toast).toBeVisible();
    const toastBox = await toast.boundingBox();
    expect(toastBox.y).toBeLessThan(160);
    expect(toastBox.y + toastBox.height).toBeLessThan(boxes.navTop);
    await page.evaluate(() => document.querySelectorAll('.notification').forEach((node) => node.remove()));
  }
});
