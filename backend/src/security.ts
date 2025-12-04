/**
 * Security Configuration for Specifys.ai Server
 * Includes security headers, rate limiting, and input validation
 */

import helmet from 'helmet';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { isAdminEmail } from './admin-config';
import { createError, ERROR_CODES } from './error-handler';
import { logger } from './logger';

/**
 * Configure security headers using Helmet
 */
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",  // Allow inline scripts (Firebase init, Analytics)
        "https://www.gstatic.com",
        "https://www.googletagmanager.com",  // Google Tag Manager
        "https://www.google-analytics.com",  // Google Analytics
        "https://ssl.google-analytics.com",  // Google Analytics SSL
        "https://googleads.g.doubleclick.net",  // Google Ads
        "https://www.googleadservices.com",  // Google Ad Services
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://accounts.google.com",  // Google Sign-In
        "https://apis.google.com"  // Google APIs (for Sign-In)
      ],
      scriptSrcAttr: ["'unsafe-inline'"],  // Allow inline event handlers (onclick, etc.)
      styleSrc: [
        "'self'",
        "'unsafe-inline'",  // Allow inline styles
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com",
        "https://accounts.google.com"  // Google Sign-In styles
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:",  // Allow all HTTPS images (needed for user avatars, etc.)
        "blob:",
        "https://www.google-analytics.com",
        "https://www.googletagmanager.com",
        "https://googleads.g.doubleclick.net"
      ],
      connectSrc: [
        "'self'",
        "https://*.firebaseio.com",
        "https://*.googleapis.com",
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "https://www.gstatic.com",  // For source maps
        "https://cdnjs.cloudflare.com",  // For source maps
        "https://accounts.google.com",  // Google Sign-In API
        "https://apis.google.com",  // Google APIs
        "https://www.google-analytics.com",  // Google Analytics
        "https://analytics.google.com",  // Google Analytics v4
        "https://www.google.com",  // Google services
        "https://stats.g.doubleclick.net",  // Google Ads tracking
        "https://googleads.g.doubleclick.net"  // Google Ads
      ],
      fontSrc: [
        "'self'",
        "data:",  // Allow data: URIs for fonts
        "https://fonts.gstatic.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com"
      ],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: [
        "'self'",
        "https://accounts.google.com",  // Google Sign-In iframe
        "https://apis.google.com",  // Google APIs iframe
        "https://www.googletagmanager.com",  // Google Tag Manager
        "https://td.doubleclick.net",  // Google Ads iframes
        "https://specify-ai.firebaseapp.com",  // Firebase Auth popup
        "https://*.firebaseapp.com"  // All Firebase Auth domains
      ]
    }
  },
  
  // X-Frame-Options - allow same origin
  frameguard: { action: 'sameorigin' },
  
  // X-Content-Type-Options
  noSniff: true,
  
  // Referrer Policy
  referrerPolicy: { policy: 'same-origin' },
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  
  // X-XSS-Protection
  xssFilter: true,
  
  // Hide X-Powered-By header
  hidePoweredBy: true
});

/**
 * Rate limiting configurations
 */
export const rateLimiters = {
  // General API rate limiting
  general: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
  }) as RateLimitRequestHandler,

  // Strict rate limiting for admin endpoints
  admin: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 requests per windowMs
    message: {
      error: 'Too many admin requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
  }) as RateLimitRequestHandler,

  // Very strict rate limiting for authentication endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: {
      error: 'Too many authentication attempts from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
  }) as RateLimitRequestHandler,

  // Feedback rate limiting
  feedback: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // limit each IP to 10 feedback submissions per hour
    message: {
      error: 'Too many feedback submissions from this IP, please try again later.',
      retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false
  }) as RateLimitRequestHandler,

  // Rate limiting for generation endpoints
  generation: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each IP to 5 generation requests per hour
    message: {
      error: 'Too many generation requests from this IP, please try again later.',
      retryAfter: '1 hour'
    },
    standardHeaders: true,
    legacyHeaders: false
  }) as RateLimitRequestHandler,

  // Rate limiting for credit consumption (prevent abuse)
  creditConsumption: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // limit each IP to 5 requests per minute
    message: {
      error: 'Too many credit consumption requests from this IP, please try again later.',
      retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false, // Count all requests, even successful ones
  }) as RateLimitRequestHandler
};

/**
 * Input validation schemas
 */
export const validationSchemas = {
  feedback: Joi.object({
    email: Joi.string().email().max(255),
    feedback: Joi.string().min(1).max(5000).required(),
    type: Joi.string().valid('bug', 'feature', 'general', 'security').default('general'),
    source: Joi.string().max(100).default('website')
  }),

  generateSpec: Joi.object({
    userInput: Joi.string().min(1).max(50000).required()
  }),

  userId: Joi.string().min(1).max(255).required()
};

export interface ValidationResult {
  isValid: boolean;
  value?: any;
  error?: string;
}

/**
 * Validate input against schema
 */
export function validateInput(data: any, schema: Joi.Schema): ValidationResult {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    return {
      isValid: false,
      error: error.details.map(detail => detail.message).join(', ')
    };
  }

  return {
    isValid: true,
    value
  };
}

/**
 * Middleware to validate request body
 */
export function validateBody(schema: Joi.Schema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const validation = validateInput(req.body, schema);
    
    if (!validation.isValid) {
      return next(createError('Invalid input', ERROR_CODES.VALIDATION_ERROR, 400, {
        details: validation.error
      }));
    }

    req.body = validation.value;
    next();
  };
}

/**
 * Middleware to validate request parameters
 */
export function validateParams(schemas: Record<string, Joi.Schema>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    for (const [param, schema] of Object.entries(schemas)) {
      const validation = validateInput(req.params[param], schema);
      
      if (!validation.isValid) {
        return next(createError(`Invalid parameter: ${param}`, ERROR_CODES.VALIDATION_ERROR, 400, {
          details: validation.error
        }));
      }

      req.params[param] = validation.value;
    }

    next();
  };
}

/**
 * Security logging middleware
 */
export function securityLogger(action: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const securityLog = {
      timestamp: new Date().toISOString(),
      action: action,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      method: req.method
    };

    // Log suspicious activity
    if (action.includes('admin') || action.includes('delete')) {
      logger.warn(securityLog, `[security] Suspicious activity: ${action}`);
    } else {
      logger.debug(securityLog, `[security] Security event: ${action}`);
    }

    next();
  };
}

/**
 * Admin authentication middleware
 * Verifies Firebase ID token and checks admin permissions
 */
export async function requireAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  logger.info({
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    url: req.url,
    hasAuthHeader: !!req.headers.authorization,
    authHeaderLength: req.headers.authorization ? req.headers.authorization.length : 0,
    authHeaderPrefix: req.headers.authorization ? req.headers.authorization.substring(0, 20) + '...' : 'none',
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString()
  }, '[security] 🔐 requireAdmin middleware - Starting authentication check');
  
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn({ 
        path: req.path,
        originalUrl: req.originalUrl,
        method: req.method,
        hasAuthHeader: !!authHeader,
        authHeaderValue: authHeader ? authHeader.substring(0, 30) + '...' : 'none',
        ip: req.ip || req.connection.remoteAddress
      }, '[security] ⚠️ Admin authentication required - no valid token');
      return next(createError('Authentication required', ERROR_CODES.UNAUTHORIZED, 401, {
        message: 'Admin access requires valid authentication token'
      }));
    }

    const idToken = authHeader.split('Bearer ')[1];
    logger.debug({
      tokenLength: idToken.length,
      tokenPrefix: idToken.substring(0, 20) + '...',
      path: req.path
    }, '[security] 🔑 Extracted token, verifying with Firebase...');
    
    // Import Firebase Admin dynamically to avoid circular dependency
    const { auth } = await import('./firebase-admin');
    const decodedToken = await auth.verifyIdToken(idToken);
    
    logger.info({
      userId: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      authTime: decodedToken.auth_time,
      exp: decodedToken.exp,
      iat: decodedToken.iat,
      path: req.path
    }, '[security] ✅ Token verified successfully - checking admin status');
    
    // Check if user is admin using centralized config
    const isAdmin = isAdminEmail(decodedToken.email || '');
    logger.debug({
      email: decodedToken.email,
      isAdmin,
      path: req.path
    }, `[security] ${isAdmin ? '✅' : '❌'} Admin check result`);
    
    if (!isAdmin) {
      logger.warn({ 
        path: req.path, 
        email: decodedToken.email,
        userId: decodedToken.uid,
        ip: req.ip || req.connection.remoteAddress
      }, '[security] 🚫 Admin access denied - user is not admin');
      return next(createError('Forbidden', ERROR_CODES.FORBIDDEN, 403, {
        message: 'Admin access required'
      }));
    }
    
    logger.info({ 
      userId: decodedToken.uid, 
      email: decodedToken.email, 
      path: req.path 
    }, '[security] ✅ Admin authenticated successfully');
    (req as any).adminUser = decodedToken;

    next();
    
  } catch (error: any) {
    logger.error({ 
      path: req.path,
      error: {
        message: error?.message,
        code: error?.code,
        stack: error?.stack
      }
    }, '[security] Admin token verification failed');
    return next(createError('Invalid token', ERROR_CODES.INVALID_TOKEN, 401, {
      message: error?.message || 'Authentication failed'
    }));
  }
}

