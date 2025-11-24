const express = require('express');
const router = express.Router();
const { db, admin, auth } = require('./firebase-admin');
const OpenAIStorageService = require('./openai-storage-service');
const creditsService = require('./credits-service');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');

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
      }
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
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Spec ready notification email sent successfully to:', userEmail);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Error sending spec ready notification email:', error);
    // Don't fail the entire request if email fails
    return { success: false, error: error.message };
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
 * Get user entitlements
 * GET /api/specs/entitlements
 * Note: This endpoint is kept for backward compatibility
 * New code should use /api/credits/entitlements
 */
router.get('/entitlements', verifyFirebaseToken, async (req, res, next) => {
    try {
        const userId = req.user.uid;
        const result = await creditsService.getEntitlements(userId);
        res.json(result);
    } catch (error) {
        logger.error({ error: error.message, userId }, 'Error fetching entitlements');
        next(createError('Failed to fetch entitlements', ERROR_CODES.DATABASE_ERROR, 500, { details: error.message }));
    }
});

/**
 * Consume a credit when creating a spec
 * POST /api/specs/consume-credit
 * Body: { specId: string }
 * Note: Uses credits-service for atomic credit consumption with validation
 */
router.post('/consume-credit', verifyFirebaseToken, async (req, res, next) => {
    try {
        const userId = req.user.uid;
        const { specId } = req.body;

        if (!specId) {
            return next(createError('specId is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
        }

        // Use credits-service for atomic credit consumption
        const result = await creditsService.consumeCredit(userId, specId);

        res.json(result);
    } catch (error) {
        logger.error({ error: error.message, userId }, 'Error consuming credit');
        
        if (error.message === 'Insufficient credits') {
            return next(createError('Insufficient credits', ERROR_CODES.INSUFFICIENT_PERMISSIONS, 403, {
                message: 'You do not have enough credits to create a spec'
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

module.exports = router;

