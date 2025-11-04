(function() {
  'use strict';

  // API base URL - adjust based on your backend
  const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:10000/api'
    : 'https://specifys-ai.onrender.com/api';

  // State
  let currentUser = null;
  let pollingInterval = null;

  // DOM elements
  const counterValue = document.getElementById('counter-value');
  const buyButton = document.getElementById('buy-button');
  const alertDiv = document.getElementById('alert');
  const alertMessage = document.getElementById('alert-message');
  const authMessage = document.getElementById('auth-message');
  
  // Debug logging system
  const debugLogs = document.getElementById('debug-logs');
  const debugSection = document.getElementById('debug-section');

  /**
   * Add debug log entry
   */
  function addDebugLog(message, type = 'info') {
    if (!debugLogs) return;
    
    const time = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `debug-log-entry ${type}`;
    logEntry.innerHTML = `<span class="debug-log-time">[${time}]</span><span class="debug-log-message">${message}</span>`;
    
    debugLogs.appendChild(logEntry);
    debugLogs.scrollTop = debugLogs.scrollHeight;
    
    // Show debug section if hidden
    if (debugSection && debugSection.style.display === 'none') {
      debugSection.style.display = 'block';
    }
    
    // Also log to console
    const consoleMethod = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'log';
    console[consoleMethod](`[${time}] ${message}`);
  }

  /**
   * Toggle debug section visibility
   */
  window.toggleDebug = function() {
    if (!debugSection) return;
    const isVisible = debugSection.style.display !== 'none';
    debugSection.style.display = isVisible ? 'none' : 'block';
    const toggleBtn = document.getElementById('debug-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = isVisible ? 'Show Logs' : 'Hide Logs';
    }
  };

  /**
   * Copy all debug logs to clipboard
   */
  window.copyLogs = function() {
    if (!debugLogs) return;
    
    const logEntries = debugLogs.querySelectorAll('.debug-log-entry');
    let logsText = '=== Debug Logs ===\n';
    logsText += `Page: ${window.location.href}\n`;
    logsText += `Time: ${new Date().toLocaleString()}\n`;
    logsText += `API URL: ${API_BASE_URL}\n\n`;
    
    logEntries.forEach(entry => {
      const time = entry.querySelector('.debug-log-time')?.textContent || '';
      const message = entry.querySelector('.debug-log-message')?.textContent || '';
      logsText += `${time} ${message}\n`;
    });
    
    navigator.clipboard.writeText(logsText).then(() => {
      addDebugLog('Logs copied to clipboard!', 'success');
      const copyBtn = document.getElementById('copy-logs-btn');
      if (copyBtn) {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        copyBtn.style.background = '#28a745';
        setTimeout(() => {
          copyBtn.textContent = originalText;
          copyBtn.style.background = '';
        }, 2000);
      }
    }).catch(err => {
      addDebugLog('Failed to copy logs: ' + err.message, 'error');
    });
  };

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
    addDebugLog('Initializing Firebase authentication...', 'info');
    await waitForFirebase();
    addDebugLog('Firebase loaded successfully', 'success');
    
    firebase.auth().onAuthStateChanged((user) => {
      currentUser = user;
      if (user) {
        addDebugLog(`User signed in: ${user.email} (UID: ${user.uid})`, 'success');
        hideAuthMessage();
        enableBuyButton();
      } else {
        addDebugLog('No user signed in', 'warning');
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
      addDebugLog(`Fetching counter from ${API_BASE_URL}/lemon/counter`, 'info');
      const response = await fetch(`${API_BASE_URL}/lemon/counter`);
      
      if (!response.ok) {
        if (response.status === 404) {
          addDebugLog(`Counter endpoint not found (404). Backend may not be deployed yet.`, 'warning');
          return;
        }
        addDebugLog(`Failed to fetch counter: HTTP ${response.status}`, 'error');
        throw new Error('Failed to fetch counter');
      }
      
      const data = await response.json();
      addDebugLog(`Counter response: ${JSON.stringify(data)}`, 'success');
      
      if (data.success && counterValue !== null) {
        const newCount = data.count || 0;
        const currentCount = parseInt(counterValue.textContent) || 0;
        
        if (newCount !== currentCount) {
          addDebugLog(`Counter updated: ${currentCount} → ${newCount}`, 'success');
          counterValue.classList.add('updating');
          counterValue.textContent = newCount;
          
          setTimeout(() => {
            counterValue.classList.remove('updating');
          }, 300);
        } else {
          addDebugLog(`Counter unchanged: ${newCount}`, 'info');
        }
      }
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        addDebugLog(`Network error: Cannot reach backend server. Is it running at ${API_BASE_URL}?`, 'warning');
        return;
      }
      if (error.message !== 'Failed to fetch counter') {
        addDebugLog(`Counter update error: ${error.message}`, 'error');
        console.error('Error updating counter:', error);
      }
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
      addDebugLog('Buy button clicked but no user signed in', 'warning');
      showAlert('Please sign in to purchase', 'error');
      return;
    }

    try {
      addDebugLog('Buy button clicked - starting checkout process...', 'info');
      // Disable button and show loading
      if (buyButton) {
        buyButton.disabled = true;
        buyButton.classList.add('loading');
      }

      addDebugLog('Getting Firebase ID token...', 'info');
      // Get Firebase token
      const token = await getIdToken();
      addDebugLog('ID token obtained successfully', 'success');

      const requestBody = {
        userId: currentUser.uid,
        email: currentUser.email
      };
      addDebugLog(`Sending checkout request to ${API_BASE_URL}/lemon/checkout`, 'info');
      addDebugLog(`Request body: ${JSON.stringify(requestBody)}`, 'info');

      // Create checkout
      const response = await fetch(`${API_BASE_URL}/lemon/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      addDebugLog(`Response status: ${response.status} ${response.statusText}`, response.ok ? 'success' : 'error');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        addDebugLog(`Checkout error response: ${JSON.stringify(errorData)}`, 'error');
        throw new Error(errorData.error || 'Failed to create checkout');
      }

      const data = await response.json();
      addDebugLog(`Checkout response: ${JSON.stringify(data)}`, 'success');
      
      if (!data.success || !data.checkoutUrl) {
        addDebugLog('Invalid checkout response - missing checkoutUrl', 'error');
        throw new Error('Invalid checkout response');
      }

      addDebugLog(`Checkout URL received: ${data.checkoutUrl}`, 'success');
      addDebugLog('Loading Lemon Squeezy SDK...', 'info');

      // Wait for Lemon Squeezy SDK to load
      await loadLemonSqueezySDK();
      addDebugLog('Lemon Squeezy SDK loaded', 'success');

      addDebugLog('Setting up Lemon Squeezy event handler...', 'info');
      // Setup event handler
      window.LemonSqueezy.Setup({
        eventHandler: (event) => {
          addDebugLog(`Lemon Squeezy event: ${event}`, 'info');
          console.log('Lemon Squeezy event:', event);
          
          if (event === 'Checkout.Success') {
            addDebugLog('Purchase successful! Waiting for webhook...', 'success');
            showAlert('Purchase successful! Counter will update shortly.', 'success');
            // Start polling more frequently after purchase
            updateCounter();
            startPolling();
          } else if (event === 'Checkout.Closed') {
            addDebugLog('Checkout closed by user', 'info');
          }
        }
      });

      addDebugLog('Opening Lemon Squeezy checkout overlay...', 'info');
      // Open checkout overlay
      window.LemonSqueezy.Url.Open(data.checkoutUrl);

    } catch (error) {
      addDebugLog(`Checkout error: ${error.message}`, 'error');
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
    addDebugLog('=== Test System Initialization Started ===', 'info');
    addDebugLog(`API Base URL: ${API_BASE_URL}`, 'info');
    addDebugLog(`Page URL: ${window.location.href}`, 'info');
    
    try {
      // Initialize auth
      await initAuth();

      // Load counter initially
      await updateCounter();

      // Start polling for updates
      startPolling();
      addDebugLog('Polling started (every 3 seconds)', 'info');

      // Attach event listeners
      if (buyButton) {
        buyButton.addEventListener('click', handleBuyClick);
        addDebugLog('Buy button event listener attached', 'info');
      }

      // Cleanup on page unload
      window.addEventListener('beforeunload', () => {
        stopPolling();
      });
      
      addDebugLog('=== Initialization Complete ===', 'success');
    } catch (error) {
      addDebugLog(`Initialization failed: ${error.message}`, 'error');
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
