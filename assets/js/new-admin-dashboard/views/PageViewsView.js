/**
 * Page Views View
 *
 * Shows the contents of the Firestore `page_views` collection with:
 *  - Recent table (page URL, username, referrer) - filterable + paginated
 *  - Top Pages aggregate (count, unique users, last seen)
 *  - Top Referrers aggregate (count, unique users, last seen)
 *
 * Backed by:
 *  - GET /api/admin/analytics/page-views
 *  - GET /api/admin/analytics/page-views/by-page
 *  - GET /api/admin/analytics/page-views/by-referrer
 */

import { helpers } from '../utils/helpers.js';
import { apiService } from '../services/ApiService.js';

const SUB_TABS = ['recent', 'by-page', 'by-referrer'];

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(value);
  return div.innerHTML;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function shorten(value, max = 60) {
  if (!value) return '';
  const str = String(value);
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}…`;
}

function rangeDaysToFromISO(value) {
  if (value === 'all' || value === undefined || value === null || value === '') return null;
  const days = parseInt(value, 10);
  if (!Number.isFinite(days) || days <= 0) return null;
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return from.toISOString();
}

export class PageViewsView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;

    this.state = {
      activeTab: 'recent',
      loading: false,
      filters: {
        pageContains: '',
        username: '',
        referrer: '',
        sort: 'recent',
        rangeDays: '7'
      },
      recent: {
        rows: [],
        nextCursor: null,
        loadedCount: 0
      },
      byPage: {
        rows: []
      },
      byReferrer: {
        rows: []
      }
    };

    this._initialized = false;
    this._initialLoadDone = false;
  }

  /**
   * Lazy init - wires DOM event listeners on first show().
   */
  initOnce() {
    if (this._initialized) return;
    this._initialized = true;

    const rangeSelect = helpers.dom('#page-views-range-select');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', (e) => {
        this.state.filters.rangeDays = e.target.value;
        this.reloadAll();
      });
    }

    const refreshBtn = helpers.dom('#page-views-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.reloadAll());
    }

    helpers.domAll('.page-views-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.pvTab;
        if (!tabName || !SUB_TABS.includes(tabName)) return;
        this.setActiveTab(tabName);
      });
    });

    const sortSelect = helpers.dom('#page-views-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.state.filters.sort = e.target.value === 'oldest' ? 'oldest' : 'recent';
        if (this.state.activeTab === 'recent') this.loadRecent({ reset: true });
      });
    }

    const applyBtn = helpers.dom('#page-views-apply-filters-btn');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => this.applyFilters());
    }

    const clearBtn = helpers.dom('#page-views-clear-filters-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearFilters());
    }

    ['#page-views-filter-page', '#page-views-filter-username', '#page-views-filter-referrer'].forEach((sel) => {
      const input = helpers.dom(sel);
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.applyFilters();
        });
      }
    });

    const loadMoreBtn = helpers.dom('#page-views-load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => this.loadRecent({ reset: false }));
    }
  }

  /**
   * Switch the visible sub-tab and lazy-load its data.
   */
  setActiveTab(tabName) {
    if (!SUB_TABS.includes(tabName)) return;
    this.state.activeTab = tabName;

    helpers.domAll('.page-views-tab').forEach((tab) => {
      const isActive = tab.dataset.pvTab === tabName;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    helpers.domAll('.page-views-tab-content').forEach((content) => {
      const isActive = content.dataset.pvTabContent === tabName;
      content.classList.toggle('active', isActive);
      content.style.display = isActive ? '' : 'none';
    });

    const sortSelect = helpers.dom('#page-views-sort-select');
    if (sortSelect) {
      sortSelect.disabled = tabName !== 'recent';
      sortSelect.title = tabName === 'recent'
        ? 'Sort order'
        : 'Sort only applies to Recent tab';
    }

    if (tabName === 'recent' && this.state.recent.rows.length === 0) {
      this.loadRecent({ reset: true });
    } else if (tabName === 'by-page' && this.state.byPage.rows.length === 0) {
      this.loadByPage();
    } else if (tabName === 'by-referrer' && this.state.byReferrer.rows.length === 0) {
      this.loadByReferrer();
    }
  }

  applyFilters() {
    this.state.filters.pageContains = (helpers.dom('#page-views-filter-page')?.value || '').trim();
    this.state.filters.username = (helpers.dom('#page-views-filter-username')?.value || '').trim();
    this.state.filters.referrer = (helpers.dom('#page-views-filter-referrer')?.value || '').trim();

    if (this.state.activeTab === 'recent') {
      this.loadRecent({ reset: true });
    } else {
      this.reloadAll();
    }
  }

  clearFilters() {
    ['#page-views-filter-page', '#page-views-filter-username', '#page-views-filter-referrer'].forEach((sel) => {
      const input = helpers.dom(sel);
      if (input) input.value = '';
    });
    this.state.filters.pageContains = '';
    this.state.filters.username = '';
    this.state.filters.referrer = '';
    this.applyFilters();
  }

  buildCommonQuery() {
    const params = new URLSearchParams();
    const fromIso = rangeDaysToFromISO(this.state.filters.rangeDays);
    if (fromIso) params.set('from', fromIso);
    return params;
  }

  /**
   * Load the Recent paginated list with current filters.
   */
  async loadRecent({ reset = true } = {}) {
    const tbody = helpers.dom('#page-views-recent-table tbody');
    const loadMoreBtn = helpers.dom('#page-views-load-more-btn');
    const loadedCount = helpers.dom('#page-views-loaded-count');

    if (reset) {
      this.state.recent.rows = [];
      this.state.recent.nextCursor = null;
      this.state.recent.loadedCount = 0;
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" class="table-empty-state">Loading page views…</td></tr>';
      }
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      if (loadedCount) loadedCount.textContent = '';
    } else if (loadMoreBtn) {
      loadMoreBtn.disabled = true;
      const span = loadMoreBtn.querySelector('span');
      if (span) span.textContent = 'Loading…';
    }

    try {
      const params = this.buildCommonQuery();
      params.set('sort', this.state.filters.sort);
      params.set('limit', '50');
      if (this.state.filters.pageContains) params.set('pageContains', this.state.filters.pageContains);
      if (this.state.filters.username) params.set('username', this.state.filters.username);
      if (this.state.filters.referrer) params.set('referrer', this.state.filters.referrer);
      if (!reset && this.state.recent.nextCursor) {
        params.set('cursor', this.state.recent.nextCursor);
      }

      const response = await apiService.get(`/api/admin/analytics/page-views?${params.toString()}`);
      const rows = Array.isArray(response.rows) ? response.rows : [];

      if (reset) {
        this.state.recent.rows = rows;
      } else {
        this.state.recent.rows = this.state.recent.rows.concat(rows);
      }
      this.state.recent.nextCursor = response.nextCursor || null;
      this.state.recent.loadedCount = this.state.recent.rows.length;

      this.renderRecent();
      this.updateQuickStats(rows, reset);
    } catch (error) {
      console.error('[PageViewsView] loadRecent error:', error);
      if (reset && tbody) {
        tbody.innerHTML = '<tr><td colspan="5" class="table-empty-state">Error loading page views.</td></tr>';
      }
    } finally {
      if (loadMoreBtn) {
        loadMoreBtn.disabled = false;
        const span = loadMoreBtn.querySelector('span');
        if (span) span.textContent = 'Load more';
      }
    }
  }

  renderRecent() {
    const tbody = helpers.dom('#page-views-recent-table tbody');
    const loadMoreBtn = helpers.dom('#page-views-load-more-btn');
    const loadedCount = helpers.dom('#page-views-loaded-count');

    if (!tbody) return;

    const rows = this.state.recent.rows;
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty-state">No page views match your filters.</td></tr>';
    } else {
      tbody.innerHTML = rows.map((row) => {
        const pageDisplay = row.pagePath || row.page || '—';
        const pageTitle = row.pageTitle ? ` (${escapeHtml(shorten(row.pageTitle, 80))})` : '';
        const pageHref = row.pagePath || (row.page && row.page.startsWith('/') ? row.page : null);
        const pageCell = pageHref
          ? `<a href="${escapeHtml(pageHref)}" target="_blank" rel="noopener noreferrer" class="page-views-link" title="${escapeHtml(pageDisplay)}">${escapeHtml(shorten(pageDisplay, 80))}</a>${pageTitle ? `<span class="page-views-subtle">${pageTitle}</span>` : ''}`
          : `<span title="${escapeHtml(pageDisplay)}">${escapeHtml(shorten(pageDisplay, 80))}</span>${pageTitle ? `<span class="page-views-subtle">${pageTitle}</span>` : ''}`;

        const userCell = row.userId
          ? `<div class="page-views-user-cell"><span class="page-views-user-name">${escapeHtml(row.username || row.userId)}</span>${row.email ? `<span class="page-views-subtle">${escapeHtml(row.email)}</span>` : ''}</div>`
          : `<span class="page-views-subtle">(anonymous)</span>`;

        const referrerCell = row.referrer
          ? `<a href="${escapeHtml(row.referrer)}" target="_blank" rel="noopener noreferrer" class="page-views-link" title="${escapeHtml(row.referrer)}">${escapeHtml(shorten(row.referrer, 80))}</a>`
          : `<span class="page-views-subtle">(direct)</span>`;

        const deviceCell = row.device ? escapeHtml(row.device) : '<span class="page-views-subtle">—</span>';

        return `
          <tr>
            <td>${escapeHtml(formatDateTime(row.viewedAt))}</td>
            <td>${pageCell}</td>
            <td>${userCell}</td>
            <td>${referrerCell}</td>
            <td>${deviceCell}</td>
          </tr>
        `;
      }).join('');
    }

    if (loadMoreBtn) {
      loadMoreBtn.style.display = this.state.recent.nextCursor ? '' : 'none';
    }
    if (loadedCount) {
      const total = this.state.recent.loadedCount;
      loadedCount.textContent = total > 0
        ? `Showing ${helpers.formatNumber(total)} record${total === 1 ? '' : 's'}`
        : '';
    }
  }

  /**
   * Load the Top Pages aggregate.
   */
  async loadByPage() {
    const tbody = helpers.dom('#page-views-by-page-table tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-empty-state">Loading top pages…</td></tr>';
    }
    try {
      const params = this.buildCommonQuery();
      params.set('limit', '100');
      params.set('groupBy', 'pagePath');
      const response = await apiService.get(`/api/admin/analytics/page-views/by-page?${params.toString()}`);
      this.state.byPage.rows = Array.isArray(response.rows) ? response.rows : [];
      this.renderByPage();
    } catch (error) {
      console.error('[PageViewsView] loadByPage error:', error);
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="4" class="table-empty-state">Error loading top pages.</td></tr>';
      }
    }
  }

  renderByPage() {
    const tbody = helpers.dom('#page-views-by-page-table tbody');
    if (!tbody) return;
    const rows = this.state.byPage.rows;
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-empty-state">No page views in this range.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((row) => {
      const key = row.key || '(unknown)';
      const pageHref = key.startsWith('/') ? key : null;
      const pageCell = pageHref
        ? `<a href="${escapeHtml(pageHref)}" target="_blank" rel="noopener noreferrer" class="page-views-link" title="${escapeHtml(key)}">${escapeHtml(shorten(key, 100))}</a>`
        : `<span title="${escapeHtml(key)}">${escapeHtml(shorten(key, 100))}</span>`;
      return `
        <tr>
          <td>${pageCell}</td>
          <td>${helpers.formatNumber(row.count || 0)}</td>
          <td>${helpers.formatNumber(row.uniqueUsers || 0)}</td>
          <td>${escapeHtml(formatDateTime(row.lastSeen))}</td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Load the Top Referrers aggregate.
   */
  async loadByReferrer() {
    const tbody = helpers.dom('#page-views-by-referrer-table tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-empty-state">Loading top referrers…</td></tr>';
    }
    try {
      const params = this.buildCommonQuery();
      params.set('limit', '100');
      const response = await apiService.get(`/api/admin/analytics/page-views/by-referrer?${params.toString()}`);
      this.state.byReferrer.rows = Array.isArray(response.rows) ? response.rows : [];
      this.renderByReferrer();
    } catch (error) {
      console.error('[PageViewsView] loadByReferrer error:', error);
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="4" class="table-empty-state">Error loading top referrers.</td></tr>';
      }
    }
  }

  renderByReferrer() {
    const tbody = helpers.dom('#page-views-by-referrer-table tbody');
    if (!tbody) return;
    const rows = this.state.byReferrer.rows;
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-empty-state">No referrers in this range.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((row) => {
      const key = row.key || '(direct)';
      const isUrl = /^https?:\/\//i.test(key);
      const refCell = isUrl
        ? `<a href="${escapeHtml(key)}" target="_blank" rel="noopener noreferrer" class="page-views-link" title="${escapeHtml(key)}">${escapeHtml(shorten(key, 100))}</a>`
        : `<span class="page-views-subtle" title="${escapeHtml(key)}">${escapeHtml(shorten(key, 100))}</span>`;
      return `
        <tr>
          <td>${refCell}</td>
          <td>${helpers.formatNumber(row.count || 0)}</td>
          <td>${helpers.formatNumber(row.uniqueUsers || 0)}</td>
          <td>${escapeHtml(formatDateTime(row.lastSeen))}</td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Refresh derived stats based on aggregate endpoints (so they cover the whole window,
   * not just the current Recent slice).
   */
  async loadQuickStats() {
    try {
      const params = this.buildCommonQuery();
      params.set('limit', '500');
      params.set('groupBy', 'pagePath');
      const [byPage, byRef] = await Promise.all([
        apiService.get(`/api/admin/analytics/page-views/by-page?${params.toString()}`),
        apiService.get(`/api/admin/analytics/page-views/by-referrer?${params.toString()}`)
      ]);

      const pageRows = Array.isArray(byPage.rows) ? byPage.rows : [];
      const refRows = Array.isArray(byRef.rows) ? byRef.rows : [];

      const totalViews = pageRows.reduce((acc, r) => acc + (r.count || 0), 0);
      const uniquePages = pageRows.length;
      const uniqueRefs = refRows.length;
      const uniqueUsers = pageRows.reduce((acc, r) => Math.max(acc, r.uniqueUsers || 0), 0);

      const setStat = (id, value) => {
        const el = helpers.dom(id);
        if (el) el.textContent = helpers.formatNumber(value || 0);
      };
      setStat('#page-views-stat-total', totalViews);
      setStat('#page-views-stat-unique-pages', uniquePages);
      setStat('#page-views-stat-unique-users', uniqueUsers);
      setStat('#page-views-stat-unique-referrers', uniqueRefs);

      if (byPage.truncated) {
        const el = helpers.dom('#page-views-stat-total');
        if (el) el.title = `Showing aggregates over the most recent ${helpers.formatNumber(byPage.scanned || 0)} records (window truncated). Narrow the date range for an exact count.`;
      }
    } catch (error) {
      console.error('[PageViewsView] loadQuickStats error:', error);
    }
  }

  /**
   * Fallback update for stats from currently-loaded recent rows (used while aggregates load).
   */
  updateQuickStats(_rows, _reset) {
    // Aggregate stats come from loadQuickStats(); this is intentionally a no-op
    // to avoid showing misleading partial counts from a single page of recent rows.
  }

  /**
   * Reload everything for the current tab + stats.
   */
  reloadAll() {
    this.loadQuickStats();
    if (this.state.activeTab === 'recent') {
      this.loadRecent({ reset: true });
    } else if (this.state.activeTab === 'by-page') {
      this.loadByPage();
    } else if (this.state.activeTab === 'by-referrer') {
      this.loadByReferrer();
    }
    // Invalidate cached rows for non-active tabs so they reload when shown
    if (this.state.activeTab !== 'by-page') this.state.byPage.rows = [];
    if (this.state.activeTab !== 'by-referrer') this.state.byReferrer.rows = [];
    if (this.state.activeTab !== 'recent') {
      this.state.recent.rows = [];
      this.state.recent.nextCursor = null;
    }
  }

  /**
   * Called by main.js when this section becomes active.
   */
  show() {
    this.initOnce();
    if (!this._initialLoadDone) {
      this._initialLoadDone = true;
      this.loadQuickStats();
      this.loadRecent({ reset: true });
    }
  }

  /**
   * Called by main.js after data refreshes.
   */
  update() {
    // No-op: this view fetches on demand via show() / refresh button.
  }
}
