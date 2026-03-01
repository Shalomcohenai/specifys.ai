// Configuration file for Specifys.ai server
// ========== BACKEND BASE URL – change only here ==========
const BACKEND_BASE_URL = process.env.PRODUCTION_SERVER_URL || 'https://specifys-ai-backend.onrender.com';
// ==========================================================

module.exports = {
  BACKEND_BASE_URL,
  // Server configuration
  port: process.env.PORT || 10000,
  
  // Google Apps Script URL for feedback
  googleAppsScriptUrl: 'https://script.google.com/macros/s/AKfycbym3fu04RejAdA6GHKV9lMkT5dgkB9cxgY9yZ0hPkGxJzPrSrO3pT0XgooeL_z4_mtayQ/exec',
  
  // Production server URL
  productionServerUrl: BACKEND_BASE_URL,
  
  // CORS origins (allowed domains)
  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:4000',
    'http://localhost:5000',
    'http://localhost:10000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:4000',
    'http://127.0.0.1:10000',
    'https://specifys-ai.com',
    'https://www.specifys-ai.com',
    BACKEND_BASE_URL,
    process.env.RENDER_URL ? `https://${process.env.RENDER_URL}` : null
  ].filter(Boolean),
  
  // Credits V3 Configuration
  creditsV3: {
    // Enable V3 system (default: false - disabled)
    enabled: process.env.CREDITS_V3_ENABLED === 'true'
  }
};
