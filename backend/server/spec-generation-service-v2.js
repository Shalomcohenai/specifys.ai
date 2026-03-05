/**
 * Spec generation service v2 — OpenAI Assistants API, persistent threads, structured outputs.
 * Replaces legacy Worker-based flow. All sections (overview, technical, market, design) use full structure.
 * @see docs/architecture/ARCHITECTURE_REFRESH.md
 */

const { logger } = require('./logger');
const specEvents = require('./spec-events');
const { getSpecThreadManager } = require('./spec-thread-manager');
const { STAGE_ROOT_KEYS, buildResponseFormat } = require('../schemas/spec-schemas');

const OVERVIEW_USER_PROMPT_PREFIX = `Return ONLY valid JSON (no text/markdown). Top-level key MUST be overview. All output must be in English.
Include: shortTitle (3-8 word display title for the spec), ideaSummary, problemStatement, targetAudience (object: ageRange, sector, interests, needs), valueProposition, coreFeaturesOverview (array of 6-8 features), userJourneySummary, detailedUserFlow.steps, screenDescriptions (screens array with name, description, uiComponents; navigationStructure), complexityScore (architecture, integrations, functionality, userSystem as numbers 0-100), suggestionsIdeaSummary and suggestionsCoreFeatures as { toInclude: [], notToInclude: [...] }.
Generate a comprehensive overview from the user input below. Every required key must contain substantive content.

User Input:
`;

class SpecGenerationServiceV2 {
  constructor() {
    this.threadManager = null;
  }

  _getThreadManager() {
    if (!this.threadManager) {
      const { db } = require('./firebase-admin');
      const openaiStorage = process.env.OPENAI_API_KEY
        ? new (require('./openai-storage-service'))(process.env.OPENAI_API_KEY)
        : null;
      if (!openaiStorage) throw new Error('OpenAI not configured');
      this.threadManager = getSpecThreadManager(openaiStorage, db);
    }
    return this.threadManager;
  }

  _buildTechnicalPrompt(specId, overviewContent, appDescription, workflow, additionalDetails, isReference) {
    const overviewSection = isReference
      ? `[SPEC_REFERENCE]\nSpec ID: ${specId}\nOverview Location: Firebase > specs collection > ${specId} > overview field\nNote: The system will retrieve the full overview content automatically.`
      : `Application Overview:\n${overviewContent}`;
    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be technical. Never omit required keys.
Create a comprehensive technical specification. Required keys (each with full content):
- techStack (object): frontend, backend, database, storage, authentication.
- architectureOverview (string): full paragraph (80+ chars).
- databaseSchema (object): description, tables (array of at least 2 tables: name, purpose, fields array, relationships).
- apiEndpoints (array): each with path, method, description, requestBody, responseBody.
- securityAuthentication (object): authentication, authorization, securityMeasures, securityCriticalPoints (array of 3-5 strings).
- integrationExternalApis (object): thirdPartyServices (array), integrations, dataFlow.
- devops, dataStorage, analytics, detailedDataModels, dataFlowDetailed (each with full sub-keys).

${overviewSection}

User Input:
App Description: ${appDescription}
User Workflow: ${workflow}
Additional Details: ${additionalDetails}`;
  }

  _buildMarketPrompt(specId, overviewContent, appDescription, workflow, additionalDetails, isReference) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const overviewSection = isReference
      ? `[SPEC_REFERENCE]\nSpec ID: ${specId}\nOverview in Firebase > specs > ${specId} > overview.`
      : `Application Overview:\n${overviewContent}`;
    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be market. Never omit required keys.
Create comprehensive market research. Required keys (each with full content):
- industryOverview (object): trends, marketData, growthProjections/growthPotential.
- targetAudienceInsights (object): demographics, needs, behaviors, etc.
- competitiveLandscape (array, at least 1 competitor with name, advantages, disadvantages, etc.).
- swotAnalysis (object): strengths, weaknesses, opportunities, threats (arrays).
- monetizationModel (object): pricingStrategy, revenueStreams, rationale.
- marketingStrategy (object): channels, messaging, goToMarket.

Current Date: ${currentDateStr}

${overviewSection}

User Input:
App Description: ${appDescription}
User Workflow: ${workflow}
Additional Details: ${additionalDetails}`;
  }

  _buildDesignPrompt(specId, overviewContent, appDescription, workflow, additionalDetails, isReference) {
    const overviewSection = isReference
      ? `[SPEC_REFERENCE]\nSpec ID: ${specId}\nOverview in Firebase > specs > ${specId} > overview.`
      : `Application Overview:\n${overviewContent}`;
    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be design. Never omit required keys.
Create comprehensive design specifications. Required keys (each with full content):
- visualStyleGuide (object): colors, typography, spacing, buttons, animations.
- logoIconography (object): logoConcepts, colorVersions, iconSet, appIcon.
- uiLayout (object): landingPage, dashboard, navigation, responsiveDesign.
- uxPrinciples (object): userFlow, accessibility, informationHierarchy.

${overviewSection}

User Input:
App Description: ${appDescription}
User Workflow: ${workflow}
Additional Details: ${additionalDetails}`;
  }

  _buildPrompt(stage, specId, overview, answers) {
    const appDescription = answers[0] || 'Not provided';
    const workflow = answers[1] || 'Not provided';
    const additionalDetails = answers[2] || 'Not provided';
    const hasOverview = overview && typeof overview === 'string' && overview.trim().length > 0;
    const overviewContent = hasOverview ? overview : null;
    const isReference = !overviewContent;
    if (stage === 'technical') return this._buildTechnicalPrompt(specId, overviewContent, appDescription, workflow, additionalDetails, isReference);
    if (stage === 'market') return this._buildMarketPrompt(specId, overviewContent, appDescription, workflow, additionalDetails, isReference);
    if (stage === 'design') return this._buildDesignPrompt(specId, overviewContent, appDescription, workflow, additionalDetails, isReference);
    return `Generate ${stage} specification.\nApp Description: ${appDescription}\nWorkflow: ${workflow}\nAdditional: ${additionalDetails}\n\nOverview:\n${overviewContent || ''}`;
  }

  /**
   * Generate overview for a spec (v2). Uses thread; stores thread_id on spec.
   * @param {string} specId - Spec ID
   * @param {string} userInput - User input / planning text
   * @returns {Promise<string>} Overview JSON string (full structure)
   */
  async generateOverview(specId, userInput) {
    const requestId = `v2-overview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    logger.info({ requestId, specId }, '[SpecGenV2] Starting overview generation');
    const tm = this._getThreadManager();
    const threadId = await tm.getOrCreateThread(specId);
    const userMessage = OVERVIEW_USER_PROMPT_PREFIX + (userInput || '');
    const payload = await tm.runStage(threadId, 'overview', userMessage);
    const rootKey = STAGE_ROOT_KEYS.overview;
    const overviewObj = payload[rootKey];
    const specification = JSON.stringify(overviewObj);
    logger.info({ requestId, specId, duration: `${Date.now() - startTime}ms` }, '[SpecGenV2] Overview completed');
    return specification;
  }

  /**
   * Generate one section (technical, market, design). Emits spec.update / spec.error.
   * @param {string} specId - Spec ID
   * @param {string} stage - technical | market | design
   * @param {string} overview - Overview content string
   * @param {Array} answers - [appDescription, workflow, additionalDetails]
   * @returns {Promise<string>} Section JSON string
   */
  async generateSection(specId, stage, overview, answers) {
    const requestId = `v2-${stage}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    logger.info({ requestId, specId, stage }, '[SpecGenV2] Starting section generation');
    specEvents.emitSpecUpdate(specId, stage, 'generating', null);
    const tm = this._getThreadManager();
    const threadId = await tm.getOrCreateThread(specId);
    const userMessage = this._buildPrompt(stage, specId, overview, answers);
    try {
      const payload = await tm.runStage(threadId, stage, userMessage);
      const rootKey = STAGE_ROOT_KEYS[stage];
      const content = JSON.stringify(payload[rootKey], null, 2);
      specEvents.emitSpecUpdate(specId, stage, 'ready', content);
      logger.info({ requestId, specId, stage, duration: `${Date.now() - startTime}ms` }, '[SpecGenV2] Section completed');
      return content;
    } catch (error) {
      const isSchemaError = /invalid_json_schema|json_schema|response_format|schema must/i.test(error.message);
      logger.error({
        requestId,
        specId,
        stage,
        error: error.message,
        // Log the exact schema we attempted to send when it looks like a schema error.
        ...(isSchemaError && { attemptedSchema: JSON.stringify(buildResponseFormat(stage), null, 2) })
      }, '[SpecGenV2] Section failed');
      specEvents.emitSpecError(specId, stage, error);
      throw error;
    }
  }

  /**
   * Generate all specs sequentially: technical → market → design → architecture. Emits spec.update / spec.complete / spec.error.
   * @param {string} specId - Spec ID
   * @param {string} overview - Overview content string
   * @param {Array} answers - User answers
   * @returns {Promise<object>} { technical, market, design, architecture, successes, errors }
   */
  async generateAllSpecs(specId, overview, answers) {
    const requestId = `v2-all-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    logger.info({ requestId, specId }, '[SpecGenV2] Starting generateAllSpecs');
    const processed = { technical: null, market: null, design: null, architecture: null, successes: [], errors: [] };
    const stages = ['technical', 'market', 'design'];

    for (const stage of stages) {
      specEvents.emitSpecUpdate(specId, stage, 'generating', null);
      try {
        const content = await this.generateSection(specId, stage, overview, answers);
        processed[stage] = content;
        processed.successes.push({ stage, content });
      } catch (err) {
        processed.errors.push({ stage, error: err, retryable: /timeout|network|ECONNREFUSED|ETIMEDOUT|AbortError/i.test(err.message) });
      }
    }

    if (processed.technical && processed.market && processed.design) {
      specEvents.emitSpecUpdate(specId, 'architecture', 'generating', null);
      try {
        const architecture = await this.generateArchitecture(specId, overview, processed.technical, processed.market, processed.design);
        processed.architecture = architecture;
        specEvents.emitSpecUpdate(specId, 'architecture', 'ready', architecture);
        processed.successes.push({ stage: 'architecture', content: architecture });
      } catch (err) {
        logger.error({ requestId, specId, error: err.message }, '[SpecGenV2] Architecture failed');
        specEvents.emitSpecError(specId, 'architecture', err);
        processed.errors.push({ stage: 'architecture', error: err, retryable: false });
      }
    }

    logger.info({ requestId, specId, duration: `${Date.now() - startTime}ms`, successes: processed.successes.length, errors: processed.errors.length }, '[SpecGenV2] generateAllSpecs completed');
    specEvents.emitSpecComplete(specId, processed);
    return processed;
  }

  /**
   * Generate architecture as structured JSON then serialize to Markdown for storage.
   * Uses assistant model (fallback: gpt-5.2, gpt-5-mini, gpt-5-nano, gpt-5) via runStage with ArchitectureSchema; prompt is opinionated and Mermaid-strict.
   * @param {string} specId - Spec ID
   * @param {string} overview - Overview content
   * @param {string} technical - Technical content
   * @param {string} market - Market content
   * @param {string} design - Design content
   * @returns {Promise<string>} Markdown string (for Firestore and frontend)
   */
  async generateArchitecture(specId, overview, technical, market, design) {
    const requestId = `v2-arch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    logger.info({ requestId, specId }, '[SpecGenV2] Starting architecture generation');

    const userPrompt = this._buildArchitecturePrompt(overview, technical, market, design);

    const tm = this._getThreadManager();
    const threadId = await tm.getOrCreateThread(specId);
    const parsed = await tm.runStage(threadId, 'architecture', userPrompt);
    const rootKey = STAGE_ROOT_KEYS.architecture;
    const payload = parsed[rootKey];
    const markdown = this._architecturePayloadToMarkdown(payload);

    logger.info({ requestId, specId, duration: `${Date.now() - startTime}ms` }, '[SpecGenV2] Architecture completed');
    return typeof markdown === 'string' ? markdown : String(markdown);
  }

  _buildArchitecturePrompt(overview, technical, market, design) {
    const overviewSlice = (overview || '').slice(0, 15000);
    const technicalSlice = (technical || '').slice(0, 20000);
    const marketSlice = (market || '').slice(0, 8000);
    const designSlice = (design || '').slice(0, 12000);

    return `You are an expert software architect. You are using a capable language model and must provide specific, non-generic technical advice with real depth. Do not give vague or template-like answers.

Return ONLY valid JSON. The top-level key MUST be "architecture". The JSON must match this structure exactly:

1. coreFunctionalityLogic: Array of the system's most critical functions (e.g. "Real-time sync engine", "Payment processing flow"). Each item has: name (string), description (string), technicalImplementation (string summary).

2. thirdPartyIntegrations: Array of external services. You MUST use the SAME integrations already mentioned in the Technical section (integrationExternalApis.thirdPartyServices and the integrations/dataFlow prose). For each integration use a stable id slug that matches that source (e.g. "Stripe" -> "stripe", "AWS S3" -> "aws-s3"). Each item has: id (string, slug), name (string or null), purpose (string), integrationMethod (string: one of "Webhooks", "SDK", "REST API"). Be OPINIONATED: recommend the best-practice integration method for the specific tech stack defined in the Technical stage (frontend, backend, database), not generic advice.

3. webPerformanceStrategy: For web apps define: cachingStrategy (e.g. CDN, cache headers), lazyLoadingStrategy, ssrSsgApproach (SSR vs SSG). Use null for any that do not apply. Strings only, no nested objects.

4. embeddedDiagrams: Two Mermaid diagram strings (use null if not applicable):
   - systemMapMermaid: A system/architecture map diagram.
   - sequenceDiagramThirdPartyMermaid: A SEQUENCE diagram showing a complex third-party integration flow (e.g. how the app talks to a Payment Gateway or Auth provider). This must be a sequenceDiagram, not a flowchart.

MERMAID RULES (strict):
- Use Mermaid 10–compatible syntax only.
- Do NOT wrap diagram code in markdown code fences in your JSON; the strings must be raw Mermaid only.
- No illegal characters in node or label text: avoid unescaped quotes or parentheses inside labels; use simple alphanumeric or hyphenated labels.
- sequenceDiagramThirdPartyMermaid must use "sequenceDiagram" and show at least two participants (e.g. App and Payment Gateway) with clear steps.

Input context:

## Overview
${overviewSlice}

## Technical (use this for tech stack and thirdPartyServices — match integration names and ids here)
${technicalSlice}

## Market
${marketSlice}

## Design
${designSlice}

Output: single JSON object with key "architecture" and the four sections above. No markdown, no explanation.`;
  }

  _architecturePayloadToMarkdown(payload) {
    if (!payload || typeof payload !== 'object') return '';

    const lines = [];

    if (Array.isArray(payload.coreFunctionalityLogic) && payload.coreFunctionalityLogic.length > 0) {
      lines.push('## Core functionality');
      lines.push('');
      payload.coreFunctionalityLogic.forEach((item, i) => {
        if (item && typeof item === 'object') {
          lines.push(`### ${i + 1}. ${item.name || 'Function'}`);
          lines.push('');
          if (item.description) lines.push(item.description + '\n');
          if (item.technicalImplementation) lines.push('**Implementation:** ' + item.technicalImplementation + '\n');
        }
      });
    }

    if (Array.isArray(payload.thirdPartyIntegrations) && payload.thirdPartyIntegrations.length > 0) {
      lines.push('## Third-party integrations');
      lines.push('');
      payload.thirdPartyIntegrations.forEach((item) => {
        if (item && typeof item === 'object') {
          const name = item.name || item.id || 'Integration';
          lines.push(`- **${name}** (id: \`${item.id}\`): ${item.purpose || ''} — *${item.integrationMethod || ''}*`);
        }
      });
      lines.push('');
    }

    if (payload.webPerformanceStrategy && typeof payload.webPerformanceStrategy === 'object') {
      const w = payload.webPerformanceStrategy;
      if (w.cachingStrategy || w.lazyLoadingStrategy || w.ssrSsgApproach) {
        lines.push('## Web performance strategy');
        lines.push('');
        if (w.cachingStrategy) lines.push('- **Caching:** ' + w.cachingStrategy);
        if (w.lazyLoadingStrategy) lines.push('- **Lazy loading:** ' + w.lazyLoadingStrategy);
        if (w.ssrSsgApproach) lines.push('- **SSR/SSG:** ' + w.ssrSsgApproach);
        lines.push('');
      }
    }

    if (payload.embeddedDiagrams && typeof payload.embeddedDiagrams === 'object') {
      const d = payload.embeddedDiagrams;
      if (d.systemMapMermaid && typeof d.systemMapMermaid === 'string' && d.systemMapMermaid.trim()) {
        lines.push('## System map');
        lines.push('');
        lines.push('```mermaid');
        lines.push(d.systemMapMermaid.trim());
        lines.push('```');
        lines.push('');
      }
      if (d.sequenceDiagramThirdPartyMermaid && typeof d.sequenceDiagramThirdPartyMermaid === 'string' && d.sequenceDiagramThirdPartyMermaid.trim()) {
        lines.push('## Third-party integration sequence');
        lines.push('');
        lines.push('```mermaid');
        lines.push(d.sequenceDiagramThirdPartyMermaid.trim());
        lines.push('```');
        lines.push('');
      }
    }

    return lines.join('\n').trim() || '';
  }
}

module.exports = new SpecGenerationServiceV2();
