/**
 * Payments View - Complete payment and transaction management
 * Shows all purchases with correct prices
 */

import { helpers } from '../utils/helpers.js';

export class PaymentsView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.table = null;
    this.currentRange = 'week';
    
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
    // Range filter
    const rangeSelect = helpers.dom('#payments-range-select');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', (e) => {
        this.currentRange = e.target.value;
        this.render();
      });
    }
  }
  
  /**
   * Setup data subscriptions
   */
  setupDataSubscriptions() {
    this.dataManager.on('data', ({ source }) => {
      if (source === 'purchases') {
        this.render();
      }
    });
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
  
  /**
   * Update view
   */
  update() {
    this.render();
  }
  
  /**
   * Render payments table
   */
  render() {
    if (!this.table) return;
    
    const allData = this.dataManager.getAllData();
    let purchases = allData.purchases || [];
    
    // Apply range filter
    if (this.currentRange !== 'all') {
      const now = Date.now();
      const ranges = {
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000
      };
      const threshold = now - (ranges[this.currentRange] || ranges.week);
      
      purchases = purchases.filter(p => {
        if (!p.createdAt) return false;
        const created = p.createdAt instanceof Date ? p.createdAt.getTime() : new Date(p.createdAt).getTime();
        return created >= threshold;
      });
    }
    
    // Sort by date (newest first)
    purchases.sort((a, b) => {
      const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
      const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
      return timeB - timeA;
    });
    
    if (purchases.length === 0) {
      this.table.innerHTML = '<tr><td colspan="5" class="table-empty-state">No payments found</td></tr>';
      return;
    }
    
    // Render table
    const html = purchases.map(purchase => {
      const date = purchase.createdAt instanceof Date ? purchase.createdAt : new Date(purchase.createdAt);
      const formattedDate = helpers.formatDate(date);
      const formattedAmount = helpers.formatCurrency(purchase.total || 0, purchase.currency || 'USD');
      const status = purchase.status || 'paid';
      const statusClass = status === 'paid' ? 'status-paid' : 
                         status === 'refunded' ? 'status-failed' : 
                         'status-pending';
      
      return `
        <tr>
          <td>${formattedDate}</td>
          <td>
            <div class="user-info">
              <div class="user-email">${this.escapeHtml(purchase.email || purchase.userId || 'Unknown')}</div>
            </div>
          </td>
          <td>${this.escapeHtml(purchase.productName || 'Purchase')}</td>
          <td>${formattedAmount}</td>
          <td><span class="status-badge ${statusClass}">${status}</span></td>
        </tr>
      `;
    }).join('');
    
    this.table.innerHTML = html;
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
