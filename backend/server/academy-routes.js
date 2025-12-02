const express = require('express');
const { db } = require('./firebase-admin');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');
const admin = require('firebase-admin');

const router = express.Router();

const ACADEMY_GUIDES_COLLECTION = 'academy_guides';

/**
 * Increment guide view count (public endpoint - no auth required)
 * POST /api/academy/guides/:guideId/view
 */
async function incrementViewCount(req, res, next) {
  const requestId = req.requestId || `guide-view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.debug({ requestId, guideId: req.params.guideId }, '[academy-routes] Incrementing view count');
  
  try {
    const { guideId } = req.params;
    
    if (!guideId) {
      return next(createError('guideId is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    
    // Get guide document
    const guideRef = db.collection(ACADEMY_GUIDES_COLLECTION).doc(guideId);
    const guideDoc = await guideRef.get();
    
    if (!guideDoc.exists) {
      return next(createError('Guide not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
    }
    
    // Increment views atomically
    await guideRef.update({
      views: admin.firestore.FieldValue.increment(1)
    });
    
    logger.info({ requestId, guideId }, '[academy-routes] POST /guides/:guideId/view - Success');
    
    res.json({
      success: true,
      message: 'View count incremented'
    });
    
  } catch (error) {
    logger.error({ 
      requestId, 
      error: { message: error.message, stack: error.stack } 
    }, '[academy-routes] POST /guides/:guideId/view - Error');
    next(createError(error.message || 'Failed to increment view count', ERROR_CODES.DATABASE_ERROR, 500));
  }
}

router.post('/guides/:guideId/view', incrementViewCount);

module.exports = router;
