const express = require('express');
const router = express.Router();
const { requireAdmin } = require('./security');
const { db, admin } = require('./firebase-admin');
const { syncAllUsers, getLastUserSyncReport } = require('./user-management');

/**
 * Verify user has admin access
 * GET /api/admin/verify
 */
router.get('/verify', requireAdmin, async (req, res) => {
  try {
    res.json({ 
      success: true, 
      email: req.adminUser.email,
      uid: req.adminUser.uid 
    });
  } catch (error) {

    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get all users (admin only)
 * GET /api/admin/users
 */
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json({ success: true, users });
  } catch (error) {

    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * Trigger a full user sync (admin only)
 * POST /api/admin/users/sync
 */
router.post('/users/sync', requireAdmin, async (req, res) => {
  try {
    const options = req.body && typeof req.body === 'object' ? req.body : {};
    const summary = await syncAllUsers({
      ensureEntitlements: options.ensureEntitlements !== false,
      includeDataCollections: options.includeDataCollections !== false,
      dryRun: false,
      recordResult: true
    });

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('[admin/users/sync] Failed to sync users', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync users',
      details: error.message
    });
  }
});

/**
 * Get latest sync summary (admin only)
 * GET /api/admin/users/sync-status
 */
router.get('/users/sync-status', requireAdmin, async (req, res) => {
  try {
    const cached = getLastUserSyncReport();
    if (cached) {
      return res.json({ success: true, summary: cached, cached: true });
    }

    const includeDataCollections = req.query.includeDataCollections !== 'false';
    const preview = await syncAllUsers({
      ensureEntitlements: false,
      includeDataCollections,
      dryRun: true,
      recordResult: false
    });

    res.json({
      success: true,
      summary: preview,
      cached: false
    });
  } catch (error) {
    console.error('[admin/users/sync-status] Failed to compute sync status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compute sync status',
      details: error.message
    });
  }
});

/**
 * Get all specs (admin only)
 * GET /api/admin/specs
 */
router.get('/specs', requireAdmin, async (req, res) => {
  try {
    const specsSnapshot = await db.collection('specs').get();
    const specs = specsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json({ success: true, specs });
  } catch (error) {

    res.status(500).json({ error: 'Failed to fetch specs' });
  }
});

/**
 * Get all market research (admin only)
 * GET /api/admin/market-research
 */
router.get('/market-research', requireAdmin, async (req, res) => {
  try {
    const researchSnapshot = await db.collection('marketResearch').get();
    const research = researchSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json({ success: true, research });
  } catch (error) {

    res.status(500).json({ error: 'Failed to fetch market research' });
  }
});

/**
 * Add credits to a user (admin only)
 * POST /api/admin/users/:userId/credits
 */
router.post('/users/:userId/credits', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, reason } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const { grantCredits } = require('./credits-service');
    const result = await grantCredits(userId, amount, 'admin', { reason: reason || 'Admin manual grant' });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[admin/users/credits] Failed to add credits', error);
    res.status(500).json({ error: 'Failed to add credits', details: error.message });
  }
});

/**
 * Change user plan (admin only)
 * PUT /api/admin/users/:userId/plan
 */
router.put('/users/:userId/plan', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { plan } = req.body;

    if (!plan || !['free', 'pro'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Must be "free" or "pro"' });
    }

    const userRef = db.collection('users').doc(userId);
    await userRef.update({ plan, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

    // Update entitlements if switching to pro
    if (plan === 'pro') {
      const entitlementsRef = db.collection('entitlements').doc(userId);
      await entitlementsRef.set({
        userId,
        unlimited: true,
        can_edit: true,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    res.json({ success: true, userId, plan });
  } catch (error) {
    console.error('[admin/users/plan] Failed to change plan', error);
    res.status(500).json({ error: 'Failed to change plan', details: error.message });
  }
});

/**
 * Reset user password (admin only)
 * POST /api/admin/users/:userId/reset-password
 */
router.post('/users/:userId/reset-password', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const userRecord = await admin.auth().getUser(userId);
    if (!userRecord.email) {
      return res.status(400).json({ error: 'User has no email address' });
    }

    const link = await admin.auth().generatePasswordResetLink(userRecord.email);
    
    res.json({ success: true, resetLink: link });
  } catch (error) {
    console.error('[admin/users/reset-password] Failed to reset password', error);
    res.status(500).json({ error: 'Failed to reset password', details: error.message });
  }
});

/**
 * Toggle user disabled status (admin only)
 * PUT /api/admin/users/:userId/toggle
 */
router.put('/users/:userId/toggle', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { disabled } = req.body;

    await admin.auth().updateUser(userId, { disabled: Boolean(disabled) });
    
    const userRef = db.collection('users').doc(userId);
    await userRef.update({ disabled: Boolean(disabled), updatedAt: admin.firestore.FieldValue.serverTimestamp() });

    res.json({ success: true, userId, disabled: Boolean(disabled) });
  } catch (error) {
    console.error('[admin/users/toggle] Failed to toggle user', error);
    res.status(500).json({ error: 'Failed to toggle user', details: error.message });
  }
});

/**
 * Get errors (admin only)
 * GET /api/admin/errors
 */
router.get('/errors', requireAdmin, async (req, res) => {
  try {
    const errorsSnapshot = await db.collection('errorLogs')
      .orderBy('lastOccurrence', 'desc')
      .limit(50)
      .get();
    
    const errors = errorsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json({ success: true, errors });
  } catch (error) {
    console.error('[admin/errors] Failed to fetch errors', error);
    res.status(500).json({ error: 'Failed to fetch errors', details: error.message });
  }
});

/**
 * Get performance metrics (admin only)
 * GET /api/admin/performance
 */
router.get('/performance', requireAdmin, async (req, res) => {
  try {
    // This is a placeholder - in production you'd track actual metrics
    // For now, return mock data
    const range = req.query.range || 'day';
    
    res.json({
      success: true,
      avgResponseTime: 150, // ms
      errorRate: 0.5, // percentage
      activeConnections: 10,
      uptime: 99.9 // percentage
    });
  } catch (error) {
    console.error('[admin/performance] Failed to fetch performance', error);
    res.status(500).json({ error: 'Failed to fetch performance', details: error.message });
  }
});

module.exports = router;

