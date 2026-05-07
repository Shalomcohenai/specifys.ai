/**
 * Centralized API Client (core source of truth).
 */
(function () {
  'use strict';

  class ApiClient {
    constructor(baseUrl) {
      this.baseUrl = baseUrl || (window.getApiBaseUrl ? window.getApiBaseUrl() : (window.API_BASE_URL || window.BACKEND_URL || ''));
      this.cache = new Map();
      this.retryConfig = {
        maxRetries: 3,
        retryDelay: 1000,
        retryableStatuses: [408, 429, 500, 502, 503, 504]
      };
      this.cacheTTL = 5 * 60 * 1000;
    }

    async getAuthHeaders() {
      const headers = { 'Content-Type': 'application/json' };
      if (window.auth && window.auth.currentUser) {
        try {
          const token = await window.auth.currentUser.getIdToken();
          headers.Authorization = `Bearer ${token}`;
        } catch (error) {}
      }
      return headers;
    }

    async retryRequest(fn, retryCount = 0) {
      try {
        return await fn();
      } catch (error) {
        const shouldRetry = retryCount < this.retryConfig.maxRetries &&
          error.status &&
          this.retryConfig.retryableStatuses.includes(error.status);
        if (!shouldRetry) throw error;
        const delay = this.retryConfig.retryDelay * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.retryRequest(fn, retryCount + 1);
      }
    }

    async request(endpoint, options = {}) {
      const url = `${this.baseUrl}${endpoint}`;
      const method = options.method || 'GET';
      const cacheKey = method === 'GET' ? url : null;

      if (cacheKey && this.cache.has(cacheKey) && !options.skipCache) {
        const { data, timestamp } = this.cache.get(cacheKey);
        if (Date.now() - timestamp < this.cacheTTL) return data;
        this.cache.delete(cacheKey);
      }

      const headers = { ...(await this.getAuthHeaders()), ...options.headers };
      const config = { method, headers, ...options };
      if (options.body && typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
      }

      return this.retryRequest(async () => {
        const response = await fetch(url, config);
        let payload = null;
        const text = await response.text();
        if (text) {
          try { payload = JSON.parse(text); } catch (e) {}
        }

        if (!response.ok) {
          const message = payload?.error?.message || payload?.message || `API Error: ${response.status} ${response.statusText}`;
          const error = new Error(message);
          error.status = response.status;
          error.code = payload?.error?.code || null;
          error.response = payload || response;
          throw error;
        }

        const data = payload || {};
        if (cacheKey && method === 'GET') {
          this.cache.set(cacheKey, { data, timestamp: Date.now() });
        }
        return data;
      });
    }

    get(endpoint, options = {}) { return this.request(endpoint, { ...options, method: 'GET' }); }
    post(endpoint, body, options = {}) { return this.request(endpoint, { ...options, method: 'POST', body }); }
    put(endpoint, body, options = {}) { return this.request(endpoint, { ...options, method: 'PUT', body }); }
    delete(endpoint, options = {}) { return this.request(endpoint, { ...options, method: 'DELETE' }); }
    clearCache() { this.cache.clear(); }
  }

  window.api = new ApiClient();
})();
