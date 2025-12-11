# תוכנית השלבים הבאים - בניית האתר כמו שצריך

## 🎯 מטרה
לוודא שהאתר בנוי כמו שצריך מבחינה טכנית, לפני דיוק העיצוב.

## 📋 שלבים

### שלב 1: בדיקת תקינות כל הדפים ✅
**מטרה**: לזהות דפים עם בעיות CSS, JavaScript, או פונקציונליות

**דפים לבדיקה**:
- ✅ index.html - עובד (תוקן)
- ✅ why.html - עובד (תוקן)
- ✅ spec-viewer.html - עובד (תוקן)
- ✅ profile.html - עובד (תוקן)
- ⚠️ about.html - צריך לבדוק (אין CSS ספציפי)
- ⚠️ how.html - צריך לבדוק (אין CSS ספציפי)
- ⚠️ articles.html - צריך לבדוק (Jekyll layout)
- ⚠️ article.html - צריך לבדוק
- ✅ admin-dashboard.html - יש CSS
- ⚠️ legacy-viewer.html - צריך לבדוק
- ✅ demo-spec.html - יש CSS
- ✅ auth.html - יש CSS
- ✅ pricing.html - יש CSS
- ✅ 404.html - יש CSS
- ✅ ToolPicker.html - יש CSS

**פעולות**:
1. לבדוק כל דף ב-localhost:4000
2. לזהות דפים עם בעיות CSS (unstyled components)
3. לזהות דפים עם שגיאות JavaScript בקונסול
4. לזהות דפים עם בעיות Firebase/Auth
5. לזהות דפים עם בעיות API calls

---

### שלב 2: בדיקת שגיאות JavaScript 🔍
**מטרה**: לוודא שאין שגיאות קריטיות בקונסול

**בדיקות**:
- [ ] לפתוח כל דף ולבדוק את הקונסול
- [ ] לזהות שגיאות 404 (קבצים חסרים)
- [ ] לזהות שגיאות Firebase
- [ ] לזהות שגיאות API
- [ ] לזהות שגיאות JavaScript syntax

**קבצים לבדיקה**:
- `/assets/js/config.js`
- `/assets/js/api-client.js`
- `/assets/js/index.js`
- `/assets/js/spec-viewer.js`
- `/assets/js/profile.js`
- `/assets/js/articles.js`
- וכל שאר קבצי ה-JS

---

### שלב 3: בדיקת אינטגרציה Firebase 🔥
**מטרה**: לוודא שכל הדפים עם auth עובדים

**דפים לבדיקה**:
- [ ] index.html - auth buttons
- [ ] profile.html - user data loading
- [ ] spec-viewer.html - auth checks
- [ ] auth.html - login/signup
- [ ] why.html - auth buttons (תוקן)
- [ ] about.html - auth buttons
- [ ] how.html - auth buttons

**בדיקות**:
- [ ] משתמש לא מחובר - רואה "Log in/Sign up"
- [ ] משתמש מחובר - רואה שם/avatar
- [ ] מעבר בין דפים שומר auth state
- [ ] logout עובד

---

### שלב 4: בדיקת אינטגרציה API 🌐
**מטרה**: לוודא שכל הקריאות ל-API עובדות

**API endpoints לבדיקה**:
- [ ] `/api/users/ensure` - user creation
- [ ] `/api/specs/*` - spec operations
- [ ] `/api/blog/*` - blog operations
- [ ] `/api/entitlements/*` - credits/plans
- [ ] `/api/stats/*` - statistics

**בדיקות**:
- [ ] Network tab - כל הקריאות מחזירות 200/201
- [ ] אין 404/500 errors
- [ ] Error handling עובד

---

### שלב 5: בדיקת תהליך הבנייה (Jekyll Build) 🏗️
**מטרה**: לוודא ש-Jekyll בונה את האתר כמו שצריך

**בדיקות**:
- [ ] `bundle exec jekyll build` עובד ללא שגיאות
- [ ] כל הקבצים ב-`_site/` נוצרים
- [ ] CSS files נטענים
- [ ] JavaScript files נטענים
- [ ] Images נטענות
- [ ] `_config.yml` מכיל את כל הקבצים הנדרשים

**קבצים חשובים**:
- `_config.yml` - exclude/include lists
- `_site/assets/css/pages/*` - כל קבצי ה-CSS
- `_site/pages/*` - כל הדפים

---

### שלב 6: בדיקת קבצים חסרים 📁
**מטרה**: לוודא שכל הקבצים נטענים

**בדיקות**:
- [ ] Network tab - אין 404 errors
- [ ] כל ה-CSS files נטענים
- [ ] כל ה-JavaScript files נטענים
- [ ] כל ה-images נטענות
- [ ] כל ה-fonts נטענות

**קבצים חשובים**:
- `/tools/prompts.js` - צריך להיות ב-`_site/tools/`
- כל קבצי ה-CSS ב-`assets/css/pages/`
- כל קבצי ה-JS ב-`assets/js/`

---

### שלב 7: יצירת CSS חסר 🎨
**מטרה**: ליצור CSS לדפים שצריכים

**דפים שצריכים CSS**:
- [ ] about.html - אם יש קומפוננטות מיוחדות
- [ ] how.html - אם יש קומפוננטות מיוחדות
- [ ] articles.html - אם יש קומפוננטות מיוחדות
- [ ] article.html - אם יש קומפוננטות מיוחדות
- [ ] legacy-viewer.html - אם יש קומפוננטות מיוחדות

**פעולות**:
1. לבדוק כל דף ולזהות קומפוננטות מיוחדות
2. לבדוק אם יש CSS ב-`main-compiled.css.backup.old`
3. ליצור קבצי CSS חדשים אם צריך
4. להוסיף ל-`_config.yml`

---

### שלב 8: בדיקת ניווט 🔗
**מטרה**: לוודא שכל הקישורים עובדים

**בדיקות**:
- [ ] כל הקישורים ב-header עובדים
- [ ] כל הקישורים ב-footer עובדים
- [ ] כל הקישורים פנימיים עובדים
- [ ] אין broken links

---

## 🚀 סדר ביצוע מומלץ

1. **שלב 1** - בדיקת תקינות כל הדפים (הכי חשוב)
2. **שלב 2** - בדיקת שגיאות JavaScript
3. **שלב 3** - בדיקת אינטגרציה Firebase
4. **שלב 4** - בדיקת אינטגרציה API
5. **שלב 5** - בדיקת תהליך הבנייה
6. **שלב 6** - בדיקת קבצים חסרים
7. **שלב 7** - יצירת CSS חסר
8. **שלב 8** - בדיקת ניווט

---

## ✅ קריטריונים להצלחה

האתר נחשב "בנוי כמו שצריך" כאשר:
- ✅ כל הדפים נטענים ללא שגיאות
- ✅ אין שגיאות JavaScript בקונסול
- ✅ Firebase auth עובד בכל הדפים
- ✅ כל הקריאות ל-API עובדות
- ✅ Jekyll build עובד ללא שגיאות
- ✅ אין קבצים חסרים (404 errors)
- ✅ כל הקישורים עובדים
- ✅ כל הקומפוננטות מעוצבות (גם אם לא מושלם)

---

## 📝 הערות

- **לא** להתמקד בעיצוב מושלם בשלב זה
- **כן** להתמקד בפונקציונליות ובתקינות טכנית
- אחרי שכל השלבים יושלמו, אפשר להתחיל לדייק את העיצוב
