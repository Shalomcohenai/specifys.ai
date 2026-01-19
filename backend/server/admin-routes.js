const express = require('express');
const router = express.Router();
const { requireAdmin } = require('./security');
const { db, admin } = require('./firebase-admin');
const { syncAllUsers, getLastUserSyncReport } = require('./user-management');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');
const { getRenderLogs, getRenderLogsSummary } = require('./render-logger');
const { getActivityEvents } = require('./admin-activity-service');
const { getUserAnalytics } = require('./user-analytics-service');
const { fetchSubscriptionById, listSubscriptions, buildSubscriptionUpdateFromRecord } = require('./lemon-subscription-resolver');
const { getProductKeyByVariantId, getProductByKey } = require('./lemon-products-config');
const creditsV3Service = require('./credits-v3-service');
const { syncPaymentsData, getCachedPaymentsData, getPaymentsSummary } = require('./lemon-payments-cache');
const emailTracking = require('./email-tracking-service');
const emailService = require('./email-service');

// Debug: Log all route registrations
logger.info('[admin-routes] Initializing admin routes...');

// Enhanced logging helper for all admin routes
const logRouteCall = (req, routeName) => {
  const requestId = req.requestId || `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({
    requestId,
    route: routeName,
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    url: req.url,
    query: req.query,
    params: req.params,
    hasBody: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    bodySize: req.body ? JSON.stringify(req.body).length : 0,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    origin: req.get('origin'),
    hasAuthHeader: !!req.headers.authorization,
    authHeaderLength: req.headers.authorization ? req.headers.authorization.length : 0,
    authHeaderPrefix: req.headers.authorization ? req.headers.authorization.substring(0, 20) + '...' : 'none',
    timestamp: new Date().toISOString()
  }, `[admin-routes] 🔵 Route called: ${routeName} - ${req.method} ${req.originalUrl}`);
  return requestId;
};

/**
 * Verify user has admin access
 * GET /api/admin/verify
 */
router.get('/verify', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'GET /verify');
  logger.info({ 
    requestId, 
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid,
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    url: req.url
  }, '[admin-routes] GET /verify - Route handler called - Verifying admin access');
  
  try {
    res.json({ 
      success: true, 
      email: req.adminUser.email,
      uid: req.adminUser.uid 
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[admin-routes] GET /verify - Error');
    next(createError('Internal server error', ERROR_CODES.INTERNAL_ERROR, 500));
  }
});

/**
 * Get all users (admin only)
 * GET /api/admin/users
 */
router.get('/users', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'GET /users');
  logger.info({ 
    requestId,
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid
  }, '[admin-routes] GET /users - Fetching all users');
  
  try {
    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    logger.info({ requestId, count: users.length }, '[admin-routes] GET /users - Success');
    res.json({ success: true, users });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[admin-routes] GET /users - Error');
    next(createError('Failed to fetch users', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

/**
 * Trigger a full user sync (admin only)
 * POST /api/admin/users/sync
 */
router.post('/users/sync', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'POST /users/sync');
  logger.info({ 
    requestId,
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid,
    options: req.body
  }, '[admin-routes] POST /users/sync - Starting user sync');
  
  try {
    const options = req.body && typeof req.body === 'object' ? req.body : {};
    logger.debug({ requestId, options }, '[admin-routes] Sync options');
    const summary = await syncAllUsers({
      includeDataCollections: options.includeDataCollections !== false,
      dryRun: false,
      recordResult: true
    });

    logger.info({ requestId, summary }, '[admin-routes] POST /users/sync - Success');
    res.json({
      success: true,
      summary
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[admin-routes] POST /users/sync - Error');
    next(createError('Failed to sync users', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Get latest sync summary (admin only)
 * GET /api/admin/users/sync-status
 */
router.get('/users/sync-status', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'GET /users/sync-status');
  logger.info({ 
    requestId,
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid,
    query: req.query
  }, '[admin-routes] GET /users/sync-status - Fetching sync status');
  
  try {
    const cached = getLastUserSyncReport();
    if (cached) {
      logger.debug({ requestId }, '[admin-routes] Returning cached sync status');
      return res.json({ success: true, summary: cached, cached: true });
    }

    const includeDataCollections = req.query.includeDataCollections !== 'false';
    logger.debug({ requestId, includeDataCollections }, '[admin-routes] Computing sync status');
    const preview = await syncAllUsers({
      includeDataCollections,
      dryRun: true,
      recordResult: false
    });

    logger.info({ requestId }, '[admin-routes] GET /users/sync-status - Success');
    res.json({
      success: true,
      summary: preview,
      cached: false
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[admin-routes] GET /users/sync-status - Error');
    next(createError('Failed to compute sync status', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Get all specs (admin only)
 * GET /api/admin/specs
 */
router.get('/specs', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'GET /specs');
  logger.info({ 
    requestId,
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid
  }, '[admin-routes] GET /specs - Fetching all specs');
  
  try {
    const specsSnapshot = await db.collection('specs').get();
    const specs = specsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    logger.info({ requestId, count: specs.length }, '[admin-routes] GET /specs - Success');
    res.json({ success: true, specs });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[admin-routes] GET /specs - Error');
    next(createError('Failed to fetch specs', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

/**
 * Get all market research (admin only)
 * GET /api/admin/market-research
 */
router.get('/market-research', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'GET /market-research');
  logger.info({ 
    requestId,
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid
  }, '[admin-routes] GET /market-research - Fetching market research');
  
  try {
    const researchSnapshot = await db.collection('marketResearch').get();
    const research = researchSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    logger.info({ requestId, count: research.length }, '[admin-routes] GET /market-research - Success');
    res.json({ success: true, research });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[admin-routes] GET /market-research - Error');
    next(createError('Failed to fetch market research', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

/**
 * Add credits to a user (admin only)
 * POST /api/admin/users/:userId/credits
 */
router.post('/users/:userId/credits', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'POST /users/:userId/credits');
  const { userId } = req.params;
  logger.info({ 
    requestId, 
    userId,
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid,
    credits: req.body.credits,
    amount: req.body.amount,
    reason: req.body.reason
  }, '[admin-routes] POST /users/:userId/credits - Adding credits');
  
  try {
    const { amount, reason } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      logger.warn({ requestId, userId, amount }, '[admin-routes] Invalid amount');
      return next(createError('Invalid amount', ERROR_CODES.INVALID_INPUT, 400));
    }

    const creditsV3Service = require('./credits-v3-service');
    logger.debug({ requestId, userId, amount, reason }, '[admin-routes] Granting credits');
    const result = await creditsV3Service.grantCredits(userId, amount, 'admin', { 
      creditType: 'paid',
      reason: reason || 'Admin manual grant' 
    });

    logger.info({ 
      requestId, 
      userId, 
      amount, 
      creditsAdded: result.creditsAdded,
      remaining: result.remaining,
      alreadyProcessed: result.alreadyProcessed || false,
      transactionId: result.transactionId
    }, '[admin-routes] POST /users/:userId/credits - Success');
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error({ requestId, userId, error: { message: error.message, stack: error.stack } }, '[admin-routes] POST /users/:userId/credits - Error');
    next(createError('Failed to add credits', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Change user plan (admin only)
 * PUT /api/admin/users/:userId/plan
 */
router.put('/users/:userId/plan', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'PUT /users/:userId/plan');
  const { userId } = req.params;
  logger.info({ 
    requestId, 
    userId,
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid,
    plan: req.body.plan
  }, '[admin-routes] PUT /users/:userId/plan - Changing user plan');
  
  try {
    const { plan } = req.body;

    if (!plan || !['free', 'pro'].includes(plan)) {
      logger.warn({ requestId, userId, plan }, '[admin-routes] Invalid plan');
      return next(createError('Invalid plan. Must be "free" or "pro"', ERROR_CODES.INVALID_INPUT, 400));
    }

    logger.debug({ requestId, userId, plan }, '[admin-routes] Updating user plan');
    const userRef = db.collection('users').doc(userId);
    await userRef.update({ plan, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

    // Update credits using V3 system if switching to pro
    if (plan === 'pro') {
      logger.debug({ requestId, userId }, '[admin-routes] Updating credits for pro plan');
      const creditsV3Service = require('./credits-v3-service');
      await creditsV3Service.enableProSubscription(userId, {
        productKey: 'pro_monthly',
        productName: 'Pro Monthly',
        subscriptionStatus: 'active',
        metadata: {
          source: 'admin',
          adminUserId: req.adminUser?.uid
        }
      });
      
      // Record activity for admin-enabled subscription
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userEmail = userDoc.exists ? userDoc.data().email : null;
        
        recordSubscriptionChange(
          userId,
          userEmail,
          'pro',
          'active',
          {
            source: 'admin',
            adminUserId: req.adminUser?.uid
          }
        ).catch(err => {
          logger.warn({ requestId, userId, error: err.message }, '[admin-routes] Failed to record subscription activation activity');
        });
      } catch (err) {
        // Ignore - activity recording is non-critical
      }
    } else if (plan === 'free') {
      logger.debug({ requestId, userId }, '[admin-routes] Disabling pro plan');
      const creditsV3Service = require('./credits-v3-service');
      await creditsV3Service.disableProSubscription(userId, {
        cancelReason: 'admin_requested',
        restoreCredits: null
      });
      
      // Record activity for admin-disabled subscription (already done in disableProSubscription, but adding here for admin context)
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userEmail = userDoc.exists ? userDoc.data().email : null;
        
        recordSubscriptionChange(
          userId,
          userEmail,
          'pro',
          'cancelled',
          {
            source: 'admin',
            adminUserId: req.adminUser?.uid,
            cancelReason: 'admin_requested'
          }
        ).catch(err => {
          logger.warn({ requestId, userId, error: err.message }, '[admin-routes] Failed to record subscription cancellation activity');
        });
      } catch (err) {
        // Ignore - activity recording is non-critical
      }
    }

    logger.info({ requestId, userId, plan }, '[admin-routes] PUT /users/:userId/plan - Success');
    res.json({ success: true, userId, plan });
  } catch (error) {
    logger.error({ requestId, userId, error: { message: error.message, stack: error.stack } }, '[admin-routes] PUT /users/:userId/plan - Error');
    next(createError('Failed to change plan', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Reset user password (admin only)
 * POST /api/admin/users/:userId/reset-password
 */
router.post('/users/:userId/reset-password', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'POST /users/:userId/reset-password');
  const { userId } = req.params;
  logger.info({ 
    requestId, 
    userId,
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid
  }, '[admin-routes] POST /users/:userId/reset-password - Resetting password');
  
  try {
    const userRecord = await admin.auth().getUser(userId);
    if (!userRecord.email) {
      logger.warn({ requestId, userId }, '[admin-routes] User has no email address');
      return next(createError('User has no email address', ERROR_CODES.RESOURCE_NOT_FOUND, 400));
    }

    logger.debug({ requestId, userId, email: userRecord.email }, '[admin-routes] Generating password reset link');
    const link = await admin.auth().generatePasswordResetLink(userRecord.email);
    
    logger.info({ requestId, userId }, '[admin-routes] POST /users/:userId/reset-password - Success');
    res.json({ success: true, resetLink: link });
  } catch (error) {
    logger.error({ requestId, userId, error: { message: error.message, stack: error.stack } }, '[admin-routes] POST /users/:userId/reset-password - Error');
    next(createError('Failed to reset password', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Toggle user disabled status (admin only)
 * PUT /api/admin/users/:userId/toggle
 */
router.put('/users/:userId/toggle', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'PUT /users/:userId/toggle');
  const { userId } = req.params;
  logger.info({ 
    requestId, 
    userId,
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid,
    disabled: req.body.disabled
  }, '[admin-routes] PUT /users/:userId/toggle - Toggling user status');
  
  try {
    const { disabled } = req.body;
    const disabledStatus = Boolean(disabled);

    logger.debug({ requestId, userId, disabled: disabledStatus }, '[admin-routes] Updating user status');
    await admin.auth().updateUser(userId, { disabled: disabledStatus });
    
    const userRef = db.collection('users').doc(userId);
    await userRef.update({ disabled: disabledStatus, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

    logger.info({ requestId, userId, disabled: disabledStatus }, '[admin-routes] PUT /users/:userId/toggle - Success');
    res.json({ success: true, userId, disabled: disabledStatus });
  } catch (error) {
    logger.error({ requestId, userId, error: { message: error.message, stack: error.stack } }, '[admin-routes] PUT /users/:userId/toggle - Error');
    next(createError('Failed to toggle user', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Delete user permanently (admin only)
 * DELETE /api/admin/users/:userId
 * This will delete the user from Firebase Auth and all related data from Firestore
 */
router.delete('/users/:userId', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'DELETE /users/:userId');
  const { userId } = req.params;
  logger.info({ 
    requestId, 
    userId,
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid
  }, '[admin-routes] DELETE /users/:userId - Deleting user permanently');
  
  try {
    // Prevent admin from deleting themselves
    if (userId === req.adminUser?.uid) {
      logger.warn({ requestId, userId }, '[admin-routes] Admin attempted to delete themselves');
      return next(createError('You cannot delete your own account', ERROR_CODES.INVALID_INPUT, 400));
    }

    // Get user info before deletion for logging
    let userEmail = 'unknown';
    try {
      const userRecord = await admin.auth().getUser(userId);
      userEmail = userRecord.email || userId;
    } catch (error) {
      logger.warn({ requestId, userId, error: error.message }, '[admin-routes] Could not fetch user record before deletion');
    }

    // Delete from Firebase Auth
    logger.debug({ requestId, userId }, '[admin-routes] Deleting user from Firebase Auth');
    await admin.auth().deleteUser(userId);

    // Delete from Firestore collections
    const batch = db.batch();
    let deletedCount = 0;

    // Delete user document
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      batch.delete(userRef);
      deletedCount++;
    }

    // Delete subscriptions document
    const subscriptionsRef = db.collection('subscriptions').doc(userId);
    const subscriptionsDoc = await subscriptionsRef.get();
    if (subscriptionsDoc.exists) {
      batch.delete(subscriptionsRef);
      deletedCount++;
    }

    // Delete user_credits document
    const userCreditsRef = db.collection('user_credits').doc(userId);
    const userCreditsDoc = await userCreditsRef.get();
    if (userCreditsDoc.exists) {
      batch.delete(userCreditsRef);
      deletedCount++;
    }

    // Delete userTools document
    const userToolsRef = db.collection('userTools').doc(userId);
    const userToolsDoc = await userToolsRef.get();
    if (userToolsDoc.exists) {
      batch.delete(userToolsRef);
      deletedCount++;
    }

    // Commit batch deletions
    if (deletedCount > 0) {
      await batch.commit();
      logger.debug({ requestId, userId, deletedCount }, '[admin-routes] Deleted user documents from Firestore');
    }

    // Helper function to delete documents in batches (Firestore limit is 500 per batch)
    const deleteInBatches = async (docs, collectionName) => {
      const BATCH_SIZE = 500;
      let deletedCount = 0;
      
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const batchDocs = docs.slice(i, i + BATCH_SIZE);
        
        batchDocs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        deletedCount += batchDocs.length;
        logger.debug({ requestId, userId, collectionName, batch: Math.floor(i / BATCH_SIZE) + 1, count: batchDocs.length }, `[admin-routes] Deleted batch of ${collectionName}`);
      }
      
      return deletedCount;
    };

    // Delete all specs by this user
    const specsSnapshot = await db.collection('specs').where('userId', '==', userId).get();
    const deletedSpecsCount = !specsSnapshot.empty ? await deleteInBatches(specsSnapshot.docs, 'specs') : 0;
    if (deletedSpecsCount > 0) {
      logger.debug({ requestId, userId, specsCount: deletedSpecsCount }, '[admin-routes] Deleted all user specs');
    }

    // Delete all apps by this user
    const appsSnapshot = await db.collection('apps').where('userId', '==', userId).get();
    const deletedAppsCount = !appsSnapshot.empty ? await deleteInBatches(appsSnapshot.docs, 'apps') : 0;
    if (deletedAppsCount > 0) {
      logger.debug({ requestId, userId, appsCount: deletedAppsCount }, '[admin-routes] Deleted all user apps');
    }

    // Delete all market research by this user
    const marketResearchSnapshot = await db.collection('marketResearch').where('userId', '==', userId).get();
    const deletedMarketResearchCount = !marketResearchSnapshot.empty ? await deleteInBatches(marketResearchSnapshot.docs, 'marketResearch') : 0;
    if (deletedMarketResearchCount > 0) {
      logger.debug({ requestId, userId, marketResearchCount: deletedMarketResearchCount }, '[admin-routes] Deleted all user market research');
    }

    // Note: We don't delete purchases as they are historical records
    // But we could optionally mark them as deleted or anonymize them

    logger.info({ 
      requestId, 
      userId, 
      userEmail,
      deletedDocuments: deletedCount,
      deletedSpecs: deletedSpecsCount,
      deletedApps: deletedAppsCount,
      deletedMarketResearch: deletedMarketResearchCount
    }, '[admin-routes] DELETE /users/:userId - Success');

    res.json({ 
      success: true, 
      userId,
      userEmail,
      deleted: {
        documents: deletedCount,
        specs: deletedSpecsCount,
        apps: deletedAppsCount,
        marketResearch: deletedMarketResearchCount
      }
    });
  } catch (error) {
    logger.error({ requestId, userId, error: { message: error.message, stack: error.stack } }, '[admin-routes] DELETE /users/:userId - Error');
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/user-not-found') {
      return next(createError('User not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
    }
    
    next(createError('Failed to delete user', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Get errors (admin only)
 * GET /api/admin/errors
 */
router.get('/errors', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'GET /errors');
  logger.info({ 
    requestId, 
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    url: req.url,
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid
  }, '[admin-routes] GET /errors - Route handler called - Fetching error logs');
  
  try {
    const errorsSnapshot = await db.collection('errorLogs')
      .orderBy('lastOccurrence', 'desc')
      .limit(50)
      .get();
    
    const errors = errorsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    logger.info({ requestId, count: errors.length }, '[admin-routes] GET /errors - Success');
    res.json({ success: true, errors });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[admin-routes] GET /errors - Error');
    next(createError('Failed to fetch errors', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Get render logs (admin only)
 * GET /api/admin/render-logs
 * Query params: limit, level, userId, startDate, endDate
 */
router.get('/render-logs', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'GET /render-logs');
  logger.info({ 
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid
  }, '[admin-routes] GET /render-logs - Fetching render logs');
  
  try {
    const limit = parseInt(req.query.limit) || 100;
    const level = req.query.level || null;
    const userId = req.query.userId || null;
    
    // Parse date filters
    let startDate = null;
    let endDate = null;
    if (req.query.startDate) {
      startDate = new Date(req.query.startDate);
    }
    if (req.query.endDate) {
      endDate = new Date(req.query.endDate);
    }
    
    const logs = await getRenderLogs(limit, level, userId, startDate, endDate);
    
    logger.info({ requestId, count: logs.length }, '[admin-routes] GET /render-logs - Success');
    res.json({ 
      success: true, 
      logs,
      total: logs.length
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[admin-routes] GET /render-logs - Error');
    next(createError('Failed to fetch render logs', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Get render logs summary (admin only)
 * GET /api/admin/render-logs/summary
 * Query params: startDate, endDate
 */
router.get('/render-logs/summary', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'GET /render-logs/summary');
  logger.info({ 
    requestId,
    query: req.query,
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid
  }, '[admin-routes] GET /render-logs/summary - Fetching render logs summary');
  
  try {
    let startDate = null;
    let endDate = null;
    if (req.query.startDate) {
      startDate = new Date(req.query.startDate);
    }
    if (req.query.endDate) {
      endDate = new Date(req.query.endDate);
    }
    
    const summary = await getRenderLogsSummary(startDate, endDate);
    
    logger.info({ requestId, summary }, '[admin-routes] GET /render-logs/summary - Success');
    res.json({ 
      success: true, 
      summary
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[admin-routes] GET /render-logs/summary - Error');
    next(createError('Failed to fetch render logs summary', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Get performance metrics (admin only)
 * GET /api/admin/performance
 */
router.get('/performance', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'GET /performance');
  logger.info({ 
    requestId,
    method: req.method,
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    url: req.url,
    query: req.query,
    range: req.query.range,
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid
  }, '[admin-routes] GET /performance - Route handler called - Fetching performance metrics');
  
  try {
    // This is a placeholder - in production you'd track actual metrics
    // For now, return mock data
    const range = req.query.range || 'day';
    
    logger.debug({ requestId, range }, '[admin-routes] Returning performance metrics');
    res.json({
      success: true,
      avgResponseTime: 150, // ms
      errorRate: 0.5, // percentage
      activeConnections: 10,
      uptime: 99.9 // percentage
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[admin-routes] GET /performance - Error');
    next(createError('Failed to fetch performance', ERROR_CODES.INTERNAL_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Get all contact submissions (admin only)
 * GET /api/admin/contact-submissions
 */
router.get('/contact-submissions', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'GET /contact-submissions');
  logger.info({ 
    requestId,
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid
  }, '[admin-routes] GET /contact-submissions - Fetching contact submissions');
  
  try {
    let query = db.collection('contactSubmissions').orderBy('createdAt', 'desc');
    
    // Apply status filter if provided
    if (req.query.status && req.query.status !== 'all') {
      query = query.where('status', '==', req.query.status);
    }
    
    // Limit results
    const limitCount = parseInt(req.query.limit) || 100;
    query = query.limit(limitCount);
    
    const snapshot = await query.get();
    const submissions = snapshot.docs.map(doc => {
      const data = doc.data();
      // Convert Firestore Timestamps to ISO strings
      const result = {
        id: doc.id,
        ...data
      };
      
      // Convert createdAt
      if (data.createdAt && data.createdAt.toDate) {
        result.createdAt = data.createdAt.toDate().toISOString();
      } else if (data.createdAt instanceof Date) {
        result.createdAt = data.createdAt.toISOString();
      } else if (data.timestamp) {
        result.createdAt = new Date(data.timestamp).toISOString();
      }
      
      // Convert updatedAt
      if (data.updatedAt && data.updatedAt.toDate) {
        result.updatedAt = data.updatedAt.toDate().toISOString();
      } else if (data.updatedAt instanceof Date) {
        result.updatedAt = data.updatedAt.toISOString();
      }
      
      return result;
    });
    
    logger.info({ requestId, count: submissions.length }, '[admin-routes] GET /contact-submissions - Success');
    res.json({ success: true, submissions });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[admin-routes] GET /contact-submissions - Error');
    next(createError('Failed to fetch contact submissions', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

/**
 * Update contact submission status (admin only)
 * PUT /api/admin/contact-submissions/:id/status
 */
router.put('/contact-submissions/:id/status', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'PUT /contact-submissions/:id/status');
  const { id } = req.params;
  const { status } = req.body;
  
  logger.info({ 
    requestId,
    id,
    status,
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid
  }, '[admin-routes] PUT /contact-submissions/:id/status - Updating contact submission status');
  
  try {
    const validStatuses = ['new', 'read', 'replied', 'archived'];
    if (!status || !validStatuses.includes(status)) {
      return next(createError('Invalid status', ERROR_CODES.INVALID_INPUT, 400));
    }
    
    const submissionRef = db.collection('contactSubmissions').doc(id);
    await submissionRef.update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    logger.info({ requestId, id, status }, '[admin-routes] PUT /contact-submissions/:id/status - Success');
    res.json({ success: true, id, status });
  } catch (error) {
    logger.error({ requestId, id, error: { message: error.message, stack: error.stack } }, '[admin-routes] PUT /contact-submissions/:id/status - Error');
    next(createError('Failed to update contact submission status', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

/**
 * Sync credits for all users (admin only)
 * POST /api/admin/credits/sync-all
 * This endpoint migrates and syncs credits from old system (entitlements) to new system (user_credits)
 * Processes users in batches to avoid overwhelming the server
 */
router.post('/credits/sync-all', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'POST /credits/sync-all');
  logger.info({ 
    requestId,
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid,
    options: req.body
  }, '[admin-routes] POST /credits/sync-all - Starting credits sync for all users');
  
  try {
    const creditsV3Service = require('./credits-v3-service');
    const { batchSize = 10, startAfter = null, dryRun = false } = req.body || {};
    
    // Validate batch size
    const validBatchSize = Math.min(Math.max(parseInt(batchSize) || 10, 1), 50);
    
    logger.info({ requestId, batchSize: validBatchSize, dryRun }, '[admin-routes] Credits sync parameters');
    
    // Get all users
    let usersQuery = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(validBatchSize);
    
    if (startAfter) {
      const startAfterDoc = await db.collection('users').doc(startAfter).get();
      if (startAfterDoc.exists) {
        usersQuery = usersQuery.startAfter(startAfterDoc);
      }
    }
    
    const usersSnapshot = await usersQuery.get();
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    if (users.length === 0) {
      logger.info({ requestId }, '[admin-routes] No more users to process');
      return res.json({
        success: true,
        processed: 0,
        migrated: 0,
        alreadySynced: 0,
        errors: 0,
        nextBatch: null,
        completed: true,
        message: 'All users processed'
      });
    }
    
    const results = {
      processed: 0,
      migrated: 0,
      alreadySynced: 0,
      errors: 0,
      errorDetails: []
    };
    
    // Process each user
    for (const user of users) {
      try {
        results.processed++;
        
        // Check if user already has credits in V3 system
        const creditsRef = db.collection('user_credits_v3').doc(user.id);
        const creditsDoc = await creditsRef.get();
        
        if (creditsDoc.exists) {
          // Already synced
          results.alreadySynced++;
          logger.debug({ requestId, userId: user.id }, '[admin-routes] User already has credits in V3 system');
        } else {
          // Need to migrate
          if (!dryRun) {
            // Call getUserCredits which will automatically create if needed
            await creditsV3Service.getUserCredits(user.id);
            results.migrated++;
            logger.info({ requestId, userId: user.id }, '[admin-routes] Migrated user credits');
          } else {
            // Dry run - user needs credits initialization
            results.migrated++;
            logger.debug({ requestId, userId: user.id }, '[admin-routes] Would initialize user credits (dry run)');
          }
        }
      } catch (error) {
        results.errors++;
        results.errorDetails.push({
          userId: user.id,
          error: error.message
        });
        logger.error({ requestId, userId: user.id, error: error.message }, '[admin-routes] Error processing user');
      }
    }
    
    // Determine if there are more users to process
    const lastUserId = users[users.length - 1].id;
    const hasMore = users.length === validBatchSize;
    
    logger.info({ 
      requestId, 
      processed: results.processed,
      migrated: results.migrated,
      alreadySynced: results.alreadySynced,
      errors: results.errors,
      hasMore
    }, '[admin-routes] POST /credits/sync-all - Batch completed');
    
    res.json({
      success: true,
      processed: results.processed,
      migrated: results.migrated,
      alreadySynced: results.alreadySynced,
      errors: results.errors,
      errorDetails: results.errorDetails.length > 0 ? results.errorDetails : undefined,
      nextBatch: hasMore ? { startAfter: lastUserId, batchSize: validBatchSize } : null,
      completed: !hasMore,
      dryRun: dryRun,
      message: dryRun 
        ? `Dry run completed. Would migrate ${results.migrated} users.`
        : `Processed ${results.processed} users. Migrated ${results.migrated}, already synced ${results.alreadySynced}.`
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[admin-routes] POST /credits/sync-all - Error');
    next(createError('Failed to sync credits', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Get user analytics (admin only)
 * GET /api/admin/users/:userId/analytics
 */
router.get('/users/:userId/analytics', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'GET /users/:userId/analytics');
  const { userId } = req.params;
  logger.info({ 
    requestId,
    userId,
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid
  }, '[admin-routes] GET /users/:userId/analytics - Fetching user analytics');
  
  try {
    const analytics = await getUserAnalytics(userId);
    
    logger.info({ requestId, userId }, '[admin-routes] GET /users/:userId/analytics - Success');
    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    logger.error({ 
      requestId, 
      userId,
      error: { message: error.message, stack: error.stack } 
    }, '[admin-routes] GET /users/:userId/analytics - Error');
    
    if (error.message === 'User not found') {
      return next(createError('User not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
    }
    
    next(createError('Failed to fetch user analytics', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * Get activity events with pagination and filtering (admin only)
 * GET /api/admin/activity
 * Query params:
 *   - limit: Number of events (default: 50, max: 200)
 *   - startAfter: Document ID for pagination
 *   - type: Filter by type (user, spec, payment, subscription, credit, system)
 *   - category: Filter by category (user, content, payment, system)
 *   - userId: Filter by userId
 *   - searchText: Search in title/description
 *   - startDate: ISO date string - filter events after this date
 *   - endDate: ISO date string - filter events before this date
 */
router.get('/activity', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'GET /activity');
  logger.info({ 
    requestId,
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid,
    query: req.query
  }, '[admin-routes] GET /activity - Fetching activity events');
  
  try {
    const {
      limit,
      startAfter,
      type,
      category,
      userId,
      searchText,
      startDate,
      endDate
    } = req.query;
    
    // Parse dates if provided
    let parsedStartDate = null;
    let parsedEndDate = null;
    
    if (startDate) {
      parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) {
        return next(createError('Invalid startDate format. Use ISO 8601 format.', ERROR_CODES.INVALID_INPUT, 400));
      }
    }
    
    if (endDate) {
      parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        return next(createError('Invalid endDate format. Use ISO 8601 format.', ERROR_CODES.INVALID_INPUT, 400));
      }
    }
    
    const result = await getActivityEvents({
      limit: limit ? parseInt(limit) : undefined,
      startAfter: startAfter || undefined,
      type: type || undefined,
      category: category || undefined,
      userId: userId || undefined,
      searchText: searchText || undefined,
      startDate: parsedStartDate,
      endDate: parsedEndDate
    });
    
    logger.info({ 
      requestId, 
      count: result.events.length,
      hasMore: result.hasMore
    }, '[admin-routes] GET /activity - Success');
    
    res.json({
      success: true,
      events: result.events,
      hasMore: result.hasMore,
      lastDocId: result.lastDocId,
      count: result.events.length
    });
  } catch (error) {
    logger.error({ 
      requestId, 
      error: { message: error.message, stack: error.stack } 
    }, '[admin-routes] GET /activity - Error');
    next(createError('Failed to fetch activity events', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

/**
 * Refresh user subscription data from Lemon Squeezy API
 * POST /api/admin/users/:userId/refresh-subscription
 */
router.post('/users/:userId/refresh-subscription', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'POST /users/:userId/refresh-subscription');
  const { userId } = req.params;
  logger.info({ 
    requestId,
    userId,
    adminEmail: req.adminUser?.email,
    adminUserId: req.adminUser?.uid
  }, '[admin-routes] POST /users/:userId/refresh-subscription - Refreshing subscription data from Lemon Squeezy');
  
  try {
    // Get Lemon Squeezy API credentials
    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
    const storeId = process.env.LEMON_SQUEEZY_STORE_ID;
    
    if (!apiKey) {
      return next(createError('Lemon Squeezy API key not configured', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500));
    }
    
    const fetch = globalThis.fetch || require('node-fetch');
    
    // Step 1: Get existing subscription ID from Firebase (prioritize subscriptions_v3 over user_credits_v3)
    // CRITICAL: Get subscription ID from webhookRequestId (format: "webhook_1728411")
    let lemonSubscriptionId = null;
    const subscriptionsV3Doc = await db.collection('subscriptions_v3').doc(userId).get();
    
    if (subscriptionsV3Doc.exists) {
      const subscriptionsV3Data = subscriptionsV3Doc.data();
      
      // Get subscription ID from webhookRequestId (format: "webhook_1728411")
      if (subscriptionsV3Data?.webhookRequestId && typeof subscriptionsV3Data.webhookRequestId === 'string') {
        if (subscriptionsV3Data.webhookRequestId.startsWith('webhook_')) {
          const extractedId = subscriptionsV3Data.webhookRequestId.replace(/^webhook_/, '');
          if (/^\d+$/.test(extractedId)) {
            lemonSubscriptionId = extractedId;
            logger.info({ 
              requestId, 
              userId, 
              subscriptionId: lemonSubscriptionId, 
              source: 'subscriptions_v3.webhookRequestId',
              webhookRequestId: subscriptionsV3Data.webhookRequestId
            }, '[admin-routes] Found subscription ID from webhookRequestId in subscriptions_v3');
          }
        }
      }
    }
    
    // Fallback to user_credits_v3 if not found
    if (!lemonSubscriptionId) {
      const creditsV3Doc = await db.collection('user_credits_v3').doc(userId).get();
      if (creditsV3Doc.exists) {
        const creditsV3Data = creditsV3Doc.data();
        lemonSubscriptionId = creditsV3Data?.subscription?.lemonSubscriptionId || null;
        logger.info({ requestId, userId, subscriptionId: lemonSubscriptionId, source: 'user_credits_v3' }, '[admin-routes] Found subscription ID in user_credits_v3');
      }
    }
    
    // If no subscription ID found, user doesn't have a Lemon subscription
    if (!lemonSubscriptionId) {
      return next(createError(
        'No subscription ID found for this user. This endpoint only works for users with existing Lemon Squeezy subscriptions.',
        ERROR_CODES.RESOURCE_NOT_FOUND,
        404
      ));
    }
    
    // Step 2: Fetch full subscription data from Lemon API with include=order
    logger.info({ requestId, userId, subscriptionId: lemonSubscriptionId }, '[admin-routes] Fetching subscription data from Lemon Squeezy API');
    
    const subscriptionResult = await fetchSubscriptionById({
      fetch,
      apiKey,
      subscriptionId: lemonSubscriptionId,
      storeId: storeId ? storeId.toString() : null,
      logger,
      requestId
    });
    
    // Check if result is an error object
    if (subscriptionResult && subscriptionResult.error) {
      const errorDetails = subscriptionResult.error;
      logger.error({ 
        requestId, 
        userId, 
        subscriptionId: lemonSubscriptionId,
        lemonError: errorDetails 
      }, '[admin-routes] Lemon API returned error');
      
      const errorMessage = errorDetails.body?.errors?.[0]?.detail || 
                           errorDetails.body?.errors?.[0]?.title || 
                           errorDetails.message ||
                           `Lemon Squeezy API returned ${errorDetails.status || 'error'}`;
      
      // If 404, provide more helpful message
      if (errorDetails.status === 404) {
        return next(createError(
          `Subscription ID ${lemonSubscriptionId} not found in Lemon Squeezy. The subscription may have been deleted, or the ID may be incorrect. Please verify the subscription ID in your Lemon Squeezy dashboard.`,
          ERROR_CODES.RESOURCE_NOT_FOUND,
          404,
          { 
            lemonApiError: errorDetails,
            subscriptionId: lemonSubscriptionId,
            hint: 'The subscription ID exists in your database but not in Lemon Squeezy. This could mean the subscription was deleted or the ID is incorrect.'
          }
        ));
      }
      
      return next(createError(
        `Failed to fetch subscription from Lemon Squeezy: ${errorMessage}`,
        ERROR_CODES.EXTERNAL_SERVICE_ERROR,
        errorDetails.status || 500,
        { lemonApiError: errorDetails }
      ));
    }
    
    if (!subscriptionResult) {
      return next(createError(
        `Subscription ${lemonSubscriptionId} not found in Lemon Squeezy. It may have been deleted or the subscription ID is incorrect.`,
        ERROR_CODES.RESOURCE_NOT_FOUND,
        404
      ));
    }
    
    const subscriptionRecord = subscriptionResult;
    
    // Step 3: Extract all data from subscription record using buildSubscriptionUpdateFromRecord
    const existingSubscriptionData = subscriptionsV3Doc.exists ? subscriptionsV3Doc.data() : {};
    const builtData = buildSubscriptionUpdateFromRecord(subscriptionRecord, existingSubscriptionData, admin);
    
    if (!builtData || !builtData.update) {
      return next(createError('Failed to parse subscription data from Lemon Squeezy', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500));
    }
    
    const attributes = builtData.attributes || {};
    const variantId = builtData.update.variant_id || existingSubscriptionData?.variant_id || null;
    const productId = builtData.update.product_id || existingSubscriptionData?.product_id || null;
    
    // Get product key from variant ID
    const productKey = variantId ? getProductKeyByVariantId(variantId.toString()) : null;
    const productConfig = productKey ? getProductByKey(productKey) : null;
    
    // Use product_name from API if available, otherwise from config
    const productName = builtData.update.product_name || 
                        productConfig?.name || 
                        existingSubscriptionData?.product_name || null;
    
    // Use variant_name from API if available
    const variantName = builtData.update.variant_name || null;
    
    // Use billing_interval from config or existing data
    const billingInterval = productConfig?.billing_interval || existingSubscriptionData?.billing_interval || null;
    
    // Extract currency from order if available (via relationships)
    let currency = existingSubscriptionData?.currency || 'USD';
    const orderId = builtData.orderId || builtData.update.last_order_id || null;
    
    // Step 4: Update subscriptions_v3 with ALL missing fields
    const subscriptionsV3Ref = db.collection('subscriptions_v3').doc(userId);
    const subscriptionUpdate = {
      ...builtData.update,
      product_key: productKey || existingSubscriptionData?.product_key || null,
      product_name: productName || builtData.update.product_name || existingSubscriptionData?.product_name || null,
      variant_name: variantName || builtData.update.variant_name || existingSubscriptionData?.variant_name || null,
      billing_interval: billingInterval || existingSubscriptionData?.billing_interval || null,
      currency: currency, // Preserve existing or use default
      last_synced_at: admin.firestore.FieldValue.serverTimestamp(),
      last_synced_source: 'admin_refresh',
      last_synced_mode: 'live',
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await subscriptionsV3Ref.set(subscriptionUpdate, { merge: true });
    
    // Step 5: Update user_credits_v3.subscription with renewsAt, endsAt, cancelAtPeriodEnd
    const creditsV3Ref = db.collection('user_credits_v3').doc(userId);
    const creditsV3Doc = await creditsV3Ref.get();
    
    if (creditsV3Doc.exists) {
      const currentCreditsData = creditsV3Doc.data();
      const currentSubscription = currentCreditsData?.subscription || {};
      
      const creditsSubscriptionUpdate = {
        'subscription.renewsAt': builtData.update.renews_at || null,
        'subscription.endsAt': builtData.update.ends_at || null,
        'subscription.cancelAtPeriodEnd': builtData.update.cancel_at_period_end || false,
        'subscription.status': builtData.status || currentSubscription.status || 'active',
        'subscription.lemonSubscriptionId': lemonSubscriptionId,
        'subscription.lastSyncedAt': admin.firestore.FieldValue.serverTimestamp()
      };
      
      // Preserve product info if missing
      if (!currentSubscription.productKey && productKey) {
        creditsSubscriptionUpdate['subscription.productKey'] = productKey;
      }
      // Use product_name from API if available
      const finalProductName = productName || builtData.update.product_name || currentSubscription.productName;
      if (!currentSubscription.productName && finalProductName) {
        creditsSubscriptionUpdate['subscription.productName'] = finalProductName;
      }
      if (!currentSubscription.billingInterval && billingInterval) {
        creditsSubscriptionUpdate['subscription.billingInterval'] = billingInterval;
      }
      
      await creditsV3Ref.update(creditsSubscriptionUpdate);
    }
    
    // Step 6: Update users collection with lemon_customer_id if missing
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      const customerId = builtData.customerId || null;
      
      if (customerId && !userData.lemon_customer_id) {
        await userRef.update({
          lemon_customer_id: customerId
        });
        logger.info({ requestId, userId, customerId }, '[admin-routes] Updated users.lemon_customer_id');
      }
    }
    
    logger.info({ 
      requestId, 
      userId,
      lemonSubscriptionId,
      productKey,
      productName,
      billingInterval,
      renewsAt: builtData.update.renews_at,
      endsAt: builtData.update.ends_at,
      cancelAtPeriodEnd: builtData.update.cancel_at_period_end,
      customerId: builtData.customerId,
      orderId: orderId
    }, '[admin-routes] POST /users/:userId/refresh-subscription - Success');
    
    res.json({
      success: true,
      message: 'Subscription data refreshed successfully from Lemon Squeezy',
      data: {
        lemonSubscriptionId,
        productKey,
        productName,
        billingInterval,
        status: builtData.status,
        renewsAt: builtData.update.renews_at,
        endsAt: builtData.update.ends_at,
        cancelAtPeriodEnd: builtData.update.cancel_at_period_end,
        customerId: builtData.customerId,
        orderId: orderId,
        storeId: builtData.update.store_id,
        currency: currency
      }
    });
  } catch (error) {
    logger.error({ 
      requestId, 
      userId,
      error: { message: error.message, stack: error.stack } 
    }, '[admin-routes] POST /users/:userId/refresh-subscription - Error');
    
    next(createError('Failed to refresh subscription data', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * GET /api/admin/payments/summary
 * Get payments summary statistics
 */
router.get('/payments/summary', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'GET /payments/summary');
  logger.info({ requestId, adminEmail: req.adminUser?.email }, '[admin-routes] GET /payments/summary');

  try {
    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
    const storeId = process.env.LEMON_SQUEEZY_STORE_ID;

    if (!apiKey || !storeId) {
      return next(createError('Lemon Squeezy API key or store ID not configured', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500));
    }

    const summary = await getPaymentsSummary({ apiKey, storeId, logger, requestId });

    if (!summary) {
      return next(createError('Failed to get payments summary', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500));
    }

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[admin-routes] GET /payments/summary - Error');
    next(createError('Failed to get payments summary', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * GET /api/admin/payments/orders
 * Get cached orders data
 */
router.get('/payments/orders', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'GET /payments/orders');
  const { status, refunded, dateFrom, dateTo, limit = 100 } = req.query;

  logger.info({ requestId, status, refunded, dateFrom, dateTo, limit }, '[admin-routes] GET /payments/orders');

  try {
    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
    const storeId = process.env.LEMON_SQUEEZY_STORE_ID;

    if (!apiKey || !storeId) {
      return next(createError('Lemon Squeezy API key or store ID not configured', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500));
    }

    const cacheData = await getCachedPaymentsData({ apiKey, storeId, logger, requestId });

    if (!cacheData || !cacheData.orders) {
      return res.json({
        success: true,
        data: {
          orders: [],
          total: 0
        }
      });
    }

    let orders = [...cacheData.orders];

    // Apply filters
    if (status) {
      orders = orders.filter(order => order.status === status);
    }

    if (refunded === 'true') {
      orders = orders.filter(order => order.refunded);
    } else if (refunded === 'false') {
      orders = orders.filter(order => !order.refunded);
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      orders = orders.filter(order => {
        if (!order.createdAt) return false;
        return new Date(order.createdAt) >= fromDate;
      });
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      orders = orders.filter(order => {
        if (!order.createdAt) return false;
        return new Date(order.createdAt) <= toDate;
      });
    }

    // Sort by date (newest first)
    orders.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });

    // Limit
    const limitedOrders = orders.slice(0, parseInt(limit, 10));

    res.json({
      success: true,
      data: {
        orders: limitedOrders,
        total: orders.length,
        filtered: limitedOrders.length
      }
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[admin-routes] GET /payments/orders - Error');
    next(createError('Failed to get orders', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * GET /api/admin/payments/customers
 * Get cached customers data
 */
router.get('/payments/customers', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'GET /payments/customers');
  const { search, limit = 100 } = req.query;

  logger.info({ requestId, search, limit }, '[admin-routes] GET /payments/customers');

  try {
    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
    const storeId = process.env.LEMON_SQUEEZY_STORE_ID;

    if (!apiKey || !storeId) {
      return next(createError('Lemon Squeezy API key or store ID not configured', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500));
    }

    const cacheData = await getCachedPaymentsData({ apiKey, storeId, logger, requestId });

    if (!cacheData || !cacheData.customers) {
      return res.json({
        success: true,
        data: {
          customers: [],
          total: 0
        }
      });
    }

    let customers = [...cacheData.customers];

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      customers = customers.filter(customer => 
        customer.email?.toLowerCase().includes(searchLower) ||
        customer.name?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by total spent (highest first)
    customers.sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));

    // Limit
    const limitedCustomers = customers.slice(0, parseInt(limit, 10));

    res.json({
      success: true,
      data: {
        customers: limitedCustomers,
        total: customers.length,
        filtered: limitedCustomers.length
      }
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[admin-routes] GET /payments/customers - Error');
    next(createError('Failed to get customers', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * GET /api/admin/payments/errors
 * Get errors: cancelled subscriptions, refunded orders, past_due, etc.
 */
router.get('/payments/errors', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'GET /payments/errors');
  const { type } = req.query; // cancelled, refunded, past_due, expired

  logger.info({ requestId, type }, '[admin-routes] GET /payments/errors');

  try {
    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
    const storeId = process.env.LEMON_SQUEEZY_STORE_ID;

    if (!apiKey || !storeId) {
      return next(createError('Lemon Squeezy API key or store ID not configured', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500));
    }

    const cacheData = await getCachedPaymentsData({ apiKey, storeId, logger, requestId });

    if (!cacheData) {
      return res.json({
        success: true,
        data: {
          errors: {
            cancelled: [],
            refunded: [],
            pastDue: [],
            expired: []
          },
          total: 0
        }
      });
    }

    const errors = {
      cancelled: (cacheData.subscriptions || []).filter(sub => 
        sub.status === 'cancelled' || sub.cancelled
      ),
      refunded: (cacheData.orders || []).filter(order => order.refunded),
      pastDue: (cacheData.subscriptions || []).filter(sub => 
        sub.status === 'past_due'
      ),
      expired: (cacheData.subscriptions || []).filter(sub => 
        sub.status === 'expired'
      )
    };

    // Filter by type if specified
    let filteredErrors = [];
    if (type === 'cancelled') {
      filteredErrors = errors.cancelled;
    } else if (type === 'refunded') {
      filteredErrors = errors.refunded;
    } else if (type === 'past_due') {
      filteredErrors = errors.pastDue;
    } else if (type === 'expired') {
      filteredErrors = errors.expired;
    } else {
      // Return all errors combined
      filteredErrors = [
        ...errors.cancelled.map(sub => ({ ...sub, errorType: 'cancelled' })),
        ...errors.refunded.map(order => ({ ...order, errorType: 'refunded' })),
        ...errors.pastDue.map(sub => ({ ...sub, errorType: 'past_due' })),
        ...errors.expired.map(sub => ({ ...sub, errorType: 'expired' }))
      ];
    }

    // Sort by date (newest first)
    filteredErrors.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(a.endsAt || 0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(b.endsAt || 0);
      return dateB - dateA;
    });

    res.json({
      success: true,
      data: {
        errors: type ? filteredErrors : {
          cancelled: errors.cancelled,
          refunded: errors.refunded,
          pastDue: errors.pastDue,
          expired: errors.expired
        },
        total: filteredErrors.length,
        counts: {
          cancelled: errors.cancelled.length,
          refunded: errors.refunded.length,
          pastDue: errors.pastDue.length,
          expired: errors.expired.length
        }
      }
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[admin-routes] GET /payments/errors - Error');
    next(createError('Failed to get errors', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * GET /api/admin/payments/new-subscribers
 * Get new subscribers (users who purchased subscription in last 30 days)
 */
router.get('/payments/new-subscribers', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'GET /payments/new-subscribers');
  const { days = 30, limit = 100 } = req.query;

  logger.info({ requestId, days, limit }, '[admin-routes] GET /payments/new-subscribers');

  try {
    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
    const storeId = process.env.LEMON_SQUEEZY_STORE_ID;

    if (!apiKey || !storeId) {
      return next(createError('Lemon Squeezy API key or store ID not configured', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500));
    }

    const cacheData = await getCachedPaymentsData({ apiKey, storeId, logger, requestId });

    if (!cacheData || !cacheData.subscriptions) {
      return res.json({
        success: true,
        data: {
          subscribers: [],
          total: 0
        }
      });
    }

    const now = new Date();
    const daysAgo = new Date(now.getTime() - parseInt(days, 10) * 24 * 60 * 60 * 1000);

    // Filter subscriptions created in last N days
    const newSubscribers = (cacheData.subscriptions || []).filter(sub => {
      if (!sub.createdAt) return false;
      const subDate = new Date(sub.createdAt);
      return subDate >= daysAgo;
    });

    // Sort by date (newest first)
    newSubscribers.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });

    // Limit
    const limitedSubscribers = newSubscribers.slice(0, parseInt(limit, 10));

    // Match with customers and orders for full details
    const subscribersWithDetails = limitedSubscribers.map(sub => {
      const customer = (cacheData.customers || []).find(c => c.id === sub.customerId);
      const order = (cacheData.orders || []).find(o => o.id === sub.orderId);

      return {
        ...sub,
        customer: customer ? {
          email: customer.email,
          name: customer.name,
          totalSpent: customer.totalSpent,
          totalOrders: customer.totalOrders
        } : null,
        order: order ? {
          total: order.total,
          currency: order.currency,
          orderNumber: order.orderNumber
        } : null
      };
    });

    res.json({
      success: true,
      data: {
        subscribers: subscribersWithDetails,
        total: newSubscribers.length,
        filtered: limitedSubscribers.length
      }
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[admin-routes] GET /payments/new-subscribers - Error');
    next(createError('Failed to get new subscribers', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * POST /api/admin/payments/sync
 * Manually trigger payments data sync
 */
router.post('/payments/sync', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'POST /payments/sync');
  logger.info({ requestId, adminEmail: req.adminUser?.email }, '[admin-routes] POST /payments/sync - Manual sync triggered');

  try {
    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
    const storeId = process.env.LEMON_SQUEEZY_STORE_ID;

    if (!apiKey || !storeId) {
      return next(createError('Lemon Squeezy API key or store ID not configured', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500));
    }

    // Trigger sync
    const cacheData = await syncPaymentsData({ apiKey, storeId, logger, requestId });

    logger.info({ 
      requestId,
      orders: cacheData?.orders?.length || 0,
      customers: cacheData?.customers?.length || 0,
      subscriptions: cacheData?.subscriptions?.length || 0
    }, '[admin-routes] POST /payments/sync - Sync completed');

    res.json({
      success: true,
      message: 'Payments data synced successfully',
      data: {
        orders: cacheData?.orders?.length || 0,
        customers: cacheData?.customers?.length || 0,
        subscriptions: cacheData?.subscriptions?.length || 0,
        invoices: cacheData?.invoices?.length || 0,
        lastSynced: cacheData?.last_synced_at,
        stats: cacheData?.stats
      }
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[admin-routes] POST /payments/sync - Error');
    next(createError('Failed to sync payments data', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * GET /api/admin/analytics/email
 * Get email analytics statistics
 */
router.get('/analytics/email', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'GET /analytics/email');
  
  try {
    const { emailType, linkType, startDate, endDate, days } = req.query;
    
    const filters = {};
    if (emailType) filters.emailType = emailType;
    if (linkType) filters.linkType = linkType;
    
    // Date range handling
    if (days) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(days, 10));
      filters.startDate = daysAgo.toISOString();
    } else {
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
    }
    
    const [clickStats, sentStats] = await Promise.all([
      emailTracking.getEmailClickStats(filters),
      emailTracking.getEmailSentStats(filters)
    ]);
    
    logger.info({ requestId, filters, clicksTotal: clickStats.total, sentTotal: sentStats.total }, '[admin-routes] Email analytics retrieved');
    
    // Calculate click rate based on emails sent (not clicks)
    const clickRate = sentStats.total > 0 ? ((clickStats.total / sentStats.total) * 100).toFixed(2) : 0;
    
    res.json({
      success: true,
      filters,
      stats: {
        clicks: {
          ...clickStats,
          clickRate: parseFloat(clickRate)
        },
        sent: {
          ...sentStats
        },
        totalEmailsSent: sentStats.total,
        totalClicks: clickStats.total,
        clickRate: parseFloat(clickRate)
      }
    });
  } catch (error) {
    logger.error({ requestId, error: error.message }, '[admin-routes] Failed to get email analytics');
    next(createError('Failed to get email analytics', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * GET /api/admin/users/:userId/emails
 * Get email history and clicks for a specific user
 */
router.get('/users/:userId/emails', requireAdmin, async (req, res, next) => {
  const requestId = logRouteCall(req, 'GET /users/:userId/emails');
  const { userId } = req.params;
  
  try {
    // Get email click journey
    const journey = await emailTracking.getUserEmailJourney(userId);
    
    // Get user email preferences
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    
    // Calculate stats
    const totalClicks = journey.length;
    const uniqueEmailTypes = new Set(journey.map(e => e.emailType));
    const lastClick = journey.length > 0 ? journey[0].clickedAt : null;
    
    // Get clicks by email type
    const clicksByType = {};
    journey.forEach(click => {
      const type = click.emailType || 'unknown';
      clicksByType[type] = (clicksByType[type] || 0) + 1;
    });
    
    logger.info({ requestId, userId, totalClicks }, '[admin-routes] User email history retrieved');
    
    res.json({
      success: true,
      userId,
      emailPreferences: userData.emailPreferences || {
        newsletter: true,
        updates: true,
        specNotifications: true,
        marketing: true
      },
      stats: {
        totalClicks,
        uniqueEmailTypes: uniqueEmailTypes.size,
        lastClick,
        clicksByType
      },
      journey: journey
    });
  } catch (error) {
    logger.error({ requestId, userId, error: error.message }, '[admin-routes] Failed to get user email history');
    next(createError('Failed to get user email history', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

// Debug: Log all registered routes (must be after all route definitions)
logger.info('[admin-routes] Admin routes initialized. Registered routes:');
router.stack.forEach((layer) => {
  if (layer.route) {
    const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
    logger.info(`[admin-routes]   ${methods} ${layer.route.path}`);
  }
});

module.exports = router;

