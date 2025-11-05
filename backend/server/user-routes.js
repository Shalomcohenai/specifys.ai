const express = require('express');
const router = express.Router();
const { auth } = require('./firebase-admin');
const { createOrUpdateUserDocument } = require('./user-management');

/**
 * Middleware to verify Firebase ID token
 */
async function verifyFirebaseToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No valid authorization header' });
        }

        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(idToken);

        req.user = decodedToken;
        next();
    } catch (error) {

        res.status(401).json({ error: 'Invalid token' });
    }
}

/**
 * Route to ensure user document exists in Firestore
 * POST /api/users/ensure
 */
router.post('/ensure', verifyFirebaseToken, async (req, res) => {
    try {
        const userId = req.user.uid;

        // Create or update user document in Firestore
        const userDoc = await createOrUpdateUserDocument(userId);

        res.json({
            success: true,
            user: userDoc,
            message: 'User document ensured in Firestore'
        });

    } catch (error) {

        res.status(500).json({
            error: 'Failed to ensure user document',
            details: error.message
        });
    }
});

module.exports = router;
