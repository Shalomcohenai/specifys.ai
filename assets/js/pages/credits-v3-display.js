/**
 * Credits V3 Display Module - Specifys.ai
 * Handles updating the credits display in the header using the new unified system
 */

(function() {
  'use strict';

  const CREDIT_CLASSES = ['unlimited', 'credits', 'loading'];

  // Wait for dependencies
  function waitForDependencies() {
    return new Promise((resolve) => {
      // Check if CreditsV3Manager is available
      const checkManager = () => typeof window.CreditsV3Manager !== 'undefined';

      if (checkManager()) {
        resolve();
      } else {
        const checkInterval = setInterval(() => {
          if (checkManager()) {
            clearInterval(checkInterval);
            window.removeEventListener('credits-v3-manager-ready', readyHandler);
            resolve();
          }
        }, 100);

        const readyHandler = () => {
          clearInterval(checkInterval);
          window.removeEventListener('credits-v3-manager-ready', readyHandler);
          resolve();
        };
        window.addEventListener('credits-v3-manager-ready', readyHandler);

        setTimeout(() => {
          clearInterval(checkInterval);
          window.removeEventListener('credits-v3-manager-ready', readyHandler);
          resolve();
        }, 10000);
      }
    });
  }

  function getCreditsElements() {
    const creditsDisplay = document.getElementById('credits-display');
    const creditsText = document.getElementById('credits-text');
    if (!creditsDisplay || !creditsText) {
      return null;
    }
    return { creditsDisplay, creditsText };
  }

  function applyCreditsState(state) {
    const elements = getCreditsElements();
    if (!elements) return;

    const { creditsDisplay, creditsText } = elements;
    
    // Remove hidden class to show the element
    creditsDisplay.classList.remove('hidden');
    creditsDisplay.style.display = 'flex';
    creditsText.textContent = state.text || '';
    creditsText.title = state.title || '';

    if (!creditsDisplay.dataset.pricingAttached) {
      creditsDisplay.style.cursor = 'pointer';
      creditsDisplay.title = 'View pricing plans';
      creditsDisplay.addEventListener('click', () => {
        window.location.href = '/pages/pricing.html';
      });
      creditsDisplay.dataset.pricingAttached = 'true';
    }

    CREDIT_CLASSES.forEach((cls) => creditsDisplay.classList.remove(cls));
    if (state.variant && CREDIT_CLASSES.includes(state.variant)) {
      creditsDisplay.classList.add(state.variant);
    }
  }

  const LOADING_STATE = {
    text: 'Loading credits…',
    title: 'Retrieving latest credits',
    variant: 'loading'
  };

  const GUEST_PRICING_STATE = {
    text: 'Pricing',
    title: 'View pricing plans',
    variant: 'credits'
  };

  let isUpdating = false;

  /**
   * Check if user is authenticated and show loading state immediately
   * This runs early, before waiting for dependencies, to provide instant feedback
   */
  function checkAndShowLoadingEarly() {
    // Try to check if user is authenticated without waiting
    let auth = null;
    try {
      auth = window.auth || (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null);
    } catch (e) {
      // Firebase might not be ready yet, that's okay
      return;
    }

    if (!auth) {
      return;
    }

    // Check if user is already authenticated
    const user = auth.currentUser;
    if (user) {
      // Show loading state immediately
      applyCreditsState(LOADING_STATE);
    }
  }

  /**
   * Update credits display in header
   * @param {Object} options - Options for update
   * @param {boolean} options.showLoading - Show loading state
   * @param {boolean} options.forceRefresh - Force refresh from API (ignore cache)
   */
  async function updateCreditsDisplay(options = {}) {
    await waitForDependencies();
    
    const manager = window.CreditsV3Manager;
    if (!manager) {
      if (window.appLogger) {
        window.appLogger.log('Error', 'CreditsV3Manager not available', { context: 'CreditsV3Display.updateCreditsDisplay' });
      }
      return;
    }

    // Check if user is authenticated
    const auth = window.auth || (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null);
    if (!auth) {
      applyCreditsState(GUEST_PRICING_STATE);
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      applyCreditsState(GUEST_PRICING_STATE);
      return;
    }

    // Prevent concurrent updates
    if (isUpdating && !options.forceRefresh) {
      return;
    }
    isUpdating = true;

    try {
      // Always show loading state if not already shown (early check might have shown it)
      // But don't override if we're already showing something
      const currentDisplay = document.getElementById('credits-display');
      if (!currentDisplay || currentDisplay.classList.contains('hidden')) {
        applyCreditsState(LOADING_STATE);
      }

      // Get credits from manager
      const credits = await manager.getCredits(options.forceRefresh);
      
      // Format for display
      const displayState = manager.formatCredits(credits);
      
      // Apply to UI
      applyCreditsState(displayState);
    } catch (error) {
      // Enhanced error logging with more context
      if (window.appLogger) {
        const errorContext = {
          context: 'CreditsV3Display.updateCreditsDisplay',
          errorName: error?.name,
          errorMessage: error?.message,
          forceRefresh: options.forceRefresh,
          userAgent: navigator.userAgent,
          url: window.location.href
        };
        window.appLogger.logError(error, errorContext);
      }
      
      // Check if this is a network error
      const isNetworkError = error?.message?.includes('Load failed') || 
                            error?.message?.includes('Failed to fetch') ||
                            error?.message?.includes('Network') ||
                            error?.name === 'TypeError';
      
      // Show appropriate error state
      if (isNetworkError) {
        // For network errors, show a more helpful message
        applyCreditsState({
          text: 'Credits unavailable',
          title: 'Network error - please check your connection and try again',
          variant: 'loading'
        });
      } else {
        // For other errors, show generic message
        applyCreditsState({
          text: 'Credits unavailable',
          title: 'Unable to load credits at the moment',
          variant: 'loading'
        });
      }
    } finally {
      isUpdating = false;
    }
  }

  /**
   * Update credits display with retry logic for new users
   * @param {Object} options - Options for update
   * @param {number} maxRetries - Maximum number of retry attempts
   * @param {number} attempt - Current attempt number
   */
  async function updateCreditsDisplayWithRetry(options = {}, maxRetries = 5, attempt = 0) {
    await waitForDependencies();
    
    const manager = window.CreditsV3Manager;
    if (!manager) {
      if (window.appLogger) {
        window.appLogger.log('Error', 'Manager not available for retry', { 
          context: 'CreditsV3Display.updateCreditsDisplayWithRetry',
          attempt
        });
      }
      return;
    }

    const retryDelays = [500, 1000, 2000, 3000, 5000]; // ms
    
    try {
      await updateCreditsDisplay(options);
      const credits = await manager.getCredits(options.forceRefresh);
      
      // If we got credits (even 0) or unlimited, we're done
      if (credits && (credits.total !== undefined || credits.unlimited)) {
        if (window.appLogger && attempt > 0) {
          window.appLogger.log('Info', 'Credits loaded successfully after retry', {
            context: 'CreditsV3Display.updateCreditsDisplayWithRetry',
            attempt: attempt + 1,
            credits: credits.unlimited ? 'unlimited' : credits.total
          });
        }
        return; // Success!
      }
      
      // If no credits yet and we have retries left, try again
      if (attempt < maxRetries - 1) {
        const delay = retryDelays[attempt] || 2000;
        if (window.appLogger) {
          window.appLogger.log('Info', `Retrying credits fetch (attempt ${attempt + 2}/${maxRetries})`, {
            context: 'CreditsV3Display.updateCreditsDisplayWithRetry',
            attempt: attempt + 1,
            delay
          });
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        return updateCreditsDisplayWithRetry(options, maxRetries, attempt + 1);
      }
    } catch (error) {
      // Check if this is a network error
      const isNetworkError = error?.message?.includes('Load failed') || 
                            error?.message?.includes('Failed to fetch') ||
                            error?.message?.includes('Network') ||
                            error?.name === 'TypeError';
      
      // If error and we have retries left, try again (especially for network errors)
      if (attempt < maxRetries - 1) {
        const delay = retryDelays[attempt] || 2000;
        if (window.appLogger) {
          window.appLogger.log('Info', `Retrying after error (attempt ${attempt + 2}/${maxRetries})`, {
            context: 'CreditsV3Display.updateCreditsDisplayWithRetry',
            attempt: attempt + 1,
            delay,
            isNetworkError,
            errorName: error?.name,
            errorMessage: error?.message
          });
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        return updateCreditsDisplayWithRetry(options, maxRetries, attempt + 1);
      }
      
      // Last attempt failed - log error but don't throw (user already sees optimistic UI)
      if (window.appLogger) {
        window.appLogger.logError(error, { 
          context: 'CreditsV3Display.updateCreditsDisplayWithRetry',
          finalAttempt: true,
          maxRetries,
          isNetworkError,
          errorName: error?.name,
          errorMessage: error?.message
        });
      }
    }
  }

  /**
   * Show welcome message for new users
   * Displays a notification near the credits display
   */
  function showWelcomeCreditMessage() {
    // Check if message was already shown (prevent duplicates)
    if (document.getElementById('welcome-credit-message')) {
      return;
    }

    const creditsDisplay = document.getElementById('credits-display');
    if (!creditsDisplay) {
      return;
    }

    // Create message element
    const message = document.createElement('div');
    message.id = 'welcome-credit-message';
    message.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: #F59E0B;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      font-size: 14px;
      font-weight: 500;
      opacity: 0;
      transform: translateY(-10px);
      transition: opacity 0.3s ease, transform 0.3s ease;
      pointer-events: none;
      max-width: 300px;
      line-height: 1.4;
    `;
    message.textContent = 'Welcome! You have received 1 credit!';
    message.setAttribute('role', 'alert');
    message.setAttribute('aria-live', 'polite');

    document.body.appendChild(message);

    // Show after 2 seconds with fade-in animation
    setTimeout(() => {
      message.style.opacity = '1';
      message.style.transform = 'translateY(0)';
    }, 2000);

    // Hide after 10 seconds (8 seconds visible + 2 seconds delay) with fade-out
    setTimeout(() => {
      message.style.opacity = '0';
      message.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        if (message.parentNode) {
          message.parentNode.removeChild(message);
        }
      }, 300); // Wait for fade-out animation
    }, 12000); // 2s delay + 10s visible = 12s total
  }

  /**
   * Initialize credits display
   */
  async function init() {
    await waitForDependencies();
    
    const manager = window.CreditsV3Manager;
    if (!manager) {
      if (window.appLogger) {
        window.appLogger.log('Error', 'CreditsV3Manager not available', { context: 'CreditsV3Display.init' });
      }
      return;
    }

    // Wait for Firebase auth
    const auth = window.auth || (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null);
    if (!auth) {
      // Wait for auth to be ready
      if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
          if (user) {
            // Show loading state immediately when user logs in
            applyCreditsState(LOADING_STATE);
            // Then update with actual credits
            updateCreditsDisplay();
          } else {
            applyCreditsState(GUEST_PRICING_STATE);
          }
        });
      }
      // Show Pricing for guests while auth loads
      applyCreditsState(GUEST_PRICING_STATE);
      return;
    }

    // Track if we've already initialized to prevent duplicate subscriptions
    if (window.__creditsV3DisplayInitialized) {
      return;
    }
    window.__creditsV3DisplayInitialized = true;

    // Subscribe to auth state changes (only once)
    auth.onAuthStateChanged((user) => {
      if (user) {
        // Show loading state immediately when user logs in
        applyCreditsState(LOADING_STATE);
        // Then update with actual credits
        updateCreditsDisplay();
      } else {
        applyCreditsState(GUEST_PRICING_STATE);
      }
    });

    // Subscribe to credit updates from manager
    manager.subscribe((credits) => {
      const displayState = manager.formatCredits(credits);
      applyCreditsState(displayState);
    });

    // Check if we need to refresh credits on load (for new users)
    const needsRefreshOnLoad = sessionStorage.getItem('refreshCreditsOnLoad') === 'true';
    const showCreditPopup = sessionStorage.getItem('showCreditPopup') === 'true';
    const isNewUser = needsRefreshOnLoad || showCreditPopup;
    
    if (needsRefreshOnLoad) {
      sessionStorage.removeItem('refreshCreditsOnLoad');
    }
    
    // Initial update - only if user is authenticated
    const currentUser = auth.currentUser;
    if (currentUser) {
      if (isNewUser) {
        // SOLUTION 1: Optimistic UI - Show 1 credit immediately for new users
        applyCreditsState({
          text: 'Credits: 1',
          variant: 'credits',
          title: '1 specification credit remaining'
        });
        
        // SOLUTION 2: Polling with retry - Load real credits in background
        // This will update the display when credits are ready
        updateCreditsDisplayWithRetry({ forceRefresh: true }, 5);
        
        // Show welcome message for new users
        showWelcomeCreditMessage();
      } else {
        updateCreditsDisplay();
      }
    } else {
      // Show Pricing for guests (not authenticated)
      applyCreditsState(GUEST_PRICING_STATE);
    }
  }

  // Expose functions to window
  window.updateCreditsDisplay = updateCreditsDisplay;
  window.clearCreditsCache = function() {
    const manager = window.CreditsV3Manager;
    if (manager) {
      manager.clearCache();
    }
  };

  // Check and show loading state early (before waiting for dependencies)
  // This provides instant feedback to the user
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndShowLoadingEarly);
  } else {
    checkAndShowLoadingEarly();
  }

  // Also check after a short delay in case Firebase loads later
  setTimeout(checkAndShowLoadingEarly, 50);
  setTimeout(checkAndShowLoadingEarly, 200);

  // Initialize when DOM is ready (only once)
  let initCalled = false;
  function safeInit() {
    if (initCalled) return;
    initCalled = true;
    init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInit);
  } else {
    safeInit();
  }

  // Also initialize after a short delay to ensure all scripts are loaded (only once)
  setTimeout(safeInit, 100);
})();
