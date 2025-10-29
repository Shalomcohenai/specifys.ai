/**
 * Credits Display Manager
 * Manages the credits display circle in the header across all pages
 */

class CreditsDisplayManager {
    constructor() {
        this.isInitialized = false;
        this.currentUser = null;
        this.pollingInterval = null;
        this.pollingIntervalMs = 30000; // 30 seconds
    }

    /**
     * Initialize the credits display
     */
    async init() {
        if (this.isInitialized) return;
        
        // Wait for Firebase to be available
        if (typeof firebase === 'undefined') {
            setTimeout(() => this.init(), 1000);
            return;
        }

        // Listen to auth state changes
        firebase.auth().onAuthStateChanged((user) => {
            this.currentUser = user;
            if (user) {
                this.showCreditsDisplay();
                this.updateCredits();
                this.startPolling();
            } else {
                this.hideCreditsDisplay();
                this.stopPolling();
            }
        });

        this.isInitialized = true;
    }

    /**
     * Show the credits display
     */
    showCreditsDisplay() {
        const creditsDisplay = document.getElementById('credits-display');
        if (creditsDisplay) {
            creditsDisplay.style.display = 'flex';
        }
    }

    /**
     * Hide the credits display
     */
    hideCreditsDisplay() {
        const creditsDisplay = document.getElementById('credits-display');
        if (creditsDisplay) {
            creditsDisplay.style.display = 'none';
        }
    }

    /**
     * Update the credits display
     */
    async updateCredits() {
        if (!this.currentUser) return;

        try {
            const token = await this.currentUser.getIdToken();
            const response = await fetch(`${window.API_BASE_URL || 'http://localhost:3001'}/api/specs/entitlements`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                console.error('Failed to fetch entitlements');
                return;
            }

            const data = await response.json();
            this.renderCredits(data);

        } catch (error) {
            console.error('Error updating credits:', error);
        }
    }

    /**
     * Render the credits display
     * @param {Object} entitlements - User entitlements data
     */
    renderCredits(entitlements) {
        const creditsText = document.getElementById('credits-text');
        const creditsContainer = document.querySelector('.credits-container');
        
        if (!creditsText || !creditsContainer) return;

        const { entitlements: userEntitlements, user } = entitlements;
        
        // Remove existing classes
        creditsContainer.classList.remove('pro', 'unlimited', 'low', 'normal');
        
        let displayText = '';
        let cssClass = '';

        if (userEntitlements.unlimited) {
            // Pro subscription - unlimited
            displayText = 'pro';
            cssClass = 'pro';
        } else if (userEntitlements.spec_credits > 0) {
            // Has purchased credits
            displayText = userEntitlements.spec_credits.toString();
            cssClass = 'normal';
        } else {
            // Free specs remaining - use default of 1 if not set
            // IMPORTANT: Only use default if field doesn't exist (undefined/null), not if it's negative
            const freeSpecs = typeof user.free_specs_remaining === 'number'
                ? user.free_specs_remaining  // Keep actual value even if negative
                : 1;  // Default to 1 only if field doesn't exist
            
            if (freeSpecs > 0) {
                displayText = freeSpecs.toString();
                // Add 'low' class if only 1-2 remaining
                if (freeSpecs <= 2) {
                    cssClass = 'low';
                } else {
                    cssClass = 'normal';
                }
            } else {
                // No credits (including negative values)
                displayText = '0';
                cssClass = 'low';
            }
        }

        creditsText.textContent = displayText;
        
        if (cssClass) {
            creditsContainer.classList.add(cssClass);
        }

        // Add click handler to show modal with details
        creditsContainer.onclick = () => {
            this.showCreditsModal(entitlements);
        };
    }

    /**
     * Show credits details modal
     * @param {Object} entitlements - User entitlements data
     */
    showCreditsModal(entitlements) {
        const { entitlements: userEntitlements, user } = entitlements;
        
        let message = '';
        
        // IMPORTANT: Only use default if field doesn't exist (undefined/null), not if it's negative
        const freeSpecs = typeof user.free_specs_remaining === 'number'
            ? user.free_specs_remaining  // Keep actual value even if negative
            : 1;  // Default to 1 only if field doesn't exist
        
        if (userEntitlements.unlimited) {
            message = 'You have unlimited specifications with your Pro subscription!';
        } else if (userEntitlements.spec_credits > 0) {
            message = `You have ${userEntitlements.spec_credits} purchased credit${userEntitlements.spec_credits !== 1 ? 's' : ''} remaining.`;
        } else if (freeSpecs > 0) {
            message = `You have ${freeSpecs} free specification${freeSpecs !== 1 ? 's' : ''} remaining.`;
        } else {
            message = 'You have 0 specifications remaining. Please purchase credits to create more specifications.';
        }
        
        // Simple alert for now - can be replaced with custom modal
        alert(message);
        
        // Optionally redirect based on action
        if (!userEntitlements.unlimited && userEntitlements.spec_credits === 0) {
            window.location.href = '/pages/pricing.html';
        }
    }

    /**
     * Start polling for credits updates
     */
    startPolling() {
        this.stopPolling(); // Clear any existing interval
        
        this.pollingInterval = setInterval(() => {
            this.updateCredits();
        }, this.pollingIntervalMs);
    }

    /**
     * Stop polling
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    /**
     * Force refresh credits (useful after purchases)
     */
    async refreshCredits() {
        await this.updateCredits();
    }
}

// Global instance
window.creditsDisplayManager = new CreditsDisplayManager();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.creditsDisplayManager.init();
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CreditsDisplayManager;
}
