/**
 * Render Error Capture
 * Captures unhandled errors and rejections from the Node.js process
 * and saves them to Firebase for monitoring
 */

const { logger } = require('./logger');
const { logError } = require('./error-logger');

let isInitialized = false;

/**
 * Initialize error capture for unhandled errors
 */
function initializeErrorCapture() {
  if (isInitialized) {
    logger.warn('[render-error-capture] Error capture already initialized');
    return;
  }

  // Capture unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    const errorMessage = reason instanceof Error ? reason.message : String(reason);
    const errorStack = reason instanceof Error ? reason.stack : undefined;
    const errorName = reason instanceof Error ? reason.name : 'UnhandledRejection';
    
    logger.error({
      type: 'unhandled_rejection',
      error: {
        name: errorName,
        message: errorMessage,
        stack: errorStack
      },
      promise: promise ? 'Promise rejected' : 'Unknown promise'
    }, '[render-error-capture] ❌ Unhandled Promise Rejection');

    // Save to Firebase
    logError(
      'unhandled_rejection',
      errorMessage,
      'UNHANDLED_REJECTION',
      null,
      'server',
      {
        errorName,
        stack: errorStack,
        source: 'process_unhandledRejection',
        timestamp: new Date().toISOString()
      }
    ).catch(err => {
      logger.error({ error: err.message }, '[render-error-capture] Failed to save unhandled rejection to Firebase');
    });
  });

  // Capture uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error({
      type: 'uncaught_exception',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    }, '[render-error-capture] ❌ Uncaught Exception');

    // Save to Firebase
    logError(
      'uncaught_exception',
      error.message,
      'UNCAUGHT_EXCEPTION',
      null,
      'server',
      {
        errorName: error.name,
        stack: error.stack,
        source: 'process_uncaughtException',
        timestamp: new Date().toISOString()
      }
    ).catch(err => {
      logger.error({ error: err.message }, '[render-error-capture] Failed to save uncaught exception to Firebase');
    });

    // Exit process after logging (uncaught exceptions are fatal)
    // Give time for Firebase write to complete
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Capture warnings (optional - can be noisy)
  if (process.env.LOG_WARNINGS === 'true') {
    process.on('warning', (warning) => {
      logger.warn({
        type: 'process_warning',
        warning: {
          name: warning.name,
          message: warning.message,
          stack: warning.stack
        }
      }, '[render-error-capture] ⚠️ Process Warning');

      // Save to Firebase (as warning, not error)
      logError(
        'process_warning',
        warning.message,
        'PROCESS_WARNING',
        null,
        'server',
        {
          warningName: warning.name,
          stack: warning.stack,
          source: 'process_warning',
          timestamp: new Date().toISOString()
        }
      ).catch(err => {
        logger.error({ error: err.message }, '[render-error-capture] Failed to save warning to Firebase');
      });
    });
  }

  isInitialized = true;
  logger.info('[render-error-capture] ✅ Error capture initialized');
}

module.exports = {
  initializeErrorCapture
};

