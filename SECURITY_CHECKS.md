# 🔍 Security Checks - רשימת בדיקות אבטחה

## ✅ בדיקות שצריך לעשות עכשיו

### 1. בדיקת Security Headers

**איך לבדוק:**
1. פתח את האתר בדפדפן
2. פתח Developer Tools (F12)
3. לך לטאב **Network**
4. רענן את הדף
5. בחר request כלשהו (למשל `index.html` או `main.css`)
6. לך לטאב **Headers**
7. גלול למטה ל-**Response Headers**

**מה לחפש:**
- ✅ `X-Content-Type-Options: nosniff`
- ✅ `X-Frame-Options: SAMEORIGIN`
- ✅ `Strict-Transport-Security` (אם זה HTTPS)
- ✅ `X-XSS-Protection: 1; mode=block`
- ✅ `Content-Security-Policy` (אמור להיות מוגדר)

**תוצאה צפויה:** כל ה-headers האלה אמורים להופיע

---

### 2. בדיקת CORS Logging

**איך לבדוק:**
1. פתח את ה-terminal שבו רץ השרת
2. פתח את האתר בדפדפן
3. רענן את הדף
4. בדוק את הלוגים ב-terminal

**מה לחפש:**
- ✅ הודעות `[CORS] Request from origin: ...`
- ✅ הודעות `[CORS] Allowed origins: [...]`
- ✅ הודעות `[CORS] ✅ Allowed origin: ...` או `[CORS] ⚠️ Origin not in allowed list: ...`

**תוצאה צפויה:** 
- אם origin ברשימה → תראה `✅ Allowed origin`
- אם origin לא ברשימה → תראה `⚠️ Origin not in allowed list` אבל האתר עדיין יעבוד (בגלל fallback)

**רשום:** אילו origins מופיעים ב-logs?

---

### 3. בדיקת Rate Limiting

**איך לבדוק:**
1. פתח את האתר בדפדפן
2. פתח Developer Tools → Network
3. נסה לשלוח feedback כמה פעמים מהר (יותר מ-10 פעמים בדקה)
4. בדוק אם אתה מקבל שגיאה של "Too many requests"

**מה לחפש:**
- ✅ אחרי כמה פעמים אתה מקבל שגיאה 429 (Too Many Requests)
- ✅ הודעת שגיאה: "Too many feedback submissions from this IP"

**תוצאה צפויה:** אחרי 10 פעמים בדקה אתה אמור לקבל שגיאה

---

### 4. בדיקת Console Errors

**איך לבדוק:**
1. פתח את האתר בדפדפן
2. פתח Developer Tools → Console
3. רענן את הדף
4. פתח כמה דפים שונים באתר

**מה לחפש:**
- ❌ אין שגיאות CORS אדומות
- ❌ אין שגיאות 404 על endpoints
- ✅ הכל עובד תקין

**תוצאה צפויה:** אין שגיאות אדומות (אזהרות צהובות זה בסדר)

---

### 5. בדיקת Network Requests

**איך לבדוק:**
1. פתח את האתר בדפדפן
2. פתח Developer Tools → Network
3. רענן את הדף
4. בדוק את כל ה-requests

**מה לחפש:**
- ✅ כל ה-requests מצליחים (200 או 304)
- ✅ אין requests שנכשלים (404, 500, וכו')
- ✅ ה-API requests עובדים תקין

**תוצאה צפויה:** כל ה-requests מצליחים

---

### 6. בדיקת אם האתר עובד תקין

**איך לבדוק:**
1. פתח את כל הדפים העיקריים:
   - דף הבית
   - spec-viewer
   - admin dashboard (אם יש)
   - profile
   - כל דף אחר חשוב
2. בדוק שכל הפונקציונליות עובדת:
   - יצירת spec
   - צפייה ב-spec
   - feedback
   - כל דבר אחר חשוב

**מה לחפש:**
- ✅ כל הדפים נטענים תקין
- ✅ כל הפונקציונליות עובדת
- ✅ אין בעיות עיצוב
- ✅ הכל נראה כמו קודם

**תוצאה צפויה:** הכל עובד כמו קודם, בלי בעיות

---

## 📝 מה לרשום

אחרי שתסיים את כל הבדיקות, רשום:

1. **Security Headers:** האם כל ה-headers מופיעים? ✅/❌
2. **CORS Origins:** אילו origins מופיעים ב-logs?
3. **Rate Limiting:** האם rate limiting עובד? ✅/❌
4. **Console Errors:** האם יש שגיאות? ✅/❌
5. **Network Requests:** האם כל ה-requests מצליחים? ✅/❌
6. **האתר עובד:** האם הכל עובד תקין? ✅/❌

---

## 🚨 אם משהו לא עובד

אם משהו לא עובד:
1. **עצור** - אל תמשיך
2. **רשום** מה לא עובד
3. **צלם מסך** של השגיאה
4. **בדוק את הלוגים** ב-terminal
5. **ספר לי** מה קרה

אם הכל עובד תקין, נוכל להמשיך לשלב הבא (הסרת fallback ל-'*').

