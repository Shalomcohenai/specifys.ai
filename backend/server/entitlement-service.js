const { db, admin } = require('./firebase-admin');
const config = require('../../config/lemon-products.json');

/**
 * Check if user can create a specification
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - {canCreate: boolean, reason?: string, creditsRemaining?: number}
 */
async function checkUserCanCreateSpec(userId) {
    try {
        // Get user document
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return { canCreate: false, reason: 'User not found' };
        }

        const userData = userDoc.data();

        // Get entitlements document
        const entitlementsDoc = await db.collection('entitlements').doc(userId).get();
        const entitlements = entitlementsDoc.exists ? entitlementsDoc.data() : {
            spec_credits: 0,
            unlimited: false,
            can_edit: false
        };

        // Check unlimited access (Pro subscription)
        if (entitlements.unlimited) {
            return { 
                canCreate: true, 
                reason: 'Pro subscription - unlimited access',
                creditsRemaining: 'unlimited'
            };
        }

        // Check purchased credits
        if (entitlements.spec_credits > 0) {
            return { 
                canCreate: true, 
                reason: 'Has purchased credits',
                creditsRemaining: entitlements.spec_credits
            };
        }

        // Check free specs remaining
        if (userData.free_specs_remaining > 0) {
            return { 
                canCreate: true, 
                reason: 'Has free specs remaining',
                creditsRemaining: userData.free_specs_remaining
            };
        }

        return { 
            canCreate: false, 
            reason: 'No credits remaining',
            creditsRemaining: 0
        };

    } catch (error) {
        console.error('Error checking user can create spec:', error);
        return { canCreate: false, reason: 'Error checking entitlements' };
    }
}

/**
 * Consume a specification credit
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Success status
 */
async function consumeSpecCredit(userId) {
    try {
        const batch = db.batch();

        // Get user document
        const userDocRef = db.collection('users').doc(userId);
        const userDoc = await userDocRef.get();
        
        if (!userDoc.exists) {
            throw new Error('User not found');
        }

        const userData = userDoc.data();

        // Get entitlements document
        const entitlementsDocRef = db.collection('entitlements').doc(userId);
        const entitlementsDoc = await entitlementsDocRef.get();
        
        const entitlements = entitlementsDoc.exists ? entitlementsDoc.data() : {
            spec_credits: 0,
            unlimited: false,
            can_edit: false
        };

        // If unlimited, no need to consume credits
        if (entitlements.unlimited) {
            return true;
        }

        // Consume free specs first
        if (userData.free_specs_remaining > 0) {
            batch.update(userDocRef, {
                free_specs_remaining: admin.firestore.FieldValue.increment(-1),
                last_entitlement_sync_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        // Then consume purchased credits
        else if (entitlements.spec_credits > 0) {
            batch.update(entitlementsDocRef, {
                spec_credits: admin.firestore.FieldValue.increment(-1),
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        else {
            throw new Error('No credits available to consume');
        }

        await batch.commit();
        return true;

    } catch (error) {
        console.error('Error consuming spec credit:', error);
        return false;
    }
}

/**
 * Grant credits to user
 * @param {string} userId - User ID
 * @param {number} creditsToAdd - Number of credits to add
 * @param {string} orderId - Lemon Squeezy order ID
 * @param {string} variantId - Product variant ID
 * @returns {Promise<boolean>} - Success status
 */
async function grantCredits(userId, creditsToAdd, orderId, variantId) {
    try {
        const batch = db.batch();

        // Update entitlements
        const entitlementsDocRef = db.collection('entitlements').doc(userId);
        batch.update(entitlementsDocRef, {
            spec_credits: admin.firestore.FieldValue.increment(creditsToAdd),
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Create purchase record
        const purchaseDocRef = db.collection('purchases').doc();
        batch.set(purchaseDocRef, {
            userId: userId,
            lemon_order_id: orderId,
            product_id: getProductIdByVariantId(variantId),
            variant_id: variantId,
            credits_granted: creditsToAdd,
            credits_used: 0,
            total_amount_cents: getPriceByVariantId(variantId) * 100,
            currency: config.currency,
            status: 'completed',
            purchased_at: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        return true;

    } catch (error) {
        console.error('Error granting credits:', error);
        return false;
    }
}

/**
 * Enable Pro subscription
 * @param {string} userId - User ID
 * @param {string} subscriptionId - Lemon Squeezy subscription ID
 * @param {Date} currentPeriodEnd - Subscription end date
 * @returns {Promise<boolean>} - Success status
 */
async function enableProSubscription(userId, subscriptionId, currentPeriodEnd) {
    try {
        const batch = db.batch();

        // Update user plan
        const userDocRef = db.collection('users').doc(userId);
        batch.update(userDocRef, {
            plan: 'pro',
            last_entitlement_sync_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update entitlements
        const entitlementsDocRef = db.collection('entitlements').doc(userId);
        batch.update(entitlementsDocRef, {
            unlimited: true,
            can_edit: true,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Create/update subscription record
        const subscriptionDocRef = db.collection('subscriptions').doc(userId);
        batch.set(subscriptionDocRef, {
            userId: userId,
            lemon_subscription_id: subscriptionId,
            product_id: getProductIdByVariantId(subscriptionId),
            variant_id: subscriptionId,
            status: 'active',
            current_period_end: admin.firestore.Timestamp.fromDate(currentPeriodEnd),
            cancel_at_period_end: false,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await batch.commit();
        return true;

    } catch (error) {
        console.error('Error enabling Pro subscription:', error);
        return false;
    }
}

/**
 * Revoke Pro subscription
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Success status
 */
async function revokeProSubscription(userId) {
    try {
        const batch = db.batch();

        // Update user plan
        const userDocRef = db.collection('users').doc(userId);
        batch.update(userDocRef, {
            plan: 'free',
            last_entitlement_sync_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update entitlements
        const entitlementsDocRef = db.collection('entitlements').doc(userId);
        batch.update(entitlementsDocRef, {
            unlimited: false,
            can_edit: false,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update subscription status
        const subscriptionDocRef = db.collection('subscriptions').doc(userId);
        batch.update(subscriptionDocRef, {
            status: 'cancelled',
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        return true;

    } catch (error) {
        console.error('Error revoking Pro subscription:', error);
        return false;
    }
}

/**
 * Claim pending entitlements for user
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {Promise<boolean>} - Success status
 */
async function claimPendingEntitlements(userId, email) {
    try {
        // Find pending entitlements for this email
        const pendingQuery = db.collection('pending_entitlements')
            .where('email', '==', email)
            .where('claimed', '==', false);

        const pendingSnapshot = await pendingQuery.get();
        
        if (pendingSnapshot.empty) {
            return true; // No pending entitlements
        }

        const batch = db.batch();

        for (const doc of pendingSnapshot.docs) {
            const pendingData = doc.data();
            const grants = JSON.parse(pendingData.grants_json);

            // Apply grants
            if (grants.spec_credits > 0) {
                await grantCredits(userId, grants.spec_credits, pendingData.lemon_order_id, pendingData.variant_id);
            }

            if (grants.unlimited) {
                await enableProSubscription(userId, pendingData.lemon_subscription_id, new Date(pendingData.current_period_end));
            }

            // Mark as claimed
            batch.update(doc.ref, {
                claimed: true,
                claimed_at: admin.firestore.FieldValue.serverTimestamp(),
                claimed_by_user_id: userId
            });
        }

        await batch.commit();
        return true;

    } catch (error) {
        console.error('Error claiming pending entitlements:', error);
        return false;
    }
}

/**
 * Check if user can edit a specification
 * @param {string} userId - User ID
 * @param {string} specId - Specification ID
 * @returns {Promise<boolean>} - Can edit status
 */
async function checkCanEditSpec(userId, specId) {
    try {
        // Get entitlements
        const entitlementsDoc = await db.collection('entitlements').doc(userId).get();
        const entitlements = entitlementsDoc.exists ? entitlementsDoc.data() : {
            can_edit: false
        };

        // Check if user has edit permission
        if (entitlements.can_edit) {
            return true;
        }

        // Check if user owns the spec and has Pro
        const specDoc = await db.collection('specs').doc(specId).get();
        if (specDoc.exists && specDoc.data().userId === userId) {
            const userDoc = await db.collection('users').doc(userId).get();
            return userDoc.exists && userDoc.data().plan === 'pro';
        }

        return false;

    } catch (error) {
        console.error('Error checking can edit spec:', error);
        return false;
    }
}

/**
 * Get user entitlements for display
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - User entitlements
 */
async function getUserEntitlements(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const entitlementsDoc = await db.collection('entitlements').doc(userId).get();

        const userData = userDoc.exists ? userDoc.data() : {};
        const entitlements = entitlementsDoc.exists ? entitlementsDoc.data() : {
            spec_credits: 0,
            unlimited: false,
            can_edit: false
        };

        return {
            user: userData,
            entitlements: entitlements
        };

    } catch (error) {
        console.error('Error getting user entitlements:', error);
        return {
            user: {},
            entitlements: { spec_credits: 0, unlimited: false, can_edit: false }
        };
    }
}

/**
 * Add audit log entry
 * @param {string} userId - User ID
 * @param {string} source - Source of action
 * @param {string} action - Action performed
 * @param {string} eventId - Event ID
 * @param {Object} payload - Additional data
 */
async function addAuditLog(userId, source, action, eventId, payload = {}) {
    try {
        await db.collection('audit_logs').add({
            userId: userId,
            source: source,
            action: action,
            event_id: eventId,
            payload_json: JSON.stringify(payload),
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error adding audit log:', error);
    }
}

/**
 * Find user by Lemon customer ID or email
 * @param {string} customerId - Lemon customer ID
 * @param {string} email - Customer email
 * @returns {Promise<string|null>} - User ID or null
 */
async function findUserByLemonCustomerIdOrEmail(customerId, email) {
    try {
        // First try by Lemon customer ID
        if (customerId) {
            const userQuery = db.collection('users').where('lemon_customer_id', '==', customerId);
            const userSnapshot = await userQuery.get();
            
            if (!userSnapshot.empty) {
                return userSnapshot.docs[0].id;
            }
        }

        // Then try by email
        if (email) {
            const userQuery = db.collection('users').where('email', '==', email);
            const userSnapshot = await userQuery.get();
            
            if (!userSnapshot.empty) {
                return userSnapshot.docs[0].id;
            }
        }

        return null;

    } catch (error) {
        console.error('Error finding user:', error);
        return null;
    }
}

/**
 * Create pending entitlement
 * @param {string} email - Customer email
 * @param {string} customerId - Lemon customer ID
 * @param {Object} payload - Webhook payload
 * @param {Object} grants - Grants to apply
 * @param {string} reason - Reason for pending
 */
async function createPendingEntitlement(email, customerId, payload, grants, reason) {
    try {
        await db.collection('pending_entitlements').add({
            email: email,
            lemon_customer_id: customerId,
            payload_json: JSON.stringify(payload),
            grants_json: JSON.stringify(grants),
            reason: reason,
            claimed: false,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error creating pending entitlement:', error);
    }
}

/**
 * Refund credits (for order refunds)
 * @param {string} userId - User ID
 * @param {number} creditsToRefund - Credits to refund
 * @param {string} orderId - Order ID
 */
async function refundCredits(userId, creditsToRefund, orderId) {
    try {
        const batch = db.batch();

        // Update entitlements
        const entitlementsDocRef = db.collection('entitlements').doc(userId);
        batch.update(entitlementsDocRef, {
            spec_credits: admin.firestore.FieldValue.increment(-creditsToRefund),
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update purchase record
        const purchaseQuery = db.collection('purchases')
            .where('userId', '==', userId)
            .where('lemon_order_id', '==', orderId);
        
        const purchaseSnapshot = await purchaseQuery.get();
        if (!purchaseSnapshot.empty) {
            const purchaseDoc = purchaseSnapshot.docs[0];
            batch.update(purchaseDoc.ref, {
                status: 'refunded',
                refunded_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        await batch.commit();

    } catch (error) {
        console.error('Error refunding credits:', error);
    }
}

// Helper functions
function getProductIdByVariantId(variantId) {
    for (const [key, product] of Object.entries(config.products)) {
        if (product.variant_id === variantId) {
            return product.product_id;
        }
    }
    return null;
}

function getPriceByVariantId(variantId) {
    for (const [key, product] of Object.entries(config.products)) {
        if (product.variant_id === variantId) {
            return product.price_nis;
        }
    }
    return 0;
}

module.exports = {
    checkUserCanCreateSpec,
    consumeSpecCredit,
    grantCredits,
    enableProSubscription,
    revokeProSubscription,
    claimPendingEntitlements,
    checkCanEditSpec,
    getUserEntitlements,
    addAuditLog,
    findUserByLemonCustomerIdOrEmail,
    createPendingEntitlement,
    refundCredits
};