const express = require('express');
const router = express.Router();
const { auth, db, admin } = require('./firebase-admin');
const { checkUserCanCreateSpec, consumeSpecCredit, refundSpecCredit, getUserEntitlements, checkCanEditSpec } = require('./entitlement-service');
const fetch = require('node-fetch');
const Joi = require('joi');
const OpenAIStorageService = require('./openai-storage-service');

// Input validation schemas
const createSpecSchema = Joi.object({
    userInput: Joi.string().required().min(10).max(50000)
});

const checkEditSchema = Joi.object({
    specId: Joi.string().required().pattern(/^[a-zA-Z0-9\-_]+$/)
});

// Input validation middleware
function validateInput(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ 
                error: 'Invalid input', 
                details: error.details.map(d => d.message) 
            });
        }
        req.body = value;
        next();
    };
}

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
        console.error('Error verifying Firebase token:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
}

/**
 * Route to create a new specification
 * POST /api/specs/create
 */
router.post('/create', verifyFirebaseToken, validateInput(createSpecSchema), async (req, res) => {
    try {
        console.log('🔵 [POST /api/specs/create] Request received');
        const userId = req.user.uid;
        const { userInput } = req.body;
        console.log('🔵 [POST /api/specs/create] User ID:', userId);
        console.log('🔵 [POST /api/specs/create] Input length:', userInput?.length || 0);

        // Check if user can create a spec
        const canCreateResult = await checkUserCanCreateSpec(userId);
        console.log('🔵 [POST /api/specs/create] Can create result:', canCreateResult);
        
        if (!canCreateResult.canCreate) {
            // Return paywall data for frontend
            return res.status(402).json({
                error: 'Payment required',
                paywall: {
                    message: 'You need to purchase credits to create more specifications',
                    options: [
                        {
                            id: 'single_spec',
                            name: 'Single Spec',
                            price: 4.90,
                            currency: 'USD',
                            description: '1 additional specification'
                        },
                        {
                            id: 'three_pack',
                            name: '3-Pack',
                            price: 9.90,
                            currency: 'USD',
                            description: '3 additional specifications (Save $5)'
                        },
                        {
                            id: 'pro_monthly',
                            name: 'Pro Monthly',
                            price: 29.90,
                            currency: 'USD',
                            description: 'Unlimited specifications + editing'
                        },
                        {
                            id: 'pro_yearly',
                            name: 'Pro Yearly',
                            price: 299.90,
                            currency: 'USD',
                            description: 'Unlimited specifications + editing (Save $58.90)'
                        }
                    ]
                }
            });
        }

        // Consume credit BEFORE generation to prevent bypass
        console.log('🔵 [POST /api/specs/create] Calling consumeSpecCredit...');
        const creditResult = await consumeSpecCredit(userId);
        console.log('🔵 [POST /api/specs/create] Credit result:', creditResult);
        if (!creditResult.success) {
            console.log('🔵 [POST /api/specs/create] Credit consumption failed - returning 402');
            return res.status(402).json({
                error: 'Failed to consume credit - insufficient credits',
                paywall: {
                    message: 'You need to purchase credits to create more specifications',
                    options: [
                        {
                            id: 'single_spec',
                            name: 'Single Spec',
                            price: 4.90,
                            currency: 'USD',
                            description: '1 additional specification'
                        },
                        {
                            id: 'three_pack',
                            name: '3-Pack',
                            price: 9.90,
                            currency: 'USD',
                            description: '3 additional specifications (Save $5)'
                        },
                        {
                            id: 'pro_monthly',
                            name: 'Pro Monthly',
                            price: 29.90,
                            currency: 'USD',
                            description: 'Unlimited specifications + editing'
                        },
                        {
                            id: 'pro_yearly',
                            name: 'Pro Yearly',
                            price: 299.90,
                            currency: 'USD',
                            description: 'Unlimited specifications + editing (Save $58.90)'
                        }
                    ]
                }
            });
        }

        // Track which credit type was consumed for proper refund if needed
        const consumedCreditType = creditResult.creditType;
        console.log('🔵 [POST /api/specs/create] Credit consumed successfully, type:', consumedCreditType);

        // Generate specification using existing API
        // NOTE: Users can provide answers in any language, but the API will always return the specification in English
        console.log('🔵 [POST /api/specs/create] Generating specification...');
        let specification;
        try {
            const requestBody = {
                stage: 'overview',
                locale: 'en-US',  // Force English output regardless of input language
                temperature: 0,
                prompt: {
                    system: 'You are a professional product manager and UX architect. Generate a comprehensive application overview based on user input. IMPORTANT: Always respond in English, regardless of the language used in the user input.',
                    developer: 'Create a detailed overview that includes application summary, core features, user journey, target audience, problem statement, and unique value proposition. Ensure all output is in English.',
                    user: userInput
                }
            };

            const apiResponse = await fetch('https://spspec.shalom-cohen-111.workers.dev/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!apiResponse.ok) {
                // Credit was already consumed, refund it to the correct source
                await refundSpecCredit(userId, consumedCreditType);
                throw new Error(`API error: ${apiResponse.status}`);
            }

            specification = await apiResponse.text();
        } catch (error) {
            // Credit was already consumed, refund it to the correct source
            await refundSpecCredit(userId, consumedCreditType);
            throw error;
        }

        // Return the specification
        console.log('🔵 [POST /api/specs/create] Specification generated successfully, returning response');
        res.json({
            success: true,
            specification: specification,
            creditsRemaining: canCreateResult.creditsRemaining === 'unlimited' ? 'unlimited' : canCreateResult.creditsRemaining - 1
        });
        console.log('🔵 [POST /api/specs/create] Request completed successfully');

    } catch (error) {
        console.error('❌ [POST /api/specs/create] Error creating specification:', error);
        res.status(500).json({ 
            error: 'Failed to create specification',
            details: error.message 
        });
    }
});

/**
 * Route to get user entitlements
 * GET /api/specs/entitlements
 */
router.get('/entitlements', verifyFirebaseToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const entitlements = await getUserEntitlements(userId);
        
        res.json({
            success: true,
            ...entitlements
        });

    } catch (error) {
        console.error('Error getting entitlements:', error);
        res.status(500).json({ 
            error: 'Failed to get entitlements',
            details: error.message 
        });
    }
});

/**
 * Route to check if user can edit a specification
 * POST /api/specs/check-edit
 */
router.post('/check-edit', verifyFirebaseToken, async (req, res) => {
    try {
        // Validate input
        const { error, value } = checkEditSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ 
                error: 'Invalid input', 
                details: error.details[0].message 
            });
        }

        const userId = req.user.uid;
        const { specId } = value;

        const canEdit = await checkCanEditSpec(userId, specId);
        
        res.json({
            success: true,
            canEdit: canEdit
        });

    } catch (error) {
        console.error('Error checking edit permission:', error);
        res.status(500).json({ 
            error: 'Failed to check edit permission',
            details: error.message 
        });
    }
});

/**
 * Route to get specification creation status
 * GET /api/specs/status
 */
router.get('/status', verifyFirebaseToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const canCreateResult = await checkUserCanCreateSpec(userId);
        
        res.json({
            success: true,
            canCreate: canCreateResult.canCreate,
            reason: canCreateResult.reason,
            creditsRemaining: canCreateResult.creditsRemaining
        });

    } catch (error) {
        console.error('Error getting spec status:', error);
        res.status(500).json({ 
            error: 'Failed to get spec status',
            details: error.message 
        });
    }
});

// Initialize OpenAI Storage Service
const openaiStorage = process.env.OPENAI_API_KEY 
  ? new OpenAIStorageService(process.env.OPENAI_API_KEY)
  : null;

/**
 * Background upload function (non-blocking)
 * This uploads a spec to OpenAI Storage after Firebase save
 */
async function uploadToOpenAIBackground(specId, specData) {
  // Only if feature is enabled
  if (!process.env.ENABLE_OPENAI_STORAGE || process.env.ENABLE_OPENAI_STORAGE !== 'true') {
    return;
  }
  
  if (!openaiStorage) {
    console.warn('[OpenAI Storage] Service not configured');
    return;
  }
  
  try {
    console.log(`[Background] Uploading spec ${specId} to OpenAI...`);
    
    const fileId = await openaiStorage.uploadSpec(specId, specData);
    
    await db.collection('specs').doc(specId).update({
      openaiFileId: fileId,
      uploadedToOpenAI: true,
      openaiUploadTimestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`[Background] ✓ Successfully uploaded spec ${specId} to OpenAI (file ID: ${fileId})`);
  } catch (error) {
    console.error(`[Background] Failed to upload spec ${specId}:`, error.message);
    
    // Store error for debugging
    try {
      await db.collection('specs').doc(specId).update({
        openaiUploadError: error.message,
        uploadedToOpenAI: false
      });
    } catch (updateError) {
      console.error('Failed to store upload error:', updateError);
    }
  }
}

/**
 * Route to manually upload spec to OpenAI (for testing)
 * POST /api/specs/:specId/upload-to-openai
 */
router.post('/:specId/upload-to-openai', verifyFirebaseToken, async (req, res) => {
  try {
    if (!openaiStorage) {
      return res.status(503).json({ error: 'OpenAI storage not configured' });
    }

    const { specId } = req.params;
    const userId = req.user.uid;
    
    // Verify ownership
    const specRef = db.collection('specs').doc(specId);
    const specDoc = await specRef.get();
    
    if (!specDoc.exists) {
      return res.status(404).json({ error: 'Spec not found' });
    }
    
    if (specDoc.data().userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const specData = specDoc.data();
    
    // Upload to OpenAI
    console.log(`[Manual Upload] Uploading spec ${specId} to OpenAI...`);
    const fileId = await openaiStorage.uploadSpec(specId, specData);
    
    // Update Firebase
    await specRef.update({
      openaiFileId: fileId,
      uploadedToOpenAI: true,
      openaiUploadTimestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`[Manual Upload] ✓ Successfully uploaded spec ${specId} (file ID: ${fileId})`);
    
    res.json({
      success: true,
      fileId: fileId,
      message: 'Spec uploaded to OpenAI successfully'
    });
    
  } catch (error) {
    console.error('Error uploading to OpenAI:', error);
    res.status(500).json({ 
      error: 'Failed to upload to OpenAI',
      details: error.message 
    });
  }
});

/**
 * Route to get OpenAI storage status (admin only)
 * GET /api/specs/openai-status
 */
router.get('/openai-status', verifyFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    // Get statistics
    const totalSpecsSnapshot = await db.collection('specs').count().get();
    const uploadedSpecsSnapshot = await db.collection('specs')
      .where('uploadedToOpenAI', '==', true)
      .count()
      .get();
    const failedSpecsSnapshot = await db.collection('specs')
      .where('openaiUploadError', '!=', null)
      .count()
      .get();
    
    const total = totalSpecsSnapshot.data().count;
    const uploaded = uploadedSpecsSnapshot.data().count;
    const failed = failedSpecsSnapshot.data().count;
    
    res.json({
      success: true,
      total: total,
      uploaded: uploaded,
      failed: failed,
      notUploaded: total - uploaded,
      percentage: total > 0 ? ((uploaded / total) * 100).toFixed(2) : 0,
      enabled: process.env.ENABLE_OPENAI_STORAGE === 'true'
    });
    
  } catch (error) {
    console.error('Error getting OpenAI status:', error);
    res.status(500).json({ 
      error: 'Failed to get status',
      details: error.message 
    });
  }
});

module.exports = router;