const crypto = require('crypto');
const { db, admin } = require('./firebase-admin');
const config = require('../../config/lemon-products.json');
const {
    grantCredits,
    enableProSubscription,
    revokeProSubscription,
    addAuditLog,
    findUserByLemonCustomerIdOrEmail,
    createPendingEntitlement,
    refundCredits
} = require('./entitlement-service');

// Get webhook secret from environment variable
const webhookSecret = process.env.LEMON_WEBHOOK_SECRET || config.webhook_secret;

/**
 * Verify Lemon Squeezy webhook signature
 * @param {Object} req - Express request object
 * @returns {boolean} - Signature validity
 */
async function verifySignature(req) {
    try {
        const signature = req.headers['x-signature'];
        if (!signature) {

            return false;
        }


        
        // req.body should be a Buffer when using express.raw()
        const rawBody = req.body.toString();
        
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(rawBody)
            .digest('hex');

        const providedSignature = signature.replace('sha256=', '');
        
        const isValid = crypto.timingSafeEqual(
            Buffer.from(expectedSignature, 'hex'),
            Buffer.from(providedSignature, 'hex')
        );

        if (!isValid) {

                expected_prefix: expectedSignature.substring(0, 20) + '...',
                provided_prefix: providedSignature.substring(0, 20) + '...',
                rawBody_length: rawBody.length
            });
        } else {

        }

        return isValid;

    } catch (error) {

        return false;
    }
}

/**
 * Check if webhook event was already processed (idempotency)
 * @param {string} eventId - Event ID
 * @returns {Promise<boolean>} - True if already processed
 */
async function isEventProcessed(eventId) {
    try {
        const eventDoc = await db.collection('processed_webhook_events').doc(eventId).get();
        return eventDoc.exists;
    } catch (error) {

        return false;
    }
}

/**
 * Mark webhook event as processed
 * @param {string} eventId - Event ID
 */
async function markEventProcessed(eventId) {
    try {
        await db.collection('processed_webhook_events').doc(eventId).set({
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {

    }
}

/**
 * Handle order_created event
 * @param {Object} payload - Webhook payload
 */
async function handleOrderCreated(payload) {
    const startTime = Date.now();
    let userId = null;
    let creditsGranted = 0;
    
    try {
        const { data } = payload;
        const order = data.attributes;
        


            order_id: order.id,
            customer_id: order.customer_id,
            user_email: order.user_email,
            variant_id: order.variant_id,
            total: order.total,
            currency: order.currency
        });

        // Find user by customer ID or email

            customer_id: order.customer_id,
            email: order.user_email
        });
        
        userId = await findUserByLemonCustomerIdOrEmail(
            order.customer_id,
            order.user_email
        );



        // Get product info
        const product = Object.values(config.products).find(p => 
            p.variant_id === order.variant_id
        );

        if (!product) {

            await addAuditLog(null, 'lemon_webhook', 'order_created_product_not_found', payload.meta.event_id, {
                order_id: order.id,
                variant_id: order.variant_id,
                available_products: Object.keys(config.products)
            });
            return;
        }


            name: product.name,
            credits: product.grants.spec_credits,
            unlimited: product.grants.unlimited
        });

        if (userId) {

            
            // Persist Lemon customer ID on user for future lookups
            await db.collection('users').doc(userId).set({
                lemon_customer_id: order.customer_id || null,
                last_entitlement_sync_at: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });


                userId,
                credits: product.grants.spec_credits,
                order_id: order.id
            });

            // User exists - grant credits immediately
            const grantResult = await grantCredits(userId, product.grants.spec_credits, order.id, order.variant_id);
            creditsGranted = product.grants.spec_credits;
            
            if (!grantResult) {

                await addAuditLog(userId, 'lemon_webhook', 'order_created_grant_failed', payload.meta.event_id, {
                    order_id: order.id,
                    variant_id: order.variant_id,
                    credits_attempted: product.grants.spec_credits
                });
                // CRITICAL: Throw error to trigger retry - this prevents lost purchases
                throw new Error(`Failed to grant credits for user ${userId} on order ${order.id}`);
            } else {

            }
            
            await addAuditLog(userId, 'lemon_webhook', 'order_created', payload.meta.event_id, {
                order_id: order.id,
                variant_id: order.variant_id,
                credits_granted: product.grants.spec_credits,
                grant_successful: grantResult
            });

            const duration = Date.now() - startTime;

        } else {

            
            // User doesn't exist - create pending entitlement
            await createPendingEntitlement(
                order.user_email,
                order.customer_id,
                payload,
                product.grants,
                'order_created_before_signup'
            );

            const duration = Date.now() - startTime;

            
            await addAuditLog(null, 'lemon_webhook', 'order_created_pending', payload.meta.event_id, {
                order_id: order.id,
                variant_id: order.variant_id,
                user_email: order.user_email,
                credits_will_grant: product.grants.spec_credits
            });
        }

    } catch (error) {
        const duration = Date.now() - startTime;

            error: error.message,
            stack: error.stack,
            duration_ms: duration,
            userId,
            credits_granted
        });
        
        await addAuditLog(userId, 'lemon_webhook', 'order_created_error', payload?.meta?.event_id || 'unknown', {
            error: error.message,
            stack: error.stack,
            duration_ms: duration
        });
        
        throw error;
    }
}

/**
 * Handle order_refunded event
 * @param {Object} payload - Webhook payload
 */
async function handleOrderRefunded(payload) {
    try {
        const { data } = payload;
        const order = data.attributes;
        


        // Find user
        const userId = await findUserByLemonCustomerIdOrEmail(
            order.customer_id,
            order.user_email
        );

        if (!userId) {

            return;
        }

        // Get product info
        const product = Object.values(config.products).find(p => 
            p.variant_id === order.variant_id
        );

        if (product && product.grants.spec_credits > 0) {
            await refundCredits(userId, product.grants.spec_credits, order.id);
            
            await addAuditLog(userId, 'lemon_webhook', 'order_refunded', payload.meta.event_id, {
                order_id: order.id,
                variant_id: order.variant_id,
                credits_refunded: product.grants.spec_credits
            });


        }

    } catch (error) {

        throw error;
    }
}

/**
 * Handle subscription_created event
 * @param {Object} payload - Webhook payload
 */
async function handleSubscriptionCreated(payload) {
    try {
        const { data } = payload;
        const subscription = data.attributes;
        


        // Find user
        const userId = await findUserByLemonCustomerIdOrEmail(
            subscription.customer_id,
            subscription.user_email
        );

        if (userId) {
            // Persist Lemon customer ID on user for future lookups
            await db.collection('users').doc(userId).set({
                lemon_customer_id: subscription.customer_id || null,
                last_entitlement_sync_at: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // User exists - enable Pro immediately
            const currentPeriodEnd = new Date(subscription.current_period_end);
            await enableProSubscription(userId, subscription.id, subscription.variant_id, currentPeriodEnd);
            
            await addAuditLog(userId, 'lemon_webhook', 'subscription_created', payload.meta.event_id, {
                subscription_id: subscription.id,
                variant_id: subscription.variant_id
            });


        } else {
            // User doesn't exist - create pending entitlement
            const product = Object.values(config.products).find(p => 
                p.variant_id === subscription.variant_id
            );

            if (product) {
                await createPendingEntitlement(
                    subscription.user_email,
                    subscription.customer_id,
                    payload,
                    product.grants,
                    'subscription_created_before_signup'
                );


            }
        }

    } catch (error) {

        throw error;
    }
}

/**
 * Handle subscription_payment_success event
 * @param {Object} payload - Webhook payload
 */
async function handleSubscriptionPaymentSuccess(payload) {
    try {
        const { data } = payload;
        const subscription = data.attributes;
        


        // Find user
        const userId = await findUserByLemonCustomerIdOrEmail(
            subscription.customer_id,
            subscription.user_email
        );

        if (userId) {
            // Persist Lemon customer ID on user for future lookups
            await db.collection('users').doc(userId).set({
                lemon_customer_id: subscription.customer_id || null,
                last_entitlement_sync_at: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // Update subscription period
            const currentPeriodEnd = new Date(subscription.current_period_end);
            await enableProSubscription(userId, subscription.id, subscription.variant_id, currentPeriodEnd);
            
            await addAuditLog(userId, 'lemon_webhook', 'subscription_payment_success', payload.meta.event_id, {
                subscription_id: subscription.id,
                variant_id: subscription.variant_id
            });


        }

    } catch (error) {

        throw error;
    }
}

/**
 * Handle subscription_updated event
 * @param {Object} payload - Webhook payload
 */
async function handleSubscriptionUpdated(payload) {
    try {
        const { data } = payload;
        const subscription = data.attributes;
        


        // Find user
        const userId = await findUserByLemonCustomerIdOrEmail(
            subscription.customer_id,
            subscription.user_email
        );

        if (userId) {
            // Update subscription in database
            const subscriptionDocRef = db.collection('subscriptions').doc(userId);
            await subscriptionDocRef.update({
                status: subscription.status,
                current_period_end: admin.firestore.Timestamp.fromDate(new Date(subscription.current_period_end)),
                cancel_at_period_end: subscription.cancel_at_period_end,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
            
            await addAuditLog(userId, 'lemon_webhook', 'subscription_updated', payload.meta.event_id, {
                subscription_id: subscription.id,
                status: subscription.status
            });


        }

    } catch (error) {

        throw error;
    }
}

/**
 * Handle subscription_cancelled event
 * @param {Object} payload - Webhook payload
 */
async function handleSubscriptionCancelled(payload) {
    try {
        const { data } = payload;
        const subscription = data.attributes;
        


        // Find user
        const userId = await findUserByLemonCustomerIdOrEmail(
            subscription.customer_id,
            subscription.user_email
        );

        if (userId) {
            // Update subscription status but keep Pro until period end
            const subscriptionDocRef = db.collection('subscriptions').doc(userId);
            await subscriptionDocRef.update({
                status: 'cancelled',
                cancel_at_period_end: true,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
            
            await addAuditLog(userId, 'lemon_webhook', 'subscription_cancelled', payload.meta.event_id, {
                subscription_id: subscription.id
            });


        }

    } catch (error) {

        throw error;
    }
}

/**
 * Handle subscription_expired event
 * @param {Object} payload - Webhook payload
 */
async function handleSubscriptionExpired(payload) {
    try {
        const { data } = payload;
        const subscription = data.attributes;
        


        // Find user
        const userId = await findUserByLemonCustomerIdOrEmail(
            subscription.customer_id,
            subscription.user_email
        );

        if (userId) {
            // Revoke Pro access
            await revokeProSubscription(userId);
            
            await addAuditLog(userId, 'lemon_webhook', 'subscription_expired', payload.meta.event_id, {
                subscription_id: subscription.id
            });


        }

    } catch (error) {

        throw error;
    }
}

/**
 * Handle subscription_payment_failed event
 * @param {Object} payload - Webhook payload
 */
async function handleSubscriptionPaymentFailed(payload) {
    try {
        const { data } = payload;
        const subscription = data.attributes;
        


        // Find user
        const userId = await findUserByLemonCustomerIdOrEmail(
            subscription.customer_id,
            subscription.user_email
        );

        if (userId) {
            // Update subscription status
            const subscriptionDocRef = db.collection('subscriptions').doc(userId);
            await subscriptionDocRef.update({
                status: 'payment_failed',
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
            
            await addAuditLog(userId, 'lemon_webhook', 'subscription_payment_failed', payload.meta.event_id, {
                subscription_id: subscription.id
            });


        }

    } catch (error) {

        throw error;
    }
}

/**
 * Main webhook handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleLemonWebhook(req, res) {
    const startTime = Date.now();
    let payload = null;
    
    try {



            signature: req.headers['x-signature'] ? req.headers['x-signature'].substring(0, 20) + '...' : 'none',
            'user-agent': req.headers['user-agent']
        });

        // Verify signature

        const isValidSignature = await verifySignature(req);
        if (!isValidSignature) {


            return res.status(401).json({ error: 'Invalid signature' });
        }


        // Parse payload
        payload = JSON.parse(req.body.toString());


            event_id: payload.meta.event_id,
            event_name: payload.meta.event_name
        });
        
        // Log full payload for debugging (first 500 chars)
        const payloadPreview = JSON.stringify(payload, null, 2).substring(0, 500);


        // Check idempotency
        const eventId = payload.meta.event_id;

        
        if (await isEventProcessed(eventId)) {


            return res.status(200).json({ message: 'Event already processed' });
        }


        // Mark as processed immediately to prevent duplicates

        await markEventProcessed(eventId);


        // Handle event based on type
        const eventType = payload.meta.event_name;


        switch (eventType) {
            case 'order_created':
                await handleOrderCreated(payload);
                break;
            case 'order_refunded':
                await handleOrderRefunded(payload);
                break;
            case 'subscription_created':
                await handleSubscriptionCreated(payload);
                break;
            case 'subscription_payment_success':
                await handleSubscriptionPaymentSuccess(payload);
                break;
            case 'subscription_updated':
                await handleSubscriptionUpdated(payload);
                break;
            case 'subscription_cancelled':
                await handleSubscriptionCancelled(payload);
                break;
            case 'subscription_expired':
                await handleSubscriptionExpired(payload);
                break;
            case 'subscription_payment_failed':
                await handleSubscriptionPaymentFailed(payload);
                break;
            default:

                await addAuditLog(null, 'lemon_webhook', 'unhandled_event', eventId, {
                    event_type: eventType,
                    payload: payload
                });
        }

        const duration = Date.now() - startTime;


        res.status(200).json({ message: 'Webhook processed successfully' });

    } catch (error) {
        const duration = Date.now() - startTime;

            error: error.message,
            stack: error.stack
        });
        
        // Log error safely
        try {
            await addAuditLog(null, 'lemon_webhook', 'processing_error', payload?.meta?.event_id || 'unknown', {
                error: error.message,
                stack: error.stack,
                duration_ms: duration
            });

        } catch (logError) {

        }


        res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    handleLemonWebhook
};