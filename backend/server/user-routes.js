const express = require('express');
const router = express.Router();
const { auth } = require('./firebase-admin');
const { createOrUpdateUserDocument, ensureEntitlementDocument } = require('./user-management');

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

        const userDataOverrides = req.body && typeof req.body === 'object' ? req.body.userData || {} : {};

        const ensureResult = await createOrUpdateUserDocument(userId, userDataOverrides);

        let entitlementResult = null;
        try {
            entitlementResult = await ensureEntitlementDocument(userId);
        } catch (entitlementError) {
            console.error('[users/ensure] Failed to ensure entitlements', {
                userId,
                message: entitlementError.message
            });
            entitlementResult = {
                created: false,
                updated: false,
                unchanged: false,
                error: entitlementError.message
            };
        }

        const statusMessage = ensureResult.created
            ? 'User document created in Firestore'
            : ensureResult.updated
              ? 'User document updated in Firestore'
              : 'User document already up to date';

        res.json({
            success: true,
            message: statusMessage,
            user: ensureResult.user,
            created: ensureResult.created,
            updated: ensureResult.updated,
            unchanged: ensureResult.unchanged,
            changes: ensureResult.changes,
            entitlements: entitlementResult,
            timestamp: new Date().toISOString()
        });

    } catch (error) {

        res.status(500).json({
            error: 'Failed to ensure user document',
            details: error.message
        });
    }
});

module.exports = router;
