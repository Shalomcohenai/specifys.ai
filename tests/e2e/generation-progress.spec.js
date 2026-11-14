import path from 'path';
import { test, expect } from '@playwright/test';

test('generation status names the running section instead of a percent', async ({ page }) => {
  await page.setContent(`
    <link rel="stylesheet" href="/assets/css/pages/spec-viewer.css">
    <main style="max-width:720px;margin:24px auto;padding:16px;font-family:sans-serif">
      <div id="spec-generation-progress" class="spec-generation-progress">
        <div class="progress-bar-header">
          <span class="progress-bar-stage" id="progress-stage-label"></span>
          <span class="progress-bar-percent" id="progress-percent-label"></span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill" id="progress-bar-fill"></div>
        </div>
        <div class="progress-message" id="progress-message"></div>
      </div>
    </main>
  `);
  await page.addScriptTag({ path: path.resolve('assets/js/features/spec-generation-progress.js') });
  await page.evaluate(() => {
    const model = window.SpecGenerationProgress.compute({
      status: {
        overview: 'ready', technical: 'ready', market: 'ready', design: 'ready',
        architecture: 'ready', visibility: 'ready', prompts: 'generating'
      }
    });
    document.getElementById('progress-stage-label').textContent = model.headline;
    document.getElementById('progress-percent-label').textContent = 'Section 7 of 7';
    document.getElementById('progress-bar-fill').style.width = model.percent + '%';
    document.getElementById('progress-message').textContent = [model.detail, model.expectation, model.background].join(' ');
  });

  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(page.locator('#progress-stage-label')).toContainText('Generating Prompts');
    await expect(page.locator('#progress-percent-label')).toHaveText('Section 7 of 7');
    await expect(page.locator('#progress-message')).toContainText('8 to 10 minutes');
    await expect(page.locator('#progress-message')).toContainText('leave this page');
    await expect(page.locator('body')).not.toContainText('97%');
    const overflow = await page.evaluate(() => document.getElementById('spec-generation-progress').scrollWidth - document.getElementById('spec-generation-progress').clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
