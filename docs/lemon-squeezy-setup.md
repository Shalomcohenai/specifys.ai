# תיעוד מערכת התשלום Lemon Squeezy

## ✅ סטטוס: המערכת נבדקה ועובדת במלואה!

**תאריך בדיקה אחרונה:** 5 בנובמבר 2025  
**סטטוס:** ✅ כל הפונקציונליות עובדת - רכישות, webhooks, עדכון מונה, redirect

המערכת נבדקה בהצלחה עם 2 רכישות test מלאות. כל השלבים עובדים:
- יצירת checkout ✅
- עיבוד תשלום ✅
- קבלת webhooks ✅
- אימות חתימה ✅
- שמירה ב-Firestore ✅
- עדכון מונה בזמן אמת ✅

---

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
LEMON_WEBHOOK_SECRET=testpassword123

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
Secret: testpassword123  (אותו secret מה-Render)
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

## בעיה #12: Webhook Signature Format - שני פורמטים

**הבעיה:**
```
❌ Invalid webhook signature
```

**הסיבה:**
Lemon Squeezy יכול לשלוח את ה-signature בשני פורמטים:
1. `sha256=hexdigest` (פורמט מתועד)
2. `hexdigest` בלבד (פורמט בפועל שנשלח)

**הפתרון:**
עדכנו את `verifyWebhookSignature` לתמוך בשני הפורמטים:

```javascript
function verifyWebhookSignature(payload, signature, secret) {
  let receivedSignature;
  
  // תמיכה בשני פורמטים
  if (signature.includes('=')) {
    // פורמט: sha256=hexdigest
    const signatureParts = signature.split('=');
    if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') {
      return false;
    }
    receivedSignature = signatureParts[1];
  } else {
    // פורמט: hexdigest בלבד (זה מה שנשלח בפועל)
    receivedSignature = signature;
  }
  
  // חישוב HMAC SHA256
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const calculatedSignature = hmac.digest('hex');
  
  // השוואה עם constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(receivedSignature, 'hex'),
    Buffer.from(calculatedSignature, 'hex')
  );
}
```

**למידה:** לעתים הפורמט בפועל שונה מהמתועד - צריך לתמוך בשניהם.

---

## בעיה #13: מיקום custom_data ו-test_mode ב-Webhook Payload

**הבעיה:**
ה-`custom_data` (המכיל את `user_id`) לא נמצא ב-`attributes.custom` אלא ב-`meta.custom_data`.

**הסיבה:**
Lemon Squeezy מכניס את ה-`custom_data` ב-`meta.custom_data` ולא ב-`attributes.custom`.

**הפתרון:**
עדכנו את `parseWebhookPayload` לבדוק את `meta.custom_data` ראשון:

```javascript
function parseWebhookPayload(event) {
  // בדוק meta.custom_data ראשון (כך Lemon Squeezy מכניס את זה)
  let customData = {};
  
  if (event.meta?.custom_data) {
    customData = event.meta.custom_data;
    console.log('Found custom_data in meta.custom_data:', customData);
  } else if (attributes.custom) {
    customData = attributes.custom;
  }
  // ... fallbacks נוספים
  
  // test_mode גם ב-meta.test_mode
  const testMode = event.meta?.test_mode !== undefined 
    ? event.meta.test_mode 
    : (attributes.test_mode !== undefined ? attributes.test_mode : false);
  
  // ...
}
```

**למידה:** תמיד לבדוק את המבנה בפועל של ה-payload בלוגים, לא רק בדוקומנטציה.

---

## בעיה #14: LEMON_WEBHOOK_SECRET לא הוגדר ב-Render

**הבעיה:**
```
❌ Missing webhook signature or secret
Secret: Missing
```

**הסיבה:**
ה-`LEMON_WEBHOOK_SECRET` לא הוגדר ב-Render Environment Variables.

**הפתרון:**
1. הוספנו הודעת שגיאה מפורטת:
```javascript
if (!signature || !secret) {
  console.error('❌ Missing webhook signature or secret');
  console.error('Please ensure LEMON_WEBHOOK_SECRET=testpassword123 is set in Render environment variables');
  return res.status(401).json({ error: 'Unauthorized' });
}
```

2. הוספנו את המשתנה ב-Render:
   - `LEMON_WEBHOOK_SECRET=testpassword123`

**למידה:** תמיד לבדוק שכל משתני הסביבה מוגדרים ב-Render לפני בדיקת webhooks.

---

## מסקנות סופיות ואימות המערכת

### ✅ המערכת עובדת במלואה!

לאחר כל התיקונים, המערכת נבדקה בהצלחה ב-5 בנובמבר 2025:

#### רכישה ראשונה - הצלחה מלאה:
```
Frontend:
  10:12:06 - Counter: 0
  10:12:18 - Counter updated: 0 → 1 ✅

Backend (Render):
  08:12:16 - ✅ Webhook signature verified
  08:12:16 - Found custom_data in meta.custom_data: { user_id: '7FWFxKOGZAZe9BylPMsg7T1xkRu2' }
  08:12:16 - ✅ Webhook processed successfully: Order 6757374
  08:12:16 - Test purchase recorded: 6757374
```

#### רכישה שנייה - הצלחה מלאה:
```
Frontend:
  10:12:30 - Buy button clicked
  10:13:19 - Lemon Squeezy event: Checkout.Success
  10:13:21 - Counter updated: 1 → 2 ✅

Backend (Render):
  08:13:18 - ✅ Webhook signature verified
  08:13:18 - Found custom_data in meta.custom_data: { user_id: '7FWFxKOGZAZe9BylPMsg7T1xkRu2' }
  08:13:18 - ✅ Webhook processed successfully: Order 6757553
  08:13:18 - Test purchase recorded: 6757553
```

### מה עובד:
1. ✅ **Checkout Creation** - יצירת checkout מול Lemon Squeezy API
2. ✅ **Checkout Overlay** - פתיחת חלון תשלום ב-SDK
3. ✅ **Payment Processing** - עיבוד תשלום ב-Lemon Squeezy
4. ✅ **Webhook Reception** - קבלת webhooks מ-Lemon Squeezy
5. ✅ **Signature Verification** - אימות חתימת webhook (שני פורמטים)
6. ✅ **Payload Parsing** - חילוץ נתונים מ-webhook (`meta.custom_data`, `meta.test_mode`)
7. ✅ **Firestore Recording** - שמירת רכישות ב-Firestore
8. ✅ **Counter Updates** - עדכון המונה בזמן אמת (polling)
9. ✅ **Redirect Handling** - חזרה לאתר אחרי רכישה מוצלחת

### מבנה Webhook Payload (הסופי):

```json
{
  "meta": {
    "test_mode": true,                    // ✅ כאן!
    "event_name": "order_created",
    "custom_data": {                      // ✅ כאן!
      "user_id": "7FWFxKOGZAZe9BylPMsg7T1xkRu2"
    },
    "webhook_id": "..."
  },
  "data": {
    "type": "orders",
    "id": "6757553",
    "attributes": {
      "store_id": 230339,
      "customer_id": 7076294,
      "identifier": "...",
      "order_number": 2303399,
      "user_email": "Shalom.cohen.111@gmail.com",
      "currency": "USD",
      "total": 999,
      "test_mode": true,                  // גם כאן (אבל תמיד לבדוק meta.test_mode ראשון)
      "created_at": "2025-11-05T08:13:17.000000Z",
      "order_items": [...]
    }
  }
}
```

### Webhook Signature Header Format:

Lemon Squeezy שולח את ה-signature בשני פורמטים אפשריים:
1. `x-signature: sha256=9e49876e161c1ac4e63e32479ea776e2...` (פורמט מתועד)
2. `x-signature: 9e49876e161c1ac4e63e32479ea776e2...` (פורמט בפועל - נפוץ יותר)

**הקוד תומך בשניהם!**

### סדר פעולות קריטי ב-server.js:

```javascript
// 1. Trust proxy (לפני הכל)
app.set('trust proxy', true);

// 2. CORS (לפני כל routes)
app.use(corsMiddleware);

// 3. Lemon routes (לפני express.json() כדי ש-webhook יוכל לגשת ל-raw body)
app.use('/api/lemon', lemonRoutes);

// 4. Rate limiting (אחרי lemon routes, עם skip ל-lemon)
app.use('/api/', rateLimiter);

// 5. JSON parsing (אחרי lemon routes)
app.use(express.json());

// 6. שאר ה-routes
app.use('/api/', otherRoutes);
```

---

## קישורים שימושיים

- **Lemon Squeezy API Documentation:** https://docs.lemonsqueezy.com/api
- **Create Checkout API:** https://docs.lemonsqueezy.com/api/checkouts/create-checkout
- **Checkout Overlay:** https://docs.lemonsqueezy.com/help/checkout/checkout-overlay
- **Webhooks:** https://docs.lemonsqueezy.com/api/webhooks
- **Render Dashboard:** https://dashboard.render.com
- **Firebase Console:** https://console.firebase.google.com

---

## מדריך מהיר להטמעה במערכת הקרדיטים

לאחר שבדקת את המערכת ב-`test-system.html` והכל עובד, הנה המדריך להטמעה במערכת הקרדיטים האמיתית:

### שלב 1: עדכון Backend

1. **עדכן את `lemon-credits-service.js`:**
   ```javascript
   // במקום recordTestPurchase, צור פונקציה חדשה:
   async function recordPurchase(userId, orderId, variantId, orderData) {
     // 1. שמור את הרכישה ב-collection: purchases
     await db.collection('purchases').add({
       userId,
       orderId,
       variantId,
       orderNumber: orderData.orderNumber,
       total: orderData.total,
       currency: orderData.currency,
       testMode: orderData.testMode,
       createdAt: admin.firestore.FieldValue.serverTimestamp()
     });
     
     // 2. עדכן את ה-entitlements לפי variant ID
     const creditsToAdd = getCreditsForVariant(variantId);
     await updateUserCredits(userId, creditsToAdd);
     
     // 3. רשום ב-activity log
     await logCreditActivity(userId, 'purchase', {
       orderId,
       credits: creditsToAdd
     });
   }
   
   function getCreditsForVariant(variantId) {
     // מפה של variant ID → כמות קרדיטים
     const variantMap = {
       '1073211': 10,  // לדוגמה: variant זה = 10 קרדיטים
       '1073212': 50,
       '1073213': 100
     };
     return variantMap[variantId] || 0;
   }
   ```

2. **עדכן את `lemon-routes.js`:**
   ```javascript
   // במקום recordTestPurchase, קרא ל-recordPurchase
   await recordPurchase(orderData.userId, orderData.orderId, orderData.variantId, orderData);
   ```

3. **הסר Test Mode:**
   ```javascript
   // שנה ב-lemon-routes.js:
   test_mode: false  // במקום true
   ```

### שלב 2: עדכון Frontend

1. **הסר את `test-system.html`** (או העבר לדף admin בלבד)

2. **הוסף כפתור "Buy Credits" לעמוד הקרדיטים:**
   ```html
   <button id="buy-credits-btn" data-variant-id="1073211">
     Buy 10 Credits - $9.99
   </button>
   ```

3. **עדכן את ה-JavaScript:**
   ```javascript
   // השתמש באותו קוד מ-test-system.js
   // אבל שנה את ה-URLs:
   const API_BASE_URL = 'https://specifys-ai.onrender.com/api';
   const redirectUrl = `${FRONTEND_URL}/credits?purchase=success`;
   ```

### שלב 3: עדכון Firestore Rules

הוסף rules ל-`purchases` collection:
```javascript
match /purchases/{purchaseId} {
  allow read: if request.auth != null && request.auth.uid == resource.data.userId;
  allow create, update, delete: if isAdmin(); // רק backend
}
```

### שלב 4: בדיקות סופיות

1. ✅ בדוק רכישה אחת ב-test mode
2. ✅ בדוק שהקרדיטים מתעדכנים
3. ✅ בדוק שהרכישה נשמרת ב-Firestore
4. ✅ בדוק redirect אחרי רכישה
5. ✅ בדוק webhooks ב-Render logs

### שלב 5: מעבר ל-Production

1. **החלף את ה-Variant ID** ל-production variants
2. **הסר `test_mode: true`** מהקוד
3. **עדכן את ה-Webhook Secret** ל-production secret
4. **בדוק רכישה אמיתית אחת** (עם סכום קטן)
5. **עקוב אחרי ה-Logs** ב-Render

---

## נקודות חשובות להטמעה

### 1. ניהול Variants
- צור mapping בין Variant ID לכמות קרדיטים
- שמור את ה-mapping ב-Firestore או ב-environment variables
- הוסף validation לוודא שה-variant קיים

### 2. אבטחה
- ✅ Webhook signature verification (כבר מוגדר)
- ✅ Firebase token verification (כבר מוגדר)
- ✅ Firestore rules (צריך להוסיף ל-purchases)
- ✅ Rate limiting (כבר מוגדר)

### 3. Error Handling
- הוסף retry logic ל-webhook processing
- הוסף error notifications (email/Slack)
- שמור failed webhooks ב-Firestore לבדיקה ידנית

### 4. Monitoring
- עקוב אחרי מספר רכישות ביום
- עקוב אחרי failed webhooks
- עקוב אחרי errors ב-Render logs

### 5. Backup & Recovery
- שמור backup של כל הרכישות
- צור script לשחזור רכישות מ-Lemon Squeezy API
- הוסף validation לוודא שלא נוצרות רכישות כפולות

---

**עודכן לאחרונה:** 5 בנובמבר 2025  
**גרסת תיעוד:** 2.0 (כולל מסקנות סופיות ואימות המערכת)
