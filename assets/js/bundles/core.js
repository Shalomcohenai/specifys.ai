/**
 * Core Bundle - Essential scripts needed on all pages
 * Includes: config, security-utils, css-monitor
 */

// Import core utilities
import '../config.js';
import '../security-utils.js';
import '../css-monitor.js';

// Make core utilities available globally if needed
// They're already in window scope from their own files

console.log('[Core Bundle] Loaded');
