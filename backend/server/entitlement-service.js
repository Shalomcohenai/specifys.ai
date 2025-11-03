const { db, admin, auth } = require('./firebase-admin');
const config = require('../../config/lemon-products.json');

/**
 * Create or update user document in Firestore (inline to avoid circular dependency)
 * @param {string} uid - User ID
 * @returns {Promise<Object>} - User document data
 */
async function createOrUpdateUserDocumentInline(uid) {
    try {
        const userDocRef = db.collection('users').doc(uid);
        
        // Get current user data from Auth
        let authUser;
        try {
            const userRecord = await auth.getUser(uid);
            authUser = {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                emailVerified: userRecord.emailVerified,
                disabled: userRecord.disabled,
                creationTime: userRecord.metadata.creationTime,
                lastSignInTime: userRecord.metadata.lastSignInTime
            };
        } catch (error) {

            throw error;
        }
        
        const userDoc = {
            email: authUser.email,
            displayName: authUser.displayName || authUser.email.split('@')[0],
            emailVerified: authUser.emailVerified,
            disabled: authUser.disabled,
            createdAt: authUser.creationTime,
            lastActive: authUser.lastSignInTime || new Date().toISOString(),
            // Initialize payment-related fields
            plan: 'free',
            free_specs_remaining: 1,
            lemon_customer_id: null,
            last_entitlement_sync_at: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await userDocRef.set(userDoc, { merge: true });
        
        // Create entitlements document if it doesn't exist
        const entitlementsDocRef = db.collection('entitlements').doc(uid);
        const entitlementsDoc = await entitlementsDocRef.get();
        
        if (!entitlementsDoc.exists) {
            await entitlementsDocRef.set({
                userId: uid,
                spec_credits: 0,
                unlimited: false,
                can_edit: false,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        
        return userDoc;
    } catch (error) {

        throw error;
    }
}

/**
 * Check if user can create a specification
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - {canCreate: boolean, reason?: string, creditsRemaining?: number}
 */
async function checkUserCanCreateSpec(userId) {
    try {

        // Get user document
        let userDoc = await db.collection('users').doc(userId).get();
        
        // If user document doesn't exist, try to create it
        if (!userDoc.exists) {

            try {
                await createOrUpdateUserDocumentInline(userId);

                // Re-fetch the user document
                userDoc = await db.collection('users').doc(userId).get();
            } catch (createError) {

                // If creation fails, still check with default values
                return {
                    canCreate: false,
                    reason: 'User not found and could not be created',
                    creditsRemaining: 0
                };
            }
        }

        const userData = userDoc.data();

        // Get entitlements document
        const entitlementsDoc = await db.collection('entitlements').doc(userId).get();
        const entitlements = entitlementsDoc.exists ? entitlementsDoc.data() : {
            spec_credits: 0,
            unlimited: false,
            can_edit: false
        };

        // Graceful fallback: treat plan==='pro' as unlimited even if entitlements not synced yet
        if (userData && userData.plan === 'pro') {
            return {
                canCreate: true,
                reason: 'Pro subscription (by plan) - unlimited access',
                creditsRemaining: 'unlimited'
            };
        }

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

        // Check free specs remaining - use default of 1 if not set
        // IMPORTANT: Only use default if field doesn't exist (undefined/null), not if it's negative
        const freeSpecsRemaining = typeof userData.free_specs_remaining === 'number'
            ? userData.free_specs_remaining  // Keep actual value even if negative
            : 1;  // Default to 1 only if field doesn't exist



        if (freeSpecsRemaining > 0) {

            return { 
                canCreate: true, 
                reason: 'Has free specs remaining',
                creditsRemaining: freeSpecsRemaining
            };
        }


        return { 
            canCreate: false, 
            reason: 'No credits remaining',
            creditsRemaining: 0
        };

    } catch (error) {

        return { canCreate: false, reason: 'Error checking entitlements' };
    }
}

/**
 * Consume a specification credit
 * @param {string} userId - User ID
 * @returns {Promise<{success: boolean, creditType?: string}>} - Success status and credit type consumed
 */
async function consumeSpecCredit(userId) {
    try {

        
        // Get user document
        let userDocRef = db.collection('users').doc(userId);
        let userDoc = await userDocRef.get();
        
        // If user document doesn't exist, try to create it
        if (!userDoc.exists) {

            try {
                await createOrUpdateUserDocumentInline(userId);

                // Re-fetch the user document
                userDoc = await userDocRef.get();
            } catch (createError) {

                throw new Error('User not found and could not be created');
            }
        }
        
        const batch = db.batch();

        const userData = userDoc.data();

            free_specs_remaining: userData.free_specs_remaining,
            type: typeof userData.free_specs_remaining
        });

        // Pro users (by plan) should not consume credits
        if (userData && userData.plan === 'pro') {

            return { success: true, creditType: 'unlimited' };
        }

        // Get entitlements document
        const entitlementsDocRef = db.collection('entitlements').doc(userId);
        const entitlementsDoc = await entitlementsDocRef.get();
        
        const entitlements = entitlementsDoc.exists ? entitlementsDoc.data() : {
            spec_credits: 0,
            unlimited: false,
            can_edit: false
        };

            unlimited: entitlements.unlimited,
            spec_credits: entitlements.spec_credits
        });

        // If unlimited, no need to consume credits
        if (entitlements.unlimited) {

            return { success: true, creditType: 'unlimited' };
        }

        // Consume free specs first - use default of 1 if not set
        // IMPORTANT: Only use default if field doesn't exist (undefined/null), not if it's negative
        const freeSpecsRemaining = typeof userData.free_specs_remaining === 'number'
            ? userData.free_specs_remaining  // Keep actual value even if negative
            : 1;  // Default to 1 only if field doesn't exist


        let creditType;

        if (freeSpecsRemaining > 0) {
            creditType = 'free';
            // Check if field exists in database
            if (typeof userData.free_specs_remaining === 'number') {
                // Field exists - use increment

                batch.update(userDocRef, {
                    free_specs_remaining: admin.firestore.FieldValue.increment(-1),
                    last_entitlement_sync_at: admin.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // Field doesn't exist - use set with merge to ensure it's created

                batch.set(userDocRef, {
                    free_specs_remaining: 0,
                    last_entitlement_sync_at: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
        } else if (entitlements.spec_credits > 0) {
            creditType = 'purchased';
            // No free specs, try purchased credits

            // Use set with merge to ensure document exists
            batch.set(entitlementsDocRef, {
                spec_credits: admin.firestore.FieldValue.increment(-1),
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } else {
            // Zero or negative - don't allow consumption

            throw new Error('No credits available to consume');
        }


        await batch.commit();

        return { success: true, creditType };

    } catch (error) {

        return { success: false };
    }
}

/**
 * Refund a spec credit (when generation fails after consuming credit)
 * @param {string} userId - User ID
 * @param {string} creditType - Type of credit to refund ('free' or 'purchased' or 'unlimited')
 * @returns {Promise<boolean>} - Success status
 */
async function refundSpecCredit(userId, creditType = 'purchased') {
    try {
        const batch = db.batch();

        // If unlimited, no need to refund
        if (creditType === 'unlimited') {

            return true;
        }



        if (creditType === 'free') {
            // Refund to free_specs_remaining
            const userDocRef = db.collection('users').doc(userId);
            batch.set(userDocRef, {
                free_specs_remaining: admin.firestore.FieldValue.increment(1),
                last_entitlement_sync_at: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } else {
            // Refund to purchased credits (default behavior)
            const entitlementsDocRef = db.collection('entitlements').doc(userId);
            batch.set(entitlementsDocRef, {
                spec_credits: admin.firestore.FieldValue.increment(1),
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        await batch.commit();

        return true;

    } catch (error) {

            userId,
            creditType,
            error: error.message
        });
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
    const startTime = Date.now();
    
    try {


            userId,
            creditsToAdd,
            orderId,
            variantId
        });
        
        const batch = db.batch();

        // Update entitlements - FIXED: Changed from batch.update to batch.set
        const entitlementsDocRef = db.collection('entitlements').doc(userId);
        

        batch.set(entitlementsDocRef, {
            spec_credits: admin.firestore.FieldValue.increment(creditsToAdd),
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Create purchase record
        const productId = getProductIdByVariantId(variantId);
        const price = getPriceByVariantId(variantId);
        

            productId,
            price,
            currency: config.currency
        });
        
        const purchaseDocRef = db.collection('purchases').doc();
        batch.set(purchaseDocRef, {
            userId: userId,
            lemon_order_id: orderId,
            product_id: productId,
            variant_id: variantId,
            credits_granted: creditsToAdd,
            credits_used: 0,
            total_amount_cents: price * 100,
            currency: config.currency,
            status: 'completed',
            purchased_at: admin.firestore.FieldValue.serverTimestamp()
        });


        await batch.commit();
        
        const duration = Date.now() - startTime;

        return true;

    } catch (error) {
        const duration = Date.now() - startTime;

            userId,
            creditsToAdd,
            orderId,
            variantId,
            error: error.message,
            stack: error.stack
        });
        return false;
    }
}

/**
 * Enable Pro subscription
 * @param {string} userId - User ID
 * @param {string} subscriptionId - Lemon Squeezy subscription ID
 * @param {string} variantId - Product variant ID
 * @param {Date} currentPeriodEnd - Subscription end date
 * @returns {Promise<boolean>} - Success status
 */
async function enableProSubscription(userId, subscriptionId, variantId, currentPeriodEnd) {
    try {

        
        // Get current entitlements to preserve purchased credits
        const entitlementsDoc = await db.collection('entitlements').doc(userId).get();
        let preservedCredits = 0;
        if (entitlementsDoc.exists()) {
            preservedCredits = entitlementsDoc.data().spec_credits || 0;

        }
        
        const batch = db.batch();

        // Update user plan
        const userDocRef = db.collection('users').doc(userId);
        batch.update(userDocRef, {
            plan: 'pro',
            last_entitlement_sync_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update entitlements - preserve credits
        const entitlementsDocRef = db.collection('entitlements').doc(userId);
        batch.set(entitlementsDocRef, {
            unlimited: true,
            can_edit: true,
            spec_credits: 0, // Zero out active credits
            preserved_credits: preservedCredits, // Save for later
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Create/update subscription record
        const subscriptionDocRef = db.collection('subscriptions').doc(userId);
        batch.set(subscriptionDocRef, {
            userId: userId,
            lemon_subscription_id: subscriptionId,
            product_id: getProductIdByVariantId(variantId),
            variant_id: variantId,
            status: 'active',
            current_period_end: admin.firestore.Timestamp.fromDate(currentPeriodEnd),
            cancel_at_period_end: false,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await batch.commit();

        return true;

    } catch (error) {

            userId,
            subscriptionId,
            variantId,
            error: error.message,
            stack: error.stack
        });
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

        
        // Get preserved credits
        const entitlementsDoc = await db.collection('entitlements').doc(userId).get();
        const preservedCredits = entitlementsDoc.exists() 
            ? (entitlementsDoc.data().preserved_credits || 0) 
            : 0;
        

        
        const batch = db.batch();

        // Update user plan
        const userDocRef = db.collection('users').doc(userId);
        batch.set(userDocRef, {
            plan: 'free',
            last_entitlement_sync_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Update entitlements - restore preserved credits
        const entitlementsDocRef = db.collection('entitlements').doc(userId);
        batch.set(entitlementsDocRef, {
            unlimited: false,
            can_edit: false,
            spec_credits: preservedCredits, // Restore credits
            preserved_credits: 0, // Clear preserved credits
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Update subscription status (if exists)
        const subscriptionDocRef = db.collection('subscriptions').doc(userId);
        const subscriptionDoc = await subscriptionDocRef.get();
        if (subscriptionDoc.exists) {
            batch.set(subscriptionDocRef, {
                status: 'cancelled',
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        await batch.commit();

        return true;

    } catch (error) {

            userId,
            error: error.message,
            stack: error.stack
        });
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
            const payload = JSON.parse(pendingData.payload_json);

            // Apply grants
            if (grants.spec_credits > 0) {
                const order = payload.data.attributes;
                const variantId = order.first_order_item?.variant_id || order.variant_id;
                await grantCredits(userId, grants.spec_credits, payload.data.id, variantId);
            }

            if (grants.unlimited) {
                const subscription = payload.data.attributes;
                const currentPeriodEnd = new Date(subscription.current_period_end);
                await enableProSubscription(userId, subscription.id, subscription.variant_id, currentPeriodEnd);
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
        let userDoc = await db.collection('users').doc(userId).get();
        
        // If user document doesn't exist, try to create it
        if (!userDoc.exists) {

            try {
                await createOrUpdateUserDocumentInline(userId);

                // Re-fetch the user document
                userDoc = await db.collection('users').doc(userId).get();
            } catch (createError) {

                // Continue with default values if creation fails
            }
        }
        
        const entitlementsDoc = await db.collection('entitlements').doc(userId).get();

        const userData = userDoc.exists ? userDoc.data() : {};
        let entitlements = entitlementsDoc.exists ? entitlementsDoc.data() : {
            spec_credits: 0,
            unlimited: false,
            can_edit: false
        };

        // Ensure free_specs_remaining has a default value of 1 if not set
        if (userData && typeof userData.free_specs_remaining !== 'number') {
            userData.free_specs_remaining = 1;
        }

        // Graceful fallback: if plan==='pro', reflect unlimited in API response
        if (userData && userData.plan === 'pro' && !entitlements.unlimited) {
            entitlements = {
                ...entitlements,
                unlimited: true,
                can_edit: true
            };
        }

        return {
            user: userData,
            entitlements: entitlements
        };

    } catch (error) {

        return {
            user: { free_specs_remaining: 1 },
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

            customerId,
            email
        });
        
        // First try by Lemon customer ID
        if (customerId) {

            const userQuery = db.collection('users').where('lemon_customer_id', '==', customerId);
            const userSnapshot = await userQuery.get();
            
            if (!userSnapshot.empty) {
                const userId = userSnapshot.docs[0].id;

                return userId;
            } else {

            }
        }

        // Then try by email
        if (email) {

            const userQuery = db.collection('users').where('email', '==', email);
            const userSnapshot = await userQuery.get();
            
            if (!userSnapshot.empty) {
                const userId = userSnapshot.docs[0].id;

                return userId;
            } else {

            }
        }


        return null;

    } catch (error) {

            error: error.message,
            stack: error.stack,
            customerId,
            email
        });
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

        // Update entitlements - use set with merge to ensure document exists
        const entitlementsDocRef = db.collection('entitlements').doc(userId);
        batch.set(entitlementsDocRef, {
            spec_credits: admin.firestore.FieldValue.increment(-creditsToRefund),
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Update purchase record
        const purchaseQuery = db.collection('purchases')
            .where('userId', '==', userId)
            .where('lemon_order_id', '==', orderId);
        
        const purchaseSnapshot = await purchaseQuery.get();
        if (!purchaseSnapshot.empty) {
            const purchaseDoc = purchaseSnapshot.docs[0];
            batch.set(purchaseDoc.ref, {
                status: 'refunded',
                refunded_at: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        await batch.commit();


    } catch (error) {

            userId,
            creditsToRefund,
            orderId,
            error: error.message
        });
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
            return product.price_usd || 0;
        }
    }
    return 0;
}

module.exports = {
    checkUserCanCreateSpec,
    consumeSpecCredit,
    refundSpecCredit,
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