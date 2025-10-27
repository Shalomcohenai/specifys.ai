/**
 * Security Configuration for Specifys.ai Server
 * Includes security headers, rate limiting, and input validation
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');

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
        "https://www.gstatic.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com"
      ],
      styleSrc: [
        "'self'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://fonts.googleapis.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        "blob:"
      ],
      connectSrc: [
        "'self'",
        "https://*.firebaseio.com",
        "https://*.googleapis.com",
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com"
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdn.jsdelivr.net"
      ],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  
  // X-Frame-Options
  frameguard: { action: 'deny' },
  
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
    userInput: Joi.string().min(1).max(10000).required()
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
      return res.status(400).json({
        error: 'Invalid input',
        details: validation.error
      });
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
        return res.status(400).json({
          error: `Invalid parameter: ${param}`,
          details: validation.error
        });
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
      console.warn('🔒 Security Event:', securityLog);
    } else {
      console.log('📝 API Access:', securityLog);
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
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('🚨 Unauthorized admin access attempt from IP:', req.ip);
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Admin access requires valid authentication token'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    // Import Firebase Admin dynamically to avoid circular dependency
    const { auth } = require('./firebase-admin');
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // Check if user is admin
    const adminEmails = [
      'specifysai@gmail.com',
      'admin@specifys.ai', 
      'shalom@specifys.ai'
    ];
    
    if (!adminEmails.includes(decodedToken.email)) {
      console.warn('🚨 Non-admin user attempted admin access:', decodedToken.email, 'from IP:', req.ip);
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Admin access required'
      });
    }
    
    req.adminUser = decodedToken;
    console.log('✅ Admin access granted to:', decodedToken.email);
    next();
    
  } catch (error) {
    console.error('🚨 Admin authentication error:', error.message);
    return res.status(401).json({ 
      error: 'Invalid token',
      message: 'Authentication failed'
    });
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
