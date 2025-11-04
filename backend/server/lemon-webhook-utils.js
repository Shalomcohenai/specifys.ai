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
      return false;
    }

    // Lemon Squeezy sends signature in format: sha256=hexdigest
    const signatureParts = signature.split('=');
    if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') {
      return false;
    }

    const receivedSignature = signatureParts[1];

    // Calculate HMAC SHA256
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload, 'utf8');
    const calculatedSignature = hmac.digest('hex');

    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature, 'hex'),
      Buffer.from(calculatedSignature, 'hex')
    );
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
      // Custom data can be in: attributes.custom, checkout_data.custom, or order_items
      let customData = {};
      if (attributes.custom) {
        customData = attributes.custom;
      } else if (attributes.checkout_data?.custom) {
        customData = attributes.checkout_data.custom;
      } else if (attributes.order_items && attributes.order_items.length > 0) {
        // Check first order item for custom data
        customData = attributes.order_items[0]?.product_options?.custom || {};
      }
      
      // Extract order details
      const orderData = {
        orderId: eventData.id,
        orderNumber: attributes.order_number || attributes.identifier || null,
        userId: customData.user_id || customData.userId || null,
        email: attributes.customer_email || attributes.email || attributes.user_email || null,
        total: attributes.total || attributes.total_formatted ? parseFloat(attributes.total_formatted.replace(/[^0-9.]/g, '')) * 100 : 0,
        currency: attributes.currency || 'USD',
        testMode: attributes.test_mode !== undefined ? attributes.test_mode : false,
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
