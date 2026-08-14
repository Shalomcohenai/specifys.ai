# ✅ Checklist להגדרת Webhook - Lemon Squeezy

## לפני התחלה

- [ ] יש לך חשבון Lemon Squeezy פעיל
- [ ] יש לך שרת Render פעיל עם ה-endpoint `/api/lemon/webhook`
- [ ] יש לך את כל ה-API keys והמזהים

---

## שלב 1: הגדרת Environment Variables ב-Render

- [ ] `LEMON_SQUEEZY_API_KEY` - API Key מ-Lemon Squeezy
- [ ] `LEMON_SQUEEZY_STORE_ID` - Store ID (מספר, לדוגמה: 230339)
- [ ] `LEMON_SQUEEZY_VARIANT_ID` - Variant ID (מספר, לדוגמה: 1073211)
- [ ] `LEMON_WEBHOOK_SECRET` - **חובה!** (לדוגמה: `testpassword123`)
- [ ] `FIREBASE_PROJECT_ID` - Firebase Project ID
- [ ] `FIREBASE_SERVICE_ACCOUNT_KEY` - JSON מלא של Service Account Key

**⚠️ חשוב:** `LEMON_WEBHOOK_SECRET` חייב להיות **זהה בדיוק** ל-Secret שיהיה ב-Lemon Squeezy Dashboard!

---

## שלב 2: הגדרת Webhook ב-Lemon Squeezy Dashboard

1. **היכנס ל-Dashboard:**
   - [ ] נווט ל: https://app.lemonsqueezy.com/settings/webhooks

2. **צור Webhook חדש:**
   - [ ] לחץ על **"Create Webhook"**
   - [ ] **URL**: `https://your-service.onrender.com/api/lemon/webhook`
     - ⚠️ **רק HTTPS** (לא HTTP)
     - ⚠️ **ללא `/` בסוף**
     - ⚠️ ודא שה-URL נכון
   - [ ] **Secret**: `testpassword123` (או מה שהגדרת ב-Render)
     - ⚠️ **חייב להיות זהה** ל-`LEMON_WEBHOOK_SECRET` ב-Render!
   - [ ] **Events**: select at least:
     - `order_created`
     - `subscription_created`
     - `subscription_updated`
     - `subscription_cancelled`
     - `subscription_expired`
     - `subscription_paused`
     - `subscription_payment_success`
     - `subscription_payment_failed`
     - `subscription_payment_recovered`
     - `subscription_payment_refunded`
     - ⚠️ `order_created` alone is not enough. Cancel, expiry, failed payment, and monthly renewal will not update the site or admin activity without the `subscription_*` events.
   - [ ] **Test Mode**: השאר unchecked (או סמן אם זה רק לבדיקות)

3. **שמור את ה-Webhook:**
   - [ ] לחץ על **"Save"**
   - [ ] ודא שה-Status = **Active** (ירוק)

---

## שלב 3: בדיקת Webhook

### בדיקה 1: Webhook History ב-Lemon Squeezy
- [ ] לך ל-Webhook History ב-Dashboard
- [ ] בדוק אם יש ניסיונות שליחה (אפילו אם Failed)
- [ ] אם יש Failed - בדוק למה (URL, Secret, וכו')

### בדיקה 2: לוגים ב-Render
- [ ] בצע רכישת test
- [ ] חכה 10-30 שניות
- [ ] בדוק ב-Render Logs:
  - [ ] `=== Webhook Received ===`
  - [ ] `✅ Webhook signature verified`
  - [ ] `✅ Webhook processed successfully`
  - [ ] `Found custom_data in meta.custom_data: { user_id: '...' }`

### בדיקה 3: המונה עולה
- [ ] בדוק את המונה בדף test-system.html
- [ ] המונה צריך לעלות מ-0 ל-1 (או יותר אם יש רכישות קודמות)

---

## בעיות נפוצות - Quick Fix

### ❌ Webhook לא מגיע בכלל
- [ ] בדוק שה-URL נכון ב-Lemon Squeezy Dashboard
- [ ] בדוק שה-Webhook Status = Active
- [ ] בדוק שה-Event `order_created` נבחר
- [ ] בדוק ב-Webhook History אם יש ניסיונות שליחה

### ❌ Signature Verification Failed
- [ ] ודא ש-`LEMON_WEBHOOK_SECRET` ב-Render **זהה בדיוק** ל-Secret ב-Lemon Squeezy
- [ ] ללא רווחים, אותיות קטנות/גדולות, וכו'
- [ ] בדוק את הלוגים - יש שם פרטים על מה השתבש

### ❌ Custom Data לא נמצא
- [ ] בדוק שהקוד מחפש ב-`meta.custom_data` (לא ב-`attributes.custom`)
- [ ] בדוק שהקוד מחפש `test_mode` ב-`meta.test_mode`
- [ ] בדוק את הלוגים - יש שם איפה הוא מחפש

### ❌ Endpoint לא קיים (404)
- [ ] בדוק שה-Deploy של Render הצליח
- [ ] בדוק שה-route `/api/lemon/webhook` קיים בקוד
- [ ] בדוק שה-Lemon routes מוגדרים **לפני** `express.json()`

---

## Checklist סופי - כל מה שחייב לעבוד

- [ ] ✅ כל משתני הסביבה מוגדרים ב-Render
- [ ] ✅ Webhook מוגדר ב-Lemon Squeezy Dashboard
- [ ] ✅ URL נכון ונשלח (HTTPS, ללא `/` בסוף)
- [ ] ✅ Secret זהה ב-Render וב-Lemon Squeezy
- [ ] ✅ Event `order_created` נבחר
- [ ] ✅ Webhook Status = Active
- [ ] ✅ Webhook מתקבל ב-Render (רואים בלוגים)
- [ ] ✅ Signature verification עובר
- [ ] ✅ Custom data נמצא (`meta.custom_data`)
- [ ] ✅ הרכישה נשמרת ב-Firestore
- [ ] ✅ המונה עולה

---

## אם הכל עובד ✅

אם עברת על כל ה-checklist והכל עובד:
- 🎉 **המערכת מוכנה!**
- ✅ Webhooks מתקבלים
- ✅ Signature מאומת
- ✅ נתונים נשמרים
- ✅ המונה מתעדכן

**השלב הבא:** הטמעה במערכת הקרדיטים האמיתית (ראה `docs/lemon-squeezy-setup.md`)

---

## קישורים מהירים

- **Lemon Squeezy Dashboard:** https://app.lemonsqueezy.com/settings/webhooks
- **Render Dashboard:** https://dashboard.render.com
- **Firebase Console:** https://console.firebase.google.com
- **תיעוד מלא:** `docs/lemon-squeezy-setup.md`

---

**עודכן לאחרונה:** 5 בנובמבר 2025  
**סטטוס:** ✅ מעודכן עם כל הלמידה מהפיתוח

