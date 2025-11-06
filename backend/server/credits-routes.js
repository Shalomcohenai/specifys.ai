const express = require('express');
const router = express.Router();
const { db, auth } = require('./firebase-admin');
const { requireAdmin } = require('./security');
const creditsService = require('./credits-service');

/**
 * Middleware to verify Firebase ID token
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
 * POST /api/credits/grant
 * Grant credits to a user
 * Requires: Admin authentication OR payment provider authentication
 * Body: { userId, amount, source, metadata }
 */
router.post('/grant', requireAdmin, async (req, res) => {
  try {
    const { userId, amount, source, metadata } = req.body;

    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId is required and must be a string' });
    }

    if (!amount || typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
      return res.status(400).json({ error: 'amount must be a positive integer' });
    }

    if (!source || typeof source !== 'string') {
      return res.status(400).json({ error: 'source is required and must be a string' });
    }

    // Grant credits
    const result = await creditsService.grantCredits(
      userId,
      amount,
      source,
      metadata || {}
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error granting credits:', error);
    res.status(500).json({
      error: 'Failed to grant credits',
      details: error.message
    });
  }
});

/**
 * POST /api/credits/refund
 * Refund credits to a user
 * Requires: Firebase authentication (user can refund their own credits, admin can refund any user's credits)
 * Body: { userId (optional, defaults to requesting user), amount, reason, originalTransactionId }
 */
router.post('/refund', verifyFirebaseToken, async (req, res) => {
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
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only refund your own credits'
      });
    }

    // Validate required fields
    if (!targetUserId || typeof targetUserId !== 'string') {
      return res.status(400).json({ error: 'userId is required and must be a string' });
    }

    if (!amount || typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
      return res.status(400).json({ error: 'amount must be a positive integer' });
    }

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ error: 'reason is required and must be a string' });
    }

    // Refund credits
    const result = await creditsService.refundCredit(
      targetUserId,
      amount,
      reason,
      originalTransactionId || null
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error refunding credits:', error);
    res.status(500).json({
      error: 'Failed to refund credits',
      details: error.message
    });
  }
});

/**
 * GET /api/credits/transactions
 * Get credit transactions for a user
 * Requires: Firebase authentication (user can only see their own transactions, admin can see all)
 * Query params: userId (optional, admin only), limit (default: 50, max: 100)
 */
router.get('/transactions', verifyFirebaseToken, async (req, res) => {
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
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only view your own transactions'
      });
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

    res.json({
      success: true,
      transactions: transactions,
      count: transactions.length,
      limit: limitNum,
      hasMore: transactions.length === limitNum // Indicates there might be more
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      error: 'Failed to fetch transactions',
      details: error.message
    });
  }
});

/**
 * GET /api/credits/entitlements
 * Get user entitlements
 * Requires: Firebase authentication
 * Returns: { entitlements, user }
 */
router.get('/entitlements', verifyFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const result = await creditsService.getEntitlements(userId);

    res.json(result);
  } catch (error) {
    console.error('Error fetching entitlements:', error);
    res.status(500).json({
      error: 'Failed to fetch entitlements',
      details: error.message
    });
  }
});

module.exports = router;

