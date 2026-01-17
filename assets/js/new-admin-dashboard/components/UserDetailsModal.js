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
    console.log('[UserDetailsModal] show() called with userId:', userId);
    this.currentUserId = userId;
    this.isOpen = true;
    
    // Create modal if it doesn't exist
    if (!this.modal) {
      console.log('[UserDetailsModal] Creating modal...');
      this.createModal();
    }
    
    if (!this.modal) {
      console.error('[UserDetailsModal] Modal was not created!');
      alert('Failed to create modal. Please check console for errors.');
      return;
    }
    
    console.log('[UserDetailsModal] Showing modal...');
    // Show modal - ensure it's displayed as flex with proper positioning
    this.modal.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 99999 !important;
      background: rgba(0, 0, 0, 0.6) !important;
      backdrop-filter: blur(4px) !important;
      padding: 20px !important;
    `;
    this.modal.setAttribute('data-modal-open', 'true');
    document.body.style.overflow = 'hidden';
    
    // Force a reflow to ensure styles are applied
    void this.modal.offsetHeight;
    
    console.log('[UserDetailsModal] Modal displayed', {
      display: window.getComputedStyle(this.modal).display,
      visibility: window.getComputedStyle(this.modal).visibility,
      opacity: window.getComputedStyle(this.modal).opacity,
      zIndex: window.getComputedStyle(this.modal).zIndex,
      position: window.getComputedStyle(this.modal).position,
      background: window.getComputedStyle(this.modal).background
    });
    
    // Load user data
    try {
      await this.loadUserData(userId);
    } catch (error) {
      console.error('[UserDetailsModal] Error in show():', error);
      // Show error in modal
      const body = this.modal.querySelector('#user-details-modal-body');
      if (body) {
        body.innerHTML = `
          <div class="user-details-error">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Error loading user data: ${error.message}</p>
            <button class="btn-modern" onclick="document.getElementById('user-details-modal').querySelector('.user-details-modal-close').click()">Close</button>
          </div>
        `;
      }
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
      <div class="user-details-modal-overlay" id="user-details-modal" style="display: none; visibility: hidden; opacity: 0; position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 99999; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px); align-items: center; justify-content: center;">
        <div class="user-details-modal-content" style="background: #ffffff; border-radius: 12px; width: min(900px, 95%); max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); overflow: hidden;">
          <div class="user-details-modal-header" style="padding: 24px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
            <h2 style="margin: 0; font-size: 1.5rem; font-weight: 600; color: #1f2937;">User Details</h2>
            <button class="user-details-modal-close" aria-label="Close" style="background: transparent; border: none; color: #6b7280; font-size: 1.5rem; cursor: pointer; padding: 8px; display: flex; align-items: center; justify-content: center; border-radius: 8px; width: 36px; height: 36px;">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="user-details-modal-body" id="user-details-modal-body" style="padding: 24px; overflow-y: auto; flex: 1;">
            <div class="user-details-loading" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 24px; text-align: center; color: #6b7280;">
              <i class="fas fa-spinner fa-spin" style="font-size: 3rem; margin-bottom: 16px;"></i>
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
      console.warn('[UserDetailsModal] Close button not found');
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
    if (this._escapeHandler) {
      document.removeEventListener('keydown', this._escapeHandler);
    }
    this._escapeHandler = escapeHandler;
    document.addEventListener('keydown', this._escapeHandler);
  }

  /**
   * Load user analytics data
   */
  /**
   * Inject styles for data source badge
   */
  injectDataSourceBadgeStyles() {
    if (!document.getElementById('data-source-badge-styles')) {
      const style = document.createElement('style');
      style.id = 'data-source-badge-styles';
      style.textContent = `
        .data-source-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .data-source-badge.v3 {
          background-color: #10b981;
          color: white;
        }
        .data-source-badge.v2 {
          background-color: #f59e0b;
          color: white;
        }
      `;
      document.head.appendChild(style);
    }
  }

  async loadUserData(userId) {
    this.injectDataSourceBadgeStyles();
    const body = this.modal.querySelector('#user-details-modal-body');
    
    try {
      // Use ApiService to make the request
      const data = await apiService.get(`/api/admin/users/${userId}/analytics`);
      const analytics = data.analytics;
      
      // Store analytics for copy button
      this.currentAnalytics = analytics;
      
      // Render user data
      this.renderUserData(analytics);
      
      // Setup copy button after rendering
      setTimeout(() => {
        this.setupCopyButton();
        this.setupRefreshButton();
      }, 100);
      
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
    
    if (!body) {
      console.error('[UserDetailsModal] Modal body not found!');
      return;
    }
    
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
          ${analytics.rawData?.user_credits_v3?.exists !== false ? 
            '<span class="data-source-badge v3" style="margin-left: 8px;" title="Data from V3 system (user_credits_v3)">V3</span>' : 
            '<span class="data-source-badge v2" style="margin-left: 8px;" title="Data from V2 system (fallback)">V2</span>'
          }
        </h3>
        <div class="user-details-grid">
          ${credits ? `
            <div class="user-details-item">
              <label>Total Credits</label>
              <div class="user-details-value user-details-value-large">
                ${credits.unlimited ? '∞' : (credits.total || 0)}
              </div>
            </div>
            ${!credits.unlimited ? `
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
            ` : ''}
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

      <!-- Subscription Information -->
      <div class="user-details-section">
        <h3 class="user-details-section-title">
          <i class="fas fa-credit-card"></i>
          Subscription Information
          <button class="refresh-subscription-btn" id="refresh-subscription-btn" title="Refresh subscription data from Lemon Squeezy API">
            <i class="fas fa-sync-alt"></i>
            Refresh from Lemon Squeezy
          </button>
        </h3>
        <div class="user-details-grid">
          ${analytics.subscription ? `
            <div class="user-details-item">
              <label>Status</label>
              <div class="user-details-value">
                ${analytics.subscription.status ? `<span class="subscription-status-${this.getSubscriptionStatusClass(analytics.subscription.status)}">${this.escapeHtml(analytics.subscription.status)}</span>` : '—'}
              </div>
            </div>
            <div class="user-details-item">
              <label>Renewal Date</label>
              <div class="user-details-value">${this.formatSubscriptionRenewal(analytics.subscription)}</div>
            </div>
            ${analytics.subscription.renewsAt ? `
              <div class="user-details-item">
                <label>Renews At</label>
                <div class="user-details-value">${this.formatDateTime(analytics.subscription.renewsAt)}</div>
              </div>
            ` : ''}
            ${analytics.subscription.endsAt ? `
              <div class="user-details-item">
                <label>Ends At</label>
                <div class="user-details-value">${this.formatDateTime(analytics.subscription.endsAt)}</div>
              </div>
            ` : ''}
            <div class="user-details-item">
              <label>Cancelled at Period End</label>
              <div class="user-details-value">
                ${analytics.subscription.cancelAtPeriodEnd ? '<span class="subscription-status-cancelled">Yes</span>' : 'No'}
              </div>
            </div>
            ${analytics.subscription.subscriptionId ? `
              <div class="user-details-item">
                <label>Subscription ID</label>
                <div class="user-details-value user-details-value-monospace">${this.escapeHtml(analytics.subscription.subscriptionId)}</div>
              </div>
            ` : ''}
          ` : `
            <div class="user-details-item">
              <div class="user-details-value">No subscription data available</div>
            </div>
          `}
        </div>
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

      <!-- Raw Data / Debug Information -->
      <div class="user-details-section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 class="user-details-section-title" style="margin: 0;">
            <i class="fas fa-code"></i>
            Raw Data (Debug)
          </h3>
          <button class="btn-modern small" id="copy-raw-data-btn" style="margin-left: auto;">
            <i class="fas fa-copy"></i>
            Copy All Data
          </button>
        </div>
        <div class="user-details-raw-data" id="raw-data-container">
          <details style="margin-bottom: 16px;">
            <summary style="cursor: pointer; font-weight: 600; padding: 8px; background: #f5f5f5; border-radius: 4px; user-select: none;">
              users Collection
            </summary>
            <pre style="background: #f9f9f9; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 0.85rem; margin-top: 8px; border: 1px solid #e5e7eb;">${this.escapeHtml(JSON.stringify(analytics.rawData?.users || {}, null, 2))}</pre>
          </details>
          <details style="margin-bottom: 16px;">
            <summary style="cursor: pointer; font-weight: 600; padding: 8px; background: #f5f5f5; border-radius: 4px; user-select: none;">
              user_credits_v3 Collection
            </summary>
            <pre style="background: #f9f9f9; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 0.85rem; margin-top: 8px; border: 1px solid #e5e7eb;">${this.escapeHtml(JSON.stringify(analytics.rawData?.user_credits_v3 || {}, null, 2))}</pre>
          </details>
          <details style="margin-bottom: 16px;">
            <summary style="cursor: pointer; font-weight: 600; padding: 8px; background: #f5f5f5; border-radius: 4px; user-select: none;">
              subscriptions_v3 Collection
            </summary>
            <pre style="background: #f9f9f9; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 0.85rem; margin-top: 8px; border: 1px solid #e5e7eb;">${this.escapeHtml(JSON.stringify(analytics.rawData?.subscriptions_v3 || {}, null, 2))}</pre>
          </details>
        </div>
      </div>
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
   * Get CSS class for subscription status
   */
  getSubscriptionStatusClass(status) {
    if (!status) return 'unknown';
    const statusLower = status.toLowerCase();
    if (statusLower === 'active' || statusLower === 'on_trial') return 'active';
    if (statusLower === 'cancelled' || statusLower === 'expired' || statusLower === 'past_due') return 'cancelled';
    return 'unknown';
  }

  /**
   * Format subscription renewal date
   */
  formatSubscriptionRenewal(subscription) {
    if (!subscription) return '—';
    
    // Check if subscription is cancelled/expired
    const isCancelledStatus = subscription.status === 'cancelled' || subscription.status === 'expired';
    
    // If cancelled status, show cancelled
    if (isCancelledStatus) {
      return '<span class="subscription-status-cancelled">Cancelled</span>';
    }
    
    // Determine renewal/end date
    // If cancel_at_period_end is true, use endsAt (when subscription will actually end)
    // Otherwise, use renewsAt (when subscription will renew)
    const renewalDate = subscription.cancelAtPeriodEnd 
      ? (subscription.endsAt || subscription.renewsAt)
      : (subscription.renewsAt || subscription.endsAt);
    
    if (!renewalDate) {
      return '—';
    }
    
    const date = new Date(renewalDate);
    const now = new Date();
    const diffMs = date - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    // Format date
    const formattedDate = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    // Format time
    const formattedTime = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // If cancelled at period end, show when it will end
    if (subscription.cancelAtPeriodEnd) {
      if (diffDays < 0) {
        return '<span class="subscription-status-cancelled">Cancelled</span>';
      } else if (diffDays === 0) {
        return `<span class="subscription-status-cancelled">Cancelled (ends today at ${formattedTime})</span>`;
      } else if (diffDays === 1) {
        return `<span class="subscription-status-cancelled">Cancelled (ends tomorrow, ${formattedDate} at ${formattedTime})</span>`;
      } else {
        return `<span class="subscription-status-cancelled">Cancelled (ends in ${diffDays} days, ${formattedDate} at ${formattedTime})</span>`;
      }
    }
    
    // Active subscription - show renewal date
    if (diffDays < 0) {
      return `<span class="subscription-status-expired">Expired (${formattedDate})</span>`;
    } else if (diffDays === 0) {
      return `<span class="subscription-status-renewing">Renews today at ${formattedTime}</span>`;
    } else if (diffDays === 1) {
      return `<span class="subscription-status-renewing">Renews tomorrow (${formattedDate} at ${formattedTime})</span>`;
    } else {
      return `<span class="subscription-status-active">Renews in ${diffDays} days (${formattedDate} at ${formattedTime})</span>`;
    }
  }

  /**
   * Setup refresh subscription button
   */
  setupRefreshButton() {
    const refreshBtn = this.modal?.querySelector('#refresh-subscription-btn');
    if (!refreshBtn || !this.currentUserId) {
      console.log('[UserDetailsModal] Refresh button not found or no userId', { refreshBtn: !!refreshBtn, userId: this.currentUserId });
      return;
    }
    
    // Remove existing listener if any
    const newRefreshBtn = refreshBtn.cloneNode(true);
    refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
    
    newRefreshBtn.addEventListener('click', async () => {
      if (newRefreshBtn.disabled) return;
      
      const originalHTML = newRefreshBtn.innerHTML;
      newRefreshBtn.disabled = true;
      newRefreshBtn.classList.add('refreshing');
      newRefreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
      
      try {
        // Emit refresh start event
        window.dispatchEvent(new CustomEvent('subscriptionRefreshStart', { detail: { userId: this.currentUserId } }));
        
        const response = await apiService.post(`/api/admin/users/${this.currentUserId}/refresh-subscription`);
        
        if (response.success) {
          // Emit refresh success event
          window.dispatchEvent(new CustomEvent('subscriptionRefreshSuccess', { detail: { userId: this.currentUserId } }));
          
          // Show success message
          const successMsg = document.createElement('div');
          successMsg.className = 'refresh-success-message';
          successMsg.style.cssText = 'background: #d4edda; color: #155724; padding: 12px; border-radius: 4px; margin: 12px 0; border: 1px solid #c3e6cb;';
          successMsg.innerHTML = '<i class="fas fa-check-circle"></i> Subscription data refreshed successfully!';
          newRefreshBtn.parentNode.insertBefore(successMsg, newRefreshBtn.nextSibling);
          
          // Remove success message after 3 seconds
          setTimeout(() => successMsg.remove(), 3000);
          
          // Reload user data
          await this.loadUserData(this.currentUserId);
        } else {
          throw new Error(response.message || 'Failed to refresh subscription data');
        }
      } catch (error) {
        console.error('[UserDetailsModal] Error refreshing subscription:', error);
        
        // Emit refresh error event
        window.dispatchEvent(new CustomEvent('subscriptionRefreshError', { detail: { userId: this.currentUserId, error: error.message } }));
        
        // Show error message
        const errorMsg = document.createElement('div');
        errorMsg.className = 'refresh-error-message';
        errorMsg.style.cssText = 'background: #f8d7da; color: #721c24; padding: 12px; border-radius: 4px; margin: 12px 0; border: 1px solid #f5c6cb;';
        errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${error.message || 'Failed to refresh subscription data'}`;
        newRefreshBtn.parentNode.insertBefore(errorMsg, newRefreshBtn.nextSibling);
        
        // Remove error message after 5 seconds
        setTimeout(() => errorMsg.remove(), 5000);
      } finally {
        newRefreshBtn.disabled = false;
        newRefreshBtn.classList.remove('refreshing');
        newRefreshBtn.innerHTML = originalHTML;
      }
    });
  }

  /**
   * Setup copy button for raw data
   */
  setupCopyButton() {
    const copyBtn = this.modal?.querySelector('#copy-raw-data-btn');
    if (!copyBtn) return;
    
    // Remove existing listener if any
    const newCopyBtn = copyBtn.cloneNode(true);
    copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
    
    newCopyBtn.addEventListener('click', () => {
      // Use stored analytics data
      const rawData = this.currentAnalytics?.rawData || {
        users: {},
        user_credits_v3: {},
        subscriptions_v3: {}
      };
      
      // Copy to clipboard
      const jsonString = JSON.stringify(rawData, null, 2);
      navigator.clipboard.writeText(jsonString).then(() => {
        // Show success feedback
        const originalHTML = newCopyBtn.innerHTML;
        newCopyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        newCopyBtn.classList.add('success');
        setTimeout(() => {
          newCopyBtn.innerHTML = originalHTML;
          newCopyBtn.classList.remove('success');
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy data to clipboard');
      });
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

