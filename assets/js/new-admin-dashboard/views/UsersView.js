/**
 * Users View - Complete user management
 * Redesigned with quick summary, filters, and full control
 */

import { helpers } from '../utils/helpers.js';

export class UsersView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.table = null;
    this.currentPage = 1;
    this.perPage = 25;
    this.selectedUsers = new Set();
    
    this.init();
  }
  
  /**
   * Initialize view
   */
  init() {
    this.table = helpers.dom('#users-table tbody');
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Subscribe to data changes
    this.setupDataSubscriptions();
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Search
    const searchInput = helpers.dom('#users-search');
    if (searchInput) {
      searchInput.addEventListener('input', helpers.debounce(() => {
        this.currentPage = 1;
        this.updateSummary();
        this.render();
      }, 300));
    }
    
    // Filters
    const planFilter = helpers.dom('#users-plan-filter');
    if (planFilter) {
      planFilter.addEventListener('change', () => {
        this.currentPage = 1;
        this.updateSummary();
        this.render();
      });
    }
    
    const statusFilter = helpers.dom('#users-status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', () => {
        this.currentPage = 1;
        this.updateSummary();
        this.render();
      });
    }
    
    const dateFrom = helpers.dom('#users-date-from');
    const dateTo = helpers.dom('#users-date-to');
    if (dateFrom) {
      dateFrom.addEventListener('change', () => {
        this.currentPage = 1;
        this.updateSummary();
        this.render();
      });
    }
    if (dateTo) {
      dateTo.addEventListener('change', () => {
        this.currentPage = 1;
        this.updateSummary();
        this.render();
      });
    }
    
    // Select all
    const selectAll = helpers.dom('#users-select-all');
    if (selectAll) {
      selectAll.addEventListener('change', (e) => {
        this.toggleSelectAll(e.target.checked);
      });
    }
    
    // Export buttons
    const exportBtn = helpers.dom('#export-users-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportCSV();
      });
    }
    
    const exportPdfBtn = helpers.dom('#export-users-pdf-btn');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => {
        this.exportPDF();
      });
    }
    
    // Bulk actions
    const bulkActionsBtn = helpers.dom('#bulk-actions-btn');
    if (bulkActionsBtn) {
      bulkActionsBtn.addEventListener('click', () => {
        this.showBulkActions();
      });
    }
  }
  
  /**
   * Setup data subscriptions
   */
  setupDataSubscriptions() {
    this.dataManager.on('data', ({ source, data }) => {
      if (source === 'users' || source === 'userCredits' || source === 'specs') {
        this.updateSummary();
        this.render();
      }
    });
  }
  
  /**
   * Update summary cards
   */
  updateSummary() {
    const allData = this.dataManager.getAllData();
    let users = allData.users;
    
    // Apply filters (but not pagination)
    users = this.filterUsers(users, allData.userCredits, false);
    
    // Total users
    const totalUsers = users.length;
    this.updateSummaryValue('summary-total-users', totalUsers);
    
    // Pro users
    const proUsers = users.filter(u => {
      const userCredits = allData.userCredits.find(uc => uc.userId === u.id);
      return userCredits?.unlimited || u.plan === 'pro';
    }).length;
    this.updateSummaryValue('summary-pro-users', proUsers);
    
    // Active users (30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const activeUsers = users.filter(u => {
      if (!u.lastActive) return false;
      return u.lastActive.getTime() >= thirtyDaysAgo;
    }).length;
    this.updateSummaryValue('summary-active-users', activeUsers);
    
    // New users (7 days)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const newUsers = users.filter(u => {
      if (!u.createdAt) return false;
      return u.createdAt.getTime() >= sevenDaysAgo;
    }).length;
    this.updateSummaryValue('summary-new-users', newUsers);
  }
  
  /**
   * Update summary value
   */
  updateSummaryValue(id, value) {
    const element = helpers.dom(`#${id}`);
    if (element) {
      element.textContent = value.toLocaleString();
    }
  }
  
  /**
   * Filter users
   */
  filterUsers(users, userCredits, applyDateFilter = true) {
    // Search filter
    const searchInput = helpers.dom('#users-search');
    const searchTerm = searchInput?.value.trim().toLowerCase() || '';
    
    if (searchTerm) {
      users = users.filter(user => {
        const haystack = `${user.email} ${user.displayName} ${user.id}`.toLowerCase();
        return haystack.includes(searchTerm);
      });
    }
    
    // Plan filter
    const planFilter = helpers.dom('#users-plan-filter');
    const planValue = planFilter?.value || 'all';
    
    if (planValue !== 'all') {
      users = users.filter(user => {
        const userCredit = userCredits.find(uc => uc.userId === user.id);
        if (planValue === 'pro') {
          return userCredit?.unlimited || user.plan === 'pro';
        }
        return !userCredit?.unlimited && user.plan !== 'pro';
      });
    }
    
    // Status filter
    const statusFilter = helpers.dom('#users-status-filter');
    const statusValue = statusFilter?.value || 'all';
    
    if (statusValue !== 'all') {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      users = users.filter(user => {
        if (statusValue === 'active') {
          return user.lastActive && user.lastActive.getTime() >= thirtyDaysAgo;
        } else {
          return !user.lastActive || user.lastActive.getTime() < thirtyDaysAgo;
        }
      });
    }
    
    // Date filter
    if (applyDateFilter) {
      const dateFrom = helpers.dom('#users-date-from');
      const dateTo = helpers.dom('#users-date-to');
      
      if (dateFrom?.value) {
        const fromDate = new Date(dateFrom.value);
        fromDate.setHours(0, 0, 0, 0);
        users = users.filter(user => {
          if (!user.createdAt) return false;
          return user.createdAt >= fromDate;
        });
      }
      
      if (dateTo?.value) {
        const toDate = new Date(dateTo.value);
        toDate.setHours(23, 59, 59, 999);
        users = users.filter(user => {
          if (!user.createdAt) return false;
          return user.createdAt <= toDate;
        });
      }
    }
    
    // Sort by creation date
    users.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    
    return users;
  }
  
  /**
   * Render users table
   */
  render() {
    if (!this.table) return;
    
    const allData = this.dataManager.getAllData();
    let users = allData.users;
    
    // Apply filters
    users = this.filterUsers(users, allData.userCredits);
    
    // Pagination
    const totalPages = Math.ceil(users.length / this.perPage);
    const startIndex = (this.currentPage - 1) * this.perPage;
    const endIndex = startIndex + this.perPage;
    const pageUsers = users.slice(startIndex, endIndex);
    
    if (pageUsers.length === 0) {
      this.table.innerHTML = '<tr><td colspan="8" class="table-empty">No users found</td></tr>';
      this.renderPagination(0, 0);
      return;
    }
    
    // Render table
    const html = pageUsers.map(user => {
      // Find user credits - check both userId and direct id match
      const userCredits = allData.userCredits.find(uc => 
        uc.userId === user.id || uc.id === user.id
      );
      
      // Calculate credits - use total if available, otherwise calculate from balances
      let credits = 0;
      if (userCredits) {
        if (userCredits.unlimited) {
          credits = 'Unlimited';
        } else {
          credits = userCredits.total || 
            ((userCredits.balances?.free || 0) + 
             (userCredits.balances?.paid || 0) + 
             (userCredits.balances?.bonus || 0));
        }
      }
      
      const specCount = allData.specsByUser[user.id]?.length || 0;
      const plan = userCredits?.unlimited ? 'Pro' : (user.plan || 'Free');
      const isSelected = this.selectedUsers.has(user.id);
      
      return `
        <tr data-user-id="${user.id}">
          <td>
            <input type="checkbox" class="user-checkbox" data-user-id="${user.id}" ${isSelected ? 'checked' : ''}>
          </td>
          <td>
            <div class="user-info">
              <div class="user-name">${this.escapeHtml(user.displayName)}</div>
              <div class="user-email">${this.escapeHtml(user.email)}</div>
            </div>
          </td>
          <td>${helpers.formatDate(user.createdAt)}</td>
          <td><span class="plan-badge plan-${plan.toLowerCase()}">${plan}</span></td>
          <td>${specCount}</td>
          <td>${credits}</td>
          <td>${helpers.formatRelative(user.lastActive)}</td>
          <td>
            <div class="action-buttons">
              <button class="action-btn small" data-user-id="${user.id}" data-action="edit" title="Edit user">
                <i class="fas fa-edit"></i>
              </button>
              <button class="action-btn small" data-user-id="${user.id}" data-action="view" title="View details">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
    this.table.innerHTML = html;
    
    // Add checkbox listeners
    this.table.querySelectorAll('.user-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const userId = e.target.dataset.userId;
        if (e.target.checked) {
          this.selectedUsers.add(userId);
        } else {
          this.selectedUsers.delete(userId);
        }
        this.updateBulkActions();
      });
    });
    
    // Add action button listeners
    this.table.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        const userId = e.currentTarget.dataset.userId;
        this.handleUserAction(action, userId);
      });
    });
    
    // Render pagination
    this.renderPagination(users.length, totalPages);
  }
  
  /**
   * Toggle select all
   */
  toggleSelectAll(checked) {
    const allCheckboxes = this.table.querySelectorAll('.user-checkbox');
    allCheckboxes.forEach(checkbox => {
      checkbox.checked = checked;
      const userId = checkbox.dataset.userId;
      if (checked) {
        this.selectedUsers.add(userId);
      } else {
        this.selectedUsers.delete(userId);
      }
    });
    this.updateBulkActions();
  }
  
  /**
   * Update bulk actions button
   */
  updateBulkActions() {
    const count = this.selectedUsers.size;
    const bulkBtn = helpers.dom('#bulk-actions-btn');
    const countSpan = helpers.dom('#bulk-selected-count');
    
    if (bulkBtn && countSpan) {
      countSpan.textContent = count;
      if (count > 0) {
        bulkBtn.style.display = 'flex';
      } else {
        bulkBtn.style.display = 'none';
      }
    }
  }
  
  /**
   * Handle user action
   */
  handleUserAction(action, userId) {
    console.log(`[UsersView] Action: ${action} for user: ${userId}`);
    // TODO: Implement edit/view actions
  }
  
  /**
   * Show bulk actions
   */
  showBulkActions() {
    const count = this.selectedUsers.size;
    if (count === 0) return;
    
    // TODO: Show bulk actions modal
    console.log(`[UsersView] Bulk actions for ${count} users`);
  }
  
  /**
   * Render pagination
   */
  renderPagination(totalUsers, totalPages) {
    const paginationWrapper = helpers.dom('#users-pagination');
    if (!paginationWrapper) return;
    
    if (totalPages <= 1) {
      paginationWrapper.classList.add('hidden');
      return;
    }
    
    paginationWrapper.classList.remove('hidden');
    
    const currentPage = this.currentPage;
    const pages = [];
    
    // Generate page numbers
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
        pages.push(i);
      } else if (i === currentPage - 3 || i === currentPage + 3) {
        pages.push('...');
      }
    }
    
    const html = `
      <div class="pagination-info">
        <span>Showing ${((currentPage - 1) * this.perPage) + 1}-${Math.min(currentPage * this.perPage, totalUsers)} of ${totalUsers}</span>
      </div>
      <div class="pagination-controls">
        <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">
          <i class="fas fa-chevron-left"></i> Previous
        </button>
        <div class="pagination-pages">
          ${pages.map(page => 
            page === '...' 
              ? '<span class="pagination-ellipsis">...</span>'
              : `<button class="pagination-btn ${page === currentPage ? 'active' : ''}" data-page="${page}">${page}</button>`
          ).join('')}
        </div>
        <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">
          Next <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    `;
    
    paginationWrapper.innerHTML = html;
    
    // Add event listeners
    paginationWrapper.querySelectorAll('.pagination-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page);
        if (page && page !== currentPage && !btn.disabled) {
          this.currentPage = page;
          this.render();
        }
      });
    });
  }
  
  /**
   * Export to CSV
   */
  exportCSV() {
    const allData = this.dataManager.getAllData();
    const users = this.filterUsers(allData.users, allData.userCredits);
    
    const headers = ['Email', 'Name', 'Plan', 'Specs', 'Credits', 'Created', 'Last Active'];
    const rows = users.map(user => {
      const userCredits = allData.userCredits.find(uc => uc.userId === user.id);
      const specCount = allData.specsByUser[user.id]?.length || 0;
      const credits = userCredits?.total || 0;
      const plan = userCredits?.unlimited ? 'Pro' : (user.plan || 'Free');
      
      return [
        user.email,
        user.displayName,
        plan,
        specCount,
        credits,
        user.createdAt ? user.createdAt.toISOString() : '',
        user.lastActive ? user.lastActive.toISOString() : ''
      ];
    });
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  /**
   * Export to PDF (placeholder)
   */
  exportPDF() {
    console.log('[UsersView] PDF export not yet implemented');
    // TODO: Implement PDF export
  }
  
  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Show view
   */
  show() {
    this.updateSummary();
    this.render();
  }
  
  /**
   * Hide view
   */
  hide() {
    // Cleanup if needed
  }
}
