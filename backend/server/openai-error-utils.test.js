/**
 * Unit tests for OpenAI error classification (quota/auth messaging).
 * Run: node backend/server/openai-error-utils.test.js
 */
const assert = require('assert');
const { classifyOpenAIError, formatOpenAIErrorForLogs } = require('./openai-error-utils');

const quotaBlob = `Chat completions failed: {
    "error": {
        "message": "You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.",
        "type": "insufficient_quota",
        "param": null,
        "code": "credit_balance_exhausted"
    }
}`;

const q = classifyOpenAIError(quotaBlob);
assert.strictEqual(q.code, 'openai_quota_exhausted');
assert.ok(q.isQuota);
assert.ok(/credits are exhausted/i.test(q.userMessage));

const formatted = formatOpenAIErrorForLogs(new Error(quotaBlob));
assert.ok(/credits are exhausted/i.test(formatted));
assert.ok(!/credit_balance_exhausted/.test(formatted) || /code=openai_quota_exhausted/.test(formatted));

const scope = classifyOpenAIError('Missing scopes: model.request');
assert.strictEqual(scope.code, 'openai_missing_scope');

const unknown = classifyOpenAIError('random boom');
assert.strictEqual(unknown.code, null);
assert.strictEqual(unknown.userMessage, null);

console.log('openai-error-utils.test.js: all passed');
