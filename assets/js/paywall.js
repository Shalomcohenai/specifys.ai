/**
 * Paywall Manager
 * Handles the display and interaction of the paywall modal
 */

class PaywallManager {
    constructor() {
        this.isInitialized = false;
        this.modal = null;
        this.currentCallback = null;
        this.pollingInterval = null;
        this.pollingTimeout = null;
    }

    /**
     * Initialize the paywall manager
     */
    init() {
        if (this.isInitialized) return;
        
        this.createModal();
        this.isInitialized = true;
    }

    /**
     * Create the paywall modal HTML
     */
    createModal() {
        // Remove existing modal if any
        const existingModal = document.getElementById('paywall-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalHTML = `
            <div id="paywall-modal" class="paywall-modal" style="display: none;">
                <div class="paywall-overlay"></div>
                <div class="paywall-content">
                    <div class="paywall-header">
                        <h2>Upgrade to Continue</h2>
                        <button class="paywall-close" onclick="window.paywallManager.hidePaywall()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="paywall-body">
                        <p class="paywall-message">You need to purchase credits to create more specifications</p>
                        <div class="paywall-options" id="paywall-options">
                            <!-- Options will be populated dynamically -->
                        </div>
                        <div class="paywall-processing" id="paywall-processing" style="display: none;">
                            <div class="processing-spinner"></div>
                            <p>Processing your purchase...</p>
                            <p class="processing-note">This may take a few moments</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('paywall-modal');
    }

    /**
     * Show the paywall modal
     * @param {Object} paywallData - Paywall data from API
     * @param {Function} successCallback - Callback for successful purchase
     */
    showPaywall(paywallData, successCallback) {
        this.init();
        this.currentCallback = successCallback;

        // Update message
        const messageEl = this.modal.querySelector('.paywall-message');
        if (messageEl && paywallData.message) {
            messageEl.textContent = paywallData.message;
        }

        // Populate options
        this.populateOptions(paywallData.options || []);

        // Show modal
        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Add escape key listener
        this.escapeKeyListener = (e) => {
            if (e.key === 'Escape') {
                this.hidePaywall();
            }
        };
        document.addEventListener('keydown', this.escapeKeyListener);
    }

    /**
     * Hide the paywall modal
     */
    hidePaywall() {
        if (this.modal) {
            this.modal.style.display = 'none';
            document.body.style.overflow = '';
        }

        // Remove escape key listener
        if (this.escapeKeyListener) {
            document.removeEventListener('keydown', this.escapeKeyListener);
            this.escapeKeyListener = null;
        }

        // Stop polling if active
        this.stopPolling();

        this.currentCallback = null;
    }

    /**
     * Populate payment options
     * @param {Array} options - Payment options
     */
    populateOptions(options) {
        const optionsContainer = document.getElementById('paywall-options');
        if (!optionsContainer) return;

        optionsContainer.innerHTML = '';

        options.forEach(option => {
            const optionHTML = `
                <div class="paywall-option" data-option-id="${option.id}">
                    <div class="option-header">
                        <h3>${option.name}</h3>
                        <div class="option-price">
                            <span class="currency">₪</span>
                            <span class="amount">${option.price}</span>
                        </div>
                    </div>
                    <div class="option-description">
                        ${option.description}
                    </div>
                    <button class="option-button" onclick="window.paywallManager.selectOption('${option.id}')">
                        ${option.id.includes('pro') ? 'Subscribe' : 'Buy Now'}
                    </button>
                </div>
            `;
            optionsContainer.insertAdjacentHTML('beforeend', optionHTML);
        });
    }

    /**
     * Handle option selection
     * @param {string} optionId - Selected option ID
     */
    async selectOption(optionId) {
        try {
            // Show processing state
            this.showProcessing();

            // Get Lemon Squeezy checkout URL
            const config = await this.getLemonConfig();
            const product = config.products[optionId];
            
            if (!product) {
                throw new Error('Product not found');
            }

            // Track the purchase attempt
            this.trackPurchaseAttempt(optionId);

            // Open Lemon Squeezy checkout
            const checkoutUrl = `https://${config.lemon_store_id}.lemonsqueezy.com/buy/${product.variant_id}`;
            
            // Open in new window
            const checkoutWindow = window.open(checkoutUrl, '_blank', 'width=600,height=700,scrollbars=yes,resizable=yes');
            
            if (!checkoutWindow) {
                throw new Error('Popup blocked. Please allow popups for this site.');
            }

            // Start polling for purchase completion
            this.startPolling();

        } catch (error) {
            console.error('Error initiating purchase:', error);
            this.hideProcessing();
            alert('Error initiating purchase. Please try again.');
        }
    }

    /**
     * Show processing state
     */
    showProcessing() {
        const optionsContainer = document.getElementById('paywall-options');
        const processingContainer = document.getElementById('paywall-processing');
        
        if (optionsContainer) optionsContainer.style.display = 'none';
        if (processingContainer) processingContainer.style.display = 'block';
    }

    /**
     * Hide processing state
     */
    hideProcessing() {
        const optionsContainer = document.getElementById('paywall-options');
        const processingContainer = document.getElementById('paywall-processing');
        
        if (optionsContainer) optionsContainer.style.display = 'grid';
        if (processingContainer) processingContainer.style.display = 'none';
    }

    /**
     * Start polling for purchase completion
     */
    startPolling() {
        this.stopPolling(); // Clear any existing polling

        let pollCount = 0;
        const maxPolls = 30; // 30 polls * 2 seconds = 60 seconds max
        const pollInterval = 2000; // 2 seconds

        this.pollingInterval = setInterval(async () => {
            pollCount++;
            
            try {
                const user = firebase.auth().currentUser;
                if (!user) {
                    this.stopPolling();
                    return;
                }

                const token = await user.getIdToken();
                const response = await fetch('http://localhost:3001/api/specs/entitlements', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    const { entitlements, user: userData } = data;

                    // Check if user got new credits or Pro access
                    const hasNewCredits = entitlements.spec_credits > 0 || entitlements.unlimited || userData.free_specs_remaining > 0;
                    
                    if (hasNewCredits) {
                        console.log('Purchase detected! Credits updated:', data);
                        this.stopPolling();
                        this.hidePaywall();
                        
                        // Call success callback
                        if (this.currentCallback) {
                            this.currentCallback(data);
                        }
                        return;
                    }
                }

                // Check if we've exceeded max polls
                if (pollCount >= maxPolls) {
                    console.log('Polling timeout reached');
                    this.stopPolling();
                    this.hideProcessing();
                    alert('Purchase processing is taking longer than expected. Please refresh the page to check your credits.');
                }

            } catch (error) {
                console.error('Error polling for purchase:', error);
                // Continue polling on error
            }
        }, pollInterval);

        // Set timeout to stop polling
        this.pollingTimeout = setTimeout(() => {
            this.stopPolling();
        }, maxPolls * pollInterval);
    }

    /**
     * Stop polling
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        
        if (this.pollingTimeout) {
            clearTimeout(this.pollingTimeout);
            this.pollingTimeout = null;
        }
    }

    /**
     * Get Lemon Squeezy configuration
     */
    async getLemonConfig() {
        try {
            const response = await fetch('/config/lemon-products.json');
            return await response.json();
        } catch (error) {
            console.error('Error loading Lemon config:', error);
            throw error;
        }
    }

    /**
     * Track purchase attempt
     * @param {string} optionId - Option ID
     */
    trackPurchaseAttempt(optionId) {
        if (typeof gtag !== 'undefined') {
            gtag('event', 'purchase_attempt', {
                'event_category': 'Paywall',
                'event_label': optionId,
                'option_id': optionId
            });
        }
    }
}

// Global instance
window.paywallManager = new PaywallManager();

// CSS Styles
const paywallStyles = `
<style>
.paywall-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.paywall-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
}

.paywall-content {
    position: relative;
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    animation: paywallSlideIn 0.3s ease-out;
}

@keyframes paywallSlideIn {
    from {
        opacity: 0;
        transform: scale(0.9) translateY(-20px);
    }
    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}

.paywall-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px 24px 0;
    border-bottom: 1px solid #e5e7eb;
    margin-bottom: 24px;
}

.paywall-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: #1f2937;
}

.paywall-close {
    background: none;
    border: none;
    font-size: 1.25rem;
    color: #6b7280;
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    transition: all 0.2s ease;
}

.paywall-close:hover {
    background: #f3f4f6;
    color: #374151;
}

.paywall-body {
    padding: 0 24px 24px;
}

.paywall-message {
    text-align: center;
    color: #6b7280;
    margin-bottom: 32px;
    font-size: 1.1rem;
}

.paywall-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-bottom: 24px;
}

.paywall-option {
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    padding: 20px;
    transition: all 0.2s ease;
    cursor: pointer;
}

.paywall-option:hover {
    border-color: #3b82f6;
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.15);
}

.option-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.option-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #1f2937;
}

.option-price {
    display: flex;
    align-items: baseline;
}

.option-price .currency {
    font-size: 0.9rem;
    color: #6b7280;
    margin-right: 2px;
}

.option-price .amount {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1f2937;
}

.option-description {
    color: #6b7280;
    font-size: 0.9rem;
    margin-bottom: 16px;
    line-height: 1.4;
}

.option-button {
    width: 100%;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    color: white;
    border: none;
    padding: 12px 16px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
}

.option-button:hover {
    background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
    transform: translateY(-1px);
}

.paywall-processing {
    text-align: center;
    padding: 40px 20px;
}

.processing-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e5e7eb;
    border-top: 4px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.processing-note {
    color: #6b7280;
    font-size: 0.9rem;
    margin-top: 8px;
}

/* Mobile Responsive */
@media (max-width: 768px) {
    .paywall-content {
        width: 95%;
        margin: 20px;
    }
    
    .paywall-options {
        grid-template-columns: 1fr;
        gap: 16px;
    }
    
    .paywall-header {
        padding: 20px 20px 0;
    }
    
    .paywall-body {
        padding: 0 20px 20px;
    }
}
</style>
`;

// Inject styles
document.head.insertAdjacentHTML('beforeend', paywallStyles);

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaywallManager;
}