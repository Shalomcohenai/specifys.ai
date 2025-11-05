// API Configuration
// This file centralizes all API endpoints

const API_CONFIG = {
  // Development backend URL
  development: 'http://localhost:10000',

  // Production backend URL
  // Options:
  // 1. Empty string/null = use relative URLs (API on same domain)
  // 2. Full URL = use absolute URL (API on different domain/subdomain)
  // 3. If api.specifys-ai.com doesn't exist, leave as null to use same origin
  production: 'https://specifys-ai.onrender.com', // Render backend URL

  // Auto-detect environment
  get baseUrl() {
    // If running on localhost, use development API
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return this.development;
    }
    // For production, use same origin (relative URLs will work)
    // This means API endpoints should be accessible via /api/* on the same domain
    // If API is on different domain/subdomain, set this.production to the full URL
    return this.production || '';
  }
};

// Export for use in other scripts
window.API_CONFIG = API_CONFIG;
window.API_BASE_URL = API_CONFIG.baseUrl;

// Global helper function to get API base URL (with fallbacks)
window.getApiBaseUrl = function() {
    // First try to get from API_CONFIG (which should be loaded from config.js)
    if (typeof API_CONFIG !== 'undefined' && API_CONFIG) {
        try {
            const baseUrl = API_CONFIG.baseUrl;
            if (baseUrl) {
                return baseUrl;
            }
        } catch (e) {
            console.warn('Error accessing API_CONFIG.baseUrl:', e);
        }
    }
    
    // Fallback to window.API_BASE_URL (set by config.js)
    if (typeof window.API_BASE_URL !== 'undefined' && window.API_BASE_URL) {
        return window.API_BASE_URL;
    }
    
    // Last resort: check if we're in production
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        // We're in production, use Render URL
        return 'https://specifys-ai.onrender.com';
    }
    
    // Development fallback
    return 'http://localhost:10000';
};

// Version logging for frontend
const FRONTEND_VERSION = '1.2.5-assistant-fix-2025-10-31';



