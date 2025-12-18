import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  where,
  limit,
  onSnapshot,
  getDocs,
  doc,
  getDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB9hr0IWM4EREzkKDxBxYoYinV6LJXWXV4",
  authDomain: "specify-ai.firebaseapp.com",
  projectId: "specify-ai",
  storageBucket: "specify-ai.firebasestorage.app",
  messagingSenderId: "734278787482",
  appId: "1:734278787482:web:0e312fb6f197e849695a23",
  measurementId: "G-4YR9LK63MR"
};

const COLLECTIONS = Object.freeze({
  USERS: "users",
  USER_CREDITS: "user_credits",
  SPECS: "specs",
  PURCHASES: "purchases",
  SUBSCRIPTIONS: "subscriptions",
  CREDITS_TRANSACTIONS: "credits_transactions",
  ACTIVITY_LOGS: "activityLogs",
  ERROR_LOGS: "errorLogs",
  CSS_CRASH_LOGS: "cssCrashLogs",
  BLOG_QUEUE: "blogQueue"
});

const ADMIN_EMAILS = new Set([
  "specifysai@gmail.com",
  "admin@specifys.ai",
  "shalom@specifys.ai"
]);

const DATE_RANGES = Object.freeze({
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000
});

const MAX_ACTIVITY_EVENTS = 200;
const MAX_PURCHASES = 250;
const MAX_SPEC_CACHE = 2000;

let ChartLib = null;
let MarkedLib = null;

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Make auth available globally for API client
window.auth = auth;

function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-loaded-src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.dataset.loadedSrc = src;
    script.onload = () => resolve();
    script.onerror = (event) => reject(event);
    document.head.appendChild(script);
  });
}

/**
 * Utility helpers
 */
const PRODUCT_PRICE_MAP = {
  single_spec: 4.9,
  three_pack: 9.9,
  pro_monthly: 29.9,
  pro_yearly: 299.9,
  pro_lifetime: 499.0
};

const utils = {
  now: () => new Date(),
  toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (value instanceof Timestamp) return value.toDate();
    if (typeof value === "number") return new Date(value);
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : new Date(parsed);
    }
    return null;
  },
  formatDate(value) {
    const date = utils.toDate(value);
    if (!date) return "—";
    return date.toLocaleString("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  },
  escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
  formatRelative(value) {
    const date = utils.toDate(value);
    if (!date) return "—";
    const diff = Date.now() - date.getTime();
    const minutes = Math.round(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days} d ago`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months} mo ago`;
    const years = Math.round(months / 12);
    return `${years} yr ago`;
  },
  formatCurrency(amount, currency = "USD") {
    if (typeof amount !== "number") return "—";
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (e) {
      return `${amount.toFixed(2)} ${currency}`;
    }
  },
  formatNumber(value) {
    if (value === null || value === undefined) return "—";
    if (Math.abs(value) >= 1000) {
      return new Intl.NumberFormat("en-US", { notation: "compact" }).format(
        value
      );
    }
    return new Intl.NumberFormat("en-US").format(value);
  },
  clampArray(arr, limit) {
    if (arr.length <= limit) return arr;
    return arr.slice(0, limit);
  },
  debounce(fn, wait = 250) {
    let timeout = null;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), wait);
    };
  },
  dom(selector) {
    return document.querySelector(selector);
  },
  domAll(selector) {
    return Array.from(document.querySelectorAll(selector));
  },
  sanitizeSlug(slug) {
    return slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 140);
  },
  normalizeCurrency(value, context = {}) {
    if (value === null || value === undefined) {
      return utils.lookupProductPrice(context) ?? null;
    }
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return utils.lookupProductPrice(context) ?? null;
    }
    if (Math.abs(numeric) >= 1000) {
      return Number((numeric / 100).toFixed(2));
    }
    if (numeric >= 50 || numeric % 10 === 0) {
      const mapped = utils.lookupProductPrice(context);
      if (mapped) return mapped;
    }
    return Number(numeric.toFixed(2));
  },
  lookupProductPrice(context) {
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
};

/**
 * DataAggregator - Central data store for all Firebase data
 * Manages all Firebase subscriptions and provides single source of truth
 */
class DataAggregator {
  constructor(db) {
    this.db = db;
    this.unsubscribeFns = [];
    
    // Central aggregated data store
    this.aggregatedData = {
      users: new Map(),
      userCredits: new Map(),
      specs: new Map(),
      specsByUser: new Map(),
      purchases: [],
      activityLogs: [],
      contactSubmissions: [],
    };
    
    // Unified activity events (generated from all sources)
    this.activityEvents = this.loadActivityEventsFromStorage();
    
    // Content stats
    this.contentStats = {
      articlesViews: 0,
      guidesViews: 0,
      articlesViewsInRange: 0,
      guidesViewsInRange: 0
    };
    
    // Callbacks for data changes
    this.onDataChangeCallbacks = [];
    
    // Track errors for each source
    this.sourceErrors = new Map();
    
    // Track initial loads
    this.initialLoads = {
      users: true,
      specs: true,
      purchases: true,
      userCredits: true
    };
    
    // Track if events were generated from existing data
    this._eventsGenerated = false;
  }
  
  /**
   * Load activity events from localStorage
   */
  loadActivityEventsFromStorage() {
    try {
      const stored = localStorage.getItem('admin-activity-events');
      if (stored) {
        const events = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        return events.map(event => ({
          ...event,
          timestamp: event.timestamp ? new Date(event.timestamp) : utils.now()
        })).filter(event => {
          // Only keep events from last 7 days
          const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
          return event.timestamp && event.timestamp.getTime() >= sevenDaysAgo;
        });
      }
    } catch (error) {
      // Failed to load activity events from storage
    }
    return [];
  }
  
  /**
   * Save activity events to localStorage
   */
  saveActivityEventsToStorage() {
    try {
      // Convert Date objects to ISO strings for storage
      const eventsToStore = this.activityEvents.map(event => ({
        ...event,
        timestamp: event.timestamp ? event.timestamp.toISOString() : new Date().toISOString()
      }));
      localStorage.setItem('admin-activity-events', JSON.stringify(eventsToStore));
    } catch (error) {
      // Failed to save activity events to storage
    }
  }
  
  /**
   * Register callback for data changes
   */
  onDataChange(callback) {
    if (typeof callback === 'function') {
      this.onDataChangeCallbacks.push(callback);
    }
  }
  
  /**
   * Notify all callbacks of data changes
   */
  notifyDataChange(source, error = null) {
    // Store error if provided (but not for restricted sources)
    if (error && source.endsWith('-error')) {
      const sourceKey = source.replace('-error', '');
      this.sourceErrors.set(sourceKey, error);
    } else if (source.endsWith('-restricted')) {
      // Clear error for restricted sources (they're not errors, just restricted)
      const sourceKey = source.replace('-restricted', '');
      this.sourceErrors.delete(sourceKey);
    } else if (!source.endsWith('-error') && !source.endsWith('-restricted')) {
      // Clear error when source is ready
      const sourceKey = source;
      this.sourceErrors.delete(sourceKey);
    }
    
    // Check if initial loads are complete and generate events from existing data
    if (this.initialLoads.users === false && 
        this.initialLoads.specs === false && 
        this.initialLoads.purchases === false &&
        this.initialLoads.userCredits === false &&
        !this._eventsGenerated) {
      // Generate events from existing data once all initial loads are complete
      this.generateEventsFromExistingData();
      this._eventsGenerated = true;
    }
    
    this.onDataChangeCallbacks.forEach(callback => {
      try {
        callback(this.aggregatedData, source, error);
      } catch (error) {
        // Error in data change callback
      }
    });
  }
  
  /**
   * Get error for a specific source
   */
  getSourceError(sourceKey) {
    return this.sourceErrors.get(sourceKey) || null;
  }
  
  /**
   * Normalize user data
   */
  normalizeUser(id, data) {
    return {
      id,
      email: data.email || "",
      displayName: data.displayName || data.email || "",
      plan: (data.plan || "free").toLowerCase(),
      createdAt: utils.toDate(data.createdAt) || utils.toDate(data.creationTime),
      lastActive: utils.toDate(data.lastActive),
      newsletterSubscription: Boolean(data.newsletterSubscription),
      disabled: Boolean(data.disabled),
      emailVerified: Boolean(data.emailVerified),
      freeSpecsRemaining: typeof data.free_specs_remaining === "number" ? data.free_specs_remaining : null,
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
      title: data.title || "Untitled spec",
      createdAt: utils.toDate(data.createdAt),
      updatedAt: utils.toDate(data.updatedAt),
      content: data.content || "",
      metadata: data
    };
  }
  
  /**
   * Normalize purchase data
   */
  normalizePurchase(id, data) {
    return {
      id,
      createdAt: utils.toDate(data.createdAt),
      total: utils.normalizeCurrency(data.total, data),
      currency: data.currency || "USD",
      userId: data.userId || null,
      email: data.email || "",
      productName: data.productName || data.product_key || "Purchase",
      productType: data.productType || "one_time",
      status: data.status || "paid",
      subscriptionId: data.subscriptionId || null,
      metadata: data
    };
  }
  
  /**
   * Create activity event from data change
   */
  createActivityEvent(type, data, user = null) {
    const event = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      timestamp: data.createdAt || utils.now(),
      meta: {}
    };
    
    switch (type) {
      case 'user':
        event.title = `New user · ${data.displayName || data.email || data.id}`;
        event.description = data.email || data.displayName || data.id;
        event.meta = {
          userId: data.id,
          email: data.email,
          userEmail: data.email,
          userName: data.displayName,
          plan: data.plan
        };
        break;
      case 'spec':
        event.title = `Spec created · ${data.title}`;
        event.description = user?.email || data.userId || "";
        event.meta = {
          userId: data.userId,
          specId: data.id,
          userName: user?.displayName,
          email: user?.email,
          userEmail: user?.email
        };
        break;
      case 'payment':
      case 'subscription':
        event.title = `${data.productName}`;
        event.description = `${utils.formatCurrency(data.total, data.currency)} • ${data.email || data.userId || "Unknown user"}`;
        event.meta = {
          userId: data.userId,
          purchaseId: data.id,
          userName: user?.displayName,
          email: data.email || user?.email,
          userEmail: data.email || user?.email
        };
        break;
    }
    
    return event;
  }
  
  /**
   * Subscribe to users collection
   */
  subscribeToUsers() {
    try {
      const unsubUsers = onSnapshot(
        collection(this.db, COLLECTIONS.USERS),
        (snapshot) => {
          const isInitialLoad = this.initialLoads.users;
          this.initialLoads.users = false;
          
          if (isInitialLoad) {
            // On initial load, process all docs and create activity for recent users (30 days)
            const last30Days = Date.now() - (30 * 24 * 60 * 60 * 1000);
            snapshot.docs.forEach((docSnap) => {
              const user = this.normalizeUser(docSnap.id, docSnap.data());
              this.aggregatedData.users.set(docSnap.id, user);
              
              // Create activity event for users created in last 30 days
              if (user.createdAt && user.createdAt.getTime() >= last30Days) {
                const eventId = `user-${user.id}`;
                const existingEventIds = new Set(this.activityEvents.map(e => e.id));
                if (!existingEventIds.has(eventId)) {
                  const event = this.createActivityEvent('user', user);
                  event.id = eventId; // Use stable ID to avoid duplicates
                  this.activityEvents.unshift(event);
                  this.activityEvents = utils.clampArray(this.activityEvents, MAX_ACTIVITY_EVENTS);
                  this.saveActivityEventsToStorage();
                }
              }
            });
          } else {
            // For subsequent updates, only process changes
            snapshot.docChanges().forEach((change) => {
              if (change.type === "removed") {
                this.aggregatedData.users.delete(change.doc.id);
              } else {
                const user = this.normalizeUser(change.doc.id, change.doc.data());
                this.aggregatedData.users.set(change.doc.id, user);
                
                // Create activity event for new users
                if (change.type === "added") {
                  const event = this.createActivityEvent('user', user);
                  this.activityEvents.unshift(event);
                  this.activityEvents = utils.clampArray(this.activityEvents, MAX_ACTIVITY_EVENTS);
                  this.saveActivityEventsToStorage();
                }
              }
            });
          }
          
          this.notifyDataChange('users');
        },
        (error) => {
          console.error('[DataAggregator] Error subscribing to users:', error);
          this.notifyDataChange('users-error', error);
        }
      );
      
      this.unsubscribeFns.push(unsubUsers);
      return unsubUsers;
    } catch (error) {
      console.error('[DataAggregator] Failed to subscribe to users:', error);
      this.notifyDataChange('users-error', error);
      return null;
    }
  }
  
  // subscribeToEntitlements() removed - using user_credits system only
  
  /**
   * Subscribe to user_credits collection (new credits system)
   */
  subscribeToUserCredits() {
    try {
      const unsubUserCredits = onSnapshot(
        collection(this.db, COLLECTIONS.USER_CREDITS),
        (snapshot) => {
          const isInitialLoad = this.initialLoads.userCredits;
          this.initialLoads.userCredits = false;
          
          if (isInitialLoad) {
            // On initial load, process all docs
            snapshot.docs.forEach((docSnap) => {
              const data = docSnap.data();
              const subscriptionType = data.subscription?.type || data.metadata?.subscription?.type;
              const subscriptionStatus = data.subscription?.status || data.metadata?.subscription?.status;
              const normalized = {
                userId: docSnap.id,
                balances: {
                  free: data.balances?.free || 0,
                  paid: data.balances?.paid || 0,
                  bonus: data.balances?.bonus || 0
                },
                total: (data.balances?.free || 0) + (data.balances?.paid || 0) + (data.balances?.bonus || 0),
                unlimited: subscriptionType === 'pro' && subscriptionStatus === 'active',
                updatedAt: utils.toDate(data.metadata?.updatedAt),
                metadata: data
              };
              this.aggregatedData.userCredits.set(docSnap.id, normalized);
            });
          } else {
            // For subsequent updates, only process changes
            snapshot.docChanges().forEach((change) => {
              if (change.type === "removed") {
                this.aggregatedData.userCredits.delete(change.doc.id);
              } else {
                const data = change.doc.data();
                const previous = this.aggregatedData.userCredits.get(change.doc.id);
                const previousSubscriptionType = previous ? (previous.metadata?.subscription?.type || (previous.unlimited ? 'pro' : 'none')) : 'none';
                const previousSubscriptionStatus = previous ? (previous.metadata?.subscription?.status || (previous.unlimited ? 'active' : 'none')) : 'none';
                const previousIsPro = previousSubscriptionType === 'pro' && previousSubscriptionStatus === 'active';
                
                const subscriptionType = data.subscription?.type || data.metadata?.subscription?.type;
                const subscriptionStatus = data.subscription?.status || data.metadata?.subscription?.status;
                const normalized = {
                  userId: change.doc.id,
                  balances: {
                    free: data.balances?.free || 0,
                    paid: data.balances?.paid || 0,
                    bonus: data.balances?.bonus || 0
                  },
                  total: (data.balances?.free || 0) + (data.balances?.paid || 0) + (data.balances?.bonus || 0),
                  unlimited: subscriptionType === 'pro' && subscriptionStatus === 'active',
                  updatedAt: utils.toDate(data.metadata?.updatedAt),
                  metadata: data
                };
                
                const currentIsPro = subscriptionType === 'pro' && subscriptionStatus === 'active';
                
                // Create activity event if subscription status changed
                if (previous && previousIsPro !== currentIsPro) {
                  const user = this.aggregatedData.users.get(change.doc.id);
                  if (user) {
                    const eventType = currentIsPro ? 'subscription' : 'payment';
                    const eventTitle = currentIsPro 
                      ? 'Specifys Pro – Monthly' 
                      : 'Subscription cancelled';
                    const event = this.createActivityEvent(eventType, {
                      id: change.doc.id,
                      createdAt: normalized.updatedAt || utils.now(),
                      productName: eventTitle,
                      productType: 'subscription',
                      userId: change.doc.id,
                      email: user.email,
                      plan: currentIsPro ? 'pro' : 'free'
                    }, user);
                    event.id = `subscription-${change.doc.id}-${Date.now()}`;
                    this.activityEvents.unshift(event);
                    this.activityEvents = utils.clampArray(this.activityEvents, MAX_ACTIVITY_EVENTS);
                    this.saveActivityEventsToStorage();
                  }
                }
                
                this.aggregatedData.userCredits.set(change.doc.id, normalized);
              }
            });
          }
          
          this.notifyDataChange('userCredits');
        },
        (error) => {
          // Mark initial load as complete even on error
          this.initialLoads.userCredits = false;
          if (error?.code === "permission-denied") {
            console.warn('[DataAggregator] Permission denied for userCredits:', error);
            this.notifyDataChange('userCredits-restricted', error);
          } else {
            console.error('[DataAggregator] Error subscribing to userCredits:', error);
            this.notifyDataChange('userCredits-error', error);
          }
        }
      );
      
      this.unsubscribeFns.push(unsubUserCredits);
      return unsubUserCredits;
    } catch (error) {
      // Mark initial load as complete even on error
      this.initialLoads.userCredits = false;
      if (error?.code === "permission-denied") {
        console.warn('[DataAggregator] Permission denied for userCredits:', error);
        this.notifyDataChange('userCredits-restricted', error);
      } else {
        console.error('[DataAggregator] Failed to subscribe to userCredits:', error);
        this.notifyDataChange('userCredits-error', error);
      }
      return null;
    }
  }
  
  /**
   * Subscribe to specs collection
   */
  subscribeToSpecs() {
    try {
      const specsQuery = query(
        collection(this.db, COLLECTIONS.SPECS),
        orderBy("createdAt", "desc"),
        limit(MAX_SPEC_CACHE)
      );
      
      const unsubSpecs = onSnapshot(
        specsQuery,
        (snapshot) => {
          const isInitialLoad = this.initialLoads.specs;
          this.initialLoads.specs = false;
          
          if (isInitialLoad) {
            // On initial load, process all docs and create activity for recent specs (30 days)
            const last30Days = Date.now() - (30 * 24 * 60 * 60 * 1000);
            snapshot.docs.forEach((docSnap) => {
              const data = docSnap.data();
              const spec = this.normalizeSpec(docSnap.id, data);
              this.aggregatedData.specs.set(docSnap.id, spec);
              
              // Update specsByUser map
              if (spec.userId) {
                const list = this.aggregatedData.specsByUser.get(spec.userId) || [];
                const index = list.findIndex((s) => s.id === spec.id);
                if (index >= 0) {
                  list[index] = spec;
                } else {
                  list.push(spec);
                }
                list.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
                this.aggregatedData.specsByUser.set(spec.userId, utils.clampArray(list, MAX_SPEC_CACHE));
              }
              
              // Create activity event for specs created in last 30 days
              if (spec.createdAt && spec.createdAt.getTime() >= last30Days) {
                const eventId = `spec-${spec.id}`;
                const existingEventIds = new Set(this.activityEvents.map(e => e.id));
                if (!existingEventIds.has(eventId)) {
                  const user = this.aggregatedData.users.get(spec.userId);
                  const event = this.createActivityEvent('spec', spec, user);
                  event.id = eventId; // Use stable ID to avoid duplicates
                  this.activityEvents.unshift(event);
                  this.activityEvents = utils.clampArray(this.activityEvents, MAX_ACTIVITY_EVENTS);
                  this.saveActivityEventsToStorage();
                }
              }
            });
          } else {
            // For subsequent updates, only process changes
            snapshot.docChanges().forEach((change) => {
              if (change.type === "removed") {
                const existing = this.aggregatedData.specs.get(change.doc.id);
                if (existing) {
                  this.aggregatedData.specs.delete(change.doc.id);
                  if (existing.userId) {
                    const list = this.aggregatedData.specsByUser.get(existing.userId) || [];
                    this.aggregatedData.specsByUser.set(
                      existing.userId,
                      list.filter((s) => s.id !== change.doc.id)
                    );
                  }
                }
              } else {
                const spec = this.normalizeSpec(change.doc.id, change.doc.data());
                const previous = this.aggregatedData.specs.get(spec.id);
                
                // Update specsByUser map
                if (previous && previous.userId && previous.userId !== spec.userId) {
                  const prevList = this.aggregatedData.specsByUser.get(previous.userId);
                  if (prevList) {
                    this.aggregatedData.specsByUser.set(
                      previous.userId,
                      prevList.filter((s) => s.id !== spec.id)
                    );
                  }
                }
                
                this.aggregatedData.specs.set(spec.id, spec);
                if (spec.userId) {
                  const list = this.aggregatedData.specsByUser.get(spec.userId) || [];
                  const index = list.findIndex((s) => s.id === spec.id);
                  if (index >= 0) {
                    list[index] = spec;
                  } else {
                    list.push(spec);
                  }
                  list.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
                  this.aggregatedData.specsByUser.set(spec.userId, utils.clampArray(list, MAX_SPEC_CACHE));
                }
                
                // Create activity event for new specs
                if (change.type === "added") {
                  const user = this.aggregatedData.users.get(spec.userId);
                  const event = this.createActivityEvent('spec', spec, user);
                  this.activityEvents.unshift(event);
                  this.activityEvents = utils.clampArray(this.activityEvents, MAX_ACTIVITY_EVENTS);
                  this.saveActivityEventsToStorage();
                }
              }
            });
          }
          
          this.notifyDataChange('specs');
        },
        (error) => {
          console.error('[DataAggregator] Error subscribing to specs:', error);
          this.notifyDataChange('specs-error', error);
        }
      );
      
      this.unsubscribeFns.push(unsubSpecs);
      return unsubSpecs;
    } catch (error) {
      console.error('[DataAggregator] Failed to subscribe to specs:', error);
      this.notifyDataChange('specs-error', error);
      return null;
    }
  }
  
  /**
   * Subscribe to purchases collection
   */
  subscribeToPurchases() {
    try {
      const purchasesQuery = query(
        collection(this.db, COLLECTIONS.PURCHASES),
        orderBy("createdAt", "desc"),
        limit(MAX_PURCHASES)
      );
      
      const unsubPurchases = onSnapshot(
        purchasesQuery,
        (snapshot) => {
          const isInitialLoad = this.initialLoads.purchases;
          this.initialLoads.purchases = false;
          
          if (isInitialLoad) {
            // On initial load, process all docs and create activity for recent purchases (30 days)
            const last30Days = Date.now() - (30 * 24 * 60 * 60 * 1000);
            snapshot.docs.forEach((docSnap) => {
              const purchase = this.normalizePurchase(docSnap.id, docSnap.data());
              const index = this.aggregatedData.purchases.findIndex((p) => p.id === purchase.id);
              
              if (index >= 0) {
                this.aggregatedData.purchases[index] = purchase;
              } else {
                this.aggregatedData.purchases.push(purchase);
              }
              
              // Create activity event for purchases created in last 30 days
              if (purchase.createdAt && purchase.createdAt.getTime() >= last30Days) {
                const eventId = `purchase-${purchase.id}`;
                const existingEventIds = new Set(this.activityEvents.map(e => e.id));
                if (!existingEventIds.has(eventId)) {
                  const user = this.aggregatedData.users.get(purchase.userId);
                  const eventType = purchase.productType === "subscription" ? "subscription" : "payment";
                  const event = this.createActivityEvent(eventType, purchase, user);
                  event.id = eventId; // Use stable ID to avoid duplicates
                  this.activityEvents.unshift(event);
                  this.activityEvents = utils.clampArray(this.activityEvents, MAX_ACTIVITY_EVENTS);
                  this.saveActivityEventsToStorage();
                }
              }
            });
            
            // Sort purchases after initial load
            this.aggregatedData.purchases.sort(
              (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
            );
            this.aggregatedData.purchases = utils.clampArray(this.aggregatedData.purchases, MAX_PURCHASES);
          } else {
            // For subsequent updates, only process changes
            snapshot.docChanges().forEach((change) => {
              if (change.type === "removed") {
                this.aggregatedData.purchases = this.aggregatedData.purchases.filter(
                  (p) => p.id !== change.doc.id
                );
              } else {
                const purchase = this.normalizePurchase(change.doc.id, change.doc.data());
                const index = this.aggregatedData.purchases.findIndex((p) => p.id === purchase.id);
                
                if (index >= 0) {
                  this.aggregatedData.purchases[index] = purchase;
                } else {
                  this.aggregatedData.purchases.unshift(purchase);
                }
                
                // Sort purchases
                this.aggregatedData.purchases.sort(
                  (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
                );
                this.aggregatedData.purchases = utils.clampArray(this.aggregatedData.purchases, MAX_PURCHASES);
                
                // Create activity event for new purchases
                if (change.type === "added") {
                  const user = this.aggregatedData.users.get(purchase.userId);
                  const eventType = purchase.productType === "subscription" ? "subscription" : "payment";
                  const event = this.createActivityEvent(eventType, purchase, user);
                  this.activityEvents.unshift(event);
                  this.activityEvents = utils.clampArray(this.activityEvents, MAX_ACTIVITY_EVENTS);
                  this.saveActivityEventsToStorage();
                }
              }
            });
          }
          
          this.notifyDataChange('purchases');
        },
        (error) => {
          console.error('[DataAggregator] Error subscribing to purchases:', error);
          this.notifyDataChange('purchases-error', error);
        }
      );
      
      this.unsubscribeFns.push(unsubPurchases);
      return unsubPurchases;
    } catch (error) {
      console.error('[DataAggregator] Failed to subscribe to purchases:', error);
      this.notifyDataChange('purchases-error');
      return null;
    }
  }
  
  /**
   * Subscribe to activity logs collection
   */
  subscribeToActivityLogs() {
    try {
      const activityQuery = query(
        collection(this.db, COLLECTIONS.ACTIVITY_LOGS),
        orderBy("timestamp", "desc"),
        limit(MAX_ACTIVITY_EVENTS)
      );
      
      const unsubActivity = onSnapshot(
        activityQuery,
        (snapshot) => {
          const events = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              type: data.type || "system",
              title: data.title || data.event || "Activity",
              description: data.description || data.message || "",
              timestamp: utils.toDate(data.timestamp),
              meta: data
            };
          });
          
          this.aggregatedData.activityLogs = events;
          
          // Merge activity logs with generated events
          this.updateActivityEvents();
          
          this.notifyDataChange('activityLogs');
        },
        (error) => {
          if (error?.code === "permission-denied") {
            console.warn('[DataAggregator] Permission denied for activityLogs:', error);
            this.notifyDataChange('activityLogs-restricted');
          } else {
            console.error('[DataAggregator] Error subscribing to activityLogs:', error);
            this.notifyDataChange('activityLogs-error', error);
          }
        }
      );
      
      this.unsubscribeFns.push(unsubActivity);
      return unsubActivity;
    } catch (error) {
      if (error?.code === "permission-denied") {
        this.notifyDataChange('activityLogs-restricted');
      } else {
        this.notifyDataChange('activityLogs-error', error);
      }
      return null;
    }
  }
  
  /**
   * Generate activity events from existing data (for initial load)
   * Creates events from users, specs, and purchases created in the last 7 days
   */
  generateEventsFromExistingData() {
    // Only generate events if all critical initial loads are complete
    // userCredits is optional - if it fails, we can still generate events using user.plan
    if (this.initialLoads.users || this.initialLoads.specs || this.initialLoads.purchases) {
      return; // Wait for critical data to load
    }
    // Note: userCredits is optional - if it fails, we'll use user.plan as fallback
    
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const existingEventIds = new Set(this.activityEvents.map(e => e.id));
    const newEvents = [];
    
    // Generate events from users created in last 30 days
    const users = Array.from(this.aggregatedData.users.values());
    users.forEach(user => {
      if (user.createdAt && user.createdAt.getTime() >= thirtyDaysAgo) {
        const eventId = `user-${user.id}`;
        if (!existingEventIds.has(eventId)) {
          const event = this.createActivityEvent('user', user);
          event.id = eventId; // Use stable ID to avoid duplicates
          newEvents.push(event);
          existingEventIds.add(eventId);
        }
      }
    });
    
    // Generate events from specs created in last 30 days
    const specs = Array.from(this.aggregatedData.specs.values());
    specs.forEach(spec => {
      if (spec.createdAt && spec.createdAt.getTime() >= thirtyDaysAgo) {
        const eventId = `spec-${spec.id}`;
        if (!existingEventIds.has(eventId)) {
          const user = this.aggregatedData.users.get(spec.userId);
          const event = this.createActivityEvent('spec', spec, user);
          event.id = eventId; // Use stable ID to avoid duplicates
          newEvents.push(event);
          existingEventIds.add(eventId);
        }
      }
    });
    
    // Generate events from purchases created in last 30 days
    this.aggregatedData.purchases.forEach(purchase => {
      if (purchase.createdAt && purchase.createdAt.getTime() >= thirtyDaysAgo) {
        const eventId = `purchase-${purchase.id}`;
        if (!existingEventIds.has(eventId)) {
          const user = this.aggregatedData.users.get(purchase.userId);
          const eventType = purchase.productType === "subscription" ? "subscription" : "payment";
          const event = this.createActivityEvent(eventType, purchase, user);
          event.id = eventId; // Use stable ID to avoid duplicates
          newEvents.push(event);
          existingEventIds.add(eventId);
        }
      }
    });
    
    // Add new events to the beginning of the array
    if (newEvents.length > 0) {
      this.activityEvents.unshift(...newEvents);
      this.activityEvents = utils.clampArray(this.activityEvents, MAX_ACTIVITY_EVENTS);
      this.saveActivityEventsToStorage();
    }
  }
  
  /**
   * Update unified activity events by merging generated events with activity logs
   */
  updateActivityEvents() {
    const combined = [...this.activityEvents, ...this.aggregatedData.activityLogs];
    combined.sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
    this.activityEvents = utils.clampArray(combined, MAX_ACTIVITY_EVENTS);
    // Save to localStorage for persistence across page refreshes
    this.saveActivityEventsToStorage();
  }
  
  /**
   * Subscribe to contact submissions collection
   */
  subscribeToContactSubmissions() {
    try {
      const contactQuery = query(
        collection(this.db, 'contactSubmissions'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      
      const unsubContact = onSnapshot(
        contactQuery,
        (snapshot) => {
          const submissions = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              email: data.email || '',
              message: data.message || '',
              userId: data.userId || null,
              userName: data.userName || null,
              status: data.status || 'new',
              createdAt: utils.toDate(data.createdAt) || utils.toDate(data.timestamp) || new Date(),
              timestamp: data.timestamp || new Date().toISOString()
            };
          });
          
          // Track new submissions for notifications
          const previousIds = new Set(this.aggregatedData.contactSubmissions.map(s => s.id));
          const newSubmissions = submissions.filter(s => !previousIds.has(s.id) && s.status === 'new');
          
          this.aggregatedData.contactSubmissions = submissions;
          
          // Notify about new submissions
          if (newSubmissions.length > 0) {
            this.notifyDataChange('contactSubmissions-new');
          }
          
          this.notifyDataChange('contactSubmissions');
        },
        (error) => {
          // Mark initial load as complete even on error (contactSubmissions doesn't block other data)
          if (error?.code === "permission-denied") {
            console.warn('[DataAggregator] Permission denied for contactSubmissions:', error);
            this.notifyDataChange('contactSubmissions-restricted', error);
          } else {
            console.error('[DataAggregator] Error subscribing to contactSubmissions:', error);
            this.notifyDataChange('contactSubmissions-error', error);
          }
        }
      );
      
      this.unsubscribeFns.push(unsubContact);
      return unsubContact;
    } catch (error) {
      // Mark initial load as complete even on error (contactSubmissions doesn't block other data)
      if (error?.code === "permission-denied") {
        console.warn('[DataAggregator] Permission denied for contactSubmissions:', error);
        this.notifyDataChange('contactSubmissions-restricted', error);
      } else {
        console.error('[DataAggregator] Failed to subscribe to contactSubmissions:', error);
        this.notifyDataChange('contactSubmissions-error', error);
      }
      return null;
    }
  }
  
  /**
   * Initialize all subscriptions
   */
  subscribeAll() {
    this.subscribeToUsers();
    // subscribeToEntitlements() removed - using new user_credits system only
    this.subscribeToUserCredits();
    this.subscribeToSpecs();
    this.subscribeToPurchases();
    this.subscribeToActivityLogs();
    this.subscribeToContactSubmissions();
  }
  
  /**
   * Unsubscribe from all listeners
   */
  unsubscribeAll() {
    this.unsubscribeFns.forEach((unsub) => {
      try {
        unsub();
      } catch (error) {
        // Error unsubscribing
      }
    });
    this.unsubscribeFns = [];
  }
  
  /**
   * Reset all data
   */
  reset() {
    this.aggregatedData.users.clear();
    this.aggregatedData.userCredits.clear();
    this.aggregatedData.specs.clear();
    this.aggregatedData.specsByUser.clear();
    this.aggregatedData.purchases = [];
    this.aggregatedData.activityLogs = [];
    this.activityEvents = [];
    this.initialLoads = {
      users: true,
      specs: true,
      purchases: true
    };
    this._eventsGenerated = false;
    // Clear localStorage as well
    try {
      localStorage.removeItem('admin-activity-events');
    } catch (error) {
      // Failed to clear activity events from storage
    }
  }
  
  /**
   * Get user by ID
   */
  getUser(userId) {
    return this.aggregatedData.users.get(userId) || null;
  }
  
  /**
   * Get all users sorted by creation date
   */
  getUsersSorted() {
    return Array.from(this.aggregatedData.users.values()).sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }
  
  /**
   * Get purchases filtered by range
   */
  getPurchases(range) {
    if (!range || range === "all") return this.aggregatedData.purchases;
    const threshold = Date.now() - DATE_RANGES[range];
    return this.aggregatedData.purchases.filter(
      (purchase) => (purchase.createdAt?.getTime() || 0) >= threshold
    );
  }
  
  /**
   * Get unified activity events
   */
  getActivityEvents() {
    return this.activityEvents;
  }
}

class DashboardDataStore {
  constructor() {
    this.users = new Map();
    this.specs = new Map();
    this.specsByUser = new Map();
    this.purchases = [];
    this.activity = [];
    this.manualActivity = [];
    this.blogQueue = [];
    this.contactSubmissions = [];
  }

  reset() {
    this.users.clear();
    this.specs.clear();
    this.specsByUser.clear();
    this.purchases = [];
    this.activity = [];
    this.manualActivity = [];
    this.blogQueue = [];
    this.contactSubmissions = [];
  }

  upsertUser(id, data) {
    const normalized = {
      id,
      email: data.email || "",
      displayName: data.displayName || data.email || "",
      plan: (data.plan || "free").toLowerCase(),
      createdAt: utils.toDate(data.createdAt) || utils.toDate(data.creationTime),
      lastActive: utils.toDate(data.lastActive),
      newsletterSubscription: Boolean(data.newsletterSubscription),
      disabled: Boolean(data.disabled),
      emailVerified: Boolean(data.emailVerified),
      freeSpecsRemaining: typeof data.free_specs_remaining === "number" ? data.free_specs_remaining : null,
      metadata: data
    };
    this.users.set(id, normalized);
    return normalized;
  }

  removeUser(id) {
    this.users.delete(id);
  }

  // upsertEntitlement() removed - using user_credits system only
  // removeEntitlement() removed - using user_credits system only

  upsertSpec(id, data) {
    const normalized = {
      id,
      userId: data.userId || data.uid || null,
      title: data.title || "Untitled spec",
      createdAt: utils.toDate(data.createdAt),
      updatedAt: utils.toDate(data.updatedAt),
      content: data.content || "",
      metadata: data
    };

    const previous = this.specs.get(id);
    if (previous && previous.userId && previous.userId !== normalized.userId) {
      const prevList = this.specsByUser.get(previous.userId);
      if (prevList) {
        this.specsByUser.set(
          previous.userId,
          prevList.filter((spec) => spec.id !== id)
        );
      }
    }

    this.specs.set(id, normalized);
    if (normalized.userId) {
      const list = this.specsByUser.get(normalized.userId) || [];
      const index = list.findIndex((spec) => spec.id === id);
      if (index >= 0) {
        list[index] = normalized;
                } else {
        list.push(normalized);
      }
      list.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      this.specsByUser.set(
        normalized.userId,
        utils.clampArray(list, MAX_SPEC_CACHE)
      );
    }

    return normalized;
  }

  removeSpec(id) {
    const existing = this.specs.get(id);
    if (existing) {
      this.specs.delete(id);
      if (existing.userId) {
        const list = this.specsByUser.get(existing.userId) || [];
        this.specsByUser.set(
          existing.userId,
          list.filter((spec) => spec.id !== id)
        );
      }
    }
  }

  setPurchases(purchases) {
    this.purchases = purchases
      .map((doc) => ({
        id: doc.id,
        createdAt: utils.toDate(doc.createdAt),
        total: utils.normalizeCurrency(doc.total, doc),
        currency: doc.currency || "USD",
        userId: doc.userId || null,
        email: doc.email || "",
        productName: doc.productName || doc.product_key || "Purchase",
        productType: doc.productType || "one_time",
        status: doc.status || "paid",
        subscriptionId: doc.subscriptionId || null,
        metadata: doc
      }))
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    this.purchases = utils.clampArray(this.purchases, MAX_PURCHASES);
  }

  upsertPurchase(id, data) {
    const normalized = {
      id,
      createdAt: utils.toDate(data.createdAt),
      total: utils.normalizeCurrency(data.total, data),
      currency: data.currency || "USD",
      userId: data.userId || null,
      email: data.email || "",
      productName: data.productName || data.product_key || "Purchase",
      productType: data.productType || "one_time",
      status: data.status || "paid",
      subscriptionId: data.subscriptionId || null,
      metadata: data
    };
    const index = this.purchases.findIndex((item) => item.id === id);
    if (index >= 0) {
      this.purchases[index] = normalized;
    } else {
      this.purchases.unshift(normalized);
    }
    this.purchases.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    this.purchases = utils.clampArray(this.purchases, MAX_PURCHASES);
    return normalized;
  }

  removePurchase(id) {
    this.purchases = this.purchases.filter((item) => item.id !== id);
  }

  setActivity(events, options = { append: false }) {
    if (options.append) {
      this.activity = utils.clampArray(
        [...events, ...this.activity],
        MAX_ACTIVITY_EVENTS
      );
    } else {
      this.activity = utils.clampArray(events, MAX_ACTIVITY_EVENTS);
    }
  }

  recordActivity(event) {
    if (!event || !event.timestamp) return;
    const normalized = {
      id: event.id || `${event.type}-${event.timestamp.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      type: event.type || "system",
      title: event.title || "Activity",
      description: event.description || "",
      timestamp: utils.toDate(event.timestamp) || utils.now(),
      meta: event.meta || {}
    };
    this.manualActivity.unshift(normalized);
    this.manualActivity = utils.clampArray(this.manualActivity, MAX_ACTIVITY_EVENTS);
  }

  setBlogQueue(items) {
    this.blogQueue = items
      .map((item) => ({
        id: item.id,
        title: item.postData?.title || "Untitled post",
        status: item.status || "pending",
        createdAt: utils.toDate(item.createdAt),
        startedAt: utils.toDate(item.startedAt),
        completedAt: utils.toDate(item.completedAt),
        error: item.error || null,
        result: item.result || null
      }))
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  getUsersSorted() {
    return Array.from(this.users.values()).sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  getUser(userId) {
    return this.users.get(userId) || null;
  }

  // getEntitlement() removed - using user_credits system only

  getSpecCount(userId) {
    const list = this.specsByUser.get(userId);
    return list ? list.length : 0;
  }

  getSpecsForUser(userId) {
    return this.specsByUser.get(userId) || [];
  }

  getPurchases(range) {
    if (!range || range === "all") return this.purchases;
    const threshold = Date.now() - DATE_RANGES[range];
    return this.purchases.filter((purchase) => (purchase.createdAt?.getTime() || 0) >= threshold);
  }

  getActivityMerged() {
    const combined = [...this.manualActivity, ...this.activity];
    combined.sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
    return utils.clampArray(combined, MAX_ACTIVITY_EVENTS);
  }
}

/**
 * MetricsCalculator - Calculates all dashboard metrics from aggregated data
 * Single source of truth for all metric calculations
 */
class MetricsCalculator {
  constructor(dataAggregator) {
    this.dataAggregator = dataAggregator;
  }
  
  /**
   * Calculate all overview metrics for a given date range
   */
  calculateOverviewMetrics(range = 'week') {
    const threshold = Date.now() - (DATE_RANGES[range] || DATE_RANGES.week);
    const aggregatedData = this.dataAggregator.aggregatedData;
    
    // Get all users
    const users = this.dataAggregator.getUsersSorted();
    const totalUsers = users.length;
    
    // Users in range
    const usersInRange = users.filter(
      (user) => (user.createdAt?.getTime() || 0) >= threshold
    );
    const newUsers = usersInRange.length;
    
    // Pro users - check user_credits subscription (source of truth)
    const proUsers = users.filter((user) => {
      const userCredits = aggregatedData.userCredits.get(user.id);
      if (userCredits) {
        const subscriptionType = userCredits.metadata?.subscription?.type;
        const subscriptionStatus = userCredits.metadata?.subscription?.status;
        return (subscriptionType === 'pro' && subscriptionStatus === 'active') || userCredits.unlimited;
      }
      return user.plan === "pro";
    }).length;
    const proUsersInRange = usersInRange.filter((user) => {
      const userCredits = aggregatedData.userCredits.get(user.id);
      if (userCredits) {
        const subscriptionType = userCredits.metadata?.subscription?.type;
        const subscriptionStatus = userCredits.metadata?.subscription?.status;
        return (subscriptionType === 'pro' && subscriptionStatus === 'active') || userCredits.unlimited;
      }
      return user.plan === "pro";
    }).length;
    const proShare = totalUsers ? Math.round((proUsers / totalUsers) * 100) : 0;
    const proShareInRange = newUsers ? Math.round((proUsersInRange / newUsers) * 100) : 0;
    
    // Live users (active in last 15 minutes)
    const LIVE_THRESHOLD_MS = 15 * 60 * 1000;
    const liveThreshold = Date.now() - LIVE_THRESHOLD_MS;
    const liveUsers = users.filter((user) => {
      if (!user.lastActive) return false;
      const lastActiveTime = user.lastActive?.getTime() || 0;
      return lastActiveTime >= liveThreshold;
    }).length;
    
    // Specs metrics
    const specs = Array.from(aggregatedData.specs.values());
    const specsInRange = specs.filter(
      (spec) => (spec.createdAt?.getTime() || 0) >= threshold
    ).length;
    const specsTotal = specs.length;
    
    // Revenue metrics
    const purchases = this.dataAggregator.getPurchases(range);
    const revenueRange = purchases.reduce(
      (sum, purchase) => sum + (purchase.total || 0),
      0
    );
    const revenueTotal = aggregatedData.purchases.reduce(
      (sum, purchase) => sum + (purchase.total || 0),
      0
    );
    
    return {
      totalUsers,
      newUsers,
      liveUsers,
      proUsers: proUsersInRange,
      proShare: proShareInRange,
      specsInRange,
      specsTotal,
      revenueRange,
      revenueTotal
    };
  }
  
  /**
   * Calculate activity feed events (unified from all sources)
   */
  calculateActivityFeed(filter = 'all') {
    const events = this.dataAggregator.getActivityEvents();
    
    if (filter === 'all') {
      return events;
    }
    
    return events.filter((event) => {
      if (filter === "payment") {
        return event.type === "payment" || event.type === "subscription";
      }
      if (filter === "user") {
        return event.type === "user" || event.type === "auth";
      }
      return event.type === filter;
    });
  }
  
  /**
   * Calculate content stats (articles views and guides views)
   * Now uses analytics API to get views by actual view date, not publication date
   */
  async calculateContentStats(range = 'week', apiBaseUrl) {
    const stats = {
      articlesViews: 0,
      articlesViewsInRange: 0,
      guidesViews: 0,
      guidesViewsInRange: 0
    };
    
    // Load content stats from analytics API
    try {
      if (window.api) {
        const response = await window.api.get(`/api/analytics/content-stats?range=${range}`);
        if (response && response.success && response.stats) {
          stats.articlesViews = response.stats.articlesViews || 0;
          stats.articlesViewsInRange = response.stats.articlesViewsInRange || 0;
          stats.guidesViews = response.stats.guidesViews || 0;
          stats.guidesViewsInRange = response.stats.guidesViewsInRange || 0;
          return stats; // Return early if successful
        }
      }
    } catch (error) {
      // Fallback to old method if analytics API fails
      
      // Fallback: Load articles views from API (backward compatibility)
      try {
        const articlesData = await window.api.get('/api/articles/list?status=all&limit=1000');
        if (articlesData && articlesData.success && articlesData.articles) {
          const totalViews = articlesData.articles.reduce(
            (sum, article) => sum + (article.views || 0),
            0
          );
          stats.articlesViews = totalViews;
          stats.articlesViewsInRange = totalViews; // Fallback: show all views
        }
      } catch (error) {
        // Failed to load articles stats
      }
      
      // Fallback: Load guides views from Firestore
      try {
        const guidesSnapshot = await getDocs(collection(db, 'academy_guides'));
        const guides = guidesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        const totalViews = guides.reduce((sum, guide) => sum + (guide.views || 0), 0);
        stats.guidesViews = totalViews;
        stats.guidesViewsInRange = totalViews; // Fallback: show all views
      } catch (error) {
        // Failed to load guides stats
      }
    }
    
    return stats;
  }
}

class GlobalSearch {
  constructor(store, elements) {
    this.store = store;
    this.elements = elements;
    this.active = false;
    this.boundHandleKey = this.handleKeydown.bind(this);
    this.debouncedSearch = utils.debounce(this.executeSearch.bind(this), 160);
    this.init();
  }

  init() {
    document.addEventListener("keydown", this.boundHandleKey);
    this.elements.openTrigger?.addEventListener("click", () => this.open());
    this.elements.closeTrigger?.addEventListener("click", () => this.close());
    this.elements.backdrop?.addEventListener("click", () => this.close());
    this.elements.input?.addEventListener("input", (event) => {
      this.debouncedSearch(event.target.value);
    });
  }

  handleKeydown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === "/") {
      event.preventDefault();
      this.toggle();
    } else if (event.key === "Escape" && this.active) {
      event.preventDefault();
      this.close();
    }
  }

  toggle() {
    if (this.active) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.active = true;
    this.elements.root?.classList.remove("hidden");
    setTimeout(() => this.elements.input?.focus(), 20);
    this.renderPlaceholder();
  }

  close() {
    this.active = false;
    this.elements.root?.classList.add("hidden");
    if (this.elements.input) {
      this.elements.input.value = "";
    }
    this.renderPlaceholder();
  }

  renderPlaceholder() {
    if (!this.elements.results) return;
    this.elements.results.innerHTML = `
      <div class="results-placeholder">Start typing to search across modules.</div>
    `;
  }

  executeSearch(rawTerm) {
    if (!this.elements.results) return;
    const term = rawTerm.trim().toLowerCase();
    if (term.length < 2) {
      this.renderPlaceholder();
            return;
        }

    const userResults = [];
    const paymentResults = [];
    const specResults = [];
    const logResults = [];

    for (const user of this.store.getUsersSorted()) {
      if (
        (user.email && user.email.toLowerCase().includes(term)) ||
        (user.displayName && user.displayName.toLowerCase().includes(term))
      ) {
        userResults.push({
          id: user.id,
          title: user.displayName || user.email || user.id || "Unknown",
          subtitle: `${user.email || user.id || "No email"} • Plan: ${user.plan || "free"}`,
          action: () => {
            const navButton = document.querySelector(
              '[data-target="users-section"]'
            );
            navButton?.dispatchEvent(new Event("click", { bubbles: true }));
            const searchInput = document.getElementById("users-search");
            if (searchInput) {
              searchInput.focus();
              searchInput.value = user.email || user.id || "";
              searchInput.dispatchEvent(new Event("input"));
            }
            this.close();
          }
        });
      }
    }

    for (const purchase of this.store.purchases) {
      const target = [purchase.email, purchase.productName, purchase.productType]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (target.includes(term)) {
        paymentResults.push({
          id: purchase.id,
          title: `${utils.formatCurrency(purchase.total, purchase.currency)} • ${purchase.productName}`,
          subtitle: `${purchase.email || purchase.userId || "Unknown user"} · ${utils.formatDate(purchase.createdAt)}`,
          action: () => {
            document
              .querySelector('[data-target="payments-section"]')
              ?.dispatchEvent(new Event("click", { bubbles: true }));
            this.close();
          }
        });
      }
    }

    for (const [userId, specs] of this.store.specsByUser.entries()) {
      for (const spec of specs) {
        const target = `${spec.title} ${spec.metadata?.description || ""}`.toLowerCase();
        if (target.includes(term)) {
          specResults.push({
            id: spec.id,
            title: spec.title,
            subtitle: `${this.store.getUser(userId)?.email || userId} · ${utils.formatDate(spec.createdAt)}`,
            action: () => {
              this.elements.specViewer?.openWithUser(userId);
              this.close();
            }
          });
        }
      }
    }

    for (const event of this.store.getActivityMerged()) {
      const target = `${event.title} ${event.description}`.toLowerCase();
      if (target.includes(term)) {
        logResults.push({
          id: event.id,
          title: event.title,
          subtitle: `${event.type.toUpperCase()} · ${utils.formatDate(event.timestamp)}`,
          action: () => {
            document
              .querySelector('[data-target="logs-section"]')
              ?.dispatchEvent(new Event("click", { bubbles: true }));
            this.close();
          }
        });
      }
    }

    const renderGroup = (label, items) => {
      if (!items.length) return "";
      const htmlItems = items
        .slice(0, 6)
        .map(
          (item) => `
          <li class="result-item" data-result-id="${item.id}">
            <span class="result-title">${item.title}</span>
            <span class="result-meta">${item.subtitle}</span>
          </li>
        `
        )
        .join("");
      return `
        <section class="result-group" data-group="${label.toLowerCase()}">
          <h3>${label}</h3>
          <ul class="result-list">${htmlItems}</ul>
        </section>
      `;
    };

    const resultsHTML = [
      renderGroup("Users", userResults),
      renderGroup("Payments", paymentResults),
      renderGroup("Specs", specResults),
      renderGroup("Logs", logResults)
    ]
      .filter(Boolean)
      .join("");

    this.elements.results.innerHTML =
      resultsHTML || `<div class="results-placeholder">No results found for "${term}".</div>`;

    this.elements.results
      .querySelectorAll(".result-item")
      .forEach((itemElement) => {
        itemElement.addEventListener("click", () => {
          const group = itemElement.closest(".result-group")?.dataset.group;
          const id = itemElement.dataset.resultId;
          const collectionMap = {
            users: userResults,
            payments: paymentResults,
            specs: specResults,
            logs: logResults
          };
          const targetCollection = collectionMap[group];
          const found = targetCollection?.find((entry) => entry.id === id);
          found?.action?.();
        });
      });
  }

  async fetchBlogPost(id) {
    if (!id) {
      throw new Error("Post ID is required to load the post.");
    }
    let token = await this.getAuthToken();
    if (!token) {
      const authError = new Error("Authentication required to load blog post.");
      authError.status = 401;
      throw authError;
    }
    try {
      const result = await window.api.get(`/api/blog/get-post?id=${encodeURIComponent(id)}`);
      if (!result || !result.success || !result.post) {
        throw new Error(result?.error || 'Failed to load blog post');
      }
      return result.post;
    } catch (error) {
      if (error.status === 401) {
        // Try refreshing token and retry once
        token = await this.getAuthToken(true);
        if (!token) {
          const refreshError = new Error("Unable to refresh authentication token.");
          refreshError.status = 401;
          throw refreshError;
        }
        const result = await window.api.get(`/api/blog/get-post?id=${encodeURIComponent(id)}`);
        if (!result || !result.success || !result.post) {
          throw new Error(result?.error || 'Failed to load blog post');
        }
        return result.post;
      }
      throw error;
    }
  }

  async enterBlogEditMode(id) {
    if (!id) return;
    try {
      if (this.editingPost?.id !== id) {
        this.exitBlogEditMode();
      }
      this.setBlogFeedback("Loading post for editing…", "success");
      const post = await this.fetchBlogPost(id);

      this.editingPost = {
        id: post.id,
        date: post.date,
        slug: post.slug
      };

      if (this.dom.blogFields.title) {
        this.dom.blogFields.title.value = post.title || "";
      }
      if (this.dom.blogFields.description) {
        this.dom.blogFields.description.value = post.description || "";
        if (this.dom.blogFields.descriptionCount) {
          this.dom.blogFields.descriptionCount.textContent = `${post.description?.length || 0} / 160`;
        }
      }
      if (this.dom.blogFields.content) {
        this.dom.blogFields.content.value = post.content || "";
      }
      if (this.dom.blogFields.tags) {
        this.dom.blogFields.tags.value = Array.isArray(post.tags) ? post.tags.join(", ") : "";
      }
      if (this.dom.blogFields.slug) {
        this.dom.blogFields.slug.value = post.slug || "";
        this.dom.blogFields.slug.dataset.manual = "true";
        this.dom.blogFields.slug.disabled = true;
      }
      if (this.dom.blogFields.date) {
        this.dom.blogFields.date.value = post.date || "";
        this.dom.blogFields.date.disabled = true;
      }
      if (this.dom.blogFields.seoTitle) {
        this.dom.blogFields.seoTitle.value = post.seoTitle || "";
      }
      if (this.dom.blogFields.seoDescription) {
        this.dom.blogFields.seoDescription.value = post.seoDescription || "";
      }
      if (this.dom.blogFields.author) {
        this.dom.blogFields.author.value = post.author || "specifys.ai Team";
      }

      if (this.blogSubmitButton) {
        this.blogSubmitButton.innerHTML = '<i class="fas fa-save"></i> Save changes';
      }

      this.setBlogFeedback(`Editing ${post.title}`, "success");
      this.dom.blogForm?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      // Failed to load post
      this.setBlogFeedback(error.message || "Failed to load post for editing.", "error");
      this.exitBlogEditMode();
    }
  }

  exitBlogEditMode(options = {}) {
    const { resetForm = false } = options;
    this.editingPost = null;

    if (this.dom.blogFields.slug) {
      this.dom.blogFields.slug.disabled = false;
      delete this.dom.blogFields.slug.dataset.manual;
    }
    if (this.dom.blogFields.date) {
      this.dom.blogFields.date.disabled = false;
      if (!this.dom.blogFields.date.value) {
        this.dom.blogFields.date.value = utils.now().toISOString().slice(0, 10);
      }
    }

    if (resetForm && this.dom.blogForm) {
      this.dom.blogForm.reset();
      if (this.dom.blogFields.date) {
        this.dom.blogFields.date.value = utils.now().toISOString().slice(0, 10);
      }
      if (this.dom.blogFields.author) {
        this.dom.blogFields.author.value = "specifys.ai Team";
      }
      if (this.dom.blogFields.descriptionCount) {
        this.dom.blogFields.descriptionCount.textContent = "0 / 160";
      }
    }

    if (this.blogSubmitButton) {
      this.blogSubmitButton.innerHTML = this.blogSubmitDefaultText;
    }
  }
}

class SpecViewerModal {
  constructor(store, elements) {
    this.store = store;
    this.elements = elements;
    this.currentUserId = null;
    this.debouncedFilter = utils.debounce(this.renderList.bind(this), 150);
    this.init();
  }

  init() {
    if (!this.elements.root) return;
    this.elements.dismissButtons?.forEach((btn) =>
      btn.addEventListener("click", () => this.close())
    );
    this.elements.backdrop?.addEventListener("click", () => this.close());
    this.elements.search?.addEventListener("input", () => {
      this.debouncedFilter();
    });
  }

  open(userId) {
    this.currentUserId = userId;
    if (this.elements.root) {
      this.elements.root.classList.remove("hidden");
    }
    if (this.elements.search) {
      this.elements.search.value = "";
    }
    this.renderList();
  }

  async openWithFetch(userId) {
    await this.preloadSpecs(userId);
    this.open(userId);
  }

  async preloadSpecs(userId) {
    if (this.store.getSpecsForUser(userId).length > 0) return;
    try {
      const q = query(
        collection(db, COLLECTIONS.SPECS),
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(100)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        this.store.upsertSpec(docSnap.id, docSnap.data());
      });
    } catch (error) {
      // Failed to preload specs
    }
  }

  async openWithUser(userId) {
    await this.preloadSpecs(userId);
    this.open(userId);
  }

  close() {
    if (this.elements.root) {
      this.elements.root.classList.add("hidden");
    }
  }

  renderList() {
    if (!this.elements.list || !this.currentUserId) return;
    const specs = this.store.getSpecsForUser(this.currentUserId);
    const searchValue = this.elements.search?.value.trim().toLowerCase() ?? "";
    const filtered = searchValue
      ? specs.filter((spec) => {
          const haystack = `${spec.title} ${spec.content}`.toLowerCase();
          return haystack.includes(searchValue);
        })
      : specs;
    if (!filtered.length) {
      this.elements.list.innerHTML =
        "<div class=\"modal-placeholder\">No specs found for this user.</div>";
      return;
    }

    const html = filtered
      .map((spec) => {
        const preview = (spec.content || "").split(/\s+/).slice(0, 50).join(" ");
        return `
          <article class="spec-item" data-spec-id="${spec.id}">
            <header>
              <h3>${spec.title}</h3>
              <time>${utils.formatDate(spec.createdAt)}</time>
            </header>
            <div class="spec-meta">
              <span>ID: ${spec.id}</span>
              <span>Updated: ${utils.formatRelative(spec.updatedAt)}</span>
                    </div>
            <p class="spec-preview">${preview}…</p>
            <div class="spec-actions">
              <a href="/pages/spec-viewer.html?spec=${spec.id}" target="_blank" rel="noopener">Open viewer</a>
              <a href="/pages/spec.html?id=${spec.id}" target="_blank" rel="noopener">Open editor</a>
            </div>
          </article>
        `;
      })
      .join("");

    this.elements.list.innerHTML = html;
  }
}

class AdminDashboardApp {
  constructor() {
    // New centralized architecture
    this.dataAggregator = new DataAggregator(db);
    this.metricsCalculator = new MetricsCalculator(this.dataAggregator);
    
    // Keep DashboardDataStore for backward compatibility
    this.store = new DashboardDataStore();
    
    this.unsubscribeFns = [];
    this.isActivityPaused = false;
    this.autoRefreshTimer = null;
    this.nextAutoRefreshAt = null;
    this.lastManualRefresh = null; // Track last manual refresh time
    this.syncInProgress = false;
    this.charts = {
      usersPlan: null,
      specsTimeline: null,
      revenueTrend: null,
      usersGrowth: null,
      specsGrowth: null,
      conversionFunnel: null,
      apiResponse: null,
      errorRate: null
    };
    this.activeActivityFilter = "all";
    this.usersCurrentPage = 1;
    this.usersPerPage = 25; // Number of users per page
    this.selectedUsers = new Set(); // For bulk actions
    this.alerts = [];
    this.alertsCurrentPage = 1;
    this.alertsPerPage = 5;
    this.articlesViews = 0;
    this.specsInitialLoad = true; // Track if this is the first load of specs
    this.performanceData = {
      apiResponseTimes: [],
      errorRates: [],
      connections: 0,
      uptime: 100
    };
    this.renderLogsData = []; // Store render logs from API
    
    // Setup data change callbacks
    this.dataAggregator.onDataChange((aggregatedData, source) => {
      // Sync DashboardDataStore with DataAggregator for backward compatibility
      this.syncStoreWithAggregator();
      
      // Mark source as ready
      if (source === 'users') {
        this.markSourceReady('users');
        this.renderUsersTable();
        this.rebuildSearchIndex();
        this.updateOverview();
        this.renderActivityFeed();
      }
      if (source === 'users-error') {
        const error = this.dataAggregator.getSourceError('users');
        this.markSourceError('users', error);
      }
      // Entitlements removed - using user_credits system only
      // if (source === 'entitlements') {
      //   this.markSourceReady('entitlements');
      //   this.renderUsersTable();
      // }
      if (source === 'userCredits') {
        this.markSourceReady('userCredits');
        this.renderUsersTable();
        this.updateOverview();
        this.renderActivityFeed();
      }
      if (source === 'userCredits-restricted') {
        this.markSourceRestricted('userCredits', 'Requires elevated Firebase permissions.');
        // Still render data even if userCredits is restricted - use user.plan as fallback
        this.renderUsersTable();
        this.updateOverview();
        this.renderActivityFeed();
      }
      if (source === 'userCredits-error') {
        const error = this.dataAggregator.getSourceError('userCredits');
        this.markSourceError('userCredits', error);
      }
      if (source === 'specs') {
        this.markSourceReady('specs');
        this.renderUsersTable();
        this.rebuildSearchIndex();
        this.updateOverview();
        this.renderActivityFeed();
        this.renderLogs();
        this.updateStatistics();
        if (this.dom.specUsageTable?.closest('.dashboard-section.active')) {
          this.renderSpecUsageAnalytics();
        }
      }
      if (source === 'specs-error') {
        const error = this.dataAggregator.getSourceError('specs');
        this.markSourceError('specs', error);
      }
      if (source === 'purchases') {
        this.markSourceReady('purchases');
        this.renderPaymentsTable();
        this.updateOverview();
        this.renderLogs();
        this.updateStatistics();
        this.rebuildSearchIndex();
        this.renderActivityFeed();
      }
      if (source === 'purchases-error') {
        const error = this.dataAggregator.getSourceError('purchases');
        this.markSourceError('purchases', error);
      }
      if (source === 'activityLogs') {
        this.markSourceReady('activityLogs');
        this.renderLogs();
        this.renderActivityFeed();
      }
      if (source === 'activityLogs-restricted') {
        this.markSourceRestricted('activityLogs', 'Requires elevated Firebase permissions.');
      }
      if (source === 'activityLogs-error') {
        const error = this.dataAggregator.getSourceError('activityLogs');
        this.markSourceError('activityLogs', error);
      }
      if (source === 'contactSubmissions') {
        this.store.contactSubmissions = aggregatedData.contactSubmissions || [];
        if (this.dom.contactTable?.closest('.dashboard-section.active')) {
          this.renderContactTable();
        }
        this.updateContactBadge();
      }
      if (source === 'contactSubmissions-restricted') {
        this.markSourceRestricted('contactSubmissions', 'Requires elevated Firebase permissions.');
        // Contact submissions are optional - data should still display
      }
      if (source === 'contactSubmissions-error') {
        const error = this.dataAggregator.getSourceError('contactSubmissions');
        this.markSourceError('contactSubmissions', error);
      }
      if (source === 'contactSubmissions-new') {
        // Show notification for new contact submissions
        const newSubmissions = aggregatedData.contactSubmissions.filter(s => s.status === 'new');
        if (newSubmissions.length > 0) {
          this.showContactNotification(newSubmissions.length);
        }
        this.updateContactBadge();
      }
      
      // Update funnel and content analytics when data changes
      if (this.dom.funnelVisualization?.closest('.dashboard-section.active')) {
        this.loadFunnelData();
      }
      if (this.dom.topArticlesList?.closest('.dashboard-section.active')) {
        this.loadContentAnalytics();
      }
    });

    // Sync DashboardDataStore with DataAggregator for backward compatibility
    this.syncStoreWithAggregator = () => {
      const agg = this.dataAggregator.aggregatedData;
      
      // Sync users
      this.store.users.clear();
      agg.users.forEach((user, id) => {
        this.store.users.set(id, user);
      });
      
      // Entitlements removed - using user_credits system only
      
      // Sync specs
      this.store.specs.clear();
      this.store.specsByUser.clear();
      agg.specs.forEach((spec, id) => {
        this.store.specs.set(id, spec);
      });
      agg.specsByUser.forEach((specs, userId) => {
        this.store.specsByUser.set(userId, specs);
      });
      
      // Sync purchases
      this.store.purchases = [...agg.purchases];
      
      // Sync activity logs
      this.store.activity = [...agg.activityLogs];
      
      // Sync contact submissions
      this.store.contactSubmissions = [...(agg.contactSubmissions || [])];
      
      // Sync manual activity (from unified activity events)
      this.store.manualActivity = this.dataAggregator.getActivityEvents()
        .filter(event => !agg.activityLogs.find(log => log.id === event.id));
    };

    this.dom = {
      shell: utils.dom("#admin-shell"),
      navButtons: utils.domAll(".nav-link"),
      sections: utils.domAll(".dashboard-section"),
      statusIndicator: utils.dom("#connection-indicator .dot"),
      statusLabel: utils.dom("#connection-indicator .label"),
      sidebarLastSync: utils.dom("#sidebar-last-sync"),
      topbarStatus: utils.dom("#topbar-sync-status"),
      manualRefresh: utils.dom("#manual-refresh-btn"),
      syncCreditsBtn: utils.dom("#sync-credits-btn"),
      signOut: utils.dom("#sign-out-btn"),
      consoleLogsToggle: utils.dom("#console-logs-toggle"),
      consoleLogsToggleText: utils.dom("#console-logs-toggle-text"),
      overviewRange: utils.dom("#overview-range"),
      overviewMetrics: utils.dom("#overview-metrics"),
      activityFeed: utils.dom("#activity-feed"),
      toggleActivity: utils.dom("#toggle-activity-pause"),
      activityFilterButtons: utils.domAll(".activity-filter-btn"),
      sourceList: utils.dom("#source-status-list"),
      autoRefreshNext: utils.dom("#auto-refresh-next"),
      syncUsersButton: utils.dom("#sync-users-btn"),
      syncUsersSummary: utils.dom("#sync-users-summary"),
      activityDetail: {
        root: utils.dom("#activity-detail"),
        title: utils.dom("#activity-detail-title"),
        close: utils.dom("#activity-detail-close"),
        name: utils.dom("#activity-detail-user"),
        email: utils.dom("#activity-detail-email"),
        userId: utils.dom("#activity-detail-userid"),
        time: utils.dom("#activity-detail-time"),
        context: utils.dom("#activity-detail-context")
      },
      usersSearch: utils.dom("#users-search"),
      usersPlanFilter: utils.dom("#users-plan-filter"),
      usersTable: utils.dom("#users-table tbody"),
      exportUsers: utils.dom("#export-users-btn"),
      usersPagination: utils.dom("#users-pagination"),
      usersPaginationInfo: utils.dom("#users-pagination-info"),
      usersPaginationPrev: utils.dom("#users-pagination-prev"),
      usersPaginationNext: utils.dom("#users-pagination-next"),
      usersPaginationPages: utils.dom("#users-pagination-pages"),
      conversionFunnel: utils.dom("#conversion-funnel"),
      retentionMetrics: utils.dom("#retention-metrics"),
      funnelVisualization: utils.dom("#funnel-visualization"),
      funnelMetrics: utils.dom("#funnel-metrics"),
      funnelRange: utils.dom("#funnel-range"),
      topArticlesList: utils.dom("#top-articles-list"),
      topGuidesList: utils.dom("#top-guides-list"),
      topArticlesSubtitle: utils.dom("#top-articles-subtitle"),
      topGuidesSubtitle: utils.dom("#top-guides-subtitle"),
      contentRange: utils.dom("#content-range"),
      contentType: utils.dom("#content-type"),
      paymentsSearch: utils.dom("#payments-search"),
      paymentsRange: utils.dom("#payments-range"),
      paymentsTable: utils.dom("#payments-table tbody"),
      logsStream: utils.dom("#logs-stream"),
      logsFilter: utils.dom("#logs-filter"),
      blogForm: utils.dom("#blog-form"),
      blogFields: {
        title: utils.dom("#blog-title"),
        date: utils.dom("#blog-date"),
        slug: utils.dom("#blog-slug"),
        seoTitle: utils.dom("#blog-seo-title"),
        seoDescription: utils.dom("#blog-seo-description"),
        description: utils.dom("#blog-description"),
        content: utils.dom("#blog-content"),
        tags: utils.dom("#blog-tags"),
        author: utils.dom("#blog-author"),
        descriptionCount: utils.dom("#blog-description-count")
      },
      blogFeedback: utils.dom("#blog-feedback"),
      blogPreview: utils.dom("#blog-preview-btn"),
      blogQueueList: utils.dom("#blog-queue-list"),
      refreshQueue: utils.dom("#refresh-queue-btn"),
      statsRangeButtons: utils.domAll(".range-btn"),
      statsStartDate: utils.dom("#stats-start-date"),
      statsEndDate: utils.dom("#stats-end-date"),
      metrics: {
        // Chart canvases for metric cards
        usersTotalChart: utils.dom('[data-metric="users-total"]'),
        usersLiveChart: utils.dom('[data-metric="users-live"]'),
        usersProChart: utils.dom('[data-metric="users-pro"]'),
        specsTotalChart: utils.dom('[data-metric="specs-total"]'),
        revenueTotalChart: utils.dom('[data-metric="revenue-total"]'),
        articlesReadChart: utils.dom('[data-metric="articles-read"]'),
        guidesReadChart: utils.dom('[data-metric="guides-read"]')
      },
      metricCharts: {
        usersTotal: null,
        usersLive: null,
        usersPro: null,
        specsTotal: null,
        revenueTotal: null,
        articlesRead: null,
        guidesRead: null
      },
      apiHealth: {
        checkButton: utils.dom("#api-health-check-btn"),
        copyButton: utils.dom("#api-health-copy-btn"),
        responseText: utils.dom("#api-response-text")
      },
      quickActions: {
        addCredits: utils.dom("#quick-action-add-credits"),
        changePlan: utils.dom("#quick-action-change-plan"),
        resetPassword: utils.dom("#quick-action-reset-password"),
        toggleUser: utils.dom("#quick-action-toggle-user"),
        modal: utils.dom("#quick-actions-modal"),
        modalTitle: utils.dom("#quick-actions-title"),
        modalBody: utils.dom("#quick-actions-body")
      },
      usersStatusFilter: utils.dom("#users-status-filter"),
      usersDateFrom: utils.dom("#users-date-from"),
      usersDateTo: utils.dom("#users-date-to"),
      usersSelectAll: utils.dom("#users-select-all"),
      exportUsersPdf: utils.dom("#export-users-pdf-btn"),
      bulkActionsBtn: utils.dom("#bulk-actions-btn"),
      bulkSelectedCount: utils.dom("#bulk-selected-count"),
      bulkActionsModal: utils.dom("#bulk-actions-modal"),
      bulkAddCredits: utils.dom("#bulk-add-credits"),
      bulkChangePlan: utils.dom("#bulk-change-plan"),
      bulkDisableUsers: utils.dom("#bulk-disable-users"),
      alertsList: utils.dom("#alerts-list"),
      alertsSeverityFilter: utils.dom("#alerts-severity-filter"),
      copyAllEmailsBtn: utils.dom("#copy-all-emails-btn"),
      alertsPagination: utils.dom("#alerts-pagination"),
      alertsPaginationInfo: utils.dom("#alerts-pagination-info"),
      alertsPaginationPrev: utils.dom("#alerts-pagination-prev"),
      alertsPaginationNext: utils.dom("#alerts-pagination-next"),
      alertsPaginationPages: utils.dom("#alerts-pagination-pages"),
      markAllReadBtn: utils.dom("#mark-all-read-btn"),
      userActivityModal: utils.dom("#user-activity-modal"),
      userActivityTitle: utils.dom("#user-activity-title"),
      userActivityTimeline: utils.dom("#user-activity-timeline"),
      performanceRange: utils.dom("#performance-range"),
      updateButtons: {
        funnel: utils.dom("#funnel-update-btn"),
        contentAnalytics: utils.dom("#content-analytics-update-btn"),
        alerts: utils.dom("#alerts-update-btn"),
        performance: utils.dom("#performance-update-btn"),
        specUsage: utils.dom("#spec-usage-update-btn"),
        contact: utils.dom("#contact-update-btn")
      },
      performanceMetrics: {
        apiResponse: utils.dom('[data-perf="api-response"]'),
        errorRate: utils.dom('[data-perf="error-rate"]'),
        connections: utils.dom('[data-perf="connections"]'),
        uptime: utils.dom('[data-perf="uptime"]')
      },
      contactTable: utils.dom("#contact-table tbody"),
      contactStatusFilter: utils.dom("#contact-status-filter"),
      contactSearch: utils.dom("#contact-search"),
      exportContacts: utils.dom("#export-contacts-btn"),
      specUsageRange: utils.dom("#spec-usage-range"),
      specUsageSearch: utils.dom("#spec-usage-search"),
      specUsageTable: utils.dom("#spec-usage-table tbody"),
      specUsageSummary: utils.dom("#spec-usage-summary")
    };

    if (this.dom.blogFields.date && !this.dom.blogFields.date.value) {
      this.dom.blogFields.date.value = utils.now().toISOString().slice(0, 10);
    }

    this.blogSubmitButton = this.dom.blogForm?.querySelector("button.primary") || null;
    this.blogSubmitDefaultText = this.blogSubmitButton?.innerHTML || "Publish post";
    this.editingPost = null;

    this.sourceState = {
      users: "pending",
      specs: "pending",
      purchases: "pending",
      activityLogs: "pending",
      blogQueue: "pending"
    };
    this.sourceMessages = {};

    // API Health Check state
    this.apiHealthCheckInProgress = false;

    const specViewerElements = {
      root: utils.dom("#spec-viewer"),
      backdrop: utils.dom("#spec-viewer .modal-backdrop"),
      dismissButtons: utils.domAll('#spec-viewer [data-modal-dismiss]'),
      list: utils.dom("#spec-list"),
      search: utils.dom("#spec-search-input")
    };
    this.specViewer = new SpecViewerModal(this.store, specViewerElements);

    const globalSearchElements = {
      root: utils.dom("#global-search"),
      results: utils.dom("#global-search-results"),
      input: utils.dom("#global-search-input"),
      openTrigger: utils.dom("#global-search-trigger"),
      closeTrigger: utils.dom("#global-search-close"),
      backdrop: utils.dom("#global-search-backdrop"),
      specViewer: this.specViewer
    };
    this.globalSearch = new GlobalSearch(this.store, globalSearchElements);

    this.bindNavigation();
    this.bindInteractions();
    this.setupAuthGate();
  }

  bindNavigation() {
    this.dom.navButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.target;
        if (!target) return;
        this.dom.navButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
        this.dom.sections.forEach((section) => {
          if (section.id === target) {
            section.classList.add("active");
            section.scrollIntoView({ behavior: "smooth", block: "start" });
            // Load contact submissions when contact section is opened
            if (target === "contact-section") {
              this.loadContactSubmissions();
            }
            // Don't auto-load data when sections are opened - user must click Update button
            // This prevents unnecessary API calls
          } else {
            section.classList.remove("active");
          }
        });
      });
    });
    
    // Add scroll spy to update active nav button based on scroll position
    this.setupScrollSpy();
    
    // Setup Update button handlers for manual data loading
    this.setupUpdateButtons();
  }
  
  /**
   * Setup Update button handlers for sections that require manual refresh
   */
  setupUpdateButtons() {
    // Funnel section
    if (this.dom.updateButtons.funnel) {
      this.dom.updateButtons.funnel.addEventListener('click', () => {
        this.loadFunnelData();
      });
    }
    
    // Content Analytics section
    if (this.dom.updateButtons.contentAnalytics) {
      this.dom.updateButtons.contentAnalytics.addEventListener('click', () => {
        this.loadContentAnalytics();
      });
    }
    
    // Alerts section
    if (this.dom.updateButtons.alerts) {
      this.dom.updateButtons.alerts.addEventListener('click', () => {
        this.loadAlerts();
      });
    }
    
    // Performance section
    if (this.dom.updateButtons.performance) {
      this.dom.updateButtons.performance.addEventListener('click', () => {
        this.updatePerformanceMetrics();
      });
    }
    
    // Spec Usage section
    if (this.dom.updateButtons.specUsage) {
      this.dom.updateButtons.specUsage.addEventListener('click', () => {
        this.renderSpecUsageAnalytics();
      });
    }
    
    // Contact section
    if (this.dom.updateButtons.contact) {
      this.dom.updateButtons.contact.addEventListener('click', () => {
        this.loadContactSubmissions();
      });
    }
  }

  /**
   * Setup scroll spy to update active navigation button based on visible section
   */
  setupScrollSpy() {
    let scrollTimeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.updateActiveNavFromScroll();
      }, 100);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    // Also check on initial load
    setTimeout(() => this.updateActiveNavFromScroll(), 500);
  }

  /**
   * Update active navigation button based on which section is currently visible
   */
  updateActiveNavFromScroll() {
    const sections = Array.from(this.dom.sections);
    const scrollPosition = window.scrollY + 200; // Offset for better UX
    
    // Find the section that is currently most visible
    let activeSection = null;
    let maxVisibility = 0;
    
    sections.forEach(section => {
      const rect = section.getBoundingClientRect();
      const sectionTop = rect.top + window.scrollY;
      const sectionBottom = sectionTop + rect.height;
      
      // Calculate how much of the section is visible
      const visibleTop = Math.max(scrollPosition, sectionTop);
      const visibleBottom = Math.min(scrollPosition + window.innerHeight, sectionBottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const visibility = visibleHeight / rect.height;
      
      if (visibility > maxVisibility && scrollPosition >= sectionTop - 100) {
        maxVisibility = visibility;
        activeSection = section;
      }
    });
    
    // Update active nav button
    if (activeSection) {
      const targetId = activeSection.id;
      this.dom.navButtons.forEach((btn) => {
        const btnTarget = btn.dataset.target;
        if (btnTarget === targetId) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
    }
  }

  bindInteractions() {
    this.dom.manualRefresh?.addEventListener("click", () => this.refreshAllData("manual"));
    this.dom.syncUsersButton?.addEventListener("click", () => this.syncUsersManually());
    this.dom.syncCreditsBtn?.addEventListener("click", () => this.syncCreditsManually());
    this.dom.apiHealth.checkButton?.addEventListener("click", () => this.performApiHealthCheck());
    this.dom.apiHealth.copyButton?.addEventListener("click", () => this.copyHealthCheckLogs());
    this.dom.consoleLogsToggle?.addEventListener("click", () => this.toggleConsoleLogs());
    this.dom.signOut?.addEventListener("click", async () => {
      try {
        await signOut(auth);
      } catch (error) {
        // Error signing out
      }
    });
    this.dom.overviewRange?.addEventListener("change", () => this.updateOverview());
    this.dom.toggleActivity?.addEventListener("click", () => this.toggleActivityStream());
    this.dom.usersSearch?.addEventListener("input", utils.debounce(() => {
      this.usersCurrentPage = 1; // Reset to first page on search
      this.renderUsersTable();
    }, 120));
    this.dom.usersPlanFilter?.addEventListener("change", () => {
      this.usersCurrentPage = 1; // Reset to first page on filter change
      this.renderUsersTable();
    });
    this.dom.contactStatusFilter?.addEventListener("change", () => this.loadContactSubmissions());
    this.dom.contactSearch?.addEventListener("input", utils.debounce(() => {
      this.renderContactTable();
    }, 300));
    this.dom.exportContacts?.addEventListener("click", () => this.exportContactsCsv());
    this.dom.specUsageRange?.addEventListener("change", () => this.renderSpecUsageAnalytics());
    this.dom.specUsageSearch?.addEventListener("input", utils.debounce(() => {
      this.renderSpecUsageAnalytics();
    }, 300));
    this.dom.funnelRange?.addEventListener("change", () => this.loadFunnelData());
    this.dom.contentRange?.addEventListener("change", () => this.loadContentAnalytics());
    this.dom.contentType?.addEventListener("change", () => this.loadContentAnalytics());
    this.dom.usersStatusFilter?.addEventListener("change", () => {
      this.usersCurrentPage = 1;
      this.renderUsersTable();
    });
    this.dom.usersDateFrom?.addEventListener("change", () => {
      this.usersCurrentPage = 1;
      this.renderUsersTable();
    });
    this.dom.usersDateTo?.addEventListener("change", () => {
      this.usersCurrentPage = 1;
      this.renderUsersTable();
    });
    this.dom.usersSelectAll?.addEventListener("change", (e) => {
      this.toggleSelectAllUsers(e.target.checked);
    });
    this.dom.exportUsers?.addEventListener("click", () => this.exportUsersCsv());
    this.dom.exportUsersPdf?.addEventListener("click", () => this.exportUsersPdf());
    this.dom.bulkActionsBtn?.addEventListener("click", () => {
      this.dom.bulkActionsModal?.classList.remove("hidden");
    });
    this.dom.quickActions.addCredits?.addEventListener("click", () => this.openQuickAction("add-credits"));
    this.dom.quickActions.changePlan?.addEventListener("click", () => this.openQuickAction("change-plan"));
    this.dom.quickActions.resetPassword?.addEventListener("click", () => this.openQuickAction("reset-password"));
    this.dom.quickActions.toggleUser?.addEventListener("click", () => this.openQuickAction("toggle-user"));
    this.dom.alertsSeverityFilter?.addEventListener("change", () => {
      this.alertsCurrentPage = 1;
      this.renderAlerts();
    });
    this.dom.copyAllEmailsBtn?.addEventListener("click", () => this.copyAllEmails());
    this.dom.markAllReadBtn?.addEventListener("click", () => this.markAllAlertsRead());
    this.dom.alertsPaginationPrev?.addEventListener("click", () => {
      if (this.alertsCurrentPage > 1) {
        this.alertsCurrentPage--;
        this.renderAlerts();
      }
    });
    this.dom.alertsPaginationNext?.addEventListener("click", () => {
      const totalPages = Math.ceil(this.getFilteredAlerts().length / this.alertsPerPage);
      if (this.alertsCurrentPage < totalPages) {
        this.alertsCurrentPage++;
        this.renderAlerts();
      }
    });
    this.dom.performanceRange?.addEventListener("change", () => this.updatePerformanceMetrics());
    this.dom.usersPaginationPrev?.addEventListener("click", () => {
      if (this.usersCurrentPage > 1) {
        this.usersCurrentPage--;
        this.renderUsersTable();
      }
    });
    this.dom.usersPaginationNext?.addEventListener("click", () => {
      this.usersCurrentPage++;
      this.renderUsersTable();
    });
    this.dom.paymentsSearch?.addEventListener("input", utils.debounce(() => this.renderPaymentsTable(), 120));
    this.dom.paymentsRange?.addEventListener("change", () => this.renderPaymentsTable());
    this.dom.logsFilter?.addEventListener("change", () => this.renderLogs());
    const refreshRenderLogsBtn = utils.dom("#refresh-render-logs-btn");
    refreshRenderLogsBtn?.addEventListener("click", () => {
      this.renderLogsData = []; // Clear cache
      this.loadRenderLogs();
    });
    
    // Load render logs when logs section is opened
    const logsNavButton = utils.dom('[data-target="logs-section"]');
    logsNavButton?.addEventListener("click", () => {
      // Load logs if not already loaded
      if (this.renderLogsData.length === 0) {
        this.loadRenderLogs();
      }
    });
    
    // Also check if logs section is already active on page load
    const logsSection = utils.dom("#logs-section");
    if (logsSection?.classList.contains("active")) {
      this.loadRenderLogs();
    }
    if (this.dom.blogFields.description) {
      this.dom.blogFields.description.addEventListener("input", () => {
        const count = this.dom.blogFields.description.value.length;
        if (this.dom.blogFields.descriptionCount) {
          this.dom.blogFields.descriptionCount.textContent = `${count} / 160`;
        }
      });
    }
    this.dom.blogFields.title?.addEventListener("input", () => {
      if (!this.dom.blogFields.slug) return;
      if (!this.dom.blogFields.slug.dataset.manual) {
        this.dom.blogFields.slug.value = utils.sanitizeSlug(
          this.dom.blogFields.title.value || ""
        );
      }
    });
    this.dom.blogFields.slug?.addEventListener("input", () => {
      const currentValue = this.dom.blogFields.slug.value.trim();
      if (currentValue) {
        this.dom.blogFields.slug.dataset.manual = "true";
      } else {
        delete this.dom.blogFields.slug.dataset.manual;
      }
    });
    this.dom.blogForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      this.handleBlogSubmit();
    });
    this.dom.blogPreview?.addEventListener("click", () => this.showBlogPreview());
    this.dom.refreshQueue?.addEventListener("click", async () => {
      try {
        await this.refreshBlogQueue();
        this.setBlogFeedback("Queue refreshed.", "success");
      } catch (error) {
        // refreshBlogQueue already handled feedback/logging when not silent
      }
    });
    this.dom.statsRangeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.dom.statsRangeButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.updateStatistics();
      });
    });
    this.dom.statsStartDate?.addEventListener("change", () => this.updateStatistics());
    this.dom.statsEndDate?.addEventListener("change", () => this.updateStatistics());

    this.dom.activityDetail.close?.addEventListener("click", () => {
      this.hideActivityDetail();
    });
    if (this.dom.activityFilterButtons.length) {
      this.dom.activityFilterButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          this.dom.activityFilterButtons.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          this.activeActivityFilter = btn.dataset.filter || "all";
          this.renderActivityFeed();
        });
            });
        }
    }

  setupAuthGate() {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        this.redirectToLogin();
        return;
      }
      const email = user.email?.toLowerCase();
      if (!email || !ADMIN_EMAILS.has(email)) {
        alert("Access denied. You must be an admin to view this dashboard.");
        this.redirectToLogin();
        return;
      }
      this.currentUser = user;
      await this.start();
    });
  }

  redirectToLogin() {
    window.location.href = "/pages/auth.html";
  }

  async start() {
    this.updateConnectionState("pending", "Connecting…");
    this.initializeCharts();
    await this.subscribeToSources();
    // Initialize auto refresh timer (will schedule for 24h from now if no manual refresh)
    this.updateAutoRefreshTimer();
    await this.fetchUserSyncStatus();
    // Initialize contact badge
    this.updateContactBadge();
    // Initialize console logs toggle
    this.initConsoleLogsToggle();
    // Don't auto-load alerts and performance - user must click Update button
    // This prevents unnecessary API calls and reduces server load
  }

  initializeCharts() {
    const ChartConstructor = ChartLib || window.Chart;
    if (!ChartConstructor) {
      return;
    }

    // Initialize metric cards charts (7-day column charts) first
    this.initializeMetricCharts();

    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      color: "#f5f5f5",
      scales: {
        x: {
          ticks: { color: "#a6a6a6" },
          grid: { color: "rgba(255,255,255,0.06)" }
        },
        y: {
          ticks: { color: "#a6a6a6" },
          grid: { color: "rgba(255,255,255,0.06)" }
        }
      },
      plugins: {
        legend: { display: false }
      }
    };
    const planCtx = document.getElementById("users-plan-chart");
    if (planCtx) {
      this.charts.usersPlan = new ChartConstructor(planCtx, {
        type: "doughnut",
        data: {
          labels: ["Pro", "Free"],
          datasets: [
            {
              data: [0, 0],
              backgroundColor: ["#7f8dff", "#1f1f1f"],
              borderWidth: 0
            }
          ]
        },
        options: {
          cutout: "60%",
          plugins: {
            legend: { position: "bottom", labels: { color: "#a6a6a6" } }
          }
        }
      });
    }
    const specsCtx = document.getElementById("specs-timeline-chart");
    if (specsCtx) {
      this.charts.specsTimeline = new ChartConstructor(specsCtx, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            {
              label: "Specs",
              data: [],
              borderColor: "#7f8dff",
              backgroundColor: "rgba(127,141,255,0.2)",
              tension: 0.3,
              fill: true
            }
          ]
        },
        options: defaultOptions
      });
    }
    const revenueCtx = document.getElementById("revenue-trend-chart");
    if (revenueCtx) {
      this.charts.revenueTrend = new ChartConstructor(revenueCtx, {
        type: "bar",
        data: {
          labels: [],
          datasets: [
            {
              label: "Revenue",
              data: [],
              backgroundColor: "#6bdcff"
            }
          ]
        },
        options: defaultOptions
      });
    }
    const usersGrowthCtx = document.getElementById("users-growth-chart");
    if (usersGrowthCtx) {
      this.charts.usersGrowth = new ChartConstructor(usersGrowthCtx, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            {
              label: "Users",
              data: [],
              borderColor: "#ff6b35",
              backgroundColor: "rgba(255, 107, 53, 0.2)",
              tension: 0.3,
              fill: true
            }
          ]
        },
        options: {
          ...defaultOptions,
          plugins: {
            legend: { display: true, position: "top", labels: { color: "#a6a6a6" } }
          }
        }
      });
    }
    const specsGrowthCtx = document.getElementById("specs-growth-chart");
    if (specsGrowthCtx) {
      this.charts.specsGrowth = new ChartConstructor(specsGrowthCtx, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            {
              label: "Specs",
              data: [],
              borderColor: "#7f8dff",
              backgroundColor: "rgba(127,141,255,0.2)",
              tension: 0.3,
              fill: true
            }
          ]
        },
        options: {
          ...defaultOptions,
          plugins: {
            legend: { display: true, position: "top", labels: { color: "#a6a6a6" } }
          }
        }
      });
    }
  }

  /**
   * Initialize metric cards charts (7-day column charts)
   */
  initializeMetricCharts() {
    const ChartConstructor = ChartLib || window.Chart;
    if (!ChartConstructor) {
      return;
    }

    const chartOptions = {
      type: 'bar',
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 8,
            titleFont: { size: 12 },
            bodyFont: { size: 11 },
            cornerRadius: 4
          }
        },
        scales: {
          x: {
            display: true,
            grid: { display: false },
            ticks: {
              font: { size: 10 },
              color: '#6b7280',
              maxRotation: 0,
              autoSkip: false
            }
          },
          y: {
            display: true,
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
              drawBorder: false
            },
            ticks: {
              font: { size: 10 },
              color: '#6b7280',
              precision: 0,
              stepSize: 1
            }
          }
        }
      }
    };

    // Initialize all metric charts with empty data (will be populated in updateOverview)
    const metrics = [
      { metric: 'users-total', key: 'usersTotal' },
      { metric: 'users-live', key: 'usersLive' },
      { metric: 'users-pro', key: 'usersPro' },
      { metric: 'specs-total', key: 'specsTotal' },
      { metric: 'revenue-total', key: 'revenueTotal' },
      { metric: 'articles-read', key: 'articlesRead' },
      { metric: 'guides-read', key: 'guidesRead' }
    ];
    metrics.forEach(({ metric, key }) => {
      const canvas = document.querySelector(`[data-metric="${metric}"]`);
      if (canvas) {
        this.dom.metricCharts[key] = new ChartConstructor(canvas, {
          ...chartOptions,
          data: {
            labels: this.getLast7DaysLabels(),
            datasets: [{
              label: metric,
              data: new Array(7).fill(0),
              backgroundColor: this.getMetricColor(metric),
              borderRadius: 4,
              borderSkipped: false
            }]
          }
        });
      }
    });
  }

  /**
   * Get labels for last 7 days
   */
  getLast7DaysLabels() {
    const labels = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = date.getDate();
      labels.push(`${dayName} ${dayNum}`);
    }
    return labels;
  }

  /**
   * Get color for metric chart
   */
  getMetricColor(metric) {
    const colors = {
      'users-total': 'rgba(59, 130, 246, 0.8)',
      'users-live': 'rgba(16, 185, 129, 0.8)',
      'users-pro': 'rgba(139, 92, 246, 0.8)',
      'specs-total': 'rgba(245, 158, 11, 0.8)',
      'revenue-total': 'rgba(34, 197, 94, 0.8)',
      'articles-read': 'rgba(239, 68, 68, 0.8)',
      'guides-read': 'rgba(6, 182, 212, 0.8)'
    };
    return colors[metric] || 'rgba(107, 114, 128, 0.8)';
  }

  /**
   * Calculate daily data for last 7 days
   */
  calculateDailyData(dataArray, dateField = 'createdAt', valueField = null) {
    const dailyData = new Array(7).fill(0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    dataArray.forEach(item => {
      const itemDate = item[dateField];
      if (!itemDate) return;
      
      const date = new Date(itemDate);
      date.setHours(0, 0, 0, 0);
      const daysAgo = Math.floor((today - date) / (1000 * 60 * 60 * 24));
      
      if (daysAgo >= 0 && daysAgo < 7) {
        const value = valueField ? (item[valueField] || 0) : 1;
        dailyData[6 - daysAgo] += value;
      }
    });
    
    return dailyData;
  }

  /**
   * Calculate daily users data
   */
  calculateDailyUsers() {
    const users = Array.from(this.store.users.values());
    return this.calculateDailyData(users, 'createdAt');
  }

  /**
   * Calculate daily specs data
   */
  calculateDailySpecs() {
    const specs = Array.from(this.store.specs.values());
    return this.calculateDailyData(specs, 'createdAt');
  }

  /**
   * Calculate daily revenue data
   */
  calculateDailyRevenue() {
    const purchases = this.store.purchases || [];
    return this.calculateDailyData(purchases, 'createdAt', 'total');
  }

  /**
   * Calculate daily articles views (from analytics API)
   */
  async calculateDailyArticlesViews() {
    try {
      if (!window.api) {
        return new Array(7).fill(0);
      }
      const response = await window.api.get('/api/analytics/content-stats?range=week');
      if (response && response.success) {
        // For now, return evenly distributed data (will be enhanced with actual daily breakdown)
        const total = response.stats.articlesViewsInRange || 0;
        return new Array(7).fill(Math.floor(total / 7));
      }
    } catch (error) {
      // Failed to load daily articles views
    }
    return new Array(7).fill(0);
  }

  /**
   * Calculate daily guides views (from analytics API)
   */
  async calculateDailyGuidesViews() {
    try {
      if (!window.api) {
        return new Array(7).fill(0);
      }
      const response = await window.api.get('/api/analytics/content-stats?range=week');
      if (response && response.success) {
        // For now, return evenly distributed data (will be enhanced with actual daily breakdown)
        const total = response.stats.guidesViewsInRange || 0;
        return new Array(7).fill(Math.floor(total / 7));
      }
    } catch (error) {
      // Failed to load daily guides views
    }
    return new Array(7).fill(0);
  }

  async subscribeToSources() {
    // Use new DataAggregator instead of old Firebase listeners
    this.dataAggregator.unsubscribeAll();
    this.dataAggregator.reset();
    this.store.reset();
    this.specsInitialLoad = true; // Reset for reconnection
    this.updateAllSources("pending");

    // Subscribe to all data sources via DataAggregator
    try {
      this.dataAggregator.subscribeAll();
      // Entitlements removed from UI - using user_credits system now
      
      // Mark sources as ready when data arrives (handled by callbacks in constructor)
      // The callbacks will handle marking sources ready and updating UI
      
    } catch (error) {
      console.error('[AdminDashboard] Failed to subscribe to data sources:', error);
      // Mark all sources as error if subscription fails completely
      this.updateAllSources("error");
    }

    // Blog queue (via API)
    try {
      await this.refreshBlogQueue({ silent: true });
      this.markSourceReady("blogQueue");
        } catch (error) {
      if (error?.status === 403) {
        this.markSourceRestricted("blogQueue", "Requires blog queue privileges.");
      } else if (error?.status === 401) {
        this.markSourceError("blogQueue", "Authentication required.");
      } else {
        this.markSourceError("blogQueue", error);
      }
    }
  }

  updateAllSources(state) {
    Object.keys(this.sourceState).forEach((key) => {
      this.sourceState[key] = state;
    });
    this.renderSourceStates();
  }

  markSourceReady(key) {
    this.sourceState[key] = "ready";
    this.renderSourceStates();
    this.updateConnectionStatus();
  }

  markSourceError(key, error) {
    this.sourceState[key] = "error";
    this.renderSourceStates();
    if (error) {
      // Store error message for display
      const errorMessage = error?.message || error?.code || String(error || 'Unknown error');
      this.sourceMessages[key] = errorMessage;
      console.error(`[AdminDashboard] Source error for ${key}:`, error);
    }
    this.updateConnectionStatus();
  }

  markSourceRestricted(key, message) {
    this.sourceState[key] = "restricted";
    if (message) {
      this.sourceMessages[key] = message;
    }
    this.renderSourceStates();
    this.updateConnectionStatus();
  }

  renderSourceStates() {
    if (!this.dom.sourceList) return;
    this.dom.sourceList.querySelectorAll(".source-state").forEach((el) => {
      const key = el.dataset.source;
      const state = this.sourceState[key] || "pending";
      let label = state;
      if (state === "ready") label = "Ready";
      if (state === "pending") label = "Pending";
      if (state === "error") label = "Error";
      if (state === "restricted") label = "Restricted";
      el.textContent = label;
      el.title = this.sourceMessages[key] || "";
      el.classList.remove("ready", "error", "restricted");
      if (state === "ready") el.classList.add("ready");
      if (state === "error") el.classList.add("error");
      if (state === "restricted") el.classList.add("restricted");
    });
  }

  updateConnectionStatus() {
    const states = Object.values(this.sourceState);
    if (states.every((state) => state === "ready" || state === "restricted")) {
      this.updateConnectionState("online", "Realtime sync active");
      const now = utils.now();
      if (this.dom.sidebarLastSync) {
        this.dom.sidebarLastSync.textContent = utils.formatDate(now);
      }
    } else if (states.some((state) => state === "error")) {
      this.updateConnectionState("offline", "Connection issues detected");
    } else {
      this.updateConnectionState("pending", "Connecting…");
    }
  }

  updateConnectionState(state, label) {
    if (this.dom.statusIndicator) {
      this.dom.statusIndicator.classList.remove(
        "status-online",
        "status-offline",
        "status-pending"
      );
      this.dom.statusIndicator.classList.add(
        state === "online"
          ? "status-online"
          : state === "offline"
          ? "status-offline"
          : "status-pending"
      );
    }
    if (this.dom.statusLabel) {
      this.dom.statusLabel.textContent = label;
    }
    if (this.dom.topbarStatus) {
      this.dom.topbarStatus.textContent = label;
    }
  }

  toggleActivityStream() {
    this.isActivityPaused = !this.isActivityPaused;
    if (this.dom.toggleActivity) {
      const icon = this.dom.toggleActivity.querySelector("i");
      if (icon) {
        icon.classList.toggle("fa-pause", !this.isActivityPaused);
        icon.classList.toggle("fa-play", this.isActivityPaused);
      }
      this.dom.toggleActivity.innerHTML = `
        <i class="fas ${this.isActivityPaused ? "fa-play" : "fa-pause"}"></i>
        ${this.isActivityPaused ? "Resume stream" : "Pause stream"}
      `;
    }
  }

  renderUsersTable() {
    if (!this.dom.usersTable) return;
    const searchTerm = this.dom.usersSearch?.value.trim().toLowerCase() ?? "";
    const planFilter = this.dom.usersPlanFilter?.value ?? "all";
    const statusFilter = this.dom.usersStatusFilter?.value ?? "all";
    const dateFrom = this.dom.usersDateFrom?.value;
    const dateTo = this.dom.usersDateTo?.value;
    const filteredUsers = [];

    // First, filter users
    for (const user of this.store.getUsersSorted()) {
      if (searchTerm) {
        const haystack = [user.email, user.displayName, user.id].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(searchTerm)) continue;
      }
      if (planFilter !== "all" && (user.plan || "free") !== planFilter) continue;
      
      // Status filter (active/inactive based on lastActive)
      if (statusFilter !== "all") {
        const now = Date.now();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        const isActive = user.lastActive && user.lastActive.getTime() >= thirtyDaysAgo;
        if (statusFilter === "active" && !isActive) continue;
        if (statusFilter === "inactive" && isActive) continue;
      }
      
      // Date filters
      if (dateFrom && user.createdAt) {
        const userDate = new Date(user.createdAt);
        const fromDate = new Date(dateFrom);
        if (userDate < fromDate) continue;
      }
      if (dateTo && user.createdAt) {
        const userDate = new Date(user.createdAt);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999); // End of day
        if (userDate > toDate) continue;
      }
      
      filteredUsers.push(user);
    }

    // Calculate pagination
    const totalUsers = filteredUsers.length;
    const totalPages = Math.max(1, Math.ceil(totalUsers / this.usersPerPage));
    
    // Ensure current page is valid
    if (this.usersCurrentPage > totalPages) {
      this.usersCurrentPage = totalPages;
    }
    if (this.usersCurrentPage < 1) {
      this.usersCurrentPage = 1;
    }

    // Get users for current page
    const startIndex = (this.usersCurrentPage - 1) * this.usersPerPage;
    const endIndex = Math.min(startIndex + this.usersPerPage, totalUsers);
    const usersForPage = filteredUsers.slice(startIndex, endIndex);

    // Build rows for current page
    const rows = [];
    for (const user of usersForPage) {
      // Use new user_credits system instead of old entitlements
      const userCredits = this.dataAggregator.aggregatedData.userCredits.get(user.id);
      const specCount = this.store.getSpecCount(user.id);
      
      // Determine plan: check user_credits subscription first (source of truth), then user.plan, then default to free
      let userPlan = "free";
      
      if (userCredits) {
        // user_credits is the source of truth for subscription status
        // Check subscription type and status directly from metadata
        const subscriptionType = userCredits.metadata?.subscription?.type;
        const subscriptionStatus = userCredits.metadata?.subscription?.status;
        
        if (subscriptionType === 'pro' && subscriptionStatus === 'active') {
          userPlan = "pro";
        } else if (userCredits.unlimited) {
          // Fallback: if unlimited is true, user has Pro (backward compatibility)
          userPlan = "pro";
        } else if (user.plan) {
          // Fallback to user.plan if user_credits doesn't have subscription info
          userPlan = (user.plan || "free").toLowerCase();
        }
      } else if (user.plan) {
        // If no user_credits data, use user.plan
        userPlan = (user.plan || "free").toLowerCase();
      }
      const planDisplay = userPlan === "pro" ? "Pro" : "Free";
      const planBadge = `<span class="badge ${userPlan}">${planDisplay}</span>`;
      
      // Calculate credits: use new user_credits system only
      let credits = "—";
      
      if (userCredits) {
        // New system - use user_credits
        if (userCredits.unlimited) {
          credits = "Unlimited";
        } else {
          credits = userCredits.total || 0;
        }
      } else {
        // If no credits info found, default to 0 for display
        credits = 0;
      }
      const isSelected = this.selectedUsers.has(user.id);
      const userEmail = user.email || "";
      const userName = user.displayName || "";
      rows.push(`
        <tr data-user-id="${user.id}">
          <td>
            <input type="checkbox" data-user-id="${user.id}" ${isSelected ? "checked" : ""}>
          </td>
          <td class="user-cell">
            ${userName ? `<div class="user-name">${userName}</div>` : ""}
            <div class="user-email">${userEmail || user.id || "No email"}</div>
          </td>
          <td>${utils.formatDate(user.createdAt)}</td>
          <td class="plan-cell">${planBadge}</td>
          <td class="specs-cell">${utils.formatNumber(specCount)}</td>
          <td class="credits-cell">${credits}</td>
          <td class="last-active-cell">${utils.formatRelative(user.lastActive)}</td>
          <td class="actions-cell">
            <div class="table-actions-compact">
              <button class="table-action-btn-icon" data-action="view-specs" data-user-id="${user.id}" title="View specs">
                <i class="fas fa-file-alt"></i>
              </button>
              ${userEmail ? `<button class="table-action-btn-icon" data-action="copy-email" data-email="${userEmail}" title="Copy email">
                <i class="fas fa-copy"></i>
              </button>` : ""}
              <button class="table-action-btn-icon btn-danger" data-action="delete-user" data-user-id="${user.id}" data-user-email="${userEmail || user.id}" title="Delete user">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `);
    }

    // Render table
    if (!rows.length) {
      this.dom.usersTable.innerHTML = `<tr><td colspan="8" class="table-empty">No users match the filter.</td></tr>`;
      if (this.dom.usersPagination) {
        this.dom.usersPagination.style.display = "none";
      }
    } else {
      this.dom.usersTable.innerHTML = rows.join("");
      this.renderUsersPagination(totalUsers, totalPages, startIndex + 1, endIndex);
      
      // Bind checkbox events
      this.dom.usersTable.querySelectorAll('input[type="checkbox"][data-user-id]').forEach(checkbox => {
        checkbox.addEventListener("change", (e) => {
          const userId = checkbox.dataset.userId;
          if (e.target.checked) {
            this.selectedUsers.add(userId);
          } else {
            this.selectedUsers.delete(userId);
          }
          this.updateBulkActionsUI();
          // Update select all checkbox
          if (this.dom.usersSelectAll) {
            const allChecked = Array.from(this.dom.usersTable.querySelectorAll('input[type="checkbox"][data-user-id]')).every(cb => cb.checked);
            this.dom.usersSelectAll.checked = allChecked;
          }
        });
      });
    }

    this.dom.usersTable
      .querySelectorAll('[data-action="view-specs"]')
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          const userId = btn.dataset.userId;
          if (!userId) return;
          await this.specViewer.openWithUser(userId);
        });
      });

    this.dom.usersTable
      .querySelectorAll('[data-action="copy-email"]')
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const email = btn.dataset.email;
          if (!email) return;
          navigator.clipboard?.writeText(email);
          btn.classList.add("copied");
          setTimeout(() => btn.classList.remove("copied"), 1000);
        });
      });

    this.dom.usersTable
      .querySelectorAll('[data-action="delete-user"]')
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          const userId = btn.dataset.userId;
          const userEmail = btn.dataset.userEmail;
          if (!userId) return;
          
          // Confirm deletion
          const confirmMessage = `Are you sure you want to permanently delete this user?\n\nUser: ${userEmail}\n\nThis will delete:\n- User account from Firebase Auth\n- All user data from Firestore\n- All specs, apps, and market research\n- All subscriptions and credits\n\nThis action cannot be undone!`;
          
          if (!confirm(confirmMessage)) {
            return;
          }
          
          // Double confirmation
          if (!confirm(`Final confirmation: Delete user ${userEmail}?\n\nThis action is PERMANENT and cannot be undone.`)) {
            return;
          }
          
          // Disable button and show loading state
          btn.disabled = true;
          const originalHTML = btn.innerHTML;
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
          
          try {
            const response = await window.api.delete(`/api/admin/users/${userId}`);
            
            if (response.success) {
              // Show success message
              alert(`User ${userEmail} has been permanently deleted.`);
              
              // Remove user from local store
              this.store.removeUser(userId);
              
              // Remove the row from the table
              const row = btn.closest('tr[data-user-id]');
              if (row) {
                row.remove();
                // Update pagination if needed
                this.renderUsersTable();
              }
              
              // Refresh data
              await this.dataAggregator.refresh();
            } else {
              throw new Error(response.error || response.message || 'Failed to delete user');
            }
          } catch (error) {
            console.error('Error deleting user:', error);
            alert(`Failed to delete user: ${error.message}`);
            btn.disabled = false;
            btn.innerHTML = originalHTML;
          }
        });
      });
  }

  renderUsersPagination(totalUsers, totalPages, startIndex, endIndex) {
    if (!this.dom.usersPagination) return;

    // Show pagination if there are multiple pages
    if (totalPages <= 1) {
      this.dom.usersPagination.style.display = "none";
      return;
    }

    this.dom.usersPagination.style.display = "flex";

    // Update info text
    if (this.dom.usersPaginationInfo) {
      this.dom.usersPaginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${totalUsers}`;
    }

    // Update prev/next buttons
    if (this.dom.usersPaginationPrev) {
      this.dom.usersPaginationPrev.disabled = this.usersCurrentPage === 1;
    }
    if (this.dom.usersPaginationNext) {
      this.dom.usersPaginationNext.disabled = this.usersCurrentPage >= totalPages;
    }

    // Render page numbers
    if (this.dom.usersPaginationPages) {
      const pages = [];
      const maxVisiblePages = 7; // Show up to 7 page numbers
      let startPage = Math.max(1, this.usersCurrentPage - Math.floor(maxVisiblePages / 2));
      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      // Adjust start if we're near the end
      if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }

      // Add first page and ellipsis if needed
      if (startPage > 1) {
        pages.push(`<button class="pagination-page-btn" data-page="1">1</button>`);
        if (startPage > 2) {
          pages.push(`<span class="pagination-ellipsis">…</span>`);
        }
      }

      // Add page numbers
      for (let i = startPage; i <= endPage; i++) {
        const isActive = i === this.usersCurrentPage;
        pages.push(
          `<button class="pagination-page-btn ${isActive ? "active" : ""}" data-page="${i}">${i}</button>`
        );
      }

      // Add last page and ellipsis if needed
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pages.push(`<span class="pagination-ellipsis">…</span>`);
        }
        pages.push(`<button class="pagination-page-btn" data-page="${totalPages}">${totalPages}</button>`);
      }

      this.dom.usersPaginationPages.innerHTML = pages.join("");

      // Add click handlers for page buttons
      this.dom.usersPaginationPages
        .querySelectorAll(".pagination-page-btn")
        .forEach((btn) => {
          btn.addEventListener("click", () => {
            const page = parseInt(btn.dataset.page);
            if (page && page !== this.usersCurrentPage) {
              this.usersCurrentPage = page;
              this.renderUsersTable();
              // Scroll to top of table
              this.dom.usersTable?.closest(".table-wrapper")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          });
        });
    }
  }

  renderPaymentsTable() {
    if (!this.dom.paymentsTable) return;
    const searchTerm = this.dom.paymentsSearch?.value.trim().toLowerCase() ?? "";
    const range = this.dom.paymentsRange?.value ?? "week";
    const payments = this.store.getPurchases(range);
    const rows = [];

    for (const purchase of payments) {
        if (searchTerm) {
        const haystack = `${purchase.email} ${purchase.productName} ${purchase.productType}`.toLowerCase();
        if (!haystack.includes(searchTerm)) continue;
      }
      rows.push(`
        <tr>
          <td>${utils.formatDate(purchase.createdAt)}</td>
          <td>${purchase.email || purchase.userId || "Unknown user"}</td>
          <td>${purchase.productName}</td>
          <td>${utils.formatCurrency(purchase.total, purchase.currency)}</td>
          <td>${purchase.productType}</td>
          <td>${purchase.status}</td>
        </tr>
      `);
    }

    this.dom.paymentsTable.innerHTML = rows.length
      ? rows.join("")
      : `<tr><td colspan="6" class="table-empty">No payments in this range.</td></tr>`;
  }

  async renderLogs() {
    if (!this.dom.logsStream) return;
    
    // Load render logs from API if not already loaded or if section is active
    const logsSection = this.dom.logsStream.closest('.dashboard-section');
    if (logsSection?.classList.contains('active') && this.renderLogsData.length === 0) {
      await this.loadRenderLogs();
    }
    
    const filter = this.dom.logsFilter?.value ?? "all";
    
    // Combine activity events and render logs
    const events = this.store.getActivityMerged();
    const renderLogs = this.renderLogsData.map(log => ({
      id: log.id,
      type: log.level?.toLowerCase() || 'server',
      title: log.message || 'Server log',
      description: this.formatRenderLogDescription(log),
      timestamp: log.timestamp ? (log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp)) : new Date(),
      userId: log.userId,
      userEmail: log.userEmail,
      level: log.level,
      path: log.path,
      method: log.method,
      statusCode: log.statusCode,
      errorStack: log.errorStack
    }));
    
    const allLogs = [...renderLogs, ...events];
    
    // Sort by timestamp (newest first)
    allLogs.sort((a, b) => {
      const timeA = a.timestamp?.getTime() || 0;
      const timeB = b.timestamp?.getTime() || 0;
      return timeB - timeA;
    });
    
    const filtered = filter === "all" 
      ? allLogs 
      : allLogs.filter((log) => {
          if (filter === 'error' || filter === 'warn') {
            return log.level?.toLowerCase() === filter || log.type === filter;
          }
          return log.type === filter;
        });

    if (!filtered.length) {
      this.dom.logsStream.innerHTML = `<div class="logs-placeholder">No log events yet.</div>`;
      return;
    }

    const html = filtered
      .slice(0, 100) // Limit to 100 most recent logs
      .map(
        (log) => {
          const userInfo = log.userEmail 
            ? `<span class="log-user">${log.userEmail}</span>` 
            : log.userId 
            ? `<span class="log-user">User: ${log.userId.substring(0, 8)}...</span>` 
            : '';
          const pathInfo = log.path ? `<span class="log-path">${log.method || ''} ${log.path}</span>` : '';
          const levelClass = (log.level || log.type || '').toLowerCase();
          
          return `
            <article class="log-entry ${log.type} ${levelClass}" data-log-id="${log.id || ''}">
              <header>
                ${log.title || 'Server log'}
                ${userInfo}
                ${pathInfo}
              </header>
              <div>${log.description || ""}</div>
              ${log.errorStack ? `<details class="log-stack"><summary>Stack trace</summary><pre>${utils.escapeHtml(log.errorStack)}</pre></details>` : ''}
              <footer class="log-meta">
                <span class="log-level">${(log.level || log.type || 'INFO').toUpperCase()}</span>
                <time>${utils.formatDate(log.timestamp)}</time>
              </footer>
            </article>
          `;
        }
      )
      .join("");
    if (!this.isActivityPaused) {
      this.dom.logsStream.innerHTML = html;
    }
  }
  
  formatRenderLogDescription(log) {
    let desc = '';
    if (log.errorName) {
      desc += `<strong>${utils.escapeHtml(log.errorName)}</strong>: `;
    }
    if (log.errorCode) {
      desc += `[${utils.escapeHtml(log.errorCode)}] `;
    }
    if (log.statusCode) {
      desc += `HTTP ${log.statusCode} `;
    }
    if (log.requestId) {
      desc += `Request ID: ${log.requestId.substring(0, 8)}... `;
    }
    return desc || log.message || 'Server log entry';
  }
  
  async loadRenderLogs() {
    try {
      if (!window.api) {
        console.warn('[admin-dashboard] API client not available');
        return;
      }
      
      // Load last 100 render logs
      const response = await window.api.get('/api/admin/render-logs?limit=100');
      if (response && response.success && response.logs) {
        this.renderLogsData = response.logs;
        // Re-render logs section
        this.renderLogs();
      }
    } catch (error) {
      console.error('[admin-dashboard] Failed to load render logs:', error);
      // Don't show error to user, just log it
    }
  }

  async updateOverview() {
    const overviewRange = this.dom.overviewRange?.value ?? "week";
    
    // Calculate daily data for last 7 days
    const dailyUsers = this.calculateDailyUsers();
    const dailySpecs = this.calculateDailySpecs();
    const dailyRevenue = this.calculateDailyRevenue();
    const dailyArticles = await this.calculateDailyArticlesViews();
    const dailyGuides = await this.calculateDailyGuidesViews();
    
    // Calculate pro users daily (users with pro plan created each day)
    const users = Array.from(this.store.users.values());
    const dailyProUsers = new Array(7).fill(0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    users.forEach(user => {
      if (user.plan === 'pro' && user.createdAt) {
        const date = new Date(user.createdAt);
        date.setHours(0, 0, 0, 0);
        const daysAgo = Math.floor((today - date) / (1000 * 60 * 60 * 24));
        if (daysAgo >= 0 && daysAgo < 7) {
          dailyProUsers[6 - daysAgo]++;
        }
      }
    });
    
    // Calculate live users (active in last 15 min) - simplified to show current count
    const liveUsersCount = this.metricsCalculator.calculateOverviewMetrics(overviewRange).liveUsers;
    const dailyLiveUsers = new Array(7).fill(0);
    dailyLiveUsers[6] = liveUsersCount; // Show current live users in today's column
    
    // Update metric charts
    this.updateMetricChart('usersTotal', dailyUsers);
    this.updateMetricChart('usersLive', dailyLiveUsers);
    this.updateMetricChart('usersPro', dailyProUsers);
    this.updateMetricChart('specsTotal', dailySpecs);
    this.updateMetricChart('revenueTotal', dailyRevenue);
    this.updateMetricChart('articlesRead', dailyArticles);
    this.updateMetricChart('guidesRead', dailyGuides);

    this.renderActivityFeed();
    this.updateCharts();
  }

  /**
   * Update a metric chart with new data
   */
  updateMetricChart(chartKey, data) {
    const chart = this.dom.metricCharts[chartKey];
    if (chart && Array.isArray(data)) {
      chart.data.datasets[0].data = data;
      chart.update('none'); // Update without animation for better performance
    }
  }

  // Deprecated: Use MetricsCalculator.calculateContentStats() instead
  // Kept for backward compatibility
  async loadContentStats(range) {
    const apiBaseUrl = this.getApiBaseUrl();
    const contentStats = await this.metricsCalculator.calculateContentStats(range, apiBaseUrl);
    
    // Update articles views
    if (this.dom.metrics.articlesRead) {
      this.dom.metrics.articlesRead.textContent = utils.formatNumber(contentStats.articlesViewsInRange);
    }
    if (this.dom.metrics.articlesReadRange) {
      this.dom.metrics.articlesReadRange.textContent = `Total: ${utils.formatNumber(contentStats.articlesViews)}`;
    }
    
    // Update guides reads
    if (this.dom.metrics.guidesRead) {
      this.dom.metrics.guidesRead.textContent = utils.formatNumber(contentStats.guidesViewsInRange);
    }
    if (this.dom.metrics.guidesReadRange) {
      this.dom.metrics.guidesReadRange.textContent = `Total: ${utils.formatNumber(contentStats.guidesViews)}`;
    }
  }

  getApiBaseUrl() {
    // Use the global getApiBaseUrl function from config.js if available
    if (typeof window.getApiBaseUrl === "function") {
      return window.getApiBaseUrl();
    }
    // Fallback to Render URL (same as config.js)
    return "https://specifys-ai-development.onrender.com";
  }

  renderActivityFeed() {
    if (!this.dom.activityFeed) return;
    
    // Use MetricsCalculator for unified activity feed - same source as Live Overview
    const filter = this.activeActivityFilter || "all";
    const events = this.metricsCalculator.calculateActivityFeed(filter);
    
    if (!events.length) {
      this.dom.activityFeed.innerHTML = `<li class="activity-placeholder">Waiting for events…</li>`;
      return;
    }
    
    const html = events.slice(0, 20).map((event) => {
      const user = event.meta?.userId ? this.store.getUser(event.meta.userId) : null;
      const userEmail = event.meta?.email || event.meta?.userEmail || user?.email || "";
      const userName = event.meta?.userName || user?.displayName || user?.email || event.meta?.userId || "Unknown user";
      const emailBadge = userEmail ? `<span class="activity-badge">${userEmail}</span>` : "";
      const icon = this.getActivityIcon(event.type);
      return `
        <li class="activity-item ${event.type}" data-activity-id="${event.id}">
          <span class="activity-icon"><i class="${icon}"></i></span>
          <div class="activity-item__info">
            <span class="activity-item__title">${event.title}</span>
            <span class="activity-item__meta">${userName} ${emailBadge}</span>
          </div>
          <time>${utils.formatRelative(event.timestamp)}</time>
        </li>
      `;
    }).join("");
    if (!this.isActivityPaused) {
      this.dom.activityFeed.innerHTML = html;
      this.dom.activityFeed.querySelectorAll(".activity-item").forEach((item) => {
        item.addEventListener("click", () => {
          const id = item.dataset.activityId;
          if (id) {
            this.toggleActivityDetail(id, item);
          }
        });
      });
    }
  }

  updateCharts() {
    const users = this.store.getUsersSorted();
    // Pro users - check user_credits subscription (source of truth)
    const proUsers = users.filter((user) => {
      const userCredits = this.dataAggregator.aggregatedData.userCredits.get(user.id);
      if (userCredits) {
        const subscriptionType = userCredits.metadata?.subscription?.type;
        const subscriptionStatus = userCredits.metadata?.subscription?.status;
        return (subscriptionType === 'pro' && subscriptionStatus === 'active') || userCredits.unlimited;
      }
      return user.plan === "pro";
    }).length;
    const freeUsers = users.length - proUsers;
    if (this.charts.usersPlan) {
      this.charts.usersPlan.data.datasets[0].data = [proUsers, freeUsers];
      this.charts.usersPlan.update();
    }

    const specsByDay = new Map();
    this.store.specs.forEach((spec) => {
      const date = spec.createdAt
        ? spec.createdAt.toISOString().slice(0, 10)
        : "Unknown";
      specsByDay.set(date, (specsByDay.get(date) || 0) + 1);
    });
    const specsLabels = Array.from(specsByDay.keys()).sort();
    const specsValues = specsLabels.map((label) => specsByDay.get(label));
    if (this.charts.specsTimeline) {
      this.charts.specsTimeline.data.labels = specsLabels;
      this.charts.specsTimeline.data.datasets[0].data = specsValues;
      this.charts.specsTimeline.update();
    }

    const revenueByDay = new Map();
    this.store.purchases.forEach((purchase) => {
      const date = purchase.createdAt
        ? purchase.createdAt.toISOString().slice(0, 10)
        : "Unknown";
      revenueByDay.set(date, (revenueByDay.get(date) || 0) + (purchase.total || 0));
    });
    const revenueLabels = Array.from(revenueByDay.keys()).sort();
    const revenueValues = revenueLabels.map((label) => Number(revenueByDay.get(label).toFixed(2)));
    if (this.charts.revenueTrend) {
      this.charts.revenueTrend.data.labels = revenueLabels;
      this.charts.revenueTrend.data.datasets[0].data = revenueValues;
      this.charts.revenueTrend.update();
    }

    // Users growth chart - cumulative users over time
    const usersByDay = new Map();
    users.forEach((user) => {
      if (user.createdAt) {
        const date = user.createdAt.toISOString().slice(0, 10);
        usersByDay.set(date, (usersByDay.get(date) || 0) + 1);
      }
    });
    const usersLabels = Array.from(usersByDay.keys()).sort();
    // Calculate cumulative values
    let cumulativeUsers = 0;
    const usersValues = usersLabels.map((label) => {
      cumulativeUsers += usersByDay.get(label);
      return cumulativeUsers;
    });
    if (this.charts.usersGrowth) {
      this.charts.usersGrowth.data.labels = usersLabels;
      this.charts.usersGrowth.data.datasets[0].data = usersValues;
      this.charts.usersGrowth.update();
    }

    // Specs growth chart - cumulative specs over time
    const specsByDayCumulative = new Map();
    Array.from(this.store.specs.values()).forEach((spec) => {
      if (spec.createdAt) {
        const date = spec.createdAt.toISOString().slice(0, 10);
        specsByDayCumulative.set(date, (specsByDayCumulative.get(date) || 0) + 1);
      }
    });
    const specsLabelsCumulative = Array.from(specsByDayCumulative.keys()).sort();
    // Calculate cumulative values
    let cumulativeSpecs = 0;
    const specsValuesCumulative = specsLabelsCumulative.map((label) => {
      cumulativeSpecs += specsByDayCumulative.get(label);
      return cumulativeSpecs;
    });
    if (this.charts.specsGrowth) {
      this.charts.specsGrowth.data.labels = specsLabelsCumulative;
      this.charts.specsGrowth.data.datasets[0].data = specsValuesCumulative;
      this.charts.specsGrowth.update();
    }
  }

  updateStatistics() {
    const rangeButton = this.dom.statsRangeButtons.find((btn) => btn.classList.contains("active"));
    const rangeKey = rangeButton?.dataset.range ?? "week";
    const rangeMs = DATE_RANGES[rangeKey] || DATE_RANGES.week;
    const customStart = this.dom.statsStartDate?.value ? new Date(this.dom.statsStartDate.value) : null;
    const customEnd = this.dom.statsEndDate?.value ? new Date(this.dom.statsEndDate.value) : null;
    const endTimestamp = customEnd ? customEnd.getTime() + 24 * 60 * 60 * 1000 : Date.now();
    const startTimestamp = customStart
      ? customStart.getTime()
      : endTimestamp - rangeMs;

    const activeUsers = this.store.getUsersSorted().filter(
      (user) => (user.lastActive?.getTime() || 0) >= startTimestamp
    ).length;
    const specsCreated = Array.from(this.store.specs.values()).filter(
      (spec) => (spec.createdAt?.getTime() || 0) >= startTimestamp
    ).length;
    const purchasesInRange = this.store.purchases.filter((purchase) => (purchase.createdAt?.getTime() || 0) >= startTimestamp);
    const creditsUsed = purchasesInRange.reduce((sum, purchase) => {
      const credits = purchase.metadata?.credits || purchase.metadata?.metadata?.credits || 0;
      return sum + (typeof credits === "number" ? credits : 0);
    }, 0);
    const revenue = purchasesInRange
      .reduce((sum, purchase) => sum + (purchase.total || 0), 0);

    const statsMapping = {
      "active-users": utils.formatNumber(activeUsers),
      "specs-created": utils.formatNumber(specsCreated),
      "credits-used": utils.formatNumber(creditsUsed),
      revenue: utils.formatCurrency(revenue)
    };

    Object.entries(statsMapping).forEach(([key, value]) => {
      const element = utils.dom(`[data-stats="${key}"]`);
      if (element) element.textContent = value;
    });

    const detailMapping = {
      "active-users-change": `From ${utils.formatDate(startTimestamp)} to ${utils.formatDate(endTimestamp)}`,
      "specs-change": `In range: ${utils.formatNumber(specsCreated)}`,
      "credits-change": `Credits purchased: ${utils.formatNumber(creditsUsed)}`,
      "revenue-change": `Revenue in range: ${utils.formatCurrency(revenue)}`
    };
    Object.entries(detailMapping).forEach(([key, value]) => {
      const element = utils.dom(`[data-stats-detail="${key}"]`);
      if (element) element.textContent = value;
    });

    // Update growth charts based on selected range
    this.updateGrowthCharts(startTimestamp, endTimestamp, rangeKey);
  }

  updateGrowthCharts(startTimestamp, endTimestamp, rangeKey) {
    const users = this.store.getUsersSorted();
    const specs = Array.from(this.store.specs.values());

    // Filter data by range
    const usersInRange = users.filter((user) => {
      const createdAt = user.createdAt?.getTime() || 0;
      return createdAt >= startTimestamp && createdAt <= endTimestamp;
    });

    const specsInRange = specs.filter((spec) => {
      const createdAt = spec.createdAt?.getTime() || 0;
      return createdAt >= startTimestamp && createdAt <= endTimestamp;
    });

    // Group by time period based on range
    let groupByFunction;
    let formatLabel;
    
    if (rangeKey === "day") {
      groupByFunction = (date) => date.toISOString().slice(0, 10);
      formatLabel = (dateStr) => {
        const d = new Date(dateStr);
        return `${d.getDate()}/${d.getMonth() + 1}`;
      };
    } else if (rangeKey === "week") {
      groupByFunction = (date) => {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().slice(0, 10);
      };
      formatLabel = (dateStr) => {
        const d = new Date(dateStr);
        return `Week ${Math.ceil((d.getDate()) / 7)}/${d.getMonth() + 1}`;
      };
    } else {
      // month
      groupByFunction = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      formatLabel = (dateStr) => {
        const [year, month] = dateStr.split('-');
        return `${month}/${year.slice(2)}`;
      };
    }

    // Users growth chart
    const usersByPeriod = new Map();
    usersInRange.forEach((user) => {
      if (user.createdAt) {
        const period = groupByFunction(user.createdAt);
        usersByPeriod.set(period, (usersByPeriod.get(period) || 0) + 1);
      }
    });
    const usersPeriodLabels = Array.from(usersByPeriod.keys()).sort();
    let cumulativeUsers = 0;
    const usersPeriodValues = usersPeriodLabels.map((label) => {
      cumulativeUsers += usersByPeriod.get(label);
      return cumulativeUsers;
    });
    if (this.charts.usersGrowth) {
      this.charts.usersGrowth.data.labels = usersPeriodLabels.map(formatLabel);
      this.charts.usersGrowth.data.datasets[0].data = usersPeriodValues;
      this.charts.usersGrowth.update();
    }

    // Specs growth chart
    const specsByPeriod = new Map();
    specsInRange.forEach((spec) => {
      if (spec.createdAt) {
        const period = groupByFunction(spec.createdAt);
        specsByPeriod.set(period, (specsByPeriod.get(period) || 0) + 1);
      }
    });
    const specsPeriodLabels = Array.from(specsByPeriod.keys()).sort();
    let cumulativeSpecs = 0;
    const specsPeriodValues = specsPeriodLabels.map((label) => {
      cumulativeSpecs += specsByPeriod.get(label);
      return cumulativeSpecs;
    });
    if (this.charts.specsGrowth) {
      this.charts.specsGrowth.data.labels = specsPeriodLabels.map(formatLabel);
      this.charts.specsGrowth.data.datasets[0].data = specsPeriodValues;
      this.charts.specsGrowth.update();
    }

    // Update Conversion Funnel
    this.updateConversionFunnel();

    // Update Retention Metrics
    this.updateRetentionMetrics();
  }

  updateConversionFunnel() {
    if (!this.dom.conversionFunnel) return;

    const users = this.store.getUsersSorted();
    const totalUsers = users.length;
    // Pro users - check user_credits subscription (source of truth)
    const proUsers = users.filter((u) => {
      const userCredits = this.dataAggregator.aggregatedData.userCredits.get(u.id);
      if (userCredits) {
        const subscriptionType = userCredits.metadata?.subscription?.type;
        const subscriptionStatus = userCredits.metadata?.subscription?.status;
        return (subscriptionType === 'pro' && subscriptionStatus === 'active') || userCredits.unlimited;
      }
      return u.plan === "pro";
    }).length;
    const purchases = this.store.purchases;
    const totalPurchases = purchases.length;

    // Calculate conversion rates
    const visitors = totalUsers * 3; // Estimate visitors (3x users)
    const signups = totalUsers;
    const proConversions = proUsers;
    const purchaseConversions = totalPurchases;

    const stages = [
      { label: "Visitors", value: visitors, percentage: 100 },
      { label: "Signups", value: signups, percentage: (signups / visitors) * 100 },
      { label: "Pro Users", value: proConversions, percentage: (proConversions / signups) * 100 },
      { label: "Purchases", value: purchaseConversions, percentage: (purchaseConversions / signups) * 100 }
    ];

    const maxValue = Math.max(...stages.map(s => s.value));

    const html = stages.map(stage => {
      const width = (stage.value / maxValue) * 100;
      return `
        <div class="funnel-stage">
          <div class="funnel-stage-label">${stage.label}</div>
          <div class="funnel-stage-bar">
            <div class="funnel-stage-fill" style="width: ${width}%">${utils.formatNumber(stage.value)}</div>
          </div>
          <div class="funnel-stage-value">${utils.formatNumber(stage.value)}</div>
          <div class="funnel-stage-percentage">${stage.percentage.toFixed(1)}%</div>
        </div>
      `;
    }).join("");

    this.dom.conversionFunnel.innerHTML = html;
  }

  updateRetentionMetrics() {
    if (!this.dom.retentionMetrics) return;

    const users = this.store.getUsersSorted();
    const totalUsers = users.length;
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

    // Calculate DAU (Daily Active Users)
    const dau = users.filter(u => u.lastActive && u.lastActive.getTime() >= oneDayAgo).length;

    // Calculate MAU (Monthly Active Users)
    const mau = users.filter(u => u.lastActive && u.lastActive.getTime() >= thirtyDaysAgo).length;

    // Calculate Retention Rate (users active in last 7 days / users created in last 30 days)
    const usersCreatedLast30Days = users.filter(u => u.createdAt && u.createdAt.getTime() >= thirtyDaysAgo).length;
    const usersActiveLast7Days = users.filter(u => u.lastActive && u.lastActive.getTime() >= sevenDaysAgo).length;
    const retentionRate = usersCreatedLast30Days > 0 
      ? (usersActiveLast7Days / usersCreatedLast30Days) * 100 
      : 0;

    // Calculate Churn Rate (users inactive for 30+ days / total users)
    const inactiveUsers = users.filter(u => !u.lastActive || u.lastActive.getTime() < thirtyDaysAgo).length;
    const churnRate = totalUsers > 0 ? (inactiveUsers / totalUsers) * 100 : 0;

    const html = `
      <div class="retention-card">
        <h4>DAU</h4>
        <div class="retention-value">${utils.formatNumber(dau)}</div>
        <div class="retention-change">Daily Active Users</div>
      </div>
      <div class="retention-card">
        <h4>MAU</h4>
        <div class="retention-value">${utils.formatNumber(mau)}</div>
        <div class="retention-change">Monthly Active Users</div>
      </div>
      <div class="retention-card">
        <h4>Retention Rate</h4>
        <div class="retention-value">${retentionRate.toFixed(1)}%</div>
        <div class="retention-change ${retentionRate >= 50 ? "positive" : "negative"}">
          ${usersActiveLast7Days} / ${usersCreatedLast30Days} users
        </div>
      </div>
      <div class="retention-card">
        <h4>Churn Rate</h4>
        <div class="retention-value">${churnRate.toFixed(1)}%</div>
        <div class="retention-change ${churnRate < 10 ? "positive" : "negative"}">
          ${inactiveUsers} inactive users
        </div>
      </div>
    `;

    this.dom.retentionMetrics.innerHTML = html;
  }

  async exportUsersCsv() {
    const headers = [
      "User ID",
      "Email",
      "Display Name",
      "Plan",
      "Created At",
      "Last Active",
      "Specs Count",
      "Credits",
      "Unlimited",
      "Email Verified"
    ];
    const rows = this.store.getUsersSorted().map((user) => {
      // Use new user_credits system instead of old entitlements
      const userCredits = this.dataAggregator.aggregatedData.userCredits.get(user.id);
      
      // Calculate credits: use new user_credits system only
      let credits = "";
      
      if (userCredits) {
        // New system - use user_credits
        if (userCredits.unlimited) {
          credits = "Unlimited";
        } else {
          credits = userCredits.total || 0;
        }
      } else {
        // If no credits info found, default to 0
        credits = 0;
      }
      
      return [
        user.id,
        user.email,
        user.displayName,
        user.plan || "free",
        utils.formatDate(user.createdAt),
        utils.formatDate(user.lastActive),
        this.store.getSpecCount(user.id),
        credits,
        userCredits?.unlimited ? "yes" : "no",
        user.emailVerified ? "yes" : "no"
      ]
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `specifys-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 0);
  }

  async handleBlogSubmit() {
    if (!this.dom.blogForm) {
      return;
    }
    
    const isEditing = Boolean(this.editingPost);
    
    const title = this.dom.blogFields.title?.value.trim() ?? "";
    const description = this.dom.blogFields.description?.value.trim() ?? "";
    const content = this.dom.blogFields.content?.value.trim() ?? "";
    const rawTags = this.dom.blogFields.tags?.value ?? "";
    const slugInput = this.dom.blogFields.slug?.value.trim() ?? "";
    const seoTitle = this.dom.blogFields.seoTitle?.value.trim() ?? "";
    const seoDescription = this.dom.blogFields.seoDescription?.value.trim() ?? "";
    const author = (this.dom.blogFields.author?.value || "specifys.ai Team").trim();
    const dateValue = this.dom.blogFields.date?.value || utils.now().toISOString().slice(0, 10);

    // Beta: Only title is required
    if (!title) {
      const errorMsg = "Title is required.";
      this.setBlogFeedback(errorMsg, "error");
      return;
    }

    const tags = rawTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const payload = {
      title,
      description: description || "No description",
      content: content || "No content",
      tags,
      date: dateValue,
      author,
      slug: slugInput ? utils.sanitizeSlug(slugInput) : utils.sanitizeSlug(title)
    };

    if (seoTitle) {
      payload.seoTitle = seoTitle;
    }
    if (seoDescription) {
      payload.seoDescription = seoDescription;
    }


    if (isEditing && this.editingPost?.id) {
      payload.id = this.editingPost.id;
      payload.date = this.editingPost.date || payload.date;
      payload.slug = this.editingPost.slug || payload.slug;
    }

    const button = this.blogSubmitButton;
    const originalText = button?.innerHTML;
    if (button) {
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
      button.disabled = true;
    }
    
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error("Failed to get authentication token. Please sign in again.");
      }
      
      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai-development.onrender.com";
      const requestUrl = isEditing
        ? `${apiBaseUrl}/api/blog/update-post`
        : `${apiBaseUrl}/api/blog/create-post`;
      
      try {
        const endpoint = isEditing ? '/api/blog/update-post' : '/api/blog/create-post';
        const result = await window.api.post(endpoint, payload);
        
        if (!result || !result.success) {
          const message = result?.error || `Failed to ${isEditing ? "update" : "create"} blog post`;
          throw new Error(message);
        }
        
        if (isEditing) {
          this.setBlogFeedback("Post updated successfully.", "success");
          this.exitBlogEditMode({ resetForm: true });
          await this.refreshBlogQueue({ silent: true }).catch(() => {});
        } else {
          this.setBlogFeedback("✅ Post created successfully!", "success");
          this.dom.blogForm.reset();
          if (this.dom.blogFields.date) {
            this.dom.blogFields.date.value = utils.now().toISOString().slice(0, 10);
          }
          if (this.dom.blogFields.slug) {
            delete this.dom.blogFields.slug.dataset.manual;
          }
          if (this.dom.blogFields.author) {
            this.dom.blogFields.author.value = "specifys.ai Team";
          }
          if (this.dom.blogFields.descriptionCount) {
            this.dom.blogFields.descriptionCount.textContent = "0 / 160";
          }
          try {
            await this.refreshBlogQueue({ silent: true });
          } catch (queueError) {
            // Blog queue refresh failed
          }
        }
      } catch (innerError) {
        // Re-throw to outer catch block
        throw innerError;
      }
    } catch (error) {
      const errorDetails = error.message || `Failed to ${isEditing ? "update" : "create"} blog post.`;
      this.setBlogFeedback(`❌ Error: ${errorDetails}`, "error");
    } finally {
      if (button) {
        button.innerHTML = originalText;
        button.disabled = false;
      }
    }
  }

  async showBlogPreview() {
    const previewModal = document.getElementById("preview-modal");
    const previewArticle = document.getElementById("preview-article");
    if (!previewModal || !previewArticle) return;
    const title = this.dom.blogFields.title?.value.trim();
    const description = this.dom.blogFields.description?.value.trim();
    const content = this.dom.blogFields.content?.value.trim();
    if (!title || !content) {
      alert("Add title and content to preview.");
            return;
        }
    if (!MarkedLib) {
      try {
        const module = await import("https://cdn.jsdelivr.net/npm/marked@11.2.0/lib/marked.esm.js");
        MarkedLib = module.marked ?? module.default ?? null;
      } catch (error) {
        // Failed to load marked
      }
    }
    let renderedContent;
    if (MarkedLib) {
      if (typeof MarkedLib === "function") {
        renderedContent = MarkedLib(content);
      } else if (typeof MarkedLib.parse === "function") {
        renderedContent = MarkedLib.parse(content);
      }
    }
    if (!renderedContent) {
      renderedContent = `<pre>${content}</pre>`;
    }
    previewArticle.innerHTML = `
      <h1>${title}</h1>
      ${description ? `<p class="lead">${description}</p>` : ""}
      <hr>
      <div class="content">${renderedContent}</div>
    `;
    previewModal.classList.remove("hidden");
    previewModal
      .querySelectorAll("[data-modal-dismiss]")
      .forEach((btn) => btn.addEventListener("click", () => previewModal.classList.add("hidden")));
    previewModal
      .querySelector(".modal-backdrop")
      ?.addEventListener("click", () => previewModal.classList.add("hidden"));
  }

  setBlogFeedback(message, type) {
    if (!this.dom.blogFeedback) return;
    this.dom.blogFeedback.textContent = message;
    this.dom.blogFeedback.classList.remove("success", "error");
    if (type) this.dom.blogFeedback.classList.add(type);
  }

  async refreshBlogQueue(options = {}) {
    const { silent = false } = options;
    try {
      let token = await this.getAuthToken();
      if (!token) {
        const authError = new Error("Authentication required to refresh blog posts.");
        authError.status = 401;
        throw authError;
      }

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai-development.onrender.com";
      const requestUrl = `${apiBaseUrl}/api/blog/list-posts`;
      try {
        const result = await window.api.get('/api/blog/list-posts');
        if (!result || !result.success) {
          // Request failed
          const message = result?.error || 'Failed to load blog posts';
          throw new Error(message);
        }
        
        const posts = Array.isArray(result.posts) ? result.posts : [];
        // Posts from API are already extracted from blogQueue structure
        // Map them to the format expected by setBlogQueue
        this.store.setBlogQueue(
          posts.map((post) => ({
            id: post.id,
            postData: {
              title: post.title,
              description: post.description,
              date: post.date,
              author: post.author,
              tags: post.tags,
              slug: post.slug,
              url: post.url,
              published: post.published
            },
            status: post.status || (post.published ? 'completed' : 'pending'),
            createdAt: utils.toDate(post.createdAt),
            updatedAt: utils.toDate(post.updatedAt)
          }))
        );
        this.renderBlogQueue();
        return result;
      } catch (innerError) {
        // Re-throw to outer catch block
        throw innerError;
      }
    } catch (error) {
      if (!silent) {
        this.setBlogFeedback(error.message || "Failed to refresh blog posts.", "error");
      }
      // Failed to refresh blog posts
      throw error;
    }
  }

  renderBlogQueue() {
    if (!this.dom.blogQueueList) return;
    if (!this.store.blogQueue.length) {
      this.dom.blogQueueList.innerHTML = `<li class="queue-placeholder">Queue is empty.</li>`;
      return;
    }
    const html = this.store.blogQueue
      .slice(0, 20)
      .map((item) => {
        const statusClass = item.status || "pending";
        const meta = [
          item.createdAt ? `Created ${utils.formatRelative(item.createdAt)}` : null,
          item.startedAt ? `Started ${utils.formatRelative(item.startedAt)}` : null,
          item.completedAt ? `Completed ${utils.formatRelative(item.completedAt)}` : null
        ]
          .filter(Boolean)
          .join(" · ");
        const title = item.postData?.title || item.title || "Untitled post";
        const url = item.postData?.url || item.url;
        return `
          <li class="queue-item ${statusClass}">
            <div class="queue-title">${title}</div>
            <div class="queue-meta">
              <span>${meta}</span>
              <span class="queue-status">${item.status}</span>
                </div>
            ${
              item.error
                ? `<div class="queue-error">Error: ${item.error}</div>`
                : ""
            }
            <div class="queue-actions">
              ${
                url
                  ? `<a href="${url}" target="_blank" rel="noopener">View post</a>`
                  : ""
              }
              ${
                item.id
                  ? `<button class="queue-edit-btn" data-id="${item.id}"><i class="fas fa-edit"></i> Edit</button>`
                  : ""
              }
            </div>
          </li>
        `;
      })
      .join("");
    this.dom.blogQueueList.innerHTML = html;

    this.dom.blogQueueList
      .querySelectorAll(".queue-edit-btn")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          if (id) {
            this.enterBlogEditMode(id);
          }
        });
      });
  }

  rebuildSearchIndex() {
    if (this.globalSearch && this.globalSearch.active) {
      const value = this.globalSearch.elements.input?.value;
      if (value) {
        this.globalSearch.executeSearch(value);
      }
    }
  }

  toggleActivityDetail(activityId, element) {
    const events = this.store.getActivityMerged();
    const record = events.find((event) => event.id === activityId);
    if (!record) return;
    const alreadySelected = element.classList.contains("selected");
    this.dom.activityFeed.querySelectorAll(".activity-item").forEach((item) => item.classList.remove("selected"));
    if (alreadySelected) {
      this.hideActivityDetail();
            return;
    }
    element.classList.add("selected");
    this.showActivityDetail(record);
  }

  getActivityIcon(type) {
    switch (type) {
      case "payment":
      case "subscription":
        return "fas fa-hand-holding-dollar";
      case "spec":
        return "fas fa-file-alt";
      case "user":
        return "fas fa-user-plus";
      case "auth":
        return "fas fa-user-check";
      default:
        return "fas fa-info-circle";
    }
  }

  showActivityDetail(event) {
    const panel = this.dom.activityDetail;
    if (!panel.root) return;
    const user = event.meta?.userId ? this.store.getUser(event.meta.userId) : null;
    const name = event.meta?.userName || user?.displayName || user?.email || event.meta?.userId || "Unknown user";
    const email = event.meta?.email || event.meta?.userEmail || user?.email || event.meta?.userId || "Not provided";
    panel.title.textContent = event.title;
    panel.name.textContent = name;
    panel.email.textContent = email;
    panel.userId.textContent = event.meta?.userId || "—";
    panel.time.textContent = `${utils.formatDate(event.timestamp)} (${utils.formatRelative(event.timestamp)})`;
    const contextParts = [];
    if (event.meta?.specId) contextParts.push(`Spec: ${event.meta.specId}`);
    if (event.meta?.purchaseId) contextParts.push(`Purchase: ${event.meta.purchaseId}`);
    if (event.meta?.plan) contextParts.push(`Plan: ${event.meta.plan}`);
    if (event.meta?.description) contextParts.push(event.meta.description);
    panel.context.textContent = contextParts.join(" • ") || "—";
    panel.root.classList.remove("hidden");
  }

  hideActivityDetail() {
    if (this.dom.activityDetail.root) {
      this.dom.activityDetail.root.classList.add("hidden");
    }
    this.dom.activityFeed?.querySelectorAll(".activity-item").forEach((item) => item.classList.remove("selected"));
  }

  async refreshAllData(reason = "manual") {
    this.updateConnectionState("pending", "Refreshing data…");
    
    // Track manual refresh time
    if (reason === "manual" || reason === "manual-user-sync") {
      this.lastManualRefresh = Date.now();
    }
    
    await this.subscribeToSources();
    this.updateAutoRefreshTimer();
  }

  updateAutoRefreshTimer() {
    // Clear existing timer
    if (this.autoRefreshTimer) {
      clearTimeout(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }

    // Calculate next refresh time
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    // If there was a manual refresh in the last 24 hours, schedule auto refresh for 24h after that
    let nextRefreshTime;
    if (this.lastManualRefresh && (now - this.lastManualRefresh) < twentyFourHours) {
      // Schedule auto refresh 24 hours after last manual refresh
      nextRefreshTime = this.lastManualRefresh + twentyFourHours;
    } else {
      // No recent manual refresh, schedule for 24 hours from now
      nextRefreshTime = now + twentyFourHours;
    }
    
    this.nextAutoRefreshAt = new Date(nextRefreshTime);
    
    // Update UI
    if (this.dom.autoRefreshNext) {
      const timeUntilRefresh = nextRefreshTime - now;
      if (timeUntilRefresh > 0) {
        const hours = Math.floor(timeUntilRefresh / (60 * 60 * 1000));
        const minutes = Math.floor((timeUntilRefresh % (60 * 60 * 1000)) / (60 * 1000));
        this.dom.autoRefreshNext.textContent = `Scheduled in ${hours}h ${minutes}m`;
      } else {
        this.dom.autoRefreshNext.textContent = `Scheduled at ${utils.formatDate(this.nextAutoRefreshAt)}`;
      }
    }
    
    // Set up auto refresh timer
    const timeUntilRefresh = nextRefreshTime - now;
    if (timeUntilRefresh > 0) {
      this.autoRefreshTimer = setTimeout(() => {
        // Only auto refresh if no manual refresh happened in the meantime
        const timeSinceLastManual = this.lastManualRefresh ? (Date.now() - this.lastManualRefresh) : Infinity;
        if (timeSinceLastManual >= twentyFourHours) {
          this.refreshAllData("auto");
        } else {
          // Manual refresh happened, reschedule
          this.updateAutoRefreshTimer();
        }
      }, timeUntilRefresh);
    } else {
      // Time already passed, refresh immediately
      this.refreshAllData("auto");
    }
  }

  async getAuthToken(forceRefresh = false) {
    try {
      const user = auth.currentUser;
      if (!user) return null;
      const token = await user.getIdToken(forceRefresh);
      return token;
    } catch (error) {
      return null;
    }
  }

  unsubscribeAll() {
    // Use DataAggregator's unsubscribeAll for Firebase listeners
    this.dataAggregator.unsubscribeAll();
    // Keep old unsubscribeFns for blog queue and other API-based subscriptions
    this.unsubscribeFns.forEach((fn) => {
      if (typeof fn === "function") {
        try {
          fn();
        } catch (error) {
          // Error unsubscribing
        }
      }
    });
    this.unsubscribeFns = [];
  }

  updateSyncSummary(message, variant = "info") {
    const summaryEl = this.dom.syncUsersSummary;
    if (!summaryEl) return;
    summaryEl.textContent = message;
    summaryEl.classList.remove("success", "error");
    if (variant === "success") {
      summaryEl.classList.add("success");
    } else if (variant === "error") {
      summaryEl.classList.add("error");
    }
  }

  async parseJsonSafely(response) {
    if (!response) return null;
    try {
      // Clone the response so we can read it multiple times if needed
      const clonedResponse = response.clone();
      return await clonedResponse.json();
    } catch (error) {
      // If JSON parsing fails, try to get text for debugging from a fresh clone
      try {
        const textResponse = response.clone();
        const text = await textResponse.text();
        // Failed to parse JSON response
        return null;
      } catch (textError) {
        return null;
      }
    }
  }

  buildSyncSummaryDisplay(summary = {}, cached = false) {
    const parts = [];

    if (summary.runAt) {
      parts.push(`Last run ${utils.formatDate(summary.runAt)}`);
    } else {
      parts.push("No sync executed yet");
    }

    parts.push(`Created ${summary.created || 0}`);
    parts.push(`Updated ${summary.updated || 0}`);

    if (typeof summary.errors === "number") {
      parts.push(`Errors ${summary.errors}`);
    }

    if (summary.inconsistencies?.authWithoutFirestore?.total) {
      parts.push(`${summary.inconsistencies.authWithoutFirestore.total} users missing docs`);
    } else if (summary.potentialCreates) {
      parts.push(`${summary.potentialCreates} users missing docs`);
    }

    if (summary.inconsistencies?.missingEntitlements?.total) {
      parts.push(`${summary.inconsistencies.missingEntitlements.total} missing entitlements`);
    } else if (summary.potentialEntitlementCreates) {
      parts.push(`${summary.potentialEntitlementCreates} missing entitlements`);
    }

    if (cached) {
      parts.push("cached");
    }

    const text = parts.join(" · ");
    const variant = summary.errors && summary.errors > 0
      ? "error"
      : (summary.created || summary.updated)
        ? "success"
        : "info";

    return { text, variant };
  }

  async fetchSyncStatusPrimary(token, apiBaseUrl) {
    try {
      const payload = await window.api.get('/api/admin/users/sync-status');
      return {
        summary: payload.summary || {},
        cached: Boolean(payload.cached)
      };
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async fetchSyncStatusLegacy(token, apiBaseUrl) {
    const payload = await window.api.post('/api/sync-users', {
      dryRun: true,
      ensureEntitlements: true,
      includeDataCollections: true
    });
    
    if (!payload) {
      throw new Error('Invalid response format: server returned non-JSON response');
    }

    if (!payload.success) {
      const message = payload?.error || payload?.details || 'Sync failed';
      throw new Error(message);
    }

    // For legacy endpoint, summary might be at root level or in summary field
    const summary = payload.summary || payload;
    
    if (!summary || typeof summary !== 'object') {
      throw new Error('Invalid response: missing summary data');
    }

    return {
      summary: summary,
      cached: false
    };
  }

  async fetchUserSyncStatus() {
    if (!this.dom.syncUsersSummary) return;
    this.updateSyncSummary("Loading sync status…", "info");
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return;
      }

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai-development.onrender.com";

      let result = null;
      try {
        result = await this.fetchSyncStatusPrimary(token, apiBaseUrl);
      } catch (error) {
        if (error?.status === 404) {
          result = null;
        } else {
          throw error;
        }
      }

      if (!result) {
        result = await this.fetchSyncStatusLegacy(token, apiBaseUrl);
        // Fallback to legacy /api/sync-users for sync status
      }

      const { text, variant } = this.buildSyncSummaryDisplay(result.summary, result.cached);
      this.updateSyncSummary(text, variant);
    } catch (error) {
      this.updateSyncSummary(`Unable to load sync status: ${error.message || error}`, "error");
      // Failed to fetch user sync status
    }
  }

  async syncUsersPrimary(token, apiBaseUrl) {
    const payload = await window.api.post('/api/admin/users/sync', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({})
    });

    if (payload && payload.status === 404) {
      return null;
    }

    if (!payload || !payload.success) {
      const message = payload?.error || payload?.details || 'Sync failed';
      const error = new Error(message);
      error.status = payload?.status || 500;
      throw error;
    }

    return {
      summary: payload.summary || {}
    };
  }

  async syncUsersLegacy(token, apiBaseUrl) {
    const payload = await window.api.post('/api/sync-users', {
      dryRun: false,
      ensureEntitlements: true,
      includeDataCollections: true
    });
    
    if (!payload) {
      throw new Error('Invalid response format: server returned non-JSON response');
    }

    if (!payload.success) {
      const message = payload?.error || payload?.details || 'Sync failed';
      throw new Error(message);
    }

    // For legacy endpoint, summary might be at root level or in summary field
    const summary = payload.summary || payload;
    
    return {
      summary: summary || {}
    };
  }

  async syncUsersManually() {
    if (this.syncInProgress) {
      return;
    }

    const button = this.dom.syncUsersButton;
    const originalLabel = button?.innerHTML;

    try {
      this.syncInProgress = true;
      if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing…';
      }
      this.updateSyncSummary("Sync in progress…", "info");

      const token = await this.getAuthToken();
      if (!token) {
        this.updateSyncSummary("Missing admin session. Please sign in again.", "error");
        return;
      }

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai-development.onrender.com";

      let result = null;
      try {
        result = await this.syncUsersPrimary(token, apiBaseUrl);
      } catch (error) {
        if (error?.status === 404) {
          result = null;
        } else {
          throw error;
        }
      }

      if (!result) {
        result = await this.syncUsersLegacy(token, apiBaseUrl);
        // Fallback to legacy /api/sync-users for manual sync
      }

      const summary = result.summary || {};
      const message = `Created ${summary.created || 0} · Updated ${summary.updated || 0} · Errors ${summary.errors || 0}`;
      const variant = summary.errors && summary.errors > 0 ? "error" : "success";
      this.updateSyncSummary(message, variant);

      await this.fetchUserSyncStatus();
      await this.refreshAllData("manual-user-sync");
    } catch (error) {
      this.updateSyncSummary(`User sync failed: ${error.message || error}`, "error");
      // Manual user sync failed
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = originalLabel || '<i class="fas fa-user-check"></i> Sync users';
      }
      this.syncInProgress = false;
    }
  }

  /**
   * Sync credits for all users
   * Migrates credits from old system (entitlements) to new system (user_credits)
  /**
   * Toggle console logs visibility
   */
  toggleConsoleLogs() {
    try {
      const currentState = localStorage.getItem('specifys_console_logs_enabled');
      const isEnabled = currentState === 'true';
      const newState = !isEnabled;
      
      // Update localStorage
      localStorage.setItem('specifys_console_logs_enabled', newState ? 'true' : 'false');
      
      // Update console state using global control functions
      if (window.__SPECIFYS_CONSOLE_CONTROL__) {
        if (newState) {
          window.__SPECIFYS_CONSOLE_CONTROL__.enable();
        } else {
          window.__SPECIFYS_CONSOLE_CONTROL__.disable();
        }
      }
      
      // Update button text and visual state
      if (this.dom.consoleLogsToggleText) {
        this.dom.consoleLogsToggleText.textContent = `Logs: ${newState ? 'ON' : 'OFF'}`;
      }
      
      if (this.dom.consoleLogsToggle) {
        if (newState) {
          this.dom.consoleLogsToggle.classList.add('active');
          this.dom.consoleLogsToggle.classList.remove('inactive');
        } else {
          this.dom.consoleLogsToggle.classList.remove('active');
          this.dom.consoleLogsToggle.classList.add('inactive');
        }
      }
      
      // Show feedback
      console.log(`Console logs ${newState ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling console logs:', error);
    }
  }

  /**
   * Initialize console logs toggle state
   */
  initConsoleLogsToggle() {
    try {
      const isEnabled = localStorage.getItem('specifys_console_logs_enabled') === 'true';
      
      if (this.dom.consoleLogsToggleText) {
        this.dom.consoleLogsToggleText.textContent = `Logs: ${isEnabled ? 'ON' : 'OFF'}`;
      }
      
      if (this.dom.consoleLogsToggle) {
        if (isEnabled) {
          this.dom.consoleLogsToggle.classList.add('active');
          this.dom.consoleLogsToggle.classList.remove('inactive');
        } else {
          this.dom.consoleLogsToggle.classList.remove('active');
          this.dom.consoleLogsToggle.classList.add('inactive');
        }
      }
    } catch (error) {
      // Silently fail if localStorage is not available
    }
  }

   /**
   * Processes users in batches
   */
  async syncCreditsManually() {
    if (this.creditsSyncInProgress) {
      return;
    }

    const button = this.dom.syncCreditsBtn;
    const originalLabel = button?.innerHTML;

    try {
      this.creditsSyncInProgress = true;
      if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing credits...';
      }

      const token = await this.getAuthToken();
      if (!token) {
        alert("Missing admin session. Please sign in again.");
        return;
      }

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai-development.onrender.com";

      let totalProcessed = 0;
      let totalMigrated = 0;
      let totalAlreadySynced = 0;
      let totalErrors = 0;
      let nextBatch = null;
      let batchNumber = 0;
      let isCompleted = false;

      // Process in batches until complete
      do {
        batchNumber++;
        if (button) {
          button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing batch ${batchNumber}...`;
        }

        const response = await fetch(`${apiBaseUrl}/api/admin/credits/sync-all`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            batchSize: 10,
            startAfter: nextBatch?.startAfter || null,
            dryRun: false
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || 'Sync failed');
        }

        totalProcessed += result.processed || 0;
        totalMigrated += result.migrated || 0;
        totalAlreadySynced += result.alreadySynced || 0;
        totalErrors += result.errors || 0;
        nextBatch = result.nextBatch;
        isCompleted = result.completed || false;

        // Show progress notification
        if (isCompleted) {
          const message = `Credits sync completed! Processed: ${totalProcessed}, Migrated: ${totalMigrated}, Already synced: ${totalAlreadySynced}, Errors: ${totalErrors}`;
          console.log('[Credits Sync]', message);
          alert(message);
        } else {
          const message = `Batch ${batchNumber}: Processed ${result.processed} users (${result.migrated} migrated, ${result.alreadySynced} already synced)`;
          console.log('[Credits Sync]', message);
          // Don't show alert for each batch, only log to console
        }

        // Small delay between batches to avoid overwhelming the server
        if (nextBatch && !isCompleted) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } while (nextBatch && !isCompleted);

      // Refresh data after sync
      await this.refreshAllData("manual-credits-sync");

    } catch (error) {
      console.error('[Admin Dashboard] Credits sync error:', error);
      alert(`Credits sync failed: ${error.message || error}`);
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = originalLabel || '<i class="fas fa-sync-alt"></i> Sync Credits';
      }
      this.creditsSyncInProgress = false;
    }
  }

  // ===== API Health Check Methods =====

  async performApiHealthCheck() {
    if (this.apiHealthCheckInProgress) {
      return;
    }

    this.apiHealthCheckInProgress = true;
    const button = this.dom.apiHealth.checkButton;
    const responseText = this.dom.apiHealth.responseText;
    const originalLabel = button?.innerHTML;

    try {
      // Update UI
      if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
      }
      if (responseText) {
        responseText.value = "Testing full spec generation flow...\n\nTesting: Backend → Cloudflare Worker → OpenAI\n\nThis uses the same pipeline as real spec generation.";
        responseText.style.color = '';
        responseText.style.backgroundColor = '';
      }

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai-development.onrender.com";

      // Call the test-spec health check endpoint (uses same flow as real spec generation)
      const responseData = await window.api.get('/api/health/test-spec');
      
      // Format the response message
      let statusMessage = '';
      let isHealthy = false;

      if (responseData.status === 'healthy' && 
          responseData.backend === 'ok' && 
          responseData.cloudflare === 'ok' && 
          responseData.openai === 'ok') {
        // All systems operational
        isHealthy = true;
        statusMessage = `✅ ALL SYSTEMS OPERATIONAL\n\n`;
        statusMessage += `Backend: ${responseData.backend.toUpperCase()}\n`;
        statusMessage += `Cloudflare Worker: ${responseData.cloudflare.toUpperCase()}\n`;
        statusMessage += `OpenAI API: ${responseData.openai.toUpperCase()}\n`;
        if (responseData.totalResponseTime) {
          statusMessage += `\nTotal Response Time: ${responseData.totalResponseTime}`;
        }
        if (responseData.openaiResponseTime) {
          statusMessage += `\nOpenAI Response Time: ${responseData.openaiResponseTime}`;
        }
        statusMessage += `\n\nTimestamp: ${responseData.timestamp || new Date().toISOString()}`;
      } else {
        // System error detected
        isHealthy = false;
        statusMessage = `❌ SYSTEM ERROR DETECTED\n\n`;
        statusMessage += `Backend: ${responseData.backend?.toUpperCase() || 'UNKNOWN'}\n`;
        statusMessage += `Cloudflare Worker: ${responseData.cloudflare?.toUpperCase() || 'UNKNOWN'}\n`;
        statusMessage += `OpenAI API: ${responseData.openai?.toUpperCase() || 'UNKNOWN'}\n`;
        
        if (responseData.error) {
          statusMessage += `\n⚠️ ERROR DETAILS:\n${responseData.error}\n`;
        }
        
        statusMessage += `\nTimestamp: ${responseData.timestamp || new Date().toISOString()}`;
        statusMessage += `\n\nFull Response:\n${JSON.stringify(responseData, null, 2)}`;
      }
      
      // Display response in textarea with color coding
      if (responseText) {
        responseText.value = statusMessage;
        if (isHealthy) {
          responseText.style.color = '#10b981';
          responseText.style.backgroundColor = '#ecfdf5';
        } else {
          responseText.style.color = '#ef4444';
          responseText.style.backgroundColor = '#fef2f2';
        }
      }

      // Update button with result
      if (button) {
        if (isHealthy) {
          button.innerHTML = '<i class="fas fa-check-circle"></i> System Healthy';
          button.classList.remove('error');
          button.classList.add('success');
          setTimeout(() => {
            button.classList.remove('success');
            button.innerHTML = originalLabel || '<i class="fas fa-heartbeat"></i> Check System Health';
          }, 3000);
        } else {
          button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error Detected';
          button.classList.remove('success');
          button.classList.add('error');
        }
      }

    } catch (error) {
      // Network error or other exception
      const errorMessage = `❌ CONNECTION ERROR\n\n`;
      const errorDetails = `Failed to connect to health check endpoint.\n\n`;
      const errorInfo = `Error: ${error.message}\n\n`;
      const stackTrace = error.stack ? `Stack:\n${error.stack}` : '';
      
      if (responseText) {
        responseText.value = errorMessage + errorDetails + errorInfo + stackTrace;
        responseText.style.color = '#ef4444';
        responseText.style.backgroundColor = '#fef2f2';
      }
      
      if (button) {
        button.innerHTML = '<i class="fas fa-times-circle"></i> Connection Failed';
        button.classList.remove('success');
        button.classList.add('error');
      }
      
      // API health check failed
    } finally {
      if (button && !button.classList.contains('success') && !button.classList.contains('error')) {
        button.disabled = false;
        button.innerHTML = originalLabel || '<i class="fas fa-heartbeat"></i> Check System Health';
      } else if (button && (button.classList.contains('success') || button.classList.contains('error'))) {
        button.disabled = false;
      }
      this.apiHealthCheckInProgress = false;
    }
  }

  // Copy health check logs to clipboard
  async copyHealthCheckLogs() {
    const responseText = this.dom.apiHealth.responseText;
    const copyButton = this.dom.apiHealth.copyButton;
    
    if (!responseText || !responseText.value || responseText.value.trim() === '') {
      // No content to copy
      if (copyButton) {
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = '<i class="fas fa-exclamation-circle"></i> No logs to copy';
        setTimeout(() => {
          copyButton.innerHTML = originalText;
        }, 2000);
      }
      return;
    }

    try {
      // Copy to clipboard
      await navigator.clipboard.writeText(responseText.value);
      
      // Visual feedback
      if (copyButton) {
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
        copyButton.classList.add('success');
        setTimeout(() => {
          copyButton.innerHTML = originalText;
          copyButton.classList.remove('success');
        }, 2000);
      }
    } catch (error) {
      // Fallback for older browsers
      try {
        responseText.select();
        responseText.setSelectionRange(0, 99999); // For mobile devices
        document.execCommand('copy');
        
        if (copyButton) {
          const originalText = copyButton.innerHTML;
          copyButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
          copyButton.classList.add('success');
          setTimeout(() => {
            copyButton.innerHTML = originalText;
            copyButton.classList.remove('success');
          }, 2000);
        }
      } catch (fallbackError) {
        // Failed to copy logs
        if (copyButton) {
          const originalText = copyButton.innerHTML;
          copyButton.innerHTML = '<i class="fas fa-times"></i> Copy failed';
          copyButton.classList.add('error');
          setTimeout(() => {
            copyButton.innerHTML = originalText;
            copyButton.classList.remove('error');
          }, 2000);
        }
      }
    }
  }

  // Quick Actions
  openQuickAction(action) {
    const modal = this.dom.quickActions.modal;
    const title = this.dom.quickActions.modalTitle;
    const body = this.dom.quickActions.modalBody;
    
    if (!modal || !title || !body) return;

    const actions = {
      "add-credits": {
        title: "Add Credits to User",
        content: `
          <form id="quick-action-form" class="quick-action-form">
            <div class="form-group">
              <label for="quick-user-id">User ID or Email</label>
              <input type="text" id="quick-user-id" required placeholder="Enter user ID or email">
            </div>
            <div class="form-group">
              <label for="quick-credits-amount">Amount</label>
              <input type="number" id="quick-credits-amount" required min="1" placeholder="Number of credits">
            </div>
            <div class="form-group">
              <label for="quick-credits-reason">Reason</label>
              <textarea id="quick-credits-reason" rows="3" placeholder="Reason for adding credits"></textarea>
            </div>
            <div class="form-actions">
              <button type="submit" class="primary">Add Credits</button>
              <button type="button" class="secondary" data-modal-dismiss>Cancel</button>
            </div>
          </form>
        `
      },
      "change-plan": {
        title: "Change User Plan",
        content: `
          <form id="quick-action-form" class="quick-action-form">
            <div class="form-group">
              <label for="quick-user-id-plan">User ID or Email</label>
              <input type="text" id="quick-user-id-plan" required placeholder="Enter user ID or email">
            </div>
            <div class="form-group">
              <label for="quick-plan-select">New Plan</label>
              <select id="quick-plan-select" required>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <div class="form-actions">
              <button type="submit" class="primary">Change Plan</button>
              <button type="button" class="secondary" data-modal-dismiss>Cancel</button>
            </div>
          </form>
        `
      },
      "reset-password": {
        title: "Reset User Password",
        content: `
          <form id="quick-action-form" class="quick-action-form">
            <div class="form-group">
              <label for="quick-user-id-password">User ID or Email</label>
              <input type="text" id="quick-user-id-password" required placeholder="Enter user ID or email">
            </div>
            <div class="form-group">
              <p class="form-hint">A password reset email will be sent to the user.</p>
            </div>
            <div class="form-actions">
              <button type="submit" class="primary">Send Reset Email</button>
              <button type="button" class="secondary" data-modal-dismiss>Cancel</button>
            </div>
          </form>
        `
      },
      "toggle-user": {
        title: "Disable/Enable User",
        content: `
          <form id="quick-action-form" class="quick-action-form">
            <div class="form-group">
              <label for="quick-user-id-toggle">User ID or Email</label>
              <input type="text" id="quick-user-id-toggle" required placeholder="Enter user ID or email">
            </div>
            <div class="form-group">
              <label for="quick-user-action">Action</label>
              <select id="quick-user-action" required>
                <option value="disable">Disable User</option>
                <option value="enable">Enable User</option>
              </select>
            </div>
            <div class="form-actions">
              <button type="submit" class="primary">Apply</button>
              <button type="button" class="secondary" data-modal-dismiss>Cancel</button>
            </div>
          </form>
        `
      }
    };

    const actionData = actions[action];
    if (!actionData) return;

    title.textContent = actionData.title;
    body.innerHTML = actionData.content;
    modal.classList.remove("hidden");

    // Setup modal dismiss handlers
    const closeModal = () => modal.classList.add("hidden");
    
    // Close button (X)
    const closeBtn = modal.querySelector(".close-btn");
    if (closeBtn) {
      // Remove old listeners and add new one
      const newCloseBtn = closeBtn.cloneNode(true);
      closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
      newCloseBtn.addEventListener("click", closeModal);
    }

    // Dismiss buttons (Cancel)
    modal.querySelectorAll("[data-modal-dismiss]").forEach((btn) => {
      btn.addEventListener("click", closeModal);
    });

    // Backdrop click
    const backdrop = modal.querySelector(".modal-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", closeModal);
    }

    // Bind form submit
    const form = body.querySelector("#quick-action-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleQuickAction(action, form);
      });
    }
  }

  async handleQuickAction(action, form) {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai-development.onrender.com";

      let response;
      const userId = form.querySelector("input[type='text']")?.value;

      switch (action) {
        case "add-credits":
          const amount = parseInt(form.querySelector("#quick-credits-amount")?.value);
          const reason = form.querySelector("#quick-credits-reason")?.value || "Admin manual grant";
          response = await window.api.post(`/api/admin/users/${userId}/credits`, { amount, reason });
          break;
        case "change-plan":
          const plan = form.querySelector("#quick-plan-select")?.value;
          response = await window.api.put(`/api/admin/users/${userId}/plan`, { plan });
          break;
        case "reset-password":
          response = await window.api.post(`/api/admin/users/${userId}/reset-password`);
          break;
        case "toggle-user":
          const userAction = form.querySelector("#quick-user-action")?.value;
          response = await window.api.put(`/api/admin/users/${userId}/toggle`, { disabled: userAction === "disable" });
          break;
      }

      if (response?.success) {
        alert("Action completed successfully!");
        if (this.dom.quickActions.modal) {
          this.dom.quickActions.modal.classList.add("hidden");
        }
        
        // Clear CreditsV2Manager cache (new unified credits system)
        // This ensures the user sees updated credits immediately
        if (window.CreditsV2Manager) {
          window.CreditsV2Manager.clearCache();
        } else if (typeof window.clearCreditsCache === 'function') {
          window.clearCreditsCache();
        }
        
        // Force refresh credits display if user is viewing their own profile
        // This works even if the admin is viewing another user's data
        if (typeof window.updateCreditsDisplay === 'function') {
          window.updateCreditsDisplay({ forceRefresh: true });
        }
        
        this.refreshAllData();
      } else {
        // response is already parsed JSON, not a Response object
        const error = response || {};
        alert(`Error: ${error?.error || error?.message || "Failed to complete action"}`);
      }
    } catch (error) {
      // Quick action error
      alert(`Error: ${error.message}`);
    }
  }

  // Advanced Filters
  toggleSelectAllUsers(checked) {
    const checkboxes = this.dom.usersTable?.querySelectorAll('input[type="checkbox"][data-user-id]');
    checkboxes?.forEach((checkbox) => {
      checkbox.checked = checked;
      const userId = checkbox.dataset.userId;
      if (checked) {
        this.selectedUsers.add(userId);
      } else {
        this.selectedUsers.delete(userId);
      }
    });
    this.updateBulkActionsUI();
  }

  updateBulkActionsUI() {
    const count = this.selectedUsers.size;
    if (this.dom.bulkSelectedCount) {
      this.dom.bulkSelectedCount.textContent = count;
    }
    if (this.dom.bulkActionsBtn) {
      this.dom.bulkActionsBtn.style.display = count > 0 ? "inline-flex" : "none";
    }
  }

  // Alerts
  async loadAlerts() {
    const updateBtn = this.dom.updateButtons.alerts;
    
    // Show loading state
    if (updateBtn) {
      updateBtn.classList.add('loading');
      updateBtn.disabled = true;
    }
    
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai-development.onrender.com";

      // Load errors from errorLogs collection
      const data = await window.api.get('/api/admin/errors');
      if (data) {
        this.alerts = (data.errors || []).map(err => ({
          id: err.id,
          type: "error",
          severity: err.frequency > 10 ? "critical" : err.frequency > 5 ? "warning" : "info",
          title: err.errorType || "Error",
          description: err.errorMessage,
          timestamp: err.lastOccurrence?.toDate?.() || new Date(),
          frequency: err.frequency
        }));
      }

      // Add user alerts (inactive users, etc.)
      const users = this.store.getUsersSorted();
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

      users.forEach(user => {
        if (user.disabled) {
          this.alerts.push({
            id: `user-disabled-${user.id}`,
            type: "user",
            severity: "warning",
            title: "Disabled User",
            description: `User ${user.email || user.id} is disabled`,
            timestamp: user.lastActive || user.createdAt,
            userId: user.id
          });
        } else if (user.lastActive && user.lastActive.getTime() < thirtyDaysAgo) {
          this.alerts.push({
            id: `user-inactive-${user.id}`,
            type: "user",
            severity: "info",
            title: "Inactive User",
            description: `User ${user.email || user.id} hasn't been active for 30+ days`,
            timestamp: user.lastActive,
            userId: user.id
          });
        }
      });

      this.renderAlerts();
    } catch (error) {
      // Failed to load alerts
    } finally {
      // Remove loading state
      if (updateBtn) {
        updateBtn.classList.remove('loading');
        updateBtn.disabled = false;
      }
    }
  }

  getFilteredAlerts() {
    const severityFilter = this.dom.alertsSeverityFilter?.value || "all";
    return severityFilter === "all"
      ? this.alerts
      : this.alerts.filter(a => a.severity === severityFilter);
  }

  renderAlerts() {
    if (!this.dom.alertsList) return;

    const filtered = this.getFilteredAlerts();

    if (!filtered.length) {
      this.dom.alertsList.innerHTML = '<div class="alerts-placeholder">No alerts found.</div>';
      if (this.dom.alertsPagination) {
        this.dom.alertsPagination.style.display = "none";
      }
      return;
    }

    // Pagination
    const totalPages = Math.ceil(filtered.length / this.alertsPerPage);
    const startIndex = (this.alertsCurrentPage - 1) * this.alertsPerPage;
    const endIndex = startIndex + this.alertsPerPage;
    const paginatedAlerts = filtered.slice(startIndex, endIndex);

    const html = paginatedAlerts.map(alert => {
      const user = alert.userId ? this.store.getUser(alert.userId) : null;
      const userEmail = user?.email || alert.userEmail || "";
      
      return `
        <div class="alert-item alert-item-compact ${alert.severity}">
          <div class="alert-icon">
            <i class="fas fa-${alert.severity === "critical" ? "exclamation-triangle" : alert.severity === "warning" ? "exclamation-circle" : "info-circle"}"></i>
          </div>
          <div class="alert-content">
            <div class="alert-title">${alert.title}</div>
            <div class="alert-description">${alert.description}</div>
            <div class="alert-meta">
              <span>${utils.formatRelative(alert.timestamp)}</span>
              ${userEmail ? `<span class="alert-email">${userEmail}</span>` : ""}
              ${alert.frequency ? `<span>Occurred ${alert.frequency} times</span>` : ""}
            </div>
          </div>
          <div class="alert-actions">
            ${alert.userId ? `<button class="alert-action-btn" data-user-id="${alert.userId}">View User</button>` : ""}
          </div>
        </div>
      `;
    }).join("");

    this.dom.alertsList.innerHTML = html;

    // Bind view user buttons
    this.dom.alertsList.querySelectorAll('[data-user-id]').forEach(btn => {
      btn.addEventListener("click", () => {
        const userId = btn.dataset.userId;
        this.showUserActivity(userId);
      });
    });

    // Update pagination
    if (this.dom.alertsPagination) {
      if (totalPages > 1) {
        this.dom.alertsPagination.style.display = "flex";
        
        // Update pagination info
        if (this.dom.alertsPaginationInfo) {
          const start = startIndex + 1;
          const end = Math.min(endIndex, filtered.length);
          this.dom.alertsPaginationInfo.textContent = `Showing ${start}-${end} of ${filtered.length}`;
        }

        // Update prev/next buttons
        if (this.dom.alertsPaginationPrev) {
          this.dom.alertsPaginationPrev.disabled = this.alertsCurrentPage === 1;
        }
        if (this.dom.alertsPaginationNext) {
          this.dom.alertsPaginationNext.disabled = this.alertsCurrentPage === totalPages;
        }

        // Update page numbers
        if (this.dom.alertsPaginationPages) {
          let pagesHtml = "";
          for (let i = 1; i <= totalPages; i++) {
            const isActive = i === this.alertsCurrentPage;
            pagesHtml += `<button class="pagination-page ${isActive ? "active" : ""}" data-page="${i}">${i}</button>`;
          }
          this.dom.alertsPaginationPages.innerHTML = pagesHtml;

          // Bind page number clicks
          this.dom.alertsPaginationPages.querySelectorAll(".pagination-page").forEach(btn => {
            btn.addEventListener("click", () => {
              this.alertsCurrentPage = parseInt(btn.dataset.page);
              this.renderAlerts();
            });
          });
        }
      } else {
        this.dom.alertsPagination.style.display = "none";
      }
    }
  }

  copyAllEmails() {
    const filtered = this.getFilteredAlerts();
    const emails = new Set();
    
    filtered.forEach(alert => {
      if (alert.userId) {
        const user = this.store.getUser(alert.userId);
        if (user?.email) {
          emails.add(user.email);
        }
      }
      if (alert.userEmail) {
        emails.add(alert.userEmail);
      }
    });

    const emailList = Array.from(emails).join(", ");
    
    if (!emailList) {
      alert("No emails found in alerts.");
      return;
    }

    // Copy to clipboard
    navigator.clipboard.writeText(emailList).then(() => {
      // Show feedback
      const btn = this.dom.copyAllEmailsBtn;
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
      btn.style.color = "var(--color-success, #28a745)";
      
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.color = "";
      }, 2000);
    }).catch(err => {
      // Failed to copy emails
      alert("Failed to copy emails. Please try again.");
    });
  }

  markAllAlertsRead() {
    this.alerts = [];
    this.renderAlerts();
  }

  // User Activity Timeline
  async showUserActivity(userId) {
    if (!this.dom.userActivityModal) return;

    this.dom.userActivityTitle.textContent = `Activity Timeline - ${userId}`;
    this.dom.userActivityTimeline.innerHTML = '<div class="modal-placeholder">Loading...</div>';
    this.dom.userActivityModal.classList.remove("hidden");

    try {
      const user = this.store.getUser(userId);
      const specs = Array.from(this.store.specs.values()).filter(s => s.userId === userId);
      const purchases = this.store.purchases.filter(p => p.userId === userId);
      const activities = this.store.activity.filter(a => a.meta?.userId === userId);

      const timelineItems = [
        ...specs.map(spec => ({
          type: "spec",
          title: `Spec Created: ${spec.title || "Untitled"}`,
          description: `Created at ${utils.formatDate(spec.createdAt)}`,
          timestamp: spec.createdAt
        })),
        ...purchases.map(purchase => ({
          type: "payment",
          title: `Purchase: ${purchase.productName || "Unknown"}`,
          description: `Amount: $${purchase.total || 0}`,
          timestamp: purchase.createdAt
        })),
        ...activities.map(activity => ({
          type: activity.type,
          title: activity.title,
          description: activity.description,
          timestamp: activity.timestamp
        }))
      ].sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));

      const html = timelineItems.length
        ? `<div class="timeline">${timelineItems.map(item => `
          <div class="timeline-item ${item.type}">
            <div class="timeline-item-header">
              <div class="timeline-item-title">${item.title}</div>
              <div class="timeline-item-time">${utils.formatRelative(item.timestamp)}</div>
            </div>
            <div class="timeline-item-description">${item.description}</div>
          </div>
        `).join("")}</div>`
        : '<div class="modal-placeholder">No activity found for this user.</div>';

      this.dom.userActivityTimeline.innerHTML = html;
    } catch (error) {
      // Failed to load user activity
      this.dom.userActivityTimeline.innerHTML = '<div class="modal-placeholder">Error loading activity.</div>';
    }
  }

  // Performance Metrics
  async updatePerformanceMetrics() {
    const updateBtn = this.dom.updateButtons.performance;
    
    // Show loading state
    if (updateBtn) {
      updateBtn.classList.add('loading');
      updateBtn.disabled = true;
    }
    
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai-development.onrender.com";

      const range = this.dom.performanceRange?.value || "day";
      const data = await window.api.get(`/api/admin/performance?range=${range}`);
      if (data) {
        if (this.dom.performanceMetrics.apiResponse) {
          this.dom.performanceMetrics.apiResponse.textContent = `${(data.avgResponseTime || 0).toFixed(0)}ms`;
        }
        if (this.dom.performanceMetrics.errorRate) {
          this.dom.performanceMetrics.errorRate.textContent = `${(data.errorRate || 0).toFixed(2)}%`;
        }
        if (this.dom.performanceMetrics.connections) {
          this.dom.performanceMetrics.connections.textContent = data.activeConnections || 0;
        }
        if (this.dom.performanceMetrics.uptime) {
          this.dom.performanceMetrics.uptime.textContent = `${(data.uptime || 100).toFixed(2)}%`;
        }
      }
    } catch (error) {
      // Failed to update performance metrics
    } finally {
      // Remove loading state
      if (updateBtn) {
        updateBtn.classList.remove('loading');
        updateBtn.disabled = false;
      }
    }
  }

  // Export PDF
  async exportUsersPdf() {
    // For now, just show a message - PDF generation would require a library like jsPDF
    alert("PDF export feature coming soon. Please use CSV export for now.");
  }

  // Contact Submissions
  async loadContactSubmissions() {
    const updateBtn = this.dom.updateButtons.contact;
    
    // Show loading state
    if (updateBtn) {
      updateBtn.classList.add('loading');
      updateBtn.disabled = true;
    }
    
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      // First, try to use real-time data from DataAggregator
      if (this.dataAggregator.aggregatedData.contactSubmissions.length > 0) {
        this.store.contactSubmissions = [...this.dataAggregator.aggregatedData.contactSubmissions];
        this.renderContactTable();
        this.updateContactBadge();
      }

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai-development.onrender.com";

      const status = this.dom.contactStatusFilter?.value || "all";
      const url = `${apiBaseUrl}/api/admin/contact-submissions?status=${status}&limit=100`;
      
      const data = await window.api.get(`/api/admin/contact-submissions?status=${status}&limit=100`);
      if (data.success) {
        this.store.contactSubmissions = data.submissions.map(sub => ({
          ...sub,
          createdAt: utils.toDate(sub.createdAt) || utils.toDate(sub.timestamp) || new Date()
        }));
        this.renderContactTable();
        this.updateContactBadge();
      }
    } catch (error) {
      // Failed to load contact submissions
      if (this.dom.contactTable) {
        this.dom.contactTable.innerHTML = `<tr><td colspan="6" class="table-empty">Error loading contact submissions.</td></tr>`;
      }
    } finally {
      // Remove loading state
      if (updateBtn) {
        updateBtn.classList.remove('loading');
        updateBtn.disabled = false;
      }
    }
  }

  renderContactTable() {
    if (!this.dom.contactTable) return;
    
    const searchTerm = this.dom.contactSearch?.value.trim().toLowerCase() || "";
    const submissions = this.store.contactSubmissions || [];
    
    let filtered = submissions;
    if (searchTerm) {
      filtered = submissions.filter(sub => 
        sub.email?.toLowerCase().includes(searchTerm) ||
        sub.message?.toLowerCase().includes(searchTerm) ||
        sub.userName?.toLowerCase().includes(searchTerm)
      );
    }

    if (!filtered.length) {
      this.dom.contactTable.innerHTML = `<tr><td colspan="6" class="table-empty">No contact submissions found.</td></tr>`;
      return;
    }

    const rows = filtered.map(sub => {
      const date = utils.formatDate(sub.createdAt);
      const messagePreview = sub.message?.length > 100 
        ? sub.message.substring(0, 100) + "..." 
        : sub.message || "";
      const statusClass = `status-${sub.status || 'new'}`;
      const statusLabel = (sub.status || 'new').charAt(0).toUpperCase() + (sub.status || 'new').slice(1);
      
      return `
        <tr>
          <td>${date}</td>
          <td>${sub.email || "—"}</td>
          <td>${sub.userName || sub.userId || "—"}</td>
          <td>
            <div class="message-preview" title="${sub.message || ''}">
              ${messagePreview}
            </div>
          </td>
          <td>
            <select class="status-select ${statusClass}" data-id="${sub.id}" data-current="${sub.status || 'new'}">
              <option value="new" ${sub.status === 'new' ? 'selected' : ''}>New</option>
              <option value="read" ${sub.status === 'read' ? 'selected' : ''}>Read</option>
              <option value="replied" ${sub.status === 'replied' ? 'selected' : ''}>Replied</option>
              <option value="archived" ${sub.status === 'archived' ? 'selected' : ''}>Archived</option>
            </select>
          </td>
          <td>
            <button class="action-btn small" onclick="window.adminDashboard.viewContactMessage('${sub.id}')" title="View full message">
              <i class="fas fa-eye"></i>
            </button>
          </td>
        </tr>
      `;
    }).join("");

    this.dom.contactTable.innerHTML = rows;

    // Add event listeners for status changes
    this.dom.contactTable.querySelectorAll('.status-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        const newStatus = e.target.value;
        const oldStatus = e.target.dataset.current;
        
        if (newStatus === oldStatus) return;
        
        try {
          await this.updateContactStatus(id, newStatus);
          e.target.dataset.current = newStatus;
          e.target.className = `status-select status-${newStatus}`;
        } catch (error) {
          // Failed to update status
          e.target.value = oldStatus;
          alert("Failed to update status. Please try again.");
        }
      });
    });
  }

  async updateContactStatus(id, status) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Not authenticated");

    const apiBaseUrl = typeof window.getApiBaseUrl === "function"
      ? window.getApiBaseUrl()
      : "https://specifys-ai-development.onrender.com";

    const result = await window.api.put(`/api/admin/contact-submissions/${id}/status`, { status });
    
    if (!result || !result.success) {
      throw new Error(result?.error || "Failed to update status");
    }

    // Update local store
    const submission = this.store.contactSubmissions.find(s => s.id === id);
    if (submission) {
      submission.status = status;
    }
    
    // Also update in DataAggregator if it exists
    const aggSubmission = this.dataAggregator.aggregatedData.contactSubmissions.find(s => s.id === id);
    if (aggSubmission) {
      aggSubmission.status = status;
    }
    
    // Update badge
    this.updateContactBadge();
  }

  viewContactMessage(id) {
    const submission = this.store.contactSubmissions.find(s => s.id === id);
    if (!submission) return;
    
    alert(`Contact Message\n\nFrom: ${submission.email || "Unknown"}\nUser: ${submission.userName || submission.userId || "Guest"}\nDate: ${utils.formatDate(submission.createdAt)}\n\nMessage:\n${submission.message || "No message"}`);
  }

  async exportContactsCsv() {
    const submissions = this.store.contactSubmissions || [];
    if (!submissions.length) {
      alert("No contact submissions to export.");
      return;
    }

    const headers = ["Date", "Email", "User", "Message", "Status"];
    const rows = submissions.map(sub => [
      utils.formatDate(sub.createdAt),
      sub.email || "",
      sub.userName || sub.userId || "",
      `"${(sub.message || "").replace(/"/g, '""')}"`,
      sub.status || "new"
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contact-submissions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Update contact badge on nav button
   */
  updateContactBadge() {
    const contactNavButton = document.querySelector('[data-target="contact-section"]');
    if (!contactNavButton) return;
    
    const newCount = (this.store.contactSubmissions || []).filter(s => s.status === 'new').length;
    
    // Remove existing badge
    const existingBadge = contactNavButton.querySelector('.nav-badge');
    if (existingBadge) {
      existingBadge.remove();
    }
    
    // Add badge if there are new submissions
    if (newCount > 0) {
      const badge = document.createElement('span');
      badge.className = 'nav-badge';
      badge.textContent = newCount > 99 ? '99+' : newCount.toString();
      badge.setAttribute('aria-label', `${newCount} new contact submissions`);
      contactNavButton.appendChild(badge);
    }
  }

  /**
   * Show notification for new contact submissions
   */
  showContactNotification(count) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'contact-notification';
    notification.setAttribute('role', 'alert');
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-envelope"></i>
        <div class="notification-text">
          <strong>New Contact Message${count > 1 ? 's' : ''}</strong>
          <span>${count} new message${count > 1 ? 's' : ''} from user${count > 1 ? 's' : ''}</span>
        </div>
        <button class="notification-close" aria-label="Close notification">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
    
    // Add click handler to navigate to contact section
    notification.addEventListener('click', (e) => {
      if (!e.target.closest('.notification-close')) {
        const contactNavButton = document.querySelector('[data-target="contact-section"]');
        if (contactNavButton) {
          contactNavButton.click();
        }
        notification.remove();
      }
    });
    
    // Add close handler
    const closeBtn = notification.querySelector('.notification-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        notification.remove();
      });
    }
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
      }
    }, 10000);
  }

  renderSpecUsageAnalytics() {
    const container = this.dom.specUsageTable;
    if (!container) return;
    
    const updateBtn = this.dom.updateButtons.specUsage;
    
    // Show loading state
    if (updateBtn) {
      updateBtn.classList.add('loading');
      updateBtn.disabled = true;
    }

    const range = this.dom.specUsageRange?.value || "all";
    const searchTerm = (this.dom.specUsageSearch?.value || "").toLowerCase().trim();
    const allSpecs = Array.from(this.store.specs.values());
    
    // Filter by date range
    let filteredSpecs = allSpecs;
    if (range !== "all") {
      const threshold = Date.now() - DATE_RANGES[range];
      filteredSpecs = allSpecs.filter(
        (spec) => (spec.createdAt?.getTime() || 0) >= threshold
      );
    }

    // Filter by search term
    if (searchTerm) {
      filteredSpecs = filteredSpecs.filter((spec) => {
        const user = this.store.getUser(spec.userId);
        const specTitle = (spec.title || "").toLowerCase();
        const userEmail = (user?.email || "").toLowerCase();
        const userName = (user?.displayName || "").toLowerCase();
        return specTitle.includes(searchTerm) || 
               userEmail.includes(searchTerm) || 
               userName.includes(searchTerm);
      });
    }

    // Sort chronologically (newest first)
    filteredSpecs.sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );

    if (filteredSpecs.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="12" class="table-empty">No specs found for selected criteria.</td>
        </tr>
      `;
      this.updateSpecUsageSummary({
        overviewOnly: 0,
        overviewTechnical: 0,
        overviewTechnicalMarket: 0,
        withDiagrams: 0,
        withDesign: 0,
        withPrompts: 0,
        withMockups: 0,
        withAiChat: 0,
        total: 0
      });
      return;
    }

    // Calculate statistics
    const stats = this.calculateSpecUsageStats(filteredSpecs);
    this.updateSpecUsageSummary(stats);

    // Render table rows
    const rows = filteredSpecs.map((spec) => {
      const user = this.store.getUser(spec.userId);
      // Use new user_credits system instead of old entitlements
      const userCredits = this.dataAggregator.aggregatedData.userCredits.get(spec.userId);
      const specData = spec.metadata || {};
      const status = specData.status || {};
      
      // Check which features are available
      const hasOverview = !!(specData.overview && status.overview === "ready");
      const hasTechnical = !!(specData.technical && status.technical === "ready");
      const hasMarket = !!(specData.market && status.market === "ready");
      const hasDesign = !!(specData.design && status.design === "ready");
      const hasDiagrams = !!(specData.diagrams?.generated === true);
      const hasPrompts = !!(specData.prompts && (
        Array.isArray(specData.prompts) ? specData.prompts.length > 0 :
        typeof specData.prompts === 'object' ? Object.keys(specData.prompts).length > 0 :
        false
      ));
      const hasMockups = !!(specData.mockups && (
        Array.isArray(specData.mockups) ? specData.mockups.length > 0 :
        typeof specData.mockups === 'object' ? Object.keys(specData.mockups || {}).length > 0 :
        false
      ));
      const hasAiChat = !!(specData.openaiAssistantId || specData.chatThreadId || specData.openaiFileId);
      const hasExport = false; // Export is not tracked, but we can check if user has exported based on other indicators
      
      // Check user type using new credits system
      const isPro = !!(userCredits?.unlimited || user?.plan === 'pro');
      const hasCredits = !!(userCredits && !userCredits.unlimited && userCredits.total > 0);
      
      // Build user info with badges
      let userInfo = user?.email || user?.displayName || spec.userId || "Unknown";
      const badges = [];
      if (isPro) badges.push('<span class="user-badge pro-badge" title="Pro User">Pro</span>');
      if (hasCredits) badges.push('<span class="user-badge credits-badge" title="Has Purchased Credits">Credits</span>');
      
      return `
        <tr class="spec-usage-row">
          <td>
            <strong>${spec.title || "Untitled Spec"}</strong>
          </td>
          <td>
            <div class="user-info-cell">
              <span class="user-info">${userInfo}</span>
              ${badges.length > 0 ? `<div class="user-badges">${badges.join('')}</div>` : ''}
            </div>
          </td>
          <td>
            <span class="date-info">${utils.formatDate(spec.createdAt)}</span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasOverview ? "active" : ""}" title="Overview">
              <i class="fas fa-${hasOverview ? "check-circle" : "circle"}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasTechnical ? "active" : ""}" title="Technical">
              <i class="fas fa-${hasTechnical ? "check-circle" : "circle"}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasMarket ? "active" : ""}" title="Market">
              <i class="fas fa-${hasMarket ? "check-circle" : "circle"}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasDesign ? "active" : ""}" title="Design">
              <i class="fas fa-${hasDesign ? "check-circle" : "circle"}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasDiagrams ? "active" : ""}" title="Diagrams">
              <i class="fas fa-${hasDiagrams ? "check-circle" : "circle"}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasPrompts ? "active" : ""}" title="Prompts">
              <i class="fas fa-${hasPrompts ? "check-circle" : "circle"}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasMockups ? "active" : ""}" title="Mockups">
              <i class="fas fa-${hasMockups ? "check-circle" : "circle"}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasAiChat ? "active" : ""}" title="AI Chat">
              <i class="fas fa-${hasAiChat ? "check-circle" : "circle"}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasExport ? "active" : ""}" title="Export">
              <i class="fas fa-${hasExport ? "check-circle" : "circle"}"></i>
            </span>
          </td>
        </tr>
      `;
    }).join("");

    container.innerHTML = rows;
  }

  calculateSpecUsageStats(specs) {
    const stats = {
      overviewOnly: 0,
      overviewTechnical: 0,
      overviewTechnicalMarket: 0,
      withDiagrams: 0,
      withDesign: 0,
      withPrompts: 0,
      withMockups: 0,
      withAiChat: 0,
      total: specs.length
    };

    specs.forEach((spec) => {
      const specData = spec.metadata || {};
      const status = specData.status || {};
      
      const hasOverview = !!(specData.overview && status.overview === "ready");
      const hasTechnical = !!(specData.technical && status.technical === "ready");
      const hasMarket = !!(specData.market && status.market === "ready");
      const hasDesign = !!(specData.design && status.design === "ready");
      const hasDiagrams = !!(specData.diagrams?.generated === true);
      const hasPrompts = !!(specData.prompts && (
        Array.isArray(specData.prompts) ? specData.prompts.length > 0 :
        typeof specData.prompts === 'object' ? Object.keys(specData.prompts).length > 0 :
        false
      ));
      const hasMockups = !!(specData.mockups && (
        Array.isArray(specData.mockups) ? specData.mockups.length > 0 :
        typeof specData.mockups === 'object' ? Object.keys(specData.mockups || {}).length > 0 :
        false
      ));
      const hasAiChat = !!(specData.openaiAssistantId || specData.chatThreadId || specData.openaiFileId);

      if (hasOverview && !hasTechnical && !hasMarket) {
        stats.overviewOnly++;
      }
      if (hasOverview && hasTechnical && !hasMarket) {
        stats.overviewTechnical++;
      }
      if (hasOverview && hasTechnical && hasMarket) {
        stats.overviewTechnicalMarket++;
      }
      if (hasDiagrams) {
        stats.withDiagrams++;
      }
      if (hasDesign) {
        stats.withDesign++;
      }
      if (hasPrompts) {
        stats.withPrompts++;
      }
      if (hasMockups) {
        stats.withMockups++;
      }
      if (hasAiChat) {
        stats.withAiChat++;
      }
    });

    return stats;
  }

  updateSpecUsageSummary(stats) {
    if (!this.dom.specUsageSummary) return;
    
    const overviewOnly = this.dom.specUsageSummary.querySelector('[data-metric="overview-only"]');
    const overviewTechnical = this.dom.specUsageSummary.querySelector('[data-metric="overview-technical"]');
    const overviewTechnicalMarket = this.dom.specUsageSummary.querySelector('[data-metric="overview-technical-market"]');
    const withDiagrams = this.dom.specUsageSummary.querySelector('[data-metric="with-diagrams"]');
    const withDesign = this.dom.specUsageSummary.querySelector('[data-metric="with-design"]');
    const withPrompts = this.dom.specUsageSummary.querySelector('[data-metric="with-prompts"]');
    const withMockups = this.dom.specUsageSummary.querySelector('[data-metric="with-mockups"]');
    const withAiChat = this.dom.specUsageSummary.querySelector('[data-metric="with-aichat"]');

    if (overviewOnly) overviewOnly.textContent = utils.formatNumber(stats.overviewOnly || 0);
    if (overviewTechnical) overviewTechnical.textContent = utils.formatNumber(stats.overviewTechnical || 0);
    if (overviewTechnicalMarket) overviewTechnicalMarket.textContent = utils.formatNumber(stats.overviewTechnicalMarket || 0);
    if (withDiagrams) withDiagrams.textContent = utils.formatNumber(stats.withDiagrams || 0);
    if (withDesign) withDesign.textContent = utils.formatNumber(stats.withDesign || 0);
    if (withPrompts) withPrompts.textContent = utils.formatNumber(stats.withPrompts || 0);
    if (withMockups) withMockups.textContent = utils.formatNumber(stats.withMockups || 0);
    if (withAiChat) withAiChat.textContent = utils.formatNumber(stats.withAiChat || 0);
    
    // Remove loading state
    const updateBtn = this.dom.updateButtons.specUsage;
    if (updateBtn) {
      updateBtn.classList.remove('loading');
      updateBtn.disabled = false;
    }
  }

  /**
   * Load and render funnel analysis data
   */
  async loadFunnelData() {
    if (!this.dom.funnelVisualization || !this.dom.funnelMetrics) return;
    
    const range = this.dom.funnelRange?.value || 'week';
    
    try {
      if (!window.api) {
        this.dom.funnelVisualization.innerHTML = '<div class="funnel-placeholder">API client not loaded</div>';
        return;
      }
      const response = await window.api.get(`/api/analytics/funnel?range=${range}`);
      
      if (response && response.success && response.funnel) {
        this.renderFunnelVisualization(response.funnel, response.conversions);
      } else {
        this.dom.funnelVisualization.innerHTML = '<div class="funnel-placeholder">No funnel data available</div>';
        this.dom.funnelMetrics.innerHTML = '<div class="funnel-metrics-placeholder">No conversion data available</div>';
      }
    } catch (error) {
      this.dom.funnelVisualization.innerHTML = '<div class="funnel-placeholder">Error loading funnel data</div>';
      this.dom.funnelMetrics.innerHTML = '<div class="funnel-metrics-placeholder">Error loading conversion data</div>';
    } finally {
      // Remove loading state
      const btn = this.dom.updateButtons.funnel;
      if (btn) {
        btn.classList.remove('loading');
        btn.disabled = false;
      }
    }
  }

  /**
   * Render funnel visualization
   */
  renderFunnelVisualization(funnel, conversions) {
    if (!this.dom.funnelVisualization) return;
    
    const steps = [
      { label: 'Visitors', value: funnel.visitors, color: '#3b82f6' },
      { label: 'Signups', value: funnel.signups, color: '#10b981' },
      { label: 'Pricing Views', value: funnel.pricingViews, color: '#f59e0b' },
      { label: 'Buy Now Clicks', value: funnel.buyNowClicks, color: '#ef4444' },
      { label: 'Checkout Initiated', value: funnel.checkoutInitiated, color: '#8b5cf6' },
      { label: 'Purchases', value: funnel.purchases, color: '#06b6d4' }
    ];
    
    const maxValue = Math.max(...steps.map(s => s.value), 1);
    
    const funnelHtml = `
      <div class="funnel-steps">
        ${steps.map((step, index) => {
          const width = maxValue > 0 ? (step.value / maxValue * 100) : 0;
          const conversion = index > 0 ? ((step.value / steps[index - 1].value) * 100).toFixed(1) : '100.0';
          return `
            <div class="funnel-step" style="--step-width: ${width}%">
              <div class="funnel-step-bar" style="background-color: ${step.color}; width: ${width}%">
                <span class="funnel-step-label">${step.label}</span>
                <span class="funnel-step-value">${utils.formatNumber(step.value)}</span>
              </div>
              ${index > 0 ? `<div class="funnel-conversion">${conversion}% conversion</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
    
    this.dom.funnelVisualization.innerHTML = funnelHtml;
    
    // Render conversion metrics
    if (this.dom.funnelMetrics) {
      const metricsHtml = `
        <div class="funnel-metrics-grid">
          <div class="funnel-metric">
            <span class="metric-label">Visitors → Signups</span>
            <span class="metric-value">${conversions.visitorsToSignups}%</span>
          </div>
          <div class="funnel-metric">
            <span class="metric-label">Signups → Pricing</span>
            <span class="metric-value">${conversions.signupsToPricing}%</span>
          </div>
          <div class="funnel-metric">
            <span class="metric-label">Pricing → Buy Now</span>
            <span class="metric-value">${conversions.pricingToBuyNow}%</span>
          </div>
          <div class="funnel-metric">
            <span class="metric-label">Buy Now → Checkout</span>
            <span class="metric-value">${conversions.buyNowToCheckout}%</span>
          </div>
          <div class="funnel-metric">
            <span class="metric-label">Checkout → Purchase</span>
            <span class="metric-value">${conversions.checkoutToPurchase}%</span>
          </div>
          <div class="funnel-metric highlight">
            <span class="metric-label">Overall Conversion</span>
            <span class="metric-value">${conversions.overallConversion}%</span>
          </div>
        </div>
      `;
      this.dom.funnelMetrics.innerHTML = metricsHtml;
    }
  }

  /**
   * Load and render content analytics (top articles and guides)
   */
  async loadContentAnalytics() {
    const updateBtn = this.dom.updateButtons.contentAnalytics;
    
    // Show loading state
    if (updateBtn) {
      updateBtn.classList.add('loading');
      updateBtn.disabled = true;
    }
    
    const range = this.dom.contentRange?.value || 'week';
    const contentType = this.dom.contentType?.value || 'both';
    
    try {
      // Load top articles
      if (contentType === 'both' || contentType === 'articles') {
        await this.loadTopArticles(range);
      } else if (this.dom.topArticlesList) {
        this.dom.topArticlesList.innerHTML = '<div class="content-placeholder">Hidden</div>';
      }
      
      // Load top guides
      if (contentType === 'both' || contentType === 'guides') {
        await this.loadTopGuides(range);
      } else if (this.dom.topGuidesList) {
        this.dom.topGuidesList.innerHTML = '<div class="content-placeholder">Hidden</div>';
      }
    } catch (error) {
      // Failed to load content analytics
    } finally {
      // Remove loading state
      if (updateBtn) {
        updateBtn.classList.remove('loading');
        updateBtn.disabled = false;
      }
    }
  }

  /**
   * Load top articles
   */
  async loadTopArticles(range) {
    if (!this.dom.topArticlesList) return;
    
    try {
      if (!window.api) {
        this.dom.topArticlesList.innerHTML = '<div class="content-placeholder">API client not loaded</div>';
        return;
      }
      const response = await window.api.get(`/api/analytics/top-articles?range=${range}&limit=10`);
      
      if (response && response.success && response.articles) {
        this.renderTopArticles(response.articles);
        if (this.dom.topArticlesSubtitle) {
          this.dom.topArticlesSubtitle.textContent = `Top ${response.articles.length} by views (${range})`;
        }
      } else {
        this.dom.topArticlesList.innerHTML = '<div class="content-placeholder">No articles data available</div>';
      }
    } catch (error) {
      this.dom.topArticlesList.innerHTML = '<div class="content-placeholder">Error loading articles</div>';
    }
  }

  /**
   * Render top articles list
   */
  renderTopArticles(articles) {
    if (!this.dom.topArticlesList) return;
    
    if (articles.length === 0) {
      this.dom.topArticlesList.innerHTML = '<div class="content-placeholder">No articles found</div>';
      return;
    }
    
    const html = articles.map((article, index) => `
      <div class="top-content-item">
        <div class="content-rank">#${index + 1}</div>
        <div class="content-info">
          <h4 class="content-title">${article.title || 'Untitled'}</h4>
          <div class="content-meta">
            <span class="content-views">
              <i class="fas fa-eye"></i>
              ${utils.formatNumber(article.views)} views
            </span>
            ${article.totalViews ? `<span class="content-total">Total: ${utils.formatNumber(article.totalViews)}</span>` : ''}
          </div>
        </div>
        <div class="content-actions">
          <a href="/article.html?slug=${article.slug}" target="_blank" class="action-link" title="View article">
            <i class="fas fa-external-link-alt"></i>
          </a>
        </div>
      </div>
    `).join('');
    
    this.dom.topArticlesList.innerHTML = html;
  }

  /**
   * Load top guides
   */
  async loadTopGuides(range) {
    if (!this.dom.topGuidesList) return;
    
    try {
      if (!window.api) {
        this.dom.topGuidesList.innerHTML = '<div class="content-placeholder">API client not loaded</div>';
        return;
      }
      const response = await window.api.get(`/api/analytics/top-guides?range=${range}&limit=10`);
      
      if (response && response.success && response.guides) {
        this.renderTopGuides(response.guides);
        if (this.dom.topGuidesSubtitle) {
          this.dom.topGuidesSubtitle.textContent = `Top ${response.guides.length} by views (${range})`;
        }
      } else {
        this.dom.topGuidesList.innerHTML = '<div class="content-placeholder">No guides data available</div>';
      }
    } catch (error) {
      this.dom.topGuidesList.innerHTML = '<div class="content-placeholder">Error loading guides</div>';
    }
  }

  /**
   * Render top guides list
   */
  renderTopGuides(guides) {
    if (!this.dom.topGuidesList) return;
    
    if (guides.length === 0) {
      this.dom.topGuidesList.innerHTML = '<div class="content-placeholder">No guides found</div>';
      return;
    }
    
    const html = guides.map((guide, index) => `
      <div class="top-content-item">
        <div class="content-rank">#${index + 1}</div>
        <div class="content-info">
          <h4 class="content-title">${guide.title || 'Untitled'}</h4>
          <div class="content-meta">
            <span class="content-views">
              <i class="fas fa-eye"></i>
              ${utils.formatNumber(guide.views)} views
            </span>
            ${guide.totalViews ? `<span class="content-total">Total: ${utils.formatNumber(guide.totalViews)}</span>` : ''}
          </div>
        </div>
        <div class="content-actions">
          <a href="/pages/academy/guide.html?id=${guide.id}" target="_blank" class="action-link" title="View guide">
            <i class="fas fa-external-link-alt"></i>
          </a>
        </div>
      </div>
    `).join('');
    
    this.dom.topGuidesList.innerHTML = html;
  }
}

async function loadChartJsWithFallback() {
  const cdnSources = [
    "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js",
    "https://unpkg.com/chart.js@4.4.4/dist/chart.umd.min.js"
  ];

  for (const src of cdnSources) {
    try {
      await loadExternalScript(src);
      if (window.Chart) {
        ChartLib = window.Chart;
        console.log("Chart.js loaded successfully from:", src);
        return true;
      }
    } catch (error) {
      console.warn("Failed to load Chart.js from:", src, error);
      continue;
    }
  }
  
  console.error("Chart.js failed to load from all CDN sources. Charts will not be available.");
  return false;
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadChartJsWithFallback();
  window.adminDashboard = new AdminDashboardApp();
});

