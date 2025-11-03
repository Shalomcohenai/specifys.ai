/**
 * Entitlements Cache Manager
 * 
 * Provides centralized caching for user entitlements data
 * Prevents duplicate API calls and ensures data consistency across all components
 */

class EntitlementsCache {
    constructor() {
        this.cache = null;
        this.lastFetch = null;
        this.cacheDuration = 10000; // 10 seconds
        this.listeners = [];
        this.isFetching = false;
        this.fetchPromise = null;
    }
    
    /**
     * Get entitlements data (from cache or API)
     * @param {boolean} forceRefresh - Force refresh from API
     * @returns {Promise<Object|null>} Entitlements data
     */
    async get(forceRefresh = false) {
        // If already fetching, wait for that request
        if (this.isFetching && this.fetchPromise) {
            return await this.fetchPromise;
        }
        
        // Check cache validity
        if (!forceRefresh && this.cache && 
            this.lastFetch && 
            Date.now() - this.lastFetch < this.cacheDuration) {

            return this.cache;
        }
        
        // Fetch from API
        this.isFetching = true;
        this.fetchPromise = this._fetchFromAPI();
        
        try {
            const data = await this.fetchPromise;
            return data;
        } finally {
            this.isFetching = false;
            this.fetchPromise = null;
        }
    }
    
    /**
     * Internal method to fetch from API
     * @private
     */
    async _fetchFromAPI() {
        try {

            
            // Check if Firebase is available
            if (typeof firebase === 'undefined' || !firebase.auth) {

                return null;
            }
            
            const user = firebase.auth().currentUser;
            if (!user) {

                return null;
            }
            
            const token = await user.getIdToken();
            const apiUrl = window.API_BASE_URL || 'http://localhost:10000';
            
            const response = await fetch(`${apiUrl}/api/specs/entitlements`, {
                headers: { 
                    'Authorization': `Bearer ${token}` 
                }
            });
            
            if (!response.ok) {

                return null;
            }
            
            const data = await response.json();
            
            // Update cache
            this.cache = data;
            this.lastFetch = Date.now();
            

            
            // Notify listeners
            this.notifyListeners();
            
            return data;
            
        } catch (error) {

            return null;
        }
    }
    
    /**
     * Subscribe to cache updates
     * @param {Function} callback - Callback function to call when cache updates
     */
    subscribe(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);

        }
    }
    
    /**
     * Unsubscribe from cache updates
     * @param {Function} callback - Callback function to remove
     */
    unsubscribe(callback) {
        const index = this.listeners.indexOf(callback);
        if (index > -1) {
            this.listeners.splice(index, 1);

        }
    }
    
    /**
     * Notify all listeners of cache update
     * @private
     */
    notifyListeners() {

        this.listeners.forEach(callback => {
            try {
                callback(this.cache);
            } catch (error) {

            }
        });
    }
    
    /**
     * Invalidate the cache
     */
    invalidate() {

        this.cache = null;
        this.lastFetch = null;
    }
    
    /**
     * Refresh cache immediately
     * @returns {Promise<Object|null>}
     */
    async refresh() {

        return await this.get(true);
    }
    
    /**
     * Get cached data without fetching (returns null if not cached)
     * @returns {Object|null}
     */
    getCached() {
        return this.cache;
    }
    
    /**
     * Check if cache is valid
     * @returns {boolean}
     */
    isValid() {
        return this.cache !== null && 
               this.lastFetch !== null && 
               Date.now() - this.lastFetch < this.cacheDuration;
    }
}

// Create global instance
window.entitlementsCache = new EntitlementsCache();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EntitlementsCache;
}



