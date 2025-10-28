const express = require('express');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const { syncAllUsers } = require('./server/user-management');
const blogRoutes = require('./server/blog-routes');
const specRoutes = require('./server/spec-routes');
const chatRoutes = require('./server/chat-routes');
const { handleLemonWebhook } = require('./server/lemon-webhook');
const { securityHeaders, rateLimiters } = require('./server/security');

// Load environment variables from .env file
console.log('Loading environment variables...');
dotenv.config();

const app = express();
const port = 3001; // Changed to 3001 to avoid potential port conflicts

// Apply security headers
app.use(securityHeaders);

// Apply rate limiting
app.use('/api/', rateLimiters.general);
app.use('/api/admin/', rateLimiters.admin);
app.use('/api/auth/', rateLimiters.auth);
app.use('/api/feedback', rateLimiters.feedback);

// CORS middleware to allow requests from your frontend
app.use((req, res, next) => {
  // console.log('Applying CORS middleware...');
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:4000',
    'http://localhost:8080',
    'http://localhost:10000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:4000',
    'https://specifys-ai.com'
  ];
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

// Lemon Squeezy webhook endpoint (must be before express.json())
app.post('/api/webhook/lemon', express.raw({type: 'application/json'}), handleLemonWebhook);

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the parent directory (main site)
app.use(express.static('..'));

// Serve blog files from _site/blog directory
app.use('/blog', express.static('../_site/blog'));

// Serve blog posts from _site/2025 directory structure
app.use('/2025', express.static('../_site/2025'));

// Spec routes with authorization
app.use('/api/specs', specRoutes);

// Chat routes for AI chat functionality
app.use('/api/chat', chatRoutes);

// Basic route for server status
app.get('/api/status', (req, res) => {
  res.status(200).json({ message: 'Server is running' });
});

// Endpoint to sync users from Firebase Auth to Firestore
app.post('/api/sync-users', async (req, res) => {
  console.log('🔄 Sync users request received');
  
  try {
    const result = await syncAllUsers();
    console.log('✅ User sync completed successfully');
    res.json({
      success: true,
      message: 'Users synced successfully',
      result: result
    });
  } catch (error) {
    console.error('❌ Error syncing users:', error);
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
app.post('/api/generate-spec', async (req, res) => {
  console.log('Received request:', req.body);
  const { userInput } = req.body;

  if (!userInput) {
    console.log('Error: User input is required');
    return res.status(400).json({ error: 'User input is required' });
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.log('Error: API key is not configured');
    return res.status(500).json({ error: 'API key is not configured' });
  }

  try {
    console.log('Sending request to Grok API...');
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
      console.log('Error from Grok API:', data.error?.message);
      throw new Error(data.error?.message || 'Failed to fetch specification');
    }

    console.log('Successfully received specification from Grok API');
    res.json({ specification: data.choices[0].message.content });
  } catch (error) {
    console.error('Error fetching specification:', error.message);
    res.status(500).json({ error: 'Failed to generate specification' });
  }
});

// Repair diagram endpoint
app.post('/api/diagrams/repair', async (req, res) => {
  console.log('Received diagram repair request:', req.body);
  
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
    
    console.log('✅ Diagram repaired successfully');
    res.json({ 
      success: true,
      repairedDiagram: {
        mermaidCode: cleanedCode
      }
    });
    
  } catch (error) {
    console.error('Error repairing diagram:', error.message);
    res.status(500).json({ error: 'Failed to repair diagram' });
  }
});

// Start the server
console.log('Attempting to start server on port', port);
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log('Available endpoints:');
  console.log('  POST /api/webhook/lemon - Lemon Squeezy webhook');
  console.log('  POST /api/specs/create - Create spec with authorization');
  console.log('  GET  /api/specs/entitlements - Get user entitlements');
  console.log('  GET  /api/specs/status - Get spec creation status');
  console.log('  POST /api/specs/check-edit - Check edit permissions');
  console.log('  POST /api/chat/init - Initialize chat for a spec');
  console.log('  POST /api/chat/message - Send message to chat');
  console.log('  POST /api/chat/diagrams/generate - Generate diagrams for spec');
  console.log('  POST /api/diagrams/repair - Repair broken diagram');
}).on('error', (err) => {
  console.error('Failed to start server:', err.message);
});
