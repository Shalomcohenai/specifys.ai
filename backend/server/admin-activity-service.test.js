/**
 * Run: node backend/server/admin-activity-service.test.js
 */
const assert = require('assert');
const {
  resolveSubscriptionActivityAction,
  buildSubscriptionActivityTitle
} = require('./subscription-activity');

assert.strictEqual(resolveSubscriptionActivityAction('paid'), 'activated');
assert.strictEqual(resolveSubscriptionActivityAction('active'), 'activated');
assert.strictEqual(resolveSubscriptionActivityAction('on_trial'), 'activated');
assert.strictEqual(resolveSubscriptionActivityAction('cancelled'), 'cancelled');
assert.strictEqual(resolveSubscriptionActivityAction('expired'), 'cancelled');
assert.strictEqual(resolveSubscriptionActivityAction('past_due'), 'cancelled');
assert.strictEqual(resolveSubscriptionActivityAction('active', { cancelAtPeriodEnd: true }), 'cancelled');
assert.strictEqual(resolveSubscriptionActivityAction('paid', { action: 'renewed' }), 'renewed');

assert.strictEqual(buildSubscriptionActivityTitle('pro', 'activated'), 'Subscription activated · pro');
assert.strictEqual(buildSubscriptionActivityTitle('pro', 'cancelled'), 'Subscription cancelled · pro');
assert.strictEqual(buildSubscriptionActivityTitle('pro', 'renewed'), 'Subscription renewed · pro');

console.log('admin-activity-service.test.js: all passed');
