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
   * Read the count of welcome credits granted during the most recent signup.
   * Falls back to legacy boolean flags so older sessions still get the welcome UI.
   * @returns {number} - Optimistic credit count (0 means "no optimistic state").
   */
  function getOptimisticWelcomeCount() {
    try {
      const raw = sessionStorage.getItem('welcomeCreditsCount');
      if (raw !== null && raw !== '') {
        const parsed = parseInt(raw, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
      const refreshOnLoad = sessionStorage.getItem('refreshCreditsOnLoad') === 'true';
      const showPopup = sessionStorage.getItem('showCreditPopup') === 'true';
      if (refreshOnLoad || showPopup) {
        return 1;
      }
    } catch (e) {
      // sessionStorage may be unavailable (e.g. SSR/private mode); ignore.
    }
    return 0;
  }

  /**
   * Render the optimistic "Credits: N" state if a welcome grant is pending.
   * Safe to call before Firebase has restored the auth session.
   * @returns {boolean} - true if optimistic state was applied.
   */
  function applyOptimisticWelcomeCreditsIfNeeded() {
    const total = getOptimisticWelcomeCount();
    if (total <= 0) return false;
    applyCreditsState({
      text: `Credits: ${total}`,
      variant: 'credits',
      title: `${total} specification credit${total !== 1 ? 's' : ''} remaining`
    });
    return true;
  }

  /**
   * Show the earliest possible state for the credits widget:
   *  - If a welcome grant is pending (just registered), render "Credits: N" optimistically.
   *    This must NOT depend on auth.currentUser, because Firebase's IndexedDB hydration
   *    is async and `currentUser` is typically null for the first ~100-500ms after redirect.
   *  - Otherwise, if Firebase already exposes an authenticated user, show the loading state.
   *  - Otherwise, leave the element hidden (guest UI is decided later in init()).
   */
  function checkAndShowLoadingEarly() {
    // Highest priority: a brand-new user that we already know was granted N credits.
    if (applyOptimisticWelcomeCreditsIfNeeded()) {
      return;
    }

    let auth = null;
    try {
      auth = window.auth || (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null);
    } catch (e) {
      return;
    }

    if (!auth) {
      return;
    }

    const user = auth.currentUser;
    if (user) {
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
      // If we're mid-welcome-grant the absence of auth is almost certainly transient
      // (Firebase compat still hydrating from IndexedDB). Don't trash the optimistic UI.
      if (!applyOptimisticWelcomeCreditsIfNeeded()) {
        applyCreditsState(GUEST_PRICING_STATE);
      }
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      if (!applyOptimisticWelcomeCreditsIfNeeded()) {
        applyCreditsState(GUEST_PRICING_STATE);
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

      // Guard: if a welcome grant is still pending and the API hasn't caught up
      // (returns less than the optimistic count), keep the optimistic state on
      // screen instead of regressing to "Credits: 0".
      const optimisticTotal = getOptimisticWelcomeCount();
      const apiTotal = (credits && typeof credits.total === 'number') ? credits.total : null;
      const apiIsBehindOptimistic = optimisticTotal > 0
        && !(credits && credits.unlimited)
        && apiTotal !== null
        && apiTotal < optimisticTotal;

      if (apiIsBehindOptimistic) {
        applyOptimisticWelcomeCreditsIfNeeded();
        if (window.appLogger) {
          window.appLogger.log('Debug', 'API total behind optimistic, keeping optimistic UI', {
            context: 'CreditsV3Display.updateCreditsDisplay',
            apiTotal,
            optimisticTotal
          });
        }
      } else {
        // Format for display and apply to UI
        const displayState = manager.formatCredits(credits);
        applyCreditsState(displayState);

        // API matches/exceeds optimistic — clear the optimistic flags so future loads
        // don't keep retrying.
        if (optimisticTotal > 0 && (credits?.unlimited || (apiTotal !== null && apiTotal >= optimisticTotal))) {
          try {
            sessionStorage.removeItem('welcomeCreditsCount');
            sessionStorage.removeItem('refreshCreditsOnLoad');
          } catch (e) { /* sessionStorage unavailable */ }
        }
      }
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

      // For brand-new users we showed an optimistic Credits: N. If the API returns 0
      // it usually means the welcome grant hasn't propagated yet — keep retrying so we
      // don't end up flashing "Credits: 0" over our optimistic UI.
      const optimisticTotal = getOptimisticWelcomeCount();
      const apiTotal = (credits && typeof credits.total === 'number') ? credits.total : null;
      const hasReachedOptimistic = credits && (
        credits.unlimited ||
        (apiTotal !== null && (optimisticTotal <= 0 || apiTotal >= optimisticTotal))
      );

      if (hasReachedOptimistic) {
        if (window.appLogger && attempt > 0) {
          window.appLogger.log('Info', 'Credits loaded successfully after retry', {
            context: 'CreditsV3Display.updateCreditsDisplayWithRetry',
            attempt: attempt + 1,
            credits: credits.unlimited ? 'unlimited' : credits.total
          });
        }
        // Welcome grant has materialised; we no longer need the optimistic flag.
        try {
          sessionStorage.removeItem('welcomeCreditsCount');
          sessionStorage.removeItem('refreshCreditsOnLoad');
        } catch (e) { /* sessionStorage unavailable */ }
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

    // Apply optimistic Credits: N before any auth check. Safe to repeat — applies only
    // when sessionStorage holds a pending welcome grant.
    applyOptimisticWelcomeCreditsIfNeeded();

    // Wait for Firebase auth
    const auth = window.auth || (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null);
    if (!auth) {
      // Wait for auth to be ready
      if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
          if (user) {
            // Respect a pending welcome grant here too (mirrors the main path below).
            if (getOptimisticWelcomeCount() > 0) {
              applyOptimisticWelcomeCreditsIfNeeded();
              updateCreditsDisplayWithRetry({ forceRefresh: true }, 5);
              showWelcomeCreditMessage();
            } else {
              applyCreditsState(LOADING_STATE);
              updateCreditsDisplay();
            }
          } else if (getOptimisticWelcomeCount() <= 0) {
            applyCreditsState(GUEST_PRICING_STATE);
          }
        });
      }
      // Show Pricing for guests while auth loads — only if we're not in the welcome flow.
      if (getOptimisticWelcomeCount() <= 0) {
        applyCreditsState(GUEST_PRICING_STATE);
      }
      return;
    }

    // Track if we've already initialized to prevent duplicate subscriptions
    if (window.__creditsV3DisplayInitialized) {
      return;
    }
    window.__creditsV3DisplayInitialized = true;

    // Helper: handle the "new-user landing on homepage right after registration" path.
    // Must be safe to call multiple times (e.g. once from init's eager check, once
    // from onAuthStateChanged once Firebase finishes restoring the session).
    let welcomeFlowStarted = false;
    function startWelcomeFlow() {
      if (welcomeFlowStarted) return;
      welcomeFlowStarted = true;
      // Optimistic UI is also applied in checkAndShowLoadingEarly, but reapply
      // here in case some other code path (e.g. LOADING_STATE) just overwrote it.
      applyOptimisticWelcomeCreditsIfNeeded();
      updateCreditsDisplayWithRetry({ forceRefresh: true }, 5);
      showWelcomeCreditMessage();
    }

    // Subscribe to auth state changes (only once).
    // IMPORTANT: this listener must respect a pending welcome grant. If we just landed
    // here after register, currentUser is typically null when init() runs, so the
    // optimistic/new-user path below cannot trigger synchronously. We therefore mirror
    // the new-user handling inside this callback for when auth eventually hydrates.
    auth.onAuthStateChanged((user) => {
      if (!user) {
        // Don't overwrite an optimistic Credits: N with "Pricing" — that would happen
        // briefly during initial hydration if we trusted the first (null) fire.
        if (getOptimisticWelcomeCount() <= 0) {
          applyCreditsState(GUEST_PRICING_STATE);
        }
        return;
      }

      if (getOptimisticWelcomeCount() > 0) {
        startWelcomeFlow();
        return;
      }

      // Established user — show loading then refresh from API.
      applyCreditsState(LOADING_STATE);
      updateCreditsDisplay();
    });

    // Subscribe to credit updates from manager
    manager.subscribe((credits) => {
      const displayState = manager.formatCredits(credits);
      applyCreditsState(displayState);
    });

    // Eager path: if we ALREADY know we're a freshly-registered user (sessionStorage
    // flag from auth.html), kick off the welcome flow immediately, regardless of
    // whether Firebase has restored the session yet. This is the key fix for the
    // "Credits: 0 until refresh" bug.
    if (getOptimisticWelcomeCount() > 0) {
      startWelcomeFlow();
      return;
    }

    // Otherwise, take the normal path based on the (possibly transient) currentUser.
    const currentUser = auth.currentUser;
    if (currentUser) {
      updateCreditsDisplay();
    } else {
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
