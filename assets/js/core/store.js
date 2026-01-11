/**
 * Simple State Management
 * Centralized state management for the application
 */

(function() {
  'use strict';

  class Store {
    constructor(initialState = {}) {
      this.state = { ...initialState };
      this.listeners = [];
      this.middleware = [];
    }

    /**
     * Get current state
     */
    getState() {
      return { ...this.state };
    }

    /**
     * Get specific state key
     */
    get(key) {
      return this.state[key];
    }

    /**
     * Update state
     */
    setState(newState) {
      const prevState = { ...this.state };
      
      // Apply middleware
      let processedState = newState;
      for (const middleware of this.middleware) {
        processedState = middleware(prevState, processedState) || processedState;
      }
      
      this.state = { ...this.state, ...processedState };
      this.notify(prevState, this.state);
    }

    /**
     * Set specific state key
     */
    set(key, value) {
      this.setState({ [key]: value });
    }

    /**
     * Subscribe to state changes
     */
    subscribe(callback, keys = null) {
      const listener = {
        callback,
        keys: keys ? (Array.isArray(keys) ? keys : [keys]) : null
      };
      
      this.listeners.push(listener);
      
      // Return unsubscribe function
      return () => {
        this.listeners = this.listeners.filter(l => l !== listener);
      };
    }

    /**
     * Notify all listeners of state changes
     */
    notify(prevState, newState) {
      this.listeners.forEach(listener => {
        // If listener has specific keys, only notify if those keys changed
        if (listener.keys) {
          const hasChanges = listener.keys.some(key => 
            prevState[key] !== newState[key]
          );
          if (hasChanges) {
            listener.callback(newState, prevState);
          }
        } else {
          // Notify for any state change
          listener.callback(newState, prevState);
        }
      });
    }

    /**
     * Add middleware
     */
    use(middleware) {
      this.middleware.push(middleware);
    }

    /**
     * Reset state to initial
     */
    reset() {
      const prevState = { ...this.state };
      this.state = {};
      this.notify(prevState, this.state);
    }

    /**
     * Clear all listeners
     */
    clearListeners() {
      this.listeners = [];
    }
  }

  // Create global store with initial state
  const initialState = {
    user: null,
    specs: [],
    credits: 0,
    entitlements: {},
    loading: false,
    currentSpec: null,
    error: null
  };

  window.store = new Store(initialState);

  // Expose class for advanced usage
  window.Store = Store;

})();


