/**
 * Overview View - Redesigned from scratch
 * Shows: Active users now, New users today, Specs created today, Purchases today
 */

import { ChartComponent } from '../components/ChartComponent.js';
import { MetricsCalculator } from '../core/MetricsCalculator.js';
import { helpers } from '../utils/helpers.js';

export class OverviewView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.metricsCalculator = new MetricsCalculator(dataManager);
    this.charts = new Map();
    this.activityFeed = null;
    
    this.init();
  }
  
  /**
   * Initialize view
   */
  init() {
    // Initialize charts
    this.initCharts();
    
    // Initialize activity feed
    this.initActivityFeed();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Subscribe to data changes
    this.setupDataSubscriptions();
  }
  
  /**
   * Initialize charts
   */
  initCharts() {
    const chartIds = ['chart-active-now', 'chart-new-today', 'chart-specs-today', 'chart-purchases-today'];
    
    chartIds.forEach(chartId => {
      const canvas = helpers.dom(`#${chartId}`);
      if (canvas && window.Chart) {
        // Set fixed size
        canvas.style.width = '100%';
        canvas.style.height = '60px';
        canvas.width = canvas.offsetWidth;
        canvas.height = 60;
        
        const chart = new ChartComponent(canvas, {
          type: 'line',
          data: {
            labels: this.getLast7DaysLabels(),
            datasets: [{
              label: chartId,
              data: new Array(7).fill(0),
              borderColor: this.getChartColor(chartId),
              backgroundColor: this.getChartColor(chartId, 0.1),
              borderWidth: 2,
              fill: true,
              tension: 0.4,
              pointRadius: 0,
              pointHoverRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { enabled: true }
            },
            scales: {
              x: {
                display: false
              },
              y: {
                display: false,
                beginAtZero: true
              }
            }
          }
        });
        
        this.charts.set(chartId, chart);
      }
    });
  }
  
  /**
   * Get chart color
   */
  getChartColor(chartId, alpha = 1) {
    const colors = {
      'chart-active-now': `rgba(59, 130, 246, ${alpha})`,
      'chart-new-today': `rgba(16, 185, 129, ${alpha})`,
      'chart-specs-today': `rgba(139, 92, 246, ${alpha})`,
      'chart-purchases-today': `rgba(245, 158, 11, ${alpha})`
    };
    return colors[chartId] || `rgba(99, 102, 241, ${alpha})`;
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
   * Initialize activity feed
   */
  initActivityFeed() {
    this.activityFeed = helpers.dom('#activity-feed');
    
    // Setup filter buttons
    const filterButtons = helpers.domAll('.activity-filter-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const filter = btn.dataset.filter || 'all';
        this.stateManager.setState('activityFilter', filter);
        this.renderActivityFeed();
      });
    });
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Refresh button
    const refreshBtn = helpers.dom('#refresh-data-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.updateAll();
      });
    }
  }
  
  /**
   * Setup data subscriptions
   */
  setupDataSubscriptions() {
    // Subscribe to all data sources
    ['users', 'userCredits', 'specs', 'purchases', 'activityLogs'].forEach(source => {
      this.dataManager.on('data', ({ source: dataSource, data }) => {
        if (dataSource === source) {
          this.updateAll();
          if (dataSource === 'activityLogs' || dataSource === 'users' || dataSource === 'purchases') {
            this.renderActivityFeed();
          }
        }
      });
    });
    
    // Subscribe to activity events
    this.dataManager.on('activity', () => {
      this.renderActivityFeed();
    });
  }
  
  /**
   * Update all metrics
   */
  updateAll() {
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
    const activeNow = allData.users.filter(u => 
      u.lastActive && u.lastActive.getTime() >= fifteenMinutesAgo
    ).length;
    
    const activeYesterday = allData.users.filter(u => {
      if (!u.lastActive) return false;
      const lastActive = u.lastActive.getTime();
      return lastActive >= yesterday.getTime() && lastActive <= yesterdayEnd.getTime();
    }).length;
    
    const activeChange = activeYesterday > 0 
      ? Math.round(((activeNow - activeYesterday) / activeYesterday) * 100)
      : 0;
    
    this.updateMetric('metric-active-now', activeNow);
    this.updateChange('metric-active-now-change', activeChange);
    this.updateChart('chart-active-now', this.calculateDailyData(allData.users, 'lastActive', today));
    
    // 2. New Users Today
    const newToday = allData.users.filter(u => {
      if (!u.createdAt) return false;
      const created = u.createdAt.getTime();
      return created >= today.getTime() && created <= todayEnd.getTime();
    }).length;
    
    const newYesterday = allData.users.filter(u => {
      if (!u.createdAt) return false;
      const created = u.createdAt.getTime();
      return created >= yesterday.getTime() && created <= yesterdayEnd.getTime();
    }).length;
    
    const newChange = newYesterday > 0
      ? Math.round(((newToday - newYesterday) / newYesterday) * 100)
      : 0;
    
    this.updateMetric('metric-new-today', newToday);
    this.updateChange('metric-new-today-change', newChange);
    this.updateChart('chart-new-today', this.calculateDailyData(allData.users, 'createdAt', today));
    
    // 3. Specs Created Today
    const specsToday = allData.specs.filter(s => {
      if (!s.createdAt) return false;
      const created = s.createdAt.getTime();
      return created >= today.getTime() && created <= todayEnd.getTime();
    }).length;
    
    const specsYesterday = allData.specs.filter(s => {
      if (!s.createdAt) return false;
      const created = s.createdAt.getTime();
      return created >= yesterday.getTime() && created <= yesterdayEnd.getTime();
    }).length;
    
    const specsChange = specsYesterday > 0
      ? Math.round(((specsToday - specsYesterday) / specsYesterday) * 100)
      : 0;
    
    this.updateMetric('metric-specs-today', specsToday);
    this.updateChange('metric-specs-today-change', specsChange);
    this.updateChart('chart-specs-today', this.calculateDailyData(allData.specs, 'createdAt', today));
    
    // 4. Purchases Today
    const purchasesToday = allData.purchases.filter(p => {
      if (!p.createdAt) return false;
      const created = p.createdAt.getTime();
      return created >= today.getTime() && created <= todayEnd.getTime();
    });
    
    const purchasesCount = purchasesToday.length;
    const revenueToday = purchasesToday.reduce((sum, p) => sum + (p.total || 0), 0);
    
    this.updateMetric('metric-purchases-today', purchasesCount);
    this.updateMetric('metric-revenue-today', revenueToday, true);
    this.updateChart('chart-purchases-today', this.calculateDailyData(allData.purchases, 'createdAt', today, 'total'));
  }
  
  /**
   * Calculate daily data for last 7 days
   */
  calculateDailyData(data, dateField, today, valueField = null) {
    const dailyData = new Array(7).fill(0);
    
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
   * Update metric value
   */
  updateMetric(id, value, isCurrency = false) {
    const element = helpers.dom(`#${id}`);
    if (element) {
      if (isCurrency) {
        element.textContent = helpers.formatCurrency(value);
      } else {
        element.textContent = value.toLocaleString();
      }
    }
  }
  
  /**
   * Update change indicator
   */
  updateChange(id, change) {
    const element = helpers.dom(`#${id}`);
    if (element) {
      const icon = element.querySelector('i');
      const span = element.querySelector('span');
      
      if (change > 0) {
        icon.className = 'fas fa-arrow-up';
        element.style.color = 'var(--success)';
        element.style.background = 'rgba(16, 185, 129, 0.1)';
        span.textContent = `+${change}%`;
      } else if (change < 0) {
        icon.className = 'fas fa-arrow-down';
        element.style.color = 'var(--error)';
        element.style.background = 'rgba(239, 68, 68, 0.1)';
        span.textContent = `${change}%`;
      } else {
        icon.className = 'fas fa-minus';
        element.style.color = 'var(--text-tertiary)';
        element.style.background = 'var(--gray-100)';
        span.textContent = '0%';
      }
    }
  }
  
  /**
   * Update chart
   */
  updateChart(chartId, data) {
    const chart = this.charts.get(chartId);
    if (chart) {
      chart.updateData({ data });
    }
  }
  
  /**
   * Render activity feed
   */
  renderActivityFeed() {
    if (!this.activityFeed) return;
    
    const filter = this.stateManager.getState('activityFilter') || 'all';
    const events = this.dataManager.getActivityEvents(filter);
    
    if (events.length === 0) {
      this.activityFeed.innerHTML = '<li class="activity-placeholder">No activity yet</li>';
      return;
    }
    
    const html = events.slice(0, 10).map(event => {
      const icon = this.getActivityIcon(event.type);
      const time = helpers.formatRelative(event.timestamp);
      
      return `
        <li class="activity-item">
          <span class="activity-icon"><i class="${icon}"></i></span>
          <div class="activity-content">
            <div class="activity-title">${this.escapeHtml(event.title || 'Activity')}</div>
            <div class="activity-description">${this.escapeHtml(event.description || '')}</div>
          </div>
          <time class="activity-time">${time}</time>
        </li>
      `;
    }).join('');
    
    this.activityFeed.innerHTML = html;
  }
  
  /**
   * Get activity icon
   */
  getActivityIcon(type) {
    const icons = {
      user: 'fas fa-user',
      spec: 'fas fa-file-alt',
      payment: 'fas fa-credit-card',
      subscription: 'fas fa-sync-alt'
    };
    return icons[type] || 'fas fa-circle';
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
    console.log('[OverviewView] Showing view');
    this.updateAll();
    this.renderActivityFeed();
    
    // Force update after a short delay
    setTimeout(() => {
      this.updateAll();
      this.renderActivityFeed();
    }, 500);
  }
  
  /**
   * Hide view
   */
  hide() {
    // Cleanup if needed
  }
}
