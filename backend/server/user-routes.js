const express = require('express');
const router = express.Router();
const { auth, db } = require('./firebase-admin');
const { ensureEntitlementDocument, initializeUser } = require('./user-management');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');
const { recordEvent } = require('./analytics-service');

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
 * Initialize user documents (users + entitlements) in a single transaction
 * POST /api/users/initialize
 * This is the preferred method for creating new users - ensures atomicity
 */
router.post('/initialize', verifyFirebaseToken, async (req, res, next) => {
    const requestId = req.requestId || `user-init-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info({ requestId, userId: req.user?.uid }, '[user-routes] POST /initialize - Starting user initialization');
    
    try {
        const userId = req.user.uid;
        logger.debug({ requestId, userId }, '[user-routes] Processing user initialization');

        const userDataOverrides = req.body && typeof req.body === 'object' ? req.body.userData || {} : {};
        const isNewUserFromClient = req.body?.isNewUser === true;

        logger.debug({ requestId, userId, hasOverrides: Object.keys(userDataOverrides).length > 0, isNewUserFromClient }, '[user-routes] Initializing user documents');
        const result = await initializeUser(userId, userDataOverrides, isNewUserFromClient);
        logger.debug({ 
            requestId, 
            userId, 
            created: result.created, 
            updated: result.updated, 
            unchanged: result.unchanged,
            isNewUser: result._isNewUser,
            hasNeedsCreditsInit: !!result._needsCreditsInit
        }, '[user-routes] User initialization completed');

        const statusMessage = result.created
            ? 'User documents initialized in Firestore'
            : result.updated
              ? 'User documents updated in Firestore'
              : 'User documents already up to date';

        logger.info({ requestId, userId, message: statusMessage }, '[user-routes] POST /initialize - Success');
        
        // Track user creation/signup for analytics (only for new users)
        if (result.created) {
            try {
                await recordEvent('user_created', userId, 'user', userId, {
                    email: result.user?.email || req.user?.email,
                    method: 'email' // Could be enhanced to detect Google OAuth
                });
            } catch (analyticsError) {
                // Don't fail the request if analytics fails
                logger.warn({ requestId, error: analyticsError.message }, '[user-routes] Failed to record user creation event');
            }
        }
        
        const responseData = {
            success: true,
            message: statusMessage,
            user: result.user,
            entitlements: result.entitlements,
            created: result.created,
            updated: result.updated,
            unchanged: result.unchanged,
            isNewUser: result._isNewUser || false, // Indicate if this is a new user registration
            timestamp: new Date().toISOString()
        };
        
        logger.debug({ 
            requestId, 
            userId, 
            isNewUser: responseData.isNewUser,
            created: responseData.created
        }, '[user-routes] Sending response to client');
        
        res.json(responseData);

    } catch (error) {
        logger.error({ 
            requestId,
            userId: req.user?.uid,
            error: {
                message: error.message,
                stack: error.stack
            }
        }, '[user-routes] POST /initialize - Error');
        next(createError('Failed to initialize user documents', ERROR_CODES.DATABASE_ERROR, 500, {
            details: error.message
        }));
    }
});

module.exports = router;
