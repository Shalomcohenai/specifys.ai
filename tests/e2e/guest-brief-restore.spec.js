import path from 'path';
import { test, expect } from '@playwright/test';

test('a saved brief is painted back into the chat', async ({ page }) => {
  await page.setContent(`
    <div id="livingBrief">
      <div id="lbChatScroll"><div id="lbMessages"></div></div>
      <textarea id="lbInput"></textarea>
      <textarea id="main-pitch"></textarea>
    </div>
  `);
  await page.addScriptTag({ path: path.resolve('assets/js/features/planning/living-brief.js') });
  const restored = await page.evaluate(() => {
    return window.LivingBrief.restore({
      draft: { vision: 'appointment-booking app for barbers and salons' },
      messages: [
        { role: 'assistant', content: 'What are we building?' },
        { role: 'user', content: 'appointment-booking app for barbers and salons' }
      ],
      composer: 'reminders and payments'
    });
  });
  expect(restored).toBe(true);
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(page.locator('.lb-msg--user')).toContainText('appointment-booking app for barbers and salons');
    await expect(page.locator('#lbInput')).toHaveValue('reminders and payments');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(8);
  }
});
