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

// Version logging for frontend
const FRONTEND_VERSION = '1.2.5-assistant-fix-2025-10-31';



