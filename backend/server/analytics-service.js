/**
 * Analytics Service
 * Handles analytics data collection and aggregation
 */

const { db, admin } = require('./firebase-admin');
const { logger } = require('./logger');

// Helper to get IP address from request
function getClientIp(req) {
  return req.ip || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         null;
}

const COLLECTIONS = {
  ARTICLE_VIEWS: 'article_views',
  GUIDE_VIEWS: 'guide_views',
  ANALYTICS_EVENTS: 'analytics_events',
  PAGE_VIEWS: 'page_views'
};

/**
 * Record an article view
 */
async function recordArticleView(articleId, articleSlug, userId = null, ip = null) {
  const requestId = `article-view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const viewData = {
      articleId,
      articleSlug,
      userId: userId || null,
      viewedAt: admin.firestore.FieldValue.serverTimestamp(),
      ip: ip || null
    };
    
    // Save individual view record
    await db.collection(COLLECTIONS.ARTICLE_VIEWS).add(viewData);
    
    // Update article counter (backward compatibility)
    const articleRef = db.collection('articles');
    const snapshot = await articleRef.where('slug', '==', articleSlug).limit(1).get();
    if (!snapshot.empty) {
      const articleDoc = snapshot.docs[0];
      await articleDoc.ref.update({
        views: admin.firestore.FieldValue.increment(1)
      });
    }
    
    // Add to analytics_events for quick queries
    await db.collection(COLLECTIONS.ANALYTICS_EVENTS).add({
      type: 'article_view',
      entityId: articleId,
      entityType: 'article',
      entitySlug: articleSlug,
      userId: userId || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata: { ip }
    });
    
    logger.debug({ requestId, articleId, articleSlug, userId }, '[analytics-service] Article view recorded');
    return { success: true };
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[analytics-service] Failed to record article view');
    throw error;
  }
}

/**
 * Record a guide view
 */
async function recordGuideView(guideId, userId = null, ip = null) {
  const requestId = `guide-view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const viewData = {
      guideId,
      userId: userId || null,
      viewedAt: admin.firestore.FieldValue.serverTimestamp(),
      ip: ip || null
    };
    
    // Save individual view record
    await db.collection(COLLECTIONS.GUIDE_VIEWS).add(viewData);
    
    // Update guide counter (backward compatibility)
    const guideRef = db.collection('academy_guides').doc(guideId);
    const guideDoc = await guideRef.get();
    if (guideDoc.exists) {
      await guideRef.update({
        views: admin.firestore.FieldValue.increment(1)
      });
    }
    
    // Add to analytics_events for quick queries
    await db.collection(COLLECTIONS.ANALYTICS_EVENTS).add({
      type: 'guide_view',
      entityId: guideId,
      entityType: 'guide',
      userId: userId || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata: { ip }
    });
    
    logger.debug({ requestId, guideId, userId }, '[analytics-service] Guide view recorded');
    return { success: true };
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[analytics-service] Failed to record guide view');
    throw error;
  }
}

/**
 * Get or create session ID for a user
 * Sessions expire after 30 minutes of inactivity
 */
async function getOrCreateSession(userId, pageViewData) {
  if (!userId) return null;
  
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  const now = Date.now();
  
  try {
    // Get the most recent page view for this user
    const recentPageViews = await db.collection(COLLECTIONS.PAGE_VIEWS)
      .where('userId', '==', userId)
      .orderBy('viewedAt', 'desc')
      .limit(1)
      .get();
    
    if (!recentPageViews.empty) {
      const lastPageView = recentPageViews.docs[0].data();
      const lastViewTime = lastPageView.viewedAt?.toDate?.()?.getTime() || 
                          (lastPageView.viewedAt instanceof Date ? lastPageView.viewedAt.getTime() : null);
      
      // If last view was within session timeout, reuse session ID
      if (lastViewTime && (now - lastViewTime) < SESSION_TIMEOUT_MS && lastPageView.sessionId) {
        return lastPageView.sessionId;
      }
    }
    
    // Create new session ID
    return `session_${userId}_${now}_${Math.random().toString(36).substr(2, 9)}`;
  } catch (error) {
    logger.warn({ userId, error: error.message }, '[analytics-service] Error getting session, creating new one');
    // Fallback: create new session ID
    return `session_${userId}_${now}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Record a page view
 * Enhanced to track sessionId, referrer, and pagePath
 */
async function recordPageView(page, userId = null, metadata = {}, req = null) {
  const requestId = `page-view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Extract referrer from request headers if available
    let referrer = metadata.referrer || null;
    if (req && !referrer) {
      referrer = req.get('referer') || req.get('referrer') || null;
    }
    
    // Extract pagePath from request if available
    let pagePath = metadata.pagePath || page;
    if (req && !metadata.pagePath) {
      pagePath = req.path || req.originalUrl || page;
    }
    
    // Extract UTM parameters from query string if available
    const utmParams = {};
    if (req && req.query) {
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(param => {
        if (req.query[param]) {
          utmParams[param] = req.query[param];
        }
      });
    }
    
    // Get or create session ID
    let sessionId = metadata.sessionId || null;
    if (userId && !sessionId) {
      sessionId = await getOrCreateSession(userId, { page, pagePath });
    }
    
    const viewData = {
      page,
      pagePath: pagePath || page,
      userId: userId || null,
      viewedAt: admin.firestore.FieldValue.serverTimestamp(),
      referrer: referrer,
      sessionId: sessionId,
      duration: metadata.duration || null,
      ...utmParams,
      ...metadata
    };
    
    // Save to page_views collection
    await db.collection(COLLECTIONS.PAGE_VIEWS).add(viewData);
    
    // Add to analytics_events for quick queries
    await db.collection(COLLECTIONS.ANALYTICS_EVENTS).add({
      type: 'page_view',
      entityId: page,
      entityType: 'page',
      userId: userId || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        pagePath,
        referrer,
        sessionId,
        ...utmParams,
        ...metadata
      }
    });
    
    logger.debug({ requestId, page, pagePath, userId, sessionId }, '[analytics-service] Page view recorded');
    return { success: true, sessionId };
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[analytics-service] Failed to record page view');
    throw error;
  }
}

/**
 * Record an analytics event
 */
async function recordEvent(type, entityId, entityType, userId = null, metadata = {}) {
  const requestId = `analytics-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const eventData = {
      type,
      entityId,
      entityType,
      userId: userId || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata
    };
    
    await db.collection(COLLECTIONS.ANALYTICS_EVENTS).add(eventData);
    
    logger.debug({ requestId, type, entityId, entityType, userId }, '[analytics-service] Analytics event recorded');
    return { success: true };
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[analytics-service] Failed to record analytics event');
    throw error;
  }
}

/**
 * Get article views count for a date range
 */
async function getArticleViewsCount(startDate, endDate, articleId = null) {
  try {
    // Convert Date to Firestore Timestamp
    const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
    const endTimestamp = admin.firestore.Timestamp.fromDate(endDate);
    
    let query = db.collection(COLLECTIONS.ARTICLE_VIEWS)
      .where('viewedAt', '>=', startTimestamp)
      .where('viewedAt', '<=', endTimestamp);
    
    if (articleId) {
      query = query.where('articleId', '==', articleId);
    }
    
    const snapshot = await query.get();
    return snapshot.size;
  } catch (error) {
    logger.error({ error: { message: error.message, stack: error.stack } }, '[analytics-service] Failed to get article views count');
    return 0;
  }
}

/**
 * Get guide views count for a date range
 */
async function getGuideViewsCount(startDate, endDate, guideId = null) {
  try {
    // Convert Date to Firestore Timestamp
    const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
    const endTimestamp = admin.firestore.Timestamp.fromDate(endDate);
    
    let query = db.collection(COLLECTIONS.GUIDE_VIEWS)
      .where('viewedAt', '>=', startTimestamp)
      .where('viewedAt', '<=', endTimestamp);
    
    if (guideId) {
      query = query.where('guideId', '==', guideId);
    }
    
    const snapshot = await query.get();
    return snapshot.size;
  } catch (error) {
    logger.error({ error: { message: error.message, stack: error.stack } }, '[analytics-service] Failed to get guide views count');
    return 0;
  }
}

module.exports = {
  recordArticleView,
  recordGuideView,
  recordPageView,
  recordEvent,
  getArticleViewsCount,
  getGuideViewsCount,
  getOrCreateSession,
  COLLECTIONS
};











