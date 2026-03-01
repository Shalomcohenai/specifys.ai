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

let creditsV3Service;
try {
  creditsV3Service = require('./credits-v3-service');
} catch (e) {
  creditsV3Service = null;
}

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
 * Parse JSON from assistant response (may be wrapped in ```json ... ```)
 */
function parseStructuredResponse(responseText) {
  if (!responseText || typeof responseText !== 'string') return null;
  let str = responseText.trim();
  const jsonMatch = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    str = jsonMatch[1].trim();
  }
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

/**
 * POST /api/brain-dump/generate
 * Single-shot: description -> structured output (plainText, mermaidCode, fullPrompt). Rate limited 5/day.
 */
router.post('/generate', verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `brain-dump-gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const userId = req.user.uid;

  try {
    const rateLimitError = await checkAndIncrementPersonalPromptRateLimit(userId);
    if (rateLimitError) {
      return next(rateLimitError);
    }

    if (!chatService || !openaiStorage) {
      return next(createError('OpenAI not configured', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 503));
    }
    const { specId, description } = req.body;
    if (!specId) {
      return next(createError('specId is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
      return next(createError('description is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }

    await chatService.verifySpecOwnership(specId, userId);
    const { assistantId } = await chatService.ensureSpecReadyForChat(specId, userId, requestId);

    const userMessage = `The user wants this feature or change:

"${description.trim()}"

Based on the specification in your knowledge, return a single JSON object with exactly these keys (no other text before or after, no markdown):
- "plainText": A short, simple explanation in plain language (Hebrew or English) of how this change works and what will be added/changed. Example style: "Yes, this is easy! The system has a table X from which you can pull the data; then using 2 new functions get_sum and get_avg you can get the numbers; the display will be on the develop page in the site style."
- "mermaidCode": A Mermaid diagram (flowchart or graph) showing ONLY the relevant subsystem that is affected—not the whole app. Highlight the node that changes by adding a line: style NodeId fill:#e1f5fe (use the actual node id in your diagram). Output valid Mermaid syntax only.
- "fullPrompt": A complete, copy-paste ready prompt for a developer to use in Cursor or another AI IDE to implement this feature, including all relevant context from the spec (endpoints, data models, structure).

Return ONLY valid JSON with keys: plainText, mermaidCode, fullPrompt.`;

    const thread = await openaiStorage.createThread();
    const responseText = await openaiStorage.sendMessage(thread.id, assistantId, userMessage);

    const parsed = parseStructuredResponse(responseText);
    if (!parsed || typeof parsed.plainText !== 'string') {
      logger.warn({ requestId, responsePreview: responseText?.slice(0, 200) }, '[brain-dump] POST /generate - AI response was not valid JSON');
      return next(createError('Failed to get structured response from AI', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500));
    }

    const plainText = parsed.plainText || '';
    const mermaidCode = typeof parsed.mermaidCode === 'string' ? parsed.mermaidCode.trim() : '';
    const fullPrompt = typeof parsed.fullPrompt === 'string' ? parsed.fullPrompt : '';

    logger.info({ requestId, specId, userId }, '[brain-dump] POST /generate - Success');
    res.json({
      success: true,
      plainText,
      mermaidCode: mermaidCode || undefined,
      fullPrompt
    });
  } catch (error) {
    logger.error({ requestId, error: error.message }, '[brain-dump] POST /generate - Error');
    if (error.message === 'Spec not found' || error.message.includes('Unauthorized')) {
      return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403));
    }
    next(createError('Failed to generate', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, { details: error.message }));
  }
});

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

/**
 * POST /api/brain-dump/apply-to-spec
 * Pro only: merge the change into overview + technical. Does not update design.
 */
router.post('/apply-to-spec', verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `brain-dump-apply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const userId = req.user.uid;

  try {
    if (!creditsV3Service) {
      return next(createError('Credits service not available', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 503));
    }
    const available = await creditsV3Service.getAvailableCredits(userId);
    if (!available || available.unlimited !== true) {
      return next(createError('Add to main architecture is available for PRO users only', ERROR_CODES.INSUFFICIENT_PERMISSIONS, 403));
    }

    if (!chatService || !openaiStorage) {
      return next(createError('OpenAI not configured', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 503));
    }
    const { specId, plainText, fullPrompt } = req.body;
    if (!specId) {
      return next(createError('specId is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    if (!plainText || typeof plainText !== 'string') {
      return next(createError('plainText is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    if (!fullPrompt || typeof fullPrompt !== 'string') {
      return next(createError('fullPrompt is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }

    await chatService.verifySpecOwnership(specId, userId);
    const { assistantId } = await chatService.ensureSpecReadyForChat(specId, userId, requestId);

    const mergeMessage = `Merge the following change into the specification. Do not change design.

Change summary:
${plainText.trim()}

Full implementation prompt (for context):
${fullPrompt.trim()}

Return a JSON object with exactly two keys:
- "overview": the updated full overview content (integrate the change into the existing overview).
- "technical": the updated full technical specification content (integrate the change into the existing technical spec).

Preserve existing structure and only integrate this change. Output only valid JSON, no other text or markdown.`;

    const thread = await openaiStorage.createThread();
    const responseText = await openaiStorage.sendMessage(thread.id, assistantId, mergeMessage);

    const parsed = parseStructuredResponse(responseText);
    if (!parsed || typeof parsed.overview !== 'string' || typeof parsed.technical !== 'string') {
      logger.warn({ requestId, responsePreview: responseText?.slice(0, 200) }, '[brain-dump] POST /apply-to-spec - AI response was not valid JSON');
      return next(createError('Failed to get updated spec from AI', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500));
    }

    await db.collection('specs').doc(specId).update({
      overview: parsed.overview,
      technical: parsed.technical,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info({ requestId, specId, userId }, '[brain-dump] POST /apply-to-spec - Success');
    res.json({ success: true });
  } catch (error) {
    logger.error({ requestId, error: error.message }, '[brain-dump] POST /apply-to-spec - Error');
    if (error.message === 'Spec not found' || error.message.includes('Unauthorized')) {
      return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403));
    }
    next(createError('Failed to apply to spec', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, { details: error.message }));
  }
});

module.exports = router;
