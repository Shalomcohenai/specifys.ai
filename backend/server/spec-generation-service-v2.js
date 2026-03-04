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
Include: ideaSummary, problemStatement, targetAudience (object: ageRange, sector, interests, needs), valueProposition, coreFeaturesOverview (array of 6-8 features), userJourneySummary, detailedUserFlow.steps, screenDescriptions (screens array with name, description, uiComponents; navigationStructure), complexityScore (architecture, integrations, functionality, userSystem as numbers 0-100), suggestionsIdeaSummary and suggestionsCoreFeatures as { toInclude: [], notToInclude: [...] }.
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
   * Generate architecture Markdown from overview + technical + market + design. Uses o1 and full thread context.
   * @param {string} specId - Spec ID
   * @param {string} overview - Overview content
   * @param {string} technical - Technical content
   * @param {string} market - Market content
   * @param {string} design - Design content
   * @returns {Promise<string>} Markdown string
   */
  async generateArchitecture(specId, overview, technical, market, design) {
    const requestId = `v2-arch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    logger.info({ requestId, specId }, '[SpecGenV2] Starting architecture generation');
    const structure = `
Your output MUST be a single Markdown document with exactly these 7 sections (use these exact headings):

## 1. System Overview & Tech Stack
Core Technologies, Infrastructure, Third-Party Integrations, Architecture Pattern.

## 2. File & Directory Structure
Tree Diagram (Mermaid if helpful), Naming Conventions, Module Responsibility.

## 3. Data Schema & Models
Entities, Field Definitions, Relationships, Indexing.

## 4. Key Logic Flows
User Journeys, Data Lifecycle, Error Handling.

## 5. API & Function Definitions
REST Endpoints, Core Utility Functions, Frontend Hooks/Services.

## 6. UI & Page Architecture
Sitemap, Component Hierarchy, Design Tokens.

## 7. Security & Constraints
Authentication & Authorization, Environment Variables, Performance Constraints.

Use \`\`\`mermaid ... \`\`\` blocks where helpful. Return ONLY the Markdown.`;

    const userPrompt = `Combine the following specification sections into one architecture document. Follow the exact 7-section structure below.

## Overview
${(overview || '').slice(0, 15000)}

## Technical
${(technical || '').slice(0, 20000)}

## Market
${(market || '').slice(0, 8000)}

## Design
${(design || '').slice(0, 12000)}

---
REQUIRED OUTPUT STRUCTURE:
${structure}`;

    const tm = this._getThreadManager();
    const threadId = await tm.getOrCreateThread(specId);
    const markdown = await tm.runArchitecture(threadId, userPrompt);
    logger.info({ requestId, specId, duration: `${Date.now() - startTime}ms` }, '[SpecGenV2] Architecture completed');
    return typeof markdown === 'string' ? markdown : String(markdown);
  }
}

module.exports = new SpecGenerationServiceV2();
