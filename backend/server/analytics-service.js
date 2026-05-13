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

/**
 * Resolve userIds in a list of rows into a username/email by batch-fetching the users collection.
 * Falls back to the userId itself if no user document is found.
 */
async function enrichWithUsers(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows || [];
  try {
    const userIds = Array.from(new Set(rows.map((r) => r.userId).filter(Boolean)));
    if (userIds.length === 0) {
      return rows.map((r) => ({ ...r, username: '(anonymous)', email: null }));
    }
    const userRefs = userIds.map((id) => db.collection('users').doc(id));
    const userDocs = await db.getAll(...userRefs);
    const userMap = new Map();
    userDocs.forEach((doc) => {
      if (doc.exists) {
        const u = doc.data() || {};
        const displayName =
          u.displayName ||
          u.name ||
          (u.email ? String(u.email).split('@')[0] : null) ||
          doc.id;
        userMap.set(doc.id, { username: displayName, email: u.email || null });
      }
    });
    return rows.map((r) => {
      if (!r.userId) return { ...r, username: '(anonymous)', email: null };
      const u = userMap.get(r.userId);
      if (!u) return { ...r, username: r.userId, email: null };
      return { ...r, username: u.username, email: u.email };
    });
  } catch (error) {
    logger.warn({ error: error.message }, '[analytics-service] enrichWithUsers fallback');
    return rows.map((r) => ({ ...r, username: r.userId || '(anonymous)', email: null }));
  }
}

/**
 * Paginated query of page_views with filters, sort, and cursor pagination.
 *
 * Filters supported server-side (Firestore where): page (exact), userId, viewedAt range.
 * Filters applied client-side after fetch (substring match): referrerContains, usernameContains, pageContains.
 * Sort: 'recent' (viewedAt desc, default) | 'oldest' (viewedAt asc).
 * Pagination: cursor is the document id of the last row of the previous page.
 *
 * Returns { rows, nextCursor, scanned }.
 */
async function queryPageViews(filters = {}) {
  const {
    pageEquals = null,
    pageContains = null,
    userId = null,
    referrerContains = null,
    usernameContains = null,
    from = null,
    to = null,
    sort = 'recent',
    limit = 50,
    cursor = null
  } = filters;

  const requestId = `qpv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  try {
    const cappedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const direction = sort === 'oldest' ? 'asc' : 'desc';
    const hasPostFilter = !!referrerContains || !!usernameContains || !!pageContains;
    const fetchLimit = hasPostFilter ? Math.min(cappedLimit * 4, 800) : cappedLimit + 1;

    let query = db.collection(COLLECTIONS.PAGE_VIEWS);
    if (pageEquals) query = query.where('page', '==', pageEquals);
    if (userId) query = query.where('userId', '==', userId);
    if (from instanceof Date) {
      query = query.where('viewedAt', '>=', admin.firestore.Timestamp.fromDate(from));
    }
    if (to instanceof Date) {
      query = query.where('viewedAt', '<=', admin.firestore.Timestamp.fromDate(to));
    }
    query = query.orderBy('viewedAt', direction);

    if (cursor) {
      const cursorDoc = await db.collection(COLLECTIONS.PAGE_VIEWS).doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    query = query.limit(fetchLimit);

    const snapshot = await query.get();
    let rows = snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      const viewedAtRaw = data.viewedAt;
      const viewedAt =
        viewedAtRaw && typeof viewedAtRaw.toDate === 'function'
          ? viewedAtRaw.toDate()
          : viewedAtRaw instanceof Date
            ? viewedAtRaw
            : null;
      return {
        id: doc.id,
        page: data.page || null,
        pagePath: data.pagePath || null,
        pageTitle: data.pageTitle || null,
        userId: data.userId || null,
        referrer: data.referrer || null,
        sessionId: data.sessionId || null,
        device: data.device || null,
        utm_source: data.utm_source || null,
        utm_medium: data.utm_medium || null,
        utm_campaign: data.utm_campaign || null,
        viewedAt: viewedAt ? viewedAt.toISOString() : null
      };
    });

    rows = await enrichWithUsers(rows);

    if (pageContains) {
      const needle = String(pageContains).toLowerCase();
      rows = rows.filter((r) => {
        const hay = `${r.page || ''} ${r.pagePath || ''}`.toLowerCase();
        return hay.includes(needle);
      });
    }
    if (referrerContains) {
      const needle = String(referrerContains).toLowerCase();
      rows = rows.filter((r) => (r.referrer || '').toLowerCase().includes(needle));
    }
    if (usernameContains) {
      const needle = String(usernameContains).toLowerCase();
      rows = rows.filter((r) => {
        const hay = `${r.username || ''} ${r.email || ''}`.toLowerCase();
        return hay.includes(needle);
      });
    }

    let nextCursor = null;
    if (rows.length > cappedLimit) {
      rows = rows.slice(0, cappedLimit);
      nextCursor = rows[rows.length - 1].id;
    } else if (snapshot.size === fetchLimit && rows.length > 0) {
      nextCursor = rows[rows.length - 1].id;
    }

    return { rows, nextCursor, scanned: snapshot.size };
  } catch (error) {
    logger.error(
      { requestId, error: { message: error.message, stack: error.stack } },
      '[analytics-service] queryPageViews failed'
    );
    throw error;
  }
}

/**
 * Aggregate page_views grouped by page, pagePath, or referrer.
 * Scans up to maxScan rows within the optional viewedAt window and groups in memory.
 *
 * Returns { rows: [{ key, count, uniqueUsers, lastSeen }], scanned, truncated }.
 */
async function aggregatePageViews(options = {}) {
  const {
    groupBy = 'page',
    from = null,
    to = null,
    limit = 50,
    maxScan = 10000
  } = options;

  const requestId = `agg-pv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  try {
    const cappedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const cappedScan = Math.min(Math.max(parseInt(maxScan, 10) || 10000, 100), 50000);

    let query = db.collection(COLLECTIONS.PAGE_VIEWS);
    if (from instanceof Date) {
      query = query.where('viewedAt', '>=', admin.firestore.Timestamp.fromDate(from));
    }
    if (to instanceof Date) {
      query = query.where('viewedAt', '<=', admin.firestore.Timestamp.fromDate(to));
    }
    query = query.orderBy('viewedAt', 'desc').limit(cappedScan);

    const snapshot = await query.get();
    const buckets = new Map();

    snapshot.docs.forEach((doc) => {
      const data = doc.data() || {};
      let key;
      if (groupBy === 'referrer') {
        const ref = (data.referrer || '').trim();
        key = ref || '(direct)';
      } else if (groupBy === 'pagePath') {
        key = data.pagePath || data.page || '(unknown)';
      } else {
        key = data.page || data.pagePath || '(unknown)';
      }

      const viewedAtRaw = data.viewedAt;
      const viewedAt =
        viewedAtRaw && typeof viewedAtRaw.toDate === 'function'
          ? viewedAtRaw.toDate()
          : viewedAtRaw instanceof Date
            ? viewedAtRaw
            : null;

      if (!buckets.has(key)) {
        buckets.set(key, {
          key,
          count: 0,
          uniqueUserIds: new Set(),
          lastSeen: viewedAt
        });
      }
      const bucket = buckets.get(key);
      bucket.count += 1;
      if (data.userId) bucket.uniqueUserIds.add(data.userId);
      if (viewedAt && (!bucket.lastSeen || viewedAt > bucket.lastSeen)) {
        bucket.lastSeen = viewedAt;
      }
    });

    const rows = Array.from(buckets.values())
      .map((b) => ({
        key: b.key,
        count: b.count,
        uniqueUsers: b.uniqueUserIds.size,
        lastSeen: b.lastSeen ? b.lastSeen.toISOString() : null
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, cappedLimit);

    return {
      rows,
      scanned: snapshot.size,
      truncated: snapshot.size >= cappedScan
    };
  } catch (error) {
    logger.error(
      { requestId, error: { message: error.message, stack: error.stack } },
      '[analytics-service] aggregatePageViews failed'
    );
    throw error;
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
  queryPageViews,
  aggregatePageViews,
  enrichWithUsers,
  COLLECTIONS
};











