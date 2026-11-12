import test from 'node:test';
import assert from 'node:assert/strict';

import './spec-flow-feedback.js';

const api = globalThis.SpecFlowFeedback;

test('generation errors name a next step and a primary action', () => {
  for (const input of ['auth', 'credits', 'network', 'save', 'unavailable', { status: 403, message: 'no credits' }, { message: 'Failed to fetch' }]) {
    const model = api.describeGenerationError(input);
    assert.ok(model.title.length > 0);
    assert.match(model.nextStep, /Next:|Sign in|Try again|Review plans|Reload|workspace|connection|Generate/i);
    assert.ok(model.nextStep.length > 12);
    assert.ok(model.actions.some((action) => action.primary));
  }
});

test('credit and network failures do not echo the raw server string', () => {
  const model = api.describeGenerationError({ status: 500, message: 'boom internal stack /api/secret' });
  const html = api.renderNoticeHTML(model);
  assert.equal(html.includes('boom internal'), false);
  assert.equal(html.includes('/api/secret'), false);
  assert.match(html, /Next:/);
  assert.match(html, /role="alert"/);
});

test('load errors pick a different next step for auth, permission, and a missing id', () => {
  const auth = api.describeLoadError('User must be authenticated to view specifications');
  const denied = api.describeLoadError('You do not have permission to view this specification.');
  const missing = api.describeLoadError('No specification ID provided in URL');
  assert.match(auth.nextStep, /Sign in/);
  assert.match(denied.nextStep, /account/);
  assert.match(missing.actions[0].href, /profile/);
  assert.notEqual(auth.title, missing.title);
});

test('empty workspace offers create and an example', () => {
  const empty = api.describeEmptyWorkspace('empty');
  assert.match(empty.nextStep, /Generate/);
  assert.equal(empty.actions[0].action, 'create');
  assert.match(empty.actions[1].href, /demo-spec/);
  const failed = api.describeEmptyWorkspace('error');
  assert.equal(failed.actions[0].action, 'retry');
});

test('progress markup exposes the current stage', () => {
  const html = api.renderProgressHTML(1);
  assert.match(html, /Starting generation/);
  assert.match(html, /aria-current="step"/);
  assert.match(html, /role="status"/);
  const loading = api.renderLoadingHTML('Loading your specifications…');
  assert.match(loading, /Loading your specifications/);
  assert.match(loading, /aria-live="polite"/);
});
