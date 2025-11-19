const express = require('express');
const router = express.Router();
// Use built-in fetch for Node.js 18+ or fallback to node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
  // Node.js 18+ has built-in fetch
  fetch = globalThis.fetch;
} else {
  // Fallback for older Node versions
  fetch = require('node-fetch');
}
const { auth, db, admin } = require('./firebase-admin');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');
const { verifyWebhookSignature, parseWebhookPayload } = require('./lemon-webhook-utils');
const { recordTestPurchase, getTestPurchaseCount } = require('./lemon-credits-service');
const { getProductByKey, getProductByVariantId, getProductKeyByVariantId } = require('./lemon-products-config');
const { recordPurchase } = require('./lemon-purchase-service');
const creditsService = require('./credits-service');
const {
  resolveSubscription,
  upsertSubscriptionFromWebhook,
  buildSubscriptionUpdateFromRecord,
  hasActiveStatus,
  hasCancelledStatus
} = require('./lemon-subscription-resolver');

/**
 * Middleware to verify Firebase ID token
 */
async function verifyFirebaseToken(req, res, next) {
  logger.debug({ path: req.path }, '[lemon-routes] Verifying Firebase token');
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn({ path: req.path }, '[lemon-routes] No valid authorization header');
      return next(createError('No valid authorization header', ERROR_CODES.UNAUTHORIZED, 401));
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);

    logger.debug({ userId: decodedToken.uid, path: req.path }, '[lemon-routes] Token verified successfully');
    req.user = decodedToken;
    next();
  } catch (error) {
    logger.error({ error: error.message, path: req.path }, '[lemon-routes] Token verification failed');
    next(createError('Invalid token', ERROR_CODES.INVALID_TOKEN, 401));
  }
}

/**
 * POST /api/lemon/checkout
 * Creates a checkout session with Lemon Squeezy
 */
router.post('/checkout', express.json(), verifyFirebaseToken, async (req, res, next) => {
  try {
    const userId = req.user.uid;
    const userEmail = req.user.email;
    const {
      productKey = null,
      successPath = null,
      successQuery = null,
      quantity = 1
    } = req.body || {};

    // Get Lemon Squeezy configuration
    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
    const storeId = process.env.LEMON_SQUEEZY_STORE_ID;
    const defaultVariantId = process.env.LEMON_SQUEEZY_VARIANT_ID;

    if (!apiKey || !storeId) {
      logger.error({ userId }, '[lemon-routes] Lemon Squeezy configuration missing');
      return next(createError('Lemon Squeezy configuration missing', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
        details: 'Please configure LEMON_SQUEEZY_API_KEY and LEMON_SQUEEZY_STORE_ID in Render environment variables',
        missing: {
          apiKey: !apiKey,
          storeId: !storeId
        }
      }));
    }

    const productConfig = productKey ? getProductByKey(productKey) : null;
    const variantIdToUse = productConfig?.variant_id || defaultVariantId;

    if (!variantIdToUse) {
      logger.error({ userId, productKey }, '[lemon-routes] Lemon Squeezy variant configuration missing');
      return next(createError('Lemon Squeezy variant configuration missing', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
        details: 'No variant ID provided. Ensure LEMON_SQUEEZY_VARIANT_ID is set or supply a valid productKey.',
        productKey
      }));
    }

    if (productKey && !productConfig) {
      logger.warn({ userId, productKey }, '[lemon-routes] Invalid product key');
      return next(createError('Invalid product key', ERROR_CODES.INVALID_INPUT, 400, {
        details: `Product key "${productKey}" not found in lemon-products configuration`
      }));
    }

    console.log('=== Lemon Checkout Request ===');
    const requestLog = {
      userId,
      userEmail,
      productKey,
      variantId: variantIdToUse,
      storeId,
      successPath,
      successQuery
    };
    console.log(JSON.stringify(requestLog, null, 2));

    // Create checkout via Lemon Squeezy API
    const checkoutUrl = `https://api.lemonsqueezy.com/v1/checkouts`;
    
    // Build success URL for redirect after purchase
    const frontendUrl = process.env.FRONTEND_URL || 'https://specifys-ai.com';
    const inferredSuccessPath = productKey ? '/pages/pricing.html' : '/pages/test-system.html';
    const finalSuccessPath = successPath || inferredSuccessPath;
    const normalizedSuccessPath = finalSuccessPath.startsWith('/') ? finalSuccessPath : `/${finalSuccessPath}`;
    const successParams = new URLSearchParams({ checkout: 'success' });
    if (productKey) {
      successParams.set('product', productKey);
    }
    if (successQuery && typeof successQuery === 'object') {
      Object.entries(successQuery).forEach(([key, value]) => {
        if (typeof value === 'undefined' || value === null) return;
        successParams.set(key, String(value));
      });
    }
    const successUrl = `${frontendUrl}${normalizedSuccessPath}?${successParams.toString()}`;

    const useTestMode = process.env.LEMON_TEST_MODE !== 'false';

    // According to Lemon Squeezy API documentation:
    // - checkout_data should be an object (not array)
    // - checkout_options should be an object (not array)
    // - redirect_url should be in product_options, not checkout_options
    const checkoutData = {
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: {
            email: userEmail,
            custom: {
              user_id: userId,
              product_key: productKey,
              variant_id: variantIdToUse
            }
          },
          test_mode: useTestMode,
          product_options: {
            redirect_url: successUrl
          },
          checkout_options: {
            embed: true // Enable overlay mode
          }
        },
        relationships: {
          store: {
            data: {
              type: 'stores',
              id: storeId.toString()
            }
          },
          variant: {
            data: {
              type: 'variants',
              id: variantIdToUse.toString()
            }
          }
        }
      }
    };

    const response = await fetch(checkoutUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json'
      },
      body: JSON.stringify(checkoutData)
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = await response.text();
      }
      
      console.error('Lemon Squeezy API error:', JSON.stringify(errorData, null, 2));
      console.error('Used variantId:', variantIdToUse);
      console.error('Used storeId:', storeId);
      
      // Parse Lemon Squeezy error details
      let errorMessage = 'Failed to create checkout';
      let errorDetails = errorData;
      
      if (errorData.errors && Array.isArray(errorData.errors)) {
        const variantError = errorData.errors.find(err => 
          err.source?.pointer?.includes('variant') || 
          err.detail?.includes('variant')
        );
        
        if (variantError) {
          errorMessage = `Variant ID not found: ${variantIdToUse}`;
          errorDetails = {
            error: 'Variant does not exist',
            detail: variantError.detail || 'The variant ID provided does not exist in your Lemon Squeezy store',
            variantId: variantIdToUse,
            storeId: storeId,
            hint: 'Please verify that LEMON_SQUEEZY_VARIANT_ID in Render matches a valid variant ID from your Lemon Squeezy dashboard'
          };
        }
      }
      
      logger.error({ userId, errorData, variantId: variantIdToUse, storeId }, '[lemon-routes] Lemon Squeezy API error');
      return next(createError(errorMessage, ERROR_CODES.EXTERNAL_SERVICE_ERROR, response.status || 500, errorDetails));
    }

    const responseData = await response.json();
    const checkoutUrlValue = responseData.data?.attributes?.url;

    if (!checkoutUrlValue) {
      logger.error({ userId }, '[lemon-routes] No checkout URL in response');
      return next(createError('No checkout URL in response', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500));
    }

    logger.info({ userId, checkoutUrl: checkoutUrlValue }, '[lemon-routes] POST /checkout - Success');
    res.json({
      success: true,
      checkoutUrl: checkoutUrlValue,
      checkoutId: responseData.data?.id,
      product: productConfig ? {
        key: productKey,
        name: productConfig.name,
        type: productConfig.type,
        credits: productConfig.credits,
        billingInterval: productConfig.billing_interval || null
      } : null,
      testMode: useTestMode
    });

    console.log('✅ Lemon checkout created successfully:', {
      checkoutId: responseData.data?.id,
      productKey,
      variantId: variantIdToUse,
      testMode: useTestMode
    });

  } catch (error) {
    const requestId = req.requestId || `lemon-checkout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.error({ requestId, userId: req.user?.uid, error: { message: error.message, stack: error.stack } }, '[lemon-routes] POST /checkout - Error');
    next(createError('Failed to create checkout', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
      details: error.message
    }));
  }
});

/**
 * POST /api/lemon/subscription/cancel
 * Cancel current Lemon Squeezy subscription for authenticated user
 */
router.post('/subscription/cancel', express.json(), verifyFirebaseToken, async (req, res, next) => {
  const requestId = req.requestId || `lemon-cancel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ requestId, userId: req.user?.uid }, '[lemon-routes] POST /subscription/cancel - Cancelling subscription');
  
  try {
    const userId = req.user.uid;
    const userEmail = req.user.email;
    const reason = req.body?.reason || 'user_requested';
    const cancelImmediately = req.body?.cancelImmediately === true;

    logger.debug({ requestId, userId, userEmail, reason, cancelImmediately }, '[lemon-routes] Cancellation requested');

    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
    if (!apiKey) {
      logger.error({ requestId }, '[lemon-routes] Lemon Squeezy configuration missing');
      return next(createError('Lemon Squeezy configuration missing', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
        details: 'LEMON_SQUEEZY_API_KEY not configured on server'
      }));
    }

    const subscriptionDocRef = db.collection('subscriptions').doc(userId);
    const subscriptionDoc = await subscriptionDocRef.get();
    if (!subscriptionDoc.exists) {
      logger.warn({ requestId, userId }, '[lemon-routes] No subscription doc found for user');
      return next(createError('No active subscription found for this user', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
    }

    const subscriptionData = subscriptionDoc.data() || {};
    const lemonMode = process.env.LEMON_MODE
      ? process.env.LEMON_MODE.toLowerCase()
      : (process.env.LEMON_TEST_MODE === 'true' ? 'test' : 'live');
    const storeId = process.env.LEMON_SQUEEZY_STORE_ID || null;
    // Note: requestId is already defined above, don't override it

    console.log('[LEMON][CANCEL] Start resolver', {
      requestId,
      userId,
      userEmail,
      lemonMode,
      storeId,
      cancelImmediately,
      hasStoredId: !!subscriptionData.lemon_subscription_id
    });

    const resolution = await resolveSubscription({
      db,
      admin,
      fetch,
      userId,
      userEmail,
      subscriptionDocRef,
      subscriptionData,
      apiKey,
      storeId,
      mode: lemonMode,
      requestId,
      logger: console
    });

    if (!resolution || !resolution.subscriptionId) {
      console.warn('[LEMON][CANCEL] Resolver could not determine subscription ID', {
        requestId,
        attempts: resolution?.attempts || null
      });
      logger.warn({ requestId, userId }, '[lemon-routes] Subscription not found');
      return next(createError('Subscription not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404, {
        details: 'לא נמצא מנוי פעיל לחשבון זה או שקיימת חוסר התאמה בין מצב Test/Live, ה-API key או ה-store ID.',
        requestId
      }));
    }

    const subscriptionId = resolution.subscriptionId;
    const subscriptionAttributes = resolution.attributes || {};
    const resolvedStatus = resolution.status || subscriptionAttributes.status || null;
    const resolvedEndsAt =
      subscriptionAttributes.ends_at ||
      subscriptionAttributes.ends_at_formatted ||
      subscriptionAttributes.cancelled_at ||
      subscriptionAttributes.renews_at ||
      null;

    console.log('[LEMON][CANCEL] Resolver result', {
      requestId,
      subscriptionId,
      source: resolution.source,
      resolvedStatus,
      attempts: resolution.attempts
    });

    console.log('[LEMON][CANCEL] Proceeding with Lemon Squeezy cancellation', {
      requestId,
      subscriptionId,
      cancelImmediately
    });

    const cancelEndpoint = `https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`;
    const lemonHeaders = {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/vnd.api+json'
    };

    let cancellationMode = cancelImmediately ? 'immediate' : 'period_end';
    let cancelResponse;
    let cancelResponseBody = null;

    if (cancelImmediately) {
      cancelResponse = await fetch(cancelEndpoint, {
        method: 'DELETE',
        headers: lemonHeaders
      });
    } else {
      const patchPayload = {
        data: {
          type: 'subscriptions',
          id: subscriptionId.toString(),
          attributes: {
            cancel_at_period_end: true,
            cancellation_reason: reason
          }
        }
      };

      cancelResponse = await fetch(cancelEndpoint, {
        method: 'PATCH',
        headers: {
          ...lemonHeaders,
          'Content-Type': 'application/vnd.api+json'
        },
        body: JSON.stringify(patchPayload)
      });

      if (!cancelResponse.ok) {
        let patchErrorBody = null;
        try {
          patchErrorBody = await cancelResponse.clone().json();
        } catch (cloneErr) {
          try {
            patchErrorBody = await cancelResponse.clone().text();
          } catch (textErr) {
            patchErrorBody = null;
          }
        }

        console.warn('[LEMON][CANCEL] Patch cancellation failed, attempting immediate delete', {
          requestId,
          subscriptionId,
          status: cancelResponse.status,
          body: patchErrorBody
        });

        cancellationMode = 'immediate';
        cancelResponse = await fetch(cancelEndpoint, {
          method: 'DELETE',
          headers: lemonHeaders
        });
      }
    }

    if (!cancelResponse.ok) {
      let errorDetails = null;
      try {
        errorDetails = await cancelResponse.clone().json();
      } catch (err) {
        try {
          errorDetails = await cancelResponse.clone().text();
        } catch (textErr) {
          errorDetails = null;
        }
      }

      const errorSummary = Array.isArray(errorDetails?.errors)
        ? errorDetails.errors.map((err) => err.detail || err.title).filter(Boolean).join(' | ')
        : null;

      console.error('[LEMON][CANCEL] Lemon API cancellation failed', {
        requestId,
        subscriptionId,
        status: cancelResponse.status,
        body: errorDetails
      });

      return res.status(cancelResponse.status || 500).json({
        error: 'Failed to cancel subscription with Lemon Squeezy',
        details: errorSummary || 'Lemon Squeezy rejected the cancellation request. בדוק שהחנות והמפתחות תואמים למצב Test/Live.',
        requestId
      });
    }

    try {
      cancelResponseBody = await cancelResponse.clone().json();
    } catch (err) {
      cancelResponseBody = null;
    }

    if (cancelResponseBody?.data) {
      const built = buildSubscriptionUpdateFromRecord(cancelResponseBody.data, subscriptionData, admin);
      if (built?.update) {
        const updatePayload = {
          ...built.update,
          last_synced_source: 'cancel_api',
          last_synced_mode: lemonMode
        };
        try {
          await subscriptionDocRef.set(updatePayload, { merge: true });
        } catch (backfillErr) {
          console.warn('[LEMON][CANCEL] Failed to backfill subscription doc after cancellation', {
            requestId,
            error: backfillErr?.message || backfillErr
          });
        }
      }
    }

    const effectiveEndsAt =
      cancelResponseBody?.data?.attributes?.ends_at ||
      cancelResponseBody?.data?.attributes?.ends_at_formatted ||
      resolvedEndsAt;

    const disableResult = await creditsService.disableProSubscription(userId, {
      subscriptionId,
      cancelReason: reason,
      cancelMode: cancellationMode,
      metadata: {
        resolverSource: resolution.source,
        resolvedStatus,
        resolvedEndsAt: resolvedEndsAt || null,
        lemonMode,
        requestId
      },
      cancelMetadata: {
        lemonResponse: cancelResponseBody
      }
    });

    res.json({
      success: true,
      cancellationMode,
      subscriptionStatus: disableResult.subscriptionStatus || 'cancelled',
      restoredCredits: disableResult.restoredCredits || 0,
      endsAt: effectiveEndsAt || null,
      requestId
    });
  } catch (error) {
    logger.error({ requestId, userId: req.user?.uid, error: { message: error.message, stack: error.stack } }, '[lemon-routes] POST /subscription/cancel - Error');
    next(createError('Failed to cancel subscription', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
      details: error.message,
      requestId: requestId || undefined
    }));
  }
});

/**
 * POST /api/lemon/webhook
 * Handle Lemon Squeezy webhooks
 * Note: This endpoint does NOT require Firebase auth (Lemon Squeezy calls it directly)
 * Note: This route must be registered BEFORE express.json() middleware to access raw body
 */
router.post('/webhook', express.raw({ type: 'application/json', limit: '10mb' }), async (req, res, next) => {
  const webhookRequestId = req.headers['x-request-id'] || `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  logger.info({ webhookRequestId }, '[lemon-routes] POST /webhook - Webhook received');
  
  try {
    
    // Get webhook signature
    const signature = req.headers['x-signature'];
    const secret = process.env.LEMON_WEBHOOK_SECRET;

    if (!signature || !secret) {
      console.error('❌ Missing webhook signature or secret');
      console.error('Signature:', signature ? 'Present' : 'Missing');
      console.error('Secret:', secret ? 'Present' : 'Missing');
      console.error('Environment variable LEMON_WEBHOOK_SECRET is:', secret ? `Set (length: ${secret.length})` : 'NOT SET');
      console.error('Please ensure LEMON_WEBHOOK_SECRET=testpassword123 is set in Render environment variables');
      logger.warn({}, '[lemon-routes] Webhook unauthorized - missing signature or secret');
      return next(createError('Unauthorized', ERROR_CODES.UNAUTHORIZED, 401));
    }

    // Get raw body for signature verification
    const payload = req.body.toString('utf8');
    logger.debug({ payloadLength: payload.length }, '[lemon-routes] Webhook payload received');
    
    // Verify signature
    if (!verifyWebhookSignature(payload, signature, secret)) {
      logger.warn({}, '[lemon-routes] Webhook invalid signature');
      return next(createError('Invalid signature', ERROR_CODES.UNAUTHORIZED, 401));
    }

    console.log('✅ Webhook signature verified');

    // Parse webhook payload
    const event = JSON.parse(payload);
    console.log('Event name:', event.meta?.event_name);
    console.log('Event type:', event.meta?.event_name);
    
    const parsed = parseWebhookPayload(event);

    if (!parsed) {
      console.log('Unhandled webhook event:', event.meta?.event_name);
      return res.status(200).json({ received: true, handled: false });
    }

    // Handle order_created event
    if (parsed.eventName === 'order_created') {
      const { orderData, customData } = parsed;

      // Log full order data for debugging
      console.log('=== Webhook Order Data ===');
      console.log('Order ID:', orderData.orderId);
      console.log('User ID:', orderData.userId);
      console.log('Email:', orderData.email);
      console.log('Test Mode:', orderData.testMode);
      console.log('Variant ID:', orderData.variantId);
      console.log('Full orderData:', JSON.stringify(orderData, null, 2));

      const allowTestPurchases = process.env.LEMON_ALLOW_TEST_WEBHOOKS === 'true' || process.env.LEMON_TEST_MODE !== 'false';

      // Determine product details
      const resolvedProductKey = customData?.product_key || orderData.productKey || getProductKeyByVariantId(orderData.variantId);
      const productConfig = resolvedProductKey ? getProductByKey(resolvedProductKey) : getProductByVariantId(orderData.variantId);

      if (orderData.testMode) {
        if (!allowTestPurchases) {
          console.log('⚠️ Ignoring test mode purchase (test mode disabled)');
          return res.status(200).json({ received: true, handled: false, reason: 'Test mode disabled' });
        }
      } else {
        console.log('Processing live purchase (testMode false)');
      }

      // Check if userId exists
      if (!orderData.userId) {
        console.log('⚠️ Missing userId in order data, cannot record purchase');
        return res.status(200).json({ received: true, handled: false, reason: 'Missing userId' });
      }

      // Record purchase in Firebase
      if (orderData.orderId) {
        try {
          if (orderData.testMode) {
            await recordTestPurchase(
              orderData.userId,
              orderData.orderId,
              orderData.variantId,
              {
                email: orderData.email,
                orderNumber: orderData.orderNumber,
                amount: orderData.total,
                currency: orderData.currency,
                productId: orderData.productId,
                quantity: orderData.quantity || 1,
                testMode: true,
                productKey: resolvedProductKey
              }
            );

            console.log(`✅ Test purchase recorded: Order ${orderData.orderId} for user ${orderData.userId}`);
          } else {
            const quantityOrdered = Number.isFinite(Number(orderData.quantity))
              ? Math.max(1, Number(orderData.quantity))
              : 1;
            const baseCredits = typeof productConfig?.credits === 'number'
              ? productConfig.credits
              : (typeof productConfig?.credits === 'string' ? Number(productConfig.credits) : null);
            const creditsToGrant = Number.isFinite(baseCredits) ? baseCredits * quantityOrdered : null;

            await recordPurchase({
              orderId: orderData.orderId,
              orderNumber: orderData.orderNumber,
              userId: orderData.userId,
              email: orderData.email,
              variantId: orderData.variantId,
              productId: orderData.productId,
              productKey: resolvedProductKey,
              productName: productConfig?.name || null,
              productType: productConfig?.type || null,
              credits: creditsToGrant,
              quantity: quantityOrdered,
              total: orderData.total,
              currency: orderData.currency,
              testMode: orderData.testMode,
              subscriptionId: orderData.subscriptionId,
              subscriptionStatus: orderData.subscriptionStatus,
              subscriptionInterval: productConfig?.billing_interval || null,
              rawPayload: event,
              metadata: {
                customData,
                lemonMeta: event.meta || {}
              }
            });

            console.log(`✅ Live purchase recorded: Order ${orderData.orderId} for user ${orderData.userId}`);

            if (productConfig) {
              if (productConfig.type === 'one_time' && creditsToGrant && creditsToGrant > 0) {
                try {
                  await creditsService.grantCredits(
                    orderData.userId,
                    creditsToGrant,
                    'lemon_squeezy',
                    {
                      orderId: orderData.orderId,
                      variantId: orderData.variantId,
                      productId: orderData.productId,
                      productKey: resolvedProductKey,
                      productName: productConfig.name,
                      productType: productConfig.type,
                      quantity: quantityOrdered,
                      lemonCustomerId: orderData.customerId || null,
                      transactionId: orderData.orderId ? `lemon_${orderData.orderId}` : undefined
                    }
                  );
                  console.log(`✅ Granted ${creditsToGrant} credits to user ${orderData.userId} for order ${orderData.orderId}`);
                } catch (creditError) {
                  console.error('❌ Error granting credits from Lemon purchase:', creditError);
                  throw creditError;
                }
              } else if (productConfig.type === 'subscription') {
                try {
                  await creditsService.enableProSubscription(orderData.userId, {
                    plan: 'pro',
                    orderId: orderData.orderId,
                    productId: orderData.productId,
                    productKey: resolvedProductKey,
                    productName: productConfig.name,
                    productType: productConfig.type,
                    variantId: orderData.variantId,
                    subscriptionId: orderData.subscriptionId || null,
                    subscriptionStatus: orderData.subscriptionStatus || 'active',
                    subscriptionInterval: productConfig.billing_interval || null,
                    total: orderData.total,
                    currency: orderData.currency,
                    metadata: {
                      lemonCustomerId: orderData.customerId || null
                    }
                  });
                  console.log(`✅ Pro subscription enabled for user ${orderData.userId} (order ${orderData.orderId})`);
                } catch (subscriptionError) {
                  console.error('❌ Error enabling subscription entitlements:', subscriptionError);
                  throw subscriptionError;
                }
              } else {
                console.log(`ℹ️ No entitlement changes configured for product ${resolvedProductKey}`);
              }
            } else {
              console.log('ℹ️ Product configuration not found, skipping entitlement updates');
            }
          }

          console.log(`✅ Webhook processed successfully (mode: ${orderData.testMode ? 'test' : 'live'}): Order ${orderData.orderId} for user ${orderData.userId}`);
        } catch (error) {
          console.error('❌ Error recording purchase:', error);
          throw error;
        }
      } else {
        console.log('⚠️ Missing orderId in order data, cannot record purchase');
        return res.status(200).json({ received: true, handled: false, reason: 'Missing orderId' });
      }
    }

    else if (parsed.subscriptionData) {
      const { subscriptionData, customData } = parsed;
      const subscriptionRecord = subscriptionData.raw;
      const subscriptionUserId =
        subscriptionData.userId ||
        customData?.user_id ||
        customData?.userId ||
        null;
      const webhookRequestId = `webhook_${subscriptionData.subscriptionId || Date.now()}`;
      const isTestEvent = event.meta?.test_mode === true;
      const allowTestPurchases = process.env.LEMON_ALLOW_TEST_WEBHOOKS === 'true' || process.env.LEMON_TEST_MODE !== 'false';

      if (isTestEvent && !allowTestPurchases) {
        console.log('[LEMON][WEBHOOK] Skipping test subscription event (test mode disabled)', {
          webhookRequestId,
          subscriptionId: subscriptionData.subscriptionId
        });
        return res.status(200).json({ received: true, handled: false, reason: 'Test mode disabled' });
      }

      if (!subscriptionUserId) {
        console.warn('[LEMON][WEBHOOK] Subscription event missing userId', {
          webhookRequestId,
          subscriptionId: subscriptionData.subscriptionId
        });
        return res.status(200).json({ received: true, handled: false, reason: 'Missing userId' });
      }

      console.log('[LEMON][WEBHOOK] Processing subscription event', {
        webhookRequestId,
        eventName: parsed.eventName,
        subscriptionId: subscriptionData.subscriptionId,
        status: subscriptionData.status,
        cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd,
        endsAt: subscriptionData.endsAt,
        variantId: subscriptionData.variantId,
        storeId: subscriptionData.storeId,
        customerId: subscriptionData.customerId
      });

      const upsertResult = await upsertSubscriptionFromWebhook({
        db,
        admin,
        fetch,
        userId: subscriptionUserId,
        subscriptionRecord: subscriptionRecord || event.data,
        storeId: subscriptionData.storeId || null,
        mode: isTestEvent ? 'test' : 'live',
        logger: console,
        requestId: webhookRequestId
      });

      const resolvedVariantId =
        subscriptionData.variantId ||
        upsertResult?.attributes?.variant_id ||
        null;

      const resolvedProductKey =
        customData?.product_key ||
        customData?.productKey ||
        getProductKeyByVariantId(resolvedVariantId) ||
        null;

      const productConfig = resolvedProductKey
        ? getProductByKey(resolvedProductKey)
        : getProductByVariantId(resolvedVariantId);

      const isActive = hasActiveStatus(subscriptionData.status);
      const isCancelled = hasCancelledStatus(subscriptionData.status);

      if (isActive) {
        try {
          await creditsService.enableProSubscription(subscriptionUserId, {
            plan: 'pro',
            orderId: subscriptionData.orderId || null,
            productId: subscriptionData.productId || productConfig?.product_id || null,
            productKey: resolvedProductKey,
            productName: productConfig?.name || null,
            productType: productConfig?.type || null,
            variantId: resolvedVariantId || null,
            subscriptionId: subscriptionData.subscriptionId,
            subscriptionStatus: subscriptionData.status || 'active',
            subscriptionInterval: productConfig?.billing_interval || null,
            total: null,
            currency: null,
            metadata: {
              lemonCustomerId: subscriptionData.customerId || null,
              webhookRequestId
            }
          });
          console.log('[LEMON][WEBHOOK] Enabled Pro subscription from webhook', {
            webhookRequestId,
            subscriptionId: subscriptionData.subscriptionId
          });
        } catch (enableErr) {
          console.error('[LEMON][WEBHOOK] Failed to enable subscription entitlements from webhook', {
            webhookRequestId,
            error: enableErr?.message || enableErr
          });
        }
      } else if (isCancelled || (!isActive && subscriptionData.cancelAtPeriodEnd)) {
        try {
          await creditsService.disableProSubscription(subscriptionUserId, {
            subscriptionId: subscriptionData.subscriptionId,
            cancelReason: 'webhook',
            cancelMode: subscriptionData.cancelAtPeriodEnd ? 'period_end' : 'immediate',
            metadata: {
              lemonCustomerId: subscriptionData.customerId || null,
              webhookRequestId
            }
          });
          console.log('[LEMON][WEBHOOK] Disabled subscription entitlements from webhook', {
            webhookRequestId,
            subscriptionId: subscriptionData.subscriptionId
          });
        } catch (disableErr) {
          console.error('[LEMON][WEBHOOK] Failed to disable subscription entitlements from webhook', {
            webhookRequestId,
            error: disableErr?.message || disableErr
          });
        }
      } else {
        console.log('[LEMON][WEBHOOK] Subscription event did not trigger entitlement change', {
          webhookRequestId,
          status: subscriptionData.status
        });
      }

      return res.status(200).json({
        received: true,
        handled: true,
        requestId: webhookRequestId,
        event: parsed.eventName
      });
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ received: true, handled: true });

  } catch (error) {
    logger.error({ webhookRequestId, error: { message: error.message, stack: error.stack } }, '[lemon-routes] POST /webhook - Error');
    // Still return 200 to prevent Lemon Squeezy from retrying (webhooks should not use error handler)
    res.status(200).json({ received: true, error: error.message, requestId: webhookRequestId });
  }
});

/**
 * GET /api/lemon/counter
 * Get total test purchase count
 * Public endpoint (no auth required)
 */
router.get('/counter', async (req, res, next) => {
  try {
    const count = await getTestPurchaseCount();
    logger.info({ count }, '[lemon-routes] GET /counter - Success');
    res.json({
      success: true,
      count: count
    });
  } catch (error) {
    const requestId = req.requestId || `lemon-counter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[lemon-routes] GET /counter - Error');
    next(createError('Failed to get counter', ERROR_CODES.DATABASE_ERROR, 500, {
      details: error.message
    }));
  }
});

module.exports = router;
