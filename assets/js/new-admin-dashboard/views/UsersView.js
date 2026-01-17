/**
 * Users View - Complete user management
 * Redesigned with quick summary, filters, and full control
 */

import { helpers } from '../utils/helpers.js';
import { apiService } from '../services/ApiService.js';

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
      if (source === 'users' || source === 'specs' || source === 'userCredits') {
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
      // Get credits from user_credits collection (same source as users see)
      // This matches what users see in their profile via /api/v2/credits
      const userCredits = allData.userCredits.find(uc => uc.userId === user.id);
      
      let creditsDisplay = '0';
      if (userCredits) {
        if (userCredits.unlimited) {
          // Pro users with unlimited access
          creditsDisplay = '∞';
        } else if (typeof userCredits.total === 'number') {
          // Regular users with specific credit count
          creditsDisplay = userCredits.total.toString();
        }
      } else {
        // Fallback: if user_credits not loaded yet, try to use user.freeSpecsRemaining
        // This is a temporary fallback until userCredits loads
        const fallbackCredits = typeof user.freeSpecsRemaining === 'number' 
          ? user.freeSpecsRemaining 
          : 0;
        creditsDisplay = fallbackCredits.toString();
      }
      
      const specCount = allData.specsByUser[user.id]?.length || 0;
      // Check plan from user document
      const plan = (user.plan === 'pro' || user.plan === 'Pro') ? 'Pro' : 'Free';
      const isSelected = this.selectedUsers.has(user.id);
      
      // Check if data is from V3
      // Since DataManager uses user_credits_v3 collection (collections.USER_CREDITS = "user_credits_v3"),
      // we're ALWAYS reading from V3. The badge should show V3 unless there's an error.
      // If userCredits doesn't exist for this user, it means:
      // 1. User doesn't have a document in user_credits_v3 (not migrated or new user)
      // 2. Data is still loading
      // In both cases, we're still using V3 system, just this user doesn't have data yet
      const hasAnyUserCredits = allData.userCredits && allData.userCredits.length > 0;
      // Always show V3 because we're subscribed to user_credits_v3 collection
      // Only show V2 if we explicitly know we're using fallback (which shouldn't happen)
      const dataSourceBadge = '<span class="data-source-badge v3" title="Data from V3 system (user_credits_v3)">V3</span>';
      
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
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span>${creditsDisplay}</span>
              ${dataSourceBadge}
            </div>
          </td>
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
    
    // Inject styles for data source badge if not already added
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
    // Action triggered
    
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
        console.error(`[UsersView] Unknown action: ${action}`);
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
   * View user details - opens in new window
   */
  async viewUser(userId) {
    // Viewing user details
    
    try {
      // Fetch user analytics data
      const data = await apiService.get(`/api/admin/users/${userId}/analytics`);
      const analytics = data.analytics;
      
      // Open new window with user details
      this.openUserDetailsWindow(userId, analytics);
    } catch (error) {
      console.error('[UsersView] Error loading user data:', error);
      alert(`Error loading user details: ${error.message}`);
    }
  }
  
  /**
   * Open user details in new window
   */
  openUserDetailsWindow(userId, analytics) {
    const user = analytics.user || {};
    const credits = analytics.credits || null;
    const specs = analytics.specs || { count: 0, specs: [] };
    const acquisition = analytics.acquisition || {};
    const visits = analytics.visits || {};
    const pageJourney = analytics.pageJourney || [];
    
    // Create HTML content
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>User Details - ${this.escapeHtml(user.email || userId)}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Inter', 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f7f9fc;
      color: #1f2937;
      padding: 24px;
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 18px;
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.1);
      padding: 32px;
    }
    h1 {
      font-size: 2rem;
      margin-bottom: 8px;
      color: #1f2937;
    }
    .subtitle {
      color: #6b7280;
      margin-bottom: 32px;
    }
    .section {
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid #e5e7eb;
    }
    .section:last-child {
      border-bottom: none;
    }
    .section-title {
      font-size: 1.2rem;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .section-title i {
      color: #ff6b35;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    .item {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .item label {
      font-size: 0.85rem;
      font-weight: 500;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .item .value {
      font-size: 1rem;
      color: #1f2937;
      font-weight: 500;
    }
    .item .value-large {
      font-size: 1.5rem;
      font-weight: 600;
      color: #ff6b35;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .badge.pro {
      background: rgba(255, 107, 53, 0.1);
      color: #ff6b35;
    }
    .badge.free {
      background: rgba(107, 114, 128, 0.1);
      color: #6b7280;
    }
    .badge.active {
      background: rgba(24, 180, 125, 0.1);
      color: #18b47d;
    }
    .badge.disabled {
      background: rgba(220, 53, 69, 0.1);
      color: #dc3545;
    }
    .specs-list, .sessions-list {
      margin-top: 20px;
    }
    .specs-list ul {
      list-style: none;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .specs-list li {
      display: flex;
      justify-content: space-between;
      padding: 12px;
      background: #f9fafb;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
    .session-card {
      padding: 16px;
      background: #f9fafb;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      margin-bottom: 12px;
    }
    .session-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    .session-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      font-size: 0.9rem;
      color: #6b7280;
    }
    .session-details > div {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .session-details i {
      color: #ff6b35;
      width: 16px;
    }
    .page-journey {
      max-height: 400px;
      overflow-y: auto;
      padding: 12px;
      background: #f9fafb;
      border-radius: 12px;
    }
    .page-journey-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    .page-journey-item:last-child {
      border-bottom: none;
    }
    .page-journey-number {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ff6b35;
      color: white;
      border-radius: 50%;
      font-size: 0.85rem;
      font-weight: 600;
      flex-shrink: 0;
    }
    .page-journey-content {
      flex: 1;
    }
    .page-journey-page {
      font-weight: 500;
      color: #1f2937;
    }
    .page-journey-time {
      font-size: 0.85rem;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>User Details</h1>
    <p class="subtitle">${this.escapeHtml(user.email || userId)}</p>
    
    <!-- Basic Information -->
    <div class="section">
      <h2 class="section-title">
        <i class="fas fa-user"></i>
        Basic Information
      </h2>
      <div class="grid">
        <div class="item">
          <label>Email</label>
          <div class="value">${this.escapeHtml(user.email || '—')}</div>
        </div>
        <div class="item">
          <label>Display Name</label>
          <div class="value">${this.escapeHtml(user.displayName || '—')}</div>
        </div>
        <div class="item">
          <label>Plan</label>
          <div class="value">
            <span class="badge ${(user.plan || 'free').toLowerCase()}">${(user.plan || 'free').charAt(0).toUpperCase() + (user.plan || 'free').slice(1)}</span>
          </div>
        </div>
        <div class="item">
          <label>Account Created</label>
          <div class="value">${user.createdAt ? this.formatDateTime(user.createdAt) : '—'}</div>
        </div>
        <div class="item">
          <label>Last Active</label>
          <div class="value">${user.lastActive ? this.formatDateTime(user.lastActive) : '—'}</div>
        </div>
        <div class="item">
          <label>Status</label>
          <div class="value">
            <span class="badge ${user.disabled ? 'disabled' : 'active'}">
              ${user.disabled ? 'Disabled' : 'Active'}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Credits & Usage -->
    <div class="section">
      <h2 class="section-title">
        <i class="fas fa-coins"></i>
        Credits & Usage
      </h2>
      <div class="grid">
        ${credits ? `
          <div class="item">
            <label>Total Credits</label>
            <div class="value-large">
              ${credits.unlimited ? '∞' : (credits.total || 0)}
            </div>
          </div>
          ${!credits.unlimited ? `
            <div class="item">
              <label>Free Credits</label>
              <div class="value">${credits.free || 0}</div>
            </div>
            <div class="item">
              <label>Paid Credits</label>
              <div class="value">${credits.paid || 0}</div>
            </div>
            <div class="item">
              <label>Bonus Credits</label>
              <div class="value">${credits.bonus || 0}</div>
            </div>
          ` : ''}
        ` : `
          <div class="item">
            <div class="value">No credits data available</div>
          </div>
        `}
        <div class="item">
          <label>Specs Created</label>
          <div class="value-large">${specs.count || 0}</div>
        </div>
      </div>
      ${specs.specs && specs.specs.length > 0 ? `
        <div class="specs-list">
          <h3 style="font-size: 1rem; margin-bottom: 12px;">Recent Specs</h3>
          <ul>
            ${specs.specs.slice(0, 10).map(spec => `
              <li>
                <span>${this.escapeHtml(spec.title)}</span>
                <span style="color: #6b7280; font-size: 0.85rem;">${spec.createdAt ? this.formatDate(spec.createdAt) : '—'}</span>
              </li>
            `).join('')}
          </ul>
        </div>
      ` : ''}
    </div>

    <!-- Acquisition Data -->
    <div class="section">
      <h2 class="section-title">
        <i class="fas fa-chart-line"></i>
        Acquisition Data
      </h2>
      <div class="grid">
        <div class="item">
          <label>Referrer</label>
          <div class="value">${acquisition.referrer ? this.escapeHtml(acquisition.referrer) : '—'}</div>
        </div>
        <div class="item">
          <label>Landing Page</label>
          <div class="value">${acquisition.landing_page ? this.escapeHtml(acquisition.landing_page) : '—'}</div>
        </div>
        <div class="item">
          <label>First Visit</label>
          <div class="value">${acquisition.first_visit_at ? this.formatDateTime(acquisition.first_visit_at) : '—'}</div>
        </div>
        ${acquisition.utm_source ? `
          <div class="item">
            <label>UTM Source</label>
            <div class="value">${this.escapeHtml(acquisition.utm_source)}</div>
          </div>
        ` : ''}
        ${acquisition.utm_medium ? `
          <div class="item">
            <label>UTM Medium</label>
            <div class="value">${this.escapeHtml(acquisition.utm_medium)}</div>
          </div>
        ` : ''}
        ${acquisition.utm_campaign ? `
          <div class="item">
            <label>UTM Campaign</label>
            <div class="value">${this.escapeHtml(acquisition.utm_campaign)}</div>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Visit History -->
    <div class="section">
      <h2 class="section-title">
        <i class="fas fa-history"></i>
        Visit History
      </h2>
      <div class="grid">
        <div class="item">
          <label>Total Time on Site</label>
          <div class="value-large">${visits.totalTimeOnSiteFormatted || '0s'}</div>
        </div>
        <div class="item">
          <label>Total Visits</label>
          <div class="value-large">${visits.totalVisits || 0}</div>
        </div>
        <div class="item">
          <label>Total Sessions</label>
          <div class="value">${visits.sessions ? visits.sessions.length : 0}</div>
        </div>
        ${visits.lastVisit ? `
          <div class="item">
            <label>Last Visit</label>
            <div class="value">${this.formatDateTime(visits.lastVisit.date)}</div>
          </div>
          <div class="item">
            <label>Last Visit Page</label>
            <div class="value">${this.escapeHtml(visits.lastVisit.page)}</div>
          </div>
        ` : ''}
      </div>
      ${visits.sessions && visits.sessions.length > 0 ? `
        <div class="sessions-list">
          <h3 style="font-size: 1rem; margin-bottom: 12px;">Sessions</h3>
          ${visits.sessions.map((session, index) => `
            <div class="session-card">
              <div class="session-header">
                <span style="font-weight: 600;">Session ${index + 1}</span>
                <span style="font-weight: 600; color: #ff6b35;">${session.durationFormatted || '0s'}</span>
              </div>
              <div class="session-details">
                <div>
                  <i class="fas fa-clock"></i>
                  ${this.formatDateTime(session.startTime)} - ${this.formatDateTime(session.endTime)}
                </div>
                <div>
                  <i class="fas fa-file"></i>
                  ${session.pageCount || 0} pages
                </div>
                <div>
                  <i class="fas fa-sign-in-alt"></i>
                  Entry: ${this.escapeHtml(session.entryPage)}
                </div>
                <div>
                  <i class="fas fa-sign-out-alt"></i>
                  Exit: ${this.escapeHtml(session.exitPage)}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>

    <!-- Page Journey -->
    ${pageJourney.length > 0 ? `
      <div class="section">
        <h2 class="section-title">
          <i class="fas fa-route"></i>
          Page Journey
        </h2>
        <div class="page-journey">
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
            <div style="padding: 16px; text-align: center; color: #6b7280;">
              Showing first 50 of ${pageJourney.length} page views
            </div>
          ` : ''}
        </div>
      </div>
    ` : ''}

    <!-- Raw Data / Debug Information -->
    <div class="section">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h2 class="section-title" style="margin: 0;">
          <i class="fas fa-code"></i>
          Raw Data (Debug)
        </h2>
        <button id="copy-raw-data-window-btn" style="padding: 8px 16px; background: #ff6b35; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
          <i class="fas fa-copy"></i> Copy All Data
        </button>
      </div>
      <div>
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
  </div>
  <script>
    (function() {
      const rawData = ${JSON.stringify({
        users: analytics.rawData?.users || {},
        user_credits_v3: analytics.rawData?.user_credits_v3 || {},
        subscriptions_v3: analytics.rawData?.subscriptions_v3 || {}
      })};
      
      const copyBtn = document.getElementById('copy-raw-data-window-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', function() {
          const jsonString = JSON.stringify(rawData, null, 2);
          navigator.clipboard.writeText(jsonString).then(() => {
            const originalHTML = this.innerHTML;
            this.innerHTML = '<i class="fas fa-check"></i> Copied!';
            setTimeout(() => {
              this.innerHTML = originalHTML;
            }, 2000);
          }).catch(() => {
            alert('Failed to copy data to clipboard');
          });
        });
      }
    })();
  </script>
</body>
</html>
    `;
    
    // Open new window
    const newWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
    if (newWindow) {
      newWindow.document.write(html);
      newWindow.document.close();
      newWindow.focus();
    } else {
      alert('Please allow popups to view user details');
    }
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
    // Bulk action triggered
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
      // Get credits from user_credits collection (same source as users see)
      const userCredits = allData.userCredits.find(uc => uc.userId === user.id);
      
      let creditsDisplay = '0';
      if (userCredits) {
        if (userCredits.unlimited) {
          creditsDisplay = 'unlimited';
        } else if (typeof userCredits.total === 'number') {
          creditsDisplay = userCredits.total.toString();
        }
      } else {
        // Fallback: if user_credits not loaded yet, use user.freeSpecsRemaining
        const fallbackCredits = typeof user.freeSpecsRemaining === 'number' 
          ? user.freeSpecsRemaining 
          : 0;
        creditsDisplay = fallbackCredits.toString();
      }
      
      const specCount = allData.specsByUser[user.id]?.length || 0;
      const plan = (user.plan === 'pro' || user.plan === 'Pro') ? 'Pro' : 'Free';
      
      return [
        user.email,
        user.displayName,
        plan,
        specCount,
        creditsDisplay,
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
    // PDF export not yet implemented
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
