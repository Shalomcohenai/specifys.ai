const { db, admin } = require('./firebase-admin');
const { logger } = require('./logger');
const { getPurchasesForUser } = require('./lemon-purchase-service');
const { fetchSubscriptionById } = require('./lemon-subscription-resolver');
const { grantCredits, getUserCredits, calculateTotal } = require('./credits-v3-service');
const { enableProSubscription, disableProSubscription } = require('./credits-v3-service');

const CREDITS_COLLECTION_V3 = 'user_credits_v3';
const USERS_COLLECTION = 'users';
const PURCHASES_COLLECTION = 'purchases';

// Rate limiting delay between API calls (ms)
const RATE_LIMIT_DELAY = process.env.CREDITS_SYNC_RATE_LIMIT_DELAY 
  ? parseInt(process.env.CREDITS_SYNC_RATE_LIMIT_DELAY, 10) 
  : 100;

/**
 * Calculate expected paid credits from purchases
 */
async function calculateExpectedPaidCredits(userId) {
  try {
    const purchases = await getPurchasesForUser(userId, { limit: 1000 });
    
    // Sum credits from one-time purchases with status 'paid'
    const paidCredits = purchases
      .filter(p => 
        p.productType === 'one_time' && 
        p.status === 'paid' && 
        p.credits && 
        typeof p.credits === 'number' &&
        p.credits > 0
      )
      .reduce((sum, p) => sum + (p.credits * (p.quantity || 1)), 0);
    
    return paidCredits;
  } catch (error) {
    logger.error({ userId, error: error.message }, '[CREDITS-SYNC] Error calculating expected paid credits');
    return null;
  }
}

/**
 * Fetch subscription status from Lemon Squeezy API
 */
async function fetchSubscriptionStatus(subscriptionId, apiKey) {
  if (!subscriptionId || !apiKey) {
    return null;
  }

  try {
    const fetch = globalThis.fetch || require('node-fetch');
    const result = await fetchSubscriptionById({
      fetch,
      apiKey,
      subscriptionId: subscriptionId.toString(),
      storeId: null,
      logger,
      requestId: `sync-${Date.now()}`
    });

    if (result && result.error) {
      logger.warn({ subscriptionId, error: result.error }, '[CREDITS-SYNC] Failed to fetch subscription');
      return null;
    }

    if (!result || !result.attributes) {
      return null;
    }

    const attributes = result.attributes;
    const status = attributes.status || null;
    const endsAt = attributes.ends_at || attributes.ends_at_formatted || null;
    const renewsAt = attributes.renews_at || null;
    const cancelAtPeriodEnd = attributes.cancel_at_period_end ?? attributes.cancelled ?? false;
    
    // Check if subscription is active
    const isActive = status === 'active' || status === 'paid' || status === 'on_trial';
    
    // Check if expired
    let isExpired = false;
    if (endsAt) {
      const endsAtDate = new Date(endsAt);
      if (!isNaN(endsAtDate.getTime()) && endsAtDate < new Date()) {
        isExpired = true;
      }
    }

    return {
      subscriptionId: result.id.toString(),
      status: status,
      isActive: isActive && !isExpired,
      isExpired: isExpired,
      endsAt: endsAt,
      renewsAt: renewsAt,
      cancelAtPeriodEnd: cancelAtPeriodEnd,
      attributes: attributes
    };
  } catch (error) {
    logger.error({ subscriptionId, error: error.message }, '[CREDITS-SYNC] Error fetching subscription from Lemon API');
    return null;
  }
}

/**
 * Sync credits for a single user
 */
async function syncUserCredits(userId, options = {}) {
  const {
    dryRun = false,
    apiKey = null
  } = options;

  const syncResult = {
    userId,
    fixed: false,
    creditsFixed: false,
    subscriptionFixed: false,
    errors: [],
    changes: []
  };

  try {
    // Get current credits
    const currentCredits = await getUserCredits(userId, false);
    if (!currentCredits) {
      syncResult.errors.push('Failed to get current credits');
      return syncResult;
    }

    // Calculate expected paid credits from purchases
    const expectedPaidCredits = await calculateExpectedPaidCredits(userId);
    if (expectedPaidCredits === null) {
      syncResult.errors.push('Failed to calculate expected paid credits');
      return syncResult;
    }

    const currentPaidCredits = currentCredits.balances?.paid || 0;
    const currentFreeCredits = currentCredits.balances?.free || 0;
    const currentBonusCredits = currentCredits.balances?.bonus || 0;
    const currentTotal = currentCredits.total !== undefined 
      ? currentCredits.total 
      : calculateTotal(currentCredits.balances || {});

    // Check subscription status
    const lemonSubscriptionId = currentCredits.subscription?.lemonSubscriptionId;
    let subscriptionStatus = null;
    
    if (lemonSubscriptionId && apiKey) {
      // Add rate limiting delay
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      
      subscriptionStatus = await fetchSubscriptionStatus(lemonSubscriptionId, apiKey);
    }

    // Determine if subscription should be active
    const shouldHaveActiveSubscription = subscriptionStatus?.isActive === true;
    const currentSubscriptionActive = 
      currentCredits.subscription?.type === 'pro' && 
      (currentCredits.subscription?.status === 'active' || currentCredits.subscription?.status === 'paid');

    // Check if paid credits need fixing
    const paidCreditsDiff = expectedPaidCredits - currentPaidCredits;
    const needsCreditsFix = Math.abs(paidCreditsDiff) > 0.01; // Allow small floating point differences

    // Check if subscription needs fixing
    const needsSubscriptionFix = shouldHaveActiveSubscription !== currentSubscriptionActive;

    // If nothing needs fixing, return early
    if (!needsCreditsFix && !needsSubscriptionFix) {
      return syncResult;
    }

    syncResult.fixed = true;

    // Fix credits if needed
    if (needsCreditsFix && !dryRun) {
      try {
        if (paidCreditsDiff > 0) {
          // Need to add credits
          await grantCredits(
            userId,
            paidCreditsDiff,
            'admin_sync',
            {
              reason: 'Credits sync - missing paid credits from purchases',
              notes: `Sync added ${paidCreditsDiff} paid credits to match purchases`
            }
          );
          syncResult.creditsFixed = true;
          syncResult.changes.push(`Added ${paidCreditsDiff} paid credits`);
        } else {
          // Need to remove credits (shouldn't happen often, but log it)
          logger.warn({ 
            userId, 
            expectedPaidCredits, 
            currentPaidCredits, 
            diff: paidCreditsDiff 
          }, '[CREDITS-SYNC] User has more paid credits than expected from purchases');
          syncResult.changes.push(`Warning: User has ${Math.abs(paidCreditsDiff)} more paid credits than expected`);
        }
      } catch (error) {
        syncResult.errors.push(`Failed to fix credits: ${error.message}`);
        logger.error({ userId, error: error.message }, '[CREDITS-SYNC] Error fixing credits');
      }
    } else if (needsCreditsFix && dryRun) {
      syncResult.creditsFixed = true;
      syncResult.changes.push(`Would add ${paidCreditsDiff} paid credits`);
    }

    // Fix subscription if needed
    if (needsSubscriptionFix && !dryRun) {
      try {
        if (shouldHaveActiveSubscription) {
          // Enable subscription
          const subscriptionData = subscriptionStatus.attributes;
          await enableProSubscription(userId, {
            subscriptionId: lemonSubscriptionId,
            subscriptionStatus: subscriptionStatus.status,
            currentPeriodEnd: subscriptionStatus.renewsAt || subscriptionStatus.endsAt,
            cancelAtPeriodEnd: subscriptionStatus.cancelAtPeriodEnd,
            productKey: currentCredits.subscription?.productKey || null,
            productName: currentCredits.subscription?.productName || null,
            subscriptionInterval: subscriptionData?.billing_anchor ? 'month' : null
          });
          syncResult.subscriptionFixed = true;
          syncResult.changes.push('Enabled Pro subscription');
        } else {
          // Disable subscription
          await disableProSubscription(userId, {
            subscriptionId: lemonSubscriptionId,
            cancelReason: subscriptionStatus?.isExpired ? 'expired' : 'cancelled'
          });
          syncResult.subscriptionFixed = true;
          syncResult.changes.push('Disabled Pro subscription');
        }
      } catch (error) {
        syncResult.errors.push(`Failed to fix subscription: ${error.message}`);
        logger.error({ userId, error: error.message }, '[CREDITS-SYNC] Error fixing subscription');
      }
    } else if (needsSubscriptionFix && dryRun) {
      syncResult.subscriptionFixed = true;
      if (shouldHaveActiveSubscription) {
        syncResult.changes.push('Would enable Pro subscription');
      } else {
        syncResult.changes.push('Would disable Pro subscription');
      }
    }

    return syncResult;
  } catch (error) {
    logger.error({ userId, error: error.message, stack: error.stack }, '[CREDITS-SYNC] Error syncing user credits');
    syncResult.errors.push(`Sync error: ${error.message}`);
    return syncResult;
  }
}

/**
 * Sync credits for all users
 */
async function syncAllUsersCredits(options = {}) {
  const {
    dryRun = false,
    batchSize = parseInt(process.env.CREDITS_SYNC_BATCH_SIZE || '50', 10),
    limit = null
  } = options;

  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
  if (!apiKey) {
    throw new Error('LEMON_SQUEEZY_API_KEY is required for credits sync');
  }

  const startTime = Date.now();
  const report = {
    startedAt: new Date().toISOString(),
    completedAt: null,
    dryRun,
    totalUsers: 0,
    processed: 0,
    fixed: 0,
    creditsFixed: 0,
    subscriptionsFixed: 0,
    errors: 0,
    usersWithIssues: [],
    details: {
      creditsFixed: 0,
      subscriptionsFixed: 0,
      errors: []
    }
  };

  try {
    logger.info({ dryRun, batchSize, limit }, '[CREDITS-SYNC] Starting credits sync for all users');

    // Get all users with credits
    let query = db.collection(CREDITS_COLLECTION_V3);
    if (limit) {
      query = query.limit(limit);
    }

    const creditsSnapshot = await query.get();
    const userIds = creditsSnapshot.docs.map(doc => doc.id);
    
    report.totalUsers = userIds.length;
    logger.info({ totalUsers: userIds.length }, '[CREDITS-SYNC] Found users to sync');

    // Process in batches
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      logger.info({ 
        batch: i / batchSize + 1, 
        totalBatches: Math.ceil(userIds.length / batchSize),
        batchSize: batch.length 
      }, '[CREDITS-SYNC] Processing batch');

      const batchResults = await Promise.allSettled(
        batch.map(userId => syncUserCredits(userId, { dryRun, apiKey }))
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        report.processed++;

        if (result.status === 'fulfilled') {
          const syncResult = result.value;
          if (syncResult.fixed) {
            report.fixed++;
            if (syncResult.creditsFixed) {
              report.creditsFixed++;
              report.details.creditsFixed++;
            }
            if (syncResult.subscriptionFixed) {
              report.subscriptionsFixed++;
              report.details.subscriptionsFixed++;
            }
          }
          if (syncResult.errors && syncResult.errors.length > 0) {
            report.errors++;
            report.usersWithIssues.push({
              userId: syncResult.userId,
              errors: syncResult.errors,
              changes: syncResult.changes
            });
          }
        } else {
          report.errors++;
          const userId = batch[j];
          report.usersWithIssues.push({
            userId,
            errors: [result.reason?.message || 'Unknown error'],
            changes: []
          });
          logger.error({ userId, error: result.reason }, '[CREDITS-SYNC] Batch processing error');
        }
      }

      // Small delay between batches to avoid overwhelming the system
      if (i + batchSize < userIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    report.completedAt = new Date().toISOString();
    const duration = Date.now() - startTime;
    
    logger.info({ 
      duration,
      report 
    }, '[CREDITS-SYNC] Credits sync completed');

    return report;
  } catch (error) {
    report.completedAt = new Date().toISOString();
    report.details.errors.push(error.message);
    logger.error({ error: error.message, stack: error.stack }, '[CREDITS-SYNC] Fatal error in sync all users');
    throw error;
  }
}

module.exports = {
  syncUserCredits,
  syncAllUsersCredits,
  calculateExpectedPaidCredits,
  fetchSubscriptionStatus
};

