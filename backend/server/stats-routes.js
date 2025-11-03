const express = require('express');
const router = express.Router();
const { db, admin, auth } = require('./firebase-admin');

/**
 * Middleware to verify admin permissions
 */
async function verifyAdminToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No valid authorization header' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // Check if user is admin
    const adminEmails = ['specifysai@gmail.com', 'admin@specifys.ai', 'shalom@specifys.ai'];
    if (!adminEmails.includes(decodedToken.email)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    req.user = decodedToken;
    next();
  } catch (error) {

    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Update public stats with current counts
 * POST /api/stats/update
 */
router.post('/update', verifyAdminToken, async (req, res) => {
  try {
    // Count specs
    const specsSnapshot = await db.collection('specs').get();
    const specsCount = specsSnapshot.size;
    
    // Update public stats document
    await db.collection('public_stats').doc('counts').set({
      specsCount: specsCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({
      success: true,
      stats: {
        specsCount: specsCount
      }
    });
    
  } catch (error) {

    res.status(500).json({ 
      error: 'Failed to update stats',
      details: error.message 
    });
  }
});

/**
 * Get current public stats (public endpoint)
 * GET /api/stats
 */
router.get('/', async (req, res) => {
  try {
    const statsDoc = await db.collection('public_stats').doc('counts').get();
    
    if (!statsDoc.exists) {
      return res.json({
        specsCount: 4590 // Default value
      });
    }
    
    res.json(statsDoc.data());
    
  } catch (error) {

    res.status(500).json({ 
      error: 'Failed to get stats',
      details: error.message 
    });
  }
});

module.exports = router;

