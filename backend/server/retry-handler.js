/**
 * Retry Handler for Chat System
 * Provides centralized retry mechanism with exponential backoff
 */

const { logger } = require('./logger');

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableStatusCodes: [429, 500, 502, 503, 504],
  retryableErrorMessages: [
    'server_error',
    'rate_limit',
    'timeout',
    'corrupted',
    'Vector store configuration not propagated',
    'tool_resources'
  ]
};

/**
 * Check if an error is retryable
 * @param {Error} error - The error to check
 * @param {object} config - Retry configuration
 * @returns {boolean} True if error is retryable
 */
function isRetryableError(error, config = DEFAULT_RETRY_CONFIG) {
  if (!error) return false;

  const errorMessage = error.message || '';
  const errorString = errorMessage.toLowerCase();

  // Check for retryable error messages
  for (const retryableMsg of config.retryableErrorMessages) {
    if (errorString.includes(retryableMsg.toLowerCase())) {
      return true;
    }
  }

  // Check for retryable status codes
  if (error.statusCode || error.status) {
    const statusCode = error.statusCode || error.status;
    if (config.retryableStatusCodes.includes(statusCode)) {
      return true;
    }
  }

  // Check for OpenAI-specific errors
  if (error.isCorruptedAssistant) {
    return true;
  }

  return false;
}

/**
 * Check if an error indicates that an Assistant should be recreated
 * @param {Error} error - The error to check
 * @returns {boolean} True if Assistant should be recreated
 */
function shouldRecreateAssistant(error) {
  if (!error) return false;

  const errorMessage = error.message || '';
  const errorString = errorMessage.toLowerCase();

  const recreateIndicators = [
    'corrupted',
    'vector store configuration not propagated',
    'tool_resources',
    'assistant not found',
    'assistant_id'
  ];

  for (const indicator of recreateIndicators) {
    if (errorString.includes(indicator.toLowerCase())) {
      return true;
    }
  }

  if (error.isCorruptedAssistant) {
    return true;
  }

  return false;
}

/**
 * Calculate delay for retry using exponential backoff
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {object} config - Retry configuration
 * @returns {number} Delay in milliseconds
 */
function calculateDelay(attempt, config = DEFAULT_RETRY_CONFIG) {
  const delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelay);
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - The function to retry (should return a Promise)
 * @param {object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {number} options.backoffMultiplier - Backoff multiplier (default: 2)
 * @param {Function} options.shouldRetry - Custom function to determine if should retry (optional)
 * @param {Function} options.onRetry - Callback called before each retry (optional)
 * @param {string} options.operationName - Name of the operation for logging (optional)
 * @returns {Promise} The result of the function
 */
async function retryWithBackoff(fn, options = {}) {
  const config = {
    ...DEFAULT_RETRY_CONFIG,
    ...options
  };

  const operationName = config.operationName || 'operation';
  let lastError;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) {
        logger.info({
          operation: operationName,
          attempt: attempt + 1,
          totalAttempts: attempt + 1
        }, `[retry-handler] ${operationName} succeeded after ${attempt} retries`);
      }
      return result;
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const shouldRetry = config.shouldRetry
        ? config.shouldRetry(error, attempt)
        : isRetryableError(error, config);

      if (!shouldRetry || attempt >= config.maxRetries) {
        if (attempt > 0) {
          logger.warn({
            operation: operationName,
            attempt: attempt + 1,
            totalAttempts: attempt + 1,
            error: {
              message: error.message,
              name: error.name
            }
          }, `[retry-handler] ${operationName} failed after ${attempt} retries`);
        }
        throw error;
      }

      // Calculate delay
      const delay = calculateDelay(attempt, config);

      // Call onRetry callback if provided
      if (config.onRetry) {
        config.onRetry(error, attempt, delay);
      }

      logger.debug({
        operation: operationName,
        attempt: attempt + 1,
        maxRetries: config.maxRetries,
        delay,
        error: {
          message: error.message,
          name: error.name
        }
      }, `[retry-handler] ${operationName} failed, retrying in ${delay}ms (attempt ${attempt + 1}/${config.maxRetries})`);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but just in case
  throw lastError;
}

/**
 * Retry with fixed delays (for specific use cases)
 * @param {Function} fn - The function to retry
 * @param {object} options - Retry options
 * @param {number[]} options.delays - Array of delays in ms for each retry
 * @param {Function} options.shouldRetry - Custom function to determine if should retry
 * @param {string} options.operationName - Name of the operation for logging
 * @returns {Promise} The result of the function
 */
async function retryWithFixedDelays(fn, options = {}) {
  const { delays = [1000, 2000, 3000], shouldRetry, operationName = 'operation' } = options;
  let lastError;

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) {
        logger.info({
          operation: operationName,
          attempt: attempt + 1,
          totalAttempts: attempt + 1
        }, `[retry-handler] ${operationName} succeeded after ${attempt} retries`);
      }
      return result;
    } catch (error) {
      lastError = error;

      const shouldRetryThis = shouldRetry ? shouldRetry(error, attempt) : isRetryableError(error);

      if (!shouldRetryThis || attempt >= delays.length) {
        if (attempt > 0) {
          logger.warn({
            operation: operationName,
            attempt: attempt + 1,
            totalAttempts: attempt + 1,
            error: {
              message: error.message,
              name: error.name
            }
          }, `[retry-handler] ${operationName} failed after ${attempt} retries`);
        }
        throw error;
      }

      const delay = delays[attempt] || delays[delays.length - 1];

      logger.debug({
        operation: operationName,
        attempt: attempt + 1,
        maxRetries: delays.length,
        delay,
        error: {
          message: error.message,
          name: error.name
        }
      }, `[retry-handler] ${operationName} failed, retrying in ${delay}ms (attempt ${attempt + 1}/${delays.length})`);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

module.exports = {
  retryWithBackoff,
  retryWithFixedDelays,
  isRetryableError,
  shouldRecreateAssistant,
  calculateDelay,
  DEFAULT_RETRY_CONFIG
};




