# תיעוד מערכת התשלום Lemon Squeezy

## סקירה כללית

מערכת התשלום משתמשת ב-Lemon Squeezy ליצירת checkout, עיבוד תשלומים, וניהול רכישות דרך webhooks. המערכת כוללת:
- **Frontend**: דף בדיקה (`test-system.html`) עם כפתור רכישה ומונה
- **Backend**: שרת Express.js ב-Render שמטפל ביצירת checkout וקבלת webhooks
- **Database**: Firebase Firestore לאחסון רכישות בדיקה

---

## דרישות מקדימות

### 1. חשבון Lemon Squeezy

1. היכנס לחשבון Lemon Squeezy: https://app.lemonsqueezy.com
2. צור Store (אם עדיין לא קיים)
3. צור Product ו-Variant
4. העתק את הנתונים הבאים:
   - **Store ID** - ניתן למצוא ב-URL או ב-Settings של ה-Store
   - **Variant ID** - ניתן למצוא ב-Products > Variants
   - **API Key** - Settings > API > Create New API Key

### 2. חשבון Firebase

1. ודא שיש Firebase Project פעיל
2. ודא שיש Service Account Key
3. העתק את ה-Project ID

### 3. חשבון Render

1. היכנס לחשבון Render: https://render.com
2. צור Web Service חדש (אם עדיין לא קיים)

---

## שלבי הגדרה - Backend (Render)

### שלב 1: הוספת משתני סביבה ב-Render

היכנס ל-Render Dashboard > ה-Service שלך > Environment > Add Environment Variable

הוסף את המשתנים הבאים:

\`\`\`bash
# Lemon Squeezy Configuration
LEMON_SQUEEZY_API_KEY=your_api_key_here
LEMON_SQUEEZY_STORE_ID=your_store_id_here
LEMON_SQUEEZY_VARIANT_ID=your_variant_id_here
LEMON_WEBHOOK_SECRET=specifys_ai_secret_2025

# Firebase Configuration
FIREBASE_PROJECT_ID=your_project_id_here
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}

# Frontend URL (להגדרת redirect אחרי רכישה)
FRONTEND_URL=https://specifys-ai.com
\`\`\`

**חשוב:**
- \`LEMON_SQUEEZY_API_KEY\` - המפתח מ-Lemon Squeezy Settings > API
- \`LEMON_SQUEEZY_STORE_ID\` - מזהה ה-Store (מספר)
- \`LEMON_SQUEEZY_VARIANT_ID\` - מזהה ה-Variant (מספר, לדוגמה: 1073211)
- \`LEMON_WEBHOOK_SECRET\` - מחרוזת סודית לאימות webhooks (ניתן לשנות)
- \`FIREBASE_SERVICE_ACCOUNT_KEY\` - JSON מלא של Service Account Key מ-Firebase

### שלב 2: בדיקת Deploy

1. ודא שהקוד נדחף ל-Git
2. Render יתחיל Deploy אוטומטי
3. בדוק את ה-Logs ב-Render כדי לוודא שהשרת עולה בהצלחה
4. ודא שהשרת זמין ב: \`https://your-service.onrender.com\`

---

## שלבי הגדרה - Lemon Squeezy Webhook

### שלב 1: יצירת Webhook

1. היכנס ל-Lemon Squeezy Dashboard: https://app.lemonsqueezy.com
2. לך ל-Settings > Webhooks
3. לחץ על "Create Webhook"
4. הגדר את הפרטים הבאים:

\`\`\`
URL: https://your-service.onrender.com/api/lemon/webhook
Secret: specifys_ai_secret_2025  (אותו secret מה-Render)
Events: בחר "Order Created" (או כל האירועים שאתה צריך)
\`\`\`

5. שמור את ה-Webhook

### שלב 2: בדיקת Webhook

- לאחר יצירת Webhook, Lemon Squeezy ינסה לשלוח test event
- בדוק את ה-Logs ב-Render כדי לוודא שה-Webhook התקבל

---

## שלבי הגדרה - Firestore Rules

### עדכון Rules

1. ודא שיש את הקובץ \`backend/public/firestore.rules\`
2. ודא שהקובץ מכיל את ה-Rules הבאים:

\`\`\`
// Test purchases collection - for Lemon Squeezy test system
match /test_purchases/{purchaseId} {
  allow read: if true; // Anyone can read (for counter display)
  allow create, update, delete: if isAdmin(); // Only backend (via admin SDK) can write
}
\`\`\`

3. Deploy את ה-Rules:
\`\`\`bash
firebase deploy --only firestore:rules
\`\`\`

---

## מבנה הקבצים

### Backend Files

\`\`\`
backend/
├── server/
│   ├── lemon-routes.js          # API routes ל-checkout, webhook, counter
│   ├── lemon-webhook-utils.js   # פונקציות לאימות webhook ופרסור payload
│   └── lemon-credits-service.js # פונקציות לניהול רכישות ב-Firestore
├── server.js                     # קובץ השרת הראשי (מגדיר routes)
└── public/
    └── firestore.rules          # Firestore security rules
\`\`\`

### Frontend Files

\`\`\`
assets/
├── js/
│   └── test-system.js           # JavaScript לדף הבדיקה
├── css/
│   └── pages/
│       └── test-system.css      # CSS לדף הבדיקה
pages/
└── test-system.html             # דף HTML לבדיקת המערכת
\`\`\`

---

## Flow של תהליך הרכישה

### 1. משתמש לוחץ על "Buy Test Credit"

\`\`\`
Frontend (test-system.html)
  ↓
User clicks "Buy Test Credit" button
  ↓
JavaScript (test-system.js) calls handleBuyClick()
  ↓
Gets Firebase ID Token for authentication
  ↓
Sends POST request to: /api/lemon/checkout
\`\`\`

### 2. Backend יוצר Checkout

\`\`\`
Backend (lemon-routes.js)
  ↓
Verifies Firebase token
  ↓
Extracts user ID and email
  ↓
Creates checkout via Lemon Squeezy API:
  POST https://api.lemonsqueezy.com/v1/checkouts
  Body: {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          email: userEmail,
          custom: { user_id: userId }
        },
        test_mode: true,
        product_options: {
          redirect_url: "https://specifys-ai.com/pages/test-system.html?checkout=success"
        },
        checkout_options: {
          embed: true
        }
      },
      relationships: {
        store: { data: { type: "stores", id: storeId } },
        variant: { data: { type: "variants", id: variantId } }
      }
    }
  }
  ↓
Returns checkout URL to frontend
\`\`\`

### 3. Frontend פותח Checkout

\`\`\`
Frontend (test-system.js)
  ↓
Receives checkout URL
  ↓
Loads Lemon Squeezy SDK (https://assets.lemonsqueezy.com/lemon.js)
  ↓
Opens checkout overlay using:
  - createLemonSqueezyCheckout() (new API), OR
  - LemonSqueezy.Setup() + LemonSqueezy.Url.Open() (old API), OR
  - window.open() fallback (popup window)
  ↓
User completes payment in Lemon Squeezy overlay
\`\`\`

### 4. Lemon Squeezy שולח Webhook

\`\`\`
Lemon Squeezy
  ↓
After successful payment, sends webhook:
  POST https://your-service.onrender.com/api/lemon/webhook
  Headers:
    x-signature: sha256=...
  Body: JSON payload with order details
  ↓
Backend (lemon-routes.js)
  ↓
Verifies webhook signature (HMAC SHA256)
  ↓
Parses webhook payload (order_created event)
  ↓
Extracts:
  - orderId
  - userId (from custom data)
  - variantId
  - email
  ↓
Calls recordTestPurchase() to save to Firestore
\`\`\`

### 5. עדכון Firestore

\`\`\`
Backend (lemon-credits-service.js)
  ↓
recordTestPurchase(userId, orderId, variantId)
  ↓
Saves to Firestore collection: test_purchases
  Document structure:
  {
    userId: string,
    orderId: string,
    variantId: string,
    createdAt: timestamp,
    metadata: object
  }
\`\`\`

### 6. Frontend מעדכן את המונה

\`\`\`
Frontend (test-system.js)
  ↓
After checkout success:
  - Redirects to: /pages/test-system.html?checkout=success
  OR
  - Polls counter every 3 seconds
  ↓
GET /api/lemon/counter
  ↓
Backend queries Firestore:
  db.collection('test_purchases').count()
  ↓
Returns count to frontend
  ↓
Frontend updates counter display
\`\`\`

---

## API Endpoints

### POST /api/lemon/checkout

יצירת checkout חדש.

**Headers:**
\`\`\`
Authorization: Bearer <firebase_id_token>
Content-Type: application/json
\`\`\`

**Body:**
\`\`\`json
{
  "userId": "firebase_user_id",
  "email": "user@example.com"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "checkoutUrl": "https://checkout.lemonsqueezy.com/checkout/..."
}
\`\`\`

### POST /api/lemon/webhook

Endpoint לקבלת webhooks מ-Lemon Squeezy.

**Headers:**
\`\`\`
x-signature: sha256=...
Content-Type: application/json
\`\`\`

**Body:** JSON payload מ-Lemon Squeezy

**Response:**
\`\`\`json
{
  "success": true
}
\`\`\`

### GET /api/lemon/counter

קבלת מספר הרכישות הכולל.

**Response:**
\`\`\`json
{
  "success": true,
  "count": 5
}
\`\`\`

---

## בדיקות וטיפים

### בדיקת הגדרות

1. **בדוק משתני סביבה ב-Render:**
   \`\`\`bash
   # ודא שכל המשתנים מוגדרים
   LEMON_SQUEEZY_API_KEY ✓
   LEMON_SQUEEZY_STORE_ID ✓
   LEMON_SQUEEZY_VARIANT_ID ✓
   LEMON_WEBHOOK_SECRET ✓
   \`\`\`

2. **בדוק שה-Webhook מוגדר ב-Lemon Squeezy:**
   - URL נכון
   - Secret נכון
   - Events נבחרו

3. **בדוק שה-Store ID ו-Variant ID נכונים:**
   - Store ID: בדוק ב-URL או ב-Settings
   - Variant ID: בדוק ב-Products > Variants (לדוגמה: 1073211)

### Debug Mode

הדף \`test-system.html\` כולל מערכת debug logs:
- לחץ על "Show Logs" כדי לראות את כל ה-logs
- לחץ על "Copy Logs" כדי להעתיק את ה-logs
- ה-logs מציגים את כל השלבים של תהליך הרכישה

### בעיות נפוצות

1. **422 Unprocessable Entity:**
   - ודא ש-\`checkout_data\` הוא אובייקט (לא מערך)
   - ודא ש-\`checkout_options\` הוא אובייקט (לא מערך)
   - ודא ש-\`redirect_url\` נמצא ב-\`product_options\`, לא ב-\`checkout_options\`

2. **404 Variant Not Found:**
   - בדוק ש-\`LEMON_SQUEEZY_VARIANT_ID\` נכון
   - ודא שה-Variant קיים ב-Lemon Squeezy

3. **Webhook לא מגיע:**
   - בדוק שה-URL נכון ב-Lemon Squeezy
   - בדוק שה-Secret תואם
   - בדוק את ה-Logs ב-Render

4. **Counter לא מתעדכן:**
   - ודא שה-Webhook מתקבל
   - בדוק את ה-Logs ב-Render
   - בדוק שה-Firestore Rules נכונים

---

## מבנה הנתונים ב-Firestore

### Collection: \`test_purchases\`

\`\`\`
test_purchases/
  {purchaseId}/
    userId: string          # Firebase User ID
    orderId: string         # Lemon Squeezy Order ID
    variantId: string       # Lemon Squeezy Variant ID
    createdAt: timestamp    # זמן יצירת הרכישה
    metadata: object        # נתונים נוספים (אופציונלי)
\`\`\`

### Security Rules

\`\`\`javascript
match /test_purchases/{purchaseId} {
  allow read: if true;  // כל אחד יכול לקרוא (לצורך הצגת המונה)
  allow create, update, delete: if isAdmin();  // רק השרת (Admin SDK) יכול לכתוב
}
\`\`\`

---

## שינויים עתידיים

כאשר המערכת תהיה מוכנה לייצור, יש לבצע את השינויים הבאים:

1. **הסרת Test Mode:**
   - שנה \`test_mode: true\` ל-\`test_mode: false\` ב-\`lemon-routes.js\`

2. **שילוב עם מערכת הקרדיטים הקיימת:**
   - עדכן את \`recordTestPurchase\` כדי לעדכן את ה-\`entitlements\` collection
   - הוסף לוגיקה לניהול קרדיטים לפי variant ID

3. **הסרת דף הבדיקה:**
   - הסר את \`test-system.html\` או העבר אותו לדף admin בלבד

---

## תהליך הפיתוח והלמידות (Lessons Learned)

פרק זה מתאר את כל הבעיות שהיו, הניסיונות השונים, והפתרונות הסופיים שזוהו במהלך הפיתוח.

### בעיה #1: שגיאת 422 - Format של checkout_data ו-checkout_options

**השגיאה:**
```
422 Unprocessable Entity
"The {0} field must be an array."
Source: /data/attributes/checkout_data
Source: /data/attributes/checkout_options
```

**מה ניסינו:**
1. ניסיון ראשון: שלחנו `checkout_data` ו-`checkout_options` כאובייקטים (כמו בדוקומנטציה)
2. ניסיון שני: שינינו למערכים בגלל השגיאה

**הפתרון הסופי:**
לאחר בדיקת הדוקומנטציה, התברר שהדוקומנטציה צודקת - הם **צריכים להיות אובייקטים**. הבעיה הייתה ש-`redirect_url` היה ב-`checkout_options` במקום ב-`product_options`.

**הקונפיגורציה הנכונה:**
```javascript
{
  checkout_data: {
    email: userEmail,
    custom: { user_id: userId }
  },
  product_options: {
    redirect_url: successUrl  // ✅ נכון - ב-product_options
  },
  checkout_options: {
    embed: true  // ✅ נכון - אובייקט רגיל
  }
}
```

**למידה:** תמיד לבדוק את הדוקומנטציה בקפידה - לפעמים הבעיה היא במיקום השדה ולא בפורמט.

---

### בעיה #2: Lemon Squeezy SDK לא נטען / Setup method לא קיים

**השגיאה:**
```
Cannot read properties of undefined (reading 'Setup')
Lemon Squeezy SDK loaded but Setup method not available
```

**מה ניסינו:**
1. ניסיון ראשון: חיכינו ל-`window.LemonSqueezy.Setup`
2. ניסיון שני: בדקנו אם יש `window.createLemonSqueezy`
3. ניסיון שלישי: ניסינו כל השיטות הזמינות

**הפתרון הסופי:**
ה-SDK החדש של Lemon Squeezy משתמש ב-`createLemonSqueezy()` כדי ליצור את האובייקט. צריך:
1. לבדוק אם `window.createLemonSqueezy` קיים
2. לקרוא ל-`window.LemonSqueezy = window.createLemonSqueezy()`
3. לנסות מספר שיטות פתיחה:
   - `createLemonSqueezyCheckout()` (API חדש)
   - `LemonSqueezy.Setup()` + `LemonSqueezy.Url.Open()` (API ישן)
   - `window.open()` fallback (אם הכל נכשל)

**הקוד הסופי:**
```javascript
// Method 1: New API
if (typeof window.createLemonSqueezyCheckout === 'function') {
  window.createLemonSqueezyCheckout({
    url: checkoutUrl,
    onCheckoutSuccess: () => { /* ... */ }
  });
}
// Method 2: Old API
else if (window.LemonSqueezy?.Setup) {
  window.LemonSqueezy.Setup({ /* ... */ });
  window.LemonSqueezy.Url.Open(checkoutUrl);
}
// Method 3: Fallback
else {
  window.open(checkoutUrl, 'lemon-checkout', 'width=600,height=700');
}
```

**למידה:** צריך לתמוך בגרסאות שונות של ה-SDK ולספק fallbacks.

---

### בעיה #3: Redirect אחרי רכישה מוצלחת

**הבעיה:**
אחרי רכישה מוצלחת, המשתמש הועבר לדף של Lemon Squeezy (`https://app.lemonsqueezy.com/my-orders/...`) במקום לחזור לאתר.

**מה ניסינו:**
1. ניסיון ראשון: הוספנו `success_url` ב-`checkout_options` (לא קיים ב-API)
2. ניסיון שני: הוספנו `redirect_url` ב-`checkout_options` (מיקום שגוי)

**הפתרון הסופי:**
`redirect_url` צריך להיות ב-`product_options`, לא ב-`checkout_options`:

```javascript
product_options: {
  redirect_url: `${frontendUrl}/pages/test-system.html?checkout=success`
}
```

בנוסף, הוספנו בדיקה ב-Frontend לזיהוי `checkout=success` ב-URL:

```javascript
function checkCheckoutSuccess() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('checkout') === 'success') {
    showAlert('Purchase successful!');
    updateCounter();
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}
```

**למידה:** קרא את הדוקומנטציה בקפידה - שדות יכולים להיות במקומות שונים מהצפוי.

---

### בעיה #4: CORS Errors

**השגיאה:**
```
Access to fetch at 'https://specifys-ai.onrender.com/api/lemon/counter' 
from origin 'https://specifys-ai.com' has been blocked by CORS policy
```

**הפתרון:**
1. הוספנו את `https://specifys-ai.onrender.com` ל-`allowedOrigins`
2. הזזנו את ה-CORS middleware להיות **לפני** routes ו-rate limiting
3. הוספנו `Access-Control-Allow-Credentials: true`

**למידה:** CORS middleware חייב להיות **לפני** כל ה-routes, אחרת ה-headers לא נשלחים.

---

### בעיה #5: Rate Limiting של Lemon Routes

**השגיאה:**
```
GET /api/lemon/counter 429 (Too Many Requests)
```

**הפתרון:**
1. הוספנו בדיקה ב-rate limiter לדלג על `/lemon` routes
2. הזזנו את `lemonRoutes` להיות **לפני** ה-rate limiting middleware

**הקוד:**
```javascript
// Lemon routes BEFORE rate limiting
app.use('/api/lemon', lemonRoutes);

// Rate limiting AFTER lemon routes
app.use('/api/', (req, res, next) => {
  if (req.path.startsWith('/lemon')) {
    return next(); // Skip rate limiting for lemon routes
  }
  rateLimiters.general(req, res, next);
});
```

**למידה:** Routes שצריכים להיות פטורים מ-rate limiting חייבים להיות מוגדרים לפני ה-middleware.

---

### בעיה #6: Webhook Signature Verification

**הבעיה:**
ה-webhook צריך לקרוא את ה-raw body (לא parsed JSON) כדי לאמת את החתימה.

**הפתרון:**
1. הוספנו `express.raw({ type: 'application/json' })` רק ל-webhook route
2. הזזנו את `lemonRoutes` להיות **לפני** `express.json()` middleware

**הקוד:**
```javascript
// Lemon routes BEFORE express.json() (so webhook can access raw body)
app.use('/api/lemon', lemonRoutes);

// JSON parsing AFTER lemon routes
app.use(express.json());
```

**למידה:** Webhook signature verification דורש גישה ל-raw body לפני parsing.

---

### בעיה #7: Syntax Error ב-Render (entitlement-service)

**השגיאה:**
```
SyntaxError: Unexpected token ':' 
at /opt/render/project/src/backend/server/entitlement-service.js:197
```

**הסיבה:**
הקובץ `entitlement-service.js` נמחק מהמקומי אבל עדיין היה ב-Git והיה import ב-`user-management.js`.

**הפתרון:**
1. הסרנו את ה-import מה-`user-management.js`
2. דחפנו את השינוי ל-Git
3. מחקנו את הקובץ מה-Git history

**למידה:** תמיד לבדוק שיש consistency בין הקבצים המקומיים ל-Git.

---

### בעיה #8: Trust Proxy ב-Render

**השגיאה:**
```
ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false
```

**הפתרון:**
הוספנו `app.set('trust proxy', true);` בתחילת ה-server.

**למידה:** Render משתמש ב-reverse proxy, אז צריך להגדיר `trust proxy`.

---

### בעיה #9: fetch is not a function

**השגיאה:**
```
Failed to create checkout: fetch is not a function
```

**הפתרון:**
נוספה תמיכה ב-built-in `fetch` של Node.js 18+ עם fallback ל-`node-fetch`:

```javascript
let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  fetch = require('node-fetch');
}
```

**למידה:** Node.js 18+ כולל `fetch` מובנה, אבל צריך לתמוך גם בגרסאות ישנות.

---

### בעיה #10: Variant ID לא נמצא

**השגיאה:**
```
404 Not Found: The related resource does not exist.
Source: /data/relationships/variant
```

**הפתרון:**
1. שיפרנו את ה-error handling להציג הודעה ברורה
2. ביקשנו מהמשתמש לוודא שה-Variant ID נכון
3. המשתמש אישר שה-Variant ID הוא `1073211`

**למידה:** שיפור ה-error messages עוזר למצוא בעיות במהירות.

---

### בעיה #11: כפתור "Buy" לא מגיב

**הבעיה:**
לחיצה על הכפתור לא עשתה כלום.

**הפתרון:**
1. הוספנו debug logging מפורט
2. גילינו שהכפתור נכבה אבל ה-event listener לא היה מחובר נכון
3. תיקנו על ידי clone של הכפתור והסרת listeners ישנים

**למידה:** Debug logging הוא כלי חיוני לזיהוי בעיות ב-Frontend.

---

## סיכום הקונפיגורציה הסופית

### Backend (lemon-routes.js) - הפורמט הנכון:

```javascript
const checkoutData = {
  data: {
    type: 'checkouts',
    attributes: {
      checkout_data: {              // ✅ אובייקט (לא מערך)
        email: userEmail,
        custom: { user_id: userId }
      },
      test_mode: true,
      product_options: {            // ✅ redirect_url כאן
        redirect_url: `${frontendUrl}/pages/test-system.html?checkout=success`
      },
      checkout_options: {           // ✅ אובייקט (לא מערך)
        embed: true
      }
    },
    relationships: {
      store: {
        data: {
          type: 'stores',
          id: storeId.toString()    // ✅ string
        }
      },
      variant: {
        data: {
          type: 'variants',
          id: variantId.toString()  // ✅ string
        }
      }
    }
  }
};
```

### Frontend (test-system.js) - סדר הפעולות:

1. בדוק `checkout=success` ב-URL
2. טען Lemon Squeezy SDK
3. נסה לפתוח checkout ב-3 דרכים (חדש → ישן → fallback)
4. Polling למונה כל 3 שניות

### Middleware Order ב-server.js (חשוב מאוד!):

```javascript
// 1. Trust proxy (לפני הכל)
app.set('trust proxy', true);

// 2. Security headers
app.use(securityHeaders);

// 3. CORS (לפני routes)
app.use(corsMiddleware);

// 4. Lemon routes (לפני express.json ו-rate limiting)
app.use('/api/lemon', lemonRoutes);

// 5. Rate limiting (אחרי lemon routes)
app.use('/api/', rateLimiter);

// 6. JSON parsing (אחרי lemon routes)
app.use(express.json());

// 7. שאר ה-routes
app.use('/api/', otherRoutes);
```

---

## טיפים חשובים

1. **תמיד לבדוק את הדוקומנטציה** - לפעמים השדות במקומות שונים מהצפוי
2. **Middleware order חשוב מאוד** - CORS ו-raw body parsing לפני express.json()
3. **תמיד לספק fallbacks** - SDK יכול להיות בגרסאות שונות
4. **Debug logging עוזר** - הוסיפו logs מפורטים לכל שלב
5. **Webhooks דורשים raw body** - לא ניתן להשתמש ב-express.json() לפני signature verification
6. **Render משתמש ב-reverse proxy** - צריך `trust proxy: true`
7. **Rate limiting צריך לדלג על routes מסוימים** - הגדירו אותם לפני ה-middleware

---

## קישורים שימושיים

- **Lemon Squeezy API Documentation:** https://docs.lemonsqueezy.com/api
- **Create Checkout API:** https://docs.lemonsqueezy.com/api/checkouts/create-checkout
- **Checkout Overlay:** https://docs.lemonsqueezy.com/help/checkout/checkout-overlay
- **Webhooks:** https://docs.lemonsqueezy.com/api/webhooks
- **Render Dashboard:** https://dashboard.render.com
- **Firebase Console:** https://console.firebase.google.com

---

**עודכן לאחרונה:** 5 בנובמבר 2025
