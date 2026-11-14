/**
 * URL for the homepage tools counter.
 * The site is static on Vercel, so a relative /api/tools/count 404s.
 * Other API calls use window.getApiBaseUrl() from assets/js/core/config.js.
 */
(function (root) {
  function resolveToolsCountUrl(env) {
    const source = env || root;
    let base = '';
    if (source && typeof source.getApiBaseUrl === 'function') {
      try {
        base = source.getApiBaseUrl() || '';
      } catch (e) {
        base = '';
      }
    }
    if (!base && source) {
      base = source.API_BASE_URL || source.BACKEND_URL || source.SPECIFYS_BACKEND_URL || '';
    }
    if (!base) {
      base = 'https://specifys-ai-backend.onrender.com';
    }
    return String(base).replace(/\/$/, '') + '/api/tools/count';
  }

  root.resolveToolsCountUrl = resolveToolsCountUrl;
})(typeof globalThis !== 'undefined' ? globalThis : window);
