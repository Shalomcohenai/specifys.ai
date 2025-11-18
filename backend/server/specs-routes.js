const express = require('express');
const router = express.Router();
const { db, admin, auth } = require('./firebase-admin');
const OpenAIStorageService = require('./openai-storage-service');
const creditsService = require('./credits-service');

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
    
    const transporter = nodemailer.createTransporter({
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
        console.error('Error verifying token:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
}

/**
 * Get user entitlements
 * GET /api/specs/entitlements
 * Note: This endpoint is kept for backward compatibility
 * New code should use /api/credits/entitlements
 */
router.get('/entitlements', verifyFirebaseToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const result = await creditsService.getEntitlements(userId);
        res.json(result);
    } catch (error) {
        console.error('Error fetching entitlements:', error);
        res.status(500).json({
            error: 'Failed to fetch entitlements',
            details: error.message
        });
    }
});

/**
 * Consume a credit when creating a spec
 * POST /api/specs/consume-credit
 * Body: { specId: string }
 * Note: Uses credits-service for atomic credit consumption with validation
 */
router.post('/consume-credit', verifyFirebaseToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const { specId } = req.body;

        if (!specId) {
            return res.status(400).json({ error: 'specId is required' });
        }

        // Use credits-service for atomic credit consumption
        const result = await creditsService.consumeCredit(userId, specId);

        res.json(result);
    } catch (error) {
        console.error('Error consuming credit:', error);
        
        if (error.message === 'Insufficient credits') {
            return res.status(403).json({
                error: 'Insufficient credits',
                message: 'You do not have enough credits to create a spec'
            });
        }

        res.status(500).json({
            error: 'Failed to consume credit',
            details: error.message
        });
    }
});

/**
 * Upload spec to OpenAI Storage
 * POST /api/specs/:id/upload-to-openai
 */
router.post('/:id/upload-to-openai', verifyFirebaseToken, async (req, res) => {
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
            console.error(`[${requestId}] ❌ OpenAI not configured`);
            const totalTime = Date.now() - startTime;
            console.error(`[${requestId}] ===== /api/specs/:id/upload-to-openai FAILED (${totalTime}ms) =====`);
            return res.status(503).json({ error: 'OpenAI not configured', requestId });
        }

        // Verify spec ownership
        console.log(`[${requestId}] 📤 Step 1: Verifying spec ownership`);
        const specCheckStart = Date.now();
        const specDoc = await db.collection('specs').doc(specId).get();
        const specCheckTime = Date.now() - specCheckStart;
        console.log(`[${requestId}] ⏱️  Spec check took ${specCheckTime}ms`);
        
        if (!specDoc.exists) {
            console.error(`[${requestId}] ❌ Spec not found: ${specId}`);
            const totalTime = Date.now() - startTime;
            console.error(`[${requestId}] ===== /api/specs/:id/upload-to-openai FAILED (${totalTime}ms) =====`);
            return res.status(404).json({ error: 'Specification not found', requestId });
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
            console.error(`[${requestId}] ❌ Unauthorized: User ${userId} does not own spec ${specId}`);
            const totalTime = Date.now() - startTime;
            console.error(`[${requestId}] ===== /api/specs/:id/upload-to-openai FAILED (${totalTime}ms) =====`);
            return res.status(403).json({ error: 'Unauthorized', requestId });
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
        console.error(`[${requestId}] ❌ ERROR in /api/specs/:id/upload-to-openai (${totalTime}ms):`, {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        console.error(`[${requestId}] ===== /api/specs/:id/upload-to-openai ERROR =====`);
        res.status(500).json({ 
            error: 'Failed to upload spec to OpenAI',
            details: error.message,
            requestId
        });
    }
});

/**
 * Send spec ready notification email
 * POST /api/specs/:id/send-ready-notification
 */
router.post('/:id/send-ready-notification', verifyFirebaseToken, async (req, res) => {
    try {
        const specId = req.params.id;
        const userId = req.user.uid;
        
        // Get spec from Firestore
        const specDoc = await db.collection('specs').doc(specId).get();
        
        if (!specDoc.exists) {
            return res.status(404).json({ error: 'Specification not found' });
        }
        
        const specData = specDoc.data();
        
        // Verify ownership
        if (specData.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        // Check if overview is ready
        if (specData.status?.overview !== 'ready') {
            return res.status(400).json({ 
                error: 'Specification overview is not ready yet',
                status: specData.status?.overview 
            });
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
            return res.status(400).json({ error: 'User email not found' });
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
        console.error('Error sending spec ready notification:', error);
        res.status(500).json({ 
            error: 'Failed to send notification',
            details: error.message
        });
    }
});

module.exports = router;

