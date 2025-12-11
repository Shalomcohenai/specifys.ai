// Pricing page JavaScript
// Always use Render backend URL
const API_BASE_URL = 'https://specifys-ai-store.onrender.com/api';

let lemonConfigPromise = null;
let lemonSdkPromise = null;
const productButtons = Array.from(document.querySelectorAll('button[data-product-key]'));

productButtons.forEach((btn) => {
    if (!btn.dataset.originalLabel) {
        const btnText = btn.querySelector('.btn-text');
        btn.dataset.originalLabel = btnText ? btnText.textContent.trim() : btn.textContent.trim();
    }
});

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

        const response = await fetch(`${API_BASE_URL}/lemon/checkout`, {
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

        if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            throw new Error(errorPayload.error || 'Failed to start checkout');
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
        showPricingAlert(error.message || 'Error initiating purchase. Please try again.', 'error');
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
    
    if (period === 'monthly') {
        monthlyBtn.classList.add('active');
        yearlyBtn.classList.remove('active');
        monthlyPlan.classList.add('active');
        yearlyPlan.classList.remove('active');
    } else {
        yearlyBtn.classList.add('active');
        monthlyBtn.classList.remove('active');
        yearlyPlan.classList.add('active');
        monthlyPlan.classList.remove('active');
    }
}

// Wake up the backend server when pricing page loads
// This ensures the server is ready when user clicks "Buy Now"
async function wakeUpServer() {
    try {
        // Send a lightweight ping to the health endpoint to wake up the server
        const healthUrl = `${API_BASE_URL}/health`;
        
        // Use fetch with a timeout - we don't care about the response,
        // we just want to wake up the server
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        fetch(healthUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Specifys-Pricing-Page/1.0'
            },
            signal: controller.signal
        }).then(() => {
            clearTimeout(timeoutId);
        }).catch(() => {
            clearTimeout(timeoutId);
            // Silently ignore errors - we're just trying to wake up the server
            // If it fails, the user will just wait a bit longer when clicking Buy Now
        });
    } catch (error) {
        // Silently ignore - this is just a preemptive wake-up call
    }
}

document.addEventListener('DOMContentLoaded', () => {
    handleCheckoutRedirect();
    setProductButtonsDisabled(true);
    
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
