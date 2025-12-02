/**
 * Paywall Module - Specifys.ai
 * Handles entitlement checks and paywall display
 */

(function() {
  'use strict';

  // Always use Render backend URL
  const STORE_API_BASE_URL = 'https://specifys-ai-store.onrender.com/api';

  let lemonConfigPromise = null;
  let lemonSdkPromise = null;

  function getLemonProductsConfig() {
    if (!lemonConfigPromise) {
      lemonConfigPromise = fetch('/assets/data/lemon-products.json')
        .then((response) => {
          if (!response.ok) {
            throw new Error('Failed to load product configuration');
          }
          return response.json();
        });
    }
    return lemonConfigPromise;
  }

  function loadLemonSqueezySDK() {
    if (lemonSdkPromise) {
      return lemonSdkPromise;
    }

    if (window.LemonSqueezy && (typeof window.createLemonSqueezyCheckout === 'function' || window.LemonSqueezy.Setup)) {
      lemonSdkPromise = Promise.resolve();
      return lemonSdkPromise;
    }

    lemonSdkPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[src="https://assets.lemonsqueezy.com/lemon.js"]');
      if (existingScript) {
        existingScript.addEventListener('load', resolve);
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Lemon Squeezy SDK')));
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://assets.lemonsqueezy.com/lemon.js';
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load Lemon Squeezy SDK'));
      document.head.appendChild(script);
    }).then(() => {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50;
        const interval = setInterval(() => {
          attempts += 1;

          if (typeof window.createLemonSqueezy === 'function' && !window.LemonSqueezy) {
            try {
              window.LemonSqueezy = window.createLemonSqueezy();
            } catch (error) {
              // Failed to initialize LemonSqueezy object
            }
          }

          if (typeof window.createLemonSqueezyCheckout === 'function' || (window.LemonSqueezy && typeof window.LemonSqueezy.Setup === 'function')) {
            clearInterval(interval);
            resolve();
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            if (typeof window.createLemonSqueezyCheckout === 'function' || window.LemonSqueezy) {
              resolve();
            } else {
              reject(new Error('Lemon Squeezy SDK loaded but methods unavailable'));
            }
          }
        }, 100);
      });
    });

    return lemonSdkPromise;
  }

  async function openCheckoutOverlay(checkoutUrl, { onSuccess } = {}) {
    await loadLemonSqueezySDK().catch((error) => {
      // Error loading Lemon Squeezy SDK
    });

    let opened = false;

    if (typeof window.createLemonSqueezyCheckout === 'function') {
      try {
        const checkout = window.createLemonSqueezyCheckout({
          url: checkoutUrl,
          onCheckoutSuccess: () => {
            if (typeof onSuccess === 'function') {
              onSuccess();
            }
          }
        });
        if (checkout && typeof checkout.open === 'function') {
          checkout.open();
          opened = true;
        }
      } catch (error) {
        // createLemonSqueezyCheckout error
      }
    }

    if (!opened && window.LemonSqueezy && typeof window.LemonSqueezy.Setup === 'function') {
      try {
        window.LemonSqueezy.Setup({
          eventHandler: (eventName) => {
            if (eventName === 'Checkout.Success' && typeof onSuccess === 'function') {
              onSuccess();
            }
          }
        });
        if (window.LemonSqueezy.Url && typeof window.LemonSqueezy.Url.Open === 'function') {
          window.LemonSqueezy.Url.Open(checkoutUrl);
          opened = true;
        }
      } catch (error) {
        // LemonSqueezy.Setup error
      }
    }

    if (!opened) {
      const popup = window.open(
        checkoutUrl,
        'lemon-checkout',
        'width=600,height=700,scrollbars=yes,resizable=yes,centerscreen=yes'
      );

      if (popup) {
        opened = true;
        const interval = setInterval(() => {
          if (popup.closed) {
            clearInterval(interval);
            if (typeof onSuccess === 'function') {
              onSuccess();
            }
          }
        }, 1000);
        setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
      } else {
        window.open(checkoutUrl, '_blank');
        opened = true;
      }
    }

    return opened;
  }

  async function startCheckout(productKey, triggerButton, { onSuccess, onError, setStatus } = {}) {
    const user = firebase.auth().currentUser;
    if (!user) {
      if (typeof onError === 'function') {
        onError('Please sign in to purchase credits.');
      }
      window.location.href = '/pages/auth.html';
      return;
    }

    try {
      if (triggerButton) {
        triggerButton.disabled = true;
        triggerButton.classList.add('loading');
      }

      if (typeof setStatus === 'function') {
        setStatus('Creating checkout...');
      }

      const productsConfig = await getLemonProductsConfig();
      const product = productsConfig?.products?.[productKey];
      if (!product) {
        throw new Error('Selected product is not available. Please try again later.');
      }

      const token = await user.getIdToken();
      const response = await fetch(`${STORE_API_BASE_URL}/lemon/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          productKey,
          successPath: window.location.pathname || '/',
          successQuery: { product: productKey, source: 'paywall' }
        })
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || 'Failed to start checkout');
      }

      const data = await response.json();
      if (!data.checkoutUrl) {
        throw new Error('Checkout URL missing from server response');
      }

      if (typeof setStatus === 'function') {
        setStatus('Opening checkout…');
      }

      await openCheckoutOverlay(data.checkoutUrl, {
        onSuccess: () => {
          if (typeof onSuccess === 'function') {
            onSuccess(productKey, data);
          }
        }
      });
    } catch (error) {
      // Checkout error
      if (typeof onError === 'function') {
        onError(error.message || 'Error initiating purchase. Please try again.');
      }
    } finally {
      if (triggerButton) {
        triggerButton.classList.remove('loading');
        triggerButton.disabled = false;
      }
      if (typeof setStatus === 'function') {
        setStatus('');
      }
    }
  }

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
      const entitlements = data?.entitlements || {};
      const userData = data?.user || null;

      if (entitlements?.unlimited) {
        return {
          hasAccess: true,
          entitlements: entitlements,
          paywallData: null
        };
      }

      if (typeof entitlements?.spec_credits === 'number' && entitlements.spec_credits > 0) {
        return {
          hasAccess: true,
          entitlements: entitlements,
          paywallData: null
        };
      }

      const freeSpecs = typeof userData?.free_specs_remaining === 'number'
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
      // Error checking entitlement
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

  function renderPaywallButtons(container) {
    if (!container) return;

    const products = [
      { key: 'single_spec', label: 'Single Spec', price: '$4.90', description: 'One specification credit' },
      { key: 'three_pack', label: '3-Pack', price: '$9.90', description: 'Three specification credits' },
      { key: 'pro_monthly', label: 'Pro Monthly', price: '$29.90', description: 'Unlimited specifications' },
      { key: 'pro_yearly', label: 'Pro Yearly', price: '$299.90', description: 'Unlimited - best savings' }
    ];

    container.innerHTML = `
      ${products.map(product => `
        <button class="paywall-product-btn" data-product-key="${product.key}">
          <span class="label">${product.label}</span>
          <span class="price">${product.price}</span>
          <span class="description">${product.description}</span>
        </button>
      `).join('')}
    `;
  }

  function attachPaywallButtonHandlers(modal) {
    const buttons = modal.querySelectorAll('.paywall-product-btn');
    const statusEl = modal.querySelector('#paywall-status');
    const messageEl = modal.querySelector('#paywall-message');

    function setStatus(text) {
      if (!statusEl) return;
      if (text) {
        statusEl.textContent = text;
        statusEl.style.display = 'block';
      } else {
        statusEl.textContent = '';
        statusEl.style.display = 'none';
      }
    }

    function showError(text) {
      if (messageEl) {
        messageEl.textContent = text;
        messageEl.classList.add('error');
      }
    }

    function handleSuccess(productKey) {
      if (messageEl) {
        messageEl.textContent = 'Checkout opened in a new window. Complete your purchase to unlock more credits.';
        messageEl.classList.remove('error');
      }
    }

    buttons.forEach((button) => {
      button.addEventListener('click', async () => {
        const productKey = button.dataset.productKey;
        await startCheckout(productKey, button, {
          setStatus,
          onSuccess: handleSuccess,
          onError: showError
        });
      });
    });
  }

  function showPaywall(paywallData) {
    let paywallModal = document.getElementById('paywall-modal');
    
    if (!paywallModal) {
      paywallModal = document.createElement('div');
      paywallModal.id = 'paywall-modal';
      paywallModal.className = 'modal';
      paywallModal.innerHTML = `
        <div class="modal-content paywall-content">
          <div class="modal-header">
            <h3><i class="fa fa-lock"></i> Purchase Additional Credits</h3>
            <span class="close" onclick="closePaywall()">&times;</span>
          </div>
          <div class="modal-body">
            <p id="paywall-message">${paywallData.message}</p>
            <div id="paywall-status" class="paywall-status" style="display:none;"></div>
            <div class="paywall-products"></div>
            <div class="paywall-footer">
              <a href="/pages/pricing.html" class="pricing-link">See detailed pricing and plan comparisons</a>
            </div>
            <div class="paywall-actions">
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
      messageEl.classList.remove('error');
    }

    const productsContainer = paywallModal.querySelector('.paywall-products');
    if (productsContainer && !productsContainer.hasChildNodes()) {
      renderPaywallButtons(productsContainer);
      attachPaywallButtonHandlers(paywallModal);
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
