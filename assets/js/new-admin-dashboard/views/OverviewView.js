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
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Setup data subscriptions
    this.setupDataSubscriptions();
    
    // Initialize metric descriptions
    const range = this.stateManager.getState('overviewRange') || 'week';
    this.updateMetricDescriptions(range);
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Overview range select
    const rangeSelect = helpers.dom('#overview-range-select');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', (e) => {
        const range = e.target.value;
        this.stateManager.setState('overviewRange', range);
        this.updateMetricDescriptions(range);
        this.updateMetrics();
      });
    }
  }
  
  /**
   * Update metric descriptions based on selected range
   */
  updateMetricDescriptions(range) {
    const descriptions = {
      day: 'Today',
      week: 'Last 7 days',
      month: 'Last 30 days'
    };
    
    const description = descriptions[range] || descriptions.week;
    
    // Update all metric descriptions
    const activeDesc = helpers.dom('#metric-active-description');
    const newDesc = helpers.dom('#metric-new-description');
    const specsDesc = helpers.dom('#metric-specs-description');
    const purchasesDesc = helpers.dom('#metric-purchases-description');
    
    if (activeDesc) activeDesc.textContent = description;
    if (newDesc) newDesc.textContent = description;
    if (specsDesc) specsDesc.textContent = description;
    if (purchasesDesc) purchasesDesc.textContent = description;
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
      const labels = this.getLast7DaysLabels();
      const chart = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: config.id,
            data: new Array(labels.length).fill(0),
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
    ['users', 'specs', 'purchases', 'activityLogs', 'articles', 'academyGuides'].forEach(source => {
      // Listen to data events
      this.dataManager.on('data', ({ source: dataSource }) => {
        if (dataSource === source) {
          this.updateMetrics();
          if (dataSource === 'activityLogs' || dataSource === 'adminActivityLogs' || dataSource === 'users' || dataSource === 'purchases' || dataSource === 'specs') {
            this.renderActivityFeed();
          }
          this.renderSystemStatus(); // Update status when data loads
        }
      });
      
      // Listen to loading events
      this.dataManager.on('loading', ({ source: dataSource, loading }) => {
        if (dataSource === source) {
          this.renderSystemStatus(); // Update status when loading state changes
        }
      });
      
      // Listen to error events
      this.dataManager.on('error', ({ source: dataSource }) => {
        if (dataSource === source) {
          this.renderSystemStatus(); // Update status when error occurs
        }
      });
      
      // Listen to restricted events
      this.dataManager.on('restricted', ({ source: dataSource }) => {
        if (dataSource === source) {
          this.renderSystemStatus(); // Update status when restricted
        }
      });
    });
    
    // Listen to activity events (from specs, users, purchases)
    this.dataManager.on('activity', () => {
      this.renderActivityFeed();
    });
    
    // Initial render
    this.renderSystemStatus();
  }
  
  /**
   * Update all metrics
   */
  updateMetrics() {
    const allData = this.dataManager.getAllData();
    
    // Get selected range
    const range = this.stateManager.getState('overviewRange') || 'week';
    
    // Calculate date range based on selection
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    let startDate = new Date();
    let previousStartDate = new Date();
    
    switch (range) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        previousStartDate.setDate(startDate.getDate() - 1);
        previousStartDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(today.getDate() - 6); // Last 7 days including today
        startDate.setHours(0, 0, 0, 0);
        previousStartDate.setDate(startDate.getDate() - 7);
        previousStartDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate.setDate(today.getDate() - 29); // Last 30 days including today
        startDate.setHours(0, 0, 0, 0);
        previousStartDate.setDate(startDate.getDate() - 30);
        previousStartDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate.setDate(today.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        previousStartDate.setDate(startDate.getDate() - 7);
        previousStartDate.setHours(0, 0, 0, 0);
    }
    
    const previousEndDate = new Date(startDate);
    previousEndDate.setTime(startDate.getTime() - 1);
    
    // 1. Active Users (in selected range)
    const activeInRange = allData.users.filter(u => {
      if (!u.lastActive) return false;
      const lastActive = u.lastActive instanceof Date ? u.lastActive.getTime() : new Date(u.lastActive).getTime();
      return lastActive >= startDate.getTime() && lastActive <= today.getTime();
    }).length;
    
    const activeInPreviousRange = allData.users.filter(u => {
      if (!u.lastActive) return false;
      const lastActive = u.lastActive instanceof Date ? u.lastActive.getTime() : new Date(u.lastActive).getTime();
      return lastActive >= previousStartDate.getTime() && lastActive <= previousEndDate.getTime();
    }).length;
    
    const activeChange = activeInPreviousRange > 0 
      ? Math.round(((activeInRange - activeInPreviousRange) / activeInPreviousRange) * 100)
      : (activeInRange > 0 ? 100 : 0);
    
    this.updateMetricCard('metric-active-users', activeInRange, activeChange, 'chart-active-users', allData.users, 'lastActive', null, startDate, today);
    
    // 2. New Users (in selected range)
    const newInRange = allData.users.filter(u => {
      if (!u.createdAt) return false;
      const created = u.createdAt instanceof Date ? u.createdAt.getTime() : new Date(u.createdAt).getTime();
      return created >= startDate.getTime() && created <= today.getTime();
    }).length;
    
    const newInPreviousRange = allData.users.filter(u => {
      if (!u.createdAt) return false;
      const created = u.createdAt instanceof Date ? u.createdAt.getTime() : new Date(u.createdAt).getTime();
      return created >= previousStartDate.getTime() && created <= previousEndDate.getTime();
    }).length;
    
    const newChange = newInPreviousRange > 0
      ? Math.round(((newInRange - newInPreviousRange) / newInPreviousRange) * 100)
      : (newInRange > 0 ? 100 : 0);
    
    this.updateMetricCard('metric-new-users', newInRange, newChange, 'chart-new-users', allData.users, 'createdAt', null, startDate, today);
    
    // 3. Specs Created (in selected range)
    const specsInRange = allData.specs.filter(s => {
      if (!s.createdAt) return false;
      const created = s.createdAt instanceof Date ? s.createdAt.getTime() : new Date(s.createdAt).getTime();
      return created >= startDate.getTime() && created <= today.getTime();
    }).length;
    
    const specsInPreviousRange = allData.specs.filter(s => {
      if (!s.createdAt) return false;
      const created = s.createdAt instanceof Date ? s.createdAt.getTime() : new Date(s.createdAt).getTime();
      return created >= previousStartDate.getTime() && created <= previousEndDate.getTime();
    }).length;
    
    const specsChange = specsInPreviousRange > 0
      ? Math.round(((specsInRange - specsInPreviousRange) / specsInPreviousRange) * 100)
      : (specsInRange > 0 ? 100 : 0);
    
    this.updateMetricCard('metric-specs', specsInRange, specsChange, 'chart-specs', allData.specs, 'createdAt', null, startDate, today);
    
    // 4. Purchases (in selected range)
    const purchasesInRange = allData.purchases.filter(p => {
      if (!p.createdAt) return false;
      const created = p.createdAt instanceof Date ? p.createdAt.getTime() : new Date(p.createdAt).getTime();
      return created >= startDate.getTime() && created <= today.getTime();
    });
    
    const purchasesCount = purchasesInRange.length;
    const revenueInRange = purchasesInRange.reduce((sum, p) => sum + (p.total || 0), 0);
    
    const purchasesInPreviousRange = allData.purchases.filter(p => {
      if (!p.createdAt) return false;
      const created = p.createdAt instanceof Date ? p.createdAt.getTime() : new Date(p.createdAt).getTime();
      return created >= previousStartDate.getTime() && created <= previousEndDate.getTime();
    }).length;
    
    const purchasesChange = purchasesInPreviousRange > 0
      ? Math.round(((purchasesCount - purchasesInPreviousRange) / purchasesInPreviousRange) * 100)
      : (purchasesCount > 0 ? 100 : 0);
    
    this.updateMetricCard('metric-purchases', purchasesCount, purchasesChange, 'chart-purchases', allData.purchases, 'createdAt', 'total', startDate, today);
    
    // Update revenue
    const revenueEl = helpers.dom('#metric-revenue-value');
    if (revenueEl) {
      revenueEl.textContent = helpers.formatCurrency(revenueInRange);
    }
  }
  
  /**
   * Update metric card
   */
  updateMetricCard(metricId, value, change, chartId, data, dateField, valueField = null, startDate = null, endDate = null) {
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
      
      // Ensure we have valid elements
      if (!icon || !span) {
        console.warn(`[OverviewView] Missing icon or span for ${metricId}`);
        return;
      }
      
      // Update icon and text based on change value
      if (change > 0) {
        // Positive change - arrow up
        icon.className = 'fas fa-arrow-up';
        changeEl.classList.remove('negative', 'neutral');
        changeEl.classList.add('positive');
        span.textContent = `+${change}%`;
      } else if (change < 0) {
        // Negative change - arrow down
        icon.className = 'fas fa-arrow-down';
        changeEl.classList.remove('positive', 'neutral');
        changeEl.classList.add('negative');
        span.textContent = `${change}%`; // Already includes minus sign
      } else {
        // No change - minus sign
        icon.className = 'fas fa-minus';
        changeEl.classList.remove('negative', 'positive');
        changeEl.classList.add('neutral');
        span.textContent = '0%';
      }
    } else {
      console.warn(`[OverviewView] Could not find change element for ${metricId}`);
    }
    
    // Update chart
    const chart = this.charts.get(chartId);
    if (chart) {
      const dailyData = this.calculateDailyData(data, dateField, valueField, startDate, endDate);
      chart.data.datasets[0].data = dailyData;
      chart.update('none');
    }
  }
  
  /**
   * Calculate daily data for selected range
   */
  calculateDailyData(data, dateField, valueField = null, startDate = null, endDate = null) {
    const range = this.stateManager.getState('overviewRange') || 'week';
    
    // Determine number of days based on range
    let days = 7;
    if (range === 'day') {
      days = 1;
    } else if (range === 'week') {
      days = 7;
    } else if (range === 'month') {
      days = 30;
    }
    
    const dailyData = new Array(days).fill(0);
    const today = endDate || new Date();
    today.setHours(23, 59, 59, 999);
    
    const start = startDate || (() => {
      const s = new Date(today);
      s.setDate(s.getDate() - (days - 1));
      s.setHours(0, 0, 0, 0);
      return s;
    })();
    
    data.forEach(item => {
      const itemDate = item[dateField];
      if (!itemDate) return;
      
      const date = itemDate instanceof Date ? itemDate : new Date(itemDate);
      const dateTime = date.getTime();
      
      // Check if date is within range
      if (dateTime >= start.getTime() && dateTime <= today.getTime()) {
        const daysAgo = Math.floor((today.getTime() - dateTime) / (1000 * 60 * 60 * 24));
        const index = days - 1 - daysAgo;
        
        if (index >= 0 && index < days) {
          const value = valueField ? (item[valueField] || 0) : 1;
          dailyData[index] += value;
        }
      }
    });
    
    return dailyData;
  }
  
  /**
   * Render activity feed - Uses unified activity events from DataManager
   */
  renderActivityFeed() {
    const activityList = helpers.dom('#activity-list');
    if (!activityList) return;
    
    const filter = this.stateManager.getState('activityFilter') || 'all';
    
    // Get unified activity events from DataManager (includes activityLogs + generated events from specs, users, purchases)
    const allEvents = this.dataManager.getActivityEvents(filter);
    
    // Limit to 20 most recent events
    const displayEvents = allEvents.slice(0, 20);
    
    if (displayEvents.length === 0) {
      activityList.innerHTML = '<div class="activity-empty">No activity yet</div>';
      return;
    }
    
    const html = displayEvents.map(event => {
      const icon = this.getActivityIcon(event.type);
      const time = this.formatRelativeTime(event.timestamp);
      
      // Format description based on event type
      let description = event.description || '';
      if (event.meta?.userEmail) {
        description = event.meta.userEmail;
      } else if (event.meta?.email) {
        description = event.meta.email;
      } else if (event.user) {
        description = event.user;
      } else if (event.userEmail) {
        description = event.userEmail;
      }
      
      return `
        <div class="activity-item">
          <div class="activity-icon">
            <i class="${icon}"></i>
          </div>
          <div class="activity-content">
            <div class="activity-title">${this.escapeHtml(event.title || 'Activity')}</div>
            ${description ? `<div class="activity-description">${this.escapeHtml(description)}</div>` : ''}
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
   * Render system status
   */
  renderSystemStatus() {
    const statusList = helpers.dom('#status-list');
    if (!statusList) return;

    const sources = [
      { key: 'users', label: 'Users', icon: 'fas fa-users' },
      { key: 'specs', label: 'Specs', icon: 'fas fa-file-alt' },
      { key: 'purchases', label: 'Purchases', icon: 'fas fa-credit-card' },
      { key: 'activityLogs', label: 'Activity Logs', icon: 'fas fa-stream' }
    ];
    
    const html = sources.map(({ key, label, icon }) => {
      // Check loading state - if key doesn't exist, assume not loading
      const loading = this.dataManager.loadingStates[key] === true;
      const error = this.dataManager.errors.has(key);
      const restricted = this.stateManager.getState(`restricted.${key}`);
      
      let status = 'Ready';
      let statusClass = 'ready';
      
      if (loading) {
        status = 'Pending';
        statusClass = 'pending';
      } else if (error) {
        status = 'Error';
        statusClass = 'error';
      } else if (restricted) {
        status = 'Restricted';
        statusClass = 'restricted';
      }

      return `
        <div class="status-item">
          <div class="status-info">
            <i class="${icon} status-icon"></i>
            <span class="status-label">${label}</span>
          </div>
          <span class="status-badge ${statusClass}" data-source="${key}">${status}</span>
        </div>
      `;
    }).join('');

    statusList.innerHTML = html;
    
    // Update last sync time
    const lastSyncTimeEl = helpers.dom('#last-sync-time');
    if (lastSyncTimeEl) {
      const now = new Date();
      lastSyncTimeEl.textContent = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
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
    this.renderSystemStatus(); // Render status on show
    
    // Force update after a short delay
    setTimeout(() => {
      this.updateMetrics();
      this.renderActivityFeed();
      this.renderSystemStatus(); // Update status again
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
