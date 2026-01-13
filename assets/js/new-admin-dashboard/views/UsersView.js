/**
 * Users View - Complete user management
 * Redesigned with quick summary, filters, and full control
 */

import { helpers } from '../utils/helpers.js';
import { UserDetailsModal } from '../components/UserDetailsModal.js';

export class UsersView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.table = null;
    this.currentPage = 1;
    this.perPage = 25;
    this.selectedUsers = new Set();
    this.userDetailsModal = new UserDetailsModal();
    
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
    const searchInput = helpers.dom('#users-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', helpers.debounce(() => {
        this.currentPage = 1;
        this.updateSummary();
        this.render();
      }, 300));
    }
    
    // Filters
    const planFilter = helpers.dom('#users-plan-filter-select');
    if (planFilter) {
      planFilter.addEventListener('change', () => {
        this.currentPage = 1;
        this.updateSummary();
        this.render();
      });
    }
    
    const statusFilter = helpers.dom('#users-status-filter-select');
    if (statusFilter) {
      statusFilter.addEventListener('change', () => {
        this.currentPage = 1;
        this.updateSummary();
        this.render();
      });
    }
    
    const dateFrom = helpers.dom('#users-date-from-input');
    const dateTo = helpers.dom('#users-date-to-input');
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
      if (source === 'users' || source === 'specs') {
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
    const allUsers = allData.users || [];
    
    // Total users - ALL users, no filters
    const totalUsers = allUsers.length;
    this.updateSummaryValue('stat-total-users', totalUsers);
    
    // Pro users - check from user plan
    const proUsers = allUsers.filter(u => {
      return u.plan === 'pro' || u.plan === 'Pro';
    }).length;
    this.updateSummaryValue('stat-pro-users', proUsers);
    
    // Active users (30 days) - users active in last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const activeUsers = allUsers.filter(u => {
      if (!u.lastActive) return false;
      const lastActive = u.lastActive instanceof Date ? u.lastActive.getTime() : new Date(u.lastActive).getTime();
      return lastActive >= thirtyDaysAgo;
    }).length;
    this.updateSummaryValue('stat-active-users', activeUsers);
    
    // New users (7 days) - users created in last 7 days
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const newUsers = allUsers.filter(u => {
      if (!u.createdAt) return false;
      const created = u.createdAt instanceof Date ? u.createdAt.getTime() : new Date(u.createdAt).getTime();
      return created >= sevenDaysAgo;
    }).length;
    this.updateSummaryValue('stat-new-users', newUsers);
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
  filterUsers(users, applyDateFilter = true) {
    // Search filter
    const searchInput = helpers.dom('#users-search-input');
    const searchTerm = searchInput?.value.trim().toLowerCase() || '';
    
    if (searchTerm) {
      users = users.filter(user => {
        const haystack = `${user.email || ''} ${user.displayName || ''} ${user.id || ''}`.toLowerCase();
        return haystack.includes(searchTerm);
      });
    }
    
    // Plan filter
    const planFilter = helpers.dom('#users-plan-filter-select');
    const planValue = planFilter?.value || 'all';
    
    if (planValue !== 'all') {
      users = users.filter(user => {
        if (planValue === 'pro') {
          return user.plan === 'pro' || user.plan === 'Pro';
        }
        return user.plan !== 'pro' && user.plan !== 'Pro';
      });
    }
    
    // Status filter
    const statusFilter = helpers.dom('#users-status-filter-select');
    const statusValue = statusFilter?.value || 'all';
    
    if (statusValue !== 'all') {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      users = users.filter(user => {
        if (!user.lastActive) return statusValue === 'inactive';
        const lastActive = user.lastActive instanceof Date ? user.lastActive.getTime() : new Date(user.lastActive).getTime();
        if (statusValue === 'active') {
          return lastActive >= thirtyDaysAgo;
        } else {
          return lastActive < thirtyDaysAgo;
        }
      });
    }
    
    // Date filter
    if (applyDateFilter) {
      const dateFrom = helpers.dom('#users-date-from-input');
      const dateTo = helpers.dom('#users-date-to-input');
      
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
    users = this.filterUsers(users);
    
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
      // Get credits from normalized user data
      // DataManager.normalizeUser already handles:
      // - Parsing free_specs_remaining from Firebase
      // - Defaulting to 1 if not set
      // - Ensuring it's always a number
      // So we can directly use user.freeSpecsRemaining
      const credits = typeof user.freeSpecsRemaining === 'number' 
        ? user.freeSpecsRemaining 
        : 1; // Fallback to 1 if somehow not a number
      
      // Debug log for first few users to troubleshoot
      if (pageUsers.indexOf(user) < 3) {
        console.log(`[UsersView] User ${user.email} credits:`, {
          credits,
          freeSpecsRemaining: user.freeSpecsRemaining,
          raw_free_specs_remaining: user.metadata?.free_specs_remaining,
          type: typeof user.freeSpecsRemaining
        });
      }
      
      const specCount = allData.specsByUser[user.id]?.length || 0;
      // Check plan from user document
      const plan = (user.plan === 'pro' || user.plan === 'Pro') ? 'Pro' : 'Free';
      const isSelected = this.selectedUsers.has(user.id);
      
      return `
        <tr data-user-id="${user.id}">
          <td>
            <input type="checkbox" class="user-checkbox" data-user-id="${user.id}" ${isSelected ? 'checked' : ''}>
          </td>
          <td>
            <div class="user-info">
              <div class="user-name clickable" data-user-id="${user.id}" style="cursor: pointer; color: var(--admin-accent); text-decoration: underline;">${this.escapeHtml(user.displayName)}</div>
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
              <button class="action-btn small critical" data-user-id="${user.id}" data-action="delete" title="Delete user">
                <i class="fas fa-trash"></i>
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
    
    // Add click listeners to user names (both classes: user-name and clickable)
    this.table.querySelectorAll('.user-name.clickable, .user-name[data-user-id]').forEach(nameEl => {
      nameEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const userId = e.currentTarget.dataset.userId;
        if (userId) {
          this.viewUser(userId);
        }
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
    
    switch (action) {
      case 'edit':
        this.editUser(userId);
        break;
      case 'view':
        this.viewUser(userId);
        break;
      case 'delete':
        this.deleteUser(userId);
        break;
      default:
        console.warn(`[UsersView] Unknown action: ${action}`);
    }
  }
  
  /**
   * Edit user
   */
  async editUser(userId) {
    const allData = this.dataManager.getAllData();
    const user = allData.users.find(u => u.id === userId);
    
    if (!user) {
      alert('User not found');
      return;
    }
    
    // Show edit modal
    this.showEditUserModal(user);
  }
  
  /**
   * Show edit user modal
   */
  showEditUserModal(user) {
    // Remove existing modal if any
    const existingModal = document.getElementById('edit-user-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Get current values
    const currentCredits = typeof user.freeSpecsRemaining === 'number' ? user.freeSpecsRemaining : 1;
    const currentPlan = (user.plan || 'free').toLowerCase();
    
    // Create modal HTML
    const modalHTML = `
      <div class="modal-overlay" id="edit-user-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Edit User</h2>
            <button class="modal-close" id="edit-user-modal-close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="edit-user-email" value="${this.escapeHtml(user.email)}" disabled>
              <small class="field-hint">Email cannot be changed</small>
            </div>
            <div class="form-group">
              <label>Display Name</label>
              <input type="text" id="edit-user-display-name" value="${this.escapeHtml(user.displayName || '')}">
            </div>
            <div class="form-group">
              <label>Plan</label>
              <select id="edit-user-plan">
                <option value="free" ${currentPlan === 'free' ? 'selected' : ''}>Free</option>
                <option value="pro" ${currentPlan === 'pro' ? 'selected' : ''}>Pro</option>
              </select>
            </div>
            <div class="form-group">
              <label>Free Specs Remaining (Credits)</label>
              <input type="number" id="edit-user-credits" min="0" step="1" value="${currentCredits}">
              <small class="field-hint">Number of free specs the user can create</small>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-modern" id="edit-user-cancel-btn">Cancel</button>
            <button class="btn-modern primary" id="edit-user-save-btn">
              <i class="fas fa-save"></i>
              Save Changes
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById('edit-user-modal');
    
    // Setup event listeners
    const closeBtn = document.getElementById('edit-user-modal-close');
    const cancelBtn = document.getElementById('edit-user-cancel-btn');
    const saveBtn = document.getElementById('edit-user-save-btn');
    
    const closeModal = () => {
      modal.remove();
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
    
    // Save changes
    saveBtn.addEventListener('click', async () => {
      const newPlan = document.getElementById('edit-user-plan').value;
      const newCredits = parseInt(document.getElementById('edit-user-credits').value, 10);
      const newDisplayName = document.getElementById('edit-user-display-name').value.trim();
      
      if (isNaN(newCredits) || newCredits < 0) {
        alert('Please enter a valid number of credits (0 or higher)');
        return;
      }
      
      if (!newDisplayName) {
        alert('Please enter a display name');
        return;
      }
      
      // Disable save button
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
      
      try {
        const { firebaseService } = await import('../core/FirebaseService.js');
        
        // Update user data
        const updates = {};
        
        // Update plan if changed
        if (newPlan !== currentPlan) {
          await firebaseService.updateUserPlan(user.id, newPlan);
          updates.plan = newPlan;
        }
        
        // Update credits if changed
        if (newCredits !== currentCredits) {
          await firebaseService.updateUserCredits(user.id, newCredits);
          updates.free_specs_remaining = newCredits;
        }
        
        // Update display name if changed
        if (newDisplayName !== user.displayName) {
          await firebaseService.updateUser(user.id, {
            displayName: newDisplayName
          });
          updates.displayName = newDisplayName;
        }
        
        // Show success message
        saveBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
        saveBtn.classList.add('success');
        
        setTimeout(() => {
          closeModal();
          // Refresh the view
          this.updateSummary();
          this.render();
        }, 1000);
        
      } catch (error) {
        console.error('[UsersView] Error updating user:', error);
        alert(`Error updating user: ${error.message}`);
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
      }
    });
  }
  
  /**
   * View user details
   */
  viewUser(userId) {
    console.log(`[UsersView] View user: ${userId}`);
    this.userDetailsModal.show(userId);
  }
  
  /**
   * Delete user
   */
  async deleteUser(userId) {
    const allData = this.dataManager.getAllData();
    const user = allData.users.find(u => u.id === userId);
    
    if (!user) {
      alert('User not found');
      return;
    }
    
    // Confirm deletion
    const confirmed = confirm(
      `Are you sure you want to delete user "${user.email || user.displayName || userId}"?\n\n` +
      `This action cannot be undone. All user data including specs and purchases will be permanently deleted.`
    );
    
    if (!confirmed) return;
    
    try {
      // Get Firebase service
      const { firebaseService } = await import('../core/FirebaseService.js');
      
      // Delete user document
      // Note: Credits are stored in users/{userId}/free_specs_remaining
      // No need to delete separate credits document
      await firebaseService.deleteDocument('users', userId);
      
      // Show success message
      alert(`User "${user.email || user.displayName || userId}" has been deleted successfully.`);
      
      // Refresh the view
      this.updateSummary();
      this.render();
      
    } catch (error) {
      console.error('[UsersView] Error deleting user:', error);
      alert(`Error deleting user: ${error.message}`);
    }
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
    const users = this.filterUsers(allData.users);
    
    const headers = ['Email', 'Name', 'Plan', 'Specs', 'Credits', 'Created', 'Last Active'];
    const rows = users.map(user => {
      // Get credits from normalized user data
      // DataManager.normalizeUser already handles parsing and defaulting
      const credits = typeof user.freeSpecsRemaining === 'number' 
        ? user.freeSpecsRemaining 
        : 1; // Fallback to 1 if somehow not a number
      const specCount = allData.specsByUser[user.id]?.length || 0;
      const plan = (user.plan === 'pro' || user.plan === 'Pro') ? 'Pro' : 'Free';
      
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
    
    // Setup action listeners after render
    setTimeout(() => {
      this.setupActionListeners();
    }, 100);
  }
  
  /**
   * Setup action listeners
   */
  setupActionListeners() {
    if (!this.table) return;
    
    // Add action button listeners
    this.table.querySelectorAll('[data-action]').forEach(btn => {
      // Remove existing listeners by cloning
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      // Add new listener
      newBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = e.currentTarget.dataset.action;
        const userId = e.currentTarget.dataset.userId;
        this.handleUserAction(action, userId);
      });
    });
  }
  
  /**
   * Hide view
   */
  hide() {
    // Cleanup if needed
  }
}
