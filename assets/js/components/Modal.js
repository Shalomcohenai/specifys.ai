/**
 * Modal Component
 * Reusable modal dialog component
 */

import { Component } from './base.js';

export class Modal extends Component {
  constructor(element, options = {}) {
    super(element, {
      closeOnBackdrop: true,
      closeOnEscape: true,
      ...options
    });
    
    this.isOpen = false;
    this.closeBtn = null;
    this.backdrop = null;
    this.init();
  }

  /**
   * Initialize modal
   */
  init() {
    if (!this.element) return;

    // Set ARIA attributes
    if (!this.element.hasAttribute('role')) {
      this.element.setAttribute('role', 'dialog');
    }
    if (!this.element.hasAttribute('aria-modal')) {
      this.element.setAttribute('aria-modal', 'true');
    }
    if (!this.element.hasAttribute('aria-hidden')) {
      this.element.setAttribute('aria-hidden', 'true');
    }

    // Find close button
    this.closeBtn = this.element.querySelector('.modal-close, [data-modal-close]');
    if (this.closeBtn) {
      if (!this.closeBtn.hasAttribute('aria-label')) {
        this.closeBtn.setAttribute('aria-label', 'Close dialog');
      }
      this.on('click', () => this.close());
    }

    // Close on backdrop click
    if (this.options.closeOnBackdrop) {
      this.element.addEventListener('click', (e) => {
        if (e.target === this.element) {
          this.close();
        }
      });
    }

    // Close on ESC key
    if (this.options.closeOnEscape) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      });
    }

    // Initially hide modal
    this.hide();
  }

  /**
   * Open modal
   */
  open() {
    if (!this.element) return;
    
    this.element.style.display = 'flex';
    this.isOpen = true;
    this.element.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    
    // Trap focus if focus manager is available
    if (window.focusManager) {
      window.focusManager.trapFocus(this.element, {
        initialFocus: this.closeBtn,
        returnFocus: true,
        escapeDeactivates: this.options.closeOnEscape
      });
    }
    
    // Trigger custom event
    this.element.dispatchEvent(new CustomEvent('modal:open', { 
      detail: { modal: this } 
    }));
    
    // Focus first focusable element
    const firstFocusable = this.closeBtn || this.element.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }

  /**
   * Close modal
   */
  close() {
    if (!this.element) return;
    
    // Release focus trap if focus manager is available
    if (window.focusManager) {
      window.focusManager.releaseFocus(this.element);
    }
    
    this.element.style.display = 'none';
    this.isOpen = false;
    this.element.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    
    // Trigger custom event
    this.element.dispatchEvent(new CustomEvent('modal:close', { 
      detail: { modal: this } 
    }));
  }

  /**
   * Toggle modal
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Set modal content
   */
  setContent(html) {
    const body = this.element.querySelector('.modal-body, .modal-content');
    if (body) {
      body.innerHTML = html;
    } else {
      this.element.innerHTML = html;
    }
  }

  /**
   * Set modal title
   */
  setTitle(title) {
    const titleEl = this.element.querySelector('.modal-title, h2, h3');
    if (titleEl) {
      titleEl.textContent = title;
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this.close();
    super.destroy();
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.Modal = Modal;
  window.Components = window.Components || {};
  window.Components.Modal = Modal;
}


