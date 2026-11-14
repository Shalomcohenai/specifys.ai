import test from 'node:test';
import assert from 'node:assert/strict';

import './spec-generation-progress.js';

const compute = globalThis.SpecGenerationProgress.compute;

test('a running Prompts section is not reported as nearly complete', () => {
  const model = compute({
    status: {
      overview: 'ready',
      technical: 'ready',
      market: 'ready',
      design: 'ready',
      architecture: 'ready',
      visibility: 'ready',
      prompts: 'generating'
    }
  });
  assert.ok(model.percent <= 86);
  assert.equal(model.percent, 86);
  assert.match(model.headline, /Generating Prompts/);
  assert.match(model.headline, /Section 7 of 7/);
  assert.match(model.detail, /several minutes/);
  assert.match(model.background, /leave this page/);
  assert.doesNotMatch(model.headline, /97/);
});

test('finished sections are the only ones that advance the count', () => {
  const model = compute({
    status: {
      overview: 'ready',
      technical: 'generating',
      market: 'pending',
      design: 'pending',
      architecture: 'pending',
      visibility: 'pending',
      prompts: 'pending'
    }
  });
  assert.equal(model.completed, 1);
  assert.equal(model.percent, 14);
  assert.match(model.headline, /Generating Technical/);
  assert.match(model.expectation, /8 to 10 minutes/);
});

test('an error is named instead of a percentage', () => {
  const model = compute({
    status: {
      overview: 'ready',
      technical: 'error',
      market: 'pending',
      design: 'pending',
      architecture: 'pending',
      visibility: 'pending',
      prompts: 'pending'
    }
  });
  assert.match(model.headline, /Technical needs attention/);
  assert.match(model.headline, /Retry/);
});

test('homepage no longer promises about 4 minutes', async () => {
  const { readFileSync } = await import('node:fs');
  const home = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
  assert.match(home, /8 to 10 min/);
  assert.doesNotMatch(home, /~4 min/);
});
