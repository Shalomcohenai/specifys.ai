/**
 * Tools Automation
 * Automated tool discovery using OpenAI
 */

const { AutomationJob } = require('./automation-service');
const { db, admin } = require('./firebase-admin');
const { logger } = require('./logger');
const { getAllTools, validateTool, TOOLS_COLLECTION } = require('./tools-migration-service');

/**
 * Tools Finder Job
 * Finds new tools launched in the past week using OpenAI
 */
class ToolsFinderJob extends AutomationJob {
  constructor(config = {}) {
    super('tools-finder', config);
  }

  /**
   * Get existing categories from Firestore
   * @returns {Promise<Array<string>>} List of categories
   */
  async getExistingCategories() {
    try {
      const tools = await getAllTools();
      const categories = [...new Set(tools.map(tool => tool.category).filter(Boolean))];
      return categories.sort();
    } catch (error) {
      logger.warn({ error: error.message }, '[tools-automation] Failed to get categories, using defaults');
      // Return default categories if query fails
      return [
        'Prompt-to-App Builders',
        'AI-Augmented IDEs & Code Assistants',
        'AI Agent & Workflow Tools',
        'Deployment & Marketing Integrations',
        'Prototyping Tools',
        'User Design',
        'Data-Driven App Builders',
        'Business Process Automation',
        'Game Development Tools',
        'Code Security Tools',
        'UI/UX + Code Tools',
        'Educational Coding Tools',
        'AR/VR Development Tools'
      ];
    }
  }

  /**
   * Build prompt for OpenAI
   * @param {Array<string>} categories - Existing categories
   * @returns {string} Prompt text
   */
  buildPrompt(categories) {
    const categoriesList = categories.map(cat => `- ${cat}`).join('\n');

    return `You are a tool discovery assistant. Your job is to find brand-new dev tools that LAUNCHED in the past 7-30 days.

CATEGORIES (you must map every tool to exactly one of these):
${categoriesList}

MANDATORY RESEARCH RULES (do not skip — failure to follow returns 0 tools):
1. You MUST use the web search tool. Do NOT rely on training data alone.
2. Search for launches, releases, Show HN / Hacker News posts, Product Hunt launches, Reddit r/SideProject / r/programming highlights, Twitter/X announcements, blog posts — all dated within the past 30 days (prefer the past 7 days).
3. Every tool you return MUST have a verifiable real URL that you actually found in a fresh source. If the URL is older than 30 days, drop the tool.
4. Do NOT invent tools, do NOT include established tools (Cursor, Copilot, Bolt, v0, Lovable, etc.) unless they shipped a *new major version* in the past 30 days — in that case "special" must say "major-release-YYYY-MM" or similar.
5. If, after honest searching, you cannot find any genuinely new tools in a category, skip that category.
6. If, after honest searching, you cannot find ANY new tools at all, return { "tools": [] }. An empty result is better than fabricated data.

For each tool, return a JSON object with this EXACT structure:
{
  "name": "Tool Name (required, must be the exact official name)",
  "category": "One of the categories above (required)",
  "description": "Brief description of what the tool does (required, 1-2 sentences)",
  "link": "Full URL to the tool's website (required, must be a real verified URL)",
  "rating": null or number between 1-5 (only if you have real rating data, otherwise null),
  "pros": [] or array of short strings (only with real evidence, otherwise empty),
  "cons": [] or array of short strings (only with real evidence, otherwise empty),
  "stats": null or { "users": ..., "globalRating": ..., "monthlyUsage": ..., "ARR": ... } (only real data, otherwise null),
  "special": null or string like "launched-YYYY-MM-DD", "new version", "trending-this-week"
}

Return ONLY a valid JSON object of the form { "tools": [ ... ] }. No prose. No markdown fences.

Example shape (NOT actual tools — do not return these):
{
  "tools": [
    {
      "name": "Example Tool",
      "category": "Prompt-to-App Builders",
      "description": "A tool that does X.",
      "link": "https://example.com",
      "rating": null,
      "pros": [],
      "cons": [],
      "stats": null,
      "special": "launched-YYYY-MM-DD"
    }
  ]
}`;
  }

  /**
   * Check if tool already exists
   * @param {string} name - Tool name
   * @param {string} link - Tool link
   * @returns {Promise<boolean>} True if exists
   */
  async toolExists(name, link) {
    try {
      // Check by name
      const byNameSnapshot = await db.collection(TOOLS_COLLECTION)
        .where('name', '==', name)
        .limit(1)
        .get();
      
      if (!byNameSnapshot.empty) {
        return true;
      }
      
      // Check by link
      const byLinkSnapshot = await db.collection(TOOLS_COLLECTION)
        .where('link', '==', link)
        .limit(1)
        .get();
      
      return !byLinkSnapshot.empty;
    } catch (error) {
      logger.error({ error: error.message, name, link }, '[tools-automation] Error checking if tool exists');
      // If check fails, assume it doesn't exist to avoid duplicates
      return false;
    }
  }

  /**
   * Get next available ID
   * @returns {Promise<number>} Next ID
   */
  async getNextId() {
    try {
      const snapshot = await db.collection(TOOLS_COLLECTION)
        .orderBy('id', 'desc')
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return 1;
      }
      
      const lastTool = snapshot.docs[0].data();
      return (lastTool.id || 0) + 1;
    } catch (error) {
      logger.warn({ error: error.message }, '[tools-automation] Error getting next ID, using timestamp');
      return Date.now();
    }
  }

  /**
   * Save tool to Firestore
   * @param {Object} tool - Tool object
   * @param {number} id - Tool ID
   * @returns {Promise<string>} Document ID
   */
  async saveTool(tool, id) {
    const toolData = {
      id,
      name: tool.name.trim(),
      category: tool.category.trim(),
      description: tool.description.trim(),
      link: tool.link.trim(),
      rating: tool.rating || null,
      pros: Array.isArray(tool.pros) ? tool.pros : [],
      cons: Array.isArray(tool.cons) ? tool.cons : [],
      stats: tool.stats || null,
      special: tool.special || null,
      added: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      source: 'automation'
    };

    const docRef = await db.collection(TOOLS_COLLECTION).add(toolData);
    return docRef.id;
  }

  /**
   * Execute the job
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Job result
   */
  async execute(options = {}) {
    const { dryRun = false } = options;
    const requestId = `tools-finder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startedAt = new Date();
    
    logger.info({ requestId, dryRun }, '[tools-automation] Starting tools finder job');
    
    try {
      // Get OpenAI client
      const openaiClient = this.getOpenAIClient();
      
      // Get existing categories
      const categories = await this.getExistingCategories();
      logger.debug({ requestId, categoryCount: categories.length }, '[tools-automation] Retrieved categories');
      
      // Build prompt
      const prompt = this.buildPrompt(categories);
      
      // Call OpenAI (search-preview model is web-enabled; falls back to plain gpt-4o-mini via env override)
      logger.info({ requestId }, '[tools-automation] Calling OpenAI API');
      const response = await openaiClient.chatCompletion({
        model: process.env.TOOLS_OPENAI_MODEL || 'gpt-4o-mini-search-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a tool discovery assistant. You MUST use the web search tool to ground every result in fresh sources from the past 7-30 days. Return only a valid JSON object of the shape { "tools": [ ... ] }. Empty list ({ "tools": [] }) is acceptable when nothing genuinely new was launched.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        web_search_options: {}
      });
      
      // Parse response
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }
      
      logger.debug({ requestId, contentLength: content.length }, '[tools-automation] Received OpenAI response');
      
      // Parse JSON — search-preview models may wrap prose around the JSON.
      let tools;
      const extractToolsFromParsed = (parsed) => {
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.tools)) return parsed.tools;
        if (parsed && Array.isArray(parsed.data)) return parsed.data;
        if (parsed && typeof parsed === 'object') {
          const arrayKey = Object.keys(parsed).find(key => Array.isArray(parsed[key]));
          if (arrayKey) return parsed[arrayKey];
        }
        return null;
      };

      const parseAttempts = [];
      // 1. Direct parse
      try {
        const parsed = JSON.parse(content);
        const extracted = extractToolsFromParsed(parsed);
        if (extracted) tools = extracted;
      } catch (e) {
        parseAttempts.push({ stage: 'direct', error: e.message });
      }

      // 2. JSON inside ```json``` code block (object or array)
      if (!tools) {
        const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlock) {
          try {
            const parsed = JSON.parse(codeBlock[1]);
            const extracted = extractToolsFromParsed(parsed);
            if (extracted) tools = extracted;
          } catch (e) {
            parseAttempts.push({ stage: 'code-block', error: e.message });
          }
        }
      }

      // 3. First balanced { ... } object found in prose
      if (!tools) {
        const firstObjectMatch = content.match(/\{[\s\S]*\}/);
        if (firstObjectMatch) {
          try {
            const parsed = JSON.parse(firstObjectMatch[0]);
            const extracted = extractToolsFromParsed(parsed);
            if (extracted) tools = extracted;
          } catch (e) {
            parseAttempts.push({ stage: 'first-object', error: e.message });
          }
        }
      }

      // 4. First bare array found in prose
      if (!tools) {
        const firstArrayMatch = content.match(/\[[\s\S]*\]/);
        if (firstArrayMatch) {
          try {
            const parsed = JSON.parse(firstArrayMatch[0]);
            if (Array.isArray(parsed)) tools = parsed;
          } catch (e) {
            parseAttempts.push({ stage: 'first-array', error: e.message });
          }
        }
      }

      if (!tools) {
        logger.error({ requestId, parseAttempts, contentPreview: content.substring(0, 500) }, '[tools-automation] Failed to extract tools JSON');
        throw new Error('Failed to parse tools JSON from OpenAI response');
      }
      
      if (!Array.isArray(tools)) {
        throw new Error('OpenAI response is not an array');
      }
      
      logger.info({ requestId, toolCount: tools.length }, '[tools-automation] Parsed tools from OpenAI');
      
      // Process tools
      const results = {
        found: tools.length,
        validated: 0,
        skipped: 0,
        created: 0,
        errors: []
      };
      
      for (let i = 0; i < tools.length; i++) {
        const tool = tools[i];
        
        try {
          // Validate tool
          const validation = validateTool(tool);
          
          if (!validation.valid) {
            results.errors.push({
              index: i + 1,
              name: tool.name || 'Unknown',
              errors: validation.errors
            });
            logger.warn({ requestId, index: i + 1, name: tool.name, errors: validation.errors }, '[tools-automation] Tool validation failed');
            continue;
          }
          
          results.validated++;
          
          // Check if tool already exists
          const exists = await this.toolExists(tool.name, tool.link);
          
          if (exists) {
            results.skipped++;
            logger.debug({ requestId, name: tool.name }, '[tools-automation] Tool already exists, skipping');
            continue;
          }
          
          // Save tool (unless dry run)
          if (!dryRun) {
            // Double-check before saving (race condition protection)
            const existsAgain = await this.toolExists(tool.name, tool.link);
            
            if (existsAgain) {
              results.skipped++;
              logger.debug({ requestId, name: tool.name }, '[tools-automation] Tool was added by another process, skipping');
              continue;
            }
            
            const nextId = await this.getNextId();
            const docId = await this.saveTool(tool, nextId);
            results.created++;
            logger.info({ requestId, name: tool.name, id: docId, toolId: nextId }, '[tools-automation] Tool saved');
          } else {
            results.created++;
            logger.debug({ requestId, name: tool.name }, '[tools-automation] Tool would be saved (dry run)');
          }
        } catch (error) {
          results.errors.push({
            index: i + 1,
            name: tool.name || 'Unknown',
            error: error.message
          });
          logger.error({ requestId, index: i + 1, name: tool.name, error: error.message }, '[tools-automation] Error processing tool');
        }
      }
      
      const duration = Date.now() - startedAt.getTime();
      
      logger.info({ 
        requestId, 
        results,
        duration: `${duration}ms`,
        dryRun 
      }, '[tools-automation] Tools finder job completed');
      
      return {
        success: true,
        requestId,
        results,
        duration,
        dryRun
      };
    } catch (error) {
      logger.error({ 
        requestId, 
        error: { 
          message: error.message, 
          stack: error.stack 
        } 
      }, '[tools-automation] Tools finder job failed');
      
      throw error;
    }
  }
}

module.exports = {
  ToolsFinderJob
};

