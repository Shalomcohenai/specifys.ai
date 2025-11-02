# Render Deployment Checklist

## What's Done ✅
- Backend code is ready and pushed to `purecash-system` branch
- `/api/checkout` endpoint implemented and integrated
- `/api/webhook/lemon` endpoint ready for webhooks
- Variant ID normalization handles both numeric and string formats
- Custom `userId` passed from API checkout to webhook
- Popup checkout (600x700) implemented in frontend
- Frontend uses API endpoint instead of direct URL

## Render Environment Variables Setup

Go to: Render Dashboard → Your Service → Environment

Add the following variables:

### 1. Server Configuration
```
PORT=3001
```

### 2. Firebase Configuration
```
FIREBASE_PROJECT_ID=specify-ai
FIREBASE_STORAGE_BUCKET=specify-ai.appspot.com
FIREBASE_API_KEY=AIzaSyB9hr0IWM4EREzkKDxBxYoYinV6LJXWXV4
FIREBASE_SERVICE_ACCOUNT_KEY=<paste your Firebase service account JSON here from env-template.txt>
```

**IMPORTANT:** The `FIREBASE_SERVICE_ACCOUNT_KEY` value must be on a **single line**. Copy the entire JSON object starting with `{"type":"service_account",...}` and paste it as the value.

### 3. Lemon Squeezy Configuration
```
LEMON_WEBHOOK_SECRET=specifys_ai_secret_2025
LEMON_SQUEEZY_API_KEY=<paste your Lemon Squeezy API key from env-template.txt>
```

### 4. Render URL (if needed)
```
RENDER_URL=specifys-ai.onrender.com
NODE_ENV=production
```

## Render Service Settings

**Repository:** Your GitHub repo (`Shalomcohenai/specifys.ai` or your repo)
**Branch:** `purecash-system`
**Root Directory:** `backend`
**Build Command:** `npm install`
**Start Command:** `node server.js`

## Verify Deployment

### 1. Check Server is Running
```bash
curl https://specifys-ai.onrender.com/api/status
```

Expected response:
```json
{"message":"Server is running"}
```

### 2. Check Firebase Connection
In Render logs, look for:
```
✅ Firebase Admin SDK initialized successfully
```

If you see an error, check that `FIREBASE_SERVICE_ACCOUNT_KEY` is correct.

### 3. Check Lemon Squeezy API Configuration
In Render logs, you should NOT see:
```
⚠️  LEMON_SQUEEZY_API_KEY not found in environment
```

### 4. Test Webhook Endpoint
```bash
curl -X POST https://specifys-ai.onrender.com/api/webhook/lemon \
  -H "Content-Type: application/json" \
  -d '{"test":"ping"}'
```

Expected: Should return signature verification error (this is normal if no proper signature).

### 5. Check Checkout Endpoint (Requires Auth)
This endpoint requires Firebase authentication, so you can't test it directly with curl.

## Configure Lemon Squeezy Webhook

1. Go to Lemon Squeezy Dashboard → Settings → Webhooks
2. Click "Add Webhook" or edit existing webhook
3. Set URL: `https://specifys-ai.onrender.com/api/webhook/lemon`
4. Set Secret: `specifys_ai_secret_2025`
5. Enable events: `order_created`, `order_refunded`, `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_payment_success`
6. Test webhook: Click "Send test webhook"
7. Check Render logs for incoming webhook

## After Deployment - Test Purchase Flow

### Test Scenario 1: Single Spec Purchase
1. Go to `https://specifys-ai.com` (or your domain)
2. Sign in with Google
3. Try to create a spec (should show paywall if no credits)
4. Click "Buy Single Spec" ($4.90)
5. Popup should open with Lemon Squeezy checkout
6. Complete test purchase (use Lemon Squeezy test card)
7. Popup should close automatically
8. Check console logs for polling messages
9. Credits should update automatically
10. Spec generation should start automatically

### Test Scenario 2: Check Webhook Processing
In Render logs, look for:
```
🟢 [ORDER_CREATED] Starting processing for order: <order_id>
✅ [ORDER_CREATED] Product found: { name: 'Single AI Specification', ... }
✅ [ORDER_CREATED] Credits granted successfully
```

### Test Scenario 3: Check Firebase Data
In Firebase Console:
1. Go to Firestore → `users/{userId}`
2. Check `wallet.credits` increased by 1
3. Go to `transactions/{order_id}`
4. Check transaction was created with correct details
5. Go to `audit_logs`
6. Check recent `order_created` events

## Troubleshooting

### Issue: Server doesn't start
- Check Render logs for startup errors
- Verify `PORT` is set to `3001`
- Verify all environment variables are set

### Issue: Firebase connection fails
- Verify `FIREBASE_SERVICE_ACCOUNT_KEY` is exactly as provided (single line)
- Check JSON is valid and complete
- Verify `FIREBASE_PROJECT_ID` matches your Firebase project

### Issue: Checkout API returns 500
- Check Render logs for specific error
- Verify `LEMON_SQUEEZY_API_KEY` is set correctly
- Check that API key has permissions to create checkouts

### Issue: Webhook not received
- Verify webhook URL in Lemon Squeezy dashboard
- Check `LEMON_WEBHOOK_SECRET` matches in both places
- Check Render logs for webhook attempts
- Verify Render service is active (not suspended)

### Issue: Purchase succeeds but credits don't update
- Check Render logs for webhook processing
- Look for errors in credit granting
- Check `variant_id` matches between config and webhook
- Verify user document exists in Firebase

## Success Indicators ✅

You know everything is working when:
1. ✅ Render server is running without errors
2. ✅ Firebase Admin SDK initialized successfully
3. ✅ Checkout popup opens when clicking buy button
4. ✅ Webhook received from Lemon Squeezy (check logs)
5. ✅ Credits update in Firebase after purchase
6. ✅ Spec generation starts automatically after purchase
7. ✅ Audit logs show successful `order_created` events
8. ✅ No errors in Render logs during purchase flow

## Next Steps

After successful deployment and testing:
1. Monitor Render logs for any errors
2. Test all product types (single, 3-pack, pro subscriptions)
3. Test edge cases (quantity > 1, refunds, etc.)
4. Consider setting up monitoring/alerting for webhooks
5. Document any issues found during testing

## Support

If you encounter issues:
1. Check Render logs for detailed error messages
2. Check Firebase Console for data issues
3. Check Lemon Squeezy dashboard for webhook delivery status
4. Refer to main integration docs: `/docs/lemon-squeezy-integration.md`
5. Check debugging guide: `/docs/DEBUGGING_PURCHASE_ISSUES.md`

