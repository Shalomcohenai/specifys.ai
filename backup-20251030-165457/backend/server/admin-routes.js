const express = require('express');
const router = express.Router();
const { requireAdmin } = require('./security');
const { db, admin } = require('./firebase-admin');

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
    console.error('Admin verification error:', error);
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
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
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
    console.error('Error fetching specs:', error);
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
    console.error('Error fetching market research:', error);
    res.status(500).json({ error: 'Failed to fetch market research' });
  }
});

module.exports = router;

