/**
 * Health Check Routes
 * 
 * Provides health monitoring endpoints for the credits system
 */

const express = require('express');
const router = express.Router();
const { db } = require('./firebase-admin');

/**
 * General health check
 * GET /api/health
 */
router.get('/', async (req, res) => {
    try {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'Specifys.AI Backend',
            version: '1.0.0'
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

/**
 * Credits system health check
 * GET /api/health/credits
 */
router.get('/credits', async (req, res) => {
    try {
        // Count users by type
        const proUsersSnapshot = await db.collection('entitlements')
            .where('unlimited', '==', true)
            .count()
            .get();
        
        const creditUsersSnapshot = await db.collection('entitlements')
            .where('spec_credits', '>', 0)
            .count()
            .get();
        
        // Get total users
        const totalUsersSnapshot = await db.collection('users').count().get();
        
        // Get active subscriptions
        const activeSubsSnapshot = await db.collection('subscriptions')
            .where('status', '==', 'active')
            .count()
            .get();
        
        const proUsers = proUsersSnapshot.data().count;
        const creditUsers = creditUsersSnapshot.data().count;
        const totalUsers = totalUsersSnapshot.data().count;
        const activeSubs = activeSubsSnapshot.data().count;
        
        // Calculate percentages
        const proPercentage = totalUsers > 0 ? ((proUsers / totalUsers) * 100).toFixed(2) : 0;
        const creditPercentage = totalUsers > 0 ? ((creditUsers / totalUsers) * 100).toFixed(2) : 0;
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            stats: {
                totalUsers,
                proUsers,
                creditUsers,
                freeUsers: totalUsers - proUsers - creditUsers,
                activeSubscriptions: activeSubs
            },
            percentages: {
                pro: `${proPercentage}%`,
                credit: `${creditPercentage}%`,
                free: `${(100 - parseFloat(proPercentage) - parseFloat(creditPercentage)).toFixed(2)}%`
            }
        });
        
    } catch (error) {
        console.error('[Health Check] Error checking credits system:', error);
        res.status(500).json({ 
            status: 'unhealthy', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Database connectivity check
 * GET /api/health/database
 */
router.get('/database', async (req, res) => {
    try {
        // Simple database read to check connectivity
        await db.collection('users').limit(1).get();
        
        res.json({
            status: 'healthy',
            database: 'Firestore',
            connected: true,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('[Health Check] Database error:', error);
        res.status(500).json({
            status: 'unhealthy',
            database: 'Firestore',
            connected: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Recent errors check
 * GET /api/health/errors
 * 
 * Note: This would require implementing error logging to a collection
 */
router.get('/errors', async (req, res) => {
    try {
        // Check if we have error logs collection
        const errorsSnapshot = await db.collection('error_logs')
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();
        
        const errors = errorsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        res.json({
            status: 'healthy',
            recentErrors: errors.length,
            errors: errors,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        // Error logs collection might not exist yet - that's okay
        res.json({
            status: 'healthy',
            recentErrors: 0,
            errors: [],
            note: 'Error logging not yet configured',
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;

