/**
 * Test Webhook Endpoint Script
 *
 * Usage: node backend/scripts/test-webhook.js
 *
 * This script tests the Lemon Squeezy webhook endpoint
 */

const crypto = require('crypto');

// Mock Lemon Squeezy webhook payload for order_created
const mockPayload = {
    meta: {
        event_name: 'order_created',
        event_id: 'test_event_' + Date.now(),
        custom_data: {}
    },
    data: {
        id: 'test_order_' + Date.now(),
        attributes: {
            customer_id: 'test_customer_' + Date.now(),
            user_email: 'test@example.com',
            variant_id: '91788779-0286-4f45-ad89-2fefc3835699', // single_spec variant
            total: 490, // $4.90 in cents
            currency: 'USD',
            status: 'paid'
        }
    }
};

const webhookSecret = 'specifys_ai_secret_2025';

// Create signature like Lemon Squeezy does
function createSignature(payload, secret) {
    const payloadString = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
}

async function testWebhook() {
    try {
        console.log('🧪 Testing Lemon Squeezy Webhook Endpoint');
        console.log('==========================================\n');

        const signature = createSignature(mockPayload, webhookSecret);

        console.log('📤 Sending test webhook...');
        console.log('URL: http://localhost:10000/api/webhook/lemon');
        console.log('Method: POST');
        console.log('Signature:', signature.substring(0, 20) + '...');
        console.log('Payload:', JSON.stringify(mockPayload, null, 2));

        const response = await fetch('http://localhost:10000/api/webhook/lemon', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-signature': signature,
                'User-Agent': 'Lemon Squeezy/1.0'
            },
            body: JSON.stringify(mockPayload)
        });

        const result = await response.text();
        console.log('\n📥 Response:');
        console.log('Status:', response.status);
        console.log('Body:', result);

        if (response.status === 200) {
            console.log('\n✅ Webhook processed successfully!');
        } else {
            console.log('\n❌ Webhook failed!');
        }

    } catch (error) {
        console.error('\n❌ Error testing webhook:', error.message);
        console.log('\n💡 Make sure the server is running on http://localhost:10000');
    }
}

testWebhook();
