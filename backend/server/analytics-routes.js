/**
 * Analytics Routes
 * API endpoints for analytics data
 */

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('./security');
const { db, admin } = require('./firebase-admin');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');
const { getArticleViewsCount, getGuideViewsCount, recordPageView, recordEvent } = require('./analytics-service');

/**
 * Store Web Vitals metrics
 * @param {Object} metric - Web Vitals metric data
 */
async function storeWebVital(metric) {
  try {
    const collection = db.collection('webVitals');
    await collection.add({
      name: metric.name,
      value: metric.value,
      id: metric.id,
      rating: metric.rating,
      delta: metric.delta,
      navigationType: metric.navigationType,
      url: metric.url,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: metric.userAgent,
      createdAt: new Date()
    });
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, '[analytics-routes] Error storing web vital');
    throw error;
  }
}

/**
 * Get content stats (articles and guides views)
 * GET /api/analytics/content-stats
 */
router.get('/content-stats', requireAdmin, async (req, res, next) => {
  const requestId = req.requestId || `content-stats-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, query: req.query }, '[analytics-routes] GET /content-stats');
  
  try {
    const range = req.query.range || 'week';
    const ranges = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };
    
    const rangeMs = ranges[range] || ranges.week;
    const now = new Date();
    const startDate = new Date(now.getTime() - rangeMs);
    const allTimeStart = new Date(0); // Beginning of time
    
    // Get article views
    const articlesViewsInRange = await getArticleViewsCount(startDate, now);
    const articlesViewsTotal = await getArticleViewsCount(allTimeStart, now);
    
    // Get guide views
    const guidesViewsInRange = await getGuideViewsCount(startDate, now);
    const guidesViewsTotal = await getGuideViewsCount(allTimeStart, now);
    
    logger.info({ 
      requestId, 
      range,
      articlesViewsInRange,
      articlesViewsTotal,
      guidesViewsInRange,
      guidesViewsTotal
    }, '[analytics-routes] GET /content-stats - Success');
    
    res.json({
      success: true,
      stats: {
        articlesViews: articlesViewsTotal,
        articlesViewsInRange: articlesViewsInRange,
        guidesViews: guidesViewsTotal,
        guidesViewsInRange: guidesViewsInRange
      }
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[analytics-routes] GET /content-stats - Error');
    next(createError('Failed to get content stats', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Get top articles by views
 * GET /api/analytics/top-articles
 */
router.get('/top-articles', requireAdmin, async (req, res, next) => {
  const requestId = req.requestId || `top-articles-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, query: req.query }, '[analytics-routes] GET /top-articles');
  
  try {
    const limit = parseInt(req.query.limit) || 10;
    const range = req.query.range || 'all';
    
    const ranges = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };
    
    const now = new Date();
    const startDate = range === 'all' ? new Date(0) : new Date(now.getTime() - (ranges[range] || ranges.week));
    
    // Convert Date to Firestore Timestamp
    const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
    const endTimestamp = admin.firestore.Timestamp.fromDate(now);
    
    // Get all article views in range
    let query = db.collection('article_views')
      .where('viewedAt', '>=', startTimestamp)
      .where('viewedAt', '<=', endTimestamp);
    
    const snapshot = await query.get();
    
    // Count views per article
    const articleViewsCount = new Map();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const articleId = data.articleId;
      articleViewsCount.set(articleId, (articleViewsCount.get(articleId) || 0) + 1);
    });
    
    // Get article details
    const articlesSnapshot = await db.collection('articles').get();
    const articlesMap = new Map();
    articlesSnapshot.docs.forEach(doc => {
      articlesMap.set(doc.id, { id: doc.id, ...doc.data() });
    });
    
    // Combine and sort
    const topArticles = Array.from(articleViewsCount.entries())
      .map(([articleId, views]) => {
        const article = articlesMap.get(articleId);
        return {
          id: articleId,
          title: article?.title || 'Unknown',
          slug: article?.slug || articleId,
          views: views,
          totalViews: article?.views || 0
        };
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);
    
    logger.info({ requestId, count: topArticles.length }, '[analytics-routes] GET /top-articles - Success');
    
    res.json({
      success: true,
      articles: topArticles
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[analytics-routes] GET /top-articles - Error');
    next(createError('Failed to get top articles', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Get top guides by views
 * GET /api/analytics/top-guides
 */
router.get('/top-guides', requireAdmin, async (req, res, next) => {
  const requestId = req.requestId || `top-guides-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, query: req.query }, '[analytics-routes] GET /top-guides');
  
  try {
    const limit = parseInt(req.query.limit) || 10;
    const range = req.query.range || 'all';
    
    const ranges = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };
    
    const now = new Date();
    const startDate = range === 'all' ? new Date(0) : new Date(now.getTime() - (ranges[range] || ranges.week));
    
    // Convert Date to Firestore Timestamp
    const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
    const endTimestamp = admin.firestore.Timestamp.fromDate(now);
    
    // Get all guide views in range
    let query = db.collection('guide_views')
      .where('viewedAt', '>=', startTimestamp)
      .where('viewedAt', '<=', endTimestamp);
    
    const snapshot = await query.get();
    
    // Count views per guide
    const guideViewsCount = new Map();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const guideId = data.guideId;
      guideViewsCount.set(guideId, (guideViewsCount.get(guideId) || 0) + 1);
    });
    
    // Get guide details
    const guidesSnapshot = await db.collection('academy_guides').get();
    const guidesMap = new Map();
    guidesSnapshot.docs.forEach(doc => {
      guidesMap.set(doc.id, { id: doc.id, ...doc.data() });
    });
    
    // Combine and sort
    const topGuides = Array.from(guideViewsCount.entries())
      .map(([guideId, views]) => {
        const guide = guidesMap.get(guideId);
        return {
          id: guideId,
          title: guide?.title || 'Unknown',
          views: views,
          totalViews: guide?.views || 0
        };
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, limit);
    
    logger.info({ requestId, count: topGuides.length }, '[analytics-routes] GET /top-guides - Success');
    
    res.json({
      success: true,
      guides: topGuides
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[analytics-routes] GET /top-guides - Error');
    next(createError('Failed to get top guides', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Record a page view (public endpoint - no auth required)
 * POST /api/analytics/page-view
 */
router.post('/page-view', async (req, res, next) => {
  const requestId = req.requestId || `page-view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.debug({ requestId, body: req.body }, '[analytics-routes] POST /page-view');
  
  try {
    const { page, userId, metadata } = req.body;
    
    if (!page) {
      return next(createError('Page is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    
    await recordPageView(page, userId || null, metadata || {});
    
    res.json({
      success: true,
      message: 'Page view recorded'
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[analytics-routes] POST /page-view - Error');
    next(createError('Failed to record page view', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

/**
 * Record an analytics event (public endpoint - no auth required)
 * POST /api/analytics/event
 */
router.post('/event', async (req, res, next) => {
  const requestId = req.requestId || `analytics-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.debug({ requestId, body: req.body }, '[analytics-routes] POST /event');
  
  try {
    const { type, entityId, entityType, userId, metadata } = req.body;
    
    if (!type || !entityId || !entityType) {
      return next(createError('type, entityId, and entityType are required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    
    await recordEvent(type, entityId, entityType, userId || null, metadata || {});
    
    res.json({
      success: true,
      message: 'Event recorded'
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[analytics-routes] POST /event - Error');
    next(createError('Failed to record event', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

/**
 * Get funnel analysis data
 * GET /api/analytics/funnel
 */
router.get('/funnel', requireAdmin, async (req, res, next) => {
  const requestId = req.requestId || `funnel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, query: req.query }, '[analytics-routes] GET /funnel');
  
  try {
    const range = req.query.range || 'week';
    const ranges = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };
    
    const rangeMs = ranges[range] || ranges.week;
    const now = new Date();
    const startDate = new Date(now.getTime() - rangeMs);
    const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
    const endTimestamp = admin.firestore.Timestamp.fromDate(now);
    
    // Get all analytics events in range
    const eventsSnapshot = await db.collection('analytics_events')
      .where('timestamp', '>=', startTimestamp)
      .where('timestamp', '<=', endTimestamp)
      .get();
    
    // Count funnel steps
    const funnel = {
      visitors: 0,
      signups: 0,
      pricingViews: 0,
      buyNowClicks: 0,
      checkoutInitiated: 0,
      purchases: 0
    };
    
    const uniqueVisitors = new Set();
    const uniqueSignups = new Set();
    
    // Get signups from users collection (more reliable)
    try {
      const usersSnapshot = await db.collection('users')
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get();
      
      usersSnapshot.docs.forEach(doc => {
        uniqueSignups.add(doc.id);
      });
    } catch (error) {
      logger.warn({ requestId, error: error.message }, '[analytics-routes] Failed to get signups from users collection');
    }
    
    eventsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const type = data.type;
      const userId = data.userId;
      
      // Count unique visitors (any page view)
      if (type === 'page_view') {
        uniqueVisitors.add(userId || doc.id);
      }
      
      // Count pricing page views
      if (type === 'page_view' && data.entityId === 'pricing') {
        funnel.pricingViews++;
      }
      
      // Count Buy Now clicks
      if (type === 'button_click' && data.entityId && data.entityId.startsWith('buy_now_')) {
        funnel.buyNowClicks++;
      }
      
      // Count checkout initiated
      if (type === 'funnel_step' && data.entityId === 'checkout_initiated') {
        funnel.checkoutInitiated++;
      }
      
      // Count purchases (from purchases collection or events)
      if (type === 'purchase' || type === 'payment' || type === 'subscription') {
        funnel.purchases++;
      }
    }
    
    funnel.visitors = uniqueVisitors.size;
    funnel.signups = uniqueSignups.size;
    
    // Also get purchases from purchases collection for accuracy
    try {
      const purchasesSnapshot = await db.collection('purchases')
        .where('createdAt', '>=', startTimestamp)
        .where('createdAt', '<=', endTimestamp)
        .get();
      
      funnel.purchases = purchasesSnapshot.size;
    } catch (error) {
      logger.warn({ requestId, error: error.message }, '[analytics-routes] Failed to get purchases from purchases collection');
    }
    
    // Calculate conversion rates
    const conversions = {
      visitorsToSignups: funnel.visitors > 0 ? (funnel.signups / funnel.visitors * 100).toFixed(2) : '0.00',
      signupsToPricing: funnel.signups > 0 ? (funnel.pricingViews / funnel.signups * 100).toFixed(2) : '0.00',
      pricingToBuyNow: funnel.pricingViews > 0 ? (funnel.buyNowClicks / funnel.pricingViews * 100).toFixed(2) : '0.00',
      buyNowToCheckout: funnel.buyNowClicks > 0 ? (funnel.checkoutInitiated / funnel.buyNowClicks * 100).toFixed(2) : '0.00',
      checkoutToPurchase: funnel.checkoutInitiated > 0 ? (funnel.purchases / funnel.checkoutInitiated * 100).toFixed(2) : '0.00',
      overallConversion: funnel.visitors > 0 ? (funnel.purchases / funnel.visitors * 100).toFixed(2) : '0.00'
    };
    
    logger.info({ requestId, range, funnel, conversions }, '[analytics-routes] GET /funnel - Success');
    
    res.json({
      success: true,
      range,
      funnel,
      conversions
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[analytics-routes] GET /funnel - Error');
    next(createError('Failed to get funnel data', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Store Web Vitals metrics (public endpoint - no auth required)
 * POST /api/analytics/web-vitals
 */
router.post('/web-vitals', async (req, res, next) => {
  const requestId = req.requestId || `web-vitals-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.debug({ requestId, body: req.body }, '[analytics-routes] POST /web-vitals');
  
  try {
    const { name, value, id, rating, delta, navigationType, url, userAgent } = req.body;
    
    if (!name || value === undefined) {
      return next(createError('name and value are required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    
    // Store in Firestore
    const collection = db.collection('webVitals');
    await collection.add({
      name,
      value,
      id: id || null,
      rating: rating || null,
      delta: delta || null,
      navigationType: navigationType || null,
      url: url || req.headers.referer || null,
      userAgent: userAgent || req.get('user-agent') || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: new Date(),
      ip: req.ip || req.connection.remoteAddress || null
    });
    
    res.json({
      success: true,
      message: 'Web Vital recorded'
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[analytics-routes] POST /web-vitals - Error');
    next(createError('Failed to record web vital', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

module.exports = router;


