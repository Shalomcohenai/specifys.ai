/**
 * Automation Service - Generic infrastructure for automated tasks
 * Provides OpenAI client wrapper, base job class, and job registry
 */

const { db, admin } = require('./firebase-admin');
const { logger } = require('./logger');
const OpenAI = require('openai');

/**
 * OpenAI Client Wrapper
 * Handles API calls with retry logic, rate limiting, and error handling
 */
class OpenAIClient {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.apiKey = apiKey;
    this.client = new OpenAI({ apiKey });
    this.rateLimitDelay = 1000; // 1 second between requests
    this.maxRetries = 3;
    this.retryDelay = 2000; // 2 seconds
  }

  /**
   * Make a chat completion request with retry logic
   * @param {Object} params - OpenAI chat completion parameters
   * @param {number} retries - Current retry count
   * @returns {Promise<Object>} OpenAI response
   */
  async chatCompletion(params, retries = 0) {
    const requestId = `openai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.debug({ requestId, model: params.model }, '[automation-service] OpenAI chat completion request');
      
      const response = await this.client.chat.completions.create({
        model: params.model || 'gpt-4',
        messages: params.messages || [],
        temperature: params.temperature || 0.7,
        max_tokens: params.max_tokens || 2000,
        response_format: params.response_format || { type: 'text' },
        ...params
      });

      logger.debug({ requestId, usage: response.usage }, '[automation-service] OpenAI chat completion success');
      
      // Rate limiting delay
      await this.delay(this.rateLimitDelay);
      
      return response;
    } catch (error) {
      // Handle rate limiting
      if (error.status === 429 && retries < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retries);
        logger.warn({ requestId, retries, delay }, '[automation-service] Rate limited, retrying');
        await this.delay(delay);
        return this.chatCompletion(params, retries + 1);
      }
      
      // Handle other retryable errors
      if (error.status >= 500 && retries < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retries);
        logger.warn({ requestId, retries, delay, status: error.status }, '[automation-service] Server error, retrying');
        await this.delay(delay);
        return this.chatCompletion(params, retries + 1);
      }
      
      logger.error({ requestId, error: error.message, status: error.status }, '[automation-service] OpenAI API error');
      throw error;
    }
  }

  /**
   * Parse JSON response from OpenAI
   * @param {string} content - Response content
   * @returns {Object} Parsed JSON
   */
  parseJSONResponse(content) {
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      // Try direct parse
      return JSON.parse(content);
    } catch (error) {
      logger.error({ error: error.message, content: content.substring(0, 200) }, '[automation-service] Failed to parse JSON response');
      throw new Error(`Failed to parse JSON response: ${error.message}`);
    }
  }

  /**
   * Delay helper
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Base Automation Job Class
 * All automation jobs should extend this class
 */
class AutomationJob {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.openaiClient = null;
    
    if (config.openaiApiKey) {
      this.openaiClient = new OpenAIClient(config.openaiApiKey);
    }
  }

  /**
   * Execute the job (must be implemented by subclasses)
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Job result
   */
  async execute(options = {}) {
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * Validate job configuration
   * @returns {boolean} True if valid
   */
  validateConfig() {
    if (!this.name) {
      throw new Error('Job name is required');
    }
    return true;
  }

  /**
   * Log job result to Firestore
   * @param {string} status - 'success' | 'error' | 'skipped'
   * @param {Object} result - Job result data
   * @param {Error} error - Error object if failed
   * @param {Object} metadata - Additional metadata
   */
  async logResult(status, result = null, error = null, metadata = {}) {
    const requestId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const logData = {
        jobName: this.name,
        status,
        startedAt: metadata.startedAt || admin.firestore.FieldValue.serverTimestamp(),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        result: result ? JSON.parse(JSON.stringify(result)) : null,
        error: error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : null,
        metadata: {
          ...metadata,
          dryRun: metadata.dryRun || false
        }
      };

      await db.collection('automation_logs').add(logData);
      
      logger.info({ 
        requestId, 
        jobName: this.name, 
        status,
        resultCount: result?.count || 0
      }, `[automation-service] Job ${this.name} completed with status: ${status}`);
    } catch (logError) {
      logger.error({ 
        requestId, 
        jobName: this.name, 
        error: logError.message 
      }, '[automation-service] Failed to log job result');
    }
  }

  /**
   * Handle job error
   * @param {Error} error - Error object
   * @param {Object} metadata - Additional metadata
   */
  async handleError(error, metadata = {}) {
    await this.logResult('error', null, error, metadata);
    throw error;
  }

  /**
   * Get OpenAI client instance
   * @returns {OpenAIClient} OpenAI client
   */
  getOpenAIClient() {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized. Provide openaiApiKey in config.');
    }
    return this.openaiClient;
  }
}

/**
 * Job Registry
 * Manages all registered automation jobs
 */
class JobRegistry {
  constructor() {
    this.jobs = new Map();
  }

  /**
   * Register a job
   * @param {string} name - Job name
   * @param {AutomationJob} jobInstance - Job instance
   */
  registerJob(name, jobInstance) {
    if (!(jobInstance instanceof AutomationJob)) {
      throw new Error('Job must be an instance of AutomationJob');
    }
    
    this.jobs.set(name, jobInstance);
    logger.info({ jobName: name }, '[automation-service] Job registered');
  }

  /**
   * Get a job by name
   * @param {string} name - Job name
   * @returns {AutomationJob} Job instance
   */
  getJob(name) {
    const job = this.jobs.get(name);
    if (!job) {
      throw new Error(`Job not found: ${name}`);
    }
    return job;
  }

  /**
   * List all registered jobs
   * @returns {Array<string>} List of job names
   */
  listJobs() {
    return Array.from(this.jobs.keys());
  }

  /**
   * Execute a job
   * @param {string} name - Job name
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Job result
   */
  async executeJob(name, options = {}) {
    const job = this.getJob(name);
    const startedAt = new Date();
    
    try {
      logger.info({ jobName: name, options }, '[automation-service] Executing job');
      
      const result = await job.execute(options);
      
      await job.logResult('success', result, null, {
        startedAt,
        ...options
      });
      
      return {
        success: true,
        jobName: name,
        result
      };
    } catch (error) {
      await job.logResult('error', null, error, {
        startedAt,
        ...options
      });
      
      return {
        success: false,
        jobName: name,
        error: {
          message: error.message,
          stack: error.stack
        }
      };
    }
  }

  /**
   * Get last execution status for a job
   * @param {string} name - Job name
   * @returns {Promise<Object|null>} Last execution log
   */
  async getLastStatus(name) {
    try {
      const snapshot = await db.collection('automation_logs')
        .where('jobName', '==', name)
        .orderBy('completedAt', 'desc')
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      
      return {
        id: doc.id,
        ...data,
        startedAt: data.startedAt?.toDate ? data.startedAt.toDate() : data.startedAt,
        completedAt: data.completedAt?.toDate ? data.completedAt.toDate() : data.completedAt
      };
    } catch (error) {
      logger.error({ jobName: name, error: error.message }, '[automation-service] Failed to get last status');
      return null;
    }
  }

  /**
   * Get execution history for a job
   * @param {string} name - Job name
   * @param {number} limit - Number of logs to return
   * @returns {Promise<Array>} Execution history
   */
  async getHistory(name, limit = 10) {
    try {
      const snapshot = await db.collection('automation_logs')
        .where('jobName', '==', name)
        .orderBy('completedAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startedAt: data.startedAt?.toDate ? data.startedAt.toDate() : data.startedAt,
          completedAt: data.completedAt?.toDate ? data.completedAt.toDate() : data.completedAt
        };
      });
    } catch (error) {
      logger.error({ jobName: name, error: error.message }, '[automation-service] Failed to get history');
      return [];
    }
  }
}

// Create singleton instance
const jobRegistry = new JobRegistry();

module.exports = {
  OpenAIClient,
  AutomationJob,
  JobRegistry,
  jobRegistry
};

