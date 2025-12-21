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
    
    // User Distribution Chart
    this.initChart('analytics-chart-distribution', 'doughnut', {
      label: 'User Distribution',
      backgroundColor: [
        'rgba(139, 92, 246, 0.8)',
        'rgba(156, 163, 175, 0.8)'
      ]
    });
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
    
    // Update charts
    this.updateUserGrowthChart(allData.users, startDate, endDate);
    this.updateSpecsGrowthChart(allData.specs, startDate, endDate);
    this.updateRevenueTrendChart(allData.purchases, startDate, endDate);
    this.updateUserDistributionChart(allData.users, allData.userCredits);
    
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
   * Update user distribution chart
   */
  updateUserDistributionChart(users, userCredits) {
    let proCount = 0;
    let freeCount = 0;
    
    users.forEach(user => {
      const userCredit = userCredits.find(uc => uc.userId === user.id);
      if (userCredit?.unlimited || user.plan === 'pro') {
        proCount++;
      } else {
        freeCount++;
      }
    });
    
    const chart = this.charts.get('analytics-chart-distribution');
    if (chart) {
      chart.data.labels = ['Pro', 'Free'];
      chart.data.datasets[0].data = [proCount, freeCount];
      chart.update('none');
    }
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

