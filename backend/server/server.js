const path = require('path');
const dotenv = require('dotenv');

// Load .env BEFORE config so CREDITS_V3_ENABLED and other env vars are available
const backendEnvPath = path.join(__dirname, '..', '.env');
const rootEnvPath = path.join(__dirname, '..', '..', '.env');
const serverEnvPath = path.join(__dirname, '.env');
let loadedEnvPath = null;
if (dotenv.config({ path: backendEnvPath }).parsed) {
  loadedEnvPath = backendEnvPath;
} else if (dotenv.config({ path: rootEnvPath }).parsed) {
  loadedEnvPath = rootEnvPath;
} else if (dotenv.config({ path: serverEnvPath }).parsed) {
  loadedEnvPath = serverEnvPath;
} else {
  dotenv.config();
}

const express = require('express');
const compression = require('compression');
// Use built-in fetch for Node.js 18+ or fallback to node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
  // Node.js 18+ has built-in fetch (used in Render)
  fetch = globalThis.fetch;
} else {
  // Fallback for older Node versions
  fetch = require('node-fetch');
}
const config = require('./config');
const blogRoutes = require('./blog-routes');
const blogRoutesPublic = require('./blog-routes-public');
const articlesRoutes = require('./articles-routes');
const academyRoutes = require('./academy-routes');
const adminRoutes = require('./admin-routes');
const analyticsRoutes = require('./analytics-routes');
const lemonRoutes = require('./lemon-routes');
const auxiliaryRoutes = require('./auxiliary-routes');
// Old credits routes removed - V3 is now the only active system
const healthRoutes = require('./health-routes');
const { requireAdmin, securityHeaders, rateLimiters } = require('./security');
const { logError, getErrorLogs, getErrorSummary } = require('./error-logger');
const { logCSCCrash, getCSCCrashLogs, getCSCCrashSummary } = require('./css-crash-logger');
const { errorHandler, notFoundHandler, createError, ERROR_CODES } = require('./error-handler');
const { logger, logRequest, logResponse } = require('./logger');
const { syncAllUsers } = require('./user-management');
const { startScheduledJobs } = require('./scheduled-jobs');
const { initializeErrorCapture } = require('./render-error-capture');
const { assertEnv } = require('./env-check');
const { geoMiddleware } = require('./middleware/geo');
const emailService = require('./email-service');

if (loadedEnvPath) {
  logger.info({ type: 'env_loaded', path: loadedEnvPath }, '[UNIFIED SERVER] ✅ Environment variables loaded');
} else {
  logger.warn({ type: 'env_fallback' }, '[UNIFIED SERVER] ⚠️ Using default environment variable lookup (CWD)');
}

// Initialize error capture for unhandled errors (must be early in startup)
initializeErrorCapture();
logger.info({ type: 'error_capture_initialized' }, '[UNIFIED SERVER] ✅ Error capture initialized');

// Clear require cache for development
delete require.cache[require.resolve('./chat-routes')];
delete require.cache[require.resolve('./openai-storage-service')];

const app = express();
const port = config.port;
assertEnv();

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

// Compression middleware - compress responses (must be before static files)
app.use(compression({
  filter: (req, res) => {
    // Compress all responses except if explicitly disabled
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression for all text-based content
    return compression.filter(req, res);
  },
  level: 6, // Balance between compression and CPU usage
  threshold: 1024 // Only compress responses larger than 1KB
}));
logger.info({ type: 'compression_enabled' }, '[UNIFIED SERVER] ✅ Compression middleware enabled');

// CORS middleware to allow requests from your frontend
// Must be before routes and rate limiting
// Do not remove origins without verifying they are unused (removal can break auth/API/payments)
const allowedOrigins = [...config.allowedOrigins].filter(Boolean);

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
app.use(geoMiddleware);

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
// Dedicated, more permissive limiter for fire-and-forget browser telemetry so
// rapid page loads / error bursts do not exhaust the general budget.
app.use('/api/logs', rateLimiters.monitoring);
app.use('/api/admin/css-crash-logs', rateLimiters.monitoring);
app.use('/api/analytics/web-vitals', rateLimiters.monitoring);
logger.info({ type: 'rate_limiting_applied' }, '[UNIFIED SERVER] ✅ Rate limiting applied');

// Web Vitals: sendBeacon may use text/plain (string) or application/json (Blob). Parse raw here so legacy
// clients and multipart edge cases never hit req.body {}; express.json skips this path afterward.
function isPostApiAnalyticsWebVitals(req) {
  if (req.method !== 'POST') return false;
  const pathname = (req.path || '').replace(/\/+$/, '') || '/';
  return pathname === '/api/analytics/web-vitals';
}

app.use((req, res, next) => {
  if (!isPostApiAnalyticsWebVitals(req)) return next();
  return express.raw({ type: '*/*', limit: '32kb' })(req, res, (err) => {
    if (err) return next(err);
    try {
      const buf = req.body;
      const raw = Buffer.isBuffer(buf) && buf.length ? buf.toString('utf8') : '';
      req.body = raw ? JSON.parse(raw) : {};
    } catch {
      req.body = {};
    }
    next();
  });
});

app.use((req, res, next) => {
  if (isPostApiAnalyticsWebVitals(req)) return next();
  express.json()(req, res, next);
});
logger.info({ type: 'json_parser_applied' }, '[UNIFIED SERVER] ✅ JSON body parser applied');

// Request logging middleware (using structured logger)
app.use((req, res, next) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  // Store requestId in request object for use in route handlers
  req.requestId = requestId;
  
  // Skip logging for health checks and other routine checks
  const skipLoggingPaths = ['/api/health', '/api/status'];
  const shouldSkipLogging = skipLoggingPaths.some(path => req.path.startsWith(path));
  
  // Log request start (only for API routes, skip health checks)
  if (req.path.startsWith('/api/') && !shouldSkipLogging) {
    logRequest(req, requestId);
  }
  
  // Log response when it finishes (only errors and non-routine paths)
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    // Only log errors (4xx, 5xx) or non-routine paths
    if (req.path.startsWith('/api/') && !shouldSkipLogging) {
      // Only log if it's an error or if it's not a routine endpoint
      if (res.statusCode >= 400) {
        logResponse(req, res, requestId, duration);
      }
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

// Crawlers GET /api/logs; client logger uses POST only
app.get('/api/logs', (req, res) => {
  res.setHeader('Allow', 'POST');
  res.status(405).json({
    success: false,
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: 'Use POST to submit client logs'
    },
    timestamp: new Date().toISOString()
  });
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

// MCP routes (API Key auth) - for MCP Server (Cursor / Claude Desktop)
logger.info({ type: 'route_mount', path: '/api/mcp', route: 'mcpRoutes' }, '[UNIFIED SERVER] 📌 Mounting MCP routes');
const { verifyApiKey } = require('./mcp-auth');
const mcpRoutes = require('./mcp-routes');
app.use('/api/mcp', verifyApiKey, mcpRoutes);
logger.info({ type: 'route_mounted', path: '/api/mcp' }, '[UNIFIED SERVER] ✅ MCP routes mounted');

// Credits routes for credit management (OLD - REMOVED)
// Old routes have been removed. V2 routes have been removed. V3 is now the only active system.

// Credits V3 routes - primary credit system
if (config.creditsV3.enabled) {
  logger.info({ type: 'route_mount', path: '/api/v3/credits', route: 'creditsV3Routes' }, '[UNIFIED SERVER] 📌 Mounting credits V3 routes');
  const creditsV3Routes = require('./credits-v3-routes');
  app.use('/api/v3/credits', creditsV3Routes);
  logger.info({ type: 'route_mounted', path: '/api/v3/credits' }, '[UNIFIED SERVER] ✅ Credits V3 routes mounted');
  
  // Share prompt routes
  logger.info({ type: 'route_mount', path: '/api/share-prompt', route: 'sharePromptRoutes' }, '[UNIFIED SERVER] 📌 Mounting share prompt routes');
  const sharePromptRoutes = require('./share-prompt-routes');
  app.use('/api/share-prompt', sharePromptRoutes);
  logger.info({ type: 'route_mounted', path: '/api/share-prompt' }, '[UNIFIED SERVER] ✅ Share prompt routes mounted');
} else {
  logger.info(
    { type: 'route_skipped', path: '/api/v3/credits', reason: 'credits_v3_disabled_by_env' },
    '[UNIFIED SERVER] ⏭️  Credits V3 routes disabled (set CREDITS_V3_ENABLED=true for production)'
  );
}

// Chat routes for AI chat functionality
logger.info({ type: 'route_mount', path: '/api/chat', route: 'chatRoutes' }, '[UNIFIED SERVER] 📌 Mounting chat routes');
const chatRoutes = require('./chat-routes');
app.use('/api/chat', chatRoutes);
logger.info({ type: 'route_mounted', path: '/api/chat' }, '[UNIFIED SERVER] ✅ Chat routes mounted');

logger.info({ type: 'route_mount', path: '/api/brain-dump', route: 'brainDumpRoutes' }, '[UNIFIED SERVER] 📌 Mounting brain-dump routes');
const brainDumpRoutes = require('./brain-dump-routes');
app.use('/api/brain-dump', brainDumpRoutes);
logger.info({ type: 'route_mounted', path: '/api/brain-dump' }, '[UNIFIED SERVER] ✅ Brain Dump routes mounted');

logger.info({ type: 'route_mount', path: '/api/auxiliary', route: 'auxiliaryRoutes' }, '[UNIFIED SERVER] 📌 Mounting auxiliary routes');
app.use('/api/auxiliary', auxiliaryRoutes);
logger.info({ type: 'route_mounted', path: '/api/auxiliary' }, '[UNIFIED SERVER] ✅ Auxiliary routes mounted');

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

// Articles routes
logger.info({ type: 'route_mount', path: '/api/articles', route: 'articlesRoutes' }, '[UNIFIED SERVER] 📌 Mounting articles routes');
app.post('/api/articles/generate', requireAdmin, articlesRoutes.generateArticle);
app.get('/api/articles/list', articlesRoutes.listArticles);
app.get('/api/articles/featured', articlesRoutes.getFeaturedArticles);
app.get('/api/articles/:slug', articlesRoutes.getArticleBySlug);
app.post('/api/articles/:slug/view', articlesRoutes.incrementViewCount);
app.get('/sitemap.xml', articlesRoutes.generateSitemap);
app.put('/api/articles/:id', requireAdmin, articlesRoutes.updateArticle);
app.delete('/api/articles/:id', requireAdmin, articlesRoutes.deleteArticle);
logger.info({ type: 'route_mounted', path: '/api/articles' }, '[UNIFIED SERVER] ✅ Articles routes mounted');

// Academy routes
logger.info({ type: 'route_mount', path: '/api/academy', route: 'academyRoutes' }, '[UNIFIED SERVER] 📌 Mounting academy routes');
app.post('/api/academy/guides/:guideId/view', academyRoutes.incrementViewCount);
logger.info({ type: 'route_mounted', path: '/api/academy' }, '[UNIFIED SERVER] ✅ Academy routes mounted');

// Analytics routes - public endpoints for tracking, admin-only for viewing data
logger.info({ type: 'route_mount', path: '/api/analytics', route: 'analyticsRoutes' }, '[UNIFIED SERVER] 📌 Mounting analytics routes');
app.use('/api/analytics', analyticsRoutes); // Routes handle their own auth requirements
logger.info({ type: 'route_mounted', path: '/api/analytics' }, '[UNIFIED SERVER] ✅ Analytics routes mounted');

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

// API Documentation routes (Swagger/OpenAPI)
logger.info({ type: 'route_mount', path: '/api-docs', route: 'apiDocsRoutes' }, '[UNIFIED SERVER] 📌 Mounting API documentation routes');
const apiDocsRoutes = require('./api-docs-routes');
app.use('/api-docs', apiDocsRoutes);
logger.info({ type: 'route_mounted', path: '/api-docs' }, '[UNIFIED SERVER] ✅ API documentation routes mounted');

// Basic route for server status
logger.info({ type: 'route_register', method: 'GET', path: '/api/status' }, '[UNIFIED SERVER] 📌 Registering server status endpoint');
app.get('/api/status', (req, res) => {
  res.status(200).json({ message: 'Server is running' });
});

app.get('/api/geo/context', (req, res) => {
  const country = req.geo?.country || 'US';
  const locale = req.geo?.locale || 'en';
  const recommendations = {
    US: { recommendedCompetitors: ['Notion', 'Linear'], recommendedTechStacks: ['Next.js', 'Node.js'] },
    IL: { recommendedCompetitors: ['Monday', 'Wix'], recommendedTechStacks: ['React', 'Node.js'] },
    DE: { recommendedCompetitors: ['Celonis', 'SAP'], recommendedTechStacks: ['TypeScript', 'Java'] }
  };
  const picked = recommendations[country] || recommendations.US;
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({
    success: true,
    country,
    region: req.geo?.region || null,
    locale,
    source: req.geo?.source || 'fallback',
    ...picked
  });
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
    const emailResult = await emailService.sendFeedbackEmail({
      userEmail: email,
      feedback,
      type,
      source
    });
    if (!emailResult.success) {
      logger.warn({ email, type, source, error: emailResult.error }, 'Feedback email sending failed');
    }
    
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
  }
}

// Import and mount stats routes
logger.info({ type: 'route_mount', path: '/api/stats', route: 'statsRoutes' }, '[UNIFIED SERVER] 📌 Mounting stats routes');
const statsRoutes = require('./stats-routes');
app.use('/api/stats', statsRoutes);
logger.info({ type: 'route_mounted', path: '/api/stats' }, '[UNIFIED SERVER] ✅ Stats routes mounted');

// Live Brief routes
logger.info({ type: 'route_mount', path: '/api/live-brief', route: 'liveBriefRoutes' }, '[UNIFIED SERVER] 📌 Mounting live brief routes');
const liveBriefRoutes = require('./live-brief-routes');
app.use('/api/live-brief', liveBriefRoutes);

const planningRoutes = require('./planning-routes');
app.use('/api/planning', planningRoutes);

const toolFinderRoutes = require('./tool-finder-routes');
app.use('/api/tool-finder', toolFinderRoutes);
logger.info({ type: 'route_mounted', path: '/api/live-brief' }, '[UNIFIED SERVER] ✅ Live brief routes mounted');

// Email preview routes (for viewing templates)
logger.info({ type: 'route_mount', path: '/api/email', route: 'emailPreviewRoutes' }, '[UNIFIED SERVER] 📌 Mounting email preview routes');
const emailPreviewRoutes = require('./email-preview-routes');
const emailTrackingRoutes = require('./email-tracking-routes');
app.use('/api/email', emailPreviewRoutes);
app.use('/api/email', emailTrackingRoutes);
logger.info({ type: 'route_mounted', path: '/api/email' }, '[UNIFIED SERVER] ✅ Email preview and tracking routes mounted');

// Newsletter routes (admin only)
logger.info({ type: 'route_mount', path: '/api/admin/newsletters', route: 'newsletterRoutes' }, '[UNIFIED SERVER] 📌 Mounting newsletter routes');
const newsletterRoutes = require('./newsletter-routes');
app.use('/api/admin/newsletters', newsletterRoutes);
logger.info({ type: 'route_mounted', path: '/api/admin/newsletters' }, '[UNIFIED SERVER] ✅ Newsletter routes mounted');

// Tools routes
logger.info({ type: 'route_mount', path: '/api/tools', route: 'toolsRoutes' }, '[UNIFIED SERVER] 📌 Mounting tools routes');
const toolsRoutes = require('./tools-routes');
app.use('/api/tools', toolsRoutes);
logger.info({ type: 'route_mounted', path: '/api/tools' }, '[UNIFIED SERVER] ✅ Tools routes mounted');

// Automation routes
logger.info({ type: 'route_mount', path: '/api/automation', route: 'automationRoutes' }, '[UNIFIED SERVER] 📌 Mounting automation routes');
const automationRoutes = require('./automation-routes');
app.use('/api/automation', automationRoutes);
logger.info({ type: 'route_mounted', path: '/api/automation' }, '[UNIFIED SERVER] ✅ Automation routes mounted');

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

// Serve built homepage from _site so CSS and layout apply (root index.html is Jekyll source)
const builtIndexPath = path.resolve(path.join(staticRootPath, '_site', 'index.html'));
const serveBuiltIndex = (req, res, next) => {
  res.sendFile(builtIndexPath, (err) => {
    if (err) next();
  });
};
app.get('/', serveBuiltIndex);
app.get('/index.html', serveBuiltIndex);

// Clients (e.g. okhttp) often request /favicon.png; site uses /favicon.ico
app.get('/favicon.png', (req, res) => {
  res.redirect(301, '/favicon.ico');
});

// Jekyll emits academy at _site/academy.html; express.static serves repo root, so serve built file explicitly
const builtAcademyPath = path.resolve(path.join(staticRootPath, '_site', 'academy.html'));
app.get('/academy.html', (req, res, next) => {
  res.sendFile(builtAcademyPath, (err) => {
    if (err) next();
  });
});

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

// Handle /pages/articles.html — try Jekyll output first, then source (Render may omit _site)
app.get('/pages/articles.html', (req, res) => {
  const candidates = [
    path.join(staticRootPath, '_site', 'pages', 'articles.html'),
    path.join(staticRootPath, 'pages', 'articles.html')
  ];
  const tryArticle = (index) => {
    if (index >= candidates.length) {
      logger.error({ type: 'file_error', path: '/pages/articles.html' }, '[UNIFIED SERVER] ❌ articles.html not found in _site or pages');
      return res.status(404).send('Articles page not found');
    }
    const resolvedPath = path.resolve(candidates[index]);
    logger.info({ type: 'articles_request', path: '/pages/articles.html', resolvedPath }, '[UNIFIED SERVER] 📝 Serving articles.html');
    res.sendFile(resolvedPath, (err) => {
      if (err) {
        logger.debug({ type: 'articles_fallback', path: '/pages/articles.html', resolvedPath, error: err.message }, '[UNIFIED SERVER] articles candidate miss');
        tryArticle(index + 1);
      } else {
        logger.info({ type: 'articles_served', path: '/pages/articles.html', resolvedPath }, '[UNIFIED SERVER] ✅ Articles.html served successfully');
      }
    });
  };
  tryArticle(0);
});

// Redirect old /pages/academy/ URL to canonical /academy.html (Jekyll permalink)
app.get('/pages/academy', (req, res) => {
  res.redirect(301, '/academy.html');
});
app.get('/pages/academy/', (req, res) => {
  res.redirect(301, '/academy.html');
});
app.get('/pages/academy/index.html', (req, res) => {
  res.redirect(301, '/academy.html');
});

// Serve all /pages/*.html from _site/pages/ (Jekyll built output) so layout and CSS apply
app.get('/pages/:filename', (req, res, next) => {
  const filename = req.params.filename;
  if (!filename.endsWith('.html')) return next();
  const filePath = path.join(staticRootPath, '_site', 'pages', filename);
  const resolvedPath = path.resolve(filePath);
  res.sendFile(resolvedPath, (err) => {
    if (err) next();
  });
});

// Handle /article.html route - check if article exists before serving (prevent Soft 404)
app.get('/article.html', async (req, res, next) => {
  const slug = req.query.slug;
  const requestId = `article-check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // If no slug, serve the page normally (it will show error on client side)
  if (!slug) {
    return next();
  }
  
  logger.info({ requestId, slug }, '[UNIFIED SERVER] 📝 Checking if article exists before serving');
  
  try {
    const { db } = require('./firebase-admin');
    const ARTICLES_COLLECTION = 'articles';
    const snapshot = await db.collection(ARTICLES_COLLECTION).get();
    
    const matchingDoc = snapshot.docs.find(doc => {
      const data = doc.data();
      return data.slug === slug && data.status === 'published';
    });
    
    if (!matchingDoc) {
      logger.warn({ requestId, slug }, '[UNIFIED SERVER] ⚠️ Article not found, returning 404');
      const notFoundPath = path.join(staticRootPath, '_site', 'pages', '404.html');
      const resolvedNotFoundPath = path.resolve(notFoundPath);
      return res.status(404).sendFile(resolvedNotFoundPath, (err) => {
        if (err) {
          logger.error({ requestId, error: err.message }, '[UNIFIED SERVER] ❌ Error serving 404 page');
          res.status(404).send('Article not found');
        }
      });
    }
    
    logger.info({ requestId, slug, articleId: matchingDoc.id }, '[UNIFIED SERVER] ✅ Article exists, serving page');
    next(); // Continue to serve the article page
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[UNIFIED SERVER] ❌ Error checking article existence');
    next(); // On error, fall through to serve page (let client handle it)
  }
});

// Handle /academy/guide.html route - check if guide exists before serving (prevent Soft 404)
app.get('/academy/guide.html', async (req, res, next) => {
  const guideId = req.query.guide;
  const requestId = `guide-check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // If no guide ID, serve the page normally (it will show error on client side)
  if (!guideId) {
    return next();
  }
  
  logger.info({ requestId, guideId }, '[UNIFIED SERVER] 📝 Checking if guide exists before serving');
  
  try {
    const { db } = require('./firebase-admin');
    const ACADEMY_GUIDES_COLLECTION = 'academy_guides';
    const guideRef = db.collection(ACADEMY_GUIDES_COLLECTION).doc(guideId);
    const guideDoc = await guideRef.get();
    
    if (!guideDoc.exists) {
      logger.warn({ requestId, guideId }, '[UNIFIED SERVER] ⚠️ Guide not found, returning 404');
      const notFoundPath = path.join(staticRootPath, '_site', 'pages', '404.html');
      const resolvedNotFoundPath = path.resolve(notFoundPath);
      return res.status(404).sendFile(resolvedNotFoundPath, (err) => {
        if (err) {
          logger.error({ requestId, error: err.message }, '[UNIFIED SERVER] ❌ Error serving 404 page');
          res.status(404).send('Guide not found');
        }
      });
    }
    
    logger.info({ requestId, guideId }, '[UNIFIED SERVER] ✅ Guide exists, serving page');
    next(); // Continue to serve the guide page
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[UNIFIED SERVER] ❌ Error checking guide existence');
    next(); // On error, fall through to serve page (let client handle it)
  }
});

// Serve root static files AFTER blog routes to avoid conflicts
// Configure static files with caching headers for better performance
app.use(express.static(staticRootPath, {
  maxAge: '1y', // Cache for 1 year
  etag: true, // Enable ETag for cache validation
  lastModified: true, // Enable Last-Modified headers
  immutable: false, // Set to true for files with hash in name (e.g., main-[hash].css)
  setHeaders: (res, path) => {
    // Set longer cache for CSS/JS files
    if (path.match(/\.(css|js|woff|woff2|ttf|eot|svg|png|jpg|jpeg|gif|ico|webp)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    // Set shorter cache for HTML files
    if (path.match(/\.html?$/)) {
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    }
  }
}));
logger.info({ type: 'static_mounted', path: '/', directory: staticRootPath }, '[UNIFIED SERVER] ✅ Root static files mounted with caching');

// Serve blog posts from _site/2025 directory structure
app.use('/2025', express.static(postsStaticPath, {
  maxAge: '1y',
  etag: true,
  lastModified: true
}));
logger.info({ type: 'static_mounted', path: '/2025', directory: postsStaticPath }, '[UNIFIED SERVER] ✅ Blog posts static files mounted');

// Optional: redirect non-API GET requests to main site (Render = API only; see docs/setup/render-deployment.md)
const redirectNonApiToSite = process.env.REDIRECT_NON_API_TO_SITE === 'true' && process.env.SITE_URL;
if (redirectNonApiToSite) {
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      const target = `${process.env.SITE_URL.replace(/\/$/, '')}${req.originalUrl || '/'}`;
      return res.redirect(302, target);
    }
    next();
  });
  logger.info({ type: 'redirect_enabled', siteUrl: process.env.SITE_URL }, '[UNIFIED SERVER] ✅ Redirect non-API GET to SITE_URL enabled');
}

// For non-API GET with Accept: text/html, serve 404 HTML page instead of JSON
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
  const accept = (req.headers.accept || '').toLowerCase();
  if (!accept.includes('text/html')) return next();
  const notFoundPath = path.join(staticRootPath, '_site', 'pages', '404.html');
  const resolvedPath = path.resolve(notFoundPath);
  res.status(404).sendFile(resolvedPath, (err) => {
    if (err) next();
  });
});

// 404 handler - must be after all routes (API and non-HTML requests get JSON)
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
    emailConfigured: !!(process.env.RESEND_API_KEY || (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD)),
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
  
  
  
  // Check email configuration (Resend preferred, Gmail as fallback)
  if (process.env.RESEND_API_KEY) {
    logger.info({ type: 'config_check' }, '✅ Resend email service configured (RESEND_API_KEY)');
  } else if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
    logger.info({ type: 'config_check' }, '✅ Legacy Gmail email configuration found');
  } else {
    logger.warn({ type: 'config_check' }, '⚠️  Email configuration not found (RESEND_API_KEY or EMAIL_USER/EMAIL_APP_PASSWORD)');
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
        // Don't log successful health checks - they're too frequent
        // logger.debug({ type: 'keep_alive', status: data.status || 'OK' }, `✅ Health check successful`);
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

  // Start scheduled jobs (payments sync every 24 hours)
  try {
    startScheduledJobs();
    logger.info({ type: 'scheduled_jobs_started' }, '[UNIFIED SERVER] ✅ Scheduled jobs started');
  } catch (jobError) {
    logger.error({ 
      type: 'scheduled_jobs_error',
      error: {
        message: jobError.message,
        stack: jobError.stack
      }
    }, '[UNIFIED SERVER] ⚠️ Failed to start scheduled jobs');
  }

  // Cleanup on server shutdown
  const { stopScheduledJobs } = require('./scheduled-jobs');
  
  process.on('SIGTERM', () => {
    logger.info({ type: 'server_shutdown' }, '🛑 Server shutting down...');
    clearInterval(keepAliveInterval);
    stopScheduledJobs();
    server.close(() => {
      logger.info({ type: 'server_closed' }, '✅ Server closed gracefully');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info({ type: 'server_shutdown' }, '🛑 Server shutting down...');
    clearInterval(keepAliveInterval);
    stopScheduledJobs();
    server.close(() => {
      logger.info({ type: 'server_closed' }, '✅ Server closed gracefully');
      process.exit(0);
    });
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
  
});
