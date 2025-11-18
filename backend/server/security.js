/**
 * Security Configuration for Specifys.ai Server
 * Includes security headers, rate limiting, and input validation
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const { isAdminEmail } = require('./admin-config');

/**
 * Configure security headers using Helmet
 */
const securityHeaders = helmet({
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
const rateLimiters = {
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
  }),

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
  }),

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
  }),

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
  }),

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
  })
};

/**
 * Input validation schemas
 */
const validationSchemas = {
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

/**
 * Validate input against schema
 * @param {Object} data - Data to validate
 * @param {Joi.Schema} schema - Joi schema
 * @returns {Object} - {isValid: boolean, value?: any, error?: string}
 */
function validateInput(data, schema) {
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
 * @param {Joi.Schema} schema - Joi schema
 * @returns {Function} - Express middleware
 */
function validateBody(schema) {
  return (req, res, next) => {
    const validation = validateInput(req.body, schema);
    
    if (!validation.isValid) {
      const { createError, ERROR_CODES } = require('./error-handler');
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
 * @param {Object} schemas - Object with parameter schemas
 * @returns {Function} - Express middleware
 */
function validateParams(schemas) {
  return (req, res, next) => {
    for (const [param, schema] of Object.entries(schemas)) {
      const validation = validateInput(req.params[param], schema);
      
      if (!validation.isValid) {
        const { createError, ERROR_CODES } = require('./error-handler');
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
 * @param {string} action - Action being performed
 * @returns {Function} - Express middleware
 */
function securityLogger(action) {
  return (req, res, next) => {
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

    } else {

    }

    next();
  };
}

/**
 * Admin authentication middleware
 * Verifies Firebase ID token and checks admin permissions
 * @param {Request} req 
 * @param {Response} res 
 * @param {Function} next 
 */
async function requireAdmin(req, res, next) {
  const { createError, ERROR_CODES } = require('./error-handler');
  const { logger } = require('./logger');
  
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn({ path: req.path }, '[security] Admin authentication required - no token');
      return next(createError('Authentication required', ERROR_CODES.UNAUTHORIZED, 401, {
        message: 'Admin access requires valid authentication token'
      }));
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Import Firebase Admin dynamically to avoid circular dependency
    const { auth } = require('./firebase-admin');
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // Check if user is admin using centralized config
    if (!isAdminEmail(decodedToken.email)) {
      logger.warn({ path: req.path, email: decodedToken.email }, '[security] Admin access denied');
      return next(createError('Forbidden', ERROR_CODES.FORBIDDEN, 403, {
        message: 'Admin access required'
      }));
    }
    
    logger.debug({ userId: decodedToken.uid, email: decodedToken.email, path: req.path }, '[security] Admin authenticated');
    req.adminUser = decodedToken;

    next();
    
  } catch (error) {
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

module.exports = {
  securityHeaders,
  rateLimiters,
  validationSchemas,
  validateInput,
  validateBody,
  validateParams,
  securityLogger,
  requireAdmin
};
