/**
 * Entitlements Cache Module - Specifys.ai
 * Caches user entitlements for quick access
 */

(function() {
  'use strict';

  let entitlementsCache = null;
  let cacheTimestamp = null;
  const CACHE_DURATION = 300000; // 5 minutes (increased from 30 seconds for better performance)

  async function getEntitlements(forceRefresh = false) {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (typeof firebase !== 'undefined' && firebase.auth) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }

    const user = firebase.auth().currentUser;
    if (!user) {
      return {
        entitlements: {
          unlimited: false,
          spec_credits: 0,
          can_edit: false
        },
        user: null
      };
    }

    const now = Date.now();
    if (!forceRefresh && entitlementsCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
      return entitlementsCache;
    }

    try {
      // Wait for api-client to be loaded
      if (typeof window.api === 'undefined') {
        await new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (typeof window.api !== 'undefined') {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
          
          // Timeout after 5 seconds
          setTimeout(() => {
            clearInterval(checkInterval);
            if (typeof window.api === 'undefined') {
              console.warn('API client not loaded after timeout');
            }
            resolve();
          }, 5000);
        });
      }
      
      if (typeof window.api === 'undefined' || !window.api.get) {
        throw new Error('API client not available');
      }
      
      const data = await window.api.get('/api/specs/entitlements');
      
      entitlementsCache = data;
      cacheTimestamp = now;

      return data;
    } catch (error) {
      console.error('Error fetching entitlements:', error);
      
      if (entitlementsCache) {
        return entitlementsCache;
      }

      return {
        entitlements: {
          unlimited: false,
          spec_credits: 0,
          can_edit: false
        },
        user: null
      };
    }
  }

  function clearCache() {
    entitlementsCache = null;
    cacheTimestamp = null;
  }

  async function hasAccess() {
    const data = await getEntitlements();
    const { entitlements, user } = data;

    if (entitlements.unlimited) {
      return true;
    }

    if (entitlements.spec_credits && entitlements.spec_credits > 0) {
      return true;
    }

    const freeSpecs = typeof user?.free_specs_remaining === 'number' 
      ? Math.max(0, user.free_specs_remaining)
      : 1;

    return freeSpecs > 0;
  }

  let entitlementsInitialized = false;

  function init() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
          entitlementsInitialized = false;
          clearCache();
        } else if (!entitlementsInitialized) {
          entitlementsInitialized = true;
          
          // Defer until idle or after 2 seconds
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
              getEntitlements(true);
            }, { timeout: 2000 });
          } else {
            setTimeout(() => {
              getEntitlements(true);
            }, 2000);
          }
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.getEntitlements = getEntitlements;
  window.clearEntitlementsCache = clearCache;
  window.hasAccess = hasAccess;
})();
