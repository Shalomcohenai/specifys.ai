/**
 * Loading State Component - Manages loading indicators
 */

export class LoadingState {
  constructor(element) {
    this.element = element;
    this.originalContent = element ? element.innerHTML : '';
  }
  
  /**
   * Show loading state
   */
  show(message = 'Loading...') {
    if (!this.element) return;
    
    this.element.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <span class="loading-message">${message}</span>
      </div>
    `;
    this.element.classList.add('loading');
  }
  
  /**
   * Hide loading state
   */
  hide() {
    if (!this.element) return;
    
    this.element.classList.remove('loading');
    this.element.innerHTML = this.originalContent;
  }
  
  /**
   * Show error state
   */
  showError(message = 'An error occurred') {
    if (!this.element) return;
    
    this.element.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-circle"></i>
        <span class="error-message">${message}</span>
      </div>
    `;
    this.element.classList.add('error');
  }
  
  /**
   * Show empty state
   */
  showEmpty(message = 'No data available') {
    if (!this.element) return;
    
    this.element.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-inbox"></i>
        <span class="empty-message">${message}</span>
      </div>
    `;
    this.element.classList.add('empty');
  }
}

