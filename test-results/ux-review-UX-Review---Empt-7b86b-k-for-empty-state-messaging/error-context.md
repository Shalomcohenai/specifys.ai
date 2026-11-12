# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ux-review.spec.js >> UX Review - Empty States >> Check for empty state messaging
- Location: tests/ux-review/ux-review.spec.js:234:3

# Error details

```
Error: page.screenshot: Protocol error (Page.captureScreenshot): Unable to capture screenshot
Call log:
  - taking page screenshot
  - waiting for fonts to load...
  - fonts loaded

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - region "This page doesn’t exist" [ref=e3]:
      - heading "This page doesn’t exist" [level=1] [ref=e4]
      - paragraph [ref=e5]: It may have been moved, removed, or never existed.
      - generic "HTTP status, error code, and request ID" [ref=e6]:
        - paragraph [ref=e7]: 404 NOT_FOUND
        - paragraph [ref=e8]: iad1::t84zn-1794511091638-6df65ebaceb5
  - generic "Documentation, logs, and debugging actions" [ref=e9]:
    - link "View NOT_FOUND documentation" [ref=e10] [cursor=pointer]:
      - /url: https://vercel.com/docs/errors/not_found
      - generic [ref=e11]: View Documentation
    - img [ref=e12]
    - button "Copy NOT_FOUND debugging instructions to clipboard" [ref=e14] [cursor=pointer]:
      - generic [ref=e15]: Copy Debug Prompt
      - img
    - status [ref=e16]
```

# Test source

```ts
  1   | /**
  2   |  * UX Review Test Suite
  3   |  * Tests key user flows at desktop (1440px) and mobile (390px) widths
  4   |  * Saves screenshots as artifacts for review
  5   |  */
  6   | 
  7   | import { test, expect } from '@playwright/test';
  8   | import fs from 'fs';
  9   | import path from 'path';
  10  | 
  11  | const DESKTOP_WIDTH = 1440;
  12  | const MOBILE_WIDTH = 390;
  13  | const PRODUCTION_URL = 'https://www.specifys-ai.com';
  14  | const LOCAL_URL = 'http://127.0.0.1:4000';
  15  | 
  16  | // Use production by default, fallback to local
  17  | const BASE_URL = process.env.UX_REVIEW_URL || PRODUCTION_URL;
  18  | 
  19  | // Create artifacts directory
  20  | const ARTIFACTS_DIR = '/opt/cursor/artifacts/ux-review';
  21  | if (!fs.existsSync(ARTIFACTS_DIR)) {
  22  |   fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  23  | }
  24  | 
  25  | /**
  26  |  * Save screenshot with descriptive name
  27  |  */
  28  | async function saveScreenshot(page, name, width) {
  29  |   const filename = `${name}-${width}px.png`;
  30  |   const filepath = path.join(ARTIFACTS_DIR, filename);
> 31  |   await page.screenshot({ path: filepath, fullPage: false });
      |              ^ Error: page.screenshot: Protocol error (Page.captureScreenshot): Unable to capture screenshot
  32  |   console.log(`📸 Saved: ${filename}`);
  33  |   return filepath;
  34  | }
  35  | 
  36  | /**
  37  |  * Check for console errors
  38  |  */
  39  | async function checkConsoleErrors(page) {
  40  |   const errors = [];
  41  |   page.on('console', msg => {
  42  |     if (msg.type() === 'error') {
  43  |       errors.push(msg.text());
  44  |     }
  45  |   });
  46  |   return errors;
  47  | }
  48  | 
  49  | test.describe('UX Review - Homepage', () => {
  50  |   for (const width of [DESKTOP_WIDTH, MOBILE_WIDTH]) {
  51  |     test(`Homepage value clarity @ ${width}px`, async ({ page }) => {
  52  |       await page.setViewportSize({ width, height: 900 });
  53  |       
  54  |       await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  55  |       
  56  |       // Save initial homepage
  57  |       await saveScreenshot(page, '01-homepage-hero', width);
  58  |       
  59  |       // Check hero elements visibility
  60  |       const heroHeading = page.locator('h1').first();
  61  |       await expect(heroHeading).toBeVisible();
  62  |       const headingText = await heroHeading.textContent();
  63  |       console.log(`H1: ${headingText}`);
  64  |       
  65  |       // Check CTA buttons
  66  |       const ctaButton = page.locator('button:has-text("Start"), a:has-text("Start")').first();
  67  |       await expect(ctaButton).toBeVisible();
  68  |       
  69  |       // Scroll to features/benefits
  70  |       await page.evaluate(() => window.scrollBy(0, 800));
  71  |       await page.waitForTimeout(500);
  72  |       await saveScreenshot(page, '02-homepage-features', width);
  73  |       
  74  |       // Check for value propositions
  75  |       const hasValueProps = await page.locator('text=/database|spec|prompt|cursor|export/i').count();
  76  |       expect(hasValueProps).toBeGreaterThan(0);
  77  |     });
  78  |   }
  79  | });
  80  | 
  81  | test.describe('UX Review - Idea Intake', () => {
  82  |   for (const width of [DESKTOP_WIDTH, MOBILE_WIDTH]) {
  83  |     test(`Idea intake flow @ ${width}px`, async ({ page }) => {
  84  |       await page.setViewportSize({ width, height: 900 });
  85  |       
  86  |       await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  87  |       
  88  |       // Click Start button
  89  |       const startButton = page.locator('button:has-text("Start"), a:has-text("Start")').first();
  90  |       await startButton.click();
  91  |       await page.waitForTimeout(1000);
  92  |       await saveScreenshot(page, '03-idea-intake-start', width);
  93  |       
  94  |       // Look for idea input field
  95  |       const ideaInput = page.locator('textarea, input[type="text"]').first();
  96  |       if (await ideaInput.isVisible()) {
  97  |         await saveScreenshot(page, '04-idea-intake-form', width);
  98  |         
  99  |         // Type a test idea
  100 |         await ideaInput.fill('A mobile app for tracking daily water intake with reminders');
  101 |         await page.waitForTimeout(500);
  102 |         await saveScreenshot(page, '05-idea-intake-filled', width);
  103 |         
  104 |         // Look for next/generate button
  105 |         const generateButton = page.locator('button:has-text("Generate"), button:has-text("Next"), button:has-text("Create")').first();
  106 |         if (await generateButton.isVisible()) {
  107 |           await saveScreenshot(page, '06-idea-intake-ready', width);
  108 |         }
  109 |       }
  110 |     });
  111 |   }
  112 | });
  113 | 
  114 | test.describe('UX Review - Pricing Page', () => {
  115 |   for (const width of [DESKTOP_WIDTH, MOBILE_WIDTH]) {
  116 |     test(`Pricing page @ ${width}px`, async ({ page }) => {
  117 |       await page.setViewportSize({ width, height: 900 });
  118 |       
  119 |       await page.goto(`${BASE_URL}/pages/pricing.html`, { waitUntil: 'networkidle' });
  120 |       await saveScreenshot(page, '07-pricing-hero', width);
  121 |       
  122 |       // Check pricing information visible
  123 |       const priceElement = page.locator('text=/\\$\\d+\\.\\d+|\\$\\d+/').first();
  124 |       await expect(priceElement).toBeVisible();
  125 |       
  126 |       const price = await priceElement.textContent();
  127 |       console.log(`Price: ${price}`);
  128 |       
  129 |       // Check for CTA button
  130 |       const ctaButton = page.locator('button:has-text("Subscribe"), button:has-text("Get Started")').first();
  131 |       await expect(ctaButton).toBeVisible();
```