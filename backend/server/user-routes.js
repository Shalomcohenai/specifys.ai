const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { db, admin } = require('./firebase-admin');
const { initializeUser } = require('./user-management');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');
const { recordEvent } = require('./analytics-service');
const emailService = require('./email-service');

const { verifyFirebaseToken } = require('./middleware/auth');

/**
 * Initialize user documents (users + entitlements) in a single transaction
 * POST /api/users/initialize
 * This is the preferred method for creating new users - ensures atomicity
 */
router.post('/initialize', verifyFirebaseToken, async (req, res, next) => {
    const requestId = req.requestId || `user-init-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    logger.info({ requestId, userId: req.user?.uid }, '[user-routes] ========== POST /api/users/initialize - START ==========');
    logger.info({ requestId, origin: req.get('origin'), referer: req.get('referer'), host: req.get('host'), userId: req.user?.uid }, '[user-routes] [AUTH-DEBUG] origin/referer/host (dev vs prod)');
    logger.info({ requestId, userId: req.user?.uid, method: req.method, path: req.path }, '[user-routes] Request received');
    
    try {
        const userId = req.user.uid;
        logger.info({ requestId, userId }, '[user-routes] Step 1 - Extracting request parameters...');
        logger.debug({ requestId, userId, body: req.body }, '[user-routes] Request body received');

        const userDataOverrides = req.body && typeof req.body === 'object' ? req.body.userData || {} : {};
        const isNewUserFromClient = req.body?.isNewUser === true;
        
        // Extract referrer and UTM parameters from request for new users
        if (isNewUserFromClient) {
          // Get referrer from headers
          const referrer = req.get('referer') || req.get('referrer') || null;
          
          // Extract UTM parameters from query string or body
          const utmParams = {};
          ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(param => {
            if (req.query[param]) {
              utmParams[param] = req.query[param];
            } else if (req.body && req.body[param]) {
              utmParams[param] = req.body[param];
            }
          });
          
          // Get landing page from request
          const landingPage = req.body?.landingPage || req.query?.landingPage || req.path || null;
          
          // Only set these if they don't already exist in userDataOverrides
          if (referrer && !userDataOverrides.referrer) {
            userDataOverrides.referrer = referrer;
          }
          if (landingPage && !userDataOverrides.landing_page) {
            userDataOverrides.landing_page = landingPage;
          }
          if (!userDataOverrides.first_visit_at) {
            userDataOverrides.first_visit_at = admin.firestore.FieldValue.serverTimestamp();
          }
          
          // Add UTM parameters
          Object.keys(utmParams).forEach(key => {
            if (!userDataOverrides[key]) {
              userDataOverrides[key] = utmParams[key];
            }
          });
          
          logger.debug({ 
            requestId, 
            userId, 
            referrer, 
            landingPage, 
            utmParams 
          }, '[user-routes] Extracted referrer/UTM data for new user');
        }
        
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
            logger.debug({ requestId, userId, credits: result.credits }, '[user-routes] Credits data available, using total from document...');
            // Use total from document (single source of truth), fallback to calculation for backward compatibility
            const totalCredits = result.credits.total !== undefined 
                ? result.credits.total 
                : (result.credits.balances?.paid || 0) + (result.credits.balances?.free || 0) + (result.credits.balances?.bonus || 0);
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

        // Send welcome email to new user (after credits info is calculated)
        if (result.created) {
            logger.info({ requestId, userId }, '[user-routes] Step 5.5 - Sending welcome email to new user...');
            try {
                const userEmail = result.user?.email || req.user?.email;
                const userName = result.user?.displayName || result.user?.name || userEmail?.split('@')[0] || 'there';
                const baseUrl = process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';
                const creditsCount = creditsInfo?.total || 1;

                if (userEmail) {
                    const emailPrefs = result.user?.emailPreferences;
                    // Resend marketing audience (optional: RESEND_AUDIENCE_ID / RESEND_SEGMENT_ID on server)
                    emailService.addSignupToResendAudience(userEmail, userName, userId, emailPrefs).then((audienceResult) => {
                        if (audienceResult.success && !audienceResult.skipped) {
                            logger.info({ requestId, userId, userEmail, contactId: audienceResult.contactId }, '[user-routes] ✅ User synced to Resend audience');
                        } else if (audienceResult.success && audienceResult.skipped && audienceResult.reason === 'no_audience_id') {
                            logger.debug({ requestId, userId }, '[user-routes] Resend audience sync skipped (no audience ID configured)');
                        } else if (!audienceResult.success) {
                            logger.warn({ requestId, userId, userEmail, error: audienceResult.error }, '[user-routes] ⚠️ Resend audience sync failed (non-fatal)');
                        }
                    }).catch((err) => {
                        logger.warn({ requestId, userId, userEmail, error: err.message }, '[user-routes] ⚠️ Resend audience sync exception (non-fatal)');
                    });

                    // Send email asynchronously (don't wait for it to complete)
                    emailService.sendWelcomeEmail(userEmail, userName, userId, baseUrl, creditsCount).then(emailResult => {
                        if (emailResult.success) {
                            logger.info({ requestId, userId, userEmail, messageId: emailResult.messageId, creditsCount }, '[user-routes] ✅ Welcome email sent successfully');
                        } else {
                            logger.warn({ requestId, userId, userEmail, error: emailResult.error }, '[user-routes] ⚠️ Failed to send welcome email (non-fatal)');
                        }
                    }).catch(emailError => {
                        logger.warn({ requestId, userId, userEmail, error: emailError.message }, '[user-routes] ⚠️ Exception sending welcome email (non-fatal)');
                    });
                } else {
                    logger.warn({ requestId, userId }, '[user-routes] ⚠️ Skipping welcome email - user email not available');
                }
            } catch (emailError) {
                // Don't fail the request if email sending fails
                logger.warn({ requestId, userId, error: emailError.message }, '[user-routes] ⚠️ Failed to send welcome email (non-fatal)');
            }
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
        const creditsV3Service = require('./credits-v3-service');
        const credits = await creditsV3Service.getUserCredits(userId);
        
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

/**
 * Get MCP API key status (whether user has a key; key is never returned)
 * GET /api/users/me/mcp-api-key
 */
router.get('/me/mcp-api-key', verifyFirebaseToken, async (req, res, next) => {
    const requestId = req.requestId || `mcp-key-status-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    try {
        const userId = req.user.uid;
        const userDoc = await db.collection('users').doc(userId).get();
        const hasKey = userDoc.exists && !!userDoc.data()?.mcpApiKey;
        logger.info({ requestId, userId, hasKey }, '[user-routes] GET /me/mcp-api-key');
        res.json({ success: true, hasKey });
    } catch (err) {
        logger.error({ requestId, userId: req.user?.uid, error: err.message }, '[user-routes] GET /me/mcp-api-key error');
        next(createError('Failed to get MCP API key status', ERROR_CODES.DATABASE_ERROR, 500));
    }
});

/**
 * Create or regenerate MCP API key for the current user.
 * Key is returned only in this response; store it for use with MCP (Cursor / Claude Desktop).
 * POST /api/users/me/mcp-api-key
 * Body: { regenerate?: boolean } - optional; if true, replace existing key.
 */
router.post('/me/mcp-api-key', verifyFirebaseToken, async (req, res, next) => {
    const requestId = req.requestId || `mcp-key-create-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    try {
        const userId = req.user.uid;
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const existingKey = userDoc.exists ? userDoc.data()?.mcpApiKey : null;

        if (existingKey && !req.body?.regenerate) {
            return res.status(400).json({
                success: false,
                error: 'MCP API key already exists. Send { "regenerate": true } to replace it.',
                hasKey: true
            });
        }

        const apiKey = crypto.randomBytes(24).toString('hex');
        await userRef.set(
            { mcpApiKey: apiKey, mcpApiKeyUpdatedAt: admin.firestore.FieldValue.serverTimestamp() },
            { merge: true }
        );
        logger.info({ requestId, userId, regenerated: !!existingKey }, '[user-routes] POST /me/mcp-api-key - key created');
        res.json({
            success: true,
            apiKey,
            message: 'Store this key securely. It will not be shown again. Use it as SPECIFYS_API_KEY in your MCP client (Cursor / Claude Desktop).'
        });
    } catch (err) {
        logger.error({ requestId, userId: req.user?.uid, error: err.message }, '[user-routes] POST /me/mcp-api-key error');
        next(createError('Failed to create MCP API key', ERROR_CODES.DATABASE_ERROR, 500));
    }
});

const MCP_EVENT_TYPES = new Set(['mcp_modal_open', 'mcp_page_view']);

/**
 * Record MCP-related frontend event (modal open, MCP page view) for admin stats.
 * POST /api/users/me/mcp-event
 * Body: { type: 'mcp_modal_open' | 'mcp_page_view' }
 */
router.post('/me/mcp-event', verifyFirebaseToken, async (req, res, next) => {
    const requestId = req.requestId || `mcp-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    try {
        const userId = req.user.uid;
        const type = req.body?.type;
        if (!type || !MCP_EVENT_TYPES.has(type)) {
            return next(createError('Invalid type. Use mcp_modal_open or mcp_page_view', ERROR_CODES.INVALID_INPUT, 400));
        }
        await db.collection('mcp_events').add({
            userId,
            type,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        logger.debug({ requestId, userId, type }, '[user-routes] MCP event recorded');
        res.json({ success: true });
    } catch (err) {
        logger.error({ requestId, userId: req.user?.uid, error: err.message }, '[user-routes] POST /me/mcp-event error');
        next(createError('Failed to record MCP event', ERROR_CODES.DATABASE_ERROR, 500));
    }
});

/**
 * Update user email preferences
 * PUT /api/users/preferences/email
 */
router.put('/preferences/email', verifyFirebaseToken, async (req, res, next) => {
    const requestId = req.requestId || `user-email-prefs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
        const userId = req.user.uid;
        const { newsletter, operational, marketing } = req.body;
        
        // Validate input
        const updateData = {};
        
        if (newsletter !== undefined) {
            if (typeof newsletter !== 'boolean') {
                return next(createError('newsletter must be a boolean', ERROR_CODES.INVALID_INPUT, 400));
            }
            updateData['emailPreferences.newsletter'] = newsletter;
            updateData.newsletterSubscribed = newsletter; // Keep in sync
        }
        
        if (operational !== undefined) {
            if (typeof operational !== 'boolean') {
                return next(createError('operational must be a boolean', ERROR_CODES.INVALID_INPUT, 400));
            }
            // Operational emails include: spec notifications, purchase confirmations
            updateData['emailPreferences.operational'] = operational;
            updateData['emailPreferences.specNotifications'] = operational;
            updateData['emailPreferences.updates'] = operational;
        }
        
        if (marketing !== undefined) {
            if (typeof marketing !== 'boolean') {
                return next(createError('marketing must be a boolean', ERROR_CODES.INVALID_INPUT, 400));
            }
            // Marketing emails include: tool finder, inactive user emails
            updateData['emailPreferences.marketing'] = marketing;
        }
        
        if (Object.keys(updateData).length === 0) {
            return next(createError('At least one preference must be provided', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
        }
        
        updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        
        // Get current preferences first
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return next(createError('User not found', ERROR_CODES.NOT_FOUND, 404));
        }
        
        const currentData = userDoc.data();
        const currentPreferences = currentData.emailPreferences || {
            newsletter: true,
            operational: true,
            marketing: true,
            specNotifications: true,
            updates: true
        };
        
        // Build final preferences object
        const finalPreferences = {
            ...currentPreferences,
            newsletter: newsletter !== undefined ? newsletter : currentPreferences.newsletter,
            operational: operational !== undefined ? operational : currentPreferences.operational,
            marketing: marketing !== undefined ? marketing : currentPreferences.marketing,
            specNotifications: operational !== undefined ? operational : (currentPreferences.specNotifications ?? true),
            updates: operational !== undefined ? operational : (currentPreferences.updates ?? true)
        };
        
        // Remove undefined values from finalPreferences
        Object.keys(finalPreferences).forEach(key => {
            if (finalPreferences[key] === undefined) {
                delete finalPreferences[key];
            }
        });
        
        // Update with nested object
        await db.collection('users').doc(userId).update({
            emailPreferences: finalPreferences,
            newsletterSubscribed: finalPreferences.newsletter,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        logger.info({ requestId, userId, preferences: finalPreferences }, '[user-routes] Email preferences updated');
        
        res.json({
            success: true,
            message: 'Email preferences updated',
            preferences: finalPreferences
        });
        
    } catch (error) {
        logger.error({ 
            requestId,
            userId: req.user?.uid,
            error: {
                name: error.name,
                message: error.message
            }
        }, '[user-routes] Error updating email preferences');
        next(createError('Failed to update email preferences', ERROR_CODES.DATABASE_ERROR, 500));
    }
});

/**
 * Get user email preferences
 * GET /api/users/preferences/email
 */
router.get('/preferences/email', verifyFirebaseToken, async (req, res, next) => {
    const requestId = req.requestId || `user-email-prefs-get-${Date.now()}`;
    
    try {
        const userId = req.user.uid;
        
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            return next(createError('User not found', ERROR_CODES.NOT_FOUND, 404));
        }
        
        const userData = userDoc.data();
        const preferences = userData.emailPreferences || {
            newsletter: true,
            operational: true,
            marketing: true,
            specNotifications: true,
            updates: true
        };
        
        res.json({
            success: true,
            preferences
        });
        
    } catch (error) {
        logger.error({ 
            requestId,
            userId: req.user?.uid,
            error: error.message
        }, '[user-routes] Error getting email preferences');
        next(createError('Failed to get email preferences', ERROR_CODES.DATABASE_ERROR, 500));
    }
});

module.exports = router;
