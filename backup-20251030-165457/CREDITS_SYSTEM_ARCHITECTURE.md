# Credits System Architecture - Specifys.AI

## Overview

The Credits System manages user entitlements, subscription tiers, and access control for specification generation on Specifys.AI.

**Last Updated:** 2025-10-29  
**Version:** 2.0

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [User Types & Hierarchy](#user-types--hierarchy)
3. [Data Model](#data-model)
4. [Core Components](#core-components)
5. [API Endpoints](#api-endpoints)
6. [Credit Consumption Flow](#credit-consumption-flow)
7. [Preserved Credits Logic](#preserved-credits-logic)
8. [Frontend Integration](#frontend-integration)
9. [Common Issues & Solutions](#common-issues--solutions)
10. [Testing](#testing)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                         │
│  (index.html, profile.html, pricing.html, etc.)            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Frontend Components                        │
│  • credits-display.js (UI Component)                        │
│  • entitlements-cache.js (Centralized Cache)               │
│  • config.js (API Configuration)                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend API                              │
│  • /api/specs/entitlements (GET)                           │
│  • /api/specs/create (POST)                                │
│  • /api/health/credits (GET)                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Entitlement Service Layer                      │
│  • checkUserCanCreateSpec()                                │
│  • consumeSpecCredit()                                     │
│  • grantCredits()                                          │
│  • enableProSubscription()                                 │
│  • revokeProSubscription()                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Firebase Firestore                         │
│  • users (collection)                                       │
│  • entitlements (collection)                                │
│  • subscriptions (collection)                               │
│  • purchases (collection)                                   │
│  • specs (collection)                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│               External Services                             │
│  • Lemon Squeezy (Payments & Subscriptions)               │
│  • Firebase Authentication                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## User Types & Hierarchy

The system implements a **hierarchical credit system** with the following priority:

### Priority Order (Highest to Lowest):

1. **Pro Users** (Unlimited Access)
2. **Credit Users** (Purchased Credits)
3. **Free Users** (1 Free Specification)

### User Type Details:

#### 1. Pro User (⭐)
- **Entitlements:**
  - `unlimited: true`
  - `can_edit: true`
  - Infinite spec creation
  - Edit all specifications
- **Plans:**
  - Pro Monthly: $29.90/month
  - Pro Yearly: $299.90/year
- **Display:** Shows "pro" in credits circle

#### 2. Credit User (💰)
- **Entitlements:**
  - `spec_credits: > 0`
  - `unlimited: false`
  - `can_edit: false`
- **Products:**
  - Single Spec: $4.90 (1 credit)
  - 3-Pack: $9.90 (3 credits)
- **Display:** Shows number (e.g., "3") in credits circle

#### 3. Free User (🆓)
- **Entitlements:**
  - `free_specs_remaining: 1` (default)
  - `spec_credits: 0`
  - `unlimited: false`
- **Display:** Shows "1" in credits circle

#### 4. Depleted User (❌)
- **Entitlements:**
  - `free_specs_remaining: 0`
  - `spec_credits: 0`
  - `unlimited: false`
- **Display:** Shows "0" (red) in credits circle
- **Action:** Redirected to pricing page

---

## Data Model

### Firestore Collections:

#### 1. `users/{userId}`
```javascript
{
  email: string,
  displayName: string,
  plan: string,              // 'free' | 'pro'
  free_specs_remaining: number,  // Default: 1
  lemon_customer_id: string | null,
  last_entitlement_sync_at: Timestamp,
  createdAt: string,
  lastActive: string
}
```

#### 2. `entitlements/{userId}`
```javascript
{
  userId: string,
  spec_credits: number,           // Purchased credits
  preserved_credits: number,      // Credits saved during Pro subscription
  unlimited: boolean,             // Pro subscription flag
  can_edit: boolean,              // Edit permission flag
  updated_at: Timestamp
}
```

#### 3. `subscriptions/{userId}`
```javascript
{
  userId: string,
  lemon_subscription_id: string,
  product_id: string,
  variant_id: string,
  status: string,                 // 'active' | 'cancelled'
  current_period_end: Timestamp,
  cancel_at_period_end: boolean,
  updated_at: Timestamp
}
```

#### 4. `purchases/{purchaseId}`
```javascript
{
  userId: string,
  lemon_order_id: string,
  product_id: string,
  variant_id: string,
  credits_granted: number,
  credits_used: number,
  total_amount_cents: number,
  currency: string,
  status: string,                 // 'completed' | 'refunded'
  purchased_at: Timestamp
}
```

---

## Core Components

### Backend

#### `entitlement-service.js`
Central service managing all credit-related operations.

**Key Functions:**
- `checkUserCanCreateSpec(userId)` - Validates if user can create a spec
- `consumeSpecCredit(userId)` - Consumes 1 credit (hierarchical)
- `refundSpecCredit(userId)` - Refunds 1 credit on error
- `grantCredits(userId, amount, orderId, variantId)` - Adds purchased credits
- `enableProSubscription(userId, subId, periodEnd)` - Upgrades to Pro
- `revokeProSubscription(userId)` - Downgrades from Pro
- `getUserEntitlements(userId)` - Fetches user entitlements

#### `spec-routes.js`
Handles specification-related API routes.

**Routes:**
- `GET /api/specs/entitlements` - Returns user entitlements
- `POST /api/specs/create` - Creates new specification (consumes credit)

#### `health-routes.js`
Monitoring and health check endpoints.

**Routes:**
- `GET /api/health/credits` - Credits system statistics
- `GET /api/health/database` - Database connectivity check

### Frontend

#### `credits-display.js`
Manages the credits circle in the header.

**Features:**
- Real-time credit display
- Auto-updates every 15 seconds
- Loading state animation
- Click-to-show details modal

#### `entitlements-cache.js`
Centralized caching layer for entitlements.

**Features:**
- 10-second cache duration
- Prevents duplicate API calls
- Listener subscription pattern
- Force refresh capability

#### `config.js`
API configuration and environment detection.

**Environments:**
- Development: `http://localhost:3002`
- Production: `https://api.specifys.ai`

---

## API Endpoints

### GET /api/specs/entitlements

**Description:** Returns user's entitlements and credits information.

**Authentication:** Required (Firebase JWT)

**Response:**
```json
{
  "success": true,
  "user": {
    "email": "user@example.com",
    "plan": "pro",
    "free_specs_remaining": 0
  },
  "entitlements": {
    "spec_credits": 0,
    "preserved_credits": 3,
    "unlimited": true,
    "can_edit": true
  }
}
```

### POST /api/specs/create

**Description:** Creates a new specification (consumes 1 credit).

**Authentication:** Required (Firebase JWT)

**Request Body:**
```json
{
  "title": "My App Specification",
  "description": "...",
  "mode": "comprehensive"
}
```

**Response:**
```json
{
  "success": true,
  "specId": "abc123xyz",
  "creditsRemaining": 5
}
```

### GET /api/health/credits

**Description:** Returns credits system health and statistics.

**Authentication:** Not required

**Response:**
```json
{
  "status": "healthy",
  "stats": {
    "totalUsers": 1000,
    "proUsers": 50,
    "creditUsers": 200,
    "freeUsers": 750,
    "activeSubscriptions": 45
  },
  "percentages": {
    "pro": "5.00%",
    "credit": "20.00%",
    "free": "75.00%"
  }
}
```

---

## Credit Consumption Flow

### Hierarchical Credit Consumption:

```
┌──────────────────────┐
│ User Requests Spec   │
└──────────────────────┘
           ↓
┌──────────────────────┐
│ Check Entitlements   │
└──────────────────────┘
           ↓
    ┌──────────┐
    │ Pro User?│
    └──────────┘
         ↓ Yes
┌──────────────────────┐
│ Allow (no cost)      │────→ Success
└──────────────────────┘
         ↓ No
    ┌──────────┐
    │ Credits? │
    └──────────┘
         ↓ Yes
┌──────────────────────┐
│ Consume 1 Credit     │────→ Success
└──────────────────────┘
         ↓ No
    ┌──────────┐
    │ Free Spec│
    └──────────┘
         ↓ Yes
┌──────────────────────┐
│ Consume Free Spec    │────→ Success
└──────────────────────┘
         ↓ No
┌──────────────────────┐
│ Deny (No Credits)    │────→ Redirect to Pricing
└──────────────────────┘
```

### Code Implementation:

```javascript
async function checkUserCanCreateSpec(userId) {
    // 1. Check Pro (unlimited)
    if (entitlements.unlimited) {
        return { canCreate: true, creditsRemaining: 'unlimited' };
    }
    
    // 2. Check purchased credits
    if (entitlements.spec_credits > 0) {
        return { canCreate: true, creditsRemaining: entitlements.spec_credits };
    }
    
    // 3. Check free specs
    const freeSpecs = userData.free_specs_remaining || 1;
    if (freeSpecs > 0) {
        return { canCreate: true, creditsRemaining: freeSpecs };
    }
    
    // 4. No credits
    return { canCreate: false, creditsRemaining: 0 };
}
```

---

## Preserved Credits Logic

### Problem
When a user with purchased credits upgrades to Pro, what happens to their credits?

### Solution
**Preserved Credits System** - Credits are saved and restored upon downgrade.

### Flow:

#### Upgrade to Pro:
1. User has 5 purchased credits
2. User subscribes to Pro
3. System:
   - Sets `spec_credits: 0`
   - Sets `preserved_credits: 5`
   - Sets `unlimited: true`
4. User sees "pro" + "(5 credits preserved)"

#### During Pro:
- User creates unlimited specs
- Preserved credits remain untouched
- `spec_credits` stays at 0

#### Downgrade from Pro:
1. User cancels Pro subscription
2. System:
   - Sets `unlimited: false`
   - Sets `spec_credits: 5` (restored from preserved)
   - Sets `preserved_credits: 0`
3. User can now use their 5 credits

### Code Implementation:

```javascript
// enableProSubscription()
const preservedCredits = entitlementsDoc.data().spec_credits || 0;
batch.set(entitlementsDocRef, {
    unlimited: true,
    can_edit: true,
    spec_credits: 0,
    preserved_credits: preservedCredits,  // Save for later
    ...
});

// revokeProSubscription()
const preservedCredits = entitlementsDoc.data().preserved_credits || 0;
batch.update(entitlementsDocRef, {
    unlimited: false,
    can_edit: false,
    spec_credits: preservedCredits,  // Restore credits
    preserved_credits: 0,
    ...
});
```

---

## Frontend Integration

### Loading Credits Display:

```html
<!-- 1. Load config first -->
<script src="/assets/js/config.js"></script>

<!-- 2. Load cache -->
<script src="/assets/js/entitlements-cache.js"></script>

<!-- 3. Load display component -->
<script src="/assets/js/credits-display.js"></script>
```

### Displaying Credits:

```javascript
// In your page script
window.creditsDisplayManager.init();

// Subscribe to updates
window.entitlementsCache.subscribe((data) => {
    console.log('Credits updated:', data);
});
```

### Forcing Refresh (after purchase):

```javascript
// After successful payment
await window.entitlementsCache.refresh();
```

---

## Common Issues & Solutions

### Issue 1: User sees "0" instead of "pro"

**Symptoms:**
- User has Pro subscription
- Credits circle shows "0" or "1"
- Personal Info shows Plan: PRO

**Root Cause:**
- `entitlements.unlimited` is not set to `true` in Firestore

**Solution:**
```bash
# Check user status
npm run check-user YOUR_USER_ID

# Fix Pro user
npm run fix-pro-user YOUR_USER_ID
```

---

### Issue 2: API calls to wrong port (3001 vs 3002)

**Symptoms:**
- Console errors: `ERR_CONNECTION_REFUSED`
- Failed to fetch entitlements

**Root Cause:**
- Page not loading `config.js` before making API calls

**Solution:**
Add to `<head>` of affected pages:
```html
<script src="/assets/js/config.js"></script>
```

---

### Issue 3: Credits not updating after purchase

**Symptoms:**
- User purchased credits
- Credits circle doesn't update

**Root Cause:**
- Cache not invalidated
- `grantCredits()` function not called by webhook

**Solution:**
1. Check Lemon Squeezy webhooks are configured
2. Check backend logs: `backend/server.log`
3. Force refresh: `window.entitlementsCache.refresh()`

---

### Issue 4: Preserved credits not showing

**Symptoms:**
- Pro user doesn't see "(X credits preserved)"

**Root Cause:**
- Frontend not displaying `preserved_credits` field

**Solution:**
Check `pages/profile.html` line 2929 - should display preserved credits

---

## Testing

### Automated Tests

Run full test suite:
```bash
cd backend/server
npm run test-credits
```

**Tests include:**
1. New user creation
2. Purchase credits
3. Pro upgrade (with preserved credits)
4. Pro downgrade (restore credits)
5. Consume credit (hierarchy)
6. Entitlements API

### Manual Testing Checklist

✅ New user sees 1 free credit  
✅ Purchase 1 credit → shows "1"  
✅ Purchase 3 credits → shows "3"  
✅ Pro upgrade → shows "pro"  
✅ Pro with preserved credits → shows "(X credits preserved)"  
✅ Pro downgrade → restored credits show correctly  
✅ Consume credit → number decreases  
✅ Depleted user → can't create spec  
✅ Page refresh → data persists  
✅ Multiple tabs → data syncs  

### Check Specific User:

```bash
npm run check-user USER_ID
```

### Fix Pro User (if broken):

```bash
npm run fix-pro-user USER_ID
```

---

## Version History

**v2.0 (2025-10-29)**
- Fixed critical `batch.update` bug in `enableProSubscription` and `grantCredits`
- Added preserved credits logic
- Implemented entitlements cache layer
- Reduced polling from 30s to 15s
- Added loading spinner to credits display
- Enhanced error logging
- Created health check endpoints

**v1.0 (Initial Release)**
- Basic credits system
- Pro subscriptions
- Lemon Squeezy integration

---

## Support & Troubleshooting

For issues, check:
1. Backend logs: `backend/server.log`
2. Browser console for frontend errors
3. Firebase Console for data verification
4. Lemon Squeezy Dashboard for payment webhooks

**Health Check:**
- `/api/health/credits` - System statistics
- `/api/health/database` - Database connectivity

**Admin Tools:**
- `npm run check-user` - Inspect user
- `npm run fix-pro-user` - Fix Pro subscription
- `npm run test-credits` - Run tests

---

**End of Documentation**

