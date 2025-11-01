# 🧪 Testing Instructions - Purchase System

## System Status
✅ **READY FOR TESTING**

The server is running on `http://localhost:10000`
The frontend is accessible at `http://localhost:4000`

## Testing Flow

### 1. Open the Website
Go to: `http://localhost:4000`

### 2. Start Creating a Spec
1. Click "Start" button
2. Fill in the 4 questions in Hebrew or English
3. Click "Generate"

### 3. Trigger the Paywall
You should see the paywall modal because:
- You have 0 free specs remaining
- You have no purchased credits

### 4. Make a Test Purchase
1. Click on one of the purchase options (Single Spec or 3-Pack)
2. Popup will open to Lemon Squeezy
3. Fill in the payment form

**⚠️ IMPORTANT:**
- Use **TEST MODE** in Lemon Squeezy
- Use test card: `4242 4242 4242 4242`
- Use any future expiry date
- Use any CVC

### 5. What to Watch

#### Browser Console
Watch for these logs:
```
🛒 [PAYWALL] User selected option: single_spec
🔄 [POLLING] Starting purchase detection polling
🔄 [POLLING] Poll attempt 1/150
...
✅ [POLLING] Purchase detected! Credits updated
✅ [PAYWALL] Purchase successful callback triggered
🔄 [PAYWALL] Retrying specification generation...
```

#### Server Logs
```bash
tail -f backend/server.log | grep -E "WEBHOOK|ORDER_CREATED|grantCredits"
```

Watch for:
```
═══════════════════════════════════════════════
🌐 [WEBHOOK] Received Lemon Squeezy webhook request
✅ [SIGNATURE] Signature verified successfully
🟢 [ORDER_CREATED] Starting processing for order
✅ [ORDER_CREATED] User found, proceeding with credit grant
💳 [grantCredits] Starting credit grant process
✅ [grantCredits] Credits granted successfully
✅ [ORDER_CREATED] Completed successfully
═══════════════════════════════════════════════
```

### 6. Expected Result
After purchase completes:
- ✅ Paywall closes automatically
- ✅ Specification generation starts automatically
- ✅ User is redirected to spec-viewer
- ✅ Their answers are preserved

## What to Verify

### ✅ Success Indicators
- Paywall appears when no credits
- Checkout popup opens
- Payment form loads
- Polling continues for up to 5 minutes
- Webhook received and processed
- Credits granted
- Paywall closes
- Spec generation starts
- Redirect happens smoothly

### ❌ Failure Indicators
Watch for these errors:
- `❌ [POLLING] Failed to fetch entitlements`
- `⏱️ [POLLING] Timeout reached`
- `❌ [WEBHOOK] Invalid signature`
- `❌ [grantCredits] CRITICAL failure`

## Monitoring Tools

### Real-time Webhook Monitor
```bash
./backend/scripts/watch-webhooks.sh
```

### Check for Errors
```bash
node backend/scripts/check-webhook-errors.js
```

### Check User Status
```bash
node backend/scripts/check-user-entitlements.js YOUR_USER_ID
```

### Check All Purchases
```bash
node backend/scripts/check-purchases.js
```

## Test Scenarios

### Scenario 1: Happy Path
1. User with no credits clicks Generate
2. Paywall appears
3. User buys 3-Pack
4. Credits granted
5. Spec generated
6. ✅ SUCCESS

### Scenario 2: Slow Payment
1. User clicks Buy
2. Takes 3 minutes to complete payment
3. System should still detect purchase
4. ✅ SUCCESS (5 min timeout)

### Scenario 3: User Already Purchased
1. User has credits
2. Clicks Generate
3. No paywall
4. Spec generated immediately
5. ✅ SUCCESS

### Scenario 4: Error Handling
1. Webhook fails
2. System logs error
3. Pending entitlement created
4. Credits granted on next attempt
5. ✅ RECOVERY

## Quick Diagnostics

### If purchase doesn't work:
1. Check browser console for errors
2. Check server logs for webhook activity
3. Run: `node backend/scripts/check-webhook-errors.js`
4. Verify Lemon Squeezy webhook config

### If credits not showing:
1. Hard refresh browser (Cmd+Shift+R)
2. Check user entitlements
3. Run: `node backend/scripts/check-user-entitlements.js USER_ID`
4. Verify purchase record exists

## Current Configuration

- **Polling timeout:** 5 minutes (150 polls)
- **Poll interval:** 2 seconds
- **Webhook secret:** configured
- **Products:** configured
- **Logging:** fully enabled

## Ready to Test! 🚀

Go to `http://localhost:4000` and start creating a spec!

