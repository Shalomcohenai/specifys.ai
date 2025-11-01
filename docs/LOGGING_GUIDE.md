# Logging Guide - Purchase System

## Overview

The purchase system now has comprehensive logging to help diagnose any issues. This document explains how to use the logging system and what to look for.

## Log Locations

### 1. Server Logs (Real-time)
**File:** `backend/server.log`

**How to view:**
```bash
# View last 50 lines
tail -n 50 backend/server.log

# Follow in real-time
tail -f backend/server.log

# Search for webhook activity
grep "WEBHOOK\|ORDER_CREATED" backend/server.log
```

### 2. Admin Dashboard
**URL:** `http://localhost:10000/pages/admin-dashboard.html` (or production URL)

Navigate to:
- **Payments tab** → Transactions table
- **Analytics tab** → Webhook events

### 3. Firebase Console
**Collections to check:**
- `audit_logs` - All webhook events
- `purchases` - Purchase records
- `entitlements` - Current user credits
- `pending_entitlements` - Unclaimed purchases
- `processed_webhook_events` - Idempotency tracking

## Monitoring Scripts

### Check for Errors
```bash
node backend/scripts/check-webhook-errors.js
```

**What it shows:**
- Error count and details
- Warning count and details
- Recent activity (last 24 hours)
- Pending entitlements
- Orphaned purchases

### Watch Live Webhooks
```bash
./backend/scripts/watch-webhooks.sh
```

**What it shows:**
- Real-time webhook processing
- Signature verification
- User matching
- Credit granting
- Polling activity

### Check Specific User
```bash
node backend/scripts/check-user-entitlements.js USER_ID
```

**What it shows:**
- User document details
- Current entitlements
- Active subscriptions
- Recommendations

### Check All Purchases
```bash
node backend/scripts/check-purchases.js
```

**What it shows:**
- All purchase records
- Audit logs
- Pending entitlements
- Summary statistics

## Log Format

### Webhook Processing
```
═══════════════════════════════════════════════
🌐 [WEBHOOK] Received Lemon Squeezy webhook request
🔒 [WEBHOOK] Verifying signature...
✅ [WEBHOOK] Signature verified successfully
📦 [WEBHOOK] Payload parsed successfully
🔍 [WEBHOOK] Checking if event already processed
✅ [WEBHOOK] Event not processed yet
🔄 [WEBHOOK] Processing event type: order_created
```

### Order Created
```
🟢 [ORDER_CREATED] Starting processing for order: 12345
🔍 [ORDER_CREATED] Searching for user with: {customer_id: "...", email: "..."}
✅ [ORDER_CREATED] User found, proceeding with credit grant
💳 [ORDER_CREATED] Granting credits: {userId: "...", credits: 3}
✅ [ORDER_CREATED] Completed successfully in 123ms
```

### Credit Granting
```
💳 [grantCredits] Starting credit grant process
💳 [grantCredits] Details: {userId: "...", creditsToAdd: 3, ...}
💳 [grantCredits] Committing batch operations...
✅ [grantCredits] Credits granted successfully in 45ms
```

### Polling
```
🔄 [POLLING] Starting purchase detection polling
🔄 [POLLING] Poll attempt 1/30
🔄 [POLLING] Current entitlements: {spec_credits: 0, ...}
🔄 [POLLING] No credits detected yet, continuing...
🔄 [POLLING] Poll attempt 2/30
✅ [POLLING] Purchase detected! Credits updated
```

### Errors
```
❌ [ORDER_CREATED] Product not found for variant: xxx
❌ [WEBHOOK] Error processing webhook: Error message...
❌ [CRITICAL] grantCredits failed: {error: "...", ...}
⏱️ [POLLING] Timeout reached after 30 polls
```

## Common Issues & Troubleshooting

### Issue: No webhook received
**Check:**
1. `check-webhook-errors.js` - Any errors in audit_logs?
2. Lemon Squeezy dashboard - Webhook delivery logs
3. Server logs - Any connection attempts?

**Look for:**
```
❌ [WEBHOOK] Invalid webhook signature
❌ [SIGNATURE] Signature verification failed
```

### Issue: User not found
**Check:**
```
🔍 [findUserByLemonCustomerIdOrEmail] User not found
⏳ [ORDER_CREATED] User not found, creating pending entitlement
```

**Meaning:** User purchased before signing up. Credits will be granted on signup.

### Issue: Credits not granted
**Check:**
```
❌ [ORDER_CREATED] Credit grant failed for user: xxx
❌ [CRITICAL] grantCredits failed
```

**Look for:** Firestore errors, network issues, batch commit failures.

### Issue: Polling timeout
**Check:**
```
⏱️ [POLLING] Timeout reached after 30 polls
```

**Meaning:** Webhook not received within 60 seconds. Check:
1. Lemon Squeezy webhook delivery
2. Network connectivity
3. Server uptime

## Alert Thresholds

### Critical (Investigate immediately)
- ❌ Any `[CRITICAL]` errors
- ❌ Signature verification failures
- ❌ Webhook processing errors > 5% rate

### Warning (Monitor closely)
- ⚠️ Pending entitlements > 10
- ⚠️ Orphaned purchases > 0
- ⚠️ Polling timeouts > 20%

### Normal
- ✅ Successful webhook processing
- ✅ Credits granted successfully
- ✅ Purchases detected by polling

## Daily Monitoring Checklist

1. **Run error check:**
   ```bash
   node backend/scripts/check-webhook-errors.js
   ```

2. **Check recent activity:**
   ```bash
   grep "ORDER_CREATED\|POLLING" backend/server.log | tail -100
   ```

3. **Review admin dashboard:**
   - Transactions table
   - User payment analytics
   - Error rates

4. **Check pending entitlements:**
   ```bash
   node backend/scripts/check-purchases.js
   ```

## Log Retention

- **Server logs:** Rotated daily, kept for 7 days
- **Audit logs:** Stored in Firestore, retained indefinitely
- **Purchases:** Stored in Firestore, retained indefinitely
- **Processed events:** Stored in Firestore, prevents duplicates

## Best Practices

1. **Daily:** Check error reports
2. **Weekly:** Review pending entitlements
3. **Monthly:** Audit all purchases
4. **Alert:** Set up monitoring for error spikes
5. **Backup:** Export audit logs monthly

## Need Help?

If you see errors you can't resolve:
1. Run `check-webhook-errors.js`
2. Copy the error details
3. Check audit_logs in Firebase Console
4. Review server.log for context
5. Contact support with full error details
