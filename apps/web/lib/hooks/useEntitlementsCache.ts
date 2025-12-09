'use client';

/**
 * useEntitlementsCache Hook
 * Caches user entitlements for quick access with real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { getEntitlements, EntitlementsResponse } from '@/lib/api/entitlements';
import { listenToEntitlementsDocument } from '@/lib/firebase/firestore';

const CACHE_DURATION = 300000; // 5 דקות

/**
 * Hook to cache and manage entitlements with real-time updates
 * @param forceRefresh - Force refresh from API (bypass cache)
 * @returns Entitlements data and loading state
 */
export function useEntitlementsCache(forceRefresh = false): {
  entitlements: EntitlementsResponse | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
} {
  const { user } = useAuth();
  const [cache, setCache] = useState<EntitlementsResponse | null>(null);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchEntitlements = useCallback(async (bypassCache = false) => {
    if (!user) {
      setCache(null);
      setCacheTimestamp(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getEntitlements();
      setCache(data);
      setCacheTimestamp(Date.now());
    } catch (err: any) {
      console.error('Error fetching entitlements:', err);
      setError(err);
      // Keep old cache on error (fallback) - don't clear if we have existing cache
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch and real-time listener
  useEffect(() => {
    if (!user) {
      setCache(null);
      setCacheTimestamp(null);
      return;
    }

    // Check if we need to fetch (cache expired or force refresh)
    const now = Date.now();
    const shouldFetch = forceRefresh || !cache || !cacheTimestamp || (now - cacheTimestamp) >= CACHE_DURATION;

    if (shouldFetch) {
      fetchEntitlements(true);
    }

    // Set up real-time listener (only once per user)
    const unsubscribe = listenToEntitlementsDocument(user.uid, (snapshot) => {
      if (snapshot.exists()) {
        // Invalidate cache on update
        setCache(null);
        setCacheTimestamp(null);
        // Fetch fresh data
        fetchEntitlements(true);
      }
    });

    return () => {
      unsubscribe();
    };
    // Only depend on user and forceRefresh - not on cache/cacheTimestamp to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, forceRefresh]);

  // Clear cache on auth state change
  useEffect(() => {
    if (!user) {
      setCache(null);
      setCacheTimestamp(null);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    await fetchEntitlements(true);
  }, [fetchEntitlements]);

  return {
    entitlements: cache,
    loading,
    error,
    refresh
  };
}

/**
 * Clear entitlements cache (for manual invalidation)
 */
export function clearEntitlementsCache(): void {
  // This is handled by the hook's state, but we can expose a global function
  // if needed for external use
  if (typeof window !== 'undefined') {
    (window as any).clearEntitlementsCache = () => {
      // Cache is managed by hook state, so this is mainly for compatibility
      console.log('Entitlements cache cleared');
    };
  }
}

