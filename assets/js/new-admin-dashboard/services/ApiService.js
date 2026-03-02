/**
 * API Service - Handles all API calls
 */

import { firebaseService } from '../core/FirebaseService.js';

export class ApiService {
  constructor() {
    this.baseUrl = this.getApiBaseUrl();
    // Request deduplication - prevent duplicate concurrent requests
    this.pendingRequests = new Map();
  }
  
  /**
   * Get API base URL
   */
  getApiBaseUrl() {
    if (typeof window.getApiBaseUrl === 'function') {
      const url = window.getApiBaseUrl();
      // Ensure URL doesn't have trailing slash
      return url.endsWith('/') ? url.slice(0, -1) : url;
    }
    return window.getApiBaseUrl ? window.getApiBaseUrl() : (window.API_BASE_URL || window.BACKEND_URL || '');
  }
  
  /**
   * Get auth token
   */
  async getAuthToken(forceRefresh = false) {
    try {
      const user = firebaseService.getCurrentUser();
      if (!user) return null;
      return await user.getIdToken(forceRefresh);
    } catch (error) {
      console.error('[ApiService] Error getting auth token:', error);
      return null;
    }
  }
  
  /**
   * Make API request with deduplication
   */
  async request(endpoint, options = {}) {
    // Create request key for deduplication (only for GET requests)
    const isGet = !options.method || options.method === 'GET';
    const requestKey = isGet ? `${endpoint}:${JSON.stringify(options)}` : null;
    
    // Check if same request is already pending
    if (requestKey && this.pendingRequests.has(requestKey)) {
      // Return the existing promise
      return this.pendingRequests.get(requestKey);
    }
    
    const token = await this.getAuthToken();
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Ensure endpoint starts with / and baseUrl doesn't end with /
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const cleanBaseUrl = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    const url = `${cleanBaseUrl}${cleanEndpoint}`;
    
    // Create request promise
    const requestPromise = (async () => {
      try {
        const response = await fetch(url, {
          ...options,
          headers
        });
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: response.statusText }));
          throw new Error(error.message || `HTTP ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error(`[ApiService] Error in request to ${endpoint}:`, error);
        throw error;
      } finally {
        // Remove from pending requests after completion
        if (requestKey) {
          this.pendingRequests.delete(requestKey);
        }
      }
    })();
    
    // Store pending request if it's a GET request
    if (requestKey) {
      this.pendingRequests.set(requestKey, requestPromise);
    }
    
    return requestPromise;
  }
  
  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'GET'
    });
  }
  
  /**
   * POST request
   */
  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  /**
   * PUT request
   */
  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
  
  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'DELETE'
    });
  }
  
  /**
   * Sync user credits - uses users sync endpoint
   */
  async syncCredits() {
    return this.post('/api/admin/users/sync', {
      ensureEntitlements: true,
      includeDataCollections: false
    });
  }
  
  /**
   * Sync users
   */
  async syncUsers() {
    return this.post('/api/admin/users/sync');
  }
  
  /**
   * Get content stats
   */
  async getContentStats(range = 'week') {
    return this.get(`/api/analytics/content-stats?range=${range}`);
  }

  /**
   * Get Buy Now button clicks per product (pricing page)
   */
  async getBuyNowClicks(range = 'all') {
    return this.get(`/api/analytics/buy-now-clicks?range=${range}`);
  }
  
  /**
   * Get user sync status
   */
  async getUserSyncStatus() {
    return this.get('/api/admin/users/sync-status');
  }
}

// Export singleton
export const apiService = new ApiService();

