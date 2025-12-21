/**
 * Academy View - Academy guides management and view tracking
 * Shows guides from academy_guides collection with view statistics
 */

import { helpers } from '../utils/helpers.js';
import { firebaseService } from '../core/FirebaseService.js';

export class AcademyView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.table = null;
    this.guides = [];
    
    this.init();
  }
  
  /**
   * Initialize view
   */
  init() {
    this.table = helpers.dom('#academy-table tbody');
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Don't load guides automatically - wait for show() to be called
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Search
    const searchInput = helpers.dom('#academy-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', helpers.debounce(() => {
        this.render();
      }, 300));
    }
    
    // Refresh button
    const refreshBtn = helpers.dom('#refresh-academy-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadGuides();
      });
    }
  }
  
  /**
   * Load guides from Firebase
   */
  async loadGuides() {
    if (!this.table) return;
    
    this.table.innerHTML = '<tr><td colspan="5" class="table-empty-state">Loading guides...</td></tr>';
    
    try {
      const db = firebaseService.getDb();
      if (!db) {
        throw new Error('Firebase not initialized');
      }
      
      const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const guidesSnapshot = await getDocs(collection(db, 'academy_guides'));
      
      console.log('[AcademyView] Loaded guides count:', guidesSnapshot.docs.length);
      
      this.guides = guidesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || 'Untitled Guide',
          category: data.category || 'General',
          views: data.views || 0,
          createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : new Date(),
          slug: data.slug || doc.id,
          description: data.description || ''
        };
      });
      
      console.log('[AcademyView] Processed guides:', this.guides.length);
      this.updateSummary();
      this.render();
    } catch (error) {
      console.error('[AcademyView] Error loading guides:', error);
      this.table.innerHTML = '<tr><td colspan="5" class="table-empty-state">Error loading guides</td></tr>';
    }
  }
  
  /**
   * Update summary stats
   */
  updateSummary() {
    const totalGuides = this.guides.length;
    const totalViews = this.guides.reduce((sum, g) => sum + (g.views || 0), 0);
    
    // Calculate views in last 7 days (we'll use total views as approximation)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const views7d = this.guides
      .filter(g => g.createdAt && g.createdAt.getTime() >= sevenDaysAgo)
      .reduce((sum, g) => sum + (g.views || 0), 0);
    
    // Find top guide
    const topGuide = this.guides.length > 0
      ? this.guides.reduce((top, guide) => (guide.views || 0) > (top.views || 0) ? guide : top)
      : null;
    
    this.updateSummaryValue('stat-total-guides', totalGuides);
    this.updateSummaryValue('stat-guides-views', totalViews);
    this.updateSummaryValue('stat-guides-views-7d', views7d);
    
    const topGuideEl = helpers.dom('#stat-top-guide');
    if (topGuideEl) {
      topGuideEl.textContent = topGuide ? (topGuide.title.length > 20 ? topGuide.title.substring(0, 20) + '...' : topGuide.title) : '—';
    }
  }
  
  /**
   * Update summary value
   */
  updateSummaryValue(id, value) {
    const element = helpers.dom(`#${id}`);
    if (element) {
      element.textContent = typeof value === 'number' ? value.toLocaleString() : value;
    }
  }
  
  /**
   * Render guides table
   */
  render() {
    if (!this.table) {
      console.warn('[AcademyView] Table element not found');
      return;
    }
    
    console.log('[AcademyView] Rendering', this.guides.length, 'guides');
    
    // Apply search filter
    let filteredGuides = [...this.guides];
    
    const searchInput = helpers.dom('#academy-search-input');
    const searchTerm = searchInput?.value.trim().toLowerCase() || '';
    if (searchTerm) {
      filteredGuides = filteredGuides.filter(guide => {
        const haystack = `${guide.title} ${guide.description} ${guide.category}`.toLowerCase();
        return haystack.includes(searchTerm);
      });
    }
    
    // Sort by views (highest first)
    filteredGuides.sort((a, b) => (b.views || 0) - (a.views || 0));
    
    if (filteredGuides.length === 0) {
      this.table.innerHTML = '<tr><td colspan="5" class="table-empty-state">No guides found</td></tr>';
      return;
    }
    
    // Render table
    const html = filteredGuides.map(guide => {
      return `
        <tr>
          <td>
            <div class="user-info">
              <div class="user-name">${this.escapeHtml(guide.title)}</div>
              ${guide.description ? `<div class="user-email">${this.escapeHtml(guide.description.substring(0, 60))}${guide.description.length > 60 ? '...' : ''}</div>` : ''}
            </div>
          </td>
          <td><span class="plan-badge plan-free">${this.escapeHtml(guide.category)}</span></td>
          <td><strong>${(guide.views || 0).toLocaleString()}</strong></td>
          <td>${helpers.formatDate(guide.createdAt)}</td>
          <td>
            <div class="action-buttons">
              <a href="/academy/${guide.slug}.html" target="_blank" class="action-btn small" title="View guide">
                <i class="fas fa-external-link-alt"></i>
              </a>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
    this.table.innerHTML = html;
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
    console.log('[AcademyView] Showing view, loading guides...');
    if (!this.table) {
      this.table = helpers.dom('#academy-table tbody');
    }
    this.loadGuides();
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
    this.loadGuides();
  }
}

