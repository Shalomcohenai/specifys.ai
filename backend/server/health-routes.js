/**
 * Health Check Routes
 * 
 * Provides health monitoring endpoints for the credits system
 */

const express = require('express');
const router = express.Router();
const { db } = require('./firebase-admin');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');

// Use built-in fetch for Node.js 18+ or fallback to node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  fetch = require('node-fetch');
}

/**
 * General health check
 * GET /api/health
 */
router.get('/', async (req, res, next) => {
    const requestId = req.requestId || `health-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.debug({ requestId }, '[health-routes] GET / - General health check');
    
    try {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'Specifys.AI Backend',
            version: '1.0.0'
        });
    } catch (error) {
        logger.error({ requestId, error: { message: error.message } }, '[health-routes] GET / - Error');
        // Health checks should return status codes, not use error handler
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            errorCode: ERROR_CODES.INTERNAL_ERROR
        });
    }
});

/**
 * Credits system health check
 * GET /api/health/credits
 */
router.get('/credits', async (req, res) => {
    const requestId = req.requestId || `health-credits-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.debug({ requestId }, '[health-routes] GET /credits - Credits health check');
    
    try {
        // Count users by type
        const proUsersSnapshot = await db.collection('entitlements')
            .where('unlimited', '==', true)
            .count()
            .get();
        
        const creditUsersSnapshot = await db.collection('entitlements')
            .where('spec_credits', '>', 0)
            .count()
            .get();
        
        // Get total users
        const totalUsersSnapshot = await db.collection('users').count().get();
        
        // Get active subscriptions
        const activeSubsSnapshot = await db.collection('subscriptions')
            .where('status', '==', 'active')
            .count()
            .get();
        
        const proUsers = proUsersSnapshot.data().count;
        const creditUsers = creditUsersSnapshot.data().count;
        const totalUsers = totalUsersSnapshot.data().count;
        const activeSubs = activeSubsSnapshot.data().count;
        
        // Calculate percentages
        const proPercentage = totalUsers > 0 ? ((proUsers / totalUsers) * 100).toFixed(2) : 0;
        const creditPercentage = totalUsers > 0 ? ((creditUsers / totalUsers) * 100).toFixed(2) : 0;
        
        logger.debug({ requestId, totalUsers, proUsers, creditUsers }, '[health-routes] GET /credits - Success');
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            stats: {
                totalUsers,
                proUsers,
                creditUsers,
                freeUsers: totalUsers - proUsers - creditUsers,
                activeSubscriptions: activeSubs
            },
            percentages: {
                pro: `${proPercentage}%`,
                credit: `${creditPercentage}%`,
                free: `${(100 - parseFloat(proPercentage) - parseFloat(creditPercentage)).toFixed(2)}%`
            }
        });
        
    } catch (error) {
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[health-routes] GET /credits - Error');
        // Health checks should return status codes, not use error handler
        res.status(500).json({ 
            status: 'unhealthy', 
            error: error.message,
            errorCode: ERROR_CODES.DATABASE_ERROR,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Database connectivity check
 * GET /api/health/database
 */
router.get('/database', async (req, res) => {
    const requestId = req.requestId || `health-db-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    logger.debug({ requestId }, '[health-routes] GET /database - Database health check');
    
    try {
        // Simple database read to check connectivity
        await db.collection('users').limit(1).get();
        const responseTime = Date.now() - startTime;
        
        logger.debug({ requestId, responseTime }, '[health-routes] GET /database - Success');
        res.json({
            status: 'healthy',
            database: 'Firestore',
            connected: true,
            responseTime: `${responseTime}ms`,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        logger.error({ requestId, error: { message: error.message, stack: error.stack }, responseTime }, '[health-routes] GET /database - Error');
        // Health checks should return status codes, not use error handler
        res.status(500).json({
            status: 'unhealthy',
            database: 'Firestore',
            connected: false,
            responseTime: `${responseTime}ms`,
            error: error.message,
            errorCode: ERROR_CODES.DATABASE_ERROR,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * OpenAI API connectivity check
 * GET /api/health/openai
 */
router.get('/openai', async (req, res) => {
    const requestId = req.requestId || `health-openai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    logger.debug({ requestId }, '[health-routes] GET /openai - OpenAI health check');
    
    try {
        if (!process.env.OPENAI_API_KEY) {
            logger.warn({ requestId }, '[health-routes] OpenAI API key not configured');
            return res.json({
                status: 'warning',
                service: 'OpenAI API',
                configured: false,
                message: 'OPENAI_API_KEY not configured',
                timestamp: new Date().toISOString()
            });
        }

        // Simple API call to check connectivity (list models endpoint)
        const response = await fetch('https://api.openai.com/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
            logger.debug({ requestId, responseTime }, '[health-routes] GET /openai - Success');
            res.json({
                status: 'healthy',
                service: 'OpenAI API',
                connected: true,
                responseTime: `${responseTime}ms`,
                timestamp: new Date().toISOString()
            });
        } else {
            logger.warn({ requestId, httpStatus: response.status, responseTime }, '[health-routes] GET /openai - Unhealthy');
            // Health checks should return status codes, not use error handler
            res.status(500).json({
                status: 'unhealthy',
                service: 'OpenAI API',
                connected: false,
                responseTime: `${responseTime}ms`,
                httpStatus: response.status,
                error: `HTTP ${response.status}`,
                errorCode: ERROR_CODES.EXTERNAL_SERVICE_ERROR,
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        logger.error({ requestId, error: { message: error.message, stack: error.stack }, responseTime }, '[health-routes] GET /openai - Error');
        // Health checks should return status codes, not use error handler
        res.status(500).json({
            status: 'unhealthy',
            service: 'OpenAI API',
            connected: false,
            responseTime: `${responseTime}ms`,
            error: error.message,
            errorCode: ERROR_CODES.EXTERNAL_SERVICE_ERROR,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Cloudflare Worker connectivity check
 * GET /api/health/cloudflare-worker
 */
router.get('/cloudflare-worker', async (req, res) => {
    const requestId = req.requestId || `health-worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    logger.debug({ requestId }, '[health-routes] GET /cloudflare-worker - Cloudflare Worker health check');
    
    try {
        const workerUrl = 'https://spspec.shalom-cohen-111.workers.dev/generate';
        
        // Simple health check - try to reach the worker
        const response = await fetch(workerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                stage: 'overview',
                locale: 'en-US',
                prompt: {
                    system: 'Test',
                    developer: 'Test',
                    user: 'Test'
                }
            }),
            signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        const responseTime = Date.now() - startTime;
        
        // Worker might return error for test request, but if it responds, it's healthy
        if (response.status < 500) {
            logger.debug({ requestId, httpStatus: response.status, responseTime }, '[health-routes] GET /cloudflare-worker - Success');
            res.json({
                status: 'healthy',
                service: 'Cloudflare Worker',
                connected: true,
                responseTime: `${responseTime}ms`,
                httpStatus: response.status,
                timestamp: new Date().toISOString()
            });
        } else {
            logger.warn({ requestId, httpStatus: response.status, responseTime }, '[health-routes] GET /cloudflare-worker - Unhealthy');
            // Health checks should return status codes, not use error handler
            res.status(500).json({
                status: 'unhealthy',
                service: 'Cloudflare Worker',
                connected: false,
                responseTime: `${responseTime}ms`,
                httpStatus: response.status,
                error: `HTTP ${response.status}`,
                errorCode: ERROR_CODES.EXTERNAL_SERVICE_ERROR,
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        logger.error({ requestId, error: { message: error.message, stack: error.stack }, responseTime }, '[health-routes] GET /cloudflare-worker - Error');
        // Health checks should return status codes, not use error handler
        res.status(500).json({
            status: 'unhealthy',
            service: 'Cloudflare Worker',
            connected: false,
            responseTime: `${responseTime}ms`,
            error: error.message,
            errorCode: ERROR_CODES.EXTERNAL_SERVICE_ERROR,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Comprehensive health check - checks all services
 * GET /api/health/comprehensive
 */
router.get('/comprehensive', async (req, res) => {
    const checks = {
        database: { status: 'unknown', responseTime: null, error: null },
        openai: { status: 'unknown', responseTime: null, error: null },
        cloudflareWorker: { status: 'unknown', responseTime: null, error: null }
    };
    
    let overallStatus = 'healthy';
    
    // Check database
    try {
        const dbStart = Date.now();
        await db.collection('users').limit(1).get();
        checks.database = {
            status: 'healthy',
            responseTime: Date.now() - dbStart
        };
    } catch (error) {
        checks.database = {
            status: 'unhealthy',
            error: error.message
        };
        overallStatus = 'unhealthy';
    }
    
    // Check OpenAI (if configured)
    if (process.env.OPENAI_API_KEY) {
        try {
            const openaiStart = Date.now();
            const response = await fetch('https://api.openai.com/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                },
                signal: AbortSignal.timeout(5000)
            });
            checks.openai = {
                status: response.ok ? 'healthy' : 'unhealthy',
                responseTime: Date.now() - openaiStart,
                httpStatus: response.status
            };
            if (!response.ok) overallStatus = 'unhealthy';
        } catch (error) {
            checks.openai = {
                status: 'unhealthy',
                error: error.message
            };
            overallStatus = 'unhealthy';
        }
    } else {
        checks.openai = {
            status: 'not_configured',
            message: 'OPENAI_API_KEY not set'
        };
    }
    
    // Check Cloudflare Worker
    try {
        const workerStart = Date.now();
        const response = await fetch('https://spspec.shalom-cohen-111.workers.dev/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stage: 'overview', locale: 'en-US', prompt: { system: 'Test', developer: 'Test', user: 'Test' } }),
            signal: AbortSignal.timeout(10000)
        });
        checks.cloudflareWorker = {
            status: response.status < 500 ? 'healthy' : 'unhealthy',
            responseTime: Date.now() - workerStart,
            httpStatus: response.status
        };
        if (response.status >= 500) overallStatus = 'unhealthy';
    } catch (error) {
        checks.cloudflareWorker = {
            status: 'unhealthy',
            error: error.message
        };
        overallStatus = 'unhealthy';
    }
    
    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    res.status(statusCode).json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        checks
    });
});

/**
 * Test health check - simulates actual spec generation flow: Backend → Worker → OpenAI
 * GET /api/health/test-spec
 * This endpoint goes through the exact same flow as /api/generate-spec to test the real pipeline
 */
router.get('/test-spec', async (req, res) => {
    const requestId = req.requestId || `health-test-spec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    logger.debug({ requestId }, '[health-routes] GET /test-spec - Test spec generation flow');
    
    const result = {
        backend: 'ok',
        cloudflare: 'unknown',
        openai: 'unknown',
        timestamp: new Date().toISOString()
    };

    try {
        // Step 1: Backend is already running (if we got here, backend is OK)
        // result.backend is already set to 'ok'

        // Step 2: Test the actual spec generation flow with minimal payload
        // This uses the same endpoint and Worker as real spec generation
        const workerUrl = 'https://spspec.shalom-cohen-111.workers.dev/generate';
        
        // Minimal test payload - similar to real spec generation but with simple "ping" request
        const workerPayload = {
            stage: 'overview',
            locale: 'en-US',
            prompt: {
                system: 'You are an expert application specification generator.',
                developer: 'Return ONLY valid JSON. Top-level key MUST be overview. This is a health check - return a minimal valid response.',
                user: 'ping'
            }
        };

        try {
            const workerStart = Date.now();
            const workerResponse = await fetch(workerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(workerPayload),
                signal: AbortSignal.timeout(15000) // 15 second timeout (same as real spec generation)
            });

            const workerResponseTime = Date.now() - workerStart;

            if (workerResponse.ok) {
                const workerData = await workerResponse.json();
                
                // Worker successfully connected and got response from OpenAI
                result.cloudflare = 'ok';
                result.openai = 'ok';
                result.workerResponseTime = `${workerResponseTime}ms`;
                
                // Check if we got a valid response structure
                if (workerData.overview || workerData.specification || workerData.meta) {
                    result.message = 'Successfully generated test spec';
                } else if (workerData.error) {
                    result.openai = 'error';
                    result.error = workerData.error.message || 'Worker returned error';
                }
            } else {
                result.cloudflare = 'error';
                result.openai = 'unknown';
                result.error = `Cloudflare Worker returned HTTP ${workerResponse.status}`;
                logger.warn({ requestId, httpStatus: workerResponse.status }, '[health-routes] GET /test-spec - Worker unhealthy');
            }
        } catch (workerError) {
            result.cloudflare = 'error';
            result.openai = 'unknown';
            result.error = workerError.message || 'Failed to connect to Cloudflare Worker';
            logger.error({ requestId, error: { message: workerError.message } }, '[health-routes] GET /test-spec - Worker connection failed');
        }

        // Determine overall status
        const overallStatus = (result.backend === 'ok' && result.cloudflare === 'ok' && result.openai === 'ok') 
            ? 'healthy' 
            : 'unhealthy';

        const totalTime = Date.now() - startTime;
        result.totalResponseTime = `${totalTime}ms`;

        const statusCode = overallStatus === 'healthy' ? 200 : 503;
        logger.debug({ requestId, overallStatus, result }, '[health-routes] GET /test-spec - Completed');

        res.status(statusCode).json({
            status: overallStatus,
            ...result
        });
        
    } catch (error) {
        const totalTime = Date.now() - startTime;
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[health-routes] GET /test-spec - Unexpected error');
        
        result.backend = 'error';
        result.error = error.message;
        result.totalResponseTime = `${totalTime}ms`;
        
        res.status(500).json({
            status: 'unhealthy',
            ...result
        });
    }
});

/**
 * Full health check - checks entire path: Backend → Cloudflare Worker → OpenAI
 * GET /api/health/full
 */
router.get('/full', async (req, res) => {
    const requestId = req.requestId || `health-full-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    logger.debug({ requestId }, '[health-routes] GET /full - Full health check');
    
    const result = {
        backend: 'ok',
        cloudflare: 'unknown',
        openai: 'unknown',
        timestamp: new Date().toISOString()
    };

    try {
        // Step 1: Backend is already running (if we got here, backend is OK)
        // result.backend is already set to 'ok'

        // Step 2: Check Cloudflare Worker health endpoint
        const workerUrl = 'https://healthcheck.shalom-cohen-111.workers.dev/health';
        
        try {
            const workerStart = Date.now();
            const workerResponse = await fetch(workerUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(12000) // 12 second timeout (10s for OpenAI + 2s buffer)
            });

            const workerResponseTime = Date.now() - workerStart;

            if (workerResponse.ok) {
                const workerData = await workerResponse.json();
                
                // Worker should return: { cloudflare: "ok", openai: "ok" } or error variants
                result.cloudflare = workerData.cloudflare || 'ok';
                result.openai = workerData.openai || 'unknown';
                result.workerResponseTime = `${workerResponseTime}ms`;
                
                // If worker reported an error, include it
                if (workerData.error) {
                    result.error = workerData.error;
                }
                if (workerData.responseTime) {
                    result.openaiResponseTime = workerData.responseTime;
                }
            } else {
                result.cloudflare = 'error';
                result.openai = 'unknown';
                result.error = `Cloudflare Worker returned HTTP ${workerResponse.status}`;
                logger.warn({ requestId, httpStatus: workerResponse.status }, '[health-routes] GET /full - Worker unhealthy');
            }
        } catch (workerError) {
            result.cloudflare = 'error';
            result.openai = 'unknown';
            result.error = workerError.message || 'Failed to connect to Cloudflare Worker';
            logger.error({ requestId, error: { message: workerError.message } }, '[health-routes] GET /full - Worker connection failed');
        }

        // Determine overall status
        const overallStatus = (result.backend === 'ok' && result.cloudflare === 'ok' && result.openai === 'ok') 
            ? 'healthy' 
            : 'unhealthy';

        const totalTime = Date.now() - startTime;
        result.totalResponseTime = `${totalTime}ms`;

        const statusCode = overallStatus === 'healthy' ? 200 : 503;
        logger.debug({ requestId, overallStatus, result }, '[health-routes] GET /full - Completed');

        res.status(statusCode).json({
            status: overallStatus,
            ...result
        });
        
    } catch (error) {
        const totalTime = Date.now() - startTime;
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[health-routes] GET /full - Unexpected error');
        
        result.backend = 'error';
        result.error = error.message;
        result.totalResponseTime = `${totalTime}ms`;
        
        res.status(500).json({
            status: 'unhealthy',
            ...result
        });
    }
});

/**
 * Recent errors check
 * GET /api/health/errors
 * 
 * Note: This would require implementing error logging to a collection
 */
router.get('/errors', async (req, res) => {
    try {
        // Check if we have error logs collection
        const errorsSnapshot = await db.collection('error_logs')
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();
        
        const errors = errorsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        res.json({
            status: 'healthy',
            recentErrors: errors.length,
            errors: errors,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        // Error logs collection might not exist yet - that's okay
        res.json({
            status: 'healthy',
            recentErrors: 0,
            errors: [],
            note: 'Error logging not yet configured',
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;

