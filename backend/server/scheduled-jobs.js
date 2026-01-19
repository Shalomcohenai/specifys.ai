/**
 * Scheduled Jobs
 * Handles periodic tasks like syncing payments data every 24 hours
 */

const { logger } = require('./logger');
const { syncPaymentsData } = require('./lemon-payments-cache');
const { db } = require('./firebase-admin');
const emailService = require('./email-service');

let paymentsSyncInterval = null;
let inactiveUsersCheckInterval = null;

/**
 * Start all scheduled jobs
 */
function startScheduledJobs() {
  logger.info('[scheduled-jobs] Starting scheduled jobs...');

  // Sync payments data every 24 hours
  startPaymentsSyncJob();
  
  // Check for inactive users daily (to send 30-day reminder)
  startInactiveUsersCheckJob();

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
    
    const baseUrl = process.env.BASE_URL || process.env.SITE_URL || 'https://specifys.ai';
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

module.exports = {
  startScheduledJobs,
  stopScheduledJobs,
  syncPaymentsDataOnce,
  checkInactiveUsers
};

