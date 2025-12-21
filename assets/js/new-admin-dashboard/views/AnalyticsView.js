/**
 * Analytics View - Detailed data analysis
 * Shows trends, distributions, and top performers
 */

import { ChartComponent } from '../components/ChartComponent.js';
import { helpers } from '../utils/helpers.js';

export class AnalyticsView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.charts = new Map();
    this.range = 30; // days
    this.funnelRange = 'week'; // default: last 7 days
    
    this.init();
  }
  
  /**
   * Initialize view
   */
  init() {
    // Setup event listeners
    this.setupEventListeners();
    
    // Subscribe to data changes
    this.setupDataSubscriptions();
    
    // Initialize charts
    this.initCharts();
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const rangeSelect = helpers.dom('#analytics-range-select');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', (e) => {
        this.range = parseInt(e.target.value);
        this.updateAll();
      });
    }
    
    // Funnel range select
    const funnelRangeSelect = helpers.dom('#funnel-range-select');
    if (funnelRangeSelect) {
      funnelRangeSelect.addEventListener('change', (e) => {
        this.funnelRange = e.target.value;
        this.updateAll();
      });
    }
  }
  
  /**
   * Setup data subscriptions
   */
  setupDataSubscriptions() {
    this.dataManager.on('data', ({ source }) => {
      if (['users', 'specs', 'purchases', 'userCredits'].includes(source)) {
        this.updateAll();
      }
    });
  }
  
  /**
   * Initialize charts
   */
  initCharts() {
    if (!window.Chart) {
      console.warn('[AnalyticsView] Chart.js not loaded');
      return;
    }
    
    // User Growth Chart
    this.initChart('analytics-chart-users', 'line', {
      label: 'New Users',
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)'
    });
    
    // Specs Growth Chart
    this.initChart('analytics-chart-specs', 'line', {
      label: 'Specs Created',
      borderColor: 'rgb(139, 92, 246)',
      backgroundColor: 'rgba(139, 92, 246, 0.1)'
    });
    
    // Revenue Trend Chart
    this.initChart('analytics-chart-revenue', 'line', {
      label: 'Revenue',
      borderColor: 'rgb(245, 158, 11)',
      backgroundColor: 'rgba(245, 158, 11, 0.1)'
    });
    
    // Conversion Funnel Chart
    this.initFunnelChart('analytics-chart-funnel');
  }
  
  /**
   * Initialize single chart
   */
  initChart(canvasId, type, config) {
    const canvas = helpers.dom(`#${canvasId}`);
    if (!canvas || !window.Chart) return;
    
    // Set size
    canvas.style.width = '100%';
    canvas.style.height = '250px';
    
    const ctx = canvas.getContext('2d');
    const chart = new window.Chart(ctx, {
      type: type,
      data: {
        labels: [],
        datasets: [{
          label: config.label,
          data: [],
          borderColor: config.borderColor,
          backgroundColor: config.backgroundColor || config.borderColor,
          borderWidth: 2,
          fill: type === 'line',
          tension: type === 'line' ? 0.4 : 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: type !== 'doughnut',
            position: 'top'
          },
          tooltip: {
            enabled: true
          }
        },
        scales: type !== 'doughnut' ? {
          x: {
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          }
        } : {}
      }
    });
    
    this.charts.set(canvasId, chart);
  }
  
  /**
   * Update all charts and tables
   */
  updateAll() {
    const allData = this.dataManager.getAllData();
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - this.range);
    
    // Calculate date range for funnel based on funnelRange
    const funnelEndDate = new Date();
    funnelEndDate.setHours(23, 59, 59, 999);
    const funnelStartDate = new Date();
    
    if (this.funnelRange === 'day') {
      funnelStartDate.setHours(0, 0, 0, 0);
    } else if (this.funnelRange === 'week') {
      funnelStartDate.setDate(funnelEndDate.getDate() - 6); // Last 7 days including today
      funnelStartDate.setHours(0, 0, 0, 0);
    } else if (this.funnelRange === 'month') {
      funnelStartDate.setDate(funnelEndDate.getDate() - 29); // Last 30 days including today
      funnelStartDate.setHours(0, 0, 0, 0);
    } else {
      funnelStartDate.setDate(funnelEndDate.getDate() - 6);
      funnelStartDate.setHours(0, 0, 0, 0);
    }
    
    // Update charts
    this.updateUserGrowthChart(allData.users, startDate, endDate);
    this.updateSpecsGrowthChart(allData.specs, startDate, endDate);
    this.updateRevenueTrendChart(allData.purchases, startDate, endDate);
    this.updateConversionFunnel(allData, funnelStartDate, funnelEndDate);
    
    // Update tables
    this.updateTopUsersSpecs(allData.users, allData.specsByUser);
    this.updateTopUsersPurchases(allData.users, allData.purchases);
  }
  
  /**
   * Update user growth chart
   */
  updateUserGrowthChart(users, startDate, endDate) {
    const { labels, data } = this.calculateDailyData(users, 'createdAt', startDate, endDate);
    const chart = this.charts.get('analytics-chart-users');
    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = data;
      chart.update('none');
    }
  }
  
  /**
   * Update specs growth chart
   */
  updateSpecsGrowthChart(specs, startDate, endDate) {
    const { labels, data } = this.calculateDailyData(specs, 'createdAt', startDate, endDate);
    const chart = this.charts.get('analytics-chart-specs');
    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = data;
      chart.update('none');
    }
  }
  
  /**
   * Update revenue trend chart
   */
  updateRevenueTrendChart(purchases, startDate, endDate) {
    const { labels, data } = this.calculateDailyRevenue(purchases, startDate, endDate);
    const chart = this.charts.get('analytics-chart-revenue');
    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = data;
      chart.update('none');
    }
  }
  
  /**
   * Initialize funnel chart
   */
  initFunnelChart(canvasId) {
    const canvas = helpers.dom(`#${canvasId}`);
    if (!canvas || !window.Chart) return;
    
    canvas.style.width = '100%';
    canvas.style.height = '250px';
    
    const ctx = canvas.getContext('2d');
    const chart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Visitors', 'Signups', 'Specs Created', 'Buy Now Clicks', 'Purchases'],
        datasets: [{
          label: 'Conversion Funnel',
          data: [0, 0, 0, 0, 0],
          backgroundColor: [
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)'
          ],
          borderColor: [
            'rgba(59, 130, 246, 1)',
            'rgba(16, 185, 129, 1)',
            'rgba(139, 92, 246, 1)',
            'rgba(245, 158, 11, 1)',
            'rgba(239, 68, 68, 1)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y', // Horizontal bar chart
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              afterLabel: (context) => {
                const index = context.dataIndex;
                const value = context.parsed.x;
                if (index === 0) return '';
                const prevValue = context.chart.data.datasets[0].data[index - 1];
                if (prevValue === 0) return '';
                const conversion = ((value / prevValue) * 100).toFixed(1);
                return `Conversion: ${conversion}%`;
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          y: {
            grid: {
              display: false
            }
          }
        }
      }
    });
    
    this.charts.set(canvasId, chart);
  }
  
  /**
   * Update conversion funnel
   */
  updateConversionFunnel(allData, startDate, endDate) {
    // Calculate funnel metrics
    // 1. Visitors - approximate from activity logs and users
    const visitors = this.calculateVisitors(allData.activityLogs, startDate, endDate, allData.users);
    
    // 2. Signups - users who registered in the range
    const signups = allData.users.filter(user => {
      if (!user.createdAt) return false;
      const created = user.createdAt instanceof Date ? user.createdAt.getTime() : new Date(user.createdAt).getTime();
      return created >= startDate.getTime() && created <= endDate.getTime();
    }).length;
    
    // 3. Specs Created - specs created in the range
    const specsCreated = allData.specs.filter(spec => {
      if (!spec.createdAt) return false;
      const created = spec.createdAt instanceof Date ? spec.createdAt.getTime() : new Date(spec.createdAt).getTime();
      return created >= startDate.getTime() && created <= endDate.getTime();
    }).length;
    
    // 4. Buy Now Clicks - approximate from purchases (if they purchased, they clicked buy now)
    // We can also check activity logs for "buy now" or "checkout" events
    const buyNowClicks = this.calculateBuyNowClicks(allData.purchases, allData.activityLogs, startDate, endDate);
    
    // 5. Purchases - actual purchases in the range
    const purchases = allData.purchases.filter(purchase => {
      if (!purchase.createdAt) return false;
      const created = purchase.createdAt instanceof Date ? purchase.createdAt.getTime() : new Date(purchase.createdAt).getTime();
      return created >= startDate.getTime() && created <= endDate.getTime();
    }).length;
    
    // Update chart
    const chart = this.charts.get('analytics-chart-funnel');
    if (chart) {
      chart.data.datasets[0].data = [visitors, signups, specsCreated, buyNowClicks, purchases];
      chart.update('none');
    }
    
    // Calculate conversion rates
    const conversions = {
      visitorsToSignups: visitors > 0 ? ((signups / visitors) * 100).toFixed(1) : '0.0',
      signupsToSpecs: signups > 0 ? ((specsCreated / signups) * 100).toFixed(1) : '0.0',
      specsToBuyNow: specsCreated > 0 ? ((buyNowClicks / specsCreated) * 100).toFixed(1) : '0.0',
      buyNowToPurchase: buyNowClicks > 0 ? ((purchases / buyNowClicks) * 100).toFixed(1) : '0.0',
      overallConversion: visitors > 0 ? ((purchases / visitors) * 100).toFixed(1) : '0.0'
    };
    
    // Update funnel details
    this.renderFunnelDetails({
      visitors,
      signups,
      specsCreated,
      buyNowClicks,
      purchases
    }, conversions);
  }
  
  /**
   * Calculate visitors from activity logs and users
   * Since we don't track all visitors, we approximate based on:
   * 1. Unique users from activity logs
   * 2. All users who were active in the range
   * 3. Use the higher value as approximation
   */
  calculateVisitors(activityLogs, startDate, endDate, allUsers) {
    // Method 1: Count unique users from activity logs
    let uniqueUsersFromLogs = new Set();
    if (activityLogs && activityLogs.length > 0) {
      activityLogs.forEach(log => {
        const timestamp = log.timestamp || log.createdAt;
        if (!timestamp) return;
        
        const time = timestamp instanceof Date ? timestamp.getTime() : new Date(timestamp).getTime();
        if (time >= startDate.getTime() && time <= endDate.getTime()) {
          const userId = log.userId || log.userEmail || log.user || log.meta?.userId || log.meta?.userEmail;
          if (userId) {
            uniqueUsersFromLogs.add(userId);
          }
        }
      });
    }
    
    // Method 2: Count users who were active in the range
    let activeUsers = 0;
    if (allUsers && allUsers.length > 0) {
      activeUsers = allUsers.filter(user => {
        // Check if user was created in range (new visitor)
        if (user.createdAt) {
          const created = user.createdAt instanceof Date ? user.createdAt.getTime() : new Date(user.createdAt).getTime();
          if (created >= startDate.getTime() && created <= endDate.getTime()) {
            return true;
          }
        }
        // Check if user was active in range
        if (user.lastActive) {
          const lastActive = user.lastActive instanceof Date ? user.lastActive.getTime() : new Date(user.lastActive).getTime();
          if (lastActive >= startDate.getTime() && lastActive <= endDate.getTime()) {
            return true;
          }
        }
        return false;
      }).length;
    }
    
    // Use the higher value as approximation
    // Also add some buffer for anonymous visitors (estimate 20% more)
    const loggedVisitors = Math.max(uniqueUsersFromLogs.size, activeUsers);
    const estimatedVisitors = Math.ceil(loggedVisitors * 1.2);
    
    // Ensure we have at least as many visitors as signups (visitors >= signups)
    return Math.max(estimatedVisitors, loggedVisitors);
  }
  
  /**
   * Calculate buy now clicks
   */
  calculateBuyNowClicks(purchases, activityLogs, startDate, endDate) {
    // Count purchases (they clicked buy now)
    const purchaseClicks = purchases.filter(p => {
      if (!p.createdAt) return false;
      const created = p.createdAt instanceof Date ? p.createdAt.getTime() : new Date(p.createdAt).getTime();
      return created >= startDate.getTime() && created <= endDate.getTime();
    }).length;
    
    // Also check activity logs for buy now / checkout events
    let buyNowEvents = 0;
    if (activityLogs && activityLogs.length > 0) {
      buyNowEvents = activityLogs.filter(log => {
        const timestamp = log.timestamp || log.createdAt;
        if (!timestamp) return false;
        
        const time = timestamp instanceof Date ? timestamp.getTime() : new Date(timestamp).getTime();
        if (time < startDate.getTime() || time > endDate.getTime()) return false;
        
        const message = (log.message || log.title || '').toLowerCase();
        const description = (log.description || '').toLowerCase();
        return message.includes('buy now') || 
               message.includes('checkout') || 
               description.includes('buy now') ||
               description.includes('checkout') ||
               log.type === 'payment' ||
               log.level === 'payment';
      }).length;
    }
    
    // Return the higher value (either purchases or buy now events)
    return Math.max(purchaseClicks, buyNowEvents);
  }
  
  /**
   * Render funnel details with conversion rates
   */
  renderFunnelDetails(funnel, conversions) {
    const detailsEl = helpers.dom('#funnel-details');
    if (!detailsEl) return;
    
    const html = `
      <div class="funnel-metrics-grid">
        <div class="funnel-metric">
          <span class="metric-label">Visitors → Signups</span>
          <span class="metric-value">${conversions.visitorsToSignups}%</span>
          <span class="metric-count">${funnel.signups} / ${funnel.visitors}</span>
        </div>
        <div class="funnel-metric">
          <span class="metric-label">Signups → Specs Created</span>
          <span class="metric-value">${conversions.signupsToSpecs}%</span>
          <span class="metric-count">${funnel.specsCreated} / ${funnel.signups}</span>
        </div>
        <div class="funnel-metric">
          <span class="metric-label">Specs → Buy Now Clicks</span>
          <span class="metric-value">${conversions.specsToBuyNow}%</span>
          <span class="metric-count">${funnel.buyNowClicks} / ${funnel.specsCreated}</span>
        </div>
        <div class="funnel-metric">
          <span class="metric-label">Buy Now → Purchases</span>
          <span class="metric-value">${conversions.buyNowToPurchase}%</span>
          <span class="metric-count">${funnel.purchases} / ${funnel.buyNowClicks}</span>
        </div>
        <div class="funnel-metric highlight">
          <span class="metric-label">Overall Conversion</span>
          <span class="metric-value">${conversions.overallConversion}%</span>
          <span class="metric-count">${funnel.purchases} / ${funnel.visitors}</span>
        </div>
      </div>
    `;
    
    detailsEl.innerHTML = html;
  }
  
  /**
   * Calculate daily data
   */
  calculateDailyData(items, dateField, startDate, endDate) {
    const labels = [];
    const data = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dateStr = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      labels.push(dateStr);
      
      const dayStart = new Date(current);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);
      
      const count = items.filter(item => {
        const itemDate = item[dateField];
        if (!itemDate) return false;
        return itemDate >= dayStart && itemDate <= dayEnd;
      }).length;
      
      data.push(count);
      current.setDate(current.getDate() + 1);
    }
    
    return { labels, data };
  }
  
  /**
   * Calculate daily revenue
   */
  calculateDailyRevenue(purchases, startDate, endDate) {
    const labels = [];
    const data = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dateStr = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      labels.push(dateStr);
      
      const dayStart = new Date(current);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);
      
      const revenue = purchases
        .filter(p => {
          if (!p.createdAt) return false;
          return p.createdAt >= dayStart && p.createdAt <= dayEnd;
        })
        .reduce((sum, p) => sum + (p.total || 0), 0);
      
      data.push(revenue);
      current.setDate(current.getDate() + 1);
    }
    
    return { labels, data };
  }
  
  /**
   * Update top users by specs
   */
  updateTopUsersSpecs(users, specsByUser) {
    const table = helpers.dom('#top-users-specs-table tbody');
    if (!table) return;
    
    const userSpecCounts = users.map(user => {
      const specCount = specsByUser[user.id]?.length || 0;
      return { user, specCount };
    });
    
    userSpecCounts.sort((a, b) => b.specCount - a.specCount);
    const topUsers = userSpecCounts.slice(0, 10);
    
    if (topUsers.length === 0) {
      table.innerHTML = '<tr><td colspan="3" class="table-empty">No data available</td></tr>';
      return;
    }
    
    const html = topUsers.map(({ user, specCount }) => {
      const userCredits = this.dataManager.getAllData().userCredits.find(uc => uc.userId === user.id);
      const plan = userCredits?.unlimited ? 'Pro' : (user.plan || 'Free');
      
      return `
        <tr>
          <td>
            <div class="user-info">
              <div class="user-name">${this.escapeHtml(user.displayName)}</div>
              <div class="user-email">${this.escapeHtml(user.email)}</div>
            </div>
          </td>
          <td><strong>${specCount}</strong></td>
          <td><span class="plan-badge plan-${plan.toLowerCase()}">${plan}</span></td>
        </tr>
      `;
    }).join('');
    
    table.innerHTML = html;
  }
  
  /**
   * Update top users by purchases
   */
  updateTopUsersPurchases(users, purchases) {
    const table = helpers.dom('#top-users-purchases-table tbody');
    if (!table) return;
    
    const userPurchases = new Map();
    
    purchases.forEach(purchase => {
      if (!purchase.userId) return;
      const existing = userPurchases.get(purchase.userId) || { count: 0, revenue: 0 };
      existing.count++;
      existing.revenue += purchase.total || 0;
      userPurchases.set(purchase.userId, existing);
    });
    
    const userPurchaseData = Array.from(userPurchases.entries()).map(([userId, data]) => {
      const user = users.find(u => u.id === userId);
      return { user, ...data };
    });
    
    userPurchaseData.sort((a, b) => b.revenue - a.revenue);
    const topUsers = userPurchaseData.slice(0, 10);
    
    if (topUsers.length === 0) {
      table.innerHTML = '<tr><td colspan="3" class="table-empty">No data available</td></tr>';
      return;
    }
    
    const html = topUsers.map(({ user, count, revenue }) => {
      if (!user) return '';
      
      return `
        <tr>
          <td>
            <div class="user-info">
              <div class="user-name">${this.escapeHtml(user.displayName)}</div>
              <div class="user-email">${this.escapeHtml(user.email)}</div>
            </div>
          </td>
          <td><strong>${count}</strong></td>
          <td><strong>${helpers.formatCurrency(revenue)}</strong></td>
        </tr>
      `;
    }).join('');
    
    table.innerHTML = html;
  }
  
  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Show view
   */
  show() {
    this.updateAll();
  }
  
  /**
   * Hide view
   */
  hide() {
    // Cleanup if needed
  }
}

