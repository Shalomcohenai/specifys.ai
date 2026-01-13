/**
 * Activity Service - Centralized activity event management
 * Handles activity events from Firestore collection with pagination and filtering
 */

import { firebaseService } from '../core/FirebaseService.js';

export class ActivityService {
  constructor() {
    this.collectionName = 'admin_activity_log';
    this.events = [];
    this.cachedEvents = new Map(); // Cache for pagination
    this.pageSize = 20;
    this.currentPage = 1;
    this.totalEvents = 0;
    this.filters = {
      type: 'all',
      dateRange: null,
      userId: null,
      search: null
    };
    
    // Event listeners
    this.listeners = new Map();
    
    // Subscription handle
    this.unsubscribeFn = null;
  }
  
  /**
   * Subscribe to data changes
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }
  
  /**
   * Emit event
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[ActivityService] Error in listener for ${event}:`, error);
        }
      });
    }
  }
  
  /**
   * Convert to Date
   */
  toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (value.toDate && typeof value.toDate === 'function') return value.toDate();
    if (typeof value === 'string' || typeof value === 'number') return new Date(value);
    return null;
  }
  
  /**
   * Initialize and subscribe to activity events
   */
  async initialize() {
    try {
      this.unsubscribeFn = await firebaseService.subscribe(
        this.collectionName,
        (snapshot) => {
          // Update total count
          this.totalEvents = snapshot.size;
          
          // Process all documents
          const newEvents = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              type: data.type || 'info',
              category: data.category || 'general',
              title: data.title || 'Activity',
              description: data.description || '',
              timestamp: this.toDate(data.timestamp) || this.toDate(data.createdAt) || new Date(),
              userId: data.userId || null,
              userEmail: data.userEmail || data.email || null,
              userName: data.userName || data.displayName || null,
              metadata: data.metadata || {},
              severity: data.severity || 'info',
              tags: data.tags || []
            };
          });
          
          // Sort by timestamp (newest first)
          newEvents.sort((a, b) => {
            const timeA = a.timestamp?.getTime() || 0;
            const timeB = b.timestamp?.getTime() || 0;
            return timeB - timeA;
          });
          
          this.events = newEvents;
          
          // Clear cache when data changes
          this.cachedEvents.clear();
          
          // Emit update event
          this.emit('update', {
            events: this.getFilteredEvents(),
            total: this.totalEvents,
            filtered: this.getFilteredEvents().length
          });
        },
        {
          orderByField: 'timestamp',
          orderDirection: 'desc',
          limitCount: 500 // Load up to 500 events for filtering
        },
        (error) => {
          if (error?.code === 'permission-denied') {
            // Permission denied for admin_activity_log
            this.emit('restricted', { error });
          } else {
            console.error('[ActivityService] Error subscribing to activity events:', error);
            this.emit('error', { error });
          }
        }
      );
    } catch (error) {
      console.error('[ActivityService] Failed to initialize:', error);
      this.emit('error', { error });
    }
  }
  
  /**
   * Get filtered events based on current filters
   */
  getFilteredEvents() {
    let filtered = [...this.events];
    
    // Filter by type
    if (this.filters.type !== 'all') {
      if (this.filters.type === 'payment') {
        filtered = filtered.filter(e => e.type === 'payment' || e.type === 'subscription');
      } else if (this.filters.type === 'user') {
        filtered = filtered.filter(e => e.type === 'user' || e.type === 'auth');
      } else {
        filtered = filtered.filter(e => e.type === this.filters.type);
      }
    }
    
    // Filter by date range
    if (this.filters.dateRange) {
      const { start, end } = this.filters.dateRange;
      filtered = filtered.filter(e => {
        const time = e.timestamp?.getTime() || 0;
        return time >= start.getTime() && time <= end.getTime();
      });
    }
    
    // Filter by userId
    if (this.filters.userId) {
      filtered = filtered.filter(e => e.userId === this.filters.userId);
    }
    
    // Filter by search
    if (this.filters.search) {
      const searchLower = this.filters.search.toLowerCase();
      filtered = filtered.filter(e => {
        const searchableText = [
          e.title,
          e.description,
          e.userEmail,
          e.userName,
          ...(e.tags || [])
        ].join(' ').toLowerCase();
        return searchableText.includes(searchLower);
      });
    }
    
    return filtered;
  }
  
  /**
   * Get paginated events
   */
  getPaginatedEvents(page = null) {
    if (page !== null) {
      this.currentPage = page;
    }
    
    const filtered = this.getFilteredEvents();
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    
    return {
      events: filtered.slice(startIndex, endIndex),
      currentPage: this.currentPage,
      totalPages: Math.ceil(filtered.length / this.pageSize),
      totalEvents: filtered.length,
      hasMore: endIndex < filtered.length
    };
  }
  
  /**
   * Set filter
   */
  setFilter(filterName, value) {
    this.filters[filterName] = value;
    this.currentPage = 1; // Reset to first page when filter changes
    this.cachedEvents.clear();
    
    const paginated = this.getPaginatedEvents();
    this.emit('filter', {
      filter: filterName,
      value,
      ...paginated
    });
    
    return paginated;
  }
  
  /**
   * Set multiple filters at once
   */
  setFilters(filters) {
    Object.assign(this.filters, filters);
    this.currentPage = 1;
    this.cachedEvents.clear();
    
    const paginated = this.getPaginatedEvents();
    this.emit('filter', {
      filters: this.filters,
      ...paginated
    });
    
    return paginated;
  }
  
  /**
   * Set page size
   */
  setPageSize(size) {
    this.pageSize = Math.max(1, Math.min(100, size)); // Between 1 and 100
    this.currentPage = 1;
    this.cachedEvents.clear();
    
    const paginated = this.getPaginatedEvents();
    this.emit('pageSize', {
      pageSize: this.pageSize,
      ...paginated
    });
    
    return paginated;
  }
  
  /**
   * Go to next page
   */
  nextPage() {
    const filtered = this.getFilteredEvents();
    const totalPages = Math.ceil(filtered.length / this.pageSize);
    
    if (this.currentPage < totalPages) {
      this.currentPage++;
      return this.getPaginatedEvents();
    }
    
    return null;
  }
  
  /**
   * Go to previous page
   */
  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      return this.getPaginatedEvents();
    }
    
    return null;
  }
  
  /**
   * Go to specific page
   */
  goToPage(page) {
    const filtered = this.getFilteredEvents();
    const totalPages = Math.ceil(filtered.length / this.pageSize);
    
    if (page >= 1 && page <= totalPages) {
      this.currentPage = page;
      return this.getPaginatedEvents();
    }
    
    return null;
  }
  
  /**
   * Create activity event (for client-side creation - will be replaced by server-side)
   * This is a temporary solution until Cloud Functions are set up
   */
  async createEvent(eventData) {
    try {
      const db = firebaseService.getFirestore();
      const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      
      const event = {
        type: eventData.type || 'info',
        category: eventData.category || 'general',
        title: eventData.title || 'Activity',
        description: eventData.description || '',
        timestamp: serverTimestamp(),
        userId: eventData.userId || null,
        userEmail: eventData.userEmail || eventData.email || null,
        userName: eventData.userName || eventData.displayName || null,
        metadata: eventData.metadata || {},
        severity: eventData.severity || 'info',
        tags: eventData.tags || []
      };
      
      // Note: admin_activity_log is read-only from client side (write: if false in firestore.rules)
      // Events should be created server-side via Cloud Functions
      // This method is kept for future server-side implementation
      try {
        await addDoc(collection(db, this.collectionName), event);
        return { success: true };
      } catch (createError) {
        if (createError?.code === 'permission-denied') {
          // Expected - collection is read-only from client
          // Events should be created server-side
          // Permission denied for creating event
          return { success: false, error: createError, silent: true };
        }
        throw createError;
      }
    } catch (error) {
      console.error('[ActivityService] Failed to create event:', error);
      return { success: false, error };
    }
  }
  
  /**
   * Cleanup
   */
  cleanup() {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }
    
    this.events = [];
    this.cachedEvents.clear();
    this.currentPage = 1;
    this.filters = {
      type: 'all',
      dateRange: null,
      userId: null,
      search: null
    };
    this.listeners.clear();
  }
}

