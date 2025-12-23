/**
 * Admin Activity Log Service
 * Records all platform activities to admin_activity_log collection
 * This provides a permanent, chronological record of all events
 * 
 * Improved version with better structure, categories, and searchability
 */

const { db } = require('./firebase-admin');
const admin = require('firebase-admin');

const ADMIN_ACTIVITY_LOG_COLLECTION = 'admin_activity_log';

/**
 * Record an activity event
 * @param {Object} params - Activity parameters
 * @param {string} params.type - Activity type: 'user' | 'spec' | 'payment' | 'subscription' | 'credit' | 'system'
 * @param {string} params.title - Activity title (e.g., "Spec created · App Name")
 * @param {string} params.description - Activity description (e.g., user email)
 * @param {string} params.userId - User ID (optional)
 * @param {string} params.userEmail - User email (optional)
 * @param {string} params.userName - User display name (optional)
 * @param {string} params.category - Category for filtering: 'user' | 'content' | 'payment' | 'system' (optional, auto-derived from type)
 * @param {string} params.severity - Severity level: 'info' | 'warning' | 'error' (default: 'info')
 * @param {Array<string>} params.tags - Tags for searchability (optional)
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
  userName = null,
  category = null,
  severity = 'info',
  tags = [],
  metadata = {},
  timestamp = null
}) {
  try {
    if (!type || !title) {
      throw new Error('type and title are required');
    }

    // Auto-derive category from type if not provided
    if (!category) {
      const categoryMap = {
        'user': 'user',
        'spec': 'content',
        'payment': 'payment',
        'subscription': 'payment',
        'credit': 'payment',
        'system': 'system'
      };
      category = categoryMap[type] || 'system';
    }

    // Ensure tags is an array
    if (!Array.isArray(tags)) {
      tags = tags ? [tags] : [];
    }

    // Add type to tags for easier filtering
    if (!tags.includes(type)) {
      tags.push(type);
    }

    const activityData = {
      type,
      category,
      title,
      description,
      severity,
      tags,
      userId: userId || null,
      userEmail: userEmail || null,
      userName: userName || null,
      metadata: metadata || {},
      timestamp: timestamp || admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      // Add searchable fields for better querying
      searchText: `${title} ${description} ${userEmail || ''} ${userName || ''}`.toLowerCase().trim()
    };

    // Remove null/undefined values (but keep empty strings for searchText)
    Object.keys(activityData).forEach(key => {
      if (key !== 'searchText' && (activityData[key] === null || activityData[key] === undefined)) {
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
    userName: displayName,
    tags: ['registration', 'user'],
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
    tags: ['spec', 'creation', 'content'],
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
    tags: ['purchase', 'payment', 'revenue'],
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
    tags: ['subscription', 'payment', subscriptionStatus === 'active' ? 'upgrade' : 'downgrade'],
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
    tags: ['credit', 'consumption', creditType],
    metadata: {
      specId,
      specTitle,
      creditType,
      ...metadata
    }
  });
}

/**
 * Get activity events with pagination and filtering
 * @param {Object} options - Query options
 * @param {number} options.limit - Number of events to return (default: 50, max: 200)
 * @param {string} options.startAfter - Document ID to start after (for pagination)
 * @param {string} options.type - Filter by type
 * @param {string} options.category - Filter by category
 * @param {string} options.userId - Filter by userId
 * @param {string} options.searchText - Search in title/description
 * @param {Date} options.startDate - Filter events after this date
 * @param {Date} options.endDate - Filter events before this date
 * @returns {Promise<{events: Array, hasMore: boolean, lastDocId: string}>}
 */
async function getActivityEvents({
  limit = 50,
  startAfter = null,
  type = null,
  category = null,
  userId = null,
  searchText = null,
  startDate = null,
  endDate = null
} = {}) {
  try {
    // Clamp limit
    const queryLimit = Math.min(Math.max(limit, 1), 200);
    
    let query = db.collection(ADMIN_ACTIVITY_LOG_COLLECTION);
    
    // Apply filters
    if (type) {
      query = query.where('type', '==', type);
    }
    
    if (category) {
      query = query.where('category', '==', category);
    }
    
    if (userId) {
      query = query.where('userId', '==', userId);
    }
    
    if (startDate) {
      query = query.where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startDate));
    }
    
    if (endDate) {
      query = query.where('timestamp', '<=', admin.firestore.Timestamp.fromDate(endDate));
    }
    
    // Order by timestamp descending (newest first)
    query = query.orderBy('timestamp', 'desc');
    
    // Pagination
    if (startAfter) {
      const startAfterDoc = await db.collection(ADMIN_ACTIVITY_LOG_COLLECTION).doc(startAfter).get();
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      }
    }
    
    // Limit results
    query = query.limit(queryLimit + 1); // Get one extra to check if there are more
    
    const snapshot = await query.get();
    const events = [];
    let lastDocId = null;
    
    snapshot.forEach((doc) => {
      if (events.length < queryLimit) {
        const data = doc.data();
        events.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : data.timestamp,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt
        });
        lastDocId = doc.id;
      }
    });
    
    const hasMore = snapshot.size > queryLimit;
    
    // Apply search text filter if provided (client-side filtering for now)
    // In production, consider using Algolia or similar for better search
    let filteredEvents = events;
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filteredEvents = events.filter(event => 
        event.searchText?.includes(searchLower) ||
        event.title?.toLowerCase().includes(searchLower) ||
        event.description?.toLowerCase().includes(searchLower) ||
        event.userEmail?.toLowerCase().includes(searchLower) ||
        event.userName?.toLowerCase().includes(searchLower)
      );
    }
    
    return {
      events: filteredEvents,
      hasMore,
      lastDocId: hasMore ? lastDocId : null
    };
  } catch (error) {
    console.error('[admin-activity-service] Error getting activity events:', error);
    throw error;
  }
}

module.exports = {
  recordActivity,
  recordUserRegistration,
  recordSpecCreation,
  recordPurchase,
  recordSubscriptionChange,
  recordCreditConsumption,
  getActivityEvents,
  ADMIN_ACTIVITY_LOG_COLLECTION
};

