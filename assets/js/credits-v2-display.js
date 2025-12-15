/**
 * Credits V2 Display Module - Specifys.ai
 * Handles updating the credits display in the header using the new unified system
 */

(function() {
  'use strict';

  const CREDIT_CLASSES = ['unlimited', 'credits', 'loading'];

  // Wait for dependencies
  function waitForDependencies() {
    return new Promise((resolve) => {
      // Check if CreditsV2Manager is available
      const checkManager = () => {
        if (typeof window.CreditsV2Manager !== 'undefined') {
          return true;
        }
        return false;
      };

      if (checkManager()) {
        resolve();
      } else {
        // Wait for credits-v2-manager.js to load
        const checkInterval = setInterval(() => {
          if (checkManager()) {
            clearInterval(checkInterval);
            window.removeEventListener('credits-v2-manager-ready', readyHandler);
            resolve();
          }
        }, 100);

        const readyHandler = () => {
          clearInterval(checkInterval);
          window.removeEventListener('credits-v2-manager-ready', readyHandler);
          resolve();
        };
        window.addEventListener('credits-v2-manager-ready', readyHandler);

        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          window.removeEventListener('credits-v2-manager-ready', readyHandler);
          resolve(); // Resolve anyway to prevent hanging
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
    
    const manager = window.CreditsV2Manager;
    if (!manager) {
      if (window.appLogger) {
        window.appLogger.log('Error', 'CreditsV2Manager not available', { context: 'CreditsV2Display.updateCreditsDisplay' });
      }
      return;
    }

    // Check if user is authenticated
    const auth = window.auth || (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null);
    if (!auth) {
      const creditsDisplay = document.getElementById('credits-display');
      if (creditsDisplay) {
        creditsDisplay.style.display = 'none';
      }
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      const creditsDisplay = document.getElementById('credits-display');
      if (creditsDisplay) {
        creditsDisplay.style.display = 'none';
      }
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
      if (window.appLogger) {
        window.appLogger.logError(error, { context: 'CreditsV2Display.updateCreditsDisplay' });
      }
      
      // Show error state
      applyCreditsState({
        text: 'Credits unavailable',
        title: 'Unable to load credits at the moment',
        variant: 'loading'
      });
    } finally {
      isUpdating = false;
    }
  }

  /**
   * Initialize credits display
   */
  async function init() {
    await waitForDependencies();
    
    const manager = window.CreditsV2Manager;
    if (!manager) {
      if (window.appLogger) {
        window.appLogger.log('Error', 'CreditsV2Manager not available', { context: 'CreditsV2Display.init' });
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
            const creditsDisplay = document.getElementById('credits-display');
            if (creditsDisplay) {
              creditsDisplay.style.display = 'none';
            }
          }
        });
      }
      return;
    }

    // Subscribe to auth state changes
    auth.onAuthStateChanged((user) => {
      if (user) {
        // Show loading state immediately when user logs in
        applyCreditsState(LOADING_STATE);
        // Then update with actual credits
        updateCreditsDisplay();
      } else {
        const creditsDisplay = document.getElementById('credits-display');
        if (creditsDisplay) {
          creditsDisplay.style.display = 'none';
        }
      }
    });

    // Subscribe to credit updates from manager
    manager.subscribe((credits) => {
      const displayState = manager.formatCredits(credits);
      applyCreditsState(displayState);
    });

    // Check if we need to refresh credits on load (for new users)
    const needsRefreshOnLoad = sessionStorage.getItem('refreshCreditsOnLoad') === 'true';
    if (needsRefreshOnLoad) {
      sessionStorage.removeItem('refreshCreditsOnLoad');
    }
    
    // Initial update
    if (auth.currentUser) {
      if (needsRefreshOnLoad) {
        // If we need to refresh for new user, use forceRefresh
        updateCreditsDisplay({ forceRefresh: true });
      } else {
        updateCreditsDisplay();
      }
    }
  }

  // Expose functions to window
  window.updateCreditsDisplay = updateCreditsDisplay;
  window.clearCreditsCache = function() {
    if (window.CreditsV2Manager) {
      window.CreditsV2Manager.clearCache();
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

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also initialize after a short delay to ensure all scripts are loaded
  setTimeout(init, 100);
})();
