/**
 * Logs View - Complete live activity and error logs
 * Shows activity logs and render logs from API
 */

import { helpers } from '../utils/helpers.js';
import { apiService } from '../services/ApiService.js';

export class LogsView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.logsContainer = null;
    this.renderLogsData = [];
    this.currentFilter = 'all';
    
    this.init();
  }
  
  /**
   * Initialize view
   */
  init() {
    this.logsContainer = helpers.dom('#logs-container');
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Subscribe to data changes
    this.setupDataSubscriptions();
    
    // Don't load render logs - endpoint doesn't exist
    // Just use activity logs from Firebase
    this.renderLogsData = [];
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Logs filter
    const filterSelect = helpers.dom('#logs-filter-select');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        this.currentFilter = e.target.value;
        this.render();
      });
    }
  }
  
  /**
   * Setup data subscriptions
   */
  setupDataSubscriptions() {
    this.dataManager.on('data', ({ source }) => {
      if (source === 'activityLogs') {
        this.render();
      }
    });
  }
  
  
  /**
   * Show view
   */
  show() {
    // Don't load render logs - endpoint doesn't exist
    // Just render activity logs from Firebase
    this.render();
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
    this.render();
  }
  
  /**
   * Render logs
   */
  render() {
    if (!this.logsContainer) return;
    
    const allData = this.dataManager.getAllData();
    const activityLogs = allData.activityLogs || [];
    
    // Combine activity logs and render logs
    const allLogs = [
      ...this.renderLogsData.map(log => ({
        id: log.id,
        type: log.level?.toLowerCase() || 'info',
        title: log.message || 'Log entry',
        description: this.formatLogDescription(log),
        timestamp: log.timestamp,
        userId: log.userId,
        userEmail: log.userEmail,
        level: log.level
      })),
      ...activityLogs.map(log => ({
        id: log.id || `log-${Date.now()}-${Math.random()}`,
        type: log.type || log.level?.toLowerCase() || 'info',
        title: log.title || log.message || 'Activity',
        description: log.description || log.path || '',
        timestamp: log.timestamp || log.createdAt || new Date(),
        userId: log.userId || log.meta?.userId,
        userEmail: log.userEmail || log.meta?.userEmail,
        level: log.level || 'info'
      }))
    ];
    
    // Sort by timestamp (newest first)
    allLogs.sort((a, b) => {
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      return timeB - timeA;
    });
    
    // Apply filter
    let filteredLogs = allLogs;
    if (this.currentFilter !== 'all') {
      filteredLogs = allLogs.filter(log => {
        if (this.currentFilter === 'error') return log.type === 'error' || log.level === 'error';
        if (this.currentFilter === 'warning') return log.type === 'warning' || log.level === 'warning';
        if (this.currentFilter === 'info') return log.type === 'info' || log.level === 'info';
        return true;
      });
    }
    
    // Limit to 100 most recent
    const displayLogs = filteredLogs.slice(0, 100);
    
    if (displayLogs.length === 0) {
      this.logsContainer.innerHTML = '<div class="logs-empty">No logs found</div>';
      return;
    }
    
    const html = displayLogs.map(log => {
      const logClass = this.getLogClass(log.type || log.level);
      const icon = this.getLogIcon(log.type || log.level);
      const time = this.formatRelativeTime(log.timestamp);
      
      return `
        <div class="log-entry ${logClass}">
          <div class="log-header">
            <span class="log-level">${(log.level || log.type || 'info').toUpperCase()}</span>
            <span class="log-time">${time}</span>
          </div>
          <div class="log-title">${this.escapeHtml(log.title)}</div>
          ${log.description ? `<div class="log-description">${this.escapeHtml(log.description)}</div>` : ''}
          ${log.userEmail ? `<div class="log-user">User: ${this.escapeHtml(log.userEmail)}</div>` : ''}
          ${log.path ? `<div class="log-path">Path: ${this.escapeHtml(log.path)}</div>` : ''}
        </div>
      `;
    }).join('');
    
    this.logsContainer.innerHTML = html;
  }
  
  /**
   * Format log description
   */
  formatLogDescription(log) {
    const parts = [];
    if (log.method && log.path) {
      parts.push(`${log.method} ${log.path}`);
    }
    if (log.statusCode) {
      parts.push(`Status: ${log.statusCode}`);
    }
    return parts.join(' • ') || log.description || '';
  }
  
  /**
   * Get log CSS class
   */
  getLogClass(level) {
    if (level === 'error') return 'log-error';
    if (level === 'warning') return 'log-warning';
    if (level === 'info') return 'log-info';
    return '';
  }
  
  /**
   * Get log icon
   */
  getLogIcon(level) {
    if (level === 'error') return 'fas fa-exclamation-circle';
    if (level === 'warning') return 'fas fa-exclamation-triangle';
    if (level === 'info') return 'fas fa-info-circle';
    return 'fas fa-circle';
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
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
}
