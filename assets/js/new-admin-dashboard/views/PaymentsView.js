/**
 * Payments View - Payment and transaction management
 */

import { helpers } from '../utils/helpers.js';

export class PaymentsView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.table = null;
    
    this.init();
  }
  
  /**
   * Initialize view
   */
  init() {
    this.table = helpers.dom('#payments-table tbody');
    
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
    const searchInput = helpers.dom('#payments-search');
    if (searchInput) {
      searchInput.addEventListener('input', helpers.debounce(() => {
        this.render();
      }, 300));
    }
    
    // Range filter
    const rangeFilter = helpers.dom('#payments-range');
    if (rangeFilter) {
      rangeFilter.addEventListener('change', () => {
        this.render();
      });
    }
  }
  
  /**
   * Setup data subscriptions
   */
  setupDataSubscriptions() {
    this.dataManager.on('data', ({ source, data }) => {
      if (source === 'purchases') {
        this.render();
      }
    });
  }
  
  /**
   * Render payments table
   */
  render() {
    if (!this.table) return;
    
    const allData = this.dataManager.getAllData();
    let purchases = allData.purchases;
    
    // Apply filters
    purchases = this.filterPurchases(purchases);
    
    if (purchases.length === 0) {
      this.table.innerHTML = '<tr><td colspan="5" class="table-empty">No payments found</td></tr>';
      return;
    }
    
    // Render table
    const html = purchases.slice(0, 100).map(purchase => {
      const user = allData.users.find(u => u.id === purchase.userId);
      const userName = user?.displayName || purchase.email || 'Unknown';
      
      return `
        <tr>
          <td>${helpers.formatDate(purchase.createdAt)}</td>
          <td>
            <div class="user-info">
              <div class="user-name">${this.escapeHtml(userName)}</div>
              <div class="user-email">${this.escapeHtml(purchase.email || '')}</div>
            </div>
          </td>
          <td>${this.escapeHtml(purchase.productName)}</td>
          <td>${helpers.formatCurrency(purchase.total, purchase.currency)}</td>
          <td><span class="status-badge status-${purchase.status}">${purchase.status}</span></td>
        </tr>
      `;
    }).join('');
    
    this.table.innerHTML = html;
  }
  
  /**
   * Filter purchases
   */
  filterPurchases(purchases) {
    // Search filter
    const searchInput = helpers.dom('#payments-search');
    const searchTerm = searchInput?.value.trim().toLowerCase() || '';
    
    if (searchTerm) {
      purchases = purchases.filter(purchase => {
        const haystack = `${purchase.email} ${purchase.productName} ${purchase.userId}`.toLowerCase();
        return haystack.includes(searchTerm);
      });
    }
    
    // Range filter
    const rangeFilter = helpers.dom('#payments-range');
    const range = rangeFilter?.value || 'all';
    
    if (range !== 'all') {
      const ranges = {
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000
      };
      const threshold = Date.now() - (ranges[range] || 0);
      purchases = purchases.filter(p => 
        p.createdAt && p.createdAt.getTime() >= threshold
      );
    }
    
    // Sort by date
    purchases.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    
    return purchases;
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
    this.render();
  }
  
  /**
   * Hide view
   */
  hide() {
    // Cleanup if needed
  }
}

