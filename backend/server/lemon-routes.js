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
const { verifyWebhookSignature, parseWebhookPayload } = require('./lemon-webhook-utils');
const { recordTestPurchase, getTestPurchaseCount } = require('./lemon-credits-service');
const { getProductByKey, getProductByVariantId, getProductKeyByVariantId } = require('./lemon-products-config');
const { recordPurchase } = require('./lemon-purchase-service');
const creditsService = require('./credits-service');

/**
 * Middleware to verify Firebase ID token
 */
async function verifyFirebaseToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No valid authorization header' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);

    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * POST /api/lemon/checkout
 * Creates a checkout session with Lemon Squeezy
 */
router.post('/checkout', express.json(), verifyFirebaseToken, async (req, res) => {
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
      return res.status(500).json({ 
        error: 'Lemon Squeezy configuration missing',
        details: 'Please configure LEMON_SQUEEZY_API_KEY and LEMON_SQUEEZY_STORE_ID in Render environment variables',
        missing: {
          apiKey: !apiKey,
          storeId: !storeId
        }
      });
    }

    const productConfig = productKey ? getProductByKey(productKey) : null;
    const variantIdToUse = productConfig?.variant_id || defaultVariantId;

    if (!variantIdToUse) {
      return res.status(500).json({
        error: 'Lemon Squeezy variant configuration missing',
        details: 'No variant ID provided. Ensure LEMON_SQUEEZY_VARIANT_ID is set or supply a valid productKey.',
        productKey
      });
    }

    if (productKey && !productConfig) {
      return res.status(400).json({
        error: 'Invalid product key',
        details: `Product key "${productKey}" not found in lemon-products configuration`
      });
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
      
      return res.status(response.status).json({ 
        error: errorMessage,
        details: errorDetails
      });
    }

    const responseData = await response.json();
    const checkoutUrlValue = responseData.data?.attributes?.url;

    if (!checkoutUrlValue) {
      return res.status(500).json({ error: 'No checkout URL in response' });
    }

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
    console.error('Error creating checkout:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout',
      details: error.message 
    });
  }
});

/**
 * POST /api/lemon/subscription/cancel
 * Cancel current Lemon Squeezy subscription for authenticated user
 */
router.post('/subscription/cancel', express.json(), verifyFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const userEmail = req.user.email;
    const reason = req.body?.reason || 'user_requested';
    const cancelImmediately = req.body?.cancelImmediately === true;

    console.log('[LEMON][CANCEL] Cancellation requested', {
      userId,
      userEmail,
      reason,
      cancelImmediately
    });

    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Lemon Squeezy configuration missing',
        details: 'LEMON_SQUEEZY_API_KEY not configured on server'
      });
    }

    const subscriptionDocRef = db.collection('subscriptions').doc(userId);
    const subscriptionDoc = await subscriptionDocRef.get();
    if (!subscriptionDoc.exists) {
      console.warn('[LEMON][CANCEL] No subscription doc found for user', userId);
      return res.status(404).json({ error: 'No active subscription found for this user' });
    }

    const subscriptionData = subscriptionDoc.data() || {};
    let subscriptionId = subscriptionData.lemon_subscription_id;
    let subscriptionDocUpdated = false;

    if (!subscriptionId) {
      console.warn('[LEMON][CANCEL] Subscription doc missing lemon_subscription_id', {
        userId,
        subscriptionDoc: subscriptionData
      });
    } else {
      console.log('[LEMON][CANCEL] Subscription doc already has lemon_subscription_id', subscriptionId);
    }

    const findSubscriptionIdFromPurchases = async () => {
      try {
        const snapshot = await db
          .collection('purchases')
          .where('userId', '==', userId)
          .orderBy('createdAt', 'desc')
          .limit(10)
          .get();

        if (!snapshot.empty) {
          for (const docSnap of snapshot.docs) {
            const purchase = docSnap.data() || {};
            const candidate =
              purchase.subscriptionId ||
              purchase.subscription_id ||
              purchase.subscriptionID ||
              purchase.metadata?.subscription_id ||
              purchase.metadata?.subscriptionId ||
              purchase.metadata?.subscription?.id;
            if (candidate) {
              console.log('[LEMON][CANCEL] Found subscriptionId via purchases (createdAt ordered query):', candidate);
              return candidate.toString();
            }
            const custom = purchase.metadata?.custom || purchase.checkoutData?.custom || {};
            const customCandidate =
              custom.subscription_id ||
              custom.subscriptionId ||
              custom.subscriptionID;
            if (customCandidate) {
              console.log('[LEMON][CANCEL] Found subscriptionId in purchase custom metadata:', customCandidate);
              return customCandidate.toString();
            }
          }
        }
      } catch (queryError) {
        if (queryError?.code === 9 || /index/i.test(queryError?.message || '')) {
          console.warn('[LEMON][CANCEL] Index missing for purchases query, falling back to unordered scan.');
          const fallbackSnapshot = await db
            .collection('purchases')
            .where('userId', '==', userId)
            .limit(25)
            .get();

          for (const docSnap of fallbackSnapshot.docs) {
            const purchase = docSnap.data() || {};
            const candidate =
              purchase.subscriptionId ||
              purchase.subscription_id ||
              purchase.subscriptionID ||
              purchase.metadata?.subscription_id ||
              purchase.metadata?.subscriptionId ||
              purchase.metadata?.subscription?.id;
            if (candidate) {
              console.log('[LEMON][CANCEL] Found subscriptionId via purchases fallback (unordered):', candidate);
              return candidate.toString();
            }
            const custom = purchase.metadata?.custom || purchase.checkoutData?.custom || {};
            const customCandidate =
              custom.subscription_id ||
              custom.subscriptionId ||
              custom.subscriptionID;
            if (customCandidate) {
              console.log('[LEMON][CANCEL] Found subscriptionId via purchases fallback custom metadata:', customCandidate);
              return customCandidate.toString();
            }
          }
        } else {
          console.warn('Failed to query purchases for subscription ID:', queryError);
        }
      }

      console.log('[LEMON][CANCEL] No subscriptionId found in purchases collection.');

      return null;
    };

    const fetchSubscriptionIdFromLemon = async () => {
      if (!apiKey) return null;

      const lemonHeaders = {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/vnd.api+json'
      };

      const candidates = [];
      if (subscriptionData?.metadata?.lemonCustomerId) {
        candidates.push({
          type: 'customer_id',
          value: subscriptionData.metadata.lemonCustomerId
        });
      }
      if (subscriptionData?.metadata?.lemonCustomerID) {
        candidates.push({
          type: 'customer_id',
          value: subscriptionData.metadata.lemonCustomerID
        });
      }
      if (subscriptionData?.metadata?.customer_id) {
        candidates.push({
          type: 'customer_id',
          value: subscriptionData.metadata.customer_id
        });
      }
      if (subscriptionData?.metadata?.customerId) {
        candidates.push({
          type: 'customer_id',
          value: subscriptionData.metadata.customerId
        });
      }
      if (userEmail) {
        candidates.push({
          type: 'email',
          value: userEmail
        });
      }

      for (const candidate of candidates) {
        try {
          const url =
            candidate.type === 'customer_id'
              ? `https://api.lemonsqueezy.com/v1/subscriptions?filter[customer_id]=${encodeURIComponent(candidate.value)}`
              : `https://api.lemonsqueezy.com/v1/subscriptions?filter[email]=${encodeURIComponent(candidate.value)}`;

          console.log('[LEMON][CANCEL] Attempting to fetch subscription from Lemon API', {
            filterType: candidate.type,
            value: candidate.value
          });

          const response = await fetch(url, {
            method: 'GET',
            headers: lemonHeaders
          });

          if (!response.ok) {
            let errorBody = null;
            try {
              errorBody = await response.json();
            } catch (parseErr) {
              errorBody = await response.text();
            }
            console.warn('[LEMON][CANCEL] Lemon API returned non-OK response for subscription lookup', {
              status: response.status,
              statusText: response.statusText,
              body: errorBody
            });
            continue;
          }

          const data = await response.json();
          const records = Array.isArray(data?.data) ? data.data : [];

          console.log('[LEMON][CANCEL] Lemon API subscription lookup results', {
            filterType: candidate.type,
            recordCount: records.length
          });

          for (const record of records) {
            const attributes = record?.attributes || {};
            const status = attributes?.status || attributes?.data?.status;

            if (status === 'cancelled' && !attributes?.renews_at) {
              continue;
            }

            const foundId = record?.id || attributes?.subscription_id || attributes?.id;
            if (foundId) {
              console.log('[LEMON][CANCEL] Found subscriptionId via Lemon API lookup:', foundId);
              return foundId.toString();
            }
          }
        } catch (apiError) {
          console.warn('[LEMON][CANCEL] Lemon API lookup failed', {
            filterType: candidate.type,
            error: apiError?.message || apiError
          });
        }
      }

      console.warn('[LEMON][CANCEL] Lemon API lookup did not return any active subscriptions for this user.');
      return null;
    };

    const fetchSubscriptionIdFromLastOrder = async () => {
      const lastOrderId =
        subscriptionData?.last_order_id ||
        subscriptionData?.lastOrderId ||
        subscriptionData?.last_order?.id ||
        subscriptionData?.metadata?.last_order_id ||
        subscriptionData?.metadata?.order_id;

      if (!lastOrderId) {
        return null;
      }

      try {
        const orderDoc = await db.collection('purchases').doc(lastOrderId.toString()).get();
        if (orderDoc.exists) {
          const purchase = orderDoc.data() || {};
          const candidate =
            purchase.subscriptionId ||
            purchase.subscription_id ||
            purchase.subscriptionID ||
            purchase.metadata?.subscription_id ||
            purchase.metadata?.subscriptionId ||
            purchase.metadata?.subscription?.id;
          if (candidate) {
            console.log('[LEMON][CANCEL] Found subscriptionId via last order lookup:', candidate);
            return candidate.toString();
          }
        } else {
          console.log('[LEMON][CANCEL] Last order doc not found for id', lastOrderId);
        }
      } catch (orderError) {
        console.warn('[LEMON][CANCEL] Failed to load last order doc:', orderError?.message || orderError);
      }

      return null;
    };

    if (!subscriptionId) {
      subscriptionId = await findSubscriptionIdFromPurchases();
      if (subscriptionId) {
        try {
          await subscriptionDocRef.set(
            {
              lemon_subscription_id: subscriptionId,
              updated_at: admin.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
          );
          subscriptionDocUpdated = true;
          console.log('[LEMON][CANCEL] Backfilled lemon_subscription_id onto subscription doc');
        } catch (updateError) {
          console.warn('Unable to backfill lemon_subscription_id on subscription doc:', updateError);
        }
      }
    }

    if (!subscriptionId) {
      subscriptionId = await fetchSubscriptionIdFromLastOrder();
      if (subscriptionId) {
        try {
          await subscriptionDocRef.set(
            {
              lemon_subscription_id: subscriptionId,
              updated_at: admin.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
          );
          subscriptionDocUpdated = true;
          console.log('[LEMON][CANCEL] Backfilled lemon_subscription_id via last order lookup onto subscription doc');
        } catch (updateError) {
          console.warn('Unable to backfill lemon_subscription_id from last order on subscription doc:', updateError);
        }
      }
    }

    if (!subscriptionId) {
      subscriptionId = await fetchSubscriptionIdFromLemon();
      if (subscriptionId) {
        try {
          await subscriptionDocRef.set(
            {
              lemon_subscription_id: subscriptionId,
              updated_at: admin.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
          );
          subscriptionDocUpdated = true;
          console.log('[LEMON][CANCEL] Backfilled lemon_subscription_id from Lemon API onto subscription doc');
        } catch (updateError) {
          console.warn('Unable to backfill lemon_subscription_id from Lemon API on subscription doc:', updateError);
        }
      }
    }

    if (!subscriptionId) {
      console.error('[LEMON][CANCEL] Unable to determine subscriptionId for user', userId, {
        subscriptionDocExists: subscriptionDoc.exists,
        subscriptionDataKeys: Object.keys(subscriptionData || {}),
        purchaseQueryTried: true,
        lastOrderAttempted: !!(subscriptionData?.last_order_id || subscriptionData?.lastOrderId),
        lemonLookupAttempted: !!apiKey
      });
      return res.status(400).json({
        error: 'Subscription record missing Lemon Squeezy subscription ID',
        details: 'No subscriptionId found in subscriptions or purchases collection for this user.'
      });
    }

    console.log('[LEMON][CANCEL] Proceeding with Lemon Squeezy cancellation', {
      subscriptionId,
      subscriptionDocUpdated
    });

    const cancelEndpoint = `https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`;
    const cancelPayload = {
      data: {
        type: 'subscriptions',
        id: subscriptionId.toString(),
        attributes: {
          cancel_at_period_end: !cancelImmediately,
          cancellation_reason: reason
        }
      }
    };

    let cancelResponse = await fetch(cancelEndpoint, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json'
      },
      body: JSON.stringify(cancelPayload)
    });

    let cancellationMode = cancelImmediately ? 'immediate' : 'period_end';
    let cancelResponseBody = null;

    if (!cancelResponse.ok) {
      const fallbackEndpoint = `https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}/cancel`;
      cancelResponse = await fetch(fallbackEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json'
        },
        body: JSON.stringify(cancelPayload)
      });

      if (!cancelResponse.ok) {
        let errorDetails;
        try {
          errorDetails = await cancelResponse.json();
        } catch (err) {
          errorDetails = await cancelResponse.text();
        }

        console.error('Lemon Squeezy cancellation error:', errorDetails);
        return res.status(cancelResponse.status || 500).json({
          error: 'Failed to cancel subscription with Lemon Squeezy',
          details: errorDetails
        });
      }
    }

    try {
      cancelResponseBody = await cancelResponse.json();
    } catch (err) {
      cancelResponseBody = null;
    }

    const disableResult = await creditsService.disableProSubscription(userId, {
      subscriptionId,
      cancelReason: reason,
      cancelMode: cancellationMode,
      cancelMetadata: {
        lemonResponse: cancelResponseBody
      }
    });

    res.json({
      success: true,
      cancellationMode,
      restoredCredits: disableResult.restoredCredits || 0,
      subscriptionStatus: disableResult.subscriptionStatus || 'cancelled'
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      error: 'Failed to cancel subscription',
      details: error.message
    });
  }
});

/**
 * POST /api/lemon/webhook
 * Handle Lemon Squeezy webhooks
 * Note: This endpoint does NOT require Firebase auth (Lemon Squeezy calls it directly)
 * Note: This route must be registered BEFORE express.json() middleware to access raw body
 */
router.post('/webhook', express.raw({ type: 'application/json', limit: '10mb' }), async (req, res) => {
  try {
    console.log('=== Webhook Received ===');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    
    // Get webhook signature
    const signature = req.headers['x-signature'];
    const secret = process.env.LEMON_WEBHOOK_SECRET;

    if (!signature || !secret) {
      console.error('❌ Missing webhook signature or secret');
      console.error('Signature:', signature ? 'Present' : 'Missing');
      console.error('Secret:', secret ? 'Present' : 'Missing');
      console.error('Environment variable LEMON_WEBHOOK_SECRET is:', secret ? `Set (length: ${secret.length})` : 'NOT SET');
      console.error('Please ensure LEMON_WEBHOOK_SECRET=testpassword123 is set in Render environment variables');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get raw body for signature verification
    const payload = req.body.toString('utf8');
    console.log('Payload length:', payload.length);
    console.log('Payload preview:', payload.substring(0, 500));
    
    // Verify signature
    if (!verifyWebhookSignature(payload, signature, secret)) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
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

    // Always return 200 to acknowledge receipt
    res.status(200).json({ received: true, handled: true });

  } catch (error) {
    console.error('Error processing webhook:', error);
    // Still return 200 to prevent Lemon Squeezy from retrying
    res.status(200).json({ received: true, error: error.message });
  }
});

/**
 * GET /api/lemon/counter
 * Get total test purchase count
 * Public endpoint (no auth required)
 */
router.get('/counter', async (req, res) => {
  try {
    const count = await getTestPurchaseCount();
    res.json({
      success: true,
      count: count
    });
  } catch (error) {
    console.error('Error getting counter:', error);
    res.status(500).json({ 
      error: 'Failed to get counter',
      details: error.message 
    });
  }
});

module.exports = router;
