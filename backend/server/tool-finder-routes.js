const express = require('express');
const router = express.Router();
const { db, auth } = require('./firebase-admin');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');
const emailService = require('./email-service');

/**
 * Middleware to verify Firebase ID token (optional - for authenticated users)
 */
async function verifyFirebaseTokenOptional(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // No auth header - allow but don't set req.user
            req.user = null;
            return next();
        }

        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(idToken);
        req.user = decodedToken;
        next();
    } catch (error) {
        // Invalid token - allow but don't set req.user
        req.user = null;
        next();
    }
}

/**
 * Record Tool Finder usage and send email
 * POST /api/tool-finder/usage
 * Body: { description: string (optional) }
 */
router.post('/usage', verifyFirebaseTokenOptional, async (req, res, next) => {
    const requestId = req.requestId || `tool-finder-usage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
        const userId = req.user?.uid || null;
        const description = req.body?.description || null;
        
        logger.info({ requestId, userId, hasDescription: !!description }, '[tool-finder-routes] POST /usage - Tool Finder usage recorded');
        
        // If user is authenticated, send email notification
        if (userId) {
            try {
                const userRecord = await auth.getUser(userId);
                const userEmail = userRecord.email || null;
                const userName = userRecord.displayName || userEmail?.split('@')[0] || 'User';
                
                if (userEmail) {
                    // Check user email preferences for marketing emails
                    try {
                        const userDoc = await db.collection('users').doc(userId).get();
                        const userData = userDoc.exists ? userDoc.data() : {};
                        const emailPrefs = userData.emailPreferences || {
                            newsletter: true,
                            operational: true,
                            marketing: true,
                            specNotifications: true,
                            updates: true
                        };
                        
                        // Tool Finder email is considered marketing
                        if (emailPrefs.marketing !== false) {
                            // Check if email was already sent today (prevent spam)
                            const toolFinderEmailSent = userData.toolFinderEmailSent;
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            
                            let shouldSendEmail = true;
                            if (toolFinderEmailSent) {
                                const lastSentDate = toolFinderEmailSent instanceof Date 
                                    ? toolFinderEmailSent 
                                    : new Date(toolFinderEmailSent);
                                lastSentDate.setHours(0, 0, 0, 0);
                                
                                // Only send once per day
                                if (lastSentDate.getTime() === today.getTime()) {
                                    shouldSendEmail = false;
                                    logger.info({ requestId, userId, userEmail }, '[tool-finder-routes] Skipped Tool Finder usage email - already sent today');
                                }
                            }
                            
                            if (shouldSendEmail) {
                                const baseUrl = process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';
                                
                                // Send Tool Finder usage email (non-blocking)
                                emailService.sendToolFinderUsageEmail(userEmail, userName, userId, baseUrl)
                                    .then(() => {
                                        // Mark email as sent for today
                                        db.collection('users').doc(userId).update({
                                            toolFinderEmailSent: today
                                        }).catch(updateErr => {
                                            logger.warn({ requestId, userId, error: updateErr.message }, '[tool-finder-routes] Failed to mark tool finder email as sent');
                                        });
                                    })
                                    .catch(err => {
                                        logger.warn({ requestId, userId, error: err.message }, '[tool-finder-routes] Failed to send Tool Finder usage email');
                                    });
                                
                                logger.info({ requestId, userId, userEmail }, '[tool-finder-routes] Tool Finder usage email sent');
                            }
                        } else {
                            logger.info({ requestId, userId, userEmail }, '[tool-finder-routes] Skipped Tool Finder usage email - user disabled marketing emails');
                        }
                    } catch (prefError) {
                        logger.warn({ requestId, userId, error: prefError.message }, '[tool-finder-routes] Error checking user preferences, skipping email');
                    }
                }
            } catch (authError) {
                logger.warn({ requestId, userId, error: authError.message }, '[tool-finder-routes] Failed to get user info for Tool Finder email');
            }
        }
        
        res.json({
            success: true,
            message: 'Tool Finder usage recorded',
            userId: userId || null
        });
        
    } catch (error) {
        logger.error({ requestId, error: error.message }, '[tool-finder-routes] Error recording Tool Finder usage');
        // Don't fail the request if email fails
        res.json({ success: true, message: 'Usage recorded (email notification may have failed)' });
    }
});

module.exports = router;

