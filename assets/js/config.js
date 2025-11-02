// API Configuration
// This file centralizes all API endpoints

const API_CONFIG = {
  // Development backend URL
  development: 'http://localhost:10000',

  // Production backend URL
  // IMPORTANT: Update this with your actual production API URL
  // Options:
  // - https://api.specifys-ai.com (if subdomain exists)
  // - https://specifys-ai.com/api (if using same domain)
  // - Your Railway/Heroku/Render URL
  production: 'https://specifys-ai.onrender.com',

  // Auto-detect environment
  get baseUrl() {
    let url;
    // If running on localhost, use development API
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      url = this.development;
    } else {
      // Otherwise use production
      url = this.production;
    }
    
    // Ensure URL has protocol (safety check)
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      console.warn('[API_CONFIG] URL missing protocol, adding https://');
      url = 'https://' + url;
    }
    
    return url;
  },
  
  // Check if API domain is likely valid
  async validateDomain() {
    try {
      const testUrl = `${this.baseUrl}/health`;
      const response = await fetch(testUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000)
      });
      return true;
    } catch (error) {
      if (error.message && error.message.includes('ERR_NAME_NOT_RESOLVED')) {
        console.error('❌ [API_CONFIG] Domain does not resolve:', this.baseUrl);
        console.error('❌ Please check:');
        console.error('   1. DNS configuration for API domain');
        console.error('   2. API server is running');
        console.error('   3. Correct domain in config.js (line 10)');
        return false;
      }
      return true; // Other errors might be temporary
    }
  }
};

// Export for use in other scripts
window.API_CONFIG = API_CONFIG;
window.API_BASE_URL = API_CONFIG.baseUrl;

// Version logging for frontend
const FRONTEND_VERSION = '1.2.5-assistant-fix-2025-10-31';
console.log('🎨 Specifys.ai Frontend v' + FRONTEND_VERSION + ' loaded');
console.log('🔗 API Base URL:', window.API_BASE_URL);

