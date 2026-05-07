(function () {
  'use strict';

  function sendMetric(metric) {
    try {
      const apiUrl = typeof window.getApiBaseUrl === 'function' ? window.getApiBaseUrl() : (window.API_BASE_URL || window.BACKEND_URL || '');
      const endpoint = `${apiUrl}/api/analytics/web-vitals`;
      const data = JSON.stringify({
        name: metric.name,
        value: metric.value,
        id: metric.id,
        rating: metric.rating,
        delta: metric.delta,
        navigationType: metric.navigationType,
        url: window.location.href,
        timestamp: Date.now()
      });
      if (navigator.sendBeacon) navigator.sendBeacon(endpoint, data);
      else fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: data, keepalive: true }).catch(() => {});
    } catch (error) {}
  }

  function initWebVitals() {
    if (window.webVitals && typeof window.webVitals.onLCP === 'function') {
      window.webVitals.onCLS(sendMetric);
      window.webVitals.onLCP(sendMetric);
      window.webVitals.onINP(sendMetric);
    }
  }

  if (window.webVitals) {
    initWebVitals();
  } else {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/web-vitals@4/dist/web-vitals.iife.js';
    script.onload = initWebVitals;
    document.head.appendChild(script);
  }
})();
