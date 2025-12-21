/**
 * Overview View - Main dashboard overview with metrics and activity
 */

import { MetricCard } from '../components/MetricCard.js';
import { MetricsCalculator } from '../core/MetricsCalculator.js';
import { helpers } from '../utils/helpers.js';

export class OverviewView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.metricsCalculator = new MetricsCalculator(dataManager);
    this.metricCards = new Map();
    this.activityFeed = null;
    
    this.init();
  }
  
  /**
   * Initialize view
   */
  init() {
    // Initialize metric cards
    this.initMetricCards();
    
    // Initialize activity feed
    this.initActivityFeed();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Subscribe to data changes
    this.setupDataSubscriptions();
  }
  
  /**
   * Initialize metric cards
   */
  initMetricCards() {
    const metricElements = helpers.domAll('.metric-card');
    
    metricElements.forEach(element => {
      const metricKey = element.dataset.metric;
      if (metricKey) {
        const metricCard = new MetricCard(element, this.dataManager, this.stateManager);
        this.metricCards.set(metricKey, metricCard);
      }
    });
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
    // Overview range selector
    const rangeSelector = helpers.dom('#overview-range');
    if (rangeSelector) {
      rangeSelector.addEventListener('change', (e) => {
        this.stateManager.setState('overviewRange', e.target.value);
        this.updateMetrics();
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
          this.updateMetrics();
          if (source === 'activityLogs' || source === 'users' || source === 'purchases') {
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
  updateMetrics() {
    try {
      const allData = this.dataManager.getAllData();
      const range = this.stateManager.getState('overviewRange') || 'week';
      const metrics = this.metricsCalculator.calculateOverviewMetrics(range);
      
      console.log('[OverviewView] Updating metrics:', metrics);
      
      // Update metric values
      const valueElements = {
        'users-total': helpers.dom('#metric-users-total'),
        'users-live': helpers.dom('#metric-users-live'),
        'users-pro': helpers.dom('#metric-users-pro'),
        'specs-total': helpers.dom('#metric-specs-total'),
        'revenue-total': helpers.dom('#metric-revenue-total')
      };
      
      if (valueElements['users-total']) {
        valueElements['users-total'].textContent = metrics.totalUsers.toLocaleString();
      }
      if (valueElements['users-live']) {
        valueElements['users-live'].textContent = metrics.liveUsers.toLocaleString();
      }
      if (valueElements['users-pro']) {
        valueElements['users-pro'].textContent = metrics.proUsers.toLocaleString();
      }
      if (valueElements['specs-total']) {
        valueElements['specs-total'].textContent = metrics.specsTotal.toLocaleString();
      }
      if (valueElements['revenue-total']) {
        valueElements['revenue-total'].textContent = helpers.formatCurrency(metrics.revenueRange);
      }
      
      // Update each metric card chart
      this.metricCards.forEach((card, key) => {
        let data = [];
        
        switch (key) {
          case 'users-total':
          case 'users-live':
          case 'users-pro':
            data = allData.users;
            break;
          case 'specs-total':
            data = allData.specs;
            break;
          case 'revenue-total':
            data = allData.purchases;
            break;
          default:
            data = [];
        }
        
        if (card && typeof card.update === 'function') {
          card.update(data);
        }
      });
    } catch (error) {
      console.error('[OverviewView] Error updating metrics:', error);
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
    
    const html = events.slice(0, 20).map(event => {
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
    
    // Make sure elements exist
    if (!this.activityFeed) {
      this.activityFeed = helpers.dom('#activity-feed');
    }
    
    // Update metrics
    this.updateMetrics();
    
    // Render activity feed
    this.renderActivityFeed();
    
    // Force update after a short delay to ensure data is loaded
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
}

