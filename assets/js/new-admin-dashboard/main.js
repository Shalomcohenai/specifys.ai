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
import { PaymentsView } from './views/PaymentsView.js';
import { LogsView } from './views/LogsView.js';
import { AnalyticsView } from './views/AnalyticsView.js';
import { ArticlesView } from './views/ArticlesView.js';
import { AcademyView } from './views/AcademyView.js';

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
      refreshBtn: helpers.dom('#refresh-btn'),
      signOutBtn: helpers.dom('#sign-out-btn'),
      lastSyncTime: helpers.dom('#last-sync-time')
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
    
    // Refresh button
    if (this.elements.refreshBtn) {
      this.elements.refreshBtn.addEventListener('click', () => {
        this.refreshData();
      });
    }
    
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
    
    // Sync credits button
    const syncCreditsBtn = helpers.dom('#sync-credits-btn');
    if (syncCreditsBtn) {
      syncCreditsBtn.addEventListener('click', () => {
        this.syncCredits();
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
    console.log('[NewAdminDashboard] Navigating to section:', sectionId);
    
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
    } else {
      console.warn('[NewAdminDashboard] No view found for section:', sectionId);
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      
      // Payments view
      this.views.set('payments', new PaymentsView(this.dataManager, this.stateManager));
      
      // Logs view
      this.views.set('logs', new LogsView(this.dataManager, this.stateManager));
      
      // Articles view
      this.views.set('articles', new ArticlesView(this.dataManager, this.stateManager));
      
      // Academy view
      this.views.set('academy', new AcademyView(this.dataManager, this.stateManager));
      
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
      console.warn(`[NewAdminDashboard] Access restricted for ${source}:`, error.message);
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
    }
    
    if (this.elements.statusText) {
      this.elements.statusText.textContent = label;
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
   * Refresh data
   */
  async refreshData() {
    this.updateConnectionState('pending', 'Refreshing…');
    
    try {
      // Cleanup and reinitialize
      this.dataManager.cleanup();
      await this.dataManager.initialize();
      
      this.updateConnectionState('online', 'Realtime sync active');
      this.updateLastSync();
    } catch (error) {
      console.error('[NewAdminDashboard] Refresh error:', error);
      this.updateConnectionState('offline', 'Refresh failed');
    }
  }
  
  /**
   * Sync credits
   */
  async syncCredits() {
    const btn = helpers.dom('#sync-credits-btn');
    if (btn) {
      btn.disabled = true;
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing…';
      
      try {
        await apiService.syncCredits();
        btn.innerHTML = '<i class="fas fa-check"></i> Synced';
        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.disabled = false;
        }, 2000);
      } catch (error) {
        console.error('[NewAdminDashboard] Sync credits error:', error);
        btn.innerHTML = '<i class="fas fa-times"></i> Failed';
        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.disabled = false;
        }, 2000);
      }
    }
  }
  
  /**
   * Update source status
   */
  updateSourceStatus(source, status) {
    const statusElement = helpers.dom(`[data-source="${source}"]`);
    if (statusElement) {
      statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
      statusElement.className = 'status-badge';
      statusElement.classList.add(status);
    }
  }
}

// Initialize FirebaseService immediately to make auth available for credits-v2-display.js
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
