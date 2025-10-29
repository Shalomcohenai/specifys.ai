const { db } = require('./firebase-admin');

/**
 * Log an error to Firestore
 * @param {string} errorType - Type of error (e.g., 'validation', 'firebase', 'api')
 * @param {string} errorMessage - Error message
 * @param {string} errorCode - Error code
 * @param {string} userId - User ID (optional)
 * @param {string} userAgent - User agent string
 * @param {Object} additionalData - Additional error data
 */
async function logError(errorType, errorMessage, errorCode, userId = null, userAgent = null, additionalData = {}) {
  try {
    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if this error already exists today with the same code
    const existingErrors = await db.collection('errorLogs')
      .where('errorCode', '==', errorCode)
      .where('timestamp', '>=', today)
      .limit(1)
      .get();
    
    if (existingErrors.empty) {
      // First occurrence today - create new document
      await db.collection('errorLogs').add({
        errorType,
        errorMessage,
        errorCode,
        frequency: 1,
        firstOccurrence: new Date(),
        lastOccurrence: new Date(),
        userId: userId || null,
        userAgent: userAgent || 'unknown',
        ...additionalData
      });
      console.log(`📝 New error logged: ${errorCode}`);
    } else {
      // Update existing error - increment frequency
      const errorDoc = existingErrors.docs[0];
      await errorDoc.ref.update({
        frequency: (errorDoc.data().frequency || 1) + 1,
        lastOccurrence: new Date(),
        errorMessage: errorMessage // Update with latest message
      });
      console.log(`📊 Error frequency updated: ${errorCode} (count: ${(errorDoc.data().frequency || 1) + 1})`);
    }
  } catch (error) {
    console.error('Failed to log error:', error);
  }
}

/**
 * Get error logs from Firestore
 * @param {number} limit - Maximum number of logs to retrieve
 * @param {string} errorType - Filter by error type (optional)
 * @returns {Promise<Array>} Array of error logs
 */
async function getErrorLogs(limit = 100, errorType = null) {
  try {
    let query = db.collection('errorLogs')
      .orderBy('frequency', 'desc')
      .orderBy('lastOccurrence', 'desc');
    
    if (errorType) {
      query = query.where('errorType', '==', errorType);
    }
    
    const snapshot = await query.limit(limit).get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Failed to get error logs:', error);
    throw error;
  }
}

/**
 * Get error summary (count by type)
 * @returns {Promise<Object>} Error summary
 */
async function getErrorSummary() {
  try {
    const snapshot = await db.collection('errorLogs').get();
    const summary = {};
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const type = data.errorType || 'unknown';
      summary[type] = (summary[type] || 0) + data.frequency;
    });
    
    return summary;
  } catch (error) {
    console.error('Failed to get error summary:', error);
    return {};
  }
}

module.exports = {
  logError,
  getErrorLogs,
  getErrorSummary
};

