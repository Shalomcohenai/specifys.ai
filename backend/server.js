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
  // Fallback: some setups use API_KEY; map it if present
  if (!process.env.OPENAI_API_KEY && process.env.API_KEY) {
    process.env.OPENAI_API_KEY = process.env.API_KEY;
  }
}

// Clear require cache for development
delete require.cache[require.resolve('./server/chat-routes')];
delete require.cache[require.resolve('./server/openai-storage-service')];

// Import modules that may read env at require-time AFTER loading env
const express = require('express');
const fetch = require('node-fetch');
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

// Apply rate limiting (lemon routes registered earlier, before rate limiting)
app.use('/api/', rateLimiters.general);
app.use('/api/admin/', rateLimiters.admin);
app.use('/api/auth/', rateLimiters.auth);
app.use('/api/feedback', rateLimiters.feedback);

// CORS middleware to allow requests from your frontend
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

// Legacy endpoint to handle API requests to Grok (deprecated - use /api/specs/create instead)
app.post('/api/generate-spec', rateLimiters.generation, async (req, res) => {
  const { userInput } = req.body;

  if (!userInput) {
    return res.status(400).json({ error: 'User input is required' });
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key is not configured' });
  }

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that generates detailed application specifications.' },
          { role: 'user', content: userInput },
        ],
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to fetch specification');
    }

    res.json({ specification: data.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate specification' });
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
  // Server started successfully
}).on('error', (err) => {
  // Failed to start server
});
