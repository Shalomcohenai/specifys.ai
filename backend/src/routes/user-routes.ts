/**
 * User Routes
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import { auth } from '../firebase-admin';
import { initializeUser } from '../user-management';
import { createError, ERROR_CODES } from '../error-handler';
import { logger } from '../logger';

const router: Router = express.Router();

/**
 * Middleware to verify Firebase ID token
 */
async function verifyFirebaseToken(req: Request, _res: Response, next: NextFunction): Promise<void> {
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
    } catch (error: any) {
        logger.error({ error: error.message, path: req.path }, '[user-routes] Token verification failed');
        next(createError('Invalid token', ERROR_CODES.INVALID_TOKEN, 401));
    }
}

/**
 * Initialize user documents (users + entitlements) in a single transaction
 * POST /api/users/initialize
 * This is the preferred method for creating new users - ensures atomicity
 */
router.post('/initialize', verifyFirebaseToken, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestId = req.requestId || `user-init-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info({ requestId, userId: req.user?.uid }, '[user-routes] POST /initialize - Starting user initialization');
    
    try {
        const userId = req.user!.uid;
        logger.debug({ requestId, userId }, '[user-routes] Processing user initialization');

        const userDataOverrides = req.body && typeof req.body === 'object' ? (req.body as any).userData || {} : {};

        logger.debug({ requestId, userId, hasOverrides: Object.keys(userDataOverrides).length > 0 }, '[user-routes] Initializing user documents');
        const result = await initializeUser(userId, userDataOverrides);
        logger.debug({ requestId, userId, created: result.created, updated: result.updated }, '[user-routes] User initialization completed');

        const statusMessage = result.created
            ? 'User documents initialized in Firestore'
            : result.updated
              ? 'User documents updated in Firestore'
              : 'User documents already up to date';

        logger.info({ requestId, userId, message: statusMessage }, '[user-routes] POST /initialize - Success');
        res.json({
            success: true,
            message: statusMessage,
            user: result.user,
            entitlements: result.entitlements,
            created: result.created,
            updated: result.updated,
            unchanged: result.unchanged,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
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

export default router;

