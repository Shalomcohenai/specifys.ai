/**
 * New Admin Dashboard - Main Entry Point
 * Complete redesign with top navigation and modern layout
 */

import { firebaseService } from './core/FirebaseService.js';
import { DataManager } from './core/DataManager.js';
import { StateManager } from './core/StateManager.js';
import { helpers } from './utils/helpers.js';
import { apiService } from './services/ApiService.js';
import { OverviewView } from './views/OverviewView.js';
import { UsersView } from './views/UsersView.js';
import { LogsView } from './views/LogsView.js';
import { AnalyticsView } from './views/AnalyticsView.js';
import { SpecUsageView } from './views/SpecUsageView.js';
import { McpView } from './views/McpView.js';
import { ArticlesView } from './views/ArticlesView.js';
import { AcademyView } from './views/AcademyView.js';
import { ToolsView } from './views/ToolsView.js';
import { ContactView } from './views/ContactView.js';
import { UnsubscribeView } from './views/UnsubscribeView.js';

class NewAdminDashboard {
  constructor() {
    this.dataManager = new DataManager();
    this.stateManager = new StateManager();
    this.helpers = helpers;

    // DOM elements
    this.elements = {
      navTabs: helpers.domAll('.nav-tab'),
      sections: helpers.domAll('.dashboard-content-section'),
      connectionStatus: helpers.dom('#connection-status'),
      statusDot: helpers.dom('#status-dot'),
      statusText: helpers.dom('#status-text'),
      signOutBtn: helpers.dom('#sign-out-btn'),
      lastSyncTime: helpers.dom('#last-sync-time'),
      overviewLoadingSpinner: helpers.dom('#overview-loading-spinner')
    };
    
    // Views
    this.views = new Map();
    
    // Initialize
    this.init();
  }
  
  /**
   * Initialize dashboard
   */
  async init() {
    try {
      // Setup UI first
      this.setupUI();
      
      // Setup auth gate
      this.setupAuthGate();
      
    } catch (error) {
      console.error('[NewAdminDashboard] Initialization error:', error);
    }
  }
  
  /**
   * Setup auth gate
   */
  setupAuthGate() {
    firebaseService.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = '/pages/auth.html';
        return;
      }
      
      const email = user.email?.toLowerCase();
      if (!email || !firebaseService.isAdmin(email)) {
        alert('Access denied. You must be an admin to view this dashboard.');
        window.location.href = '/pages/auth.html';
        return;
      }
      
      // User is authenticated and is admin
      await this.start();
    });
  }
  
  /**
   * Start dashboard
   */
  async start() {
    try {
      // Show loading spinner next to "Live Overview" title
      if (this.elements.overviewLoadingSpinner) {
        this.elements.overviewLoadingSpinner.style.display = 'inline-block';
      }
      
      // Update connection state
      this.updateConnectionState('pending', 'Connecting…');
      
      // Initialize data manager
      await this.dataManager.initialize();
      
      // Initialize views
      this.initViews();
      
      // Wait a bit for initial data to load
      await helpers.sleep(1000);
      
      // Update connection state
      this.updateConnectionState('online', 'Realtime sync active');
      this.updateLastSync();
      
      // Hide loading spinner when data is ready
      if (this.elements.overviewLoadingSpinner) {
        this.elements.overviewLoadingSpinner.style.display = 'none';
      }
      
      // Show overview section by default
      this.navigateToSection('overview');
      
      // Setup data listeners
      this.setupDataListeners();
      
      // Setup connection monitoring
      this.setupConnectionMonitoring();
      
    } catch (error) {
      console.error('[NewAdminDashboard] Start error:', error);
      this.updateConnectionState('offline', 'Connection error');
    }
  }
  
  /**
   * Setup UI
   */
  setupUI() {
    // Navigation tabs
    this.elements.navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const section = tab.dataset.section;
        if (section) {
          this.navigateToSection(section);
        }
      });
    });
    
    // Sync actions dropdown toggle
    const syncActionsToggle = helpers.dom('#sync-actions-toggle');
    const syncDropdownMenu = helpers.dom('#sync-dropdown-menu');
    if (syncActionsToggle && syncDropdownMenu) {
      syncActionsToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = syncActionsToggle.closest('.sync-actions-dropdown');
        if (dropdown) {
          dropdown.classList.toggle('active');
          syncActionsToggle.setAttribute('aria-expanded', dropdown.classList.contains('active'));
        }
      });
      
      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!syncActionsToggle.contains(e.target) && !syncDropdownMenu.contains(e.target)) {
          const dropdown = syncActionsToggle.closest('.sync-actions-dropdown');
          if (dropdown) {
            dropdown.classList.remove('active');
            syncActionsToggle.setAttribute('aria-expanded', 'false');
          }
        }
      });
    }
    
    // Refresh data button
    const refreshDataBtn = helpers.dom('#refresh-data-btn');
    if (refreshDataBtn) {
      refreshDataBtn.addEventListener('click', () => {
        this.refreshData();
        this.closeSyncDropdown();
      });
    }
    
    // Sync credits button
    const syncCreditsBtn = helpers.dom('#sync-credits-btn');
    if (syncCreditsBtn) {
      syncCreditsBtn.addEventListener('click', () => {
        this.syncCredits();
        this.closeSyncDropdown();
      });
    }
    
    // Refresh status button
    const refreshStatusBtn = helpers.dom('#refresh-status-btn');
    if (refreshStatusBtn) {
      refreshStatusBtn.addEventListener('click', () => {
        this.refreshSystemStatus();
        this.closeSyncDropdown();
      });
    }
    
    // Subscription refresh event listeners
    window.addEventListener('subscriptionRefreshStart', () => {
      this.stateManager.setState('subscriptionRefresh.active', true);
      this.stateManager.setState('subscriptionRefresh.lastRefresh', null);
      // Trigger status update
      if (this.views.has('overview')) {
        this.views.get('overview').renderSystemStatus();
      }
    });
    
    window.addEventListener('subscriptionRefreshSuccess', () => {
      this.stateManager.setState('subscriptionRefresh.active', false);
      this.stateManager.setState('subscriptionRefresh.lastRefresh', new Date().toISOString());
      // Trigger status update
      if (this.views.has('overview')) {
        this.views.get('overview').renderSystemStatus();
      }
    });
    
    window.addEventListener('subscriptionRefreshError', () => {
      this.stateManager.setState('subscriptionRefresh.active', false);
      // Trigger status update
      if (this.views.has('overview')) {
        this.views.get('overview').renderSystemStatus();
      }
    });
    
    // Sign out button
    if (this.elements.signOutBtn) {
      this.elements.signOutBtn.addEventListener('click', async () => {
        try {
          await firebaseService.signOut();
          window.location.href = '/pages/auth.html';
        } catch (error) {
          console.error('[NewAdminDashboard] Sign out error:', error);
        }
      });
    }

    // Activity filters
    const filterChips = helpers.domAll('.filter-chip');
    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        
        const filter = chip.dataset.filter || 'all';
        this.stateManager.setState('activityFilter', filter);
        
        // Update activity feed
        const overviewView = this.views.get('overview');
        if (overviewView && typeof overviewView.renderActivityFeed === 'function') {
          overviewView.renderActivityFeed();
        }
      });
    });
  }
  
  /**
   * Navigate to section
   */
  navigateToSection(sectionId) {
    // Navigating to section
    
    // Update active nav tabs
    this.elements.navTabs.forEach(tab => {
      const isActive = tab.dataset.section === sectionId;
      tab.classList.toggle('active', isActive);
    });
    
    // Update active sections
    this.elements.sections.forEach(section => {
      const isActive = section.id === `${sectionId}-section`;
      if (isActive) {
        section.classList.add('active');
        section.style.display = 'block';
        
        // Setup internal tabs for content section
        if (sectionId === 'content') {
          this.setupContentTabs();
        }
      } else {
        section.classList.remove('active');
        section.style.display = 'none';
      }
    });
    
    // Update state
    this.stateManager.setState('activeSection', sectionId);
    
    // Show view
    const view = this.views.get(sectionId);
    if (view && typeof view.show === 'function') {
      view.show();
    } else if (sectionId === 'content') {
      // Handle content view with internal tabs
      const contentView = this.views.get('content');
      if (contentView) {
        const activeTab = this.stateManager.getState('contentTab') || 'articles';
        this.switchContentTab(activeTab);
      }
    } else {
      // No view found for section
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  /**
   * Setup content tabs (Articles and Academy)
   */
  setupContentTabs() {
    const tabs = helpers.domAll('#content-section .payments-tab');
    if (tabs.length === 0) return;
    
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;
        this.switchContentTab(tabName);
      });
    });
    
    // Initialize first tab
    const activeTab = this.stateManager.getState('contentTab') || 'articles';
    this.switchContentTab(activeTab);
  }
  
  /**
   * Switch content tab
   */
  switchContentTab(tabName) {
    // Update tab buttons
    helpers.domAll('#content-section .payments-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    const activeTab = helpers.dom(`#content-section .payments-tab[data-tab="${tabName}"]`);
    if (activeTab) {
      activeTab.classList.add('active');
    }
    
    // Update tab content
    helpers.domAll('#content-section .payments-tab-content').forEach(content => {
      content.classList.remove('active');
    });
    const activeContent = helpers.dom(`#content-tab-${tabName}`);
    if (activeContent) {
      activeContent.classList.add('active');
    }
    
    // Update state
    this.stateManager.setState('contentTab', tabName);
    
    // Show view
    const contentView = this.views.get('content');
    if (contentView) {
      const view = contentView[tabName];
      if (view && typeof view.show === 'function') {
        view.show();
      }
    }
  }
  
  /**
   * Initialize views
   */
  initViews() {
    try {
      // Overview view
      this.views.set('overview', new OverviewView(this.dataManager, this.stateManager));
      
      // Users view
      this.views.set('users', new UsersView(this.dataManager, this.stateManager));
      
      // Analytics view
      this.views.set('analytics', new AnalyticsView(this.dataManager, this.stateManager));
      
      // Spec Usage view
      this.views.set('spec-usage', new SpecUsageView(this.dataManager, this.stateManager));
      
      // MCP view
      this.views.set('mcp', new McpView(this.dataManager, this.stateManager));
      
      // Logs view
      this.views.set('logs', new LogsView(this.dataManager, this.stateManager));
      
      // Content view - unified Articles, Tools, and Academy
      const articlesView = new ArticlesView(this.dataManager, this.stateManager);
      const toolsView = new ToolsView(this.dataManager, this.stateManager);
      const academyView = new AcademyView(this.dataManager, this.stateManager);
      this.views.set('content', { articles: articlesView, tools: toolsView, academy: academyView });
      // Keep separate views for backward compatibility
      this.views.set('articles', articlesView);
      this.views.set('tools', toolsView);
      this.views.set('academy', academyView);
      // Expose toolsView globally for onclick handlers
      window.toolsView = toolsView;
      
      // Contact view
      const contactView = new ContactView(this.dataManager, this.stateManager);
      this.views.set('contact', contactView);
      // Expose to window for onclick handlers
      window.contactView = contactView;
      
      // Unsubscribe view
      const unsubscribeView = new UnsubscribeView(this.dataManager, this.stateManager);
      this.views.set('email', unsubscribeView);
      window.unsubscribeView = unsubscribeView;
      
    } catch (error) {
      console.error('[NewAdminDashboard] Error initializing views:', error);
    }
  }
  
  /**
   * Setup data listeners
   */
  setupDataListeners() {
    // Listen to data changes
    this.dataManager.on('data', ({ source, data }) => {
      this.stateManager.setState(source, data);
      this.updateSourceStatus(source, 'ready');
      this.updateUI(source);
    });
    
    // Listen to loading states
    this.dataManager.on('loading', ({ source, loading }) => {
      this.stateManager.setState(`loading.${source}`, loading);
      if (loading) {
        this.updateSourceStatus(source, 'pending');
      }
    });
    
    // Listen to restricted (permission denied) - handle gracefully
    this.dataManager.on('restricted', ({ source, error }) => {
      // Access restricted
      this.updateSourceStatus(source, 'restricted');
      this.stateManager.setState(`restricted.${source}`, true);
    });
    
    // Listen to errors
    this.dataManager.on('error', ({ source, error }) => {
      if (error?.code !== 'permission-denied') {
        this.stateManager.setState(`errors.${source}`, error);
        this.updateSourceStatus(source, 'error');
        console.error(`[NewAdminDashboard] Error in ${source}:`, error);
      }
    });
  }
  
  /**
   * Setup connection monitoring
   */
  setupConnectionMonitoring() {
    firebaseService.onConnectionChange((connectionState) => {
      if (connectionState.online) {
        this.updateConnectionState('online', 'Realtime sync active');
        this.updateLastSync();
      } else if (connectionState.retrying) {
        this.updateConnectionState('pending', 'Reconnecting…');
      } else {
        this.updateConnectionState('offline', 'Connection lost');
      }
    });
  }
  
  /**
   * Update connection state
   */
  updateConnectionState(status, label) {
    if (this.elements.statusDot) {
      this.elements.statusDot.className = 'status-dot';
      this.elements.statusDot.classList.add(status);
      // Update tooltip with status text
      this.elements.statusDot.title = label;
    }
    
    if (this.elements.statusText) {
      this.elements.statusText.textContent = label;
      // Keep text hidden but update it for accessibility
      this.elements.statusText.setAttribute('aria-label', label);
    }
    
    this.stateManager.setState('connectionStatus', status);
  }
  
  /**
   * Update last sync time
   */
  updateLastSync() {
    if (this.elements.lastSyncTime) {
      const now = new Date();
      this.elements.lastSyncTime.textContent = now.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }
  
  /**
   * Update UI based on data source
   */
  updateUI(source) {
    const activeSection = this.stateManager.getState('activeSection');
    const activeView = this.views.get(activeSection);
    
    if (activeView && typeof activeView.update === 'function') {
      activeView.update();
    }
  }
  
  /**
   * Close sync dropdown
   */
  closeSyncDropdown() {
    const dropdown = helpers.dom('.sync-actions-dropdown');
    const toggle = helpers.dom('#sync-actions-toggle');
    if (dropdown) {
      dropdown.classList.remove('active');
    }
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
    }
  }
  
  /**
   * Refresh data
   */
  async refreshData() {
    const btn = helpers.dom('#refresh-data-btn');
    if (!btn) return;
    
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Refreshing...</span>';
    
    // Show loading spinner next to "Live Overview" title
    if (this.elements.overviewLoadingSpinner) {
      this.elements.overviewLoadingSpinner.style.display = 'inline-block';
    }
    
    this.updateConnectionState('pending', 'Refreshing…');
    
    try {
      // Cleanup and reinitialize
      this.dataManager.cleanup();
      await this.dataManager.initialize();
      
      this.updateConnectionState('online', 'Realtime sync active');
      this.updateLastSync();
      
      btn.innerHTML = '<i class="fas fa-check"></i> <span>Refreshed</span>';
      btn.classList.remove('loading');
      btn.classList.add('success');
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove('success');
        btn.disabled = false;
      }, 2000);
      
      // Hide loading spinner after refresh completes
      if (this.elements.overviewLoadingSpinner) {
        setTimeout(() => {
          if (this.elements.overviewLoadingSpinner) {
            this.elements.overviewLoadingSpinner.style.display = 'none';
          }
        }, 500);
      }
    } catch (error) {
      console.error('[NewAdminDashboard] Refresh error:', error);
      this.updateConnectionState('offline', 'Refresh failed');
      
      btn.innerHTML = '<i class="fas fa-times"></i> <span>Failed</span>';
      btn.classList.remove('loading');
      btn.classList.add('error');
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove('error');
        btn.disabled = false;
      }, 2000);
      
      // Hide loading spinner even on error
      if (this.elements.overviewLoadingSpinner) {
        this.elements.overviewLoadingSpinner.style.display = 'none';
      }
    }
  }
  
  /**
   * Sync credits
   */
  async syncCredits() {
    const btn = helpers.dom('#sync-credits-btn');
    if (!btn) return;
    
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Syncing...</span>';
    
    try {
      await apiService.syncCredits();
      
      btn.innerHTML = '<i class="fas fa-check"></i> <span>Synced</span>';
      btn.classList.remove('loading');
      btn.classList.add('success');
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove('success');
        btn.disabled = false;
      }, 2000);
    } catch (error) {
      console.error('[NewAdminDashboard] Sync credits error:', error);
      
      btn.innerHTML = '<i class="fas fa-times"></i> <span>Failed</span>';
      btn.classList.remove('loading');
      btn.classList.add('error');
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove('error');
        btn.disabled = false;
      }, 2000);
    }
  }
  
  /**
   * Refresh system status
   */
  async refreshSystemStatus() {
    const btn = helpers.dom('#refresh-status-btn');
    if (!btn) return;
    
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Checking...</span>';
    
    try {
      // Refresh all source statuses
      const sources = ['users', 'specs', 'purchases', 'activityLogs', 'articles', 'academyGuides'];
      sources.forEach(source => {
        const loading = this.dataManager.loadingStates[source];
        const error = this.dataManager.errors.has(source);
        const restricted = this.stateManager.getState(`restricted.${source}`);
        
        if (loading) {
          this.updateSourceStatus(source, 'pending');
        } else if (error) {
          this.updateSourceStatus(source, 'error');
        } else if (restricted) {
          this.updateSourceStatus(source, 'restricted');
        } else {
          this.updateSourceStatus(source, 'ready');
        }
      });
      
      this.updateLastSync();
      
      btn.innerHTML = '<i class="fas fa-check"></i> <span>Updated</span>';
      btn.classList.remove('loading');
      btn.classList.add('success');
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove('success');
        btn.disabled = false;
      }, 2000);
    } catch (error) {
      console.error('[NewAdminDashboard] Refresh status error:', error);
      
      btn.innerHTML = '<i class="fas fa-times"></i> <span>Failed</span>';
      btn.classList.remove('loading');
      btn.classList.add('error');
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove('error');
        btn.disabled = false;
      }, 2000);
    }
  }
  
  /**
   * Update last sync time
   */
  updateLastSync() {
    const lastSyncTime = helpers.dom('#last-sync-time');
    if (lastSyncTime) {
      lastSyncTime.textContent = helpers.formatDate(new Date(), { hour: '2-digit', minute: '2-digit' });
    }
    this.stateManager.setState('lastSync', new Date());
  }
  
  /**
   * Update source status
   */
  updateSourceStatus(source, status) {
    const statusElement = helpers.dom(`[data-source="${source}"]`);
    if (statusElement) {
      // Map status to display text
      const statusMap = {
        'ready': 'Ready',
        'pending': 'Pending',
        'error': 'Error',
        'restricted': 'Restricted'
      };
      
      statusElement.textContent = statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
      statusElement.className = 'status-badge';
      statusElement.classList.add(status);
    }
  }

}

// Initialize FirebaseService immediately to make auth available for credits-v3-display.js
// This ensures Firebase is initialized before credits scripts try to access it
firebaseService.getCurrentUser(); // This will initialize Firebase if not already initialized

// Initialize dashboard when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.newAdminDashboard = new NewAdminDashboard();
  });
} else {
  window.newAdminDashboard = new NewAdminDashboard();
}
