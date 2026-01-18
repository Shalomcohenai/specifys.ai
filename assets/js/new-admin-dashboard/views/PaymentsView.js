/**
 * Payments View - Complete payment and transaction management
 * Shows orders, customers, errors, and new subscribers from Lemon Squeezy
 */

import { helpers } from '../utils/helpers.js';
import { apiService } from '../services/ApiService.js';

export class PaymentsView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.currentTab = 'orders';
    this.summaryData = null;
    this.loading = false;
    
    this.init();
  }
  
  /**
   * Initialize view
   */
  init() {
    // Setup event listeners
    this.setupEventListeners();
    
    // Load initial data
    this.loadData();
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Tab switching
    const tabs = helpers.domAll('.payments-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;
        this.switchTab(tabName);
      });
    });

    // Range filter
    const rangeSelect = helpers.dom('#payments-range-select');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', () => {
        this.loadData();
      });
    }

    // Sync button
    const syncBtn = helpers.dom('#payments-sync-btn');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        this.syncPaymentsData();
      });
    }

    // Orders filters
    const ordersStatusFilter = helpers.dom('#orders-status-filter');
    const ordersSearch = helpers.dom('#orders-search-input');
    const ordersDateFrom = helpers.dom('#orders-date-from');
    const ordersDateTo = helpers.dom('#orders-date-to');

    if (ordersStatusFilter) {
      ordersStatusFilter.addEventListener('change', () => this.renderCurrentTab());
    }
    if (ordersSearch) {
      ordersSearch.addEventListener('input', () => this.renderCurrentTab());
    }
    if (ordersDateFrom) {
      ordersDateFrom.addEventListener('change', () => this.renderCurrentTab());
    }
    if (ordersDateTo) {
      ordersDateTo.addEventListener('change', () => this.renderCurrentTab());
    }

    // Customers search
    const customersSearch = helpers.dom('#customers-search-input');
    if (customersSearch) {
      customersSearch.addEventListener('input', () => this.renderCurrentTab());
    }

    // Errors type filter
    const errorsTypeFilter = helpers.dom('#errors-type-filter');
    if (errorsTypeFilter) {
      errorsTypeFilter.addEventListener('change', () => this.renderCurrentTab());
    }

    // New subscribers days filter
    const newSubscribersDaysFilter = helpers.dom('#new-subscribers-days-filter');
    if (newSubscribersDaysFilter) {
      newSubscribersDaysFilter.addEventListener('change', () => this.renderCurrentTab());
    }
  }

  /**
   * Switch tabs
   */
  switchTab(tabName) {
    this.currentTab = tabName;

    // Update tab buttons
    helpers.domAll('.payments-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    const activeTab = helpers.dom(`.payments-tab[data-tab="${tabName}"]`);
    if (activeTab) {
      activeTab.classList.add('active');
    }

    // Update tab content
    helpers.domAll('.payments-tab-content').forEach(content => {
      content.classList.remove('active');
    });
    const activeContent = helpers.dom(`#payments-tab-${tabName}`);
    if (activeContent) {
      activeContent.classList.add('active');
    }

    // Render current tab
    this.renderCurrentTab();
  }

  /**
   * Load data from API
   */
  async loadData() {
    if (this.loading) return;
    this.loading = true;

    const loadingSpinner = helpers.dom('#payments-loading-spinner');
    if (loadingSpinner) {
      loadingSpinner.style.display = 'inline-block';
    }

    try {
      // Load summary
      const summaryResponse = await apiService.get('/api/admin/payments/summary');
      if (summaryResponse.success) {
        this.summaryData = summaryResponse.data;
        this.renderSummary();
        this.renderLastSync();
      }

      // Render current tab
      await this.renderCurrentTab();
    } catch (error) {
      console.error('[PaymentsView] Error loading data:', error);
      this.showError('Failed to load payments data. Please try again.');
    } finally {
      this.loading = false;
      if (loadingSpinner) {
        loadingSpinner.style.display = 'none';
      }
    }
  }

  /**
   * Render summary statistics
   */
  renderSummary() {
    if (!this.summaryData || !this.summaryData.summary) return;

    const summary = this.summaryData.summary;
    const errors = this.summaryData.errors || {};

    // Update stat values
    const totalRevenueEl = helpers.dom('#stat-total-revenue');
    const totalOrdersEl = helpers.dom('#stat-total-orders');
    const totalCustomersEl = helpers.dom('#stat-total-customers');
    const activeSubscriptionsEl = helpers.dom('#stat-active-subscriptions');
    const newSubscribersEl = helpers.dom('#stat-new-subscribers');
    const errorsCountEl = helpers.dom('#stat-errors-count');

    if (totalRevenueEl) totalRevenueEl.textContent = this.formatCurrency(summary.totalRevenue || 0);
    if (totalOrdersEl) totalOrdersEl.textContent = (summary.totalOrders || 0).toLocaleString();
    if (totalCustomersEl) totalCustomersEl.textContent = (summary.totalCustomers || 0).toLocaleString();
    if (activeSubscriptionsEl) activeSubscriptionsEl.textContent = (summary.activeSubscriptions || 0).toLocaleString();
    if (newSubscribersEl) newSubscribersEl.textContent = (summary.newSubscribers30Days || 0).toLocaleString();
    if (errorsCountEl) errorsCountEl.textContent = (errors.total || 0).toLocaleString();

    // Update errors badge
    const errorsBadge = helpers.dom('#errors-badge');
    if (errorsBadge) {
      if (errors.total > 0) {
        errorsBadge.textContent = errors.total;
        errorsBadge.style.display = 'inline-block';
      } else {
        errorsBadge.style.display = 'none';
      }
    }
  }

  /**
   * Render last sync time
   */
  renderLastSync() {
    if (!this.summaryData || !this.summaryData.lastSynced) return;

    const lastSyncElement = helpers.dom('#last-sync-time');
    const syncStatusElement = helpers.dom('#payment-sync-status');
    
    if (lastSyncElement && this.summaryData.lastSynced) {
      const lastSync = this.summaryData.lastSynced.toDate ? 
                       this.summaryData.lastSynced.toDate() : 
                       new Date(this.summaryData.lastSynced);
      const now = new Date();
      const diffMs = now - lastSync;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      let timeText;
      if (diffHours < 1) {
        timeText = `${diffMinutes} minutes ago`;
      } else if (diffHours < 24) {
        timeText = `${diffHours} hours ago`;
      } else {
        const diffDays = Math.floor(diffHours / 24);
        timeText = `${diffDays} days ago`;
      }

      lastSyncElement.textContent = timeText;
      
      if (syncStatusElement) {
        syncStatusElement.style.display = 'block';
      }
    }
  }

  /**
   * Render current tab
   */
  async renderCurrentTab() {
    switch (this.currentTab) {
      case 'orders':
        await this.renderOrders();
        break;
      case 'customers':
        await this.renderCustomers();
        break;
      case 'errors':
        await this.renderErrors();
        break;
      case 'new-subscribers':
        await this.renderNewSubscribers();
        break;
    }
  }

  /**
   * Render orders table
   */
  async renderOrders() {
    const table = helpers.dom('#payments-orders-table tbody');
    if (!table) return;

    table.innerHTML = '<tr><td colspan="7" class="table-empty-state">Loading orders...</td></tr>';

    try {
      const statusFilter = helpers.dom('#orders-status-filter')?.value || 'all';
      const searchQuery = helpers.dom('#orders-search-input')?.value || '';
      const dateFrom = helpers.dom('#orders-date-from')?.value;
      const dateTo = helpers.dom('#orders-date-to')?.value;

      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (dateFrom) {
        params.append('dateFrom', dateFrom);
      }
      if (dateTo) {
        params.append('dateTo', dateTo);
      }
      params.append('limit', '100');

      const response = await apiService.get(`/api/admin/payments/orders?${params.toString()}`);
      
      if (!response.success || !response.data) {
        table.innerHTML = '<tr><td colspan="7" class="table-empty-state">Failed to load orders</td></tr>';
        return;
      }

      let orders = response.data.orders || [];

      // Apply search filter client-side
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        orders = orders.filter(order => 
          order.orderNumber?.toLowerCase().includes(searchLower) ||
          order.raw?.attributes?.customer_email?.toLowerCase().includes(searchLower)
        );
      }

      if (orders.length === 0) {
        table.innerHTML = '<tr><td colspan="7" class="table-empty-state">No orders found</td></tr>';
        return;
      }

      const html = orders.map(order => {
        const date = order.createdAt ? new Date(order.createdAt) : new Date();
        const formattedDate = helpers.formatDate(date);
        
        // Convert from cents if needed
        let totalAmount = order.total || 0;
        if (totalAmount > 1000) {
          totalAmount = totalAmount / 100;
        }
        const amount = this.formatCurrency(totalAmount, order.currency || 'USD');
        
        const status = order.status || 'paid';
        const statusClass = status === 'paid' ? 'status-success' : 
                           status === 'refunded' ? 'status-failed' : 
                           status === 'pending' ? 'status-pending' :
                           'status-secondary';
        const subscriptionId = order.subscriptionId ? order.subscriptionId.toString() : '-';
        const customerEmail = order.customerEmail || 
                             order.raw?.attributes?.customer_email || 
                             order.raw?.data?.attributes?.customer_email || '-';

        return `
          <tr>
            <td>${formattedDate}</td>
            <td><code>${this.escapeHtml(order.orderNumber || order.id)}</code></td>
            <td>${this.escapeHtml(customerEmail)}</td>
            <td>${this.escapeHtml(order.productName || order.variantName || '-')}</td>
            <td><strong>${amount}</strong></td>
            <td><span class="status-badge ${statusClass}">${status}</span>${order.refunded ? ' <span class="status-badge status-failed">Refunded</span>' : ''}</td>
            <td><code>${subscriptionId}</code></td>
          </tr>
        `;
      }).join('');

      table.innerHTML = html;
    } catch (error) {
      console.error('[PaymentsView] Error rendering orders:', error);
      table.innerHTML = '<tr><td colspan="7" class="table-empty-state">Error loading orders</td></tr>';
    }
  }

  /**
   * Render customers table
   */
  async renderCustomers() {
    const table = helpers.dom('#payments-customers-table tbody');
    if (!table) return;

    table.innerHTML = '<tr><td colspan="6" class="table-empty-state">Loading customers...</td></tr>';

    try {
      const searchQuery = helpers.dom('#customers-search-input')?.value || '';
      const params = new URLSearchParams();
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      params.append('limit', '100');

      const response = await apiService.get(`/api/admin/payments/customers?${params.toString()}`);
      
      if (!response.success || !response.data) {
        table.innerHTML = '<tr><td colspan="6" class="table-empty-state">Failed to load customers</td></tr>';
        return;
      }

      const customers = response.data.customers || [];

      if (customers.length === 0) {
        table.innerHTML = '<tr><td colspan="6" class="table-empty-state">No customers found</td></tr>';
        return;
      }

      // Get full cache data to count subscriptions per customer
      const cacheData = await apiService.get('/api/admin/payments/orders?limit=1').catch(() => null);
      
      // Count subscriptions per customer from summary data
      const subscriptionsByCustomer = {};
      if (this.summaryData && this.summaryData.subscriptions) {
        this.summaryData.subscriptions.forEach(sub => {
          if (sub.customerId) {
            subscriptionsByCustomer[sub.customerId] = (subscriptionsByCustomer[sub.customerId] || 0) + 1;
          }
        });
      }

      const html = customers.map(customer => {
        const createdAt = customer.createdAt ? new Date(customer.createdAt) : new Date();
        const formattedDate = helpers.formatDate(createdAt);
        const totalSpent = this.formatCurrency(customer.totalSpent || 0);
        const subscriptions = subscriptionsByCustomer[customer.id] || 0;

        return `
          <tr>
            <td><strong>${this.escapeHtml(customer.name || customer.email || 'Unknown')}</strong></td>
            <td>${this.escapeHtml(customer.email || '-')}</td>
            <td><strong>${totalSpent}</strong></td>
            <td>${(customer.totalOrders || 0).toLocaleString()}</td>
            <td>${subscriptions}</td>
            <td>${formattedDate}</td>
          </tr>
        `;
      }).join('');

      table.innerHTML = html;
    } catch (error) {
      console.error('[PaymentsView] Error rendering customers:', error);
      table.innerHTML = '<tr><td colspan="6" class="table-empty-state">Error loading customers</td></tr>';
    }
  }

  /**
   * Render errors table
   */
  async renderErrors() {
    const table = helpers.dom('#payments-errors-table tbody');
    if (!table) return;

    table.innerHTML = '<tr><td colspan="6" class="table-empty-state">Loading errors...</td></tr>';

    try {
      const typeFilter = helpers.dom('#errors-type-filter')?.value || 'all';
      const params = new URLSearchParams();
      if (typeFilter !== 'all') {
        params.append('type', typeFilter);
      }

      const response = await apiService.get(`/api/admin/payments/errors?${params.toString()}`);
      
      if (!response.success || !response.data) {
        table.innerHTML = '<tr><td colspan="6" class="table-empty-state">Failed to load errors</td></tr>';
        return;
      }

      let errors = [];
      if (typeFilter === 'all') {
        const data = response.data.errors;
        errors = [
          ...(data.cancelled || []).map(e => ({ ...e, errorType: 'cancelled' })),
          ...(data.refunded || []).map(e => ({ ...e, errorType: 'refunded' })),
          ...(data.pastDue || []).map(e => ({ ...e, errorType: 'past_due' })),
          ...(data.expired || []).map(e => ({ ...e, errorType: 'expired' }))
        ];
      } else {
        errors = response.data.errors || [];
      }

      if (errors.length === 0) {
        table.innerHTML = '<tr><td colspan="6" class="table-empty-state">No errors found</td></tr>';
        return;
    }
    
    // Sort by date (newest first)
      errors.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(a.endsAt || 0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(b.endsAt || 0);
        return dateB - dateA;
      });

      const html = errors.map(error => {
        const date = error.createdAt ? new Date(error.createdAt) : 
                    error.endsAt ? new Date(error.endsAt) : new Date();
        const formattedDate = helpers.formatDate(date);
        const errorType = error.errorType || 'unknown';
        const typeLabels = {
          cancelled: 'Cancelled',
          refunded: 'Refunded',
          past_due: 'Past Due',
          expired: 'Expired'
        };
        const typeColors = {
          cancelled: 'status-warning',
          refunded: 'status-failed',
          past_due: 'status-danger',
          expired: 'status-secondary'
        };

        // Get customer info from summary data
        let customerEmail = '-';
        let productName = '-';
        let amount = '-';

        if (error.customerId && this.summaryData && this.summaryData.customers) {
          const customer = this.summaryData.customers.find(c => c.id === error.customerId);
          if (customer) {
            customerEmail = customer.email || '-';
          }
        }

        if (error.productName) {
          productName = error.productName;
        }

        if (error.total) {
          amount = this.formatCurrency(error.total, error.currency || 'USD');
        }

        return `
          <tr>
            <td><span class="status-badge ${typeColors[errorType] || 'status-secondary'}">${typeLabels[errorType] || errorType}</span></td>
            <td>${formattedDate}</td>
            <td>${this.escapeHtml(customerEmail)}</td>
            <td>${this.escapeHtml(productName)}</td>
            <td>${amount}</td>
            <td>
              ${errorType === 'cancelled' && error.cancelAtPeriodEnd ? 'Cancels at period end' : ''}
              ${errorType === 'refunded' && error.refundedAt ? `Refunded on ${helpers.formatDate(new Date(error.refundedAt))}` : ''}
              ${errorType === 'past_due' ? 'Payment failed' : ''}
              ${errorType === 'expired' ? 'Subscription expired' : ''}
            </td>
          </tr>
        `;
      }).join('');

      table.innerHTML = html;
    } catch (error) {
      console.error('[PaymentsView] Error rendering errors:', error);
      table.innerHTML = '<tr><td colspan="6" class="table-empty-state">Error loading errors</td></tr>';
    }
  }

  /**
   * Render new subscribers table
   */
  async renderNewSubscribers() {
    const table = helpers.dom('#payments-new-subscribers-table tbody');
    if (!table) return;

    table.innerHTML = '<tr><td colspan="6" class="table-empty-state">Loading new subscribers...</td></tr>';

    try {
      const daysFilter = helpers.dom('#new-subscribers-days-filter')?.value || '30';
      const params = new URLSearchParams();
      params.append('days', daysFilter);
      params.append('limit', '100');

      const response = await apiService.get(`/api/admin/payments/new-subscribers?${params.toString()}`);
      
      if (!response.success || !response.data) {
        table.innerHTML = '<tr><td colspan="6" class="table-empty-state">Failed to load new subscribers</td></tr>';
        return;
      }

      const subscribers = response.data.subscribers || [];

      if (subscribers.length === 0) {
        table.innerHTML = '<tr><td colspan="6" class="table-empty-state">No new subscribers found</td></tr>';
      return;
    }
    
      const html = subscribers.map(sub => {
        const date = sub.createdAt ? new Date(sub.createdAt) : new Date();
      const formattedDate = helpers.formatDate(date);
        const renewsAt = sub.renewsAt ? helpers.formatDate(new Date(sub.renewsAt)) : '-';
        const status = sub.status || 'active';
        const statusClass = status === 'active' ? 'status-success' : 
                           status === 'on_trial' ? 'status-info' : 
                           'status-warning';
        const customerEmail = sub.customer?.email || '-';
        
        // Convert from cents if needed
        let totalAmount = sub.order?.total || 0;
        if (totalAmount > 1000) {
          totalAmount = totalAmount / 100;
        }
        const amount = sub.order?.total ? 
                      this.formatCurrency(totalAmount, sub.order.currency || 'USD') : '-';
      
      return `
        <tr>
          <td>${formattedDate}</td>
            <td>${this.escapeHtml(customerEmail)}</td>
            <td>${this.escapeHtml(sub.productName || '-')}</td>
          <td><span class="status-badge ${statusClass}">${status}</span></td>
            <td>${renewsAt}</td>
            <td>${amount}</td>
        </tr>
      `;
    }).join('');
    
      table.innerHTML = html;
    } catch (error) {
      console.error('[PaymentsView] Error rendering new subscribers:', error);
      table.innerHTML = '<tr><td colspan="6" class="table-empty-state">Error loading new subscribers</td></tr>';
    }
  }

  /**
   * Sync payments data manually
   */
  async syncPaymentsData() {
    const syncBtn = helpers.dom('#payments-sync-btn');
    if (!syncBtn) return;

    // Disable button
    syncBtn.disabled = true;
    const originalText = syncBtn.innerHTML;
    syncBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Syncing...</span>';

    try {
      const response = await apiService.post('/api/admin/payments/sync');
      
      if (response.success) {
        // Show success message
        this.showSuccess(`Sync completed! Fetched ${response.data.orders} orders, ${response.data.customers} customers, ${response.data.subscriptions} subscriptions.`);
        
        // Reload data
        await this.loadData();
      } else {
        throw new Error(response.message || 'Sync failed');
      }
    } catch (error) {
      console.error('[PaymentsView] Error syncing payments data:', error);
      this.showError('Failed to sync payments data. Please try again.');
    } finally {
      // Re-enable button
      syncBtn.disabled = false;
      syncBtn.innerHTML = originalText;
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    // You can implement a toast/notification system here
    console.error('[PaymentsView] Error:', message);
    alert(message); // Temporary - replace with proper notification
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    // You can implement a toast/notification system here
    console.log('[PaymentsView] Success:', message);
    alert(message); // Temporary - replace with proper notification
  }

  /**
   * Format currency
   */
  formatCurrency(amount, currency = 'USD') {
    if (typeof amount === 'string') {
      amount = parseFloat(amount);
    }
    
    // Convert from cents to dollars if amount > 1000 (likely in cents)
    if (amount > 1000) {
      amount = amount / 100;
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount || 0);
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
    this.loadData();
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
    this.loadData();
  }
}
