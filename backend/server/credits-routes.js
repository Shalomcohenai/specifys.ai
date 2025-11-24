const express = require('express');
const router = express.Router();
const { db, auth } = require('./firebase-admin');
const { requireAdmin } = require('./security');
const creditsService = require('./credits-service');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');

/**
 * Middleware to verify Firebase ID token
 */
async function verifyFirebaseToken(req, res, next) {
  logger.debug({ path: req.path }, '[credits-routes] Verifying Firebase token');
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn({ path: req.path }, '[credits-routes] No valid authorization header');
      return next(createError('No valid authorization header', ERROR_CODES.UNAUTHORIZED, 401));
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);

    logger.debug({ userId: decodedToken.uid, path: req.path }, '[credits-routes] Token verified successfully');
    req.user = decodedToken;
    next();
  } catch (error) {
    logger.error({ error: error.message, path: req.path }, '[credits-routes] Token verification failed');
    next(createError('Invalid token', ERROR_CODES.INVALID_TOKEN, 401));
  }
}

/**
 * POST /api/credits/grant
 * Grant credits to a user
 * Requires: Admin authentication OR payment provider authentication
 * Body: { userId, amount, source, metadata }
 */
router.post('/grant', requireAdmin, async (req, res, next) => {
  const requestId = req.requestId || `credits-grant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId }, '[credits-routes] POST /grant - Granting credits');
  
  try {
    const { userId, amount, source, metadata } = req.body;

    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      logger.warn({ requestId }, '[credits-routes] Invalid userId');
      return next(createError('userId is required and must be a string', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }

    if (!amount || typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
      logger.warn({ requestId, amount }, '[credits-routes] Invalid amount');
      return next(createError('amount must be a positive integer', ERROR_CODES.INVALID_INPUT, 400));
    }

    if (!source || typeof source !== 'string') {
      logger.warn({ requestId }, '[credits-routes] Invalid source');
      return next(createError('source is required and must be a string', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }

    logger.debug({ requestId, userId, amount, source }, '[credits-routes] Granting credits');
    // Grant credits
    const result = await creditsService.grantCredits(
      userId,
      amount,
      source,
      metadata || {}
    );

    logger.info({ requestId, userId, amount }, '[credits-routes] POST /grant - Success');
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[credits-routes] POST /grant - Error');
    next(createError('Failed to grant credits', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * POST /api/credits/refund
 * Refund credits to a user
 * Requires: Firebase authentication (user can refund their own credits, admin can refund any user's credits)
 * Body: { userId (optional, defaults to requesting user), amount, reason, originalTransactionId }
 */
router.post('/refund', verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `credits-refund-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, userId: req.user?.uid }, '[credits-routes] POST /refund - Refunding credits');
  
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
      logger.warn({ requestId, requestingUserId, targetUserId }, '[credits-routes] Forbidden: User can only refund own credits');
      return next(createError('Forbidden', ERROR_CODES.FORBIDDEN, 403, {
        message: 'You can only refund your own credits'
      }));
    }

    // Validate required fields
    if (!targetUserId || typeof targetUserId !== 'string') {
      logger.warn({ requestId }, '[credits-routes] Invalid userId');
      return next(createError('userId is required and must be a string', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }

    if (!amount || typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
      logger.warn({ requestId, amount }, '[credits-routes] Invalid amount');
      return next(createError('amount must be a positive integer', ERROR_CODES.INVALID_INPUT, 400));
    }

    if (!reason || typeof reason !== 'string') {
      logger.warn({ requestId }, '[credits-routes] Invalid reason');
      return next(createError('reason is required and must be a string', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }

    // Refund credits
    const result = await creditsService.refundCredit(
      targetUserId,
      amount,
      reason,
      originalTransactionId || null
    );

    logger.info({ requestId, targetUserId, amount }, '[credits-routes] POST /refund - Success');
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[credits-routes] POST /refund - Error');
    next(createError('Failed to refund credits', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * GET /api/credits/transactions
 * Get credit transactions for a user
 * Requires: Firebase authentication (user can only see their own transactions, admin can see all)
 * Query params: userId (optional, admin only), limit (default: 50, max: 100)
 */
router.get('/transactions', verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `credits-transactions-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, userId: req.user?.uid }, '[credits-routes] GET /transactions - Fetching transactions');
  
  try {
    const requestingUserId = req.user.uid;
    const { userId, limit = 50 } = req.query;

    // Determine which user's transactions to fetch
    let targetUserId = userId || requestingUserId;

    // Check if requesting user is admin (for viewing other users' transactions)
    const { isAdminEmail } = require('./admin-config');
    const isAdmin = isAdminEmail(req.user.email);

    // Non-admin users can only view their own transactions
    if (!isAdmin && targetUserId !== requestingUserId) {
      logger.warn({ requestId, requestingUserId, targetUserId }, '[credits-routes] Forbidden: User can only view own transactions');
      return next(createError('Forbidden', ERROR_CODES.FORBIDDEN, 403, {
        message: 'You can only view your own transactions'
      }));
    }

    // Validate limit
    const limitNum = Math.min(parseInt(limit) || 50, 100); // Max 100
    
    // Note: Firestore doesn't support offset() with orderBy() efficiently
    // For now, we'll just use limit. For pagination, use startAfter() with last document
    // TODO: Implement proper pagination with startAfter() if needed
    
    // Fetch transactions
    let query = db.collection('credits_transactions')
      .where('userId', '==', targetUserId)
      .orderBy('timestamp', 'desc')
      .limit(limitNum);

    const snapshot = await query.get();
    const transactions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    logger.info({ requestId, targetUserId, count: transactions.length }, '[credits-routes] GET /transactions - Success');
    res.json({
      success: true,
      transactions: transactions,
      count: transactions.length,
      limit: limitNum,
      hasMore: transactions.length === limitNum // Indicates there might be more
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[credits-routes] GET /transactions - Error');
    next(createError('Failed to fetch transactions', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * GET /api/credits/entitlements
 * Get user entitlements
 * Requires: Firebase authentication
 * Returns: { entitlements, user }
 */
router.get('/entitlements', verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `credits-entitlements-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  // Don't log routine entitlements requests - too frequent
  
  try {
    const userId = req.user.uid;
    const result = await creditsService.getEntitlements(userId);

    // Only log errors, not successful requests
    res.json(result);
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[credits-routes] GET /entitlements - Error');
    next(createError('Failed to fetch entitlements', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

module.exports = router;

