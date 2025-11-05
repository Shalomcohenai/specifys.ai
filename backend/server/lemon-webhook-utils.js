const crypto = require('crypto');

/**
 * Verify Lemon Squeezy webhook signature
 * @param {string} payload - Raw request body as string
 * @param {string} signature - Signature from x-signature header
 * @param {string} secret - Webhook secret from environment
 * @returns {boolean} - True if signature is valid
 */
function verifyWebhookSignature(payload, signature, secret) {
  try {
    if (!payload || !signature || !secret) {
      console.error('Missing parameters for signature verification:', {
        hasPayload: !!payload,
        hasSignature: !!signature,
        hasSecret: !!secret
      });
      return false;
    }

    let receivedSignature;
    
    // Lemon Squeezy can send signature in two formats:
    // 1. sha256=hexdigest (documented format)
    // 2. hexdigest only (actual format being sent based on logs)
    if (signature.includes('=')) {
      // Format: sha256=hexdigest
      const signatureParts = signature.split('=');
      if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') {
        console.error('Invalid signature format (with =):', signature.substring(0, 50));
        return false;
      }
      receivedSignature = signatureParts[1];
    } else {
      // Format: hexdigest only (this is what we're actually receiving)
      receivedSignature = signature;
    }

    // Calculate HMAC SHA256
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload, 'utf8');
    const calculatedSignature = hmac.digest('hex');

    // Use constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(receivedSignature, 'hex'),
      Buffer.from(calculatedSignature, 'hex')
    );
    
    if (!isValid) {
      console.error('Signature verification failed:', {
        receivedLength: receivedSignature.length,
        calculatedLength: calculatedSignature.length,
        receivedPrefix: receivedSignature.substring(0, 20),
        calculatedPrefix: calculatedSignature.substring(0, 20),
        secretLength: secret.length
      });
    }
    
    return isValid;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Parse webhook payload and extract relevant data
 * @param {Object} event - Webhook event data
 * @returns {Object|null} - Parsed data or null if invalid
 */
function parseWebhookPayload(event) {
  try {
    // Lemon Squeezy webhook structure
    if (!event || !event.meta || !event.meta.event_name) {
      return null;
    }

    const eventName = event.meta.event_name;
    const eventData = event.data;

    // Handle order_created event
    if (eventName === 'order_created') {
      if (!eventData || !eventData.attributes) {
        return null;
      }

      const attributes = eventData.attributes;
      const relationships = eventData.relationships || {};
      
      // Extract custom data (contains userId) - check multiple possible locations
      // Based on logs, custom_data is in meta.custom_data
      let customData = {};
      
      // Check meta.custom_data first (this is where Lemon Squeezy actually puts it based on logs)
      if (event.meta?.custom_data) {
        customData = event.meta.custom_data;
        console.log('Found custom_data in meta.custom_data:', customData);
      } else if (attributes.custom) {
        customData = attributes.custom;
        console.log('Found custom_data in attributes.custom:', customData);
      } else if (attributes.checkout_data?.custom) {
        customData = attributes.checkout_data.custom;
        console.log('Found custom_data in attributes.checkout_data.custom:', customData);
      } else if (attributes.order_items && attributes.order_items.length > 0) {
        // Check first order item for custom data
        customData = attributes.order_items[0]?.product_options?.custom || {};
        console.log('Found custom_data in order_items:', customData);
      }
      
      if (!customData || Object.keys(customData).length === 0) {
        console.log('⚠️ No custom_data found in any location');
      }
      
      // Extract order details
      // Note: test_mode can be in meta.test_mode (based on logs) or attributes.test_mode
      const testMode = event.meta?.test_mode !== undefined 
        ? event.meta.test_mode 
        : (attributes.test_mode !== undefined ? attributes.test_mode : false);
      
      const orderData = {
        orderId: eventData.id,
        orderNumber: attributes.order_number || attributes.identifier || null,
        userId: customData.user_id || customData.userId || null,
        email: attributes.customer_email || attributes.email || attributes.user_email || null,
        total: attributes.total || attributes.total_formatted ? parseFloat(attributes.total_formatted.replace(/[^0-9.]/g, '')) * 100 : 0,
        currency: attributes.currency || 'USD',
        testMode: testMode,
        createdAt: attributes.created_at || new Date().toISOString(),
        variantId: null,
        productId: null,
        quantity: 1
      };

      // Try to extract variant ID from order items
      if (attributes.order_items && attributes.order_items.length > 0) {
        const firstItem = attributes.order_items[0];
        orderData.variantId = firstItem.variant_id || firstItem.product_variant_id || null;
        orderData.productId = firstItem.product_id || null;
        orderData.quantity = firstItem.quantity || 1;
        // Also check for custom data in order item
        if (firstItem.custom && !customData.user_id) {
          customData = firstItem.custom;
          orderData.userId = customData.user_id || customData.userId || orderData.userId;
        }
      } else if (relationships.order_items?.data && relationships.order_items.data.length > 0) {
        // Try relationships if available
        const firstItemRel = relationships.order_items.data[0];
        if (firstItemRel.id) {
          // Would need additional API call to get full details
          // For now, we'll log this
          console.log('Order item ID found in relationships:', firstItemRel.id);
        }
      }

      // Extract variant ID from relationships if available
      if (relationships.first_order_item?.data) {
        const itemData = relationships.first_order_item.data;
        if (itemData.type === 'order-items' && itemData.id) {
          // Note: This requires additional API call to get full item details
          // For now, we rely on attributes
        }
      }

      return {
        eventName,
        orderData
      };
    }

    return null;
  } catch (error) {
    console.error('Error parsing webhook payload:', error);
    return null;
  }
}

module.exports = {
  verifyWebhookSignature,
  parseWebhookPayload
};
