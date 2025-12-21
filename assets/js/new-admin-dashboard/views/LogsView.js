/**
 * Logs View - Live activity and error logs
 */

import { helpers } from '../utils/helpers.js';
import { apiService } from '../services/ApiService.js';

export class LogsView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.logsStream = null;
    this.renderLogsData = [];
    
    this.init();
  }
  
  /**
   * Initialize view
   */
  init() {
    this.logsStream = helpers.dom('#logs-stream');
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Subscribe to data changes
    this.setupDataSubscriptions();
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Logs filter
    const logsFilter = helpers.dom('#logs-filter');
    if (logsFilter) {
      logsFilter.addEventListener('change', () => {
        this.render();
      });
    }
  }
  
  /**
   * Setup data subscriptions
   */
  setupDataSubscriptions() {
    this.dataManager.on('data', ({ source, data }) => {
      if (source === 'activityLogs') {
        this.render();
      }
    });
  }
  
  /**
   * Load render logs from API
   */
  async loadRenderLogs() {
    try {
      const response = await apiService.get('/api/admin/render-logs?limit=100');
      if (response && response.success && response.logs) {
        this.renderLogsData = response.logs.map(log => ({
          id: log.id,
          type: log.level?.toLowerCase() || 'server',
          title: log.message || 'Server log',
          description: this.formatRenderLogDescription(log),
          timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
          userId: log.userId,
          userEmail: log.userEmail,
          level: log.level,
          path: log.path,
          method: log.method,
          statusCode: log.statusCode,
          errorStack: log.errorStack
        }));
        this.render();
      }
    } catch (error) {
      console.error('[LogsView] Error loading render logs:', error);
    }
  }
  
  /**
   * Format render log description
   */
  formatRenderLogDescription(log) {
    let desc = '';
    if (log.errorName) {
      desc += `<strong>${this.escapeHtml(log.errorName)}</strong>: `;
    }
    if (log.errorCode) {
      desc += `[${this.escapeHtml(log.errorCode)}] `;
    }
    if (log.statusCode) {
      desc += `HTTP ${log.statusCode} `;
    }
    if (log.requestId) {
      desc += `Request ID: ${log.requestId.substring(0, 8)}... `;
    }
    return desc || log.message || 'Server log entry';
  }
  
  /**
   * Render logs
   */
  async render() {
    if (!this.logsStream) return;
    
    // Load render logs if section is active and not loaded
    const logsSection = this.logsStream.closest('.dashboard-section');
    if (logsSection?.classList.contains('active') && this.renderLogsData.length === 0) {
      await this.loadRenderLogs();
    }
    
    const allData = this.dataManager.getAllData();
    let logs = [...allData.activityLogs, ...this.renderLogsData];
    
    // Apply filter
    const logsFilter = helpers.dom('#logs-filter');
    const filter = logsFilter?.value || 'all';
    
    if (filter !== 'all') {
      logs = logs.filter(log => {
        const level = (log.level || log.type || '').toLowerCase();
        return level === filter.toLowerCase();
      });
    }
    
    // Sort by timestamp
    logs.sort((a, b) => {
      const timeA = a.timestamp?.getTime() || 0;
      const timeB = b.timestamp?.getTime() || 0;
      return timeB - timeA;
    });
    
    if (logs.length === 0) {
      this.logsStream.innerHTML = '<div class="log-placeholder">No logs found</div>';
      return;
    }
    
    // Render logs
    const html = logs.slice(0, 100).map(log => {
      const level = (log.level || log.type || 'info').toLowerCase();
      const timestamp = helpers.formatDate(log.timestamp);
      const relativeTime = helpers.formatRelative(log.timestamp);
      const userInfo = log.userEmail 
        ? `<div class="log-user">User: ${this.escapeHtml(log.userEmail)}</div>` 
        : log.userId 
        ? `<div class="log-user">User ID: ${log.userId.substring(0, 8)}...</div>` 
        : '';
      const pathInfo = log.path ? `<div class="log-path">${log.method || ''} ${log.path}</div>` : '';
      
      return `
        <div class="log-entry log-${level}">
          <div class="log-header">
            <span class="log-level">${level.toUpperCase()}</span>
            <time class="log-time" title="${timestamp}">${relativeTime}</time>
          </div>
          <div class="log-title">${this.escapeHtml(log.title || 'Log entry')}</div>
          ${log.description ? `<div class="log-description">${this.escapeHtml(log.description)}</div>` : ''}
          ${userInfo}
          ${pathInfo}
          ${log.errorStack ? `<details class="log-stack"><summary>Stack trace</summary><pre>${this.escapeHtml(log.errorStack)}</pre></details>` : ''}
        </div>
      `;
    }).join('');
    
    this.logsStream.innerHTML = html;
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
  async show() {
    await this.render();
  }
  
  /**
   * Hide view
   */
  hide() {
    // Cleanup if needed
  }
}

