/**
 * State Manager - Application state management
 * Simple state management with event system
 */

export class StateManager {
  constructor() {
    this.state = {
      // UI State
      activeSection: 'overview-section',
      loading: {},
      errors: {},
      
      // Data State
      users: [],
      userCredits: [],
      specs: [],
      purchases: [],
      activityLogs: [],
      contactSubmissions: [],
      
      // UI Preferences
      overviewRange: 'week',
      activityFilter: 'all',
      usersPage: 1,
      usersPerPage: 25,
      
      // Connection
      connectionStatus: 'pending',
      lastSync: null
    };
    
    this.listeners = new Map();
  }
  
  /**
   * Get state
   */
  getState(path = null) {
    if (!path) return this.state;
    
    const keys = path.split('.');
    let value = this.state;
    
    for (const key of keys) {
      if (value === null || value === undefined) return undefined;
      value = value[key];
    }
    
    return value;
  }
  
  /**
   * Set state
   */
  setState(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = this.state;
    
    for (const key of keys) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }
    
    const oldValue = target[lastKey];
    target[lastKey] = value;
    
    // Emit change event
    this.emit('change', { path, value, oldValue });
    this.emit(`change:${path}`, { value, oldValue });
  }
  
  /**
   * Update state (merge)
   */
  updateState(updates) {
    Object.keys(updates).forEach(key => {
      this.setState(key, updates[key]);
    });
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(path, callback) {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, []);
    }
    this.listeners.get(path).push(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(path);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }
  
  /**
   * Emit event
   */
  emit(event, data) {
    // Emit to specific path listeners
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[StateManager] Error in listener for ${event}:`, error);
        }
      });
    }
    
    // Emit to wildcard listeners
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach(callback => {
        try {
          callback({ event, data });
        } catch (error) {
          console.error(`[StateManager] Error in wildcard listener:`, error);
        }
      });
    }
  }
  
  /**
   * Reset state
   */
  reset() {
    this.state = {
      activeSection: 'overview-section',
      loading: {},
      errors: {},
      users: [],
      userCredits: [],
      specs: [],
      purchases: [],
      activityLogs: [],
      contactSubmissions: [],
      overviewRange: 'week',
      activityFilter: 'all',
      usersPage: 1,
      usersPerPage: 25,
      connectionStatus: 'pending',
      lastSync: null
    };
    
    this.emit('reset');
  }
}

