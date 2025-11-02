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
            console.error('❌ [SIGNATURE] No signature header found in request');
            return false;
        }

        console.log('🔒 [SIGNATURE] Verifying webhook signature...');
        
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
            console.error('❌ [SIGNATURE] Signature verification failed:', {
                expected_prefix: expectedSignature.substring(0, 20) + '...',
                provided_prefix: providedSignature.substring(0, 20) + '...',
                rawBody_length: rawBody.length
            });
        } else {
            console.log('✅ [SIGNATURE] Signature verified successfully');
        }

        return isValid;

    } catch (error) {
        console.error('❌ [SIGNATURE] Error verifying signature:', error);
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
        console.error('Error checking event processed:', error);
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
        console.error('Error marking event processed:', error);
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
        
        console.log('🟢 [ORDER_CREATED] Starting processing for order:', order.id);
        console.log('🟢 [ORDER_CREATED] Order details:', {
            order_id: order.id,
            customer_id: order.customer_id,
            user_email: order.user_email,
            variant_id: order.variant_id,
            total: order.total,
            currency: order.currency
        });

        // Find user by customer ID or email
        console.log('🔍 [ORDER_CREATED] Searching for user with:', {
            customer_id: order.customer_id,
            email: order.user_email
        });
        
        userId = await findUserByLemonCustomerIdOrEmail(
            order.customer_id,
            order.user_email
        );

        console.log('🔍 [ORDER_CREATED] User search result:', userId || 'Not found');

        // Get product info
        const product = Object.values(config.products).find(p => 
            p.variant_id === order.variant_id
        );

        if (!product) {
            console.error('❌ [ORDER_CREATED] Product not found for variant:', order.variant_id);
            await addAuditLog(null, 'lemon_webhook', 'order_created_product_not_found', payload.meta.event_id, {
                order_id: order.id,
                variant_id: order.variant_id,
                available_products: Object.keys(config.products)
            });
            return;
        }

        console.log('✅ [ORDER_CREATED] Product found:', {
            name: product.name,
            credits: product.grants.spec_credits,
            unlimited: product.grants.unlimited
        });

        if (userId) {
            console.log('👤 [ORDER_CREATED] User found, proceeding with credit grant');
            
            // Persist Lemon customer ID on user for future lookups
            await db.collection('users').doc(userId).set({
                lemon_customer_id: order.customer_id || null,
                last_entitlement_sync_at: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            console.log('💳 [ORDER_CREATED] Granting credits:', {
                userId,
                credits: product.grants.spec_credits,
                order_id: order.id
            });

            // User exists - grant credits immediately
            const grantResult = await grantCredits(userId, product.grants.spec_credits, order.id, order.variant_id);
            creditsGranted = product.grants.spec_credits;
            
            if (!grantResult) {
                console.error('❌ [ORDER_CREATED] Credit grant failed for user:', userId);
                await addAuditLog(userId, 'lemon_webhook', 'order_created_grant_failed', payload.meta.event_id, {
                    order_id: order.id,
                    variant_id: order.variant_id,
                    credits_attempted: product.grants.spec_credits
                });
                // CRITICAL: Throw error to trigger retry - this prevents lost purchases
                throw new Error(`Failed to grant credits for user ${userId} on order ${order.id}`);
            } else {
                console.log('✅ [ORDER_CREATED] Credits granted successfully');
            }
            
            await addAuditLog(userId, 'lemon_webhook', 'order_created', payload.meta.event_id, {
                order_id: order.id,
                variant_id: order.variant_id,
                credits_granted: product.grants.spec_credits,
                grant_successful: grantResult
            });

            const duration = Date.now() - startTime;
            console.log(`✅ [ORDER_CREATED] Completed successfully in ${duration}ms - User: ${userId}, Credits: ${creditsGranted}`);
        } else {
            console.log('⏳ [ORDER_CREATED] User not found, creating pending entitlement');
            
            // User doesn't exist - create pending entitlement
            await createPendingEntitlement(
                order.user_email,
                order.customer_id,
                payload,
                product.grants,
                'order_created_before_signup'
            );

            const duration = Date.now() - startTime;
            console.log(`⏳ [ORDER_CREATED] Pending entitlement created for email: ${order.user_email} in ${duration}ms`);
            
            await addAuditLog(null, 'lemon_webhook', 'order_created_pending', payload.meta.event_id, {
                order_id: order.id,
                variant_id: order.variant_id,
                user_email: order.user_email,
                credits_will_grant: product.grants.spec_credits
            });
        }

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error('❌ [ORDER_CREATED] Error handling order:', {
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
        
        console.log('Processing order_refunded:', order.id);

        // Find user
        const userId = await findUserByLemonCustomerIdOrEmail(
            order.customer_id,
            order.user_email
        );

        if (!userId) {
            console.log('User not found for refund:', order.user_email);
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

            console.log(`Credits refunded for user ${userId}: ${product.grants.spec_credits}`);
        }

    } catch (error) {
        console.error('Error handling order_refunded:', error);
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
        
        console.log('Processing subscription_created:', subscription.id);

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

            console.log(`Pro subscription enabled for user ${userId}`);
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

                console.log(`Pending Pro subscription created for email: ${subscription.user_email}`);
            }
        }

    } catch (error) {
        console.error('Error handling subscription_created:', error);
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
        
        console.log('Processing subscription_payment_success:', subscription.id);

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

            console.log(`Pro subscription renewed for user ${userId}`);
        }

    } catch (error) {
        console.error('Error handling subscription_payment_success:', error);
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
        
        console.log('Processing subscription_updated:', subscription.id);

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

            console.log(`Subscription updated for user ${userId}: ${subscription.status}`);
        }

    } catch (error) {
        console.error('Error handling subscription_updated:', error);
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
        
        console.log('Processing subscription_cancelled:', subscription.id);

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

            console.log(`Subscription cancelled for user ${userId} - Pro access until period end`);
        }

    } catch (error) {
        console.error('Error handling subscription_cancelled:', error);
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
        
        console.log('Processing subscription_expired:', subscription.id);

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

            console.log(`Pro access revoked for user ${userId}`);
        }

    } catch (error) {
        console.error('Error handling subscription_expired:', error);
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
        
        console.log('Processing subscription_payment_failed:', subscription.id);

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

            console.log(`Payment failed for user ${userId} subscription`);
        }

    } catch (error) {
        console.error('Error handling subscription_payment_failed:', error);
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
        console.log('═══════════════════════════════════════════════');
        console.log('🌐 [WEBHOOK] Received Lemon Squeezy webhook request');
        console.log('🌐 [WEBHOOK] Request headers:', {
            signature: req.headers['x-signature'] ? req.headers['x-signature'].substring(0, 20) + '...' : 'none',
            'user-agent': req.headers['user-agent']
        });

        // Verify signature
        console.log('🔒 [WEBHOOK] Verifying signature...');
        const isValidSignature = await verifySignature(req);
        if (!isValidSignature) {
            console.error('❌ [WEBHOOK] Invalid webhook signature - rejecting request');
            console.log('═══════════════════════════════════════════════');
            return res.status(401).json({ error: 'Invalid signature' });
        }
        console.log('✅ [WEBHOOK] Signature verified successfully');

        // Parse payload
        payload = JSON.parse(req.body.toString());
        console.log('📦 [WEBHOOK] Payload parsed successfully');
        console.log('📦 [WEBHOOK] Event details:', {
            event_id: payload.meta.event_id,
            event_name: payload.meta.event_name
        });
        
        // Log full payload for debugging (first 500 chars)
        const payloadPreview = JSON.stringify(payload, null, 2).substring(0, 500);
        console.log('📦 [WEBHOOK] Payload preview:', payloadPreview + '...');

        // Check idempotency
        const eventId = payload.meta.event_id;
        console.log('🔍 [WEBHOOK] Checking if event already processed:', eventId);
        
        if (await isEventProcessed(eventId)) {
            console.log('⚠️ [WEBHOOK] Event already processed:', eventId);
            console.log('═══════════════════════════════════════════════');
            return res.status(200).json({ message: 'Event already processed' });
        }
        console.log('✅ [WEBHOOK] Event not processed yet');

        // Mark as processed immediately to prevent duplicates
        console.log('🔄 [WEBHOOK] Marking event as processed...');
        await markEventProcessed(eventId);
        console.log('✅ [WEBHOOK] Event marked as processed');

        // Handle event based on type
        const eventType = payload.meta.event_name;
        console.log('🔄 [WEBHOOK] Processing event type:', eventType);

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
                console.log('⚠️ [WEBHOOK] Unhandled event type:', eventType);
                await addAuditLog(null, 'lemon_webhook', 'unhandled_event', eventId, {
                    event_type: eventType,
                    payload: payload
                });
        }

        const duration = Date.now() - startTime;
        console.log('✅ [WEBHOOK] Webhook processed successfully in', duration, 'ms');
        console.log('═══════════════════════════════════════════════');
        res.status(200).json({ message: 'Webhook processed successfully' });

    } catch (error) {
        const duration = Date.now() - startTime;
        console.error('❌ [WEBHOOK] Error processing webhook after', duration, 'ms:', {
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
            console.log('✅ [WEBHOOK] Error logged to audit_logs');
        } catch (logError) {
            console.error('❌ [WEBHOOK] Error logging audit:', logError);
        }

        console.log('═══════════════════════════════════════════════');
        res.status(500).json({ error: 'Internal server error' });
    }
}

module.exports = {
    handleLemonWebhook
};