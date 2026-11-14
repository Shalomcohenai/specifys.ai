import path from 'path';
import { test, expect } from '@playwright/test';

test('spec tabs show text labels at desktop and mobile sizes', async ({ page }) => {
  await page.setContent(`
    <nav class="spec-nav spec-nav--top" aria-label="Specification navigation">
      <div class="spec-nav-track">
        <nav class="side-menu-nav spec-nav-list spec-nav-list--top" aria-label="Specification tabs">
          <div class="side-menu-item" data-tab="overview">
            <button type="button" class="side-menu-button active" id="overviewTab" aria-label="Overview section">
              <i class="fa fa-book" aria-hidden="true"></i>
              <span class="side-menu-text">Overview</span>
            </button>
          </div>
          <div class="side-menu-item" data-tab="technical">
            <button type="button" class="side-menu-button" id="technicalTab" aria-label="Technical section">
              <i class="fa fa-cog" aria-hidden="true"></i>
              <span class="side-menu-text">Technical</span>
            </button>
          </div>
          <div class="side-menu-item" data-tab="prompts">
            <button type="button" class="side-menu-button" id="promptsTab" aria-label="Prompts section">
              <i class="fa fa-terminal" aria-hidden="true"></i>
              <span class="side-menu-text">Prompts</span>
            </button>
          </div>
        </nav>
      </div>
    </nav>
  `);
  await page.addStyleTag({ path: path.resolve('assets/css/pages/spec-viewer-navigation.css') });

  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const overview = page.getByRole('button', { name: 'Overview section' });
    await expect(overview).toBeVisible();
    await expect(overview.locator('.side-menu-text')).toBeVisible();
    await expect(overview.locator('.side-menu-text')).toHaveText('Overview');
    const fontSize = await overview.locator('.side-menu-text').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(12);
    const box = await overview.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(40);
    expect(box.width).toBeGreaterThanOrEqual(40);
  }
});
