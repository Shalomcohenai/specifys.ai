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
                        <h2>Oops... Looks like you've run out of credits.</h2>
                        <p class="paywall-subtitle">Want more?</p>
                        <p class="paywall-tagline">For a million dollar idea, you can invest $5</p>
                        <button class="paywall-close" onclick="window.paywallManager.hidePaywall()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="paywall-body">
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

        // Populate options (header is already set in HTML)
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
                            <span class="currency">$</span>
                            <span class="amount">${option.price}</span>
                        </div>
                    </div>
                    <div class="option-description">
                        ${option.description}
                    </div>
                    <button class="option-button" onclick="window.paywallManager.selectOption('${option.id}')">
                        Buy Now
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
            const checkoutUrl = `https://specifysai.lemonsqueezy.com/checkout/buy/${product.variant_id}`;
            
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
                const response = await fetch(`${window.API_BASE_URL || 'http://localhost:3001'}/api/specs/entitlements`, {
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
            const response = await fetch('/assets/data/lemon-products.json');
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
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    max-width: 800px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    animation: paywallSlideIn 0.3s ease-out;
    border: 2px solid #e9ecef;
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
    position: relative;
    padding: 40px 40px 24px;
    text-align: center;
    border-bottom: 1px solid #FFE8DC;
    margin-bottom: 32px;
}

.paywall-header h2 {
    margin: 0 0 12px 0;
    font-size: 2rem;
    font-weight: 700;
    color: #333;
    line-height: 1.3;
}

.paywall-subtitle {
    margin: 0 0 24px 0;
    font-size: 1.25rem;
    font-weight: 500;
    color: #FF6B35;
}

.paywall-tagline {
    margin: 0;
    font-size: 0.85rem;
    color: #666;
    font-style: italic;
}

.paywall-close {
    position: absolute;
    top: 20px;
    right: 20px;
    background: none;
    border: none;
    font-size: 1.25rem;
    color: #999;
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    transition: all 0.2s ease;
}

.paywall-close:hover {
    background: #f5f5f5;
    color: #FF6B35;
}

.paywall-body {
    padding: 0 40px 40px;
}

.paywall-options {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
    margin-bottom: 0;
}

.paywall-option {
    border: 2px solid #e9ecef;
    border-radius: 12px;
    padding: 32px 24px;
    transition: all 0.3s ease;
    cursor: pointer;
    background: white;
    display: flex;
    flex-direction: column;
    text-align: center;
}

.paywall-option:hover {
    border-color: #FF6B35;
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(255, 107, 53, 0.15);
}

.paywall-option:nth-child(2) {
    border-color: #FF6B35;
    background: #FFF4F0;
}

.paywall-option:nth-child(2):hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(255, 107, 53, 0.25);
}

.option-header {
    margin-bottom: 20px;
}

.option-header h3 {
    margin: 0 0 12px 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: #333;
}

.option-price {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 2px;
    margin-bottom: 8px;
}

.option-price .currency {
    font-size: 1rem;
    color: #666;
}

.option-price .amount {
    font-size: 2.5rem;
    font-weight: 700;
    color: #FF6B35;
}

.option-description {
    color: #666;
    font-size: 0.9rem;
    margin-bottom: 24px;
    line-height: 1.5;
    min-height: 40px;
}

.option-button {
    width: 100%;
    background: #FF6B35;
    color: white;
    border: none;
    padding: 14px 24px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-top: auto;
}

.option-button:hover {
    background: #FF8551;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(255, 107, 53, 0.3);
}

.paywall-processing {
    text-align: center;
    padding: 40px 20px;
}

.processing-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #FFE8DC;
    border-top: 4px solid #FF6B35;
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
    
    .paywall-header {
        padding: 32px 24px 20px;
    }
    
    .paywall-header h2 {
        font-size: 1.5rem;
    }
    
    .paywall-subtitle {
        font-size: 1.1rem;
    }
    
    .paywall-body {
        padding: 0 24px 32px;
    }
    
    .paywall-options {
        grid-template-columns: 1fr;
        gap: 20px;
    }
    
    .paywall-option {
        padding: 24px 20px;
    }
    
    .option-price .amount {
        font-size: 2rem;
    }
}

@media (max-width: 480px) {
    .paywall-header h2 {
        font-size: 1.25rem;
    }
    
    .paywall-header {
        padding: 28px 20px 16px;
    }
    
    .paywall-body {
        padding: 0 20px 28px;
    }
    
    .option-header h3 {
        font-size: 1.25rem;
    }
    
    .option-price .amount {
        font-size: 1.75rem;
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