const { logger } = require('./logger');
const specEvents = require('./spec-events');

/**
 * Service for generating spec sections (Technical, Market, Design)
 * Handles parallel generation with error recovery
 */
class SpecGenerationService {
  constructor() {
    this.workerUrl = 'https://spspec.shalom-cohen-111.workers.dev/generate';
    this.timeout = 120000; // 2 minutes
  }

  /**
   * Generate a single spec section
   * @param {string} specId - Spec ID
   * @param {string} stage - Stage name (technical, market, design)
   * @param {string} overview - Overview content
   * @param {Array} answers - User answers
   * @returns {Promise<string>} Generated content
   */
  async generateSection(specId, stage, overview, answers) {
    const requestId = `generate-${stage}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    logger.info({ requestId, specId, stage }, `[SpecGeneration] Starting ${stage} generation`);

    const requestBody = {
      stage: stage,
      locale: 'en-US',
      temperature: 0,
      prompt: {
        system: this.getSystemPrompt(stage),
        developer: this.getDeveloperPrompt(stage),
        user: this.buildPrompt(stage, specId, overview, answers)
      }
    };

    const doOneAttempt = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      try {
        const response = await fetch(this.workerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          const errorText = await response.text();
          const err = new Error(`API Error: ${response.status} - ${errorText}`);
          try {
            const body = JSON.parse(errorText);
            const apiError = body?.error || body;
            if (apiError?.code) err.code = apiError.code;
            if (Array.isArray(apiError?.issues)) err.issues = apiError.issues;
          } catch (_) { /* keep message only */ }
          err.statusCode = response.status;
          throw err;
        }
        const responseText = await response.text();
        const data = JSON.parse(responseText);
        return data[stage] ? JSON.stringify(data[stage], null, 2) : `No ${stage} specification generated`;
      } catch (e) {
        clearTimeout(timeoutId);
        throw e;
      }
    };

    let lastError;
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        if (attempt === 1) {
          logger.info({ requestId, specId, stage }, '[SpecGeneration] Retrying once after 422');
          await new Promise(r => setTimeout(r, 4000));
        }
        const result = await doOneAttempt();
        const duration = Date.now() - startTime;
        logger.info({ requestId, specId, stage, duration: `${duration}ms` }, `[SpecGeneration] ${stage} generation completed`);
        specEvents.emitSpecUpdate(specId, stage, 'ready', result);
        return result;
      } catch (error) {
        lastError = error;
        const is422 = error.statusCode === 422 || error.code === 'INVALID_MODEL_OUTPUT' || (error.message && error.message.includes('422'));
        if (attempt === 0 && is422) continue;
        break;
      }
    }

    const duration = Date.now() - startTime;
    logger.error({
      requestId,
      specId,
      stage,
      error: { message: lastError.message, stack: lastError.stack, name: lastError.name },
      duration: `${duration}ms`
    }, `[SpecGeneration] ${stage} generation failed`);
    specEvents.emitSpecError(specId, stage, lastError);
    throw lastError;
  }

  /**
   * Generate overview spec
   * @param {string} userInput - User input/prompt
   * @returns {Promise<string>} Generated overview content
   */
  async generateOverview(userInput) {
    const requestId = `generate-overview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    logger.info({ requestId }, '[SpecGeneration] Starting overview generation');

    try {
      const requestBody = {
        stage: 'overview',
        locale: 'en-US',
        prompt: {
          system: 'You are an expert application specification generator. Generate detailed, comprehensive specifications based on user requirements.',
          developer: 'Return ONLY valid JSON (no text/markdown). Top-level key MUST be overview. Follow the exact structure specified in the user prompt.',
          user: userInput
        }
      };

      // Call Cloudflare Worker
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(this.workerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const responseText = await response.text();
        const data = JSON.parse(responseText);

        // Cloudflare Worker returns { overview: {...}, meta: {...} } format
        let overviewObj = data.overview || (data.specification ? (typeof data.specification === 'string' ? JSON.parse(data.specification) : data.specification) : data);
        // Normalize suggestions: support array from Worker -> { toInclude: [], notToInclude: [...] }
        overviewObj = this.normalizeOverviewSuggestions(overviewObj);
        const specification = JSON.stringify(overviewObj);

        const duration = Date.now() - startTime;
        logger.info({ requestId, duration: `${duration}ms` }, '[SpecGeneration] Overview generation completed');

        return specification;

      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ 
        requestId, 
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        duration: `${duration}ms`
      }, '[SpecGeneration] Overview generation failed');

      throw error;
    }
  }

  /**
   * Normalize overview suggestions to { toInclude: [], notToInclude: [] } per section.
   * Worker may send suggestionsIdeaSummary / suggestionsCoreFeatures as array or already as object.
   */
  normalizeOverviewSuggestions(overview) {
    if (!overview || typeof overview !== 'object') return overview;
    const normalized = { ...overview };
    const sections = [
      { key: 'suggestionsIdeaSummary', defaultNotToInclude: [] },
      { key: 'suggestionsCoreFeatures', defaultNotToInclude: [] }
    ];
    for (const { key, defaultNotToInclude } of sections) {
      const val = normalized[key];
      if (Array.isArray(val)) {
        normalized[key] = { toInclude: [], notToInclude: [...val] };
      } else if (val && typeof val === 'object' && Array.isArray(val.toInclude) && Array.isArray(val.notToInclude)) {
        // already normalized
      } else {
        normalized[key] = { toInclude: [], notToInclude: defaultNotToInclude };
      }
    }
    return normalized;
  }

  /**
   * Generate all specs sequentially (Technical → Market → Design → Architecture)
   * @param {string} specId - Spec ID
   * @param {string} overview - Overview content
   * @param {Array} answers - User answers
   * @returns {Promise<Object>} Results object with technical, market, design, architecture
   */
  async generateAllSpecs(specId, overview, answers) {
    const requestId = `generate-all-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    logger.info({ requestId, specId }, '[SpecGeneration] Starting sequential generation of all specs');

    const stages = ['technical', 'market', 'design'];
    const results = [];

    for (const stage of stages) {
      specEvents.emitSpecUpdate(specId, stage, 'generating', null);
      try {
        const content = await this.generateSection(specId, stage, overview, answers);
        results.push({ status: 'fulfilled', value: content });
      } catch (err) {
        results.push({ status: 'rejected', reason: err });
        // generateSection already emitted spec.error; continue to next stage or abort
        const failedIndex = results.length - 1;
        logger.warn({ requestId, specId, stage: stages[failedIndex] }, '[SpecGeneration] Section failed, continuing with remaining stages');
      }
    }

    const processed = this.processResults(results);
    processed.architecture = null;

    if (processed.technical && processed.market && processed.design) {
      specEvents.emitSpecUpdate(specId, 'architecture', 'generating', null);
      try {
        const architecture = await this.generateArchitecture(specId, overview, processed.technical, processed.market, processed.design);
        processed.architecture = architecture;
        specEvents.emitSpecUpdate(specId, 'architecture', 'ready', architecture);
        processed.successes.push({ stage: 'architecture', content: architecture });
      } catch (err) {
        logger.error({ requestId, specId, error: err.message }, '[SpecGeneration] Architecture generation failed');
        specEvents.emitSpecError(specId, 'architecture', err);
        processed.errors.push({ stage: 'architecture', error: err, retryable: this.isRetryable(err) });
      }
    }

    const duration = Date.now() - startTime;
    logger.info({
      requestId,
      specId,
      duration: `${duration}ms`,
      successes: processed.successes.length,
      errors: processed.errors.length
    }, '[SpecGeneration] Sequential generation completed');

    specEvents.emitSpecComplete(specId, processed);

    return processed;
  }

  /**
   * Process Promise.allSettled results
   * @param {Array} results - Results from Promise.allSettled
   * @returns {Object} Processed results
   */
  processResults(results) {
    const stages = ['technical', 'market', 'design'];
    const processed = {
      technical: null,
      market: null,
      design: null,
      successes: [],
      errors: []
    };

    results.forEach((result, index) => {
      const stage = stages[index];

      if (result.status === 'fulfilled') {
        processed[stage] = result.value;
        processed.successes.push({ stage, content: result.value });
      } else {
        processed[stage] = null;
        processed.errors.push({
          stage,
          error: result.reason,
          retryable: this.isRetryable(result.reason)
        });
      }
    });

    return processed;
  }

  /**
   * Check if error is retryable
   * @param {Error} error - Error object
   * @returns {boolean} True if retryable
   */
  isRetryable(error) {
    if (!error || !error.message) return false;
    
    const retryablePatterns = [
      'timeout',
      'network',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'AbortError'
    ];

    return retryablePatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Build prompt for a specific stage
   * @param {string} stage - Stage name
   * @param {string} specId - Spec ID
   * @param {string} overview - Overview content
   * @param {Array} answers - User answers
   * @returns {string} Prompt string
   */
  buildPrompt(stage, specId, overview, answers) {
    const appDescription = answers[0] || 'Not provided';
    const workflow = answers[1] || 'Not provided';
    const additionalDetails = answers[2] || 'Not provided';

    // Use full overview when provided so Worker receives context (reference mode only when overview is missing)
    const hasOverview = overview && typeof overview === 'string' && overview.trim().length > 0;
    const overviewContent = hasOverview ? overview : null;
    const isReference = !overviewContent;

    // Build stage-specific prompt based on PROMPTS structure from tools/prompts.js
    if (stage === 'technical') {
      return this.buildTechnicalPrompt(specId, overviewContent, appDescription, workflow, additionalDetails, isReference);
    } else if (stage === 'market') {
      return this.buildMarketPrompt(specId, overviewContent, appDescription, workflow, additionalDetails, isReference);
    } else if (stage === 'design') {
      return this.buildDesignPrompt(specId, overviewContent, appDescription, workflow, additionalDetails, isReference);
    }

    // Fallback
    return `Generate ${stage} specification for:
App Description: ${appDescription}
Workflow: ${workflow}
Additional Details: ${additionalDetails}

Overview:
${overviewContent || overview}`;
  }

  /**
   * Build technical prompt (simplified version of PROMPTS.technical)
   */
  buildTechnicalPrompt(specId, overviewContent, appDescription, workflow, additionalDetails, isReference) {
    const overviewSection = isReference 
      ? `[SPEC_REFERENCE]
Spec ID: ${specId}
Overview Location: Firebase > specs collection > ${specId} > overview field
Note: The system will retrieve the full overview content automatically. Use this reference to access the complete application overview details.`
      : `Application Overview:\n${overviewContent}`;

    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be technical. Never omit required keys.

Create a comprehensive technical specification with TEXTUAL descriptions only (no diagrams). You MUST return detailed, substantive content in every key—not just headings or placeholders.

Required keys (never omit; each must contain full content):
- techStack (object): frontend, backend, database, storage, authentication—each with a clear description of technologies and choices.
- architectureOverview (string): a full paragraph describing system structure, client-server flow, API layout, and data flow. Use "" only if no overview is available.
- databaseSchema (object): MUST include a description (at least 2–3 sentences) and a tables array. When Application Overview or app description exists, you MUST infer and return at least 2–3 tables; each table: name, purpose, fields (array of field names with types and constraints, e.g. "id (PK)", "email (string, unique)"), relationships. Never return an empty tables array when the overview or user input describes the app—infer the main entities (users, content, etc.) and define them.
- apiEndpoints (array): each item MUST have path, method, description; and MUST include requestBody and responseBody (text or JSON string describing request/response structure). Also include parameters and statusCodes when relevant. Use [] only if no endpoints can be inferred.
- securityAuthentication (object): authentication, authorization, and securityMeasures as full sentences; MUST include securityCriticalPoints array with 3–5 actionable security warnings (e.g. never store secrets in frontend, validate inputs, use HTTPS, JWT best practices).
- integrationExternalApis (object): thirdPartyServices (array of names), integrations (paragraph), dataFlow (paragraph)—each with real descriptive content.

Also include devops (deploymentStrategy, infrastructure, monitoring, scaling, backup, automation), dataStorage, analytics, detailedDataModels, dataFlowDetailed—each section with at least 2–3 sentences or bullet points per sub-key. All content must be comprehensive enough for a developer to implement from the spec.

${overviewSection}

User Input:
App Description: ${appDescription}
User Workflow: ${workflow}
Additional Details: ${additionalDetails}
Note: Target Audience information should be inferred from the app description and workflow provided above.`;
  }

  /**
   * Build market prompt (simplified version of PROMPTS.market)
   */
  buildMarketPrompt(specId, overviewContent, appDescription, workflow, additionalDetails, isReference) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    
    const months = [];
    for (let i = 2; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1 - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);
    }
    const last3Months = months.join(', ');

    const overviewSection = isReference 
      ? `[SPEC_REFERENCE]
Spec ID: ${specId}
Overview Location: Firebase > specs collection > ${specId} > overview field
Note: The system will retrieve the full overview content automatically. Use this reference to access the complete application overview details.`
      : `Application Overview:\n${overviewContent}`;

    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be market. Never omit required keys. Each required key MUST contain detailed, substantive content—not empty objects or one-line stubs.

Create comprehensive market research. Return JSON with market key containing exactly these required keys, each filled with full content:
- industryOverview (object): trends, marketData, growth potential—each with paragraphs or detailed bullet points.
- targetAudienceInsights (object): demographics, needs, behaviors, and insights—substantial text per sub-key.
- competitiveLandscape (array): array of competitor objects, each with name, strengths, weaknesses, and differentiators; include at least 3–5 competitors with real content.
- swotAnalysis (object): strengths, weaknesses, opportunities, threats—each with detailed points, not just headings.
- monetizationModel (object): pricing strategy, revenue streams, and rationale—detailed descriptions.
- marketingStrategy (object): channels, messaging, go-to-market—concrete, actionable content.

Current Date: ${currentDateStr}
Last 3 Months for Historical Data: ${last3Months}

${overviewSection}

User Input:
App Description: ${appDescription}
User Workflow: ${workflow}
Additional Details: ${additionalDetails}
Note: Target Audience information should be inferred from the app description and workflow provided above.`;
  }

  /**
   * Build design prompt (simplified version of PROMPTS.design)
   */
  buildDesignPrompt(specId, overviewContent, appDescription, workflow, additionalDetails, isReference) {
    const overviewSection = isReference 
      ? `[SPEC_REFERENCE]
Spec ID: ${specId}
Overview Location: Firebase > specs collection > ${specId} > overview field
Note: The system will retrieve the full overview content automatically. Use this reference to access the complete application overview details.`
      : `Application Overview:\n${overviewContent}`;

    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be design. Never omit required keys. Each required key MUST contain detailed, substantive content—not empty objects or placeholder text.

Create comprehensive design specifications. Return JSON with design key containing exactly these required keys, each filled with full content:
- visualStyleGuide (object): colors (palette and usage), typography (fonts, sizes), spacing, buttons, animations—specific values and guidelines.
- logoIconography (object): logoConcepts, colorVersions, iconSet, appIcon (letters, bgColor, description)—concrete descriptions and recommendations.
- uiLayout (object): landingPage, dashboard, navigation, responsiveDesign—each with clear layout and structure descriptions.
- uxPrinciples (object): userFlow (how users move through the app), accessibility (WCAG-relevant points), informationHierarchy—actionable, detailed text.

Do not return section headers only; every sub-key must have real descriptive content suitable for a designer or developer.

${overviewSection}

User Input:
App Description: ${appDescription}
User Workflow: ${workflow}
Additional Details: ${additionalDetails}
Note: Target Audience information should be inferred from the app description and workflow provided above.`;
  }

  /**
   * Get system prompt for a stage
   * @param {string} stage - Stage name
   * @returns {string} System prompt
   */
  getSystemPrompt(stage) {
    const prompts = {
      technical: 'You are a highly experienced software architect and lead developer. Generate a detailed technical specification.',
      market: 'You are a market research specialist and business analyst. Generate comprehensive market research insights.',
      design: 'You are a UX/UI design specialist and branding expert. Generate comprehensive design guidelines and branding elements.',
      architecture: 'You are a software architect. Produce a single Markdown document that follows a fixed 7-section structure. Each section must include the required subsections. Use Mermaid code blocks where helpful (e.g., tree diagrams, flowcharts). Output only valid Markdown with the exact section headings provided.'
    };
    return prompts[stage] || 'You are an expert specification generator.';
  }

  /**
   * Get developer prompt for a stage
   * @param {string} stage - Stage name
   * @returns {string} Developer prompt
   */
  getDeveloperPrompt(stage) {
    const prompts = {
      technical: 'Create a comprehensive technical specification including data models, database schema, API design, security, and integration points.',
      market: 'Create detailed market analysis including market overview, competitors analysis, target audience personas, and pricing strategy.',
      design: 'Create detailed design specifications including color schemes, typography, UI components, user experience guidelines, and branding elements.',
      architecture: 'Create a single Markdown document with exactly 7 main sections. Use the exact section titles and include all required subsections. Use Markdown headings (## for main sections, ### for subsections) and optional Mermaid code blocks. Output must be valid Markdown only.'
    };
    return prompts[stage] || 'Generate a comprehensive specification.';
  }

  /**
   * Generate architecture section from overview + technical + market + design.
   * Called after advanced specs are ready; output is Markdown with optional Mermaid blocks.
   * @param {string} specId - Spec ID
   * @param {string} overview - Overview content
   * @param {string} technical - Technical content
   * @param {string} market - Market content
   * @param {string} design - Design content
   * @returns {Promise<string>} Architecture markdown
   */
  async generateArchitecture(specId, overview, technical, market, design) {
    const requestId = `generate-architecture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    logger.info({ requestId, specId }, '[SpecGeneration] Starting architecture generation');

    const architectureStructure = `
Your output MUST be a single Markdown document with exactly these 7 sections (use these exact headings). Include all subsections under each.

## 1. System Overview & Tech Stack
Defines the foundation and the "tools of the trade."
- **Core Technologies:** List the primary languages and frameworks (e.g., Node.js, React, Python).
- **Infrastructure:** Hosting (e.g., AWS, Render, Vercel) and Database (e.g., Firestore, PostgreSQL, Redis).
- **Third-Party Integrations:** External APIs (e.g., Stripe, Firebase Auth, OpenAI).
- **Architecture Pattern:** High-level logic (e.g., MVC, Microservices, Serverless).

## 2. File & Directory Structure
The "Map" for the AI. Prevents creating files in the wrong places.
- **Tree Diagram:** Visual or text representation of folders (e.g., src/components, src/services). Use Mermaid if helpful.
- **Naming Conventions:** Rules for naming files (e.g., kebab-case for files, PascalCase for React components).
- **Module Responsibility:** Brief description of what each directory is allowed to contain.

## 3. Data Schema & Models
The "Memory" of the system. How data is structured and stored.
- **Entities:** Main objects (e.g., User, Spec, McpKey).
- **Field Definitions:** Property names, data types (String, Number, Boolean), required/optional.
- **Relationships:** How entities link (e.g., One-to-Many between User and Specs).
- **Indexing:** Key fields that need fast searching in the database.

## 4. Key Logic Flows
The "Instructions" for the backend. How the system handles complex tasks.
- **User Journeys:** Step-by-step logic for key actions (e.g., "User requests API key -> System validates session -> Writes to DB").
- **Data Lifecycle:** How data is created, updated, deleted or archived.
- **Error Handling:** What happens when things go wrong (e.g., "If API Key invalid, return 401 Unauthorized").

## 5. API & Function Definitions
The "Interfaces." Specific code signatures.
- **REST Endpoints:** Method, Path, Request Body, Response (e.g., PUT /api/specs/:id).
- **Core Utility Functions:** Key logic functions that must exist (e.g., generateApiKey(), validateSchema()).
- **Frontend Hooks/Services:** How the UI interacts with the logic (e.g., useSpecData()).

## 6. UI & Page Architecture
The "Visual Map." Bridges design and code.
- **Sitemap:** List of all accessible pages and their routes.
- **Component Hierarchy:** Reusable UI elements (e.g., Sidebar, SpecEditor, StatusBadge).
- **Design Tokens:** System-wide constants (colors hex, spacing px/rem, typography).

## 7. Security & Constraints
The "Guardrails." Safety and efficiency.
- **Authentication & Authorization:** How users log in and roles (e.g., Admin vs User).
- **Environment Variables:** List of required .env keys (names only, no values).
- **Performance Constraints:** Limits (e.g., max 50 specs per user, response time under 200ms).
`;

    const userPrompt = `Combine the following specification sections into one architecture document. The output MUST follow the exact 7-section structure provided below (use the same section numbers and titles).

## Overview
${(overview || '').slice(0, 15000)}

## Technical
${(technical || '').slice(0, 20000)}

## Market
${(market || '').slice(0, 8000)}

## Design
${(design || '').slice(0, 12000)}

---
REQUIRED OUTPUT STRUCTURE (include every section and subsection; fill from the specs above):
${architectureStructure}

Use \`\`\`mermaid ... \`\`\` blocks where a diagram helps (e.g., tree, flowchart, sequence). Return ONLY the Markdown (no JSON wrapper).`;

    const requestBody = {
      stage: 'architecture',
      locale: 'en-US',
      temperature: 0.2,
      prompt: {
        system: this.getSystemPrompt('architecture'),
        developer: this.getDeveloperPrompt('architecture'),
        user: userPrompt
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const responseText = await response.text();
      let architecture = '';

      try {
        const data = JSON.parse(responseText);
        if (data.architecture && typeof data.architecture === 'string') {
          architecture = data.architecture;
        } else if (typeof data === 'string') {
          architecture = data;
        } else {
          architecture = responseText;
        }
      } catch (_) {
        architecture = responseText;
      }

      const duration = Date.now() - startTime;
      logger.info({ requestId, specId, duration: `${duration}ms` }, '[SpecGeneration] Architecture generation completed');

      return architecture;
    } catch (error) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      logger.error({ requestId, specId, error: error.message, duration: `${duration}ms` }, '[SpecGeneration] Architecture generation failed');
      throw error;
    }
  }
}

module.exports = new SpecGenerationService();

