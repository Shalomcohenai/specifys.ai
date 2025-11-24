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
      const token = await user.getIdToken();
      const apiBaseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : 'https://specifys-ai.onrender.com';
      const response = await fetch(`${apiBaseUrl}/api/specs/entitlements`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch entitlements');
      }

      const data = await response.json();
      
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

  function init() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().onAuthStateChanged((user) => {
        if (!user) {
          clearCache();
        } else {
          getEntitlements(true);
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
