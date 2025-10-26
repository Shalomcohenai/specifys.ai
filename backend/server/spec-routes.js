const express = require('express');
const router = express.Router();
const { auth } = require('./firebase-admin');
const { checkUserCanCreateSpec, consumeSpecCredit, getUserEntitlements, checkCanEditSpec } = require('./entitlement-service');
const fetch = require('node-fetch');
const Joi = require('joi');

// Input validation schemas
const createSpecSchema = Joi.object({
    userInput: Joi.string().required().min(10).max(10000).pattern(/^[a-zA-Z0-9\s\.,!?\-_()]+$/)
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
        const userId = req.user.uid;
        const { userInput } = req.body;

        // Check if user can create a spec
        const canCreateResult = await checkUserCanCreateSpec(userId);
        
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

        // Generate specification using existing API
        const requestBody = {
            stage: 'overview',
            locale: 'en-US',
            temperature: 0,
            prompt: {
                system: 'You are a professional product manager and UX architect. Generate a comprehensive application overview based on user input.',
                developer: 'Create a detailed overview that includes application summary, core features, user journey, target audience, problem statement, and unique value proposition.',
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
            throw new Error(`API error: ${apiResponse.status}`);
        }

        const specification = await apiResponse.text();

        // Consume credit after successful generation
        const creditConsumed = await consumeSpecCredit(userId);
        if (!creditConsumed) {
            console.error('Failed to consume credit for user:', userId);
            // Don't fail the request since spec was already generated
        }

        // Return the specification
        res.json({
            success: true,
            specification: specification,
            creditsRemaining: canCreateResult.creditsRemaining === 'unlimited' ? 'unlimited' : canCreateResult.creditsRemaining - 1
        });

    } catch (error) {
        console.error('Error creating specification:', error);
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

module.exports = router;