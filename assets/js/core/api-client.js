/**
 * Centralized API Client (core source of truth).
 */
(function () {
  'use strict';
  let isRedirectingToAuth = false;

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

    async getAuthHeaders({ forceRefresh = false } = {}) {
      const headers = { 'Content-Type': 'application/json' };
      const authUser = window.firebase?.auth?.().currentUser || window.auth?.currentUser;
      if (authUser) {
        try {
          const token = await authUser.getIdToken(forceRefresh);
          headers.Authorization = `Bearer ${token}`;
        } catch (error) {}
      } else if (typeof window.getAuxHeaders === 'function' && !forceRefresh) {
        try {
          const legacyHeaders = await window.getAuxHeaders();
          return { ...headers, ...legacyHeaders };
        } catch (error) {}
      }
      return headers;
    }

    async retryRequest(fn, retryCount = 0, retryConfig = this.retryConfig) {
      try {
        return await fn();
      } catch (error) {
        const shouldRetry = retryCount < retryConfig.maxRetries &&
          error.status &&
          retryConfig.retryableStatuses.includes(error.status);
        if (!shouldRetry) throw error;
        const delay = retryConfig.retryDelay * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.retryRequest(fn, retryCount + 1, retryConfig);
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

      const headers = { ...(await this.getAuthHeaders({ forceRefresh: Boolean(options._forceRefreshToken) })), ...options.headers };
      const config = { method, headers, ...options };
      delete config._authRetry;
      delete config._forceRefreshToken;
      delete config.retryConfig;
      if (options.body && typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
      }

      const retryConfig = {
        ...this.retryConfig,
        ...(options.retryConfig || {})
      };

      try {
        return await this.retryRequest(async () => {
          const response = await fetch(url, config);
          let payload = null;
          const text = await response.text();
          if (text) {
            try { payload = JSON.parse(text); } catch (e) {}
          }

          if (!response.ok) {
            if (response.status === 401 && !options._authRetry) {
              await this.getAuthHeaders({ forceRefresh: true });
              return this.request(endpoint, {
                ...options,
                _authRetry: true,
                _forceRefreshToken: true
              });
            }
            const message = payload?.error?.message || payload?.message || `API Error: ${response.status} ${response.statusText}`;
            const error = new Error(message);
            error.status = response.status;
            error.code = payload?.error?.code || null;
            error.response = payload || response;
            error.endpoint = endpoint;
            if (response.status === 401 || response.status === 403) {
              window.dispatchEvent(new CustomEvent('api:unauthorized', {
                detail: { status: response.status, endpoint }
              }));
            }
            throw error;
          }

          const data = payload || {};
          if (cacheKey && method === 'GET') {
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
          }
          return data;
        }, 0, retryConfig);
      } catch (error) {
        window.appLogger?.captureApiError?.(error, { endpoint, method });
        throw error;
      }
    }

    get(endpoint, options = {}) { return this.request(endpoint, { ...options, method: 'GET' }); }
    post(endpoint, body, options = {}) { return this.request(endpoint, { ...options, method: 'POST', body }); }
    put(endpoint, body, options = {}) { return this.request(endpoint, { ...options, method: 'PUT', body }); }
    delete(endpoint, options = {}) { return this.request(endpoint, { ...options, method: 'DELETE' }); }
    clearCache() { this.cache.clear(); }
  }

  window.api = new ApiClient();

  window.addEventListener('api:unauthorized', () => {
    if (isRedirectingToAuth) return;
    isRedirectingToAuth = true;
    window.showNotification?.('Session expired - redirecting to sign in...', 'warning');
    const nextUrl = `${window.location.pathname}${window.location.search}`;
    window.setTimeout(() => {
      window.location.href = `/pages/auth.html?next=${encodeURIComponent(nextUrl)}`;
    }, 1500);
  });
})();
