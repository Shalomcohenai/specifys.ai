import test from 'node:test';
import assert from 'node:assert/strict';

import { renderEnrichedPrompts } from './spec-viewer/modules/EnrichedStageRenderers.js';

function stage(num, name, goal) {
  return `STAGE ${num}: ${name}\n## Goal\n${goal}\n## Acceptance criteria\n- [ ] Ships\n`;
}

test('skipped stages are collapsed and explained', () => {
  const html = renderEnrichedPrompts({
    fullPrompt: [
      stage(1, 'Foundation', 'Build the booking page.'),
      stage(3, 'Auth', 'Skipped: not in scope. The product has no accounts.'),
      stage(5, 'AI', 'Skipped: not in scope.')
    ].join('\n')
  });

  assert.match(html, /Build the booking page/);
  assert.match(html, /2 steps skipped\. They are not in this product\./);
  assert.match(html, /Stage 3: Auth/);
  assert.match(html, /The product has no accounts/);
  assert.equal((html.match(/prompt-ticket-card/g) || []).length, 1);
  assert.match(html, /Auth \(skipped\)/);
});

test('a prompt with no skipped stages still shows every ticket', () => {
  const html = renderEnrichedPrompts({
    fullPrompt: [
      stage(1, 'Foundation', 'Build the booking page.'),
      stage(2, 'Data', 'Store appointments.')
    ].join('\n')
  });
  assert.equal((html.match(/prompt-ticket-card/g) || []).length, 2);
  assert.doesNotMatch(html, /prompt-skipped/);
});
