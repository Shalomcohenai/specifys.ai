/**
 * Overview View - Complete redesign
 * Shows: Active users now, New users today, Specs created today, Purchases today
 * With proper charts and Recent Activity
 */

import { helpers } from '../utils/helpers.js';
import { apiService } from '../services/ApiService.js';

export class OverviewView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.charts = new Map();
    this.contactSubmissions = [];
    
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
    
    // Initialize connection status
    this.updateActivityConnectionStatus('connecting');
    
    // Load contact submissions
    this.loadContactSubmissions();
    
    // Load Resend status
    this.checkResendStatus();
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
    
    // Test email button
    const sendTestEmailBtn = helpers.dom('#send-test-email-btn');
    if (sendTestEmailBtn) {
      sendTestEmailBtn.addEventListener('click', () => this.openTestEmailModal());
    }
    
    // Test email modal handlers
    const closeTestEmailModal = helpers.dom('#close-test-email-modal');
    const cancelTestEmailBtn = helpers.dom('#cancel-test-email-btn');
    const confirmTestEmailBtn = helpers.dom('#confirm-test-email-btn');
    const testEmailModal = helpers.dom('#test-email-modal');
    
    if (closeTestEmailModal) {
      closeTestEmailModal.addEventListener('click', () => this.closeTestEmailModal());
    }
    if (cancelTestEmailBtn) {
      cancelTestEmailBtn.addEventListener('click', () => this.closeTestEmailModal());
    }
    if (confirmTestEmailBtn) {
      confirmTestEmailBtn.addEventListener('click', () => this.sendTestEmail());
    }
    if (testEmailModal) {
      testEmailModal.addEventListener('click', (e) => {
        if (e.target === testEmailModal) {
          this.closeTestEmailModal();
        }
      });
    }
    
    // Activity search toggle button
    const activitySearchToggle = helpers.dom('#activity-search-toggle');
    const activityControls = helpers.dom('#activity-controls');
    if (activitySearchToggle && activityControls) {
      activitySearchToggle.addEventListener('click', () => {
        const isVisible = activityControls.style.display !== 'none';
        activityControls.style.display = isVisible ? 'none' : 'flex';
        activitySearchToggle.classList.toggle('active', !isVisible);
        
        // Focus search input when opening
        if (!isVisible) {
          setTimeout(() => {
            const searchInput = helpers.dom('#activity-search-input');
            if (searchInput) {
              searchInput.focus();
            }
          }, 100);
        }
      });
    }
    
    // Activity date range filter
    const activityDateFrom = helpers.dom('#activity-date-from');
    const activityDateTo = helpers.dom('#activity-date-to');
    if (activityDateFrom && activityDateTo) {
      const updateDateFilter = () => {
        const from = activityDateFrom.value;
        const to = activityDateTo.value;
        
        if (from && to) {
          const activityService = this.dataManager.getActivityService();
          if (activityService) {
            activityService.setFilter('dateRange', {
              start: new Date(from),
              end: new Date(to + 'T23:59:59')
            });
            this.stateManager.setState('activityPage', 1);
            this.renderActivityFeed();
          }
        } else if (!from && !to) {
          const activityService = this.dataManager.getActivityService();
          if (activityService) {
            activityService.setFilter('dateRange', null);
            this.stateManager.setState('activityPage', 1);
            this.renderActivityFeed();
          }
        }
      };
      
      activityDateFrom.addEventListener('change', updateDateFilter);
      activityDateTo.addEventListener('change', updateDateFilter);
    }
    
    // Activity search
    const activitySearch = helpers.dom('#activity-search-input');
    if (activitySearch) {
      let searchTimeout;
      activitySearch.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          const search = e.target.value.trim();
          const activityService = this.dataManager.getActivityService();
          if (activityService) {
            activityService.setFilter('search', search || null);
            this.stateManager.setState('activityPage', 1);
            this.renderActivityFeed();
          }
        }, 300); // Debounce 300ms
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
      // Chart.js not loaded
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
    
    // Listen to ActivityService updates
    const activityService = this.dataManager.getActivityService();
    if (activityService) {
      activityService.on('update', () => {
        this.renderActivityFeed();
        // Update status based on events availability
        if (activityService.events.length > 0) {
          this.updateActivityConnectionStatus('connected');
        }
      });
      
      // Remove the 'filter' event listener to prevent infinite loop
      // The filter is already applied in renderActivityFeed when needed
      // activityService.on('filter', () => {
      //   this.renderActivityFeed();
      // });
      
      activityService.on('error', ({ error }) => {
        console.error('[OverviewView] ActivityService error:', error);
        this.updateActivityConnectionStatus('error');
      });
      
      activityService.on('restricted', ({ error }) => {
        // ActivityService restricted
        this.updateActivityConnectionStatus('restricted');
      });
    } else {
      // ActivityService not initialized yet
      this.updateActivityConnectionStatus('connecting');
    }
    
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
    
    // Calculate change percentage properly
    let activeChange = 0;
    if (activeInPreviousRange > 0) {
      // Normal case: calculate percentage change
      activeChange = Math.round(((activeInRange - activeInPreviousRange) / activeInPreviousRange) * 100);
    } else if (activeInPreviousRange === 0 && activeInRange > 0) {
      // Previous period had 0, current has data -> 100% increase
      activeChange = 100;
    } else if (activeInPreviousRange === 0 && activeInRange === 0) {
      // Both periods have 0 -> no change
      activeChange = 0;
    } else if (activeInPreviousRange > 0 && activeInRange === 0) {
      // Previous had data, current has 0 -> 100% decrease
      activeChange = -100;
    }
    
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
    
    // Calculate change percentage properly
    let newChange = 0;
    if (newInPreviousRange > 0) {
      // Normal case: calculate percentage change
      newChange = Math.round(((newInRange - newInPreviousRange) / newInPreviousRange) * 100);
    } else if (newInPreviousRange === 0 && newInRange > 0) {
      // Previous period had 0, current has data -> 100% increase
      newChange = 100;
    } else if (newInPreviousRange === 0 && newInRange === 0) {
      // Both periods have 0 -> no change
      newChange = 0;
    } else if (newInPreviousRange > 0 && newInRange === 0) {
      // Previous had data, current has 0 -> 100% decrease
      newChange = -100;
    }
    
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
    
    // Calculate change percentage properly
    let specsChange = 0;
    if (specsInPreviousRange > 0) {
      // Normal case: calculate percentage change
      specsChange = Math.round(((specsInRange - specsInPreviousRange) / specsInPreviousRange) * 100);
    } else if (specsInPreviousRange === 0 && specsInRange > 0) {
      // Previous period had 0, current has data -> 100% increase
      specsChange = 100;
    } else if (specsInPreviousRange === 0 && specsInRange === 0) {
      // Both periods have 0 -> no change
      specsChange = 0;
    } else if (specsInPreviousRange > 0 && specsInRange === 0) {
      // Previous had data, current has 0 -> 100% decrease
      specsChange = -100;
    }
    
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
    
    // Calculate change percentage properly
    let purchasesChange = 0;
    if (purchasesInPreviousRange > 0) {
      // Normal case: calculate percentage change
      purchasesChange = Math.round(((purchasesCount - purchasesInPreviousRange) / purchasesInPreviousRange) * 100);
    } else if (purchasesInPreviousRange === 0 && purchasesCount > 0) {
      // Previous period had 0, current has data -> 100% increase
      purchasesChange = 100;
    } else if (purchasesInPreviousRange === 0 && purchasesCount === 0) {
      // Both periods have 0 -> no change
      purchasesChange = 0;
    } else if (purchasesInPreviousRange > 0 && purchasesCount === 0) {
      // Previous had data, current has 0 -> 100% decrease
      purchasesChange = -100;
    }
    
    this.updateMetricCard('metric-purchases', purchasesCount, purchasesChange, 'chart-purchases', allData.purchases, 'createdAt', 'total', startDate, today);
    
    // Update revenue
    const revenueEl = helpers.dom('#metric-revenue-value');
    if (revenueEl) {
      revenueEl.textContent = helpers.formatCurrency(revenueInRange);
    }
    
    // 5. Share Actions (in selected range) - count how many times share button was clicked
    const sharesInRange = allData.users.filter(u => {
      if (!u.sharePrompts?.lastShareAction) return false;
      const lastShare = u.sharePrompts.lastShareAction instanceof Date 
        ? u.sharePrompts.lastShareAction.getTime() 
        : new Date(u.sharePrompts.lastShareAction).getTime();
      return lastShare >= startDate.getTime() && lastShare <= today.getTime();
    }).length;
    
    const sharesInPreviousRange = allData.users.filter(u => {
      if (!u.sharePrompts?.lastShareAction) return false;
      const lastShare = u.sharePrompts.lastShareAction instanceof Date 
        ? u.sharePrompts.lastShareAction.getTime() 
        : new Date(u.sharePrompts.lastShareAction).getTime();
      return lastShare >= previousStartDate.getTime() && lastShare <= previousEndDate.getTime();
    }).length;
    
    // Calculate change percentage
    let sharesChange = 0;
    if (sharesInPreviousRange > 0) {
      sharesChange = Math.round(((sharesInRange - sharesInPreviousRange) / sharesInPreviousRange) * 100);
    } else if (sharesInPreviousRange === 0 && sharesInRange > 0) {
      sharesChange = 100;
    } else if (sharesInPreviousRange === 0 && sharesInRange === 0) {
      sharesChange = 0;
    } else if (sharesInPreviousRange > 0 && sharesInRange === 0) {
      sharesChange = -100;
    }
    
    // Update share metric if element exists
    const shareMetricEl = helpers.dom('#metric-shares');
    if (shareMetricEl) {
      const shareValueEl = shareMetricEl.querySelector('.metric-value');
      const shareChangeEl = shareMetricEl.querySelector('.metric-change');
      if (shareValueEl) {
        shareValueEl.textContent = sharesInRange;
      }
      if (shareChangeEl) {
        const changeIcon = shareChangeEl.querySelector('i');
        const changeSpan = shareChangeEl.querySelector('span');
        if (changeIcon && changeSpan) {
          this.updateChangeIndicator(shareChangeEl, changeIcon, changeSpan, sharesChange);
        }
      }
    }
  }
  
  /**
   * Update change indicator
   */
  updateChangeIndicator(changeEl, icon, span, change) {
    // Ensure change is a number
    const changeValue = typeof change === 'number' ? change : parseFloat(change) || 0;
    
    // Update icon and text based on change value
    if (changeValue > 0) {
      // Positive change - arrow up, green
      icon.className = 'fas fa-arrow-up';
      changeEl.classList.remove('negative', 'neutral');
      changeEl.classList.add('positive');
      span.textContent = `+${Math.abs(changeValue)}%`;
    } else if (changeValue < 0) {
      // Negative change - arrow down, red
      icon.className = 'fas fa-arrow-down';
      changeEl.classList.remove('positive', 'neutral');
      changeEl.classList.add('negative');
      span.textContent = `${changeValue}%`; // Already includes minus sign
    } else {
      // No change - minus sign, neutral
      icon.className = 'fas fa-minus';
      changeEl.classList.remove('negative', 'positive');
      changeEl.classList.add('neutral');
      span.textContent = '0%';
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
    
    // Update change indicator
    const changeEl = helpers.dom(`#${changeIdMap[metricId] || metricId + '-change'}`);
    if (changeEl) {
      const icon = changeEl.querySelector('i');
      const span = changeEl.querySelector('span');
      
      // Ensure we have valid elements
      if (icon && span) {
        this.updateChangeIndicator(changeEl, icon, span, change);
      }
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
   * Update activity connection status indicator
   */
  updateActivityConnectionStatus(status) {
    const indicator = helpers.dom('#activity-status-indicator');
    const statusContainer = helpers.dom('#activity-connection-status');
    
    if (!indicator) return;
    
    // Remove all status classes
    indicator.classList.remove('status-connected', 'status-connecting', 'status-error', 'status-restricted');
    if (statusContainer) {
      statusContainer.classList.remove('status-connected', 'status-connecting', 'status-error', 'status-restricted');
    }
    
    switch (status) {
      case 'connected':
        indicator.classList.add('status-connected');
        if (statusContainer) statusContainer.classList.add('status-connected');
        indicator.title = 'Connected to Firebase';
        if (statusContainer) statusContainer.title = 'Connected to Firebase';
        break;
      case 'connecting':
        indicator.classList.add('status-connecting');
        if (statusContainer) statusContainer.classList.add('status-connecting');
        indicator.title = 'Connecting to Firebase...';
        if (statusContainer) statusContainer.title = 'Connecting to Firebase...';
        break;
      case 'error':
        indicator.classList.add('status-error');
        if (statusContainer) statusContainer.classList.add('status-error');
        indicator.title = 'Connection error';
        if (statusContainer) statusContainer.title = 'Connection error';
        break;
      case 'restricted':
        indicator.classList.add('status-restricted');
        if (statusContainer) statusContainer.classList.add('status-restricted');
        indicator.title = 'Access restricted';
        if (statusContainer) statusContainer.title = 'Access restricted';
        break;
      default:
        indicator.classList.add('status-connecting');
        if (statusContainer) statusContainer.classList.add('status-connecting');
        indicator.title = 'Connecting...';
        if (statusContainer) statusContainer.title = 'Connecting...';
    }
  }
  
  /**
   * Render activity feed - Uses ActivityService with pagination
   */
  renderActivityFeed() {
    // Prevent infinite loop - if already rendering, skip
    if (this._renderingActivityFeed) {
      return;
    }
    this._renderingActivityFeed = true;
    
    try {
      const activityList = helpers.dom('#activity-list');
      if (!activityList) {
        this._renderingActivityFeed = false;
        return;
      }
      
      const activityService = this.dataManager.getActivityService();
      if (!activityService) {
        activityList.innerHTML = '<div class="activity-empty">Loading activity...</div>';
        this.updateActivityConnectionStatus('connecting');
        this._renderingActivityFeed = false;
        return;
      }
      
      // Update connection status based on events availability
      if (activityService.events.length > 0) {
        this.updateActivityConnectionStatus('connected');
      } else {
        this.updateActivityConnectionStatus('connecting');
      }
      
      const filter = this.stateManager.getState('activityFilter') || 'all';
      const currentPage = this.stateManager.getState('activityPage') || 1;
      
      // Get current filter value to avoid unnecessary updates
      const currentFilter = activityService.filters?.type;
      
      // Only set filter if it changed
      if (currentFilter !== filter) {
        activityService.setFilter('type', filter);
      }
      
      const paginated = activityService.goToPage(currentPage);
    
      if (!paginated || paginated.events.length === 0) {
        activityList.innerHTML = '<div class="activity-empty">No activity yet</div>';
        this.updateActivityPagination(null);
        this._renderingActivityFeed = false;
        return;
      }
    
    const html = paginated.events.map(event => {
      const icon = this.getActivityIcon(event.type);
      const time = this.formatRelativeTime(event.timestamp);
      
      // Format description based on event type
      let description = event.description || '';
      if (event.userEmail) {
        description = event.userEmail;
      } else if (event.meta?.userEmail) {
        description = event.meta.userEmail;
      } else if (event.meta?.email) {
        description = event.meta.email;
      }
      
      // Check if this is an advanced spec creation
      const isAdvancedSpec = event.type === 'advanced_spec_created' || 
                             event.meta?.eventName === 'advanced_spec_created' ||
                             (event.title && event.title.toLowerCase().includes('advanced'));
      
      // Add notification badge for advanced specs
      const notificationBadge = isAdvancedSpec ? '<span class="activity-badge new" style="margin-left: 8px;">Advanced Spec</span>' : '';
      
      return `
        <div class="activity-item" data-activity-id="${event.id}">
          <div class="activity-icon">
            <i class="${icon}"></i>
          </div>
          <div class="activity-content">
            <div class="activity-title">
              ${this.escapeHtml(event.title || 'Activity')}
              ${notificationBadge}
            </div>
            ${description ? `<div class="activity-description">${this.escapeHtml(description)}</div>` : ''}
          </div>
          <div class="activity-time">${time}</div>
        </div>
      `;
    }).join('');
    
      activityList.innerHTML = html;
      
      // Update pagination controls
      this.updateActivityPagination(paginated);
    } finally {
      // Always reset the flag
      this._renderingActivityFeed = false;
    }
  }
  
  /**
   * Update activity pagination controls
   */
  updateActivityPagination(paginated) {
    const paginationContainer = helpers.dom('#activity-pagination');
    if (!paginationContainer) return;
    
    if (!paginated || paginated.totalPages <= 1) {
      paginationContainer.innerHTML = '';
      return;
    }
    
    const { currentPage, totalPages, totalEvents } = paginated;
    
    let html = `
      <div class="activity-pagination-info">
        Showing ${(currentPage - 1) * 20 + 1}-${Math.min(currentPage * 20, totalEvents)} of ${totalEvents} events
      </div>
      <div class="activity-pagination-controls">
    `;
    
    // Previous button
    html += `
      <button class="activity-pagination-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">
        <i class="fas fa-chevron-left"></i>
      </button>
    `;
    
    // Page numbers (show max 5 pages)
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
      html += `<button class="activity-pagination-btn" data-page="1">1</button>`;
      if (startPage > 2) {
        html += `<span class="activity-pagination-ellipsis">...</span>`;
      }
    }
    
    for (let i = startPage; i <= endPage; i++) {
      html += `
        <button class="activity-pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">
          ${i}
        </button>
      `;
    }
    
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        html += `<span class="activity-pagination-ellipsis">...</span>`;
      }
      html += `<button class="activity-pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }
    
    // Next button
    html += `
      <button class="activity-pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">
        <i class="fas fa-chevron-right"></i>
      </button>
    `;
    
    html += '</div>';
    
    paginationContainer.innerHTML = html;
    
    // Add event listeners
    paginationContainer.querySelectorAll('.activity-pagination-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const page = parseInt(btn.dataset.page);
        if (page && !btn.disabled) {
          this.stateManager.setState('activityPage', page);
          this.renderActivityFeed();
        }
      });
    });
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
      { key: 'activityLogs', label: 'Activity Logs', icon: 'fas fa-stream' },
      { key: 'subscriptionRefresh', label: 'Subscription Refresh', icon: 'fas fa-sync-alt' }
    ];
    
    const html = sources.map(({ key, label, icon }) => {
      // Special handling for subscriptionRefresh
      if (key === 'subscriptionRefresh') {
        const isRefreshing = this.stateManager.getState('subscriptionRefresh.active') === true;
        const lastRefresh = this.stateManager.getState('subscriptionRefresh.lastRefresh');
        
        let status = 'Ready';
        let statusClass = 'ready';
        
        if (isRefreshing) {
          status = 'Refreshing...';
          statusClass = 'pending';
        } else if (lastRefresh) {
          status = 'Ready';
          statusClass = 'ready';
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
      }
      
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
    
    // Load migrations status
    this.loadMigrationsStatus();
    
    // Setup migration test buttons
    this.setupMigrationButtons();
    
    // Setup scheduled jobs test buttons
    this.setupScheduledJobsButtons();
  }
  
  /**
   * Load migrations status
   */
  async loadMigrationsStatus() {
    try {
      const response = await apiService.get('/api/admin/migrations/status');
      
      if (response.success && response.migrations) {
        // Update articles migration status
        const articlesStatus = helpers.dom('#articles-migration-status');
        if (articlesStatus) {
          if (response.migrations.articles.working) {
            articlesStatus.textContent = response.migrations.articles.lastCreated 
              ? `Last: ${new Date(response.migrations.articles.lastCreated.createdAt).toLocaleDateString()}`
              : 'Working';
            articlesStatus.className = 'migration-status working';
          } else {
            articlesStatus.textContent = 'Not Working';
            articlesStatus.className = 'migration-status error';
          }
        }
        
        // Update apps migration status
        const appsStatus = helpers.dom('#apps-migration-status');
        if (appsStatus) {
          if (response.migrations.apps.working) {
            appsStatus.textContent = response.migrations.apps.lastCreated 
              ? `Last: ${new Date(response.migrations.apps.lastCreated.createdAt).toLocaleDateString()}`
              : 'Working';
            appsStatus.className = 'migration-status working';
          } else {
            appsStatus.textContent = 'Not Working';
            appsStatus.className = 'migration-status error';
          }
        }
      }
    } catch (error) {
      console.error('[OverviewView] Error loading migrations status:', error);
      const articlesStatus = helpers.dom('#articles-migration-status');
      const appsStatus = helpers.dom('#apps-migration-status');
      if (articlesStatus) {
        articlesStatus.textContent = 'Error';
        articlesStatus.className = 'migration-status error';
      }
      if (appsStatus) {
        appsStatus.textContent = 'Error';
        appsStatus.className = 'migration-status error';
      }
    }
  }
  
  /**
   * Setup migration test buttons
   */
  setupMigrationButtons() {
    const testArticlesBtn = helpers.dom('#test-articles-migration-btn');
    const testAppsBtn = helpers.dom('#test-apps-migration-btn');
    
    if (testArticlesBtn && !testArticlesBtn.dataset.listenerAdded) {
      testArticlesBtn.dataset.listenerAdded = 'true';
      testArticlesBtn.addEventListener('click', async () => {
        testArticlesBtn.disabled = true;
        testArticlesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Testing...</span>';
        
        try {
          const response = await apiService.post('/api/admin/migrations/articles/test');
          
          if (response.success) {
            alert('Article created successfully!');
            this.loadMigrationsStatus();
          } else {
            alert('Failed to create article: ' + (response.error || 'Unknown error'));
          }
        } catch (error) {
          alert('Error testing articles migration: ' + error.message);
        } finally {
          testArticlesBtn.disabled = false;
          testArticlesBtn.innerHTML = '<i class="fas fa-vial"></i> <span>Test</span>';
        }
      });
    }
    
    if (testAppsBtn && !testAppsBtn.dataset.listenerAdded) {
      testAppsBtn.dataset.listenerAdded = 'true';
      testAppsBtn.addEventListener('click', async () => {
        testAppsBtn.disabled = true;
        testAppsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Testing...</span>';
        
        try {
          const response = await apiService.post('/api/admin/migrations/apps/test');
          
          if (response.success) {
            alert('Test app created successfully!');
            this.loadMigrationsStatus();
          } else {
            alert('Failed to create app: ' + (response.error || 'Unknown error'));
          }
        } catch (error) {
          alert('Error testing apps migration: ' + error.message);
        } finally {
          testAppsBtn.disabled = false;
          testAppsBtn.innerHTML = '<i class="fas fa-vial"></i> <span>Test</span>';
        }
      });
    }
  }
  
  /**
   * Setup scheduled jobs test buttons
   */
  setupScheduledJobsButtons() {
    const testDailyReportBtn = helpers.dom('#test-daily-report-btn');
    const testArticleWriterBtn = helpers.dom('#test-article-writer-btn');
    const testToolsFinderBtn = helpers.dom('#test-tools-finder-btn');
    
    if (testDailyReportBtn && !testDailyReportBtn.dataset.listenerAdded) {
      testDailyReportBtn.dataset.listenerAdded = 'true';
      testDailyReportBtn.addEventListener('click', async () => {
        testDailyReportBtn.disabled = true;
        testDailyReportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Testing...</span>';
        
        try {
          const response = await apiService.post('/api/admin/scheduled-jobs/daily-report/test');
          
          if (response.success) {
            alert('Daily report job executed successfully! Check Render logs for details.');
            const statusEl = helpers.dom('#daily-report-status');
            if (statusEl) {
              statusEl.textContent = 'Tested ' + new Date().toLocaleTimeString();
              statusEl.className = 'migration-status working';
            }
          } else {
            alert('Failed to run daily report job: ' + (response.error || 'Unknown error'));
            const statusEl = helpers.dom('#daily-report-status');
            if (statusEl) {
              statusEl.textContent = 'Error';
              statusEl.className = 'migration-status error';
            }
          }
        } catch (error) {
          alert('Error testing daily report job: ' + error.message);
          const statusEl = helpers.dom('#daily-report-status');
          if (statusEl) {
            statusEl.textContent = 'Error';
            statusEl.className = 'migration-status error';
          }
        } finally {
          testDailyReportBtn.disabled = false;
          testDailyReportBtn.innerHTML = '<i class="fas fa-vial"></i> <span>Test</span>';
        }
      });
    }
    
    if (testArticleWriterBtn && !testArticleWriterBtn.dataset.listenerAdded) {
      testArticleWriterBtn.dataset.listenerAdded = 'true';
      testArticleWriterBtn.addEventListener('click', async () => {
        testArticleWriterBtn.disabled = true;
        testArticleWriterBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Testing...</span>';
        
        try {
          const response = await apiService.post('/api/admin/scheduled-jobs/article-writer/test');
          
          if (response.success) {
            alert('Article writer job executed successfully! Check Render logs for details.');
            const statusEl = helpers.dom('#article-writer-status');
            if (statusEl) {
              statusEl.textContent = 'Tested ' + new Date().toLocaleTimeString();
              statusEl.className = 'migration-status working';
            }
          } else {
            alert('Failed to run article writer job: ' + (response.error || 'Unknown error'));
            const statusEl = helpers.dom('#article-writer-status');
            if (statusEl) {
              statusEl.textContent = 'Error';
              statusEl.className = 'migration-status error';
            }
          }
        } catch (error) {
          alert('Error testing article writer job: ' + error.message);
          const statusEl = helpers.dom('#article-writer-status');
          if (statusEl) {
            statusEl.textContent = 'Error';
            statusEl.className = 'migration-status error';
          }
        } finally {
          testArticleWriterBtn.disabled = false;
          testArticleWriterBtn.innerHTML = '<i class="fas fa-vial"></i> <span>Test</span>';
        }
      });
    }
    
    if (testToolsFinderBtn && !testToolsFinderBtn.dataset.listenerAdded) {
      testToolsFinderBtn.dataset.listenerAdded = 'true';
      testToolsFinderBtn.addEventListener('click', async () => {
        testToolsFinderBtn.disabled = true;
        testToolsFinderBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Testing...</span>';
        
        try {
          const response = await apiService.post('/api/admin/scheduled-jobs/tools-finder/test');
          
          if (response.success) {
            alert('Tools finder job executed successfully! Check Render logs for details.');
            const statusEl = helpers.dom('#tools-finder-status');
            if (statusEl) {
              statusEl.textContent = 'Tested ' + new Date().toLocaleTimeString();
              statusEl.className = 'migration-status working';
            }
          } else {
            alert('Failed to run tools finder job: ' + (response.error || 'Unknown error'));
            const statusEl = helpers.dom('#tools-finder-status');
            if (statusEl) {
              statusEl.textContent = 'Error';
              statusEl.className = 'migration-status error';
            }
          }
        } catch (error) {
          alert('Error testing tools finder job: ' + error.message);
          const statusEl = helpers.dom('#tools-finder-status');
          if (statusEl) {
            statusEl.textContent = 'Error';
            statusEl.className = 'migration-status error';
          }
        } finally {
          testToolsFinderBtn.disabled = false;
          testToolsFinderBtn.innerHTML = '<i class="fas fa-vial"></i> <span>Test</span>';
        }
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
   * Load contact submissions for overview
   */
  async loadContactSubmissions() {
    try {
      // Reduce limit for overview - only show recent 50
      const response = await apiService.get('/api/admin/contact-submissions?limit=50');
      
      if (response.success && response.submissions) {
        this.contactSubmissions = response.submissions.map(sub => {
          let createdAt = null;
          if (sub.createdAt) {
            if (sub.createdAt.toDate && typeof sub.createdAt.toDate === 'function') {
              createdAt = sub.createdAt.toDate();
            } else if (sub.createdAt instanceof Date) {
              createdAt = sub.createdAt;
            } else if (typeof sub.createdAt === 'string' || typeof sub.createdAt === 'number') {
              createdAt = new Date(sub.createdAt);
            }
          }
          if (!createdAt && sub.timestamp) {
            createdAt = new Date(sub.timestamp);
          }
          if (!createdAt) {
            createdAt = new Date();
          }
          
          return {
            ...sub,
            createdAt
          };
        });
        
        // Sort by date (newest first)
        this.contactSubmissions.sort((a, b) => b.createdAt - a.createdAt);
        
        this.updateContactStats();
        this.renderContactList();
      }
    } catch (error) {
      console.error('[OverviewView] Error loading contact submissions:', error);
    }
  }
  
  /**
   * Update contact statistics in overview
   */
  updateContactStats() {
    const total = this.contactSubmissions.length;
    const newCount = this.contactSubmissions.filter(s => s.status === 'new' || !s.status).length;
    const readCount = this.contactSubmissions.filter(s => s.status === 'read').length;
    const repliedCount = this.contactSubmissions.filter(s => s.status === 'replied').length;
    
    const totalEl = helpers.dom('#overview-stat-total-contact');
    const newEl = helpers.dom('#overview-stat-new-contact');
    const readEl = helpers.dom('#overview-stat-read-contact');
    const repliedEl = helpers.dom('#overview-stat-replied-contact');
    
    if (totalEl) totalEl.textContent = total;
    if (newEl) newEl.textContent = newCount;
    if (readEl) readEl.textContent = readCount;
    if (repliedEl) repliedEl.textContent = repliedCount;
  }
  
  /**
   * Render contact submissions list in overview
   */
  renderContactList() {
    const container = helpers.dom('#contact-list-overview');
    if (!container) return;
    
    // Show recent 5 submissions
    const recentSubmissions = this.contactSubmissions.slice(0, 5);
    
    if (recentSubmissions.length === 0) {
      container.innerHTML = '<div class="activity-empty">No submissions yet</div>';
      return;
    }
    
    const html = recentSubmissions.map(sub => {
      const statusClass = sub.status === 'new' || !sub.status ? 'new' : sub.status;
      const statusLabel = sub.status === 'new' || !sub.status ? 'New' : 
                          sub.status === 'read' ? 'Read' : 
                          sub.status === 'replied' ? 'Replied' : 
                          sub.status === 'archived' ? 'Archived' : 'New';
      
      const date = sub.createdAt ? new Date(sub.createdAt) : new Date();
      const dateStr = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const email = sub.email || sub.userEmail || 'No email';
      const message = sub.message || sub.feedback || '';
      const messagePreview = message.length > 100 ? message.substring(0, 100) + '...' : message;
      
      const bgColor = statusClass === 'new' ? 'rgba(239, 68, 68, 0.1)' : statusClass === 'read' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)';
      const iconColor = statusClass === 'new' ? '#ef4444' : statusClass === 'read' ? '#3b82f6' : '#10b981';
      
      return `
        <div class="activity-item" data-contact-id="${sub.id}">
          <div class="activity-icon" style="background: ${bgColor};">
            <i class="fas fa-envelope" style="color: ${iconColor};"></i>
          </div>
          <div class="activity-content">
            <div class="activity-header">
              <span class="activity-title">${this.escapeHtml(email)}</span>
              <span class="activity-badge ${statusClass}">${statusLabel}</span>
              <button class="contact-dismiss-btn" data-contact-id="${sub.id}" title="Mark as read" aria-label="Mark as read">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <p class="activity-description">${this.escapeHtml(messagePreview)}</p>
            <span class="activity-time">${dateStr}</span>
          </div>
        </div>
      `;
    }).join('');
    
    container.innerHTML = html;
    
    // Add event listeners for dismiss buttons
    container.querySelectorAll('.contact-dismiss-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const contactId = btn.dataset.contactId;
        if (contactId) {
          await this.markContactAsRead(contactId);
        }
      });
    });
  }
  
  /**
   * Mark contact submission as read
   */
  async markContactAsRead(contactId) {
    try {
      const response = await apiService.put(`/api/admin/contact-submissions/${contactId}/status`, {
        status: 'read'
      });
      
      if (response.success) {
        // Update local data
        const submission = this.contactSubmissions.find(s => s.id === contactId);
        if (submission) {
          submission.status = 'read';
          this.updateContactStats();
          this.renderContactList();
        }
      }
    } catch (error) {
      console.error('[OverviewView] Error marking contact as read:', error);
    }
  }
  
  /**
   * Show view
   */
  show() {
    // Showing overview view
    this.updateMetrics();
    this.renderActivityFeed();
    this.renderSystemStatus(); // Render status on show
    
    // Update contact submissions
    this.loadContactSubmissions();
    
    // Force update after a short delay
    setTimeout(() => {
      this.updateMetrics();
      this.renderActivityFeed();
      this.renderSystemStatus(); // Update status again
      this.checkResendStatus(); // Check Resend status
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
  
  /**
   * Check Resend email service status
   */
  async checkResendStatus() {
    try {
      const response = await apiService.get('/api/admin/email/status');
      
      if (response.success && response.status) {
        const status = response.status;
        const badge = helpers.dom('#resend-status-badge');
        
        if (badge) {
          if (status.configured && status.success) {
            badge.textContent = 'Operational';
            badge.className = 'status-badge success';
            badge.title = `From: ${status.fromEmail || 'N/A'}\nLast checked: ${new Date(status.lastChecked).toLocaleString()}`;
          } else if (status.configured && !status.success) {
            badge.textContent = 'Error';
            badge.className = 'status-badge error';
            badge.title = status.error || 'Unknown error';
          } else {
            badge.textContent = 'Not Configured';
            badge.className = 'status-badge error';
            badge.title = 'Resend API key not configured';
          }
        }
      }
    } catch (error) {
      console.error('[OverviewView] Error checking Resend status:', error);
      const badge = helpers.dom('#resend-status-badge');
      if (badge) {
        badge.textContent = 'Error';
        badge.className = 'status-badge error';
        badge.title = 'Failed to check status';
      }
    }
  }
  
  /**
   * Open test email modal
   */
  openTestEmailModal() {
    const modal = helpers.dom('#test-email-modal');
    const input = helpers.dom('#test-email-input');
    const message = helpers.dom('#test-email-message');
    
    if (modal) {
      modal.classList.remove('hidden');
      if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 100);
      }
      if (message) {
        message.classList.add('hidden');
        message.textContent = '';
      }
    }
  }
  
  /**
   * Close test email modal
   */
  closeTestEmailModal() {
    const modal = helpers.dom('#test-email-modal');
    const message = helpers.dom('#test-email-message');
    
    if (modal) {
      modal.classList.add('hidden');
    }
    if (message) {
      message.classList.add('hidden');
      message.textContent = '';
    }
  }
  
  /**
   * Send test email
   */
  async sendTestEmail() {
    const input = helpers.dom('#test-email-input');
    const message = helpers.dom('#test-email-message');
    const confirmBtn = helpers.dom('#confirm-test-email-btn');
    const btnText = confirmBtn?.querySelector('.btn-text');
    const btnLoading = confirmBtn?.querySelector('.btn-loading');
    
    if (!input || !input.value || !input.value.includes('@')) {
      if (message) {
        message.textContent = 'Please enter a valid email address';
        message.className = 'alert-message error';
        message.classList.remove('hidden');
      }
      return;
    }
    
    const email = input.value.trim();
    
    // Show loading state
    if (btnText) btnText.style.display = 'none';
    if (btnLoading) btnLoading.style.display = 'inline-block';
    if (confirmBtn) confirmBtn.disabled = true;
    if (message) {
      message.classList.add('hidden');
      message.textContent = '';
    }
    
    try {
      const response = await apiService.post('/api/admin/email/test', { email });
      
      if (response.success) {
        if (message) {
          message.textContent = `Test email sent successfully! Message ID: ${response.messageId || 'N/A'}`;
          message.className = 'alert-message success';
          message.classList.remove('hidden');
        }
        // Clear input and close modal after 2 seconds
        setTimeout(() => {
          input.value = '';
          this.closeTestEmailModal();
        }, 2000);
      } else {
        throw new Error(response.error || 'Failed to send test email');
      }
    } catch (error) {
      console.error('[OverviewView] Error sending test email:', error);
      if (message) {
        message.textContent = error.message || 'Failed to send test email. Please check the console for details.';
        message.className = 'alert-message error';
        message.classList.remove('hidden');
      }
    } finally {
      // Hide loading state
      if (btnText) btnText.style.display = 'inline-block';
      if (btnLoading) btnLoading.style.display = 'none';
      if (confirmBtn) confirmBtn.disabled = false;
    }
  }
}
