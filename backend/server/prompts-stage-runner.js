/**
 * Server-side staged PRD prompt generation (10 development stages + integrations).
 */

const { logger } = require('./logger');
const {
  TOTAL_STAGES,
  buildStageUserMessage,
  assembleFullPrompt,
  buildIntegrationsPrompt
} = require('../../packages/spec-prompts/stages.cjs');

/**
 * Generate all PRD development stages sequentially via OpenAI structured output.
 * @param {import('./spec-thread-manager').SpecThreadManager} threadManager
 * @param {string} threadId
 * @param {{ overview: string, technical: string, design: string, specId?: string }} ctx
 * @returns {Promise<string[]>}
 */
async function runPromptStages(threadManager, threadId, { overview, technical, design, specId }) {
  const generatedStages = [];
  const previousStages = [];

  for (let stageNum = 1; stageNum <= TOTAL_STAGES; stageNum += 1) {
    try {
      const userMessage = buildStageUserMessage(
        stageNum,
        overview,
        technical,
        design,
        previousStages
      );
      const payload = await threadManager.runStage(threadId, 'prompt-stage', userMessage);
      const content = payload?.prompts?.fullPrompt;
      if (!content || typeof content !== 'string' || !content.trim()) {
        throw new Error(`Stage ${stageNum} returned empty fullPrompt`);
      }
      generatedStages.push(content);
      previousStages.push(content);
      logger.info({ specId, stageNum }, '[PromptStageRunner] Stage completed');
    } catch (err) {
      logger.warn({ specId, stageNum, error: err.message }, '[PromptStageRunner] Stage failed — continuing');
    }
  }

  return generatedStages;
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
  TOTAL_STAGES
};
