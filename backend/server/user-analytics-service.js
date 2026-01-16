/**
 * User Analytics Service
 * Aggregates comprehensive user analytics data for admin dashboard
 */

const { db, admin } = require('./firebase-admin');
const { logger } = require('./logger');

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_PAGE_VIEWS = 1000; // Limit page views query for performance

/**
 * Convert Firestore timestamp to Date
 */
function toDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toDate) {
    return timestamp.toDate();
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }
  return null;
}

/**
 * Group page views into sessions
 * Sessions expire after 30 minutes of inactivity
 */
function calculateSessions(pageViews) {
  if (!pageViews || pageViews.length === 0) {
    return [];
  }

  // Sort page views by timestamp
  const sorted = [...pageViews].sort((a, b) => {
    const timeA = toDate(a.viewedAt)?.getTime() || 0;
    const timeB = toDate(b.viewedAt)?.getTime() || 0;
    return timeA - timeB;
  });

  const sessions = [];
  let currentSession = null;

  for (const pageView of sorted) {
    const viewTime = toDate(pageView.viewedAt)?.getTime();
    if (!viewTime) continue;

    if (!currentSession) {
      // Start new session
      currentSession = {
        startTime: viewTime,
        endTime: viewTime,
        pageViews: [pageView],
        entryPage: pageView.page || pageView.pagePath || 'unknown',
        exitPage: pageView.page || pageView.pagePath || 'unknown'
      };
    } else {
      const timeSinceLastView = viewTime - currentSession.endTime;
      
      if (timeSinceLastView > SESSION_TIMEOUT_MS) {
        // Session expired, start new session
        sessions.push(currentSession);
        currentSession = {
          startTime: viewTime,
          endTime: viewTime,
          pageViews: [pageView],
          entryPage: pageView.page || pageView.pagePath || 'unknown',
          exitPage: pageView.page || pageView.pagePath || 'unknown'
        };
      } else {
        // Continue current session
        currentSession.endTime = viewTime;
        currentSession.pageViews.push(pageView);
        currentSession.exitPage = pageView.page || pageView.pagePath || 'unknown';
      }
    }
  }

  // Add last session if exists
  if (currentSession) {
    sessions.push(currentSession);
  }

  // Calculate duration for each session
  return sessions.map(session => ({
    ...session,
    duration: session.endTime - session.startTime,
    pageCount: session.pageViews.length,
    startTime: new Date(session.startTime).toISOString(),
    endTime: new Date(session.endTime).toISOString()
  }));
}

/**
 * Calculate total time on site from sessions
 */
function calculateTotalTimeOnSite(sessions) {
  if (!sessions || sessions.length === 0) {
    return 0;
  }
  return sessions.reduce((total, session) => total + (session.duration || 0), 0);
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms) {
  if (!ms || ms < 0) return '0s';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Get user referrer and UTM data
 */
async function getUserReferrerData(userId) {
  try {
    // First, try to get from user document
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      if (userData.referrer || userData.utm_source) {
        return {
          referrer: userData.referrer || null,
          utm_source: userData.utm_source || null,
          utm_medium: userData.utm_medium || null,
          utm_campaign: userData.utm_campaign || null,
          utm_content: userData.utm_content || null,
          utm_term: userData.utm_term || null,
          landing_page: userData.landing_page || null,
          first_visit_at: userData.first_visit_at ? toDate(userData.first_visit_at)?.toISOString() : null
        };
      }
    }

    // Fallback: try to get from first page view
    const pageViewsSnapshot = await db.collection('page_views')
      .where('userId', '==', userId)
      .orderBy('viewedAt', 'asc')
      .limit(1)
      .get();

    if (!pageViewsSnapshot.empty) {
      const firstPageView = pageViewsSnapshot.docs[0].data();
      return {
        referrer: firstPageView.referrer || null,
        utm_source: firstPageView.utm_source || null,
        utm_medium: firstPageView.utm_medium || null,
        utm_campaign: firstPageView.utm_campaign || null,
        utm_content: firstPageView.utm_content || null,
        utm_term: firstPageView.utm_term || null,
        landing_page: firstPageView.page || firstPageView.pagePath || null,
        first_visit_at: firstPageView.viewedAt ? toDate(firstPageView.viewedAt)?.toISOString() : null
      };
    }

    return {
      referrer: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      landing_page: null,
      first_visit_at: null
    };
  } catch (error) {
    logger.error({ userId, error: error.message }, '[user-analytics-service] Error getting referrer data');
    return {
      referrer: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      landing_page: null,
      first_visit_at: null
    };
  }
}

/**
 * Get comprehensive user analytics
 */
async function getUserAnalytics(userId) {
  const requestId = `user-analytics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, userId }, '[user-analytics-service] Getting user analytics');

  try {
    // Get user document
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new Error('User not found');
    }
    const userData = userDoc.data();

    // Get credits data
    let creditsData = null;
    let isUnlimited = false;
    try {
      const creditsDoc = await db.collection('user_credits').doc(userId).get();
      if (creditsDoc.exists) {
        const credits = creditsDoc.data();
        
        // Check if user has Pro subscription with unlimited access
        const hasProSubscription = credits.subscription?.type === 'pro' && 
          (credits.subscription?.status === 'active' || credits.subscription?.status === 'paid');
        const hasUnlimitedPermission = credits.permissions?.canCreateUnlimited === true;
        // Fallback: check user.plan if subscription data is missing (for existing users)
        const hasProPlan = userData.plan === 'pro' || userData.plan === 'Pro';
        isUnlimited = hasProSubscription || hasUnlimitedPermission || (hasProPlan && !credits.subscription);
        
        creditsData = {
          unlimited: isUnlimited,
          total: isUnlimited ? null : ((credits.balances?.paid || 0) + (credits.balances?.free || 0) + (credits.balances?.bonus || 0)),
          paid: credits.balances?.paid || 0,
          free: credits.balances?.free || 0,
          bonus: credits.balances?.bonus || 0,
          subscription: credits.subscription || null
        };
      } else {
        // If no user_credits document exists, check user.plan as fallback
        const hasProPlan = userData.plan === 'pro' || userData.plan === 'Pro';
        if (hasProPlan) {
          isUnlimited = true;
          creditsData = {
            unlimited: true,
            total: null,
            paid: 0,
            free: 0,
            bonus: 0,
            subscription: null
          };
        }
      }
    } catch (error) {
      logger.warn({ requestId, userId, error: error.message }, '[user-analytics-service] Error getting credits data');
    }

    // Get subscription data - check both collections
    let subscriptionData = null;
    let needsSync = false; // Flag to indicate if user_credits needs syncing from subscriptions
    try {
      // First, try subscriptions collection
      const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
      if (subscriptionDoc.exists) {
        const subData = subscriptionDoc.data();
        // Normalize status: "paid" means active subscription
        const normalizedStatus = subData.status === 'paid' ? 'active' : (subData.status || null);
        const isActiveSubscription = normalizedStatus === 'active' || normalizedStatus === 'on_trial';
        
        subscriptionData = {
          status: normalizedStatus,
          renewsAt: subData.renews_at ? toDate(subData.renews_at)?.toISOString() : null,
          endsAt: subData.ends_at ? toDate(subData.ends_at)?.toISOString() : null,
          cancelAtPeriodEnd: subData.cancel_at_period_end || false,
          subscriptionId: subData.lemon_subscription_id || null
        };
        
        // Check if user_credits needs syncing: if subscription exists but user_credits doesn't have pro subscription
        if (isActiveSubscription && subData.product_type === 'subscription' && 
            (subData.product_key === 'pro_monthly' || subData.product_key === 'pro_yearly')) {
          const creditsDoc = await db.collection('user_credits').doc(userId).get();
          if (creditsDoc.exists) {
            const credits = creditsDoc.data();
            const hasProInCredits = credits.subscription?.type === 'pro' && 
              (credits.subscription?.status === 'active' || credits.subscription?.status === 'paid');
            if (!hasProInCredits) {
              needsSync = true;
              logger.warn({ requestId, userId }, '[user-analytics-service] Subscription exists but user_credits not synced - needs sync');
            }
          } else {
            needsSync = true;
            logger.warn({ requestId, userId }, '[user-analytics-service] Subscription exists but user_credits document missing - needs sync');
          }
        }
      } else {
        // Fallback: check user_credits.subscription
        if (creditsData && creditsData.subscription && creditsData.subscription.type === 'pro') {
          subscriptionData = {
            status: creditsData.subscription.status || null,
            renewsAt: creditsData.subscription.expiresAt ? toDate(creditsData.subscription.expiresAt)?.toISOString() : null,
            endsAt: creditsData.subscription.expiresAt ? toDate(creditsData.subscription.expiresAt)?.toISOString() : null,
            cancelAtPeriodEnd: false,
            subscriptionId: null
          };
        } else if (userData.plan === 'pro' || userData.plan === 'Pro') {
          // Fallback for existing users: if user has plan: 'pro' but no subscription data
          subscriptionData = {
            status: 'active',
            renewsAt: null,
            endsAt: null,
            cancelAtPeriodEnd: false,
            subscriptionId: null
          };
        }
      }
    } catch (error) {
      logger.warn({ requestId, userId, error: error.message }, '[user-analytics-service] Error getting subscription data');
    }

    // Get specs count and list
    let specsData = { count: 0, specs: [] };
    try {
      const specsSnapshot = await db.collection('specs')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50) // Limit to 50 most recent specs
        .get();

      specsData.count = specsSnapshot.size;
      specsData.specs = specsSnapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title || 'Untitled Spec',
        createdAt: doc.data().createdAt ? toDate(doc.data().createdAt)?.toISOString() : null
      }));
    } catch (error) {
      logger.warn({ requestId, userId, error: error.message }, '[user-analytics-service] Error getting specs data');
    }

    // Get page views
    let pageViews = [];
    try {
      const pageViewsSnapshot = await db.collection('page_views')
        .where('userId', '==', userId)
        .orderBy('viewedAt', 'desc')
        .limit(MAX_PAGE_VIEWS)
        .get();

      pageViews = pageViewsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      logger.warn({ requestId, userId, error: error.message }, '[user-analytics-service] Error getting page views');
    }

    // Calculate sessions
    const sessions = calculateSessions(pageViews);
    const totalTimeOnSite = calculateTotalTimeOnSite(sessions);

    // Get referrer/UTM data
    const referrerData = await getUserReferrerData(userId);

    // Get last visit
    let lastVisit = null;
    if (pageViews.length > 0) {
      const lastPageView = pageViews[0];
      const lastViewTime = toDate(lastPageView.viewedAt);
      if (lastViewTime) {
        // Find session for last visit
        const lastSession = sessions.find(s => {
          const sessionStart = new Date(s.startTime).getTime();
          const sessionEnd = new Date(s.endTime).getTime();
          const viewTime = lastViewTime.getTime();
          return viewTime >= sessionStart && viewTime <= sessionEnd;
        });

        lastVisit = {
          date: lastViewTime.toISOString(),
          page: lastPageView.page || lastPageView.pagePath || 'unknown',
          duration: lastSession ? formatDuration(lastSession.duration) : null
        };
      }
    }

    // Collect raw data for debugging
    const rawData = {
      users: {
        exists: userDoc.exists,
        data: userData
      },
      user_credits: null,
      subscriptions: null
    };

    try {
      const creditsDoc = await db.collection('user_credits').doc(userId).get();
      rawData.user_credits = {
        exists: creditsDoc.exists,
        data: creditsDoc.exists ? creditsDoc.data() : null
      };
    } catch (error) {
      rawData.user_credits = { error: error.message };
    }

    try {
      const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
      rawData.subscriptions = {
        exists: subscriptionDoc.exists,
        data: subscriptionDoc.exists ? subscriptionDoc.data() : null
      };
    } catch (error) {
      rawData.subscriptions = { error: error.message };
    }

    // Build comprehensive analytics object
    const analytics = {
      // Basic user info
      user: {
        id: userId,
        email: userData.email || null,
        displayName: userData.displayName || null,
        plan: userData.plan || 'free',
        createdAt: userData.createdAt ? toDate(userData.createdAt)?.toISOString() : null,
        lastActive: userData.lastActive ? (typeof userData.lastActive === 'string' ? userData.lastActive : toDate(userData.lastActive)?.toISOString()) : null,
        disabled: userData.disabled || false
      },
      // Credits information
      credits: creditsData,
      // Subscription information
      subscription: subscriptionData,
      // Specs information
      specs: specsData,
      // Acquisition data
      acquisition: referrerData,
      // Visit history
      visits: {
        totalTimeOnSite: totalTimeOnSite,
        totalTimeOnSiteFormatted: formatDuration(totalTimeOnSite),
        totalVisits: pageViews.length,
        sessions: sessions.map(s => ({
          startTime: s.startTime,
          endTime: s.endTime,
          duration: s.duration,
          durationFormatted: formatDuration(s.duration),
          pageCount: s.pageCount,
          entryPage: s.entryPage,
          exitPage: s.exitPage
        })),
        lastVisit: lastVisit
      },
      // Page journey (all page views in chronological order)
      pageJourney: pageViews
        .slice()
        .reverse() // Reverse to get chronological order
        .map(pv => ({
          id: pv.id,
          page: pv.page || pv.pagePath || 'unknown',
          viewedAt: pv.viewedAt ? toDate(pv.viewedAt)?.toISOString() : null,
          referrer: pv.referrer || null,
          sessionId: pv.sessionId || null
        })),
      // Raw data for debugging
      rawData: rawData,
      // Sync flag - indicates if user_credits needs syncing from subscriptions
      needsSync: needsSync
    };

    // Auto-sync if needed (fire and forget - don't block response)
    if (needsSync && subscriptionData && subscriptionData.status === 'active') {
      try {
        const creditsV2Service = require('./credits-v2-service');
        const productConfig = subscriptionData.subscriptionId ? {
          billing_interval: subscriptionData.renewsAt ? 'month' : null // Default to month if renewsAt exists
        } : null;
        
        creditsV2Service.enableProSubscription(userId, {
          plan: 'pro',
          subscriptionId: subscriptionData.subscriptionId || null,
          subscriptionStatus: 'active',
          subscriptionInterval: productConfig?.billing_interval || null,
          currentPeriodEnd: subscriptionData.renewsAt || subscriptionData.endsAt || null,
          cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd || false,
          metadata: {
            source: 'analytics_auto_sync',
            requestId
          }
        }).catch(syncError => {
          logger.warn({ requestId, userId, error: syncError.message }, '[user-analytics-service] Auto-sync failed (non-critical)');
        });
      } catch (syncError) {
        logger.warn({ requestId, userId, error: syncError.message }, '[user-analytics-service] Auto-sync error (non-critical)');
      }
    }

    logger.info({ requestId, userId, sessionsCount: sessions.length, pageViewsCount: pageViews.length, needsSync }, '[user-analytics-service] User analytics retrieved successfully');
    return analytics;
  } catch (error) {
    logger.error({ requestId, userId, error: { message: error.message, stack: error.stack } }, '[user-analytics-service] Error getting user analytics');
    throw error;
  }
}

module.exports = {
  getUserAnalytics,
  calculateSessions,
  calculateTotalTimeOnSite,
  getUserReferrerData
};

