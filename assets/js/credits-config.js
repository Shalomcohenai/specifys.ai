/**
 * Credits Configuration
 * Default configuration for credits system
 * This file is loaded before auth scripts to ensure configuration is available
 */

(function() {
  'use strict';

  // Allow local override to use V3 credits endpoint (safe default stays on V2)
  // Note: V3 endpoint is only available if CREDITS_V3_ENABLED=true on server
  let apiBasePath = '/api/v2/credits';
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('credits_use_v3') === 'true') {
      apiBasePath = '/api/v3/credits';
    }
  } catch (e) {
    // Ignore storage access errors (e.g., blocked in some privacy modes)
  }

  // Credits configuration object
  window.CREDITS_CONFIG = window.CREDITS_CONFIG || {
    // Default credit values
    defaultFreeCredits: 1,
    defaultPaidCredits: 0,
    defaultBonusCredits: 0,
    
    // Cache settings
    cacheTTL: 5 * 60 * 1000, // 5 minutes
    
    // API settings
    apiBasePath: apiBasePath,
    
    // Feature flags
    features: {
      enableCache: true,
      enableRetry: true,
      enableFallback: true
    }
  };

  // Log that config is loaded (only in development)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('[Credits Config] Configuration loaded:', window.CREDITS_CONFIG);
  }
})();

