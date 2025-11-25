// API Configuration
// This file centralizes all API endpoints
//
// Suppress console output on production hosts to avoid exposing internal details
(function suppressConsoleInProduction() {
  if (typeof window === 'undefined' || typeof window.location === 'undefined' || typeof console === 'undefined') {
    return;
  }

  const hostname = (window.location.hostname || '').toLowerCase();
  const search = window.location.search || '';
  const hash = window.location.hash || '';

  const devHosts = new Set(['', 'localhost', '127.0.0.1', '::1']);
  const isDevHost =
    devHosts.has(hostname) ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.test');

  const debugFlagPattern = /(?:[?&#])(debug-console|debugConsole)=(?:1|true)/i;
  const hasDebugFlag = debugFlagPattern.test(`${search}${hash}`);

  if (isDevHost || hasDebugFlag) {
    return;
  }

  const noop = function() {};
  const methods = ['log', 'info', 'debug', 'warn', 'error', 'trace'];

  window.__SPECIFYS_ORIGINAL_CONSOLE__ = window.__SPECIFYS_ORIGINAL_CONSOLE__ || {};

  methods.forEach((method) => {
    if (typeof console[method] === 'function') {
      if (!window.__SPECIFYS_ORIGINAL_CONSOLE__[method]) {
        window.__SPECIFYS_ORIGINAL_CONSOLE__[method] = console[method].bind(console);
      }
      console[method] = noop;
    }
  });
})();

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
            // Error accessing API_CONFIG.baseUrl
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



