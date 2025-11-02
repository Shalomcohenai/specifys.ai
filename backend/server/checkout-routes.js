const express = require('express');
// Handle fetch for different Node versions - use dynamic import for node-fetch v3
let fetch;
if (typeof globalThis.fetch === 'function') {
    fetch = globalThis.fetch;
} else {
    fetch = require('node-fetch');
}
const config = require('../../config/lemon-products.json');
const { verifyFirebaseToken } = require('./spec-routes');

const router = express.Router();

/**
 * Create checkout via Lemon Squeezy API
 * This allows us to pass custom data (userId) to the webhook
 * POST /api/checkout
 * Headers: Authorization: Bearer <firebase-token>
 * Body: { productId: 'single_spec' | 'three_pack' | 'pro_monthly' | 'pro_yearly' }
 */
router.post('/', verifyFirebaseToken, async (req, res) => {
    try {
        console.log('🛒 [CHECKOUT_API] Creating checkout via Lemon Squeezy API');
        
        const { productId } = req.body;
        const userId = req.user.uid;
        const userEmail = req.user.email;
        
        console.log('🛒 [CHECKOUT_API] Request details:', {
            product_id: productId,
            user_id: userId,
            user_email: userEmail
        });
        
        if (!productId) {
            return res.status(400).json({
                error: 'productId is required',
                message: 'Please provide a valid product ID'
            });
        }
        
        // Get product from config
        const product = config.products[productId];
        if (!product) {
            console.error('❌ [CHECKOUT_API] Product not found:', productId);
            return res.status(400).json({
                error: 'Invalid product',
                message: `Product '${productId}' not found`
            });
        }
        
        // Get Lemon Squeezy API key from environment
        const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
        if (!apiKey) {
            console.error('❌ [CHECKOUT_API] LEMON_SQUEEZY_API_KEY not configured');
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'Payment system not configured. Please contact support.'
            });
        }
        
        // Create checkout via Lemon Squeezy API
        const checkoutUrl = `https://api.lemonsqueezy.com/v1/checkouts`;
        
        const checkoutData = {
            data: {
                type: 'checkouts',
                attributes: {
                    store_id: config.lemon_store_id,
                    custom_price: null,
                    product_options: {
                        enabled_variants: [product.variant_id],
                        redirect_url: null,
                        receipt_button_text: null,
                        receipt_link_url: null,
                        receipt_thank_you_note: null
                    },
                    checkout_options: {
                        embed: false,
                        media: false,
                        logo: true,
                        desc: false,
                        discount: true,
                        dark: false,
                        subscription_preview: true,
                        button_color: '#2DD272'
                    },
                    checkout_data: {
                        email: userEmail,
                        name: req.user.displayName || null,
                        billing_address: {},
                        tax_number: null,
                        discount_code: null,
                        custom: {
                            user_id: userId // This will be sent to webhook
                        },
                        variant_quantities: [{
                            variant_id: product.variant_id,
                            quantity: 1
                        }]
                    },
                    preview: true,
                    test_mode: process.env.NODE_ENV !== 'production'
                }
            }
        };
        
        console.log('🛒 [CHECKOUT_API] Calling Lemon Squeezy API:', {
            url: checkoutUrl,
            variant_id: product.variant_id,
            has_custom_data: true
        });
        
        const response = await fetch(checkoutUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.api+json',
                'Content-Type': 'application/vnd.api+json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(checkoutData)
        });
        
        const responseData = await response.json();
        
        if (!response.ok) {
            console.error('❌ [CHECKOUT_API] Lemon Squeezy API error:', {
                status: response.status,
                error: responseData
            });
            
            return res.status(response.status).json({
                error: 'Checkout creation failed',
                message: responseData.errors?.[0]?.detail || 'Failed to create checkout',
                details: responseData
            });
        }
        
        // Extract checkout URL from response
        const checkoutAttributes = responseData.data?.attributes;
        const checkoutUrlFromApi = checkoutAttributes?.url;
        
        if (!checkoutUrlFromApi) {
            console.error('❌ [CHECKOUT_API] No checkout URL in response:', responseData);
            return res.status(500).json({
                error: 'Invalid API response',
                message: 'Checkout URL not received from payment provider'
            });
        }
        
        console.log('✅ [CHECKOUT_API] Checkout created successfully:', {
            checkout_id: responseData.data?.id,
            checkout_url: checkoutUrlFromApi
        });
        
        res.status(200).json({
            checkout_url: checkoutUrlFromApi,
            product: {
                id: productId,
                name: product.name,
                price: product.price_usd,
                credits: product.grants.spec_credits
            }
        });
        
    } catch (error) {
        console.error('❌ [CHECKOUT_API] Error creating checkout:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to create checkout. Please try again.'
        });
    }
});

module.exports = router;

