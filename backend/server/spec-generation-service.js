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

    try {
      // Build prompt based on stage
      const prompt = this.buildPrompt(stage, specId, overview, answers);

      const requestBody = {
        stage: stage,
        locale: 'en-US',
        temperature: 0,
        prompt: {
          system: this.getSystemPrompt(stage),
          developer: this.getDeveloperPrompt(stage),
          user: prompt
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

        const result = data[stage] 
          ? JSON.stringify(data[stage], null, 2) 
          : `No ${stage} specification generated`;

        const duration = Date.now() - startTime;
        logger.info({ requestId, specId, stage, duration: `${duration}ms` }, `[SpecGeneration] ${stage} generation completed`);

        // Emit success event
        specEvents.emitSpecUpdate(specId, stage, 'ready', result);

        return result;

      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ 
        requestId, 
        specId, 
        stage, 
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        duration: `${duration}ms`
      }, `[SpecGeneration] ${stage} generation failed`);

      // Emit error event
      specEvents.emitSpecError(specId, stage, error);

      throw error;
    }
  }

  /**
   * Generate all specs in parallel
   * @param {string} specId - Spec ID
   * @param {string} overview - Overview content
   * @param {Array} answers - User answers
   * @returns {Promise<Object>} Results object with technical, market, design
   */
  async generateAllSpecs(specId, overview, answers) {
    const requestId = `generate-all-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    logger.info({ requestId, specId }, '[SpecGeneration] Starting parallel generation of all specs');

    // Generate all three sections in parallel using Promise.allSettled
    const results = await Promise.allSettled([
      this.generateSection(specId, 'technical', overview, answers),
      this.generateSection(specId, 'market', overview, answers),
      this.generateSection(specId, 'design', overview, answers)
    ]);

    // Process results
    const processed = this.processResults(results);

    const duration = Date.now() - startTime;
    logger.info({ 
      requestId, 
      specId, 
      duration: `${duration}ms`,
      successes: processed.successes.length,
      errors: processed.errors.length
    }, '[SpecGeneration] Parallel generation completed');

    // Emit complete event
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

    // Determine if using reference or full content
    const isReference = typeof specId === 'string' && specId.length < 100;
    const overviewContent = isReference ? null : overview;

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

    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be technical. If a value is unknown, return an empty array/object—never omit required keys.

Create a comprehensive technical specification with TEXTUAL descriptions only (no diagrams). Return JSON with technical key containing detailed techStack, architectureOverview, databaseSchema, apiEndpoints, securityAuthentication, integrationExternalApis, devops, dataStorage, analytics, detailedDataModels, and dataFlowDetailed.

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

    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be market. If a value is unknown, return an empty array/object—never omit required keys.

Create comprehensive market research including marketOverview, competitorsAnalysis, targetAudiencePersonas, pricingStrategy, marketTrends, and goToMarketStrategy.

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

    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be design. If a value is unknown, return an empty array/object—never omit required keys.

Create comprehensive design specifications including visualStyleGuide (colors, typography, spacing, layout), uiComponents, userExperienceGuidelines, brandingElements, and responsiveDesign.

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
      design: 'You are a UX/UI design specialist and branding expert. Generate comprehensive design guidelines and branding elements.'
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
      design: 'Create detailed design specifications including color schemes, typography, UI components, user experience guidelines, and branding elements.'
    };
    return prompts[stage] || 'Generate a comprehensive specification.';
  }
}

module.exports = new SpecGenerationService();

