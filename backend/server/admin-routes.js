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

module.exports = router;

