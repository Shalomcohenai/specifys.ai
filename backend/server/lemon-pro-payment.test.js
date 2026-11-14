/**
 * Run: node --test backend/server/lemon-pro-payment.test.js
 * Dummy data only. No network, Firebase, or real secrets.
 */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const { parseWebhookPayload, verifyWebhookSignature } = require('./lemon-webhook-utils');
const {
  lemonCheckoutMode,
  resolveLemonWebhookSecret,
  shouldEnableProForOrder,
  proGrantDecision,
  markProActivationError,
  isProActivationError,
  proActivationFailureBody,
  buildLemonStartupLog
} = require('./lemon-pro-grant');
const { lemonWebhookSecretWarnings } = require('./env-check');

function loadPricingRedirect() {
  const code = fs.readFileSync(path.join(__dirname, '../../assets/js/pages/pricing-checkout-redirect.js'), 'utf8');
  const sandbox = {
    console,
    URLSearchParams,
    encodeURIComponent,
    decodeURIComponent,
    module: { exports: {} }
  };
  sandbox.globalThis = sandbox;
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(code, sandbox);
  return sandbox.module.exports;
}

const DUMMY_SECRET = 'dummy-webhook-secret';

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

function liveOrderEvent(orderId) {
  return {
    meta: {
      event_name: 'order_created',
      test_mode: false,
      custom_data: { user_id: 'user-dummy-1', product_key: 'pro_monthly' }
    },
    data: {
      id: orderId,
      attributes: {
        status: 'paid',
        currency: 'USD',
        total: 199,
        test_mode: false,
        user_email: 'buyer@example.com',
        order_items: [{ variant_id: 1055346, product_id: 671446, product_name: 'Specifys Pro', quantity: 1 }]
      }
    }
  };
}

function applyGrant(state, orderId) {
  const decision = proGrantDecision({
    subscriptionType: state.credits && state.credits.subscription && state.credits.subscription.type,
    subscriptionStatus: state.credits && state.credits.subscription && state.credits.subscription.status,
    lastOrderId: state.subscription ? state.subscription.last_order_id : null,
    orderId
  });
  if (!decision.grant) {
    return { state, decision, granted: false };
  }
  if (decision.userWrite.method === 'update' && !state.user) {
    throw new Error('users doc missing');
  }
  const user = Object.assign({}, state.user || {}, decision.userWrite.data);
  return {
    decision,
    granted: true,
    state: {
      user,
      credits: { subscription: { type: 'pro', status: 'active' } },
      subscription: { last_order_id: String(orderId) }
    }
  };
}

test('webhook signature accepts a valid dummy HMAC and rejects an invalid one', () => {
  const payload = JSON.stringify(liveOrderEvent('order-live-1'));
  const hex = sign(payload, DUMMY_SECRET);
  assert.strictEqual(verifyWebhookSignature(payload, hex, DUMMY_SECRET), true);
  assert.strictEqual(verifyWebhookSignature(payload, `sha256=${hex}`, DUMMY_SECRET), true);
  assert.strictEqual(verifyWebhookSignature(payload, hex.slice(0, -1) + (hex.endsWith('a') ? 'b' : 'a'), DUMMY_SECRET), false);
  assert.strictEqual(verifyWebhookSignature(payload, hex, 'different-dummy-secret'), false);
  assert.strictEqual(verifyWebhookSignature(payload, '', DUMMY_SECRET), false);
  assert.strictEqual(verifyWebhookSignature(payload, hex, ''), false);
});

test('webhook secret prefers LEMON_WEBHOOK_SECRET and accepts the alias', () => {
  assert.strictEqual(resolveLemonWebhookSecret({
    LEMON_WEBHOOK_SECRET: 'primary-dummy',
    LEMON_SQUEEZY_WEBHOOK_SECRET: 'alias-dummy'
  }), 'primary-dummy');
  assert.strictEqual(resolveLemonWebhookSecret({
    LEMON_WEBHOOK_SECRET: '   ',
    LEMON_SQUEEZY_WEBHOOK_SECRET: 'alias-dummy'
  }), 'alias-dummy');
  assert.strictEqual(resolveLemonWebhookSecret({}), '');
});

test('env check warns about LEMON_WEBHOOK_SECRET', () => {
  assert.deepStrictEqual(lemonWebhookSecretWarnings({}), ['LEMON_WEBHOOK_SECRET']);
  assert.deepStrictEqual(lemonWebhookSecretWarnings({ LEMON_WEBHOOK_SECRET: 'dummy' }), []);
  const aliasOnly = lemonWebhookSecretWarnings({ LEMON_SQUEEZY_WEBHOOK_SECRET: 'alias-dummy' });
  assert.ok(aliasOnly[0].includes('LEMON_WEBHOOK_SECRET'));
});

test('live order grants Pro once, retry is idempotent, and a missing user doc is created', () => {
  const parsed = parseWebhookPayload(liveOrderEvent('order-live-1'));
  assert.strictEqual(parsed.orderData.testMode, false);
  assert.strictEqual(parsed.orderData.userId, 'user-dummy-1');
  assert.strictEqual(shouldEnableProForOrder({
    testMode: parsed.orderData.testMode,
    productType: 'subscription'
  }), true);
  assert.strictEqual(shouldEnableProForOrder({ testMode: true, productType: 'subscription' }), false);

  const missingUser = { user: null, credits: null, subscription: null };
  const first = applyGrant(missingUser, parsed.orderData.orderId);
  assert.strictEqual(first.granted, true);
  assert.strictEqual(first.decision.userWrite.method, 'set');
  assert.strictEqual(first.decision.userWrite.merge, true);
  assert.strictEqual(first.state.user.plan, 'pro');

  const retry = applyGrant(first.state, parsed.orderData.orderId);
  assert.strictEqual(retry.granted, false);
  assert.strictEqual(retry.decision.action, 'already_processed');
  assert.strictEqual(retry.state.user.plan, 'pro');
  assert.strictEqual(retry.state.subscription.last_order_id, 'order-live-1');

  const renewal = applyGrant(first.state, 'order-live-2');
  assert.strictEqual(renewal.granted, true);
  assert.strictEqual(renewal.state.subscription.last_order_id, 'order-live-2');

  const withSubscription = proGrantDecision({
    subscriptionType: 'pro',
    subscriptionStatus: 'active',
    lastOrderId: 'order-live-1',
    orderId: 'order-live-1',
    storedSubscriptionId: null,
    subscriptionId: 'sub-dummy-1'
  });
  assert.strictEqual(withSubscription.grant, true);
  assert.strictEqual(withSubscription.userWrite.merge, true);
});

test('Pro activation failure is a 500 so Lemon can retry', () => {
  const failure = proActivationFailureBody('webhook-dummy-1');
  assert.strictEqual(failure.status, 500);
  assert.strictEqual(failure.body.received, false);
  assert.strictEqual(failure.body.requestId, 'webhook-dummy-1');
  const marked = markProActivationError(new Error('users doc missing'));
  assert.strictEqual(isProActivationError(marked), true);
  assert.strictEqual(isProActivationError(new Error('unrelated')), false);
});

test('startup log names test or live mode and omits secret values', () => {
  assert.strictEqual(lemonCheckoutMode({}), 'test');
  assert.strictEqual(lemonCheckoutMode({ LEMON_TEST_MODE: 'true' }), 'test');
  assert.strictEqual(lemonCheckoutMode({ LEMON_TEST_MODE: 'false' }), 'live');

  const live = buildLemonStartupLog({
    LEMON_TEST_MODE: 'false',
    LEMON_SQUEEZY_API_KEY: 'sk_live_dummy_key',
    LEMON_SQUEEZY_STORE_ID: 'store-dummy',
    LEMON_WEBHOOK_SECRET: DUMMY_SECRET
  });
  assert.strictEqual(live.fields.lemonCheckoutMode, 'live');
  assert.strictEqual(live.fields.lemonApiKeyConfigured, true);
  assert.strictEqual(live.fields.lemonStoreIdConfigured, true);
  assert.strictEqual(live.fields.lemonWebhookSecretConfigured, true);
  const serialized = JSON.stringify(live);
  assert.strictEqual(serialized.includes('sk_live_dummy_key'), false);
  assert.strictEqual(serialized.includes('store-dummy'), false);
  assert.strictEqual(serialized.includes(DUMMY_SECRET), false);
  assert.match(live.message, /LIVE/);

  const testMode = buildLemonStartupLog({});
  assert.strictEqual(testMode.fields.lemonCheckoutMode, 'test');
  assert.match(testMode.message, /TEST/);
});

test('logged-out pricing auth URL returns to checkout for a known product', () => {
  const { buildPricingAuthUrl, readResumeCheckout } = loadPricingRedirect();
  const url = buildPricingAuthUrl('pro_monthly');
  const next = new URL(url, 'https://specifys-ai.com').searchParams.get('next');
  assert.strictEqual(next.startsWith('/'), true);
  assert.strictEqual(next.startsWith('//'), false);
  assert.strictEqual(next.includes('://'), false);
  assert.strictEqual(readResumeCheckout(next.split('?')[1]), 'pro_monthly');
  assert.strictEqual(buildPricingAuthUrl('https://evil.example'), '/pages/auth.html');
  assert.strictEqual(readResumeCheckout('resumeCheckout=javascript:alert(1)'), null);
});

test('payment fixes stay wired in the route, grant service, and pricing page', () => {
  const route = fs.readFileSync(path.join(__dirname, 'lemon-routes.js'), 'utf8');
  const credits = fs.readFileSync(path.join(__dirname, 'credits-v3-service.js'), 'utf8');
  const pricing = fs.readFileSync(path.join(__dirname, '../../assets/js/pages/pricing.js'), 'utf8');
  const server = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

  assert.match(route, /const \{ db, admin, auth \} = require\('\.\/firebase-admin'\)/);
  assert.match(route, /resolveLemonWebhookSecret\(\)/);
  assert.match(route, /proActivationFailureBody/);
  assert.match(route, /shouldEnableProForOrder/);
  assert.match(route, /alreadyRecorded/);
  assert.doesNotMatch(route, /const secret = process\.env\.LEMON_WEBHOOK_SECRET;/);

  assert.match(credits, /proGrantDecision/);
  assert.match(credits, /transaction\.set\(userRef, decision\.userWrite\.data, \{ merge: decision\.userWrite\.merge === true \}\)/);
  assert.doesNotMatch(credits, /transaction\.update\(userRef, \{ plan: 'pro' \}\)/);

  assert.match(pricing, /PricingCheckoutRedirect\.buildPricingAuthUrl/);
  assert.match(pricing, /captureResumeCheckout/);
  assert.doesNotMatch(pricing, /const shouldDisable = !user/);
  assert.doesNotMatch(pricing, /setProductButtonsDisabled\(true\)/);
  assert.match(server, /buildLemonStartupLog/);
});
