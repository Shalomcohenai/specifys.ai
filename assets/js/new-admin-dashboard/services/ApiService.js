/**
 * API Service - Handles all API calls
 */

import { firebaseService } from '../core/FirebaseService.js';

export class ApiService {
  constructor() {
    this.baseUrl = this.getApiBaseUrl();
  }
  
  /**
   * Get API base URL
   */
  getApiBaseUrl() {
    if (typeof window.getApiBaseUrl === 'function') {
      return window.getApiBaseUrl();
    }
    return 'https://specifys-ai-development.onrender.com';
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
   * Make API request
   */
  async request(endpoint, options = {}) {
    const token = await this.getAuthToken();
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const url = `${this.baseUrl}${endpoint}`;
    
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
    }
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
   * Sync user credits
   */
  async syncCredits() {
    return this.post('/api/admin/users/sync-credits');
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
   * Get user sync status
   */
  async getUserSyncStatus() {
    return this.get('/api/admin/users/sync-status');
  }
}

// Export singleton
export const apiService = new ApiService();

