/**
 * Application Logger
 * Sends logs to backend server for monitoring
 */

(function() {
  'use strict';

  const LOG_ENDPOINT = '/api/logs';
  const MAX_RETRIES = 2;
  const RETRY_DELAY = 1000;

  /**
   * Get API base URL
   */
  function getApiBaseUrl() {
    if (typeof window !== 'undefined' && window.getApiBaseUrl) {
      return window.getApiBaseUrl();
    }
    if (typeof window !== 'undefined' && window.API_BASE_URL) {
      return window.API_BASE_URL;
    }
    return 'https://specifys-ai.onrender.com';
  }

  /**
   * Send log to backend
   */
  async function sendLog(logType, message, data = {}) {
    try {
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

      const apiUrl = getApiBaseUrl();
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
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          console.warn('[App Logger] Failed to send log:', err);
        }
      });

      // Also log to console in development
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const emoji = logType.includes('error') ? '❌' : logType.includes('warn') ? '⚠️' : '✅';
        console.log(`${emoji} [${logType}] ${message}`, data);
      }
    } catch (error) {
      // Silently fail - don't break the app
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.warn('[App Logger] Error:', error);
      }
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

  // Export functions to window
  window.appLogger = {
    log: sendLog,
    logPageLoad,
    logAccessCodeAttempt,
    logAuthEvent,
    logUserAction,
    logError,
    logFeatureUsage
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

  // Log unhandled errors
  window.addEventListener('error', (event) => {
    logError(event.error || new Error(event.message), {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  // Log unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logError(event.reason, {
      type: 'unhandledPromiseRejection'
    });
  });
})();

