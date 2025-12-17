/**
 * Structured Logging Configuration
 * Uses Pino for fast, structured logging
 * Also saves important logs to Firestore for admin dashboard
 */

const pino = require('pino');
const { saveRenderLog } = require('./render-logger');

// Determine log level from environment or default to 'info'
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Create base Pino logger
const baseLogger = pino({
  level: logLevel,
  transport: process.env.NODE_ENV === 'production' 
    ? undefined // In production, use default JSON output
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          singleLine: false
        }
      },
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    env: process.env.NODE_ENV || 'development',
    service: 'specifys-backend'
  }
});

// Wrap logger to intercept logs and save to Firestore
const logger = {
  error: (obj, msg) => {
    baseLogger.error(obj, msg);
    // Save to Firestore asynchronously (don't await to avoid blocking)
    saveRenderLog('error', obj, msg).catch(() => {
      // Silently fail - don't break logging
    });
  },
  warn: (obj, msg) => {
    baseLogger.warn(obj, msg);
    // Save to Firestore asynchronously
    saveRenderLog('warn', obj, msg).catch(() => {
      // Silently fail - don't break logging
    });
  },
  info: (obj, msg) => {
    baseLogger.info(obj, msg);
  },
  debug: (obj, msg) => {
    baseLogger.debug(obj, msg);
  },
  trace: (obj, msg) => {
    baseLogger.trace(obj, msg);
  },
  child: (bindings) => {
    return baseLogger.child(bindings);
  },
  level: baseLogger.level,
  levels: baseLogger.levels
};

/**
 * Helper functions for common log operations
 */
const logHelpers = {
  /**
   * Log API request
   */
  logRequest: (req, requestId) => {
    logger.info({
      type: 'api_request',
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      origin: req.get('origin')
    }, `🌐 ${req.method} ${req.path}`);
  },

  /**
   * Log API response
   */
  logResponse: (req, res, requestId, duration) => {
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    const emoji = res.statusCode >= 500 ? '❌' : res.statusCode >= 400 ? '⚠️' : '✅';
    
    logger[level]({
      type: 'api_response',
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration
    }, `${emoji} ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  },

  /**
   * Log error
   */
  logError: (error, context = {}) => {
    logger.error({
      type: 'error',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      ...context
    }, `❌ Error: ${error.message}`);
  },

  /**
   * Log CORS event
   */
  logCORS: (origin, allowed, requestPath) => {
    if (allowed) {
      logger.debug({
        type: 'cors',
        origin,
        allowed: true,
        path: requestPath
      }, `[CORS] ✅ Allowed origin: ${origin}`);
    } else {
      logger.warn({
        type: 'cors',
        origin,
        allowed: false,
        path: requestPath
      }, `[CORS] ⚠️  Origin not in allowed list: ${origin} - using fallback '*'`);
    }
  },

  /**
   * Log authentication event
   */
  logAuth: (event, userId, path, success) => {
    const level = success ? 'info' : 'warn';
    logger[level]({
      type: 'authentication',
      event,
      userId,
      path,
      success
    }, `[Auth] ${success ? '✅' : '❌'} ${event} - ${path}`);
  }
};

module.exports = {
  logger,
  ...logHelpers
};

