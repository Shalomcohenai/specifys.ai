// API Configuration
// This file centralizes all API endpoints
//
// ========== BACKEND URL – single place: change only here ==========
var BACKEND_URL = 'https://specifys-ai-backend.onrender.com';
// ==================================================================
//
// Prevent double-loading - wrap everything in IIFE
(function() {
  'use strict';
  
  // If already loaded, skip initialization
  if (typeof window !== 'undefined' && window.__CONFIG_LOADED__) {
    return;
  }

  // Suppress console output on production hosts to avoid exposing internal details
  (function suppressConsoleInProduction() {
    if (typeof window === 'undefined' || typeof window.location === 'undefined' || typeof console === 'undefined') {
      return;
    }

    // Check if logs are explicitly enabled via localStorage (set by admin dashboard)
    try {
      const logsEnabled = localStorage.getItem('specifys_console_logs_enabled');
      if (logsEnabled === 'true') {
        return; // Don't suppress if explicitly enabled
      }
    } catch (e) {
      // localStorage not available, continue with normal checks
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

  window.SPECIFYS_BACKEND_URL = BACKEND_URL;
  window.BACKEND_URL = BACKEND_URL;

  const API_CONFIG = {
    staging: window.SPECIFYS_BACKEND_URL,
    local: 'http://localhost:10000',

    get isDevelopment() {
      if (typeof window === 'undefined' || typeof window.location === 'undefined') {
        return false;
      }
      const hostname = (window.location.hostname || '').toLowerCase();
      const devHosts = new Set(['localhost', '127.0.0.1', '::1']);
      return devHosts.has(hostname) ||
             hostname.endsWith('.local') ||
             hostname.endsWith('.localhost') ||
             hostname.endsWith('.lan') ||
             hostname.endsWith('.test');
    },

    get isProductionSite() {
      if (typeof window === 'undefined' || typeof window.location === 'undefined') {
        return false;
      }
      const hostname = (window.location.hostname || '').toLowerCase();
      return hostname === 'specifys-ai.com' || hostname === 'www.specifys-ai.com';
    },

    get baseUrl() {
      if (this.isDevelopment) {
        return this.local;
      }
      // Production site (specifys-ai.com) is static; API runs on Render
      if (this.isProductionSite) {
        return this.staging;
      }
      return this.staging;
    }
  };

  // Export for use in other scripts
  window.API_CONFIG = API_CONFIG;
  window.API_BASE_URL = API_CONFIG.baseUrl;

  // Global helper function to get API base URL
  window.getApiBaseUrl = function() {
      // First try to get from API_CONFIG (which should be loaded from config.js)
      if (typeof window.API_CONFIG !== 'undefined' && window.API_CONFIG) {
          try {
              const baseUrl = window.API_CONFIG.baseUrl;
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
      
      if (typeof window !== 'undefined' && window.location) {
        const hostname = (window.location.hostname || '').toLowerCase();
        const devHosts = new Set(['localhost', '127.0.0.1', '::1']);
        if (devHosts.has(hostname) ||
            hostname.endsWith('.local') ||
            hostname.endsWith('.localhost') ||
            hostname.endsWith('.lan') ||
            hostname.endsWith('.test')) {
          return 'http://localhost:10000';
        }
        if (hostname === 'specifys-ai.com' || hostname === 'www.specifys-ai.com') {
          return window.SPECIFYS_BACKEND_URL;
        }
      }
      return window.SPECIFYS_BACKEND_URL;
  };

  // Version logging for frontend
  const FRONTEND_VERSION = '1.2.5-assistant-fix-2025-10-31';

  // Mark as loaded to prevent double-loading
  window.__CONFIG_LOADED__ = true;
})();



