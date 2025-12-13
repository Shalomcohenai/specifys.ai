/**
 * Focus Manager Utility
 * Manages focus for modals, dropdowns, and other interactive components
 */

class FocusManager {
  constructor() {
    this.focusStack = [];
    this.previousActiveElement = null;
  }

  /**
   * Trap focus within an element (e.g., modal)
   * @param {HTMLElement} container - Container element to trap focus in
   * @param {Object} options - Options for focus trap
   */
  trapFocus(container, options = {}) {
    const {
      initialFocus = null,
      returnFocus = true,
      escapeDeactivates = true
    } = options;

    if (!container) return;

    // Store previous active element for return focus
    if (returnFocus) {
      this.previousActiveElement = document.activeElement;
    }

    // Get all focusable elements within container
    const focusableElements = this.getFocusableElements(container);
    
    if (focusableElements.length === 0) {
      return;
    }

    // Set initial focus
    const firstFocusable = initialFocus || focusableElements[0];
    if (firstFocusable) {
      firstFocusable.focus();
    }

    // Handle Tab key
    const handleTab = (e) => {
      if (e.key !== 'Tab') return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    // Handle Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape' && escapeDeactivates) {
        this.releaseFocus();
        // Dispatch custom event for modal close
        container.dispatchEvent(new CustomEvent('focus-trap:escape', { bubbles: true }));
      }
    };

    // Add event listeners
    container.addEventListener('keydown', handleTab);
    if (escapeDeactivates) {
      container.addEventListener('keydown', handleEscape);
    }

    // Store handlers for cleanup
    container._focusTrapHandlers = {
      tab: handleTab,
      escape: handleEscape,
      returnFocus
    };

    // Add to focus stack
    this.focusStack.push(container);
  }

  /**
   * Release focus trap
   * @param {HTMLElement} container - Container to release focus from
   */
  releaseFocus(container = null) {
    const targetContainer = container || this.focusStack[this.focusStack.length - 1];
    
    if (!targetContainer || !targetContainer._focusTrapHandlers) return;

    const { tab, escape, returnFocus } = targetContainer._focusTrapHandlers;

    // Remove event listeners
    targetContainer.removeEventListener('keydown', tab);
    if (escape) {
      targetContainer.removeEventListener('keydown', escape);
    }

    // Return focus to previous element
    if (returnFocus && this.previousActiveElement) {
      // Check if element still exists and is focusable
      if (document.body.contains(this.previousActiveElement)) {
        this.previousActiveElement.focus();
      }
      this.previousActiveElement = null;
    }

    // Remove from focus stack
    this.focusStack = this.focusStack.filter(c => c !== targetContainer);
    delete targetContainer._focusTrapHandlers;
  }

  /**
   * Get all focusable elements within a container
   * @param {HTMLElement} container - Container element
   * @returns {Array<HTMLElement>} Array of focusable elements
   */
  getFocusableElements(container) {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');

    const elements = Array.from(container.querySelectorAll(selector));

    // Filter out hidden elements
    return elements.filter(el => {
      const style = window.getComputedStyle(el);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        !el.hasAttribute('aria-hidden')
      );
    });
  }

  /**
   * Move focus to next focusable element
   * @param {HTMLElement} currentElement - Current focused element
   * @param {HTMLElement} container - Container to search within
   */
  focusNext(currentElement, container = document.body) {
    const focusableElements = this.getFocusableElements(container);
    const currentIndex = focusableElements.indexOf(currentElement);
    
    if (currentIndex === -1 || currentIndex === focusableElements.length - 1) {
      return focusableElements[0];
    }
    
    return focusableElements[currentIndex + 1];
  }

  /**
   * Move focus to previous focusable element
   * @param {HTMLElement} currentElement - Current focused element
   * @param {HTMLElement} container - Container to search within
   */
  focusPrevious(currentElement, container = document.body) {
    const focusableElements = this.getFocusableElements(container);
    const currentIndex = focusableElements.indexOf(currentElement);
    
    if (currentIndex === -1 || currentIndex === 0) {
      return focusableElements[focusableElements.length - 1];
    }
    
    return focusableElements[currentIndex - 1];
  }

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   * @param {string} priority - 'polite' or 'assertive'
   */
  announce(message, priority = 'polite') {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'visually-hidden';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  window.focusManager = new FocusManager();
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FocusManager;
}
