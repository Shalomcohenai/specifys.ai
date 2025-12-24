const { db } = require('./firebase-admin');

/**
 * Save a server log to Firestore
 * This captures logs from Render and saves them with user context
 * @param {string} level - Log level (error, warn, info, debug)
 * @param {Object} logData - Log data object
 * @param {string} message - Log message
 */
async function saveRenderLog(level, logData, message) {
  try {
    // Only save errors and warnings to avoid too much data
    if (level !== 'error' && level !== 'warn') {
      return;
    }

    // Extract user information from log data
    const userId = logData.userId || logData.adminUserId || logData.user?.uid || null;
    const userEmail = logData.userEmail || logData.adminEmail || logData.user?.email || null;
    
    // Extract request information
    const requestId = logData.requestId || null;
    const method = logData.method || null;
    const path = logData.path || logData.originalUrl || null;
    const statusCode = logData.statusCode || logData.httpStatusCode || null;
    
    // Extract error information
    const errorName = logData.error?.name || logData.errorType || null;
    const errorMessage = logData.error?.message || logData.errorMessage || message || 'Unknown error';
    const errorStack = logData.error?.stack || logData.stack || null;
    const errorCode = logData.error?.code || logData.errorCode || logData.code || null;
    
    // Helper function to remove undefined values recursively
    function removeUndefined(obj) {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }
      if (Array.isArray(obj)) {
        return obj.map(removeUndefined).filter(item => item !== undefined);
      }
      const cleaned = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = removeUndefined(value);
        }
      }
      return cleaned;
    }

    // Clean logData to remove undefined values
    const cleanedLogData = removeUndefined(logData);

    // Build log document
    const logDoc = {
      level: level.toUpperCase(),
      message: errorMessage,
      timestamp: new Date(),
      userId: userId,
      userEmail: userEmail,
      requestId: requestId,
      method: method,
      path: path,
      statusCode: statusCode,
      errorName: errorName,
      errorStack: errorStack,
      errorCode: errorCode,
      logType: logData.type || 'server',
      ip: logData.ip || null,
      userAgent: logData.userAgent || null,
      origin: logData.origin || null,
      // Store cleaned log data for debugging (without undefined values)
      fullData: cleanedLogData
    };

    // Save to Firestore with ignoreUndefinedProperties
    await db.collection('renderLogs').add(logDoc);
  } catch (error) {
    // Don't throw - we don't want logging failures to break the app
    // Just log to console as fallback
    console.error('[render-logger] Failed to save log to Firestore:', error.message);
  }
}

/**
 * Get render logs from Firestore
 * @param {number} limit - Maximum number of logs to retrieve
 * @param {string} level - Filter by log level (optional)
 * @param {string} userId - Filter by user ID (optional)
 * @param {Date} startDate - Start date for filtering (optional)
 * @param {Date} endDate - End date for filtering (optional)
 * @returns {Promise<Array>} Array of render logs
 */
async function getRenderLogs(limit = 100, level = null, userId = null, startDate = null, endDate = null) {
  try {
    let query = db.collection('renderLogs')
      .orderBy('timestamp', 'desc');
    
    if (level) {
      query = query.where('level', '==', level.toUpperCase());
    }
    
    if (userId) {
      query = query.where('userId', '==', userId);
    }
    
    if (startDate) {
      query = query.where('timestamp', '>=', startDate);
    }
    
    if (endDate) {
      query = query.where('timestamp', '<=', endDate);
    }
    
    const snapshot = await query.limit(limit).get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore timestamps to Date objects
      timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : doc.data().timestamp
    }));
  } catch (error) {
    console.error('[render-logger] Error fetching render logs:', error.message);
    throw error;
  }
}

/**
 * Get render logs summary (count by level)
 * @param {Date} startDate - Start date for filtering (optional)
 * @param {Date} endDate - End date for filtering (optional)
 * @returns {Promise<Object>} Summary object with counts by level
 */
async function getRenderLogsSummary(startDate = null, endDate = null) {
  try {
    let query = db.collection('renderLogs');
    
    if (startDate) {
      query = query.where('timestamp', '>=', startDate);
    }
    
    if (endDate) {
      query = query.where('timestamp', '<=', endDate);
    }
    
    const snapshot = await query.get();
    const summary = {
      total: 0,
      error: 0,
      warn: 0,
      info: 0,
      debug: 0
    };
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const level = (data.level || 'INFO').toLowerCase();
      summary.total++;
      if (summary.hasOwnProperty(level)) {
        summary[level]++;
      }
    });
    
    return summary;
  } catch (error) {
    console.error('[render-logger] Error fetching render logs summary:', error.message);
    return {
      total: 0,
      error: 0,
      warn: 0,
      info: 0,
      debug: 0
    };
  }
}

module.exports = {
  saveRenderLog,
  getRenderLogs,
  getRenderLogsSummary
};







