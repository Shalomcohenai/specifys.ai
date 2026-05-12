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
    
    // Load Buy Now clicks (pricing)
    this.loadBuyNowClicks();

    const planningDays = parseInt(helpers.dom('#overview-planning-range-select')?.value, 10) || 30;
    this.loadOverviewPlanningAnalytics(planningDays);

    // Pipeline canary chart + controls
    this.loadPipelineCanaryHistory();
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
    
    // Buy Now clicks range select
    const buyNowRangeSelect = helpers.dom('#buy-now-clicks-range');
    if (buyNowRangeSelect) {
      buyNowRangeSelect.addEventListener('change', (e) => {
        this.loadBuyNowClicks(e.target.value);
      });
    }
    
    // Test email button
    const sendTestEmailBtn = helpers.dom('#send-test-email-btn');
    if (sendTestEmailBtn) {
      sendTestEmailBtn.addEventListener('click', () => this.openTestEmailModal());
    }

    const overviewPlanningRange = helpers.dom('#overview-planning-range-select');
    if (overviewPlanningRange) {
      overviewPlanningRange.addEventListener('change', (e) => {
        const days = parseInt(e.target.value, 10) || 30;
        this.loadOverviewPlanningAnalytics(days);
      });
    }

    const overviewContactFullBtn = helpers.dom('#overview-contact-full-btn');
    if (overviewContactFullBtn) {
      overviewContactFullBtn.addEventListener('click', () => {
        if (window.newAdminDashboard && typeof window.newAdminDashboard.navigateToSection === 'function') {
          window.newAdminDashboard.navigateToSection('contact');
        }
      });
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

    const pipelineRefresh = helpers.dom('#pipeline-canary-refresh-btn');
    if (pipelineRefresh) {
      pipelineRefresh.addEventListener('click', () => this.loadPipelineCanaryHistory());
    }
    const pipelineRun = helpers.dom('#pipeline-canary-run-btn');
    if (pipelineRun) {
      pipelineRun.addEventListener('click', () => this.runPipelineCanaryNow());
    }
  }

  /**
   * Local calendar date YYYY-MM-DD (browser timezone)
   */
  static formatLocalYMD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
      this.dataManager.on('data', ({ source: dataSource }) => {
        if (dataSource === source) {
          this.updateMetrics();
          if (dataSource === 'activityLogs' || dataSource === 'adminActivityLogs' || dataSource === 'users' || dataSource === 'purchases' || dataSource === 'specs') {
            this.renderActivityFeed();
          }
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
   * Planning usage on Live Overview (same API as former Analytics block).
   */
  async loadOverviewPlanningAnalytics(days = 30) {
    const container = helpers.dom('#overview-planning-usage-containers');
    if (!container) return;

    const sections = [
      {
        title: 'Pages',
        openAction: 'section_pages',
        useActions: ['add_custom_page', 'add_predefined_page', 'default_homepage_seeded']
      },
      {
        title: 'Workflows',
        openAction: 'section_workflow',
        useActions: ['create_workflow', 'add_workflow_step']
      },
      {
        title: 'Features',
        openAction: 'section_features',
        useActions: ['preset_feature_selected', 'add_custom_feature']
      },
      {
        title: 'Design',
        openAction: 'section_design',
        useActions: ['design_selected']
      },
      {
        title: 'Integrations',
        openAction: 'section_integrations',
        useActions: ['integration_selected']
      },
      {
        title: 'Audience',
        openAction: 'section_audience',
        useActions: ['audience_interest_selected', 'audience_platform']
      },
      {
        title: 'Screenshot',
        openAction: 'section_screenshot',
        useActions: ['screenshot_file_selected', 'screenshot_analyze_success', 'screenshot_confirmed']
      }
    ];

    try {
      const response = await apiService.getPlanningStats(days);
      if (response.success && Array.isArray(response.actions)) {
        const totalsByAction = response.actions.reduce((acc, row) => {
          acc[row.id] = row.totalEvents || 0;
          return acc;
        }, {});

        const cardsHtml = sections
          .map((section) => {
            const openedCount = totalsByAction[section.openAction] || 0;
            const usedCount = section.useActions.reduce((sum, actionId) => sum + (totalsByAction[actionId] || 0), 0);
            return `
              <div class="metric-card-small">
                <div class="metric-label">${this.escapeHtml(section.title)} Section</div>
                <div class="metric-description" style="margin-top: 8px;">Opened: <strong>${openedCount}</strong></div>
                <div class="metric-description">Used: <strong>${usedCount}</strong></div>
              </div>
            `;
          })
          .join('');

        container.innerHTML =
          cardsHtml ||
          `
          <div class="metric-card-small">
            <div class="metric-label">No Planning Data</div>
            <div class="metric-description">No events in this period</div>
          </div>
        `;
        return;
      }
      container.innerHTML = `
        <div class="metric-card-small">
          <div class="metric-label">No Planning Data</div>
          <div class="metric-description">No events in this period</div>
        </div>
      `;
    } catch (error) {
      console.error('[OverviewView] Planning analytics:', error);
      container.innerHTML = `
        <div class="metric-card-small">
          <div class="metric-label">Error Loading Planning Usage</div>
          <div class="metric-description">${this.escapeHtml(error.message || 'Unknown error')}</div>
        </div>
      `;
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

    const recentSubmissions = this.contactSubmissions.slice(0, 8);

    if (recentSubmissions.length === 0) {
      container.innerHTML = '<div class="activity-empty">No submissions yet</div>';
      return;
    }

    const html = recentSubmissions.map((sub) => {
      const statusClass = sub.status === 'new' || !sub.status ? 'new' : sub.status;
      const statusLabel =
        sub.status === 'new' || !sub.status
          ? 'New'
          : sub.status === 'read'
            ? 'Read'
            : sub.status === 'replied'
              ? 'Replied'
              : sub.status === 'archived'
                ? 'Archived'
                : 'New';

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
      const messagePreview = message.length > 160 ? `${message.substring(0, 160)}…` : message;

      return `
        <article class="overview-contact-notification" data-contact-id="${this.escapeHtml(String(sub.id))}">
          <button type="button" class="overview-contact-notification__remove" data-contact-id="${this.escapeHtml(String(sub.id))}" title="Delete this submission permanently" aria-label="Delete submission">
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
          <div class="overview-contact-notification__body">
            <div class="overview-contact-notification__row">
              <span class="overview-contact-notification__email">${this.escapeHtml(email)}</span>
              <span class="overview-contact-notification__badge overview-contact-notification__badge--${statusClass}">${statusLabel}</span>
            </div>
            <p class="overview-contact-notification__preview">${this.escapeHtml(messagePreview)}</p>
            <time class="overview-contact-notification__time">${this.escapeHtml(dateStr)}</time>
          </div>
        </article>
      `;
    }).join('');

    container.innerHTML = html;

    container.querySelectorAll('.overview-contact-notification__remove').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const contactId = btn.getAttribute('data-contact-id');
        if (contactId) {
          await this.deleteContactSubmission(contactId);
        }
      });
    });
  }

  /**
   * Permanently delete a contact submission (Firestore + overview list).
   */
  async deleteContactSubmission(contactId) {
    if (!window.confirm('Delete this contact submission permanently? This cannot be undone.')) {
      return;
    }
    try {
      const response = await apiService.delete(`/api/admin/contact-submissions/${encodeURIComponent(contactId)}`);
      if (response.success) {
        this.contactSubmissions = this.contactSubmissions.filter((s) => s.id !== contactId);
        this.updateContactStats();
        this.renderContactList();
      } else {
        window.alert(response.error || 'Failed to delete submission');
      }
    } catch (error) {
      console.error('[OverviewView] Error deleting contact submission:', error);
      window.alert(error.message || 'Failed to delete submission');
    }
  }

  /**
   * Show view
   */
  show() {
    this.updateMetrics();
    this.renderActivityFeed();

    const planningDays = parseInt(helpers.dom('#overview-planning-range-select')?.value, 10);
    this.loadOverviewPlanningAnalytics(Number.isFinite(planningDays) ? planningDays : 30);

    this.loadContactSubmissions();

    setTimeout(() => {
      this.updateMetrics();
      this.renderActivityFeed();
      const days = parseInt(helpers.dom('#overview-planning-range-select')?.value, 10);
      this.loadOverviewPlanningAnalytics(Number.isFinite(days) ? days : 30);
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
   * Product key to display label (pricing page)
   */
  static BUY_NOW_PRODUCT_LABELS = {
    single_spec: 'Single Spec',
    three_pack: '3-Pack',
    pro_monthly: 'Pro Monthly',
    pro_yearly: 'Pro Yearly'
  };
  
  /**
   * Load and render Buy Now clicks per product (pricing page)
   */
  async loadBuyNowClicks(range) {
    const listEl = helpers.dom('#buy-now-clicks-list');
    const totalEl = helpers.dom('#buy-now-clicks-total');
    if (!listEl) return;
    
    const rangeSelect = helpers.dom('#buy-now-clicks-range');
    const selectedRange = range != null ? range : (rangeSelect?.value || 'week');
    
    listEl.innerHTML = '<div class="buy-now-clicks-loading">Loading...</div>';
    if (totalEl) totalEl.textContent = '';
    
    try {
      const response = await apiService.getBuyNowClicks(selectedRange);
      if (response.success) {
        this.renderBuyNowClicks(response.byProduct, response.total, listEl, totalEl);
      } else {
        listEl.innerHTML = '<div class="buy-now-clicks-error">Failed to load</div>';
      }
    } catch (error) {
      console.error('[OverviewView] Error loading buy-now clicks:', error);
      listEl.innerHTML = '<div class="buy-now-clicks-error">Failed to load</div>';
    }
  }
  
  /**
   * Render Buy Now clicks list
   */
  renderBuyNowClicks(byProduct, total, listEl, totalEl) {
    const labels = OverviewView.BUY_NOW_PRODUCT_LABELS;
    const order = ['single_spec', 'three_pack', 'pro_monthly', 'pro_yearly'];
    
    let html = '';
    for (const key of order) {
      const count = byProduct[key] || 0;
      const label = labels[key] || key;
      html += `<div class="buy-now-click-row">
        <span class="buy-now-product">${String(label).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\>/g, '&gt;')}</span>
        <span class="buy-now-count">${count.toLocaleString()}</span>
      </div>`;
    }
    listEl.innerHTML = html || '<div class="buy-now-clicks-empty">No clicks in this period</div>';
    if (totalEl) {
      totalEl.textContent = `Total: ${(total || 0).toLocaleString()} clicks`;
      totalEl.className = 'buy-now-clicks-total';
    }
  }

  /**
   * Load pipeline canary run history and render chart
   */
  async loadPipelineCanaryHistory() {
    const chart = helpers.dom('#pipeline-canary-chart');
    const todayEl = helpers.dom('#pipeline-canary-today');
    if (!chart) return;

    chart.innerHTML = '<div class="pipeline-canary-loading">Loading history…</div>';
    if (todayEl) todayEl.textContent = '';

    try {
      const data = await apiService.getPipelineCanaryHistory(14);
      const runs = (data && data.runs) || [];
      this.renderPipelineCanaryChart(runs);
    } catch (error) {
      console.error('[OverviewView] Pipeline canary history:', error);
      chart.innerHTML = '<div class="pipeline-canary-error">Could not load history.</div>';
      if (todayEl) todayEl.textContent = '';
    }
  }

  /**
   * Render last 14 days as bars (best traffic per dateKey when multiple runs)
   */
  renderPipelineCanaryChart(runs) {
    const chart = helpers.dom('#pipeline-canary-chart');
    const todayEl = helpers.dom('#pipeline-canary-today');
    if (!chart) return;

    const rank = { green: 3, orange: 2, red: 1 };
    const byDay = new Map();
    runs.forEach((r) => {
      const d = r.dateKey;
      if (!d) return;
      const score = rank[r.traffic] || 0;
      const cur = byDay.get(d);
      const curScore = cur ? (rank[cur.run.traffic] || 0) : -1;
      const timeA = r.startedAt || '';
      const timeB = cur ? (cur.run.startedAt || '') : '';
      if (!cur || score > curScore || (score === curScore && timeA > timeB)) {
        byDay.set(d, { run: r });
      }
    });

    const keys = [];
    for (let i = 13; i >= 0; i -= 1) {
      const dt = new Date();
      dt.setHours(0, 0, 0, 0);
      dt.setDate(dt.getDate() - i);
      keys.push(OverviewView.formatLocalYMD(dt));
    }

    chart.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'pipeline-canary-bars';

    keys.forEach((dateKey) => {
      const cell = document.createElement('div');
      cell.className = 'pipeline-canary-day';
      const bar = document.createElement('div');
      bar.className = 'pipeline-canary-bar';
      const entry = byDay.get(dateKey);
      const traffic = entry && entry.run ? entry.run.traffic : null;
      if (traffic === 'green') bar.classList.add('is-green');
      else if (traffic === 'orange') bar.classList.add('is-orange');
      else if (traffic === 'red') bar.classList.add('is-red');
      else bar.classList.add('is-empty');

      const label = traffic || 'none';
      cell.title = `${dateKey}: ${label}`;

      const lbl = document.createElement('span');
      lbl.className = 'pipeline-canary-day-label';
      lbl.textContent = dateKey.slice(8);
      cell.appendChild(bar);
      cell.appendChild(lbl);
      row.appendChild(cell);
    });
    chart.appendChild(row);

    const todayKey = OverviewView.formatLocalYMD(new Date());
    const t = byDay.get(todayKey);
    if (todayEl) {
      if (!t || !t.run) {
        todayEl.textContent = `Today (${todayKey}): no run recorded for this calendar day in history.`;
      } else {
        const tr = t.run.traffic || 'in progress';
        const spec = t.run.specId ? ` spec ${t.run.specId}` : '';
        todayEl.textContent = `Today (${todayKey}): ${tr} — ${t.run.templateId || 'template'}${spec}`;
      }
    }
  }

  /**
   * Poll until run.traffic is set or timeout (aligned with long server-side generation).
   */
  async pollPipelineCanaryRun(runId, statusEl, maxMs = 3600000) {
    const start = Date.now();
    const pollIntervalMs = 6000;
    while (Date.now() - start < maxMs) {
      try {
        const data = await apiService.getPipelineCanaryRun(runId);
        const run = data && data.run;
        if (run && run.traffic) {
          if (statusEl) {
            const err = run.error ? ` — ${run.error}` : '';
            statusEl.textContent = `Result: ${run.traffic}${err}`;
          }
          return run;
        }
        if (statusEl) {
          const elapsedMin = Math.floor((Date.now() - start) / 60000);
          statusEl.textContent = `Running… (${elapsedMin}m elapsed, poll every ${pollIntervalMs / 1000}s)`;
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      } catch (err) {
        const msg = (err && err.message) ? String(err.message) : '';
        const isRateLimited = /429|Too many|rate limit/i.test(msg);
        if (isRateLimited && Date.now() - start < maxMs) {
          if (statusEl) statusEl.textContent = 'Temporary rate limit — retrying in 30s…';
          await new Promise((resolve) => setTimeout(resolve, 30000));
          continue;
        }
        throw err;
      }
    }
    if (statusEl) statusEl.textContent = 'Stopped waiting (timeout). Refresh history for partial data.';
    return null;
  }

  /**
   * POST canary run and poll to completion
   */
  async runPipelineCanaryNow() {
    const btn = helpers.dom('#pipeline-canary-run-btn');
    const statusEl = helpers.dom('#pipeline-canary-run-status');
    if (btn) btn.disabled = true;
    if (statusEl) statusEl.textContent = 'Starting…';

    try {
      const res = await apiService.runPipelineCanary({});
      const runId = res && res.runId;
      if (!runId) throw new Error('No runId returned');
      await this.pollPipelineCanaryRun(runId, statusEl);
      await this.loadPipelineCanaryHistory();
    } catch (error) {
      console.error('[OverviewView] Pipeline canary run:', error);
      if (statusEl) statusEl.textContent = `Error: ${error.message || error}`;
    } finally {
      if (btn) btn.disabled = false;
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
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
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
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
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
