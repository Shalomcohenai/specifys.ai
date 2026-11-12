/**
 * UX Review Test Suite
 * Tests key user flows at desktop (1440px) and mobile (390px) widths
 * Saves screenshots as artifacts for review
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const DESKTOP_WIDTH = 1440;
const MOBILE_WIDTH = 390;
const PRODUCTION_URL = 'https://www.specifys-ai.com';
const LOCAL_URL = 'http://127.0.0.1:4000';

// Use production by default, fallback to local
const BASE_URL = process.env.UX_REVIEW_URL || PRODUCTION_URL;

// Create artifacts directory
const ARTIFACTS_DIR = '/opt/cursor/artifacts/ux-review';
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

/**
 * Save screenshot with descriptive name
 */
async function saveScreenshot(page, name, width) {
  const filename = `${name}-${width}px.png`;
  const filepath = path.join(ARTIFACTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  console.log(`📸 Saved: ${filename}`);
  return filepath;
}

/**
 * Check for console errors
 */
async function checkConsoleErrors(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

test.describe('UX Review - Homepage', () => {
  for (const width of [DESKTOP_WIDTH, MOBILE_WIDTH]) {
    test(`Homepage value clarity @ ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Save initial homepage
      await saveScreenshot(page, '01-homepage-hero', width);
      
      // Check hero elements visibility
      const heroHeading = page.locator('h1').first();
      await expect(heroHeading).toBeVisible();
      const headingText = await heroHeading.textContent();
      console.log(`H1: ${headingText}`);
      
      // Check CTA buttons
      const ctaButton = page.locator('button:has-text("Start"), a:has-text("Start")').first();
      await expect(ctaButton).toBeVisible();
      
      // Scroll to features/benefits
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(500);
      await saveScreenshot(page, '02-homepage-features', width);
      
      // Check for value propositions
      const hasValueProps = await page.locator('text=/database|spec|prompt|cursor|export/i').count();
      expect(hasValueProps).toBeGreaterThan(0);
    });
  }
});

test.describe('UX Review - Idea Intake', () => {
  for (const width of [DESKTOP_WIDTH, MOBILE_WIDTH]) {
    test(`Idea intake flow @ ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      
      // Click Start button
      const startButton = page.locator('button:has-text("Start"), a:has-text("Start")').first();
      await startButton.click();
      await page.waitForTimeout(1000);
      await saveScreenshot(page, '03-idea-intake-start', width);
      
      // Look for idea input field
      const ideaInput = page.locator('textarea, input[type="text"]').first();
      if (await ideaInput.isVisible()) {
        await saveScreenshot(page, '04-idea-intake-form', width);
        
        // Type a test idea
        await ideaInput.fill('A mobile app for tracking daily water intake with reminders');
        await page.waitForTimeout(500);
        await saveScreenshot(page, '05-idea-intake-filled', width);
        
        // Look for next/generate button
        const generateButton = page.locator('button:has-text("Generate"), button:has-text("Next"), button:has-text("Create")').first();
        if (await generateButton.isVisible()) {
          await saveScreenshot(page, '06-idea-intake-ready', width);
        }
      }
    });
  }
});

test.describe('UX Review - Pricing Page', () => {
  for (const width of [DESKTOP_WIDTH, MOBILE_WIDTH]) {
    test(`Pricing page @ ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      
      await page.goto(`${BASE_URL}/pages/pricing.html`, { waitUntil: 'networkidle' });
      await saveScreenshot(page, '07-pricing-hero', width);
      
      // Check pricing information visible
      const priceElement = page.locator('text=/\\$\\d+\\.\\d+|\\$\\d+/').first();
      await expect(priceElement).toBeVisible();
      
      const price = await priceElement.textContent();
      console.log(`Price: ${price}`);
      
      // Check for CTA button
      const ctaButton = page.locator('button:has-text("Subscribe"), button:has-text("Get Started")').first();
      await expect(ctaButton).toBeVisible();
      
      // Scroll to features
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(500);
      await saveScreenshot(page, '08-pricing-features', width);
      
      // Scroll to FAQ
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(500);
      await saveScreenshot(page, '09-pricing-faq', width);
    });
  }
});

test.describe('UX Review - Login/Auth', () => {
  for (const width of [DESKTOP_WIDTH, MOBILE_WIDTH]) {
    test(`Login screen @ ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      
      // Try to access a protected page or login link
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      
      // Look for login/sign in link
      const loginLink = page.locator('a:has-text("Login"), a:has-text("Sign in"), button:has-text("Login")').first();
      
      if (await loginLink.isVisible()) {
        await loginLink.click();
        await page.waitForTimeout(1000);
        await saveScreenshot(page, '10-login-page', width);
        
        // Check for Firebase auth UI or custom login form
        const hasAuthUI = await page.locator('input[type="email"], input[placeholder*="email" i]').count();
        if (hasAuthUI > 0) {
          await saveScreenshot(page, '11-login-form', width);
        }
      } else {
        console.log('No login link found on homepage');
        // Try direct auth page
        await page.goto(`${BASE_URL}/pages/auth.html`, { waitUntil: 'networkidle' });
        await saveScreenshot(page, '10-auth-page', width);
      }
    });
  }
});

test.describe('UX Review - Accessibility Basics', () => {
  test('Keyboard navigation (desktop)', async ({ page }) => {
    await page.setViewportSize({ width: DESKTOP_WIDTH, height: 900 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    
    // Tab through first few elements
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);
    await saveScreenshot(page, '12-keyboard-focus-1', DESKTOP_WIDTH);
    
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);
    await saveScreenshot(page, '13-keyboard-focus-2', DESKTOP_WIDTH);
    
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);
    await saveScreenshot(page, '14-keyboard-focus-3', DESKTOP_WIDTH);
    
    // Check if focus is visible
    const focusedElement = await page.evaluateHandle(() => document.activeElement);
    const hasVisibleFocus = await page.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.outline !== 'none' || style.border !== 'none';
    }, focusedElement);
    
    console.log(`Focus visible: ${hasVisibleFocus}`);
  });
  
  test('Color contrast check (basic)', async ({ page }) => {
    await page.setViewportSize({ width: DESKTOP_WIDTH, height: 900 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    
    // Get text colors for main elements
    const textElements = await page.locator('h1, h2, p, button, a').all();
    const contrastIssues = [];
    
    for (let i = 0; i < Math.min(textElements.length, 10); i++) {
      try {
        const element = textElements[i];
        const styles = await element.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            color: computed.color,
            backgroundColor: computed.backgroundColor,
            tag: el.tagName,
            text: el.textContent?.substring(0, 50)
          };
        });
        console.log(`${styles.tag}: ${styles.color} on ${styles.backgroundColor}`);
      } catch (e) {
        // Element may have been removed
      }
    }
  });
});

test.describe('UX Review - Empty States', () => {
  test('Check for empty state messaging', async ({ page }) => {
    await page.setViewportSize({ width: DESKTOP_WIDTH, height: 900 });
    
    // Try to access user dashboard (may redirect to login)
    await page.goto(`${BASE_URL}/pages/user-dashboard.html`, { waitUntil: 'networkidle' });
    await saveScreenshot(page, '15-empty-state-check', DESKTOP_WIDTH);
    
    // Look for empty state indicators
    const hasEmptyState = await page.locator('text=/no specs|get started|create your first/i').count();
    console.log(`Empty state messages found: ${hasEmptyState}`);
  });
});

test.describe('UX Review - Loading States', () => {
  test('Check loading indicators', async ({ page }) => {
    await page.setViewportSize({ width: DESKTOP_WIDTH, height: 900 });
    await page.goto(BASE_URL);
    
    // Look for loading spinners or progress indicators
    const loadingIndicators = await page.locator('.loading, .spinner, [aria-busy="true"]').count();
    console.log(`Loading indicators found: ${loadingIndicators}`);
    
    // Check for skeleton screens
    const skeletons = await page.locator('.skeleton, .shimmer').count();
    console.log(`Skeleton screens found: ${skeletons}`);
  });
});

test.describe('UX Review - Console Errors', () => {
  test('Check for console errors on key pages', async ({ page }) => {
    const errors = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      errors.push(`Uncaught error: ${error.message}`);
    });
    
    // Homepage
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Pricing
    await page.goto(`${BASE_URL}/pages/pricing.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    console.log(`Console errors found: ${errors.length}`);
    if (errors.length > 0) {
      console.log('Errors:', errors.slice(0, 10));
    }
    
    // Allow some errors (e.g., analytics, third-party scripts)
    expect(errors.length).toBeLessThan(10);
  });
});
