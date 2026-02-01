/**
 * Stats Collector
 * Collects statistics from Firebase for daily and weekly reports
 */

const { db } = require('./firebase-admin');
const { logger } = require('./logger');
const { getErrorLogs } = require('./error-logger');

/**
 * Convert Firestore Timestamp to Date
 */
function convertTimestamp(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toDate) {
    return timestamp.toDate();
  }
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000);
  }
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date(timestamp);
}

/**
 * Collect daily statistics
 * @param {Date} startDate - Start date (beginning of day)
 * @param {Date} endDate - End date (end of day)
 * @returns {Promise<Object>} Statistics object
 */
async function collectDailyStats(startDate, endDate) {
  const requestId = `daily-stats-${Date.now()}`;
  
  try {
    logger.info({ requestId, startDate, endDate }, '[stats-collector] Collecting daily statistics');
    
    // Set time boundaries
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    // 1. Count new specs created
    // Use orderBy and filter in memory (Firestore range queries need index)
    const specsSnapshot = await db.collection('specs')
      .orderBy('createdAt', 'desc')
      .limit(1000)
      .get();
    const newSpecsCount = specsSnapshot.docs.filter(doc => {
      const createdAt = convertTimestamp(doc.data().createdAt);
      return createdAt && createdAt >= start && createdAt <= end;
    }).length;
    
    // 2. Count guide views (from guide_views collection)
    // Use orderBy and filter in memory
    const guideViewsSnapshot = await db.collection('guide_views')
      .orderBy('timestamp', 'desc')
      .limit(5000)
      .get();
    const guideViewsInPeriod = guideViewsSnapshot.docs.filter(doc => {
      const timestamp = convertTimestamp(doc.data().timestamp);
      return timestamp && timestamp >= start && timestamp <= end;
    });
    const guideViewsCount = guideViewsInPeriod.length;
    
    // Get top guides by views
    const guideViewsByGuide = {};
    guideViewsInPeriod.forEach(doc => {
      const data = doc.data();
      const guideId = data.guideId || 'unknown';
      guideViewsByGuide[guideId] = (guideViewsByGuide[guideId] || 0) + 1;
    });
    const topGuides = Object.entries(guideViewsByGuide)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([guideId, count]) => ({ guideId, views: count }));
    
    // 3. Count article views (from article_views collection)
    // Use orderBy and filter in memory
    const articleViewsSnapshot = await db.collection('article_views')
      .orderBy('timestamp', 'desc')
      .limit(5000)
      .get();
    const articleViewsInPeriod = articleViewsSnapshot.docs.filter(doc => {
      const timestamp = convertTimestamp(doc.data().timestamp);
      return timestamp && timestamp >= start && timestamp <= end;
    });
    const articleViewsCount = articleViewsInPeriod.length;
    
    // Get top articles by views
    const articleViewsBySlug = {};
    articleViewsInPeriod.forEach(doc => {
      const data = doc.data();
      const slug = data.slug || 'unknown';
      articleViewsBySlug[slug] = (articleViewsBySlug[slug] || 0) + 1;
    });
    const topArticles = Object.entries(articleViewsBySlug)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([slug, count]) => ({ slug, views: count }));
    
    // 4. Count new users registered
    // Use orderBy and filter in memory
    const usersSnapshot = await db.collection('users')
      .orderBy('createdAt', 'desc')
      .limit(1000)
      .get();
    const newUsersCount = usersSnapshot.docs.filter(doc => {
      const createdAt = convertTimestamp(doc.data().createdAt);
      return createdAt && createdAt >= start && createdAt <= end;
    }).length;
    
    // 5. Count errors
    const allErrors = await getErrorLogs(1000);
    const errorsInPeriod = allErrors.filter(error => {
      const firstOccurrence = error.firstOccurrence;
      const errorDate = convertTimestamp(firstOccurrence);
      if (!errorDate) return false;
      return errorDate >= start && errorDate <= end;
    });
    const totalErrors = errorsInPeriod.reduce((sum, error) => sum + (error.frequency || 1), 0);
    const errorsByType = {};
    errorsInPeriod.forEach(error => {
      const type = error.errorType || 'unknown';
      errorsByType[type] = (errorsByType[type] || 0) + (error.frequency || 1);
    });
    const topErrors = errorsInPeriod
      .sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
      .slice(0, 10);
    
    // 6. Count total active users (users who logged in today)
    // Use orderBy and filter in memory
    const activeUsersSnapshot = await db.collection('users')
      .orderBy('lastActive', 'desc')
      .limit(1000)
      .get();
    const activeUsersCount = activeUsersSnapshot.docs.filter(doc => {
      const lastActive = convertTimestamp(doc.data().lastActive);
      return lastActive && lastActive >= start && lastActive <= end;
    }).length;
    
    // 7. Count purchases and calculate revenue
    const purchasesSnapshot = await db.collection('purchases')
      .orderBy('createdAt', 'desc')
      .limit(1000)
      .get();
    const purchasesInPeriod = purchasesSnapshot.docs.filter(doc => {
      const data = doc.data();
      const createdAt = convertTimestamp(data.createdAt);
      return createdAt && createdAt >= start && createdAt <= end && 
             data.status === 'paid' && !data.testMode;
    });
    
    const purchasesCount = purchasesInPeriod.length;
    const totalRevenue = purchasesInPeriod.reduce((sum, doc) => {
      const data = doc.data();
      const total = data.total || 0;
      // Convert from cents to dollars (Lemon Squeezy stores amounts in cents)
      const totalInDollars = typeof total === 'number' ? total / 100 : 0;
      return sum + totalInDollars;
    }, 0);
    
    // Get currency (use first purchase's currency or default to USD)
    const currency = purchasesInPeriod.length > 0 
      ? (purchasesInPeriod[0].data().currency || 'USD')
      : 'USD';
    
    // Group purchases by product
    const purchasesByProduct = {};
    purchasesInPeriod.forEach(doc => {
      const data = doc.data();
      const productName = data.productName || data.productKey || 'Unknown';
      const count = purchasesByProduct[productName] || { count: 0, revenue: 0 };
      count.count += 1;
      // Convert from cents to dollars (Lemon Squeezy stores amounts in cents)
      count.revenue += (data.total || 0) / 100;
      purchasesByProduct[productName] = count;
    });
    
    const topProducts = Object.entries(purchasesByProduct)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([productName, data]) => ({ 
        productName, 
        count: data.count, 
        revenue: data.revenue 
      }));
    
    const stats = {
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        startFormatted: start.toLocaleDateString('en-US'),
        endFormatted: end.toLocaleDateString('en-US')
      },
      specs: {
        newSpecs: newSpecsCount
      },
      academy: {
        guideViews: guideViewsCount,
        topGuides
      },
      articles: {
        articleViews: articleViewsCount,
        topArticles
      },
      users: {
        newUsers: newUsersCount,
        activeUsers: activeUsersCount
      },
      errors: {
        totalErrors,
        uniqueErrors: errorsInPeriod.length,
        errorsByType,
        topErrors: topErrors.map(error => ({
          errorType: error.errorType,
          errorMessage: error.errorMessage,
          errorCode: error.errorCode,
          frequency: error.frequency
        }))
      },
      purchases: {
        count: purchasesCount,
        totalRevenue,
        currency,
        topProducts
      }
    };
    
    logger.info({ 
      requestId, 
      newSpecs: newSpecsCount,
      guideViews: guideViewsCount,
      articleViews: articleViewsCount,
      newUsers: newUsersCount,
      activeUsers: activeUsersCount,
      totalErrors,
      purchases: purchasesCount,
      revenue: totalRevenue
    }, '[stats-collector] Daily statistics collected successfully');
    
    return stats;
  } catch (error) {
    logger.error({ 
      requestId, 
      error: { message: error.message, stack: error.stack } 
    }, '[stats-collector] Failed to collect daily statistics');
    throw error;
  }
}

/**
 * Collect weekly statistics (aggregated from daily stats)
 * @param {Date} weekStart - Start of week (Sunday)
 * @param {Date} weekEnd - End of week (Saturday)
 * @returns {Promise<Object>} Statistics object
 */
async function collectWeeklyStats(weekStart, weekEnd) {
  const requestId = `weekly-stats-${Date.now()}`;
  
  try {
    logger.info({ requestId, weekStart, weekEnd }, '[stats-collector] Collecting weekly statistics');
    
    // Set time boundaries
    const start = new Date(weekStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(weekEnd);
    end.setHours(23, 59, 59, 999);
    
    // Collect all stats for the week
    const stats = await collectDailyStats(start, end);
    
    // Add weekly-specific aggregations
    stats.period.type = 'weekly';
    stats.period.weekStart = start.toLocaleDateString('en-US');
    stats.period.weekEnd = end.toLocaleDateString('en-US');
    
    logger.info({ 
      requestId,
      totalNewSpecs: stats.specs.newSpecs,
      totalGuideViews: stats.academy.guideViews,
      totalArticleViews: stats.articles.articleViews,
      totalNewUsers: stats.users.newUsers,
      totalActiveUsers: stats.users.activeUsers,
      totalErrors: stats.errors.totalErrors
    }, '[stats-collector] Weekly statistics collected successfully');
    
    return stats;
  } catch (error) {
    logger.error({ 
      requestId, 
      error: { message: error.message, stack: error.stack } 
    }, '[stats-collector] Failed to collect weekly statistics');
    throw error;
  }
}

module.exports = {
  collectDailyStats,
  collectWeeklyStats
};

