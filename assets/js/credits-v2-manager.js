/**
 * Credits V2 Manager - Unified Credit Management
 * Handles all credit operations with a single source of truth
 */

(function() {
  'use strict';

  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const API_BASE_PATH = '/api/v2/credits';

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
      if (typeof window.getApiBaseUrl === 'function') {
        return window.getApiBaseUrl();
      }
      return 'https://specifys-ai.onrender.com';
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
     * Make API request with fallback to old API
     */
    async apiRequest(method, path, body = null) {
      const token = await this.getAuthToken();
      const apiBaseUrl = this.getApiBaseUrl();
      
      // Try new API first
      let url = `${apiBaseUrl}${API_BASE_PATH}${path}`;
      
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

      let response = await fetch(url, options);
      
      // If 404, try fallback to old API (for backward compatibility during deployment)
      if (response.status === 404 && path === '/') {
        // Fallback to old entitlements endpoint
        const fallbackUrl = `${apiBaseUrl}/api/specs/entitlements`;
        response = await fetch(fallbackUrl, options);
        
        if (response.ok) {
          // Convert old format to new format
          const oldData = await response.json();
          return {
            success: true,
            unlimited: oldData.entitlements?.unlimited || false,
            total: oldData.entitlements?.unlimited 
              ? null 
              : (oldData.entitlements?.spec_credits || 0) + (oldData.user?.free_specs_remaining || 0),
            breakdown: {
              paid: oldData.entitlements?.spec_credits || 0,
              free: oldData.user?.free_specs_remaining || 0,
              bonus: 0
            },
            subscription: {
              type: oldData.entitlements?.unlimited ? 'pro' : 'none',
              status: oldData.entitlements?.unlimited ? 'active' : 'none'
            },
            permissions: {
              canEdit: oldData.entitlements?.can_edit || false,
              canCreateUnlimited: oldData.entitlements?.unlimited || false
            }
          };
        }
      }
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || `API error: ${response.status}`);
      }

      return await response.json();
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

        return data;
      } catch (error) {
        console.error('[CreditsV2Manager] Error fetching credits:', error);
        
        // If 404 and no cache, try fallback to old API
        if (error.message.includes('404') && !this.cache) {
          try {
            const token = await this.getAuthToken();
            const apiBaseUrl = this.getApiBaseUrl();
            const fallbackUrl = `${apiBaseUrl}/api/specs/entitlements`;
            
            const response = await fetch(fallbackUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (response.ok) {
              const oldData = await response.json();
              // Convert old format to new format
              const data = {
                success: true,
                unlimited: oldData.entitlements?.unlimited || false,
                total: oldData.entitlements?.unlimited 
                  ? null 
                  : (oldData.entitlements?.spec_credits || 0) + (oldData.user?.free_specs_remaining || 0),
                breakdown: {
                  paid: oldData.entitlements?.spec_credits || 0,
                  free: oldData.user?.free_specs_remaining || 0,
                  bonus: 0
                },
                subscription: {
                  type: oldData.entitlements?.unlimited ? 'pro' : 'none',
                  status: oldData.entitlements?.unlimited ? 'active' : 'none'
                },
                permissions: {
                  canEdit: oldData.entitlements?.can_edit || false,
                  canCreateUnlimited: oldData.entitlements?.unlimited || false
                }
              };
              
              // Update cache
              this.cache = data;
              this.cacheTimestamp = Date.now();
              
              // Notify listeners
              this.notifyListeners(data);
              
              return data;
            }
          } catch (fallbackError) {
            console.error('[CreditsV2Manager] Fallback also failed:', fallbackError);
          }
        }
        
        // Return cached data if available, even if stale
        if (this.cache) {
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
        console.error('[CreditsV2Manager] Error consuming credit:', error);
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
          console.error('[CreditsV2Manager] Error in listener:', error);
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
        console.error('[CreditsV2Manager] Error checking access:', error);
        return false;
      }
    }
  }

  // Create singleton instance
  const creditManager = new CreditManager();

  // Expose to window
  window.CreditsV2Manager = creditManager;
  window.creditsV2Manager = creditManager;

  // Export for module systems
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = creditManager;
  }
})();
