const express = require('express');
const router = express.Router();
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');
const { requireAdmin } = require('./security');
const emailTracking = require('./email-tracking-service');
const { db } = require('./firebase-admin');

/**
 * Track email click (called when user clicks link from email)
 * GET /api/email/track
 * Query params: utm_source, utm_medium, utm_campaign, utm_content, uid, et, lt, etc.
 */
router.get('/track', async (req, res) => {
  const requestId = req.requestId || `email-track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { et, lt, uid, utm_campaign, utm_content } = req.query;
    const targetUrl = req.query.target || req.query.url || req.headers.referer || null;
    
    // Extract email type and link type from query params
    const emailType = et || utm_campaign || 'unknown';
    const linkType = lt || utm_content || 'unknown';
    const userId = uid || null;
    
    // Get user email if userId is provided
    let userEmail = null;
    if (userId && userId !== 'anonymous') {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          userEmail = userDoc.data().email || null;
        }
      } catch (err) {
        logger.warn({ requestId, userId, error: err.message }, '[email-tracking] Failed to get user email');
      }
    }
    
    // Track the click
    await emailTracking.trackEmailClick(
      userId,
      userEmail,
      emailType,
      linkType,
      targetUrl,
      {
        ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'] || null,
        referrer: req.headers.referer || null,
        queryParams: req.query
      }
    );
    
    logger.info({ 
      requestId, 
      userId, 
      emailType, 
      linkType,
      targetUrl 
    }, '[email-tracking] Email click tracked');
    
    // Redirect to target URL if provided, otherwise redirect to homepage
    if (targetUrl) {
      res.redirect(targetUrl);
    } else {
      // Extract base URL from query params if available
      const baseUrl = process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';
      res.redirect(baseUrl);
    }
    
  } catch (error) {
    logger.error({ requestId, error: error.message }, '[email-tracking] Error tracking email click');
    // Still redirect even if tracking fails
    const baseUrl = process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';
    res.redirect(baseUrl);
  }
});

/**
 * Get email click statistics (admin only)
 * GET /api/email/stats
 * Query params: emailType, linkType, startDate, endDate
 */
router.get('/stats', requireAdmin, async (req, res, next) => {
  const requestId = req.requestId || `email-stats-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const filters = {
      emailType: req.query.emailType || null,
      linkType: req.query.linkType || null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null
    };
    
    const stats = await emailTracking.getEmailClickStats(filters);
    
    logger.info({ requestId, filters, statsTotal: stats.total }, '[email-tracking] Email stats retrieved');
    
    res.json({
      success: true,
      filters,
      stats
    });
  } catch (error) {
    logger.error({ requestId, error: error.message }, '[email-tracking] Error getting email stats');
    next(createError('Failed to get email stats', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Get user email journey (admin only, or user's own journey)
 * GET /api/email/journey/:userId
 */
router.get('/journey/:userId', async (req, res, next) => {
  const requestId = req.requestId || `email-journey-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?.uid || null;
    
    // Allow users to see their own journey, or admins to see any
    if (requestingUserId && requestingUserId !== userId) {
      // Check if user is admin
      try {
        await requireAdmin(req, res, () => {});
      } catch (authError) {
        return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403));
      }
    }
    
    const journey = await emailTracking.getUserEmailJourney(userId);
    
    logger.info({ requestId, userId, journeyLength: journey.length }, '[email-tracking] User email journey retrieved');
    
    res.json({
      success: true,
      userId,
      journey
    });
  } catch (error) {
    logger.error({ requestId, error: error.message }, '[email-tracking] Error getting user email journey');
    next(createError('Failed to get user email journey', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

module.exports = router;

