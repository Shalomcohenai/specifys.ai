import { test, expect } from '@playwright/test';

const fixture = `<!doctype html>
  <main id="main-content">
    <div id="approval-container" class="approval-container">
      <div class="approval-copy">
        <p class="spec-stepper-kicker">Step 1 of 2 complete. Overview is ready.</p>
        <ol class="spec-stepper" aria-label="Spec generation stages">
          <li class="spec-stepper-step is-done">
            <span class="spec-stepper-index" aria-hidden="true">1</span>
            <span><strong>Overview.</strong> Problem, audience, features, and user flow. This part is done.</span>
          </li>
          <li class="spec-stepper-step is-current" aria-current="step">
            <span class="spec-stepper-index" aria-hidden="true">2</span>
            <span><strong>Full spec.</strong> Technical, Market research, Design, Architecture, GEO &amp; SEO, and Prompts. This starts when you continue.</span>
          </li>
        </ol>
      </div>
      <div class="approval-actions">
        <button id="approveBtn" class="btn btn-success" aria-label="Generate the full spec">Generate full spec</button>
      </div>
    </div>
  </main>`;

test('the overview-ready stepper is readable without unhiding the live viewer', async ({ page }) => {
  await page.setContent(fixture);
  await page.addStyleTag({ path: 'assets/css/pages/spec-viewer.css' });

  const banner = page.locator('#approval-container');
  const cta = page.getByRole('button', { name: 'Generate the full spec' });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Step 1 of 2 complete. Overview is ready.');
    await expect(banner).toContainText('Overview');
    await expect(banner).toContainText('Full spec');
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(40);
    const overflow = await banner.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
