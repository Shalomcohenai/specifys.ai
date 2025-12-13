/**
 * Base Component Class
 * Provides foundation for all reusable components
 */

export class Component {
  constructor(element, options = {}) {
    this.element = typeof element === 'string' 
      ? document.querySelector(element) 
      : element;
    this.options = options;
    this.state = {};
    this.listeners = [];
    
    if (!this.element) {
      // Element not found
    }
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Update state and trigger re-render
   */
  setState(newState) {
    const prevState = { ...this.state };
    this.state = { ...this.state, ...newState };
    this.onStateChange(prevState, this.state);
    this.render();
  }

  /**
   * Called when state changes (can be overridden)
   */
  onStateChange(prevState, newState) {
    // Override in child classes if needed
  }

  /**
   * Render component (must be overridden in child classes)
   */
  render() {
    // Override in child classes
  }

  /**
   * Add event listener
   */
  on(event, handler) {
    if (this.element) {
      this.element.addEventListener(event, handler);
      this.listeners.push({ event, handler, element: this.element });
    }
  }

  /**
   * Remove event listener
   */
  off(event, handler) {
    if (this.element) {
      this.element.removeEventListener(event, handler);
      this.listeners = this.listeners.filter(
        l => !(l.event === event && l.handler === handler && l.element === this.element)
      );
    }
  }

  /**
   * Show component
   */
  show() {
    if (this.element) {
      this.element.style.display = '';
      this.element.style.visibility = 'visible';
    }
  }

  /**
   * Hide component
   */
  hide() {
    if (this.element) {
      this.element.style.display = 'none';
      this.element.style.visibility = 'hidden';
    }
  }

  /**
   * Add CSS class
   */
  addClass(className) {
    if (this.element) {
      this.element.classList.add(className);
    }
  }

  /**
   * Remove CSS class
   */
  removeClass(className) {
    if (this.element) {
      this.element.classList.remove(className);
    }
  }

  /**
   * Toggle CSS class
   */
  toggleClass(className) {
    if (this.element) {
      this.element.classList.toggle(className);
    }
  }

  /**
   * Check if has CSS class
   */
  hasClass(className) {
    return this.element ? this.element.classList.contains(className) : false;
  }

  /**
   * Cleanup - remove all event listeners
   */
  destroy() {
    this.listeners.forEach(({ event, handler, element }) => {
      element.removeEventListener(event, handler);
    });
    this.listeners = [];
    this.state = {};
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.Component = Component;
}


