(function() {
  'use strict';

  // API base URL - adjust based on your backend
  const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:10000/api'
    : 'https://specifys-ai.com/api';

  // State
  let currentUser = null;
  let pollingInterval = null;

  // DOM elements
  const counterValue = document.getElementById('counter-value');
  const buyButton = document.getElementById('buy-button');
  const alertDiv = document.getElementById('alert');
  const alertMessage = document.getElementById('alert-message');
  const authMessage = document.getElementById('auth-message');

  /**
   * Wait for Firebase to be available
   */
  function waitForFirebase() {
    return new Promise((resolve) => {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        resolve();
      } else {
        const checkInterval = setInterval(() => {
          if (typeof firebase !== 'undefined' && firebase.auth) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      }
    });
  }

  /**
   * Load Lemon Squeezy SDK
   */
  function loadLemonSqueezySDK() {
    return new Promise((resolve, reject) => {
      if (window.LemonSqueezy) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://assets.lemonsqueezy.com/lemon.js';
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Initialize Firebase auth state listener
   */
  async function initAuth() {
    await waitForFirebase();
    
    firebase.auth().onAuthStateChanged((user) => {
      currentUser = user;
      if (user) {
        hideAuthMessage();
        enableBuyButton();
      } else {
        showAuthMessage();
        disableBuyButton();
      }
    });
  }

  /**
   * Get Firebase ID token
   */
  async function getIdToken() {
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    return await currentUser.getIdToken();
  }

  /**
   * Show auth required message
   */
  function showAuthMessage() {
    if (authMessage) {
      authMessage.style.display = 'block';
    }
  }

  /**
   * Hide auth required message
   */
  function hideAuthMessage() {
    if (authMessage) {
      authMessage.style.display = 'none';
    }
  }

  /**
   * Enable buy button
   */
  function enableBuyButton() {
    if (buyButton) {
      buyButton.disabled = false;
      buyButton.textContent = 'Buy Test Credit';
    }
  }

  /**
   * Disable buy button
   */
  function disableBuyButton() {
    if (buyButton) {
      buyButton.disabled = true;
      buyButton.textContent = 'Sign In Required';
    }
  }

  /**
   * Show alert message
   */
  function showAlert(message, type = 'success') {
    if (alertDiv && alertMessage) {
      alertMessage.textContent = message;
      alertDiv.className = `alert alert-${type} show`;
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        hideAlert();
      }, 5000);
    }
  }

  /**
   * Hide alert message
   */
  function hideAlert() {
    if (alertDiv) {
      alertDiv.classList.remove('show');
    }
  }

  /**
   * Update counter display
   */
  async function updateCounter() {
    try {
      const response = await fetch(`${API_BASE_URL}/lemon/counter`);
      if (!response.ok) {
        throw new Error('Failed to fetch counter');
      }
      
      const data = await response.json();
      if (data.success && counterValue !== null) {
        const newCount = data.count || 0;
        const currentCount = parseInt(counterValue.textContent) || 0;
        
        if (newCount !== currentCount) {
          counterValue.classList.add('updating');
          counterValue.textContent = newCount;
          
          setTimeout(() => {
            counterValue.classList.remove('updating');
          }, 300);
        }
      }
    } catch (error) {
      console.error('Error updating counter:', error);
    }
  }

  /**
   * Start polling for counter updates
   */
  function startPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    
    // Poll every 3 seconds
    pollingInterval = setInterval(updateCounter, 3000);
  }

  /**
   * Stop polling
   */
  function stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }

  /**
   * Handle buy button click
   */
  async function handleBuyClick() {
    if (!currentUser) {
      showAlert('Please sign in to purchase', 'error');
      return;
    }

    try {
      // Disable button and show loading
      if (buyButton) {
        buyButton.disabled = true;
        buyButton.classList.add('loading');
      }

      // Get Firebase token
      const token = await getIdToken();

      // Create checkout
      const response = await fetch(`${API_BASE_URL}/lemon/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout');
      }

      const data = await response.json();
      
      if (!data.success || !data.checkoutUrl) {
        throw new Error('Invalid checkout response');
      }

      // Wait for Lemon Squeezy SDK to load
      await loadLemonSqueezySDK();

      // Setup event handler
      window.LemonSqueezy.Setup({
        eventHandler: (event) => {
          console.log('Lemon Squeezy event:', event);
          
          if (event === 'Checkout.Success') {
            showAlert('Purchase successful! Counter will update shortly.', 'success');
            // Start polling more frequently after purchase
            updateCounter();
            startPolling();
          } else if (event === 'Checkout.Closed') {
            // User closed checkout
          }
        }
      });

      // Open checkout overlay
      window.LemonSqueezy.Url.Open(data.checkoutUrl);

    } catch (error) {
      console.error('Error creating checkout:', error);
      showAlert(error.message || 'Failed to create checkout. Please try again.', 'error');
    } finally {
      // Re-enable button
      if (buyButton) {
        buyButton.disabled = false;
        buyButton.classList.remove('loading');
      }
    }
  }

  /**
   * Initialize page
   */
  async function init() {
    // Initialize auth
    await initAuth();

    // Load counter initially
    await updateCounter();

    // Start polling for updates
    startPolling();

    // Attach event listeners
    if (buyButton) {
      buyButton.addEventListener('click', handleBuyClick);
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      stopPolling();
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
