// Helper function to get API base URL
// Ensure getApiBaseUrl is available globally
// config.js should already define window.getApiBaseUrl, but provide fallback if needed
// IMPORTANT: Only define if it doesn't exist to avoid recursion
if (typeof window.getApiBaseUrl !== 'function') {
    window.getApiBaseUrl = function() {
        // Fallback if config.js not loaded
        if (typeof API_CONFIG !== 'undefined' && API_CONFIG) {
            try {
                const baseUrl = API_CONFIG.baseUrl;
                if (baseUrl && baseUrl.trim()) {
                    return baseUrl;
                }
            } catch (e) {
                // Error accessing API_CONFIG.baseUrl
            }
        }
        
        if (window.API_BASE_URL && window.API_BASE_URL.trim()) {
            return window.API_BASE_URL;
        }
        
        // Always return Render URL - no localhost support
        return 'https://specifys-ai-backend.onrender.com';
    };
}
