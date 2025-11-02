# Full Integration Checklist - Lemon Squeezy API

## ✅ שלב א: נתונים וסביבות (LIVE) - מוכן!

### Store & Variants
- ✅ `store_id`: 230339
- ✅ `variant_id` (single spec): 1055336 → +1 קרדיט
- ✅ `variant_id` (3-pack): 1055337 → +3 קרדיטים
- ✅ `variant_id` (Pro Monthly): 1055346 → מנוי חודשי
- ✅ `variant_id` (Pro Yearly): 1055354 → מנוי שנתי

### API Keys
- ✅ `LEMON_API_KEY`: מוכן ב־`backend/env-template.txt`
- ⚠️ **חסר**: `LEMON_SIGNING_SECRET` - צריך להגדיר ב‑Render

### Firebase
- ✅ שדות: `users/{uid}/wallet.credits`, `users/{uid}/subscription`
- ⚠️ **חסר**: Firebase Service Account ב‑Render

### Render
- ✅ שרת פעיל: `https://specifys-ai.onrender.com`
- ⚠️ **חסר**: משתני סביבה ב‑Render

### Frontend
- ✅ Popup checkout 600x700 מיושם
- ✅ API checkout integration מוכן
- ✅ Polling mechanism מוכן
- ❌ **אין**: Lemon.js overlay (לא מוטמע - זה חלון popup רגיל)

---

## 🔧 שלב ב: הגדרות Lemon Dashboard

### Webhook URL
**צריך להגדיר ב‑Lemon Squeezy:**
- URL: `https://specifys-ai.onrender.com/api/webhook/lemon`
- Secret: `specifys_ai_secret_2025`

### Events
צריך להפעיל:
- ✅ `order_created` - מוכן
- ❓ `order_refunded` - צריך לבדוק
- ✅ `subscription_created` - מוכן
- ✅ `subscription_updated` - מוכן
- ✅ `subscription_cancelled` - מוכן
- ✅ `subscription_expired` - מוכן
- ✅ `subscription_payment_success` - מוכן

### Test Webhook
1. לחץ "Send test" ב‑Lemon Dashboard
2. בדוק Render logs:
   - ✅ Webhook מתקבל
   - ✅ Signature מאומתת
   - ✅ מחזיר HTTP 200

---

## 🧪 שלב ג: בדיקות Flow אמיתיות (LIVE)

### 1. Checkout (API)
**קוד מוכן:**
- ✅ `/api/checkout` יוצר checkout עם `custom.userId`
- ✅ `variant_id` נכון נשלח
- ✅ `store_id` מוגדר נכון (230339)

**בדיקה:**
- [ ] שליחה ל‑`/api/checkout` מחזירה `checkout_url`
- [ ] `checkout_url` פועל בפרודקשן (LIVE)
- [ ] Console logs מציגים `variant_id` נכון

### 2. Popup Checkout
**קוד מוכן:**
- ✅ Popup 600x700 במרכז המסך
- ✅ URL נפתח ב‑popup חדש

**בדיקה:**
- [ ] לחיצה על "Buy" פותחת popup
- [ ] Popup מכיל Lemon Squeezy checkout
- [ ] בדיקת LIVE transaction עובדת

### 3. Webhook Processing
**קוד מוכן:**
- ✅ Webhook מקבל ומאמת signature
- ✅ Product lookup עובד עם normalization
- ✅ `custom.userId` מוכן
- ✅ Credits מוענקים אוטומטית
- ✅ Subscriptions מופעלות אוטומטית

**בדיקה:**
- [ ] Webhook מתקבל ב‑Render
- [ ] Signature מאומתת
- [ ] `variant_id` מזוהה נכון:
  - 1055336 → +1 קרדיט
  - 1055337 → +3 קרדיטים
  - 1055346 → Pro Monthly
  - 1055354 → Pro Yearly
- [ ] Firebase מתעדכן:
  - `wallet.credits` עולה
  - `subscription.active` = true (למנויים)
- [ ] Transaction נוצר ב‑Firebase
- [ ] HTTP 200 מוחזר מהר

### 4. Polling / Realtime
**קוד מוכן:**
- ✅ Polling מזהה שינויים בקרדיטים
- ✅ Modal נסגר אוטומטית
- ✅ `generateSpecification()` נקרא אוטומטית

**בדיקה:**
- [ ] קרדיטים עולים
- [ ] Polling מזהה את העלייה
- [ ] Modal נסגר
- [ ] יצירת Spec מתחילה

---

## ⚠️ שלב ד: בדיקות שלילה (LIVE)

### 1. Idempotency
**קוד מוכן:**
- ✅ `processed_webhooks` collection
- ✅ Duplicate events נדחים

**בדיקה:**
- [ ] שליחה חוזרת של אותו order_id
- [ ] אין כפל זכייה
- [ ] אין כפל מנוי

### 2. Refund
**קוד מוכן:**
- ✅ `order_refunded` handler
- ✅ Credits נמנעים מ‑Firebase

**בדיקה:**
- [ ] החזר תשלום ב‑Lemon
- [ ] Webhook מתקבל
- [ ] קרדיטים נמנעים

### 3. Subscription Cancelled/Expired
**קוד מוכן:**
- ✅ `subscription_cancelled` מעדכן סטטוס
- ✅ `subscription_expired` מסיר גישה

**בדיקה:**
- [ ] ביטול מנוי
- [ ] תפוגת מנוי
- [ ] Firebase מתעדכן

### 4. Invalid Signature
**קוד מוכן:**
- ✅ Signature verification
- ✅ שגיאה במקרה של חתימה לא תקינה

**בדיקה:**
- [ ] חתימה שגויה נדחית
- [ ] אין שינוי ב‑Firebase
- [ ] לוג ברור

---

## 📋 שלב ה: מוכנות להפעלה

### מה חסר להשלמת ה‑integration:

#### 1. Render Environment Variables
**להוסיף ב‑Render Dashboard:**
```bash
PORT=3001
FIREBASE_PROJECT_ID=specify-ai
FIREBASE_STORAGE_BUCKET=specify-ai.appspot.com
FIREBASE_API_KEY=AIzaSyB9hr0IWM4EREzkKDxBxYoYinV6LJXWXV4
FIREBASE_SERVICE_ACCOUNT_KEY=<העתק מ-env-template.txt>
LEMON_WEBHOOK_SECRET=specifys_ai_secret_2025
LEMON_SQUEEZY_API_KEY=<העתק מ-env-template.txt>
RENDER_URL=specifys-ai.onrender.com
NODE_ENV=production
```

#### 2. Lemon Squeezy Webhook Configuration
**בהולך ל‑Lemon Dashboard:**
- הוסף/עדכן Webhook: `https://specifys-ai.onrender.com/api/webhook/lemon`
- Secret: `specifys_ai_secret_2025`
- הפעל events: `order_created`, `order_refunded`, `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_expired`, `subscription_payment_success`
- Test webhook: לחץ "Send test"

#### 3. Firebase Service Account
**להוסיף ב‑Render:**
- העתק את כל ה‑JSON מ‑`backend/env-template.txt` לתחביר `FIREBASE_SERVICE_ACCOUNT_KEY`
- שמור ב‑**שורה אחת**

#### 4. בדיקת Render Deployment
```bash
# Check server is running
curl https://specifys-ai.onrender.com/api/status

# Check logs in Render dashboard
# Should see: "Firebase Admin SDK initialized successfully"
```

---

## ✅ מה שכבר מוכן

1. **Variant IDs**: כל ה‑IDs עודכנו לאימותים נכונים
2. **API Checkout**: `/api/checkout` יוצר checkout עם `custom.userId`
3. **Webhook Processing**: כל event handlers מוכנים
4. **Variant Normalization**: עובד עם מספרים ומחרוזות
5. **Popup Checkout**: 600x700 popup window
6. **Polling**: מזהה שינויים בקרדיטים
7. **Pro Subscriptions**: מנויים נפעלים אוטומטית
8. **Refunds**: קיזוז קרדיטים
9. **Pending Entitlements**: לקנייה לפני הרשמה
10. **Audit Logs**: לוגים מפורטים
11. **Idempotency**: אין כפילויות

---

## 🚀 סיכום מהירה: הפעלה

```bash
# 1. Update Render Environment Variables
# See: docs/RENDER_DEPLOYMENT_CHECKLIST.md

# 2. Configure Lemon Webhook
# URL: https://specifys-ai.onrender.com/api/webhook/lemon
# Secret: specifys_ai_secret_2025

# 3. Test webhook
# Click "Send test" in Lemon Dashboard

# 4. Check Render logs
# Should see: ✅ Webhook received and processed

# 5. Test purchase
# Go to https://specifys-ai.com
# Try to create a spec
# Click "Buy Single Spec"
# Complete payment in popup
# Verify credits update automatically
```

---

## 📊 Success Indicators

תסיים בנוח כש:
- ✅ כל המשתנים ב‑Render מוגדרים
- ✅ Webhook מבצע test (HTTP 200)
- ✅ רכישת test מעדכנת קרדיטים
- ✅ מנוי Pro מפעיל גישה
- ✅ Polling מזהה שינויים
- ✅ Modal נסגר אוטומטית
- ✅ Spec generation מתחיל אוטומטית
- ✅ אין שגיאות ב‑Render logs
- ✅ Firebase מעודכן כמו שצריך

---

## 🐛 Troubleshooting

### בעיה: Webhook לא מתקבל
**פתרון:**
- בדוק webhook URL ב‑Lemon Dashboard
- בדוק `LEMON_WEBHOOK_SECRET` ב‑Render
- בדוק Render service פעיל

### בעיה: Credits לא מתעדכנים
**פתרון:**
- בדוק Render logs ל‑webhook errors
- בדוק `variant_id` תואם
- בדוק Firebase connection

### בעיה: Checkout לא נפתח
**פתרון:**
- בדוק `LEMON_SQUEEZY_API_KEY` ב‑Render
- בדוק `store_id` = 230339
- בדוק console logs

### בעיה: Polling לא מזהה
**פתרון:**
- בדוק `maxPolls` ב‑`paywall.js` (150)
- בדוק Firebase realtime listeners
- בדוק console logs

---

## 📚 Documentation

- **Main Integration Guide**: `docs/lemon-squeezy-integration.md`
- **Render Deployment**: `docs/RENDER_DEPLOYMENT_CHECKLIST.md`
- **Debugging**: `docs/DEBUGGING_PURCHASE_ISSUES.md`
- **Testing**: `docs/testing-guide.md`
- **Monitoring**: `docs/PURCHASE_MONITORING_GUIDE.md`

