/**
 * Analytics Tracker
 * Client-side utility for tracking analytics events
 */

const API_BASE_URL = window.getApiBaseUrl ? window.getApiBaseUrl() : (window.API_BASE_URL || 'https://specifys-ai-development2.onrender.com');

/**
 * Track a page view
 */
async function trackPageView(page, metadata = {}) {
  try {
    // Get user ID if authenticated
    let userId = null;
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      userId = firebase.auth().currentUser.uid;
    }
    
    // Send to backend
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
    
    // Also track with Google Analytics if available
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
    // Get user ID if authenticated
    let userId = null;
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      userId = firebase.auth().currentUser.uid;
    }
    
    // Send to backend
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
    
    // Also track with Google Analytics if available
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
    // Get user ID if authenticated
    if (!userId && typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      userId = firebase.auth().currentUser.uid;
    }
    
    // Send to backend
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
    
    // Also track with Google Analytics if available
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
    // Get user ID if authenticated
    let userId = null;
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
      userId = firebase.auth().currentUser.uid;
    }
    
    // Send to backend
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
    
    // Also track with Google Analytics if available
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

// Export functions to window for global access
if (typeof window !== 'undefined') {
  window.analyticsTracker = {
    trackPageView,
    trackButtonClick,
    trackFunnelStep,
    trackEvent
  };
}


