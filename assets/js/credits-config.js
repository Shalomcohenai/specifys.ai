/**
 * Credits Configuration
 * Default configuration for credits system
 * This file is loaded before auth scripts to ensure configuration is available
 */

(function() {
  'use strict';

  // Credits configuration object
  window.CREDITS_CONFIG = window.CREDITS_CONFIG || {
    // Default credit values
    defaultFreeCredits: 1,
    defaultPaidCredits: 0,
    defaultBonusCredits: 0,
    
    // Cache settings
    cacheTTL: 5 * 60 * 1000, // 5 minutes
    
    // API settings
    apiBasePath: '/api/v2/credits',
    
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

