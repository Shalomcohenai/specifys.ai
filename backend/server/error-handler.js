/**
 * Centralized Error Handler
 * Provides consistent error handling and error codes across the application
 */

const { logger } = require('./logger');

/**
 * Error codes for different error types
 */
const ERROR_CODES = {
  // Validation errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Authentication errors (401)
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Authorization errors (403)
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Not found errors (404)
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  ENDPOINT_NOT_FOUND: 'ENDPOINT_NOT_FOUND',
  
  // Conflict errors (409)
  CONFLICT: 'CONFLICT',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  
  // Server errors (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  
  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
};

/**
 * Error handler middleware for Express
 * Should be used as the last middleware
 */
function errorHandler(err, req, res, next) {
  const requestId = req.requestId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Log the error
  logger.error({
    type: 'error_handler',
    requestId,
    method: req.method,
    path: req.path,
    error: {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      code: err.code || err.errorCode
    },
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent')
  }, `Error handling request: ${req.method} ${req.path}`);

  // Determine status code
  let statusCode = err.statusCode || err.status || 500;
  
  // Determine error code
  let errorCode = err.errorCode || err.code || ERROR_CODES.INTERNAL_ERROR;
  
  // Determine error message
  let errorMessage = err.message || 'Internal server error';
  
  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    errorMessage = 'Internal server error';
  }

  // Build error response
  const errorResponse = {
    success: false,
    error: {
      code: errorCode,
      message: errorMessage,
      requestId
    },
    timestamp: new Date().toISOString()
  };

  // Add additional details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.details = err.details;
    errorResponse.error.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Create standardized error object
 */
function createError(message, code, statusCode = 500, details = null) {
  const error = new Error(message);
  error.errorCode = code;
  error.statusCode = statusCode;
  if (details) {
    error.details = details;
  }
  return error;
}

/**
 * Async error wrapper - wraps async route handlers to catch errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found handler - should be used after all routes
 */
function notFoundHandler(req, res, next) {
  const error = createError(
    `Route not found: ${req.method} ${req.path}`,
    ERROR_CODES.ENDPOINT_NOT_FOUND,
    404
  );
  next(error);
}

module.exports = {
  errorHandler,
  createError,
  asyncHandler,
  notFoundHandler,
  ERROR_CODES
};

