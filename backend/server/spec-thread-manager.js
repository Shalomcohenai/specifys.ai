/**
 * Manages OpenAI Assistants + spec generation for v2.
 * Generation uses Chat Completions (structured outputs) via OpenAIStorageService.runSpecGeneration — no Threads API polling,
 * so restricted keys without api.threads.read still work. Legacy specs may still have thread_id from older Assistants runs.
 * @see docs/architecture/ARCHITECTURE.md
 */

const admin = require('firebase-admin');
const { logger } = require('./logger');
const { buildResponseFormat, parseAndValidateStage } = require('../schemas/spec-schemas');

/** System instructions for spec JSON stages when not using OPENAI_SPEC_GENERATOR_ASSISTANT_ID. */
const SPEC_GENERATOR_INSTRUCTIONS =
  'You generate application specification sections (overview, technical, market, design, architecture, visibility, prompts). Return only valid JSON matching the structure requested in the user message. No markdown, no explanation.';

/** Strict mini-schema used by the diagram repair sub-call. Single string output. */
const MERMAID_REPAIR_RESPONSE_FORMAT = Object.freeze({
  type: 'json_schema',
  json_schema: {
    name: 'mermaid_repair',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        corrected: { type: 'string' }
      },
      required: ['corrected'],
      additionalProperties: false
    }
  }
});

const MERMAID_REPAIR_SYSTEM =
  'You fix broken Mermaid diagrams. You always return JSON of shape { "corrected": "<mermaid source>" } with no markdown fences or surrounding text. Preserve the original intent and connections; only repair syntax.';

class SpecThreadManager {
  constructor(openaiStorage, db) {
    this.openaiStorage = openaiStorage;
    this.db = db;
    /** @type {{ mode: 'assistant', assistantId: string } | { mode: 'direct', model: string, instructions: string } | null} */
    this._specGeneratorTarget = null;
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
   * Resolve how to run spec JSON stages: existing assistant (needs api.assistants.read) or direct Chat Completions
   * (needs only model access — set OPENAI_SPEC_GENERATION_MODEL, or defaults to gpt-4o-mini).
   * Never calls POST /assistants (avoids api.assistants.write on restricted keys).
   * @returns {Promise<{ mode: 'assistant', assistantId: string } | { mode: 'direct', model: string, instructions: string }>}
   */
  async resolveSpecGeneratorTarget() {
    if (this._specGeneratorTarget) return this._specGeneratorTarget;

    const envId = process.env.OPENAI_SPEC_GENERATOR_ASSISTANT_ID?.trim();
    if (envId) {
      this._specGeneratorTarget = { mode: 'assistant', assistantId: envId };
      logger.debug({ assistantId: envId }, '[SpecThreadManager] Using OPENAI_SPEC_GENERATOR_ASSISTANT_ID');
      return this._specGeneratorTarget;
    }

    const configuredModel = process.env.OPENAI_SPEC_GENERATION_MODEL?.trim();
    const model = configuredModel || 'gpt-4o-mini';
    this._specGeneratorTarget = {
      mode: 'direct',
      model,
      instructions: SPEC_GENERATOR_INSTRUCTIONS
    };
    if (!configuredModel) {
      logger.warn(
        { model },
        '[SpecThreadManager] OPENAI_SPEC_GENERATION_MODEL not set; using gpt-4o-mini. Set OPENAI_SPEC_GENERATION_MODEL or OPENAI_SPEC_GENERATOR_ASSISTANT_ID in production.'
      );
    } else {
      logger.info({ model }, '[SpecThreadManager] Using OPENAI_SPEC_GENERATION_MODEL (no Assistants API)');
    }
    return this._specGeneratorTarget;
  }

  /**
   * Run a structured stage (overview, technical, market, design, architecture, visibility, prompts). Uses strict JSON schema; returns parsed object.
   * Logs the exact response_format schema on any OpenAI or parse failure for easier debugging.
   * @param {string} threadId - OpenAI thread ID
   * @param {string} stage - overview | technical | market | design | architecture | visibility | prompts
   * @param {string} userMessage - Full user prompt for this stage
   * @returns {Promise<object>} Parsed payload with single root key (e.g. { overview: {...} })
   */
  async runStage(threadId, stage, userMessage) {
    const responseFormat = buildResponseFormat(stage);
    const target = await this.resolveSpecGeneratorTarget();

    let text;
    try {
      text = await this.openaiStorage.runSpecGeneration(threadId, target, userMessage, responseFormat);
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
   * Ask the model to repair a single broken Mermaid diagram. Used by
   * spec-generation-service-v2 after the main payload comes back, when our
   * heuristic validator catches problems mermaid.parse() would also reject.
   *
   * Uses a tiny strict response_format so we get a clean string back without
   * the model wrapping it in extra fields, and bypasses the assistant
   * instructions (which are tuned for full-spec JSON, not single-field repair).
   *
   * @param {string} brokenSource - Sanitized Mermaid source that still failed validation
   * @param {string[]} errors - Validator messages to feed back to the model
   * @param {string} diagramKind - e.g. "flowchart", "erDiagram", "sequenceDiagram" — directs the repair
   * @returns {Promise<string|null>} Repaired Mermaid source, or null on failure
   */
  async repairMermaidDiagram(brokenSource, errors, diagramKind) {
    const target = await this.resolveSpecGeneratorTarget();

    // Use a direct (chat-completions) target with our repair-tuned system prompt,
    // even when the main flow goes through an Assistant — the assistant's full
    // spec instructions would otherwise pollute this single-field call.
    const repairTarget =
      target.mode === 'direct'
        ? { ...target, instructions: MERMAID_REPAIR_SYSTEM }
        : { mode: 'direct', model: process.env.OPENAI_SPEC_GENERATION_MODEL?.trim() || 'gpt-4o-mini', instructions: MERMAID_REPAIR_SYSTEM };

    const userMessage = `Fix the following Mermaid diagram so it parses cleanly with Mermaid 10.

Validator errors detected:
${errors.map((e) => `- ${e}`).join('\n')}

Diagram intent: ${diagramKind || 'flowchart'}.

Strict rules for the corrected diagram:
- Start with a valid directive (flowchart TD/LR, graph TD/LR, erDiagram, sequenceDiagram, classDiagram, stateDiagram-v2, mindmap, pie, gantt, journey).
- Use only ASCII alphanumerics and underscore for node IDs (no spaces, dots, hyphens, parentheses, emojis).
- For labels with spaces/punctuation, wrap them in quotes: A["Login Page"] -- not A[Login Page].
- No markdown code fences inside the diagram.
- No HTML other than <br> in labels; no smart quotes; no emoji.
- Preserve the original connections and entities; only fix syntax.
- For erDiagram, keep cardinality tokens like ||--o{ exactly as-is.

Return ONLY JSON: { "corrected": "<mermaid source>" }.

ORIGINAL DIAGRAM:
${brokenSource}`;

    let text;
    try {
      text = await this.openaiStorage.runSpecGeneration(
        'chat-completions',
        repairTarget,
        userMessage,
        MERMAID_REPAIR_RESPONSE_FORMAT
      );
    } catch (err) {
      logger.warn({ err: err.message, diagramKind }, '[SpecThreadManager] Mermaid repair call failed');
      return null;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch (e2) {
        logger.warn({ diagramKind, sample: text.slice(0, 200) }, '[SpecThreadManager] Mermaid repair returned non-JSON');
        return null;
      }
    }

    if (!parsed || typeof parsed.corrected !== 'string') return null;
    return parsed.corrected;
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
