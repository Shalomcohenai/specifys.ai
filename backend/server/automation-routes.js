/**
 * Automation Routes
 * API endpoints for managing automation jobs
 */

const express = require('express');
const router = express.Router();
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');
const { requireAdmin } = require('./security');
const { jobRegistry } = require('./automation-service');

/**
 * GET /api/automation/jobs
 * List all registered automation jobs
 */
router.get('/jobs', async (req, res, next) => {
  const requestId = req.requestId || `automation-jobs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId }, '[automation-routes] GET /api/automation/jobs');
  
  try {
    const jobs = jobRegistry.listJobs();
    
    logger.info({ requestId, count: jobs.length }, '[automation-routes] GET /api/automation/jobs - Success');
    
    res.json({
      success: true,
      count: jobs.length,
      jobs
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[automation-routes] GET /api/automation/jobs - Error');
    next(createError(error.message || 'Failed to list jobs', ERROR_CODES.INTERNAL_ERROR, 500));
  }
});

/**
 * POST /api/automation/jobs/:name/run
 * Manually trigger an automation job (admin only)
 */
router.post('/jobs/:name/run', requireAdmin, async (req, res, next) => {
  const requestId = req.requestId || `automation-run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const { name } = req.params;
  logger.info({ requestId, jobName: name, body: req.body }, '[automation-routes] POST /api/automation/jobs/:name/run');
  
  try {
    if (!name) {
      return next(createError('Job name is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    
    // Get options from request body
    const options = req.body || {};
    
    // Execute job
    const result = await jobRegistry.executeJob(name, options);
    
    logger.info({ requestId, jobName: name, success: result.success }, '[automation-routes] POST /api/automation/jobs/:name/run - Success');
    
    res.json({
      success: result.success,
      message: result.success ? `Job ${name} completed` : `Job ${name} failed`,
      result: result.result || result.error
    });
  } catch (error) {
    logger.error({ requestId, jobName: name, error: { message: error.message, stack: error.stack } }, '[automation-routes] POST /api/automation/jobs/:name/run - Error');
    
    if (error.message.includes('not found')) {
      return next(createError(`Job not found: ${name}`, ERROR_CODES.RESOURCE_NOT_FOUND, 404));
    }
    
    next(createError(error.message || `Failed to run job: ${name}`, ERROR_CODES.INTERNAL_ERROR, 500));
  }
});

/**
 * GET /api/automation/jobs/:name/status
 * Get last execution status of an automation job
 */
router.get('/jobs/:name/status', async (req, res, next) => {
  const requestId = req.requestId || `automation-status-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const { name } = req.params;
  logger.info({ requestId, jobName: name }, '[automation-routes] GET /api/automation/jobs/:name/status');
  
  try {
    if (!name) {
      return next(createError('Job name is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    
    const status = await jobRegistry.getLastStatus(name);
    
    if (!status) {
      return res.json({
        success: true,
        status: null,
        message: `No execution history found for job: ${name}`
      });
    }
    
    logger.info({ requestId, jobName: name, statusId: status.id }, '[automation-routes] GET /api/automation/jobs/:name/status - Success');
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    logger.error({ requestId, jobName: name, error: { message: error.message, stack: error.stack } }, '[automation-routes] GET /api/automation/jobs/:name/status - Error');
    next(createError(error.message || `Failed to get status for job: ${name}`, ERROR_CODES.DATABASE_ERROR, 500));
  }
});

/**
 * GET /api/automation/jobs/:name/history
 * Get execution history of an automation job
 */
router.get('/jobs/:name/history', requireAdmin, async (req, res, next) => {
  const requestId = req.requestId || `automation-history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const { name } = req.params;
  logger.info({ requestId, jobName: name, query: req.query }, '[automation-routes] GET /api/automation/jobs/:name/history');
  
  try {
    if (!name) {
      return next(createError('Job name is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
    }
    
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    
    const history = await jobRegistry.getHistory(name, limit);
    
    logger.info({ requestId, jobName: name, count: history.length }, '[automation-routes] GET /api/automation/jobs/:name/history - Success');
    
    res.json({
      success: true,
      count: history.length,
      history
    });
  } catch (error) {
    logger.error({ requestId, jobName: name, error: { message: error.message, stack: error.stack } }, '[automation-routes] GET /api/automation/jobs/:name/history - Error');
    next(createError(error.message || `Failed to get history for job: ${name}`, ERROR_CODES.DATABASE_ERROR, 500));
  }
});

/**
 * GET /api/automation/logs
 * Get automation logs (admin only)
 */
router.get('/logs', requireAdmin, async (req, res, next) => {
  const requestId = req.requestId || `automation-logs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, query: req.query }, '[automation-routes] GET /api/automation/logs');
  
  try {
    const { db } = require('./firebase-admin');
    const { jobName, limit = 50 } = req.query;
    
    let query = db.collection('automation_logs')
      .orderBy('completedAt', 'desc');
    
    if (jobName) {
      query = query.where('jobName', '==', jobName);
    }
    
    const snapshot = await query.limit(parseInt(limit, 10)).get();
    
    const logs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        startedAt: data.startedAt?.toDate ? data.startedAt.toDate() : data.startedAt,
        completedAt: data.completedAt?.toDate ? data.completedAt.toDate() : data.completedAt
      };
    });
    
    logger.info({ requestId, count: logs.length, jobName }, '[automation-routes] GET /api/automation/logs - Success');
    
    res.json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[automation-routes] GET /api/automation/logs - Error');
    next(createError(error.message || 'Failed to get automation logs', ERROR_CODES.DATABASE_ERROR, 500));
  }
});

module.exports = router;

