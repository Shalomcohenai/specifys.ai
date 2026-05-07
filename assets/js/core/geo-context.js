(function () {
  'use strict';

  const STORAGE_KEY = 'specifys_geo_context_v1';

  async function fetchGeoContext() {
    const apiUrl = typeof window.getApiBaseUrl === 'function' ? window.getApiBaseUrl() : (window.API_BASE_URL || window.BACKEND_URL || '');
    const response = await fetch(`${apiUrl}/api/geo/context`);
    if (!response.ok) throw new Error('Failed to fetch geo context');
    return response.json();
  }

  window.loadGeoContext = async function loadGeoContext(force = false) {
    if (!force) {
      try {
        const cached = sessionStorage.getItem(STORAGE_KEY);
        if (cached) {
          window.geoContext = JSON.parse(cached);
          return window.geoContext;
        }
      } catch (error) {}
    }

    const data = await fetchGeoContext();
    window.geoContext = data;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {}
    return data;
  };
})();
