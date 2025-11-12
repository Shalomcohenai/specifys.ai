/**
 * Credits Display Module - Specifys.ai
 * Handles updating the credits display in the header
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'specifys_last_credits';
  const STORAGE_TTL = 1000 * 60 * 60 * 24; // 24 hours
  const CREDIT_CLASSES = ['unlimited', 'free', 'loading'];

  // Wait for Firebase to be available
  function waitForFirebase() {
    return new Promise((resolve) => {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        resolve();
      } else {
        const checkInterval = setInterval(() => {
          if (typeof firebase !== 'undefined' && firebase.auth) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      }
    });
  }

  function getCreditsElements() {
    const creditsDisplay = document.getElementById('credits-display');
    const creditsText = document.getElementById('credits-text');
    if (!creditsDisplay || !creditsText) {
      return null;
    }
    return { creditsDisplay, creditsText };
  }

  function applyCreditsState(state) {
    const elements = getCreditsElements();
    if (!elements) return;

    const { creditsDisplay, creditsText } = elements;
    creditsDisplay.style.display = 'flex';
    creditsText.textContent = state.text || '';
    creditsText.title = state.title || '';

    CREDIT_CLASSES.forEach((cls) => creditsDisplay.classList.remove(cls));
    if (state.variant && CREDIT_CLASSES.includes(state.variant)) {
      creditsDisplay.classList.add(state.variant);
    }
  }

  function getStorageBucket() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Failed to parse credits storage bucket:', error);
      return {};
    }
  }

  function setStorageBucket(bucket) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bucket));
    } catch (error) {
      console.warn('Failed to persist credits state:', error);
    }
  }

  function getStoredCreditsState(userId) {
    if (!userId) return null;
    const bucket = getStorageBucket();
    const entry = bucket[userId];
    if (!entry) return null;
    if (entry.savedAt && Date.now() - entry.savedAt > STORAGE_TTL) {
      delete bucket[userId];
      setStorageBucket(bucket);
      return null;
    }
    return entry;
  }

  function saveCreditsState(userId, state) {
    if (!userId || !state) return;
    const bucket = getStorageBucket();
    bucket[userId] = {
      text: state.text || '',
      title: state.title || '',
      variant: state.variant || 'credits',
      savedAt: Date.now()
    };
    setStorageBucket(bucket);
  }

  function clearStoredCreditsState(userId) {
    if (!userId) return;
    const bucket = getStorageBucket();
    if (bucket[userId]) {
      delete bucket[userId];
      setStorageBucket(bucket);
    }
  }

  const LOADING_STATE = {
    text: 'Loading credits…',
    title: 'Retrieving latest credits',
    variant: 'loading'
  };

  /**
   * Update credits display in header
   */
  async function updateCreditsDisplay(options = {}) {
    await waitForFirebase();
    
    const user = firebase.auth().currentUser;
    if (!user) {
      const creditsDisplay = document.getElementById('credits-display');
      if (creditsDisplay) {
        creditsDisplay.style.display = 'none';
      }
      return;
    }

    const userId = user.uid;
    if (options.showLoading) {
      applyCreditsState(LOADING_STATE);
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
      const entitlements = data?.entitlements || {};
      const userData = data?.user || null;
      
      let creditsState = null;
      if (entitlements?.unlimited) {
        creditsState = {
          text: 'Plan: Pro',
          title: 'Unlimited specifications - Pro plan',
          variant: 'unlimited'
        };
      } else if (typeof entitlements?.spec_credits === 'number' && entitlements.spec_credits > 0) {
        creditsState = {
          text: `Credits: ${entitlements.spec_credits}`,
          title: `${entitlements.spec_credits} specification credit${entitlements.spec_credits !== 1 ? 's' : ''}`,
          variant: 'credits'
        };
      } else {
        const freeSpecs = typeof userData?.free_specs_remaining === 'number'
          ? Math.max(0, userData.free_specs_remaining)
          : 1;
        
        if (freeSpecs > 0) {
          creditsState = {
            text: `Credits: ${freeSpecs}`,
            title: `${freeSpecs} free specification${freeSpecs !== 1 ? 's' : ''} remaining`,
            variant: 'credits'
          };
        } else {
          creditsState = {
            text: 'Credits: 0',
            title: 'No specification credits remaining',
            variant: 'credits'
          };
        }
      }

      if (creditsState) {
        applyCreditsState(creditsState);
        saveCreditsState(userId, creditsState);
      }
    } catch (error) {
      console.warn('Error updating credits display:', error);
      const storedState = getStoredCreditsState(userId);
      if (storedState) {
        applyCreditsState({
          ...storedState,
          title: `${storedState.title || 'Credits'} (last updated earlier; retrying soon)`
        });
      } else {
        applyCreditsState({
          text: 'Credits unavailable',
          title: 'Unable to load credits at the moment. We will retry shortly.',
          variant: 'loading'
        });
      }
    }
  }

  let refreshInterval = null;
  let activeUserId = null;

  function init() {
    waitForFirebase().then(() => {
      firebase.auth().onAuthStateChanged((user) => {
        // Clear existing interval if any
        if (refreshInterval) {
          clearInterval(refreshInterval);
          refreshInterval = null;
        }
        
        if (user) {
          activeUserId = user.uid;
          const storedState = getStoredCreditsState(user.uid);
          if (storedState) {
            applyCreditsState(storedState);
          } else {
            applyCreditsState(LOADING_STATE);
          }
          updateCreditsDisplay();
          refreshInterval = setInterval(updateCreditsDisplay, 30000);
        } else {
          activeUserId = null;
          const creditsDisplay = document.getElementById('credits-display');
          if (creditsDisplay) {
            creditsDisplay.style.display = 'none';
          }
        }
      });

      firebase.auth().onIdTokenChanged((user) => {
        if (user && user.uid === activeUserId) {
          updateCreditsDisplay();
        }
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && activeUserId) {
          updateCreditsDisplay();
        }
      });

      window.addEventListener('focus', () => {
        if (activeUserId) {
          updateCreditsDisplay();
        }
      });

      const user = firebase.auth().currentUser;
      if (user) {
        activeUserId = user.uid;
        const storedState = getStoredCreditsState(user.uid);
        if (storedState) {
          applyCreditsState(storedState);
        } else {
          applyCreditsState(LOADING_STATE);
        }
        updateCreditsDisplay();
      }
    });
    
    // Clean up interval on page unload
    window.addEventListener('beforeunload', () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.updateCreditsDisplay = updateCreditsDisplay;
})();
