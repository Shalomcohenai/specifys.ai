# Lemon Squeezy Integration Testing Guide

## Pre-Testing Setup

### 1. Complete Environment Setup
- [ ] Update `.env` file with actual Firebase project ID
- [ ] Add Firebase service account key
- [ ] Deploy Firestore rules: `firebase deploy --only firestore:rules`
- [ ] Set webhook URL in Lemon Squeezy dashboard

### 2. Start the Server
```bash
cd backend
npm start
```

## Manual Testing Scenarios

### Test 1: New User Purchase Before Signup
**Goal:** Verify pending entitlements work for unauthenticated users

**Steps:**
1. Go to Lemon Squeezy dashboard
2. Send test webhook: `order_created` for `three_pack` product
3. Use test email: `test@example.com`
4. Check Firestore: `pending_entitlements` collection should have new document
5. Sign up with same email: `test@example.com`
6. Check Firestore: User should have 3 credits in `entitlements` collection
7. Check Firestore: `pending_entitlements` document should be marked as claimed

**Expected Results:**
- ✅ Pending entitlement created
- ✅ Credits applied on signup
- ✅ Pending entitlement marked as claimed

### Test 2: Registered User Purchase
**Goal:** Verify immediate credit application for existing users

**Steps:**
1. Create test user account
2. Send test webhook: `order_created` for `single_spec` product
3. Use same email as test user
4. Check Firestore: User should have 1 credit immediately
5. Check Firestore: `purchases` collection should have new document

**Expected Results:**
- ✅ Credits applied immediately
- ✅ Purchase record created
- ✅ Audit log entry created

### Test 3: Pro Subscription
**Goal:** Verify Pro subscription enables unlimited access

**Steps:**
1. Send test webhook: `subscription_created` for `pro_monthly`
2. Check Firestore: User should have `unlimited: true` and `can_edit: true`
3. Check Firestore: User should have `plan: 'pro'`
4. Check Firestore: `subscriptions` collection should have new document
5. Test spec creation: Should work without consuming credits
6. Test spec editing: Should be allowed

**Expected Results:**
- ✅ Pro access enabled
- ✅ Unlimited spec creation
- ✅ Spec editing allowed

### Test 4: Subscription Cancellation
**Goal:** Verify Pro access continues until period end

**Steps:**
1. Send test webhook: `subscription_cancelled`
2. Check Firestore: Subscription should have `cancel_at_period_end: true`
3. Verify Pro access still works
4. Send test webhook: `subscription_expired`
5. Check Firestore: User should have `unlimited: false` and `can_edit: false`
6. Check Firestore: User should have `plan: 'free'`

**Expected Results:**
- ✅ Pro access continues until cancellation
- ✅ Pro access revoked after expiration

### Test 5: Refund Processing
**Goal:** Verify refunds properly reverse credits

**Steps:**
1. User has credits from previous purchase
2. Send test webhook: `order_refunded`
3. Check Firestore: Credits should be reduced
4. Check Firestore: Purchase should have `status: 'refunded'`

**Expected Results:**
- ✅ Credits properly refunded
- ✅ Purchase status updated

### Test 6: Idempotency
**Goal:** Verify duplicate webhooks are handled correctly

**Steps:**
1. Send same webhook twice with same event ID
2. Check server logs: Second webhook should be ignored
3. Check Firestore: Only one purchase/entitlement should be created

**Expected Results:**
- ✅ Duplicate webhooks ignored
- ✅ No duplicate data created

## Frontend Testing

### Test 7: Paywall Display
**Goal:** Verify paywall shows when credits exhausted

**Steps:**
1. User with no credits tries to create spec
2. Check browser: Paywall modal should appear
3. Check console: API should return 402 status
4. Click purchase option: Lemon Squeezy checkout should open

**Expected Results:**
- ✅ Paywall displays correctly
- ✅ Checkout opens in new window

### Test 8: Credits Display
**Goal:** Verify credits display updates correctly

**Steps:**
1. Check header: Should show current credits
2. After purchase: Credits should update automatically
3. Pro users: Should show "UL" for unlimited

**Expected Results:**
- ✅ Credits display correctly
- ✅ Updates automatically after purchase

## API Testing

### Test 9: Spec Creation API
**Goal:** Verify API endpoints work correctly

**Test with sufficient credits:**
```bash
curl -X POST http://localhost:3001/api/specs/create \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userInput": "Create a mobile app for task management"}'
```

**Expected:** 200 response with specification

**Test with insufficient credits:**
```bash
# Same request but user has no credits
```

**Expected:** 402 response with paywall data

### Test 10: Entitlements API
**Goal:** Verify entitlements endpoint returns correct data

```bash
curl -X GET http://localhost:3001/api/specs/entitlements \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

**Expected:** JSON with user entitlements

## Monitoring and Debugging

### Check Server Logs
```bash
# Monitor webhook processing
tail -f backend/logs/webhook.log

# Monitor general server logs
tail -f backend/logs/server.log
```

### Check Firestore Data
1. Go to Firebase Console
2. Check each collection:
   - `entitlements`: User credit balances
   - `purchases`: Purchase records
   - `subscriptions`: Subscription records
   - `pending_entitlements`: Unclaimed purchases
   - `audit_logs`: Webhook processing logs
   - `processed_webhook_events`: Idempotency tracking

### Common Issues and Solutions

#### Issue: Webhook signature verification fails
**Solution:** Check webhook secret matches Lemon Squeezy dashboard

#### Issue: Credits not applied after purchase
**Solution:** Check webhook processing logs and Firestore rules

#### Issue: Paywall not showing
**Solution:** Check API returns 402 status and frontend handles it

#### Issue: Pro subscription not working
**Solution:** Check subscription webhook processing and entitlements

## Test Data Cleanup

After testing, clean up test data:

```bash
# Delete test users from Firebase Auth
# Delete test documents from Firestore collections
# Clear audit logs if needed
```

## Production Readiness Checklist

- [ ] All manual tests pass
- [ ] Webhook signature verification working
- [ ] Idempotency handling working
- [ ] Error handling working
- [ ] Audit logging working
- [ ] Frontend integration working
- [ ] Performance acceptable
- [ ] Security measures in place
- [ ] Monitoring set up
- [ ] Documentation complete
