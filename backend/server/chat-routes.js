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

    return 'iAzaUwtSW3qvcW87lICL';
  } catch (error) {

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

        const fileId = await openaiStorage.uploadSpec(specId, specData);
        
        // Update Firebase with file ID
        await db.collection('specs').doc(specId).update({
          openaiFileId: fileId,
          uploadedToOpenAI: true,
          openaiUploadTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        specData.openaiFileId = fileId;

      } catch (uploadError) {

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

        
        try {
          // Delete old file from OpenAI
          await openaiStorage.deleteFile(specData.openaiFileId);

          
          // Upload updated spec
          const newFileId = await openaiStorage.uploadSpec(specId, specData);
          
          // Update Firebase
          await db.collection('specs').doc(specId).update({
            openaiFileId: newFileId,
            openaiUploadTimestamp: admin.firestore.FieldValue.serverTimestamp()
          });
          
          // Delete old assistant if exists (we'll create a new one)
          if (specData.openaiAssistantId) {

            await openaiStorage.deleteAssistant(specData.openaiAssistantId);
            
            // Clear assistant ID from Firebase
            await db.collection('specs').doc(specId).update({
              openaiAssistantId: admin.firestore.FieldValue.delete()
            });
            
            // Reset assistant ID so it will be recreated below
            specData.openaiAssistantId = null;
          }
          
          specData.openaiFileId = newFileId;

          
        } catch (uploadError) {

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

      const assistant = await openaiStorage.createAssistant(specId, specData.openaiFileId);
      assistantId = assistant.id;
      
      // Save assistant ID
      await db.collection('specs').doc(specId).update({
        openaiAssistantId: assistantId
      });

    } else {

      // Ensure the assistant has vector store configured
      try {
        const verifiedAssistant = await openaiStorage.ensureAssistantHasVectorStore(assistantId, specData.openaiFileId);
        // Double-check: verify the assistant actually has tool_resources in the response
        if (!verifiedAssistant.tool_resources?.file_search?.vector_store_ids?.length) {

          // Delete old assistant and create new one
          await openaiStorage.deleteAssistant(assistantId);
          const newAssistant = await openaiStorage.createAssistant(specId, specData.openaiFileId);
          assistantId = newAssistant.id;
          await db.collection('specs').doc(specId).update({
            openaiAssistantId: assistantId
          });

        }
      } catch (error) {

        // If we can't fix it, try recreating the assistant

        try {
          await openaiStorage.deleteAssistant(assistantId);
          const newAssistant = await openaiStorage.createAssistant(specId, specData.openaiFileId);
          assistantId = newAssistant.id;
          await db.collection('specs').doc(specId).update({
            openaiAssistantId: assistantId
          });

        } catch (recreateError) {

          throw new Error(`Failed to configure assistant: ${error.message}`);
        }
      }
    }
    
    // Create thread
    const thread = await openaiStorage.createThread();

    
    res.json({
      success: true,
      threadId: thread.id,
      assistantId: assistantId
    });
    
  } catch (error) {

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
    
    const { specId, threadId, assistantId: initialAssistantId, message } = req.body;
    let assistantId = initialAssistantId; // Use let so we can update it during recreation
    const userId = req.user.uid;
    
    // Verify ownership
    const specDoc = await db.collection('specs').doc(specId).get();
    if (!specDoc.exists || specDoc.data().userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Ensure assistant has vector store before sending message
    const specData = specDoc.data();
    if (specData.openaiFileId) {
      try {
        const updatedAssistant = await openaiStorage.ensureAssistantHasVectorStore(assistantId, specData.openaiFileId);
        // Verify tool_resources is actually set
        const vectorStoreIds = updatedAssistant.tool_resources?.file_search?.vector_store_ids || [];
        if (vectorStoreIds.length === 0) {

          // Delete and recreate assistant
          await openaiStorage.deleteAssistant(assistantId);
          const newAssistant = await openaiStorage.createAssistant(specId, specData.openaiFileId);
          assistantId = newAssistant.id;
          await db.collection('specs').doc(specId).update({
            openaiAssistantId: assistantId
          });

        } else {

        }
      } catch (ensureError) {

        // Try to recreate assistant if ensure failed

        try {
          await openaiStorage.deleteAssistant(assistantId);
          const newAssistant = await openaiStorage.createAssistant(specId, specData.openaiFileId);
          assistantId = newAssistant.id;
          await db.collection('specs').doc(specId).update({
            openaiAssistantId: assistantId
          });

        } catch (recreateError) {

          throw new Error(`Failed to configure assistant: ${ensureError.message}`);
        }
      }
    }
    
    // Send message and get response


    
    try {
      const response = await openaiStorage.sendMessage(threadId, assistantId, message);

      
      res.json({
        success: true,
        response: response
      });
    } catch (error) {
      // If error indicates assistant is corrupted (vector store not propagated), recreate it
      const isCorrupted = error.isCorruptedAssistant || 
          error.message.includes('corrupted') || 
          error.message.includes('Vector store configuration not propagated') ||
          (error.message.includes('server_error') && error.message.includes('Vector store configuration'));
      
      if (isCorrupted) {

        try {
          if (specData.openaiFileId) {
            // Delete old assistant and wait a bit
            await openaiStorage.deleteAssistant(assistantId);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for deletion to propagate
            
            // Create new assistant with proper vector store
            const newAssistant = await openaiStorage.createAssistant(specId, specData.openaiFileId);
            const newAssistantId = newAssistant.id;
            
            // Ensure vector store is properly configured
            await openaiStorage.ensureAssistantHasVectorStore(newAssistantId, specData.openaiFileId);
            
            // Wait a bit more for configuration to propagate
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Update Firebase
            await db.collection('specs').doc(specId).update({
              openaiAssistantId: newAssistantId
            });

            
            // Retry with new assistant - need new thread too
            const newThread = await openaiStorage.createThread();
            const response = await openaiStorage.sendMessage(newThread.id, newAssistantId, message);

            
            res.json({
              success: true,
              response: response,
              threadId: newThread.id,
              assistantId: newAssistantId
            });
            return;
          }
        } catch (recreateError) {

          // Continue to throw original error
        }
      }
      // If error is server_error, try to fix and retry once
      if (error.message.includes('server_error') || error.message.includes('tool_resources')) {

        try {
          if (specData.openaiFileId) {
            await openaiStorage.ensureAssistantHasVectorStore(assistantId, specData.openaiFileId);

            // Retry once
            const response = await openaiStorage.sendMessage(threadId, assistantId, message);

            
            res.json({
              success: true,
              response: response
            });
            return;
          }
        } catch (fixError) {

        }
      }
      // Re-throw original error if fix didn't work
      throw error;
    }
    
  } catch (error) {

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
  const requestId = req.requestId || `diagrams-generate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  console.log(`[${requestId}] ===== /api/chat/diagrams/generate START =====`);
  console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
  console.log(`[${requestId}] Request Body:`, {
    specId: req.body.specId,
    hasSpecId: !!req.body.specId
  });
  console.log(`[${requestId}] User ID: ${req.user.uid}`);

  try {
    if (!openaiStorage) {
      console.error(`[${requestId}] ❌ OpenAI not configured`);
      const totalTime = Date.now() - startTime;
      console.error(`[${requestId}] ===== /api/chat/diagrams/generate FAILED (${totalTime}ms) =====`);
      return res.status(503).json({ error: 'OpenAI not configured', requestId });
    }
    
    const { specId } = req.body;
    const userId = req.user.uid;
    
    if (!specId) {
      console.error(`[${requestId}] ❌ Missing specId in request body`);
      const totalTime = Date.now() - startTime;
      console.error(`[${requestId}] ===== /api/chat/diagrams/generate FAILED (${totalTime}ms) =====`);
      return res.status(400).json({ error: 'specId is required', requestId });
    }
    
    // Verify spec ownership
    console.log(`[${requestId}] 📤 Step 1: Verifying spec ownership`);
    const specCheckStart = Date.now();
    const specDoc = await db.collection('specs').doc(specId).get();
    const specCheckTime = Date.now() - specCheckStart;
    console.log(`[${requestId}] ⏱️  Spec check took ${specCheckTime}ms`);
    
    if (!specDoc.exists || specDoc.data().userId !== userId) {
      console.error(`[${requestId}] ❌ Unauthorized: Spec not found or user does not own it`);
      const totalTime = Date.now() - startTime;
      console.error(`[${requestId}] ===== /api/chat/diagrams/generate FAILED (${totalTime}ms) =====`);
      return res.status(403).json({ error: 'Unauthorized', requestId });
    }
    
    const specData = specDoc.data();
    console.log(`[${requestId}] Spec Data:`, {
      hasTitle: !!specData.title,
      hasOpenaiFileId: !!specData.openaiFileId,
      hasOpenaiAssistantId: !!specData.openaiAssistantId,
      ownerUserId: specData.userId
    });

    
    // Ensure spec has been uploaded to OpenAI
    // Use let so we can update assistantId during recreation
    let assistantId = specData.openaiAssistantId;
    console.log(`[${requestId}] Initial Assistant ID: ${assistantId || 'none'}`);
    
    if (!assistantId) {
      console.log(`[${requestId}] 📤 Step 2: Creating assistant (no existing assistant)`);
      
      // Upload spec if not already done
      if (!specData.openaiFileId) {
        console.log(`[${requestId}] 📤 Step 2a: Uploading spec to OpenAI first`);
        const uploadStart = Date.now();
        const fileId = await openaiStorage.uploadSpec(specId, specData);
        const uploadTime = Date.now() - uploadStart;
        console.log(`[${requestId}] ⏱️  Upload took ${uploadTime}ms, File ID: ${fileId}`);
        
        const updateStart = Date.now();
        await db.collection('specs').doc(specId).update({
          openaiFileId: fileId,
          uploadedToOpenAI: true,
          openaiUploadTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        const updateTime = Date.now() - updateStart;
        console.log(`[${requestId}] ⏱️  Firestore update took ${updateTime}ms`);
        specData.openaiFileId = fileId;
      } else {
        console.log(`[${requestId}] ✅ Spec already uploaded, File ID: ${specData.openaiFileId}`);
      }
      
      // Create assistant
      console.log(`[${requestId}] 📤 Step 2b: Creating assistant`);
      const assistantStart = Date.now();
      const assistant = await openaiStorage.createAssistant(specId, specData.openaiFileId);
      const assistantTime = Date.now() - assistantStart;
      console.log(`[${requestId}] ⏱️  Assistant creation took ${assistantTime}ms`);
      assistantId = assistant.id;
      console.log(`[${requestId}] ✅ Assistant created: ${assistantId}`);
      
      // Save to database
      console.log(`[${requestId}] 📤 Step 2c: Saving assistant ID to Firestore`);
      const saveStart = Date.now();
      await db.collection('specs').doc(specId).update({
        openaiAssistantId: assistantId
      });
      const saveTime = Date.now() - saveStart;
      console.log(`[${requestId}] ⏱️  Firestore save took ${saveTime}ms`);
      console.log(`[${requestId}] ✅ Assistant ID saved to Firestore`);

    } else {
      console.log(`[${requestId}] 📤 Step 2: Ensuring assistant has vector store (existing assistant)`);

      // Ensure assistant has vector store configured (similar to chat message endpoint)
      if (specData.openaiFileId) {
        try {
          console.log(`[${requestId}] 📤 Step 2a: Ensuring vector store`);
          const ensureStart = Date.now();
          const updatedAssistant = await openaiStorage.ensureAssistantHasVectorStore(assistantId, specData.openaiFileId);
          const ensureTime = Date.now() - ensureStart;
          console.log(`[${requestId}] ⏱️  Ensure vector store took ${ensureTime}ms`);
          
          // Verify tool_resources is actually set
          const vectorStoreIds = updatedAssistant.tool_resources?.file_search?.vector_store_ids || [];
          console.log(`[${requestId}] Vector Store IDs:`, vectorStoreIds);
          
          if (vectorStoreIds.length === 0) {
            console.warn(`[${requestId}] ⚠️  Assistant has no vector stores, recreating...`);

            // Delete and recreate assistant
            await openaiStorage.deleteAssistant(assistantId);
            const newAssistant = await openaiStorage.createAssistant(specId, specData.openaiFileId);
            assistantId = newAssistant.id;
            await db.collection('specs').doc(specId).update({
              openaiAssistantId: assistantId
            });
            console.log(`[${requestId}] ✅ Assistant recreated: ${assistantId}`);

          } else {
            console.log(`[${requestId}] ✅ Assistant has vector stores configured`);

          }
        } catch (ensureError) {
          console.error(`[${requestId}] ❌ Error ensuring vector store:`, {
            message: ensureError.message,
            name: ensureError.name
          });

          // Try to recreate assistant if ensure failed
          console.log(`[${requestId}] 🔄 Attempting to recreate assistant`);
          try {
            await openaiStorage.deleteAssistant(assistantId);
            const newAssistant = await openaiStorage.createAssistant(specId, specData.openaiFileId);
            assistantId = newAssistant.id;
            await db.collection('specs').doc(specId).update({
              openaiAssistantId: assistantId
            });
            console.log(`[${requestId}] ✅ Assistant recreated: ${assistantId}`);

          } catch (recreateError) {
            console.error(`[${requestId}] ❌ Failed to recreate assistant:`, {
              message: recreateError.message,
              name: recreateError.name
            });

            throw new Error(`Failed to configure assistant: ${ensureError.message}`);
          }
        }
      } else {
        console.warn(`[${requestId}] ⚠️  Spec has no OpenAI file ID, cannot ensure vector store`);
      }
    }
    
    // Generate diagrams using Assistant API (with retry on vector store errors)
    console.log(`[${requestId}] 📤 Step 3: Generating diagrams`);
    console.log(`[${requestId}] Using Assistant ID: ${assistantId}`);
    
    let diagrams;
    const generateStart = Date.now();
    try {
      diagrams = await openaiStorage.generateDiagrams(specId, assistantId);
      const generateTime = Date.now() - generateStart;
      console.log(`[${requestId}] ⏱️  Diagram generation took ${generateTime}ms`);
      console.log(`[${requestId}] ✅ Diagrams generated:`, {
        count: diagrams?.length || 0,
        diagramTypes: diagrams?.map(d => d.type) || []
      });

    } catch (error) {
      const generateTime = Date.now() - generateStart;
      console.error(`[${requestId}] ❌ Diagram generation failed (${generateTime}ms):`, {
        message: error.message,
        name: error.name,
        isCorruptedAssistant: error.isCorruptedAssistant
      });
      
      // If error indicates assistant is corrupted (vector store not propagated), recreate it
      const isCorrupted = error.isCorruptedAssistant || 
          error.message.includes('corrupted') || 
          error.message.includes('Vector store configuration not propagated');
      
      if (isCorrupted) {
        console.log(`[${requestId}] 🔄 Detected corrupted assistant, attempting to recreate`);

        try {
          if (specData.openaiFileId) {
            // Delete old assistant and wait
            console.log(`[${requestId}] 📤 Deleting corrupted assistant`);
            await openaiStorage.deleteAssistant(assistantId);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for deletion
            console.log(`[${requestId}] ✅ Assistant deleted, waiting 2s`);
            
            // Create new assistant with proper vector store
            console.log(`[${requestId}] 📤 Creating new assistant`);
            const recreateStart = Date.now();
            const newAssistant = await openaiStorage.createAssistant(specId, specData.openaiFileId);
            const recreateTime = Date.now() - recreateStart;
            console.log(`[${requestId}] ⏱️  Assistant recreation took ${recreateTime}ms`);
            const newAssistantId = newAssistant.id;
            console.log(`[${requestId}] ✅ New assistant created: ${newAssistantId}`);
            
            // Ensure vector store is properly configured
            console.log(`[${requestId}] 📤 Ensuring vector store for new assistant`);
            await openaiStorage.ensureAssistantHasVectorStore(newAssistantId, specData.openaiFileId);
            
            // Wait for configuration to propagate
            console.log(`[${requestId}] ⏳ Waiting 3s for configuration to propagate`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Update Firebase
            console.log(`[${requestId}] 📤 Updating Firestore with new assistant ID`);
            await db.collection('specs').doc(specId).update({
              openaiAssistantId: newAssistantId
            });
            console.log(`[${requestId}] ✅ Firestore updated`);

            
            // Retry with new assistant
            console.log(`[${requestId}] 🔄 Retrying diagram generation with new assistant`);
            const retryStart = Date.now();
            diagrams = await openaiStorage.generateDiagrams(specId, newAssistantId);
            const retryTime = Date.now() - retryStart;
            console.log(`[${requestId}] ⏱️  Retry took ${retryTime}ms`);
            console.log(`[${requestId}] ✅ Diagrams generated after retry:`, {
              count: diagrams?.length || 0
            });

          } else {
            console.error(`[${requestId}] ❌ No file ID available, cannot recreate assistant`);
            throw error; // Re-throw if no file ID
          }
        } catch (recreateError) {
          console.error(`[${requestId}] ❌ Failed to recreate assistant:`, {
            message: recreateError.message,
            name: recreateError.name
          });

          throw error; // Re-throw original error
        }
      } else {
        // If it's a server_error related to tool_resources, try to fix and retry once
        if (error.message.includes('server_error') || error.message.includes('tool_resources')) {
          console.log(`[${requestId}] 🔄 Detected server_error/tool_resources issue, attempting to fix`);

          try {
            if (specData.openaiFileId) {
              await openaiStorage.ensureAssistantHasVectorStore(assistantId, specData.openaiFileId);
              console.log(`[${requestId}] ✅ Vector store ensured, retrying`);

              // Retry once
              const retryStart = Date.now();
              diagrams = await openaiStorage.generateDiagrams(specId, assistantId);
              const retryTime = Date.now() - retryStart;
              console.log(`[${requestId}] ⏱️  Retry took ${retryTime}ms`);
              console.log(`[${requestId}] ✅ Diagrams generated after retry:`, {
                count: diagrams?.length || 0
              });

            } else {
              throw error; // Re-throw if no file ID
            }
          } catch (fixError) {
            console.error(`[${requestId}] ❌ Fix attempt failed:`, {
              message: fixError.message,
              name: fixError.name
            });

            throw error; // Re-throw original error
          }
        } else {
          console.error(`[${requestId}] ❌ Non-retryable error, re-throwing`);
          // Re-throw other errors
          throw error;
        }
      }
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`[${requestId}] ✅ /api/chat/diagrams/generate SUCCESS (${totalTime}ms total)`);
    console.log(`[${requestId}] ===== /api/chat/diagrams/generate COMPLETE =====`);
    
    res.json({
      success: true,
      diagrams: diagrams,
      requestId
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[${requestId}] ❌ ERROR in /api/chat/diagrams/generate (${totalTime}ms):`, {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    console.error(`[${requestId}] ===== /api/chat/diagrams/generate ERROR =====`);

    
    // Provide more helpful error messages
    let errorMessage = 'Failed to generate diagrams';
    const errorDetails = error && error.message;
    
    if (errorDetails && errorDetails.includes('server_error')) {
      errorMessage = 'OpenAI service temporarily unavailable. Please try again in a few moments.';
    } else if (errorDetails && errorDetails.includes('rate_limit')) {
      errorMessage = 'Rate limit exceeded. Please try again in a few moments.';
    } else if (errorDetails && errorDetails.includes('timeout')) {
      errorMessage = 'Request timed out. The diagrams generation is taking longer than expected. Please try again.';
    } else if (errorDetails) {
      errorMessage = `Failed to generate diagrams: ${errorDetails}`;
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: errorDetails,
      requestId
    });
  }
});

/**
 * Repair a broken diagram using Assistant API
 * POST /api/chat/diagrams/repair
 */
router.post('/diagrams/repair', verifyFirebaseToken, async (req, res) => {
  try {

    if (!openaiStorage) {
      return res.status(503).json({ error: 'OpenAI not configured' });
    }
    
    const { specId, diagramId, brokenCode, diagramType, errorMessage } = req.body;
    const userId = req.user.uid;
    
    if (!specId || !brokenCode || !diagramType) {
      return res.status(400).json({ error: 'specId, brokenCode, and diagramType are required' });
    }
    
    // Verify spec ownership
    const specDoc = await db.collection('specs').doc(specId).get();
    if (!specDoc.exists || specDoc.data().userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const specData = specDoc.data();


    
    // Ensure spec has been uploaded to OpenAI
    let assistantId = specData.openaiAssistantId;
    
    if (!assistantId) {
      // Upload spec if not already done
      if (!specData.openaiFileId) {

        const fileId = await openaiStorage.uploadSpec(specId, specData);
        await db.collection('specs').doc(specId).update({
          openaiFileId: fileId,
          uploadedToOpenAI: true,
          openaiUploadTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        specData.openaiFileId = fileId;
      }
      
      // Create assistant
      const assistant = await openaiStorage.createAssistant(specId, specData.openaiFileId);
      assistantId = assistant.id;
      
      // Save to database
      await db.collection('specs').doc(specId).update({
        openaiAssistantId: assistantId
      });
      

    } else {

    }
    
    // Get diagram data to find title
    const diagrams = specData.diagrams?.diagrams || [];
    const diagramData = diagrams.find(d => d.id === diagramId);
    const diagramTitle = diagramData?.title || `${diagramType} Diagram`;
    
    // Repair diagram using Assistant API
    const repairedCode = await openaiStorage.repairDiagram(specId, assistantId, brokenCode, diagramTitle, diagramType, errorMessage);
    

    
    res.json({
      success: true,
      repairedDiagram: {
        mermaidCode: repairedCode
      }
    });
    
  } catch (error) {

    res.status(500).json({ 
      error: 'Failed to repair diagram',
      details: error && error.message 
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

    }
    
    // If no assistant provided, check if spec has one or create
    if (!currentAssistantId) {
      currentAssistantId = specData.openaiAssistantId;
      
      if (!currentAssistantId) {
        // Upload spec to OpenAI if not already done
        if (!specData.openaiFileId) {

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
        

      } else {

      }
    }
    
    // Send message and get response

    const response = await openaiStorage.sendMessage(currentThreadId, currentAssistantId, message);
    

    
    res.json({
      success: true,
      response: response,
      threadId: currentThreadId,
      assistantId: currentAssistantId
    });
    
  } catch (error) {

    res.status(500).json({ 
      error: 'Failed to send message',
      details: error.message 
    });
  }
});

module.exports = router;

