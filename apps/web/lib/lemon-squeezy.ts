/**
 * Lemon Squeezy SDK utilities for Next.js
 */

declare global {
  interface Window {
    createLemonSqueezyCheckout?: (options: {
      url: string;
      onCheckoutSuccess?: () => void;
      onCheckoutOpen?: () => void;
      onCheckoutClose?: () => void;
    }) => {
      open: () => void;
      close: () => void;
    };
    LemonSqueezy?: {
      Setup: (options: { eventHandler: (event: any) => void }) => void;
      Url: {
        Open: (url: string) => void;
      };
    };
    createLemonSqueezy?: () => any;
  }
}

export interface LemonProductsConfig {
  products: {
    [key: string]: {
      name: string;
      variant_id: string;
      price: number;
    };
  };
}

let lemonSdkPromise: Promise<void> | null = null;

export async function loadLemonSqueezySDK(): Promise<void> {
  if (lemonSdkPromise) {
    return lemonSdkPromise;
  }

  if (
    typeof window !== 'undefined' &&
    window.LemonSqueezy &&
    (typeof window.createLemonSqueezyCheckout === 'function' ||
      typeof window.LemonSqueezy.Setup === 'function')
  ) {
    lemonSdkPromise = Promise.resolve();
    return lemonSdkPromise;
  }

  lemonSdkPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window is not available'));
      return;
    }

    const existingScript = document.querySelector(
      'script[src="https://assets.lemonsqueezy.com/lemon.js"]'
    );
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () =>
        reject(new Error('Failed to load Lemon Squeezy SDK'))
      );
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://assets.lemonsqueezy.com/lemon.js';
    script.async = true;
    script.onload = () => {
      // Wait for LemonSqueezy to be available
      let attempts = 0;
      const maxAttempts = 50;
      const interval = setInterval(() => {
        attempts += 1;

        if (
          typeof window.createLemonSqueezyCheckout === 'function' ||
          (window.LemonSqueezy && typeof window.LemonSqueezy.Setup === 'function')
        ) {
          clearInterval(interval);
          resolve();
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          if (
            typeof window.createLemonSqueezyCheckout === 'function' ||
            window.LemonSqueezy
          ) {
            resolve();
          } else {
            reject(new Error('Lemon Squeezy SDK loaded but methods unavailable'));
          }
        }
      }, 100);
    };
    script.onerror = () => reject(new Error('Failed to load Lemon Squeezy SDK'));
    document.head.appendChild(script);
  });

  return lemonSdkPromise;
}

export async function openCheckoutOverlay(
  checkoutUrl: string,
  handlers: {
    onSuccess?: () => void;
    onOpen?: () => void;
  } = {}
): Promise<boolean> {
  await loadLemonSqueezySDK().catch((error) => {
    console.error('Error loading Lemon Squeezy SDK:', error);
  });

  const { onSuccess, onOpen } = handlers;
  let opened = false;
  let openNotified = false;
  let overlayMethodUsed = false;

  const notifyOpen = () => {
    if (typeof onOpen === 'function' && !openNotified) {
      openNotified = true;
      onOpen();
    }
  };

  const tryNextOverlayMethod = () => {
    if (typeof window === 'undefined' || !window.LemonSqueezy) {
      return;
    }

    try {
      if (window.LemonSqueezy.Setup) {
        let successDetected = false;
        window.LemonSqueezy.Setup({
          eventHandler: (event: any) => {
            if (event.event === 'Checkout.Success' && !successDetected) {
              successDetected = true;
              if (typeof onSuccess === 'function') {
                onSuccess();
              }
            }
            if (event.event === 'Checkout.Closed' && !successDetected) {
              // Checkout closed without success
            }
          }
        });

        if (window.LemonSqueezy.Url && typeof window.LemonSqueezy.Url.Open === 'function') {
          window.LemonSqueezy.Url.Open(checkoutUrl);
          setTimeout(() => {
            if (!opened) {
              // URL.Open didn't work
            }
          }, 500);
          return;
        }
      }
    } catch (error) {
      console.error('LemonSqueezy.Setup error:', error);
    }
  };

  // Method 1: Try createLemonSqueezyCheckout (overlay - preferred)
  if (typeof window !== 'undefined' && typeof window.createLemonSqueezyCheckout === 'function') {
    try {
      const checkout = window.createLemonSqueezyCheckout({
        url: checkoutUrl,
        onCheckoutSuccess: () => {
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
          // Checkout closed without purchase
        }
      });
      if (checkout && typeof checkout.open === 'function') {
        checkout.open();
        setTimeout(() => {
          if (!opened && !overlayMethodUsed) {
            tryNextOverlayMethod();
          }
        }, 500);
      } else {
        tryNextOverlayMethod();
      }
    } catch (error) {
      console.error('createLemonSqueezyCheckout error:', error);
      tryNextOverlayMethod();
    }
  } else {
    tryNextOverlayMethod();
  }

  return opened;
}

export async function getLemonProductsConfig(): Promise<LemonProductsConfig> {
  const response = await fetch('/assets/data/lemon-products.json');
  if (!response.ok) {
    throw new Error('Failed to load product configuration');
  }
  return response.json();
}

