/**
 * Brain Dump routes
 * Chat for feature/change questions in spec context, with "Create personal prompt" (rate limited 5/day per user)
 */

const express = require('express');
const router = express.Router();
const { db, admin, auth } = require('./firebase-admin');
const ChatService = require('./chat-service');
const OpenAIStorageService = require('./openai-storage-service');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');
const { retryWithBackoff, isRetryableError } = require('./retry-handler');

const openaiStorage = process.env.OPENAI_API_KEY
  ? new OpenAIStorageService(process.env.OPENAI_API_KEY)
  : null;
const chatService = openaiStorage ? new ChatService(openaiStorage) : null;

const BRAIN_DUMP_DAILY_LIMIT = 5;

function getTodayKey() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

async function verifyFirebaseToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(createError('No valid authorization header', ERROR_CODES.UNAUTHORIZED, 401));
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    next(createError('Invalid token', ERROR_CODES.INVALID_TOKEN, 401));
  }
}

/**
 * Check and consume one rate-limit slot for "Create personal prompt" (5 per day per user)
 * Returns null if allowed, or an Error to pass to next() if limit exceeded
 */
async function checkAndIncrementPersonalPromptRateLimit(userId) {
  const today = getTodayKey();
  const ref = db.collection('brainDumpRateLimit').doc(userId);

  const doc = await ref.get();
  const data = doc.exists ? doc.data() : null;

  if (!data || data.date !== today) {
    await ref.set({ date: today, count: 1 });
    return null;
  }
  if (data.count >= BRAIN_DUMP_DAILY_LIMIT) {
    return createError(
      `Brain Dump personal prompt limit reached (${BRAIN_DUMP_DAILY_LIMIT} per day). Try again tomorrow.`,
      ERROR_CODES.VALIDATION_ERROR,
      429,
      { retryAfter: 'midnight' }
    );
  }
  await ref.update({ count: admin.firestore.FieldValue.increment(1) });
  return null;
}

/**
 * POST /api/brain-dump/init
 * Ensure spec is ready and get or create Brain Dump thread for this spec
 */
router.post('/init', verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `brain-dump-init-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const userId = req.user.uid;

  try {
    if (!chatService) {
      return next(createError('OpenAI not configured', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 503));
    }
    const { specId } = req.body;
    if (!specId) {
      return next(createError('specId is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }

    const { threadId, assistantId } = await chatService.getOrCreateBrainDumpThread(specId, userId, requestId);
    logger.info({ requestId, specId, userId }, '[brain-dump] POST /init - Success');
    res.json({ success: true, threadId, assistantId });
  } catch (error) {
    logger.error({ requestId, error: error.message }, '[brain-dump] POST /init - Error');
    if (error.message === 'Spec not found' || error.message.includes('Unauthorized')) {
      return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403));
    }
    next(createError('Failed to initialize Brain Dump', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, { details: error.message }));
  }
});

/**
 * POST /api/brain-dump/message
 * Send a message, get AI response, persist both to specs/{specId}/brainDumpMessages
 */
router.post('/message', verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `brain-dump-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const userId = req.user.uid;

  try {
    if (!chatService || !openaiStorage) {
      return next(createError('OpenAI not configured', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 503));
    }
    const { specId, threadId, assistantId, message } = req.body;
    if (!message || !message.trim()) {
      return next(createError('message is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    if (!specId) {
      return next(createError('specId is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }

    const specData = await chatService.verifySpecOwnership(specId, userId);
    let currentThreadId = threadId;
    let currentAssistantId = assistantId;

    if (!currentThreadId || !currentAssistantId) {
      const ready = await chatService.getOrCreateBrainDumpThread(specId, userId, requestId);
      currentThreadId = ready.threadId;
      currentAssistantId = ready.assistantId;
    }

    const messagesRef = db.collection('specs').doc(specId).collection('brainDumpMessages');
    const now = admin.firestore.FieldValue.serverTimestamp();

    await messagesRef.add({
      role: 'user',
      content: message.trim(),
      timestamp: now
    });

    let responseText;
    try {
      responseText = await retryWithBackoff(
        () => openaiStorage.sendMessage(currentThreadId, currentAssistantId, message.trim()),
        { operationName: 'sendMessage', maxRetries: 2, initialDelay: 1000 }
      );
    } catch (error) {
      if (isRetryableError(error) && specData.openaiFileId) {
        const newAssistantId = await chatService.handleAssistantError(
          error, specId, userId, specData.openaiFileId, requestId
        );
        if (newAssistantId) {
          currentAssistantId = newAssistantId;
          responseText = await openaiStorage.sendMessage(currentThreadId, currentAssistantId, message.trim());
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    const assistantDoc = await messagesRef.add({
      role: 'assistant',
      content: responseText,
      timestamp: now,
      messageId: null
    });
    const messageId = assistantDoc.id;
    await assistantDoc.update({ messageId });

    logger.info({ requestId, specId, userId }, '[brain-dump] POST /message - Success');
    res.json({
      success: true,
      response: responseText,
      messageId,
      threadId: currentThreadId,
      assistantId: currentAssistantId
    });
  } catch (error) {
    logger.error({ requestId, error: error.message }, '[brain-dump] POST /message - Error');
    if (error.message === 'Spec not found' || error.message.includes('Unauthorized')) {
      return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403));
    }
    next(createError('Failed to send message', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, { details: error.message }));
  }
});

/**
 * GET /api/brain-dump/history?specId=...
 * Return persisted Brain Dump messages for the spec (ordered by timestamp)
 */
router.get('/history', verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `brain-dump-history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const userId = req.user.uid;
  const specId = req.query.specId;

  try {
    if (!specId) {
      return next(createError('specId is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    await chatService.verifySpecOwnership(specId, userId);

    const snapshot = await db.collection('specs').doc(specId).collection('brainDumpMessages')
      .orderBy('timestamp', 'asc')
      .get();

    const messages = snapshot.docs.map(doc => {
      const d = doc.data();
      const timestamp = d.timestamp?.toDate ? d.timestamp.toDate().toISOString() : null;
      return {
        id: doc.id,
        role: d.role,
        content: d.content,
        timestamp,
        messageId: d.messageId
      };
    });

    logger.info({ requestId, specId, count: messages.length }, '[brain-dump] GET /history - Success');
    res.json({ success: true, messages });
  } catch (error) {
    logger.error({ requestId, error: error.message }, '[brain-dump] GET /history - Error');
    if (error.message === 'Spec not found' || error.message.includes('Unauthorized')) {
      return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403));
    }
    next(createError('Failed to load history', ERROR_CODES.DATABASE_ERROR, 500, { details: error.message }));
  }
});

/**
 * POST /api/brain-dump/personal-prompt
 * Generate a single copy-paste ready prompt for the feature/change (rate limited 5/day per user)
 * Body: { specId, userQuestion, assistantReply } or { specId, messageId } to use stored reply
 */
router.post('/personal-prompt', verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `brain-dump-prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const userId = req.user.uid;

  try {
    if (!chatService || !openaiStorage) {
      return next(createError('OpenAI not configured', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 503));
    }

    const rateLimitError = await checkAndIncrementPersonalPromptRateLimit(userId);
    if (rateLimitError) {
      return next(rateLimitError);
    }

    const { specId, userQuestion, assistantReply, messageId } = req.body;
    if (!specId) {
      return next(createError('specId is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    await chatService.verifySpecOwnership(specId, userId);

    let question = userQuestion;
    let reply = assistantReply;
    if (messageId && (!question || !reply)) {
      const doc = await db.collection('specs').doc(specId).collection('brainDumpMessages').doc(messageId).get();
      if (!doc.exists) {
        return next(createError('Message not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
      }
      const d = doc.data();
      if (d.role !== 'assistant') {
        return next(createError('messageId must refer to an assistant message', ERROR_CODES.VALIDATION_ERROR, 400));
      }
      reply = d.content;
      const prevSnap = await db.collection('specs').doc(specId).collection('brainDumpMessages')
        .orderBy('timestamp', 'desc')
        .where('timestamp', '<', d.timestamp)
        .limit(1)
        .get();
      if (!prevSnap.empty) {
        const prevData = prevSnap.docs[0].data();
        if (prevData.role === 'user') question = prevData.content;
      }
    }
    if (!reply || typeof reply !== 'string') {
      return next(createError('assistantReply or messageId with stored reply is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    const userPrompt = question ? `User question: ${question}\n\nAssistant reply: ${reply}` : `Assistant reply: ${reply}`;

    const { assistantId } = await chatService.ensureSpecReadyForChat(specId, userId, requestId);
    const thread = await openaiStorage.createThread();
    const promptRequest = `Task: Generate a single, copy-paste ready prompt that a developer can use in Cursor or another AI IDE to implement this feature or change. The prompt must include all relevant context from this specification (endpoints, data models, structure, tech stack). Output only the prompt text—no commentary or explanation before or after.

${userPrompt}`;

    const promptText = await openaiStorage.sendMessage(thread.id, assistantId, promptRequest);

    logger.info({ requestId, specId, userId }, '[brain-dump] POST /personal-prompt - Success');
    res.json({ success: true, prompt: promptText || '' });
  } catch (error) {
    logger.error({ requestId, error: error.message }, '[brain-dump] POST /personal-prompt - Error');
    if (error.message === 'Spec not found' || error.message.includes('Unauthorized')) {
      return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403));
    }
    next(createError('Failed to generate personal prompt', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, { details: error.message }));
  }
});

module.exports = router;
