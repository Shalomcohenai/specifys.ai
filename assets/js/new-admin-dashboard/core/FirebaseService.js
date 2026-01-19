/**
 * Firebase Service - Reliable connection management
 * Handles all Firebase operations with retry logic and connection pooling
 */

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
  updateDoc,
  serverTimestamp,
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
  USER_CREDITS: "user_credits_v3",  // V3: Single source of truth
  SPECS: "specs",
  PURCHASES: "purchases",
  SUBSCRIPTIONS: "subscriptions_v3",  // V3: Archive/logs only
  CREDITS_TRANSACTIONS: "credit_ledger_v3",  // V3: Credit ledger
  ACTIVITY_LOGS: "activityLogs",
  ERROR_LOGS: "errorLogs",
  CSS_CRASH_LOGS: "cssCrashLogs",
  BLOG_QUEUE: "blogQueue",
  CONTACT_SUBMISSIONS: "contactSubmissions"
});

const ADMIN_EMAILS = new Set([
  "specifysai@gmail.com",
  // Only specifysai@gmail.com has admin access
]);

export class FirebaseService {
  constructor() {
    // Initialize Firebase app if not already initialized
    if (getApps().length === 0) {
      this.app = initializeApp(firebaseConfig);
    } else {
      this.app = getApps()[0];
    }
    
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    
    // Make auth available globally for credits-v2-display.js compatibility
    if (typeof window !== 'undefined') {
      window.auth = this.auth;
      // Also create firebase compat object for credits-v2-display.js
      if (!window.firebase) {
        window.firebase = {
          auth: () => this.auth,
          initializeApp: () => this.app
        };
      }
    }
    
    // Connection management
    this.connections = new Map();
    this.retryConfig = {
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 30000
    };
    
    // Connection state
    this.connectionState = {
      online: false,
      retrying: false,
      lastError: null
    };
    
    // Event listeners
    this.connectionListeners = [];
    
    // Monitor connection
    this.setupConnectionMonitoring();
  }
  
  /**
   * Setup connection monitoring
   */
  setupConnectionMonitoring() {
    // Monitor online/offline
    window.addEventListener('online', () => {
      this.connectionState.online = true;
      this.notifyConnectionChange();
    });
    
    window.addEventListener('offline', () => {
      this.connectionState.online = false;
      this.notifyConnectionChange();
    });
    
    // Initial state
    this.connectionState.online = navigator.onLine;
  }
  
  /**
   * Subscribe to connection state changes
   */
  onConnectionChange(callback) {
    this.connectionListeners.push(callback);
  }
  
  /**
   * Notify connection state change
   */
  notifyConnectionChange() {
    this.connectionListeners.forEach(callback => {
      try {
        callback(this.connectionState);
      } catch (error) {
        console.error('[FirebaseService] Error in connection listener:', error);
      }
    });
  }
  
  /**
   * Subscribe to collection with retry logic
   */
  async subscribe(collectionName, callback, options = {}, errorCallback = null) {
    const {
      orderByField = null,
      orderDirection = 'desc',
      whereClause = null,
      limitCount = null,
      retryCount = 0
    } = options;
    
    const connectionKey = `${collectionName}_${JSON.stringify(options)}`;
    
    // Return existing connection if available
    if (this.connections.has(connectionKey)) {
      return this.connections.get(connectionKey);
    }
    
    try {
      let collectionRef = collection(this.db, collectionName);
      
      // Build query
      const constraints = [];
      if (whereClause) {
        constraints.push(where(whereClause.field, whereClause.operator, whereClause.value));
      }
      if (orderByField) {
        constraints.push(orderBy(orderByField, orderDirection));
      }
      if (limitCount) {
        constraints.push(limit(limitCount));
      }
      
      const q = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;
      
      // Create snapshot listener
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          this.connectionState.online = true;
          this.connectionState.retrying = false;
          this.connectionState.lastError = null;
          this.notifyConnectionChange();
          
          try {
            callback(snapshot);
          } catch (error) {
            console.error(`[FirebaseService] Error in callback for ${collectionName}:`, error);
          }
        },
        (error) => {
          // Don't retry on permission errors
          if (error?.code === 'permission-denied') {
            // Permission denied
            if (errorCallback) {
              errorCallback(error);
            }
            return;
          }
          
          console.error(`[FirebaseService] Error subscribing to ${collectionName}:`, error);
          this.connectionState.lastError = error;
          this.notifyConnectionChange();
          
          if (errorCallback) {
            errorCallback(error);
          }
          
          // Retry on error (but not permission errors)
          if (retryCount < this.retryConfig.maxRetries) {
            this.connectionState.retrying = true;
            this.notifyConnectionChange();
            
            const delay = Math.min(
              this.retryConfig.baseDelay * Math.pow(2, retryCount),
              this.retryConfig.maxDelay
            );
            
            setTimeout(() => {
              this.connections.delete(connectionKey);
              this.subscribe(collectionName, callback, {
                ...options,
                retryCount: retryCount + 1
              }, errorCallback);
            }, delay);
          }
        }
      );
      
      this.connections.set(connectionKey, unsubscribe);
      return unsubscribe;
      
    } catch (error) {
      // Don't retry on permission errors
      if (error?.code === 'permission-denied') {
        // Permission denied
        if (errorCallback) {
          errorCallback(error);
        }
        return null;
      }
      
      console.error(`[FirebaseService] Failed to subscribe to ${collectionName}:`, error);
      this.connectionState.lastError = error;
      this.notifyConnectionChange();
      
      if (errorCallback) {
        errorCallback(error);
      }
      
      // Retry
      if (retryCount < this.retryConfig.maxRetries) {
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, retryCount),
          this.retryConfig.maxDelay
        );
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(this.subscribe(collectionName, callback, {
              ...options,
              retryCount: retryCount + 1
            }, errorCallback));
          }, delay);
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Unsubscribe from collection
   */
  unsubscribe(collectionName, options = {}) {
    const connectionKey = `${collectionName}_${JSON.stringify(options)}`;
    const unsubscribe = this.connections.get(connectionKey);
    
    if (unsubscribe) {
      unsubscribe();
      this.connections.delete(connectionKey);
    }
  }
  
  /**
   * Unsubscribe from all connections
   */
  unsubscribeAll() {
    this.connections.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        console.error('[FirebaseService] Error unsubscribing:', error);
      }
    });
    this.connections.clear();
  }
  
  /**
   * Get single document
   */
  async getDocument(collectionName, docId) {
    try {
      const docRef = doc(this.db, collectionName, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error(`[FirebaseService] Error getting document ${collectionName}/${docId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get multiple documents
   */
  async getDocuments(collectionName, options = {}) {
    try {
      let collectionRef = collection(this.db, collectionName);
      
      const constraints = [];
      if (options.whereClause) {
        constraints.push(where(options.whereClause.field, options.whereClause.operator, options.whereClause.value));
      }
      if (options.orderByField) {
        constraints.push(orderBy(options.orderByField, options.orderDirection || 'desc'));
      }
      if (options.limitCount) {
        constraints.push(limit(options.limitCount));
      }
      
      const q = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error(`[FirebaseService] Error getting documents from ${collectionName}:`, error);
      throw error;
    }
  }
  
  /**
   * Check if user is admin
   */
  isAdmin(email) {
    if (!email) return false;
    return ADMIN_EMAILS.has(email.toLowerCase());
  }
  
  /**
   * Get auth state
   */
  getAuth() {
    return this.auth;
  }
  
  /**
   * Get current user
   */
  getCurrentUser() {
    return this.auth.currentUser;
  }
  
  /**
   * Sign out
   */
  async signOut() {
    try {
      await signOut(this.auth);
    } catch (error) {
      console.error('[FirebaseService] Error signing out:', error);
      throw error;
    }
  }
  
  /**
   * On auth state changed
   */
  onAuthStateChanged(callback) {
    return onAuthStateChanged(this.auth, callback);
  }
  
  /**
   * Get collections constant
   */
  getCollections() {
    return COLLECTIONS;
  }
  
  /**
   * Get Firestore database instance
   */
  getDb() {
    return this.db;
  }
  
  /**
   * Delete document
   */
  async deleteDocument(collectionName, documentId) {
    const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const docRef = doc(this.db, collectionName, documentId);
    await deleteDoc(docRef);
  }
  
  /**
   * Update user document
   */
  async updateUser(userId, updates) {
    const userRef = doc(this.db, COLLECTIONS.USERS, userId);
    
    // Prepare update object
    const updateData = {
      ...updates,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(userRef, updateData);
    return updateData;
  }
  
  /**
   * Update user credits (free_specs_remaining)
   */
  async updateUserCredits(userId, credits) {
    return this.updateUser(userId, {
      free_specs_remaining: credits
    });
  }
  
  /**
   * Update user plan
   */
  async updateUserPlan(userId, plan) {
    if (!['free', 'pro'].includes(plan)) {
      throw new Error('Invalid plan. Must be "free" or "pro"');
    }
    
    return this.updateUser(userId, {
      plan: plan
    });
  }
}

// Export singleton instance - Initialize immediately
export const firebaseService = new FirebaseService();

// Make sure Firebase is available globally for credits-v2-display.js
if (typeof window !== 'undefined') {
  // Ensure auth is available
  if (!window.auth) {
    window.auth = firebaseService.auth;
  }
  
  // Ensure firebase compat object exists
  if (!window.firebase) {
    window.firebase = {
      auth: () => firebaseService.auth,
      initializeApp: () => firebaseService.app
    };
  }
  
  // Dispatch firebase-ready event
  window.dispatchEvent(new Event('firebase-ready'));
}

