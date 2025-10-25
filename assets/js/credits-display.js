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
            const response = await fetch('/api/specs/entitlements', {
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
        const creditsCircle = document.getElementById('credits-circle');
        
        if (!creditsText || !creditsCircle) return;

        const { entitlements: userEntitlements, user } = entitlements;
        
        // Remove existing classes
        creditsCircle.classList.remove('pro', 'unlimited');
        
        let displayText = '';
        let tooltip = '';
        let cssClass = '';

        if (userEntitlements.unlimited) {
            // Pro subscription - unlimited
            displayText = 'UL';
            tooltip = 'Pro: Unlimited specifications';
            cssClass = 'unlimited';
        } else if (userEntitlements.spec_credits > 0) {
            // Has purchased credits
            displayText = userEntitlements.spec_credits.toString();
            tooltip = `${userEntitlements.spec_credits} purchased credit${userEntitlements.spec_credits !== 1 ? 's' : ''} remaining`;
            cssClass = 'pro';
        } else if (user.free_specs_remaining > 0) {
            // Free specs remaining
            displayText = user.free_specs_remaining.toString();
            tooltip = `${user.free_specs_remaining} free specification${user.free_specs_remaining !== 1 ? 's' : ''} remaining`;
        } else {
            // No credits
            displayText = '0';
            tooltip = 'No specifications remaining - purchase credits to continue';
        }

        creditsText.textContent = displayText;
        creditsCircle.setAttribute('data-tooltip', tooltip);
        
        if (cssClass) {
            creditsCircle.classList.add(cssClass);
        }

        // Add click handler to redirect to pricing page
        creditsCircle.onclick = () => {
            if (userEntitlements.unlimited) {
                // Pro user - maybe show subscription management
                window.location.href = '/pages/profile.html';
            } else {
                // Show pricing page
                window.location.href = '/pages/pricing.html';
            }
        };
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
