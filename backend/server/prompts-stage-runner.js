/**
 * Server-side staged PRD prompt generation (10 development stages + integrations).
 */

const { logger } = require('./logger');
const { mapWithConcurrency } = require('./async-pool');
const {
  TOTAL_STAGES,
  buildStageUserMessage,
  assembleFullPrompt,
  buildIntegrationsPrompt
} = require('../../packages/spec-prompts/stages.cjs');

/** Four in flight stays under typical Luna rate limits while cutting the 10-deep chain. */
const PROMPT_STAGE_CONCURRENCY = 4;

/**
 * Generate all PRD development stages concurrently via OpenAI structured output.
 * Stage order in the returned list matches stage numbers, not completion order.
 * Each item is `{ stageNumber, content }` so assembly keeps the real stage header
 * when one stage fails.
 * @param {import('./spec-thread-manager').SpecThreadManager} threadManager
 * @param {string} threadId
 * @param {{ overview: string, technical: string, design: string, specId?: string, concurrency?: number }} ctx
 * @returns {Promise<Array<{ stageNumber: number, content: string }>>}
 */
async function runPromptStages(threadManager, threadId, { overview, technical, design, specId, concurrency }) {
  const stageNumbers = Array.from({ length: TOTAL_STAGES }, (_, i) => i + 1);
  const limit = Math.max(1, concurrency || PROMPT_STAGE_CONCURRENCY);
  const settled = await mapWithConcurrency(stageNumbers, limit, async (stageNum) => {
    const started = Date.now();
    try {
      const userMessage = buildStageUserMessage(stageNum, overview, technical, design, []);
      const payload = await threadManager.runStage(threadId, 'prompt-stage', userMessage);
      const content = payload?.prompts?.fullPrompt;
      if (!content || typeof content !== 'string' || !content.trim()) {
        throw new Error(`Stage ${stageNum} returned empty fullPrompt`);
      }
      logger.info({ specId, stageNum, durationMs: Date.now() - started }, '[PromptStageRunner] Stage completed');
      return { stageNumber: stageNum, content };
    } catch (err) {
      logger.warn(
        { specId, stageNum, error: err.message, durationMs: Date.now() - started },
        '[PromptStageRunner] Stage failed — continuing'
      );
      return null;
    }
  });

  return settled.filter(Boolean);
}

/**
 * @param {import('./spec-thread-manager').SpecThreadManager} threadManager
 * @param {string} threadId
 * @param {string} overview
 * @param {string} technical
 * @returns {Promise<Array<{ service: string, description: string, instructions: string[] }>>}
 */
async function runIntegrations(threadManager, threadId, overview, technical) {
  try {
    const userMessage = buildIntegrationsPrompt(overview, technical);
    const payload = await threadManager.runStage(threadId, 'prompt-integrations', userMessage);
    const list = payload?.thirdPartyIntegrations;
    return Array.isArray(list) ? list : [];
  } catch (err) {
    logger.warn({ error: err.message }, '[PromptStageRunner] Integrations generation failed');
    return [];
  }
}

module.exports = {
  runPromptStages,
  runIntegrations,
  assembleFullPrompt,
  TOTAL_STAGES,
  PROMPT_STAGE_CONCURRENCY
};
