/**
 * User Details Modal Component
 * Displays comprehensive user analytics and information
 */

import { helpers } from '../utils/helpers.js';
import { firebaseService } from '../core/FirebaseService.js';
import { apiService } from '../services/ApiService.js';

export class UserDetailsModal {
  constructor() {
    this.modal = null;
    this.isOpen = false;
    this.currentUserId = null;
  }

  /**
   * Show modal with user data
   */
  async show(userId) {
    // Showing modal
    this.currentUserId = userId;
    this.isOpen = true;
    
    // Create modal if it doesn't exist
    if (!this.modal) {
      // Creating modal
      this.createModal();
    }
    
    if (!this.modal) {
      console.error('[UserDetailsModal] Modal was not created!');
      return;
    }
    
    // Show modal
    this.modal.style.display = 'flex';
    this.modal.style.visibility = 'visible';
    this.modal.style.opacity = '1';
    this.modal.style.zIndex = '99999';
    this.modal.setAttribute('data-modal-open', 'true');
    document.body.style.overflow = 'hidden';
    
    // Load user data
    try {
      await this.loadUserData(userId);
    } catch (error) {
      console.error('[UserDetailsModal] Error in show():', error);
    }
  }

  /**
   * Hide modal
   */
  hide() {
    // Hiding modal
    if (this.modal) {
      this.modal.style.display = 'none';
      this.modal.style.visibility = 'hidden';
      this.modal.style.opacity = '0';
      document.body.style.overflow = '';
    }
    this.isOpen = false;
    this.currentUserId = null;
    
    // Remove escape key handler
    if (this._escapeHandler) {
      document.removeEventListener('keydown', this._escapeHandler);
      this._escapeHandler = null;
    }
  }

  /**
   * Create modal HTML structure
   */
  createModal() {
    // Remove existing modal if any
    const existing = document.getElementById('user-details-modal');
    if (existing) {
      existing.remove();
    }

    const modalHTML = `
      <div class="user-details-modal-overlay" id="user-details-modal">
        <div class="user-details-modal-content">
          <div class="user-details-modal-header">
            <h2>User Details</h2>
            <button class="user-details-modal-close" aria-label="Close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="user-details-modal-body" id="user-details-modal-body">
            <div class="user-details-loading">
              <i class="fas fa-spinner fa-spin"></i>
              <p>Loading user data...</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('user-details-modal');
    
    if (!this.modal) {
      console.error('[UserDetailsModal] Failed to create modal element!');
      return;
    }
    
    // Modal created
    
    // Setup event listeners
    const closeBtn = this.modal.querySelector('.user-details-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    } else {
      // Close button not found
    }
    
    // Close on overlay click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });
    
    // Close on Escape key - use a unique handler to avoid duplicates
    const escapeHandler = (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.hide();
      }
    };
    
    // Remove existing handler if any
    document.removeEventListener('keydown', this._escapeHandler);
    this._escapeHandler = escapeHandler;
    document.addEventListener('keydown', this._escapeHandler);
  }

  /**
   * Load user analytics data
   */
  async loadUserData(userId) {
    const body = this.modal.querySelector('#user-details-modal-body');
    
    try {
      // Use ApiService to make the request
      const data = await apiService.get(`/api/admin/users/${userId}/analytics`);
      const analytics = data.analytics;
      
      // Render user data
      this.renderUserData(analytics);
      
    } catch (error) {
      console.error('[UserDetailsModal] Error loading user data:', error);
      body.innerHTML = `
        <div class="user-details-error">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Error loading user data: ${error.message}</p>
          <button class="btn-modern" onclick="this.closest('.user-details-modal-overlay').querySelector('.user-details-modal-close').click()">Close</button>
        </div>
      `;
    }
  }

  /**
   * Render user data
   */
  renderUserData(analytics) {
    const body = this.modal.querySelector('#user-details-modal-body');
    
    const user = analytics.user || {};
    const credits = analytics.credits || null;
    const specs = analytics.specs || { count: 0, specs: [] };
    const acquisition = analytics.acquisition || {};
    const visits = analytics.visits || {};
    const pageJourney = analytics.pageJourney || [];
    
    body.innerHTML = `
      <!-- Basic Information -->
      <div class="user-details-section">
        <h3 class="user-details-section-title">
          <i class="fas fa-user"></i>
          Basic Information
        </h3>
        <div class="user-details-grid">
          <div class="user-details-item">
            <label>Email</label>
            <div class="user-details-value">${this.escapeHtml(user.email || '—')}</div>
          </div>
          <div class="user-details-item">
            <label>Display Name</label>
            <div class="user-details-value">${this.escapeHtml(user.displayName || '—')}</div>
          </div>
          <div class="user-details-item">
            <label>Plan</label>
            <div class="user-details-value">
              <span class="plan-badge plan-${(user.plan || 'free').toLowerCase()}">${(user.plan || 'free').charAt(0).toUpperCase() + (user.plan || 'free').slice(1)}</span>
            </div>
          </div>
          <div class="user-details-item">
            <label>Account Created</label>
            <div class="user-details-value">${user.createdAt ? this.formatDateTime(user.createdAt) : '—'}</div>
          </div>
          <div class="user-details-item">
            <label>Last Active</label>
            <div class="user-details-value">${user.lastActive ? this.formatDateTime(user.lastActive) : '—'}</div>
          </div>
          <div class="user-details-item">
            <label>Status</label>
            <div class="user-details-value">
              <span class="status-badge ${user.disabled ? 'status-disabled' : 'status-active'}">
                ${user.disabled ? 'Disabled' : 'Active'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Credits & Usage -->
      <div class="user-details-section">
        <h3 class="user-details-section-title">
          <i class="fas fa-coins"></i>
          Credits & Usage
        </h3>
        <div class="user-details-grid">
          ${credits ? `
            <div class="user-details-item">
              <label>Total Credits</label>
              <div class="user-details-value user-details-value-large">${credits.total || 0}</div>
            </div>
            <div class="user-details-item">
              <label>Free Credits</label>
              <div class="user-details-value">${credits.free || 0}</div>
            </div>
            <div class="user-details-item">
              <label>Paid Credits</label>
              <div class="user-details-value">${credits.paid || 0}</div>
            </div>
            <div class="user-details-item">
              <label>Bonus Credits</label>
              <div class="user-details-value">${credits.bonus || 0}</div>
            </div>
          ` : `
            <div class="user-details-item">
              <div class="user-details-value">No credits data available</div>
            </div>
          `}
          <div class="user-details-item">
            <label>Specs Created</label>
            <div class="user-details-value user-details-value-large">${specs.count || 0}</div>
          </div>
        </div>
        ${specs.specs && specs.specs.length > 0 ? `
          <div class="user-details-specs-list">
            <h4>Recent Specs</h4>
            <ul>
              ${specs.specs.slice(0, 10).map(spec => `
                <li>
                  <span class="spec-title">${this.escapeHtml(spec.title)}</span>
                  <span class="spec-date">${spec.createdAt ? this.formatDate(spec.createdAt) : '—'}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}
      </div>

      <!-- Acquisition Data -->
      <div class="user-details-section">
        <h3 class="user-details-section-title">
          <i class="fas fa-chart-line"></i>
          Acquisition Data
        </h3>
        <div class="user-details-grid">
          <div class="user-details-item">
            <label>Referrer</label>
            <div class="user-details-value">${acquisition.referrer ? this.escapeHtml(acquisition.referrer) : '—'}</div>
          </div>
          <div class="user-details-item">
            <label>Landing Page</label>
            <div class="user-details-value">${acquisition.landing_page ? this.escapeHtml(acquisition.landing_page) : '—'}</div>
          </div>
          <div class="user-details-item">
            <label>First Visit</label>
            <div class="user-details-value">${acquisition.first_visit_at ? this.formatDateTime(acquisition.first_visit_at) : '—'}</div>
          </div>
          ${acquisition.utm_source ? `
            <div class="user-details-item">
              <label>UTM Source</label>
              <div class="user-details-value">${this.escapeHtml(acquisition.utm_source)}</div>
            </div>
          ` : ''}
          ${acquisition.utm_medium ? `
            <div class="user-details-item">
              <label>UTM Medium</label>
              <div class="user-details-value">${this.escapeHtml(acquisition.utm_medium)}</div>
            </div>
          ` : ''}
          ${acquisition.utm_campaign ? `
            <div class="user-details-item">
              <label>UTM Campaign</label>
              <div class="user-details-value">${this.escapeHtml(acquisition.utm_campaign)}</div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Visit History -->
      <div class="user-details-section">
        <h3 class="user-details-section-title">
          <i class="fas fa-history"></i>
          Visit History
        </h3>
        <div class="user-details-grid">
          <div class="user-details-item">
            <label>Total Time on Site</label>
            <div class="user-details-value user-details-value-large">${visits.totalTimeOnSiteFormatted || '0s'}</div>
          </div>
          <div class="user-details-item">
            <label>Total Visits</label>
            <div class="user-details-value user-details-value-large">${visits.totalVisits || 0}</div>
          </div>
          <div class="user-details-item">
            <label>Total Sessions</label>
            <div class="user-details-value">${visits.sessions ? visits.sessions.length : 0}</div>
          </div>
          ${visits.lastVisit ? `
            <div class="user-details-item">
              <label>Last Visit</label>
              <div class="user-details-value">${this.formatDateTime(visits.lastVisit.date)}</div>
            </div>
            <div class="user-details-item">
              <label>Last Visit Page</label>
              <div class="user-details-value">${this.escapeHtml(visits.lastVisit.page)}</div>
            </div>
          ` : ''}
        </div>
        ${visits.sessions && visits.sessions.length > 0 ? `
          <div class="user-details-sessions">
            <h4>Sessions</h4>
            <div class="user-details-sessions-list">
              ${visits.sessions.map((session, index) => `
                <div class="user-details-session-card">
                  <div class="session-header">
                    <span class="session-number">Session ${index + 1}</span>
                    <span class="session-duration">${session.durationFormatted || '0s'}</span>
                  </div>
                  <div class="session-details">
                    <div class="session-time">
                      <i class="fas fa-clock"></i>
                      ${this.formatDateTime(session.startTime)} - ${this.formatDateTime(session.endTime)}
                    </div>
                    <div class="session-pages">
                      <i class="fas fa-file"></i>
                      ${session.pageCount || 0} pages
                    </div>
                    <div class="session-entry">
                      <i class="fas fa-sign-in-alt"></i>
                      Entry: ${this.escapeHtml(session.entryPage)}
                    </div>
                    <div class="session-exit">
                      <i class="fas fa-sign-out-alt"></i>
                      Exit: ${this.escapeHtml(session.exitPage)}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Page Journey -->
      ${pageJourney.length > 0 ? `
        <div class="user-details-section">
          <h3 class="user-details-section-title">
            <i class="fas fa-route"></i>
            Page Journey
          </h3>
          <div class="user-details-page-journey">
            ${pageJourney.slice(0, 50).map((page, index) => `
              <div class="page-journey-item">
                <div class="page-journey-number">${index + 1}</div>
                <div class="page-journey-content">
                  <div class="page-journey-page">${this.escapeHtml(page.page)}</div>
                  <div class="page-journey-time">${page.viewedAt ? this.formatDateTime(page.viewedAt) : '—'}</div>
                </div>
              </div>
            `).join('')}
            ${pageJourney.length > 50 ? `
              <div class="page-journey-more">
                <p>Showing first 50 of ${pageJourney.length} page views</p>
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}
    `;
  }

  /**
   * Format date and time
   */
  formatDateTime(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Format date only
   */
  formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
}

