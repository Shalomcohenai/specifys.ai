const { db } = require('./firebase-admin');

/**
 * Log a CSS crash to Firestore
 * @param {Object} crashData - CSS crash data
 */
async function logCSCCrash(crashData) {
  try {
    const {
      crashType,
      timestamp,
      url,
      userAgent,
      details = {},
      snapshot = {},
      timeSinceLoad,
      timeSinceLastActivity
    } = crashData;

    // Store the crash log
    await db.collection('cssCrashLogs').add({
      crashType,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      url: url || 'unknown',
      userAgent: userAgent || 'unknown',
      details,
      snapshot,
      timeSinceLoad: timeSinceLoad || 0,
      timeSinceLastActivity: timeSinceLastActivity || 0,
      createdAt: new Date()
    });

    console.log(`📝 CSS crash logged: ${crashType} on ${url}`);
    return true;
  } catch (error) {
    console.error('Failed to log CSS crash:', error);
    return false;
  }
}

/**
 * Get CSS crash logs from Firestore
 * @param {number} limit - Maximum number of logs to retrieve
 * @param {string} crashType - Filter by crash type (optional)
 * @param {string} url - Filter by URL (optional)
 * @returns {Promise<Array>} Array of crash logs
 */
async function getCSCCrashLogs(limit = 100, crashType = null, url = null) {
  try {
    let query = db.collection('cssCrashLogs')
      .orderBy('timestamp', 'desc');

    if (crashType) {
      query = query.where('crashType', '==', crashType);
    }

    if (url) {
      query = query.where('url', '==', url);
    }

    const snapshot = await query.limit(limit).get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate ? doc.data().timestamp.toDate() : doc.data().timestamp
    }));
  } catch (error) {
    console.error('Failed to get CSS crash logs:', error);
    throw error;
  }
}

/**
 * Get CSS crash summary (count by type)
 * @returns {Promise<Object>} Crash summary
 */
async function getCSCCrashSummary() {
  try {
    const snapshot = await db.collection('cssCrashLogs').get();
    const summary = {
      total: snapshot.size,
      byType: {},
      byUrl: {},
      recent: []
    };

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const type = data.crashType || 'unknown';
      const url = data.url || 'unknown';

      // Count by type
      summary.byType[type] = (summary.byType[type] || 0) + 1;

      // Count by URL
      summary.byUrl[url] = (summary.byUrl[url] || 0) + 1;

      // Recent crashes (last 24 hours)
      const crashTime = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
      if (crashTime >= oneDayAgo) {
        summary.recent.push({
          id: doc.id,
          type: type,
          url: url,
          timestamp: crashTime
        });
      }
    });

    // Sort recent by timestamp
    summary.recent.sort((a, b) => b.timestamp - a.timestamp);

    return summary;
  } catch (error) {
    console.error('Failed to get CSS crash summary:', error);
    return {
      total: 0,
      byType: {},
      byUrl: {},
      recent: []
    };
  }
}

module.exports = {
  logCSCCrash,
  getCSCCrashLogs,
  getCSCCrashSummary
};

