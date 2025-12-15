// Pricing page JavaScript
// Always use Render backend URL
// Prevent re-declaration errors by checking first
(function() {
    'use strict';
    
    // Check if already initialized to prevent double-loading
    if (window.PRICING_JS_INITIALIZED) {
        return; // Already loaded, skip
    }
    window.PRICING_JS_INITIALIZED = true;
    
    // Set API base URL - use main backend server
    var API_BASE_URL = window.PRICING_API_BASE_URL || (window.getApiBaseUrl ? window.getApiBaseUrl() : 'https://specifys-ai-development.onrender.com');
    // Ensure it includes /api if not already present
    if (!API_BASE_URL.endsWith('/api')) {
        API_BASE_URL = API_BASE_URL + '/api';
    }
    window.PRICING_API_BASE_URL = API_BASE_URL;
    
    var lemonConfigPromise = null;
    var lemonSdkPromise = null;
    var productButtons = [];

// Initialize product buttons when DOM is ready
function initProductButtons() {
    productButtons = Array.from(document.querySelectorAll('button[data-product-key]'));
    productButtons.forEach((btn) => {
        if (!btn.dataset.originalLabel) {
            const btnText = btn.querySelector('.btn-text');
            btn.dataset.originalLabel = btnText ? btnText.textContent.trim() : btn.textContent.trim();
        }
    });
}

function setProductButtonsDisabled(disabled) {
    productButtons.forEach((btn) => {
        // Don't modify buttons that are currently loading
        if (btn.classList.contains('loading')) {
            return;
        }
        
        btn.disabled = disabled;
        if (disabled) {
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        } else {
            btn.style.opacity = '';
            btn.style.cursor = '';
        }
    });
}

function updateProductButtonsForUser(user) {
    const shouldDisable = !user;
    setProductButtonsDisabled(shouldDisable);
}

function getPricingAlertContainer() {
    let container = document.getElementById('pricing-alert');
    if (container) {
        return container;
    }
    container = document.createElement('div');
    container.id = 'pricing-alert';
    container.className = 'pricing-alert';
    const hero = document.querySelector('.pricing-hero .container');
    if (hero && hero.parentNode) {
        hero.parentNode.insertBefore(container, hero.nextSibling);
    } else {
        document.body.prepend(container);
    }
    return container;
}

function showPricingAlert(message, type = 'success') {
    const container = getPricingAlertContainer();
    container.textContent = message;
    container.setAttribute('data-type', type);
    container.style.display = 'block';
}

function hidePricingAlert() {
    const container = document.getElementById('pricing-alert');
    if (container) {
        container.style.display = 'none';
        container.textContent = '';
    }
}

function handleCheckoutRedirect() {
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get('checkout');
    const productKey = params.get('product');

    if (checkoutStatus === 'success') {
        const productLabel = productKey ? productKey.replace(/_/g, ' ') : 'purchase';
        showPricingAlert(`Purchase successful! Your ${productLabel} will be available shortly.`, 'success');
    } else if (checkoutStatus === 'cancel') {
        showPricingAlert('Checkout was cancelled. You can try again whenever you are ready.', 'info');
    }

    const redirectReason = params.get('reason');
    const redirectMessage = params.get('message');
    if (redirectReason || redirectMessage) {
        const alertType = redirectReason === 'insufficient_credits' ? 'error' : 'info';
        showPricingAlert(redirectMessage || 'Please choose a plan to continue.', alertType);
    }

    if (checkoutStatus) {
        params.delete('checkout');
        params.delete('product');
    }
    if (redirectReason || redirectMessage) {
        params.delete('reason');
        params.delete('message');
    }

    if (checkoutStatus || redirectReason || redirectMessage) {
        const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
        window.history.replaceState({}, document.title, newUrl);
    }
}

function getLemonProductsConfig() {
    if (!lemonConfigPromise) {
        lemonConfigPromise = fetch('/assets/data/lemon-products.json')
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Failed to load product configuration');
                }
                return response.json();
            })
            .catch((error) => {
                throw error;
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

async function openCheckoutOverlay(checkoutUrl, handlers = {}) {
    await loadLemonSqueezySDK().catch((error) => {
        // Error loading Lemon Squeezy SDK
    });

    const { onSuccess, onOpen } = handlers;
    let opened = false;
    let openNotified = false;
    let overlayMethodUsed = false;

    // Call onOpen callback when checkout window opens (only once)
    const notifyOpen = () => {
        if (typeof onOpen === 'function' && !openNotified) {
            openNotified = true;
            onOpen();
        }
    };

    // Method 2: Try LemonSqueezy.Url.Open (also overlay - fallback)
    function tryNextOverlayMethod() {
        if (opened || overlayMethodUsed) return; // Already opened via overlay
        
        if (window.LemonSqueezy && typeof window.LemonSqueezy.Setup === 'function') {
            try {
                let successDetected = false;
                
                window.LemonSqueezy.Setup({
                    eventHandler: (eventName) => {
                        if (eventName === 'Checkout.Opened') {
                            opened = true;
                            overlayMethodUsed = true;
                            notifyOpen();
                        }
                        if (eventName === 'Checkout.Success' && typeof onSuccess === 'function') {
                            // Only call onSuccess for actual successful checkout
                            successDetected = true;
                            onSuccess();
                        }
                        if (eventName === 'Checkout.Closed' && !successDetected) {
                            // Checkout closed without success - don't call onSuccess
                        }
                    }
                });
                
                if (window.LemonSqueezy.Url && typeof window.LemonSqueezy.Url.Open === 'function') {
                    window.LemonSqueezy.Url.Open(checkoutUrl);
                    // Check if it opened after a delay
                    setTimeout(() => {
                        if (!opened) {
                            // URL.Open didn't work either - overlay methods failed
                        }
                    }, 500);
                    return; // Exit if URL.Open is used
                }
            } catch (error) {
                // LemonSqueezy.Setup error
            }
        }
    }

    // Method 1: Try createLemonSqueezyCheckout (overlay - preferred)
    if (typeof window.createLemonSqueezyCheckout === 'function') {
        try {
            const checkout = window.createLemonSqueezyCheckout({
                url: checkoutUrl,
                onCheckoutSuccess: () => {
                    // Only call onSuccess for actual successful checkout
                    if (typeof onSuccess === 'function') {
                        onSuccess();
                    }
                },
                onCheckoutOpen: () => {
                    opened = true;
                    overlayMethodUsed = true;
                    notifyOpen();
                },
                onCheckoutClose: () => {
                    // Checkout closed without purchase - don't call onSuccess
                }
            });
            if (checkout && typeof checkout.open === 'function') {
                checkout.open();
                // Give it a moment to open, then check if it succeeded
                setTimeout(() => {
                    if (!opened && !overlayMethodUsed) {
                        // Overlay didn't open, try next method
                        tryNextOverlayMethod();
                    }
                }, 500);
            } else {
                // checkout.open not available, try next method
                tryNextOverlayMethod();
            }
        } catch (error) {
            // createLemonSqueezyCheckout error
            // On error, try next method
            tryNextOverlayMethod();
        }
    } else {
        // createLemonSqueezyCheckout not available, try next method
        tryNextOverlayMethod();
    }

    return opened;
}

function setButtonLoading(button, isLoading) {
    if (!button) return;
    
    const btnText = button.querySelector('.btn-text');
    if (!btnText) return;
    
    if (isLoading) {
        button.disabled = true;
        button.classList.add('loading');
        button.style.cursor = 'wait';
    } else {
        button.disabled = false;
        button.classList.remove('loading');
        button.style.cursor = '';
    }
}

function updateButtonLoadingText(button, text) {
    if (!button) return;
    const btnText = button.querySelector('.btn-text');
    if (btnText) {
        btnText.textContent = text;
    }
}

function startLoadingTextRotation(button) {
    const loadingMessages = [
        'Initializing checkout...',
        'Connecting to payment system...',
        'Preparing your order...',
        'Almost ready...',
        'Setting up checkout...'
    ];
    
    let messageIndex = 0;
    const interval = setInterval(() => {
        if (!button.classList.contains('loading')) {
            clearInterval(interval);
            return;
        }
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        updateButtonLoadingText(button, loadingMessages[messageIndex]);
    }, 6000); // Change message every 6 seconds
    
    // Store interval ID on button for cleanup
    button.dataset.loadingInterval = interval;
    
    // Set initial message
    updateButtonLoadingText(button, loadingMessages[0]);
}

function stopLoadingTextRotation(button) {
    if (button && button.dataset.loadingInterval) {
        clearInterval(parseInt(button.dataset.loadingInterval));
        delete button.dataset.loadingInterval;
    }
}

function restoreButtonText(button) {
    if (!button) return;
    const originalLabel = button.dataset.originalLabel || 'Buy Now';
    updateButtonLoadingText(button, originalLabel);
}

async function purchaseSpec(evt, productKey) {
    const triggerButton = evt?.currentTarget || document.querySelector(`button[data-product-key="${productKey}"]`);

    if (triggerButton && triggerButton.disabled) {
        return;
    }

    // Store original button text if not already stored
    if (!triggerButton.dataset.originalLabel) {
        const btnText = triggerButton.querySelector('.btn-text');
        triggerButton.dataset.originalLabel = btnText ? btnText.textContent.trim() : triggerButton.textContent.trim();
    }

    // Flag to track if checkout window opened (to prevent double cleanup)
    let checkoutOpened = false;

    try {
        hidePricingAlert();

        const user = firebase.auth().currentUser;
        if (!user) {
            showPricingAlert('Please log in to purchase.', 'info');
            window.location.href = '/pages/auth.html';
            return;
        }

        trackCTA(`Purchase ${productKey}`, 'pricing_page');
        
        // Track Buy Now button click
        if (typeof window.analyticsTracker !== 'undefined') {
            window.analyticsTracker.trackButtonClick(`buy_now_${productKey}`, {
                productKey,
                location: 'pricing_page'
            });
            window.analyticsTracker.trackFunnelStep('buy_now_click', user.uid, {
                productKey
            });
        }

        // Start loading state with spinner and rotating messages
        setButtonLoading(triggerButton, true);
        startLoadingTextRotation(triggerButton);

        // Try to wake up server before starting purchase flow
        updateButtonLoadingText(triggerButton, 'Checking server connection...');
        await wakeUpServer().catch(() => {
            // Ignore errors - we'll retry in the purchase flow
        });

        const productsConfig = await getLemonProductsConfig();
        const product = productsConfig?.products?.[productKey];

        if (!product) {
            stopLoadingTextRotation(triggerButton);
            setButtonLoading(triggerButton, false);
            restoreButtonText(triggerButton);
            showPricingAlert('Selected product is not available. Please try again later.', 'error');
            return;
        }

        const token = await user.getIdToken();

        // Retry logic for when server is sleeping (Render.com cold start)
        let response;
        let lastError;
        const maxRetries = 4; // Increased retries for cold start
        const retryDelay = 4000; // 4 seconds between retries (longer for cold start)
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    // Update button text to show retry attempt
                    updateButtonLoadingText(triggerButton, `Server is waking up... (${attempt}/${maxRetries - 1})`);
                    
                    // Before retry, try to wake up the server
                    await wakeUpServer();
                    
                    // Wait before retry (give server time to wake up)
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
                
                response = await fetch(`${API_BASE_URL}/lemon/checkout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        productKey,
                        successPath: '/pages/pricing.html',
                        successQuery: { product: productKey }
                    })
                });

                if (response.ok) {
                    break; // Success, exit retry loop
                }
                
                // Handle 404 as server sleeping (cold start) - retry
                if (response.status === 404) {
                    lastError = new Error('Server is starting up, please wait...');
                    if (attempt < maxRetries - 1) {
                        continue; // Retry
                    }
                    // Last attempt - try to get error message
                    const errorPayload = await response.json().catch(() => ({}));
                    throw new Error(errorPayload.error || 'Server endpoint not found. Please try again in a moment.');
                }
                
                // If it's a server error (5xx) or network error, retry
                if (response.status >= 500 || response.status === 0) {
                    lastError = new Error('Server is starting up, please wait...');
                    if (attempt < maxRetries - 1) {
                        continue; // Retry
                    }
                    // Last attempt - try to get error message
                    const errorPayload = await response.json().catch(() => ({}));
                    throw new Error(errorPayload.error || 'Server error. Please try again in a moment.');
                }
                
                // For other 4xx errors (401, 403, etc.), don't retry
                const errorPayload = await response.json().catch(() => ({}));
                throw new Error(errorPayload.error || `Request failed (${response.status}). Please try again.`);
            } catch (error) {
                lastError = error;
                
                // Check if it's a retryable error
                const isRetryable = 
                    !response || // Network error
                    response.status === 0 || // Network error
                    response.status === 404 || // Server sleeping (cold start)
                    response.status >= 500 || // Server error
                    error.message.includes('fetch') || 
                    error.message.includes('network') ||
                    error.message.includes('Failed to fetch') ||
                    error.name === 'TypeError' ||
                    error.name === 'NetworkError';
                
                if (attempt < maxRetries - 1 && isRetryable) {
                    continue; // Retry
                }
                
                // Not retryable or out of retries
                throw error;
            }
        }

        if (!response || !response.ok) {
            // Provide more specific error message
            if (lastError) {
                throw lastError;
            }
            
            // Generic error with helpful message
            if (response && response.status === 404) {
                throw new Error('Server is starting up. Please wait a moment and try again.');
            } else if (response && response.status >= 500) {
                throw new Error('Server is temporarily unavailable. Please try again in a moment.');
            } else {
                throw new Error('Failed to start checkout. Please try again or contact support if the problem persists.');
            }
        }

        const data = await response.json();
        if (!data.checkoutUrl) {
            throw new Error('Checkout URL missing from server response');
        }

        // Stop loading rotation and update text before opening checkout
        stopLoadingTextRotation(triggerButton);
        updateButtonLoadingText(triggerButton, 'Opening checkout...');

        await openCheckoutOverlay(data.checkoutUrl, {
            onOpen: () => {
                // Checkout window opened - stop loading and restore button
                checkoutOpened = true;
                stopLoadingTextRotation(triggerButton);
                setButtonLoading(triggerButton, false);
                restoreButtonText(triggerButton);
                
                // Track checkout initiation
                if (typeof window.analyticsTracker !== 'undefined') {
                    window.analyticsTracker.trackFunnelStep('checkout_initiated', user.uid, {
                        productKey
                    });
                }
            },
            onSuccess: () => {
                showPricingAlert('Purchase successful! You will be redirected shortly.', 'success');
                
                // Track checkout success
                if (typeof window.analyticsTracker !== 'undefined') {
                    window.analyticsTracker.trackFunnelStep('checkout_success', user.uid, {
                        productKey
                    });
                }
            }
        });
    } catch (error) {
        // Checkout error
        if (!checkoutOpened) {
            stopLoadingTextRotation(triggerButton);
            setButtonLoading(triggerButton, false);
            restoreButtonText(triggerButton);
        }
        
        // Provide user-friendly error messages
        let errorMessage = error.message || 'Error initiating purchase. Please try again.';
        
        // Make error messages more user-friendly
        if (errorMessage.includes('Server is starting up') || errorMessage.includes('waking up')) {
            errorMessage = 'The server is starting up. Please wait a moment and click "Buy Now" again.';
        } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
            errorMessage = 'The server is temporarily unavailable. Please wait a moment and try again.';
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
            errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
            errorMessage = 'Please log in again to complete your purchase.';
        }
        
        showPricingAlert(errorMessage, 'error');
    } finally {
        // Only clean up if checkout didn't open (to avoid double cleanup)
        if (!checkoutOpened) {
            stopLoadingTextRotation(triggerButton);
            setButtonLoading(triggerButton, false);
            restoreButtonText(triggerButton);
        }
        
        const currentUser = (typeof firebase !== 'undefined' && typeof firebase.auth === 'function')
            ? firebase.auth().currentUser
            : null;
        updateProductButtonsForUser(currentUser);
    }
}

// Expose purchaseSpec to global scope for inline onclick handlers
window.purchaseSpec = purchaseSpec;

// Track CTA function (if not already defined)
function trackCTA(ctaName, location) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'cta_click', {
            event_category: 'CTA',
            event_label: ctaName,
            cta_location: location
        });
    }
}

// Switch billing period for Pro plan
function switchBilling(period) {
    const monthlyBtn = document.querySelector('.toggle-btn.monthly');
    const yearlyBtn = document.querySelector('.toggle-btn.yearly');
    const monthlyPlan = document.getElementById('pro-monthly');
    const yearlyPlan = document.getElementById('pro-yearly');
    
    if (!monthlyBtn || !yearlyBtn || !monthlyPlan || !yearlyPlan) {
        return;
    }
    
    if (period === 'monthly') {
        monthlyBtn.classList.add('active');
        yearlyBtn.classList.remove('active');
        monthlyPlan.classList.add('active');
        yearlyPlan.classList.remove('active');
    } else if (period === 'yearly') {
        yearlyBtn.classList.add('active');
        monthlyBtn.classList.remove('active');
        yearlyPlan.classList.add('active');
        monthlyPlan.classList.remove('active');
    }
}

// Expose switchBilling to global scope for backward compatibility
window.switchBilling = switchBilling;

// Setup billing toggle using event delegation (works even if elements load later)
let billingToggleSetup = false;
function setupBillingToggle() {
    // Only setup once to avoid duplicate listeners
    if (billingToggleSetup) {
        return;
    }
    
    // Use event delegation on the document body
    // This works even if elements are added dynamically
    if (document.body) {
        document.body.addEventListener('click', function(e) {
            const clickedBtn = e.target.closest('.toggle-btn[data-billing]');
            if (clickedBtn) {
                e.preventDefault();
                e.stopPropagation();
                const billingPeriod = clickedBtn.getAttribute('data-billing');
                if (billingPeriod) {
                    switchBilling(billingPeriod);
                }
            }
        });
        billingToggleSetup = true;
    }
}

// Initialize immediately (before DOMContentLoaded)
// This ensures the function is available for inline handlers
if (document.readyState === 'loading') {
    // DOM is still loading, wait for it
    document.addEventListener('DOMContentLoaded', function() {
        setupBillingToggle();
    });
} else {
    // DOM is already loaded, setup immediately
    setupBillingToggle();
}

// Wake up the backend server when pricing page loads
// This ensures the server is ready when user clicks "Buy Now"
async function wakeUpServer() {
    const healthUrl = `${API_BASE_URL}/health`;
    const maxRetries = 3;
    const retryDelay = 3000; // 3 seconds between retries (longer for cold start)
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            try {
                const response = await fetch(healthUrl, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'Specifys-Pricing-Page/1.0',
                        'Accept': 'application/json'
                    },
                    signal: controller.signal,
                    cache: 'no-cache'
                });
                
                clearTimeout(timeoutId);
                
                // If we get any response (even 404/500), server is awake
                // 404 might mean server is still starting, but it's responding
                if (response.status === 200 || response.status === 404 || response.status >= 500) {
                    // Server is responding (awake or waking up)
                    return true;
                }
                
                // For other status codes, consider it successful (server is awake)
                return true;
            } catch (fetchError) {
                clearTimeout(timeoutId);
                
                // Network errors or timeouts - server might be sleeping
                // Continue to retry if we have attempts left
                if (attempt < maxRetries - 1) {
                    continue;
                }
                
                // Last attempt failed - server might be down, but that's OK
                // The purchase flow will handle it with its own retry logic
                return false;
            }
        } catch (error) {
            // Unexpected error - continue to next retry if available
            if (attempt < maxRetries - 1) {
                continue;
            }
            return false;
        }
    }
    
    return false; // All retries exhausted
}

// Wake up server immediately when script loads (don't wait for DOMContentLoaded)
// This gives the server more time to wake up before user interacts
wakeUpServer();

document.addEventListener('DOMContentLoaded', () => {
    initProductButtons();
    handleCheckoutRedirect();
    setProductButtonsDisabled(true);
    
    // Billing toggle is already set up above (before DOMContentLoaded)
    // But ensure it's set up again in case DOM changed
    setupBillingToggle();
    
    // Track page view
    if (typeof window.analyticsTracker !== 'undefined') {
        window.analyticsTracker.trackPageView('pricing', {
            timestamp: new Date().toISOString()
        });
    } else if (typeof trackPageView !== 'undefined') {
        trackPageView('pricing');
    }
    
    // Wake up the server immediately when page loads
    wakeUpServer();

    if (typeof firebase !== 'undefined') {
        firebase.auth().onAuthStateChanged((user) => {
            updateProductButtonsForUser(user);
            
            // Track funnel step: pricing page view
            if (user && typeof window.analyticsTracker !== 'undefined') {
                window.analyticsTracker.trackFunnelStep('pricing_view', user.uid);
            }
        });
    }
});
})(); // End of IIFE - prevents double-loading errors
