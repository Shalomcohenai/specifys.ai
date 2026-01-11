# 🎬 Purchase Flow Simulation Guide

## Overview

The purchase flow simulator is a comprehensive testing tool that simulates the entire purchase process from frontend to database. It shows exactly what data flows where, when, and how.

---

## 🚀 Quick Start

### Run Basic Simulation

```bash
cd backend
node scripts/simulate-purchase-flow.js
```

This runs a default simulation with:
- Product: `single_spec` ($4.90 for 1 credit)
- User: `test@specifys-ai.com`
- User ID: `test_user_123`

### Run Custom Simulation

```bash
# Simulate specific product purchase
node scripts/simulate-purchase-flow.js single_spec

# Simulate three-pack purchase
node scripts/simulate-purchase-flow.js three_pack

# Simulate Pro monthly subscription
node scripts/simulate-purchase-flow.js pro_monthly

# Simulate Pro yearly subscription
node scripts/simulate-purchase-flow.js pro_yearly
```

### Advanced Options

```bash
# Specify product, user ID, and email
node scripts/simulate-purchase-flow.js single_spec user123 user@example.com

# Example output:
# 🎬 Starting simulation with:
# - Product: single_spec
# - User: user@example.com
# - User ID: user123
```

---

## 📊 What the Simulator Does

### Step-by-Step Flow

The simulator walks through **12 detailed steps**:

1. **Frontend - User initiates purchase**
   - Shows product details
   - Displays price, credits, and permissions

2. **Frontend - Opens checkout window**
   - Generates Lemon Squeezy URL
   - Opens in new window

3. **Frontend - Starts polling**
   - Configures polling (150 attempts × 2 seconds)
   - 5-minute timeout

4. **User - Completes payment**
   - User fills in card details
   - Lemon Squeezy processes payment

5. **Lemon Squeezy - Sends webhook**
   - Generates mock webhook payload
   - Creates HMAC-SHA256 signature
   - Shows exact data structure

6. **Backend - Receives webhook**
   - Endpoint: `/api/webhook/lemon`
   - Verifies signature
   - Validates payload

7. **Backend - Checks idempotency**
   - Queries `processed_webhook_events`
   - Prevents duplicate processing

8. **Backend - Processes webhook**
   - Looks up user by email
   - Creates pending entitlement if user not found

9. **Backend - Grants credits**
   - Updates `entitlements` collection
   - Creates `purchases` record
   - Marks event as processed
   - Creates audit log

10. **Backend - Verifies database state**
    - Queries all collections
    - Validates data integrity

11. **Frontend - Polling detects change**
    - GET `/api/specs/entitlements`
    - Detects credit increase

12. **Frontend - Triggers callback**
    - Retries specification generation
    - Success!

---

## 🗄️ Database Collections Explained

### 1. `users/{userId}`
**Purpose:** User profile and account data

```javascript
{
  email: "test@specifys-ai.com",
  displayName: "Test User",
  plan: "free",
  free_specs_remaining: 1,
  lemon_customer_id: "12345",
  last_entitlement_sync_at: Timestamp
}
```

### 2. `entitlements/{userId}`
**Purpose:** User credits and permissions

```javascript
{
  userId: "user123",
  spec_credits: 1,
  unlimited: false,
  can_edit: false,
  updated_at: Timestamp
}
```

### 3. `purchases/{purchaseId}`
**Purpose:** Purchase history and tracking

```javascript
{
  userId: "user123",
  lemon_order_id: "order_123456",
  product_id: "671441",
  variant_id: "91788779-0286-4f45-ad89-2fefc3835699",
  credits_granted: 1,
  credits_used: 0,
  total_amount_cents: 490,
  currency: "USD",
  status: "completed",
  purchased_at: Timestamp
}
```

### 4. `processed_webhook_events/{eventId}`
**Purpose:** Idempotency protection

```javascript
{
  event_id: "evt_1234567890",
  created_at: Timestamp
}
```

### 5. `audit_logs/{logId}`
**Purpose:** Debugging and compliance

```javascript
{
  userId: "user123",
  source: "lemon_webhook",
  action: "order_created",
  event_id: "evt_1234567890",
  payload_json: "{...}",
  created_at: Timestamp
}
```

### 6. `pending_entitlements/{pendingId}`
**Purpose:** Purchases before user signup

```javascript
{
  email: "buyer@example.com",
  lemon_customer_id: "12345",
  payload_json: "{...}",
  grants_json: "{...}",
  reason: "order_created_before_signup",
  claimed: false,
  created_at: Timestamp
}
```

---

## 🔍 Understanding the Output

### Colors

- 🔵 **Blue** = Frontend operations
- 🟡 **Yellow** = User actions
- 🟣 **Magenta** = Lemon Squeezy operations
- 🟢 **Green** = Backend operations
- 🔴 **Red** = Errors
- 🟢 **Cyan** = Summary/success

### Key Sections

#### 1. Configuration
Shows what product, user, and email are being used.

#### 2. Step-by-Step Flow
Detailed breakdown of each operation.

#### 3. Database Records
Shows exactly what data is stored where.

#### 4. Security Verification
Confirms all security measures are in place.

---

## 🧪 Testing Scenarios

### Scenario 1: Normal Purchase
User has account → Buys credits → Gets credits immediately

```bash
node scripts/simulate-purchase-flow.js single_spec existing_user existing@email.com
```

### Scenario 2: Purchase Before Signup
User doesn't have account → Buys credits → Gets pending entitlement

```bash
node scripts/simulate-purchase-flow.js three_pack new_user new@email.com
```

### Scenario 3: Pro Subscription
User subscribes → Gets unlimited access

```bash
node scripts/simulate-purchase-flow.js pro_monthly pro_user pro@email.com
```

### Scenario 4: Three-Pack Purchase
User buys bulk credits → Gets 3 credits

```bash
node scripts/simulate-purchase-flow.js three_pack bulk_user bulk@email.com
```

---

## 🔐 Security Features Demonstrated

### 1. Signature Verification
- Shows how HMAC-SHA256 signature is generated
- Verifies signature matches
- Prevents unauthorized webhooks

### 2. Idempotency Protection
- Checks if event already processed
- Prevents duplicate credit grants
- Shows event tracking

### 3. Firestore Security
- All operations server-side
- No client-side credit manipulation
- Atomic transactions

### 4. Audit Logging
- Every operation logged
- Full payload saved
- Timestamped for compliance

---

## 📝 Sample Output

```
================================================================================
🎬 [2025-11-01T12:00:00.000Z] PURCHASE FLOW SIMULATOR
================================================================================

🚀 [2025-11-01T12:00:00.001Z] Starting Purchase Flow Simulation

🖥️ [2025-11-01T12:00:00.002Z] STEP 1: Frontend - User selects product
📦 [2025-11-01T12:00:00.003Z] Product details
{
  "name": "Single AI Specification",
  "price": "$4.90",
  "credits": 1,
  "unlimited": false,
  "can_edit": false
}

🌐 [2025-11-01T12:00:00.010Z] STEP 2: Frontend opens Lemon Squeezy checkout
🔗 [2025-11-01T12:00:00.011Z] Checkout URL
{
  "url": "https://specifysai.lemonsqueezy.com/checkout/buy/91788779-0286-4f45-ad89-2fefc3835699"
}

... (continues through all 12 steps) ...

🎉 [2025-11-01T12:00:05.000Z] SIMULATION COMPLETE - Purchase flow successful!

📋 [2025-11-01T12:00:05.001Z] SUMMARY OF DATA FLOW
{
  "1. User selects product": "✅",
  "2. Checkout window opens": "✅",
  "3. Polling starts": "✅",
  "4. Payment completed": "✅",
  "5. Webhook sent": "✅",
  "6. Backend receives": "✅",
  "7. Signature verified": "✅",
  "8. Idempotency checked": "✅",
  "9. Credits granted": "✅",
  "10. Database updated": "✅",
  "11. Polling detects": "✅",
  "12. Callback triggered": "✅"
}

💾 [2025-11-01T12:00:05.002Z] WHERE DATA IS STORED
{
  "User Credits": "users/{userId} + entitlements/{userId}",
  "Purchase History": "purchases/{purchaseId}",
  "Webhook Events": "processed_webhook_events/{eventId}",
  "Audit Logs": "audit_logs/{logId}",
  "Pending Entitlements": "pending_entitlements/{pendingId} (if user not found)"
}

🔐 [2025-11-01T12:00:05.003Z] SECURITY MEASURES VERIFIED
{
  "Signature Verification": "HMAC-SHA256 ✅",
  "Idempotency Protection": "Event tracking ✅",
  "Firebase Security": "Server-side only ✅",
  "Audit Trail": "Complete logs ✅"
}
```

---

## 🎯 Key Takeaways

1. **End-to-End Visibility**: See exactly what happens at each step
2. **Database Structure**: Understand how data is organized
3. **Security Verification**: Confirm all protection measures work
4. **Error Detection**: Quickly identify issues in the flow
5. **Performance Insights**: See timing of operations

---

## 🔧 Troubleshooting

### Error: "Cannot find module 'firebase-admin'"
```bash
cd backend
npm install
```

### Error: "Firebase not initialized"
Check that `firebase-service-account.json` exists in `backend/` directory.

### Error: "Product not found"
Verify `config/lemon-products.json` exists and has the product.

### Database Permission Errors
Ensure Firebase service account has proper Firestore permissions.

---

## 📚 Related Documentation

- [Purchase System Audit](./PURCHASE_SYSTEM_AUDIT.md)
- [Webhook Security Guide](./lemon-squeezy-integration.md)
- [Firebase Setup Guide](./firebase-setup.md)

---

*Last Updated: 2025-11-01*

