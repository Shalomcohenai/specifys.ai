/**
 * Credits Display Module - Specifys.ai
 * Handles updating the credits display in the header
 */

(function() {
  'use strict';

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

  /**
   * Update credits display in header
   */
  async function updateCreditsDisplay() {
    await waitForFirebase();
    
    const user = firebase.auth().currentUser;
    if (!user) {
      const creditsDisplay = document.getElementById('credits-display');
      if (creditsDisplay) {
        creditsDisplay.style.display = 'none';
      }
      return;
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
      const { entitlements, user: userData } = data;
      
      const creditsDisplay = document.getElementById('credits-display');
      const creditsText = document.getElementById('credits-text');
      
      if (!creditsDisplay || !creditsText) {
        return;
      }

      creditsDisplay.style.display = 'flex';

      if (entitlements.unlimited) {
        // Pro user - show "PRO"
        creditsText.textContent = 'PRO';
        creditsText.title = 'Unlimited specs - Pro Plan';
        creditsDisplay.classList.add('unlimited');
        creditsDisplay.classList.remove('free');
      } else if (entitlements.spec_credits && entitlements.spec_credits > 0) {
        // User with purchased credits - show number
        creditsText.textContent = entitlements.spec_credits;
        creditsText.title = `${entitlements.spec_credits} spec credit${entitlements.spec_credits !== 1 ? 's' : ''}`;
        creditsDisplay.classList.remove('unlimited', 'free');
      } else {
        // Check if user has free specs remaining
        const freeSpecs = typeof userData.free_specs_remaining === 'number' 
          ? Math.max(0, userData.free_specs_remaining)
          : 1;
        
        if (freeSpecs > 0) {
          // Still has free spec - show number
          creditsText.textContent = freeSpecs;
          creditsText.title = `${freeSpecs} free spec${freeSpecs !== 1 ? 's' : ''} remaining`;
          creditsDisplay.classList.remove('unlimited', 'free');
        } else {
          // No free specs left - show "FREE"
          creditsText.textContent = 'FREE';
          creditsText.title = 'Free plan - No specs remaining';
          creditsDisplay.classList.add('free');
          creditsDisplay.classList.remove('unlimited');
        }
      }
    } catch (error) {
      console.error('Error updating credits display:', error);
      const creditsDisplay = document.getElementById('credits-display');
      if (creditsDisplay) {
        creditsDisplay.style.display = 'none';
      }
    }
  }

  let refreshInterval = null;

  function init() {
    waitForFirebase().then(() => {
      firebase.auth().onAuthStateChanged((user) => {
        // Clear existing interval if any
        if (refreshInterval) {
          clearInterval(refreshInterval);
          refreshInterval = null;
        }
        
        if (user) {
          updateCreditsDisplay();
          refreshInterval = setInterval(updateCreditsDisplay, 30000);
        } else {
          const creditsDisplay = document.getElementById('credits-display');
          if (creditsDisplay) {
            creditsDisplay.style.display = 'none';
          }
        }
      });

      const user = firebase.auth().currentUser;
      if (user) {
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
