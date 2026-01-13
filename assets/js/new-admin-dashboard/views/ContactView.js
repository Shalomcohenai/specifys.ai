/**
 * Contact View - Manage Contact Us submissions
 */

import { helpers } from '../utils/helpers.js';
import { apiService } from '../services/ApiService.js';

export class ContactView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.submissions = [];
    this.filteredSubmissions = [];
    this.currentStatusFilter = 'all';
    this.currentPage = 1;
    this.perPage = 25;
    
    this.init();
  }
  
  /**
   * Initialize view
   */
  init() {
    this.table = helpers.dom('#contact-table tbody');
    this.statusFilter = helpers.dom('#contact-status-filter-select');
    this.searchInput = helpers.dom('#contact-search-input');
    this.refreshBtn = helpers.dom('#refresh-contact-btn');
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Load initial data
    this.loadSubmissions();
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Status filter
    if (this.statusFilter) {
      this.statusFilter.addEventListener('change', () => {
        this.currentStatusFilter = this.statusFilter.value;
        this.currentPage = 1;
        this.filterAndRender();
      });
    }
    
    // Search input
    if (this.searchInput) {
      this.searchInput.addEventListener('input', helpers.debounce(() => {
        this.currentPage = 1;
        this.filterAndRender();
      }, 300));
    }
    
    // Refresh button
    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', () => {
        this.loadSubmissions();
      });
    }
  }
  
  /**
   * Load contact submissions from API
   */
  async loadSubmissions() {
    try {
      if (this.table) {
        this.table.innerHTML = '<tr><td colspan="6" class="table-empty-state">Loading submissions...</td></tr>';
      }
      
      const response = await apiService.get('/api/admin/contact-submissions?limit=1000');
      
      if (response.success && response.submissions) {
        this.submissions = response.submissions.map(sub => {
          let createdAt = null;
          if (sub.createdAt) {
            if (sub.createdAt.toDate && typeof sub.createdAt.toDate === 'function') {
              createdAt = sub.createdAt.toDate();
            } else if (sub.createdAt instanceof Date) {
              createdAt = sub.createdAt;
            } else if (typeof sub.createdAt === 'string' || typeof sub.createdAt === 'number') {
              createdAt = new Date(sub.createdAt);
            }
          }
          if (!createdAt && sub.timestamp) {
            createdAt = new Date(sub.timestamp);
          }
          if (!createdAt) {
            createdAt = new Date();
          }
          
          let updatedAt = null;
          if (sub.updatedAt) {
            if (sub.updatedAt.toDate && typeof sub.updatedAt.toDate === 'function') {
              updatedAt = sub.updatedAt.toDate();
            } else if (sub.updatedAt instanceof Date) {
              updatedAt = sub.updatedAt;
            } else if (typeof sub.updatedAt === 'string' || typeof sub.updatedAt === 'number') {
              updatedAt = new Date(sub.updatedAt);
            }
          }
          
          return {
            ...sub,
            createdAt,
            updatedAt
          };
        });
        
        // Sort by date (newest first)
        this.submissions.sort((a, b) => b.createdAt - a.createdAt);
        
        this.updateSummary();
        this.filterAndRender();
      } else {
        throw new Error('Failed to load submissions');
      }
    } catch (error) {
      console.error('[ContactView] Error loading submissions:', error);
      if (this.table) {
        this.table.innerHTML = `<tr><td colspan="6" class="table-empty-state error">Error loading submissions: ${error.message}</td></tr>`;
      }
    }
  }
  
  /**
   * Update summary statistics
   */
  updateSummary() {
    const total = this.submissions.length;
    const newCount = this.submissions.filter(s => s.status === 'new').length;
    const readCount = this.submissions.filter(s => s.status === 'read').length;
    const repliedCount = this.submissions.filter(s => s.status === 'replied').length;
    
    const totalEl = helpers.dom('#stat-total-contact');
    const newEl = helpers.dom('#stat-new-contact');
    const readEl = helpers.dom('#stat-read-contact');
    const repliedEl = helpers.dom('#stat-replied-contact');
    
    if (totalEl) totalEl.textContent = total;
    if (newEl) newEl.textContent = newCount;
    if (readEl) readEl.textContent = readCount;
    if (repliedEl) repliedEl.textContent = repliedCount;
  }
  
  /**
   * Filter submissions
   */
  filterAndRender() {
    let filtered = [...this.submissions];
    
    // Apply status filter
    if (this.currentStatusFilter !== 'all') {
      filtered = filtered.filter(s => s.status === this.currentStatusFilter);
    }
    
    // Apply search filter
    if (this.searchInput && this.searchInput.value.trim()) {
      const searchTerm = this.searchInput.value.toLowerCase().trim();
      filtered = filtered.filter(s => {
        const email = (s.email || '').toLowerCase();
        const message = (s.message || '').toLowerCase();
        const userName = (s.userName || '').toLowerCase();
        return email.includes(searchTerm) || message.includes(searchTerm) || userName.includes(searchTerm);
      });
    }
    
    this.filteredSubmissions = filtered;
    this.render();
  }
  
  /**
   * Render submissions table
   */
  render() {
    if (!this.table) return;
    
    if (this.filteredSubmissions.length === 0) {
      this.table.innerHTML = '<tr><td colspan="6" class="table-empty-state">No submissions found</td></tr>';
      return;
    }
    
    // Pagination
    const start = (this.currentPage - 1) * this.perPage;
    const end = start + this.perPage;
    const pageSubmissions = this.filteredSubmissions.slice(start, end);
    
    // Render table
    this.table.innerHTML = pageSubmissions.map(sub => {
      const date = this.formatDate(sub.createdAt);
      const statusBadge = this.getStatusBadge(sub.status);
      const messagePreview = sub.message ? (sub.message.length > 100 ? sub.message.substring(0, 100) + '...' : sub.message) : 'No message';
      
      return `
        <tr data-id="${sub.id}" class="contact-row ${sub.status === 'new' ? 'contact-row-new' : ''}">
          <td>
            <div class="contact-email">${this.escapeHtml(sub.email || 'No email')}</div>
            ${sub.userName ? `<div class="contact-user-name">${this.escapeHtml(sub.userName)}</div>` : ''}
          </td>
          <td>
            <div class="contact-message-preview" title="${this.escapeHtml(sub.message || '')}">${this.escapeHtml(messagePreview)}</div>
          </td>
          <td>
            <div class="contact-date">${date}</div>
          </td>
          <td>
            ${statusBadge}
          </td>
          <td>
            <div class="contact-actions">
              <button class="btn-icon-small" onclick="window.contactView?.viewSubmission('${sub.id}')" title="View details">
                <i class="fas fa-eye"></i>
              </button>
              <button class="btn-icon-small" onclick="window.contactView?.updateStatus('${sub.id}')" title="Update status">
                <i class="fas fa-edit"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
    // Render pagination
    this.renderPagination();
  }
  
  /**
   * Render pagination
   */
  renderPagination() {
    const paginationEl = helpers.dom('#contact-pagination');
    if (!paginationEl) return;
    
    const totalPages = Math.ceil(this.filteredSubmissions.length / this.perPage);
    
    if (totalPages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }
    
    let html = '<div class="pagination-controls">';
    
    // Previous button
    html += `<button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="window.contactView?.goToPage(${this.currentPage - 1})">
      <i class="fas fa-chevron-left"></i>
    </button>`;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
        html += `<button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" onclick="window.contactView?.goToPage(${i})">${i}</button>`;
      } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
        html += '<span class="pagination-ellipsis">...</span>';
      }
    }
    
    // Next button
    html += `<button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="window.contactView?.goToPage(${this.currentPage + 1})">
      <i class="fas fa-chevron-right"></i>
    </button>`;
    
    html += '</div>';
    html += `<div class="pagination-info">Showing ${(this.currentPage - 1) * this.perPage + 1} - ${Math.min(this.currentPage * this.perPage, this.filteredSubmissions.length)} of ${this.filteredSubmissions.length}</div>`;
    
    paginationEl.innerHTML = html;
  }
  
  /**
   * Go to page
   */
  goToPage(page) {
    const totalPages = Math.ceil(this.filteredSubmissions.length / this.perPage);
    if (page < 1 || page > totalPages) return;
    
    this.currentPage = page;
    this.render();
    
    // Scroll to top of table
    if (this.table) {
      this.table.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  
  /**
   * View submission details
   */
  async viewSubmission(id) {
    const submission = this.submissions.find(s => s.id === id);
    if (!submission) return;
    
    const message = submission.message || 'No message';
    const email = submission.email || 'No email';
    const userName = submission.userName || 'Not provided';
    const userId = submission.userId || 'Not provided';
    const date = this.formatDate(submission.createdAt);
    const status = submission.status || 'new';
    
    const modal = document.createElement('div');
    modal.className = 'contact-modal-overlay';
    modal.innerHTML = `
      <div class="contact-modal-content">
        <div class="contact-modal-header">
          <h2>Contact Submission Details</h2>
          <button class="contact-modal-close" onclick="this.closest('.contact-modal-overlay').remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="contact-modal-body">
          <div class="contact-detail-item">
            <label>Email:</label>
            <div>${this.escapeHtml(email)}</div>
          </div>
          <div class="contact-detail-item">
            <label>User Name:</label>
            <div>${this.escapeHtml(userName)}</div>
          </div>
          <div class="contact-detail-item">
            <label>User ID:</label>
            <div class="contact-user-id">${this.escapeHtml(userId)}</div>
          </div>
          <div class="contact-detail-item">
            <label>Date:</label>
            <div>${date}</div>
          </div>
          <div class="contact-detail-item">
            <label>Status:</label>
            <div>${this.getStatusBadge(status)}</div>
          </div>
          <div class="contact-detail-item">
            <label>Message:</label>
            <div class="contact-message-full">${this.escapeHtml(message)}</div>
          </div>
        </div>
        <div class="contact-modal-footer">
          <button class="btn-modern secondary" onclick="this.closest('.contact-modal-overlay').remove()">Close</button>
          <button class="btn-modern primary" onclick="window.contactView?.updateStatus('${id}', true)">Update Status</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }
  
  /**
   * Update submission status
   */
  async updateStatus(id, fromModal = false) {
    const submission = this.submissions.find(s => s.id === id);
    if (!submission) return;
    
    const currentStatus = submission.status || 'new';
    const statuses = ['new', 'read', 'replied', 'archived'];
    const currentIndex = statuses.indexOf(currentStatus);
    const nextIndex = (currentIndex + 1) % statuses.length;
    const nextStatus = statuses[nextIndex];
    
    // Ask for confirmation
    const confirmMessage = fromModal 
      ? `Change status from "${currentStatus}" to "${nextStatus}"?`
      : `Update status from "${currentStatus}" to "${nextStatus}"?`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
      const response = await apiService.put(`/api/admin/contact-submissions/${id}/status`, {
        status: nextStatus
      });
      
      if (response.success) {
        // Update local data
        submission.status = nextStatus;
        submission.updatedAt = new Date();
        
        this.updateSummary();
        this.filterAndRender();
        
        if (fromModal) {
          // Close modal and show updated view
          document.querySelector('.contact-modal-overlay')?.remove();
          this.viewSubmission(id);
        }
      } else {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      console.error('[ContactView] Error updating status:', error);
      alert(`Error updating status: ${error.message}`);
    }
  }
  
  /**
   * Get status badge HTML
   */
  getStatusBadge(status) {
    const badges = {
      new: '<span class="status-badge new">New</span>',
      read: '<span class="status-badge read">Read</span>',
      replied: '<span class="status-badge replied">Replied</span>',
      archived: '<span class="status-badge archived">Archived</span>'
    };
    return badges[status] || `<span class="status-badge">${status}</span>`;
  }
  
  /**
   * Format date
   */
  formatDate(date) {
    if (!date) return 'N/A';
    
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

