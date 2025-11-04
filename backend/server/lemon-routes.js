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
const { auth } = require('./firebase-admin');
const { verifyWebhookSignature, parseWebhookPayload } = require('./lemon-webhook-utils');
const { recordTestPurchase, getTestPurchaseCount } = require('./lemon-credits-service');

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
router.post('/checkout', verifyFirebaseToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const userEmail = req.user.email;

    // Get Lemon Squeezy configuration
    const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
    const storeId = process.env.LEMON_SQUEEZY_STORE_ID;
    const variantId = process.env.LEMON_SQUEEZY_VARIANT_ID;

    if (!apiKey || !storeId || !variantId) {
      return res.status(500).json({ 
        error: 'Lemon Squeezy configuration missing',
        details: 'Please configure LEMON_SQUEEZY_API_KEY, LEMON_SQUEEZY_STORE_ID, and LEMON_SQUEEZY_VARIANT_ID in Render environment variables',
        missing: {
          apiKey: !apiKey,
          storeId: !storeId,
          variantId: !variantId
        }
      });
    }

    // Create checkout via Lemon Squeezy API
    const checkoutUrl = `https://api.lemonsqueezy.com/v1/checkouts`;
    
    // Build success URL for redirect after purchase
    const frontendUrl = process.env.FRONTEND_URL || 'https://specifys-ai.com';
    const successUrl = `${frontendUrl}/pages/test-system.html?checkout=success`;

    const checkoutData = {
      data: {
        type: 'checkouts',
        attributes: {
          checkout_data: [
            {
              email: userEmail,
              custom: {
                user_id: userId
              }
            }
          ],
          test_mode: true,
          checkout_options: {
            embed: true, // Enable overlay mode
            success_url: successUrl,
            redirect_url: successUrl
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
              id: variantId.toString()
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
      console.error('Used variantId:', variantId);
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
          errorMessage = `Variant ID not found: ${variantId}`;
          errorDetails = {
            error: 'Variant does not exist',
            detail: variantError.detail || 'The variant ID provided does not exist in your Lemon Squeezy store',
            variantId: variantId,
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
      checkoutId: responseData.data?.id
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
 * POST /api/lemon/webhook
 * Handle Lemon Squeezy webhooks
 * Note: This endpoint does NOT require Firebase auth (Lemon Squeezy calls it directly)
 * Note: This route must be registered BEFORE express.json() middleware to access raw body
 */
router.post('/webhook', express.raw({ type: 'application/json', limit: '10mb' }), async (req, res) => {
  try {
    // Get webhook signature
    const signature = req.headers['x-signature'];
    const secret = process.env.LEMON_WEBHOOK_SECRET;

    if (!signature || !secret) {
      console.error('Missing webhook signature or secret');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get raw body for signature verification
    const payload = req.body.toString('utf8');
    
    // Verify signature
    if (!verifyWebhookSignature(payload, signature, secret)) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse webhook payload
    const event = JSON.parse(payload);
    const parsed = parseWebhookPayload(event);

    if (!parsed) {
      console.log('Unhandled webhook event:', event.meta?.event_name);
      return res.status(200).json({ received: true, handled: false });
    }

    // Handle order_created event
    if (parsed.eventName === 'order_created') {
      const { orderData } = parsed;

      // Only process test mode purchases
      if (!orderData.testMode) {
        console.log('Ignoring non-test mode purchase');
        return res.status(200).json({ received: true, handled: false, reason: 'Not test mode' });
      }

      // Record purchase in Firebase
      if (orderData.orderId) {
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
            testMode: true
          }
        );

        console.log(`Webhook processed: Order ${orderData.orderId} for user ${orderData.userId}`);
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
