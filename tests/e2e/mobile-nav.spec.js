import fs from 'fs';
import path from 'path';
import * as sass from 'sass';
import { test, expect } from '@playwright/test';

const compiledCss = sass.compile(path.resolve('assets/css/main.scss'), {
  style: 'expanded',
  silenceDeprecations: ['import']
}).css;

test('the header menu opens from a real click and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`<!doctype html>
    <header class="thematic-header">
      <div class="header-left">
        <div class="auth-buttons" id="auth-buttons">
          <button class="auth-btn" type="button"><span class="auth-label-full">Log in/Sign up</span><span class="auth-label-short">Log in</span></button>
        </div>
        <button type="button" class="header-menu-toggle" aria-expanded="false" aria-controls="header-nav" aria-label="Open menu">
          <span class="header-menu-toggle-bars" aria-hidden="true"></span>
        </button>
        <nav class="header-nav" id="header-nav" aria-label="Site navigation">
          <a href="/pages/how.html">How</a>
          <a href="/pages/pricing.html">Pricing</a>
          <a href="/pages/compare.html">Compare</a>
        </nav>
      </div>
      <div class="header-center">
        <div class="logo"><a href="/"><span class="logo-text">Specifys.AI</span></a></div>
      </div>
      <div class="header-right">
        <a class="auth-btn primary" href="/pages/pricing.html">Pricing</a>
      </div>
    </header>`);
  await page.addStyleTag({ content: compiledCss });
  await page.addScriptTag({ content: fs.readFileSync('assets/js/header-menu.js', 'utf8') });

  const toggle = page.locator('.header-menu-toggle');
  const box = await toggle.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  const hit = await toggle.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return top === el || el.contains(top);
  });
  expect(hit).toBe(true);
  await expect(page.locator('.auth-label-short')).toBeVisible();
  await expect(page.locator('.auth-label-full')).toBeHidden();
  const login = await page.locator('.auth-btn').first().innerText();
  expect(login.trim()).toBe('Log in');

  await expect(page.getByRole('link', { name: 'How' })).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const how = page.getByRole('link', { name: 'How' });
  await expect(how).toBeVisible();
  const howBox = await how.boundingBox();
  expect(howBox.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Tab');
  await expect(how).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
  await expect(how).toBeHidden();
});

test('the scroll-to-top control is at least 44px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`<main id="main-content"><p>Content</p></main>
    <button class="icon-btn scroll-to-top" id="scrollToTop" aria-label="Scroll to top"></button>`);
  await page.addStyleTag({ content: compiledCss });
  const button = page.getByRole('button', { name: 'Scroll to top' });
  const box = await button.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  const pad = await page.locator('#main-content').evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
  expect(pad).toBeGreaterThanOrEqual(44);
});
