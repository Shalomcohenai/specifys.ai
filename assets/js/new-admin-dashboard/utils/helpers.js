/**
 * Utility helpers
 */

export const helpers = {
  /**
   * Debounce function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  /**
   * Throttle function
   */
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },
  
  /**
   * Format date
   */
  formatDate(date) {
    if (!date) return '—';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },
  
  /**
   * Format relative time
   */
  formatRelative(date) {
    if (!date) return '—';
    const d = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const diff = now - d;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return this.formatDate(d);
  },
  
  /**
   * Format number
   */
  formatNumber(num) {
    if (typeof num !== 'number') return '0';
    return new Intl.NumberFormat('en-US').format(num);
  },
  
  /**
   * Format currency
   */
  formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  },
  
  /**
   * DOM helpers
   */
  dom(selector) {
    return document.querySelector(selector);
  },
  
  domAll(selector) {
    return Array.from(document.querySelectorAll(selector));
  },
  
  /**
   * Animate number
   */
  animateNumber(element, from, to, duration = 1000, formatter = null) {
    if (!element) return;
    
    const start = performance.now();
    const range = to - from;
    const isCurrency = formatter === 'currency' || element.textContent.includes('$');
    
    const update = (currentTime) => {
      const elapsed = currentTime - start;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (easeOutCubic)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = from + (range * easeProgress);
      
      if (isCurrency) {
        element.textContent = this.formatCurrency(Math.max(0, current));
      } else if (formatter === 'number') {
        element.textContent = this.formatNumber(Math.floor(Math.max(0, current)));
      } else {
        element.textContent = Math.floor(Math.max(0, current)).toLocaleString();
      }
      
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        if (isCurrency) {
          element.textContent = this.formatCurrency(Math.max(0, to));
        } else if (formatter === 'number') {
          element.textContent = this.formatNumber(Math.floor(Math.max(0, to)));
        } else {
          element.textContent = Math.floor(Math.max(0, to)).toLocaleString();
        }
      }
    };
    
    requestAnimationFrame(update);
  },
  
  /**
   * Clamp array
   */
  clampArray(array, maxLength) {
    return array.slice(0, maxLength);
  },
  
  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

