/**
 * Safe localStorage utilities with error handling
 * Handles SecurityError and other localStorage access issues
 */

(function() {
  'use strict';

  /**
   * Check if localStorage is available
   */
  function isLocalStorageAvailable() {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Safe localStorage.getItem with error handling
   */
  function safeGetItem(key, defaultValue = null) {
    if (!isLocalStorageAvailable()) {
      return defaultValue;
    }
    
    try {
      const value = localStorage.getItem(key);
      return value !== null ? value : defaultValue;
    } catch (error) {
      // Handle SecurityError or other localStorage errors
      if (error.name === 'SecurityError' || error.name === 'QuotaExceededError') {
        console.warn('[localStorage-safe] Access denied or quota exceeded for key:', key);
        return defaultValue;
      }
      console.error('[localStorage-safe] Error getting item:', key, error);
      return defaultValue;
    }
  }

  /**
   * Safe localStorage.setItem with error handling
   */
  function safeSetItem(key, value) {
    if (!isLocalStorageAvailable()) {
      return false;
    }
    
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      // Handle SecurityError or QuotaExceededError
      if (error.name === 'SecurityError') {
        console.warn('[localStorage-safe] Access denied for key:', key);
        return false;
      }
      if (error.name === 'QuotaExceededError') {
        console.warn('[localStorage-safe] Quota exceeded, attempting to clear old items');
        // Try to clear some old items and retry
        try {
          // Clear items older than 7 days (simple heuristic)
          const now = Date.now();
          for (let i = 0; i < localStorage.length; i++) {
            const storageKey = localStorage.key(i);
            if (storageKey && storageKey.startsWith('specBackup_')) {
              try {
                const item = localStorage.getItem(storageKey);
                if (item) {
                  const data = JSON.parse(item);
                  if (data.timestamp && (now - data.timestamp) > 7 * 24 * 60 * 60 * 1000) {
                    localStorage.removeItem(storageKey);
                  }
                }
              } catch (e) {
                // Ignore parse errors, just remove the item
                localStorage.removeItem(storageKey);
              }
            }
          }
          // Retry setting the item
          localStorage.setItem(key, value);
          return true;
        } catch (retryError) {
          console.error('[localStorage-safe] Failed to set item after cleanup:', key, retryError);
          return false;
        }
      }
      console.error('[localStorage-safe] Error setting item:', key, error);
      return false;
    }
  }

  /**
   * Safe localStorage.removeItem with error handling
   */
  function safeRemoveItem(key) {
    if (!isLocalStorageAvailable()) {
      return false;
    }
    
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      if (error.name === 'SecurityError') {
        console.warn('[localStorage-safe] Access denied for removing key:', key);
        return false;
      }
      console.error('[localStorage-safe] Error removing item:', key, error);
      return false;
    }
  }

  /**
   * Safe localStorage.clear with error handling
   */
  function safeClear() {
    if (!isLocalStorageAvailable()) {
      return false;
    }
    
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      if (error.name === 'SecurityError') {
        console.warn('[localStorage-safe] Access denied for clear');
        return false;
      }
      console.error('[localStorage-safe] Error clearing localStorage:', error);
      return false;
    }
  }

  // Export to window
  window.localStorageSafe = {
    getItem: safeGetItem,
    setItem: safeSetItem,
    removeItem: safeRemoveItem,
    clear: safeClear,
    isAvailable: isLocalStorageAvailable
  };
})();

