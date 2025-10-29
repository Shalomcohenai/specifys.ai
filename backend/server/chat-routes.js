const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { auth, db, admin } = require('./firebase-admin');
const OpenAIStorageService = require('./openai-storage-service');

const openaiStorage = process.env.OPENAI_API_KEY 
  ? new OpenAIStorageService(process.env.OPENAI_API_KEY)
  : null;

// Cache for demo spec ID to avoid repeated queries
let cachedDemoSpecId = null;

/**
 * Get the public demo spec ID
 */
async function getDemoSpecId() {
  if (cachedDemoSpecId) {
    return cachedDemoSpecId;
  }
  
  try {
    const snapshot = await db.collection('specs')
      .where('isPublic', '==', true)
      .limit(1)
      .get();
    
    if (!snapshot.empty) {
      cachedDemoSpecId = snapshot.docs[0].id;
      return cachedDemoSpecId;
    }
    
    // Fallback to old hardcoded ID for backward compatibility
    console.warn('⚠️ No public spec found, using fallback ID');
    return 'iAzaUwtSW3qvcW87lICL';
  } catch (error) {
    console.error('Error getting demo spec ID:', error);
    return 'iAzaUwtSW3qvcW87lICL';
  }
}

// Rate limiting for demo chat (10 messages per hour per IP)
const demoChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 messages per hour
  message: {
    error: 'Too many demo chat requests. Please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

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
    } else {
      // Check if spec has been updated since last upload
      const uploadTimestamp = specData.openaiUploadTimestamp?.toMillis ? specData.openaiUploadTimestamp.toMillis() : 0;
      const specUpdatedTimestamp = specData.updatedAt?.toMillis ? specData.updatedAt.toMillis() : 0;
      
      // If spec was updated after upload, re-upload it
      if (specUpdatedTimestamp > uploadTimestamp) {
        console.log(`Spec ${specId} was updated after OpenAI upload. Re-uploading...`);
        
        try {
          // Delete old file from OpenAI
          await openaiStorage.deleteFile(specData.openaiFileId);
          console.log(`Deleted old OpenAI file ${specData.openaiFileId}`);
          
          // Upload updated spec
          const newFileId = await openaiStorage.uploadSpec(specId, specData);
          
          // Update Firebase
          await db.collection('specs').doc(specId).update({
            openaiFileId: newFileId,
            openaiUploadTimestamp: admin.firestore.FieldValue.serverTimestamp()
          });
          
          // Delete old assistant if exists (we'll create a new one)
          if (specData.openaiAssistantId) {
            console.log(`[Cleanup] Deleting old assistant ${specData.openaiAssistantId} for spec ${specId}`);
            await openaiStorage.deleteAssistant(specData.openaiAssistantId);
            
            // Clear assistant ID from Firebase
            await db.collection('specs').doc(specId).update({
              openaiAssistantId: admin.firestore.FieldValue.delete()
            });
            
            // Reset assistant ID so it will be recreated below
            specData.openaiAssistantId = null;
          }
          
          specData.openaiFileId = newFileId;
          console.log(`[Cleanup] Successfully re-uploaded spec ${specId} to OpenAI with new file ${newFileId}`);
          
        } catch (uploadError) {
          console.error(`Failed to re-upload spec ${specId}:`, uploadError.message);
          return res.status(400).json({ 
            error: 'Failed to update OpenAI file',
            needsUpload: true,
            uploadError: uploadError.message
          });
        }
      }
    }
    
    // Create assistant if not exists
    let assistantId = specData.openaiAssistantId;
    if (!assistantId) {
      console.log(`[Chat Init] Creating new assistant for spec ${specId}`);
      const assistant = await openaiStorage.createAssistant(specId, specData.openaiFileId);
      assistantId = assistant.id;
      
      // Save assistant ID
      await db.collection('specs').doc(specId).update({
        openaiAssistantId: assistantId
      });
      console.log(`[Chat Init] Created assistant ${assistantId} for spec ${specId}`);
    } else {
      console.log(`[Chat Init] Reusing existing assistant ${assistantId} for spec ${specId}`);
    }
    
    // Create thread
    const thread = await openaiStorage.createThread();
    console.log(`[Chat Init] Created thread ${thread.id} for spec ${specId}`);
    
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
    console.log(`[Chat Message] Spec: ${specId}, Thread: ${threadId}, Assistant: ${assistantId}`);
    console.log(`[Chat Message] Message: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);
    const response = await openaiStorage.sendMessage(threadId, assistantId, message);
    console.log(`[Chat Message] Received response for spec ${specId}`);
    
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

/**
 * Public demo chat endpoint (no authentication required)
 * POST /api/chat/demo
 */
router.post('/demo', demoChatLimiter, async (req, res) => {
  try {
    if (!openaiStorage) {
      return res.status(503).json({ error: 'OpenAI not configured' });
    }
    
    const { threadId, assistantId, message } = req.body;
    
    // Validate input
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Get demo spec ID
    const demoSpecId = await getDemoSpecId();
    
    // Load demo spec data
    const specDoc = await db.collection('specs').doc(demoSpecId).get();
    if (!specDoc.exists) {
      return res.status(404).json({ error: 'Demo specification not found' });
    }
    
    const specData = specDoc.data();
    
    // Use provided thread/assistant or create new ones
    let currentThreadId = threadId;
    let currentAssistantId = assistantId;
    
    // If no thread provided, create one
    if (!currentThreadId) {
      const thread = await openaiStorage.createThread();
      currentThreadId = thread.id;
      console.log(`[Demo Chat] Created new thread ${currentThreadId} for demo`);
    }
    
    // If no assistant provided, check if spec has one or create
    if (!currentAssistantId) {
      currentAssistantId = specData.openaiAssistantId;
      
      if (!currentAssistantId) {
        // Upload spec to OpenAI if not already done
        if (!specData.openaiFileId) {
          console.log(`[Demo Chat] Uploading spec ${demoSpecId} to OpenAI...`);
          const fileId = await openaiStorage.uploadSpec(demoSpecId, specData);
          await db.collection('specs').doc(demoSpecId).update({
            openaiFileId: fileId,
            uploadedToOpenAI: true,
            openaiUploadTimestamp: admin.firestore.FieldValue.serverTimestamp()
          });
          specData.openaiFileId = fileId;
        }
        
        // Create assistant
        const assistant = await openaiStorage.createAssistant(demoSpecId, specData.openaiFileId);
        currentAssistantId = assistant.id;
        
        // Save to database
        await db.collection('specs').doc(demoSpecId).update({
          openaiAssistantId: currentAssistantId
        });
        
        console.log(`[Demo Chat] Created new assistant ${currentAssistantId} for demo`);
      } else {
        console.log(`[Demo Chat] Using existing assistant ${currentAssistantId} for demo`);
      }
    }
    
    // Send message and get response
    console.log(`[Demo Chat] Sending message on thread ${currentThreadId}`);
    const response = await openaiStorage.sendMessage(currentThreadId, currentAssistantId, message);
    
    console.log(`[Demo Chat] Received response for demo chat`);
    
    res.json({
      success: true,
      response: response,
      threadId: currentThreadId,
      assistantId: currentAssistantId
    });
    
  } catch (error) {
    console.error('Error in demo chat:', error);
    res.status(500).json({ 
      error: 'Failed to send message',
      details: error.message 
    });
  }
});

module.exports = router;

