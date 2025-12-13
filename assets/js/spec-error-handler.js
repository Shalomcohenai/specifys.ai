/**
 * Spec Error Handler
 * Handles errors during spec generation with recovery strategies
 */
class SpecErrorHandler {
  /**
   * Handle generation errors from Promise.allSettled results
   * @param {Array} results - Results from Promise.allSettled
   * @param {Object} options - Options object
   * @param {Function} options.displayStage - Function to display stage content
   * @param {Function} options.displayError - Function to display error
   * @param {Function} options.showNotification - Function to show notification
   * @returns {Object} Processed results with successes and errors
   */
  static handleGenerationErrors(results, options = {}) {
    const {
      displayStage = () => {},
      displayError = () => {},
      showNotification = () => {}
    } = options;

    const stages = ['technical', 'market', 'design'];
    const errors = [];
    const successes = [];

    results.forEach((result, index) => {
      const stage = stages[index];

      if (result.status === 'fulfilled') {
        successes.push({ stage, content: result.value });
        // Display successful stage
        if (displayStage) {
          displayStage(stage, result.value);
        }
      } else {
        const errorInfo = {
          stage,
          error: result.reason,
          retryable: this.isRetryable(result.reason)
        };
        errors.push(errorInfo);

        // Display error
        if (displayError) {
          displayError(stage, errorInfo);
        }
      }
    });

    // Show summary notification
    if (errors.length === 0) {
      showNotification('All specifications generated successfully!', 'success');
    } else if (successes.length === 0) {
      showNotification('All specifications failed to generate. Please try again.', 'error');
    } else {
      showNotification(
        `${successes.length} specification(s) generated successfully, ${errors.length} failed. You can retry the failed ones.`,
        'warning'
      );
    }

    return { successes, errors };
  }

  /**
   * Check if error is retryable
   * @param {Error} error - Error object
   * @returns {boolean} True if retryable
   */
  static isRetryable(error) {
    if (!error || !error.message) {
      return false;
    }

    const retryablePatterns = [
      'timeout',
      'network',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'AbortError',
      'Failed to fetch',
      'NetworkError',
      'fetch'
    ];

    const errorMessage = error.message.toLowerCase();
    return retryablePatterns.some(pattern => errorMessage.includes(pattern.toLowerCase()));
  }

  /**
   * Get user-friendly error message
   * @param {Error} error - Error object
   * @returns {string} User-friendly message
   */
  static getErrorMessage(error) {
    if (!error || !error.message) {
      return 'An unknown error occurred';
    }

    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('abort')) {
      return 'Request timed out. Please try again.';
    }

    if (message.includes('network') || message.includes('fetch') || message.includes('econnrefused')) {
      return 'Network error. Please check your connection and try again.';
    }

    if (message.includes('unauthorized') || message.includes('401')) {
      return 'Authentication required. Please log in and try again.';
    }

    if (message.includes('forbidden') || message.includes('403')) {
      return 'You do not have permission to perform this action.';
    }

    if (message.includes('not found') || message.includes('404')) {
      return 'Resource not found.';
    }

    if (message.includes('server error') || message.includes('500')) {
      return 'Server error. Please try again later.';
    }

    // Return original message if no pattern matches
    return error.message;
  }

  /**
   * Create retry button element
   * @param {string} stage - Stage name
   * @param {Function} onRetry - Retry callback
   * @returns {HTMLElement} Button element
   */
  static createRetryButton(stage, onRetry) {
    const button = document.createElement('button');
    button.className = 'retry-btn';
    button.textContent = `Retry ${stage.charAt(0).toUpperCase() + stage.slice(1)}`;
    button.onclick = () => {
      button.disabled = true;
      button.textContent = 'Retrying...';
      if (onRetry) {
        onRetry().finally(() => {
          button.disabled = false;
          button.textContent = `Retry ${stage.charAt(0).toUpperCase() + stage.slice(1)}`;
        });
      }
    };
    return button;
  }

  /**
   * Display error in UI
   * @param {string} stage - Stage name
   * @param {Object} errorInfo - Error info object
   * @param {HTMLElement} container - Container element to display error in
   * @param {Function} onRetry - Retry callback
   */
  static displayErrorInUI(stage, errorInfo, container, onRetry) {
    if (!container) {
      // Container element not provided
      return;
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'spec-error-message';
    errorDiv.innerHTML = `
      <div class="error-icon">⚠️</div>
      <div class="error-content">
        <h3>${stage.charAt(0).toUpperCase() + stage.slice(1)} Generation Failed</h3>
        <p>${this.getErrorMessage(errorInfo.error)}</p>
        ${errorInfo.retryable ? '<p class="retry-hint">This error might be temporary. You can try again.</p>' : ''}
      </div>
    `;

    if (errorInfo.retryable && onRetry) {
      const retryButton = this.createRetryButton(stage, onRetry);
      errorDiv.querySelector('.error-content').appendChild(retryButton);
    }

    container.appendChild(errorDiv);
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.SpecErrorHandler = SpecErrorHandler;
}




