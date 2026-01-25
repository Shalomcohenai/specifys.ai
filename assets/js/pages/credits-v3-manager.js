/**
 * Credits Manager - Unified Credit Management (V3)
 * Handles all credit operations with a single source of truth
 */

(function() {
  'use strict';

  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const API_BASE_PATH = '/api/v3/credits';

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
      let baseUrl;
      if (typeof window.getApiBaseUrl === 'function') {
        baseUrl = window.getApiBaseUrl();
      } else if (typeof window.API_BASE_URL !== 'undefined') {
        baseUrl = window.API_BASE_URL;
      } else {
        baseUrl = 'https://specifys-ai-development2.onrender.com';
      }
      
      // Validate URL format
      if (!baseUrl || typeof baseUrl !== 'string') {
        const fallback = 'https://specifys-ai-development2.onrender.com';
        if (window.appLogger) {
          window.appLogger.log('Error', 'Invalid API base URL, using fallback', { 
            context: 'CreditsV3Manager.getApiBaseUrl',
            received: baseUrl,
            fallback: fallback
          });
        }
        return fallback;
      }
      
      // Ensure URL doesn't end with slash
      return baseUrl.replace(/\/$/, '');
    }

    /**
     * Get Firebase auth token
     */
    async getAuthToken() {
      const auth = window.auth || (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null);
      if (!auth) {
        throw new Error('Firebase auth not available');
      }
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
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
        'Load failed',
        'Failed to fetch',
        'NetworkError',
        'Network request failed',
        'network',
        'timeout',
        'ECONNREFUSED',
        'ENOTFOUND',
        'ETIMEDOUT',
        'ERR_INTERNET_DISCONNECTED',
        'ERR_NETWORK_CHANGED',
        'TypeError' // "Load failed" is a TypeError in Safari iOS
      ];
      
      // Check if error message or name matches network error patterns
      const lowerMessage = errorMessage.toLowerCase();
      const lowerName = errorName.toLowerCase();
      
      return networkErrorPatterns.some(pattern => 
        lowerMessage.includes(pattern.toLowerCase()) || 
        lowerName.includes(pattern.toLowerCase())
      );
    }

    /**
     * Make API request with fallback to old API
     */
    async apiRequest(method, path, body = null, retries = 2) {
      const token = await this.getAuthToken();
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
          'Authorization': `Bearer ${token}`,
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
          if (window.appLogger && attempt > 0) {
            window.appLogger.log('Info', `Retrying API request (attempt ${attempt + 1}/${retries + 1})`, {
              context: 'CreditsV3Manager.apiRequest',
              url,
              method,
              attempt
            });
          }
          
          const response = await fetch(url, options);
          
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
          
          // Check if this is a network error that should be retried
          const isNetwork = this.isNetworkError(error);
          const shouldRetry = attempt < retries && (isNetwork || error.message.includes('429'));
          
          if (window.appLogger) {
            window.appLogger.logError(error, {
              context: 'CreditsV3Manager.apiRequest',
              url,
              method,
              attempt: attempt + 1,
              maxRetries: retries + 1,
              isNetworkError: isNetwork,
              willRetry: shouldRetry
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
          window.appLogger.logError(error, { context: 'CreditsV2Manager.consumeCredit', specId });
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
            window.appLogger.logError(error, { context: 'CreditsV2Manager.listener' });
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
          window.appLogger.logError(error, { context: 'CreditsV2Manager.hasAccess' });
        }
        return false;
      }
    }
  }

  // Create singleton instance
  const creditManager = new CreditManager();

  // Expose to window (V3 as primary, V2 for backward compatibility)
  window.CreditsV3Manager = creditManager;
  window.creditsV3Manager = creditManager;
  window.CreditsV2Manager = creditManager; // Backward compatibility
  window.creditsV2Manager = creditManager; // Backward compatibility
  
  // Dispatch ready event
  window.dispatchEvent(new Event('credits-v3-manager-ready'));

  // Export for module systems
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = creditManager;
  }
})();
