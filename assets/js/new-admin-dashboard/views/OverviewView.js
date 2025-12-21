/**
 * Overview View - Complete redesign
 * Shows: Active users now, New users today, Specs created today, Purchases today
 * With proper charts and Recent Activity
 */

import { helpers } from '../utils/helpers.js';

export class OverviewView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.charts = new Map();
    
    this.init();
  }
  
  /**
   * Initialize view
   */
  init() {
    // Initialize charts
    this.initCharts();
    
    // Setup data subscriptions
    this.setupDataSubscriptions();
  }
  
  /**
   * Initialize charts - Better charts with proper sizing
   */
  initCharts() {
    if (!window.Chart) {
      console.warn('[OverviewView] Chart.js not loaded');
      return;
    }
    
    const chartConfigs = [
      { id: 'chart-active-users', color: 'rgba(59, 130, 246, 1)', bgColor: 'rgba(59, 130, 246, 0.1)' },
      { id: 'chart-new-users', color: 'rgba(16, 185, 129, 1)', bgColor: 'rgba(16, 185, 129, 0.1)' },
      { id: 'chart-specs', color: 'rgba(139, 92, 246, 1)', bgColor: 'rgba(139, 92, 246, 0.1)' },
      { id: 'chart-purchases', color: 'rgba(245, 158, 11, 1)', bgColor: 'rgba(245, 158, 11, 0.1)' }
    ];
    
    chartConfigs.forEach(config => {
      const canvas = helpers.dom(`#${config.id}`);
      if (!canvas) return;
      
      // Set fixed size
      canvas.style.width = '100%';
      canvas.style.height = '60px';
      
      const ctx = canvas.getContext('2d');
      const chart = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: this.getLast7DaysLabels(),
          datasets: [{
            label: config.id,
            data: new Array(7).fill(0),
            borderColor: config.color,
            backgroundColor: config.bgColor,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBorderWidth: 2,
            pointHoverBackgroundColor: config.color,
            pointHoverBorderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: true,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: 8,
              titleFont: { size: 12 },
              bodyFont: { size: 11 },
              cornerRadius: 4,
              displayColors: false
            }
          },
          scales: {
            x: {
              display: false,
              grid: { display: false }
            },
            y: {
              display: false,
              beginAtZero: true,
              grid: { display: false }
            }
          },
          interaction: {
            intersect: false,
            mode: 'index'
          }
        }
      });
      
      this.charts.set(config.id, chart);
    });
  }
  
  /**
   * Get last 7 days labels
   */
  getLast7DaysLabels() {
    const labels = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    }
    return labels;
  }
  
  /**
   * Setup data subscriptions
   */
  setupDataSubscriptions() {
    // Subscribe to all data sources
    ['users', 'userCredits', 'specs', 'purchases', 'activityLogs'].forEach(source => {
      this.dataManager.on('data', ({ source: dataSource }) => {
        if (dataSource === source) {
          this.updateMetrics();
          if (dataSource === 'activityLogs' || dataSource === 'users' || dataSource === 'purchases') {
            this.renderActivityFeed();
          }
        }
      });
    });
  }
  
  /**
   * Update all metrics
   */
  updateMetrics() {
    const allData = this.dataManager.getAllData();
    
    // Calculate today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    
    // Calculate yesterday
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    
    // 1. Active Users Now (last 15 minutes)
    const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
    const activeNow = allData.users.filter(u => {
      if (!u.lastActive) return false;
      const lastActive = u.lastActive instanceof Date ? u.lastActive.getTime() : new Date(u.lastActive).getTime();
      return lastActive >= fifteenMinutesAgo;
    }).length;
    
    const activeYesterday = allData.users.filter(u => {
      if (!u.lastActive) return false;
      const lastActive = u.lastActive instanceof Date ? u.lastActive.getTime() : new Date(u.lastActive).getTime();
      return lastActive >= yesterday.getTime() && lastActive <= yesterdayEnd.getTime();
    }).length;
    
    const activeChange = activeYesterday > 0 
      ? Math.round(((activeNow - activeYesterday) / activeYesterday) * 100)
      : 0;
    
    this.updateMetricCard('metric-active-users', activeNow, activeChange, 'chart-active-users', allData.users, 'lastActive');
    
    // 2. New Users Today
    const newToday = allData.users.filter(u => {
      if (!u.createdAt) return false;
      const created = u.createdAt instanceof Date ? u.createdAt.getTime() : new Date(u.createdAt).getTime();
      return created >= today.getTime() && created <= todayEnd.getTime();
    }).length;
    
    const newYesterday = allData.users.filter(u => {
      if (!u.createdAt) return false;
      const created = u.createdAt instanceof Date ? u.createdAt.getTime() : new Date(u.createdAt).getTime();
      return created >= yesterday.getTime() && created <= yesterdayEnd.getTime();
    }).length;
    
    const newChange = newYesterday > 0
      ? Math.round(((newToday - newYesterday) / newYesterday) * 100)
      : 0;
    
    this.updateMetricCard('metric-new-users', newToday, newChange, 'chart-new-users', allData.users, 'createdAt');
    
    // 3. Specs Created Today
    const specsToday = allData.specs.filter(s => {
      if (!s.createdAt) return false;
      const created = s.createdAt instanceof Date ? s.createdAt.getTime() : new Date(s.createdAt).getTime();
      return created >= today.getTime() && created <= todayEnd.getTime();
    }).length;
    
    const specsYesterday = allData.specs.filter(s => {
      if (!s.createdAt) return false;
      const created = s.createdAt instanceof Date ? s.createdAt.getTime() : new Date(s.createdAt).getTime();
      return created >= yesterday.getTime() && created <= yesterdayEnd.getTime();
    }).length;
    
    const specsChange = specsYesterday > 0
      ? Math.round(((specsToday - specsYesterday) / specsYesterday) * 100)
      : 0;
    
    this.updateMetricCard('metric-specs', specsToday, specsChange, 'chart-specs', allData.specs, 'createdAt');
    
    // 4. Purchases Today
    const purchasesToday = allData.purchases.filter(p => {
      if (!p.createdAt) return false;
      const created = p.createdAt instanceof Date ? p.createdAt.getTime() : new Date(p.createdAt).getTime();
      return created >= today.getTime() && created <= todayEnd.getTime();
    });
    
    const purchasesCount = purchasesToday.length;
    const revenueToday = purchasesToday.reduce((sum, p) => sum + (p.total || 0), 0);
    
    const purchasesYesterday = allData.purchases.filter(p => {
      if (!p.createdAt) return false;
      const created = p.createdAt instanceof Date ? p.createdAt.getTime() : new Date(p.createdAt).getTime();
      return created >= yesterday.getTime() && created <= yesterdayEnd.getTime();
    }).length;
    
    const purchasesChange = purchasesYesterday > 0
      ? Math.round(((purchasesCount - purchasesYesterday) / purchasesYesterday) * 100)
      : 0;
    
    this.updateMetricCard('metric-purchases', purchasesCount, purchasesChange, 'chart-purchases', allData.purchases, 'createdAt', 'total');
    
    // Update revenue
    const revenueEl = helpers.dom('#metric-revenue-value');
    if (revenueEl) {
      revenueEl.textContent = helpers.formatCurrency(revenueToday);
    }
  }
  
  /**
   * Update metric card
   */
  updateMetricCard(metricId, value, change, chartId, data, dateField, valueField = null) {
    // Update value - fix ID mapping
    const valueIdMap = {
      'metric-active-users': 'metric-active-value',
      'metric-new-users': 'metric-new-value',
      'metric-specs': 'metric-specs-value',
      'metric-purchases': 'metric-purchases-value'
    };
    
    const valueEl = helpers.dom(`#${valueIdMap[metricId] || metricId + '-value'}`);
    if (valueEl) {
      valueEl.textContent = value.toLocaleString();
    }
    
    // Update change - fix ID mapping
    const changeIdMap = {
      'metric-active-users': 'metric-active-change',
      'metric-new-users': 'metric-new-change',
      'metric-specs': 'metric-specs-change',
      'metric-purchases': 'metric-purchases-change'
    };
    
    const changeEl = helpers.dom(`#${changeIdMap[metricId] || metricId + '-change'}`);
    if (changeEl) {
      const icon = changeEl.querySelector('i');
      const span = changeEl.querySelector('span');
      
      if (change > 0) {
        if (icon) icon.className = 'fas fa-arrow-up';
        changeEl.classList.remove('negative');
        if (span) span.textContent = `+${change}%`;
      } else if (change < 0) {
        if (icon) icon.className = 'fas fa-arrow-down';
        changeEl.classList.add('negative');
        if (span) span.textContent = `${change}%`;
      } else {
        if (icon) icon.className = 'fas fa-minus';
        changeEl.classList.remove('negative');
        if (span) span.textContent = '0%';
      }
    }
    
    // Update chart
    const chart = this.charts.get(chartId);
    if (chart) {
      const dailyData = this.calculateDailyData(data, dateField, valueField);
      chart.data.datasets[0].data = dailyData;
      chart.update('none');
    }
  }
  
  /**
   * Calculate daily data for last 7 days
   */
  calculateDailyData(data, dateField, valueField = null) {
    const dailyData = new Array(7).fill(0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    data.forEach(item => {
      const itemDate = item[dateField];
      if (!itemDate) return;
      
      const date = itemDate instanceof Date ? itemDate : new Date(itemDate);
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
   * Render activity feed - FIXED to show data
   */
  renderActivityFeed() {
    const activityList = helpers.dom('#activity-list');
    if (!activityList) return;
    
    const filter = this.stateManager.getState('activityFilter') || 'all';
    const allData = this.dataManager.getAllData();
    
    // Get activity events from multiple sources
    const events = [];
    
    // From activity logs
    if (allData.activityLogs && allData.activityLogs.length > 0) {
      allData.activityLogs.forEach(log => {
        events.push({
          type: this.getEventType(log),
          title: log.title || log.message || 'Activity',
          description: log.description || log.path || '',
          timestamp: log.timestamp || log.createdAt || new Date(),
          user: log.user || log.userEmail || ''
        });
      });
    }
    
    // From purchases
    if (allData.purchases && allData.purchases.length > 0) {
      allData.purchases.slice(0, 10).forEach(purchase => {
        events.push({
          type: 'payment',
          title: `Purchase: ${purchase.productName || 'Product'}`,
          description: `$${purchase.total || 0}`,
          timestamp: purchase.createdAt || new Date(),
          user: purchase.userEmail || purchase.userId || ''
        });
      });
    }
    
    // From new users
    if (allData.users && allData.users.length > 0) {
      allData.users
        .filter(u => {
          if (!u.createdAt) return false;
          const created = u.createdAt instanceof Date ? u.createdAt.getTime() : new Date(u.createdAt).getTime();
          const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
          return created >= oneDayAgo;
        })
        .slice(0, 5)
        .forEach(user => {
          events.push({
            type: 'user',
            title: `New user registered`,
            description: user.email || user.displayName || user.id,
            timestamp: user.createdAt || new Date(),
            user: user.email || user.displayName || user.id
          });
        });
      }
    
    // Sort by timestamp (newest first)
    events.sort((a, b) => {
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      return timeB - timeA;
    });
    
    // Apply filter
    const filteredEvents = filter === 'all' 
      ? events 
      : events.filter(e => e.type === filter);
    
    // Limit to 10
    const displayEvents = filteredEvents.slice(0, 10);
    
    if (displayEvents.length === 0) {
      activityList.innerHTML = '<div class="activity-empty">No activity yet</div>';
      return;
    }
    
    const html = displayEvents.map(event => {
      const icon = this.getActivityIcon(event.type);
      const time = this.formatRelativeTime(event.timestamp);
      
      return `
        <div class="activity-item">
          <div class="activity-icon">
            <i class="${icon}"></i>
          </div>
          <div class="activity-content">
            <div class="activity-title">${this.escapeHtml(event.title)}</div>
            <div class="activity-description">${this.escapeHtml(event.description)}</div>
          </div>
          <div class="activity-time">${time}</div>
        </div>
      `;
    }).join('');
    
    activityList.innerHTML = html;
  }
  
  /**
   * Get event type from log
   */
  getEventType(log) {
    if (log.type) return log.type;
    if (log.level === 'error') return 'error';
    if (log.level === 'warning') return 'warning';
    if (log.path && log.path.includes('spec')) return 'spec';
    if (log.path && log.path.includes('payment')) return 'payment';
    return 'info';
  }
  
  /**
   * Get activity icon
   */
  getActivityIcon(type) {
    const icons = {
      user: 'fas fa-user',
      spec: 'fas fa-file-alt',
      payment: 'fas fa-credit-card',
      subscription: 'fas fa-sync-alt',
      error: 'fas fa-exclamation-circle',
      warning: 'fas fa-exclamation-triangle',
      info: 'fas fa-info-circle'
    };
    return icons[type] || 'fas fa-circle';
  }
  
  /**
   * Format relative time
   */
  formatRelativeTime(timestamp) {
    if (!timestamp) return 'Just now';
    
    const time = timestamp instanceof Date ? timestamp.getTime() : new Date(timestamp).getTime();
    const now = Date.now();
    const diff = now - time;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return new Date(time).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }
  
  /**
   * Escape HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Show view
   */
  show() {
    console.log('[OverviewView] Showing view');
    this.updateMetrics();
    this.renderActivityFeed();
    
    // Force update after a short delay
    setTimeout(() => {
      this.updateMetrics();
      this.renderActivityFeed();
    }, 500);
  }
  
  /**
   * Hide view
   */
  hide() {
    // Cleanup if needed
  }
  
  /**
   * Update view
   */
  update() {
    this.updateMetrics();
    this.renderActivityFeed();
  }
}
