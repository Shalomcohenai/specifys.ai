import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

const indexJs = fs.readFileSync(new URL('./index/index.js', import.meta.url), 'utf8');
const authHtml = fs.readFileSync(new URL('../../../pages/auth.html', import.meta.url), 'utf8');

test('auto-start waits for Firebase to restore the session and guards redirect loops', () => {
  assert.match(indexJs, /function waitForInitialAuthUser\(/);
  assert.match(indexJs, /authStateReady/);
  assert.match(indexJs, /AUTH_READY_TIMEOUT_MS = 10000/);
  assert.match(indexJs, /Date\.now\(\) >= deadline/);
  assert.match(indexJs, /specifys_auto_start_redirect_at/);
  const start = indexJs.indexOf('function tryAutoStartPlanning');
  const end = indexJs.indexOf('function scheduleGuestBriefRestore');
  assert.ok(start > 0 && end > start);
  const body = indexJs.slice(start, end);
  assert.doesNotMatch(body, /isUserAuthenticated\(\)/);
});

test('signup awaits initialize and does not let the global listener redirect first', () => {
  assert.match(authHtml, /suppressAuthRedirect/);
  assert.match(authHtml, /function awaitWithTimeout\(/);
  assert.match(authHtml, /SIGNUP_INIT_TIMEOUT_MS/);
  assert.match(authHtml, /awaitWithTimeout\(\s*createUserDocument\(userCredential\.user, true\)/);
  assert.match(authHtml, /successMsg\.classList\.remove\('hidden'\)/);
  assert.match(authHtml, /successMsg\.style\.display = 'block'/);
  assert.match(authHtml, /!suppressAuthRedirect/);
});
