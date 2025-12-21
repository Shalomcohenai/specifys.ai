/**
 * Metrics Calculator - Calculates all dashboard metrics
 */

const DATE_RANGES = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000
};

export class MetricsCalculator {
  constructor(dataManager) {
    this.dataManager = dataManager;
  }
  
  /**
   * Calculate overview metrics
   */
  calculateOverviewMetrics(range = 'week') {
    const threshold = Date.now() - (DATE_RANGES[range] || DATE_RANGES.week);
    const allData = this.dataManager.getAllData();
    
    // Users
    const users = allData.users;
    const totalUsers = users.length;
    const newUsers = users.filter(u => 
      u.createdAt && u.createdAt.getTime() >= threshold
    ).length;
    
    // Live users (active in last 15 minutes)
    const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
    const liveUsers = users.filter(u => 
      u.lastActive && u.lastActive.getTime() >= fifteenMinutesAgo
    ).length;
    
    // Pro users
    const proUsers = users.filter(u => {
      const userCredits = allData.userCredits.find(uc => uc.userId === u.id);
      return userCredits?.unlimited || u.plan === 'pro';
    }).length;
    
    // Specs
    const specs = allData.specs;
    const specsInRange = specs.filter(s => 
      s.createdAt && s.createdAt.getTime() >= threshold
    ).length;
    const specsTotal = specs.length;
    
    // Revenue
    const purchases = allData.purchases.filter(p => 
      p.createdAt && p.createdAt.getTime() >= threshold
    );
    const revenueRange = purchases.reduce((sum, p) => sum + (p.total || 0), 0);
    const revenueTotal = allData.purchases.reduce((sum, p) => sum + (p.total || 0), 0);
    
    return {
      totalUsers,
      newUsers,
      liveUsers,
      proUsers,
      proShare: totalUsers > 0 ? (proUsers / totalUsers) * 100 : 0,
      specsInRange,
      specsTotal,
      revenueRange,
      revenueTotal
    };
  }
  
  /**
   * Calculate daily data for last 7 days
   */
  calculateDailyData(data, dateField = 'createdAt', valueField = null) {
    const dailyData = new Array(7).fill(0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    data.forEach(item => {
      const itemDate = item[dateField];
      if (!itemDate) return;
      
      const date = new Date(itemDate);
      date.setHours(0, 0, 0, 0);
      const daysAgo = Math.floor((today - date) / (1000 * 60 * 60 * 24));
      
      if (daysAgo >= 0 && daysAgo < 7) {
        const value = valueField ? (item[valueField] || 0) : 1;
        dailyData[6 - daysAgo] += value;
      }
    });
    
    return dailyData;
  }
  
  /**
   * Calculate user growth over time
   */
  calculateUserGrowth() {
    const allData = this.dataManager.getAllData();
    const users = allData.users;
    
    const byDay = new Map();
    users.forEach(user => {
      if (user.createdAt) {
        const date = user.createdAt.toISOString().slice(0, 10);
        byDay.set(date, (byDay.get(date) || 0) + 1);
      }
    });
    
    const sortedDates = Array.from(byDay.keys()).sort();
    let cumulative = 0;
    
    return sortedDates.map(date => {
      cumulative += byDay.get(date);
      return { date, count: cumulative };
    });
  }
  
  /**
   * Calculate revenue trend
   */
  calculateRevenueTrend() {
    const allData = this.dataManager.getAllData();
    const purchases = allData.purchases;
    
    const byDay = new Map();
    purchases.forEach(purchase => {
      if (purchase.createdAt) {
        const date = purchase.createdAt.toISOString().slice(0, 10);
        const current = byDay.get(date) || 0;
        byDay.set(date, current + (purchase.total || 0));
      }
    });
    
    const sortedDates = Array.from(byDay.keys()).sort();
    
    return sortedDates.map(date => ({
      date,
      revenue: byDay.get(date)
    }));
  }
}

