const path = require('path');
const dotenv = require('dotenv');
// Load environment variables BEFORE importing route modules
// Try backend/.env first (preferred), then project root .env; also support accidental ".en"
const backendEnvPath = path.join(__dirname, '.env');
const rootEnvPath = path.join(__dirname, '..', '.env');
const backendServerEnvPath = path.join(__dirname, 'server', '.env');
const backendEnPath = path.join(__dirname, '.en');
const rootEnPath = path.join(__dirname, '..', '.en');
const backendServerEnPath = path.join(__dirname, 'server', '.en');
let loadedEnvPath = null;

if (dotenv.config({ path: backendEnvPath }).parsed) {
  loadedEnvPath = backendEnvPath;
} else if (dotenv.config({ path: rootEnvPath }).parsed) {
  loadedEnvPath = rootEnvPath;
} else if (dotenv.config({ path: backendServerEnvPath }).parsed) {
  loadedEnvPath = backendServerEnvPath;
} else if (dotenv.config({ path: backendEnPath }).parsed) {
  loadedEnvPath = backendEnPath;
} else if (dotenv.config({ path: rootEnPath }).parsed) {
  loadedEnvPath = rootEnPath;
} else if (dotenv.config({ path: backendServerEnPath }).parsed) {
  loadedEnvPath = backendServerEnPath;
} else {
  // Final fallback to default lookup (CWD)
  dotenv.config();
}

// Minimal diagnostics (do not print the key value)
if (process.env.OPENAI_API_KEY) {
  // OPENAI_API_KEY detected
} else {
  // Note: OPENAI_API_KEY is used for OpenAI integrations (chat, storage, etc.)
  // API_KEY is no longer used - all spec generation goes through Cloudflare Worker
}

// Clear require cache for development
delete require.cache[require.resolve('./server/chat-routes')];
delete require.cache[require.resolve('./server/openai-storage-service')];

// Import modules that may read env at require-time AFTER loading env
const express = require('express');
// Use built-in fetch for Node.js 18+ or fallback to node-fetch (like lemon-routes.js)
let fetch;
if (typeof globalThis.fetch === 'function') {
  // Node.js 18+ has built-in fetch (used in Render)
  fetch = globalThis.fetch;
} else {
  // Fallback for older Node versions
  fetch = require('node-fetch');
}
const { syncAllUsers } = require('./server/user-management');
const blogRoutes = require('./server/blog-routes');
const userRoutes = require('./server/user-routes');
const chatRoutes = require('./server/chat-routes');
const adminRoutes = require('./server/admin-routes');
const lemonRoutes = require('./server/lemon-routes');
const { securityHeaders, rateLimiters, requireAdmin } = require('./server/security');

const app = express();

// Trust proxy for rate limiting behind reverse proxy (Render, etc.)
app.set('trust proxy', true);

// Get port from environment or use default
const port = process.env.PORT || 10000;

// Apply security headers
app.use(securityHeaders);

// CORS middleware to allow requests from your frontend
// Must be before routes and rate limiting
app.use((req, res, next) => {
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
  const origin = req.headers.origin;
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

// Lemon Squeezy routes must be registered BEFORE express.json() and rate limiting
// to allow webhook endpoint to access raw body for signature verification
// and to avoid rate limiting issues
app.use('/api/lemon', lemonRoutes);

// Apply rate limiting (after lemon routes so they're excluded)
app.use('/api/', (req, res, next) => {
  // Skip rate limiting for lemon routes (already handled above)
  if (req.path.startsWith('/lemon')) {
    return next();
  }
  rateLimiters.general(req, res, next);
});
app.use('/api/admin/', rateLimiters.admin);
app.use('/api/auth/', rateLimiters.auth);
app.use('/api/feedback', rateLimiters.feedback);

// Middleware to parse JSON bodies (registered after lemon routes)
app.use(express.json());

// Debug logging middleware
app.use((req, res, next) => {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  // Store requestId in request object for use in route handlers
  req.requestId = requestId;
  
  // Log request start
  if (req.path.startsWith('/api/')) {
    console.log(`[${requestId}] 🌐 ${req.method} ${req.path} - ${req.ip || req.connection.remoteAddress}`);
  }
  
  // Log response when it finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (req.path.startsWith('/api/')) {
      const statusEmoji = res.statusCode >= 500 ? '❌' : res.statusCode >= 400 ? '⚠️' : '✅';
      console.log(`[${requestId}] ${statusEmoji} ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    }
  });
  
  next();
});

// Serve static files from the parent directory (main site)
app.use(express.static('..'));

// Serve blog files from _site/blog directory
app.use('/blog', express.static('../_site/blog'));

// Serve blog posts from _site/2025 directory structure
app.use('/2025', express.static('../_site/2025'));

// User routes for user management
app.use('/api/users', userRoutes);

// Specs routes for spec management
const specsRoutes = require('./server/specs-routes');
app.use('/api/specs', specsRoutes);

// Chat routes for AI chat functionality
app.use('/api/chat', chatRoutes);

// Admin routes (with admin verification)
app.use('/api/admin', adminRoutes);

// Basic route for server status
app.get('/api/status', (req, res) => {
  res.status(200).json({ message: 'Server is running' });
});

// Endpoint to sync users from Firebase Auth to Firestore (admin only)
app.post('/api/sync-users', requireAdmin, async (req, res) => {
  try {
    const result = await syncAllUsers();
    res.json({
      success: true,
      message: 'Users synced successfully',
      result: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Blog Management Endpoints
app.post('/api/blog/create-post', blogRoutes.createPost);
app.get('/api/blog/list-posts', blogRoutes.listPosts);
app.post('/api/blog/delete-post', blogRoutes.deletePost);

// Endpoint for generating specifications via Cloudflare Worker
app.post('/api/generate-spec', rateLimiters.generation, async (req, res) => {
  const requestId = req.requestId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  console.log(`[${requestId}] ===== /api/generate-spec REQUEST START =====`);
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
    console.log(`[${requestId}] ❌ VALIDATION FAILED: userInput is missing`);
    return res.status(400).json({ error: 'User input is required' });
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
    console.error(`[${requestId}] ❌ ERROR in /api/generate-spec (${totalTime}ms):`, {
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause
    });
    console.error(`[${requestId}] ===== /api/generate-spec REQUEST ERROR =====`);
    
    // Always include error details in response for debugging
    res.status(500).json({ 
      error: 'Failed to generate specification',
      details: error.message,
      errorType: error.name,
      requestId: requestId
    });
  }
});

// Repair diagram endpoint
app.post('/api/diagrams/repair', async (req, res) => {
  const { overview, technical, market, diagramTitle, brokenDiagramCode } = req.body;
  
  if (!brokenDiagramCode) {
    return res.status(400).json({ error: 'Broken diagram code is required' });
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
    
    // Create a prompt to repair the diagram with proper ERD syntax
    const systemPrompt = `You are a Mermaid diagram expert. Your task is to fix broken Mermaid diagrams.

When given a broken Mermaid diagram code, analyze it and create a corrected version that:
1. Follows proper Mermaid syntax
2. Accurately represents the information from the specification context provided
3. Is complete and renderable

CRITICAL FOR ERD DIAGRAMS:
- NEVER write: USERS {id} ||--o{ TASKS {projectId} : belongs_to
- CORRECT ERD format:
  erDiagram
      ENTITY1 {
          int id PK
          string name
      }
      ENTITY2 {
          int id PK
          string title
      }
      ENTITY1 ||--o{ ENTITY2 : "has"
- Define ALL entity attributes inside curly braces BEFORE relationships
- Relationships must ONLY show entity names, NO field names

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
    res.status(500).json({ error: 'Failed to repair diagram' });
  }
});

// Add version logging
const VERSION = '1.2.5-assistant-fix-2025-10-31-' + Date.now();

// Start the server
app.listen(port, () => {
  console.log('='.repeat(60));
  console.log('🚀 SERVER STARTED SUCCESSFULLY');
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
  console.log('📝 Logging enabled for all API requests');
  console.log('📊 Detailed logs for /api/generate-spec endpoint');
  console.log('='.repeat(60));
}).on('error', (err) => {
  console.error('='.repeat(60));
  console.error('❌ FAILED TO START SERVER');
  console.error('='.repeat(60));
  console.error(`Error: ${err.message}`);
  console.error(`Code: ${err.code}`);
  console.error(`Stack: ${err.stack}`);
  console.error('='.repeat(60));
});
