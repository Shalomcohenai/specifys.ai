/**
 * Security Utilities for Specifys.ai
 * Provides safe HTML sanitization and security functions
 */

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized HTML string
 */
export function sanitizeHTML(str) {
  if (typeof str !== 'string') {
    return '';
  }
  
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Safely set innerHTML with sanitization
 * @param {HTMLElement} element - Target element
 * @param {string} content - Content to set (will be sanitized)
 */
export function safeSetInnerHTML(element, content) {
  if (!element || typeof content !== 'string') {
    return;
  }
  
  element.innerHTML = sanitizeHTML(content);
}

/**
 * Create safe HTML from template with sanitized variables
 * @param {string} template - HTML template with {{variable}} placeholders
 * @param {Object} variables - Object with variables to replace
 * @returns {string} - Safe HTML string
 */
export function createSafeHTML(template, variables = {}) {
  let safeHTML = template;
  
  Object.keys(variables).forEach(key => {
    const placeholder = `{{${key}}}`;
    const value = sanitizeHTML(String(variables[key] || ''));
    safeHTML = safeHTML.replace(new RegExp(placeholder, 'g'), value);
  });
  
  return safeHTML;
}

/**
 * Validate and sanitize user input
 * @param {string} input - User input
 * @param {Object} options - Validation options
 * @returns {Object} - {isValid: boolean, sanitized: string, errors: string[]}
 */
export function validateInput(input, options = {}) {
  const {
    maxLength = 1000,
    minLength = 0,
    allowHTML = false,
    required = false
  } = options;
  
  const errors = [];
  
  // Check if required
  if (required && (!input || input.trim().length === 0)) {
    errors.push('This field is required');
  }
  
  // Check length
  if (input && input.length > maxLength) {
    errors.push(`Text is too long (maximum ${maxLength} characters)`);
  }
  
  if (input && input.length < minLength) {
    errors.push(`Text is too short (minimum ${minLength} characters)`);
  }
  
  // Sanitize based on options
  let sanitized = input || '';
  if (!allowHTML) {
    sanitized = sanitizeHTML(sanitized);
  }
  
  return {
    isValid: errors.length === 0,
    sanitized: sanitized,
    errors: errors
  };
}

/**
 * Escape special characters for use in HTML attributes
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
export function escapeHTML(str) {
  if (typeof str !== 'string') {
    return '';
  }
  
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Check if a string contains potentially dangerous content
 * @param {string} str - String to check
 * @returns {boolean} - True if potentially dangerous
 */
export function containsDangerousContent(str) {
  if (typeof str !== 'string') {
    return false;
  }
  
  const dangerousPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /<object[^>]*>.*?<\/object>/gi,
    /<embed[^>]*>.*?<\/embed>/gi,
    /<link[^>]*>.*?<\/link>/gi,
    /<meta[^>]*>.*?<\/meta>/gi
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(str));
}

/**
 * Log security events for monitoring
 * @param {string} event - Event type
 * @param {Object} details - Event details
 */
export function logSecurityEvent(event, details = {}) {
  const securityLog = {
    timestamp: new Date().toISOString(),
    event: event,
    userAgent: navigator.userAgent,
    url: window.location.href,
    ...details
  };
  
  // Log to console in development
  if (process?.env?.NODE_ENV === 'development') {
    console.warn('Security Event:', securityLog);
  }
  
  // Send to server for monitoring (if endpoint exists)
  if (window.SECURITY_MONITORING_ENABLED) {
    fetch('/api/security/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(securityLog)
    }).catch(err => {
      console.error('Failed to log security event:', err);
    });
  }
}

// Export all functions for use in other modules
export default {
  sanitizeHTML,
  safeSetInnerHTML,
  createSafeHTML,
  validateInput,
  escapeHTML,
  containsDangerousContent,
  logSecurityEvent
};
