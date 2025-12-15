# ✅ רשימת בדיקה לפני פריסה - Specifys.ai

## 🔴 קריטי - חובה לפני פריסה

- [x] **Favicon** - ✅ קיים ב-root directory (56KB)
- [x] **Web Manifest Icons** - ✅ `icon-192.png` (19KB) ו-`icon-512.png` (61KB) נוצרו
- [x] **Environment Variables** - ✅ `backend/env-template.txt` קיים ומעודכן
- [ ] **Backend URL** - ודא ש-`config.js` מצביע לכתובת production הנכונה
- [ ] **Firebase Config** - ודא שכל משתני Firebase מוגדרים ב-Render
- [ ] **Lemon Squeezy** - ודא שכל מפתחות API מוגדרים
- [ ] **CORS** - ודא ש-CORS כולל את כל הכתובות הנדרשות

## 🟡 חשוב - מומלץ לפני פריסה

- [ ] **Console Logs** - נקה console.log מיותרים
- [ ] **Security Audit** - הרץ `npm audit` ב-backend
- [ ] **Lighthouse** - בדוק Lighthouse score (מטרה: 90+)
- [ ] **Accessibility** - הרץ בדיקת a11y (axe DevTools)
- [ ] **Error Handling** - בדוק שכל שגיאות מטופלות
- [ ] **Performance** - ודא CSS minified, images optimized
- [ ] **Mobile Testing** - בדוק על מכשירים אמיתיים

## 🟢 בדיקות נוספות

- [ ] **Google Search Console** - ודא שהאתר indexed
- [ ] **Structured Data** - בדוק ב-Google Rich Results Test
- [ ] **Analytics** - ודא GA4 מקבל events
- [ ] **Sitemap** - בדוק ש-sitemap.xml נגיש
- [ ] **Robots.txt** - בדוק ש-robots.txt נגיש
- [ ] **404 Page** - בדוק שהדף עובד
- [ ] **API Endpoints** - בדוק שכל endpoints עובדים
- [ ] **Authentication** - בדוק login/logout flow
- [ ] **Payment Flow** - בדוק תהליך תשלום (אם רלוונטי)

## 🔧 בדיקות טכניות

- [ ] **Build Process** - ודא שהבנייה עובדת (`npm run build`)
- [ ] **Dependencies** - ודא שכל dependencies מותקנות
- [ ] **Environment** - ודא שכל משתני סביבה מוגדרים
- [ ] **Database** - בדוק חיבור ל-Firebase
- [ ] **Logs** - בדוק שהלוגים עובדים
- [ ] **Error Logging** - בדוק ששגיאות נרשמות

## 📱 בדיקות UX

- [ ] **Navigation** - בדוק שכל הקישורים עובדים
- [ ] **Forms** - בדוק שכל הטפסים עובדים
- [ ] **Modals** - בדוק שכל ה-modals נפתחים
- [ ] **Responsive** - בדוק על מסכים שונים
- [ ] **Loading States** - בדוק שכל loading states עובדים
- [ ] **Error Messages** - בדוק שהודעות שגיאה ברורות

## 🚀 אחרי הפריסה

- [ ] **Health Check** - בדוק `/api/health`
- [ ] **Monitoring** - בדוק logs ו-errors
- [ ] **Analytics** - בדוק GA4 real-time
- [ ] **Performance** - בדוק Web Vitals
- [ ] **User Flows** - בדוק critical user flows
- [ ] **Payment** - בדוק תהליך תשלום end-to-end

---

**הערות:**
- רוב הבדיקות כבר עברו בהצלחה ✅
- הנושאים הקריטיים הם בעיקר קבצים חסרים (favicon, icons)
- האתר מוכן ברובו לפריסה!
