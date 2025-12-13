# מערכת הקרדיטים הישנה - תיעוד מלא

## סקירה כללית

מערכת הקרדיטים הישנה השתמשה ב-3 מקורות נתונים נפרדים:
1. `entitlements` collection - קרדיטים שנרכשו ו-Pro subscription
2. `users` collection - קרדיט חינם (`free_specs_remaining`)
3. `credits_transactions` collection - היסטוריית פעולות

## מבנה הנתונים

### Collection: `entitlements`
**Document ID:** `userId`

```javascript
{
  userId: string,
  spec_credits: number,        // קרדיטים שנרכשו (paid credits)
  unlimited: boolean,          // Pro subscription
  can_edit: boolean,
  preserved_credits: number,   // קרדיטים שנשמרו כשעברו ל-Pro
  updated_at: timestamp
}
```

### Collection: `users`
**Document ID:** `userId`

**שדות קשורים לקרדיטים:**
```javascript
{
  free_specs_remaining: number,  // קרדיט חינם למשתמש חדש (1 או 0)
  plan: 'free' | 'pro'
}
```

### Collection: `credits_transactions`
**Document ID:** `transactionId`

```javascript
{
  userId: string,
  amount: number,              // חיובי ל-grant, שלילי ל-consume
  type: 'grant' | 'consume' | 'refund',
  source: 'admin' | 'lemon_squeezy' | 'free_trial' | 'unlimited',
  specId: string | null,
  orderId: string | null,
  transactionId: string,
  metadata: {
    previousCredits: number,
    remaining: number,
    creditType: 'paid' | 'free' | 'unlimited'
  },
  timestamp: timestamp,
  createdAt: timestamp
}
```

## API Endpoints

### Backend Routes

**`/api/credits/grant`** (POST)
- דורש: Admin authentication
- Body: `{ userId, amount, source, metadata }`
- פונקציה: `creditsService.grantCredits()`

**`/api/credits/refund`** (POST)
- דורש: Firebase authentication
- Body: `{ userId (optional), amount, reason, originalTransactionId }`
- פונקציה: `creditsService.refundCredit()`

**`/api/credits/transactions`** (GET)
- דורש: Firebase authentication
- Query: `{ userId (optional, admin only), limit }`
- מחזיר: רשימת transactions

**`/api/credits/entitlements`** (GET)
- דורש: Firebase authentication
- פונקציה: `creditsService.getEntitlements()`

**`/api/specs/entitlements`** (GET)
- דורש: Firebase authentication
- Note: Backward compatibility endpoint
- פונקציה: `creditsService.getEntitlements()`

**`/api/specs/consume-credit`** (POST)
- דורש: Firebase authentication
- Body: `{ specId }`
- פונקציה: `creditsService.consumeCredit()`

**`/api/admin/users/:userId/credits`** (POST)
- דורש: Admin authentication
- Body: `{ amount, reason }`
- פונקציה: `creditsService.grantCredits()`

## קבצים

### Backend
- `backend/server/credits-service.js` - שירות קרדיטים ראשי
- `backend/server/credits-routes.js` - API routes
- `backend/src/credits-service.ts` - TypeScript version (אם קיים)

### Frontend
- `assets/js/credits-display.js` - תצוגת קרדיטים ב-header
- `assets/js/entitlements-cache.js` - cache לקרדיטים
- `assets/js/credits-config.js` - הגדרות קרדיטים

## פונקציות מרכזיות

### `grantCredits(userId, amount, source, metadata)`
- מעדכן `entitlements.spec_credits` (increment)
- יוצר transaction ב-`credits_transactions`
- תומך ב-idempotency

### `consumeCredit(userId, specId)`
- סדר בדיקות:
  1. Unlimited (Pro subscription)
  2. Paid credits (`entitlements.spec_credits`)
  3. Free credits (`users.free_specs_remaining`)
- יוצר transaction ב-`credits_transactions`

### `refundCredit(userId, amount, reason, originalTransactionId)`
- מעדכן `entitlements.spec_credits` (increment)
- יוצר transaction ב-`credits_transactions`

### `getEntitlements(userId)`
- קורא `entitlements` document
- קורא `users` document
- מחזיר `{ entitlements, user }`

### `checkAccess(userId)`
- בודק אם למשתמש יש גישה ליצירת specs
- מחזיר `{ hasAccess, entitlements, paywallData }`

## בעיות ידועות

1. **מקורות אמת מרובים** - קרדיטים מפוזרים בין `entitlements` ו-`users`
2. **לוגיקה מורכבת** - סדר עדיפות לא ברור
3. **Cache מרובה** - localStorage + memory cache + Firestore listeners
4. **בעיות סנכרון** - `getEntitlements()` יוצר documents אם לא קיימים
5. **לוגיקה מורכבת לזיהוי משתמש חדש** - בדיקה של 5 דקות

## סדר עדיפות קרדיטים

1. `unlimited: true` → Pro subscription
2. `spec_credits > 0` → קרדיטים שנרכשו
3. `free_specs_remaining > 0` → קרדיט חינם

## מיגרציה

נתונים אלה יועתקו למערכת החדשה:
- `entitlements.spec_credits` → `user_credits.balances.paid`
- `users.free_specs_remaining` → `user_credits.balances.free`
- `entitlements.unlimited` → `user_credits.subscription.type`
- `credits_transactions` → `credit_ledger`
