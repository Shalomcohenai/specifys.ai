# Credits System V3 - Complete Migration Guide

## Overview

This document provides a comprehensive guide to the Credits System V3 migration. It includes all changes made to the system, migration procedures, and instructions for rollback if needed.

**Version**: 3.0  
**Migration Date**: [To be filled]  
**Status**: Parallel mode (V2 and V3 running simultaneously)

---

## Table of Contents

1. [System Architecture Changes](#system-architecture-changes)
2. [New Collections](#new-collections)
3. [New Files Created](#new-files-created)
4. [Modified Files](#modified-files)
5. [Migration Process](#migration-process)
6. [Admin Dashboard Changes](#admin-dashboard-changes)
7. [Frontend Changes](#frontend-changes)
8. [API Changes](#api-changes)
9. [Rollback Procedures](#rollback-procedures)
10. [Testing & Validation](#testing--validation)

---

## System Architecture Changes

### V2 Architecture (Old)
- **Primary Collections**: `user_credits`, `subscriptions`
- **Data Distribution**: Subscription data split between collections
- **No Ledger**: No centralized transaction tracking
- **API Endpoint**: `/api/v2/credits`

### V3 Architecture (New)
- **Primary Collection**: `user_credits_v3` (Single Source of Truth)
- **Archive Collection**: `subscriptions_v3` (logs/audit only)
- **Ledger Collection**: `credit_ledger_v3` (full transaction history)
- **API Endpoint**: `/api/v3/credits`
- **Migration Mode**: Parallel (both systems active)

### Key Improvements
1. **Single Source of Truth**: All credit and subscription data in one place
2. **Full Transaction Ledger**: Complete audit trail of all credit operations
3. **Idempotency**: Transaction IDs prevent duplicate operations
4. **Atomic Operations**: Firestore transactions ensure data consistency
5. **Better Subscription Management**: Unified subscription data structure

---

## New Collections

### 1. `user_credits_v3`

**Purpose**: Single Source of Truth for all user credits and subscription data

**Document Structure**:
```javascript
{
  userId: string,
  balances: {
    paid: number,      // Credits purchased
    free: number,      // Free/welcome credits
    bonus: number      // Promotional credits
  },
  subscription: {
    type: 'none' | 'pro',
    status: 'none' | 'active' | 'paid' | 'cancelled' | 'expired',
    expiresAt: Timestamp | null,
    preservedCredits: number,        // Credits to restore on cancellation
    lemonSubscriptionId: string | null,
    lastSyncedAt: Timestamp | null,
    productKey: string | null,       // e.g., 'pro_monthly', 'pro_yearly'
    productName: string | null,
    billingInterval: string | null,  // 'month' | 'year'
    renewsAt: Timestamp | null,
    endsAt: Timestamp | null,
    cancelAtPeriodEnd: boolean
  },
  permissions: {
    canEdit: boolean,
    canCreateUnlimited: boolean
  },
  metadata: {
    createdAt: Timestamp,
    updatedAt: Timestamp,
    migratedFrom: 'v2' | null,
    migrationTimestamp: Timestamp | null,
    lastCreditGrant: Timestamp | null,
    lastCreditConsume: Timestamp | null,
    welcomeCreditGranted: boolean
  }
}
```

**Key Features**:
- All subscription data embedded (no need to query separate collection)
- Preserved credits mechanism for subscription cancellation
- Migration metadata for tracking

### 2. `subscriptions_v3`

**Purpose**: Archive/logs collection (NOT used for runtime decisions)

**Document Structure**:
```javascript
{
  userId: string,
  product_id: string | null,
  product_key: string | null,
  product_name: string | null,
  product_type: string | null,
  variant_id: string | null,
  status: string,
  billing_interval: string | null,
  lemon_subscription_id: string | null,
  last_order_id: string | null,
  last_order_total: number | null,
  currency: string,
  cancel_at_period_end: boolean,
  current_period_end: Timestamp | null,
  renews_at: Timestamp | null,
  purchase_date: Timestamp,
  cancelled_at: Timestamp | null,
  cancel_reason: string | null,
  updated_at: Timestamp,
  last_synced_at: Timestamp,
  last_synced_source: string,
  last_synced_mode: 'live' | 'manual',
  migrated_at: Timestamp | null
}
```

**Usage**: 
- Historical records only
- Audit trail
- Analytics
- NOT used for credit checks or subscription validation

### 3. `credit_ledger_v3`

**Purpose**: Complete transaction history for all credit operations

**Document Structure**:
```javascript
{
  id: string,                    // transactionId (unique)
  userId: string,
  type: 'consume' | 'grant' | 'refund',
  amount: number,
  creditType: 'paid' | 'free' | 'bonus' | 'unlimited',
  source: {
    type: string,                 // e.g., 'spec_creation', 'purchase', 'admin'
    specId: string | null,
    orderId: string | null,
    reason: string | null
  },
  balanceAfter: {
    paid: number,
    free: number,
    bonus: number
  },
  metadata: {
    priority: string[] | null,   // For consume operations
    notes: string | null,
    originalTransactionId: string | null  // For refunds
  },
  timestamp: Timestamp,
  createdAt: Timestamp
}
```

**Key Features**:
- Idempotency: Transaction ID prevents duplicate operations
- Balance tracking: Shows balance after each operation
- Full audit trail: Every credit operation is recorded
- Queryable: Can filter by type, creditType, date range, etc.

---

## New Files Created

### Backend Files

#### 1. `backend/server/credits-v3-service.js`

**Purpose**: Core service for all V3 credit operations

**Key Functions**:
- `getUserCredits(userId, autoCreate)` - Get user credits (creates default if missing)
- `getAvailableCredits(userId)` - Get available credits (checks subscription for unlimited)
- `consumeCredit(userId, specId, options)` - Consume credit with idempotency
- `grantCredits(userId, amount, source, metadata)` - Grant credits (admin/purchase)
- `refundCredit(userId, amount, reason, originalTransactionId)` - Refund credits
- `getCreditLedger(userId, filters)` - Get transaction history
- `enableProSubscription(userId, options)` - Enable Pro subscription
- `disableProSubscription(userId, options)` - Disable Pro subscription

**Key Features**:
- Firestore transactions for atomicity
- Idempotency via transaction IDs
- Automatic subscription expiration checking
- Credit preservation on subscription cancellation
- Comprehensive logging

**File Location**: `backend/server/credits-v3-service.js`  
**Lines**: ~1354 lines

#### 2. `backend/server/credits-v3-routes.js`

**Purpose**: Express routes for V3 API endpoints

**Endpoints**:
- `GET /api/v3/credits` - Get user credits
- `POST /api/v3/credits/consume` - Consume credit
- `POST /api/v3/credits/grant` - Grant credits (admin only)
- `POST /api/v3/credits/refund` - Refund credits
- `GET /api/v3/credits/ledger` - Get transaction ledger
- `GET /api/v3/credits/history` - Get credit history summary

**Authentication**: Firebase ID token required for all endpoints  
**Admin Only**: `/grant` endpoint

**File Location**: `backend/server/credits-v3-routes.js`  
**Lines**: ~377 lines

#### 3. `backend/scripts/migrate-to-v3.js`

**Purpose**: Migration script from V2 to V3

**Usage**:
```bash
# Dry run (validation only)
node backend/scripts/migrate-to-v3.js --dry-run

# Migrate all users
node backend/scripts/migrate-to-v3.js

# Migrate specific user
node backend/scripts/migrate-to-v3.js --user-id=USER_ID
```

**Migration Logic**:
1. Reads data from `user_credits` and `subscriptions` (V2)
2. Checks `users.plan` as fallback for Pro status
3. Builds V3 structure with unified subscription data
4. Saves to `user_credits_v3`
5. Archives subscription data to `subscriptions_v3`
6. Adds migration metadata

**Priority Order for Subscription Data**:
1. `subscriptions` collection (primary)
2. `user_credits.subscription` (fallback)
3. `users.plan` (final fallback)

**File Location**: `backend/scripts/migrate-to-v3.js`  
**Lines**: ~397 lines

#### 4. `backend/scripts/validate-v3-migration.js`

**Purpose**: Validate migration correctness

**Usage**:
```bash
# Validate all users
node backend/scripts/validate-v3-migration.js

# Validate specific user
node backend/scripts/validate-v3-migration.js --user-id=USER_ID
```

**Validates**:
- Credit balances match between V2 and V3
- Subscription status matches
- Permissions match
- Data integrity

**File Location**: `backend/scripts/validate-v3-migration.js`  
**Lines**: ~330 lines

#### 5. `backend/scripts/create-v3-collections.js`

**Purpose**: Create V3 collections in Firestore

**Usage**:
```bash
# Dry run
node backend/scripts/create-v3-collections.js --dry-run

# Create collections
node backend/scripts/create-v3-collections.js
```

**Creates**:
- `user_credits_v3`
- `subscriptions_v3`
- `credit_ledger_v3`

**File Location**: `backend/scripts/create-v3-collections.js`  
**Lines**: ~148 lines

#### 6. `backend/scripts/test-v3-system.js`

**Purpose**: Test V3 system functionality

**Usage**:
```bash
node backend/scripts/test-v3-system.js --user-id=USER_ID
```

**Tests**:
- Credit retrieval
- Credit consumption
- Credit granting
- Subscription management
- Ledger operations

**File Location**: `backend/scripts/test-v3-system.js`

---

## Modified Files

### Backend Files

#### 1. `backend/server/config.js`

**Changes**:
```javascript
// Added V3 configuration
creditsV3: {
  enabled: process.env.CREDITS_V3_ENABLED === 'true',
  migrationMode: process.env.CREDITS_V3_MIGRATION_MODE || 'parallel'
}
```

**Environment Variables**:
- `CREDITS_V3_ENABLED`: `'true'` to enable V3 system
- `CREDITS_V3_MIGRATION_MODE`: `'parallel'` | `'v3_only'` | `'v2_only'`

**Migration Modes**:
- `parallel`: Both V2 and V3 active (default)
- `v3_only`: Only V3 active
- `v2_only`: Only V2 active

**File Location**: `backend/server/config.js`  
**Lines Changed**: Added lines 29-34

#### 2. `backend/server/server.js`

**Changes**:
```javascript
// V3 routes mounting
if (config.creditsV3.enabled) {
  logger.info({ type: 'route_mount', path: '/api/v3/credits', route: 'creditsV3Routes', mode: config.creditsV3.migrationMode }, '[UNIFIED SERVER] 📌 Mounting credits V3 routes');
  const creditsV3Routes = require('./credits-v3-routes');
  app.use('/api/v3/credits', creditsV3Routes);
  logger.info({ type: 'route_mounted', path: '/api/v3/credits', mode: config.creditsV3.migrationMode }, '[UNIFIED SERVER] ✅ Credits V3 routes mounted');
} else {
  logger.info({ type: 'route_skipped', path: '/api/v3/credits', reason: 'CREDITS_V3_ENABLED=false' }, '[UNIFIED SERVER] ⏭️  Credits V3 routes disabled (feature flag)');
}
```

**File Location**: `backend/server/server.js`  
**Lines Changed**: ~359-366

#### 3. `backend/server/lemon-routes.js`

**Changes**: Added V3 sync in webhook handlers

**Order Webhook** (lines ~793-800):
```javascript
// Update V3 if enabled
if (config.creditsV3.enabled) {
  try {
    const creditsV3Service = require('./credits-v3-service');
    await creditsV3Service.enableProSubscription(orderData.userId, enableProOptions);
    logger.info({ userId: orderData.userId }, '[lemon-routes] V3 subscription enabled from order webhook');
  } catch (v3Error) {
    logger.warn({ userId: orderData.userId, error: v3Error.message }, '[lemon-routes] Failed to enable V3 subscription from order (non-critical)');
  }
}
```

**Subscription Activated Webhook** (lines ~912-919):
```javascript
// Update V3 if enabled
if (config.creditsV3.enabled) {
  try {
    const creditsV3Service = require('./credits-v3-service');
    await creditsV3Service.enableProSubscription(subscriptionUserId, enableProOptions);
    logger.info({ webhookRequestId, userId: subscriptionUserId }, '[lemon-routes] V3 subscription enabled from webhook');
  } catch (v3Error) {
    logger.warn({ webhookRequestId, userId: subscriptionUserId, error: v3Error.message }, '[lemon-routes] Failed to enable V3 subscription (non-critical)');
  }
}
```

**Subscription Cancelled Webhook** (lines ~959-966):
```javascript
// Update V3 if enabled
if (config.creditsV3.enabled) {
  try {
    const creditsV3Service = require('./credits-v3-service');
    await creditsV3Service.disableProSubscription(subscriptionUserId, disableProOptions);
    logger.info({ webhookRequestId, userId: subscriptionUserId }, '[lemon-routes] V3 subscription disabled from webhook');
  } catch (v3Error) {
    logger.warn({ webhookRequestId, userId: subscriptionUserId, error: v3Error.message }, '[lemon-routes] Failed to disable V3 subscription (non-critical)');
  }
}
```

**File Location**: `backend/server/lemon-routes.js`  
**Lines Changed**: ~793-800, ~912-919, ~959-966

#### 4. `backend/server/lemon-subscription-resolver.js`

**Changes**: Added V3 archive updates

**Lines ~662-680**: Archive to `subscriptions_v3`
```javascript
// Also update subscriptions_v3 (archive) if V3 is enabled
if (config.creditsV3.enabled) {
  try {
    const subscriptionsV3Ref = db.collection('subscriptions_v3').doc(userId);
    const v3SubscriptionData = {
      // ... subscription data
      migrated_at: admin.firestore.FieldValue.serverTimestamp()
    };
    await subscriptionsV3Ref.set(v3SubscriptionData, { merge: true });
  } catch (v3Error) {
    log.warn('Failed to update V3 subscription archive (non-critical)', { error: v3Error?.message || v3Error });
  }
}
```

**Lines ~755-780**: Sync to `user_credits_v3`
```javascript
// Also sync to user_credits_v3 if V3 is enabled
if (config.creditsV3.enabled) {
  try {
    const creditsV3Service = require('./credits-v3-service');
    creditsV3Service.enableProSubscription(userId, {
      // ... subscription options
    }).catch(v3SyncError => {
      log.warn('Auto-sync to user_credits_v3 failed (non-critical)', {
        error: v3SyncError?.message || v3SyncError
      });
    });
  } catch (v3Error) {
    log.warn('Failed to sync to V3 (non-critical)', {
      error: v3Error?.message || v3Error
    });
  }
}
```

**File Location**: `backend/server/lemon-subscription-resolver.js`  
**Lines Changed**: ~662-680, ~755-780

#### 5. `backend/server/user-analytics-service.js`

**Changes**: Added V3 data reading

**Lines ~215-258**: Read from `user_credits_v3`
```javascript
// Try V3 first
const creditsDoc = await db.collection('user_credits_v3').doc(userId).get();
if (creditsDoc.exists) {
  const creditsData = creditsDoc.data();
  // Process V3 data
}

// Fallback to V2
const subscriptionDoc = await db.collection('subscriptions_v3').doc(userId).get();
// ... process subscription data
```

**Lines ~387-408**: Raw data includes V3 collections
```javascript
rawData: {
  users: userData,
  user_credits_v3: creditsV3Data || { error: error.message },
  subscriptions_v3: subscriptionV3Data || { error: error.message }
}
```

**File Location**: `backend/server/user-analytics-service.js`  
**Lines Changed**: ~215-258, ~387-408

### Frontend Files

#### 1. `assets/js/paywall.js`

**Changes**: Added V3 endpoint support

**Lines ~280-284**:
```javascript
// Use credits API - check if V3 is enabled (via localStorage or default to V2)
// Note: V3 endpoint is only available if CREDITS_V3_ENABLED=true on server
const useV3 = localStorage.getItem('credits_use_v3') === 'true';
const creditsEndpoint = useV3 ? '/api/v3/credits' : '/api/v2/credits';
const data = await window.api.get(creditsEndpoint);
```

**Lines ~286-290**: New response format support
```javascript
// New format: { unlimited, total, breakdown: { paid, free, bonus }, subscription, permissions }
const credits = data || {};
const unlimited = credits.unlimited || false;
const total = credits.total || 0;
const breakdown = credits.breakdown || { paid: 0, free: 0, bonus: 0 };
```

**File Location**: `assets/js/paywall.js`  
**Lines Changed**: ~280-290

#### 2. `assets/js/new-admin-dashboard/core/FirebaseService.js`

**Changes**: Updated collection constants to V3

**Lines ~38-50**:
```javascript
const COLLECTIONS = Object.freeze({
  USERS: "users",
  USER_CREDITS: "user_credits_v3",  // V3: Single source of truth
  SPECS: "specs",
  PURCHASES: "purchases",
  SUBSCRIPTIONS: "subscriptions_v3",  // V3: Archive/logs only
  CREDITS_TRANSACTIONS: "credit_ledger_v3",  // V3: Credit ledger
  ACTIVITY_LOGS: "activityLogs",
  ERROR_LOGS: "errorLogs",
  CSS_CRASH_LOGS: "cssCrashLogs",
  BLOG_QUEUE: "blogQueue",
  CONTACT_SUBMISSIONS: "contactSubmissions"
});
```

**File Location**: `assets/js/new-admin-dashboard/core/FirebaseService.js`  
**Lines Changed**: ~38-50

#### 3. `assets/js/new-admin-dashboard/core/DataManager.js`

**Changes**: Load credits from V3 collection

**Lines ~320-378**: Load from `user_credits_v3`
```javascript
async loadUserCredits() {
  this.loadingStates.userCredits = true;
  this.emit('loading', { source: 'userCredits', loading: true });
  
  try {
    await firebaseService.subscribe(
      firebaseService.getCollections().USER_CREDITS,  // user_credits_v3
      (snapshot) => {
        this.data.userCredits.clear();
        snapshot.forEach((doc) => {
          const data = doc.data();
          this.data.userCredits.set(doc.id, {
            id: doc.id,
            ...data
          });
        });
        
        console.log('[DataManager] userCredits loaded from V3 (user_credits_v3):', userCreditsArray.length, 'users');
        this.emit('data', { source: 'userCredits', data: userCreditsArray });
      },
      {},
      (error) => {
        if (error?.code === 'permission-denied') {
          console.warn('[DataManager] Permission denied for user_credits_v3 collection');
          this.emit('restricted', { source: 'userCredits', error });
        }
      }
    );
  } catch (error) {
    console.error('[DataManager] Exception loading userCredits from V3 (user_credits_v3):', error);
  }
}
```

**File Location**: `assets/js/new-admin-dashboard/core/DataManager.js`  
**Lines Changed**: ~320-378

#### 4. `assets/js/new-admin-dashboard/components/UserDetailsModal.js`

**Changes**: 
- V3 data source badges
- V3 raw data display
- Copy button for raw data

**Lines ~265-268**: V3 badge indicator
```javascript
${analytics.rawData?.user_credits_v3?.exists !== false ? 
  '<span class="data-source-badge v3" style="margin-left: 8px;" title="Data from V3 system (user_credits_v3)">V3</span>' : 
  '<span class="data-source-badge v2" style="margin-left: 8px;" title="Data from V2 system (fallback)">V2</span>'
}
```

**Lines ~511-514**: Copy button
```javascript
<button class="btn-modern small" id="copy-raw-data-btn" style="margin-left: auto;">
  <i class="fas fa-copy"></i>
  Copy All Data
</button>
```

**Lines ~525-533**: V3 collections in raw data
```javascript
<details>
  <summary>user_credits_v3 Collection</summary>
  <pre>${this.escapeHtml(JSON.stringify(analytics.rawData?.user_credits_v3 || {}, null, 2))}</pre>
</details>
<details>
  <summary>subscriptions_v3 Collection</summary>
  <pre>${this.escapeHtml(JSON.stringify(analytics.rawData?.subscriptions_v3 || {}, null, 2))}</pre>
</details>
```

**Lines ~715-747**: Copy button functionality
```javascript
setupCopyButton() {
  const copyBtn = this.modal?.querySelector('#copy-raw-data-btn');
  if (!copyBtn) return;
  
  newCopyBtn.addEventListener('click', () => {
    const rawData = this.currentAnalytics?.rawData || {
      users: {},
      user_credits_v3: {},
      subscriptions_v3: {}
    };
    
    const jsonString = JSON.stringify(rawData, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      // Show success feedback
      newCopyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
      setTimeout(() => {
        newCopyBtn.innerHTML = originalHTML;
      }, 2000);
    });
  });
}
```

**File Location**: `assets/js/new-admin-dashboard/components/UserDetailsModal.js`  
**Lines Changed**: ~265-268, ~511-514, ~525-533, ~715-747

#### 5. `assets/js/new-admin-dashboard/views/UsersView.js`

**Changes**: V3 data in user details window

**Lines ~1071-1080**: V3 collections display
```javascript
<details>
  <summary>user_credits_v3 Collection</summary>
  <pre>${this.escapeHtml(JSON.stringify(analytics.rawData?.user_credits_v3 || {}, null, 2))}</pre>
</details>
<details>
  <summary>subscriptions_v3 Collection</summary>
  <pre>${this.escapeHtml(JSON.stringify(analytics.rawData?.subscriptions_v3 || {}, null, 2))}</pre>
</details>
```

**Lines ~1086-1106**: Copy button in new window
```javascript
const rawData = {
  users: analytics.rawData?.users || {},
  user_credits_v3: analytics.rawData?.user_credits_v3 || {},
  subscriptions_v3: analytics.rawData?.subscriptions_v3 || {}
};

const copyBtn = document.getElementById('copy-raw-data-window-btn');
copyBtn.addEventListener('click', function() {
  const jsonString = JSON.stringify(rawData, null, 2);
  navigator.clipboard.writeText(jsonString).then(() => {
    this.innerHTML = '<i class="fas fa-check"></i> Copied!';
    setTimeout(() => {
      this.innerHTML = originalHTML;
    }, 2000);
  });
});
```

**File Location**: `assets/js/new-admin-dashboard/views/UsersView.js`  
**Lines Changed**: ~1071-1080, ~1086-1106

---

## Migration Process

### Step 1: Environment Setup

**Set Environment Variables**:
```bash
# Enable V3 system
CREDITS_V3_ENABLED=true

# Set migration mode (parallel = both systems active)
CREDITS_V3_MIGRATION_MODE=parallel
```

**File**: `.env` or environment configuration

### Step 2: Create Collections

**Run Collection Creation Script**:
```bash
# Dry run first
node backend/scripts/create-v3-collections.js --dry-run

# Create collections
node backend/scripts/create-v3-collections.js
```

**What it does**:
- Creates placeholder documents in `user_credits_v3`
- Creates placeholder documents in `subscriptions_v3`
- Creates placeholder documents in `credit_ledger_v3`
- Ensures collections exist in Firestore

### Step 3: Run Migration

**Dry Run (Validation)**:
```bash
node backend/scripts/migrate-to-v3.js --dry-run
```

**Migrate All Users**:
```bash
node backend/scripts/migrate-to-v3.js
```

**Migrate Specific User**:
```bash
node backend/scripts/migrate-to-v3.js --user-id=USER_ID
```

**Migration Process**:
1. Reads all users from `user_credits` (V2)
2. For each user:
   - Reads `user_credits` document
   - Reads `subscriptions` document (if exists)
   - Reads `users` document (for plan fallback)
   - Builds V3 structure:
     - Migrates balances (paid, free, bonus)
     - Migrates subscription data (priority: subscriptions > user_credits.subscription > users.plan)
     - Sets permissions based on subscription
     - Adds migration metadata
   - Saves to `user_credits_v3`
   - Archives to `subscriptions_v3`
3. Reports migration statistics

**Migration Output**:
```
🚀 Starting V2 to V3 Migration
================================

📦 Migrating user: USER_ID
✅ Migrated user USER_ID (subscription source: subscriptions_collection)
   Subscription: pro / active
   Credits: paid=0, free=1, bonus=0

📊 Migration Summary
==================================================
Total users: 100
✅ Migrated: 95
⏭️  Skipped: 3
❌ Errors: 2
```

### Step 4: Validate Migration

**Run Validation Script**:
```bash
# Validate all users
node backend/scripts/validate-v3-migration.js

# Validate specific user
node backend/scripts/validate-v3-migration.js --user-id=USER_ID
```

**Validation Checks**:
- Credit balances match between V2 and V3
- Subscription status matches
- Permissions match
- Data integrity

**Validation Output**:
```
📊 Validation Summary
==================================================
Total users: 95
✅ Valid: 92
⚠️  Warnings: 2
❌ Errors: 1
```

### Step 5: Test System

**Run Test Script**:
```bash
node backend/scripts/test-v3-system.js --user-id=USER_ID
```

**Tests Performed**:
- Get user credits
- Get available credits
- Consume credit
- Grant credits
- Get ledger
- Subscription management

### Step 6: Enable Frontend (Optional)

**Enable V3 in Frontend**:
```javascript
// In browser console or localStorage
localStorage.setItem('credits_use_v3', 'true');
```

**Or**: Server can default to V3 if `CREDITS_V3_ENABLED=true`

### Step 7: Monitor

**Check Logs**:
- Monitor server logs for V3 operations
- Check for any errors or warnings
- Verify webhook handlers are syncing to V3

**Admin Dashboard**:
- Check user details show V3 badge
- Verify raw data shows V3 collections
- Test copy button functionality

---

## Admin Dashboard Changes

### New Features

#### 1. V3 Data Source Badges

**Location**: User Details Modal → Credits & Usage section

**Display**:
- **V3 Badge** (green): Data from `user_credits_v3`
- **V2 Badge** (gray): Data from V2 system (fallback)

**Code**:
```javascript
${analytics.rawData?.user_credits_v3?.exists !== false ? 
  '<span class="data-source-badge v3">V3</span>' : 
  '<span class="data-source-badge v2">V2</span>'
}
```

#### 2. V3 Collections in Raw Data

**Location**: User Details Modal → Raw Data (Debug) section

**Collections Displayed**:
- `users` Collection
- `user_credits_v3` Collection (NEW)
- `subscriptions_v3` Collection (NEW)

**Format**: Expandable `<details>` sections with JSON preview

#### 3. Copy All Data Button

**Location**: 
- User Details Modal → Raw Data section (top right)
- User Details Window → Raw Data section (top right)

**Functionality**:
- Copies all raw data (users, user_credits_v3, subscriptions_v3) to clipboard
- Shows success feedback ("Copied!" with checkmark)
- JSON formatted with 2-space indentation

**Implementation**:
```javascript
setupCopyButton() {
  const copyBtn = this.modal?.querySelector('#copy-raw-data-btn');
  copyBtn.addEventListener('click', () => {
    const rawData = {
      users: analytics.rawData?.users || {},
      user_credits_v3: analytics.rawData?.user_credits_v3 || {},
      subscriptions_v3: analytics.rawData?.subscriptions_v3 || {}
    };
    const jsonString = JSON.stringify(rawData, null, 2);
    navigator.clipboard.writeText(jsonString);
  });
}
```

#### 4. Data Loading from V3

**DataManager Changes**:
- Loads credits from `user_credits_v3` instead of `user_credits`
- Handles permission errors gracefully
- Logs V3 loading status

**FirebaseService Changes**:
- Collection constants updated to V3:
  - `USER_CREDITS: "user_credits_v3"`
  - `SUBSCRIPTIONS: "subscriptions_v3"`
  - `CREDITS_TRANSACTIONS: "credit_ledger_v3"`

#### 5. User Details Window

**New Window Features**:
- Opens in new browser window
- Shows complete user data
- Includes V3 collections
- Copy button for all data
- Formatted JSON display

**Access**: Click "View Full Details" button in user row

---

## Frontend Changes

### Paywall Integration

**File**: `assets/js/paywall.js`

**Changes**:
1. **V3 Endpoint Support**:
   ```javascript
   const useV3 = localStorage.getItem('credits_use_v3') === 'true';
   const creditsEndpoint = useV3 ? '/api/v3/credits' : '/api/v2/credits';
   ```

2. **New Response Format**:
   ```javascript
   {
     unlimited: boolean,
     total: number | null,
     breakdown: {
       paid: number,
       free: number,
       bonus: number
     },
     subscription: {
       type: 'none' | 'pro',
       status: string,
       // ... more fields
     },
     permissions: {
       canEdit: boolean,
       canCreateUnlimited: boolean
     }
   }
   ```

3. **Unlimited Subscription Handling**:
   ```javascript
   if (unlimited) {
     return {
       hasAccess: true,
       entitlements: { unlimited: true },
       paywallData: null
     };
   }
   ```

### Credits Config

**File**: `assets/js/credits-config.js`

**Current State**: Still points to V2 endpoint
```javascript
apiBasePath: '/api/v2/credits',
```

**Note**: This is overridden by `paywall.js` localStorage check

---

## API Changes

### New Endpoints

#### `GET /api/v3/credits`

**Purpose**: Get user credits and subscription info

**Authentication**: Firebase ID token required

**Response**:
```json
{
  "success": true,
  "unlimited": false,
  "total": 5,
  "breakdown": {
    "paid": 3,
    "free": 1,
    "bonus": 1
  },
  "subscription": {
    "type": "none",
    "status": "none",
    "expiresAt": null
  },
  "permissions": {
    "canEdit": false,
    "canCreateUnlimited": false
  }
}
```

#### `POST /api/v3/credits/consume`

**Purpose**: Consume credit when creating spec

**Authentication**: Firebase ID token required

**Request Body**:
```json
{
  "specId": "spec_123",
  "priority": ["free", "bonus", "paid"]
}
```

**Response**:
```json
{
  "success": true,
  "remaining": 4,
  "creditType": "free",
  "unlimited": false,
  "transactionId": "consume_spec_123_user_456"
}
```

#### `POST /api/v3/credits/grant`

**Purpose**: Grant credits to user (admin only)

**Authentication**: Admin required

**Request Body**:
```json
{
  "userId": "user_123",
  "amount": 10,
  "source": "admin",
  "metadata": {
    "creditType": "paid",
    "reason": "Customer support"
  }
}
```

#### `POST /api/v3/credits/refund`

**Purpose**: Refund credits to user

**Authentication**: Firebase ID token (own credits) or admin (any user)

**Request Body**:
```json
{
  "userId": "user_123",
  "amount": 1,
  "reason": "Spec creation failed",
  "originalTransactionId": "consume_spec_123_user_456"
}
```

#### `GET /api/v3/credits/ledger`

**Purpose**: Get transaction ledger

**Authentication**: Firebase ID token (own ledger) or admin (any user)

**Query Parameters**:
- `userId` (optional, admin only)
- `limit` (default: 50, max: 100)
- `offset` (default: 0)
- `type` (optional: 'consume' | 'grant' | 'refund')
- `creditType` (optional: 'paid' | 'free' | 'bonus')

**Response**:
```json
{
  "success": true,
  "transactions": [
    {
      "id": "consume_spec_123_user_456",
      "userId": "user_456",
      "type": "consume",
      "amount": 1,
      "creditType": "free",
      "source": {
        "type": "spec_creation",
        "specId": "spec_123"
      },
      "balanceAfter": {
        "paid": 3,
        "free": 0,
        "bonus": 1
      },
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 1,
  "limit": 50,
  "hasMore": false
}
```

#### `GET /api/v3/credits/history`

**Purpose**: Get credit history summary

**Authentication**: Firebase ID token required

**Response**:
```json
{
  "success": true,
  "summary": {
    "current": {
      "unlimited": false,
      "total": 5,
      "breakdown": {
        "paid": 3,
        "free": 1,
        "bonus": 1
      }
    },
    "totalGranted": 10,
    "totalConsumed": 5,
    "totalRefunded": 0
  },
  "recentTransactions": [...]
}
```

---

## Rollback Procedures

### Option 1: Disable V3 (Keep Data)

**Steps**:
1. **Set Environment Variable**:
   ```bash
   CREDITS_V3_ENABLED=false
   ```

2. **Restart Server**: V3 routes will be unmounted

3. **Remove Frontend Flag** (if set):
   ```javascript
   localStorage.removeItem('credits_use_v3');
   ```

4. **Result**: System returns to V2 only, V3 data preserved

### Option 2: Complete Rollback (Remove V3 Data)

**⚠️ WARNING**: This will delete all V3 data!

**Steps**:
1. **Disable V3** (as above)

2. **Delete V3 Collections** (if needed):
   ```bash
   # Use Firebase Console or Admin SDK
   # Delete all documents in:
   # - user_credits_v3
   # - subscriptions_v3
   # - credit_ledger_v3
   ```

3. **Restore from V2**: V2 data remains intact

### Option 3: Partial Rollback (Specific Users)

**Steps**:
1. Identify users with issues
2. Re-migrate specific users:
   ```bash
   node backend/scripts/migrate-to-v3.js --user-id=USER_ID
   ```
3. Or restore from V2 data manually

### Rollback Checklist

- [ ] Set `CREDITS_V3_ENABLED=false`
- [ ] Restart server
- [ ] Remove frontend localStorage flag
- [ ] Verify V2 endpoints working
- [ ] Check user credits in V2
- [ ] Monitor for errors
- [ ] (Optional) Delete V3 collections if complete rollback

---

## Testing & Validation

### Pre-Migration Testing

1. **Test V3 System**:
   ```bash
   node backend/scripts/test-v3-system.js --user-id=TEST_USER_ID
   ```

2. **Validate Collections Exist**:
   ```bash
   node backend/scripts/create-v3-collections.js --dry-run
   ```

### Post-Migration Testing

1. **Validate Migration**:
   ```bash
   node backend/scripts/validate-v3-migration.js
   ```

2. **Test API Endpoints**:
   ```bash
   # Get credits
   curl -H "Authorization: Bearer TOKEN" https://api.example.com/api/v3/credits
   
   # Consume credit
   curl -X POST -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"specId":"test_spec"}' \
     https://api.example.com/api/v3/credits/consume
   ```

3. **Test Frontend**:
   - Enable V3: `localStorage.setItem('credits_use_v3', 'true')`
   - Create spec (should consume credit)
   - Check admin dashboard (should show V3 badge)
   - Test copy button

4. **Test Admin Dashboard**:
   - Open user details
   - Verify V3 badge appears
   - Check raw data shows V3 collections
   - Test copy button
   - Verify data matches V2

### Validation Checklist

- [ ] All users migrated successfully
- [ ] Credit balances match V2
- [ ] Subscription status matches V2
- [ ] Permissions correct
- [ ] API endpoints working
- [ ] Frontend integration working
- [ ] Admin dashboard shows V3 data
- [ ] Copy button functional
- [ ] Webhooks syncing to V3
- [ ] No errors in logs

---

## Migration Statistics

### Expected Migration Results

**Typical Distribution**:
- **Migrated**: ~95% of users
- **Skipped**: ~3% (no credits document)
- **Errors**: ~2% (data issues)

**Common Issues**:
1. Missing `user_credits` document → Skipped
2. Invalid subscription data → Error (needs manual fix)
3. Missing `users.plan` → Subscription may default to 'none'

### Post-Migration Actions

1. **Review Errors**: Fix any migration errors manually
2. **Validate Critical Users**: Check Pro users migrated correctly
3. **Monitor**: Watch for any issues in first 24 hours
4. **Gradual Rollout**: Enable V3 for subset of users first (if needed)

---

## Troubleshooting

### Issue: V3 Routes Not Mounting

**Symptoms**: `/api/v3/credits` returns 404

**Solutions**:
1. Check `CREDITS_V3_ENABLED=true` in environment
2. Restart server
3. Check server logs for mount errors

### Issue: Migration Fails

**Symptoms**: Migration script errors

**Solutions**:
1. Check Firestore permissions
2. Verify collections exist
3. Check user data format
4. Run with `--user-id` for specific user debugging

### Issue: Frontend Not Using V3

**Symptoms**: Still calling `/api/v2/credits`

**Solutions**:
1. Set `localStorage.setItem('credits_use_v3', 'true')`
2. Check server has `CREDITS_V3_ENABLED=true`
3. Clear browser cache

### Issue: Admin Dashboard Shows V2 Badge

**Symptoms**: V2 badge instead of V3

**Solutions**:
1. Verify user has `user_credits_v3` document
2. Check `user-analytics-service.js` is reading V3
3. Check Firestore permissions for V3 collections

### Issue: Copy Button Not Working

**Symptoms**: Copy button doesn't copy or shows error

**Solutions**:
1. Check browser clipboard permissions
2. Verify `navigator.clipboard` is available
3. Check console for errors

---

## Additional Notes

### Data Preservation

- **V2 Data**: Never deleted, remains as backup
- **V3 Data**: New system, can be recreated from V2 if needed
- **Migration**: One-way (V2 → V3), but V2 remains functional

### Performance Considerations

- **V3 Queries**: Single collection query (faster than V2)
- **Ledger**: Indexed for efficient queries
- **Subscriptions**: Embedded in credits document (no join needed)

### Security

- **Authentication**: Firebase ID tokens required
- **Authorization**: Admin checks for grant operations
- **Idempotency**: Prevents duplicate operations
- **Transactions**: Atomic operations prevent race conditions

### Future Enhancements

- [ ] Migrate to V3-only mode (remove V2)
- [ ] Add ledger analytics dashboard
- [ ] Implement credit expiration
- [ ] Add credit transfer between users
- [ ] Subscription upgrade/downgrade flows

---

## Conclusion

This migration guide provides complete documentation for the Credits System V3 migration. All changes are documented, migration procedures are outlined, and rollback options are available.

**Key Points**:
- V3 runs in parallel with V2 (safe migration)
- All data preserved in both systems
- Admin dashboard fully supports V3
- Complete rollback procedures available
- Comprehensive testing and validation tools

For questions or issues, refer to the troubleshooting section or check server logs.

---

**Document Version**: 1.0  
**Last Updated**: [Date]  
**Maintained By**: Development Team

