/**
 * Data Manager - Centralized data store and aggregation
 * Manages all data from Firebase and provides unified interface
 */

import { firebaseService } from './FirebaseService.js';

export class DataManager {
  constructor() {
    this.collections = firebaseService.getCollections();
    
    // Data stores
    this.data = {
      users: new Map(),
      userCredits: new Map(),
      specs: new Map(),
      specsByUser: new Map(),
      purchases: [],
      activityLogs: [],
      contactSubmissions: []
    };
    
    // Activity events (unified from all sources)
    this.activityEvents = [];
    
    // Loading states
    this.loadingStates = {
      users: false,
      userCredits: false,
      specs: false,
      purchases: false,
      activityLogs: false,
      contactSubmissions: false
    };
    
    // Error states
    this.errors = new Map();
    
    // Event listeners
    this.listeners = new Map();
    
    // Cache
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
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
          console.error(`[DataManager] Error in listener for ${event}:`, error);
        }
      });
    }
  }
  
  /**
   * Normalize user data
   */
  normalizeUser(id, data) {
    return {
      id,
      email: data.email || '',
      displayName: data.displayName || data.email || '',
      plan: (data.plan || 'free').toLowerCase(),
      createdAt: this.toDate(data.createdAt) || this.toDate(data.creationTime),
      lastActive: this.toDate(data.lastActive),
      newsletterSubscription: Boolean(data.newsletterSubscription),
      disabled: Boolean(data.disabled),
      emailVerified: Boolean(data.emailVerified),
      freeSpecsRemaining: typeof data.free_specs_remaining === 'number' ? data.free_specs_remaining : null,
      metadata: data
    };
  }
  
  /**
   * Normalize spec data
   */
  normalizeSpec(id, data) {
    return {
      id,
      userId: data.userId || data.uid || null,
      title: data.title || 'Untitled spec',
      createdAt: this.toDate(data.createdAt),
      updatedAt: this.toDate(data.updatedAt),
      content: data.content || '',
      metadata: data
    };
  }
  
  /**
   * Normalize purchase data
   */
  normalizePurchase(id, data) {
    return {
      id,
      createdAt: this.toDate(data.createdAt),
      total: this.normalizeCurrency(data.total, data),
      currency: data.currency || 'USD',
      userId: data.userId || null,
      email: data.email || '',
      productName: data.productName || data.product_key || 'Purchase',
      productType: data.productType || 'one_time',
      status: data.status || 'paid',
      subscriptionId: data.subscriptionId || null,
      metadata: data
    };
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
   * Normalize currency - handles cents to dollars conversion
   * If value >= 1000, it's likely in cents, so divide by 100
   */
  normalizeCurrency(value, context = {}) {
    if (value === null || value === undefined) {
      return this.lookupProductPrice(context) ?? 0;
    }
    
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      const lookedUp = this.lookupProductPrice(context);
      return lookedUp ?? 0;
    }
    
    // If value >= 1000, it's likely in cents (e.g., 2990 = $29.90)
    if (Math.abs(numeric) >= 1000) {
      return Number((numeric / 100).toFixed(2));
    }
    
    // Try to lookup from product key/name
    const lookedUp = this.lookupProductPrice(context);
    if (lookedUp) return lookedUp;
    
    // If numeric >= 50 or divisible by 10, might be cents
    if (numeric >= 50 || numeric % 10 === 0) {
      // Check if it matches common product prices in cents
      const commonPrices = [490, 990, 2990, 29900]; // $4.90, $9.90, $29.90, $299.00
      if (commonPrices.includes(numeric)) {
        return Number((numeric / 100).toFixed(2));
      }
    }
    
    return Number(numeric.toFixed(2));
  }
  
  /**
   * Lookup product price from context
   */
  lookupProductPrice(context) {
    const PRODUCT_PRICE_MAP = {
      single_spec: 4.90,
      three_pack: 9.90,
      pro_monthly: 29.90,
      pro_yearly: 299.00
    };
    
    const key =
      context?.productKey ||
      context?.product_key ||
      context?.metadata?.productKey ||
      context?.metadata?.product_key ||
      context?.metadata?.customData?.product_key ||
      context?.metadata?.customData?.productKey;
    
    if (key && PRODUCT_PRICE_MAP[key]) {
      return PRODUCT_PRICE_MAP[key];
    }
    
    const name = (context?.productName || context?.metadata?.productName || "").toLowerCase();
    if (!name) return null;
    if (name.includes("single")) return PRODUCT_PRICE_MAP.single_spec;
    if (name.includes("3-pack") || name.includes("three")) return PRODUCT_PRICE_MAP.three_pack;
    if (name.includes("monthly")) return PRODUCT_PRICE_MAP.pro_monthly;
    if (name.includes("yearly") || name.includes("annual")) return PRODUCT_PRICE_MAP.pro_yearly;
    
    return null;
  }
  
  /**
   * Load users
   */
  async loadUsers() {
    this.loadingStates.users = true;
    this.emit('loading', { source: 'users', loading: true });
    
    try {
      await firebaseService.subscribe(
        this.collections.USERS,
        (snapshot) => {
          const isInitial = this.data.users.size === 0;
          
          snapshot.docChanges().forEach(change => {
            if (change.type === 'removed') {
              this.data.users.delete(change.doc.id);
            } else {
              const user = this.normalizeUser(change.doc.id, change.doc.data());
              this.data.users.set(change.doc.id, user);
              
              // Create activity event for new users
              if (change.type === 'added' && !isInitial) {
                this.addActivityEvent({
                  type: 'user',
                  title: `New user · ${user.displayName}`,
                  description: user.email,
                  timestamp: user.createdAt || new Date(),
                  meta: {
                    userId: user.id,
                    email: user.email,
                    plan: user.plan
                  }
                });
              }
            }
          });
          
          this.loadingStates.users = false;
          this.errors.delete('users');
          this.emit('data', { source: 'users', data: Array.from(this.data.users.values()) });
          this.emit('loading', { source: 'users', loading: false });
        },
        {
          orderByField: 'createdAt',
          orderDirection: 'desc'
        }
      );
    } catch (error) {
      this.loadingStates.users = false;
      this.errors.set('users', error);
      this.emit('error', { source: 'users', error });
      this.emit('loading', { source: 'users', loading: false });
    }
  }
  
  /**
   * Load user credits
   */
  async loadUserCredits() {
    this.loadingStates.userCredits = true;
    this.emit('loading', { source: 'userCredits', loading: true });
    
    try {
      await firebaseService.subscribe(
        this.collections.USER_CREDITS,
        (snapshot) => {
          snapshot.docChanges().forEach(change => {
            if (change.type === 'removed') {
              this.data.userCredits.delete(change.doc.id);
            } else {
              const data = change.doc.data();
              const subscriptionType = data.subscription?.type || data.metadata?.subscription?.type;
              const subscriptionStatus = data.subscription?.status || data.metadata?.subscription?.status;
              
              this.data.userCredits.set(change.doc.id, {
                userId: change.doc.id,
                balances: {
                  free: data.balances?.free || 0,
                  paid: data.balances?.paid || 0,
                  bonus: data.balances?.bonus || 0
                },
                total: (data.balances?.free || 0) + (data.balances?.paid || 0) + (data.balances?.bonus || 0),
                unlimited: subscriptionType === 'pro' && subscriptionStatus === 'active',
                updatedAt: this.toDate(data.metadata?.updatedAt),
                metadata: data
              });
            }
          });
          
          this.loadingStates.userCredits = false;
          this.errors.delete('userCredits');
          this.emit('data', { source: 'userCredits', data: Array.from(this.data.userCredits.values()) });
          this.emit('loading', { source: 'userCredits', loading: false });
        },
        {},
        (error) => {
          // Handle permission errors gracefully
          this.loadingStates.userCredits = false;
          if (error?.code === 'permission-denied') {
            console.warn('[DataManager] Permission denied for userCredits:', error);
            this.emit('restricted', { source: 'userCredits', error });
          } else {
            this.errors.set('userCredits', error);
            this.emit('error', { source: 'userCredits', error });
          }
          this.emit('loading', { source: 'userCredits', loading: false });
        }
      );
    } catch (error) {
      this.loadingStates.userCredits = false;
      if (error?.code === 'permission-denied') {
        console.warn('[DataManager] Permission denied for userCredits:', error);
        this.emit('restricted', { source: 'userCredits', error });
      } else {
        this.errors.set('userCredits', error);
        this.emit('error', { source: 'userCredits', error });
      }
      this.emit('loading', { source: 'userCredits', loading: false });
    }
  }
  
  /**
   * Load specs - OPTIMIZED with limit
   */
  async loadSpecs() {
    this.loadingStates.specs = true;
    this.emit('loading', { source: 'specs', loading: true });
    
    try {
      await firebaseService.subscribe(
        this.collections.SPECS,
        (snapshot) => {
          const isInitial = this.data.specs.size === 0;
          
          snapshot.docChanges().forEach(change => {
            if (change.type === 'removed') {
              const existing = this.data.specs.get(change.doc.id);
              if (existing) {
                this.data.specs.delete(change.doc.id);
                if (existing.userId) {
                  const userSpecs = this.data.specsByUser.get(existing.userId) || [];
                  this.data.specsByUser.set(
                    existing.userId,
                    userSpecs.filter(s => s.id !== change.doc.id)
                  );
                }
              }
            } else {
              const spec = this.normalizeSpec(change.doc.id, change.doc.data());
              this.data.specs.set(change.doc.id, spec);
              
              // Update specsByUser
              if (spec.userId) {
                const userSpecs = this.data.specsByUser.get(spec.userId) || [];
                const index = userSpecs.findIndex(s => s.id === spec.id);
                if (index >= 0) {
                  userSpecs[index] = spec;
                } else {
                  userSpecs.push(spec);
                }
                userSpecs.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
                this.data.specsByUser.set(spec.userId, userSpecs);
              }
              
              // Create activity event for new specs
              if (change.type === 'added' && !isInitial) {
                const user = this.data.users.get(spec.userId);
                this.addActivityEvent({
                  type: 'spec',
                  title: `Spec created · ${spec.title}`,
                  description: user?.email || spec.userId,
                  timestamp: spec.createdAt || new Date(),
                  meta: {
                    userId: spec.userId,
                    specId: spec.id,
                    userEmail: user?.email
                  }
                });
              }
            }
          });
          
          this.loadingStates.specs = false;
          this.errors.delete('specs');
          this.emit('data', { source: 'specs', data: Array.from(this.data.specs.values()) });
          this.emit('loading', { source: 'specs', loading: false });
        },
        {
          orderByField: 'createdAt',
          orderDirection: 'desc',
          limitCount: 500 // REDUCED from 2000 for performance
        }
      );
    } catch (error) {
      this.loadingStates.specs = false;
      this.errors.set('specs', error);
      this.emit('error', { source: 'specs', error });
      this.emit('loading', { source: 'specs', loading: false });
    }
  }
  
  /**
   * Load purchases - OPTIMIZED with limit
   */
  async loadPurchases() {
    this.loadingStates.purchases = true;
    this.emit('loading', { source: 'purchases', loading: true });
    
    try {
      await firebaseService.subscribe(
        this.collections.PURCHASES,
        (snapshot) => {
          const isInitial = this.data.purchases.length === 0;
          
          snapshot.docChanges().forEach(change => {
            if (change.type === 'removed') {
              this.data.purchases = this.data.purchases.filter(p => p.id !== change.doc.id);
            } else {
              const purchase = this.normalizePurchase(change.doc.id, change.doc.data());
              const index = this.data.purchases.findIndex(p => p.id === purchase.id);
              
              if (index >= 0) {
                this.data.purchases[index] = purchase;
              } else {
                this.data.purchases.push(purchase);
              }
              
              // Sort by date
              this.data.purchases.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
              
              // Keep only last 200 purchases in memory
              if (this.data.purchases.length > 200) {
                this.data.purchases = this.data.purchases.slice(0, 200);
              }
              
              // Create activity event for new purchases
              if (change.type === 'added' && !isInitial) {
                const user = this.data.users.get(purchase.userId);
                this.addActivityEvent({
                  type: 'payment',
                  title: purchase.productName,
                  description: `${this.formatCurrency(purchase.total, purchase.currency)} • ${purchase.email || user?.email || 'Unknown'}`,
                  timestamp: purchase.createdAt || new Date(),
                  meta: {
                    userId: purchase.userId,
                    purchaseId: purchase.id,
                    userEmail: purchase.email || user?.email
                  }
                });
              }
            }
          });
          
          this.loadingStates.purchases = false;
          this.errors.delete('purchases');
          this.emit('data', { source: 'purchases', data: this.data.purchases });
          this.emit('loading', { source: 'purchases', loading: false });
        },
        {
          orderByField: 'createdAt',
          orderDirection: 'desc',
          limitCount: 200 // REDUCED from 250 for performance
        }
      );
    } catch (error) {
      this.loadingStates.purchases = false;
      this.errors.set('purchases', error);
      this.emit('error', { source: 'purchases', error });
      this.emit('loading', { source: 'purchases', loading: false });
    }
  }
  
  /**
   * Load activity logs - OPTIMIZED with limit
   */
  async loadActivityLogs() {
    this.loadingStates.activityLogs = true;
    this.emit('loading', { source: 'activityLogs', loading: true });
    
    try {
      await firebaseService.subscribe(
        this.collections.ACTIVITY_LOGS,
        (snapshot) => {
          this.data.activityLogs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: this.toDate(doc.data().timestamp) || new Date()
          }));
          
          // Keep only last 100 logs in memory
          if (this.data.activityLogs.length > 100) {
            this.data.activityLogs = this.data.activityLogs.slice(0, 100);
          }
          
          this.loadingStates.activityLogs = false;
          this.errors.delete('activityLogs');
          this.emit('data', { source: 'activityLogs', data: this.data.activityLogs });
          this.emit('loading', { source: 'activityLogs', loading: false });
        },
        {
          orderByField: 'timestamp',
          orderDirection: 'desc',
          limitCount: 100 // REDUCED from 200 for performance
        }
      );
    } catch (error) {
      this.loadingStates.activityLogs = false;
      this.errors.set('activityLogs', error);
      this.emit('error', { source: 'activityLogs', error });
      this.emit('loading', { source: 'activityLogs', loading: false });
    }
  }
  
  /**
   * Load contact submissions
   */
  async loadContactSubmissions() {
    this.loadingStates.contactSubmissions = true;
    this.emit('loading', { source: 'contactSubmissions', loading: true });
    
    try {
      await firebaseService.subscribe(
        this.collections.CONTACT_SUBMISSIONS,
        (snapshot) => {
          this.data.contactSubmissions = snapshot.docs.map(doc => ({
            id: doc.id,
            email: doc.data().email || '',
            message: doc.data().message || '',
            userId: doc.data().userId || null,
            status: doc.data().status || 'new',
            createdAt: this.toDate(doc.data().createdAt) || new Date()
          }));
          
          this.loadingStates.contactSubmissions = false;
          this.errors.delete('contactSubmissions');
          this.emit('data', { source: 'contactSubmissions', data: this.data.contactSubmissions });
          this.emit('loading', { source: 'contactSubmissions', loading: false });
        },
        {
          orderByField: 'createdAt',
          orderDirection: 'desc',
          limitCount: 100
        },
        (error) => {
          // Handle permission errors gracefully
          this.loadingStates.contactSubmissions = false;
          if (error?.code === 'permission-denied') {
            console.warn('[DataManager] Permission denied for contactSubmissions:', error);
            this.emit('restricted', { source: 'contactSubmissions', error });
          } else {
            this.errors.set('contactSubmissions', error);
            this.emit('error', { source: 'contactSubmissions', error });
          }
          this.emit('loading', { source: 'contactSubmissions', loading: false });
        }
      );
    } catch (error) {
      this.loadingStates.contactSubmissions = false;
      if (error?.code === 'permission-denied') {
        console.warn('[DataManager] Permission denied for contactSubmissions:', error);
        this.emit('restricted', { source: 'contactSubmissions', error });
      } else {
        this.errors.set('contactSubmissions', error);
        this.emit('error', { source: 'contactSubmissions', error });
      }
      this.emit('loading', { source: 'contactSubmissions', loading: false });
    }
  }
  
  /**
   * Add activity event
   */
  addActivityEvent(event) {
    const fullEvent = {
      id: `${event.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...event
    };
    
    this.activityEvents.unshift(fullEvent);
    this.activityEvents = this.activityEvents.slice(0, 200); // Keep last 200
    
    this.emit('activity', fullEvent);
  }
  
  /**
   * Get activity events
   */
  getActivityEvents(filter = 'all') {
    if (filter === 'all') {
      return [...this.data.activityLogs, ...this.activityEvents]
        .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
        .slice(0, 200);
    }
    
    return [...this.data.activityLogs, ...this.activityEvents]
      .filter(event => event.type === filter)
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
      .slice(0, 200);
  }
  
  /**
   * Format currency
   */
  formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }
  
  /**
   * Get all data
   */
  getAllData() {
    return {
      users: Array.from(this.data.users.values()),
      userCredits: Array.from(this.data.userCredits.values()),
      specs: Array.from(this.data.specs.values()),
      specsByUser: Object.fromEntries(this.data.specsByUser),
      purchases: this.data.purchases,
      activityLogs: this.data.activityLogs,
      contactSubmissions: this.data.contactSubmissions
    };
  }
  
  /**
   * Initialize all subscriptions
   */
  async initialize() {
    await Promise.all([
      this.loadUsers(),
      this.loadUserCredits(),
      this.loadSpecs(),
      this.loadPurchases(),
      this.loadActivityLogs(),
      this.loadContactSubmissions()
    ]);
  }
  
  /**
   * Cleanup
   */
  cleanup() {
    firebaseService.unsubscribeAll();
    this.data.users.clear();
    this.data.userCredits.clear();
    this.data.specs.clear();
    this.data.specsByUser.clear();
    this.data.purchases = [];
    this.data.activityLogs = [];
    this.data.contactSubmissions = [];
    this.activityEvents = [];
    this.listeners.clear();
  }
}

