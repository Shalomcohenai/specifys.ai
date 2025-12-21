/**
 * Metric Card Component - Animated metric cards with charts
 */

import { ChartComponent } from './ChartComponent.js';
import { helpers } from '../utils/helpers.js';

export class MetricCard {
  constructor(element, dataManager, stateManager) {
    this.element = element;
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.metricKey = element.dataset.metric;
    this.chart = null;
    this.currentValue = 0;
    
    this.init();
  }
  
  /**
   * Initialize metric card
   */
  init() {
    if (!this.element) return;
    
    // Get chart canvas
    const canvas = this.element.querySelector('.metric-chart');
    if (canvas && window.Chart) {
      this.initChart(canvas);
    }
    
    // Get value element
    this.valueElement = this.element.querySelector('.metric-value .value');
    
    // Subscribe to data changes
    this.setupDataSubscription();
  }
  
  /**
   * Initialize chart
   */
  initChart(canvas) {
    const color = this.getMetricColor(this.metricKey);
    
    this.chart = new ChartComponent(canvas, {
      type: 'bar',
      data: {
        labels: this.getLast7DaysLabels(),
        datasets: [{
          label: this.metricKey,
          data: new Array(7).fill(0),
          backgroundColor: color,
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        scales: {
          x: {
            display: true,
            grid: { display: false },
            ticks: {
              font: { size: 10 },
              color: '#6b7280',
              maxRotation: 0
            }
          },
          y: {
            display: true,
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
              drawBorder: false
            },
            ticks: {
              font: { size: 10 },
              color: '#6b7280',
              precision: 0
            }
          }
        }
      }
    });
  }
  
  /**
   * Get metric color
   */
  getMetricColor(metric) {
    const colors = {
      'users-total': 'rgba(59, 130, 246, 0.8)',
      'users-live': 'rgba(16, 185, 129, 0.8)',
      'users-pro': 'rgba(139, 92, 246, 0.8)',
      'specs-total': 'rgba(245, 158, 11, 0.8)',
      'revenue-total': 'rgba(34, 197, 94, 0.8)',
      'articles-read': 'rgba(239, 68, 68, 0.8)',
      'guides-read': 'rgba(6, 182, 212, 0.8)'
    };
    return colors[metric] || 'rgba(107, 114, 128, 0.8)';
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
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = date.getDate();
      labels.push(`${dayName} ${dayNum}`);
    }
    return labels;
  }
  
  /**
   * Setup data subscription
   */
  setupDataSubscription() {
    // Subscribe to relevant data changes
    const subscriptions = {
      'users-total': 'users',
      'users-live': 'users',
      'users-pro': 'users',
      'specs-total': 'specs',
      'revenue-total': 'purchases',
      'articles-read': 'activityLogs',
      'guides-read': 'activityLogs'
    };
    
    const source = subscriptions[this.metricKey];
    if (source) {
      this.dataManager.on('data', ({ source: dataSource, data }) => {
        if (dataSource === source) {
          this.update(data);
        }
      });
    }
  }
  
  /**
   * Update metric card
   */
  update(data) {
    if (!data || data.length === 0) {
      // Show loading or empty state
      return;
    }
    
    const value = this.calculateValue(data);
    const dailyData = this.calculateDailyData(data);
    
    // Animate value
    if (this.valueElement) {
      if (this.metricKey === 'revenue-total') {
        // For revenue, format as currency
        if (value !== this.currentValue) {
          helpers.animateNumber(this.valueElement, this.currentValue, value, 1000, 'currency');
        }
      } else {
        // For numbers, animate
        if (value !== this.currentValue) {
          helpers.animateNumber(this.valueElement, this.currentValue, value, 1000, 'number');
        }
      }
      this.currentValue = value;
    }
    
    // Update chart
    if (this.chart && dailyData) {
      this.chart.updateData({ data: dailyData });
    }
  }
  
  /**
   * Calculate metric value
   */
  calculateValue(data) {
    switch (this.metricKey) {
      case 'users-total':
        return data.length || 0;
      case 'users-live':
        return this.calculateLiveUsers(data);
      case 'users-pro':
        return this.calculateProUsers(data);
      case 'specs-total':
        return data.length || 0;
      case 'revenue-total':
        return this.calculateRevenue(data);
      default:
        return 0;
    }
  }
  
  /**
   * Calculate live users (active in last 15 minutes)
   */
  calculateLiveUsers(users) {
    const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
    return users.filter(user => {
      if (!user.lastActive) return false;
      return user.lastActive.getTime() >= fifteenMinutesAgo;
    }).length;
  }
  
  /**
   * Calculate pro users
   */
  calculateProUsers(users) {
    const userCredits = this.stateManager.getState('userCredits') || [];
    const proUserIds = new Set(
      userCredits
        .filter(uc => uc.unlimited)
        .map(uc => uc.userId)
    );
    
    return users.filter(user => {
      return proUserIds.has(user.id) || user.plan === 'pro';
    }).length;
  }
  
  /**
   * Calculate revenue
   */
  calculateRevenue(purchases) {
    const range = this.stateManager.getState('overviewRange') || 'week';
    const now = Date.now();
    const ranges = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };
    const threshold = now - (ranges[range] || ranges.week);
    
    return purchases
      .filter(p => p.createdAt && p.createdAt.getTime() >= threshold)
      .reduce((sum, p) => sum + (p.total || 0), 0);
  }
  
  /**
   * Calculate daily data for last 7 days
   */
  calculateDailyData(data) {
    const dailyData = new Array(7).fill(0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    data.forEach(item => {
      const itemDate = item.createdAt;
      if (!itemDate) return;
      
      const date = new Date(itemDate);
      date.setHours(0, 0, 0, 0);
      const daysAgo = Math.floor((today - date) / (1000 * 60 * 60 * 24));
      
      if (daysAgo >= 0 && daysAgo < 7) {
        const value = this.metricKey === 'revenue-total' ? (item.total || 0) : 1;
        dailyData[6 - daysAgo] += value;
      }
    });
    
    return dailyData;
  }
  
  /**
   * Format value
   */
  formatValue(value) {
    if (this.metricKey === 'revenue-total') {
      return helpers.formatCurrency(value);
    }
    return helpers.formatNumber(value);
  }
}

