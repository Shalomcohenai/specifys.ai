const express = require('express');
const router = express.Router();
const { db, admin, auth } = require('./firebase-admin');
const OpenAIStorageService = require('./openai-storage-service');
const creditsV2Service = require('./credits-v2-service');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');
const { rateLimiters } = require('./security');
const specGenerationService = require('./spec-generation-service');
const specQueue = require('./spec-queue');
const specEvents = require('./spec-events');
const { recordSpecCreation } = require('./admin-activity-service');

/**
 * Function to send spec ready notification email
 */
async function sendSpecReadyEmail(userEmail, specTitle, specId, baseUrl) {
  try {
    // Check if email configuration is available
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_APP_PASSWORD;
    
    if (!emailUser || !emailPassword) {
      console.log('⚠️  Email configuration not found - skipping spec ready notification');
      return { success: false, reason: 'Email not configured' };
    }
    
    if (!userEmail) {
      console.log('⚠️  User email not provided - skipping spec ready notification');
      return { success: false, reason: 'User email missing' };
    }
    
    // Use Nodemailer to send email
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPassword
      },
      // Add timeout and connection settings
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 5000, // 5 seconds
      socketTimeout: 10000, // 10 seconds
      // Retry settings
      pool: true,
      maxConnections: 1,
      maxMessages: 3
    });
    
    // Generate spec link
    const specLink = `${baseUrl}/pages/spec-viewer.html?id=${specId}`;
    
    const mailOptions = {
      from: `"Specifys.ai" <${emailUser}>`,
      to: userEmail,
      subject: `Your specification "${specTitle}" is ready!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Your Specification is Ready!</h1>
          </div>
          
          <div style="background: #ffffff; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Hello! 👋
            </p>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Your specification <strong>"${specTitle}"</strong> is ready! You can always access it to view and upgrade it.
            </p>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${specLink}" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                View Your Specification
              </a>
            </div>
            
            <p style="color: #888; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; padding-top: 20px; border-top: 1px solid #eee;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${specLink}" style="color: #667eea; word-break: break-all;">${specLink}</a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>This email was sent by Specifys.ai</p>
          </div>
        </div>
      `
    };
    
    // Send email with timeout
    const sendEmailPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email send timeout after 15 seconds')), 15000);
    });
    
    const info = await Promise.race([sendEmailPromise, timeoutPromise]);
    console.log('✅ Spec ready notification email sent successfully to:', userEmail);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    const errorMessage = error.message || 'Unknown error';
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT');
    
    if (isTimeout) {
      console.error('❌ Error sending spec ready notification email: Connection timeout');
    } else {
      console.error('❌ Error sending spec ready notification email:', error);
    }
    
    // Don't fail the entire request if email fails
    return { success: false, error: errorMessage, isTimeout };
  }
}

const openaiStorage = process.env.OPENAI_API_KEY 
  ? new OpenAIStorageService(process.env.OPENAI_API_KEY)
  : null;

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

// /entitlements endpoint removed - use /api/v2/credits instead

/**
 * Consume a credit when creating a spec
 * POST /api/specs/consume-credit
 * Body: { specId: string }
 * DEPRECATED: This endpoint is deprecated. Use /api/v2/credits/consume instead.
 * Kept for backward compatibility during migration.
 * Rate limited to prevent abuse
 */
router.post('/consume-credit', rateLimiters.creditConsumption, verifyFirebaseToken, async (req, res, next) => {
    try {
        const userId = req.user.uid;
        const { specId } = req.body;

        if (!specId) {
            return next(createError('specId is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
        }

        // Use new credits V2 service
        const result = await creditsV2Service.consumeCredit(userId, specId);

        res.json(result);
    } catch (error) {
        logger.error({ error: error.message, userId }, 'Error consuming credit');
        
        if (error.message === 'Insufficient credits') {
            return next(createError('Insufficient credits', ERROR_CODES.INSUFFICIENT_PERMISSIONS, 403, {
                message: 'You do not have enough credits to create a spec'
            }));
        }
        
        if (error.message === 'User already has a spec. Only one spec per user is allowed.') {
            return next(createError('User already has a spec', ERROR_CODES.INSUFFICIENT_PERMISSIONS, 403, {
                message: 'You already have a spec. Only one spec per user is allowed. Please edit your existing spec instead.'
            }));
        }
        
        // Handle spec validation errors
        if (error.message.includes('does not exist') || error.message.includes('does not belong')) {
            return next(createError('Invalid spec', ERROR_CODES.INVALID_INPUT, 400, {
                message: error.message
            }));
        }

        next(createError('Failed to consume credit', ERROR_CODES.DATABASE_ERROR, 500, { details: error.message }));
    }
});

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
        
        // Get base URL from request or use default
        const baseUrl = req.headers.origin || process.env.BASE_URL || 'https://specifys.ai';
        
        // Send email
        const emailResult = await sendSpecReadyEmail(
            userEmail,
            specData.title || 'App Specification',
            specId,
            baseUrl
        );
        
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

        if (!Array.isArray(answers) || answers.length === 0) {
            return next(createError('answers array is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400, { requestId }));
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

        // Update status to generating
        await db.collection('specs').doc(specId).update({
            'status.technical': 'generating',
            'status.market': 'generating',
            'status.design': 'generating',
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
        
        res.json({ success: true });
    } catch (error) {
        logger.error({ requestId, error: error.message }, '[specs-routes] Error recording spec activity');
        // Don't fail the request if activity recording fails
        res.json({ success: false, error: error.message });
    }
});

module.exports = router;

