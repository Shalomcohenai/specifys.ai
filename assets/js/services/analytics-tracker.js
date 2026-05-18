/**
 * Analytics Tracker
 * Client-side utility for tracking analytics events to the backend API.
 *
 * GA4 page_view events are handled by ga4-wrapper.js only.
 * This module POSTs to Render (getApiBaseUrl resolved at call time, not load time).
 */

(function () {
  'use strict';

  if (typeof window === 'undefined') {
    return;
  }
  if (window.__analyticsTrackerLoaded) {
    return;
  }
  window.__analyticsTrackerLoaded = true;

  function getApiBaseUrl() {
    if (typeof window.getApiBaseUrl === 'function') {
      const url = window.getApiBaseUrl();
      if (url && String(url).trim()) {
        return String(url).replace(/\/$/, '');
      }
    }
    const fallback = window.API_BASE_URL || window.SPECIFYS_BACKEND_URL || window.BACKEND_URL || '';
    return String(fallback).replace(/\/$/, '');
  }

  function isDevHost() {
    try {
      const hostname = (window.location.hostname || '').toLowerCase();
      const devHosts = new Set(['', 'localhost', '127.0.0.1', '::1']);
      if (devHosts.has(hostname)) return true;
      if (hostname.endsWith('.local') || hostname.endsWith('.localhost') || hostname.endsWith('.lan')) {
        return true;
      }
      const search = window.location.search || '';
      const hash = window.location.hash || '';
      return /(?:[?&#])(debug-console|debugConsole)=(?:1|true)/i.test(`${search}${hash}`);
    } catch (e) {
      return false;
    }
  }

  function warnAnalyticsFailure(endpoint, response, networkError) {
    if (!isDevHost()) return;
    const original = window.__SPECIFYS_ORIGINAL_CONSOLE__;
    const warn = (original && original.warn) ? original.warn.bind(console) : console.warn;
    if (networkError) {
      warn('[analytics-tracker] Request failed:', endpoint, networkError.message || networkError);
      return;
    }
    if (response && !response.ok) {
      warn('[analytics-tracker] Non-OK response:', response.status, endpoint);
    }
  }

  async function postToAnalytics(path, body) {
    const base = getApiBaseUrl();
    if (!base) {
      warnAnalyticsFailure(path, null, new Error('API base URL is empty — is config.js loaded?'));
      return;
    }
    const endpoint = `${base}${path.startsWith('/') ? path : `/${path}`}`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...body.headers },
        body: JSON.stringify(body.payload)
      });
      if (!response.ok) {
        warnAnalyticsFailure(endpoint, response, null);
      }
    } catch (error) {
      warnAnalyticsFailure(endpoint, null, error);
    }
  }

  async function getAuthHeaders() {
    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.auth().currentUser) {
      return {};
    }
    const token = await firebase.auth().currentUser.getIdToken();
    return { Authorization: `Bearer ${token}` };
  }

  async function getUserId() {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      return firebase.auth().currentUser.uid;
    }
    return null;
  }

  /**
   * Track a page view (backend only — GA is handled by ga4-wrapper.js).
   */
  async function trackPageView(page, metadata = {}) {
    try {
      const userId = await getUserId();
      await postToAnalytics('/api/analytics/page-view', {
        headers: userId ? await getAuthHeaders() : {},
        payload: { page, userId, metadata }
      });
    } catch (error) {
      // Non-critical
    }
  }

  /**
   * Track a button click
   */
  async function trackButtonClick(buttonId, context = {}) {
    try {
      const userId = await getUserId();
      await postToAnalytics('/api/analytics/event', {
        headers: userId ? await getAuthHeaders() : {},
        payload: {
          type: 'button_click',
          entityId: buttonId,
          entityType: 'button',
          userId,
          metadata: context
        }
      });

      if (window.analytics && typeof window.analytics.trackButton === 'function') {
        window.analytics.trackButton(buttonId, context);
      } else if (typeof gtag !== 'undefined') {
        gtag('event', 'click', {
          event_category: 'Button Click',
          event_label: buttonId,
          ...context
        });
      }
    } catch (error) {
      // Non-critical
    }
  }

  /**
   * Track a funnel step
   */
  async function trackFunnelStep(step, userId = null, metadata = {}) {
    try {
      if (!userId) {
        userId = await getUserId();
      }

      await postToAnalytics('/api/analytics/event', {
        headers: userId ? await getAuthHeaders() : {},
        payload: {
          type: 'funnel_step',
          entityId: step,
          entityType: 'funnel',
          userId,
          metadata
        }
      });

      if (window.analytics && typeof window.analytics.event === 'function') {
        window.analytics.event('funnel_step', {
          event_category: 'Funnel',
          event_label: step,
          funnel_step: step,
          ...metadata
        });
      } else if (typeof gtag !== 'undefined') {
        gtag('event', 'funnel_step', {
          event_category: 'Funnel',
          event_label: step,
          funnel_step: step,
          ...metadata
        });
      }
    } catch (error) {
      // Non-critical
    }
  }

  /**
   * Track an analytics event
   */
  async function trackEvent(type, entityId, entityType, metadata = {}) {
    try {
      const userId = await getUserId();
      await postToAnalytics('/api/analytics/event', {
        headers: userId ? await getAuthHeaders() : {},
        payload: {
          type,
          entityId,
          entityType,
          userId,
          metadata
        }
      });

      if (window.analytics && typeof window.analytics.event === 'function') {
        window.analytics.event(type, {
          event_category: entityType,
          event_label: entityId,
          ...metadata
        });
      } else if (typeof gtag !== 'undefined') {
        gtag('event', type, {
          event_category: entityType,
          event_label: entityId,
          ...metadata
        });
      }
    } catch (error) {
      // Non-critical
    }
  }

  window.analyticsTracker = {
    trackPageView,
    trackButtonClick,
    trackFunnelStep,
    trackEvent
  };
})();
