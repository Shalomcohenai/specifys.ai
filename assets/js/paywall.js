/**
 * Paywall Module - Specifys.ai
 * Handles entitlement checks and paywall display
 */

(function() {
  'use strict';

  async function checkEntitlement() {
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
        hasAccess: false,
        entitlements: null,
        paywallData: {
          reason: 'not_authenticated',
          message: 'Please sign in to generate specifications'
        }
      };
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

      if (entitlements.unlimited) {
        return {
          hasAccess: true,
          entitlements: entitlements,
          paywallData: null
        };
      }

      if (entitlements.spec_credits && entitlements.spec_credits > 0) {
        return {
          hasAccess: true,
          entitlements: entitlements,
          paywallData: null
        };
      }

      const freeSpecs = typeof userData.free_specs_remaining === 'number' 
        ? Math.max(0, userData.free_specs_remaining)
        : 1;

      if (freeSpecs > 0) {
        return {
          hasAccess: true,
          entitlements: entitlements,
          paywallData: null
        };
      }

      return {
        hasAccess: false,
        entitlements: entitlements,
        paywallData: {
          reason: 'insufficient_credits',
          message: 'You have no remaining spec credits',
          freeSpecs: freeSpecs,
          specCredits: entitlements.spec_credits || 0,
          unlimited: false
        }
      };
    } catch (error) {
      console.error('Error checking entitlement:', error);
      return {
        hasAccess: false,
        entitlements: null,
        paywallData: {
          reason: 'error',
          message: 'Unable to verify your access. Please try again.'
        }
      };
    }
  }

  function showPaywall(paywallData) {
    let paywallModal = document.getElementById('paywall-modal');
    
    if (!paywallModal) {
      paywallModal = document.createElement('div');
      paywallModal.id = 'paywall-modal';
      paywallModal.className = 'modal';
      paywallModal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3><i class="fa fa-lock"></i> Upgrade Required</h3>
            <span class="close" onclick="closePaywall()">&times;</span>
          </div>
          <div class="modal-body">
            <p id="paywall-message">${paywallData.message}</p>
            <div class="paywall-options">
              <a href="/pages/pricing.html" class="btn btn-primary">
                View Pricing Plans
              </a>
              <button onclick="closePaywall()" class="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(paywallModal);
    }

    const messageEl = document.getElementById('paywall-message');
    if (messageEl) {
      messageEl.textContent = paywallData.message;
    }

    paywallModal.style.display = 'block';
  }

  function closePaywall() {
    const paywallModal = document.getElementById('paywall-modal');
    if (paywallModal) {
      paywallModal.style.display = 'none';
    }
  }

  window.checkEntitlement = checkEntitlement;
  window.showPaywall = showPaywall;
  window.closePaywall = closePaywall;
})();
