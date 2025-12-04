/**
 * Centralized Error Handler
 * Provides consistent error handling and error codes across the application
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

/**
 * Error codes for different error types
 */
export const ERROR_CODES = {
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
} as const;

export interface AppError extends Error {
  errorCode?: string;
  statusCode?: number;
  details?: any;
}

/**
 * Error handler middleware for Express
 * Should be used as the last middleware
 */
export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Enhanced error logging
  logger.error({
    type: 'error_handler',
    requestId,
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    url: req.url,
    query: req.query,
    params: req.params,
    error: {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      code: err.errorCode || (err as any).code,
      statusCode: err.statusCode || (err as any).status,
      details: err.details
    },
    errorType: err.name,
    errorMessage: err.message,
    errorCode: err.errorCode || (err as any).code,
    httpStatusCode: err.statusCode || (err as any).status || 500,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    origin: req.get('origin'),
    hasAuthHeader: !!req.headers.authorization,
    adminEmail: (req as any).adminUser?.email,
    adminUserId: (req as any).adminUser?.uid,
    timestamp: new Date().toISOString()
  }, `[error-handler] ❌ Error handling request: ${req.method} ${req.originalUrl} - ${err.message} (${err.statusCode || (err as any).status || 500})`);

  // Determine status code
  let statusCode = err.statusCode || (err as any).status || 500;
  
  // Determine error code
  let errorCode = err.errorCode || (err as any).code || ERROR_CODES.INTERNAL_ERROR;
  
  // Determine error message
  let errorMessage = err.message || 'Internal server error';
  
  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    errorMessage = 'Internal server error';
  }

  // Build error response
  const errorResponse: any = {
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
export function createError(message: string, code: string, statusCode: number = 500, details: any = null): AppError {
  const error = new Error(message) as AppError;
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
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found handler - should be used after all routes
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  const error = createError(
    `Route not found: ${req.method} ${req.path}`,
    ERROR_CODES.ENDPOINT_NOT_FOUND,
    404
  );
  next(error);
}

