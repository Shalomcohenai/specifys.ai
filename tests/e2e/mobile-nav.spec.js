import fs from 'fs';
import { test, expect } from '@playwright/test';

test('the header menu opens, traps focus, and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`<!doctype html>
    <header class="thematic-header">
      <div class="header-left">
        <button type="button" class="header-menu-toggle" aria-expanded="false" aria-controls="header-nav" aria-label="Open menu">
          <span class="header-menu-toggle-bars" aria-hidden="true"></span>
        </button>
        <nav class="header-nav" id="header-nav" aria-label="Site navigation">
          <a href="/pages/how.html">How</a>
          <a href="/pages/pricing.html">Pricing</a>
          <a href="/pages/compare.html">Compare</a>
        </nav>
      </div>
    </header>`);
  await page.addStyleTag({ path: 'assets/css/layout/_header.css' });
  await page.addScriptTag({ content: fs.readFileSync('assets/js/header-menu.js', 'utf8') });
  const toggle = page.locator('.header-menu-toggle');
  const box = await toggle.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole('link', { name: 'How' })).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('link', { name: 'Pricing' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'How' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
  await expect(page.getByRole('link', { name: 'How' })).toBeHidden();
});

test('the scroll-to-top control is at least 44px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`<main id="main-content"><p>Content</p></main>
    <button class="icon-btn scroll-to-top" id="scrollToTop" aria-label="Scroll to top"></button>`);
  await page.addStyleTag({ path: 'assets/css/main-compiled.css' });
  const button = page.getByRole('button', { name: 'Scroll to top' });
  const box = await button.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  const pad = await page.locator('#main-content').evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
  expect(pad).toBeGreaterThanOrEqual(44);
});
