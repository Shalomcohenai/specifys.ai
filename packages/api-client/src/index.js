/**
 * Centralized API Client
 * Handles all API calls with:
 * - Authentication headers
 * - Error handling
 * - Retry logic with exponential backoff
 * - Request/response interceptors
 * - Caching for GET requests
 */

(function() {
  'use strict';

  class ApiClient {
    constructor(baseUrl) {
      this.baseUrl = baseUrl || (window.getApiBaseUrl ? window.getApiBaseUrl() : 'https://specifys-ai-development.onrender.com');
      this.cache = new Map();
      this.retryConfig = {
        maxRetries: 3,
        retryDelay: 1000, // 1 second base delay
        retryableStatuses: [408, 429, 500, 502, 503, 504]
      };
      this.cacheTTL = 5 * 60 * 1000; // 5 minutes
      this.requestInterceptors = [];
      this.responseInterceptors = [];
    }

    /**
     * Get authentication headers
     * Automatically adds Firebase token if user is authenticated
     */
    async getAuthHeaders() {
      const headers = {
        'Content-Type': 'application/json'
      };

      // Add Firebase token if user is authenticated
      if (window.auth && window.auth.currentUser) {
        try {
          const token = await window.auth.currentUser.getIdToken();
          headers['Authorization'] = `Bearer ${token}`;
        } catch (error) {
          // Silently fail - token might not be available yet
          if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.warn('[API Client] Failed to get auth token:', error);
          }
        }
      }

      return headers;
    }

    /**
     * Retry logic with exponential backoff
     */
    async retryRequest(fn, retryCount = 0) {
      try {
        return await fn();
      } catch (error) {
        if (retryCount < this.retryConfig.maxRetries) {
          const shouldRetry = 
            error.status && 
            this.retryConfig.retryableStatuses.includes(error.status);
          
          if (shouldRetry) {
            const delay = this.retryConfig.retryDelay * Math.pow(2, retryCount);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.retryRequest(fn, retryCount + 1);
          }
        }
        throw error;
      }
    }

    /**
     * Main request method
     */
    async request(endpoint, options = {}) {
      const url = `${this.baseUrl}${endpoint}`;
      const method = options.method || 'GET';
      const cacheKey = method === 'GET' ? url : null;

      // Check cache for GET requests
      if (cacheKey && this.cache.has(cacheKey) && !options.skipCache) {
        const { data, timestamp } = this.cache.get(cacheKey);
        if (Date.now() - timestamp < this.cacheTTL) {
          return data;
        } else {
          this.cache.delete(cacheKey);
        }
      }

      const headers = {
        ...(await this.getAuthHeaders()),
        ...options.headers
      };

      const config = {
        method,
        headers,
        ...options
      };

      if (options.body && typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
      }

      return this.retryRequest(async () => {
        const response = await fetch(url, config);
        
        if (!response.ok) {
          const error = new Error(`API Error: ${response.status} ${response.statusText}`);
          error.status = response.status;
          error.response = response;
          throw error;
        }

        const data = await response.json();

        // Cache GET requests
        if (cacheKey && method === 'GET') {
          this.cache.set(cacheKey, { data, timestamp: Date.now() });
        }

        return data;
      });
    }

    // Convenience methods
    async get(endpoint, options = {}) {
      return this.request(endpoint, { ...options, method: 'GET' });
    }

    async post(endpoint, body, options = {}) {
      return this.request(endpoint, { ...options, method: 'POST', body });
    }

    async put(endpoint, body, options = {}) {
      return this.request(endpoint, { ...options, method: 'PUT', body });
    }

    async delete(endpoint, options = {}) {
      return this.request(endpoint, { ...options, method: 'DELETE' });
    }

    // Clear cache
    clearCache() {
      this.cache.clear();
    }
  }

  // Create global instance
  window.api = new ApiClient();
})();


