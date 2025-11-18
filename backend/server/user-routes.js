const express = require('express');
const router = express.Router();
const { auth } = require('./firebase-admin');
const { createOrUpdateUserDocument, ensureEntitlementDocument } = require('./user-management');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');

/**
 * Middleware to verify Firebase ID token
 */
async function verifyFirebaseToken(req, res, next) {
    logger.debug({ path: req.path }, '[user-routes] Verifying Firebase token');
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn({ path: req.path }, '[user-routes] No valid authorization header');
            return next(createError('No valid authorization header', ERROR_CODES.UNAUTHORIZED, 401));
        }

        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(idToken);

        logger.debug({ userId: decodedToken.uid, path: req.path }, '[user-routes] Token verified successfully');
        req.user = decodedToken;
        next();
    } catch (error) {
        logger.error({ error: error.message, path: req.path }, '[user-routes] Token verification failed');
        next(createError('Invalid token', ERROR_CODES.INVALID_TOKEN, 401));
    }
}

/**
 * Route to ensure user document exists in Firestore
 * POST /api/users/ensure
 */
router.post('/ensure', verifyFirebaseToken, async (req, res, next) => {
    const requestId = req.requestId || `user-ensure-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info({ requestId, userId: req.user?.uid }, '[user-routes] POST /ensure - Starting user document ensure');
    
    try {
        const userId = req.user.uid;
        logger.debug({ requestId, userId }, '[user-routes] Processing user document ensure');

        const userDataOverrides = req.body && typeof req.body === 'object' ? req.body.userData || {} : {};

        logger.debug({ requestId, userId, hasOverrides: Object.keys(userDataOverrides).length > 0 }, '[user-routes] Creating/updating user document');
        const ensureResult = await createOrUpdateUserDocument(userId, userDataOverrides);
        logger.debug({ requestId, userId, created: ensureResult.created, updated: ensureResult.updated }, '[user-routes] User document ensure completed');

        let entitlementResult = null;
        try {
            logger.debug({ requestId, userId }, '[user-routes] Ensuring entitlement document');
            entitlementResult = await ensureEntitlementDocument(userId);
            logger.debug({ requestId, userId }, '[user-routes] Entitlement document ensure completed');
        } catch (entitlementError) {
            logger.warn({ 
                requestId,
                userId, 
                error: entitlementError.message 
            }, '[user-routes] Failed to ensure entitlements (non-critical)');
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

        logger.info({ requestId, userId, message: statusMessage }, '[user-routes] POST /ensure - Success');
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
        logger.error({ 
            requestId,
            userId: req.user?.uid,
            error: {
                message: error.message,
                stack: error.stack
            }
        }, '[user-routes] POST /ensure - Error');
        next(createError('Failed to ensure user document', ERROR_CODES.DATABASE_ERROR, 500, {
            details: error.message
        }));
    }
});

module.exports = router;
