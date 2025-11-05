const express = require('express');
const router = express.Router();
const { db, admin, auth } = require('./firebase-admin');
const OpenAIStorageService = require('./openai-storage-service');

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
 */
router.get('/entitlements', verifyFirebaseToken, async (req, res) => {
    try {
        const userId = req.user.uid;

        // Get entitlements document
        const entitlementsDoc = await db.collection('entitlements').doc(userId).get();
        const entitlements = entitlementsDoc.exists
            ? entitlementsDoc.data()
            : {
                userId: userId,
                spec_credits: 0,
                unlimited: false,
                can_edit: false,
                preserved_credits: 0
            };

        // Get user document
        const userDoc = await db.collection('users').doc(userId).get();
        const user = userDoc.exists ? userDoc.data() : null;

        res.json({
            entitlements: {
                unlimited: entitlements.unlimited || false,
                spec_credits: entitlements.spec_credits || 0,
                can_edit: entitlements.can_edit || false,
                preserved_credits: entitlements.preserved_credits || 0
            },
            user: user
        });
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
 */
router.post('/consume-credit', verifyFirebaseToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const { specId } = req.body;

        if (!specId) {
            return res.status(400).json({ error: 'specId is required' });
        }

        // Use Firestore transaction for atomic credit consumption
        const result = await db.runTransaction(async (transaction) => {
            // Get entitlements document
            const entitlementsRef = db.collection('entitlements').doc(userId);
            const entitlementsDoc = await transaction.get(entitlementsRef);
            const entitlements = entitlementsDoc.exists
                ? entitlementsDoc.data()
                : {
                    userId: userId,
                    spec_credits: 0,
                    unlimited: false,
                    can_edit: false
                };

            // Check if user has unlimited access (Pro subscription)
            if (entitlements.unlimited) {
                return {
                    success: true,
                    remaining: null,
                    creditType: 'unlimited'
                };
            }

            // Check if user has paid credits
            const specCredits = entitlements.spec_credits || 0;
            if (specCredits > 0) {
                // Decrement spec_credits
                transaction.update(entitlementsRef, {
                    spec_credits: admin.firestore.FieldValue.increment(-1),
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                });

                return {
                    success: true,
                    remaining: specCredits - 1,
                    creditType: 'paid'
                };
            }

            // Check free specs from users collection
            const userRef = db.collection('users').doc(userId);
            const userDoc = await transaction.get(userRef);
            
            if (!userDoc.exists) {
                // User document doesn't exist - this shouldn't happen in normal flow
                // Create it with 0 free specs (user should have been created during signup)
                // This prevents infinite free specs for users without documents
                transaction.set(userRef, {
                    free_specs_remaining: 0,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                throw new Error('Insufficient credits');
            }
            
            const userData = userDoc.data();
            // Default to 0 if not set (don't assume 1 for existing users)
            const freeSpecsRemaining = typeof userData?.free_specs_remaining === 'number'
                ? Math.max(0, userData.free_specs_remaining)
                : 0;

            if (freeSpecsRemaining > 0) {
                // Decrement free_specs_remaining
                transaction.update(userRef, {
                    free_specs_remaining: admin.firestore.FieldValue.increment(-1)
                });

                return {
                    success: true,
                    remaining: freeSpecsRemaining - 1,
                    creditType: 'free'
                };
            }

            // No credits available
            throw new Error('Insufficient credits');
        });

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
    try {
        const specId = req.params.id;
        const userId = req.user.uid;

        if (!openaiStorage) {
            return res.status(503).json({ error: 'OpenAI not configured' });
        }

        // Verify spec ownership
        const specDoc = await db.collection('specs').doc(specId).get();
        if (!specDoc.exists) {
            return res.status(404).json({ error: 'Specification not found' });
        }

        const specData = specDoc.data();
        if (specData.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Check if already uploaded
        if (specData.openaiFileId) {
            return res.json({ 
                success: true, 
                message: 'Spec already uploaded to OpenAI',
                fileId: specData.openaiFileId
            });
        }

        // Upload to OpenAI
        const fileId = await openaiStorage.uploadSpec(specId, specData);

        // Update spec with OpenAI file ID
        await db.collection('specs').doc(specId).update({
            openaiFileId: fileId,
            openaiUploadTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ 
            success: true, 
            message: 'Spec uploaded to OpenAI successfully',
            fileId: fileId
        });
    } catch (error) {
        console.error('Error uploading spec to OpenAI:', error);
        res.status(500).json({ 
            error: 'Failed to upload spec to OpenAI',
            details: error.message 
        });
    }
});

module.exports = router;

