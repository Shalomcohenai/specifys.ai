const EventEmitter = require('events');

/**
 * Event emitter for spec generation events
 * Allows decoupled communication between spec generation and other services
 */
class SpecEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Allow many listeners
  }

  /**
   * Emit spec update event
   * @param {string} specId - Spec ID
   * @param {string} stage - Stage name (technical, market, design)
   * @param {string} status - Status (generating, ready, error)
   * @param {string|null} content - Content (null if status is generating/error)
   */
  emitSpecUpdate(specId, stage, status, content = null) {
    this.emit('spec.update', { 
      specId, 
      stage, 
      status, 
      content,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit spec generation complete event
   * @param {string} specId - Spec ID
   * @param {Object} results - Results object with technical, market, design
   */
  emitSpecComplete(specId, results) {
    this.emit('spec.complete', { 
      specId, 
      results,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit spec generation error event
   * @param {string} specId - Spec ID
   * @param {string} stage - Stage that failed
   * @param {Error} error - Error object
   */
  emitSpecError(specId, stage, error) {
    this.emit('spec.error', { 
      specId, 
      stage, 
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new SpecEventEmitter();




<<<<<<< Updated upstream
=======


>>>>>>> Stashed changes
