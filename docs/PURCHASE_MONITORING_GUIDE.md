# 🎯 Purchase System Monitoring Guide

## Overview

Complete guide for monitoring and debugging the purchase system in real-time.

---

## 🚀 Quick Access

### Web-Based Monitor
**URL:** `https://specifys-ai.com/pages/purchase-monitor.html`

**Features:**
- ✅ Real-time webhook event monitoring
- ✅ Auto-refresh every 5 seconds
- ✅ Failed transaction detection
- ✅ Pending credit tracking
- ✅ Success rate statistics
- ✅ Search and filter capabilities

---

## 📊 Monitoring Dashboard

### Statistics Panel

The dashboard shows 4 key metrics:

1. **Webhooks (24h)** - Total webhook events in last 24 hours
2. **Failed Webhooks** - Count of failed/errored events
3. **Pending Credits** - Unclaimed purchases (pre-signup)
4. **Success Rate** - Percentage of successful webhooks

### Recent Webhook Events

Shows last 50 webhook events with:
- Event type (order_created, subscription_created, etc.)
- Status (success, warning, error)
- Timestamp
- User ID / Email
- Event ID

**Filters:**
- All Events
- Orders only
- Subscriptions only
- Refunds
- Errors only

**Search:** By user email or order ID

---

## 🔧 Command-Line Tools

### 1. Check Errors

```bash
cd backend
node scripts/check-webhook-errors.js
```

**Shows:**
- Error count and details
- Warning count
- Recent activity
- Pending entitlements
- Orphaned purchases

### 2. Watch Live Webhooks

```bash
cd backend
./scripts/watch-webhooks.sh
```

**Shows:**
- Real-time webhook processing
- Signature verification
- User matching
- Credit granting

### 3. Check Specific User

```bash
cd backend
node scripts/check-user-entitlements.js USER_ID
```

**Shows:**
- User document details
- Current entitlements
- Active subscriptions
- Recommendations

### 4. Check All Purchases

```bash
cd backend
node scripts/check-purchases.js
```

**Shows:**
- All purchase records
- Audit logs
- Pending entitlements
- Summary statistics

---

## 📱 Frontend Console Monitoring

### User-Side Debugging

Ask users to open browser DevTools (F12) and check the Console tab.

### Successful Purchase Pattern

```
🔄 [POLLING] Starting purchase detection polling
🔄 [POLLING] Configuration: {maxPolls: 150, pollInterval: 2000, totalDuration: '300 seconds'}
🛒 [PAYWALL] User selected option: single_spec
🛒 [PAYWALL] Opening checkout window: https://specifysai.lemonsqueezy.com/checkout/buy/...
🛒 [PAYWALL] Checkout window opened, starting polling (5 minutes timeout)
🔄 [POLLING] Poll attempt 1/150
🔄 [POLLING] Current entitlements: {spec_credits: 0, unlimited: false, free_specs_remaining: 1}
🔄 [POLLING] No credits detected yet, continuing...
... (waiting for payment) ...
✅ [POLLING] Purchase detected! Credits updated: {spec_credits: 1, ...}
✅ [POLLING] Stopping polling and triggering callback
✅ [POLLING] Executing success callback
✅ [PAYWALL] Purchase successful callback triggered
✅ [PAYWALL] Entitlements received: {spec_credits: 1, ...}
🔄 [PAYWALL] Retrying specification generation...
✅ [generateSpecification] User has credits, proceeding with spec generation
```

### Error Patterns

**Timeout Error:**
```
⏱️ [POLLING] Timeout reached after 150 polls (5 minutes)
```

**Network Error:**
```
❌ [POLLING] Failed to fetch entitlements: 500
❌ [POLLING] Error polling for purchase: Network request failed
```

**Popup Blocked:**
```
❌ [PAYWALL] Popup blocked!
❌ [PAYWALL] Error initiating purchase: Popup blocked. Please allow popups for this site.
```

---

## 🔍 Backend Server Logs

### Live Monitoring

```bash
# Follow logs in real-time
tail -f backend/server.log

# Watch only webhook activity
tail -f backend/server.log | grep -E "WEBHOOK|ORDER_CREATED|POLLING|grantCredits"

# Search for specific order
grep "order_12345" backend/server.log

# Check last 100 lines
tail -100 backend/server.log
```

### Successful Webhook Flow

```
═══════════════════════════════════════════════
🌐 [WEBHOOK] Received Lemon Squeezy webhook request
🌐 [WEBHOOK] Request headers: {signature: 'sha256=abc123...', user-agent: 'LemonSqueezy/1.0'}
🔒 [WEBHOOK] Verifying signature...
✅ [SIGNATURE] Signature verified successfully
✅ [WEBHOOK] Signature verified successfully
📦 [WEBHOOK] Payload parsed successfully
📦 [WEBHOOK] Event details: {event_id: 'evt_123', event_name: 'order_created'}
📦 [WEBHOOK] Payload preview: {"meta":{"event_name":"order_created"...
🔍 [WEBHOOK] Checking if event already processed: evt_123
✅ [WEBHOOK] Event not processed yet
🔄 [WEBHOOK] Marking event as processed...
✅ [WEBHOOK] Event marked as processed
🔄 [WEBHOOK] Processing event type: order_created
🟢 [ORDER_CREATED] Starting processing for order: order_123
🟢 [ORDER_CREATED] Order details: {order_id: 'order_123', customer_id: '12345', user_email: 'user@example.com', variant_id: 'xxx', total: 4.9, currency: 'USD'}
🔍 [ORDER_CREATED] Searching for user with: {customer_id: '12345', email: 'user@example.com'}
🔍 [findUserByLemonCustomerIdOrEmail] Searching for user: {customerId: '12345', email: 'user@example.com'}
✅ [ORDER_CREATED] User found, proceeding with credit grant
✅ [ORDER_CREATED] Product found: {name: 'Single AI Specification', credits: 1, unlimited: false}
👤 [ORDER_CREATED] User found, proceeding with credit grant
💳 [ORDER_CREATED] Granting credits: {userId: 'user123', credits: 1, order_id: 'order_123'}
💳 [grantCredits] Starting credit grant process
💳 [grantCredits] Details: {userId: 'user123', creditsToAdd: 1, orderId: 'order_123', variantId: 'xxx'}
💳 [grantCredits] Preparing entitlements update for user: user123
💳 [grantCredits] Creating purchase record: {productId: '671441', price: 4.9, currency: 'USD'}
💳 [grantCredits] Committing batch operations...
✅ [grantCredits] Credits granted successfully in 45ms - User: user123, Credits: 1
✅ [ORDER_CREATED] Credits granted successfully
✅ [ORDER_CREATED] Completed successfully in 234ms - User: user123, Credits: 1
✅ [WEBHOOK] Webhook processed successfully in 280 ms
═══════════════════════════════════════════════
```

### Error Flow

```
═══════════════════════════════════════════════
🌐 [WEBHOOK] Received Lemon Squeezy webhook request
🔒 [WEBHOOK] Verifying signature...
❌ [SIGNATURE] Signature verification failed: {expected_prefix: 'abc123...', provided_prefix: 'xyz789...', rawBody_length: 1234}
❌ [WEBHOOK] Invalid webhook signature - rejecting request
═══════════════════════════════════════════════

OR

🟢 [ORDER_CREATED] Starting processing for order: order_123
❌ [ORDER_CREATED] Product not found for variant: invalid_variant
❌ [ORDER_CREATED] Error handling order: {error: 'Product not found', duration_ms: 12}

OR

💳 [grantCredits] Starting credit grant process
💳 [grantCredits] Committing batch operations...
❌ [CRITICAL] grantCredits failed after 1234 ms: {userId: 'user123', creditsToAdd: 1, orderId: 'order_123', error: 'Permission denied', stack: '...'}
❌ [ORDER_CREATED] Credit grant failed for user: user123
❌ [ORDER_CREATED] Error handling order: {error: 'Failed to grant credits', duration_ms: 1500}
```

---

## 🎯 Common Issues & Diagnosis

### Issue 1: No Webhook Received

**Symptoms:**
- User paid but no credits
- No webhook logs
- Purchase doesn't appear in system

**Diagnosis:**
```bash
# Check Lemon Squeezy dashboard for webhook delivery logs
# Verify webhook URL: https://specifys-ai.com/api/webhook/lemon
# Check server uptime
```

**Solution:**
- Verify webhook URL in Lemon Squeezy settings
- Check server logs for connection attempts
- Verify firewall/network settings

---

### Issue 2: Invalid Signature

**Symptoms:**
- Log shows: `❌ [SIGNATURE] Signature verification failed`
- Webhook returns 401
- Repeated retries

**Diagnosis:**
```bash
# Check .env file
cat backend/.env | grep LEMON_WEBHOOK_SECRET

# Compare with Lemon Squeezy dashboard
```

**Solution:**
- Verify `LEMON_WEBHOOK_SECRET` matches exactly
- Restart server after changing .env
- Check for extra spaces or special characters

---

### Issue 3: User Not Found

**Symptoms:**
- Log shows: `⏳ [ORDER_CREATED] User not found, creating pending entitlement`
- Credits not applied
- Pending entitlement created

**Diagnosis:**
```bash
# Check pending entitlements
node backend/scripts/check-purchases.js

# Check user email in Firebase
```

**Solution:**
- This is NORMAL if user purchased before signup
- Credits will be granted automatically on signup
- Verify email matches exactly

---

### Issue 4: Credits Granted But User Doesn't See Them

**Symptoms:**
- Backend shows: `✅ Credits granted successfully`
- User sees 0 credits in UI
- Polling timeout

**Diagnosis:**
```bash
# Check actual entitlements
node backend/scripts/check-user-entitlements.js USER_ID

# Check browser console for frontend errors
```

**Solution:**
- Browser cache - hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
- Polling timeout - check webhook timing
- UI not updating - check for JavaScript errors

---

### Issue 5: Polling Timeout

**Symptoms:**
- Alert: "Purchase processing is taking longer than expected"
- 5 minutes elapsed
- User sees timeout message

**Diagnosis:**
```bash
# Check webhook processing time
tail -f backend/server.log | grep "ORDER_CREATED.*Completed successfully"

# Verify webhook was received
grep "order_123" backend/server.log
```

**Solution:**
- Webhook may have been slow (check processing time)
- Have user refresh page manually
- Verify credits in admin dashboard
- Check if user actually completed payment

---

### Issue 6: Duplicate Events

**Symptoms:**
- Log shows: `⚠️ [WEBHOOK] Event already processed`
- Webhook received multiple times

**Diagnosis:**
```bash
# Check processed events
node backend/scripts/check-webhook-errors.js

# Look for idempotency messages
```

**Solution:**
- This is CORRECT behavior (idempotency protection)
- Webhook may have been sent multiple times by Lemon
- System correctly ignored duplicates

---

## 📈 Daily Monitoring Checklist

### Morning Routine (5 minutes)

1. **Check dashboard:**
   - Open `/pages/purchase-monitor.html`
   - Review failed webhooks count
   - Check success rate
   - Review recent events

2. **Run error check:**
   ```bash
   node backend/scripts/check-webhook-errors.js
   ```

3. **Review overnight activity:**
   ```bash
   grep "ORDER_CREATED\|subscription_created" backend/server.log | tail -20
   ```

### Weekly Review (15 minutes)

1. **Check pending entitlements:**
   ```bash
   node backend/scripts/check-purchases.js
   ```

2. **Review conversion rates:**
   - Admin dashboard → Analytics tab
   - Product performance
   - User retention

3. **Audit recent failures:**
   - Purchase monitor → Failed transactions
   - Identify patterns
   - Document solutions

### Monthly Audit (30 minutes)

1. **Export audit logs:**
   - Firebase Console → Export data
   - Store in backup location

2. **Review system health:**
   - Success rate trends
   - Average processing time
   - Error frequency

3. **Update documentation:**
   - Record new edge cases
   - Update runbooks
   - Share findings

---

## 🚨 Alert Thresholds

### Critical (Investigate Immediately)
- ❌ Any `[CRITICAL]` errors
- ❌ Signature verification failures
- ❌ Success rate < 95%
- ❌ Failed webhooks > 5 per hour

### Warning (Monitor Closely)
- ⚠️ Pending entitlements > 10
- ⚠️ Orphaned purchases > 0
- ⚠️ Polling timeouts > 20%
- ⚠️ Processing time > 5 seconds

### Normal
- ✅ Success rate > 99%
- ✅ Average processing time < 500ms
- ✅ Failed webhooks < 2 per hour
- ✅ All purchases claimed within 24 hours

---

## 🔗 Quick Links

- **Purchase Monitor:** `/pages/purchase-monitor.html`
- **Admin Dashboard:** `/pages/admin-dashboard.html`
- **Firebase Console:** [Firestore](https://console.firebase.google.com/project/specify-ai/firestore)
- **Lemon Squeezy:** [Dashboard](https://app.lemonsqueezy.com)

---

## 📞 Support Escalation

When reporting an issue, provide:

1. **User details:**
   - Email / User ID
   - Timestamp of purchase
   - Order ID from Lemon

2. **System logs:**
   ```bash
   # Server logs
   grep -A 50 "order_ID" backend/server.log
   
   # Error check
   node backend/scripts/check-webhook-errors.js
   
   # User status
   node backend/scripts/check-user-entitlements.js USER_ID
   ```

3. **Dashboard screenshots:**
   - Purchase monitor statistics
   - Failed transactions
   - Recent webhook events

4. **Browser console:** Screenshot of frontend errors

---

## 🎯 Success Metrics

**System is healthy when:**
- ✅ Success rate > 99%
- ✅ Average webhook processing time < 500ms
- ✅ No failed transactions in last 24h
- ✅ Pending entitlements < 5
- ✅ All users receive credits within 5 minutes
- ✅ No critical errors in logs

---

*Last Updated: November 2025*

