/**
 * GA4 Wrapper
 * - Provides page/event/identify helpers
 * - Enforces a minimal schema (window.ANALYTICS_EVENT_MAP)
 * - Adds defaults (page name/path, anon/session, device, locale, referrer, utms)
 * - Auto-binds CTA/button clicks via data attributes
 * - Tracks content engagement (scroll + time buckets)
 */
(function (window, document) {
  if (typeof window === 'undefined') return;

  const GA4Wrapper = {};
  const schema = window.ANALYTICS_EVENT_MAP || {};
  let lastPagePath = null;

  const STORAGE_KEYS = {
    anon: 'specifys_analytics_anon_id',
    session: 'specifys_analytics_session_id'
  };

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getAnonId() {
    try {
      const existing = window.localStorage.getItem(STORAGE_KEYS.anon);
      if (existing) return existing;
      const next = uuid();
      window.localStorage.setItem(STORAGE_KEYS.anon, next);
      return next;
    } catch (e) {
      return uuid();
    }
  }

  function getSessionId() {
    try {
      const existing = window.sessionStorage.getItem(STORAGE_KEYS.session);
      if (existing) return existing;
      const next = uuid();
      window.sessionStorage.setItem(STORAGE_KEYS.session, next);
      return next;
    } catch (e) {
      return uuid();
    }
  }

  function getDeviceType() {
    const ua = navigator.userAgent || '';
    if (/mobile/i.test(ua)) return 'mobile';
    if (/tablet/i.test(ua)) return 'tablet';
    return 'desktop';
  }

  function getUtmParams() {
    const params = new URLSearchParams(window.location.search);
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    return keys.reduce((acc, key) => {
      if (params.get(key)) acc[key] = params.get(key);
      return acc;
    }, {});
  }

  function baseContext() {
    return {
      page_name: document.title || window.location.pathname,
      page_path: window.location.pathname + window.location.search,
      page_type: document.body?.dataset?.pageType || undefined,
      referrer: document.referrer || undefined,
      locale: navigator.language || undefined,
      device: getDeviceType(),
      session_id: getSessionId(),
      anon_id: getAnonId(),
      ...getUtmParams()
    };
  }

  function isGtagReady() {
    return typeof window.gtag === 'function';
  }

  function validate(eventName, payload) {
    const def = schema[eventName];
    if (!def || !Array.isArray(def.required)) return;
    const missing = def.required.filter((key) => payload[key] === undefined || payload[key] === null || payload[key] === '');
    if (missing.length && window.appLogger) {
      window.appLogger.log('Warning', `Missing required fields for ${eventName}: ${missing.join(', ')}`, { 
        context: 'GA4Wrapper.validate',
        eventName,
        missingFields: missing 
      });
    }
  }

  function sendEvent(eventName, props = {}) {
    const context = baseContext();
    const payload = { ...context, ...props };
    validate(eventName, payload);
    if (!isGtagReady()) return;
    window.gtag('event', eventName, payload);
  }

  function fireBackendPageView(pageName, context) {
    try {
      if (document.body && document.body.dataset && document.body.dataset.noTrack === 'true') return;
      if (!window.analyticsTracker || typeof window.analyticsTracker.trackPageView !== 'function') return;

      const metadata = {
        pagePath: context.page_path,
        pageTitle: document.title || undefined,
        referrer: context.referrer,
        locale: context.locale,
        device: context.device,
        sessionId: context.session_id,
        anonId: context.anon_id,
        pageType: context.page_type
      };
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((k) => {
        if (context[k]) metadata[k] = context[k];
      });

      let sent = false;
      const send = () => {
        if (sent) return;
        sent = true;
        try { window.analyticsTracker.trackPageView(pageName, metadata); } catch (_) {}
      };

      // Wait briefly for Firebase auth to restore so logged-in users get attributed
      const waitForAuthThenSend = () => {
        try {
          if (window.firebase && window.firebase.auth) {
            const unsubscribe = window.firebase.auth().onAuthStateChanged(() => {
              send();
              if (typeof unsubscribe === 'function') setTimeout(unsubscribe, 0);
            });
          } else {
            send();
          }
        } catch (_) {
          send();
        }
      };

      if (window.firebase && window.firebase.auth) {
        waitForAuthThenSend();
      } else {
        window.addEventListener('firebase-ready', waitForAuthThenSend, { once: true });
      }

      // Safety fallback: send even if Firebase never loads (anon page view)
      setTimeout(send, 2000);
    } catch (_) {
      // Never let analytics throw and break the page
    }
  }

  function page(pageName, props = {}) {
    const context = baseContext();
    const path = props.page_path || context.page_path;
    if (lastPagePath === path) return;
    lastPagePath = path;
    const resolvedName = pageName || context.page_name;
    sendEvent('page_view', { page_name: resolvedName, ...props, page_path: path });
    fireBackendPageView(resolvedName, context);
  }

  function identify(userId, traits = {}) {
    if (!isGtagReady() || !userId) return;
    const sanitized = { user_id: userId };
    Object.keys(traits || {}).forEach((key) => {
      const value = traits[key];
      if (typeof value !== 'object' && typeof value !== 'function') {
        sanitized[key] = value;
      }
    });
    window.gtag('set', sanitized);
  }

  function trackCTA(name, meta = {}) {
    sendEvent('cta_click', {
      cta_name: name,
      ...meta
    });
  }

  function trackButton(id, meta = {}) {
    sendEvent('button_click', {
      button_id: id,
      ...meta
    });
  }

  function deriveText(el) {
    if (!el) return '';
    return (el.dataset.analyticsLabel || el.textContent || '').trim();
  }

  function bindClickHandlers() {
    const ctas = document.querySelectorAll('[data-analytics-cta], [data-product-key]');
    ctas.forEach((el) => {
      if (el.__analyticsBound) return;
      el.__analyticsBound = true;
      el.addEventListener('click', function () {
        const planId = el.dataset.planId || el.dataset.analyticsPlanId || el.dataset.productKey;
        const location = el.dataset.analyticsLocation || window.location.pathname;
        const ctaName = el.dataset.analyticsCta || el.dataset.productKey || deriveText(el);
        trackCTA(ctaName || 'cta', {
          plan_id: planId,
          page_name: baseContext().page_name,
          location
        });
      });
    });

    const buttons = document.querySelectorAll('[data-analytics-button]');
    buttons.forEach((el) => {
      if (el.__analyticsBound) return;
      el.__analyticsBound = true;
      el.addEventListener('click', function () {
        const buttonId = el.dataset.analyticsButton || deriveText(el);
        const location = el.dataset.analyticsLocation || window.location.pathname;
        trackButton(buttonId || 'button', {
          page_name: baseContext().page_name,
          location
        });
      });
    });
  }

  function setupTimeBuckets() {
    const buckets = [15, 30, 60];
    buckets.forEach((seconds) => {
      setTimeout(() => {
        sendEvent('content_engaged', {
          page_name: baseContext().page_name,
          time_on_page_bucket: `${seconds}s`,
          engagement_type: 'time'
        });
      }, seconds * 1000);
    });
  }

  function setupScrollBuckets() {
    const seen = { 25: false, 50: false, 75: false, 100: false };
    function handler() {
      const scrollPercent = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      );
      [25, 50, 75, 100].forEach((bucket) => {
        if (!seen[bucket] && scrollPercent >= bucket) {
          seen[bucket] = true;
          sendEvent('content_engaged', {
            page_name: baseContext().page_name,
            scroll_depth_bucket: `${bucket}%`,
            engagement_type: 'scroll'
          });
        }
      });
    }

    let ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          handler();
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  function init() {
    page();
    bindClickHandlers();
    setupTimeBuckets();
    setupScrollBuckets();
  }

  document.addEventListener('DOMContentLoaded', init);

  GA4Wrapper.page = page;
  GA4Wrapper.event = sendEvent;
  GA4Wrapper.identify = identify;
  GA4Wrapper.trackCTA = trackCTA;
  GA4Wrapper.trackButton = trackButton;
  GA4Wrapper.bindClickHandlers = bindClickHandlers;

  window.analytics = GA4Wrapper;
})(window, document);
