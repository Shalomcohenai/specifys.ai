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
// Lemon Squeezy official SDK
const { lemonSqueezySetup, createCheckout } = require('@lemonsqueezy/lemonsqueezy.js');
const { auth, db, admin } = require('./firebase-admin');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');
const { verifyWebhookSignature, parseWebhookPayload } = require('./lemon-webhook-utils');
const { recordTestPurchase, getTestPurchaseCount } = require('./lemon-credits-service');
const { getProductByKey, getProductByVariantId, getProductKeyByVariantId } = require('./lemon-products-config');
const { recordPurchase } = require('./lemon-purchase-service');
const creditsV2Service = require('./credits-v2-service');
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
  const requestId = req.requestId || `checkout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const userId = req.user.uid;
    const userEmail = req.user.email;
    const {
      productKey = null,
      successPath = null,
      successQuery = null,
      quantity = 1
    } = req.body || {};

    logger.info({ 
      requestId, 
      userId, 
      userEmail, 
      productKey, 
      successPath, 
      successQuery, 
      quantity 
    }, '[lemon-routes] POST /checkout - Request received');

    // Get Lemon Squeezy configuration
    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
    const storeId = process.env.LEMON_SQUEEZY_STORE_ID;
    const defaultVariantId = process.env.LEMON_SQUEEZY_VARIANT_ID;

    logger.debug({ 
      requestId, 
      hasApiKey: !!apiKey, 
      apiKeyLength: apiKey ? apiKey.length : 0,
      hasStoreId: !!storeId, 
      storeId: storeId,
      hasDefaultVariantId: !!defaultVariantId,
      defaultVariantId: defaultVariantId
    }, '[lemon-routes] Environment variables check');

    if (!apiKey || !storeId) {
      logger.error({ 
        requestId, 
        userId, 
        missingApiKey: !apiKey, 
        missingStoreId: !storeId,
        apiKeyLength: apiKey ? apiKey.length : 0,
        storeId: storeId
      }, '[lemon-routes] Lemon Squeezy configuration missing');
      return next(createError('Lemon Squeezy configuration missing', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
        details: 'Please configure LEMON_SQUEEZY_API_KEY and LEMON_SQUEEZY_STORE_ID in Render environment variables',
        missing: {
          apiKey: !apiKey,
          storeId: !storeId
        }
      }));
    }

    logger.debug({ requestId, productKey }, '[lemon-routes] Looking up product config');
    const productConfig = productKey ? getProductByKey(productKey) : null;
    logger.debug({ 
      requestId, 
      productKey, 
      foundProductConfig: !!productConfig,
      productConfigVariantId: productConfig?.variant_id,
      defaultVariantId 
    }, '[lemon-routes] Product config lookup result');
    
    const variantIdToUse = productConfig?.variant_id || defaultVariantId;
    logger.debug({ 
      requestId, 
      variantIdToUse, 
      source: productConfig?.variant_id ? 'productConfig' : 'defaultVariantId' 
    }, '[lemon-routes] Variant ID resolution');

    if (!variantIdToUse) {
      logger.error({ 
        requestId, 
        userId, 
        productKey, 
        hasProductConfig: !!productConfig,
        productConfigVariantId: productConfig?.variant_id,
        defaultVariantId 
      }, '[lemon-routes] Lemon Squeezy variant configuration missing');
      return next(createError('Lemon Squeezy variant configuration missing', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
        details: 'No variant ID provided. Ensure LEMON_SQUEEZY_VARIANT_ID is set or supply a valid productKey.',
        productKey
      }));
    }

    if (productKey && !productConfig) {
      logger.warn({ requestId, userId, productKey }, '[lemon-routes] Invalid product key');
      return next(createError('Invalid product key', ERROR_CODES.INVALID_INPUT, 400, {
        details: `Product key "${productKey}" not found in lemon-products configuration`
      }));
    }


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
    logger.debug({ requestId, useTestMode, testModeEnv: process.env.LEMON_TEST_MODE }, '[lemon-routes] Test mode configuration');

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

    logger.info({ 
      requestId, 
      userId, 
      storeId, 
      variantId: variantIdToUse, 
      successUrl, 
      useTestMode
    }, '[lemon-routes] Calling Lemon Squeezy API to create checkout using official SDK');

    // Setup Lemon Squeezy SDK
    lemonSqueezySetup({ apiKey });

    const fetchStartTime = Date.now();
    let checkoutResult;
    try {
      // Use official Lemon Squeezy SDK - handles Cloudflare challenges automatically
      checkoutResult = await createCheckout(
        storeId.toString(),
        variantIdToUse.toString(),
        {
          checkoutData: {
            email: userEmail,
            custom: {
              user_id: userId,
              product_key: productKey,
              variant_id: variantIdToUse
            }
          },
          productOptions: {
            redirectUrl: successUrl
          },
          checkoutOptions: {
            embed: true // Enable overlay mode
          },
          testMode: useTestMode
        }
      );
      
      const fetchDuration = Date.now() - fetchStartTime;
      logger.debug({ 
        requestId, 
        fetchDuration,
        hasData: !!checkoutResult?.data,
        hasError: !!checkoutResult?.error
      }, '[lemon-routes] Lemon Squeezy SDK response received');
    } catch (sdkError) {
      const fetchDuration = Date.now() - fetchStartTime;
      logger.error({ 
        requestId, 
        userId, 
        error: { 
          message: sdkError.message, 
          stack: sdkError.stack,
          name: sdkError.name 
        },
        fetchDuration
      }, '[lemon-routes] SDK error calling Lemon Squeezy API');
      throw sdkError;
    }

    // Check for SDK errors
    if (checkoutResult?.error) {
      logger.error({ 
        requestId, 
        userId, 
        error: checkoutResult.error,
        variantId: variantIdToUse, 
        storeId,
        apiKeyLength: apiKey ? apiKey.length : 0,
        apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'missing'
      }, '[lemon-routes] Lemon Squeezy SDK returned error');
      
      // Parse error details
      let errorMessage = 'Failed to create checkout';
      let errorDetails = checkoutResult.error;
      
      if (checkoutResult.error.errors && Array.isArray(checkoutResult.error.errors)) {
        logger.debug({ requestId, errorCount: checkoutResult.error.errors.length }, '[lemon-routes] Parsing error array');
        const variantError = checkoutResult.error.errors.find(err => 
          err.source?.pointer?.includes('variant') || 
          err.detail?.includes('variant')
        );
        
        if (variantError) {
          logger.warn({ requestId, variantError }, '[lemon-routes] Variant error found in response');
          errorMessage = `Variant ID not found: ${variantIdToUse}`;
          errorDetails = {
            error: 'Variant does not exist',
            detail: variantError.detail || 'The variant ID provided does not exist in your Lemon Squeezy store',
            variantId: variantIdToUse,
            storeId: storeId,
            hint: 'Please verify that LEMON_SQUEEZY_VARIANT_ID in Render matches a valid variant ID from your Lemon Squeezy dashboard'
          };
        } else {
          logger.debug({ requestId, firstError: checkoutResult.error.errors[0] }, '[lemon-routes] First error in array (not variant-related)');
        }
      }
      
      return next(createError(errorMessage, ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, errorDetails));
    }

    if (!checkoutResult?.data) {
      logger.error({ 
        requestId,
        userId, 
        checkoutResult
      }, '[lemon-routes] No checkout data in SDK response');
      return next(createError('No checkout data in response', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
        details: 'Lemon Squeezy SDK response did not contain checkout data',
        response: checkoutResult
      }));
    }
    
    const checkoutUrlValue = checkoutResult.data.attributes?.url;
    const checkoutId = checkoutResult.data.id;
    
    logger.debug({ 
      requestId, 
      hasCheckoutUrl: !!checkoutUrlValue, 
      checkoutId: checkoutId,
      dataKeys: checkoutResult.data ? Object.keys(checkoutResult.data) : []
    }, '[lemon-routes] Extracting checkout URL from SDK response');

    if (!checkoutUrlValue) {
      logger.error({ 
        requestId,
        userId, 
        checkoutResult,
        dataAttributes: checkoutResult.data?.attributes,
        dataKeys: checkoutResult.data ? Object.keys(checkoutResult.data) : []
      }, '[lemon-routes] No checkout URL in SDK response');
      return next(createError('No checkout URL in response', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
        details: 'Lemon Squeezy SDK response did not contain checkout URL',
        responseStructure: {
          hasData: !!checkoutResult.data,
          hasAttributes: !!checkoutResult.data?.attributes,
          attributesKeys: checkoutResult.data?.attributes ? Object.keys(checkoutResult.data.attributes) : []
        }
      }));
    }

    logger.info({ 
      requestId,
      userId, 
      checkoutUrl: checkoutUrlValue,
      checkoutId: checkoutId,
      productKey,
      testMode: useTestMode
    }, '[lemon-routes] POST /checkout - Success');
    
    res.json({
      success: true,
      checkoutUrl: checkoutUrlValue,
      checkoutId: checkoutId,
      product: productConfig ? {
        key: productKey,
        name: productConfig.name,
        type: productConfig.type,
        credits: productConfig.credits,
        billingInterval: productConfig.billing_interval || null
      } : null,
      testMode: useTestMode
    });

  } catch (error) {
    logger.error({ 
      requestId, 
      userId: req.user?.uid, 
      error: { 
        message: error.message, 
        stack: error.stack,
        name: error.name,
        code: error.code
      },
      body: req.body,
      hasUser: !!req.user,
      userEmail: req.user?.email
    }, '[lemon-routes] POST /checkout - Unexpected error');
    next(createError('Failed to create checkout', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
      details: error.message,
      errorType: error.name,
      errorCode: error.code
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
        }
      }
    }

    const effectiveEndsAt =
      cancelResponseBody?.data?.attributes?.ends_at ||
      cancelResponseBody?.data?.attributes?.ends_at_formatted ||
      resolvedEndsAt;

    const disableResult = await creditsV2Service.disableProSubscription(userId, {
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

    // Parse webhook payload
    const event = JSON.parse(payload);
    
    const parsed = parseWebhookPayload(event);

    if (!parsed) {
      return res.status(200).json({ received: true, handled: false });
    }

    // Handle order_created event
    if (parsed.eventName === 'order_created') {
      const { orderData, customData } = parsed;


      const allowTestPurchases = process.env.LEMON_ALLOW_TEST_WEBHOOKS === 'true' || process.env.LEMON_TEST_MODE !== 'false';

      // Determine product details
      const resolvedProductKey = customData?.product_key || orderData.productKey || getProductKeyByVariantId(orderData.variantId);
      const productConfig = resolvedProductKey ? getProductByKey(resolvedProductKey) : getProductByVariantId(orderData.variantId);

      if (orderData.testMode) {
        if (!allowTestPurchases) {
          return res.status(200).json({ received: true, handled: false, reason: 'Test mode disabled' });
        }
      }

      // Check if userId exists
      if (!orderData.userId) {
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


            if (productConfig) {
              if (productConfig.type === 'one_time' && creditsToGrant && creditsToGrant > 0) {
                try {
                  await creditsV2Service.grantCredits(
                    orderData.userId,
                    creditsToGrant,
                    'purchase',
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
                } catch (creditError) {
                  throw creditError;
                }
              } else if (productConfig.type === 'subscription') {
                try {
                  await creditsV2Service.enableProSubscription(orderData.userId, {
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
                } catch (subscriptionError) {
                  throw subscriptionError;
                }
              }
            }
          }

        } catch (error) {
          throw error;
        }
      } else {
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
        return res.status(200).json({ received: true, handled: false, reason: 'Test mode disabled' });
      }

      if (!subscriptionUserId) {
        return res.status(200).json({ received: true, handled: false, reason: 'Missing userId' });
      }


      const upsertResult = await upsertSubscriptionFromWebhook({
        db,
        admin,
        fetch,
        userId: subscriptionUserId,
        subscriptionRecord: subscriptionRecord || event.data,
        storeId: subscriptionData.storeId || null,
        mode: isTestEvent ? 'test' : 'live',
        logger: logger,
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
          await creditsV2Service.enableProSubscription(subscriptionUserId, {
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
        } catch (enableErr) {
        }
      } else if (isCancelled || (!isActive && subscriptionData.cancelAtPeriodEnd)) {
        try {
          await creditsV2Service.disableProSubscription(subscriptionUserId, {
            subscriptionId: subscriptionData.subscriptionId,
            cancelReason: 'webhook',
            cancelMode: subscriptionData.cancelAtPeriodEnd ? 'period_end' : 'immediate',
            metadata: {
              lemonCustomerId: subscriptionData.customerId || null,
              webhookRequestId
            }
          });
        } catch (disableErr) {
        }
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
