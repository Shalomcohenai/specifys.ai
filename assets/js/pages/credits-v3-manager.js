/**
 * Credits Manager - Unified Credit Management (V3)
 * Handles all credit operations with a single source of truth
 */

(function() {
  'use strict';

  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const API_BASE_PATH = '/api/v3/credits';
  // How long getAuthToken will wait for Firebase to hydrate currentUser
  // before giving up. Covers the race right after a redirect from auth.html,
  // where IndexedDB rehydration takes ~100-500ms in Safari/iOS.
  const AUTH_READY_TIMEOUT_MS = 1500;

  /**
   * Marker error thrown when Firebase Auth has not yet hydrated a user.
   * Treated as a transient, retryable condition (not a real ERROR) by callers.
   */
  function createAuthNotReadyError(message) {
    const err = new Error(message || 'Auth not ready');
    err.name = 'AuthNotReadyError';
    return err;
  }

  /**
   * Wait up to `timeoutMs` for `auth.currentUser` to become non-null via
   * onAuthStateChanged. Resolves with the user (or null on timeout).
   * Used only as a one-shot fallback inside getAuthToken.
   */
  function waitForAuthUser(auth, timeoutMs) {
    return new Promise((resolve) => {
      if (!auth || typeof auth.onAuthStateChanged !== 'function') {
        resolve(null);
        return;
      }
      let settled = false;
      let unsubscribe = null;
      const finish = (user) => {
        if (settled) return;
        settled = true;
        if (typeof unsubscribe === 'function') {
          try { unsubscribe(); } catch (_) { /* noop */ }
        }
        resolve(user || null);
      };
      try {
        unsubscribe = auth.onAuthStateChanged((user) => {
          if (user) finish(user);
        });
      } catch (_) {
        resolve(null);
        return;
      }
      setTimeout(() => finish(null), timeoutMs);
    });
  }

  class CreditManager {
    constructor() {
      this.cache = null;
      this.cacheTimestamp = null;
      this.listeners = new Set();
    }

    /**
     * Get API base URL
     */
    getApiBaseUrl() {
      const baseUrl = (typeof window.getApiBaseUrl === 'function')
        ? window.getApiBaseUrl()
        : (window.API_BASE_URL || window.BACKEND_URL || '');
      if (!baseUrl || typeof baseUrl !== 'string') {
        throw new Error('API base URL not configured. Ensure config.js is loaded first.');
      }
      return baseUrl.replace(/\/$/, '');
    }

    /**
     * Get Firebase auth token.
     *
     * If `auth.currentUser` is not yet available (common immediately after a
     * redirect from auth.html — Firebase compat hydrates IndexedDB async),
     * we wait briefly for `onAuthStateChanged` to fire before declaring the
     * user unauthenticated. The eventual failure throws an AuthNotReadyError
     * so callers can classify it as transient instead of a hard error.
     */
    async getAuthToken() {
      const auth = window.auth || (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null);
      if (!auth) {
        throw createAuthNotReadyError('Firebase auth not available');
      }
      let user = auth.currentUser;
      if (!user) {
        user = await waitForAuthUser(auth, AUTH_READY_TIMEOUT_MS);
      }
      if (!user) {
        throw createAuthNotReadyError('User not authenticated');
      }
      return await user.getIdToken();
    }

    /**
     * Check if error is a network error that should be retried
     */
    isNetworkError(error) {
      if (!error) return false;
      
      const errorMessage = error.message || error.toString() || '';
      const errorName = error.name || '';
      
      // Common network error patterns
      const networkErrorPatterns = [
        'fetch',
        'load failed',
        'failed to fetch',
        'networkerror',
        'network request failed',
        'network',
        'timeout',
        'econnrefused',
        'enotfound',
        'etimedout',
        'err_internet_disconnected',
        'err_network_changed',
        'aborted',
        'the network connection was lost',
        'could not connect to the server'
      ];

      const lowerMessage = errorMessage.toLowerCase();
      const lowerName = errorName.toLowerCase();

      if (networkErrorPatterns.some(pattern => lowerMessage.includes(pattern))) {
        return true;
      }
      // Safari iOS uses TypeError + "Load failed" without the word "fetch"
      if (lowerName === 'typeerror' && (
        lowerMessage.includes('load failed') ||
        lowerMessage.includes('failed to fetch') ||
        lowerMessage.includes('network')
      )) {
        return true;
      }
      return false;
    }

    /**
     * Make API request with fallback to old API
     */
    async apiRequest(method, path, body = null, retries = 2) {
      const apiBaseUrl = this.getApiBaseUrl();
      
      // Validate URL construction
      if (!apiBaseUrl || !path) {
        const error = new Error('Invalid API URL configuration');
        if (window.appLogger) {
          window.appLogger.logError(error, { 
            context: 'CreditsV3Manager.apiRequest',
            apiBaseUrl,
            path,
            method
          });
        }
        throw error;
      }
      
      // Try new API first
      let url = `${apiBaseUrl}${API_BASE_PATH}${path}`;
      
      // Validate final URL
      try {
        new URL(url); // This will throw if URL is invalid
      } catch (urlError) {
        const error = new Error(`Invalid URL: ${url}`);
        if (window.appLogger) {
          window.appLogger.logError(error, { 
            context: 'CreditsV3Manager.apiRequest',
            constructedUrl: url,
            apiBaseUrl,
            path
          });
        }
        throw error;
      }

      const options = {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      // Retry logic for network errors or rate limiting
      let lastError;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const token = await this.getAuthToken();
          options.headers['Authorization'] = `Bearer ${token}`;

          if (window.appLogger && attempt > 0) {
            window.appLogger.log('Info', `Retrying API request (attempt ${attempt + 1}/${retries + 1})`, {
              context: 'CreditsV3Manager.apiRequest',
              url,
              method,
              attempt
            });
          }
          
          const response = await fetch(url, options);

          if (response.status === 401) {
            const errorData401 = await response.json().catch(() => ({ message: 'Unknown error' }));
            const msg401 = `${errorData401.message || ''} ${JSON.stringify(errorData401)}`.toLowerCase();
            const expired401 =
              msg401.includes('id-token-expired') ||
              msg401.includes('token has expired') ||
              msg401.includes('auth/id-token-expired');
            if (expired401 && attempt < retries) {
              const auth401 = window.auth || (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null);
              if (auth401 && auth401.currentUser) {
                await auth401.currentUser.getIdToken(true);
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
                continue;
              }
            }
            const err401 = new Error(errorData401.message || 'API error: 401');
            if (window.appLogger) {
              window.appLogger.logError(err401, {
                context: 'CreditsV3Manager.apiRequest',
                url,
                method,
                status: 401,
                errorData: errorData401
              });
            }
            throw err401;
          }

          // Handle rate limiting (429) - wait and retry
          if (response.status === 429 && attempt < retries) {
            const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
            if (window.appLogger) {
              window.appLogger.log('Info', `Rate limited, waiting ${waitTime}ms before retry`, {
                context: 'CreditsV3Manager.apiRequest',
                url,
                attempt
              });
            }
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue; // Retry
          }
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            const error = new Error(errorData.message || `API error: ${response.status}`);
            if (window.appLogger) {
              window.appLogger.logError(error, {
                context: 'CreditsV3Manager.apiRequest',
                url,
                method,
                status: response.status,
                statusText: response.statusText,
                errorData
              });
            }
            throw error;
          }

          const data = await response.json();
          
          if (window.appLogger && attempt > 0) {
            window.appLogger.log('Info', 'API request succeeded after retry', {
              context: 'CreditsV3Manager.apiRequest',
              url,
              method,
              attempt
            });
          }
          
          return data;
        } catch (error) {
          lastError = error;

          // Classify the error so we can decide whether to retry and at what
          // log level to surface it. "AuthNotReadyError" is a transient race
          // (Firebase rehydrating right after redirect from auth.html) and
          // should be retried like a network error, then logged at Info — not
          // as an ERROR — if it ultimately fails.
          const isNetwork = this.isNetworkError(error);
          const isAuthNotReady = error?.name === 'AuthNotReadyError';
          const shouldRetry = attempt < retries && (isNetwork || isAuthNotReady || error.message.includes('429'));

          if (window.appLogger && !shouldRetry) {
            if (isAuthNotReady) {
              window.appLogger.log('Info', 'API request aborted: auth not ready', {
                context: 'CreditsV3Manager.apiRequest',
                url,
                method,
                attempt: attempt + 1,
                maxRetries: retries + 1,
                isAuthNotReady: true,
                willRetry: false,
                errorMessage: error?.message
              });
            } else {
              window.appLogger.logError(error, {
                context: 'CreditsV3Manager.apiRequest',
                url,
                method,
                attempt: attempt + 1,
                maxRetries: retries + 1,
                isNetworkError: isNetwork,
                willRetry: false
              });
            }
          } else if (window.appLogger && shouldRetry) {
            window.appLogger.log('Info', 'API request failed, will retry', {
              context: 'CreditsV3Manager.apiRequest',
              url,
              method,
              attempt: attempt + 1,
              maxRetries: retries + 1,
              isNetworkError: isNetwork,
              isAuthNotReady,
              errorMessage: error?.message
            });
          }

          if (shouldRetry) {
            const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
          
          // Don't retry - throw the error
          throw error;
        }
      }
      
      // This should never be reached, but just in case
      throw lastError || new Error('API request failed after retries');
    }

    /**
     * Get credits - single method, handles caching
     * @param {boolean} forceRefresh - Force refresh from API
     * @returns {Promise<Object>} - Credits data
     */
    async getCredits(forceRefresh = false) {
      // Check cache
      if (!forceRefresh && this.cache && 
          Date.now() - this.cacheTimestamp < CACHE_TTL) {
        if (window.appLogger) {
          window.appLogger.log('Debug', 'Returning cached credits', {
            context: 'CreditsV3Manager.getCredits',
            cacheAge: Date.now() - this.cacheTimestamp
          });
        }
        return this.cache;
      }

      try {
        // Fetch from API
        const data = await this.apiRequest('GET', '/');

        // Update cache
        this.cache = data;
        this.cacheTimestamp = Date.now();

        // Notify listeners
        this.notifyListeners(data);

        if (window.appLogger) {
          window.appLogger.log('Debug', 'Credits fetched successfully', {
            context: 'CreditsV3Manager.getCredits',
            unlimited: data.unlimited,
            total: data.total,
            forceRefresh
          });
        }

        return data;
      } catch (error) {
        // Enhanced error logging
        if (window.appLogger) {
          const errorContext = {
            context: 'CreditsV3Manager.getCredits',
            forceRefresh,
            hasCache: !!this.cache,
            cacheAge: this.cache ? Date.now() - this.cacheTimestamp : null,
            errorName: error?.name,
            errorMessage: error?.message,
            isNetworkError: this.isNetworkError(error)
          };
          window.appLogger.logError(error, errorContext);
        }
        
        // Return cached data if available, even if stale
        if (this.cache) {
          if (window.appLogger) {
            window.appLogger.log('Info', 'Returning stale cached credits due to error', {
              context: 'CreditsV3Manager.getCredits',
              cacheAge: Date.now() - this.cacheTimestamp,
              errorName: error?.name
            });
          }
          return this.cache;
        }
        
        throw error;
      }
    }

    /**
     * Consume a credit
     * @param {string} specId - Specification ID
     * @param {Object} options - Options (priority)
     * @returns {Promise<Object>} - Result
     */
    async consumeCredit(specId, options = {}) {
      try {
        // Try new API first
        try {
          const result = await this.apiRequest('POST', '/consume', {
            specId: specId,
            priority: options.priority
          });

          // Clear cache to force refresh
          this.clearCache();

          // Notify listeners
          if (this.cache) {
            this.notifyListeners(this.cache);
          }

          return result;
        } catch (error) {
          // If 404, try fallback to old API
          if (error.message.includes('404')) {
            const token = await this.getAuthToken();
            const apiBaseUrl = this.getApiBaseUrl();
            const fallbackUrl = `${apiBaseUrl}/api/specs/consume-credit`;
            
            const response = await fetch(fallbackUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ specId })
            });
            
            if (response.ok) {
              const result = await response.json();
              this.clearCache();
              return result;
            }
          }
          throw error;
        }
      } catch (error) {
        if (window.appLogger) {
          window.appLogger.logError(error, { context: 'CreditsV3Manager.consumeCredit', specId });
        }
        throw error;
      }
    }

    /**
     * Subscribe to credit updates
     * @param {Function} callback - Callback function
     * @returns {Function} - Unsubscribe function
     */
    subscribe(callback) {
      this.listeners.add(callback);

      // Return unsubscribe function
      return () => {
        this.listeners.delete(callback);
      };
    }

    /**
     * Clear cache
     */
    clearCache() {
      this.cache = null;
      this.cacheTimestamp = null;
    }

    /**
     * Format credits for display
     * @param {Object} credits - Credits data from API
     * @returns {Object} - Formatted display data
     */
    formatCredits(credits) {
      if (!credits) {
        return {
          text: 'Loading credits…',
          variant: 'loading',
          title: 'Retrieving latest credits'
        };
      }

      if (credits.unlimited) {
        return {
          text: 'Plan: Pro',
          variant: 'unlimited',
          title: 'Unlimited specifications - Pro plan',
          breakdown: null
        };
      }

      const total = credits.total || 0;
      
      return {
        text: `Credits: ${total}`,
        variant: 'credits',
        title: `${total} specification credit${total !== 1 ? 's' : ''} remaining`,
        breakdown: credits.breakdown || {
          paid: 0,
          free: 0,
          bonus: 0
        }
      };
    }

    /**
     * Notify all listeners
     * @param {Object} data - Credits data
     */
    notifyListeners(data) {
      this.listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          if (window.appLogger) {
            window.appLogger.logError(error, { context: 'CreditsV3Manager.listener' });
          }
        }
      });
    }

    /**
     * Check if user has access to create specs
     * @returns {Promise<boolean>} - True if user has access
     */
    async hasAccess() {
      try {
        const credits = await this.getCredits();
        return credits.unlimited || (credits.total && credits.total > 0);
      } catch (error) {
        if (window.appLogger) {
          window.appLogger.logError(error, { context: 'CreditsV3Manager.hasAccess' });
        }
        return false;
      }
    }
  }

  // Create singleton instance
  const creditManager = new CreditManager();

  // Expose V3 manager globally.
  window.CreditsV3Manager = creditManager;
  window.creditsV3Manager = creditManager;
  
  // Dispatch ready event
  window.dispatchEvent(new Event('credits-v3-manager-ready'));

  // Export for module systems
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = creditManager;
  }
})();
