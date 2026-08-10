/**
 * Classify OpenAI API failures into stable codes + safe user-facing messages.
 * Keeps raw provider payloads out of the UI while still guiding operators.
 */

/**
 * @param {unknown} errOrText
 * @returns {{ code: string|null, userMessage: string|null, isQuota: boolean, isAuth: boolean }}
 */
function classifyOpenAIError(errOrText) {
  const raw =
    typeof errOrText === 'string'
      ? errOrText
      : errOrText?.message
        ? String(errOrText.message)
        : errOrText
          ? String(errOrText)
          : '';

  let providerCode = null;
  let providerType = null;
  let providerMessage = '';
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      providerCode = parsed?.error?.code || null;
      providerType = parsed?.error?.type || null;
      providerMessage = parsed?.error?.message || '';
    }
  } catch (_) {
    // ignore parse failures — fall through to string heuristics
  }

  const blob = `${raw}\n${providerMessage}\n${providerCode || ''}\n${providerType || ''}`.toLowerCase();

  if (
    providerCode === 'credit_balance_exhausted' ||
    providerType === 'insufficient_quota' ||
    /credit_balance_exhausted|insufficient_quota|no credits remaining|billing_hard_limit/i.test(blob)
  ) {
    return {
      code: 'openai_quota_exhausted',
      userMessage:
        'OpenAI API credits are exhausted. Add billing credits at platform.openai.com, then retry overview generation.',
      isQuota: true,
      isAuth: false
    };
  }

  if (
    providerCode === 'invalid_api_key' ||
    /invalid.?api.?key|incorrect api key|unauthorized/i.test(blob)
  ) {
    return {
      code: 'openai_auth',
      userMessage: 'OpenAI API key is invalid or unauthorized. Check OPENAI_API_KEY / OPENAI_SPEC_API_KEY on the server.',
      isQuota: false,
      isAuth: true
    };
  }

  if (/missing_scope|model\.request/i.test(blob)) {
    return {
      code: 'openai_missing_scope',
      userMessage:
        'OpenAI API key is missing model.request permission. Enable it on the key or set OPENAI_SPEC_API_KEY.',
      isQuota: false,
      isAuth: true
    };
  }

  if (/rate.?limit|429/.test(blob) && /openai|chat completions failed/i.test(blob)) {
    return {
      code: 'openai_rate_limit',
      userMessage: 'OpenAI rate limit hit. Wait a moment and retry overview generation.',
      isQuota: false,
      isAuth: false
    };
  }

  return { code: null, userMessage: null, isQuota: false, isAuth: false };
}

/**
 * Prefer a short operator/user message over the raw OpenAI JSON blob.
 * @param {Error|string} error
 * @returns {string}
 */
function formatOpenAIErrorForLogs(error) {
  const classified = classifyOpenAIError(error);
  const raw = typeof error === 'string' ? error : error?.message || String(error || 'Unknown error');
  if (classified.userMessage) {
    return `${classified.userMessage} (code=${classified.code})`;
  }
  return raw.length > 500 ? `${raw.slice(0, 500)}…` : raw;
}

module.exports = {
  classifyOpenAIError,
  formatOpenAIErrorForLogs
};
