# רשימת קבצים הקשורים למערכת הקנייה (הוסרו)

## קבצי קונפיגורציה (נמחקו)
- `config/lemon-products.json` - הגדרות מוצרים של Lemon Squeezy
- `assets/data/lemon-products.json` - עותק נוסף של הגדרות המוצרים

## קבצי Backend (נמחקו)
- `backend/server/entitlement-service.js` - שירות ניהול זכאויות וקרדיטים
- `backend/server/lemon-webhook.js` - עיבוד webhook של Lemon Squeezy
- `backend/server/spec-routes.js` - routes ליצירת specs עם בדיקת הרשאות
- `backend/scripts/check-purchases.js` - סקריפט לבדיקת רכישות
- `backend/scripts/check-user-entitlements.js` - סקריפט לבדיקת זכאויות משתמש
- `backend/scripts/simulate-purchase-flow.js` - סקריפט לסימולציית תהליך רכישה
- `backend/scripts/test-credits-system.js` - סקריפט לבדיקת מערכת קרדיטים

## קבצי Frontend (נמחקו)
- `assets/js/paywall.js` - מנהל מודל תשלום
- `assets/js/credits-display.js` - תצוגת קרדיטים
- `assets/js/entitlements-cache.js` - מטמון זכאויות

## דפים (נמחקו)
- `pages/purchase-monitor.html` - דף ניטור רכישות

## קבצי דוקומנטציה (נמחקו)
- `docs/lemon-squeezy-integration.md` - תיעוד אינטגרציה עם Lemon Squeezy
- `docs/PURCHASE_SYSTEM_AUDIT.md` - ביקורת מערכת רכישות
- `docs/PURCHASE_SYSTEM_REVIEW.md` - סקירת מערכת רכישות
- `docs/DEBUGGING_PURCHASE_ISSUES.md` - מדריך דיבוג בעיות רכישה
- `docs/PURCHASE_MONITORING_GUIDE.md` - מדריך ניטור רכישות

## קבצים שעודכנו

### backend/server.js
- הוסרו imports של `spec-routes` ו-`lemon-webhook`
- הוסר endpoint `/api/webhook/lemon`
- הוסר route `/api/specs`

### backend/public/firestore.rules
- הוסרו rules עבור:
  - `entitlements` collection
  - `purchases` collection
  - `subscriptions` collection
  - `pending_entitlements` collection
  - `audit_logs` collection
  - `processed_webhook_events` collection

### assets/js/index.js
- הוסרה בדיקת קרדיטים לפני יצירת spec
- הוסר טיפול ב-402 status (Payment required)
- הוסרה פונקציה `showPaywall()`
- שונה שימוש מ-`/api/specs/create` ל-`/api/generate-spec` (legacy endpoint)

### index.html
- הוסר script של `entitlements-cache.js`

### pages/pricing.html
- הוסרו scripts של `entitlements-cache.js` ו-`credits-display.js`
- הכפתורים כבר היו disabled ואין צורך לשנות

## הערות
- דף `pricing.html` נשאר אך הכפתורים disabled ואין פונקציונליות פעילה
- כל הקוד הקשור למערכת הקנייה הוסר
- המערכת עכשיו משתמשת ב-`/api/generate-spec` endpoint הישן ללא בדיקות הרשאות

