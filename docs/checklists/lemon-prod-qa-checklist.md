# ✅ רשימת בדיקות לפני פתיחת מערכת התשלומים (Production)

## הכנות מוקדמות
- [ ] ודא שכל משתני הסביבה קיימים בשירות Render הייעודי:
  - `LEMON_SQUEEZY_API_KEY`
  - `LEMON_SQUEEZY_STORE_ID`
  - `LEMON_WEBHOOK_SECRET` (הסוד של production)
  - `FRONTEND_URL`
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_SERVICE_ACCOUNT_KEY`
  - `LEMON_TEST_MODE=false`
- [ ] הגדר webhook חדש ב-Lemon Squeezy ל-production:
  - URL: `https://<service-name>.onrender.com/api/lemon/webhook`
  - Secret תואם למשתנה `LEMON_WEBHOOK_SECRET`
  - אירועים: לפחות `order_created`
- [ ] פרוס את השירות והמתן לסיום ה-deploy ללא שגיאות בלוגים.

## בדיקות API (במצב בדיקה)
- [ ] בצע רכישת בדיקה עם `LEMON_TEST_MODE=true` (לפני מעבר ללייב) לווידוא הזרימה:
  - `/api/lemon/checkout` מחזיר `checkoutUrl`
  - overlay של Lemon Squeezy נפתח ומציג את המוצר הנכון
- [ ] אמת בלוגי השרת:
  - `✅ Webhook signature verified`
  - `✅ Live purchase recorded` או `✅ Test purchase recorded` בהתאם למצב
- [ ] בדוק שב-Firestore:
  - נאסף מסמך חדש ב-`test_purchases` (לבדיקות) או `purchases` (לייב)
  - השדות כוללים את `userId`, `productKey`, `variantId`, `total`

## בדיקות Frontend
- [ ] `pricing.html`:
  - כפתורי הרכישה עדיין מושבתים (disabled) עד סיום הבדיקות
  - טעינת הדף עם `?checkout=success&product=single_spec` מציגה הודעת הצלחה וניקוי ה-URL
  - טעינת הדף עם `?checkout=cancel` מציגה הודעת ביטול
- [ ] בדוק שה-SDK של Lemon נטען ללא שגיאות (בקונסול הדפדפן)
- [ ] ודא שהקריאה ל-`/assets/data/lemon-products.json` מחזירה את המידע המעודכן (4 מוצרים)

## בדיקות Webhook Production
- [ ] העבר את `LEMON_TEST_MODE=false`
- [ ] בצע רכישת אמת אחת (סכום קטן) דרך overlay:
  - וודא שה-webhook נקלט (`✅ Live purchase recorded`)
  - בדוק במסד שורה חדשה ב-`purchases` עם `testMode=false`
- [ ] הרשומות שנוצרו:
  - `orderId` ייחודי, `productKey` נכון, `subscriptionId` (אם מדובר במנוי)
  - שדות `createdAt`/`updatedAt` קיבלו `serverTimestamp`

## אימות נתונים
- [ ] בדוק ב-Firebase Console שהכללים ל-`purchases` פועלים (קריאה רק למשתמש/אדמין, כתיבה רק דרך השרת)
- [ ] הרץ `getPurchasesForUser` (באדמין) לבדיקת החזרת נתונים ללא חריגה
- [ ] ודא שדף הפרופיל לא משתנה וקיימת תמיכה עתידית להצגת רכישות/מנויים

## סיום
- [ ] עדכן את `LEMON_WEBHOOK_SECRET` וה-webhook ל-secret הסופי (אם השתמשת בבדיקתיים)
- [ ] ברגע שכל הבדיקות עברו, ניתן להסיר את ה-`disabled` מהכפתורים ולפתוח את הרכישה למשתמשים.
- [ ] תכנן ריסט קרדיטים (2 לכל משתמש) רק לאחר שהמערכת בלייב ומאומתת.

