/**
 * Unsubscribe View - Manage unsubscribed users
 * Shows users who have unsubscribed from emails
 */

import { helpers } from '../utils/helpers.js';
import { apiService } from '../services/ApiService.js';

export class UnsubscribeView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.users = [];
    this.currentPage = 1;
    this.pageSize = 20;
    this.total = 0;
    this.searchTerm = '';
    this.filterType = 'all';
    
    this.init();
  }
  
  /**
   * Initialize view
   */
  init() {
    this.setupEventListeners();
    this.setupEmailDraftAssistant();
    this.loadUnsubscribedUsers();
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Search input
    const searchInput = helpers.dom('#unsubscribe-search-input');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.searchTerm = e.target.value;
          this.currentPage = 1;
          this.loadUnsubscribedUsers();
        }, 300);
      });
    }
    
    // Filter select
    const filterSelect = helpers.dom('#unsubscribe-type-filter-select');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        this.filterType = e.target.value;
        this.currentPage = 1;
        this.loadUnsubscribedUsers();
      });
    }
    
    // Export CSV button
    const exportBtn = helpers.dom('#export-unsubscribed-csv-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportToCSV());
    }
  }

  /**
   * Admin-only: generate marketing email HTML (English) via OpenAI; copy/paste only.
   */
  setupEmailDraftAssistant() {
    if (this._emailDraftAssistantBound) {
      return;
    }
    const genBtn = helpers.dom('#email-draft-generate-btn');
    const briefEl = helpers.dom('#email-draft-brief');
    const introEl = helpers.dom('#email-draft-intro');
    const panelEl = briefEl.closest('.email-draft-panel');
    const kindInputs = () =>
      panelEl ? Array.from(panelEl.querySelectorAll('input[name="email-draft-kind"]')) : [];
    if (!genBtn || !briefEl) {
      return;
    }
    this._emailDraftAssistantBound = true;

    const statusEl = helpers.dom('#email-draft-status');
    const errEl = helpers.dom('#email-draft-error');
    const outEl = helpers.dom('#email-draft-output');
    const subjectInput = helpers.dom('#email-draft-subject');
    const htmlTa = helpers.dom('#email-draft-html');
    const previewFrame = helpers.dom('#email-draft-preview-frame');
    const copySubjectBtn = helpers.dom('#email-draft-copy-subject');
    const copyHtmlBtn = helpers.dom('#email-draft-copy-html');

    const getSelectedDraftKind = () => {
      const radios = kindInputs();
      const hit = radios.find((r) => r.checked);
      const v = hit && hit.value;
      if (v === 'marketing' || v === 'general') return v;
      return 'product';
    };

    const syncEmailDraftKindUi = () => {
      const kind = getSelectedDraftKind();
      const phProduct = briefEl.getAttribute('data-placeholder-product') || '';
      const phMarketing = briefEl.getAttribute('data-placeholder-marketing') || phProduct;
      const phGeneral = briefEl.getAttribute('data-placeholder-general') || phProduct;
      if (kind === 'marketing') briefEl.placeholder = phMarketing;
      else if (kind === 'general') briefEl.placeholder = phGeneral;
      else briefEl.placeholder = phProduct;
      if (introEl) {
        if (kind === 'marketing') {
          introEl.textContent =
            'Write a short creative brief in Hebrew or English (angle, audience, desired CTA). You get a conversion-focused marketing email in English in the same HTML layout—not tied to one product release. Copy into Resend or your ESP—nothing is sent from here.';
        } else if (kind === 'general') {
          introEl.textContent =
            'Describe what the Specifys.ai team should say to users (Hebrew or English is fine). You get a respectful, professional email in English in the same layout—thanks, heads-up, support note, or similar—not a sales blast. Copy into Resend or your ESP—nothing is sent from here.';
        } else {
          introEl.textContent =
            'Describe the update in English (a few bullet points are enough). You get a short subject line and full HTML in a compact dark layout suited for newsletters. Copy into Resend or your ESP—nothing is sent from here.';
        }
      }
    };
    kindInputs().forEach((r) => r.addEventListener('change', syncEmailDraftKindUi));
    syncEmailDraftKindUi();

    const setStatus = (text) => {
      if (statusEl) statusEl.textContent = text || '';
    };

    const showError = (msg) => {
      if (!errEl) return;
      errEl.textContent = msg || 'Something went wrong.';
      errEl.classList.remove('hidden');
    };

    const clearError = () => {
      if (!errEl) return;
      errEl.textContent = '';
      errEl.classList.add('hidden');
    };

    const copyWithFeedback = async (text, button, doneLabel) => {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        if (button) {
          const prev = button.textContent;
          button.textContent = doneLabel || 'Copied';
          setTimeout(() => {
            button.textContent = prev;
          }, 1600);
        }
      } catch (e) {
        window.alert('Clipboard not available. Select and copy manually.');
      }
    };

    genBtn.addEventListener('click', async () => {
      const brief = (briefEl.value || '').trim();
      clearError();
      if (!brief) {
        showError('Please enter a brief describing the email you want.');
        return;
      }
      const emailDraftKind = getSelectedDraftKind();
      genBtn.disabled = true;
      setStatus('Generating…');
      if (outEl) outEl.classList.add('hidden');
      try {
        const data = await apiService.post('/api/admin/email/draft', { brief, emailDraftKind });
        if (!data.success || !data.html) {
          throw new Error(data.message || 'Invalid response');
        }
        if (subjectInput) subjectInput.value = data.subject || '';
        if (htmlTa) htmlTa.value = data.html;
        if (previewFrame) {
          previewFrame.srcdoc = data.html;
        }
        if (outEl) outEl.classList.remove('hidden');
        setStatus('Done. Copy subject and HTML below.');
      } catch (err) {
        const msg = err.message || String(err);
        showError(msg);
        setStatus('');
      } finally {
        genBtn.disabled = false;
      }
    });

    if (copySubjectBtn) {
      copySubjectBtn.addEventListener('click', () => {
        const t = subjectInput ? subjectInput.value : '';
        copyWithFeedback(t, copySubjectBtn, 'Copied');
      });
    }
    if (copyHtmlBtn) {
      copyHtmlBtn.addEventListener('click', () => {
        const t = htmlTa ? htmlTa.value : '';
        copyWithFeedback(t, copyHtmlBtn, 'Copied');
      });
    }
  }
  
  /**
   * Load unsubscribed users
   */
  async loadUnsubscribedUsers() {
    try {
      const params = new URLSearchParams({
        limit: 1000,
        ...(this.searchTerm && { search: this.searchTerm })
      });
      
      const response = await apiService.get(`/api/admin/unsubscribed-users?${params}`);
      
      if (response.success && response.users) {
        // Apply filter
        let filteredUsers = response.users;
        if (this.filterType === 'newsletter') {
          filteredUsers = filteredUsers.filter(u => u.unsubscribedFrom.includes('newsletter'));
        } else if (this.filterType === 'all_emails') {
          filteredUsers = filteredUsers.filter(u => u.unsubscribedFrom.includes('all_emails'));
        }
        
        this.users = filteredUsers;
        this.total = response.total || filteredUsers.length;
        
        this.updateStats();
        this.renderTable();
        this.renderPagination();
      }
    } catch (error) {
      console.error('[UnsubscribeView] Error loading unsubscribed users:', error);
      const tbody = helpers.dom('#unsubscribe-table tbody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="5" class="table-empty-state">Error loading data</td></tr>';
      }
    }
  }
  
  /**
   * Update statistics
   */
  updateStats() {
    const totalEl = helpers.dom('#unsubscribed-total');
    const newsletterEl = helpers.dom('#unsubscribed-newsletter');
    const allEmailsEl = helpers.dom('#unsubscribed-all');
    
    const total = this.users.length;
    const newsletter = this.users.filter(u => u.unsubscribedFrom.includes('newsletter')).length;
    const allEmails = this.users.filter(u => u.unsubscribedFrom.includes('all_emails')).length;
    
    if (totalEl) totalEl.textContent = total;
    if (newsletterEl) newsletterEl.textContent = newsletter;
    if (allEmailsEl) allEmailsEl.textContent = allEmails;
  }
  
  /**
   * Render table
   */
  renderTable() {
    const tbody = helpers.dom('#unsubscribe-table tbody');
    if (!tbody) return;
    
    if (this.users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty-state">No unsubscribed users found</td></tr>';
      return;
    }
    
    // Paginate
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    const paginatedUsers = this.users.slice(start, end);
    
    const html = paginatedUsers.map(user => {
      const unsubscribedFrom = user.unsubscribedFrom.map(type => {
        if (type === 'newsletter') return 'Newsletter';
        if (type === 'all_emails') return 'All Emails';
        return type;
      }).join(', ');
      
      const date = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US') : 'N/A';
      
      return `
        <tr>
          <td>${this.escapeHtml(user.email || 'N/A')}</td>
          <td><code style="font-size: 0.85em;">${this.escapeHtml(user.userId)}</code></td>
          <td>${this.escapeHtml(unsubscribedFrom)}</td>
          <td>${date}</td>
          <td>
            <button class="btn-modern btn-small" onclick="window.unsubscribeView?.viewUser('${user.userId}')" title="View user details">
              <i class="fas fa-eye"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
    
    tbody.innerHTML = html;
  }
  
  /**
   * Render pagination
   */
  renderPagination() {
    const paginationEl = helpers.dom('#unsubscribe-pagination');
    if (!paginationEl) return;
    
    const totalPages = Math.ceil(this.users.length / this.pageSize);
    
    if (totalPages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }
    
    let html = '<div class="pagination-controls">';
    
    // Previous button
    html += `
      <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">
        <i class="fas fa-chevron-left"></i>
      </button>
    `;
    
    // Page numbers
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(totalPages, this.currentPage + 2);
    
    if (startPage > 1) {
      html += `<button class="pagination-btn" data-page="1">1</button>`;
      if (startPage > 2) {
        html += `<span class="pagination-ellipsis">...</span>`;
      }
    }
    
    for (let i = startPage; i <= endPage; i++) {
      html += `
        <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">
          ${i}
        </button>
      `;
    }
    
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        html += `<span class="pagination-ellipsis">...</span>`;
      }
      html += `<button class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }
    
    // Next button
    html += `
      <button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${this.currentPage + 1}">
        <i class="fas fa-chevron-right"></i>
      </button>
    `;
    
    html += '</div>';
    paginationEl.innerHTML = html;
    
    // Add event listeners
    paginationEl.querySelectorAll('.pagination-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const page = parseInt(btn.dataset.page);
        if (page && !btn.disabled) {
          this.currentPage = page;
          this.renderTable();
          this.renderPagination();
        }
      });
    });
  }
  
  /**
   * View user details
   */
  viewUser(userId) {
    // Open user details modal or navigate to user
    window.location.hash = `#users-section`;
    // Trigger user view to show this user
    const event = new CustomEvent('showUser', { detail: { userId } });
    window.dispatchEvent(event);
  }
  
  /**
   * Export to CSV
   */
  async exportToCSV() {
    try {
      const response = await apiService.get('/api/admin/unsubscribed-users?limit=10000');
      
      if (response.success && response.users) {
        // Apply same filters
        let filteredUsers = response.users;
        if (this.filterType === 'newsletter') {
          filteredUsers = filteredUsers.filter(u => u.unsubscribedFrom.includes('newsletter'));
        } else if (this.filterType === 'all_emails') {
          filteredUsers = filteredUsers.filter(u => u.unsubscribedFrom.includes('all_emails'));
        }
        
        // Create CSV
        const headers = ['Email', 'User ID', 'Unsubscribed From', 'Created At', 'Last Active'];
        const rows = filteredUsers.map(user => [
          user.email || '',
          user.userId || '',
          user.unsubscribedFrom.join('; '),
          user.createdAt ? new Date(user.createdAt).toISOString() : '',
          user.lastActive ? new Date(user.lastActive).toISOString() : ''
        ]);
        
        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        // Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `unsubscribed-users-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('[UnsubscribeView] Error exporting CSV:', error);
      alert('Failed to export CSV: ' + (error.message || 'Unknown error'));
    }
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
    this.loadUnsubscribedUsers();
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
    this.loadUnsubscribedUsers();
  }
}

