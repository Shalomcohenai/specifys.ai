/**
 * Manages OpenAI Assistants + spec generation for v2.
 * Generation uses Chat Completions (structured outputs) via OpenAIStorageService.runSpecGeneration — no Threads API polling,
 * so restricted keys without api.threads.read still work. Legacy specs may still have thread_id from older Assistants runs.
 * @see docs/architecture/ARCHITECTURE_REFRESH.md
 */

const admin = require('firebase-admin');
const { logger } = require('./logger');
const { buildResponseFormat, parseAndValidateStage } = require('../schemas/spec-schemas');

const ASSISTANTS_V2_HEADER = 'assistants=v2';

/** Model fallback order for creating assistants (first success wins). Older models (4, 3.5) last. */
const ASSISTANT_MODEL_FALLBACKS = [
  'gpt-5.2', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5',
  'gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-4',
  'gpt-3.5-turbo'
];

class SpecThreadManager {
  constructor(openaiStorage, db) {
    this.openaiStorage = openaiStorage;
    this.db = db;
    this._generatorAssistantId = null;
    this._architectureAssistantId = null;
  }

  /**
   * Resolve correlation id for v2 generation. Does not create OpenAI threads (generation is chat-completions-based).
   * If Firestore already has thread_id from a legacy flow, returns it for logging/UI compatibility.
   *
   * Handles two failure modes:
   * 1. Race condition — spec document not yet committed when background job starts.
   *    We retry up to 3 times with exponential back-off before giving up.
   * 2. Spec deleted mid-flight — between the initial get() and the update() call
   *    the document may be deleted. We catch NOT_FOUND (Firestore code 5) and
   *    raise a clear error instead of letting the raw Firestore error bubble up.
   *
   * @param {string} specId - Spec document ID
   * @returns {Promise<string>} Placeholder or legacy thread_id
   */
  async getOrCreateThread(specId) {
    const ref = this.db.collection('specs').doc(specId);

    // Retry loop handles the race condition where Firestore hasn't committed
    // the new spec document by the time the background generation job runs.
    let doc;
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      doc = await ref.get();
      if (doc.exists) break;
      if (attempt < maxAttempts) {
        const delay = attempt * 800; // 800 ms, 1600 ms
        logger.warn({ specId, attempt, delay }, '[SpecThreadManager] Spec doc not found yet — retrying after delay');
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (!doc.exists) {
      throw new Error(`Spec document not found after ${maxAttempts} attempts: ${specId}. Ensure the document is fully committed to Firestore before calling generate-overview or generate-all.`);
    }

    const data = doc.data();
    const existing = data?.thread_id && typeof data.thread_id === 'string' ? data.thread_id.trim() : null;
    if (existing) {
      logger.debug({ specId, threadId: existing }, '[SpecThreadManager] Using stored thread_id (legacy)');
      return existing;
    }

    logger.info({ specId }, '[SpecThreadManager] v2 uses Chat Completions — no OpenAI thread created or stored');
    return 'chat-completions';
  }

  /**
   * Ensure spec generator assistant exists. Uses env OPENAI_SPEC_GENERATOR_ASSISTANT_ID or creates one.
   * Model: first from ASSISTANT_MODEL_FALLBACKS that succeeds (gpt-5.2, gpt-5-mini, gpt-5-nano, gpt-5).
   * @returns {Promise<string>} assistant_id
   */
  async getGeneratorAssistantId() {
    if (this._generatorAssistantId) return this._generatorAssistantId;
    const envId = process.env.OPENAI_SPEC_GENERATOR_ASSISTANT_ID;
    if (envId && envId.trim()) {
      this._generatorAssistantId = envId.trim();
      return this._generatorAssistantId;
    }
    const { id, model } = await this._createAssistant('You generate application specification sections (overview, technical, market, design). Return only valid JSON matching the structure requested in the user message. No markdown, no explanation.', 'generator');
    this._generatorAssistantId = id;
    logger.info({ assistantId: id, model }, '[SpecThreadManager] Created spec generator assistant. Set OPENAI_SPEC_GENERATOR_ASSISTANT_ID to reuse.');
    return id;
  }

  /**
   * Ensure architecture assistant exists. Uses env OPENAI_SPEC_ARCHITECTURE_ASSISTANT_ID or creates one.
   * Model: first from ASSISTANT_MODEL_FALLBACKS that succeeds.
   * @returns {Promise<string>} assistant_id
   */
  async getArchitectureAssistantId() {
    if (this._architectureAssistantId) return this._architectureAssistantId;
    const envId = process.env.OPENAI_SPEC_ARCHITECTURE_ASSISTANT_ID;
    if (envId && envId.trim()) {
      this._architectureAssistantId = envId.trim();
      return this._architectureAssistantId;
    }
    const { id, model } = await this._createAssistant('You are a software architect. Produce a single Markdown document with exactly 7 sections as specified in the user message. Use Mermaid code blocks where helpful. Output only valid Markdown.', 'architecture');
    this._architectureAssistantId = id;
    logger.info({ assistantId: id, model }, '[SpecThreadManager] Created architecture assistant. Set OPENAI_SPEC_ARCHITECTURE_ASSISTANT_ID to reuse.');
    return id;
  }

  /**
   * Create an assistant using the first model from ASSISTANT_MODEL_FALLBACKS that succeeds.
   * @param {string} instructions - Assistant instructions
   * @param {'generator'|'architecture'} assistantType - For naming
   * @returns {Promise<{id: string, model: string}>}
   */
  async _createAssistant(instructions, assistantType = 'generator') {
    const baseURL = this.openaiStorage.baseURL || 'https://api.openai.com/v1';
    const apiKey = this.openaiStorage.apiKey;
    if (!apiKey) throw new Error('OpenAI API key not configured');
    const fetchFn = await this.openaiStorage.getFetch();
    const namePrefix = assistantType === 'architecture' ? 'Architecture' : 'Generator';
    let lastError = null;
    for (const model of ASSISTANT_MODEL_FALLBACKS) {
      const res = await fetchFn(`${baseURL}/assistants`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': ASSISTANTS_V2_HEADER
        },
        body: JSON.stringify({
          name: `Spec ${namePrefix} - ${model}`,
          model,
          instructions,
          tools: []
        })
      });
      const text = await res.text();
      if (res.ok) {
        const body = JSON.parse(text);
        return { id: body.id, model };
      }
      let code;
      try {
        const errBody = JSON.parse(text);
        code = errBody?.error?.code;
      } catch (_) {}
      if (code === 'unsupported_model' || code === 'model_not_found') {
        lastError = new Error(`Failed to create assistant: ${text}`);
        logger.warn({ model, code }, '[SpecThreadManager] Model not available, trying next fallback');
        continue;
      }
      throw new Error(`Failed to create assistant: ${text}`);
    }
    throw lastError || new Error('Failed to create assistant: no model succeeded');
  }

  /**
   * Run a structured stage (overview, technical, market, design, architecture). Uses strict JSON schema; returns parsed object.
   * Logs the exact response_format schema on any OpenAI or parse failure for easier debugging.
   * @param {string} threadId - OpenAI thread ID
   * @param {string} stage - overview | technical | market | design | architecture
   * @param {string} userMessage - Full user prompt for this stage
   * @returns {Promise<object>} Parsed payload with single root key (e.g. { overview: {...} })
   */
  async runStage(threadId, stage, userMessage) {
    const responseFormat = buildResponseFormat(stage);
    const assistantId = await this.getGeneratorAssistantId();

    let text;
    try {
      text = await this.openaiStorage.runSpecGeneration(threadId, assistantId, userMessage, responseFormat);
    } catch (err) {
      logger.error({
        stage,
        threadId,
        error: err.message,
        sentSchema: JSON.stringify(responseFormat, null, 2)
      }, '[SpecThreadManager] OpenAI run failed — schema sent above');
      throw err;
    }

    let raw;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      try {
        raw = JSON.parse(cleaned);
      } catch (e2) {
        logger.error({ stage, threadId, rawResponse: text.slice(0, 500) }, '[SpecThreadManager] Failed to parse JSON response');
        throw new Error(`Failed to parse JSON response for stage "${stage}": ${e2.message}`);
      }
    }

    try {
      return parseAndValidateStage(stage, raw);
    } catch (validationErr) {
      logger.error({
        stage,
        threadId,
        validationError: validationErr.message,
        receivedKeys: Object.keys(raw || {})
      }, '[SpecThreadManager] Zod validation failed on OpenAI response');
      throw validationErr;
    }
  }
}

let singleton = null;

/**
 * @param {object} openaiStorage - OpenAIStorageService instance
 * @param {object} db - Firestore instance (admin.firestore())
 * @returns {SpecThreadManager}
 */
function getSpecThreadManager(openaiStorage, db) {
  if (!singleton) singleton = new SpecThreadManager(openaiStorage, db);
  return singleton;
}

module.exports = {
  SpecThreadManager,
  getSpecThreadManager
};
