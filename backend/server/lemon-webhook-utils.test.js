/**
 * Run: node backend/server/lemon-webhook-utils.test.js
 */
const assert = require('assert');
const { parseWebhookPayload } = require('./lemon-webhook-utils');

const paymentSuccess = parseWebhookPayload({
  meta: {
    event_name: 'subscription_payment_success',
    custom_data: { user_id: 'user-1' }
  },
  data: {
    id: 'inv-99',
    attributes: {
      subscription_id: 'sub-123',
      status: 'paid',
      billing_reason: 'renewal',
      renews_at: '2026-09-14T00:00:00Z'
    }
  }
});

assert.strictEqual(paymentSuccess.eventName, 'subscription_payment_success');
assert.strictEqual(paymentSuccess.subscriptionData.subscriptionId, 'sub-123');
assert.strictEqual(paymentSuccess.subscriptionData.invoiceId, 'inv-99');
assert.strictEqual(paymentSuccess.subscriptionData.billingReason, 'renewal');
assert.strictEqual(paymentSuccess.subscriptionData.isPaymentEvent, true);

const cancelled = parseWebhookPayload({
  meta: { event_name: 'subscription_updated' },
  data: {
    id: 'sub-123',
    attributes: {
      status: 'active',
      cancelled: true,
      cancel_at_period_end: true,
      ends_at: '2026-09-01T00:00:00Z'
    }
  }
});

assert.strictEqual(cancelled.subscriptionData.cancelAtPeriodEnd, true);
assert.strictEqual(cancelled.subscriptionData.subscriptionId, 'sub-123');

console.log('lemon-webhook-utils.test.js: all passed');
