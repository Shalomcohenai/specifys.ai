const express = require('express');
const router = express.Router();
const { auth } = require('./firebase-admin');
const { db } = require('./firebase-admin');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');

/**
 * Middleware to verify Firebase ID token
 */
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
    logger.error({ error: error.message }, '[share-prompt-routes] Token verification failed');
    next(createError('Invalid token', ERROR_CODES.INVALID_TOKEN, 401));
  }
}

/**
 * GET /api/share-prompt/check
 * Check if share prompt should be shown for a spec
 * Requires: Firebase authentication
 * Query: specId
 * Returns: { shouldShow: boolean }
 */
router.get('/check', verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `share-check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const userId = req.user.uid;
    const { specId } = req.query;

    if (!specId) {
      return next(createError('specId is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }

    // Get user's share prompt preferences
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : {};

    const sharePrompts = userData.sharePrompts || {};

    // Check if user dismissed permanently
    if (sharePrompts.dismissedPermanently === true) {
      logger.debug({ requestId, userId, specId }, '[share-prompt-routes] User dismissed permanently');
      return res.json({ shouldShow: false });
    }

    // Check if user already shared this spec
    const sharedSpecs = sharePrompts.sharedSpecs || [];
    if (sharedSpecs.includes(specId)) {
      logger.debug({ requestId, userId, specId }, '[share-prompt-routes] Spec already shared');
      return res.json({ shouldShow: false });
    }

    // Check if user dismissed "maybe later" too many times
    const timesDismissed = sharePrompts.timesDismissed || 0;
    if (timesDismissed >= 3) {
      logger.debug({ requestId, userId, specId, timesDismissed }, '[share-prompt-routes] User dismissed too many times');
      return res.json({ shouldShow: false });
    }

    // Check if last shown was less than 24 hours ago
    const lastShown = sharePrompts.lastShown;
    if (lastShown) {
      const lastShownDate = lastShown.toDate ? lastShown.toDate() : new Date(lastShown);
      const hoursSinceLastShown = (Date.now() - lastShownDate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastShown < 24) {
        logger.debug({ requestId, userId, specId, hoursSinceLastShown }, '[share-prompt-routes] Last shown too recently');
        return res.json({ shouldShow: false });
      }
    }

    // Verify spec exists and belongs to user
    const specRef = db.collection('specs').doc(specId);
    const specDoc = await specRef.get();
    
    if (!specDoc.exists) {
      logger.warn({ requestId, userId, specId }, '[share-prompt-routes] Spec not found');
      return res.json({ shouldShow: false });
    }

    const specData = specDoc.data();
    if (specData.userId !== userId) {
      logger.warn({ requestId, userId, specId }, '[share-prompt-routes] Spec does not belong to user');
      return res.json({ shouldShow: false });
    }

    // Check if overview is ready
    if (specData.status?.overview !== 'ready') {
      logger.debug({ requestId, userId, specId }, '[share-prompt-routes] Overview not ready');
      return res.json({ shouldShow: false });
    }

    logger.info({ requestId, userId, specId }, '[share-prompt-routes] Share prompt should be shown');
    res.json({ shouldShow: true });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[share-prompt-routes] GET /check - Error');
    next(createError('Failed to check share prompt', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * POST /api/share-prompt/action
 * Record a share prompt action (maybe_later, dismissed, or shared)
 * Requires: Firebase authentication
 * Body: { specId, action }
 * Returns: { success: boolean }
 */
router.post('/action', verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `share-action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const userId = req.user.uid;
    const { specId, action } = req.body;

    if (!specId) {
      return next(createError('specId is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }

    if (!action || !['maybe_later', 'dismissed', 'shared'].includes(action)) {
      return next(createError('action must be one of: maybe_later, dismissed, shared', ERROR_CODES.INVALID_INPUT, 400));
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : {};

    const sharePrompts = userData.sharePrompts || {};
    const updateData = {};

    if (action === 'dismissed') {
      // Dismiss permanently
      updateData['sharePrompts.dismissedPermanently'] = true;
      updateData['sharePrompts.lastShown'] = new Date();
    } else if (action === 'maybe_later') {
      // Increment dismissal count
      const timesDismissed = (sharePrompts.timesDismissed || 0) + 1;
      updateData['sharePrompts.timesDismissed'] = timesDismissed;
      updateData['sharePrompts.lastShown'] = new Date();
    } else if (action === 'shared') {
      // Mark spec as shared
      const sharedSpecs = sharePrompts.sharedSpecs || [];
      if (!sharedSpecs.includes(specId)) {
        sharedSpecs.push(specId);
        updateData['sharePrompts.sharedSpecs'] = sharedSpecs;
      }
      updateData['sharePrompts.lastShareAction'] = new Date();
    }

    // Update user document
    await userRef.set(updateData, { merge: true });

    logger.info({ requestId, userId, specId, action }, '[share-prompt-routes] Share prompt action recorded');
    res.json({ success: true });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[share-prompt-routes] POST /action - Error');
    next(createError('Failed to record share prompt action', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

module.exports = router;

