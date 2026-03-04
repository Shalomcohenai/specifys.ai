const express = require('express');
const router = express.Router();
const { db, admin, auth } = require('./firebase-admin');
const OpenAIStorageService = require('./openai-storage-service');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');
const { rateLimiters } = require('./security');
const specGenerationService = require('./spec-generation-service');
const specGenerationServiceV2 = require('./spec-generation-service-v2');
const specQueue = require('./spec-queue');
const specEvents = require('./spec-events');
const { recordSpecCreation } = require('./admin-activity-service');
const emailService = require('./email-service');

const openaiStorage = process.env.OPENAI_API_KEY 
  ? new OpenAIStorageService(process.env.OPENAI_API_KEY)
  : null;

/**
 * Extract a short display title (max 5 words) from overview JSON content.
 * Used in profile cards and spec-viewer header.
 */
function extractTitleFromOverview(overviewContent) {
    const MAX_WORDS = 5;
    if (!overviewContent || typeof overviewContent !== 'string') return 'App Specification';
    try {
        const overviewObj = JSON.parse(overviewContent);
        const ideaSummary = overviewObj.ideaSummary || (overviewObj.overview && overviewObj.overview.ideaSummary);
        if (ideaSummary && typeof ideaSummary === 'string' && ideaSummary.trim().length > 0) {
            const trimmed = ideaSummary.trim();
            const firstSentence = trimmed.split(/[.!?]/)[0].trim();
            const words = firstSentence.split(/\s+/).filter(Boolean);
            if (words.length >= 1) return words.slice(0, MAX_WORDS).join(' ');
        }
        if (overviewObj.applicationSummary && Array.isArray(overviewObj.applicationSummary.paragraphs) && overviewObj.applicationSummary.paragraphs[0]) {
            const p = overviewObj.applicationSummary.paragraphs[0];
            if (typeof p === 'string' && p.trim().length > 0) {
                const words = p.trim().split(/\s+/).filter(Boolean);
                if (words.length >= 1) return words.slice(0, MAX_WORDS).join(' ');
            }
        }
    } catch (e) {
        // ignore parse errors
    }
    return 'App Specification';
}

/**
 * Middleware to verify Firebase ID token
 */
async function verifyFirebaseToken(req, res, next) {
    logger.debug({ path: req.path }, 'Verifying Firebase token');
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn({ path: req.path }, 'No valid authorization header');
            return next(createError('No valid authorization header', ERROR_CODES.UNAUTHORIZED, 401));
        }

        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(idToken);

        logger.debug({ userId: decodedToken.uid, path: req.path }, 'Token verified successfully');
        req.user = decodedToken;
        next();
    } catch (error) {
        logger.error({ error: error.message, path: req.path }, 'Token verification failed');
        next(createError('Invalid token', ERROR_CODES.INVALID_TOKEN, 401));
    }
}

/**
 * Get all specs for current user
 * GET /api/specs
 */
router.get('/', verifyFirebaseToken, async (req, res, next) => {
    const requestId = req.requestId || `specs-list-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
        const userId = req.user.uid;
        
        logger.info({ requestId, userId }, '[specs-routes] GET /api/specs - Fetching user specs');
        
        const specsSnapshot = await db.collection('specs')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();
        
        const specs = specsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        logger.info({ requestId, userId, count: specs.length }, '[specs-routes] GET /api/specs - Success');
        
        res.json({
            success: true,
            specs: specs
        });
        
    } catch (error) {
        logger.error({ requestId, userId: req.user?.uid, error: error.message }, '[specs-routes] GET /api/specs - Error');
        next(createError('Failed to fetch specs', ERROR_CODES.DATABASE_ERROR, 500, {
            details: error.message
        }));
    }
});

// /entitlements endpoint removed - use /api/v3/credits instead
// DEPRECATED /consume-credit endpoint removed - frontend uses /api/v3/credits/consume directly

/**
 * Upload spec to OpenAI Storage
 * POST /api/specs/:id/upload-to-openai
 */
router.post('/:id/upload-to-openai', verifyFirebaseToken, async (req, res, next) => {
    const requestId = req.requestId || `upload-endpoint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    console.log(`[${requestId}] ===== /api/specs/:id/upload-to-openai START =====`);
    console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
    console.log(`[${requestId}] Spec ID: ${req.params.id}`);
    console.log(`[${requestId}] User ID: ${req.user.uid}`);
    
    try {
        const specId = req.params.id;
        const userId = req.user.uid;

        if (!openaiStorage) {
            logger.error({ requestId }, 'OpenAI not configured');
            return next(createError('OpenAI not configured', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 503, { requestId }));
        }

        // Verify spec ownership
        console.log(`[${requestId}] 📤 Step 1: Verifying spec ownership`);
        const specCheckStart = Date.now();
        const specDoc = await db.collection('specs').doc(specId).get();
        const specCheckTime = Date.now() - specCheckStart;
        console.log(`[${requestId}] ⏱️  Spec check took ${specCheckTime}ms`);
        
        if (!specDoc.exists) {
            logger.error({ requestId, specId }, 'Spec not found');
            return next(createError('Specification not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404, { requestId }));
        }

        const specData = specDoc.data();
        console.log(`[${requestId}] Spec Data:`, {
            hasTitle: !!specData.title,
            hasOverview: !!specData.overview,
            hasTechnical: !!specData.technical,
            ownerUserId: specData.userId,
            hasOpenaiFileId: !!specData.openaiFileId
        });
        
        if (specData.userId !== userId) {
            logger.warn({ requestId, userId, specId }, 'Unauthorized: User does not own spec');
            return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403, { requestId }));
        }

        // Check if already uploaded
        if (specData.openaiFileId) {
            console.log(`[${requestId}] ✅ Spec already uploaded to OpenAI: ${specData.openaiFileId}`);
            const totalTime = Date.now() - startTime;
            console.log(`[${requestId}] ✅ /api/specs/:id/upload-to-openai SUCCESS (already uploaded) (${totalTime}ms)`);
            console.log(`[${requestId}] ===== /api/specs/:id/upload-to-openai COMPLETE =====`);
            return res.json({ 
                success: true, 
                message: 'Spec already uploaded to OpenAI',
                fileId: specData.openaiFileId,
                requestId
            });
        }

        // Upload to OpenAI
        console.log(`[${requestId}] 📤 Step 2: Uploading spec to OpenAI`);
        const uploadStart = Date.now();
        const fileId = await openaiStorage.uploadSpec(specId, specData);
        const uploadTime = Date.now() - uploadStart;
        console.log(`[${requestId}] ⏱️  OpenAI upload took ${uploadTime}ms`);
        console.log(`[${requestId}] ✅ File ID received: ${fileId}`);

        // Update spec with OpenAI file ID
        console.log(`[${requestId}] 📤 Step 3: Updating Firestore with file ID`);
        const updateStart = Date.now();
        await db.collection('specs').doc(specId).update({
            openaiFileId: fileId,
            openaiUploadTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        const updateTime = Date.now() - updateStart;
        console.log(`[${requestId}] ⏱️  Firestore update took ${updateTime}ms`);
        console.log(`[${requestId}] ✅ Firestore updated successfully`);

        const totalTime = Date.now() - startTime;
        console.log(`[${requestId}] ✅ /api/specs/:id/upload-to-openai SUCCESS (${totalTime}ms total)`);
        console.log(`[${requestId}] ===== /api/specs/:id/upload-to-openai COMPLETE =====`);
        
        res.json({ 
            success: true, 
            message: 'Spec uploaded to OpenAI successfully',
            fileId: fileId,
            requestId
        });
    } catch (error) {
        const totalTime = Date.now() - startTime;
        logger.error({
            requestId,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            duration: `${totalTime}ms`
        }, 'Error uploading spec to OpenAI');
        next(createError('Failed to upload spec to OpenAI', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
            details: error.message,
            requestId
        }));
    }
});

/**
 * Send spec ready notification email
 * POST /api/specs/:id/send-ready-notification
 */
router.post('/:id/send-ready-notification', verifyFirebaseToken, async (req, res, next) => {
    console.log(`[send-ready-notification] Request received for specId: ${req.params.id}`);
    try {
        const specId = req.params.id;
        const userId = req.user.uid;
        console.log(`[send-ready-notification] Processing for userId: ${userId}, specId: ${specId}`);
        
        // Get spec from Firestore
        const specDoc = await db.collection('specs').doc(specId).get();
        
        if (!specDoc.exists) {
            return next(createError('Specification not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
        }
        
        const specData = specDoc.data();
        
        // Verify ownership
        if (specData.userId !== userId) {
            return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403));
        }
        
        // Check if overview is ready
        if (specData.status?.overview !== 'ready') {
            return next(createError('Specification overview is not ready yet', ERROR_CODES.VALIDATION_ERROR, 400, {
                status: specData.status?.overview
            }));
        }
        
        // Check if email was already sent (optional - to prevent duplicate emails)
        if (specData.emailNotificationSent) {
            return res.json({ 
                success: true, 
                message: 'Email notification already sent',
                alreadySent: true 
            });
        }
        
        // Get user email from Firebase Auth
        const userRecord = await auth.getUser(userId);
        const userEmail = userRecord.email;
        
        if (!userEmail) {
            return next(createError('User email not found', ERROR_CODES.RESOURCE_NOT_FOUND, 400));
        }
        
        // Get base URL from request or use default (never use localhost)
        let baseUrl = req.headers.origin || process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';
        // Fix localhost URLs - replace with production URL
        if (baseUrl && (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'))) {
            baseUrl = process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';
            logger.info({ requestId, originalOrigin: req.headers.origin, fixedBaseUrl: baseUrl }, '[specs-routes] Fixed localhost baseUrl');
        }
        
        // Get user display name
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data() || {};
        const displayName = userRecord.displayName || userData.displayName || userEmail.split('@')[0];
        
        // Check user email preferences for spec notifications
        const emailPrefs = userData.emailPreferences || {
            newsletter: true,
            operational: true,
            marketing: true,
            specNotifications: true,
            updates: true
        };
        
        if (emailPrefs.specNotifications === false || emailPrefs.operational === false) {
            return next(createError('User has disabled spec notification emails', ERROR_CODES.INVALID_REQUEST, 400));
        }
        
        // Check how many specs the user has to determine which email template to use
        const userSpecsSnapshot = await db.collection('specs')
            .where('userId', '==', userId)
            .get();
        
        const userSpecsCount = userSpecsSnapshot.size;
        const isFirstSpec = userSpecsCount <= 1; // 1 because we're counting the current spec
        
        // Send email using Resend service - different email for first vs subsequent specs
        let emailResult;
        if (isFirstSpec) {
            emailResult = await emailService.sendSpecReadyEmail(
                userEmail,
                displayName,
                specData.title || 'App Specification',
                specId,
                userId,
                baseUrl
            );
        } else {
            emailResult = await emailService.sendSpecReadyEmailSubsequent(
                userEmail,
                displayName,
                specData.title || 'App Specification',
                specId,
                userId,
                baseUrl
            );
        }
        
        if (emailResult.success) {
            // Mark email as sent in Firestore
            await db.collection('specs').doc(specId).update({
                emailNotificationSent: true,
                emailNotificationSentAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        
        res.json({
            success: emailResult.success,
            message: emailResult.success 
                ? 'Email notification sent successfully' 
                : 'Failed to send email notification',
            details: emailResult
        });
        
    } catch (error) {
        logger.error({ error: error.message, stack: error.stack, specId: req.params.id }, 'Error sending spec ready notification');
        next(createError('Failed to send notification', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
            details: error.message
        }));
    }
});

/**
 * Generate all specs in parallel (Technical, Market, Design)
 * POST /api/specs/:id/generate-all
 * Body: { overview: string, answers: Array }
 * Returns: 202 Accepted immediately, processes in background
 */
router.post('/:id/generate-all', verifyFirebaseToken, async (req, res, next) => {
    const requestId = req.requestId || `generate-all-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    logger.info({ requestId, specId: req.params.id }, '[specs-routes] POST /generate-all - Starting parallel generation');

    try {
        const specId = req.params.id;
        const userId = req.user.uid;
        const { overview, answers } = req.body;

        if (!overview) {
            return next(createError('overview is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400, { requestId }));
        }

        if (!Array.isArray(answers)) {
            return next(createError('answers must be an array', ERROR_CODES.MISSING_REQUIRED_FIELD, 400, { requestId }));
        }

        // Verify spec ownership
        const specDoc = await db.collection('specs').doc(specId).get();
        
        if (!specDoc.exists) {
            logger.error({ requestId, specId }, 'Spec not found');
            return next(createError('Specification not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404, { requestId }));
        }

        const specData = specDoc.data();
        
        if (specData.userId !== userId) {
            logger.warn({ requestId, userId, specId }, 'Unauthorized: User does not own spec');
            return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403, { requestId }));
        }

        // Update status: only technical generating initially (Market, Design run sequentially after)
        await db.collection('specs').doc(specId).update({
            'status.technical': 'generating',
            'status.market': 'pending',
            'status.design': 'pending',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Add to queue for processing
        const job = await specQueue.add(specId, overview, answers);

        // Set up event listeners for this spec
        const updateListener = (event) => {
            if (event.specId === specId) {
                // Update Firestore on each stage completion
                const updateData = {
                    [`status.${event.stage}`]: event.status,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };

                if (event.status === 'ready' && event.content) {
                    updateData[event.stage] = event.content;
                }
                updateData.generationVersion = 'v2';

                db.collection('specs').doc(specId).update(updateData).catch(err => {
                    logger.error({ requestId, specId, stage: event.stage, error: err.message }, 'Failed to update spec in Firestore');
                });
            }
        };

        const completeListener = async (event) => {
            if (event.specId === specId) {
                // Remove listeners
                specEvents.removeListener('spec.update', updateListener);
                specEvents.removeListener('spec.complete', completeListener);
                specEvents.removeListener('spec.error', errorListener);

                // Trigger OpenAI upload (non-blocking)
                if (openaiStorage) {
                    triggerOpenAIUploadForSpec(specId).catch(err => {
                        logger.warn({ requestId, specId, error: err.message }, 'Failed to trigger OpenAI upload');
                    });
                }
            }
        };

        const errorListener = (event) => {
            if (event.specId === specId) {
                logger.error({ requestId, specId, stage: event.stage, error: event.error }, 'Spec generation error');
                // Persist error state so UI shows error + Retry instead of infinite loading
                db.collection('specs').doc(specId).update({
                    [`status.${event.stage}`]: 'error',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }).catch(err => {
                    logger.error({ requestId, specId, stage: event.stage, error: err.message }, 'Failed to update spec error status in Firestore');
                });
            }
        };

        specEvents.on('spec.update', updateListener);
        specEvents.on('spec.complete', completeListener);
        specEvents.on('spec.error', errorListener);

        const totalTime = Date.now() - startTime;
        logger.info({ requestId, specId, duration: `${totalTime}ms` }, '[specs-routes] POST /generate-all - Job queued');

        // Return 202 Accepted - processing in background
        res.status(202).json({
            success: true,
            message: 'Spec generation started',
            specId: specId,
            jobId: job.id,
            status: job.status,
            requestId
        });

    } catch (error) {
        const totalTime = Date.now() - startTime;
        logger.error({
            requestId,
            specId: req.params.id,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            duration: `${totalTime}ms`
        }, '[specs-routes] POST /generate-all - Error');
        next(createError('Failed to start spec generation', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
            details: error.message,
            requestId
        }));
    }
});

/**
 * Generate a single section (technical, market, or design).
 * POST /api/specs/:id/generate-section
 * Body: { section: 'technical' | 'market' | 'design' }
 * Returns: 202 Accepted; runs in background and updates Firestore on success or failure.
 */
const VALID_SECTIONS = ['technical', 'market', 'design'];
router.post('/:id/generate-section', verifyFirebaseToken, async (req, res, next) => {
    const requestId = req.requestId || `generate-section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const specId = req.params.id;
    const userId = req.user.uid;
    const { section } = req.body;

    if (!section || !VALID_SECTIONS.includes(section)) {
        return next(createError('section must be one of: technical, market, design', ERROR_CODES.MISSING_REQUIRED_FIELD, 400, { requestId }));
    }

    try {
        const specDoc = await db.collection('specs').doc(specId).get();
        if (!specDoc.exists) {
            return next(createError('Specification not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404, { requestId }));
        }
        const specData = specDoc.data();
        if (specData.userId !== userId) {
            return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403, { requestId }));
        }

        const overview = specData.overview;
        const answers = Array.isArray(specData.answers) ? specData.answers : [];
        if (!overview) {
            return next(createError('Spec overview is required to generate section', ERROR_CODES.MISSING_REQUIRED_FIELD, 400, { requestId }));
        }

        await db.collection('specs').doc(specId).update({
            [`status.${section}`]: 'generating',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Run in background so we can return 202 immediately
        setImmediate(async () => {
            try {
                const result = await specGenerationServiceV2.generateSection(specId, section, overview, answers);
                await db.collection('specs').doc(specId).update({
                    [section]: result,
                    [`status.${section}`]: 'ready',
                    generationVersion: 'v2',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                logger.info({ requestId, specId, section }, '[specs-routes] POST /generate-section - Section ready');
                if (openaiStorage) {
                    triggerOpenAIUploadForSpec(specId).catch(err => {
                        logger.warn({ requestId, specId, section, error: err.message }, 'Failed to trigger OpenAI upload after generate-section');
                    });
                }
            } catch (err) {
                logger.error({ requestId, specId, section, error: err.message }, '[specs-routes] POST /generate-section - Section failed');
                await db.collection('specs').doc(specId).update({
                    [`status.${section}`]: 'error',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }).catch(updateErr => {
                    logger.error({ requestId, specId, section, error: updateErr.message }, 'Failed to update spec error status in Firestore');
                });
            }
        });

        res.status(202).json({
            success: true,
            message: 'Section generation started',
            specId,
            section,
            requestId
        });
    } catch (error) {
        logger.error({ requestId, specId, section, error: error.message }, '[specs-routes] POST /generate-section - Error');
        next(createError('Failed to start section generation', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
            details: error.message,
            requestId
        }));
    }
});

/**
 * Generate architecture section from overview + technical + market + design.
 * POST /api/specs/:id/generate-architecture
 * Returns 202 immediately; generation runs in background and updates Firestore when done.
 * The frontend listens for status.architecture changes via Firestore real-time listener.
 */
router.post('/:id/generate-architecture', verifyFirebaseToken, async (req, res, next) => {
    const requestId = req.requestId || `generate-architecture-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const specId = req.params.id;
    const userId = req.user.uid;

    try {
        const specDoc = await db.collection('specs').doc(specId).get();
        if (!specDoc.exists) {
            return next(createError('Specification not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404, { requestId }));
        }
        const specData = specDoc.data();
        if (specData.userId !== userId) {
            return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403, { requestId }));
        }

        const { overview, technical, market, design } = specData;

        if (!overview || !technical || !market || !design) {
            return next(createError(
                'Overview, technical, market, and design are required before generating architecture',
                ERROR_CODES.MISSING_REQUIRED_FIELD, 400, { requestId }
            ));
        }

        // Anchor write: marks the doc as generating so the frontend shows a spinner
        // and confirms the document is writable before the background job starts.
        await db.collection('specs').doc(specId).update({
            'status.architecture': 'generating',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Fire background generation — return 202 immediately so HTTP never times out.
        (async () => {
            try {
                const architecture = await specGenerationServiceV2.generateArchitecture(
                    specId, overview, technical, market, design
                );
                await db.collection('specs').doc(specId).update({
                    architecture,
                    'status.architecture': 'ready',
                    generationVersion: 'v2',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                specEvents.emitSpecUpdate(specId, 'architecture', 'ready', architecture);
                logger.info({ requestId, specId, duration: `${Date.now() - startTime}ms` }, '[specs-routes] Architecture generation complete');
            } catch (err) {
                logger.error({ requestId, specId, error: err.message }, '[specs-routes] Architecture background generation failed');
                db.collection('specs').doc(specId).update({
                    'status.architecture': 'error',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }).catch(() => {});
                specEvents.emitSpecError(specId, 'architecture', err);
            }
        })();

        const totalTime = Date.now() - startTime;
        logger.info({ requestId, specId, duration: `${totalTime}ms` }, '[specs-routes] POST /generate-architecture - Job started');

        res.status(202).json({
            success: true,
            message: 'Architecture generation started',
            specId,
            requestId
        });
    } catch (error) {
        const totalTime = Date.now() - startTime;
        logger.error({ requestId, specId: req.params.id, error: error.message, duration: `${totalTime}ms` }, '[specs-routes] POST /generate-architecture - Error');
        next(createError(error.message || 'Failed to start architecture generation', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
            details: error.message,
            requestId
        }));
    }
});

/**
 * Generate overview spec in background
 * POST /api/specs/generate-overview
 * Body: { userInput: string, specId?: string }
 * Returns: 202 Accepted immediately, processes in background
 */
router.post('/generate-overview', rateLimiters.generation, verifyFirebaseToken, async (req, res, next) => {
    const requestId = req.requestId || `generate-overview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    logger.info({ requestId }, '[specs-routes] POST /generate-overview - Starting overview generation');

    try {
        const userId = req.user.uid;
        const { userInput, specId } = req.body;

        if (!userInput) {
            return next(createError('userInput is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400, { requestId }));
        }

        // If specId provided, verify ownership AND commit status before background job starts.
        // Writing status.overview:'generating' before firing the background task serves two purposes:
        //  1. Confirms the spec document is fully committed and writable in Firestore.
        //  2. Eliminates the race condition where getOrCreateThread reads the doc before the
        //     client-side write has propagated to the server-side Firestore connection.
        if (specId) {
            const specDoc = await db.collection('specs').doc(specId).get();
            if (!specDoc.exists) {
                return next(createError('Specification not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404, { requestId }));
            }
            const specData = specDoc.data();
            if (specData.userId !== userId) {
                return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403, { requestId }));
            }

            // Anchor write: confirms doc is committed before background job starts.
            // If this fails with NOT_FOUND the error is caught by the outer try/catch
            // and a 500 is returned — preventing a ghost background job.
            await db.collection('specs').doc(specId).update({
                'status.overview': 'generating',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        // Generate overview in background (v2 requires specId for thread; fallback to legacy when missing)
        const generateOverview = async () => {
            try {
                const overviewContent = specId
                    ? await specGenerationServiceV2.generateOverview(specId, userInput)
                    : await specGenerationService.generateOverview(userInput);

                // If specId provided, update the spec
                if (specId) {
                    // Verify spec exists before updating
                    const specDoc = await db.collection('specs').doc(specId).get();
                    if (!specDoc.exists) {
                        // Spec was deleted (likely due to error in frontend)
                        // This is expected behavior - don't throw error, just log and return
                        logger.warn({ requestId, specId }, '[specs-routes] Spec not found when trying to update overview - likely deleted due to error');
                        return overviewContent; // Return the generated content but don't update non-existent spec
                    }
                    
                    const extractedTitle = extractTitleFromOverview(overviewContent);
                    await db.collection('specs').doc(specId).update({
                        overview: overviewContent,
                        'status.overview': 'ready',
                        title: extractedTitle,
                        generationVersion: 'v2',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    
                    // Emit event
                    specEvents.emitSpecUpdate(specId, 'overview', 'ready', overviewContent);
                }
                
                return overviewContent;
            } catch (error) {
                logger.error({ requestId, error: error.message, specId }, '[specs-routes] Overview generation failed');
                if (specId) {
                    // Verify spec exists before updating error status
                    try {
                        const specDoc = await db.collection('specs').doc(specId).get();
                        if (specDoc.exists) {
                            await db.collection('specs').doc(specId).update({
                                'status.overview': 'error',
                                updatedAt: admin.firestore.FieldValue.serverTimestamp()
                            });
                            specEvents.emitSpecError(specId, 'overview', error);
                        } else {
                            logger.warn({ requestId, specId }, '[specs-routes] Spec does not exist, cannot update error status');
                        }
                    } catch (updateError) {
                        logger.error({ requestId, specId, updateError: updateError.message }, '[specs-routes] Failed to update spec error status');
                    }
                }
                throw error;
            }
        };

        // Start generation in background (fire and forget)
        generateOverview().catch(err => {
            logger.error({ requestId, error: err.message }, '[specs-routes] Background overview generation error');
        });

        const totalTime = Date.now() - startTime;
        logger.info({ requestId, duration: `${totalTime}ms` }, '[specs-routes] POST /generate-overview - Job started');

        // Return 202 Accepted - processing in background
        res.status(202).json({
            success: true,
            message: 'Overview generation started in background',
            specId: specId || null,
            requestId
        });

    } catch (error) {
        const totalTime = Date.now() - startTime;
        logger.error({
            requestId,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            },
            duration: `${totalTime}ms`
        }, '[specs-routes] POST /generate-overview - Error');
        next(createError('Failed to start overview generation', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
            details: error.message,
            requestId
        }));
    }
});

/**
 * Get generation job status
 * GET /api/specs/:id/generation-status
 */
router.get('/:id/generation-status', verifyFirebaseToken, async (req, res, next) => {
    try {
        const specId = req.params.id;
        const userId = req.user.uid;

        // Verify spec ownership
        const specDoc = await db.collection('specs').doc(specId).get();
        
        if (!specDoc.exists) {
            return next(createError('Specification not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
        }

        const specData = specDoc.data();
        
        if (specData.userId !== userId) {
            return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403));
        }

        // Get job status from queue
        const job = specQueue.getJob(specId);

        res.json({
            success: true,
            specId: specId,
            job: job || null,
            queueStatus: specQueue.getStatus()
        });

    } catch (error) {
        logger.error({ error: error.message, specId: req.params.id }, 'Error getting generation status');
        next(createError('Failed to get generation status', ERROR_CODES.DATABASE_ERROR, 500, {
            details: error.message
        }));
    }
});

// Helper function to trigger OpenAI upload
async function triggerOpenAIUploadForSpec(specId) {
    try {
        const specDoc = await db.collection('specs').doc(specId).get();
        if (!specDoc.exists) return;

        const specData = specDoc.data();
        if (specData.openaiFileId) return; // Already uploaded

        if (openaiStorage) {
            const fileId = await openaiStorage.uploadSpec(specId, specData);
            await db.collection('specs').doc(specId).update({
                openaiFileId: fileId,
                openaiUploadTimestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (error) {
        // Non-blocking, just log
        logger.warn({ specId, error: error.message }, 'Failed to upload spec to OpenAI');
    }
}

/**
 * Record spec creation activity (called from client after spec creation)
 * POST /api/specs/:id/record-activity
 */
router.post('/:id/record-activity', verifyFirebaseToken, async (req, res, next) => {
    const requestId = req.requestId || `record-activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
        const specId = req.params.id;
        const userId = req.user.uid;
        
        // Get spec from Firestore
        const specDoc = await db.collection('specs').doc(specId).get();
        
        if (!specDoc.exists) {
            return next(createError('Specification not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
        }
        
        const specData = specDoc.data();
        
        // Verify ownership
        if (specData.userId !== userId) {
            return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403));
        }
        
        // Get user email
        const userRecord = await auth.getUser(userId);
        const userEmail = userRecord.email || null;
        
        // Record activity (fire and forget - don't block response)
        recordSpecCreation(
            specId,
            userId,
            userEmail,
            specData.title || 'Untitled',
            {
                specId,
                specTitle: specData.title,
                mode: specData.mode || 'unified'
            }
        ).catch(err => {
            logger.warn({ requestId, specId, error: err.message }, '[specs-routes] Failed to record spec creation activity');
        });
        
        // Send spec creation email notification (non-blocking)
        if (userEmail) {
            const baseUrl = process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';
            const specMode = specData.mode || 'unified';
            const isAdvanced = specMode === 'advanced' || specData.status?.technical === 'ready' || 
                               specData.status?.market === 'ready' || specData.status?.design === 'ready';
            
            // Get user display name
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data() || {};
            const displayName = userRecord.displayName || userData.displayName || userEmail.split('@')[0];
            
            // Check user email preferences for spec notifications
            const emailPrefs = userData.emailPreferences || {
                newsletter: true,
                operational: true,
                marketing: true,
                specNotifications: true,
                updates: true
            };
            
            // Check if email was already sent for this spec
            if (!specData.specCreationEmailSent && emailPrefs.specNotifications !== false && emailPrefs.operational !== false) {
                if (isAdvanced) {
                    // Send advanced spec email
                    emailService.sendAdvancedSpecReadyEmail(
                        userEmail,
                        displayName,
                        specData.title || 'App Specification',
                        specId,
                        userId,
                        baseUrl
                    ).catch(err => {
                        logger.warn({ requestId, specId, error: err.message }, '[specs-routes] Failed to send advanced spec creation email');
                    });
                } else {
                    // Send regular spec email
                    emailService.sendSpecReadyEmail(
                        userEmail,
                        displayName,
                        specData.title || 'App Specification',
                        specId,
                        userId,
                        baseUrl
                    ).catch(err => {
                        logger.warn({ requestId, specId, error: err.message }, '[specs-routes] Failed to send spec creation email');
                    });
                }
                
                // Mark email as sent
                db.collection('specs').doc(specId).update({
                    specCreationEmailSent: true,
                    specCreationEmailSentAt: admin.firestore.FieldValue.serverTimestamp()
                }).catch(err => {
                    logger.warn({ requestId, specId, error: err.message }, '[specs-routes] Failed to mark spec creation email as sent');
                });
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        logger.error({ requestId, error: error.message }, '[specs-routes] Error recording spec activity');
        // Don't fail the request if activity recording fails
        res.json({ success: false, error: error.message });
    }
});

module.exports = router;

