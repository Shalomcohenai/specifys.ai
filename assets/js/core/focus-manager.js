/**
 * Focus Manager Utility.
 */
class FocusManager {
  constructor() {
    this.focusStack = [];
    this.previousActiveElement = null;
  }

  getFocusableElements(container) {
    return Array.from(container.querySelectorAll('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
  }

  trapFocus(container, options = {}) {
    if (!container) return;
    const focusable = this.getFocusableElements(container);
    if (!focusable.length) return;
    this.previousActiveElement = document.activeElement;
    const first = options.initialFocus || focusable[0];
    const last = focusable[focusable.length - 1];
    first.focus();

    const handleKey = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
      if (e.key === 'Escape' && options.escapeDeactivates !== false) {
        this.releaseFocus();
      }
    };

    container.addEventListener('keydown', handleKey);
    this.focusStack.push({ container, handleKey });
  }

  releaseFocus() {
    const trap = this.focusStack.pop();
    if (!trap) return;
    trap.container.removeEventListener('keydown', trap.handleKey);
    if (this.previousActiveElement) this.previousActiveElement.focus();
  }
}

window.focusManager = new FocusManager();
