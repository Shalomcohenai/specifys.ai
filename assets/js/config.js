// API Configuration
// This file centralizes all API endpoints

const API_CONFIG = {
  // Development backend URL
  development: 'http://localhost:10000',

  // Production backend URL
  // TODO: Replace with your actual production API URL
  production: 'https://api.specifys-ai.com',

  // Auto-detect environment
  get baseUrl() {
    // If running on localhost, use development API
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return this.development;
    }
    // Otherwise use production
    return this.production;
  }
};

// Export for use in other scripts
window.API_CONFIG = API_CONFIG;
window.API_BASE_URL = API_CONFIG.baseUrl;

// Version logging for frontend
const FRONTEND_VERSION = '1.2.5-assistant-fix-2025-10-31';



