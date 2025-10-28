const express = require('express');
const router = express.Router();
const { auth, db, admin } = require('./firebase-admin');
const OpenAIStorageService = require('./openai-storage-service');

const openaiStorage = process.env.OPENAI_API_KEY 
  ? new OpenAIStorageService(process.env.OPENAI_API_KEY)
  : null;

/**
 * Middleware to verify Firebase token
 */
async function verifyFirebaseToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No valid authorization header' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Initialize chat session for a spec
 * POST /api/chat/init
 */
router.post('/init', verifyFirebaseToken, async (req, res) => {
  try {
    if (!openaiStorage) {
      return res.status(503).json({ error: 'OpenAI not configured' });
    }
    
    const { specId } = req.body;
    const userId = req.user.uid;
    
    // Verify spec ownership
    const specDoc = await db.collection('specs').doc(specId).get();
    if (!specDoc.exists || specDoc.data().userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const specData = specDoc.data();
    
    // Check if spec has been uploaded to OpenAI
    if (!specData.openaiFileId) {
      // Try to upload the spec now
      try {
        console.log(`Attempting to upload spec ${specId} to OpenAI...`);
        const fileId = await openaiStorage.uploadSpec(specId, specData);
        
        // Update Firebase with file ID
        await db.collection('specs').doc(specId).update({
          openaiFileId: fileId,
          uploadedToOpenAI: true,
          openaiUploadTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        specData.openaiFileId = fileId;
        console.log(`Successfully uploaded spec ${specId} to OpenAI`);
      } catch (uploadError) {
        console.error(`Failed to upload spec ${specId}:`, uploadError.message);
        return res.status(400).json({ 
          error: 'Spec not uploaded to OpenAI yet',
          needsUpload: true,
          uploadError: uploadError.message
        });
      }
    }
    
    // Create assistant if not exists
    let assistantId = specData.openaiAssistantId;
    if (!assistantId) {
      console.log(`Creating assistant for spec ${specId}`);
      const assistant = await openaiStorage.createAssistant(specId, specData.openaiFileId);
      assistantId = assistant.id;
      
      // Save assistant ID
      await db.collection('specs').doc(specId).update({
        openaiAssistantId: assistantId
      });
    }
    
    // Create thread
    const thread = await openaiStorage.createThread();
    
    res.json({
      success: true,
      threadId: thread.id,
      assistantId: assistantId
    });
    
  } catch (error) {
    console.error('Error initializing chat:', error);
    res.status(500).json({ 
      error: 'Failed to initialize chat',
      details: error.message 
    });
  }
});

/**
 * Send message to chat
 * POST /api/chat/message
 */
router.post('/message', verifyFirebaseToken, async (req, res) => {
  try {
    if (!openaiStorage) {
      return res.status(503).json({ error: 'OpenAI not configured' });
    }
    
    const { specId, threadId, assistantId, message } = req.body;
    const userId = req.user.uid;
    
    // Verify ownership
    const specDoc = await db.collection('specs').doc(specId).get();
    if (!specDoc.exists || specDoc.data().userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Send message and get response
    console.log(`Sending message for spec ${specId} with thread ${threadId}`);
    const response = await openaiStorage.sendMessage(threadId, assistantId, message);
    console.log(`Received response for spec ${specId}`);
    
    res.json({
      success: true,
      response: response
    });
    
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ 
      error: 'Failed to send message',
      details: error.message 
    });
  }
});

/**
 * Generate diagrams for a specification
 * POST /api/chat/diagrams/generate
 */
router.post('/diagrams/generate', verifyFirebaseToken, async (req, res) => {
  try {
    if (!openaiStorage) {
      return res.status(503).json({ error: 'OpenAI not configured' });
    }
    
    const { specId } = req.body;
    const userId = req.user.uid;
    
    if (!specId) {
      return res.status(400).json({ error: 'specId is required' });
    }
    
    // Verify spec ownership
    const specDoc = await db.collection('specs').doc(specId).get();
    if (!specDoc.exists || specDoc.data().userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const specData = specDoc.data();
    
    console.log(`Generating diagrams for spec ${specId} using OpenAI memory`);
    
    // Generate diagrams using OpenAI storage service
    // This will extract technical and overview data and generate diagrams
    const diagrams = await openaiStorage.generateDiagrams(specData);
    
    console.log(`Successfully generated ${diagrams.length} diagrams for spec ${specId}`);
    
    res.json({
      success: true,
      diagrams: diagrams
    });
    
  } catch (error) {
    console.error('Error generating diagrams:', error);
    res.status(500).json({ 
      error: 'Failed to generate diagrams',
      details: error.message 
    });
  }
});

module.exports = router;

