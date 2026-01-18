/**
 * Credits Configuration
 * Default configuration for credits system
 * This file is loaded before auth scripts to ensure configuration is available
 */

(function() {
  'use strict';

  // V3 is now the default credits system
  // Note: V3 endpoint is only available if CREDITS_V3_ENABLED=true on server
  const apiBasePath = '/api/v3/credits';

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
})();

