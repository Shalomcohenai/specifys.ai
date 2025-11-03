/**
 * Credits Display Manager
 * Manages the credits display circle in the header across all pages
 */

class CreditsDisplayManager {
    constructor() {
        this.isInitialized = false;
        this.currentUser = null;
    }

    /**
     * Initialize the credits display
     */
    async init() {
        if (this.isInitialized) return;
        
        // Wait for Firebase to be available and initialized
        if (typeof firebase === 'undefined' || !firebase.apps || firebase.apps.length === 0) {
            setTimeout(() => this.init(), 500);
            return;
        }

        try {
            // Listen to auth state changes
            firebase.auth().onAuthStateChanged(async (user) => {
                this.currentUser = user;
                if (user) {
                    this.showCreditsDisplay();
                    await this.updateCredits(); // Immediate refresh on login
                } else {
                    this.hideCreditsDisplay();
                }
            });

            this.isInitialized = true;
        } catch (error) {

            // Retry if Firebase is not ready yet
            setTimeout(() => this.init(), 500);
        }
    }

    /**
     * Show the credits display
     */
    showCreditsDisplay() {
        const creditsDisplay = document.getElementById('credits-display');
        if (creditsDisplay) {
            creditsDisplay.style.display = 'flex';
            
            // Show loading state until first API call completes
            const creditsText = document.getElementById('credits-text');
            if (creditsText && (creditsText.textContent === '0' || creditsText.textContent === '')) {
                creditsText.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            }
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
            // Use entitlements cache if available, otherwise fetch directly
            let data;
            if (window.entitlementsCache) {
                data = await window.entitlementsCache.get();
            } else {
                // Fallback to direct API call if cache not available
                const token = await this.currentUser.getIdToken();
                const response = await fetch(`${window.API_BASE_URL || 'http://localhost:10000'}/api/specs/entitlements`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {

                    return;
                }

                data = await response.json();
            }

            if (data) {
                this.renderCredits(data);
            }

        } catch (error) {

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

        // Treat plan==='pro' as Pro (fallback) even if entitlements.unlimited not yet synced
        const isProByPlan = user && user.plan === 'pro';

        if (userEntitlements.unlimited || isProByPlan) {
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
