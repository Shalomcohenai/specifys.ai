console.log('Starting server setup...');

const express = require('express');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const { syncAllUsers } = require('./server/user-management');
const blogRoutes = require('./server/blog-routes');

// Load environment variables from .env file
console.log('Loading environment variables...');
dotenv.config();

const app = express();
const port = 3001; // Changed to 3001 to avoid potential port conflicts

// Middleware to parse JSON bodies
console.log('Setting up middleware...');
app.use(express.json());

// Serve static files from the current directory
app.use(express.static('.'));

// Serve blog files from _site/blog directory
app.use('/blog', express.static('_site/blog'));

// Serve blog posts from _site/2025 directory structure
app.use('/2025', express.static('_site/2025'));

// CORS middleware to allow requests from your frontend
app.use((req, res, next) => {
  console.log('Applying CORS middleware...');
  res.header('*', 'http://localhost:8080');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
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

// Endpoint to handle API requests to Grok
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

// Start the server
console.log('Attempting to start server on port', port);
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
}).on('error', (err) => {
  console.error('Failed to start server:', err.message);
});
