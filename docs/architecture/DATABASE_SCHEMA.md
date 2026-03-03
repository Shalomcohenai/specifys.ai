# 📊 Complete Database Schema - Specifys.ai

## Overview

This document provides a complete reference for all Firestore collections and their fields used in the Specifys.ai application.

---

## 🔑 Collections Summary

| Collection | Document ID | Primary Purpose |
|------------|-------------|-----------------|
| `users` | Firebase UID | User profile and account data |
| `user_credits_v3` | Firebase UID | **Credits V3 – single source of truth** (balances, subscription, permissions) |
| `entitlements` | Firebase UID | Legacy credits/permissions (deprecated; use `user_credits_v3`) |
| `credit_ledger_v3` | Auto-generated | V3 credit transaction ledger |
| `subscriptions_v3` | — | Archive/logs for subscription events (not primary source) |
| `purchases` | Auto-generated | Purchase history |
| `subscriptions` | Firebase UID | Legacy subscription records |
| `pending_entitlements` | Auto-generated | Pre-signup purchases |
| `processed_webhook_events` | Event ID | Webhook idempotency |
| `audit_logs` | Auto-generated | Debugging and compliance |
| `brainDumpRateLimit` | Firebase UID | Brain Dump daily rate limit (5/day per user) |
| `specs` | Auto-generated | User specifications |
| `apps` | Auto-generated | App dashboards |
| `marketResearch` | Auto-generated | Market research data |
| `userTools` | Firebase UID | User tool configuration |
| `tools` | Auto-generated | **Vibe Coding Tools Map** – source of truth; `tools/map/tools.json` is derived export only |

---

## 👤 `users` Collection

**Document ID:** Firebase UID (string)

**Purpose:** Store user profile information and basic account data

### Fields

```javascript
{
  // Authentication Data
  email: string,                           // User's email address
  displayName: string,                     // Display name
  emailVerified: boolean,                  // Email verification status
  disabled: boolean,                       // Account disabled flag
  
  // Timestamps
  createdAt: string|timestamp,             // Account creation date
  lastActive: string|timestamp,            // Last activity timestamp
  
  // Payment & Credits
  plan: string,                            // 'free' | 'pro'
  // Note: Credits are now managed in user_credits_v3 collection (single source of truth)
  // free_specs_remaining is deprecated - use user_credits_v3 instead
  lemon_customer_id: string|null,          // Lemon Squeezy customer ID
  last_entitlement_sync_at: timestamp,     // Last sync with entitlements

  // MCP (Cursor / Claude Desktop)
  mcpApiKey: string|null,                  // Optional; per-user API key for MCP server (create via Profile or POST /api/users/me/mcp-api-key)
  mcpApiKeyUpdatedAt: timestamp|null       // When the MCP API key was last set/regenerated
}
```

### Example Document

```javascript
{
  email: "user@example.com",
  displayName: "John Doe",
  emailVerified: true,
  disabled: false,
  createdAt: "2025-01-01T00:00:00Z",
  lastActive: "2025-11-02T12:00:00Z",
  plan: "free",
  // Credits are stored in user_credits_v3 collection, not here
  lemon_customer_id: "cus_12345",
  last_entitlement_sync_at: Timestamp(2025, 11, 2, 12, 0, 0),
  mcpApiKey: null,
  mcpApiKeyUpdatedAt: null
}
```

### Key Points

- **Document ID = UID** from Firebase Authentication
- **Credits are managed in `user_credits_v3` collection** (single source of truth)
- `free_specs_remaining` is deprecated - use `user_credits_v3` instead
- `plan` can be 'free' or 'pro'
- `lemon_customer_id` links to Lemon Squeezy for payment tracking

---

## 💳 `user_credits_v3` Collection (Primary Credits System)

**Document ID:** Firebase UID (string)

**Purpose:** Single source of truth for user credits, subscription status, and permissions. Replaces the legacy `entitlements`-based credit logic.

### Fields

```javascript
{
  userId: string,
  balances: {
    paid: number,    // Purchased credits
    free: number,    // Free/welcome credits
    bonus: number   // Bonus credits
  },
  total: number,    // Computed: paid + free + bonus (single source of truth)
  subscription: {
    type: 'none' | 'pro',
    status: 'none' | 'active' | 'paid' | 'expired' | 'cancelled',
    expiresAt: timestamp | null,
    preservedCredits: number,
    lemonSubscriptionId: string | null,
    lastSyncedAt: timestamp | null,
    productKey: string | null,
    productName: string | null,
    billingInterval: string | null,
    renewsAt: timestamp | null,
    endsAt: timestamp | null,
    cancelAtPeriodEnd: boolean
  },
  permissions: {
    canEdit: boolean,
    canCreateUnlimited: boolean   // Pro: unlimited spec creation
  },
  metadata: {
    createdAt: timestamp,
    updatedAt: timestamp,
    migratedFrom: string | null,
    migrationTimestamp: timestamp | null,
    lastCreditGrant: timestamp | null,
    lastCreditConsume: timestamp | null,
    welcomeCreditGranted: boolean
  }
}
```

### Key Points

- **Document ID = UID.** One document per user.
- **Credits:** Use `total` or `balances.paid + balances.free + balances.bonus`. Consumption order: free → bonus → paid.
- **Pro:** `subscription.type === 'pro'` and `status === 'active'` or `'paid'` with valid `expiresAt` → unlimited creation.
- **New users:** Get 1 free welcome credit (`balances.free: 1`, `metadata.welcomeCreditGranted: true`).
- Ledger and subscription events are recorded in `credit_ledger_v3` and `subscriptions_v3` (archive).

---

## 📊 `brainDumpRateLimit` Collection

**Document ID:** Firebase UID (string)

**Purpose:** Enforce Brain Dump API rate limit (5 requests per day per user). Reset is date-based (e.g. midnight).

Used by `POST /api/brain-dump/generate`. When exceeded, API returns `429`.

---

## 💳 `entitlements` Collection (Legacy)

**Document ID:** Firebase UID (string)

**Purpose:** Store user's credits, permissions, and access levels

### Fields

```javascript
{
  userId: string,                          // Reference to user's UID
  spec_credits: number,                    // Purchased spec credits
  unlimited: boolean,                      // Pro subscription access
  can_edit: boolean,                       // Edit permissions
  preserved_credits: number,               // Credits preserved when Pro enabled
  updated_at: timestamp                    // Last update timestamp
}
```

### Example Document

```javascript
// Regular user with purchased credits
{
  userId: "abc123...",
  spec_credits: 3,
  unlimited: false,
  can_edit: false,
  preserved_credits: 0,
  updated_at: Timestamp(2025, 11, 2, 12, 0, 0)
}

// Pro subscription user
{
  userId: "def456...",
  spec_credits: 0,
  unlimited: true,
  can_edit: true,
  preserved_credits: 5,                    // Had 5 credits before Pro
  updated_at: Timestamp(2025, 11, 2, 12, 0, 0)
}
```

### Credit Priority Order (Deprecated - See user_credits_v3)

**Note:** The `entitlements` collection is deprecated. Credits are now managed in `user_credits_v3` collection.

Old priority order (for reference):
1. **`unlimited: true`** → Pro subscription → Can create unlimited specs
2. **`spec_credits > 0`** → Purchased credits → Can create purchased specs
3. **`free_specs_remaining > 0`** → Free trial → Can create 1 free spec

See `user_credits_v3` collection documentation below for current credit system.

### Key Points

- **Document ID = UID** (same as user document)
- `spec_credits` is incremented/decremented, never set directly
- `preserved_credits` stores credits when Pro is enabled
- `can_edit` allows users to edit their existing specs

---

## 🛒 `purchases` Collection

**Document ID:** Auto-generated by Firestore

**Purpose:** Track individual purchases and credit transactions

### Fields

```javascript
{
  userId: string,                          // User who made the purchase
  lemon_order_id: string,                  // Lemon Squeezy order ID
  product_id: string,                      // Product ID from config
  variant_id: string,                      // Product variant ID
  credits_granted: number,                 // Credits granted
  credits_used: number,                    // Credits consumed
  total_amount_cents: number,              // Purchase amount in cents
  currency: string,                        // Currency code ('USD')
  status: string,                          // 'completed' | 'refunded'
  purchased_at: timestamp                  // Purchase timestamp
}
```

### Example Document

```javascript
{
  userId: "abc123...",
  lemon_order_id: "order_67890",
  product_id: "671441",
  variant_id: "91788779-0286-4f45-ad89-2fefc3835699",
  credits_granted: 3,
  credits_used: 1,
  total_amount_cents: 990,                 // $9.90
  currency: "USD",
  status: "completed",
  purchased_at: Timestamp(2025, 11, 2, 10, 0, 0)
}
```

### Key Points

- Created automatically when webhook processes `order_created`
- `credits_used` tracks consumption against this purchase
- Used for refund tracking and purchase history

---

## 🔄 `subscriptions` Collection

**Document ID:** Firebase UID (string)

**Purpose:** Track active and past subscriptions

### Fields

```javascript
{
  userId: string,                          // User with subscription
  lemon_subscription_id: string,           // Lemon Squeezy subscription ID
  product_id: string,                      // Product ID from config
  variant_id: string,                      // Product variant ID
  status: string,                          // 'active' | 'cancelled' | 'expired' | 'payment_failed'
  current_period_end: timestamp,           // Subscription end date
  cancel_at_period_end: boolean,           // Cancellation scheduled?
  updated_at: timestamp                    // Last update timestamp
}
```

### Example Document

```javascript
{
  userId: "def456...",
  lemon_subscription_id: "sub_12345",
  product_id: "671443",
  variant_id: "cae56dc9-f0b9-45fa-a4af-5405e08ab8c9",
  status: "active",
  current_period_end: Timestamp(2025, 12, 2, 12, 0, 0),  // Next month
  cancel_at_period_end: false,
  updated_at: Timestamp(2025, 11, 2, 12, 0, 0)
}
```

### Key Points

- **Document ID = UID** (one subscription per user)
- `status: 'cancelled'` means subscription continues until `current_period_end`
- `cancel_at_period_end: true` marks for cancellation

---

## ⏳ `pending_entitlements` Collection

**Document ID:** Auto-generated by Firestore

**Purpose:** Store purchases made before user signup

### Fields

```javascript
{
  email: string,                           // Email used in purchase
  lemon_customer_id: string,               // Lemon Squeezy customer ID
  payload_json: string,                    // Full webhook payload (JSON string)
  grants_json: string,                     // Grants configuration (JSON string)
  reason: string,                          // Why pending: 'order_created_before_signup'
  claimed: boolean,                        // Credits applied?
  claimed_at: timestamp,                   // When credits were applied
  claimed_by_user_id: string,              // User who claimed
  created_at: timestamp                    // When pending was created
}
```

### Example Document

```javascript
{
  email: "buyer@example.com",
  lemon_customer_id: "cus_12345",
  payload_json: "{\"meta\":{\"event_name\":\"order_created\"...}",
  grants_json: "{\"spec_credits\":3}",
  reason: "order_created_before_signup",
  claimed: false,
  claimed_at: null,
  claimed_by_user_id: null,
  created_at: Timestamp(2025, 11, 2, 10, 0, 0)
}
```

### Key Points

- Created when purchase webhook arrives but user doesn't exist yet
- Automatically claimed when user signs up with matching email
- `claimed: true` prevents duplicate claiming

---

## 🔒 `processed_webhook_events` Collection

**Document ID:** Event ID from Lemon Squeezy (string)

**Purpose:** Prevent duplicate webhook processing (idempotency)

### Fields

```javascript
{
  event_id: string,                        // Lemon Squeezy event ID
  created_at: timestamp                    // When processed
}
```

### Example Document

```javascript
{
  event_id: "evt_1234567890",
  created_at: Timestamp(2025, 11, 2, 10, 0, 0)
}
```

### Key Points

- **Document ID = Event ID** from webhook payload
- Checked before processing any webhook
- Prevents duplicate credit grants

---

## 📋 `audit_logs` Collection

**Document ID:** Auto-generated by Firestore

**Purpose:** Track all critical operations for debugging and compliance

### Fields

```javascript
{
  userId: string|null,                     // User involved (null if user not found)
  source: string,                          // 'lemon_webhook' | 'api' | 'admin'
  action: string,                          // 'order_created' | 'grant_failed' | etc.
  event_id: string,                        // Webhook event ID
  payload_json: string,                    // Full payload (JSON string)
  created_at: timestamp                    // When logged
}
```

### Example Document

```javascript
{
  userId: "abc123...",
  source: "lemon_webhook",
  action: "order_created",
  event_id: "evt_1234567890",
  payload_json: "{\"meta\":{\"event_name\":\"order_created\"...}",
  created_at: Timestamp(2025, 11, 2, 10, 0, 0)
}
```

### Key Points

- Records every webhook operation
- `payload_json` stores full webhook payload for debugging
- Used for troubleshooting and compliance

---

## 📄 Other Collections

### `specs` Collection

Store user-generated specifications

### `apps` Collection

Store app dashboards

### `marketResearch` Collection

Store market research data

### `userTools` Collection

Store user tool configuration

### `tools` Collection (Vibe Coding Tools Map)

**Document ID:** Auto-generated (Firestore)

**Purpose:** Single source of truth for the Vibe Coding Tools Map. All reads (API, MCP, site) use this collection. The file `tools/map/tools.json` is a **derived export only** (see [TOOLS-MAP-DATA](../references/TOOLS-MAP-DATA.md)).

**Fields (typical):**

- `id` – numeric or string identifier
- `name`, `category`, `description`, `link` – required
- `rating`, `pros`, `cons`, `special`, `stats`, `added` – optional
- `migratedAt`, `lastUpdated`, `source` – internal/metadata (excluded from public export)

**Related:** Export via `tools-export-service.js` (admin or after tools-finder job). MCP exposes list via `GET /api/mcp/tools`.

---

## 🔍 How to Check User Credits

**Primary:** Use the `user_credits_v3` collection. Check document with ID = User ID; fields `total` and `balances` (paid, free, bonus). For Pro, check `subscription.type === 'pro'` and `subscription.status === 'active'` or `'paid'`.

### Method 1: Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Navigate to **Firestore Database**
3. Open **`user_credits_v3`** collection (primary) or legacy `entitlements`
4. Find document with UID = User ID
5. Check `total` and `balances` (V3) or `spec_credits` (legacy)

### Method 2: Command Line Script

```bash
cd backend
node scripts/check-user-entitlements.js USER_ID
```

**Output:**
```
📊 User Status Report
==========================================
User ID: abc123...
==========================================

👤 User Document:
─────────────────────────────────────────
  Email: user@example.com
  Display Name: John Doe
  Plan: free
  Free Specs Remaining: 1
  Created: 2025-01-01T00:00:00Z
  Last Active: 2025-11-02T12:00:00Z

💳 Entitlements:
─────────────────────────────────────────
  Unlimited: ❌ NO
  Can Edit: ❌ NO
  Spec Credits: 3
  Preserved Credits: 0
  Updated At: 2025-11-02T10:00:00Z

📈 Summary:
─────────────────────────────────────────
  User Type: 💰 CREDIT USER
  Can Create Specs: ✅ YES
  Remaining: 3

✅ Check completed!
```

### Method 3: Purchase Monitor Dashboard

1. Go to `/pages/purchase-monitor.html`
2. View recent webhook events
3. Check statistics

---

## 🔗 Relationships Between Collections

```
Firebase Auth (UID)
    ↓
users/{userId}
    ↓
user_credits_v3/{userId} ────► Primary credit source (V3: balances, total, subscription, permissions)
    ↓
credit_ledger_v3 ────► Transaction log
subscriptions_v3 ────► Subscription event archive
    ↓
entitlements/{userId} ────► Legacy (deprecated)
subscriptions/{userId} ────► Legacy Pro access
    ↓
purchases/{purchaseId} ────► Purchase history linked to userId
brainDumpRateLimit/{userId} ────► Brain Dump daily rate limit
```

**User-to-Entitlements:**
- Same UID in both collections
- `entitlements` is updated when:
  - User purchases credits
  - User subscribes to Pro
  - User creates spec (credit consumed)
  - User refunds spec

**User-to-Purchases:**
- `purchases` collection links to user via `userId`
- Created automatically on webhook processing

**User-to-Subscriptions:**
- Same UID in both collections
- One active subscription per user

---

## 🛡️ Firestore Security Rules

### `entitlements` Collection

```javascript
match /entitlements/{document} {
  allow read: if request.auth != null && (
    !exists(/databases/$(database)/documents/entitlements/$(document)) ||
    request.auth.uid == resource.data.userId
  ) || isAdmin();
  allow write: if request.auth.uid == resource.data.userId || isAdmin();
}
```

### `purchases` Collection

```javascript
match /purchases/{document} {
  allow read: if request.auth != null && (
    request.auth.uid == resource.data.userId
  ) || isAdmin();
}
```

---

## 📊 Data Flow Example

### New User Purchases Credits

```
1. User signs up
   └─> users/{uid} created
   └─> entitlements/{uid} created with spec_credits: 0

2. User clicks purchase
   └─> Paywall opens
   └─> Polling starts

3. User completes payment at Lemon Squeezy
   └─> Lemon sends webhook to backend

4. Backend processes webhook
   └─> verifySignature() ✅
   └─> isEventProcessed() ✅
   └─> markEventProcessed() ✅
   └─> grantCredits(userId, 3, orderId, variantId)
       └─> entitlements/{uid}.spec_credits += 3
       └─> purchases/{purchaseId} created
       └─> processed_webhook_events/{eventId} created
       └─> audit_logs/{logId} created

5. Polling detects change
   └─> GET /api/specs/entitlements
   └─> Returns {spec_credits: 3}
   └─> Callback triggers
   └─> Spec generation retries
```

---

## 🔧 Maintenance Scripts

### Check Specific User
```bash
node backend/scripts/check-user-entitlements.js USER_ID
```

### Check All Purchases
```bash
node backend/scripts/check-purchases.js
```

### Check for Errors
```bash
node backend/scripts/check-webhook-errors.js
```

### Run Simulation
```bash
node backend/scripts/simulate-purchase-flow.js single_spec
```

---

## 📈 Common Queries

### Get All Pro Users
```javascript
db.collection('entitlements')
  .where('unlimited', '==', true)
  .get()
```

### Get Users with Credits
```javascript
db.collection('entitlements')
  .where('spec_credits', '>', 0)
  .get()
```

### Get Recent Purchases
```javascript
db.collection('purchases')
  .where('purchased_at', '>=', yesterday)
  .orderBy('purchased_at', 'desc')
  .get()
```

### Get Unclaimed Pending Entitlements
```javascript
db.collection('pending_entitlements')
  .where('claimed', '==', false)
  .get()
```

---

*Last Updated: March 2025*

