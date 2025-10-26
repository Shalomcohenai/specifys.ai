# Lemon Squeezy Payment Integration Documentation

## Overview

This document provides comprehensive setup instructions and troubleshooting guide for the Lemon Squeezy payment integration in Specifys.ai.

## Architecture

The integration consists of several key components:

1. **Configuration**: `/config/lemon-products.json` - Product definitions and webhook secret
2. **Backend Services**: 
   - `entitlement-service.js` - Credit management and user entitlements
   - `lemon-webhook.js` - Webhook processing and signature verification
   - `spec-routes.js` - API endpoints with authorization
3. **Frontend Components**:
   - `paywall.js` - Payment modal and checkout integration
   - `credits-display.js` - Real-time credits display
4. **Database**: Firestore collections for entitlements, purchases, subscriptions

## Setup Instructions

### 1. Lemon Squeezy Configuration

#### Get Webhook Secret
1. Log into your Lemon Squeezy dashboard
2. Go to Settings → Webhooks
3. Create a new webhook with URL: `https://yourdomain.com/api/webhook/lemon`
4. Copy the webhook secret
5. Update `/config/lemon-products.json` with the secret

#### Product Configuration
The products are already configured in `/config/lemon-products.json`:

```json
{
  "lemon_store_id": "230339",
  "webhook_id": "57567",
  "currency": "USD",
  "products": {
    "single_spec": {
      "product_id": "671441",
      "variant_id": "1055336",
      "name": "Single AI Specification",
      "price_nis": 19,
      "type": "one_time",
      "grants": {
        "spec_credits": 1,
        "can_edit": false,
        "unlimited": false
      }
    },
    "three_pack": {
      "product_id": "671442",
      "variant_id": "1055344",
      "name": "3-Pack AI Specifications",
      "price_nis": 38,
      "type": "one_time",
      "grants": {
        "spec_credits": 3,
        "can_edit": false,
        "unlimited": false
      }
    },
    "pro_monthly": {
      "product_id": "671443",
      "variant_id": "1055346",
      "name": "Pro Monthly Subscription",
      "price_nis": 115,
      "type": "subscription",
      "grants": {
        "spec_credits": 0,
        "can_edit": true,
        "unlimited": true
      }
    },
    "pro_yearly": {
      "product_id": "671444",
      "variant_id": "1055354",
      "name": "Pro Yearly Subscription",
      "price_nis": 1150,
      "type": "subscription",
      "grants": {
        "spec_credits": 0,
        "can_edit": true,
        "unlimited": true
      }
    }
  },
  "webhook_secret": "specifys_ai_secret_2025"
}
```

### 2. Firebase Setup

#### Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules
```

#### Required Collections
The following collections will be auto-created on first write:

- `entitlements`: User credit balances and permissions
- `purchases`: One-time purchase records
- `subscriptions`: Subscription records
- `pending_entitlements`: Credits for unauthenticated users
- `audit_logs`: Webhook processing logs
- `processed_webhook_events`: Idempotency tracking

#### Environment Variables
Create `/backend/.env`:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app

# Server Configuration
PORT=3001

# Lemon Squeezy (already in config file)
LEMON_WEBHOOK_SECRET=specifys_ai_secret_2025
```

### 3. Server Deployment

#### Install Dependencies
```bash
cd backend
npm install express firebase-admin node-fetch joi dotenv
```

#### Start Server
```bash
npm start
```

The server will start on port 3001 with these endpoints:
- `POST /api/webhook/lemon` - Lemon Squeezy webhook
- `POST /api/specs/create` - Create spec with authorization
- `GET /api/specs/entitlements` - Get user entitlements
- `GET /api/specs/status` - Get spec creation status
- `POST /api/specs/check-edit` - Check edit permissions

## User Flow

### 1. Free User Experience
1. User signs up → Gets 1 free spec
2. User creates spec → Free spec consumed
3. User tries to create another spec → Paywall shown
4. User purchases credits → Credits granted via webhook
5. User can create more specs

### 2. Pro Subscription Flow
1. User subscribes to Pro → Webhook enables unlimited access
2. User can create unlimited specs and edit all specs
3. User cancels → Pro access continues until period end
4. Subscription expires → Pro access revoked

### 3. Pending Entitlements Flow
1. Unauthenticated user purchases → Pending entitlement created
2. User signs up with same email → Credits automatically applied
3. User can immediately use purchased credits

## API Endpoints

### POST /api/specs/create
Creates a new specification with authorization check.

**Headers:**
```
Authorization: Bearer <firebase-token>
Content-Type: application/json
```

**Body:**
```json
{
  "userInput": "Create a mobile app for task management"
}
```

**Responses:**
- `200`: Specification created successfully
- `402`: Payment required (returns paywall data)
- `401`: Invalid authentication
- `400`: Invalid input

### GET /api/specs/entitlements
Returns user's current entitlements.

**Headers:**
```
Authorization: Bearer <firebase-token>
```

**Response:**
```json
{
  "success": true,
  "user": {
    "plan": "free",
    "free_specs_remaining": 1
  },
  "entitlements": {
    "spec_credits": 0,
    "unlimited": false,
    "can_edit": false
  }
}
```

## Webhook Events

The system handles these Lemon Squeezy webhook events:

### Order Events
- `order_created`: Grant credits or create pending entitlement
- `order_refunded`: Refund credits

### Subscription Events
- `subscription_created`: Enable Pro subscription
- `subscription_payment_success`: Renew Pro subscription
- `subscription_updated`: Update subscription status
- `subscription_cancelled`: Mark for cancellation (keep Pro until period end)
- `subscription_expired`: Revoke Pro access
- `subscription_payment_failed`: Mark payment as failed

## Database Schema

### entitlements Collection
```javascript
{
  userId: string,
  spec_credits: number,
  unlimited: boolean,
  can_edit: boolean,
  updated_at: timestamp
}
```

### purchases Collection
```javascript
{
  userId: string,
  lemon_order_id: string,
  lemon_event_id: string,
  product_id: string,
  variant_id: string,
  credits_granted: number,
  credits_used: number,
  total_amount_cents: number,
  currency: string,
  status: string,
  purchased_at: timestamp
}
```

### subscriptions Collection
```javascript
{
  userId: string,
  lemon_subscription_id: string,
  product_id: string,
  variant_id: string,
  status: string,
  current_period_end: timestamp,
  cancel_at_period_end: boolean,
  updated_at: timestamp
}
```

### pending_entitlements Collection
```javascript
{
  email: string,
  lemon_customer_id: string,
  payload_json: string,
  grants_json: string,
  reason: string,
  claimed: boolean,
  claimed_at: timestamp,
  claimed_by_user_id: string,
  created_at: timestamp
}
```

## Testing

### Manual Testing Steps

1. **New User Purchase Before Signup**
   - Use test webhook to simulate order_created
   - Verify pending_entitlement created
   - Sign up with same email
   - Verify credits applied automatically

2. **Registered User Purchase**
   - User purchases credits
   - Verify credits granted immediately
   - User creates spec
   - Verify credit consumed

3. **Pro Subscription**
   - User subscribes to Pro
   - Verify unlimited access enabled
   - User cancels subscription
   - Verify Pro access continues until period end

4. **Refund Processing**
   - Process refund webhook
   - Verify credits reverted
   - Verify purchase status updated

### Test Webhooks
Use Lemon Squeezy's test webhook feature to simulate events:

1. Go to Lemon Squeezy Dashboard → Webhooks
2. Click "Send Test Webhook"
3. Select event type and send
4. Check server logs and Firestore data

## Troubleshooting

### Common Issues

#### 1. Webhook Signature Verification Fails
**Symptoms:** 401 errors in webhook logs
**Solutions:**
- Verify webhook secret matches Lemon Squeezy dashboard
- Check that webhook URL is correct
- Ensure server is receiving raw body (not parsed JSON)

#### 2. Credits Not Applied After Purchase
**Symptoms:** User purchases but no credits received
**Solutions:**
- Check webhook processing logs
- Verify user email matches purchase email
- Check pending_entitlements collection
- Verify Firestore rules allow writes

#### 3. Paywall Not Showing
**Symptoms:** Users can create specs without payment
**Solutions:**
- Check entitlement service is working
- Verify API endpoint returns 402 for insufficient credits
- Check frontend handles 402 response correctly

#### 4. Pro Subscription Not Working
**Symptoms:** Pro users can't edit specs
**Solutions:**
- Check subscription webhook processing
- Verify entitlements.unlimited is true
- Check entitlements.can_edit is true
- Verify user.plan is 'pro'

### Debugging Tools

#### 1. Check User Entitlements
```javascript
// In browser console
const user = firebase.auth().currentUser;
const token = await user.getIdToken();
const response = await fetch('/api/specs/entitlements', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();
console.log(data);
```

#### 2. Check Webhook Logs
```bash
# Server logs
tail -f backend/logs/webhook.log

# Firestore audit logs
# Check audit_logs collection in Firebase Console
```

#### 3. Test Webhook Endpoint
```bash
curl -X POST https://yourdomain.com/api/webhook/lemon \
  -H "Content-Type: application/json" \
  -H "x-signature: sha256=test" \
  -d '{"test": "data"}'
```

### Monitoring

#### Key Metrics to Monitor
1. **Webhook Success Rate**: Should be >99%
2. **Credit Application Time**: Should be <30 seconds
3. **Failed Purchases**: Track and investigate
4. **Refund Processing**: Monitor for accuracy

#### Alerts to Set Up
1. Webhook signature verification failures
2. Failed credit applications
3. High error rates in audit logs
4. Subscription payment failures

## Security Considerations

### 1. Webhook Security
- Always verify HMAC-SHA256 signatures
- Use HTTPS for webhook endpoint
- Implement rate limiting (but not for Lemon Squeezy IPs)
- Log all webhook attempts

### 2. Database Security
- Firestore rules prevent unauthorized access
- Admin SDK bypasses rules for webhook processing
- Audit all entitlement changes

### 3. API Security
- Require Firebase authentication for all endpoints
- Validate all input data
- Rate limit API endpoints
- Log all API calls

## Performance Optimization

### 1. Database Optimization
- Use batch writes for multiple operations
- Index frequently queried fields
- Implement caching for entitlements

### 2. Webhook Processing
- Process webhooks asynchronously when possible
- Implement retry logic for failed operations
- Use transactions for atomic operations

### 3. Frontend Optimization
- Cache entitlements data
- Implement optimistic UI updates
- Use polling efficiently for purchase detection

## Maintenance

### Regular Tasks
1. **Weekly**: Review webhook error logs
2. **Monthly**: Audit entitlement accuracy
3. **Quarterly**: Review subscription metrics
4. **Annually**: Update Lemon Squeezy integration

### Backup Strategy
- Firestore automatic backups
- Export critical collections regularly
- Test restore procedures

## Support

For technical support:
1. Check this documentation first
2. Review server logs
3. Test with Lemon Squeezy test webhooks
4. Contact development team with specific error details

## Changelog

### Version 1.0.0
- Initial Lemon Squeezy integration
- Support for one-time purchases and subscriptions
- Pending entitlements for unauthenticated users
- Comprehensive webhook processing
- Real-time credits display
- Paywall integration