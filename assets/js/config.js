// API Configuration
// This file centralizes all API endpoints

const API_CONFIG = {
  // Production backend URL - always use Render
  production: 'https://specifys-ai.onrender.com', // Render backend URL

  // Always return Render URL (no localhost support)
  get baseUrl() {
    // Always use Render backend - no localhost development
    return this.production || 'https://specifys-ai.onrender.com';
  }
};

// Export for use in other scripts
window.API_CONFIG = API_CONFIG;
window.API_BASE_URL = API_CONFIG.baseUrl;

// Global helper function to get API base URL
window.getApiBaseUrl = function() {
    // First try to get from API_CONFIG (which should be loaded from config.js)
    if (typeof API_CONFIG !== 'undefined' && API_CONFIG) {
        try {
            const baseUrl = API_CONFIG.baseUrl;
            if (baseUrl && baseUrl.trim()) {
                return baseUrl;
            }
        } catch (e) {
            console.warn('Error accessing API_CONFIG.baseUrl:', e);
        }
    }
    
    // Fallback to window.API_BASE_URL (set by config.js)
    if (window.API_BASE_URL && window.API_BASE_URL.trim()) {
        return window.API_BASE_URL;
    }
    
    // Always return Render URL - no localhost support
    return 'https://specifys-ai.onrender.com';
};

// Version logging for frontend
const FRONTEND_VERSION = '1.2.5-assistant-fix-2025-10-31';



