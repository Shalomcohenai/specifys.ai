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
      // Check if already loaded and initialized
      if (window.LemonSqueezy && typeof window.LemonSqueezy.Setup === 'function') {
        addDebugLog('Lemon Squeezy SDK already loaded', 'info');
        resolve();
        return;
      }

      // Check if script already exists
      const existingScript = document.querySelector('script[src="https://assets.lemonsqueezy.com/lemon.js"]');
      if (existingScript) {
        // Script is loading, wait for it
        addDebugLog('Lemon Squeezy script already loading, waiting...', 'info');
        let objectCreated = false;
        const checkInterval = setInterval(() => {
          // Try to create if createLemonSqueezy exists (only once)
          if (typeof window.createLemonSqueezy === 'function' && !window.LemonSqueezy && !objectCreated) {
            try {
              window.LemonSqueezy = window.createLemonSqueezy();
              objectCreated = true;
              addDebugLog('Lemon Squeezy object created (existing script)', 'success');
            } catch (error) {
              addDebugLog(`Error creating Lemon Squeezy object: ${error.message}`, 'error');
            }
          }
          
          // Check if we can use the SDK (new API might not have Setup)
          if (window.LemonSqueezy) {
            // Check for new API methods or old API
            if (typeof window.createLemonSqueezyCheckout === 'function' || typeof window.LemonSqueezy.Setup === 'function') {
              clearInterval(checkInterval);
              addDebugLog('Lemon Squeezy SDK loaded after wait', 'success');
              resolve();
              return;
            }
          }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          if (!window.LemonSqueezy) {
            reject(new Error('Lemon Squeezy SDK failed to load'));
          } else {
            // Even without Setup, if we have createLemonSqueezyCheckout, we can proceed
            if (typeof window.createLemonSqueezyCheckout === 'function') {
              resolve();
            } else {
              reject(new Error('Lemon Squeezy SDK loaded but no usable methods found'));
            }
          }
        }, 10000);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://assets.lemonsqueezy.com/lemon.js';
      script.async = true; // Use async instead of defer for better control
      
      script.onload = () => {
        // Wait for SDK to be available (can take a moment)
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait
        const checkSDK = setInterval(() => {
          attempts++;
          
          // Check if createLemonSqueezy function exists (new SDK API)
          if (typeof window.createLemonSqueezy === 'function') {
            clearInterval(checkSDK);
            
            // Create the LemonSqueezy object if it doesn't exist
            if (!window.LemonSqueezy) {
              try {
                window.LemonSqueezy = window.createLemonSqueezy();
                addDebugLog('Lemon Squeezy object created using createLemonSqueezy()', 'success');
                
                // Log available methods for debugging
                if (window.LemonSqueezy) {
                  addDebugLog(`Available methods: ${Object.keys(window.LemonSqueezy).join(', ')}`, 'info');
                }
              } catch (error) {
                addDebugLog(`Error creating Lemon Squeezy object: ${error.message}`, 'error');
                reject(new Error(`Failed to create Lemon Squeezy object: ${error.message}`));
                return;
              }
            }
            
            // Check for new API (createLemonSqueezyCheckout) or old API (Setup)
            if (typeof window.createLemonSqueezyCheckout === 'function') {
              addDebugLog('Lemon Squeezy SDK ready (new API with createLemonSqueezyCheckout)', 'success');
              resolve();
            } else if (window.LemonSqueezy && typeof window.LemonSqueezy.Setup === 'function') {
              addDebugLog('Lemon Squeezy SDK ready (old API with Setup)', 'success');
              resolve();
            } else {
              // Try to open checkout URL directly if we have the object
              if (window.LemonSqueezy && typeof window.LemonSqueezy.Url !== 'undefined') {
                addDebugLog('Lemon Squeezy SDK ready (direct URL access)', 'success');
                resolve();
              } else {
                addDebugLog('Lemon Squeezy object created but no usable methods found', 'warning');
                console.warn('LemonSqueezy object:', window.LemonSqueezy);
                console.warn('Available methods:', Object.keys(window.LemonSqueezy || {}));
                // Still resolve - we can try to open the URL directly
                addDebugLog('Will attempt to open checkout URL directly', 'info');
                resolve();
              }
            }
          } else if (window.LemonSqueezy && typeof window.LemonSqueezy.Setup === 'function') {
            // Old API - LemonSqueezy already exists
            clearInterval(checkSDK);
            addDebugLog('Lemon Squeezy SDK ready (old API)', 'success');
            resolve();
          } else if (attempts >= maxAttempts) {
            clearInterval(checkSDK);
            addDebugLog('Lemon Squeezy SDK loaded but not available after wait', 'warning');
            console.warn('LemonSqueezy object:', window.LemonSqueezy);
            console.warn('Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('lemon')));
            reject(new Error('Lemon Squeezy SDK loaded but Setup method not available'));
          }
        }, 100);
      };
      
      script.onerror = () => {
        addDebugLog('Failed to load Lemon Squeezy SDK script', 'error');
        reject(new Error('Failed to load Lemon Squeezy SDK'));
      };
      
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
    // Refresh button reference in case it was cloned
    const btn = document.getElementById('buy-button') || buyButton;
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Buy Test Credit';
      addDebugLog('Buy button enabled', 'success');
      
      // Update global reference
      if (typeof window !== 'undefined') {
        window.buyButton = btn;
      }
      
      // Debug: Verify button state
      console.log('Buy button enabled:', {
        disabled: btn.disabled,
        text: btn.textContent,
        id: btn.id
      });
    } else {
      addDebugLog('ERROR: Buy button element not found!', 'error');
      console.error('Buy button element not found');
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
    addDebugLog('=== handleBuyClick() called ===', 'info');
    
    // Refresh button reference
    const btn = document.getElementById('buy-button') || buyButton || (typeof window !== 'undefined' ? window.buyButton : null);
    
    if (!currentUser) {
      addDebugLog('Buy button clicked but no user signed in', 'warning');
      showAlert('Please sign in to purchase', 'error');
      return;
    }
    
    if (!btn) {
      addDebugLog('ERROR: Buy button element not found in handleBuyClick!', 'error');
      return;
    }
    
    if (btn.disabled) {
      addDebugLog('WARNING: Buy button is disabled!', 'warning');
      console.warn('Button state:', { disabled: btn.disabled, text: btn.textContent });
      return;
    }

    try {
      addDebugLog('Buy button clicked - starting checkout process...', 'info');
      // Disable button and show loading
      const btn = document.getElementById('buy-button') || buyButton;
      if (btn) {
        btn.disabled = true;
        btn.classList.add('loading');
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

      // Verify SDK is available and try different methods
      let checkoutOpened = false;

      // Method 1: New API with createLemonSqueezyCheckout
      if (typeof window.createLemonSqueezyCheckout === 'function') {
        addDebugLog('Using new Lemon Squeezy API (createLemonSqueezyCheckout)', 'info');
        try {
          // Check what createLemonSqueezyCheckout returns
          const checkout = window.createLemonSqueezyCheckout({
            url: data.checkoutUrl,
            onCheckoutSuccess: () => {
              addDebugLog('Purchase successful! Waiting for webhook...', 'success');
              showAlert('Purchase successful! Counter will update shortly.', 'success');
              updateCounter();
              startPolling();
            }
          });
          
          // Try to open it if there's an open method
          if (checkout && typeof checkout.open === 'function') {
            checkout.open();
            checkoutOpened = true;
            addDebugLog('Checkout opened using checkout.open()', 'success');
          } else if (checkout) {
            addDebugLog(`Checkout object created but no open method. Object keys: ${Object.keys(checkout || {}).join(', ')}`, 'warning');
            // Still mark as opened since we tried
            checkoutOpened = true;
          } else {
            addDebugLog('createLemonSqueezyCheckout returned undefined/null', 'warning');
          }
        } catch (error) {
          addDebugLog(`Error opening checkout with new API: ${error.message}`, 'error');
          console.error('createLemonSqueezyCheckout error:', error);
        }
      }

      // Method 2: Old API with Setup and Url.Open
      if (!checkoutOpened && window.LemonSqueezy && typeof window.LemonSqueezy.Setup === 'function') {
        addDebugLog('Using old Lemon Squeezy API (Setup + Url.Open)', 'info');
        try {
          window.LemonSqueezy.Setup({
            eventHandler: (event) => {
              // Handle both string and object event formats
              const eventType = typeof event === 'string' ? event : (event?.event || event?.type || 'unknown');
              const eventData = typeof event === 'object' ? event : null;
              
              addDebugLog(`Lemon Squeezy event: ${eventType}`, 'info');
              console.log('Lemon Squeezy event:', event);
              
              if (eventType === 'Checkout.Success' || event?.event === 'Checkout.Success') {
                addDebugLog('Purchase successful! Waiting for webhook...', 'success');
                showAlert('Purchase successful! Counter will update shortly.', 'success');
                
                // Update counter immediately
                updateCounter();
                startPolling();
                
                // Close overlay if it's open (though redirect_url should handle this)
                try {
                  if (window.LemonSqueezy && window.LemonSqueezy.Url && typeof window.LemonSqueezy.Url.Close === 'function') {
                    // Don't close immediately - let redirect_url handle it
                    // window.LemonSqueezy.Url.Close();
                  }
                } catch (e) {
                  // Ignore errors
                }
              } else if (eventType === 'Checkout.Closed' || event?.event === 'Checkout.Closed') {
                addDebugLog('Checkout closed by user', 'info');
              } else if (eventType === 'mounted' || event?.event === 'mounted') {
                addDebugLog('Checkout overlay mounted', 'info');
              }
            }
          });
          
          if (window.LemonSqueezy.Url && typeof window.LemonSqueezy.Url.Open === 'function') {
            window.LemonSqueezy.Url.Open(data.checkoutUrl);
            checkoutOpened = true;
          }
        } catch (error) {
          addDebugLog(`Error using old API: ${error.message}`, 'error');
        }
      }

      // Method 3: Direct URL access
      if (!checkoutOpened && window.LemonSqueezy && window.LemonSqueezy.Url) {
        addDebugLog('Trying direct URL.Open method', 'info');
        try {
          if (typeof window.LemonSqueezy.Url.Open === 'function') {
            window.LemonSqueezy.Url.Open(data.checkoutUrl);
            checkoutOpened = true;
          }
        } catch (error) {
          addDebugLog(`Error opening URL directly: ${error.message}`, 'error');
        }
      }

      // Method 4: Try to open checkout URL directly using window.open as overlay
      if (!checkoutOpened) {
        addDebugLog('No SDK overlay method available, opening checkout URL directly', 'info');
        try {
          // Try to open as popup window (overlay-like)
          const popup = window.open(
            data.checkoutUrl,
            'lemon-checkout',
            'width=600,height=700,scrollbars=yes,resizable=yes,centerscreen=yes'
          );
          
          if (popup) {
            checkoutOpened = true;
            addDebugLog('Checkout opened in popup window', 'success');
            
            // Monitor popup for close/success
            const checkPopup = setInterval(() => {
              if (popup.closed) {
                clearInterval(checkPopup);
                addDebugLog('Checkout popup closed - checking for purchase...', 'info');
                updateCounter();
                startPolling();
              }
            }, 1000);
            
            // Cleanup after 5 minutes
            setTimeout(() => clearInterval(checkPopup), 300000);
          } else {
            addDebugLog('Popup blocked, opening in new tab', 'warning');
            window.open(data.checkoutUrl, '_blank');
            checkoutOpened = true;
          }
        } catch (error) {
          addDebugLog(`Error opening checkout: ${error.message}`, 'error');
          // Last resort - open in same window
          window.location.href = data.checkoutUrl;
          checkoutOpened = true;
        }
      }

      if (checkoutOpened) {
        addDebugLog('Checkout opened successfully', 'success');
      } else {
        throw new Error('Failed to open checkout - no available methods');
      }

    } catch (error) {
      addDebugLog(`Checkout error: ${error.message}`, 'error');
      console.error('Error creating checkout:', error);
      showAlert(error.message || 'Failed to create checkout. Please try again.', 'error');
          } finally {
        // Re-enable button
        const btn = document.getElementById('buy-button') || buyButton;
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('loading');
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
        // Remove any existing listeners first by cloning
        const newBuyButton = buyButton.cloneNode(true);
        buyButton.parentNode.replaceChild(newBuyButton, buyButton);
        
        // Update the global reference to the new button
        const updatedBuyButton = document.getElementById('buy-button');
        if (updatedBuyButton) {
          // Update the global buyButton variable
          window.buyButton = updatedBuyButton;
          
          updatedBuyButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            addDebugLog('Buy button clicked - event fired!', 'info');
            handleBuyClick();
          });
          
          addDebugLog('Buy button event listener attached', 'info');
          
          // Debug: Verify click handler
          console.log('Buy button click handler attached:', {
            disabled: updatedBuyButton.disabled,
            hasClickListener: true
          });
        } else {
          addDebugLog('ERROR: Could not find button after cloning!', 'error');
        }
      } else {
        addDebugLog('ERROR: Buy button not found when attaching listener!', 'error');
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
