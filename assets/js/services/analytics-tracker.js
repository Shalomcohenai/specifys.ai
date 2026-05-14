/**
 * Analytics Tracker
 * Client-side utility for tracking analytics events
 *
 * Wrapped in an IIFE with an idempotency guard so that an accidental
 * double-load of this file does not cause `Identifier 'API_BASE_URL'
 * has already been declared` in browsers (the const is now module-private).
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

  const API_BASE_URL = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.API_BASE_URL || window.BACKEND_URL || '');

  /**
   * Track a page view
   */
  async function trackPageView(page, metadata = {}) {
    try {
      let userId = null;
      if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        userId = firebase.auth().currentUser.uid;
      }

      await fetch(`${API_BASE_URL}/api/analytics/page-view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'Authorization': `Bearer ${await firebase.auth().currentUser.getIdToken()}` } : {})
        },
        body: JSON.stringify({
          page,
          userId,
          metadata
        })
      }).catch(() => {
        // Silently fail - analytics is non-critical
      });

      if (window.analytics && typeof window.analytics.page === 'function') {
        window.analytics.page(page, metadata);
      } else if (typeof gtag !== 'undefined') {
        gtag('event', 'page_view', {
          event_category: 'Navigation',
          event_label: page,
          page_path: page,
          ...metadata
        });
      }
    } catch (error) {
      // Silently fail - analytics is non-critical
    }
  }

  /**
   * Track a button click
   */
  async function trackButtonClick(buttonId, context = {}) {
    try {
      let userId = null;
      if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        userId = firebase.auth().currentUser.uid;
      }

      await fetch(`${API_BASE_URL}/api/analytics/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'Authorization': `Bearer ${await firebase.auth().currentUser.getIdToken()}` } : {})
        },
        body: JSON.stringify({
          type: 'button_click',
          entityId: buttonId,
          entityType: 'button',
          userId,
          metadata: context
        })
      }).catch(() => {
        // Silently fail - analytics is non-critical
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
      // Silently fail - analytics is non-critical
    }
  }

  /**
   * Track a funnel step
   */
  async function trackFunnelStep(step, userId = null, metadata = {}) {
    try {
      if (!userId && typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        userId = firebase.auth().currentUser.uid;
      }

      await fetch(`${API_BASE_URL}/api/analytics/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'Authorization': `Bearer ${await firebase.auth().currentUser.getIdToken()}` } : {})
        },
        body: JSON.stringify({
          type: 'funnel_step',
          entityId: step,
          entityType: 'funnel',
          userId,
          metadata
        })
      }).catch(() => {
        // Silently fail - analytics is non-critical
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
      // Silently fail - analytics is non-critical
    }
  }

  /**
   * Track an analytics event
   */
  async function trackEvent(type, entityId, entityType, metadata = {}) {
    try {
      let userId = null;
      if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
        userId = firebase.auth().currentUser.uid;
      }

      await fetch(`${API_BASE_URL}/api/analytics/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? { 'Authorization': `Bearer ${await firebase.auth().currentUser.getIdToken()}` } : {})
        },
        body: JSON.stringify({
          type,
          entityId,
          entityType,
          userId,
          metadata
        })
      }).catch(() => {
        // Silently fail - analytics is non-critical
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
      // Silently fail - analytics is non-critical
    }
  }

  window.analyticsTracker = {
    trackPageView,
    trackButtonClick,
    trackFunnelStep,
    trackEvent
  };
})();
