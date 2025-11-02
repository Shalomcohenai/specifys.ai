/**
 * Centralized API Client
 * Provides error handling, retry logic, and consistent API communication
 */

class APIClient {
    constructor() {
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
    }

    /**
     * Get the API base URL with validation
     */
    getBaseUrl() {
        let url = window.API_BASE_URL || 'http://localhost:10000';
        
        // Ensure URL has protocol
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            console.warn('[APIClient] URL missing protocol, adding https://');
            url = 'https://' + url;
        }
        
        // Remove trailing slash
        url = url.replace(/\/$/, '');
        
        return url;
    }

    /**
     * Check if error is a network/DNS error
     */
    isNetworkError(error) {
        if (!error) return false;
        
        const message = error.message || '';
        const name = error.name || '';
        
        return name === 'TypeError' || 
               message.includes('Failed to fetch') ||
               message.includes('ERR_NAME_NOT_RESOLVED') ||
               message.includes('ERR_INTERNET_DISCONNECTED') ||
               message.includes('NetworkError') ||
               message.includes('Network request failed');
    }

    /**
     * Fetch with retry logic and error handling
     * @param {string} endpoint - API endpoint (e.g., '/api/specs/entitlements')
     * @param {object} options - Fetch options
     * @param {number} retries - Current retry attempt
     * @returns {Promise<Response>}
     */
    async fetchWithRetry(endpoint, options = {}, retries = 0) {
        const baseUrl = this.getBaseUrl();
        const url = `${baseUrl}${endpoint}`;
        
        // Default options
        const fetchOptions = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        try {
            console.log(`[APIClient] Fetching: ${url} (attempt ${retries + 1}/${this.maxRetries + 1})`);
            
            const response = await fetch(url, fetchOptions);
            
            // If successful, return response
            if (response.ok || response.status < 500) {
                return response;
            }
            
            // For 5xx errors, retry
            if (response.status >= 500 && retries < this.maxRetries) {
                console.warn(`[APIClient] Server error ${response.status}, retrying...`);
                await this.delay(this.retryDelay * (retries + 1));
                return this.fetchWithRetry(endpoint, options, retries + 1);
            }
            
            return response;
            
        } catch (error) {
            // Check if it's a network error
            if (this.isNetworkError(error)) {
                console.error(`[APIClient] Network error:`, error);
                
                // If it's a DNS error, don't retry (DNS won't fix itself)
                if (error.message && error.message.includes('ERR_NAME_NOT_RESOLVED')) {
                    console.error('[APIClient] DNS resolution failed - domain may not exist');
                    throw new Error('API_DOMAIN_NOT_RESOLVED');
                }
                
                // For other network errors, retry if we have retries left
                if (retries < this.maxRetries) {
                    console.warn(`[APIClient] Network error, retrying in ${this.retryDelay * (retries + 1)}ms...`);
                    await this.delay(this.retryDelay * (retries + 1));
                    return this.fetchWithRetry(endpoint, options, retries + 1);
                }
            }
            
            // Re-throw if no more retries or non-network error
            throw error;
        }
    }

    /**
     * Delay helper for retries
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check if API is available
     */
    async checkAvailability() {
        try {
            const baseUrl = this.getBaseUrl();
            // Try to resolve the domain
            const testUrl = `${baseUrl}/api/health`;
            
            const response = await fetch(testUrl, {
                method: 'GET',
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            
            return response.ok;
        } catch (error) {
            if (this.isNetworkError(error)) {
                return false;
            }
            return false;
        }
    }
}

// Create global instance
window.apiClient = new APIClient();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIClient;
}

console.log('[APIClient] Initialized');

