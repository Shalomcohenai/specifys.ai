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
    const startTime = Date.now();
    logger.info({ requestId, userId: req.user?.uid }, '[user-routes] ========== POST /api/users/initialize - START ==========');
    logger.info({ requestId, userId: req.user?.uid, method: req.method, path: req.path }, '[user-routes] Request received');
    
    try {
        const userId = req.user.uid;
        logger.info({ requestId, userId }, '[user-routes] Step 1 - Extracting request parameters...');
        logger.debug({ requestId, userId, body: req.body }, '[user-routes] Request body received');

        const userDataOverrides = req.body && typeof req.body === 'object' ? req.body.userData || {} : {};
        const isNewUserFromClient = req.body?.isNewUser === true;
        
        logger.info({ 
            requestId, 
            userId, 
            hasOverrides: Object.keys(userDataOverrides).length > 0, 
            isNewUserFromClient,
            overridesKeys: Object.keys(userDataOverrides)
        }, '[user-routes] Request parameters extracted');

        logger.info({ requestId, userId, isNewUserFromClient }, '[user-routes] Step 2 - Calling initializeUser()...');
        const result = await initializeUser(userId, userDataOverrides, isNewUserFromClient);
        logger.info({ requestId, userId }, '[user-routes] ✅ initializeUser() completed successfully');
        logger.info({ 
            requestId, 
            userId, 
            created: result.created, 
            updated: result.updated, 
            unchanged: result.unchanged,
            isNewUser: result._isNewUser,
            hasNeedsCreditsInit: !!result._needsCreditsInit,
            hasCredits: !!result.credits,
            hasUser: !!result.user,
            hasEntitlements: !!result.entitlements
        }, '[user-routes] Step 3 - Processing initializeUser result...');

        const statusMessage = result.created
            ? 'User documents initialized in Firestore'
            : result.updated
              ? 'User documents updated in Firestore'
              : 'User documents already up to date';

        logger.info({ requestId, userId, message: statusMessage }, '[user-routes] Status message determined');
        
        // Track user creation/signup for analytics (only for new users)
        if (result.created) {
            logger.info({ requestId, userId }, '[user-routes] Step 4 - Recording analytics event for new user...');
            try {
                await recordEvent('user_created', userId, 'user', userId, {
                    email: result.user?.email || req.user?.email,
                    method: 'email' // Could be enhanced to detect Google OAuth
                });
                logger.info({ requestId, userId }, '[user-routes] ✅ Analytics event recorded successfully');
            } catch (analyticsError) {
                // Don't fail the request if analytics fails
                logger.warn({ requestId, userId, error: analyticsError.message }, '[user-routes] ⚠️ Failed to record user creation event (non-fatal)');
            }
        } else {
            logger.debug({ requestId, userId }, '[user-routes] Skipping analytics - user not newly created');
        }
        
        // Calculate credits info if available
        logger.info({ requestId, userId }, '[user-routes] Step 5 - Processing credits information...');
        let creditsInfo = null;
        if (result.credits) {
            logger.debug({ requestId, userId, credits: result.credits }, '[user-routes] Credits data available, calculating totals...');
            const creditsV2Service = require('./credits-v2-service');
            const totalCredits = creditsV2Service.calculateTotal(result.credits.balances);
            creditsInfo = {
                total: totalCredits,
                breakdown: result.credits.balances,
                welcomeCreditGranted: result.credits.metadata?.welcomeCreditGranted || false
            };
            logger.info({ 
                requestId, 
                userId, 
                totalCredits, 
                breakdown: creditsInfo.breakdown,
                welcomeCreditGranted: creditsInfo.welcomeCreditGranted
            }, '[user-routes] ✅ Credits info calculated successfully');
        } else {
            logger.warn({ requestId, userId }, '[user-routes] ⚠️ WARNING - result.credits is missing!');
        }
        
        logger.info({ requestId, userId }, '[user-routes] Step 6 - Building response data...');
        const responseData = {
            success: true,
            message: statusMessage,
            user: result.user,
            entitlements: result.entitlements,
            credits: creditsInfo, // Include credits information
            created: result.created,
            updated: result.updated,
            unchanged: result.unchanged,
            isNewUser: result._isNewUser || false, // Indicate if this is a new user registration
            creditsGranted: (result._isNewUser && creditsInfo) ? creditsInfo.total : 0, // Number of credits granted to new user
            timestamp: new Date().toISOString()
        };
        
        logger.info({ 
            requestId, 
            userId, 
            isNewUser: responseData.isNewUser,
            created: responseData.created,
            creditsGranted: responseData.creditsGranted,
            totalCredits: creditsInfo?.total,
            hasCreditsInfo: !!creditsInfo,
            hasUser: !!responseData.user,
            hasEntitlements: !!responseData.entitlements
        }, '[user-routes] Response data built successfully');
        
        const totalTime = Date.now() - startTime;
        logger.info({ requestId, userId, totalTime }, '[user-routes] Step 7 - Sending response to client...');
        logger.info({ requestId, userId, statusCode: 200, totalTime }, `[user-routes] ========== POST /api/users/initialize - SUCCESS (${totalTime}ms) ==========`);
        
        res.json(responseData);

    } catch (error) {
        const totalTime = Date.now() - startTime;
        logger.error({ 
            requestId,
            userId: req.user?.uid,
            totalTime,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        }, '[user-routes] ========== POST /api/users/initialize - ERROR ==========');
        logger.error({ 
            requestId,
            userId: req.user?.uid,
            errorType: error.constructor.name,
            errorMessage: error.message
        }, '[user-routes] Error details logged above');
        
        next(createError('Failed to initialize user documents', ERROR_CODES.DATABASE_ERROR, 500, {
            details: error.message
        }));
    }
});

/**
 * Get current user information
 * GET /api/users/me
 */
router.get('/me', verifyFirebaseToken, async (req, res, next) => {
    const requestId = req.requestId || `user-me-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    try {
        const userId = req.user.uid;
        
        // Get user document
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            return next(createError('User not found', ERROR_CODES.NOT_FOUND, 404));
        }
        
        const userData = userDoc.data();
        
        // Get credits
        const creditsV2Service = require('./credits-v2-service');
        const credits = await creditsV2Service.getUserCredits(userId);
        
        res.json({
            success: true,
            user: {
                id: userId,
                email: req.user.email || userData.email,
                ...userData
            },
            credits: credits
        });
        
    } catch (error) {
        logger.error({ 
            requestId,
            userId: req.user?.uid,
            error: {
                name: error.name,
                message: error.message
            }
        }, '[user-routes] Error getting user info');
        next(createError('Failed to get user information', ERROR_CODES.DATABASE_ERROR, 500));
    }
});

module.exports = router;
