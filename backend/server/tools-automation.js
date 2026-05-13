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
    
    return `You are a tool discovery assistant. Find NEW tools that were LAUNCHED in the past week (last 7 days) in the following categories:

${categoriesList}

IMPORTANT REQUIREMENTS:
1. Only return tools that were ACTUALLY LAUNCHED in the past week - do not include existing tools or tools from previous weeks
2. If no new tools were launched this week, return an empty array
3. Do NOT invent or make up tools - only include tools that you can verify exist
4. Each tool must have a real, working URL
5. Only include tools that match the categories above

For each tool, return a JSON object with this EXACT structure:
{
  "name": "Tool Name (required, must be exact name)",
  "category": "One of the categories from the list above (required)",
  "description": "Brief description of what the tool does (required, 1-2 sentences)",
  "link": "Full URL to the tool's website (required, must be valid URL)",
  "rating": null or number between 1-5 (only if you have real rating data, otherwise null),
  "pros": [] or array of strings (only if you have real information, otherwise empty array),
  "cons": [] or array of strings (only if you have real information, otherwise empty array),
  "stats": null or object with users/globalRating/monthlyUsage/ARR (only if you have real data, otherwise null),
  "special": null or string like "new version" or "popular" (only if applicable, otherwise null)
}

Return ONLY a valid JSON object of the form { "tools": [ ... ] }. If no new tools were found, return { "tools": [] }.

Example format:
{
  "tools": [
    {
      "name": "Example Tool",
      "category": "Prompt-to-App Builders",
      "description": "A tool that does X",
      "link": "https://example.com",
      "rating": null,
      "pros": [],
      "cons": [],
      "stats": null,
      "special": null
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
      
      // Call OpenAI
      logger.info({ requestId }, '[tools-automation] Calling OpenAI API');
      const response = await openaiClient.chatCompletion({
        model: process.env.TOOLS_OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a tool discovery assistant. You help find new developer tools that were recently launched. Always return valid JSON wrapping the tools array as { "tools": [ ... ] }.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for more consistent results
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      });
      
      // Parse response
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }
      
      logger.debug({ requestId, contentLength: content.length }, '[tools-automation] Received OpenAI response');
      
      // Parse JSON
      let tools;
      try {
        // Try to parse as JSON object first (if wrapped)
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          tools = parsed;
        } else if (parsed.tools && Array.isArray(parsed.tools)) {
          tools = parsed.tools;
        } else if (parsed.data && Array.isArray(parsed.data)) {
          tools = parsed.data;
        } else {
          // Try to extract array from any property
          const arrayKey = Object.keys(parsed).find(key => Array.isArray(parsed[key]));
          tools = arrayKey ? parsed[arrayKey] : [];
        }
      } catch (parseError) {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
        if (jsonMatch) {
          tools = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error(`Failed to parse JSON: ${parseError.message}`);
        }
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

