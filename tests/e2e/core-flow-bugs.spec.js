import { test, expect } from '@playwright/test';

const FIXTURE = '/core-flow-fixture.html';

const FIXTURE_HTML = `<!DOCTYPE html>
<html lang="en">
<body>
  <div id="heroContent">Hero</div>
  <div id="planningContainer" class="hidden" style="display:none">
    <textarea id="main-pitch"></textarea>
    <div id="livingBrief">
      <div id="lbChatScroll"><div id="lbMessages"></div></div>
      <div id="lbComposer">
        <form id="lbComposerForm" action="javascript:void(0)">
          <textarea id="lbInput" aria-label="Message Living Brief"></textarea>
          <button type="submit" id="lbSend" aria-label="Send" aria-disabled="true">Send</button>
        </form>
      </div>
    </div>
  </div>
  <script>
    window.__specifysEnsureIdleScripts = function () {
      if (!window.__idleLoading) {
        window.__idleLoading = new Promise(function (resolve, reject) {
          var s = document.createElement('script');
          s.src = '/assets/js/features/planning/living-brief.js';
          s.onload = function () { resolve(); };
          s.onerror = function () { reject(new Error('living-brief')); };
          document.body.appendChild(s);
        });
      }
      return window.__idleLoading;
    };
  </script>
  <script src="/assets/js/features/index/index.js"></script>
</body>
</html>`;

test.beforeEach(async ({ page }) => {
  await page.route((url) => url.pathname.endsWith(FIXTURE), (route) => {
    route.fulfill({ status: 200, contentType: 'text/html', body: FIXTURE_HTML });
  });
});

test('returning visitor with guestBriefStarted can type, enable Send, and press Enter to send', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('guestBriefStarted', '1');
    localStorage.setItem('hasVisited', 'true');
    const auth = {
      get currentUser() { return null; },
      authStateReady() { return Promise.resolve(); },
      onAuthStateChanged(cb) { cb(null); return () => {}; }
    };
    window.firebase = { auth: () => auth };
  });

  await page.goto(FIXTURE);
  await expect(page.locator('#planningContainer')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('.lb-msg--assistant')).toContainText('What are we building?', { timeout: 8000 });

  const input = page.locator('#lbInput');
  await input.fill('A booking app for barbers');
  await expect(page.locator('#lbSend')).toHaveAttribute('aria-disabled', 'false');
  await input.press('Enter');
  await expect(page.locator('.lb-msg--user')).toContainText('A booking app for barbers');
  await expect(input).toHaveValue('');
  expect(errors).toEqual([]);
});

test('resumeBrief=1 restores the saved guest brief after signup', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('guestBriefStarted', '1');
    localStorage.setItem('hasVisited', 'true');
    localStorage.setItem('pendingGuestBrief', JSON.stringify({
      planningText: 'appointment-booking app for barbers',
      planningData: { vision: 'appointment-booking app for barbers' },
      draft: { vision: 'appointment-booking app for barbers' },
      messages: [
        { role: 'assistant', content: 'What are we building?' },
        { role: 'user', content: 'appointment-booking app for barbers' }
      ],
      composer: 'reminders'
    }));
    const auth = {
      get currentUser() { return null; },
      authStateReady() { return Promise.resolve(); },
      onAuthStateChanged(cb) { cb(null); return () => {}; }
    };
    window.firebase = { auth: () => auth };
  });

  await page.goto(FIXTURE + '?resumeBrief=1');
  await expect(page.locator('.lb-msg--user')).toContainText('appointment-booking app for barbers', { timeout: 8000 });
  await expect(page.locator('#lbInput')).toHaveValue('reminders');
  await expect(page).not.toHaveURL(/resumeBrief=1/);
});

test('signed-in ?autoStart=true waits for auth and does not redirect-loop', async ({ page }) => {
  const authHits = [];
  await page.route('**/pages/auth.html**', (route) => {
    authHits.push(route.request().url());
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>auth</title><p>auth</p>' });
  });
  await page.addInitScript(() => {
    localStorage.setItem('hasVisited', 'true');
    const user = { uid: 'signed-in-user', email: 'owner@example.com' };
    let current = null;
    const auth = {
      get currentUser() { return current; },
      authStateReady() {
        return new Promise((resolve) => {
          setTimeout(() => {
            current = user;
            resolve();
          }, 180);
        });
      },
      onAuthStateChanged(cb) {
        setTimeout(() => {
          current = user;
          cb(user);
        }, 180);
        return () => {};
      }
    };
    window.firebase = { auth: () => auth };
    window.questionFlowController = {
      start() { window.__autoStarted = true; }
    };
  });

  await page.goto(FIXTURE + '?autoStart=true');
  await expect.poll(() => page.evaluate(() => window.__autoStarted === true), { timeout: 5000 }).toBe(true);
  expect(authHits).toEqual([]);
  await expect(page).not.toHaveURL(/auth\.html/);
  await page.waitForTimeout(600);
  expect(authHits).toEqual([]);
});

test('auto-start loop guard stops a second redirect inside the bounce window', async ({ page }) => {
  const authHits = [];
  await page.route('**/pages/auth.html**', (route) => {
    authHits.push(route.request().url());
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>auth</title>' });
  });
  await page.addInitScript(() => {
    localStorage.setItem('hasVisited', 'true');
    sessionStorage.setItem('specifys_auto_start_redirect_at', String(Date.now()));
    const auth = {
      get currentUser() { return null; },
      authStateReady() { return Promise.resolve(); },
      onAuthStateChanged(cb) { cb(null); return () => {}; }
    };
    window.firebase = { auth: () => auth };
  });

  await page.goto(FIXTURE + '?autoStart=true');
  await page.waitForTimeout(500);
  expect(authHits).toEqual([]);
  await expect(page).not.toHaveURL(/auth\.html/);
});

test('logged-out auto-start still redirects to auth once', async ({ page }) => {
  const authHits = [];
  await page.route('**/pages/auth.html**', (route) => {
    authHits.push(route.request().url());
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>auth</title><p>auth</p>' });
  });
  await page.addInitScript(() => {
    localStorage.setItem('hasVisited', 'true');
    const auth = {
      get currentUser() { return null; },
      authStateReady() { return Promise.resolve(); },
      onAuthStateChanged(cb) { cb(null); return () => {}; }
    };
    window.firebase = { auth: () => auth };
  });

  await page.goto(FIXTURE + '?autoStart=true');
  await expect.poll(() => authHits.length, { timeout: 5000 }).toBe(1);
  expect(authHits[0]).toContain('autoStart');
});

function fulfillJs(route, body) {
  return route.fulfill({
    status: 200,
    contentType: 'text/javascript',
    headers: { 'access-control-allow-origin': '*' },
    body
  });
}

function firebaseModule(kind) {
  if (kind === 'app') {
    return `export function initializeApp() { return {}; }`;
  }
  if (kind === 'firestore') {
    return `
      export function getFirestore() { return {}; }
      export function doc() { return {}; }
      export function setDoc() { return Promise.resolve(); }
      export function getDoc() { return Promise.resolve({ exists: () => false }); }
      export function serverTimestamp() { return null; }
    `;
  }
  return `
    const listeners = [];
    let currentUser = null;
    function notify() {
      listeners.forEach((cb) => { try { cb(currentUser); } catch (e) {} });
    }
    export function getAuth() {
      return { get currentUser() { return currentUser; } };
    }
    export class GoogleAuthProvider {}
    export function onAuthStateChanged(_auth, cb) {
      listeners.push(cb);
      Promise.resolve().then(() => cb(currentUser));
      return () => {};
    }
    export function createUserWithEmailAndPassword(_auth, email) {
      return new Promise((resolve) => {
        setTimeout(() => {
          currentUser = {
            uid: 'new-user',
            email,
            getIdToken: async () => 'test-token'
          };
          notify();
          resolve({ user: currentUser });
        }, 40);
      });
    }
    export function signInWithEmailAndPassword() { return Promise.reject(Object.assign(new Error('no'), { code: 'auth/operation-not-allowed' })); }
    export function signOut() { return Promise.resolve(); }
    export function signInWithPopup() { return Promise.reject(Object.assign(new Error('no'), { code: 'auth/popup-blocked' })); }
    export function signInWithRedirect() { return Promise.resolve(); }
    export function getAdditionalUserInfo() { return { isNewUser: true }; }
    export function getRedirectResult() { return Promise.resolve(null); }
  `;
}

test('signup shows success only after initialize resolves and does not abort it', async ({ page }) => {
  let initStarted = 0;
  let initFinished = false;
  await page.route('**/firebasejs/10.12.2/firebase-app.js*', (route) => fulfillJs(route, firebaseModule('app')));
  await page.route('**/firebasejs/10.12.2/firebase-auth.js*', (route) => fulfillJs(route, firebaseModule('auth')));
  await page.route('**/firebasejs/10.12.2/firebase-firestore.js*', (route) => fulfillJs(route, firebaseModule('firestore')));
  await page.route('**/api/users/initialize', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'authorization, content-type'
        }
      });
      return;
    }
    initStarted += 1;
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ created: true, isNewUser: true, creditsGranted: 1, credits: { total: 1 } })
    });
    initFinished = true;
  });
  await page.route('**/pages/profile.html**', (route) => {
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>profile</title><p>profile</p>' });
  });
  await page.route('**googletagmanager.com/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route('**fonts.googleapis.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**fonts.gstatic.com/**', (route) => route.fulfill({ status: 200, body: '' }));
  await page.route('**cdnjs.cloudflare.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));

  await page.goto('/pages/auth.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#register-tab').click();
  await expect(page.locator('#register-form')).toBeVisible();
  await page.locator('#register-email').fill('new-user@example.com');
  await page.locator('#register-password').fill('password123');
  await page.locator('#register-confirm').fill('password123');
  await page.locator('#privacy-policy-agreement').check();
  await page.locator('#register-btn').click();

  const success = page.locator('#success-message');
  await expect(success).toBeVisible({ timeout: 8000 });
  await expect(success).toContainText('Account created');
  expect(initStarted).toBe(1);
  expect(initFinished).toBe(true);
  expect(page.url()).toContain('/pages/auth.html');

  await page.waitForURL(/profile\.html/, { timeout: 5000 });
});
