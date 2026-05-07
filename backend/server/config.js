// Configuration file for Specifys.ai server
// ========== BACKEND BASE URL – change only here ==========
const BACKEND_BASE_URL = process.env.PRODUCTION_SERVER_URL || 'https://specifys-ai-backend.onrender.com';
const BACKEND_URL = process.env.BACKEND_URL || BACKEND_BASE_URL;
const API_VERSION = process.env.API_VERSION || 'v1';
// ==========================================================

module.exports = {
  BACKEND_BASE_URL,
  BACKEND_URL,
  API_VERSION,
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
    'http://localhost:5173',
    'http://localhost:8080',
    'http://localhost:10000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:4000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:10000',
    'https://specifys-ai.com',
    'https://www.specifys-ai.com',
    BACKEND_BASE_URL,
    process.env.RENDER_URL ? `https://${process.env.RENDER_URL}` : null
  ].filter(Boolean),
  
  // Credits V3 Configuration
  creditsV3: {
    // Production: opt-in via CREDITS_V3_ENABLED=true (matches Render / prod env).
    // Non-production: on by default so localhost and tests get /api/v3/credits without extra env;
    // set CREDITS_V3_ENABLED=false to disable locally.
    enabled:
      process.env.NODE_ENV === 'production'
        ? process.env.CREDITS_V3_ENABLED === 'true'
        : process.env.CREDITS_V3_ENABLED !== 'false'
  }
};
