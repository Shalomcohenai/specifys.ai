/**
 * Manages OpenAI Threads per spec for v2 generation.
 * One thread per spec; getOrCreateThread ensures continuity across overview → technical → market → design → architecture.
 * @see docs/architecture/ARCHITECTURE_REFRESH.md
 */

const admin = require('firebase-admin');
const { logger } = require('./logger');
const { buildResponseFormat, parseAndValidateStage } = require('../schemas/spec-schemas');

const ASSISTANTS_V2_HEADER = 'assistants=v2';

class SpecThreadManager {
  constructor(openaiStorage, db) {
    this.openaiStorage = openaiStorage;
    this.db = db;
    this._generatorAssistantId = null;
    this._architectureAssistantId = null;
  }

  /**
   * Get or create OpenAI thread for this spec. Persists thread_id in Firestore.
   *
   * Handles two failure modes:
   * 1. Race condition — spec document not yet committed when background job starts.
   *    We retry up to 3 times with exponential back-off before giving up.
   * 2. Spec deleted mid-flight — between the initial get() and the update() call
   *    the document may be deleted. We catch NOT_FOUND (Firestore code 5) and
   *    raise a clear error instead of letting the raw Firestore error bubble up.
   *
   * @param {string} specId - Spec document ID
   * @returns {Promise<string>} thread_id
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
      logger.debug({ specId, threadId: existing }, '[SpecThreadManager] Using existing thread');
      return existing;
    }

    const thread = await this.openaiStorage.createThread();
    const threadId = thread.id;

    try {
      await ref.update({ thread_id: threadId, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      logger.info({ specId, threadId }, '[SpecThreadManager] Created and stored new thread');
    } catch (updateErr) {
      // Firestore gRPC code 5 = NOT_FOUND — the spec was deleted between our get() and update().
      const isNotFound = updateErr.code === 5 || String(updateErr.message).includes('NOT_FOUND');
      if (isNotFound) {
        logger.warn({ specId, threadId }, '[SpecThreadManager] Spec deleted during thread creation — aborting generation');
        throw new Error(`Spec was deleted during generation setup: ${specId}`);
      }
      throw updateErr;
    }

    return threadId;
  }

  /**
   * Ensure spec generator assistant (gpt-4o) exists. Uses env OPENAI_SPEC_GENERATOR_ASSISTANT_ID or creates one.
   * @returns {Promise<string>} assistant_id
   */
  async getGeneratorAssistantId() {
    if (this._generatorAssistantId) return this._generatorAssistantId;
    const envId = process.env.OPENAI_SPEC_GENERATOR_ASSISTANT_ID;
    if (envId && envId.trim()) {
      this._generatorAssistantId = envId.trim();
      return this._generatorAssistantId;
    }
    const id = await this._createAssistant('gpt-4o', 'You generate application specification sections (overview, technical, market, design). Return only valid JSON matching the structure requested in the user message. No markdown, no explanation.');
    this._generatorAssistantId = id;
    logger.info({ assistantId: id }, '[SpecThreadManager] Created spec generator assistant (gpt-4o). Set OPENAI_SPEC_GENERATOR_ASSISTANT_ID to reuse.');
    return id;
  }

  /**
   * Ensure architecture assistant (o1) exists. Uses env OPENAI_SPEC_ARCHITECTURE_ASSISTANT_ID or creates one.
   * @returns {Promise<string>} assistant_id
   */
  async getArchitectureAssistantId() {
    if (this._architectureAssistantId) return this._architectureAssistantId;
    const envId = process.env.OPENAI_SPEC_ARCHITECTURE_ASSISTANT_ID;
    if (envId && envId.trim()) {
      this._architectureAssistantId = envId.trim();
      return this._architectureAssistantId;
    }
    const id = await this._createAssistant('o1-preview', 'You are a software architect. Produce a single Markdown document with exactly 7 sections as specified in the user message. Use Mermaid code blocks where helpful. Output only valid Markdown.');
    this._architectureAssistantId = id;
    logger.info({ assistantId: id }, '[SpecThreadManager] Created architecture assistant (o1-preview). Set OPENAI_SPEC_ARCHITECTURE_ASSISTANT_ID to reuse.');
    return id;
  }

  async _createAssistant(model, instructions) {
    const baseURL = this.openaiStorage.baseURL || 'https://api.openai.com/v1';
    const apiKey = this.openaiStorage.apiKey;
    if (!apiKey) throw new Error('OpenAI API key not configured');
    const fetchFn = await this.openaiStorage.getFetch();
    const res = await fetchFn(`${baseURL}/assistants`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': ASSISTANTS_V2_HEADER
      },
      body: JSON.stringify({
        name: `Spec ${model === 'o1-preview' ? 'Architecture' : 'Generator'} - ${model}`,
        model,
        instructions,
        tools: []
      })
    });
    if (!res.ok) throw new Error(`Failed to create assistant: ${await res.text()}`);
    const body = await res.json();
    return body.id;
  }

  /**
   * Run a structured stage (overview, technical, market, design). Uses strict JSON schema; returns parsed object.
   * Logs the exact response_format schema on any OpenAI or parse failure for easier debugging.
   * @param {string} threadId - OpenAI thread ID
   * @param {string} stage - overview | technical | market | design
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

  /**
   * Run architecture stage (o1, Markdown). No response_format.
   * @param {string} threadId - OpenAI thread ID
   * @param {string} userMessage - Full user prompt for architecture
   * @returns {Promise<string>} Markdown string
   */
  async runArchitecture(threadId, userMessage) {
    const assistantId = await this.getArchitectureAssistantId();
    return this.openaiStorage.runSpecGeneration(threadId, assistantId, userMessage, null);
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
