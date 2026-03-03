/**
 * Tools Routes
 * API endpoints for tools management and automation
 */

const express = require('express');
const router = express.Router();
const { db } = require('./firebase-admin');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');
const { requireAdmin } = require('./security');
const { getAllTools, getToolById } = require('./tools-migration-service');
const { ToolsFinderJob } = require('./tools-automation');
const { jobRegistry } = require('./automation-service');
const { exportToolsToJson } = require('./tools-export-service');

/**
 * GET /api/tools
 * Get all tools (with optional filtering)
 */
router.get('/', async (req, res, next) => {
  const requestId = req.requestId || `tools-get-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, query: req.query }, '[tools-routes] GET /api/tools');
  
  try {
    const { category, limit } = req.query;
    
    const options = {
      category: category || null,
      limit: limit ? parseInt(limit, 10) : null
    };
    
    const tools = await getAllTools(options);
    
    logger.info({ requestId, count: tools.length, category: options.category }, '[tools-routes] GET /api/tools - Success');
    
    res.json({
      success: true,
      count: tools.length,
      tools
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[tools-routes] GET /api/tools - Error');
    next(createError(error.message || 'Failed to get tools', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

/**
 * GET /api/tools/count
 * Lightweight endpoint returning only tool count (for homepage etc.)
 */
router.get('/count', async (req, res, next) => {
  const requestId = req.requestId || `tools-count-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.debug({ requestId }, '[tools-routes] GET /api/tools/count');

  try {
    const tools = await getAllTools();
    res.json({ success: true, count: tools.length });
  } catch (error) {
    logger.error({ requestId, error: error.message }, '[tools-routes] GET /api/tools/count - Error');
    next(createError(error.message || 'Failed to get tools count', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

/**
 * GET /api/tools/:id
 * Get a specific tool by ID
 */
router.get('/:id', async (req, res, next) => {
  const requestId = req.requestId || `tool-get-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, toolId: req.params.id }, '[tools-routes] GET /api/tools/:id');
  
  try {
    const { id } = req.params;
    
    if (!id) {
      return next(createError('Tool ID is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    
    const tool = await getToolById(id);
    
    if (!tool) {
      return next(createError('Tool not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
    }
    
    logger.info({ requestId, toolId: id }, '[tools-routes] GET /api/tools/:id - Success');
    
    res.json({
      success: true,
      tool
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[tools-routes] GET /api/tools/:id - Error');
    next(createError(error.message || 'Failed to get tool', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

/**
 * POST /api/tools/automation/run
 * Manually trigger tools finder automation (admin only)
 */
router.post('/automation/run', requireAdmin, async (req, res, next) => {
  const requestId = req.requestId || `tools-automation-run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, body: req.body }, '[tools-routes] POST /api/tools/automation/run');
  
  try {
    const { dryRun = false } = req.body;
    
    // Check if job is registered
    let job;
    try {
      job = jobRegistry.getJob('tools-finder');
    } catch (error) {
      // Job not registered, create it
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return next(createError('OpenAI API key not configured', ERROR_CODES.CONFIGURATION_ERROR, 500));
      }
      
      job = new ToolsFinderJob({ openaiApiKey: apiKey });
      jobRegistry.registerJob('tools-finder', job);
      logger.info({ requestId }, '[tools-routes] Tools finder job registered');
    }
    
    // Execute job
    const result = await jobRegistry.executeJob('tools-finder', { dryRun });
    
    logger.info({ requestId, success: result.success }, '[tools-routes] POST /api/tools/automation/run - Success');
    
    res.json({
      success: result.success,
      message: result.success ? 'Tools finder automation completed' : 'Tools finder automation failed',
      result: result.result || result.error
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[tools-routes] POST /api/tools/automation/run - Error');
    next(createError(error.message || 'Failed to run tools automation', ERROR_CODES.INTERNAL_ERROR, 500));
  }
});

/**
 * GET /api/tools/automation/status
 * Get last execution status of tools finder automation
 */
router.get('/automation/status', async (req, res, next) => {
  const requestId = req.requestId || `tools-automation-status-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId }, '[tools-routes] GET /api/tools/automation/status');
  
  try {
    const status = await jobRegistry.getLastStatus('tools-finder');
    
    if (!status) {
      return res.json({
        success: true,
        status: null,
        message: 'No execution history found'
      });
    }
    
    logger.info({ requestId, statusId: status.id }, '[tools-routes] GET /api/tools/automation/status - Success');
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[tools-routes] GET /api/tools/automation/status - Error');
    res.json({
      success: false,
      error: error.message || 'Failed to get automation status',
      status: null,
      message: 'Error loading automation status'
    });
  }
});

/**
 * POST /api/tools/export
 * Export Firestore tools to tools/map/tools.json (admin only)
 */
router.post('/export', requireAdmin, async (req, res, next) => {
  const requestId = req.requestId || `tools-export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, body: req.body }, '[tools-routes] POST /api/tools/export');

  try {
    const { dryRun = false } = req.body;
    const result = await exportToolsToJson({ dryRun });

    if (!result.success) {
      return next(createError(result.error || 'Export failed', ERROR_CODES.INTERNAL_ERROR, 500));
    }

    logger.info({ requestId, count: result.count, dryRun }, '[tools-routes] POST /api/tools/export - Success');

    res.json({
      success: true,
      message: dryRun ? 'Dry run completed' : 'Tools exported to tools.json',
      count: result.count,
      path: result.path || null,
      dryRun: !!dryRun
    });
  } catch (error) {
    logger.error({ requestId, error: error.message, stack: error.stack }, '[tools-routes] POST /api/tools/export - Error');
    next(createError(error.message || 'Failed to export tools', ERROR_CODES.INTERNAL_ERROR, 500));
  }
});

module.exports = router;

