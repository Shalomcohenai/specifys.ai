import path from 'path';
import { test, expect } from '@playwright/test';

test('spec flow notices show progress, an empty state, and a next step', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setContent('<main id="host"></main>');
  await page.addScriptTag({ path: path.resolve('assets/js/features/spec-flow-feedback.js') });
  await page.evaluate(() => {
    const api = window.SpecFlowFeedback;
    const host = document.getElementById('host');
    host.innerHTML = [
      api.renderProgressHTML(0),
      api.renderNoticeHTML(api.describeGenerationError('network')),
      api.renderNoticeHTML(api.describeEmptyWorkspace('empty')),
      api.renderLoadingHTML('Loading your specifications…')
    ].join('');
  });

  await expect(page.getByRole('status').first()).toContainText('Saving your brief');
  await expect(page.getByRole('alert').first()).toContainText('Next:');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create your first spec' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'See an example' })).toBeVisible();
  await expect(page.getByText('Loading your specifications…')).toBeVisible();
  expect(errors).toEqual([]);
});
