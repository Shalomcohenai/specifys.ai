import { onAuthChanged, getCurrentUser } from './authService.js';

/**
 * Require authentication - redirect to login if not authenticated
 * @param {string} redirectTo - URL to redirect to if not authenticated (default: '/login.html')
 */
export function requireAuth(redirectTo = '/login.html') {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthChanged((user) => {
      unsubscribe(); // Stop listening after first check
      
      if (user) {
        resolve(user);
      } else {
        window.location.href = redirectTo;
        reject(new Error('User not authenticated'));
      }
    });
  });
}

/**
 * Redirect if already authenticated - prevent logged in users from accessing auth pages
 * @param {string} redirectTo - URL to redirect to if authenticated (default: '/dashboard.html')
 */
export function redirectIfAuthed(redirectTo = '/dashboard.html') {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthChanged((user) => {
      unsubscribe(); // Stop listening after first check
      
      if (user) {
        window.location.href = redirectTo;
        reject(new Error('User already authenticated'));
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Check if user is authenticated (synchronous)
 * @returns {boolean} - True if user is authenticated
 */
export function isAuthenticated() {
  return !!getCurrentUser();
}

/**
 * Get current user (synchronous)
 * @returns {Object|null} - Current user or null
 */
export function getCurrentUserSync() {
  return getCurrentUser();
}

/**
 * Wait for auth state to be determined
 * @returns {Promise<Object|null>} - User object or null
 */
export function waitForAuth() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthChanged((user) => {
      unsubscribe(); // Stop listening after first check
      resolve(user);
    });
  });
}

/**
 * Protect a route with authentication
 * @param {Function} callback - Function to call if user is authenticated
 * @param {string} redirectTo - URL to redirect to if not authenticated
 */
export function protectRoute(callback, redirectTo = '/login.html') {
  requireAuth(redirectTo)
    .then(callback)
    .catch((error) => {
      // Route protection failed
    });
}

/**
 * Initialize route guards for the current page
 * This should be called on pages that need authentication
 */
export function initRouteGuards() {
  // Add any global route guard logic here
}
