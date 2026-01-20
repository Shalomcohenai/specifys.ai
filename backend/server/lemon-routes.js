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
const creditsV3Service = require('./credits-v3-service');
const { recordSubscriptionChange } = require('./admin-activity-service');
const config = require('./config');
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
      try {
      Object.entries(successQuery).forEach(([key, value]) => {
        if (typeof value === 'undefined' || value === null) return;
        successParams.set(key, String(value));
      });
      } catch (entriesError) {
        logger.warn({ 
          requestId, 
          successQuery, 
          error: entriesError.message 
        }, '[lemon-routes] Error processing successQuery entries');
      }
    }
    const successUrl = `${frontendUrl}${normalizedSuccessPath}?${successParams.toString()}`;

    const useTestMode = process.env.LEMON_TEST_MODE !== 'false';
    logger.debug({ requestId, useTestMode, testModeEnv: process.env.LEMON_TEST_MODE }, '[lemon-routes] Test mode configuration');

    // Prepare checkout parameters
    const checkoutParams = {
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
    };

    logger.info({ 
      requestId, 
      userId, 
      userEmail,
      storeId: storeId.toString(), 
      variantId: variantIdToUse.toString(), 
      successUrl, 
      useTestMode,
      checkoutParams: {
        checkoutData: {
          email: checkoutParams.checkoutData.email,
          custom: checkoutParams.checkoutData.custom
        },
        productOptions: checkoutParams.productOptions,
        checkoutOptions: checkoutParams.checkoutOptions,
        testMode: checkoutParams.testMode
      },
      apiKeyExists: !!apiKey,
      apiKeyLength: apiKey ? apiKey.length : 0,
      apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'missing'
    }, '[lemon-routes] 🔵 [CRITICAL] Calling Lemon Squeezy API - ALL PARAMETERS LOGGED');

    // Setup Lemon Squeezy SDK
    lemonSqueezySetup({ apiKey });

    const fetchStartTime = Date.now();
    let checkoutResult;
    try {
      // Use official Lemon Squeezy SDK - handles Cloudflare challenges automatically
      checkoutResult = await createCheckout(
        storeId.toString(),
        variantIdToUse.toString(),
        checkoutParams
      );
      
      const fetchDuration = Date.now() - fetchStartTime;
      logger.info({ 
        requestId, 
        fetchDuration,
        hasData: !!checkoutResult?.data,
        hasError: !!checkoutResult?.error,
        statusCode: checkoutResult?.statusCode,
        responseStructure: {
          hasCheckoutResult: !!checkoutResult,
          hasData: !!checkoutResult?.data,
          hasError: !!checkoutResult?.error,
          keys: checkoutResult ? Object.keys(checkoutResult) : []
        }
      }, '[lemon-routes] 🔵 Lemon Squeezy SDK response received - FULL STRUCTURE LOGGED');
    } catch (sdkError) {
      const fetchDuration = Date.now() - fetchStartTime;
      logger.error({ 
        requestId, 
        userId, 
        userEmail,
        storeId: storeId.toString(),
        variantId: variantIdToUse.toString(),
        error: { 
          message: sdkError.message, 
          stack: sdkError.stack,
          name: sdkError.name,
          code: sdkError.code,
          statusCode: sdkError.statusCode,
          response: sdkError.response
        },
        checkoutParams: {
          checkoutData: {
            email: checkoutParams.checkoutData.email,
            custom: checkoutParams.checkoutData.custom
          },
          productOptions: checkoutParams.productOptions,
          checkoutOptions: checkoutParams.checkoutOptions,
          testMode: checkoutParams.testMode
        },
        apiKeyExists: !!apiKey,
        apiKeyLength: apiKey ? apiKey.length : 0,
        fetchDuration
      }, '[lemon-routes] ❌ [CRITICAL] SDK error calling Lemon Squeezy API - FULL ERROR DETAILS LOGGED');
      throw sdkError;
    }

    // Check for SDK errors
    if (checkoutResult?.error) {
      logger.error({ 
        requestId, 
        userId, 
        userEmail,
        variantId: variantIdToUse, 
        storeId: storeId.toString(),
        error: checkoutResult.error,
        errorType: typeof checkoutResult.error,
        errorKeys: typeof checkoutResult.error === 'object' && checkoutResult.error ? Object.keys(checkoutResult.error) : [],
        statusCode: checkoutResult?.statusCode,
        hasErrorsArray: Array.isArray(checkoutResult.error?.errors),
        errorsCount: Array.isArray(checkoutResult.error?.errors) ? checkoutResult.error.errors.length : 0,
        apiKeyLength: apiKey ? apiKey.length : 0,
        apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'missing',
        checkoutParams: {
          checkoutData: {
            email: checkoutParams.checkoutData.email,
            custom: checkoutParams.checkoutData.custom
          },
          productOptions: checkoutParams.productOptions,
          checkoutOptions: checkoutParams.checkoutOptions,
          testMode: checkoutParams.testMode
        }
      }, '[lemon-routes] ❌ [CRITICAL] Lemon Squeezy SDK returned error - FULL ERROR STRUCTURE LOGGED');
      
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

    // SDK returns: { statusCode, error, data }
    // data structure: { jsonapi, links, data: { type, id, attributes: { url, ... }, ... } }
    if (!checkoutResult?.data) {
      logger.error({ 
        requestId,
        userId, 
        checkoutResult,
        statusCode: checkoutResult?.statusCode
      }, '[lemon-routes] No checkout data in SDK response');
      return next(createError('No checkout data in response', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
        details: 'Lemon Squeezy SDK response did not contain checkout data',
        response: checkoutResult
      }));
    }
    
    // Extract nested data: checkoutResult.data.data.attributes.url
    const checkoutData = checkoutResult.data.data;
    if (!checkoutData) {
      logger.error({ 
        requestId,
        userId, 
        checkoutResult,
        dataKeys: checkoutResult.data ? Object.keys(checkoutResult.data) : []
      }, '[lemon-routes] No nested data in SDK response');
      return next(createError('No checkout data in response', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
        details: 'Lemon Squeezy SDK response structure is invalid',
        responseStructure: {
          hasData: !!checkoutResult.data,
          hasNestedData: !!checkoutResult.data.data,
          dataKeys: checkoutResult.data ? Object.keys(checkoutResult.data) : []
        }
      }));
    }
    
    const checkoutUrlValue = checkoutData.attributes?.url;
    const checkoutId = checkoutData.id;
    
    logger.debug({ 
      requestId, 
      hasCheckoutUrl: !!checkoutUrlValue, 
      checkoutId: checkoutId,
      dataKeys: checkoutData ? Object.keys(checkoutData) : [],
      attributesKeys: checkoutData.attributes ? Object.keys(checkoutData.attributes) : []
    }, '[lemon-routes] Extracting checkout URL from SDK response');

    if (!checkoutUrlValue) {
      logger.error({ 
        requestId,
        userId, 
        checkoutResult,
        checkoutData,
        dataAttributes: checkoutData.attributes,
        dataKeys: checkoutData ? Object.keys(checkoutData) : [],
        attributesKeys: checkoutData.attributes ? Object.keys(checkoutData.attributes) : []
      }, '[lemon-routes] No checkout URL in SDK response');
      return next(createError('No checkout URL in response', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500, {
        details: 'Lemon Squeezy SDK response did not contain checkout URL',
        responseStructure: {
          hasData: !!checkoutResult.data,
          hasNestedData: !!checkoutResult.data.data,
          hasAttributes: !!checkoutData.attributes,
          attributesKeys: checkoutData.attributes ? Object.keys(checkoutData.attributes) : []
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

    const disableResult = await creditsV3Service.disableProSubscription(userId, {
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
 * GET /api/lemon/webhook
 * Health check endpoint for webhook (used by Render/Lemon Squeezy to verify endpoint exists)
 */
router.get('/webhook', async (req, res) => {
  logger.info({ method: 'GET', path: '/webhook' }, '[lemon-routes] GET /webhook - Health check');
  res.status(200).json({
    success: true,
    message: 'Webhook endpoint is active. Use POST method to send webhooks.',
    method: 'POST'
  });
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

      logger.info({ 
        webhookRequestId,
        orderId: orderData.orderId,
        userId: orderData.userId,
        email: orderData.email,
        paymentEmail: orderData.email,
        variantId: orderData.variantId,
        customDataProductKey: customData?.product_key,
        orderDataProductKey: orderData.productKey
      }, '[lemon-routes] 🔵 order_created webhook - Starting processing');

      const allowTestPurchases = process.env.LEMON_ALLOW_TEST_WEBHOOKS === 'true' || process.env.LEMON_TEST_MODE !== 'false';

      // Determine product details
      const resolvedProductKey = customData?.product_key || orderData.productKey || getProductKeyByVariantId(orderData.variantId);
      logger.info({ 
        webhookRequestId,
        orderId: orderData.orderId,
        resolvedProductKey,
        source: customData?.product_key ? 'customData' : (orderData.productKey ? 'orderData' : 'variantId_lookup')
      }, '[lemon-routes] 🔵 Product key resolution');

      const productConfig = resolvedProductKey ? getProductByKey(resolvedProductKey) : getProductByVariantId(orderData.variantId);
      logger.info({ 
        webhookRequestId,
        orderId: orderData.orderId,
        hasProductConfig: !!productConfig,
        productConfigType: productConfig?.type,
        productConfigCredits: productConfig?.credits,
        productConfigName: productConfig?.name
      }, '[lemon-routes] 🔵 Product config lookup result');

      if (orderData.testMode) {
        if (!allowTestPurchases) {
          return res.status(200).json({ received: true, handled: false, reason: 'Test mode disabled' });
        }
      }

      // Check if userId exists
      if (!orderData.userId) {
        return res.status(200).json({ received: true, handled: false, reason: 'Missing userId' });
      }

      // Get user email from Firebase Auth for additional context
      let userEmail = null;
      try {
        const userRecord = await auth.getUser(orderData.userId);
        userEmail = userRecord.email || null;
        logger.info({ 
          webhookRequestId,
          orderId: orderData.orderId,
          userId: orderData.userId,
          userEmail,
          paymentEmail: orderData.email
        }, '[lemon-routes] 🔵 User email retrieved from Firebase Auth');
      } catch (authError) {
        logger.warn({ 
          webhookRequestId,
          orderId: orderData.orderId,
          userId: orderData.userId,
          error: authError.message
        }, '[lemon-routes] ⚠️ Failed to retrieve user email from Firebase Auth');
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
            logger.info({ 
              webhookRequestId,
              orderId: orderData.orderId,
              userId: orderData.userId,
              testMode: orderData.testMode
            }, '[lemon-routes] 🔵 Processing LIVE purchase (not test)');

            const quantityOrdered = Number.isFinite(Number(orderData.quantity))
              ? Math.max(1, Number(orderData.quantity))
              : 1;
            const baseCredits = typeof productConfig?.credits === 'number'
              ? productConfig.credits
              : (typeof productConfig?.credits === 'string' ? Number(productConfig.credits) : null);
            const creditsToGrant = Number.isFinite(baseCredits) ? baseCredits * quantityOrdered : null;

            logger.info({ 
              webhookRequestId,
              orderId: orderData.orderId,
              userId: orderData.userId,
              quantityOrdered,
              baseCredits,
              creditsToGrant,
              productConfigExists: !!productConfig,
              productConfigCreditsType: typeof productConfig?.credits,
              productConfigCreditsValue: productConfig?.credits
            }, '[lemon-routes] 🔵 Credits calculation for grant');

            logger.info({ 
              webhookRequestId,
              orderId: orderData.orderId,
              userId: orderData.userId
            }, '[lemon-routes] 🔵 Calling recordPurchase...');

            await recordPurchase({
              orderId: orderData.orderId,
              orderNumber: orderData.orderNumber,
              userId: orderData.userId,
              email: orderData.email,
              userEmail: userEmail,
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

            logger.info({ 
              webhookRequestId,
              orderId: orderData.orderId,
              userId: orderData.userId,
              userEmail,
              paymentEmail: orderData.email
            }, '[lemon-routes] ✅ recordPurchase completed successfully - Purchase saved to Firestore');

            // Send purchase confirmation email (non-blocking)
            if (userEmail && productConfig) {
              const emailService = require('./email-service');
              const baseUrl = process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';
              const productName = productConfig.name || 'Product';
              const amount = orderData.total || 0;
              const currency = orderData.currency || 'USD';
              
              // Get user display name and check email preferences
              let displayName = userEmail.split('@')[0];
              let shouldSendEmail = true;
              
              if (orderData.userId) {
                try {
                  const userDoc = await db.collection('users').doc(orderData.userId).get();
                  if (userDoc.exists) {
                    const userData = userDoc.data();
                    
                    // Get display name
                    if (userRecord && userRecord.displayName) {
                      displayName = userRecord.displayName;
                    } else {
                      displayName = userData.displayName || displayName;
                    }
                    
                    // Check email preferences for operational emails (purchase confirmations)
                    const emailPrefs = userData.emailPreferences || {
                      newsletter: true,
                      operational: true,
                      marketing: true,
                      specNotifications: true,
                      updates: true
                    };
                    
                    shouldSendEmail = emailPrefs.operational !== false;
                  }
                } catch (displayNameError) {
                  logger.warn({ 
                    webhookRequestId, 
                    orderId: orderData.orderId, 
                    error: displayNameError.message 
                  }, '[lemon-routes] Failed to get user data for purchase email');
                }
              }
              
              // Only send email if user hasn't disabled operational emails
              // Check if purchase email was already sent for this order (webhook might be called multiple times)
              if (shouldSendEmail) {
                // Check if email was already sent for this order
                let orderEmailSent = false;
                try {
                  const orderDoc = await db.collection('orders').doc(orderData.orderId).get();
                  if (orderDoc.exists) {
                    const orderDataFromDb = orderDoc.data();
                    orderEmailSent = orderDataFromDb.purchaseEmailSent === true;
                  }
                } catch (checkError) {
                  logger.warn({ 
                    webhookRequestId, 
                    orderId: orderData.orderId, 
                    error: checkError.message 
                  }, '[lemon-routes] Failed to check if purchase email was already sent');
                }
                
                if (!orderEmailSent) {
                  emailService.sendPurchaseConfirmationEmail(
                    userEmail,
                    displayName,
                    orderData.userId || null,
                    productName,
                    amount,
                    currency,
                    orderData.orderId,
                    baseUrl
                  )
                    .then(() => {
                      // Mark email as sent for this order
                      db.collection('orders').doc(orderData.orderId).update({
                        purchaseEmailSent: true,
                        purchaseEmailSentAt: admin.firestore.FieldValue.serverTimestamp()
                      }).catch(updateErr => {
                        logger.warn({ 
                          webhookRequestId, 
                          orderId: orderData.orderId, 
                          error: updateErr.message 
                        }, '[lemon-routes] Failed to mark purchase email as sent');
                      });
                    })
                    .catch(err => {
                      logger.warn({ 
                        webhookRequestId, 
                        orderId: orderData.orderId, 
                        error: err.message 
                      }, '[lemon-routes] Failed to send purchase confirmation email (non-fatal)');
                    });
                } else {
                  logger.info({ 
                    webhookRequestId, 
                    orderId: orderData.orderId,
                    userId: orderData.userId 
                  }, '[lemon-routes] Skipped purchase confirmation email - already sent for this order');
                }
              } else {
                logger.info({ 
                  webhookRequestId, 
                  orderId: orderData.orderId,
                  userId: orderData.userId 
                }, '[lemon-routes] Skipped purchase confirmation email - user disabled operational emails');
              }
            }

            // CRITICAL: Log all values before checking conditions for credit grant
            logger.info({ 
              webhookRequestId,
              orderId: orderData.orderId,
              userId: orderData.userId,
              hasProductConfig: !!productConfig,
              productConfigType: productConfig?.type,
              productConfigCredits: productConfig?.credits,
              productConfigName: productConfig?.name,
              creditsToGrant,
              creditsToGrantType: typeof creditsToGrant,
              creditsToGrantValue: creditsToGrant,
              isCreditsToGrantNumber: typeof creditsToGrant === 'number',
              isCreditsToGrantPositive: creditsToGrant && creditsToGrant > 0,
              condition1_productConfigExists: !!productConfig,
              condition2_productTypeIsOneTime: productConfig?.type === 'one_time',
              condition3_creditsToGrantExists: !!creditsToGrant,
              condition4_creditsToGrantPositive: creditsToGrant && creditsToGrant > 0,
              allConditionsMet: !!(productConfig && productConfig.type === 'one_time' && creditsToGrant && creditsToGrant > 0)
            }, '[lemon-routes] 🔵 [CRITICAL] Checking if credits should be granted - ALL CONDITIONS LOGGED');

            if (productConfig) {
              logger.info({ 
                webhookRequestId,
                orderId: orderData.orderId,
                userId: orderData.userId,
                productConfigType: productConfig.type,
                creditsToGrant
              }, '[lemon-routes] 🔵 ✅ productConfig EXISTS - proceeding to check product type');

              logger.info({ 
                webhookRequestId,
                orderId: orderData.orderId,
                userId: orderData.userId,
                productConfigType: productConfig.type,
                isOneTime: productConfig.type === 'one_time',
                creditsToGrant,
                creditsToGrantExists: !!creditsToGrant,
                creditsToGrantPositive: creditsToGrant && creditsToGrant > 0,
                willEnterOneTimeBlock: !!(productConfig.type === 'one_time' && creditsToGrant && creditsToGrant > 0)
              }, '[lemon-routes] 🔵 [CRITICAL] Checking one_time conditions - BREAKDOWN');

              if (productConfig.type === 'one_time' && creditsToGrant && creditsToGrant > 0) {
                logger.info({ 
                  webhookRequestId,
                  orderId: orderData.orderId,
                  userId: orderData.userId,
                  creditsToGrant,
                  productType: productConfig.type,
                  conditionCheck: 'ALL CONDITIONS MET - ENTERING grantCredits BLOCK'
                }, '[lemon-routes] 🟢 [SUCCESS] Conditions met for granting credits - CALLING grantCredits NOW...');
                logger.info({ 
                  webhookRequestId,
                  orderId: orderData.orderId,
                  userId: orderData.userId,
                  creditsToGrant,
                  productType: productConfig.type
                }, '[lemon-routes] 🟢 Conditions met for granting credits - calling grantCredits...');

                try {
                  logger.info({ 
                    webhookRequestId,
                    orderId: orderData.orderId,
                    userId: orderData.userId,
                    creditsToGrant,
                    transactionId: orderData.orderId ? `lemon_${orderData.orderId}` : undefined,
                    metadata: {
                      orderId: orderData.orderId,
                      variantId: orderData.variantId,
                      productId: orderData.productId,
                      productKey: resolvedProductKey
                    }
                  }, '[lemon-routes] 🔵 [CRITICAL] CALLING grantCredits NOW - parameters logged');

                  const grantResult = await creditsV3Service.grantCredits(
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
                  
                  logger.info({ 
                    webhookRequestId,
                    orderId: orderData.orderId,
                    userId: orderData.userId,
                    creditsToGrant,
                    grantResult: {
                      success: grantResult.success,
                      creditsAdded: grantResult.creditsAdded,
                      remaining: grantResult.remaining,
                      alreadyProcessed: grantResult.alreadyProcessed,
                      transactionId: grantResult.transactionId
                    }
                  }, '[lemon-routes] ✅ [SUCCESS] grantCredits completed successfully - CREDITS GRANTED');
                } catch (creditError) {
                  logger.error({ 
                    webhookRequestId,
                    orderId: orderData.orderId,
                    userId: orderData.userId,
                    creditsToGrant,
                    error: creditError.message,
                    stack: creditError.stack
                  }, '[lemon-routes] ❌ grantCredits FAILED - throwing error');
                  throw creditError;
                }
              } else if (productConfig.type === 'subscription') {
                logger.info({ 
                  webhookRequestId,
                  orderId: orderData.orderId,
                  userId: orderData.userId,
                  productType: productConfig.type
                }, '[lemon-routes] 🔵 Processing subscription product');
                try {
                  // CRITICAL FIX: In order_created webhook, subscription ID may not exist yet
                  // Try to fetch it from Lemon API using the order ID
                  let resolvedSubscriptionId = orderData.subscriptionId;
                  
                  if (!resolvedSubscriptionId || resolvedSubscriptionId === 'null') {
                    logger.info({ 
                      webhookRequestId, 
                      orderId: orderData.orderId, 
                      userId: orderData.userId 
                    }, '[lemon-routes] Subscription ID missing in order_created - attempting to fetch from Lemon API');
                    
                    try {
                      const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
                      const fetch = globalThis.fetch || require('node-fetch');
                      
                      if (apiKey && orderData.orderId) {
                        // Fetch order from Lemon API to get subscription ID
                        const orderUrl = `https://api.lemonsqueezy.com/v1/orders/${encodeURIComponent(orderData.orderId)}`;
                        const orderResponse = await fetch(orderUrl, {
                          method: 'GET',
                          headers: {
                            'Accept': 'application/vnd.api+json',
                            'Content-Type': 'application/vnd.api+json',
                            'Authorization': `Bearer ${apiKey}`
                          }
                        });
                        
                        if (orderResponse.ok) {
                          const orderApiData = await orderResponse.json();
                          const orderAttrs = orderApiData?.data?.attributes || {};
                          const orderRels = orderApiData?.data?.relationships || {};
                          
                          // Try to get subscription ID from order
                          resolvedSubscriptionId = 
                            orderAttrs.subscription_id ||
                            orderRels?.subscription?.data?.id ||
                            null;
                          
                          if (resolvedSubscriptionId) {
                            logger.info({ 
                              webhookRequestId, 
                              orderId: orderData.orderId,
                              subscriptionId: resolvedSubscriptionId 
                            }, '[lemon-routes] Found subscription ID from Lemon API order lookup');
                            orderData.subscriptionId = resolvedSubscriptionId.toString();
                          } else {
                            logger.warn({ 
                              webhookRequestId, 
                              orderId: orderData.orderId 
                            }, '[lemon-routes] No subscription ID in order - will be set by subscription_created webhook');
                          }
                        }
                      }
                    } catch (fetchErr) {
                      logger.warn({ 
                        webhookRequestId, 
                        error: fetchErr.message,
                        orderId: orderData.orderId 
                      }, '[lemon-routes] Failed to fetch subscription ID from order API - subscription_created webhook will handle it');
                    }
                  }
                  
                  // For subscription orders, calculate currentPeriodEnd from billing interval
                  // This will be calculated in enableProSubscription from purchase_date if not provided
                  let currentPeriodEnd = null;
                  
                  const enableProOptions = {
                    plan: 'pro',
                    orderId: orderData.orderId,
                    productId: orderData.productId,
                    productKey: resolvedProductKey,
                    productName: productConfig.name,
                    productType: productConfig.type,
                    variantId: orderData.variantId,
                    // CRITICAL: Only use subscriptionId if we actually have one
                    // If null, subscription_created webhook will update it later
                    subscriptionId: resolvedSubscriptionId || null,
                    subscriptionStatus: orderData.subscriptionStatus || 'active',
                    subscriptionInterval: productConfig.billing_interval || null,
                    currentPeriodEnd: currentPeriodEnd,
                    total: orderData.total,
                    currency: orderData.currency,
                    metadata: {
                      lemonCustomerId: orderData.customerId || null,
                      orderCreatedWebhook: true,
                      subscriptionIdResolved: !!resolvedSubscriptionId
                    }
                  };
                  
                  // Update V3 subscription
                  // Note: If subscriptionId is null, subscription_created webhook will update it
                  await creditsV3Service.enableProSubscription(orderData.userId, enableProOptions);
                  logger.info({ 
                    webhookRequestId,
                    userId: orderData.userId,
                    subscriptionId: resolvedSubscriptionId || 'null - waiting for subscription_created',
                    orderId: orderData.orderId
                  }, '[lemon-routes] V3 subscription enabled from order webhook');
                } catch (subscriptionError) {
                  logger.error({ 
                    webhookRequestId,
                    userId: orderData.userId,
                    error: subscriptionError.message 
                  }, '[lemon-routes] Error enabling subscription from order webhook');
                  throw subscriptionError;
                }
              } else {
                // productConfig.type is NOT 'one_time' OR creditsToGrant is null/0
                logger.warn({ 
                  webhookRequestId,
                  orderId: orderData.orderId,
                  userId: orderData.userId,
                  productConfigType: productConfig.type,
                  creditsToGrant,
                  creditsToGrantType: typeof creditsToGrant,
                  condition1_productTypeIsOneTime: productConfig.type === 'one_time',
                  condition2_creditsToGrantExists: !!creditsToGrant,
                  condition3_creditsToGrantPositive: creditsToGrant && creditsToGrant > 0,
                  failureReason: !(productConfig.type === 'one_time') ? 'productType is not one_time' : (!creditsToGrant ? 'creditsToGrant is null/0' : 'unknown')
                }, '[lemon-routes] ⚠️ [FAILED] productConfig exists but conditions NOT met for granting credits - DETAILED BREAKDOWN');
              }
            } else {
              logger.warn({ 
                webhookRequestId,
                orderId: orderData.orderId,
                userId: orderData.userId,
                resolvedProductKey,
                productConfigIsNull: true,
                resolvedProductKeyValue: resolvedProductKey
              }, '[lemon-routes] ⚠️ [FAILED] productConfig is NULL - skipping credit grant - PRODUCT CONFIG LOOKUP FAILED');
            }
          }

        } catch (error) {
          logger.error({ 
            webhookRequestId,
            orderId: orderData?.orderId,
            userId: orderData?.userId,
            error: error.message,
            stack: error.stack
          }, '[lemon-routes] ❌ Error in order_created webhook processing - rethrowing');
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

      // Check if user.plan is 'pro' (fallback for missing product_key)
      let isProUser = false;
      try {
        const userDoc = await db.collection('users').doc(subscriptionUserId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          isProUser = userData.plan === 'pro' || userData.plan === 'Pro';
        }
      } catch (userCheckError) {
        logger.warn({ webhookRequestId, userId: subscriptionUserId, error: userCheckError.message }, '[lemon-routes] Failed to check user.plan (non-critical)');
      }

      // Enable Pro subscription if: (explicit Pro product) OR (user.plan is Pro AND subscription is active)
      if (isActive && (resolvedProductKey || isProUser)) {
        try {
          // Extract renewal/expiration date from subscription data
          // Prioritize renewsAt (for active subscriptions), then endsAt (for cancelled)
          const renewalDate = subscriptionData.renewsAt || subscriptionData.endsAt || null;
          
          const enableProOptions = {
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
            currentPeriodEnd: renewalDate, // Pass renewal date as currentPeriodEnd
            cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd || false,
            total: null,
            currency: null,
            metadata: {
              lemonCustomerId: subscriptionData.customerId || null,
              webhookRequestId
            }
          };
          
          // Update V3 subscription
          await creditsV3Service.enableProSubscription(subscriptionUserId, enableProOptions);
          logger.info({ webhookRequestId, userId: subscriptionUserId }, '[lemon-routes] V3 subscription enabled from webhook');
          
          // Record activity (already done in enableProSubscription, but adding here for webhook context)
          try {
            const userDoc = await db.collection('users').doc(subscriptionUserId).get();
            const userEmail = userDoc.exists ? userDoc.data().email : subscriptionData.customerId || null;
            
            recordSubscriptionChange(
              subscriptionUserId,
              userEmail,
              'pro',
              subscriptionData.status || 'active',
              {
                subscriptionId: subscriptionData.subscriptionId,
                productKey: resolvedProductKey,
                productName: productConfig?.name,
                source: 'webhook',
                webhookRequestId
              }
            ).catch(err => {
              logger.warn({ webhookRequestId, userId: subscriptionUserId, error: err.message }, '[lemon-routes] Failed to record subscription activation activity');
            });
          } catch (err) {
            // Ignore - activity recording is non-critical
          }
        } catch (enableErr) {
        }
      } else if (isCancelled || (!isActive && subscriptionData.cancelAtPeriodEnd)) {
        try {
          const disableProOptions = {
            subscriptionId: subscriptionData.subscriptionId,
            cancelReason: 'webhook',
            restoreCredits: null
          };
          
          // Update V3 subscription
          await creditsV3Service.disableProSubscription(subscriptionUserId, disableProOptions);
          logger.info({ webhookRequestId, userId: subscriptionUserId }, '[lemon-routes] V3 subscription disabled from webhook');
          
          // Record activity (already done in disableProSubscription, but adding here for webhook context)
          try {
            const userDoc = await db.collection('users').doc(subscriptionUserId).get();
            const userEmail = userDoc.exists ? userDoc.data().email : subscriptionData.customerId || null;
            
            recordSubscriptionChange(
              subscriptionUserId,
              userEmail,
              'pro',
              'cancelled',
              {
                subscriptionId: subscriptionData.subscriptionId,
                cancelReason: 'webhook',
                cancelMode: subscriptionData.cancelAtPeriodEnd ? 'period_end' : 'immediate',
                source: 'webhook',
                webhookRequestId
              }
            ).catch(err => {
              logger.warn({ webhookRequestId, userId: subscriptionUserId, error: err.message }, '[lemon-routes] Failed to record subscription cancellation activity');
            });
          } catch (err) {
            // Ignore - activity recording is non-critical
          }
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
