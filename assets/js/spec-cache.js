/**
 * Spec Cache Service
 * Implements caching hierarchy: Memory → localStorage → Firestore
 * 
 * Cache TTL:
 * - Memory: 5 minutes
 * - localStorage: 1 hour
 * - Firestore: source of truth
 */
class SpecCache {
  constructor() {
    this.memoryCache = new Map(); // 5 minutes TTL
    this.localStorageKey = 'spec_cache_';
    this.memoryTTL = 5 * 60 * 1000; // 5 minutes
    this.localStorageTTL = 60 * 60 * 1000; // 1 hour
  }

  /**
   * Get spec from cache or Firestore
   * @param {string} specId - Spec ID
   * @param {Function} fetchFromFirestore - Function to fetch from Firestore if not cached
   * @returns {Promise<Object>} Spec data
   */
  async get(specId, fetchFromFirestore) {
    if (!specId) {
      throw new Error('Spec ID is required');
    }

    // 1. Check memory cache
    const memory = this.memoryCache.get(specId);
    if (memory && !this.isExpired(memory, this.memoryTTL)) {
      console.log(`[SpecCache] Cache HIT (memory) for specId: ${specId}`);
      return memory.data;
    }

    // 2. Check localStorage
    try {
      const local = localStorage.getItem(this.localStorageKey + specId);
      if (local) {
        const parsed = JSON.parse(local);
        if (!this.isExpired(parsed, this.localStorageTTL)) {
          console.log(`[SpecCache] Cache HIT (localStorage) for specId: ${specId}`);
          // Update memory cache
          this.memoryCache.set(specId, parsed);
          return parsed.data;
        } else {
          // Expired, remove it
          localStorage.removeItem(this.localStorageKey + specId);
        }
      }
    } catch (error) {
      console.warn('[SpecCache] Error reading from localStorage:', error);
      // Continue to Firestore fetch
    }

    // 3. Fetch from Firestore
    console.log(`[SpecCache] Cache MISS for specId: ${specId}, fetching from Firestore`);
    if (!fetchFromFirestore || typeof fetchFromFirestore !== 'function') {
      throw new Error('fetchFromFirestore function is required');
    }

    const firestore = await fetchFromFirestore(specId);

    // Update caches
    this.set(specId, firestore);

    return firestore;
  }

  /**
   * Set spec in cache
   * @param {string} specId - Spec ID
   * @param {Object} data - Spec data
   */
  set(specId, data) {
    if (!specId || !data) {
      return;
    }

    const cacheEntry = {
      data,
      timestamp: Date.now()
    };

    // Update memory cache
    this.memoryCache.set(specId, cacheEntry);

    // Update localStorage
    try {
      localStorage.setItem(
        this.localStorageKey + specId,
        JSON.stringify(cacheEntry)
      );
    } catch (error) {
      // localStorage might be full or disabled
      console.warn('[SpecCache] Error writing to localStorage:', error);
      // Try to clear old entries
      this.cleanupLocalStorage();
    }
  }

  /**
   * Invalidate cache for a spec
   * @param {string} specId - Spec ID
   */
  invalidate(specId) {
    this.memoryCache.delete(specId);
    try {
      localStorage.removeItem(this.localStorageKey + specId);
    } catch (error) {
      console.warn('[SpecCache] Error removing from localStorage:', error);
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    this.memoryCache.clear();
    try {
      // Clear all spec cache entries from localStorage
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.localStorageKey)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('[SpecCache] Error clearing localStorage:', error);
    }
  }

  /**
   * Check if cache entry is expired
   * @param {Object} entry - Cache entry with timestamp
   * @param {number} ttl - Time to live in milliseconds
   * @returns {boolean} True if expired
   */
  isExpired(entry, ttl) {
    if (!entry || !entry.timestamp) {
      return true;
    }
    return Date.now() - entry.timestamp > ttl;
  }

  /**
   * Cleanup old localStorage entries
   * Removes entries older than 24 hours
   */
  cleanupLocalStorage() {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      keys.forEach(key => {
        if (key.startsWith(this.localStorageKey)) {
          try {
            const entry = JSON.parse(localStorage.getItem(key));
            if (entry && entry.timestamp && (now - entry.timestamp > maxAge)) {
              localStorage.removeItem(key);
            }
          } catch (error) {
            // Invalid entry, remove it
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.warn('[SpecCache] Error during cleanup:', error);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    let localStorageCount = 0;
    try {
      const keys = Object.keys(localStorage);
      localStorageCount = keys.filter(key => key.startsWith(this.localStorageKey)).length;
    } catch (error) {
      // localStorage not available
    }

    return {
      memoryCacheSize: this.memoryCache.size,
      localStorageCount: localStorageCount,
      memoryTTL: this.memoryTTL,
      localStorageTTL: this.localStorageTTL
    };
  }
}

// Export singleton instance
window.specCache = new SpecCache();

// Cleanup on page load (remove entries older than 24 hours)
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    window.specCache.cleanupLocalStorage();
  });
}

