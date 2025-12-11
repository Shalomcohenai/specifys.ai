/**
 * Credits Display Module - Specifys.ai
 * Handles updating the credits display in the header
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'specifys_last_credits';
  const STORAGE_TTL = 1000 * 60 * 60 * 24; // 24 hours
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const CREDIT_CLASSES = ['unlimited', 'free', 'loading'];

  // Wait for Firebase to be available and initialized
  function waitForFirebase() {
    return new Promise((resolve) => {
      // Check if Firebase is loaded and initialized
      const checkFirebase = () => {
        if (typeof firebase !== 'undefined' && 
            firebase.apps && 
            firebase.apps.length > 0 && 
            firebase.auth && 
            firebase.firestore) {
          return true;
        }
        // Also check if window.auth exists (set by initFirebase)
        if (window.auth && window.db) {
          return true;
        }
        return false;
      };

      if (checkFirebase()) {
        resolve();
      } else {
        // Listen for firebase-ready event
        const readyHandler = () => {
          window.removeEventListener('firebase-ready', readyHandler);
          resolve();
        };
        window.addEventListener('firebase-ready', readyHandler);

        // Also poll as fallback
        const checkInterval = setInterval(() => {
          if (checkFirebase()) {
            clearInterval(checkInterval);
            window.removeEventListener('firebase-ready', readyHandler);
            resolve();
          }
        }, 100);

        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          window.removeEventListener('firebase-ready', readyHandler);
          if (!checkFirebase()) {
            console.warn('Firebase initialization timeout in credits-display.js');
          }
          resolve(); // Resolve anyway to prevent hanging
        }, 10000);
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
    // Remove hidden class to show the element
    creditsDisplay.classList.remove('hidden');
    creditsDisplay.style.display = 'flex';
    creditsText.textContent = state.text || '';
    creditsText.title = state.title || '';

    if (!creditsDisplay.dataset.pricingAttached) {
      creditsDisplay.style.cursor = 'pointer';
      creditsDisplay.title = 'View pricing plans';
      creditsDisplay.addEventListener('click', () => {
        window.location.href = '/pages/pricing.html';
      });
      creditsDisplay.dataset.pricingAttached = 'true';
    }

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
    const now = Date.now();
    bucket[userId] = {
      text: state.text || '',
      title: state.title || '',
      variant: state.variant || 'credits',
      savedAt: now,
      updatedAt: now,
      lastFetchTimestamp: now
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
   * @param {Object} options - Options for update
   * @param {boolean} options.showLoading - Show loading state
   * @param {boolean} options.forceRefresh - Force refresh from API (ignore cache)
   */
  async function updateCreditsDisplay(options = {}) {
    await waitForFirebase();
    const auth = window.auth || (firebase && firebase.auth ? firebase.auth() : null);
    if (!auth) return null;
    const user = auth.currentUser;
    if (!user) {
      const creditsDisplay = document.getElementById('credits-display');
      if (creditsDisplay) {
        creditsDisplay.style.display = 'none';
      }
      return;
    }

    const userId = user.uid;
    
    // Check if we need to fetch from API or can use cache
    const storedState = getStoredCreditsState(userId);
    const now = Date.now();
    const lastFetch = storedState?.lastFetchTimestamp || 0;
    const shouldFetch = options.forceRefresh || (now - lastFetch) >= CACHE_DURATION;
    
    // If we have cached state and don't need to fetch, use it immediately
    if (storedState && !shouldFetch && !options.showLoading) {
      applyCreditsState(storedState);
      return;
    }
    
    if (options.showLoading) {
      applyCreditsState(LOADING_STATE);
    }
    
    // Prevent concurrent updates
    if (isUpdating && !options.forceRefresh) {
      return;
    }
    isUpdating = true;

    try {
      // Use entitlements cache if available (performance optimization)
      let data;
      if (typeof window.getEntitlements === 'function' && !options.forceRefresh && !shouldFetch) {
        // Use cached entitlements (reduces API calls and CORS preflight overhead)
        data = await window.getEntitlements(false);
      } else {
        // Fallback to direct API call if cache is not available
        const token = await user.getIdToken();
        const apiBaseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : 'https://specifys-ai.onrender.com';
        data = await window.api.get('/api/specs/entitlements');
      }
      
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
        
        // Update store with credits
        if (window.store) {
          const credits = entitlements?.unlimited 
            ? 'unlimited' 
            : entitlements?.spec_credits || userData?.free_specs_remaining || 0;
          window.store.set('credits', credits);
          window.store.set('entitlements', entitlements);
          window.store.set('user', userData);
        }
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
    } finally {
      isUpdating = false;
    }
  }

  let activeUserId = null;
  let entitlementsUnsubscribe = null;
  let userUnsubscribe = null;
  let isUpdating = false;

  /**
   * Check if user is new (created within last 5 minutes)
   */
  async function checkIfNewUser(userId) {
    try {
      await waitForFirebase();
      const db = window.db || (firebase && firebase.firestore ? firebase.firestore() : null);
      if (!db) return false;
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) return true;
      const createdAt = userDoc.data()?.createdAt;
      if (createdAt) {
        const created = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
        return (Date.now() - created.getTime()) < 5 * 60 * 1000; // 5 minutes
      }
      return false;
    } catch (error) {
      console.warn('Error checking if new user:', error);
      return false;
    }
  }

  /**
   * Update UI from entitlements and user data
   */
  function updateUIFromData(entitlements, userData) {
    // Prevent updates if there's an active API update
    if (isUpdating) {
      return;
    }
    
    // Check if we should update based on timestamp
    const storedState = getStoredCreditsState(activeUserId);
    const now = Date.now();
    if (storedState && storedState.updatedAt) {
      // Only update if this data is newer than what we have
      // Firestore listeners might fire with stale data
      const dataAge = now - (storedState.updatedAt || 0);
      // If we have recent data (less than 1 second old), skip update from listener
      // This prevents race conditions where listener fires before API response
      if (dataAge < 1000) {
        return;
      }
    }
    
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

    if (creditsState && activeUserId) {
      applyCreditsState(creditsState);
      saveCreditsState(activeUserId, creditsState);
    }
  }

  /**
   * Initialize Firestore listeners for real-time updates
   */
  async function initCreditsListeners(userId) {
    await waitForFirebase();
    const db = window.db || (firebase && firebase.firestore ? firebase.firestore() : null);
    if (!db) {
      console.warn('Firestore not available for credits listeners');
      return;
    }

    // Clean up existing listeners
    if (entitlementsUnsubscribe) {
      entitlementsUnsubscribe();
      entitlementsUnsubscribe = null;
    }
    if (userUnsubscribe) {
      userUnsubscribe();
      userUnsubscribe = null;
    }

    // Listen to entitlements collection
    const entitlementsRef = db
      .collection('entitlements')
      .doc(userId);
    
    entitlementsUnsubscribe = entitlementsRef.onSnapshot(
      (snapshot) => {
        const entitlements = snapshot.exists ? snapshot.data() : {};
        
        // Get user data to combine with entitlements
        db
          .collection('users')
          .doc(userId)
          .get()
          .then((userSnap) => {
            const userData = userSnap.exists ? userSnap.data() : {};
            updateUIFromData(entitlements, userData);
          })
          .catch((error) => {
            console.warn('Error fetching user data for credits display:', error);
            updateUIFromData(entitlements, null);
          });
      },
      (error) => {
        console.warn('Error in entitlements listener:', error);
      }
    );

    // Listen to users collection (for free_specs_remaining)
    const userRef = db
      .collection('users')
      .doc(userId);
    
    userUnsubscribe = userRef.onSnapshot(
      (snapshot) => {
        const userData = snapshot.exists ? snapshot.data() : {};
        
        // Get entitlements to combine with user data
        db
          .collection('entitlements')
          .doc(userId)
          .get()
          .then((entSnap) => {
            const entitlements = entSnap.exists ? entSnap.data() : {};
            updateUIFromData(entitlements, userData);
          })
          .catch((error) => {
            console.warn('Error fetching entitlements for credits display:', error);
            updateUIFromData({}, userData);
          });
      },
      (error) => {
        console.warn('Error in user listener:', error);
      }
    );
  }

  /**
   * Update credits display with retry mechanism for new users
   */
  async function updateCreditsDisplayWithRetry(options = {}, retryCount = 0) {
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [1000, 2000, 3000]; // ms
    
    try {
      await updateCreditsDisplay(options);
    } catch (error) {
      // If this is a new user or fetch failed, retry
      if (retryCount < MAX_RETRIES) {
        const isNewUser = await checkIfNewUser(activeUserId);
        if (isNewUser || error.message.includes('Failed to fetch')) {
          const delay = RETRY_DELAYS[retryCount] || 3000;
          setTimeout(() => {
            updateCreditsDisplayWithRetry(options, retryCount + 1);
          }, delay);
          return;
        }
      }
      // Re-throw if not retrying
      throw error;
    }
  }

  function init() {
    waitForFirebase().then(async () => {
      const auth = window.auth || (firebase && firebase.auth ? firebase.auth() : null);
      if (!auth) {
        console.warn('Auth not available in credits-display.js');
        return;
      }
      auth.onAuthStateChanged(async (user) => {
        // Clean up existing listeners
        if (entitlementsUnsubscribe) {
          entitlementsUnsubscribe();
          entitlementsUnsubscribe = null;
        }
        if (userUnsubscribe) {
          userUnsubscribe();
          userUnsubscribe = null;
        }
        
        if (user) {
          activeUserId = user.uid;
          const storedState = getStoredCreditsState(user.uid);
          if (storedState) {
            // Show cached state immediately
            applyCreditsState(storedState);
          } else {
            // Only show loading if we don't have cached state
            applyCreditsState(LOADING_STATE);
          }
          
          // Check if new user - use polling instead of delay
          const isNewUser = await checkIfNewUser(user.uid);
          if (isNewUser) {
            // Poll for documents to be created (max 5 seconds)
            let pollCount = 0;
            const maxPolls = 10; // 10 * 500ms = 5 seconds
            const pollInterval = setInterval(async () => {
              pollCount++;
              const db = window.db || (firebase && firebase.firestore ? firebase.firestore() : null);
              if (db) {
                try {
                  const [userDoc, entitlementsDoc] = await Promise.all([
                    db.collection('users').doc(user.uid).get(),
                    db.collection('entitlements').doc(user.uid).get()
                  ]);
                  
                  if (userDoc.exists || entitlementsDoc.exists || pollCount >= maxPolls) {
                    clearInterval(pollInterval);
                    updateCreditsDisplayWithRetry();
                  }
                } catch (error) {
                  console.warn('Error polling for user documents:', error);
                  if (pollCount >= maxPolls) {
                    clearInterval(pollInterval);
                    updateCreditsDisplayWithRetry();
                  }
                }
              } else if (pollCount >= maxPolls) {
                clearInterval(pollInterval);
                updateCreditsDisplayWithRetry();
              }
            }, 500);
          } else {
            // Not a new user - update immediately
            updateCreditsDisplayWithRetry();
          }
          
          // Initialize Firestore listeners for real-time updates
          initCreditsListeners(user.uid).catch((error) => {
            console.warn('Error initializing credits listeners:', error);
          });
        } else {
          activeUserId = null;
          const creditsDisplay = document.getElementById('credits-display');
          if (creditsDisplay) {
            creditsDisplay.style.display = 'none';
          }
        }
      });

      if (auth && typeof auth.onIdTokenChanged === 'function') {
        auth.onIdTokenChanged((user) => {
          if (user && user.uid === activeUserId) {
            // Only update if token actually changed (not on every page load)
            updateCreditsDisplay({ forceRefresh: false });
          }
        });
      }

      const user = auth && auth.currentUser ? auth.currentUser : null;
      if (user) {
        activeUserId = user.uid;
        const storedState = getStoredCreditsState(user.uid);
        if (storedState) {
          // Show cached state immediately
          applyCreditsState(storedState);
        } else {
          // Only show loading if we don't have cached state
          applyCreditsState(LOADING_STATE);
        }
        
        // Check if new user - use polling instead of delay
        checkIfNewUser(user.uid).then(async (isNew) => {
          if (isNew) {
            // Poll for documents to be created (max 5 seconds)
            let pollCount = 0;
            const maxPolls = 10; // 10 * 500ms = 5 seconds
            const pollInterval = setInterval(async () => {
              pollCount++;
              const db = window.db || (firebase && firebase.firestore ? firebase.firestore() : null);
              if (db) {
                try {
                  const [userDoc, entitlementsDoc] = await Promise.all([
                    db.collection('users').doc(user.uid).get(),
                    db.collection('entitlements').doc(user.uid).get()
                  ]);
                  
                  if (userDoc.exists || entitlementsDoc.exists || pollCount >= maxPolls) {
                    clearInterval(pollInterval);
                    updateCreditsDisplayWithRetry();
                  }
                } catch (error) {
                  console.warn('Error polling for user documents:', error);
                  if (pollCount >= maxPolls) {
                    clearInterval(pollInterval);
                    updateCreditsDisplayWithRetry();
                  }
                }
              } else if (pollCount >= maxPolls) {
                clearInterval(pollInterval);
                updateCreditsDisplayWithRetry();
              }
            }, 500);
          } else {
            // Not a new user - update immediately
            updateCreditsDisplayWithRetry();
          }
          initCreditsListeners(user.uid).catch((error) => {
            console.warn('Error initializing credits listeners:', error);
          });
        });
      }
    });
    
    // Clean up listeners on page unload
    window.addEventListener('beforeunload', () => {
      if (entitlementsUnsubscribe) {
        entitlementsUnsubscribe();
        entitlementsUnsubscribe = null;
      }
      if (userUnsubscribe) {
        userUnsubscribe();
        userUnsubscribe = null;
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
