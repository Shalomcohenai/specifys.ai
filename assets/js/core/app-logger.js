/**
 * Application Logger
 * Sends logs to backend server for monitoring
 */

(function() {
  'use strict';

  const LOG_ENDPOINT = '/api/logs';
  const MAX_RETRIES = 2;
  const RETRY_DELAY = 1000;

  // Client-side throttling so a noisy page (e.g. error loops) cannot blast the
  // backend and trigger a 429 cascade for the user. Same-signature logs are
  // collapsed within DEDUP_WINDOW_MS, and we cap total sends per minute.
  const DEDUP_WINDOW_MS = 30 * 1000;
  const MAX_SENDS_PER_MIN = 30;
  const _recentSignatures = new Map();
  const _sendTimestamps = [];

  function _signatureFor(logType, message, data) {
    try {
      const dataKey = data && data.error
        ? `${data.error.name || ''}:${(data.error.message || '').slice(0, 120)}`
        : '';
      return `${logType}|${(message || '').slice(0, 120)}|${dataKey}`;
    } catch (_e) {
      return `${logType}|${message || ''}`;
    }
  }

  function _shouldThrottle(signature) {
    const now = Date.now();
    const last = _recentSignatures.get(signature);
    if (last && now - last < DEDUP_WINDOW_MS) {
      return true;
    }
    _recentSignatures.set(signature, now);
    if (_recentSignatures.size > 200) {
      const cutoff = now - DEDUP_WINDOW_MS;
      for (const [k, t] of _recentSignatures) {
        if (t < cutoff) _recentSignatures.delete(k);
      }
    }
    while (_sendTimestamps.length && now - _sendTimestamps[0] > 60 * 1000) {
      _sendTimestamps.shift();
    }
    if (_sendTimestamps.length >= MAX_SENDS_PER_MIN) {
      return true;
    }
    _sendTimestamps.push(now);
    return false;
  }

  /**
   * Send log to backend
   */
  async function sendLog(logType, message, data = {}) {
    try {
      const signature = _signatureFor(logType, message, data);
      if (_shouldThrottle(signature)) {
        return;
      }

      const pageInfo = {
        url: window.location.href,
        title: document.title,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };

      const logData = {
        logType,
        message,
        data,
        pageInfo
      };

      const apiUrl = typeof window.getApiBaseUrl === 'function' ? window.getApiBaseUrl() : (window.API_BASE_URL || '');
      const endpoint = `${apiUrl}${LOG_ENDPOINT}`;

      // Try to send log (don't block if it fails)
      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(logData),
        keepalive: true // Keep request alive even if page unloads
      }).catch(err => {
        // Silently fail - don't spam console
      });
    } catch (error) {
      // Silently fail - don't break the app
    }
  }

  /**
   * Log page load
   */
  function logPageLoad() {
    sendLog('PageLoad', 'Page loaded', {
      path: window.location.pathname,
      query: window.location.search
    });
  }

  /**
   * Log access code verification
   */
  function logAccessCodeAttempt(success, attemptCount = 1) {
    sendLog(
      success ? 'AccessCodeSuccess' : 'AccessCodeFailure',
      success ? 'Access code verified successfully' : 'Access code verification failed',
      {
        attemptCount,
        timestamp: new Date().toISOString()
      }
    );
  }

  /**
   * Log user authentication events
   */
  function logAuthEvent(event, userId = null) {
    sendLog('AuthEvent', `User ${event}`, {
      userId,
      event,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log button clicks and user interactions
   */
  function logUserAction(action, details = {}) {
    sendLog('UserAction', `User action: ${action}`, {
      action,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log errors
   */
  function logError(error, context = {}) {
    sendLog('Error', 'Application error occurred', {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      ...context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log feature usage
   */
  function logFeatureUsage(feature, details = {}) {
    sendLog('FeatureUsage', `Feature used: ${feature}`, {
      feature,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  function captureApiError(error, context = {}) {
    logError(error || new Error('Unknown API error'), {
      type: 'apiClientError',
      ...context
    });
  }

  // Export functions to window
  window.appLogger = {
    log: sendLog,
    logPageLoad,
    logAccessCodeAttempt,
    logAuthEvent,
    logUserAction,
    logError,
    logFeatureUsage,
    captureApiError
  };

  // Log page load when script loads - deferred until page is interactive
  function deferredLogPageLoad() {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(logPageLoad, { timeout: 5000 });
    } else {
      setTimeout(logPageLoad, 5000);
    }
  }
  
  if (document.readyState === 'complete') {
    deferredLogPageLoad();
  } else {
    window.addEventListener('load', deferredLogPageLoad);
  }

  // Log unhandled errors (skip cross-origin "Script error." — browser withholds filename/line)
  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    const isCrossOriginScriptError =
      (msg === 'Script error.' || msg === 'Script error') &&
      (!event.filename || event.filename === '') &&
      (!event.lineno || event.lineno === 0);
    if (isCrossOriginScriptError) {
      return;
    }
    logError(event.error || new Error(event.message), {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  // Log unhandled promise rejections with filtering for known non-critical errors
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    const errorMessage = error?.message || String(error);
    const errorName = error?.name || 'UnknownError';
    
    // Filter out known non-critical errors that don't need logging
    const ignoredErrors = [
      'Connection to Indexed Database server lost',
      'Database deleted by request of the user',
      'Failed to execute \'decodeAudioData\' on \'BaseAudioContext\'',
      'Attempt to get records from database without an in-progress transaction'
    ];
    
    // Check if this is an ignored error
    let shouldIgnore = ignoredErrors.some(ignored =>
      errorMessage.includes(ignored)
    );

    // Also ignore if it's a user-initiated database deletion
    if (errorName === 'UnknownError' && errorMessage.includes('Database deleted by request')) {
      shouldIgnore = true;
    }

    // Mermaid: invalid user/AI diagram text (not an application defect)
    if (errorMessage.includes('No diagram type detected matching given configuration')) {
      shouldIgnore = true;
    }
    
    if (!shouldIgnore) {
      logError(error, {
        type: 'unhandledPromiseRejection'
      });
    } else {
      // Silently handle known non-critical errors
      // These are expected in certain scenarios (e.g., user clears browser data)
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.debug('[App Logger] Ignored non-critical error:', errorMessage);
      }
    }
  });
})();

