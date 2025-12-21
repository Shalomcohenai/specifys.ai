/**
 * New Admin Dashboard - Main Entry Point
 * Modern, modular architecture with reliable Firebase connection
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

class NewAdminDashboard {
  constructor() {
    this.dataManager = new DataManager();
    this.stateManager = new StateManager();
    this.helpers = helpers;
    
    // DOM elements
    this.elements = {
      shell: helpers.dom('#new-admin-shell'),
      sidebar: helpers.dom('#admin-sidebar'),
      mobileMenuToggle: helpers.dom('#mobile-menu-toggle'),
      mobileMenuBackdrop: helpers.dom('#mobile-menu-backdrop'),
      navLinks: helpers.domAll('.nav-link'),
      sections: helpers.domAll('.dashboard-section'),
      connectionIndicator: helpers.dom('#connection-indicator'),
      connectionLabel: helpers.dom('#connection-indicator .label'),
      sidebarLastSync: helpers.dom('#sidebar-last-sync'),
      topbarStatus: helpers.dom('#topbar-sync-status'),
      signOutBtn: helpers.dom('#sign-out-btn'),
      refreshBtn: helpers.dom('#manual-refresh-btn')
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
      // Setup UI first (so sections are visible)
      this.setupUI();
      
      // Initialize views (before navigation)
      this.initViews();
      
      // Show overview section by default - MUST be after views are initialized
      this.navigateToSection('overview-section');
      
      // Setup auth gate
      this.setupAuthGate();
      
      // Setup data listeners
      this.setupDataListeners();
      
      // Setup connection monitoring
      this.setupConnectionMonitoring();
      
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
      
      // Wait a bit for initial data to load
      await helpers.sleep(1000);
      
      // Update connection state
      this.updateConnectionState('online', 'Realtime sync active');
      this.stateManager.setState('lastSync', new Date());
      
      // Show overview view and update it
      const overviewView = this.views.get('overview-section');
      if (overviewView) {
        overviewView.show();
        // Force update after data loads
        setTimeout(() => {
          overviewView.updateMetrics();
          overviewView.renderActivityFeed();
        }, 500);
      }
      
    } catch (error) {
      console.error('[NewAdminDashboard] Start error:', error);
      this.updateConnectionState('offline', 'Connection error');
    }
  }
  
  /**
   * Setup UI
   */
  setupUI() {
    // Mobile menu
    if (this.elements.mobileMenuToggle) {
      this.elements.mobileMenuToggle.addEventListener('click', () => {
        this.toggleMobileMenu();
      });
    }
    
    if (this.elements.mobileMenuBackdrop) {
      this.elements.mobileMenuBackdrop.addEventListener('click', () => {
        this.closeMobileMenu();
      });
    }
    
    // Navigation
    this.elements.navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        if (link.dataset.target) {
          e.preventDefault();
          this.navigateToSection(link.dataset.target);
        }
      });
    });
    
    // Sign out
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
    
    // Refresh
    if (this.elements.refreshBtn) {
      this.elements.refreshBtn.addEventListener('click', () => {
        this.refreshData();
      });
    }
    
    // Sync credits button
    const syncCreditsBtn = helpers.dom('#sync-credits-btn');
    if (syncCreditsBtn) {
      syncCreditsBtn.addEventListener('click', () => {
        this.syncCredits();
      });
    }
    
    // Close mobile menu on window resize
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        this.closeMobileMenu();
      }
    });
  }
  
  /**
   * Toggle mobile menu
   */
  toggleMobileMenu() {
    if (this.elements.sidebar) {
      this.elements.sidebar.classList.toggle('mobile-open');
      if (this.elements.mobileMenuBackdrop) {
        this.elements.mobileMenuBackdrop.classList.toggle('active');
      }
      if (this.elements.mobileMenuToggle) {
        const isOpen = this.elements.sidebar.classList.contains('mobile-open');
        this.elements.mobileMenuToggle.setAttribute('aria-expanded', isOpen);
      }
    }
  }
  
  /**
   * Close mobile menu
   */
  closeMobileMenu() {
    if (this.elements.sidebar) {
      this.elements.sidebar.classList.remove('mobile-open');
      if (this.elements.mobileMenuBackdrop) {
        this.elements.mobileMenuBackdrop.classList.remove('active');
      }
      if (this.elements.mobileMenuToggle) {
        this.elements.mobileMenuToggle.setAttribute('aria-expanded', 'false');
      }
    }
  }
  
  /**
   * Navigate to section
   */
  navigateToSection(sectionId) {
    console.log('[NewAdminDashboard] Navigating to section:', sectionId);
    
    // Hide current view
    const currentSection = this.stateManager.getState('activeSection');
    if (currentSection) {
      const currentView = this.views.get(currentSection);
      if (currentView && typeof currentView.hide === 'function') {
        currentView.hide();
      }
    }
    
    // Update active nav
    this.elements.navLinks.forEach(link => {
      const isActive = link.dataset.target === sectionId;
      link.classList.toggle('active', isActive);
    });
    
    // Update active section - CRITICAL: Make sure sections are shown
    this.elements.sections.forEach(section => {
      const isActive = section.id === sectionId;
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
    
    // Show new view
    const newView = this.views.get(sectionId);
    if (newView && typeof newView.show === 'function') {
      newView.show();
    } else {
      console.warn('[NewAdminDashboard] No view found for section:', sectionId);
    }
    
    // Close mobile menu
    this.closeMobileMenu();
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  /**
   * Setup data listeners
   */
  setupDataListeners() {
    // Listen to data changes
    this.dataManager.on('data', ({ source, data }) => {
      this.stateManager.setState(source, data);
      this.updateSourceStatus(source, 'Ready');
      this.updateUI(source);
    });
    
    // Listen to loading states
    this.dataManager.on('loading', ({ source, loading }) => {
      this.stateManager.setState(`loading.${source}`, loading);
      if (loading) {
        this.updateSourceStatus(source, 'Pending');
      }
    });
    
    // Listen to restricted (permission denied) - handle gracefully
    this.dataManager.on('restricted', ({ source, error }) => {
      console.warn(`[NewAdminDashboard] Access restricted for ${source}:`, error.message);
      this.updateSourceStatus(source, 'Restricted');
      // Don't show as error, just mark as restricted
      this.stateManager.setState(`restricted.${source}`, true);
    });
    
    // Listen to errors
    this.dataManager.on('error', ({ source, error }) => {
      // Don't log permission errors as errors (they're handled as restricted)
      if (error?.code !== 'permission-denied') {
        this.stateManager.setState(`errors.${source}`, error);
        this.updateSourceStatus(source, 'Error');
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
    if (this.elements.connectionIndicator) {
      const dot = this.elements.connectionIndicator.querySelector('.dot');
      if (dot) {
        dot.classList.remove('status-online', 'status-offline', 'status-pending');
        dot.classList.add(`status-${status}`);
      }
    }
    
    if (this.elements.connectionLabel) {
      this.elements.connectionLabel.textContent = label;
    }
    
    if (this.elements.topbarStatus) {
      this.elements.topbarStatus.textContent = label;
    }
    
    if (this.elements.sidebarLastSync && status === 'online') {
      this.elements.sidebarLastSync.textContent = helpers.formatDate(new Date());
    }
    
    this.stateManager.setState('connectionStatus', status);
  }
  
  /**
   * Initialize views
   */
  initViews() {
    try {
      // Overview view
      this.views.set('overview-section', new OverviewView(this.dataManager, this.stateManager));
      
      // Users view
      this.views.set('users-section', new UsersView(this.dataManager, this.stateManager));
      
      // Payments view
      this.views.set('payments-section', new PaymentsView(this.dataManager, this.stateManager));
      
      // Logs view
      this.views.set('logs-section', new LogsView(this.dataManager, this.stateManager));
      
      // Analytics view
      this.views.set('analytics-section', new AnalyticsView(this.dataManager, this.stateManager));
      
      // Show overview view immediately
      const overviewView = this.views.get('overview-section');
      if (overviewView) {
        overviewView.show();
      }
    } catch (error) {
      console.error('[NewAdminDashboard] Error initializing views:', error);
    }
  }
  
  /**
   * Update UI based on data source
   */
  updateUI(source) {
    // Update active view if it depends on this data source
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
      this.stateManager.setState('lastSync', new Date());
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
      statusElement.textContent = status;
      statusElement.className = `source-state ${status.toLowerCase()}`;
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.newAdminDashboard = new NewAdminDashboard();
  });
} else {
  window.newAdminDashboard = new NewAdminDashboard();
}

