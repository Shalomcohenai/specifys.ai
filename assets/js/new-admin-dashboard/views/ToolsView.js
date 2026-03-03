/**
 * Tools View - Complete tools management
 * View, manage tools and automation
 */

import { helpers } from '../utils/helpers.js';
import { apiService } from '../services/ApiService.js';

export class ToolsView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.table = null;
    this.tools = [];
    this.currentCategory = 'all';
    this.categories = [];
    
    this.init();
  }
  
  /**
   * Initialize view
   */
  init() {
    this.table = helpers.dom('#tools-table tbody');
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Load automation status
    this.loadAutomationStatus();
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Search
    const searchInput = helpers.dom('#tools-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', helpers.debounce(() => {
        this.render();
      }, 300));
    }
    
    // Category filter
    const categoryFilter = helpers.dom('#tools-category-filter-select');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        this.currentCategory = e.target.value;
        this.render();
      });
    }
    
    // Refresh button
    const refreshBtn = helpers.dom('#refresh-tools-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadTools();
      });
    }
    
    // Run automation button
    const runBtn = helpers.dom('#run-tools-automation-btn');
    if (runBtn) {
      runBtn.addEventListener('click', () => {
        this.runAutomation();
      });
    }
    
    // View logs button
    const logsBtn = helpers.dom('#view-tools-automation-logs-btn');
    if (logsBtn) {
      logsBtn.addEventListener('click', () => {
        this.viewAutomationLogs();
      });
    }

    // Export to JSON button
    const exportBtn = helpers.dom('#export-tools-json-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportToJson();
      });
    }
  }
  
  /**
   * Show view
   */
  async show() {
    await this.loadTools();
    await this.loadAutomationStatus();
  }
  
  /**
   * Load tools from API
   */
  async loadTools() {
    try {
      const response = await window.api.get('/api/tools');
      
      if (response.success) {
        this.tools = response.tools || [];
        
        // Extract unique categories
        this.categories = [...new Set(this.tools.map(tool => tool.category).filter(Boolean))].sort();
        
        // Update category filter
        this.updateCategoryFilter();
        
        // Update stats
        this.updateStats();
        
        // Render table
        this.render();
      } else {
        throw new Error(response.error || 'Failed to load tools');
      }
    } catch (error) {
      console.error('[ToolsView] Error loading tools:', error);
      if (this.table) {
        this.table.innerHTML = `
          <tr>
            <td colspan="5" class="table-empty-state">Error loading tools: ${error.message}</td>
          </tr>
        `;
      }
    }
  }
  
  /**
   * Update category filter dropdown
   */
  updateCategoryFilter() {
    const filter = helpers.dom('#tools-category-filter-select');
    if (!filter) return;
    
    // Clear existing options except "All"
    filter.innerHTML = '<option value="all">All categories</option>';
    
    // Add categories
    this.categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      filter.appendChild(option);
    });
  }
  
  /**
   * Update stats
   */
  updateStats() {
    const totalTools = this.tools.length;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const toolsThisWeek = this.tools.filter(tool => {
      const added = tool.added ? new Date(tool.added) : (tool.createdAt ? new Date(tool.createdAt) : null);
      return added && added >= weekAgo;
    }).length;
    const autoAdded = this.tools.filter(tool => tool.source === 'automation').length;
    
    helpers.dom('#stat-total-tools').textContent = totalTools.toLocaleString();
    helpers.dom('#stat-tools-this-week').textContent = toolsThisWeek.toLocaleString();
    helpers.dom('#stat-tools-categories').textContent = this.categories.length.toLocaleString();
    helpers.dom('#stat-tools-auto-added').textContent = autoAdded.toLocaleString();
  }
  
  /**
   * Render tools table
   */
  render() {
    if (!this.table) return;
    
    // Filter tools
    let filtered = [...this.tools];
    
    // Filter by category
    if (this.currentCategory !== 'all') {
      filtered = filtered.filter(tool => tool.category === this.currentCategory);
    }
    
    // Filter by search
    const searchInput = helpers.dom('#tools-search-input');
    const searchTerm = searchInput?.value.toLowerCase().trim() || '';
    if (searchTerm) {
      filtered = filtered.filter(tool => 
        tool.name?.toLowerCase().includes(searchTerm) ||
        tool.description?.toLowerCase().includes(searchTerm) ||
        tool.category?.toLowerCase().includes(searchTerm)
      );
    }
    
    // Render
    if (filtered.length === 0) {
      this.table.innerHTML = `
        <tr>
          <td colspan="5" class="table-empty-state">No tools found</td>
        </tr>
      `;
      return;
    }
    
    this.table.innerHTML = filtered.map(tool => {
      const addedDate = tool.added ? new Date(tool.added).toLocaleDateString() : 
                       (tool.createdAt ? new Date(tool.createdAt).toLocaleDateString() : 'N/A');
      const source = tool.source === 'automation' ? 
        '<span class="badge badge-success">Auto</span>' : 
        '<span class="badge badge-info">Manual</span>';
      
      return `
        <tr>
          <td>
            <div class="tool-name">
              <strong>${helpers.escapeHtml(tool.name || 'Unknown')}</strong>
              ${tool.link ? `<a href="${helpers.escapeHtml(tool.link)}" target="_blank" rel="noopener noreferrer" class="tool-link">
                <i class="fas fa-external-link-alt"></i>
              </a>` : ''}
            </div>
            <small class="text-muted">${helpers.escapeHtml(tool.description || '')}</small>
          </td>
          <td>${helpers.escapeHtml(tool.category || 'N/A')}</td>
          <td>${source}</td>
          <td>${addedDate}</td>
          <td>
            <button class="btn-icon" title="View tool" onclick="window.toolsView?.viewTool('${tool.id || ''}')">
              <i class="fas fa-eye"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }
  
  /**
   * Load automation status
   */
  async loadAutomationStatus() {
    try {
      const status = await window.api.get('/api/tools/automation/status');
      
      if (status.success && status.status) {
        const lastStatus = status.status;
        const statusEl = helpers.dom('#tools-automation-status');
        const lastRunEl = helpers.dom('#tools-automation-last-run');
        const lastResultEl = helpers.dom('#tools-automation-last-result');
        
        if (statusEl) {
          statusEl.textContent = lastStatus.status === 'success' ? 'Active' : 
                                 lastStatus.status === 'error' ? 'Error' : 'Unknown';
          statusEl.className = `info-value ${lastStatus.status === 'success' ? 'text-success' : 
                                                      lastStatus.status === 'error' ? 'text-error' : 'text-muted'}`;
        }
        
        if (lastRunEl && lastStatus.completedAt) {
          const date = new Date(lastStatus.completedAt);
          lastRunEl.textContent = date.toLocaleString();
        }
        
        if (lastResultEl && lastStatus.result) {
          const result = lastStatus.result;
          if (result.results) {
            const { found = 0, created = 0, skipped = 0 } = result.results;
            lastResultEl.textContent = `Found: ${found}, Added: ${created}, Skipped: ${skipped}`;
          } else {
            lastResultEl.textContent = 'No results';
          }
        }
        
        // Calculate next run (7 days from last run)
        if (lastStatus.completedAt) {
          const nextRunEl = helpers.dom('#tools-automation-next-run');
          if (nextRunEl) {
            const lastRun = new Date(lastStatus.completedAt);
            const nextRun = new Date(lastRun.getTime() + 7 * 24 * 60 * 60 * 1000);
            nextRunEl.textContent = nextRun.toLocaleString();
          }
        }
      } else {
        const statusEl = helpers.dom('#tools-automation-status');
        if (statusEl) {
          statusEl.textContent = 'Not run yet';
          statusEl.className = 'info-value text-muted';
        }
      }
    } catch (error) {
      console.error('[ToolsView] Error loading automation status:', error);
      const statusEl = helpers.dom('#tools-automation-status');
      if (statusEl) {
        statusEl.textContent = 'Error';
        statusEl.className = 'info-value text-error';
      }
    }
  }
  
  /**
   * Run automation manually
   */
  async runAutomation() {
    const btn = helpers.dom('#run-tools-automation-btn');
    if (!btn) return;
    
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';
    
    try {
      const result = await window.api.post('/api/tools/automation/run', {});
      
      if (result.success) {
        alert('Tools automation completed successfully!');
        await this.loadAutomationStatus();
        await this.loadTools();
      } else {
        throw new Error(result.error || 'Automation failed');
      }
    } catch (error) {
      console.error('[ToolsView] Error running automation:', error);
      alert(`Error: ${error.message}`);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }
  
  /**
   * Export Firestore tools to tools/map/tools.json
   */
  async exportToJson() {
    const btn = helpers.dom('#export-tools-json-btn');
    if (!btn) return;

    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';

    try {
      const result = await window.api.post('/api/tools/export', {});

      if (result.success) {
        alert(`Tools exported successfully. ${result.count} tools written to tools/map/tools.json`);
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error) {
      console.error('[ToolsView] Error exporting tools:', error);
      alert(`Error: ${error.message}`);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }

  /**
   * View automation logs
   */
  async viewAutomationLogs() {
    try {
      const logs = await window.api.get('/api/automation/jobs/tools-finder/history?limit=10');
      
      if (logs.success) {
        const logsText = logs.history.map(log => {
          const date = new Date(log.completedAt || log.startedAt).toLocaleString();
          const status = log.status === 'success' ? '✅' : log.status === 'error' ? '❌' : '⏳';
          return `${status} ${date} - ${log.status}`;
        }).join('\n');
        
        alert(`Automation Logs:\n\n${logsText || 'No logs found'}`);
      }
    } catch (error) {
      console.error('[ToolsView] Error loading logs:', error);
      alert(`Error loading logs: ${error.message}`);
    }
  }
  
  /**
   * View tool details
   */
  viewTool(toolId) {
    const tool = this.tools.find(t => t.id === toolId);
    if (!tool) {
      alert('Tool not found');
      return;
    }
    
    const details = `
Name: ${tool.name}
Category: ${tool.category}
Description: ${tool.description}
Link: ${tool.link || 'N/A'}
Rating: ${tool.rating || 'N/A'}
Source: ${tool.source || 'manual'}
Added: ${tool.added || 'N/A'}
    `.trim();
    
    alert(details);
  }
}

// Make available globally for onclick handlers
window.toolsView = null;

