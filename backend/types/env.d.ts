/**
 * Environment variables types
 */

declare namespace NodeJS {
  interface ProcessEnv {
    // Server
    PORT?: string;
    NODE_ENV?: 'development' | 'production' | 'test';
    
    // Firebase
    FIREBASE_PROJECT_ID?: string;
    FIREBASE_STORAGE_BUCKET?: string;
    FIREBASE_SERVICE_ACCOUNT_KEY?: string;
    FIREBASE_SERVICE_ACCOUNT_KEY_FILE?: string;
    
    // OpenAI
    OPENAI_API_KEY?: string;
    
    // Lemon Squeezy
    LEMON_SQUEEZY_API_KEY?: string;
    LEMON_SQUEEZY_WEBHOOK_SECRET?: string;
    LEMON_SQUEEZY_STORE_ID?: string;
    
    // Cloudflare Worker
    CLOUDFLARE_WORKER_URL?: string;
    
    // Google Apps Script
    GOOGLE_APPS_SCRIPT_URL?: string;
    
    // Production
    PRODUCTION_SERVER_URL?: string;
    RENDER_URL?: string;
    
    // Other
    [key: string]: string | undefined;
  }
}


