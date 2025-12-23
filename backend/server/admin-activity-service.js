/**
 * Admin Activity Log Service
 * Records all platform activities to admin_activity_log collection
 * This provides a permanent, chronological record of all events
 */

const { db } = require('./firebase-admin');
const admin = require('firebase-admin');

const ADMIN_ACTIVITY_LOG_COLLECTION = 'admin_activity_log';

/**
 * Record an activity event
 * @param {Object} params - Activity parameters
 * @param {string} params.type - Activity type: 'user' | 'spec' | 'payment' | 'subscription'
 * @param {string} params.title - Activity title (e.g., "Spec created · App Name")
 * @param {string} params.description - Activity description (e.g., user email)
 * @param {string} params.userId - User ID (optional)
 * @param {string} params.userEmail - User email (optional)
 * @param {Object} params.metadata - Additional metadata (specId, purchaseId, etc.)
 * @param {Date|admin.firestore.Timestamp} params.timestamp - Event timestamp (defaults to server timestamp)
 * @returns {Promise<string>} - Document ID of created activity log
 */
async function recordActivity({
  type,
  title,
  description = '',
  userId = null,
  userEmail = null,
  metadata = {},
  timestamp = null
}) {
  try {
    if (!type || !title) {
      throw new Error('type and title are required');
    }

    const activityData = {
      type,
      title,
      description,
      userId: userId || null,
      userEmail: userEmail || null,
      metadata: metadata || {},
      timestamp: timestamp || admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Remove null/undefined values
    Object.keys(activityData).forEach(key => {
      if (activityData[key] === null || activityData[key] === undefined) {
        delete activityData[key];
      }
    });

    const docRef = await db.collection(ADMIN_ACTIVITY_LOG_COLLECTION).add(activityData);
    
    console.log(`[admin-activity-service] Recorded activity: ${type} - ${title} (ID: ${docRef.id})`);
    
    return docRef.id;
  } catch (error) {
    console.error('[admin-activity-service] Error recording activity:', error);
    // Don't throw - activity logging should not break main flow
    return null;
  }
}

/**
 * Record user registration activity
 * @param {string} userId - User ID
 * @param {string} userEmail - User email
 * @param {string} displayName - User display name
 * @param {Object} metadata - Additional metadata
 */
async function recordUserRegistration(userId, userEmail, displayName, metadata = {}) {
  return recordActivity({
    type: 'user',
    title: `New user registered · ${displayName || userEmail || userId}`,
    description: userEmail || userId,
    userId,
    userEmail,
    metadata: {
      displayName,
      ...metadata
    }
  });
}

/**
 * Record spec creation activity
 * @param {string} specId - Spec ID
 * @param {string} userId - User ID
 * @param {string} userEmail - User email
 * @param {string} specTitle - Spec title
 * @param {Object} metadata - Additional metadata
 */
async function recordSpecCreation(specId, userId, userEmail, specTitle, metadata = {}) {
  return recordActivity({
    type: 'spec',
    title: `Spec created · ${specTitle || 'Untitled'}`,
    description: userEmail || userId,
    userId,
    userEmail,
    metadata: {
      specId,
      specTitle,
      ...metadata
    }
  });
}

/**
 * Record purchase activity
 * @param {string} purchaseId - Purchase/Order ID
 * @param {string} userId - User ID
 * @param {string} userEmail - User email
 * @param {string} productName - Product name
 * @param {number} total - Purchase total
 * @param {string} currency - Currency code
 * @param {Object} metadata - Additional metadata
 */
async function recordPurchase(purchaseId, userId, userEmail, productName, total, currency = 'USD', metadata = {}) {
  return recordActivity({
    type: 'payment',
    title: `Purchase: ${productName || 'Product'}`,
    description: `${currency} ${total || 0} • ${userEmail || userId || 'Unknown'}`,
    userId,
    userEmail,
    metadata: {
      purchaseId,
      productName,
      total,
      currency,
      ...metadata
    }
  });
}

/**
 * Record subscription change activity
 * @param {string} userId - User ID
 * @param {string} userEmail - User email
 * @param {string} subscriptionType - Subscription type (e.g., 'pro')
 * @param {string} subscriptionStatus - Subscription status (e.g., 'active', 'cancelled')
 * @param {Object} metadata - Additional metadata
 */
async function recordSubscriptionChange(userId, userEmail, subscriptionType, subscriptionStatus, metadata = {}) {
  const action = subscriptionStatus === 'active' ? 'activated' : subscriptionStatus === 'cancelled' ? 'cancelled' : 'changed';
  
  return recordActivity({
    type: 'subscription',
    title: `Subscription ${action} · ${subscriptionType || 'Unknown'}`,
    description: userEmail || userId,
    userId,
    userEmail,
    metadata: {
      subscriptionType,
      subscriptionStatus,
      ...metadata
    }
  });
}

/**
 * Record credit consumption activity
 * @param {string} userId - User ID
 * @param {string} userEmail - User email
 * @param {string} specId - Spec ID
 * @param {string} specTitle - Spec title
 * @param {string} creditType - Credit type consumed ('free', 'paid', 'bonus')
 * @param {Object} metadata - Additional metadata
 */
async function recordCreditConsumption(userId, userEmail, specId, specTitle, creditType, metadata = {}) {
  return recordActivity({
    type: 'credit',
    title: `Credit consumed · ${specTitle || 'Spec'}`,
    description: `${creditType || 'credit'} credit • ${userEmail || userId}`,
    userId,
    userEmail,
    metadata: {
      specId,
      specTitle,
      creditType,
      ...metadata
    }
  });
}

module.exports = {
  recordActivity,
  recordUserRegistration,
  recordSpecCreation,
  recordPurchase,
  recordSubscriptionChange,
  recordCreditConsumption,
  ADMIN_ACTIVITY_LOG_COLLECTION
};

