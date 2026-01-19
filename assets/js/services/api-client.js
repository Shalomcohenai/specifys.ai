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
      this.baseUrl = baseUrl || (window.getApiBaseUrl ? window.getApiBaseUrl() : 'https://specifys-ai-development2.onrender.com');
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
     * @param {boolean} forceRefresh - Force token refresh
     */
    async getAuthHeaders(forceRefresh = false) {
      const headers = {
        'Content-Type': 'application/json'
      };

      // Add Firebase token if user is authenticated
      if (window.auth && window.auth.currentUser) {
        try {
          const token = await window.auth.currentUser.getIdToken(forceRefresh);
          headers['Authorization'] = `Bearer ${token}`;
        } catch (error) {
          // Silently fail - token might not be available yet
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
          // Check if error has status (HTTP error) or is a network error
          const isNetworkError = !error.status && (
            error.message?.includes('Failed to fetch') ||
            error.message?.includes('NetworkError') ||
            error.message?.includes('Network request failed') ||
            error.name === 'TypeError' ||
            error.name === 'NetworkError'
          );
          
          const shouldRetry = 
            (error.status && this.retryConfig.retryableStatuses.includes(error.status)) ||
            isNetworkError;
          
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
     * Apply request interceptors
     */
    async applyRequestInterceptors(config) {
      let modifiedConfig = { ...config };
      for (const interceptor of this.requestInterceptors) {
        modifiedConfig = await interceptor(modifiedConfig);
      }
      return modifiedConfig;
    }

    /**
     * Apply response interceptors
     */
    async applyResponseInterceptors(response, config) {
      let modifiedResponse = response;
      for (const interceptor of this.responseInterceptors) {
        modifiedResponse = await interceptor(modifiedResponse, config);
      }
      return modifiedResponse;
    }

    /**
     * Main request method
     */
    async request(endpoint, options = {}) {
      const url = `${this.baseUrl}${endpoint}`;
      const method = options.method || 'GET';
      const cacheKey = method === 'GET' && !options.skipCache ? url : null;

      // Check cache for GET requests
      if (cacheKey && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTTL) {
          return cached.data;
        } else {
          // Cache expired, remove it
          this.cache.delete(cacheKey);
        }
      }

      // Get authentication headers
      const authHeaders = await this.getAuthHeaders();

      // Build request config
      const config = {
        method: method,
        headers: {
          ...authHeaders,
          ...options.headers
        },
        ...options
      };

      // Handle body
      if (options.body) {
        if (typeof options.body === 'object' && !(options.body instanceof FormData)) {
          config.body = JSON.stringify(options.body);
        } else {
          config.body = options.body;
          // Remove Content-Type for FormData (browser will set it with boundary)
          if (options.body instanceof FormData) {
            delete config.headers['Content-Type'];
          }
        }
      }

      // Apply request interceptors
      const finalConfig = await this.applyRequestInterceptors(config);

      // Make request with retry logic
      return this.retryRequest(async () => {
        const response = await fetch(url, finalConfig);
        
        // Apply response interceptors
        const interceptedResponse = await this.applyResponseInterceptors(response, finalConfig);
        
        if (!interceptedResponse.ok) {
          // Handle 401 Unauthorized - try refreshing token once
          if (interceptedResponse.status === 401 && window.auth && window.auth.currentUser && !options._tokenRefreshed) {
            try {
              // Refresh token and retry request
              const refreshedHeaders = await this.getAuthHeaders(true);
              const retryConfig = {
                ...finalConfig,
                headers: {
                  ...refreshedHeaders,
                  ...options.headers
                }
              };
              options._tokenRefreshed = true; // Prevent infinite loop
              
              const retryResponse = await fetch(url, retryConfig);
              if (retryResponse.ok) {
                const contentType = retryResponse.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                  return await retryResponse.json();
                } else {
                  return await retryResponse.text();
                }
              }
            } catch (refreshError) {
              // Token refresh failed, continue with original error
            }
          }
          
          // Try to parse error response
          let errorData = null;
          let errorMessage = `API Error: ${interceptedResponse.status} ${interceptedResponse.statusText}`;
          
          try {
            const cloned = interceptedResponse.clone();
            errorData = await cloned.json();
            if (errorData.details || errorData.error || errorData.message) {
              errorMessage = errorData.details || errorData.error || errorData.message;
            }
          } catch (parseError) {
            // Not JSON, try text
            try {
              const cloned = interceptedResponse.clone();
              const errorText = await cloned.text();
              errorMessage = errorText || errorMessage;
            } catch (textError) {
              // Can't parse error, use default message
            }
          }

          const error = new Error(errorMessage);
          error.status = interceptedResponse.status;
          error.response = interceptedResponse;
          error.data = errorData;
          throw error;
        }

        // Parse response
        let data;
        const contentType = interceptedResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await interceptedResponse.json();
        } else {
          data = await interceptedResponse.text();
        }

        // Cache GET requests
        if (cacheKey && method === 'GET') {
          this.cache.set(cacheKey, {
            data: data,
            timestamp: Date.now()
          });
        }

        return data;
      });
    }

    /**
     * GET request
     */
    async get(endpoint, options = {}) {
      return this.request(endpoint, { ...options, method: 'GET' });
    }

    /**
     * POST request
     */
    async post(endpoint, body, options = {}) {
      return this.request(endpoint, { ...options, method: 'POST', body });
    }

    /**
     * PUT request
     */
    async put(endpoint, body, options = {}) {
      return this.request(endpoint, { ...options, method: 'PUT', body });
    }

    /**
     * DELETE request
     */
    async delete(endpoint, options = {}) {
      return this.request(endpoint, { ...options, method: 'DELETE' });
    }

    /**
     * Clear cache
     */
    clearCache() {
      this.cache.clear();
    }

    /**
     * Clear cache for specific endpoint
     */
    clearCacheFor(endpoint) {
      const url = `${this.baseUrl}${endpoint}`;
      this.cache.delete(url);
    }

    /**
     * Add request interceptor
     */
    addRequestInterceptor(interceptor) {
      this.requestInterceptors.push(interceptor);
      return () => {
        this.requestInterceptors = this.requestInterceptors.filter(i => i !== interceptor);
      };
    }

    /**
     * Add response interceptor
     */
    addResponseInterceptor(interceptor) {
      this.responseInterceptors.push(interceptor);
      return () => {
        this.responseInterceptors = this.responseInterceptors.filter(i => i !== interceptor);
      };
    }

    /**
     * Update base URL
     */
    setBaseUrl(baseUrl) {
      this.baseUrl = baseUrl;
      this.clearCache(); // Clear cache when base URL changes
    }
  }

  // Create global instance
  window.api = new ApiClient();

  // Expose class for advanced usage
  window.ApiClient = ApiClient;

})();


