/**
 * Per-stage Chat Completions limits for spec generation.
 * Model id stays gpt-5.6-luna (or OPENAI_SPEC_GENERATION_MODEL). These options
 * only cap output and, for template-filling stages, lower reasoning effort.
 *
 * gpt-5.6-luna defaults reasoning_effort to "medium", and max_completion_tokens
 * includes reasoning tokens. Prompt tickets and Mermaid repair do not need that
 * default. "minimal" is rejected with 400 on this model, so it is never sent.
 */

const DEFAULT_MAX_COMPLETION_TOKENS = 16384;
const DEFAULT_TIMEOUT_MS = 180000;

const STAGE_CALL_OPTIONS = Object.freeze({
  overview: { maxCompletionTokens: 16384, timeoutMs: 180000 },
  technical: { maxCompletionTokens: 16384, timeoutMs: 180000 },
  market: { maxCompletionTokens: 16384, timeoutMs: 180000 },
  design: { maxCompletionTokens: 16384, timeoutMs: 180000 },
  architecture: { maxCompletionTokens: 16384, timeoutMs: 180000 },
  visibility: { maxCompletionTokens: 16384, timeoutMs: 180000 },
  prompts: { maxCompletionTokens: 16384, timeoutMs: 180000 },
  'prompt-stage': { maxCompletionTokens: 8192, reasoningEffort: 'low', timeoutMs: 120000 },
  'prompt-integrations': { maxCompletionTokens: 4096, reasoningEffort: 'low', timeoutMs: 120000 },
  'mermaid-repair': { maxCompletionTokens: 4096, reasoningEffort: 'low', timeoutMs: 90000 }
});

function getStageCallOptions(stage) {
  return STAGE_CALL_OPTIONS[stage] || {
    maxCompletionTokens: DEFAULT_MAX_COMPLETION_TOKENS,
    timeoutMs: DEFAULT_TIMEOUT_MS
  };
}

/**
 * gpt-5 / o-series (including gpt-5.6-luna) use max_completion_tokens.
 * Older chat models keep max_tokens. reasoning_effort is only attached for
 * the completion-token models, and only when the stage asked for a supported value.
 * @param {object} body
 * @param {string} model
 * @param {{ maxCompletionTokens?: number, reasoningEffort?: string }} [callOptions]
 */
function applySpecCompletionLimits(body, model, callOptions = {}) {
  const m = String(model || '').toLowerCase();
  const usesCompletionTokens = /^o[0-9]/.test(m) || /^gpt-5/.test(m);
  const maxTokens = callOptions.maxCompletionTokens || DEFAULT_MAX_COMPLETION_TOKENS;
  if (usesCompletionTokens) {
    body.max_completion_tokens = maxTokens;
    const effort = callOptions.reasoningEffort;
    if (effort && effort !== 'minimal') {
      body.reasoning_effort = effort;
    }
  } else {
    body.max_tokens = maxTokens;
  }
  return body;
}

module.exports = {
  DEFAULT_MAX_COMPLETION_TOKENS,
  DEFAULT_TIMEOUT_MS,
  STAGE_CALL_OPTIONS,
  getStageCallOptions,
  applySpecCompletionLimits
};
