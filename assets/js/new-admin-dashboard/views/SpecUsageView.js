/**
 * Spec Usage Analytics View
 * Shows detailed breakdown of which features users utilize for each spec
 */

import { helpers } from '../utils/helpers.js';

/** Column order aligned with spec viewer sections (diagrams are embedded, not a separate product). */
const FEATURE_COLUMNS = [
  { key: 'overview', label: 'Overview', abbr: 'Ov' },
  { key: 'technical', label: 'Technical', abbr: 'Tk' },
  { key: 'mindmap', label: 'Mind map', abbr: 'Mm' },
  { key: 'market', label: 'Market', abbr: 'Mk' },
  { key: 'design', label: 'Design', abbr: 'Ds' },
  { key: 'architecture', label: 'Architecture', abbr: 'Ar' },
  { key: 'visibility', label: 'AIO & SEO', abbr: 'Vs' },
  { key: 'prompts', label: 'Prompts', abbr: 'Pr' },
  { key: 'mockup', label: 'Mockup', abbr: 'Mu' },
  { key: 'chat', label: 'AI Chat', abbr: 'AI' },
  { key: 'brainDump', label: 'Brain dump', abbr: 'Bd' }
];

const TABLE_BODY_COLSPAN = 3 + FEATURE_COLUMNS.length + 1;

export class SpecUsageView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.range = 'week';
    this.searchTerm = '';

    this.init();
  }

  /**
   * Initialize view
   */
  init() {
    this.injectSpecUsageTableHead();
    this.setupEventListeners();
    this.setupSpecRowDownloadTable();
    this.setupDataSubscriptions();
  }

  /**
   * Two-line headers: full section name, abbrev below; hover shows full label (title on abbrev + row cells).
   */
  injectSpecUsageTableHead() {
    const thead = helpers.dom('#spec-usage-table thead');
    if (!thead || thead.dataset.specUsageHead === '1') {
      return;
    }
    thead.dataset.specUsageHead = '1';
    const featureThs = FEATURE_COLUMNS.map((col) => {
      const label = this.escapeHtml(col.label);
      const abbr = this.escapeHtml(col.abbr);
      return `<th class="feature-column" scope="col">
        <div class="spec-usage-feature-head">
          <span class="spec-usage-feature-head__title">${label}</span>
          <span class="spec-usage-feature-head__abbr" title="${label}">${abbr}</span>
        </div>
      </th>`;
    }).join('');
    thead.innerHTML = `<tr>
      <th class="spec-usage-col-spec" scope="col">Spec</th>
      <th class="spec-usage-col-user" scope="col">User</th>
      <th class="spec-usage-col-date" scope="col">Created</th>
      ${featureThs}
      <th class="spec-row-data-column" scope="col">
        <div class="spec-usage-feature-head">
          <span class="spec-usage-feature-head__title">Download</span>
          <span class="spec-usage-feature-head__abbr" title="Download full Firestore row (JSON)">DL</span>
        </div>
      </th>
    </tr>`;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const rangeSelect = helpers.dom('#spec-usage-range-select');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', (e) => {
        this.range = e.target.value;
        this.render();
      });
    }

    const searchInput = helpers.dom('#spec-usage-search-input');
    if (searchInput) {
      searchInput.addEventListener(
        'input',
        helpers.debounce((e) => {
          this.searchTerm = e.target.value.toLowerCase().trim();
          this.render();
        }, 300)
      );
    }
  }

  /**
   * Delegated clicks: download full Firestore row as JSON (admin research).
   */
  setupSpecRowDownloadTable() {
    const table = helpers.dom('#spec-usage-table');
    if (!table || table.dataset.rowDownloadBound === '1') {
      return;
    }
    table.dataset.rowDownloadBound = '1';
    table.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action="download-spec-row"]');
      if (!btn || !table.contains(btn)) {
        return;
      }
      e.preventDefault();
      const specId = btn.getAttribute('data-spec-id');
      if (!specId) {
        return;
      }
      const spec = this.dataManager.getAllData().specs.find((s) => s.id === specId);
      if (!spec) {
        window.alert('Spec not found in the current dashboard cache. Refresh the page or widen the date filter.');
        return;
      }
      this.downloadCompleteSpecRow(spec);
    });
  }

  serializeFirestoreFieldForDebug(v) {
    if (v == null) {
      return v;
    }
    if (typeof v.toDate === 'function') {
      try {
        return v.toDate().toISOString();
      } catch (err) {
        return String(v);
      }
    }
    if (typeof v === 'object' && typeof v._seconds === 'number') {
      return new Date(v._seconds * 1000).toISOString();
    }
    if (typeof v === 'object' && typeof v.seconds === 'number') {
      return new Date(v.seconds * 1000).toISOString();
    }
    return v;
  }

  serializeObjectForDebug(value) {
    if (Array.isArray(value)) {
      return value.map((item) => this.serializeObjectForDebug(item));
    }
    if (value && typeof value === 'object') {
      const maybeSerialized = this.serializeFirestoreFieldForDebug(value);
      if (typeof maybeSerialized !== 'object' || maybeSerialized == null) {
        return maybeSerialized;
      }
      const out = {};
      Object.keys(value).forEach((key) => {
        out[key] = this.serializeObjectForDebug(value[key]);
      });
      return out;
    }
    return this.serializeFirestoreFieldForDebug(value);
  }

  buildCompleteSpecRowPayload(spec) {
    const meta = spec.metadata && typeof spec.metadata === 'object' ? spec.metadata : {};
    const merged = { ...meta, id: spec.id };
    return this.serializeObjectForDebug(merged);
  }

  downloadCompleteSpecRow(spec) {
    const payload = this.buildCompleteSpecRowPayload(spec);
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().replace(/[:]/g, '-');
    link.href = url;
    link.download = `spec-row-${spec.id}-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Setup data subscriptions
   */
  setupDataSubscriptions() {
    this.dataManager.on('data', ({ source }) => {
      if (source === 'specs' || source === 'users') {
        this.render();
      }
    });
  }

  /**
   * Check if spec has feature (Firestore row is on spec.metadata).
   */
  hasFeature(spec, feature) {
    const specData = spec.metadata || {};
    const status = specData.status || {};

    switch (feature) {
      case 'overview':
        return !!(specData.overview && status.overview === 'ready');
      case 'technical':
        return !!(specData.technical && status.technical === 'ready');
      case 'market':
        return !!(specData.market && status.market === 'ready');
      case 'design':
        return !!(specData.design && status.design === 'ready');
      case 'architecture':
        return !!(specData.architecture && status.architecture === 'ready');
      case 'visibility':
        if (status.visibility !== 'ready') {
          return false;
        }
        {
          const v = specData.visibility;
          if (v == null) {
            return false;
          }
          if (typeof v === 'string') {
            return v.trim().length > 0;
          }
          if (typeof v === 'object') {
            return Object.keys(v).length > 0;
          }
          return Boolean(v);
        }
      case 'prompts':
        return !!(
          specData.prompts &&
          (Array.isArray(specData.prompts)
            ? specData.prompts.length > 0
            : typeof specData.prompts === 'object'
              ? Object.keys(specData.prompts).length > 0
              : false)
        );
      case 'mockup':
        if (status.mockup === 'ready') {
          return true;
        }
        return !!(
          specData.mockups &&
          (Array.isArray(specData.mockups)
            ? specData.mockups.length > 0
            : typeof specData.mockups === 'object'
              ? Object.keys(specData.mockups || {}).length > 0
              : false)
        );
      case 'mindmap': {
        const mm = specData.mindMap ?? specData.mindmap;
        if (mm == null) {
          return false;
        }
        if (typeof mm === 'string') {
          return mm.trim().length > 0;
        }
        if (typeof mm === 'object') {
          return Object.keys(mm).length > 0;
        }
        return Boolean(mm);
      }
      case 'chat':
        return !!(
          status.chat === 'ready' ||
          specData.openaiAssistantId ||
          specData.chatThreadId ||
          specData.openaiFileId
        );
      case 'brainDump':
        return !!(specData.brainDumpLastUsedAt);
      default:
        return false;
    }
  }

  /**
   * Calculate spec usage statistics
   */
  calculateStats(specs) {
    const stats = {
      overviewOnly: 0,
      overviewTechnical: 0,
      overviewTechnicalMarket: 0,
      withMindMap: 0,
      withDesign: 0,
      withArchitecture: 0,
      withVisibility: 0,
      withPrompts: 0,
      withMockup: 0,
      withAiChat: 0,
      withBrainDump: 0
    };

    specs.forEach((spec) => {
      const hasOverview = this.hasFeature(spec, 'overview');
      const hasTechnical = this.hasFeature(spec, 'technical');
      const hasMarket = this.hasFeature(spec, 'market');
      const hasDesign = this.hasFeature(spec, 'design');
      const hasMindmap = this.hasFeature(spec, 'mindmap');
      const hasPrompts = this.hasFeature(spec, 'prompts');
      const hasMockup = this.hasFeature(spec, 'mockup');
      const hasAiChat = this.hasFeature(spec, 'chat');
      const hasBrainDump = this.hasFeature(spec, 'brainDump');
      const hasArchitecture = this.hasFeature(spec, 'architecture');
      const hasVisibility = this.hasFeature(spec, 'visibility');

      if (hasOverview && !hasTechnical && !hasMarket) {
        stats.overviewOnly++;
      }
      if (hasOverview && hasTechnical && !hasMarket) {
        stats.overviewTechnical++;
      }
      if (hasOverview && hasTechnical && hasMarket) {
        stats.overviewTechnicalMarket++;
      }
      if (hasMindmap) {
        stats.withMindMap++;
      }
      if (hasDesign) {
        stats.withDesign++;
      }
      if (hasArchitecture) {
        stats.withArchitecture++;
      }
      if (hasVisibility) {
        stats.withVisibility++;
      }
      if (hasPrompts) {
        stats.withPrompts++;
      }
      if (hasMockup) {
        stats.withMockup++;
      }
      if (hasAiChat) {
        stats.withAiChat++;
      }
      if (hasBrainDump) {
        stats.withBrainDump++;
      }
    });

    return stats;
  }

  /**
   * Filter specs by range and search
   */
  filterSpecs(specs) {
    let filtered = specs;

    if (this.range !== 'all') {
      const now = Date.now();
      const days = this.range === 'week' ? 7 : 30;
      const threshold = now - days * 24 * 60 * 60 * 1000;

      filtered = filtered.filter((spec) => {
        if (!spec.createdAt) {
          return false;
        }
        const created = spec.createdAt instanceof Date ? spec.createdAt.getTime() : new Date(spec.createdAt).getTime();
        return created >= threshold;
      });
    }

    if (this.searchTerm) {
      const allData = this.dataManager.getAllData();
      filtered = filtered.filter((spec) => {
        const user = allData.users.find((u) => u.id === spec.userId);
        const specTitle = (spec.title || '').toLowerCase();
        const userEmail = (user?.email || '').toLowerCase();
        const userName = (user?.displayName || '').toLowerCase();
        return (
          specTitle.includes(this.searchTerm) ||
          userEmail.includes(this.searchTerm) ||
          userName.includes(this.searchTerm)
        );
      });
    }

    return filtered;
  }

  /**
   * Render summary statistics
   */
  renderSummary(stats) {
    const set = (id, value) => {
      const el = helpers.dom(id);
      if (el) {
        el.textContent = value.toLocaleString();
      }
    };
    set('#spec-usage-overview-only', stats.overviewOnly);
    set('#spec-usage-overview-technical', stats.overviewTechnical);
    set('#spec-usage-overview-technical-market', stats.overviewTechnicalMarket);
    set('#spec-usage-with-mind-map', stats.withMindMap);
    set('#spec-usage-with-design', stats.withDesign);
    set('#spec-usage-with-architecture', stats.withArchitecture);
    set('#spec-usage-with-visibility', stats.withVisibility);
    set('#spec-usage-with-prompts', stats.withPrompts);
    set('#spec-usage-with-mockup', stats.withMockup);
    set('#spec-usage-with-aichat', stats.withAiChat);
    set('#spec-usage-with-brain-dump', stats.withBrainDump);
  }

  /**
   * Short numeric date for compact table (e.g. 5/12/26).
   */
  formatShortCreated(date) {
    if (!date) {
      return '—';
    }
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) {
      return '—';
    }
    return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
  }

  /**
   * Render table
   */
  renderTable(specs) {
    const tbody = helpers.dom('#spec-usage-table tbody');
    if (!tbody) {
      return;
    }

    if (specs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${TABLE_BODY_COLSPAN}" class="table-empty-state">No specs found for selected criteria.</td></tr>`;
      return;
    }

    specs.sort((a, b) => {
      const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
      const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
      return timeB - timeA;
    });

    const allData = this.dataManager.getAllData();
    const html = specs
      .map((spec) => {
        const user = allData.users.find((u) => u.id === spec.userId);
        const userInfo = user?.email || user?.displayName || spec.userId || 'Unknown';

        const cellsHtml = FEATURE_COLUMNS.map((col) => {
          const active = this.hasFeature(spec, col.key);
          const label = this.escapeHtml(col.label);
          return `<td class="feature-cell">
            <span class="feature-indicator ${active ? 'active' : ''}" title="${label}">
              <i class="fas fa-${active ? 'check' : 'circle'}" aria-hidden="true"></i>
            </span>
          </td>`;
        }).join('');

        return `
        <tr>
          <td class="spec-usage-col-spec">
            <div class="user-name">${this.escapeHtml(spec.title || 'Untitled Spec')}</div>
          </td>
          <td class="spec-usage-col-user">
            <div class="user-email">${this.escapeHtml(userInfo)}</div>
          </td>
          <td class="spec-usage-col-date">${this.formatShortCreated(spec.createdAt)}</td>
          ${cellsHtml}
          <td class="spec-row-data-cell">
            <button type="button" class="btn-spec-row-download" data-action="download-spec-row" data-spec-id="${this.escapeHtml(String(spec.id))}" title="Download full Firestore row (JSON)" aria-label="Download full Firestore row as JSON">
              <i class="fas fa-file-download" aria-hidden="true"></i>
            </button>
          </td>
        </tr>
      `;
      })
      .join('');

    tbody.innerHTML = html;
  }

  /**
   * Render view
   */
  render() {
    const allData = this.dataManager.getAllData();
    const filteredSpecs = this.filterSpecs(allData.specs);

    const stats = this.calculateStats(filteredSpecs);
    this.renderSummary(stats);

    this.renderTable(filteredSpecs);
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    if (!text) {
      return '';
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show view
   */
  show() {
    this.injectSpecUsageTableHead();
    this.render();
  }

  /**
   * Hide view
   */
  hide() {
    // Cleanup if needed
  }
}
