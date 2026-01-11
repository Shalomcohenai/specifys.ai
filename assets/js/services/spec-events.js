/**
 * Spec Event Listener
 * Listens to Firestore real-time updates for spec changes
 */
class SpecEventListener {
  constructor(specId) {
    this.specId = specId;
    this.unsubscribe = null;
    this.callbacks = {
      onUpdate: [],
      onStageComplete: [],
      onError: []
    };
  }

  /**
   * Setup Firestore real-time listener
   * @param {Function} onUpdate - Callback for spec updates
   */
  setupListeners(onUpdate) {
    if (!this.specId || !window.firebase || !window.firebase.firestore) {
      return;
    }

    // Cleanup existing listener
    this.cleanup();

    // Setup new listener
    this.unsubscribe = window.firebase.firestore()
      .collection('specs')
      .doc(this.specId)
      .onSnapshot((doc) => {
        if (doc.exists) {
          const specData = doc.data();
          this.handleSpecUpdate(specData, onUpdate);
        }
      }, (error) => {
        // Error listening to spec updates
      });
  }

  /**
   * Handle spec update from Firestore
   * @param {Object} specData - Spec data from Firestore
   * @param {Function} onUpdate - Update callback
   */
  handleSpecUpdate(specData, onUpdate) {
    if (!specData || !specData.status) {
      return;
    }

    const status = specData.status;

    // Check each stage
    ['technical', 'market', 'design'].forEach(stage => {
      if (status[stage] === 'ready' && specData[stage]) {
        // Stage completed
        this.triggerStageComplete(stage, specData[stage]);
      } else if (status[stage] === 'error') {
        // Stage error
        this.triggerError(stage, new Error(`${stage} generation failed`));
      }
    });

    // Call general update callback
    if (onUpdate && typeof onUpdate === 'function') {
      onUpdate(specData);
    }

    // Trigger registered callbacks
    this.callbacks.onUpdate.forEach(callback => {
      try {
        callback(specData);
      } catch (error) {
        // Error in onUpdate callback
      }
    });
  }

  /**
   * Trigger stage complete event
   * @param {string} stage - Stage name
   * @param {string} content - Stage content
   */
  triggerStageComplete(stage, content) {
    this.callbacks.onStageComplete.forEach(callback => {
      try {
        callback(stage, content);
      } catch (error) {
        // Error in onStageComplete callback
      }
    });
  }

  /**
   * Trigger error event
   * @param {string} stage - Stage name
   * @param {Error} error - Error object
   */
  triggerError(stage, error) {
    this.callbacks.onError.forEach(callback => {
      try {
        callback(stage, error);
      } catch (error) {
        // Error in onError callback
      }
    });
  }

  /**
   * Register callback for spec updates
   * @param {Function} callback - Callback function
   */
  onUpdate(callback) {
    if (typeof callback === 'function') {
      this.callbacks.onUpdate.push(callback);
    }
  }

  /**
   * Register callback for stage completion
   * @param {Function} callback - Callback function
   */
  onStageComplete(callback) {
    if (typeof callback === 'function') {
      this.callbacks.onStageComplete.push(callback);
    }
  }

  /**
   * Register callback for errors
   * @param {Function} callback - Callback function
   */
  onError(callback) {
    if (typeof callback === 'function') {
      this.callbacks.onError.push(callback);
    }
  }

  /**
   * Cleanup listeners
   */
  cleanup() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    // Clear callbacks
    this.callbacks = {
      onUpdate: [],
      onStageComplete: [],
      onError: []
    };
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.SpecEventListener = SpecEventListener;
}




