/**
 * Pure helpers for Lemon checkout mode, webhook secret resolution,
 * and idempotent Pro grants. No Firebase or network access.
 */

function lemonCheckoutMode(env = process.env) {
  // Checkout stays in test mode unless LEMON_TEST_MODE is exactly "false".
  return env.LEMON_TEST_MODE !== 'false' ? 'test' : 'live';
}

function resolveLemonWebhookSecret(env = process.env) {
  const primary = typeof env.LEMON_WEBHOOK_SECRET === 'string' ? env.LEMON_WEBHOOK_SECRET.trim() : '';
  const alias = typeof env.LEMON_SQUEEZY_WEBHOOK_SECRET === 'string' ? env.LEMON_SQUEEZY_WEBHOOK_SECRET.trim() : '';
  return primary || alias || '';
}

function shouldEnableProForOrder({ testMode, productType } = {}) {
  if (testMode) return false;
  return productType === 'subscription';
}

/**
 * Same-order retries must not grant again. A new order id (renewal) still grants.
 * The user document write is a merge so a missing users/{uid} doc is created.
 */
function proGrantDecision({
  subscriptionType,
  subscriptionStatus,
  lastOrderId,
  orderId,
  storedSubscriptionId,
  subscriptionId
} = {}) {
  const active = String(subscriptionType || '').toLowerCase() === 'pro'
    && ['active', 'paid', 'on_trial'].includes(String(subscriptionStatus || '').toLowerCase());
  const sameOrder = orderId != null && String(orderId) !== ''
    && lastOrderId != null && String(lastOrderId) === String(orderId);
  const incomingSubscriptionId = subscriptionId ? String(subscriptionId) : '';
  const existingSubscriptionId = storedSubscriptionId ? String(storedSubscriptionId) : '';
  // An empty incoming id must not count as a change, so an order retry cannot
  // wipe a subscription id that a later webhook already stored.
  const subscriptionUnchanged = !incomingSubscriptionId || incomingSubscriptionId === existingSubscriptionId;

  if (active && sameOrder && subscriptionUnchanged) {
    return { action: 'already_processed', grant: false };
  }

  return {
    action: 'grant',
    grant: true,
    userWrite: { method: 'set', merge: true, data: { plan: 'pro' } }
  };
}

function markProActivationError(error) {
  const wrapped = error instanceof Error ? error : new Error('Pro activation failed');
  wrapped.code = 'PRO_ACTIVATION_FAILED';
  return wrapped;
}

function isProActivationError(error) {
  return !!(error && error.code === 'PRO_ACTIVATION_FAILED');
}

function proActivationFailureBody(requestId) {
  return {
    status: 500,
    body: {
      received: false,
      error: 'Pro activation failed',
      requestId: requestId || null
    }
  };
}

function buildLemonStartupLog(env = process.env) {
  const mode = lemonCheckoutMode(env);
  return {
    message: mode === 'live'
      ? '[UNIFIED SERVER] Lemon Squeezy checkout mode: LIVE'
      : '[UNIFIED SERVER] Lemon Squeezy checkout mode: TEST',
    fields: {
      type: 'lemon_checkout_mode',
      lemonCheckoutMode: mode,
      lemonApiKeyConfigured: Boolean(env.LEMON_SQUEEZY_API_KEY),
      lemonStoreIdConfigured: Boolean(env.LEMON_SQUEEZY_STORE_ID),
      lemonWebhookSecretConfigured: Boolean(resolveLemonWebhookSecret(env))
    }
  };
}

module.exports = {
  lemonCheckoutMode,
  resolveLemonWebhookSecret,
  shouldEnableProForOrder,
  proGrantDecision,
  markProActivationError,
  isProActivationError,
  proActivationFailureBody,
  buildLemonStartupLog
};
