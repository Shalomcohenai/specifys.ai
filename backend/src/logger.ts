/**
 * Structured Logging Configuration
 * Uses Pino for fast, structured logging
 */

import pino from 'pino';
import { Request, Response } from 'express';

// Determine log level from environment or default to 'info'
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Create logger instance
export const logger = pino({
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

/**
 * Helper functions for common log operations
 */
export const logRequest = (req: Request, requestId: string): void => {
  logger.info({
    type: 'api_request',
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    origin: req.get('origin')
  }, `🌐 ${req.method} ${req.path}`);
};

export const logResponse = (req: Request, res: Response, requestId: string, duration: number): void => {
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
};

export const logError = (error: Error, context: Record<string, any> = {}): void => {
  logger.error({
    type: 'error',
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    },
    ...context
  }, `❌ Error: ${error.message}`);
};

export const logCORS = (origin: string, allowed: boolean, requestPath: string): void => {
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
};

export const logAuth = (event: string, userId: string | undefined, path: string, success: boolean): void => {
  const level = success ? 'info' : 'warn';
  logger[level]({
    type: 'authentication',
    event,
    userId,
    path,
    success
  }, `[Auth] ${success ? '✅' : '❌'} ${event} - ${path}`);
};


