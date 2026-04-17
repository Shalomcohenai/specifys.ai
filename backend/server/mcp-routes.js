/**
 * MCP API routes - used by the MCP Server (Cursor / Claude Desktop).
 * All routes require API Key via verifyApiKey (see mcp-auth.js).
 * Base path: /api/mcp
 */

const express = require('express');
const router = express.Router();
const { db, admin } = require('./firebase-admin');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');
const { buildSpecUpdatePayload } = require('./mcp-auth');
const specGenerationService = require('./spec-generation-service');
const { getAllTools } = require('./tools-migration-service');

const MCP_REQUESTS_COLLECTION = 'mcp_requests';

/**
 * Middleware: log each MCP request to Firestore for stats (fire-and-forget).
 */
router.use((req, res, next) => {
  const userId = req.user?.uid;
  const path = req.path || req.url?.split('?')[0] || '';
  const method = req.method || 'GET';
  const client = req.mcpClient || 'unknown';
  const doc = {
    userId: userId || null,
    path,
    method,
    client,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  };
  db.collection(MCP_REQUESTS_COLLECTION).add(doc).catch(err => {
    logger.warn({ err: err.message, path, method }, '[mcp-routes] Failed to log MCP request');
  });
  next();
});

/**
 * GET /api/mcp/specs
 * List current user's specs (metadata).
 */
router.get('/specs', async (req, res, next) => {
  const requestId = req.requestId || `mcp-specs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  try {
    const userId = req.user.uid;
    const snapshot = await db.collection('specs')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    const specs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() ?? doc.data().createdAt
    }));
    logger.info({ requestId, userId, count: specs.length }, '[mcp-routes] GET /specs');
    res.json({ success: true, specs });
  } catch (err) {
    logger.error({ requestId, error: err.message }, '[mcp-routes] GET /specs error');
    next(createError('Failed to fetch specs', ERROR_CODES.DATABASE_ERROR, 500, { details: err.message }));
  }
});

/**
 * GET /api/mcp/specs/:id
 * Get full spec document (including overview, technical, market, design, architecture, visibility, prompts).
 */
router.get('/specs/:id', async (req, res, next) => {
  const requestId = req.requestId || `mcp-spec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const specId = req.params.id;
  try {
    const userId = req.user.uid;
    const doc = await db.collection('specs').doc(specId).get();
    if (!doc.exists) {
      return next(createError('Specification not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
    }
    const data = doc.data();
    if (data.userId !== userId) {
      return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403));
    }
    const spec = { id: doc.id, ...data };
    // Serialize Firestore timestamps for JSON
    if (spec.createdAt?.toDate) spec.createdAt = spec.createdAt.toDate().toISOString();
    if (spec.updatedAt?.toDate) spec.updatedAt = spec.updatedAt.toDate().toISOString();
    logger.info({ requestId, specId, userId }, '[mcp-routes] GET /specs/:id');
    res.json({ success: true, spec });
  } catch (err) {
    logger.error({ requestId, specId, error: err.message }, '[mcp-routes] GET /specs/:id error');
    next(createError('Failed to fetch spec', ERROR_CODES.DATABASE_ERROR, 500, { details: err.message }));
  }
});

/**
 * PUT /api/mcp/specs/:id
 * Partial update: overview, technical, design, market, architecture, visibility, prompts, title.
 */
router.put('/specs/:id', async (req, res, next) => {
  const requestId = req.requestId || `mcp-put-spec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const specId = req.params.id;
  try {
    const userId = req.user.uid;
    const doc = await db.collection('specs').doc(specId).get();
    if (!doc.exists) {
      return next(createError('Specification not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
    }
    if (doc.data().userId !== userId) {
      return next(createError('Unauthorized', ERROR_CODES.FORBIDDEN, 403));
    }
    const { updateData, error } = buildSpecUpdatePayload(req.body);
    if (error) {
      return next(createError(error, ERROR_CODES.VALIDATION_ERROR, 400));
    }
    if (Object.keys(updateData).length === 0) {
      return next(createError('No allowed fields to update (overview, technical, design, market, architecture, visibility, prompts, title)', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('specs').doc(specId).update(updateData);
    logger.info({ requestId, specId, userId, fields: Object.keys(updateData).filter(k => k !== 'updatedAt') }, '[mcp-routes] PUT /specs/:id');
    res.json({ success: true, specId });
  } catch (err) {
    logger.error({ requestId, specId, error: err.message }, '[mcp-routes] PUT /specs/:id error');
    next(createError('Failed to update spec', ERROR_CODES.DATABASE_ERROR, 500, { details: err.message }));
  }
});

/**
 * GET /api/mcp/prompt-templates
 * Return developer prompt descriptions for overview, technical, market, design, architecture, visibility, prompts.
 */
router.get('/prompt-templates', async (req, res, next) => {
  const requestId = req.requestId || `mcp-prompts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  try {
    const overview = 'Generate application overview as JSON with overview key. Include app name, description, target audience, core features, user flow.';
    const technical = specGenerationService.getDeveloperPrompt('technical');
    const market = specGenerationService.getDeveloperPrompt('market');
    const design = specGenerationService.getDeveloperPrompt('design');
    const systemPrompts = {
      technical: specGenerationService.getSystemPrompt('technical'),
      market: specGenerationService.getSystemPrompt('market'),
      design: specGenerationService.getSystemPrompt('design')
    };
    logger.info({ requestId }, '[mcp-routes] GET /prompt-templates');
    const architecture = 'Generate architecture based on overview + technical. Include diagrams and integration boundaries.';
    const visibility = 'Generate AIO & SEO visibility engine based on overview + technical. Return launch-ready assets.';
    const prompts = 'Generate implementation prompts from all sections: overview, technical, market, design, architecture, visibility.';
    res.json({
      success: true,
      prompts: { overview, technical, market, design, architecture, visibility, prompts },
      systemPrompts
    });
  } catch (err) {
    logger.error({ requestId, error: err.message }, '[mcp-routes] GET /prompt-templates error');
    next(createError('Failed to fetch prompt templates', ERROR_CODES.INTERNAL_ERROR, 500, { details: err.message }));
  }
});

/**
 * GET /api/mcp/tools
 * List Vibe Coding tools (proxy to tools collection).
 */
router.get('/tools', async (req, res, next) => {
  const requestId = req.requestId || `mcp-tools-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  try {
    const { category, limit } = req.query;
    const options = {
      category: category || null,
      limit: limit ? parseInt(limit, 10) : null
    };
    const tools = await getAllTools(options);
    logger.info({ requestId, count: tools.length }, '[mcp-routes] GET /tools');
    res.json({ success: true, count: tools.length, tools });
  } catch (err) {
    logger.error({ requestId, error: err.message }, '[mcp-routes] GET /tools error');
    next(createError('Failed to fetch tools', ERROR_CODES.DATABASE_ERROR, 500, { details: err.message }));
  }
});

module.exports = router;
