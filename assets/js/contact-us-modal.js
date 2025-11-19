// Contact Us Modal
(function() {
  'use strict';

  let contactModal = null;

  function createContactModal() {
    if (contactModal) return contactModal;

    const modal = document.createElement('div');
    modal.id = 'contact-us-modal';
    modal.className = 'contact-modal-overlay';
    modal.innerHTML = `
      <div class="contact-modal-content">
        <div class="contact-modal-header">
          <h2>Contact Us</h2>
          <button class="contact-modal-close" aria-label="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="contact-modal-body">
          <form id="contact-us-form">
            <div class="form-group">
              <label for="contact-email">Email</label>
              <input 
                type="email" 
                id="contact-email" 
                name="email" 
                placeholder="your.email@example.com"
                required
              >
            </div>
            <div class="form-group">
              <label for="contact-message">Message</label>
              <textarea 
                id="contact-message" 
                name="message" 
                rows="6" 
                placeholder="Please enter your message here..."
                required
              ></textarea>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" id="contact-cancel-btn">Cancel</button>
              <button type="submit" class="btn btn-primary" id="contact-submit-btn">
                <span class="btn-text">Send</span>
                <span class="btn-loader" style="display: none;">
                  <i class="fas fa-spinner fa-spin"></i> Sending...
                </span>
              </button>
            </div>
            <div id="contact-message-status" class="contact-message-status" style="display: none;"></div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    contactModal = modal;

    // Close handlers
    const closeBtn = modal.querySelector('.contact-modal-close');
    const cancelBtn = modal.querySelector('#contact-cancel-btn');
    
    closeBtn.addEventListener('click', closeContactModal);
    cancelBtn.addEventListener('click', closeContactModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeContactModal();
      }
    });

    // Form submission
    const form = modal.querySelector('#contact-us-form');
    form.addEventListener('submit', handleContactSubmit);

    return modal;
  }

  function openContactModal() {
    const modal = createContactModal();
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Focus on email input
    setTimeout(() => {
      const emailInput = modal.querySelector('#contact-email');
      if (emailInput) emailInput.focus();
    }, 100);
  }

  function closeContactModal() {
    if (contactModal) {
      contactModal.style.display = 'none';
      document.body.style.overflow = '';
      
      // Reset form
      const form = contactModal.querySelector('#contact-us-form');
      if (form) {
        form.reset();
      }
      
      // Hide status message
      const statusEl = contactModal.querySelector('#contact-message-status');
      if (statusEl) {
        statusEl.style.display = 'none';
        statusEl.className = 'contact-message-status';
      }
    }
  }

  async function handleContactSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('#contact-submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    const statusEl = form.querySelector('#contact-message-status');
    
    const email = form.querySelector('#contact-email').value.trim();
    const message = form.querySelector('#contact-message').value.trim();
    
    if (!email || !message) {
      showStatus(statusEl, 'Please fill in all fields', 'error');
      return;
    }
    
    // Show loading state
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';
    statusEl.style.display = 'none';
    
    try {
      // Get current user if authenticated
      let userId = null;
      let userName = null;
      if (typeof firebase !== 'undefined' && firebase.auth) {
        const user = firebase.auth().currentUser;
        if (user) {
          userId = user.uid;
          userName = user.displayName || user.email || 'Unknown User';
        }
      }
      
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          message,
          userId,
          userName,
          timestamp: new Date().toISOString()
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }
      
      // Success
      showStatus(statusEl, 'Thank you! Your message has been sent successfully.', 'success');
      form.reset();
      
      // Close modal after 2 seconds
      setTimeout(() => {
        closeContactModal();
      }, 2000);
      
    } catch (error) {
      console.error('Error submitting contact form:', error);
      showStatus(statusEl, error.message || 'Failed to send message. Please try again.', 'error');
    } finally {
      // Reset button state
      submitBtn.disabled = false;
      btnText.style.display = 'inline-block';
      btnLoader.style.display = 'none';
    }
  }

  function showStatus(element, message, type) {
    if (!element) return;
    
    element.textContent = message;
    element.className = `contact-message-status ${type}`;
    element.style.display = 'block';
    
    // Scroll to status message
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Initialize on DOM ready
  function init() {
    const contactBtn = document.getElementById('contact-us-btn');
    if (contactBtn) {
      contactBtn.addEventListener('click', openContactModal);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for manual triggering if needed
  window.openContactModal = openContactModal;
  window.closeContactModal = closeContactModal;
})();

