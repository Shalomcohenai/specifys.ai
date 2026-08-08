/**
 * Paywall Module - Specifys.ai
 * Handles entitlement checks and paywall display
 */

(function() {
  'use strict';

  // Use main backend server - get from config or fallback
  const STORE_API_BASE_URL = (window.getApiBaseUrl ? window.getApiBaseUrl() : (window.API_BASE_URL || window.BACKEND_URL || '')) + '/api';

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
          // Clear cache to force refresh (using new credits system)
          if (typeof window.clearCreditsCache === 'function') {
            window.clearCreditsCache();
          }
          
          // Update credits display immediately
          if (typeof window.updateCreditsDisplay === 'function') {
            window.updateCreditsDisplay({ showLoading: true, forceRefresh: true });
            
            // Retry after 2 seconds to allow webhook to process
            setTimeout(() => {
              window.updateCreditsDisplay({ forceRefresh: true });
            }, 2000);
            
            // One more retry after 5 seconds (webhook might be delayed)
            setTimeout(() => {
              window.updateCreditsDisplay({ forceRefresh: true });
            }, 5000);
          }
          
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
      const apiBaseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.API_BASE_URL || window.BACKEND_URL || '');
      // Use V3 credits API (default system)
      // Note: V3 endpoint is only available if CREDITS_V3_ENABLED=true on server
      const creditsEndpoint = '/api/v3/credits';
      const data = await window.api.get(creditsEndpoint);
      
      // New format: { unlimited, total, breakdown: { paid, free, bonus }, subscription, permissions }
      const credits = data || {};
      const unlimited = credits.unlimited || false;
      const total = credits.total || 0;
      const breakdown = credits.breakdown || { paid: 0, free: 0, bonus: 0 };

      if (unlimited) {
        return {
          hasAccess: true,
          entitlements: { unlimited: true },
          paywallData: null
        };
      }

      if (total > 0) {
        return {
          hasAccess: true,
          entitlements: { 
            unlimited: false,
            spec_credits: breakdown.paid || 0,
            total: total
          },
          paywallData: null
        };
      }

      return {
        hasAccess: false,
        entitlements: { unlimited: false, spec_credits: 0, total: 0 },
        paywallData: {
          reason: 'insufficient_credits',
          message: 'Your free credit is used up. Upgrade to Pro to unlock Database Design, Export to Cursor, Unlimited Specs, AI Review, and Team Collaboration.',
          freeSpecs: breakdown.free || 0,
          specCredits: breakdown.paid || 0,
          total: total,
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

  const PRO_PAYWALL_BENEFITS = [
    { icon: 'fa-database', title: 'Unlock Database Design', detail: 'Schema, relationships, and data model for your app' },
    { icon: 'fa-terminal', title: 'Export to Cursor', detail: 'Ship IDE-ready prompts and MCP context in one click' },
    { icon: 'fa-infinity', title: 'Unlimited Specs', detail: 'Iterate on every idea — no credit ceiling' },
    { icon: 'fa-wand-magic-sparkles', title: 'AI Review', detail: 'Deeper technical, market, and architecture coverage' },
    { icon: 'fa-users', title: 'Team Collaboration', detail: 'Share specs and keep everyone aligned' }
  ];

  function escapePaywallHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getSpecPreviewFromContext(paywallData) {
    const fromPayload = paywallData && paywallData.preview;
    if (fromPayload && (fromPayload.title || fromPayload.stage)) {
      return {
        title: fromPayload.title || 'Your specification',
        stage: fromPayload.stage || null,
        meta: fromPayload.meta || null
      };
    }

    try {
      const planning = window.planningData || null;
      const vision = planning && planning.vision && planning.vision.description;
      if (vision && String(vision).trim()) {
        const title = String(vision).trim().slice(0, 80) + (String(vision).length > 80 ? '…' : '');
        return { title, stage: 'Planning draft', meta: 'Ready to generate — Pro unlocks unlimited specs' };
      }
    } catch (_) { /* ignore */ }

    try {
      const title =
        (window.currentSpecData && (window.currentSpecData.title || window.currentSpecData.appName)) ||
        localStorage.getItem('lastSpecTitle') ||
        null;
      const stage = (window.currentSpecData && window.currentSpecData.status && window.currentSpecData.status.overview) || null;
      if (title) {
        return {
          title: String(title).slice(0, 100),
          stage: stage === 'ready' ? 'Overview ready' : (stage || 'In progress'),
          meta: 'Keep building on what you already created'
        };
      }
    } catch (_) { /* ignore */ }

    return null;
  }

  function buildExhaustedMessage(paywallData) {
    if (paywallData && paywallData.message && paywallData.reason !== 'insufficient_credits') {
      return paywallData.message;
    }
    return 'Your free credit is used up. Upgrade to Pro to keep building — unlock Database Design, Export to Cursor, Unlimited Specs, AI Review, and Team Collaboration.';
  }

  function renderPaywallButtons(container) {
    if (!container) return;

    const products = [
      {
        key: 'pro_monthly',
        label: 'Subscribe to Pro',
        price: '$1.99/mo',
        description: 'Unlimited specs · Database Design · Cursor export'
      }
    ];

    container.innerHTML = `
      ${products.map(product => `
        <button type="button" class="paywall-product-btn" data-product-key="${product.key}">
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
        statusEl.hidden = false;
      } else {
        statusEl.textContent = '';
        statusEl.hidden = true;
      }
    }

    function showError(text) {
      if (messageEl) {
        messageEl.textContent = text;
        messageEl.classList.add('is-alert');
      }
    }

    function handleSuccess() {
      if (messageEl) {
        messageEl.textContent = 'Checkout opened. Complete purchase to unlock Pro benefits on the work you already started.';
        messageEl.classList.remove('is-alert');
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

  function ensurePaywallStyles() {
    if (document.getElementById('paywall-sprint-b-styles')) return;
    const link = document.createElement('link');
    link.id = 'paywall-sprint-b-styles';
    link.rel = 'stylesheet';
    link.href = '/assets/css/pages/paywall.css';
    document.head.appendChild(link);
  }

  function renderPaywallPreview(container, paywallData) {
    if (!container) return;
    const preview = getSpecPreviewFromContext(paywallData || {});
    if (preview) {
      container.innerHTML = `
        <p class="paywall-preview-label">Your work so far</p>
        <p class="paywall-preview-title">${escapePaywallHtml(preview.title)}</p>
        <p class="paywall-preview-meta">${escapePaywallHtml(preview.stage || '')}${preview.meta ? ' · ' + escapePaywallHtml(preview.meta) : ''}</p>
      `;
      container.hidden = false;
      return;
    }
    container.innerHTML = `
      <p class="paywall-preview-label">Your next step</p>
      <p class="paywall-preview-empty">Pro unlocks the full pipeline for every idea you plan — Database Design, Cursor export, and unlimited specs.</p>
    `;
    container.hidden = false;
  }

  function onPaywallKeydown(event) {
    if (event.key === 'Escape') {
      closePaywall();
    }
  }

  function buildPaywallModal() {
    const paywallModal = document.createElement('div');
    paywallModal.id = 'paywall-modal';
    paywallModal.className = 'paywall-modal';
    paywallModal.setAttribute('role', 'dialog');
    paywallModal.setAttribute('aria-modal', 'true');
    paywallModal.setAttribute('aria-labelledby', 'paywall-title');
    paywallModal.innerHTML = `
      <div class="paywall-dialog">
        <header class="paywall-header">
          <div class="paywall-header-text">
            <span class="paywall-badge">Specifys Pro</span>
            <h2 id="paywall-title" class="paywall-title">Unlock Specifys Pro</h2>
          </div>
          <button type="button" class="paywall-close" data-paywall-close aria-label="Close">
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </header>
        <div class="paywall-body">
          <div class="paywall-main">
            <p id="paywall-message" class="paywall-reason"></p>
            <div id="paywall-preview" class="paywall-preview" hidden></div>
            <p class="paywall-benefits-heading">Everything in Pro</p>
            <ul class="paywall-benefits" id="paywall-benefits"></ul>
          </div>
          <aside class="paywall-aside">
            <p class="paywall-aside-label">One plan. Cancel anytime.</p>
            <div class="paywall-price" aria-label="1.99 US dollars per month">
              <span class="paywall-price-currency">$</span>
              <span class="paywall-price-amount">1.99</span>
              <span class="paywall-price-period">/ month</span>
            </div>
            <p class="paywall-price-note">30-day money-back guarantee</p>
            <div id="paywall-status" class="paywall-status" hidden></div>
            <div class="paywall-products"></div>
            <div class="paywall-aside-links">
              <a href="/pages/pricing.html?reason=insufficient_credits" class="pricing-link">Compare Pro benefits</a>
              <button type="button" class="paywall-dismiss" data-paywall-close>Not now</button>
            </div>
          </aside>
        </div>
      </div>
    `;

    paywallModal.addEventListener('click', (event) => {
      if (event.target === paywallModal || event.target.closest('[data-paywall-close]')) {
        closePaywall();
      }
    });

    const benefitsEl = paywallModal.querySelector('#paywall-benefits');
    if (benefitsEl) {
      benefitsEl.innerHTML = PRO_PAYWALL_BENEFITS.map((b) => `
        <li>
          <span class="paywall-benefit-icon" aria-hidden="true"><i class="fa ${b.icon}"></i></span>
          <span>
            <strong>${escapePaywallHtml(b.title)}</strong>
            <span class="paywall-benefit-detail">${escapePaywallHtml(b.detail)}</span>
          </span>
        </li>
      `).join('');
    }

    const productsContainer = paywallModal.querySelector('.paywall-products');
    renderPaywallButtons(productsContainer);
    attachPaywallButtonHandlers(paywallModal);

    return paywallModal;
  }

  function showPaywall(paywallData) {
    ensurePaywallStyles();
    const data = paywallData || {};
    let paywallModal = document.getElementById('paywall-modal');

    if (paywallModal && !paywallModal.querySelector('.paywall-aside')) {
      paywallModal.remove();
      paywallModal = null;
    }

    if (!paywallModal) {
      paywallModal = buildPaywallModal();
      document.body.appendChild(paywallModal);
    }

    const messageEl = document.getElementById('paywall-message');
    if (messageEl) {
      messageEl.textContent = buildExhaustedMessage(data);
      messageEl.classList.toggle('is-alert', data.reason === 'error');
    }

    renderPaywallPreview(document.getElementById('paywall-preview'), data);

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    paywallModal.classList.add('is-open');
    paywallModal.style.display = '';
    document.addEventListener('keydown', onPaywallKeydown);

    const closeBtn = paywallModal.querySelector('.paywall-close');
    if (closeBtn) {
      closeBtn.focus();
    }
  }

  function closePaywall() {
    const paywallModal = document.getElementById('paywall-modal');
    if (paywallModal) {
      paywallModal.classList.remove('is-open');
      paywallModal.style.display = 'none';
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    document.removeEventListener('keydown', onPaywallKeydown);
  }

  window.checkEntitlement = checkEntitlement;
  window.showPaywall = showPaywall;
  window.closePaywall = closePaywall;
  window.PRO_PAYWALL_BENEFITS = PRO_PAYWALL_BENEFITS;
})();
