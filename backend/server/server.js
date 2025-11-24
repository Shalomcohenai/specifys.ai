const path = require('path');
const express = require('express');
// Use built-in fetch for Node.js 18+ or fallback to node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
  // Node.js 18+ has built-in fetch (used in Render)
  fetch = globalThis.fetch;
} else {
  // Fallback for older Node versions
  fetch = require('node-fetch');
}
const dotenv = require('dotenv');
const config = require('./config');
const blogRoutes = require('./blog-routes');
const blogRoutesPublic = require('./blog-routes-public');
const adminRoutes = require('./admin-routes');
const lemonRoutes = require('./lemon-routes');
const creditsRoutes = require('./credits-routes');
const healthRoutes = require('./health-routes');
const { requireAdmin, securityHeaders, rateLimiters } = require('./security');
const { logError, getErrorLogs, getErrorSummary } = require('./error-logger');
const { logCSCCrash, getCSCCrashLogs, getCSCCrashSummary } = require('./css-crash-logger');
const { errorHandler, notFoundHandler, createError, ERROR_CODES } = require('./error-handler');
const { logger, logRequest, logResponse } = require('./logger');
const { syncAllUsers } = require('./user-management');

// Load environment variables BEFORE importing route modules
// Try backend/.env first (preferred), then project root .env, then server/.env
const backendEnvPath = path.join(__dirname, '..', '.env');
const rootEnvPath = path.join(__dirname, '..', '..', '.env');
const serverEnvPath = path.join(__dirname, '.env');
let loadedEnvPath = null;

logger.info({
  type: 'env_loading_start',
  paths: {
    backend: backendEnvPath,
    root: rootEnvPath,
    server: serverEnvPath
  }
}, '[UNIFIED SERVER] 🔍 Loading environment variables...');

if (dotenv.config({ path: backendEnvPath }).parsed) {
  loadedEnvPath = backendEnvPath;
  logger.info({ type: 'env_loaded', path: loadedEnvPath }, '[UNIFIED SERVER] ✅ Environment variables loaded from backend/.env');
} else if (dotenv.config({ path: rootEnvPath }).parsed) {
  loadedEnvPath = rootEnvPath;
  logger.info({ type: 'env_loaded', path: loadedEnvPath }, '[UNIFIED SERVER] ✅ Environment variables loaded from project root .env');
} else if (dotenv.config({ path: serverEnvPath }).parsed) {
  loadedEnvPath = serverEnvPath;
  logger.info({ type: 'env_loaded', path: loadedEnvPath }, '[UNIFIED SERVER] ✅ Environment variables loaded from server/.env');
} else {
  // Final fallback to default lookup (CWD)
  dotenv.config();
  logger.warn({ type: 'env_fallback' }, '[UNIFIED SERVER] ⚠️ Using default environment variable lookup (CWD)');
}

// Clear require cache for development
delete require.cache[require.resolve('./chat-routes')];
delete require.cache[require.resolve('./openai-storage-service')];

const app = express();
const port = config.port;

logger.info({
  type: 'server_init',
  port,
  configPort: config.port,
  nodeEnv: process.env.NODE_ENV || 'development'
}, '[UNIFIED SERVER] 🚀 Initializing unified server...');

// Trust proxy for rate limiting behind reverse proxy (Render, etc.)
// Trust only first proxy (Render) to avoid rate limit bypass warnings
app.set('trust proxy', 1);
logger.info({ type: 'trust_proxy_set' }, '[UNIFIED SERVER] ✅ Trust proxy enabled (for Render reverse proxy)');

// Apply security headers (must be before other middleware)
app.use(securityHeaders);
logger.info({ type: 'security_headers_applied' }, '[UNIFIED SERVER] ✅ Security headers applied');

// CORS middleware to allow requests from your frontend
// Must be before routes and rate limiting
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:4000',
  'http://localhost:8080',
  'http://localhost:10000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4000',
  'https://specifys-ai.com',
  'https://www.specifys-ai.com',
  'https://specifys-ai.onrender.com',
  process.env.RENDER_URL ? `https://${process.env.RENDER_URL}` : null
].filter(Boolean);

logger.info({ 
  type: 'cors_setup',
  allowedOriginsCount: allowedOrigins.length,
  allowedOrigins: allowedOrigins.slice(0, 5) // Log first 5 for brevity
}, '[UNIFIED SERVER] 📌 Setting up CORS middleware...');

app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Log CORS decisions for API routes (but not too verbose)
  if (req.path.startsWith('/api/') && req.method !== 'OPTIONS') {
    if (origin && allowedOrigins.includes(origin)) {
      logger.debug({ type: 'cors_allowed', origin, path: req.path }, '[UNIFIED SERVER] ✅ CORS: Allowed origin');
    } else if (origin) {
      logger.warn({ type: 'cors_blocked', origin, path: req.path }, '[UNIFIED SERVER] ⚠️ CORS: Origin not in allowed list');
    }
  }
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Bearer');
  res.header('Access-Control-Expose-Headers', 'Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});
logger.info({ type: 'cors_applied' }, '[UNIFIED SERVER] ✅ CORS middleware applied');

// Lemon Squeezy routes must be registered BEFORE express.json() and rate limiting
// to allow webhook endpoint to access raw body for signature verification
// and to avoid rate limiting issues
logger.info({ type: 'route_mount', path: '/api/lemon', route: 'lemonRoutes' }, '[UNIFIED SERVER] 📌 Mounting Lemon Squeezy routes');
app.use('/api/lemon', lemonRoutes);
logger.info({ type: 'route_mounted', path: '/api/lemon' }, '[UNIFIED SERVER] ✅ Lemon Squeezy routes mounted');

// Apply rate limiting (after lemon routes so they're excluded)
logger.info({ type: 'rate_limiting_setup' }, '[UNIFIED SERVER] 📌 Setting up rate limiting...');
app.use('/api/', (req, res, next) => {
  // Skip rate limiting for lemon routes (already handled above)
  if (req.path.startsWith('/lemon')) {
    return next();
  }
  rateLimiters.general(req, res, next);
});
app.use('/api/auth/', rateLimiters.auth);
app.use('/api/feedback', rateLimiters.feedback);
logger.info({ type: 'rate_limiting_applied' }, '[UNIFIED SERVER] ✅ Rate limiting applied');

// Middleware to parse JSON bodies (registered after lemon routes)
app.use(express.json());
logger.info({ type: 'json_parser_applied' }, '[UNIFIED SERVER] ✅ JSON body parser applied');

// Request logging middleware (using structured logger)
app.use((req, res, next) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  // Store requestId in request object for use in route handlers
  req.requestId = requestId;
  
  // Log request start (only for API routes)
  if (req.path.startsWith('/api/')) {
    logRequest(req, requestId);
  }
  
  // Log response when it finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (req.path.startsWith('/api/')) {
      logResponse(req, res, requestId, duration);
    }
  });
  
  next();
});


// Admin error logs endpoint
app.get('/api/admin/error-logs', requireAdmin, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const errorType = req.query.errorType || null;

    const logs = await getErrorLogs(limit, errorType);

    res.json({
      success: true,
      logs,
      total: logs.length
    });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error fetching error logs');
    next(createError('Failed to get error logs', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

// CSS crash logs endpoint - POST to receive logs
app.post('/api/admin/css-crash-logs', async (req, res, next) => {
  try {
    const { log } = req.body;

    if (!log || !log.crashType) {
      return next(createError('Invalid crash log data', ERROR_CODES.VALIDATION_ERROR, 400));
    }

    await logCSCCrash(log);

    res.json({
      success: true,
      message: 'CSS crash log saved'
    });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error saving CSS crash log');
    next(createError('Failed to save CSS crash log', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

// General application logs endpoint - POST to receive logs
app.post('/api/logs', async (req, res, next) => {
  try {
    const { logType, message, data, pageInfo } = req.body;

    if (!logType || !message) {
      return next(createError('logType and message are required', ERROR_CODES.VALIDATION_ERROR, 400));
    }

    // Log to server console
    const logData = {
      timestamp: new Date().toISOString(),
      logType,
      message,
      data: data || {},
      pageInfo: pageInfo || {},
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    };

    // Use appropriate log level based on logType
    if (logType.includes('error') || logType.includes('Error')) {
      logger.error(logData, `[CLIENT LOG] ${message}`);
    } else if (logType.includes('warn') || logType.includes('Warning')) {
      logger.warn(logData, `[CLIENT LOG] ${message}`);
    } else {
      logger.info(logData, `[CLIENT LOG] ${message}`);
    }

    res.json({
      success: true,
      message: 'Log saved'
    });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error saving application log');
    next(createError('Failed to save log', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

// CSS crash logs endpoint - GET to retrieve logs
app.get('/api/admin/css-crash-logs', requireAdmin, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const crashType = req.query.crashType || null;
    const url = req.query.url || null;

    const logs = await getCSCCrashLogs(limit, crashType, url);

    res.json({
      success: true,
      logs,
      total: logs.length
    });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error fetching CSS crash logs');
    next(createError('Failed to get CSS crash logs', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

// CSS crash summary endpoint
app.get('/api/admin/css-crash-summary', requireAdmin, async (req, res, next) => {
  try {
    const summary = await getCSCCrashSummary();

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error fetching CSS crash summary');
    next(createError('Failed to get CSS crash summary', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

// Error summary endpoint
app.get('/api/admin/error-summary', requireAdmin, async (req, res, next) => {
  try {
    const summary = await getErrorSummary();

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error fetching error summary');
    next(createError('Failed to get error summary', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

// User routes for user management (must be before static files)
logger.info({ type: 'route_mount', path: '/api/users', route: 'userRoutes' }, '[UNIFIED SERVER] 📌 Mounting user routes');
const userRoutes = require('./user-routes');
app.use('/api/users', userRoutes);
logger.info({ type: 'route_mounted', path: '/api/users' }, '[UNIFIED SERVER] ✅ User routes mounted');

// Specs routes for spec management
logger.info({ type: 'route_mount', path: '/api/specs', route: 'specsRoutes' }, '[UNIFIED SERVER] 📌 Mounting specs routes');
const specsRoutes = require('./specs-routes');
app.use('/api/specs', specsRoutes);
logger.info({ type: 'route_mounted', path: '/api/specs' }, '[UNIFIED SERVER] ✅ Specs routes mounted');

// Credits routes for credit management
logger.info({ type: 'route_mount', path: '/api/credits', route: 'creditsRoutes' }, '[UNIFIED SERVER] 📌 Mounting credits routes');
app.use('/api/credits', creditsRoutes);
logger.info({ type: 'route_mounted', path: '/api/credits' }, '[UNIFIED SERVER] ✅ Credits routes mounted');

// Chat routes for AI chat functionality
logger.info({ type: 'route_mount', path: '/api/chat', route: 'chatRoutes' }, '[UNIFIED SERVER] 📌 Mounting chat routes');
const chatRoutes = require('./chat-routes');
app.use('/api/chat', chatRoutes);
logger.info({ type: 'route_mounted', path: '/api/chat' }, '[UNIFIED SERVER] ✅ Chat routes mounted');

// Blog routes (must be before static files to avoid conflicts)
// Public routes - no authentication required (returns only published posts)
app.get('/api/blog/public/posts', blogRoutesPublic.listPublishedPosts);
app.get('/api/blog/public/post', blogRoutesPublic.getPublishedPost);
// Admin routes - require authentication
app.post('/api/blog/create-post', requireAdmin, blogRoutes.createPost);
app.get('/api/blog/list-posts', requireAdmin, blogRoutes.listPosts);
app.get('/api/blog/get-post', requireAdmin, blogRoutes.getPost);
app.post('/api/blog/update-post', requireAdmin, blogRoutes.updatePost);
app.post('/api/blog/delete-post', requireAdmin, blogRoutes.deletePost);

// Admin routes (must be after specific admin endpoints, with rate limiting)
// Enhanced logging for route mounting
logger.info({
  timestamp: new Date().toISOString(),
  action: 'mounting_admin_routes',
  path: '/api/admin',
  hasRateLimiter: true,
  hasAdminRoutes: !!adminRoutes,
  adminRoutesType: typeof adminRoutes,
  adminRoutesStackLength: adminRoutes?.stack?.length || 0
}, '[server] 🔵 Mounting admin routes at /api/admin');

// Log all registered routes before mounting
if (adminRoutes && adminRoutes.stack) {
  logger.info('[server] 📋 Admin routes to be mounted:');
  adminRoutes.stack.forEach((layer, index) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
      logger.info(`[server]   ${index + 1}. ${methods} ${layer.route.path}`);
    } else if (layer.name === 'router') {
      logger.info(`[server]   ${index + 1}. [Router middleware: ${layer.regexp}]`);
    }
  });
}

// Enhanced logging middleware for all admin requests
app.use('/api/admin', (req, res, next) => {
  const requestId = req.requestId || `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.requestId = requestId;
  
  logger.info({
    requestId,
    type: 'admin_request_start',
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    url: req.url,
    query: req.query,
    params: req.params,
    hasBody: !!req.body,
    bodySize: req.body ? JSON.stringify(req.body).length : 0,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    origin: req.get('origin'),
    referer: req.get('referer'),
    hasAuthHeader: !!req.headers.authorization,
    authHeaderLength: req.headers.authorization ? req.headers.authorization.length : 0,
    authHeaderPrefix: req.headers.authorization ? req.headers.authorization.substring(0, 20) + '...' : 'none',
    contentType: req.get('content-type'),
    accept: req.get('accept'),
    timestamp: new Date().toISOString()
  }, `[server] 🔵 Admin request received: ${req.method} ${req.originalUrl}`);
  
  // Log response when it finishes
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info({
      requestId,
      type: 'admin_request_end',
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    }, `[server] ${res.statusCode >= 500 ? '❌' : res.statusCode >= 400 ? '⚠️' : '✅'} Admin request completed: ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
}, rateLimiters.admin, adminRoutes);

// Health check routes
logger.info({ type: 'route_mount', path: '/api/health', route: 'healthRoutes' }, '[UNIFIED SERVER] 📌 Mounting health check routes');
app.use('/api/health', healthRoutes);
logger.info({ type: 'route_mounted', path: '/api/health' }, '[UNIFIED SERVER] ✅ Health check routes mounted');

// Basic route for server status
logger.info({ type: 'route_register', method: 'GET', path: '/api/status' }, '[UNIFIED SERVER] 📌 Registering server status endpoint');
app.get('/api/status', (req, res) => {
  res.status(200).json({ message: 'Server is running' });
});
logger.info({ type: 'route_registered', method: 'GET', path: '/api/status' }, '[UNIFIED SERVER] ✅ Server status endpoint registered');

// Endpoint to sync users from Firebase Auth to Firestore (admin only)
logger.info({ type: 'route_register', method: 'POST', path: '/api/sync-users' }, '[UNIFIED SERVER] 📌 Registering user sync endpoint');
app.post('/api/sync-users', requireAdmin, async (req, res, next) => {
  try {
    const options = req.body && typeof req.body === 'object' ? req.body : {};
    const dryRun = options.dryRun === true;
    const summary = await syncAllUsers({
      ensureEntitlements: options.ensureEntitlements !== false,
      includeDataCollections: options.includeDataCollections !== false,
      dryRun,
      recordResult: !dryRun
    });

    res.json({
      success: true,
      dryRun,
      summary
    });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error syncing users');
    next(createError('Failed to sync users', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

// Feedback endpoint (with rate limiting)
app.post('/api/feedback', rateLimiters.feedback, async (req, res, next) => {
  const { email, feedback, type, source } = req.body;

  if (!feedback) {
    return next(createError('Feedback text is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
  }

  try {
    // 1. Send email notification
    await sendFeedbackEmail(email, feedback);
    
    // 2. Save to Google Sheets via Google Apps Script
    await saveToGoogleSheets(email, feedback, type, source);
    
    res.json({ success: true, message: 'Feedback submitted successfully' });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error processing feedback');
    next(createError('Failed to process feedback', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500));
  }
});

// Contact Us endpoint (with rate limiting)
app.post('/api/contact', rateLimiters.feedback, async (req, res, next) => {
  const { email, message, userId, userName, timestamp } = req.body;

  if (!email || !message) {
    return next(createError('Email and message are required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
  }

  try {
    const { db, admin } = require('./firebase-admin');
    
    // Save contact form submission to Firebase
    const contactDoc = {
      email: email.trim(),
      message: message.trim(),
      userId: userId || null,
      userName: userName || null,
      status: 'new',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      timestamp: timestamp || new Date().toISOString()
    };
    
    await db.collection('contactSubmissions').add(contactDoc);
    
    logger.info({ 
      email, 
      userId, 
      hasMessage: !!message 
    }, 'Contact form submission saved to Firebase');
    
    res.json({ success: true, message: 'Contact form submitted successfully' });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error processing contact form');
    next(createError('Failed to process contact form', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

// Function to send feedback email
async function sendFeedbackEmail(email, feedback) {
  try {
    // Check if email configuration is available
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_APP_PASSWORD;
    const feedbackEmail = process.env.FEEDBACK_EMAIL;
    
    if (emailUser && emailPassword && feedbackEmail) {
      // Use Nodemailer to send email
      const nodemailer = require('nodemailer');
      
      const transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPassword
        }
      });
      
      const mailOptions = {
        from: emailUser,
        to: feedbackEmail,
        subject: 'New Feedback from Specifys.ai',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0078d4;">📝 New Feedback Received</h2>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>📧 User Email:</strong> ${email || 'Not provided'}</p>
              <p><strong>🕒 Time:</strong> ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}</p>
              <p><strong>📱 Source:</strong> Specifys.ai Try Page</p>
            </div>
            <div style="background: #fff; padding: 20px; border-left: 4px solid #0078d4; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">Feedback Content:</h3>
              <p style="color: #555; line-height: 1.6; white-space: pre-wrap;">${feedback}</p>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">This email was automatically generated by the Specifys.ai feedback system.</p>
          </div>
        `
      };
      
      const info = await transporter.sendMail(mailOptions);
      
    } else {
      // Fallback: log to console
    }
    
  } catch (error) {

    // Don't fail the entire request if email fails
  }
}

// Function to save feedback to Google Sheets via Google Apps Script
async function saveToGoogleSheets(email, feedback, type, source) {
  try {
    // Use the Google Apps Script URL from config
    const googleAppsScriptUrl = config.googleAppsScriptUrl;
    
    const response = await fetch(googleAppsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email || 'Not provided',
        feedback: feedback,
        type: type || 'general',
        source: source || 'specifys-ai-website'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Google Apps Script error: ${response.status}`);
    }
    
    const result = await response.json();

    
  } catch (error) {

    // Don't fail the entire request if Sheets fails
    console.error('Failed to save feedback to Google Sheets:', error.message);
  }
}

// Endpoint for generating specifications via Cloudflare Worker
app.post('/api/generate-spec', rateLimiters.generation, async (req, res, next) => {
  const requestId = req.requestId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  console.log(`[${requestId}] ===== /api/generate-spec REQUEST START (server.js) =====`);
  console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
  console.log(`[${requestId}] IP: ${req.ip || req.connection.remoteAddress}`);
  console.log(`[${requestId}] User-Agent: ${req.headers['user-agent'] || 'N/A'}`);
  console.log(`[${requestId}] Request Body:`, {
    hasUserInput: !!req.body.userInput,
    userInputLength: req.body.userInput?.length || 0,
    userInputPreview: req.body.userInput?.substring(0, 200) || 'N/A'
  });

  const { userInput } = req.body;

  if (!userInput) {
    logger.warn({ requestId }, 'Validation failed: userInput is missing');
    return next(createError('User input is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
  }

  try {
    // Convert userInput to Cloudflare Worker format
    // Worker expects: { stage: "overview", prompt: { system, developer, user } }
    const workerPayload = {
      stage: 'overview',
      locale: 'en-US',
      prompt: {
        system: 'You are an expert application specification generator. Generate detailed, comprehensive specifications based on user requirements.',
        developer: 'Return ONLY valid JSON (no text/markdown). Top-level key MUST be overview. Follow the exact structure specified in the user prompt.',
        user: userInput
      }
    };

    console.log(`[${requestId}] 📤 Preparing request to Cloudflare Worker`);
    console.log(`[${requestId}] Worker URL: https://spspec.shalom-cohen-111.workers.dev/generate`);
    console.log(`[${requestId}] Worker Payload:`, {
      stage: workerPayload.stage,
      locale: workerPayload.locale,
      promptSystemLength: workerPayload.prompt.system.length,
      promptDeveloperLength: workerPayload.prompt.developer.length,
      promptUserLength: workerPayload.prompt.user.length,
      promptUserPreview: workerPayload.prompt.user.substring(0, 200)
    });

    const workerRequestStart = Date.now();

    // Forward request to Cloudflare Worker
    let response;
    try {
      console.log(`[${requestId}] 🔄 Attempting to fetch from Cloudflare Worker...`);
      response = await fetch('https://spspec.shalom-cohen-111.workers.dev/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workerPayload),
      });
      console.log(`[${requestId}] ✅ Fetch completed successfully`);
    } catch (fetchError) {
      console.error(`[${requestId}] ❌ Fetch failed:`, {
        message: fetchError.message,
        name: fetchError.name,
        stack: fetchError.stack,
        cause: fetchError.cause
      });
      throw new Error(`Failed to connect to Cloudflare Worker: ${fetchError.message}`);
    }

    const workerRequestTime = Date.now() - workerRequestStart;
    console.log(`[${requestId}] ⏱️  Worker request took ${workerRequestTime}ms`);
    console.log(`[${requestId}] 📥 Worker Response Status: ${response.status} ${response.statusText}`);
    console.log(`[${requestId}] Worker Response Headers:`, {
      'content-type': response.headers.get('content-type'),
      'content-length': response.headers.get('content-length'),
      'cf-ray': response.headers.get('cf-ray'),
      'cf-request-id': response.headers.get('cf-request-id')
    });

    // Read response body first (before checking ok) to see what Worker returned
    let responseBodyText = null;
    let responseBodyJson = null;
    try {
      responseBodyText = await response.text();
      console.log(`[${requestId}] 📄 Worker Response Body (raw, first 500 chars):`, responseBodyText.substring(0, 500));
      try {
        responseBodyJson = JSON.parse(responseBodyText);
        console.log(`[${requestId}] 📄 Worker Response Body (parsed):`, JSON.stringify(responseBodyJson, null, 2));
      } catch (jsonParseError) {
        console.log(`[${requestId}] ⚠️  Worker response is not valid JSON:`, jsonParseError.message);
      }
    } catch (readError) {
      console.error(`[${requestId}] ❌ Failed to read Worker response body:`, readError.message);
    }

    // Check if response is OK
    if (!response.ok) {
      console.log(`[${requestId}] ❌ Worker returned error status: ${response.status}`);
      let errorMessage = 'Failed to fetch specification';
      let errorDetails = null;
      
      if (responseBodyJson) {
        errorDetails = responseBodyJson;
        // Worker returns errors in format: { error: { code, message, issues? }, correlationId? }
        if (responseBodyJson.error) {
          errorMessage = responseBodyJson.error.message || responseBodyJson.error.code || errorMessage;
          if (responseBodyJson.error.issues && Array.isArray(responseBodyJson.error.issues)) {
            errorMessage += ': ' + responseBodyJson.error.issues.join(', ');
          }
          if (responseBodyJson.error.code) {
            errorMessage = `[${responseBodyJson.error.code}] ${errorMessage}`;
          }
        }
        console.log(`[${requestId}] Worker Error Data (from JSON):`, JSON.stringify(responseBodyJson, null, 2));
        if (responseBodyJson.correlationId) {
          console.log(`[${requestId}] Worker Correlation ID: ${responseBodyJson.correlationId}`);
        }
      } else if (responseBodyText) {
        errorMessage = responseBodyText.substring(0, 500) || `HTTP ${response.status}: ${response.statusText}`;
        errorDetails = { text: responseBodyText };
        console.log(`[${requestId}] Worker Error Text:`, responseBodyText.substring(0, 500));
      } else {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        errorDetails = { status: response.status, statusText: response.statusText };
        console.log(`[${requestId}] Worker Error (no body):`, errorMessage);
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`[${requestId}] ===== /api/generate-spec REQUEST FAILED (${totalTime}ms) =====`);
      throw new Error(errorMessage);
    }

    // Response is OK, use the parsed JSON
    if (!responseBodyJson) {
      const totalTime = Date.now() - startTime;
      console.error(`[${requestId}] ❌ Worker returned OK but response is not valid JSON`);
      console.log(`[${requestId}] ===== /api/generate-spec REQUEST FAILED (${totalTime}ms) =====`);
      throw new Error('Worker returned invalid JSON response');
    }
    
    const data = responseBodyJson;
    
    console.log(`[${requestId}] ✅ Successfully received and parsed Worker response`);
    console.log(`[${requestId}] Response Structure:`, {
      hasOverview: !!data.overview,
      hasSpecification: !!data.specification,
      hasMeta: !!data.meta,
      keys: Object.keys(data),
      overviewKeys: data.overview ? Object.keys(data.overview) : null
    });
    
    // Cloudflare Worker returns { overview: {...}, meta: {...} } format
    // Convert to { specification: ... } format for backward compatibility
    let specification;
    if (data.overview) {
      // Worker returned structured data
      specification = JSON.stringify(data.overview);
      console.log(`[${requestId}] 📝 Using 'overview' field, length: ${specification.length}`);
    } else if (data.specification) {
      // Already in expected format
      specification = data.specification;
      console.log(`[${requestId}] 📝 Using 'specification' field, length: ${specification.length}`);
    } else {
      // Fallback - stringify entire response
      specification = JSON.stringify(data);
      console.log(`[${requestId}] ⚠️  Using fallback (stringify entire response), length: ${specification.length}`);
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`[${requestId}] ✅ Successfully generated specification (${totalTime}ms total)`);
    console.log(`[${requestId}] ===== /api/generate-spec REQUEST SUCCESS =====`);
    
    res.json({ specification });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    logger.error({
      requestId,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause
      },
      duration: `${totalTime}ms`
    }, `Error in /api/generate-spec (${totalTime}ms)`);
    
    // Determine error code based on error type
    let errorCode = ERROR_CODES.EXTERNAL_SERVICE_ERROR;
    if (error.message.includes('connect') || error.message.includes('fetch')) {
      errorCode = ERROR_CODES.EXTERNAL_SERVICE_ERROR;
    } else if (error.message.includes('validation') || error.message.includes('required')) {
      errorCode = ERROR_CODES.VALIDATION_ERROR;
    }
    
    // Pass error to error handler with details
    const enhancedError = createError(
      `Failed to generate specification: ${error.message}`,
      errorCode,
      500,
      { errorType: error.name, requestId }
    );
    next(enhancedError);
  }
});

// Repair diagram endpoint (legacy - kept for backward compatibility)
app.post('/api/diagrams/repair', async (req, res, next) => {
  const { overview, technical, market, diagramTitle, brokenDiagramCode } = req.body;
  
  if (!brokenDiagramCode) {
    return next(createError('Broken diagram code is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
  }
  
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Build context from spec
    const specContext = `
## Specification Context:
${overview ? `**Overview:**\n${overview}\n\n` : ''}
${technical ? `**Technical Specs:**\n${technical}\n\n` : ''}
${market ? `**Market Research:**\n${market}\n\n` : ''}
`;
    
    // Create a prompt to repair the diagram
    const systemPrompt = `You are a Mermaid diagram expert. Your task is to fix broken Mermaid diagrams.

When given a broken Mermaid diagram code, analyze it and create a corrected version that:
1. Follows proper Mermaid syntax
2. Accurately represents the information from the specification context provided
3. Is complete and renderable

Return ONLY valid Mermaid code, nothing else.`;
    
    const userPrompt = `The following Mermaid diagram is broken:\n\n\`\`\`mermaid\n${brokenDiagramCode}\n\`\`\`\n\nContext:\n${specContext}\n\nTitle: ${diagramTitle}\n\nPlease provide a corrected version of this diagram.`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });
    
    const repairedCode = completion.choices[0].message.content.trim();
    
    // Clean up the response (remove any markdown code blocks)
    let cleanedCode = repairedCode;
    if (repairedCode.startsWith('```mermaid')) {
      cleanedCode = repairedCode.replace(/```mermaid\n?/, '').replace(/```\n?$/, '').trim();
    } else if (repairedCode.startsWith('```')) {
      cleanedCode = repairedCode.replace(/```\n?/, '').replace(/```\n?$/, '').trim();
    }
    

    res.json({ 
      success: true,
      repairedDiagram: {
        mermaidCode: cleanedCode
      }
    });
    
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Error repairing diagram');
    next(createError('Failed to repair diagram', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500));
  }
});

// Import and mount stats routes
logger.info({ type: 'route_mount', path: '/api/stats', route: 'statsRoutes' }, '[UNIFIED SERVER] 📌 Mounting stats routes');
const statsRoutes = require('./stats-routes');
app.use('/api/stats', statsRoutes);
logger.info({ type: 'route_mounted', path: '/api/stats' }, '[UNIFIED SERVER] ✅ Stats routes mounted');

// Live Brief routes
logger.info({ type: 'route_mount', path: '/api/live-brief', route: 'liveBriefRoutes' }, '[UNIFIED SERVER] 📌 Mounting live brief routes');
const liveBriefRoutes = require('./live-brief-routes');
app.use('/api/live-brief', liveBriefRoutes);
logger.info({ type: 'route_mounted', path: '/api/live-brief' }, '[UNIFIED SERVER] ✅ Live brief routes mounted');

// Serve static files from the parent directory (main site)
// Must be after API routes to avoid conflicts
const staticRootPath = path.join(__dirname, '..', '..');
const blogStaticPath = path.join(__dirname, '..', '..', '_site', 'blog');
const postsStaticPath = path.join(__dirname, '..', '..', '_site', '2025');

logger.info({
  type: 'static_files_setup',
  paths: {
    root: staticRootPath,
    blog: blogStaticPath,
    posts: postsStaticPath
  }
}, '[UNIFIED SERVER] 📌 Setting up static file serving...');

// IMPORTANT: Explicit route for /blog/ must come BEFORE express.static(staticRootPath)
// Otherwise staticRootPath will serve blog/index.html (source) instead of _site/blog/index.html (built)
app.get('/blog/', (req, res) => {
  const indexPath = path.join(blogStaticPath, 'index.html');
  const resolvedPath = path.resolve(indexPath);
  logger.info({ type: 'blog_request', path: '/blog/', resolvedPath }, '[UNIFIED SERVER] 📝 Serving blog index.html');
  res.sendFile(resolvedPath, (err) => {
    if (err) {
      logger.error({ type: 'file_error', path: '/blog/', error: err.message, resolvedPath }, '[UNIFIED SERVER] ❌ Error serving blog index.html');
      res.status(404).send('Blog page not found');
    } else {
      logger.info({ type: 'blog_served', path: '/blog/' }, '[UNIFIED SERVER] ✅ Blog index.html served successfully');
    }
  });
});

// Dynamic route for new Firebase blog posts (format: /YYYY/MM/DD/slug/)
// This must come BEFORE static file serving to catch dynamic post URLs
app.get('/:year/:month/:day/:slug/', async (req, res, next) => {
  const { year, month, day, slug } = req.params;
  
  // Validate format: year must be 4 digits, month and day must be 2 digits
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) {
    // Format doesn't match blog post pattern, fall through to static file serving
    return next();
  }
  
  const requestId = `dynamic-post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  logger.info({ requestId, year, month, day, slug }, '[UNIFIED SERVER] 📝 Checking for dynamic blog post');
  
  try {
    // Check if post exists in Firebase
    const { db } = require('./firebase-admin');
    const BLOG_COLLECTION = 'blogQueue';
    const snapshot = await db.collection(BLOG_COLLECTION).get();
    
    const matchingDoc = snapshot.docs.find(doc => {
      const data = doc.data();
      const postData = data.postData || data;
      const isPublished = postData.published === true || postData.published === 'true' || postData.published === 1;
      const isCompleted = data.status === 'completed';
      return isCompleted && isPublished && postData.slug === slug;
    });
    
    if (matchingDoc) {
      // Post exists in Firebase - serve dynamic post page
      const dynamicPostPath = path.join(staticRootPath, '_site', 'pages', 'dynamic-post.html');
      const resolvedPath = path.resolve(dynamicPostPath);
      logger.info({ requestId, resolvedPath }, '[UNIFIED SERVER] ✅ Serving dynamic post page');
      res.sendFile(resolvedPath, (err) => {
        if (err) {
          logger.error({ requestId, error: err.message, resolvedPath }, '[UNIFIED SERVER] ❌ Error serving dynamic post page');
          next(); // Fall through to static file serving (maybe it's a legacy Jekyll post)
        } else {
          logger.info({ requestId }, '[UNIFIED SERVER] ✅ Dynamic post page served successfully');
        }
      });
    } else {
      // Post doesn't exist in Firebase - fall through to static file serving (maybe it's a legacy Jekyll post)
      logger.debug({ requestId, slug }, '[UNIFIED SERVER] Post not found in Firebase, falling through to static files');
      next();
    }
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[UNIFIED SERVER] ❌ Error checking for dynamic post');
    next(); // Fall through to static file serving on error
  }
});

// Serve blog static files (CSS, JS, etc.) from _site/blog directory
// Note: Using /blog/assets to avoid conflict with /blog/ route
app.use('/blog/assets', express.static(path.join(blogStaticPath, 'assets')));
logger.info({ type: 'static_mounted', path: '/blog/assets', directory: path.join(blogStaticPath, 'assets') }, '[UNIFIED SERVER] ✅ Blog assets mounted');

// Serve root static files AFTER blog routes to avoid conflicts
app.use(express.static(staticRootPath));
logger.info({ type: 'static_mounted', path: '/', directory: staticRootPath }, '[UNIFIED SERVER] ✅ Root static files mounted');

// Serve blog posts from _site/2025 directory structure
app.use('/2025', express.static(postsStaticPath));
logger.info({ type: 'static_mounted', path: '/2025', directory: postsStaticPath }, '[UNIFIED SERVER] ✅ Blog posts static files mounted');

// Note: Admin endpoints are defined above

// 404 handler - must be after all routes
logger.info({ type: 'middleware_mount', middleware: 'notFoundHandler' }, '[UNIFIED SERVER] 📌 Mounting 404 handler');
app.use(notFoundHandler);
logger.info({ type: 'middleware_mounted', middleware: 'notFoundHandler' }, '[UNIFIED SERVER] ✅ 404 handler mounted');

// Error handler - must be last middleware
logger.info({ type: 'middleware_mount', middleware: 'errorHandler' }, '[UNIFIED SERVER] 📌 Mounting error handler');
app.use(errorHandler);
logger.info({ type: 'middleware_mounted', middleware: 'errorHandler' }, '[UNIFIED SERVER] ✅ Error handler mounted');

// Add version logging
const VERSION = '2.0.0-unified-server-' + Date.now();

// Start the server
const server = app.listen(port, () => {
  // Log comprehensive server startup summary
  logger.info({
    type: 'server_start',
    port,
    version: VERSION,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD),
    googleSheetsConfigured: !!process.env.GOOGLE_SHEETS_WEBHOOK_URL,
    renderUrl: process.env.RENDER_URL || 'N/A',
    unifiedServer: true,
    routesMounted: {
      lemon: true,
      credits: true,
      health: true,
      users: true,
      specs: true,
      chat: true,
      stats: true,
      liveBrief: true,
      admin: true,
      blog: true
    },
    staticFilesServing: {
      root: true,
      blog: true,
      posts: true
    },
    middleware: {
      securityHeaders: true,
      cors: true,
      rateLimiting: true,
      jsonParser: true,
      requestLogging: true,
      errorHandling: true
    }
  }, '[UNIFIED SERVER] 🚀 SERVER STARTED SUCCESSFULLY - All routes and middleware loaded');
  
  // Also log to console for visibility
  console.log('='.repeat(60));
  console.log('🚀 SERVER STARTED SUCCESSFULLY (server/server.js)');
  console.log('='.repeat(60));
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`🌐 Port: ${port}`);
  console.log(`📦 Version: ${VERSION}`);
  console.log(`🖥️  Node.js: ${process.version}`);
  console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`☁️  Cloudflare Worker: https://spspec.shalom-cohen-111.workers.dev/generate`);
  console.log(`📍 Render URL: ${process.env.RENDER_URL || 'N/A'}`);
  console.log('='.repeat(60));
  console.log('📝 Structured logging enabled (Pino)');
  console.log('📊 Error handling enabled');
  console.log('='.repeat(60));
  
  
  // Check configuration
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    logger.warn({ type: 'config_check' }, '⚠️  Email configuration not found (EMAIL_USER, EMAIL_APP_PASSWORD)');
  } else {
    logger.info({ type: 'config_check' }, '✅ Email configuration found');
  }
  
  if (!process.env.GOOGLE_SHEETS_WEBHOOK_URL) {
    logger.warn({ type: 'config_check' }, '⚠️  Google Sheets webhook URL not configured');
  } else {
    logger.info({ type: 'config_check' }, '✅ Google Sheets webhook URL configured');
  }

  // Keep-alive mechanism: ping health endpoint every 30 minutes to prevent Render from sleeping
  const KEEP_ALIVE_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds
  // Use external URL if available (for Render), otherwise fallback to localhost
  // Prefer RENDER_EXTERNAL_URL (set automatically by Render) over RENDER_URL
  const baseUrl = process.env.RENDER_EXTERNAL_URL 
    ? process.env.RENDER_EXTERNAL_URL 
    : (process.env.RENDER_URL ? `https://${process.env.RENDER_URL}` : `http://localhost:${port}`);
  
  const keepAlive = async () => {
    // Skip keep-alive if baseUrl is localhost (development) or if it's pointing to wrong service
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      logger.debug({ type: 'keep_alive', baseUrl }, `⏭️ Skipping keep-alive (localhost)`);
      return;
    }
    
    try {
      const healthUrl = `${baseUrl}/api/health`;
      
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Specifys-KeepAlive/1.0',
          'Connection': 'keep-alive'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        logger.info({ type: 'keep_alive', status: data.status || 'OK' }, `✅ Health check successful`);
      } else {
        // Only warn if it's not a 404 (which might mean wrong URL configured)
        if (response.status === 404) {
          logger.debug({ type: 'keep_alive', status: response.status, baseUrl }, `⚠️ Health check returned 404 - check RENDER_EXTERNAL_URL configuration`);
        } else {
          logger.warn({ type: 'keep_alive', status: response.status }, `⚠️ Health check returned status ${response.status}`);
        }
      }
    } catch (error) {
      // Don't log timeout errors as errors - they're expected if server is busy
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        logger.debug({ type: 'keep_alive' }, `⏱️ Health check timeout (server may be busy)`);
      } else {
        // Don't log as error if it's a network error (might be wrong URL)
        if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
          logger.debug({ type: 'keep_alive', error: error.message, baseUrl }, `⚠️ Health check failed - check RENDER_EXTERNAL_URL configuration`);
        } else {
          logger.error({ type: 'keep_alive', error: error.message }, `❌ Health check failed`);
        }
      }
    }
  };

  // Start keep-alive immediately, then every 30 minutes
  logger.info({ 
    type: 'keep_alive_start',
    interval: `${KEEP_ALIVE_INTERVAL / 60000} minutes`,
    baseUrl,
    healthUrl: `${baseUrl}/api/health`
  }, `[UNIFIED SERVER] 🔄 Starting keep-alive mechanism (every ${KEEP_ALIVE_INTERVAL / 60000} minutes)`);
  logger.info({
    type: 'keep_alive_config',
    intervalMs: KEEP_ALIVE_INTERVAL,
    timeoutMs: 10000,
    baseUrl,
    healthEndpoint: '/api/health'
  }, '[UNIFIED SERVER] 📋 Keep-alive configuration');
  keepAlive(); // Run immediately
  const keepAliveInterval = setInterval(keepAlive, KEEP_ALIVE_INTERVAL);
  logger.info({ type: 'keep_alive_active' }, '[UNIFIED SERVER] ✅ Keep-alive mechanism active');

  // Cleanup on server shutdown
  process.on('SIGTERM', () => {
    logger.info({ type: 'keep_alive_stop' }, '🛑 Stopping keep-alive mechanism');
    clearInterval(keepAliveInterval);
  });

  process.on('SIGINT', () => {
    logger.info({ type: 'keep_alive_stop' }, '🛑 Stopping keep-alive mechanism');
    clearInterval(keepAliveInterval);
  });
}).on('error', (err) => {
  logger.error({
    type: 'server_start_error',
    error: {
      message: err.message,
      code: err.code,
      stack: err.stack
    }
  }, '❌ FAILED TO START SERVER (server/server.js)');
  
  // Also log to console for visibility
  console.error('='.repeat(60));
  console.error('❌ FAILED TO START SERVER (server/server.js)');
  console.error('='.repeat(60));
  console.error(`Error: ${err.message}`);
  console.error(`Code: ${err.code}`);
  console.error(`Stack: ${err.stack}`);
  console.error('='.repeat(60));
});
