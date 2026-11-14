import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ux-review',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  use: {
    baseURL: process.env.UX_REVIEW_URL || 'https://www.specifys-ai.com',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
});
