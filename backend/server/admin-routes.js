const express = require('express');
const router = express.Router();
const { requireAdmin } = require('./security');
const { db, admin } = require('./firebase-admin');
const { syncAllUsers, getLastUserSyncReport } = require('./user-management');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');

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
      ensureEntitlements: options.ensureEntitlements !== false,
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
      ensureEntitlements: false,
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

    const { grantCredits } = require('./credits-service');
    logger.debug({ requestId, userId, amount, reason }, '[admin-routes] Granting credits');
    const result = await grantCredits(userId, amount, 'admin', { reason: reason || 'Admin manual grant' });

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

    // Update entitlements if switching to pro
    if (plan === 'pro') {
      logger.debug({ requestId, userId }, '[admin-routes] Updating entitlements for pro plan');
      const entitlementsRef = db.collection('entitlements').doc(userId);
      await entitlementsRef.set({
        userId,
        unlimited: true,
        can_edit: true,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
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
    const submissions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
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

// Debug: Log all registered routes
logger.info('[admin-routes] Admin routes initialized. Registered routes:');
router.stack.forEach((layer) => {
  if (layer.route) {
    const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
    logger.info(`[admin-routes]   ${methods} ${layer.route.path}`);
  }
});

module.exports = router;

