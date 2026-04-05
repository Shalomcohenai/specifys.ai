/**
 * Scheduled Jobs
 * Handles periodic tasks like syncing payments data every 24 hours
 */

const { logger } = require('./logger');
const { syncPaymentsData } = require('./lemon-payments-cache');
const { db } = require('./firebase-admin');
const emailService = require('./email-service');
const { jobRegistry } = require('./automation-service');
const { ToolsFinderJob } = require('./tools-automation');
const { exportToolsToJson } = require('./tools-export-service');
const { ArticleWriterJob } = require('./articles-automation');
const { CreditsSyncJob } = require('./credits-sync-job');
const { collectDailyStats, collectWeeklyStats } = require('./stats-collector');
const { fromZonedTime, toZonedTime } = require('date-fns-tz');

let paymentsSyncInterval = null;
let inactiveUsersCheckInterval = null;
let toolsFinderInterval = null;
let articleWriterInterval = null;
let creditsSyncInterval = null;
let dailyReportInterval = null;
let weeklyReportInterval = null;

/**
 * Start all scheduled jobs
 */
function startScheduledJobs() {
  logger.info('[scheduled-jobs] Starting scheduled jobs...');

  // Sync payments data every 24 hours
  startPaymentsSyncJob();
  
  // Check for inactive users daily (to send 30-day reminder)
  startInactiveUsersCheckJob();

  // Tools finder automation (weekly)
  startToolsFinderJob();

  // Article writer automation (daily)
  startArticleWriterJob();

  // Credits sync automation (daily)
  startCreditsSyncJob();

  // Daily report (runs every day at 9:00 AM)
  startDailyReportJob();

  // Weekly report (runs every Sunday at 9:00 AM)
  startWeeklyReportJob();

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
  
  if (inactiveUsersCheckInterval) {
    clearInterval(inactiveUsersCheckInterval);
    inactiveUsersCheckInterval = null;
  }

  if (toolsFinderInterval) {
    clearInterval(toolsFinderInterval);
    toolsFinderInterval = null;
  }

  if (articleWriterInterval) {
    clearInterval(articleWriterInterval);
    articleWriterInterval = null;
  }

  if (creditsSyncInterval) {
    clearInterval(creditsSyncInterval);
    creditsSyncInterval = null;
  }

  if (dailyReportInterval) {
    clearInterval(dailyReportInterval);
    dailyReportInterval = null;
  }

  if (weeklyReportInterval) {
    clearInterval(weeklyReportInterval);
    weeklyReportInterval = null;
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

/**
 * Start inactive users check job (runs daily)
 * Checks for users who haven't logged in for 30 days and sends reminder email (once per user)
 */
function startInactiveUsersCheckJob() {
  // Calculate milliseconds in 24 hours
  const hours24 = 24 * 60 * 60 * 1000;

  // Run check every 24 hours
  inactiveUsersCheckInterval = setInterval(() => {
    checkInactiveUsers();
  }, hours24);

  logger.info('[scheduled-jobs] Inactive users check job started - will run every 24 hours');
}

/**
 * Check for inactive users and send reminder emails
 * Sends email to users who haven't logged in for 30 days (one-time per user)
 */
async function checkInactiveUsers() {
  const requestId = `inactive-users-check-${Date.now()}`;
  
  try {
    logger.info({ requestId }, '[scheduled-jobs] Starting inactive users check');
    
    const baseUrl = process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    let emailsSent = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      // Skip if user already received inactive email
      if (userData.inactiveEmailSent === true) {
        skipped++;
        continue;
      }
      
      // Get lastActive date
      let lastActive = null;
      if (userData.lastActive) {
        // Handle Firestore Timestamp
        if (userData.lastActive.toDate) {
          lastActive = userData.lastActive.toDate();
        } else if (userData.lastActive instanceof Date) {
          lastActive = userData.lastActive;
        } else {
          lastActive = new Date(userData.lastActive);
        }
      } else if (userData.createdAt) {
        // Fallback to createdAt if lastActive doesn't exist
        if (userData.createdAt.toDate) {
          lastActive = userData.createdAt.toDate();
        } else {
          lastActive = new Date(userData.createdAt);
        }
      }
      
      if (!lastActive) {
        skipped++;
        continue;
      }
      
      // Check if user is inactive (30 days or more)
      if (lastActive < thirtyDaysAgo) {
        const userEmail = userData.email;
        const userName = userData.displayName || userEmail?.split('@')[0] || 'User';
        
        if (userEmail) {
          try {
            // Check user email preferences for updates/inactive user emails
            // Inactive user email is considered "updates" category
            const emailPrefs = userData.emailPreferences || {
              newsletter: true,
              operational: true,
              marketing: true,
              specNotifications: true,
              updates: true
            };
            
            // Only send if user wants updates emails
            if (emailPrefs.updates === false) {
              skipped++;
              continue;
            }
            
            // Send inactive user email
            const emailResult = await emailService.sendInactiveUserEmail(userEmail, userName, userId, baseUrl);
            
            if (emailResult.success) {
              // Mark that email was sent (one-time)
              await db.collection('users').doc(userId).update({
                inactiveEmailSent: true,
                inactiveEmailSentAt: new Date().toISOString()
              });
              
              emailsSent++;
              logger.info({ requestId, userId, userEmail }, '[scheduled-jobs] Inactive user email sent');
            } else {
              errors++;
              logger.warn({ requestId, userId, userEmail, error: emailResult.error }, '[scheduled-jobs] Failed to send inactive user email');
            }
          } catch (error) {
            errors++;
            logger.error({ requestId, userId, userEmail, error: error.message }, '[scheduled-jobs] Error sending inactive user email');
          }
        } else {
          skipped++;
          logger.warn({ requestId, userId }, '[scheduled-jobs] User has no email, skipping');
        }
      }
    }
    
    logger.info({ 
      requestId, 
      emailsSent, 
      skipped, 
      errors,
      totalUsers: usersSnapshot.size 
    }, '[scheduled-jobs] Inactive users check completed');
    
  } catch (error) {
    logger.error({ 
      requestId, 
      error: { 
        message: error.message, 
        stack: error.stack 
      } 
    }, '[scheduled-jobs] Inactive users check failed');
  }
}

/**
 * Start tools finder job (runs weekly - every 7 days)
 */
function startToolsFinderJob() {
  const apiKey = process.env.OPENAI_API_KEY;
  const enabled = process.env.TOOLS_AUTOMATION_ENABLED !== 'false';

  if (!enabled) {
    logger.info('[scheduled-jobs] Tools finder job disabled via TOOLS_AUTOMATION_ENABLED');
    return;
  }

  if (!apiKey) {
    logger.warn('[scheduled-jobs] Tools finder job not started - OPENAI_API_KEY not configured');
    return;
  }

  // Register job if not already registered
  try {
    jobRegistry.getJob('tools-finder');
  } catch (error) {
    const job = new ToolsFinderJob({ openaiApiKey: apiKey });
    jobRegistry.registerJob('tools-finder', job);
    logger.info('[scheduled-jobs] Tools finder job registered');
  }

  // Calculate milliseconds in 7 days
  const days7 = 7 * 24 * 60 * 60 * 1000;

  // Run job every 7 days
  toolsFinderInterval = setInterval(() => {
    runToolsFinderJob();
  }, days7);

  logger.info('[scheduled-jobs] Tools finder job started - will run every 7 days');
}

/**
 * Run tools finder job once
 */
async function runToolsFinderJob() {
  const requestId = `scheduled-tools-finder-${Date.now()}`;
  
  try {
    logger.info({ requestId }, '[scheduled-jobs] Starting scheduled tools finder job');
    
    await jobRegistry.executeJob('tools-finder', { dryRun: false });
    
    logger.info({ requestId }, '[scheduled-jobs] Scheduled tools finder job completed successfully');

    // Export Firestore tools to tools.json after successful run (source of truth sync)
    try {
      const exportResult = await exportToolsToJson({ dryRun: false });
      if (exportResult.success) {
        logger.info({ requestId, count: exportResult.count }, '[scheduled-jobs] Tools export to JSON completed');
      } else {
        logger.warn({ requestId, error: exportResult.error }, '[scheduled-jobs] Tools export to JSON failed');
      }
    } catch (exportErr) {
      logger.warn({ requestId, error: exportErr.message }, '[scheduled-jobs] Tools export to JSON failed');
    }
  } catch (error) {
    logger.error({ 
      requestId, 
      error: { 
        message: error.message, 
        stack: error.stack 
      } 
    }, '[scheduled-jobs] Scheduled tools finder job failed');
  }
}

/**
 * Start weekly article writer job (vibe coding / AI topics + N articles per run)
 *
 * Env:
 * - WEEKLY_ARTICLES_ENABLED — default true when articles automation is on (set 'false' to disable schedule only)
 * - WEEKLY_ARTICLES_DAY — 0–6, Sunday–Saturday (default: 1 = Monday)
 * - WEEKLY_ARTICLES_HOUR — 0–23 (default: 9)
 * - WEEKLY_ARTICLES_TIMEZONE — IANA zone (default: REPORT_TIMEZONE or UTC)
 * - WEEKLY_ARTICLES_COUNT — articles per run (default: 3, max 10)
 * - ARTICLES_AUTOMATION_ENABLED — master switch (default on)
 */
function startArticleWriterJob() {
  const apiKey = process.env.OPENAI_API_KEY;
  const masterEnabled = process.env.ARTICLES_AUTOMATION_ENABLED !== 'false';
  const weeklyEnabled = process.env.WEEKLY_ARTICLES_ENABLED !== 'false';

  if (!masterEnabled) {
    logger.info('[scheduled-jobs] Article writer job disabled via ARTICLES_AUTOMATION_ENABLED');
    return;
  }

  if (!weeklyEnabled) {
    logger.info('[scheduled-jobs] Weekly article writer schedule disabled via WEEKLY_ARTICLES_ENABLED');
    return;
  }

  if (!apiKey) {
    logger.warn('[scheduled-jobs] Article writer job not started - OPENAI_API_KEY not configured');
    return;
  }

  try {
    jobRegistry.getJob('article-writer');
  } catch (error) {
    const job = new ArticleWriterJob({ openaiApiKey: apiKey });
    jobRegistry.registerJob('article-writer', job);
    logger.info('[scheduled-jobs] Article writer job registered');
  }

  const timezone = process.env.WEEKLY_ARTICLES_TIMEZONE || process.env.REPORT_TIMEZONE || 'UTC';
  let reportHour = parseInt(process.env.WEEKLY_ARTICLES_HOUR, 10);
  if (Number.isNaN(reportHour) || reportHour < 0 || reportHour > 23) {
    reportHour = 9;
  }

  let targetDay = parseInt(process.env.WEEKLY_ARTICLES_DAY, 10);
  if (Number.isNaN(targetDay) || targetDay < 0 || targetDay > 6) {
    targetDay = 1;
  }

  const days7 = 7 * 24 * 60 * 60 * 1000;
  const now = new Date();
  const tzNow = toZonedTime(now, timezone);

  let daysUntil = (targetDay - tzNow.getDay() + 7) % 7;
  if (daysUntil === 0 && tzNow.getHours() >= reportHour) {
    daysUntil = 7;
  }

  const nextRunLocal = new Date(tzNow);
  nextRunLocal.setDate(tzNow.getDate() + daysUntil);
  nextRunLocal.setHours(reportHour, 0, 0, 0);
  nextRunLocal.setSeconds(0, 0);
  nextRunLocal.setMilliseconds(0);

  const nextRun = fromZonedTime(nextRunLocal, timezone);
  const msUntilNext = Math.max(0, nextRun.getTime() - now.getTime());

  setTimeout(() => {
    runArticleWriterJob();
    articleWriterInterval = setInterval(() => {
      runArticleWriterJob();
    }, days7);
  }, msUntilNext);

  logger.info({
    nextRun: nextRun.toISOString(),
    reportHour,
    targetDay,
    timezone,
    msUntilNext
  }, '[scheduled-jobs] Weekly article writer scheduled');
}

/**
 * Run weekly article batch once (topic list + one article per topic)
 */
async function runArticleWriterJob(overrides = {}) {
  const requestId = `scheduled-article-writer-${Date.now()}`;

  try {
    logger.info({ requestId }, '[scheduled-jobs] Starting scheduled weekly article writer job');

    const execResult = await jobRegistry.executeJob('article-writer', {
      dryRun: false,
      weeklyBatch: true,
      ...overrides
    });

    if (!execResult.success) {
      logger.error({
        requestId,
        error: execResult.error
      }, '[scheduled-jobs] Scheduled article writer job reported failure');
      return execResult;
    }

    const r = execResult.result;
    if (r?.skipped) {
      logger.info({ requestId, weekKey: r.weekKey, reason: r.reason }, '[scheduled-jobs] Weekly article batch skipped');
      return execResult;
    }

    logger.info({
      requestId,
      weekKey: r?.weekKey,
      articleCount: r?.articles?.length,
      errors: r?.errors?.length || 0
    }, '[scheduled-jobs] Scheduled weekly article writer job completed');
    return execResult;
  } catch (error) {
    logger.error({
      requestId,
      error: {
        message: error.message,
        stack: error.stack
      }
    }, '[scheduled-jobs] Scheduled article writer job failed');
    throw error;
  }
}

/**
 * Start credits sync job (runs daily - every 24 hours)
 */
function startCreditsSyncJob() {
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
  const enabled = process.env.CREDITS_SYNC_ENABLED === 'true';

  if (!enabled) {
    logger.info('[scheduled-jobs] Credits sync job is disabled by environment variable');
    return;
  }

  if (!apiKey) {
    logger.warn('[scheduled-jobs] Credits sync job not started - LEMON_SQUEEZY_API_KEY not configured');
    return;
  }

  // Register job if not already registered
  try {
    jobRegistry.getJob('CreditsSyncJob');
  } catch (error) {
    const job = new CreditsSyncJob();
    jobRegistry.registerJob('CreditsSyncJob', job);
    logger.info('[scheduled-jobs] Credits sync job registered');
  }

  // Calculate milliseconds in 24 hours
  const hours24 = 24 * 60 * 60 * 1000;

  // Run immediately on startup
  runCreditsSyncJob().catch(error => logger.error({ error: error.message }, '[scheduled-jobs] Initial CreditsSyncJob run failed'));

  // Run job every 24 hours
  creditsSyncInterval = setInterval(() => {
    runCreditsSyncJob().catch(error => logger.error({ error: error.message }, '[scheduled-jobs] Scheduled CreditsSyncJob run failed'));
  }, hours24);

  logger.info('[scheduled-jobs] Credits sync job started - will run daily');
}

/**
 * Run credits sync job once
 */
async function runCreditsSyncJob() {
  const requestId = `scheduled-credits-sync-${Date.now()}`;
  
  try {
    logger.info({ requestId }, '[scheduled-jobs] Starting scheduled credits sync job');
    
    await jobRegistry.executeJob('CreditsSyncJob', { dryRun: false });
    
    logger.info({ requestId }, '[scheduled-jobs] Scheduled credits sync job completed successfully');
  } catch (error) {
    logger.error({ 
      requestId, 
      error: { 
        message: error.message, 
        stack: error.stack 
      } 
    }, '[scheduled-jobs] Scheduled credits sync job failed');
  }
}

/**
 * Helper function to calculate next scheduled time in a specific timezone
 * @param {number} hour - Hour of day (0-23)
 * @param {string} timezone - Timezone string (e.g., 'Asia/Jerusalem', 'UTC')
 * @returns {Date} Next scheduled time in UTC
 */
function getNextScheduledTime(hour, timezone = 'UTC') {
  const now = new Date();
  
  // Get current time in the specified timezone
  const tzNow = toZonedTime(now, timezone);
  
  // Create next run time in the timezone
  const nextRun = new Date(tzNow);
  nextRun.setHours(hour, 0, 0, 0);
  nextRun.setSeconds(0, 0);
  nextRun.setMilliseconds(0);
  
  // If it's already past the scheduled hour today, schedule for tomorrow
  if (tzNow.getHours() >= hour) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  
  // Convert back to UTC
  return fromZonedTime(nextRun, timezone);
}

/**
 * Start daily report job (runs every day at configured hour)
 * Sends a daily email report with comprehensive statistics
 * 
 * Environment variables:
 * - DAILY_REPORT_HOUR: Hour of day (0-23), default: 9
 * - REPORT_TIMEZONE: Timezone (e.g., 'Asia/Jerusalem', 'UTC'), default: 'UTC'
 */
function startDailyReportJob() {
  const adminEmail = process.env.ADMIN_EMAIL || 'specifysai@gmail.com';
  const enabled = process.env.DAILY_REPORT_ENABLED !== 'false';
  const reportHour = parseInt(process.env.DAILY_REPORT_HOUR) || 9;
  const timezone = process.env.REPORT_TIMEZONE || 'UTC';

  logger.info({ 
    enabled, 
    adminEmail: adminEmail ? 'configured' : 'missing',
    dailyReportEnabled: process.env.DAILY_REPORT_ENABLED,
    reportHour,
    timezone
  }, '[scheduled-jobs] Daily report job configuration check');

  if (!enabled) {
    logger.info('[scheduled-jobs] Daily report job disabled via DAILY_REPORT_ENABLED');
    return;
  }

  if (!adminEmail) {
    logger.warn('[scheduled-jobs] Daily report job not started - ADMIN_EMAIL not configured');
    return;
  }

  // Validate hour
  let validHour = reportHour;
  if (reportHour < 0 || reportHour > 23) {
    logger.warn({ reportHour }, '[scheduled-jobs] Invalid DAILY_REPORT_HOUR, using default 9');
    validHour = 9;
  }

  // Calculate milliseconds in 24 hours
  const hours24 = 24 * 60 * 60 * 1000;

  // Calculate time until next scheduled hour in the specified timezone
  const now = new Date();
  const nextRun = getNextScheduledTime(validHour, timezone);
  const msUntilNext = nextRun.getTime() - now.getTime();

  // Run job every day (starting from next scheduled time)
  setTimeout(() => {
    // Run immediately on first scheduled time
    runDailyReportJob(adminEmail);
    
    // Then schedule for every 24 hours
    dailyReportInterval = setInterval(() => {
      runDailyReportJob(adminEmail);
    }, hours24);
  }, msUntilNext);

  logger.info({ 
    nextRun: nextRun.toISOString(),
    reportHour: validHour,
    timezone,
    adminEmail,
    msUntilNextRun: msUntilNext,
    currentTime: now.toISOString()
  }, `[scheduled-jobs] Daily report job started - will run every day at ${validHour}:00 ${timezone}`);
}

/**
 * Run daily report job once
 * Collects statistics from yesterday and sends email report
 */
async function runDailyReportJob(adminEmail) {
  const requestId = `daily-report-${Date.now()}`;
  
  try {
    logger.info({ requestId }, '[scheduled-jobs] Starting daily report job');
    
    // Calculate date range (yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Collect statistics
    const stats = await collectDailyStats(yesterday, today);
    
    // Send email report
    const baseUrl = process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';
    const emailResult = await emailService.sendDailyReport(adminEmail, stats, baseUrl);
    
    if (emailResult.success) {
      logger.info({ 
        requestId, 
        date: stats.period?.startFormatted,
        newSpecs: stats.specs?.newSpecs || 0,
        newUsers: stats.users?.newUsers || 0,
        messageId: emailResult.messageId 
      }, '[scheduled-jobs] Daily report email sent successfully');
    } else {
      logger.error({ 
        requestId, 
        error: emailResult.error 
      }, '[scheduled-jobs] Failed to send daily report email');
    }
    
  } catch (error) {
    logger.error({ 
      requestId, 
      error: { 
        message: error.message, 
        stack: error.stack 
      } 
    }, '[scheduled-jobs] Daily report job failed');
  }
}

/**
 * Start weekly report job (runs every Sunday at configured hour)
 * Sends a weekly email report with comprehensive statistics for the past week
 * 
 * Environment variables:
 * - WEEKLY_REPORT_HOUR: Hour of day (0-23), default: 9
 * - REPORT_TIMEZONE: Timezone (e.g., 'Asia/Jerusalem', 'UTC'), default: 'UTC'
 */
function startWeeklyReportJob() {
  const adminEmail = process.env.ADMIN_EMAIL || 'specifysai@gmail.com';
  const enabled = process.env.WEEKLY_REPORT_ENABLED !== 'false';
  const reportHour = parseInt(process.env.WEEKLY_REPORT_HOUR) || 9;
  const timezone = process.env.REPORT_TIMEZONE || 'UTC';

  if (!enabled) {
    logger.info('[scheduled-jobs] Weekly report job disabled via WEEKLY_REPORT_ENABLED');
    return;
  }

  if (!adminEmail) {
    logger.warn('[scheduled-jobs] Weekly report job not started - ADMIN_EMAIL not configured');
    return;
  }

  // Validate hour
  let validHour = reportHour;
  if (reportHour < 0 || reportHour > 23) {
    logger.warn({ reportHour }, '[scheduled-jobs] Invalid WEEKLY_REPORT_HOUR, using default 9');
    validHour = 9;
  }

  // Calculate milliseconds in 7 days
  const days7 = 7 * 24 * 60 * 60 * 1000;

  // Calculate time until next Sunday at the specified hour in the timezone
  const now = new Date();
  const tzNow = toZonedTime(now, timezone);
  
  // Find next Sunday
  let daysUntilSunday = (7 - tzNow.getDay()) % 7;
  
  // If today is Sunday and we haven't passed the scheduled hour, run today
  // Otherwise, schedule for next Sunday
  if (daysUntilSunday === 0 && tzNow.getHours() >= validHour) {
    daysUntilSunday = 7;
  }
  
  // Create next Sunday date in the timezone
  const nextSunday = new Date(tzNow);
  nextSunday.setDate(tzNow.getDate() + daysUntilSunday);
  nextSunday.setHours(validHour, 0, 0, 0);
  nextSunday.setSeconds(0, 0);
  nextSunday.setMilliseconds(0);
  
  // Convert back to UTC
  const nextRun = fromZonedTime(nextSunday, timezone);
  const msUntilNext = nextRun.getTime() - now.getTime();

  // Run job every 7 days (starting from next Sunday)
  setTimeout(() => {
    // Run immediately on first Sunday
    runWeeklyReportJob(adminEmail);
    
    // Then schedule for every 7 days
    weeklyReportInterval = setInterval(() => {
      runWeeklyReportJob(adminEmail);
    }, days7);
  }, msUntilNext);

  logger.info({ 
    nextRun: nextRun.toISOString(),
    reportHour: validHour,
    timezone,
    adminEmail 
  }, `[scheduled-jobs] Weekly report job started - will run every Sunday at ${validHour}:00 ${timezone}`);
}

/**
 * Run weekly report job once
 * Collects statistics from the past week and sends email report
 */
async function runWeeklyReportJob(adminEmail) {
  const requestId = `weekly-report-${Date.now()}`;
  
  try {
    logger.info({ requestId }, '[scheduled-jobs] Starting weekly report job');
    
    // Calculate date range (last 7 days - Sunday to Saturday)
    const weekEnd = new Date();
    weekEnd.setHours(23, 59, 59, 999);
    
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    
    // Collect statistics
    const stats = await collectWeeklyStats(weekStart, weekEnd);
    
    // Send email report
    const baseUrl = process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';
    const emailResult = await emailService.sendWeeklyReport(adminEmail, stats, baseUrl);
    
    if (emailResult.success) {
      logger.info({ 
        requestId, 
        weekStart: stats.period?.weekStart,
        weekEnd: stats.period?.weekEnd,
        newSpecs: stats.specs?.newSpecs || 0,
        newUsers: stats.users?.newUsers || 0,
        messageId: emailResult.messageId 
      }, '[scheduled-jobs] Weekly report email sent successfully');
    } else {
      logger.error({ 
        requestId, 
        error: emailResult.error 
      }, '[scheduled-jobs] Failed to send weekly report email');
    }
    
  } catch (error) {
    logger.error({ 
      requestId, 
      error: { 
        message: error.message, 
        stack: error.stack 
      } 
    }, '[scheduled-jobs] Weekly report job failed');
  }
}

module.exports = {
  startScheduledJobs,
  stopScheduledJobs,
  syncPaymentsDataOnce,
  checkInactiveUsers,
  runToolsFinderJob,
  runArticleWriterJob,
  startCreditsSyncJob,
  runCreditsSyncJob,
  startDailyReportJob,
  runDailyReportJob,
  startWeeklyReportJob,
  runWeeklyReportJob
};

