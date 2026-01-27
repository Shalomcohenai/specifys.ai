const { AutomationJob } = require('./automation-service');
const { syncAllUsersCredits } = require('./credits-sync-service');
const { logger } = require('./logger');

/**
 * Credits Sync Job - Syncs user credits with purchases and subscriptions
 * Runs daily to ensure credits are accurate
 */
class CreditsSyncJob extends AutomationJob {
  constructor() {
    super('CreditsSyncJob', {
      description: 'Sync user credits with purchases and Lemon Squeezy subscriptions',
      frequency: 'daily',
      enabled: process.env.CREDITS_SYNC_ENABLED === 'true'
    });
  }

  async execute(options = {}) {
    const requestId = `credits-sync-${Date.now()}`;
    const startTime = Date.now();

    logger.info({ requestId }, '[CreditsSyncJob] Starting credits sync job');

    try {
      const dryRun = process.env.CREDITS_SYNC_DRY_RUN === 'true' || options.dryRun === true;
      
      const report = await syncAllUsersCredits({
        dryRun,
        batchSize: parseInt(process.env.CREDITS_SYNC_BATCH_SIZE || '50', 10),
        limit: options.limit || null
      });

      const duration = Date.now() - startTime;

      logger.info({
        requestId,
        duration,
        report
      }, '[CreditsSyncJob] Credits sync job completed successfully');

      return {
        success: true,
        requestId,
        duration,
        report,
        dryRun
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error({
        requestId,
        duration,
        error: error.message,
        stack: error.stack
      }, '[CreditsSyncJob] Credits sync job failed');

      return {
        success: false,
        requestId,
        duration,
        error: error.message,
        dryRun: process.env.CREDITS_SYNC_DRY_RUN === 'true'
      };
    }
  }
}

module.exports = {
  CreditsSyncJob
};

