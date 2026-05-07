const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { db, admin } = require('./firebase-admin');
const OpenAIStorageService = require('./openai-storage-service');
const ChatService = require('./chat-service');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');
const { retryWithBackoff, isRetryableError } = require('./retry-handler');

const openaiStorage = process.env.OPENAI_API_KEY 
  ? new OpenAIStorageService(process.env.OPENAI_API_KEY)
  : null;

const chatService = openaiStorage ? new ChatService(openaiStorage) : null;

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

const { verifyFirebaseToken } = require('./middleware/auth');

/**
 * Initialize chat session for a spec
 * POST /api/chat/init
 */
router.post('/init', verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `chat-init-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, userId: req.user?.uid }, '[chat-routes] POST /init - Starting chat initialization');
  
  try {
    if (!chatService) {
      logger.error({ requestId }, '[chat-routes] OpenAI not configured');
      return next(createError('OpenAI not configured', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 503));
    }
    
    const { specId } = req.body;
    const userId = req.user.uid;
    logger.debug({ requestId, specId, userId }, '[chat-routes] Initializing chat session');
    
    // Ensure spec is ready for chat (uploaded, assistant exists with vector store)
    const { fileId, assistantId } = await chatService.ensureSpecReadyForChat(specId, userId, requestId);
    
    // Create thread
    const threadId = await chatService.createThread(specId, userId, requestId);
    
    logger.info({ requestId, specId, userId, assistantId, threadId }, '[chat-routes] POST /init - Success');
    res.json({
      success: true,
      threadId: threadId,
      assistantId: assistantId
    });
    
  } catch (error) {
    logger.error({
      requestId,
      error: {
        message: error.message,
        stack: error.stack
      }
    }, '[chat-routes] POST /init - Error');
    
    // Handle specific error types
    if (error.message === 'Spec not found' || error.message.includes('Unauthorized')) {
      return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403));
    }
    
    next(createError('Failed to initialize chat', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Send message to chat
 * POST /api/chat/message
 */
router.post('/message', verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `chat-message-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, userId: req.user?.uid }, '[chat-routes] POST /message - Starting message send');

  try {
    if (!chatService) {
      logger.error({ requestId }, '[chat-routes] OpenAI not configured');
      return next(createError('OpenAI not configured', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 503));
    }
    
    const { specId, threadId, assistantId: initialAssistantId, message } = req.body;
    let assistantId = initialAssistantId;
    const userId = req.user.uid;
    logger.debug({ requestId, specId, threadId, assistantId, hasMessage: !!message }, '[chat-routes] Processing message');
    
    // Validate required fields
    if (!message || !message.trim()) {
      logger.error({ requestId }, '[chat-routes] Missing or empty message');
      return next(createError('Message is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400, { requestId }));
    }
    
    // Verify ownership and get spec data
    const specData = await chatService.verifySpecOwnership(specId, userId);
    
    // Ensure spec is ready (assistant exists with vector store)
    if (!assistantId || !specData.openaiFileId) {
      const ready = await chatService.ensureSpecReadyForChat(specId, userId, requestId);
      assistantId = ready.assistantId;
    } else {
      // Verify assistant has vector store
      try {
        assistantId = await chatService.getOrCreateAssistant(specId, specData.openaiFileId, requestId);
      } catch (error) {
        logger.warn({ requestId, specId, error: error.message }, '[chat-routes] Failed to get/create assistant, ensuring ready');
        const ready = await chatService.ensureSpecReadyForChat(specId, userId, requestId);
        assistantId = ready.assistantId;
      }
    }
    
    // Ensure thread exists - create if missing
    let currentThreadId = threadId;
    if (!currentThreadId) {
      logger.info({ requestId, specId, userId }, '[chat-routes] Thread ID missing, creating new thread');
      currentThreadId = await chatService.createThread(specId, userId, requestId);
      logger.debug({ requestId, newThreadId: currentThreadId }, '[chat-routes] New thread created');
    }
    
    // Send message with retry
    const response = await retryWithBackoff(
      async () => {
        try {
          return await openaiStorage.sendMessage(currentThreadId, assistantId, message);
        } catch (error) {
          // If assistant is corrupted, try to recreate it
          if (isRetryableError(error) && specData.openaiFileId) {
            const newAssistantId = await chatService.handleAssistantError(error, specId, userId, specData.openaiFileId, requestId);
            if (newAssistantId) {
              assistantId = newAssistantId;
              // Create new thread for new assistant
              const newThreadId = await chatService.createThread(specId, userId, requestId);
              return {
                response: await openaiStorage.sendMessage(newThreadId, newAssistantId, message),
                threadId: newThreadId,
                assistantId: newAssistantId
              };
            }
          }
          throw error;
        }
      },
      {
        operationName: 'sendMessage',
        maxRetries: 2,
        initialDelay: 1000
      }
    );

    // Handle response (might include new threadId/assistantId if assistant was recreated)
    const result = {
      success: true,
      response: response.response || response
    };
    
    // Always include threadId (either original or newly created)
    result.threadId = response.threadId || currentThreadId;
    
    if (response.assistantId) {
      result.assistantId = response.assistantId;
    } else if (assistantId) {
      result.assistantId = assistantId;
    }
    
    logger.info({ requestId, specId, userId }, '[chat-routes] POST /message - Success');
    res.json(result);
    
  } catch (error) {
    logger.error({
      requestId,
      error: {
        message: error.message,
        stack: error.stack
      }
    }, '[chat-routes] POST /message - Error');
    
    // Handle specific error types
    if (error.message === 'Spec not found' || error.message.includes('Unauthorized')) {
      return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403));
    }
    
    next(createError('Failed to send message', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Generate diagrams for a specification (deprecated — diagrams are embedded in Technical & Architecture)
 * POST /api/chat/diagrams/generate
 */
router.post('/diagrams/generate', verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `diagrams-generate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  logger.info({ requestId, userId: req.user?.uid }, '[chat-routes] POST /diagrams/generate - Deprecated stub');

  try {
    const { specId } = req.body;
    if (!specId) {
      logger.error({ requestId }, '[chat-routes] Missing specId in request body');
      return next(createError('specId is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400, { requestId }));
    }

    const totalTime = Date.now() - startTime;
    logger.info({ requestId, specId, duration: `${totalTime}ms` }, '[chat-routes] POST /diagrams/generate - Returning deprecated response');

    res.json({
      success: true,
      deprecated: true,
      message: 'Standalone diagram generation is retired. Mermaid diagrams are embedded in the Technical Specification and Architecture sections.',
      diagrams: [],
      requestId
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    
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
    
    logger.error({
      requestId,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      duration: `${totalTime}ms`
    }, '[chat-routes] POST /diagrams/generate - Error');
    
    // Handle specific error types
    if (error.message === 'Spec not found' || error.message.includes('Unauthorized')) {
      return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403));
    }
    
    next(createError(errorMessage, ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
      details: errorDetails,
      requestId
    }));
  }
});

/**
 * Repair a broken diagram using Assistant API
 * POST /api/chat/diagrams/repair
 */
router.post('/diagrams/repair', verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `diagrams-repair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, userId: req.user?.uid }, '[chat-routes] POST /diagrams/repair - Starting diagram repair');
  
  try {
    if (!chatService) {
      logger.error({ requestId }, '[chat-routes] OpenAI not configured');
      return next(createError('OpenAI not configured', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 503));
    }
    
    const { specId, diagramId, brokenCode, diagramType, errorMessage } = req.body;
    const userId = req.user.uid;
    logger.debug({ requestId, specId, diagramId, diagramType }, '[chat-routes] Processing diagram repair');
    
    if (!specId || !brokenCode || !diagramType) {
      logger.warn({ requestId }, '[chat-routes] Missing required fields');
      return next(createError('specId, brokenCode, and diagramType are required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    
    // Verify ownership and ensure spec is ready
    const specData = await chatService.verifySpecOwnership(specId, userId);
    const { assistantId } = await chatService.ensureSpecReadyForChat(specId, userId, requestId);
    
    // Get diagram data to find title
    const diagrams = specData.diagrams?.diagrams || [];
    const diagramData = diagrams.find(d => d.id === diagramId);
    const diagramTitle = diagramData?.title || `${diagramType} Diagram`;
    
    // Repair diagram using Assistant API with retry
    const repairedCode = await retryWithBackoff(
      () => openaiStorage.repairDiagram(specId, assistantId, brokenCode, diagramTitle, diagramType, errorMessage),
      {
        operationName: 'repairDiagram',
        maxRetries: 2,
        initialDelay: 1000
      }
    );
    
    logger.info({ requestId, specId, userId, diagramId }, '[chat-routes] POST /diagrams/repair - Success');
    res.json({
      success: true,
      repairedDiagram: {
        mermaidCode: repairedCode
      }
    });
    
  } catch (error) {
    logger.error({
      requestId,
      error: {
        message: error.message,
        stack: error.stack
      }
    }, '[chat-routes] POST /diagrams/repair - Error');
    
    // Handle specific error types
    if (error.message === 'Spec not found' || error.message.includes('Unauthorized')) {
      return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403));
    }
    
    next(createError('Failed to repair diagram', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
      details: error && error.message
    }));
  }
});

/**
 * Public demo chat endpoint (no authentication required)
 * POST /api/chat/demo
 */
router.post('/demo', demoChatLimiter, async (req, res, next) => {
  const requestId = req.requestId || `chat-demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, ip: req.ip }, '[chat-routes] POST /demo - Starting demo chat');
  
  try {
    if (!openaiStorage) {
      logger.error({ requestId }, '[chat-routes] OpenAI not configured');
      return next(createError('OpenAI not configured', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 503));
    }
    
    const { threadId, assistantId, message } = req.body;
    logger.debug({ requestId, hasThreadId: !!threadId, hasAssistantId: !!assistantId, hasMessage: !!message }, '[chat-routes] Processing demo chat');
    
    // Validate input
    if (!message || !message.trim()) {
      logger.warn({ requestId }, '[chat-routes] Message is required');
      return next(createError('Message is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    
    // Get demo spec ID
    const demoSpecId = await getDemoSpecId();
    logger.debug({ requestId, demoSpecId }, '[chat-routes] Demo spec ID retrieved');
    
    // Load demo spec data
    const specDoc = await db.collection('specs').doc(demoSpecId).get();
    if (!specDoc.exists) {
      logger.error({ requestId, demoSpecId }, '[chat-routes] Demo specification not found');
      return next(createError('Demo specification not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
    }
    
    const specData = specDoc.data();
    
    // Use provided thread/assistant or create new ones
    let currentThreadId = threadId;
    let currentAssistantId = assistantId;
    
    // If no thread provided, create one
    if (!currentThreadId) {
      const thread = await retryWithBackoff(
        () => openaiStorage.createThread(),
        {
          operationName: 'createThread',
          maxRetries: 2,
          initialDelay: 500
        }
      );
      currentThreadId = thread.id;
    }
    
    // If no assistant provided, check if spec has one or create
    if (!currentAssistantId) {
      currentAssistantId = specData.openaiAssistantId;
      
      if (!currentAssistantId) {
        // Ensure spec is uploaded
        let fileId = specData.openaiFileId;
        if (!fileId) {
          fileId = await retryWithBackoff(
            () => openaiStorage.uploadSpec(demoSpecId, specData),
            {
              operationName: 'uploadSpec',
              maxRetries: 2,
              initialDelay: 1000
            }
          );
          await db.collection('specs').doc(demoSpecId).update({
            openaiFileId: fileId,
            uploadedToOpenAI: true,
            openaiUploadTimestamp: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        
        // Create assistant
        const assistant = await retryWithBackoff(
          () => openaiStorage.createAssistant(demoSpecId, fileId),
          {
            operationName: 'createAssistant',
            maxRetries: 2,
            initialDelay: 2000
          }
        );
        currentAssistantId = assistant.id;
        
        // Save to database
        await db.collection('specs').doc(demoSpecId).update({
          openaiAssistantId: currentAssistantId
        });
      }
    }
    
    // Send message with retry
    const response = await retryWithBackoff(
      () => openaiStorage.sendMessage(currentThreadId, currentAssistantId, message),
      {
        operationName: 'sendMessage',
        maxRetries: 2,
        initialDelay: 1000
      }
    );
    
    logger.info({ requestId }, '[chat-routes] POST /demo - Success');
    res.json({
      success: true,
      response: response,
      threadId: currentThreadId,
      assistantId: currentAssistantId
    });
    
  } catch (error) {
    logger.error({
      requestId,
      error: {
        message: error.message,
        stack: error.stack
      }
    }, '[chat-routes] POST /demo - Error');
    next(createError('Failed to send message', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
      details: error.message
    }));
  }
});

module.exports = router;

