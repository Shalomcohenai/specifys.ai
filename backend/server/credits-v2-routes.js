const express = require('express');
const router = express.Router();
const { auth } = require('./firebase-admin');
const { requireAdmin } = require('./security');
const creditsV2Service = require('./credits-v2-service');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');

/**
 * Middleware to verify Firebase ID token
 */
async function verifyFirebaseToken(req, res, next) {
  logger.debug({ path: req.path }, '[credits-v2-routes] Verifying Firebase token');
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn({ path: req.path }, '[credits-v2-routes] No valid authorization header');
      return next(createError('No valid authorization header', ERROR_CODES.UNAUTHORIZED, 401));
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);

    logger.debug({ userId: decodedToken.uid, path: req.path }, '[credits-v2-routes] Token verified successfully');
    req.user = decodedToken;
    next();
  } catch (error) {
    logger.error({ error: error.message, path: req.path }, '[credits-v2-routes] Token verification failed');
    next(createError('Invalid token', ERROR_CODES.INVALID_TOKEN, 401));
  }
}

/**
 * GET /api/v2/credits
 * Get user credits
 * Requires: Firebase authentication
 * Returns: { unlimited, total, breakdown, subscription }
 */
router.get('/', verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `credits-get-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const userId = req.user.uid;
    const result = await creditsV2Service.getAvailableCredits(userId);
    const credits = await creditsV2Service.getUserCredits(userId);

    res.json({
      success: true,
      ...result,
      subscription: credits.subscription,
      permissions: credits.permissions
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[credits-v2-routes] GET / - Error');
    next(createError('Failed to fetch credits', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * POST /api/v2/credits/consume
 * Consume a credit when creating a spec
 * Requires: Firebase authentication
 * Body: { specId }
 * Returns: { success, remaining, breakdown, creditType, unlimited }
 */
router.post('/consume', verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `credits-consume-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const userId = req.user?.uid;
  
  logger.info({ 
    requestId, 
    userId,
    hasBody: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    specId: req.body?.specId,
    priority: req.body?.priority
  }, '[credits-v2-routes] POST /consume - Request received');
  
  try {
    if (!userId) {
      logger.error({ requestId }, '[credits-v2-routes] No userId in request');
      return next(createError('User ID not found', ERROR_CODES.UNAUTHORIZED, 401));
    }

    const { specId, priority } = req.body;

    if (!specId || typeof specId !== 'string') {
      logger.warn({ requestId, userId, specId, specIdType: typeof specId }, '[credits-v2-routes] Invalid specId');
      return next(createError('specId is required and must be a string', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }

    logger.debug({ requestId, userId, specId, priority }, '[credits-v2-routes] Calling consumeCredit service');
    
    const result = await creditsV2Service.consumeCredit(userId, specId, { priority });

    logger.info({ 
      requestId, 
      userId, 
      specId,
      success: result.success,
      unlimited: result.unlimited,
      creditType: result.creditType,
      remaining: result.remaining
    }, '[credits-v2-routes] POST /consume - Success');
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ 
      requestId, 
      userId: req.user?.uid,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      errorString: error.toString()
    }, '[credits-v2-routes] ❌ POST /consume - Error occurred');
    
    if (error.message === 'Insufficient credits' || error.message.includes('Insufficient credits')) {
      return next(createError('Insufficient credits', ERROR_CODES.INSUFFICIENT_PERMISSIONS, 403, {
        message: 'You do not have enough credits to create a spec'
      }));
    }
    
    if (error.message === 'User already has a spec. Only one spec per user is allowed.' || error.message.includes('already has a spec')) {
      return next(createError('User already has a spec', ERROR_CODES.INSUFFICIENT_PERMISSIONS, 403, {
        message: 'You already have a spec. Only one spec per user is allowed. Please edit your existing spec instead.'
      }));
    }
    
    // For unknown errors, provide detailed error information
    logger.error({ 
      requestId, 
      userId: req.user?.uid,
      fullError: error,
      errorDetails: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    }, '[credits-v2-routes] Unexpected error in consume endpoint');
    
    next(createError('Failed to consume credit', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message,
      requestId
    }));
  }
});

/**
 * POST /api/v2/credits/grant
 * Grant credits to a user
 * Requires: Admin authentication
 * Body: { userId, amount, source, metadata }
 * Returns: { success, creditsAdded, total, breakdown, creditType }
 */
router.post('/grant', requireAdmin, async (req, res, next) => {
  const requestId = req.requestId || `credits-grant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId }, '[credits-v2-routes] POST /grant - Granting credits');
  
  try {
    const { userId, amount, source, metadata } = req.body;

    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      logger.warn({ requestId }, '[credits-v2-routes] Invalid userId');
      return next(createError('userId is required and must be a string', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }

    if (!amount || typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
      logger.warn({ requestId, amount }, '[credits-v2-routes] Invalid amount');
      return next(createError('amount must be a positive integer', ERROR_CODES.INVALID_INPUT, 400));
    }

    if (!source || typeof source !== 'string') {
      logger.warn({ requestId }, '[credits-v2-routes] Invalid source');
      return next(createError('source is required and must be a string', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }

    logger.debug({ requestId, userId, amount, source }, '[credits-v2-routes] Granting credits');
    const result = await creditsV2Service.grantCredits(
      userId,
      amount,
      source,
      metadata || {}
    );

    logger.info({ requestId, userId, amount }, '[credits-v2-routes] POST /grant - Success');
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[credits-v2-routes] POST /grant - Error');
    next(createError('Failed to grant credits', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * POST /api/v2/credits/refund
 * Refund credits to a user
 * Requires: Firebase authentication (user can refund their own credits, admin can refund any user's credits)
 * Body: { userId (optional, defaults to requesting user), amount, reason, originalTransactionId }
 * Returns: { success, creditsRefunded, total, breakdown }
 */
router.post('/refund', verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `credits-refund-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, userId: req.user?.uid }, '[credits-v2-routes] POST /refund - Refunding credits');
  
  try {
    const requestingUserId = req.user.uid;
    const { userId, amount, reason, originalTransactionId } = req.body;

    // Determine target user - default to requesting user
    let targetUserId = userId || requestingUserId;

    // Check if requesting user is admin
    const { isAdminEmail } = require('./admin-config');
    const isAdmin = isAdminEmail(req.user.email);

    // Non-admin users can only refund their own credits
    if (!isAdmin && targetUserId !== requestingUserId) {
      logger.warn({ requestId, requestingUserId, targetUserId }, '[credits-v2-routes] Forbidden: User can only refund own credits');
      return next(createError('Forbidden', ERROR_CODES.FORBIDDEN, 403, {
        message: 'You can only refund your own credits'
      }));
    }

    // Validate required fields
    if (!targetUserId || typeof targetUserId !== 'string') {
      logger.warn({ requestId }, '[credits-v2-routes] Invalid userId');
      return next(createError('userId is required and must be a string', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }

    if (!amount || typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
      logger.warn({ requestId, amount }, '[credits-v2-routes] Invalid amount');
      return next(createError('amount must be a positive integer', ERROR_CODES.INVALID_INPUT, 400));
    }

    if (!reason || typeof reason !== 'string') {
      logger.warn({ requestId }, '[credits-v2-routes] Invalid reason');
      return next(createError('reason is required and must be a string', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }

    // Refund credits
    const result = await creditsV2Service.refundCredit(
      targetUserId,
      amount,
      reason,
      originalTransactionId || null
    );

    logger.info({ requestId, targetUserId, amount }, '[credits-v2-routes] POST /refund - Success');
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[credits-v2-routes] POST /refund - Error');
    next(createError('Failed to refund credits', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * GET /api/v2/credits/ledger
 * Get credit ledger for a user
 * Requires: Firebase authentication (user can only see their own ledger, admin can see all)
 * Query params: userId (optional, admin only), limit (default: 50, max: 100), offset, type, creditType
 * Returns: { transactions, count, limit, hasMore }
 */
router.get('/ledger', verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `credits-ledger-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, userId: req.user?.uid }, '[credits-v2-routes] GET /ledger - Fetching ledger');
  
  try {
    const requestingUserId = req.user.uid;
    const { userId, limit, offset, type, creditType } = req.query;

    // Determine which user's ledger to fetch
    let targetUserId = userId || requestingUserId;

    // Check if requesting user is admin (for viewing other users' ledger)
    const { isAdminEmail } = require('./admin-config');
    const isAdmin = isAdminEmail(req.user.email);

    // Non-admin users can only view their own ledger
    if (!isAdmin && targetUserId !== requestingUserId) {
      logger.warn({ requestId, requestingUserId, targetUserId }, '[credits-v2-routes] Forbidden: User can only view own ledger');
      return next(createError('Forbidden', ERROR_CODES.FORBIDDEN, 403, {
        message: 'You can only view your own ledger'
      }));
    }

    const filters = {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      type: type || undefined,
      creditType: creditType || undefined
    };

    const result = await creditsV2Service.getCreditLedger(targetUserId, filters);

    logger.info({ requestId, targetUserId, count: result.count }, '[credits-v2-routes] GET /ledger - Success');
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[credits-v2-routes] GET /ledger - Error');
    next(createError('Failed to fetch ledger', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * GET /api/v2/credits/history
 * Get credit history summary for a user
 * Requires: Firebase authentication
 * Returns: { summary, recentTransactions }
 */
router.get('/history', verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `credits-history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const userId = req.user.uid;
    
    // Get current credits
    const credits = await creditsV2Service.getUserCredits(userId);
    const available = await creditsV2Service.getAvailableCredits(userId);
    
    // Get all consume transactions to calculate total consumed
    const consumeLedger = await creditsV2Service.getCreditLedger(userId, { type: 'consume', limit: 1000 });
    
    // Get recent transactions for display (last 10)
    const recentLedger = await creditsV2Service.getCreditLedger(userId, { limit: 10 });
    
    // Calculate summary - use all consume transactions for accurate total
    const summary = {
      current: available,
      totalGranted: 0,
      totalConsumed: 0,
      totalRefunded: 0
    };
    
    // Calculate total consumed from all consume transactions
    consumeLedger.transactions.forEach(transaction => {
      if (transaction.type === 'consume') {
        // For consume, amount is usually negative or 1, we want the absolute value
        const consumed = Math.abs(transaction.amount || 1);
        summary.totalConsumed += consumed;
      }
    });
    
    // Calculate granted and refunded from recent transactions (for display)
    recentLedger.transactions.forEach(transaction => {
      if (transaction.type === 'grant') {
        summary.totalGranted += transaction.amount || 0;
      } else if (transaction.type === 'refund') {
        summary.totalRefunded += transaction.amount || 0;
      }
    });
    
    res.json({
      success: true,
      summary: summary,
      recentTransactions: ledger.transactions
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[credits-v2-routes] GET /history - Error');
    next(createError('Failed to fetch history', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

module.exports = router;
