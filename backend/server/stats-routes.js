const express = require('express');
const router = express.Router();
const { db, admin, auth } = require('./firebase-admin');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');

/**
 * Middleware to verify admin permissions
 */
async function verifyAdminToken(req, res, next) {
  logger.debug({ path: req.path }, '[stats-routes] Verifying admin token');
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn({ path: req.path }, '[stats-routes] No valid authorization header');
      return next(createError('No valid authorization header', ERROR_CODES.UNAUTHORIZED, 401));
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // Check if user is admin
    const adminEmails = ['specifysai@gmail.com', 'admin@specifys.ai', 'shalom@specifys.ai'];
    if (!adminEmails.includes(decodedToken.email)) {
      logger.warn({ path: req.path, email: decodedToken.email }, '[stats-routes] Admin access required');
      return next(createError('Admin access required', ERROR_CODES.FORBIDDEN, 403));
    }
    
    logger.debug({ userId: decodedToken.uid, path: req.path }, '[stats-routes] Admin token verified');
    req.user = decodedToken;
    next();
  } catch (error) {
    logger.error({ error: error.message, path: req.path }, '[stats-routes] Token verification failed');
    next(createError('Invalid token', ERROR_CODES.INVALID_TOKEN, 401));
  }
}

/**
 * Update public stats with current counts
 * POST /api/stats/update
 */
router.post('/update', verifyAdminToken, async (req, res, next) => {
  const requestId = req.requestId || `stats-update-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId }, '[stats-routes] POST /update - Updating stats');
  
  try {
    // Count specs
    const specsSnapshot = await db.collection('specs').get();
    const specsCount = specsSnapshot.size;
    
    // Update public stats document
    await db.collection('public_stats').doc('counts').set({
      specsCount: specsCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    logger.info({ requestId, specsCount }, '[stats-routes] POST /update - Success');
    res.json({
      success: true,
      stats: {
        specsCount: specsCount
      }
    });
    
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[stats-routes] POST /update - Error');
    next(createError('Failed to update stats', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Get current public stats (public endpoint)
 * GET /api/stats
 */
router.get('/', async (req, res, next) => {
  const requestId = req.requestId || `stats-get-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.debug({ requestId }, '[stats-routes] GET / - Getting stats');
  
  try {
    const statsDoc = await db.collection('public_stats').doc('counts').get();
    
    if (!statsDoc.exists) {
      logger.debug({ requestId }, '[stats-routes] Stats not found, returning default');
      return res.json({
        specsCount: 4590 // Default value
      });
    }
    
    logger.debug({ requestId }, '[stats-routes] GET / - Success');
    res.json(statsDoc.data());
    
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[stats-routes] GET / - Error');
    next(createError('Failed to get stats', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

module.exports = router;

