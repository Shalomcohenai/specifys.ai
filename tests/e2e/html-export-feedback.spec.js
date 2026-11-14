import path from 'path';
import { test, expect } from '@playwright/test';

async function mountExport(page) {
  await page.setContent(`
    <main style="max-width:640px;margin:16px auto;font-family:sans-serif">
      <label><input type="checkbox" id="export-overview"> Overview</label>
      <button id="generate-export-btn" type="button">Export</button>
      <p id="export-status" class="export-status" role="status"></p>
      <div id="export-progress" class="export-progress hidden"><p id="progress-text"></p><div id="progress-bar"></div></div>
    </main>
  `);
  await page.addScriptTag({ path: path.resolve('assets/js/features/spec-viewer/spec-viewer-chat.js') });
  await page.evaluate(() => {
    window.formatTextContent = (value) => String(value || '');
    window.showNotification = () => {};
    window.currentSpecData = { title: 'Booking app', overview: 'Appointments for barbers and salons.' };
    document.getElementById('generate-export-btn').addEventListener('click', () => window.generateExport());
  });
}

test('HTML export reports an empty selection and a ready download', async ({ page }) => {
  await mountExport(page);
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => { document.getElementById('export-overview').checked = false; });
    await page.getByRole('button', { name: 'Export' }).click();
    await expect(page.locator('#export-status')).toHaveText('Select at least one section, then export again.');

    await page.evaluate(() => { document.getElementById('export-overview').checked = true; });
    await page.getByRole('button', { name: 'Export' }).click();
    const link = page.locator('.export-download-link');
    await expect(link).toBeVisible();
    await expect(link).toContainText('Booking_app_export_');
    await expect(link).toHaveAttribute('download', /Booking_app_export_/);
    const overflow = await page.evaluate(() => document.querySelector('main').scrollWidth - document.querySelector('main').clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
