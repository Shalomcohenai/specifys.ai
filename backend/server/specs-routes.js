const express = require('express');
const router = express.Router();
const { db, admin, auth } = require('./firebase-admin');
const OpenAIStorageService = require('./openai-storage-service');
const creditsService = require('./credits-service');

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

module.exports = router;

