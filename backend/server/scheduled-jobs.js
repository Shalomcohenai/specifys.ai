/**
 * Scheduled Jobs
 * Handles periodic tasks like syncing payments data every 24 hours
 */

const { logger } = require('./logger');
const { syncPaymentsData } = require('./lemon-payments-cache');

let paymentsSyncInterval = null;

/**
 * Start all scheduled jobs
 */
function startScheduledJobs() {
  logger.info('[scheduled-jobs] Starting scheduled jobs...');

  // Sync payments data every 24 hours
  startPaymentsSyncJob();

  logger.info('[scheduled-jobs] All scheduled jobs started');
}

/**
 * Stop all scheduled jobs
 */
function stopScheduledJobs() {
  logger.info('[scheduled-jobs] Stopping scheduled jobs...');

  if (paymentsSyncInterval) {
    clearInterval(paymentsSyncInterval);
    paymentsSyncInterval = null;
  }

  logger.info('[scheduled-jobs] All scheduled jobs stopped');
}

/**
 * Start payments sync job (runs every 24 hours)
 */
function startPaymentsSyncJob() {
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
  const storeId = process.env.LEMON_SQUEEZY_STORE_ID;

  if (!apiKey || !storeId) {
    logger.warn('[scheduled-jobs] Payments sync job not started - API key or store ID not configured');
    return;
  }

  // Run sync immediately on startup (optional - remove if you don't want this)
  // syncPaymentsDataOnce(apiKey, storeId);

  // Calculate milliseconds in 24 hours
  const hours24 = 24 * 60 * 60 * 1000;

  // Run sync every 24 hours
  paymentsSyncInterval = setInterval(() => {
    syncPaymentsDataOnce(apiKey, storeId);
  }, hours24);

  logger.info('[scheduled-jobs] Payments sync job started - will run every 24 hours');
}

/**
 * Sync payments data once (used by interval and can be called manually)
 */
async function syncPaymentsDataOnce(apiKey, storeId) {
  const requestId = `scheduled-sync-${Date.now()}`;
  
  try {
    logger.info({ requestId }, '[scheduled-jobs] Starting scheduled payments data sync');
    
    await syncPaymentsData({ apiKey, storeId, logger, requestId });
    
    logger.info({ requestId }, '[scheduled-jobs] Scheduled payments data sync completed successfully');
  } catch (error) {
    logger.error({ 
      requestId, 
      error: { 
        message: error.message, 
        stack: error.stack 
      } 
    }, '[scheduled-jobs] Scheduled payments data sync failed');
  }
}

module.exports = {
  startScheduledJobs,
  stopScheduledJobs,
  syncPaymentsDataOnce
};

