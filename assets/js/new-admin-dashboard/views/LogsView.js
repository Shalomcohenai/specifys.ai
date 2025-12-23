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
      if (source === 'errorLogs' || source === 'activityLogs' || source === 'adminActivityLogs' || source === 'purchases') {
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
   * Render logs - System Health Check logs from admin_activity_log
   */
  render() {
    if (!this.logsContainer) return;
    
    const allData = this.dataManager.getAllData();
    
    // Collect System Health Check logs from admin_activity_log
    const systemLogs = [];
    
    // Get logs from admin_activity_log collection (System Health Check logs)
    if (allData.adminActivityLogs && allData.adminActivityLogs.length > 0) {
      allData.adminActivityLogs.forEach(log => {
        systemLogs.push({
          id: log.id,
          type: log.type || 'info',
          title: log.title || 'System Activity',
          description: log.description || '',
          timestamp: log.timestamp || new Date(),
          userId: log.userId || null,
          userEmail: log.userEmail || null,
          metadata: log.metadata || {}
        });
      });
    }
    
    // Collect all errors from different sources
    const allErrors = [];
    
    // 1. Error logs from errorLogs collection
    if (allData.errorLogs && allData.errorLogs.length > 0) {
      allData.errorLogs.forEach(error => {
        allErrors.push({
          id: error.id,
          type: 'error',
          category: 'system',
          title: error.errorMessage || error.message || 'System Error',
          description: `Type: ${error.errorType || 'unknown'} | Code: ${error.errorCode || 'N/A'}${error.frequency > 1 ? ` | Occurred ${error.frequency} times` : ''}`,
          timestamp: error.lastOccurrence || error.timestamp || new Date(),
          userId: error.userId,
          userEmail: null, // Will try to find from users
          errorCode: error.errorCode,
          errorType: error.errorType,
          frequency: error.frequency || 1
        });
      });
    }
    
    // 2. Errors from activity logs
    if (allData.activityLogs && allData.activityLogs.length > 0) {
      allData.activityLogs.forEach(log => {
        const isError = log.type === 'error' || log.level === 'error' || 
                       (log.message && log.message.toLowerCase().includes('error')) ||
                       (log.title && log.title.toLowerCase().includes('error'));
        
        if (isError) {
          allErrors.push({
            id: log.id || `error-${Date.now()}-${Math.random()}`,
            type: 'error',
            category: 'user',
            title: log.title || log.message || 'User Error',
            description: log.description || log.path || '',
            timestamp: log.timestamp || log.createdAt || new Date(),
            userId: log.userId || log.meta?.userId,
            userEmail: log.userEmail || log.meta?.userEmail,
            path: log.path
          });
        }
      });
    }
    
    // 3. Failed purchases (status !== 'completed')
    if (allData.purchases && allData.purchases.length > 0) {
      allData.purchases.forEach(purchase => {
        if (purchase.status && purchase.status !== 'completed' && purchase.status !== 'paid') {
          allErrors.push({
            id: `purchase-error-${purchase.id}`,
            type: 'error',
            category: 'purchase',
            title: `Failed Purchase: ${purchase.productName || 'Unknown Product'}`,
            description: `Status: ${purchase.status} | Amount: ${purchase.total || 0} ${purchase.currency || 'USD'}`,
            timestamp: purchase.createdAt || new Date(),
            userId: purchase.userId,
            userEmail: purchase.email,
            purchaseId: purchase.id
          });
        }
      });
    }
    
    // Enrich with user emails
    allErrors.forEach(error => {
      if (error.userId && !error.userEmail && allData.users) {
        const user = allData.users.find(u => u.id === error.userId);
        if (user) {
          error.userEmail = user.email;
        }
      }
    });
    
    // Sort by timestamp (newest first)
    allErrors.sort((a, b) => {
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      return timeB - timeA;
    });
    
    // Combine system logs and errors
    const allLogs = [...systemLogs, ...allErrors];
    
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
        if (this.currentFilter === 'purchase') return log.category === 'purchase';
        if (this.currentFilter === 'user') return log.category === 'user';
        if (this.currentFilter === 'system') return log.category === 'system' || log.type === 'info' || log.type === 'system';
        return true;
      });
    }
    
    // Limit to 200 most recent logs
    const displayLogs = filteredLogs.slice(0, 200);
    
    if (displayLogs.length === 0) {
      this.logsContainer.innerHTML = '<div class="logs-empty">No logs found</div>';
      return;
    }
    
    const html = displayLogs.map(log => {
      // Check if it's a system log (from admin_activity_log) or an error
      const isSystemLog = systemLogs.some(sl => sl.id === log.id);
      const isError = log.type === 'error' || log.category === 'system' || log.category === 'user' || log.category === 'purchase';
      
      if (isSystemLog && !isError) {
        // System Health Check log
        const time = this.formatRelativeTime(log.timestamp);
        return `
          <div class="log-entry log-info">
            <div class="log-header">
              <span class="log-level">SYSTEM</span>
              <span class="log-category">Health Check</span>
              <span class="log-time">${time}</span>
            </div>
            <div class="log-title">${this.escapeHtml(log.title)}</div>
            ${log.description ? `<div class="log-description">${this.escapeHtml(log.description)}</div>` : ''}
            ${log.userEmail ? `<div class="log-user">User: ${this.escapeHtml(log.userEmail)}</div>` : ''}
          </div>
        `;
      }
      
      // Error log
      const time = this.formatRelativeTime(log.timestamp);
      const categoryLabel = log.category === 'purchase' ? 'Purchase Error' : 
                           log.category === 'user' ? 'User Error' : 
                           'System Error';
      
      return `
        <div class="log-entry log-error">
          <div class="log-header">
            <span class="log-level">ERROR</span>
            <span class="log-category">${categoryLabel}</span>
            <span class="log-time">${time}</span>
          </div>
          <div class="log-title">${this.escapeHtml(log.title)}</div>
          ${log.description ? `<div class="log-description">${this.escapeHtml(log.description)}</div>` : ''}
          ${log.userEmail ? `<div class="log-user">User: ${this.escapeHtml(log.userEmail)}</div>` : ''}
          ${log.errorCode ? `<div class="log-error-code">Error Code: ${this.escapeHtml(log.errorCode)}</div>` : ''}
          ${log.frequency > 1 ? `<div class="log-frequency">Occurred ${log.frequency} times</div>` : ''}
        </div>
      `;
    }).join('');
    
    this.logsContainer.innerHTML = html;
  }
  
  /**
   * Old render method - kept for reference but not used
   */
  renderOld() {
    if (!this.logsContainer) return;
    
    const allData = this.dataManager.getAllData();
    
    // Collect all errors from different sources
    const allErrors = [];
      const time = this.formatRelativeTime(error.timestamp);
      const categoryLabel = error.category === 'purchase' ? 'Purchase Error' : 
                           error.category === 'user' ? 'User Error' : 
                           'System Error';
      
      return `
        <div class="log-entry log-error">
          <div class="log-header">
            <span class="log-level">ERROR</span>
            <span class="log-category">${categoryLabel}</span>
            <span class="log-time">${time}</span>
          </div>
          <div class="log-title">${this.escapeHtml(error.title)}</div>
          ${error.description ? `<div class="log-description">${this.escapeHtml(error.description)}</div>` : ''}
          ${error.userEmail ? `<div class="log-user">User: ${this.escapeHtml(error.userEmail)}</div>` : ''}
          ${error.errorCode ? `<div class="log-error-code">Error Code: ${this.escapeHtml(error.errorCode)}</div>` : ''}
          ${error.frequency > 1 ? `<div class="log-frequency">Occurred ${error.frequency} times</div>` : ''}
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
