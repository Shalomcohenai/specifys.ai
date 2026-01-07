/**
 * Web Vitals Tracking
 * Tracks Core Web Vitals and sends them to backend for monitoring
 */

(function() {
  'use strict';

  // Check if web-vitals library is available
  if (typeof getCLS === 'undefined' && typeof getFID === 'undefined' && typeof getLCP === 'undefined') {
    // Fallback: Load web-vitals from CDN if not available
    // Use UMD version to avoid ES module syntax errors
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/web-vitals@3/dist/web-vitals.attribution.umd.js';
    script.async = true;
    script.onload = initWebVitals;
    script.onerror = function() {
      // Fallback: try without attribution if UMD attribution fails
      const fallbackScript = document.createElement('script');
      fallbackScript.src = 'https://unpkg.com/web-vitals@3/dist/web-vitals.umd.js';
      fallbackScript.async = true;
      fallbackScript.onload = initWebVitals;
      document.head.appendChild(fallbackScript);
    };
    document.head.appendChild(script);
  } else {
    initWebVitals();
  }

  function initWebVitals() {
    // Get API base URL
    function getApiBaseUrl() {
      if (typeof window !== 'undefined' && window.getApiBaseUrl) {
        return window.getApiBaseUrl();
      }
      if (typeof window !== 'undefined' && window.API_BASE_URL) {
        return window.API_BASE_URL;
      }
      return 'https://specifys-ai.onrender.com';
    }

    // Send metric to backend
    function sendMetric(metric) {
      try {
        const apiUrl = getApiBaseUrl();
        const endpoint = `${apiUrl}/api/analytics/web-vitals`;

        // Use sendBeacon for better reliability
        const data = JSON.stringify({
          name: metric.name,
          value: metric.value,
          id: metric.id,
          rating: metric.rating,
          delta: metric.delta,
          navigationType: metric.navigationType,
          url: window.location.href,
          timestamp: Date.now(),
          userAgent: navigator.userAgent
        });

        // Try sendBeacon first (more reliable)
        if (navigator.sendBeacon) {
          navigator.sendBeacon(endpoint, data);
        } else {
          // Fallback to fetch
          fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: data,
            keepalive: true
          }).catch(err => {
            // Silently fail - don't break the app
          });
        }
      } catch (error) {
        // Silently fail - don't break the app
      }
    }

    // Track Core Web Vitals
    try {
      // Largest Contentful Paint (LCP)
      if (typeof getLCP !== 'undefined') {
        getLCP(sendMetric);
      } else if (typeof onLCP !== 'undefined') {
        onLCP(sendMetric);
      }

      // First Input Delay (FID) - deprecated, use INP instead
      if (typeof getFID !== 'undefined') {
        getFID(sendMetric);
      } else if (typeof onFID !== 'undefined') {
        onFID(sendMetric);
      }

      // Interaction to Next Paint (INP) - new metric
      if (typeof getINP !== 'undefined') {
        getINP(sendMetric);
      } else if (typeof onINP !== 'undefined') {
        onINP(sendMetric);
      }

      // Cumulative Layout Shift (CLS)
      if (typeof getCLS !== 'undefined') {
        getCLS(sendMetric);
      } else if (typeof onCLS !== 'undefined') {
        onCLS(sendMetric);
      }

      // First Contentful Paint (FCP)
      if (typeof getFCP !== 'undefined') {
        getFCP(sendMetric);
      } else if (typeof onFCP !== 'undefined') {
        onFCP(sendMetric);
      }

      // Time to First Byte (TTFB)
      if (typeof getTTFB !== 'undefined') {
        getTTFB(sendMetric);
      } else if (typeof onTTFB !== 'undefined') {
        onTTFB(sendMetric);
      }
    } catch (error) {
      // Silently fail - don't break the app
    }
  }

  // Export for module use
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initWebVitals };
  }
})();






