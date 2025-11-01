# Debugging Purchase Issues - Step by Step Guide

## Quick Diagnosis

If a user reports they bought credits but don't see them:

### 1. Check Server Logs (Live)
```bash
tail -f backend/server.log | grep -E "WEBHOOK|ORDER_CREATED|POLLING|grantCredits"
```

Look for:
- ✅ Webhook received
- ✅ Signature verified
- ✅ User found
- ✅ Credits granted
- ✅ Purchase detected by polling

### 2. Check User Status
```bash
node backend/scripts/check-user-entitlements.js USER_ID
```

Look for:
- Current `spec_credits`
- Plan type
- Last activity

### 3. Check Recent Purchases
```bash
node backend/scripts/check-purchases.js
```

Look for:
- User's purchase record
- Order ID from Lemon
- Status: completed

### 4. Check for Errors
```bash
node backend/scripts/check-webhook-errors.js
```

Look for:
- Error count
- Recent failed webhooks
- Pending entitlements

## Common Issues & Solutions

### Issue 1: Webhook Never Received
**Symptoms:**
- No webhook logs
- Purchase doesn't appear in system
- User paid but no credits

**Check:**
```bash
# In Firebase Console, check audit_logs
# Look for "order_created" events
# Check Lemon Squeezy dashboard for webhook delivery status
```

**Solution:**
- Verify webhook URL in Lemon Squeezy: `https://specifys-ai.com/api/webhook/lemon`
- Check webhook secret: `LEMON_WEBHOOK_SECRET=specifys_ai_secret_2025`
- Verify server is running and accessible
- Check network/firewall settings

### Issue 2: Invalid Signature
**Symptoms:**
- Log shows: `❌ [SIGNATURE] Signature verification failed`
- Webhook returns 401

**Solution:**
- Verify `LEMON_WEBHOOK_SECRET` matches Lemon Squeezy
- Check `.env` file has correct value
- Restart server after changing .env

### Issue 3: User Not Found
**Symptoms:**
- Log shows: `❌ [findUserByLemonCustomerIdOrEmail] User not found`
- Pending entitlement created
- Credits not applied

**Check:**
```bash
node backend/scripts/check-purchases.js
# Look for pending entitlements
```

**Solution:**
- This is NORMAL if user purchased before signup
- Credits will be granted automatically on signup
- Check `pending_entitlements` collection
- Verify email matches exactly

### Issue 4: Credits Granted But User Doesn't See Them
**Symptoms:**
- Log shows: `✅ Credits granted successfully`
- User sees 0 credits in UI

**Check:**
```bash
node backend/scripts/check-user-entitlements.js USER_ID
# Check actual spec_credits value
```

**Possible causes:**
- Browser cache - have user hard refresh (Cmd+Shift+R)
- Polling timeout - check if webhook took too long
- UI not updating - check browser console for errors

### Issue 5: Polling Timeout
**Symptoms:**
- Alert: "Purchase processing is taking longer than expected"
- Webhook processed but user sees timeout

**Check:**
```bash
tail -f backend/server.log | grep POLLING
# Look for timeout messages
```

**Solution:**
- Webhook may have been slow
- Check server performance
- Have user refresh page manually
- Verify credits in admin dashboard

### Issue 6: Duplicate Charge Detection
**Symptoms:**
- Log shows: `⚠️ Event already processed`
- Credits only granted once

**Solution:**
- This is CORRECT behavior (idempotency)
- Webhook might have been called twice by Lemon
- System correctly ignored duplicate

## Detailed Log Analysis

### Successful Flow
Look for this sequence in logs:

```
═══════════════════════════════════════════════
🌐 [WEBHOOK] Received Lemon Squeezy webhook request
✅ [SIGNATURE] Signature verified successfully
📦 [WEBHOOK] Payload parsed successfully
✅ [WEBHOOK] Event not processed yet
🟢 [ORDER_CREATED] Starting processing for order: 123
🔍 [ORDER_CREATED] Searching for user with: {customer_id: "...", email: "..."}
✅ [ORDER_CREATED] User found, proceeding with credit grant
💳 [ORDER_CREATED] Granting credits: {userId: "...", credits: 3}
💳 [grantCredits] Starting credit grant process
💳 [grantCredits] Committing batch operations...
✅ [grantCredits] Credits granted successfully in 45ms
✅ [ORDER_CREATED] Completed successfully in 789ms
✅ [WEBHOOK] Webhook processed successfully in 850 ms
═══════════════════════════════════════════════
```

### Error Flow
Look for error indicators:

```
❌ [WEBHOOK] Invalid signature
❌ [ORDER_CREATED] Product not found for variant: xxx
❌ [ORDER_CREATED] Credit grant failed
❌ [grantCredits] CRITICAL failure
⏱️ [POLLING] Timeout reached
```

## Frontend Browser Console

When user has an issue, ask them to:

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for these patterns:

**Successful:**
```
🔄 [POLLING] Starting purchase detection polling
🔄 [POLLING] Poll attempt 1/30
✅ [POLLING] Purchase detected! Credits updated
✅ [POLLING] Executing success callback
✅ [PAYWALL] Purchase successful callback triggered
🔄 [PAYWALL] Retrying specification generation...
```

**Error:**
```
❌ [POLLING] Failed to fetch entitlements: 500
⏱️ [POLLING] Timeout reached after 30 polls
❌ [PAYWALL] No callback registered
```

## Manual Credit Grant (Last Resort)

If all else fails, manually grant credits:

```bash
# Find user ID
node backend/scripts/check-user-entitlements.js USER_ID

# Use Firebase Console to manually update entitlements
# Set spec_credits to desired amount
# Update last_entitlement_sync_at to current time
```

## Prevention Checklist

✅ Webhook URL configured correctly
✅ Webhook secret matches on both sides
✅ Server is running and accessible
✅ Firestore permissions are correct
✅ Products configured with correct variant IDs
✅ Test mode disabled in production

## Support Information to Collect

When reporting an issue, provide:

1. **User details:**
   - Email address
   - User ID (from Firebase)
   - Timestamp of purchase

2. **Lemon Squeezy details:**
   - Order ID
   - Order date
   - Product variant ID

3. **Logs:**
   ```bash
   # Server logs
   grep -A 50 "order_12345" backend/server.log
   
   # User status
   node backend/scripts/check-user-entitlements.js USER_ID
   
   # Purchase check
   node backend/scripts/check-purchases.js
   
   # Error check
   node backend/scripts/check-webhook-errors.js
   ```

4. **Browser console:** Screenshot of errors

## Quick Commands Reference

```bash
# Monitor webhooks in real-time
./backend/scripts/watch-webhooks.sh

# Check for errors
node backend/scripts/check-webhook-errors.js

# Check specific user
node backend/scripts/check-user-entitlements.js USER_ID

# Check all purchases
node backend/scripts/check-purchases.js

# View recent logs
tail -100 backend/server.log

# Search for specific order
grep "ORDER_ID" backend/server.log

# Test webhook
node backend/scripts/test-webhook.js
```
