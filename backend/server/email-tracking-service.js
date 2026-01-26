const { db, admin } = require('./firebase-admin');
const { logger } = require('./logger');

/**
 * Email Tracking Service
 * Tracks email clicks and user engagement
 */

/**
 * Generate tracking URL with UTM parameters
 * @param {string} baseUrl - Base URL
 * @param {string} emailType - Type of email (welcome, spec-ready, purchase, etc.)
 * @param {string} userId - User ID
 * @param {string} linkType - Type of link (cta, footer, etc.)
 * @param {string} additionalParams - Additional URL parameters (optional)
 * @param {string} trackingBaseUrl - Base URL for tracking endpoint (optional, defaults to env)
 * @returns {string} - Tracking URL
 */
function generateTrackingUrl(baseUrl, emailType, userId, linkType = 'cta', additionalParams = {}, trackingBaseUrl = null) {
  try {
    // Build target URL with UTM parameters for analytics
    const targetUrl = new URL(baseUrl);
    targetUrl.searchParams.set('utm_source', 'email');
    targetUrl.searchParams.set('utm_medium', 'email');
    targetUrl.searchParams.set('utm_campaign', emailType);
    targetUrl.searchParams.set('utm_content', linkType);
    
    // Add additional parameters if provided
    Object.keys(additionalParams).forEach(key => {
      if (additionalParams[key]) {
        targetUrl.searchParams.set(key, additionalParams[key].toString());
      }
    });
    
    // Build tracking URL (goes through tracking endpoint)
    const trackBase = trackingBaseUrl || process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';
    const trackingUrl = new URL(`${trackBase}/api/email/track`);
    trackingUrl.searchParams.set('et', emailType); // email type
    trackingUrl.searchParams.set('lt', linkType); // link type
    trackingUrl.searchParams.set('uid', userId || 'anonymous'); // user id
    trackingUrl.searchParams.set('target', targetUrl.toString()); // target URL to redirect to
    
    return trackingUrl.toString();
  } catch (error) {
    logger.error({ error: error.message, baseUrl }, '[EmailTracking] Error generating tracking URL');
    return baseUrl; // Return original URL if parsing fails
  }
}

/**
 * Track email click event
 * @param {string} userId - User ID
 * @param {string} userEmail - User email
 * @param {string} emailType - Type of email
 * @param {string} linkType - Type of link clicked
 * @param {string} targetUrl - Target URL
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<void>}
 */
async function trackEmailClick(userId, userEmail, emailType, linkType, targetUrl, metadata = {}) {
  try {
    const trackingData = {
      userId: userId || null,
      userEmail: userEmail || null,
      emailType: emailType,
      linkType: linkType,
      targetUrl: targetUrl,
      metadata: metadata,
      clickedAt: admin.firestore.FieldValue.serverTimestamp(),
      timestamp: new Date().toISOString(),
      ip: metadata.ip || null,
      userAgent: metadata.userAgent || null,
      referrer: metadata.referrer || null
    };
    
    await db.collection('email_clicks').add(trackingData);
    
    logger.info({ 
      userId, 
      userEmail, 
      emailType, 
      linkType,
      targetUrl 
    }, '[EmailTracking] Email click tracked');
  } catch (error) {
    logger.error({ 
      error: error.message, 
      userId, 
      emailType 
    }, '[EmailTracking] Failed to track email click');
  }
}

/**
 * Get email click statistics
 * @param {Object} filters - Filters (emailType, linkType, dateRange, etc.)
 * @returns {Promise<Object>} - Statistics
 */
async function getEmailClickStats(filters = {}) {
  try {
    let query = db.collection('email_clicks');
    
    if (filters.emailType) {
      query = query.where('emailType', '==', filters.emailType);
    }
    
    if (filters.linkType) {
      query = query.where('linkType', '==', filters.linkType);
    }
    
    if (filters.startDate) {
      query = query.where('timestamp', '>=', filters.startDate);
    }
    
    if (filters.endDate) {
      query = query.where('timestamp', '<=', filters.endDate);
    }
    
    const snapshot = await query.get();
    
    const stats = {
      total: snapshot.size,
      byEmailType: {},
      byLinkType: {},
      byUser: {},
      uniqueUsers: new Set(),
      uniqueClicks: new Set()
    };
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const emailType = data.emailType || 'unknown';
      const linkType = data.linkType || 'unknown';
      const userId = data.userId || 'anonymous';
      
      // Count by email type
      stats.byEmailType[emailType] = (stats.byEmailType[emailType] || 0) + 1;
      
      // Count by link type
      stats.byLinkType[linkType] = (stats.byLinkType[linkType] || 0) + 1;
      
      // Count by user
      if (userId !== 'anonymous') {
        stats.byUser[userId] = (stats.byUser[userId] || 0) + 1;
        stats.uniqueUsers.add(userId);
      }
      
      // Track unique clicks (user + emailType + linkType)
      const uniqueKey = `${userId}_${emailType}_${linkType}`;
      stats.uniqueClicks.add(uniqueKey);
    });
    
    return {
      total: stats.total,
      uniqueUsers: stats.uniqueUsers.size,
      uniqueClicks: stats.uniqueClicks.size,
      byEmailType: stats.byEmailType,
      byLinkType: stats.byLinkType,
      topUsers: Object.entries(stats.byUser)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([userId, count]) => ({ userId, count }))
    };
  } catch (error) {
    logger.error({ error: error.message }, '[EmailTracking] Failed to get email click stats');
    throw error;
  }
}

/**
 * Get user email click journey
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - User click journey
 */
async function getUserEmailJourney(userId) {
  try {
    // Try with orderBy first (requires composite index)
    const snapshot = await db.collection('email_clicks')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .get();
    
    const journey = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        emailType: data.emailType,
        linkType: data.linkType,
        targetUrl: data.targetUrl,
        clickedAt: data.clickedAt?.toDate?.()?.toISOString() || data.timestamp,
        metadata: data.metadata || {}
      };
    });
    
    return journey;
  } catch (error) {
    // If orderBy fails (likely missing index), try without orderBy
    if (error.code === 9 || error.message?.includes('index') || error.message?.includes('Index')) {
      logger.warn({ userId, error: error.message }, '[EmailTracking] Index missing, fetching without orderBy');
      try {
        const snapshot = await db.collection('email_clicks')
          .where('userId', '==', userId)
          .get();
        
        const journey = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            emailType: data.emailType,
            linkType: data.linkType,
            targetUrl: data.targetUrl,
            clickedAt: data.clickedAt?.toDate?.()?.toISOString() || data.timestamp,
            metadata: data.metadata || {}
          };
        });
        
        // Sort manually by timestamp (descending)
        journey.sort((a, b) => {
          const dateA = new Date(a.clickedAt || 0);
          const dateB = new Date(b.clickedAt || 0);
          return dateB - dateA;
        });
        
        return journey;
      } catch (fallbackError) {
        logger.error({ error: fallbackError.message, userId }, '[EmailTracking] Failed to get user email journey (fallback)');
        throw fallbackError;
      }
    }
    
    logger.error({ error: error.message, userId }, '[EmailTracking] Failed to get user email journey');
    throw error;
  }
}

/**
 * Record that an email was sent
 * @param {string} userId - User ID
 * @param {string} recipientEmail - Recipient email
 * @param {string} subject - Email subject
 * @param {string} category - Email category (welcome, spec-ready, etc.)
 * @param {string} eventName - Event name (user_registered, spec_created, etc.)
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<string>} - Tracking ID
 */
async function recordEmailSent(userId, recipientEmail, subject, category, eventName, metadata = {}) {
  try {
    const trackingData = {
      userId: userId || null,
      recipientEmail: recipientEmail || null,
      subject: subject || null,
      category: category || 'unknown',
      eventName: eventName || 'unknown',
      metadata: metadata || {},
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      timestamp: new Date().toISOString()
    };
    
    const docRef = await db.collection('email_sent').add(trackingData);
    
    logger.info({ 
      trackingId: docRef.id,
      userId, 
      recipientEmail, 
      category,
      eventName
    }, '[EmailTracking] Email sent recorded');
    
    return docRef.id;
  } catch (error) {
    logger.error({ 
      error: error.message, 
      userId, 
      category 
    }, '[EmailTracking] Failed to record email sent');
    throw error;
  }
}

/**
 * Get total emails sent statistics
 * @param {Object} filters - Filters (category, eventName, startDate, endDate)
 * @returns {Promise<Object>} - Statistics
 */
async function getEmailSentStats(filters = {}) {
  try {
    let query = db.collection('email_sent');
    
    if (filters.category) {
      query = query.where('category', '==', filters.category);
    }
    
    if (filters.eventName) {
      query = query.where('eventName', '==', filters.eventName);
    }
    
    if (filters.startDate) {
      query = query.where('timestamp', '>=', filters.startDate);
    }
    
    if (filters.endDate) {
      query = query.where('timestamp', '<=', filters.endDate);
    }
    
    const snapshot = await query.get();
    
    const stats = {
      total: snapshot.size,
      byCategory: {},
      byEventName: {},
      uniqueRecipients: new Set()
    };
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const category = data.category || 'unknown';
      const eventName = data.eventName || 'unknown';
      const recipientEmail = data.recipientEmail;
      
      // Count by category
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      
      // Count by event name
      stats.byEventName[eventName] = (stats.byEventName[eventName] || 0) + 1;
      
      // Track unique recipients
      if (recipientEmail) {
        stats.uniqueRecipients.add(recipientEmail);
      }
    });
    
    return {
      total: stats.total,
      uniqueRecipients: stats.uniqueRecipients.size,
      byCategory: stats.byCategory,
      byEventName: stats.byEventName
    };
  } catch (error) {
    logger.error({ error: error.message }, '[EmailTracking] Failed to get email sent stats');
    throw error;
  }
}

module.exports = {
  generateTrackingUrl,
  trackEmailClick,
  getEmailClickStats,
  getUserEmailJourney,
  recordEmailSent,
  getEmailSentStats
};

