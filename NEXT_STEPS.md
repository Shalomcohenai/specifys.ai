# Next Steps for Purchase Testing

## Current Situation

You just tried to make a test purchase and it didn't work because:

**The Problem:**
- ✅ All code is working correctly
- ✅ Test webhook processed successfully
- ❌ Real webhook can't reach localhost

**Why it failed:**
- Lemon Squeezy sent webhook to production URL
- No webhook ever reached your local server
- Local polling kept waiting forever

## Solutions

### Option 1: Deploy Backend to Production (Recommended)

**Best for:** Real testing with actual purchases

**Steps:**
1. Sign up for a hosting service (Railway.app or Render.com)
2. Deploy your backend there
3. Get your public URL (e.g., `https://specifys-backend.railway.app`)
4. Update Lemon Squeezy webhook to point there
5. Test real purchases

**Time:** ~30 minutes

**Commands:**
```bash
# Deploy to Railway
railway login
railway init
railway up

# Or deploy to Render
# (follow Render's Node.js deployment guide)
```

### Option 2: Use Test Email for Local Testing

**Best for:** Quick verification that system works

**Steps:**
1. Open browser DevTools
2. Run test webhook script in terminal
3. Create account with email: `test@example.com`
4. See credits appear

**Time:** 2 minutes

**Commands:**
```bash
# In terminal 1 - watch logs
tail -f backend/server.log

# In terminal 2 - trigger test webhook
node backend/scripts/test-webhook.js

# In browser - create account with test@example.com email
```

### Option 3: Manual Credit Grant (Immediate)

**Best for:** You need to test RIGHT NOW

**Steps:**
1. Go to Firebase Console
2. Find your user ID
3. Manually grant credits
4. Test immediately

**Time:** 30 seconds

**Firebase Console:**
```
Collections → entitlements → YOUR_USER_ID → Update spec_credits to 1
```

## My Recommendation

**For immediate testing:** Use Option 3 (manual credit grant) so you can verify the rest of the flow works.

**For long-term:** Use Option 1 (deploy to production) so real users can purchase.

## Quick Commands

```bash
# Check if server is running
ps aux | grep "node server.js"

# Watch webhooks
tail -f backend/server.log | grep -E "WEBHOOK|ORDER_CREATED"

# Test webhook locally
node backend/scripts/test-webhook.js

# Check user entitlements
node backend/scripts/check-user-entitlements.js USER_ID
```

