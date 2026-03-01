/**
 * Spec Usage Analytics View
 * Shows detailed breakdown of which features users utilize for each spec
 */

import { helpers } from '../utils/helpers.js';

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
    this.setupEventListeners();
    this.setupDataSubscriptions();
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Range select
    const rangeSelect = helpers.dom('#spec-usage-range-select');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', (e) => {
        this.range = e.target.value;
        this.render();
      });
    }
    
    // Search input
    const searchInput = helpers.dom('#spec-usage-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', helpers.debounce((e) => {
        this.searchTerm = e.target.value.toLowerCase().trim();
        this.render();
      }, 300));
    }
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
   * Check if spec has feature
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
      case 'diagrams':
        return !!(specData.diagrams?.generated === true);
      case 'prompts':
        return !!(specData.prompts && (
          Array.isArray(specData.prompts) ? specData.prompts.length > 0 :
          typeof specData.prompts === 'object' ? Object.keys(specData.prompts).length > 0 :
          false
        ));
      case 'mockups':
        return !!(specData.mockups && (
          Array.isArray(specData.mockups) ? specData.mockups.length > 0 :
          typeof specData.mockups === 'object' ? Object.keys(specData.mockups || {}).length > 0 :
          false
        ));
      case 'aichat':
        return !!(specData.openaiAssistantId || specData.chatThreadId || specData.openaiFileId);
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
      withDiagrams: 0,
      withDesign: 0,
      withPrompts: 0,
      withMockups: 0,
      withAiChat: 0,
      withBrainDump: 0
    };
    
    specs.forEach(spec => {
      const hasOverview = this.hasFeature(spec, 'overview');
      const hasTechnical = this.hasFeature(spec, 'technical');
      const hasMarket = this.hasFeature(spec, 'market');
      const hasDesign = this.hasFeature(spec, 'design');
      const hasDiagrams = this.hasFeature(spec, 'diagrams');
      const hasPrompts = this.hasFeature(spec, 'prompts');
      const hasMockups = this.hasFeature(spec, 'mockups');
      const hasAiChat = this.hasFeature(spec, 'aichat');
      const hasBrainDump = this.hasFeature(spec, 'brainDump');
      
      if (hasOverview && !hasTechnical && !hasMarket) {
        stats.overviewOnly++;
      }
      if (hasOverview && hasTechnical && !hasMarket) {
        stats.overviewTechnical++;
      }
      if (hasOverview && hasTechnical && hasMarket) {
        stats.overviewTechnicalMarket++;
      }
      if (hasDiagrams) {
        stats.withDiagrams++;
      }
      if (hasDesign) {
        stats.withDesign++;
      }
      if (hasPrompts) {
        stats.withPrompts++;
      }
      if (hasMockups) {
        stats.withMockups++;
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
    
    // Filter by date range
    if (this.range !== 'all') {
      const now = Date.now();
      const days = this.range === 'week' ? 7 : 30;
      const threshold = now - (days * 24 * 60 * 60 * 1000);
      
      filtered = filtered.filter(spec => {
        if (!spec.createdAt) return false;
        const created = spec.createdAt instanceof Date ? spec.createdAt.getTime() : new Date(spec.createdAt).getTime();
        return created >= threshold;
      });
    }
    
    // Filter by search term
    if (this.searchTerm) {
      const allData = this.dataManager.getAllData();
      filtered = filtered.filter(spec => {
        const user = allData.users.find(u => u.id === spec.userId);
        const specTitle = (spec.title || '').toLowerCase();
        const userEmail = (user?.email || '').toLowerCase();
        const userName = (user?.displayName || '').toLowerCase();
        return specTitle.includes(this.searchTerm) || 
               userEmail.includes(this.searchTerm) || 
               userName.includes(this.searchTerm);
      });
    }
    
    return filtered;
  }
  
  /**
   * Render summary statistics
   */
  renderSummary(stats) {
    helpers.dom('#spec-usage-overview-only').textContent = stats.overviewOnly.toLocaleString();
    helpers.dom('#spec-usage-overview-technical').textContent = stats.overviewTechnical.toLocaleString();
    helpers.dom('#spec-usage-overview-technical-market').textContent = stats.overviewTechnicalMarket.toLocaleString();
    helpers.dom('#spec-usage-with-diagrams').textContent = stats.withDiagrams.toLocaleString();
    helpers.dom('#spec-usage-with-design').textContent = stats.withDesign.toLocaleString();
    helpers.dom('#spec-usage-with-prompts').textContent = stats.withPrompts.toLocaleString();
    helpers.dom('#spec-usage-with-mockups').textContent = stats.withMockups.toLocaleString();
    helpers.dom('#spec-usage-with-aichat').textContent = stats.withAiChat.toLocaleString();
    const brainDumpEl = helpers.dom('#spec-usage-with-brain-dump');
    if (brainDumpEl) brainDumpEl.textContent = stats.withBrainDump.toLocaleString();
  }
  
  /**
   * Render table
   */
  renderTable(specs) {
    const tbody = helpers.dom('#spec-usage-table tbody');
    if (!tbody) return;
    
    if (specs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" class="table-empty-state">No specs found for selected criteria.</td></tr>';
      return;
    }
    
    // Sort by creation date (newest first)
    specs.sort((a, b) => {
      const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
      const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
      return timeB - timeA;
    });
    
    const allData = this.dataManager.getAllData();
    const html = specs.map(spec => {
      const user = allData.users.find(u => u.id === spec.userId);
      const userInfo = user?.email || user?.displayName || spec.userId || 'Unknown';
      
      const hasOverview = this.hasFeature(spec, 'overview');
      const hasTechnical = this.hasFeature(spec, 'technical');
      const hasMarket = this.hasFeature(spec, 'market');
      const hasDesign = this.hasFeature(spec, 'design');
      const hasDiagrams = this.hasFeature(spec, 'diagrams');
      const hasPrompts = this.hasFeature(spec, 'prompts');
      const hasMockups = this.hasFeature(spec, 'mockups');
      const hasAiChat = this.hasFeature(spec, 'aichat');
      const hasBrainDump = this.hasFeature(spec, 'brainDump');
      
      return `
        <tr>
          <td>
            <div class="user-name">${this.escapeHtml(spec.title || 'Untitled Spec')}</div>
          </td>
          <td>
            <div class="user-email">${this.escapeHtml(userInfo)}</div>
          </td>
          <td>${helpers.formatDate(spec.createdAt)}</td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasOverview ? 'active' : ''}" title="Overview">
              <i class="fas fa-${hasOverview ? 'check-circle' : 'circle'}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasTechnical ? 'active' : ''}" title="Technical">
              <i class="fas fa-${hasTechnical ? 'check-circle' : 'circle'}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasMarket ? 'active' : ''}" title="Market Research">
              <i class="fas fa-${hasMarket ? 'check-circle' : 'circle'}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasDesign ? 'active' : ''}" title="Design">
              <i class="fas fa-${hasDesign ? 'check-circle' : 'circle'}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasDiagrams ? 'active' : ''}" title="Diagrams">
              <i class="fas fa-${hasDiagrams ? 'check-circle' : 'circle'}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasPrompts ? 'active' : ''}" title="Prompts">
              <i class="fas fa-${hasPrompts ? 'check-circle' : 'circle'}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasMockups ? 'active' : ''}" title="Mockups">
              <i class="fas fa-${hasMockups ? 'check-circle' : 'circle'}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasAiChat ? 'active' : ''}" title="AI Chat">
              <i class="fas fa-${hasAiChat ? 'check-circle' : 'circle'}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasBrainDump ? 'active' : ''}" title="Brain Dump">
              <i class="fas fa-${hasBrainDump ? 'check-circle' : 'circle'}"></i>
            </span>
          </td>
        </tr>
      `;
    }).join('');
    
    tbody.innerHTML = html;
  }
  
  /**
   * Render view
   */
  render() {
    const allData = this.dataManager.getAllData();
    const filteredSpecs = this.filterSpecs(allData.specs);
    
    // Calculate and render statistics
    const stats = this.calculateStats(filteredSpecs);
    this.renderSummary(stats);
    
    // Render table
    this.renderTable(filteredSpecs);
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
  
  /**
   * Show view
   */
  show() {
    this.render();
  }
  
  /**
   * Hide view
   */
  hide() {
    // Cleanup if needed
  }
}




