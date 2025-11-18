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
const adminRoutes = require('./admin-routes');
const { requireAdmin, securityHeaders, rateLimiters } = require('./security');
const { logError, getErrorLogs, getErrorSummary } = require('./error-logger');
const { logCSCCrash, getCSCCrashLogs, getCSCCrashSummary } = require('./css-crash-logger');
const { errorHandler, notFoundHandler, createError, ERROR_CODES } = require('./error-handler');
const { logger, logRequest, logResponse } = require('./logger');

dotenv.config();

const app = express();
const port = config.port;

// Apply security headers (must be before other middleware)
app.use(securityHeaders);

// Middleware to parse JSON bodies
app.use(express.json());

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

// CORS middleware to allow requests from your frontend
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // LOGGING: Log incoming origin for debugging
  if (req.path.startsWith('/api/')) {
    console.log(`[CORS] Request from origin: ${origin || 'none (same-origin)'}`);
    console.log(`[CORS] Allowed origins:`, config.allowedOrigins);
  }
  
  // Check if origin is in allowed list
  if (origin && config.allowedOrigins.includes(origin)) {
    // LOGGING: Origin is allowed
    if (req.path.startsWith('/api/')) {
      console.log(`[CORS] ✅ Allowed origin: ${origin}`);
    }
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    // LOGGING: Using fallback (origin not in list or no origin)
    if (req.path.startsWith('/api/')) {
      if (origin) {
        console.warn(`[CORS] ⚠️  Origin not in allowed list: ${origin} - using fallback '*'`);
      } else {
        console.log(`[CORS] ℹ️  No origin header (same-origin request) - using fallback '*'`);
      }
    }
    res.header('Access-Control-Allow-Origin', '*'); // Fallback for development
  }
  
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
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

// Blog management endpoints
app.post('/api/blog/create-post', requireAdmin, blogRoutes.createPost);
app.get('/api/blog/list-posts', requireAdmin, blogRoutes.listPosts);
app.post('/api/blog/delete-post', requireAdmin, blogRoutes.deletePost);
app.get('/api/blog/queue-status', requireAdmin, blogRoutes.getQueueStatus);

// Admin routes (must be after specific admin endpoints, with rate limiting)
app.use('/api/admin', rateLimiters.admin, adminRoutes);

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

// Import and mount chat routes
const chatRoutes = require('./chat-routes');
app.use('/api/chat', chatRoutes);

// Import and mount user routes
const userRoutes = require('./user-routes');
app.use('/api/users', userRoutes);

// Import and mount specs routes
const specsRoutes = require('./specs-routes');
app.use('/api/specs', specsRoutes);

// Import and mount stats routes
const statsRoutes = require('./stats-routes');
app.use('/api/stats', statsRoutes);

// Live Brief routes
const liveBriefRoutes = require('./live-brief-routes');
app.use('/api/live-brief', liveBriefRoutes);

// Note: Admin endpoints are defined above (lines 97-184)

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Error handler - must be last middleware
app.use(errorHandler);

app.listen(port, () => {
  logger.info({
    type: 'server_start',
    port,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD),
    googleSheetsConfigured: !!process.env.GOOGLE_SHEETS_WEBHOOK_URL
  }, '🚀 SERVER STARTED SUCCESSFULLY (server/server.js)');
  
  // Also log to console for visibility
  console.log('='.repeat(60));
  console.log('🚀 SERVER STARTED SUCCESSFULLY (server/server.js)');
  console.log('='.repeat(60));
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`🌐 Port: ${port}`);
  console.log(`🖥️  Node.js: ${process.version}`);
  console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`☁️  Cloudflare Worker: https://spspec.shalom-cohen-111.workers.dev/generate`);
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
