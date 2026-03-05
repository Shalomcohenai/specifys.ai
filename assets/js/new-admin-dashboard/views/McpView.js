/**
 * MCP View - MCP usage stats (keys, events, API usage by client and function)
 */

import { helpers } from '../utils/helpers.js';
import { apiService } from '../services/ApiService.js';

function setText(selector, value) {
  const el = helpers.dom(selector);
  if (el) el.textContent = value;
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

export class McpView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.stats = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.load();
  }

  setupEventListeners() {
    const refreshBtn = helpers.dom('#mcp-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.load());
    }
  }

  async load() {
    try {
      const response = await apiService.get('/api/admin/stats/mcp');
      if (response.success && response.data) {
        this.stats = response.data;
        this.render();
      } else {
        this.renderError();
      }
    } catch (error) {
      console.error('[McpView] Error loading MCP stats:', error);
      this.renderError();
    }
  }

  render() {
    const d = this.stats;
    setText('#mcp-stat-users-with-key', d.usersWithKey ?? '—');
    setText('#mcp-stat-modal-opens', d.events?.mcp_modal_open ?? '—');
    setText('#mcp-stat-page-views', d.events?.mcp_page_view ?? '—');
    const total = d.apiRequests?.total ?? 0;
    setText('#mcp-stat-api-requests', total);
    const byClient = d.apiRequests?.byClient ?? {};
    setText('#mcp-stat-cursor', byClient.cursor ?? 0);
    setText('#mcp-stat-claude', byClient.claude ?? 0);
    setText('#mcp-stat-unknown', byClient.unknown ?? 0);

    const tbody = helpers.dom('#mcp-top-functions-table tbody');
    if (tbody) {
      const top = d.apiRequests?.topFunctions ?? [];
      if (top.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" class="table-empty-state">No API calls in the last 30 days</td></tr>';
      } else {
        tbody.innerHTML = top
          .map(({ path, count }) => `<tr><td><code>${escapeHtml(path)}</code></td><td>${count}</td></tr>`)
          .join('');
      }
    }

    const usersWithKeyTbody = helpers.dom('#mcp-users-with-key-table tbody');
    if (usersWithKeyTbody) {
      const list = d.usersWithKeyList ?? [];
      if (list.length === 0) {
        usersWithKeyTbody.innerHTML = '<tr><td colspan="3" class="table-empty-state">No users with MCP API key</td></tr>';
      } else {
        usersWithKeyTbody.innerHTML = list
          .map(u => `<tr><td><code>${escapeHtml(u.userId)}</code></td><td>${escapeHtml(u.email || '—')}</td><td>${escapeHtml(u.displayName || '—')}</td></tr>`)
          .join('');
      }
    }
  }

  renderError() {
    setText('#mcp-stat-users-with-key', '—');
    setText('#mcp-stat-modal-opens', '—');
    setText('#mcp-stat-page-views', '—');
    setText('#mcp-stat-api-requests', '—');
    setText('#mcp-stat-cursor', '—');
    setText('#mcp-stat-claude', '—');
    setText('#mcp-stat-unknown', '—');
    const tbody = helpers.dom('#mcp-top-functions-table tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="2" class="table-empty-state">Error loading MCP stats</td></tr>';
    }
    const usersWithKeyTbody = helpers.dom('#mcp-users-with-key-table tbody');
    if (usersWithKeyTbody) {
      usersWithKeyTbody.innerHTML = '<tr><td colspan="3" class="table-empty-state">Error loading MCP stats</td></tr>';
    }
  }

  show() {
    if (!this.stats) this.load();
    else this.render();
  }

  update() {
    this.load();
  }
}
