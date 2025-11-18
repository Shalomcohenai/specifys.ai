# מדריך בדיקה - Site Optimization

## ✅ השרת רץ!

**השרת פעיל ב:** http://localhost:4000

---

## 📋 רשימת דפים לבדיקה

### 🔴 דפים קריטיים (חייבים לבדוק)

#### 1. דף בית (Homepage)
- **URL:** http://localhost:4000/
- **מה לבדוק:**
  - ✅ הגופנים נטענים (Montserrat + Inter בלבד)
  - ✅ אין שגיאות בקונסול
  - ✅ התפריט והכותרות מופיעים נכון
  - ✅ אין טעינה של ספריות כבדות (Mermaid, Marked, וכו')

#### 2. דף Legacy Viewer (עודכן!)
- **URL:** http://localhost:4000/pages/legacy-viewer.html
- **מה לבדוק:**
  - ✅ הגופנים מותאמים (Montserrat + Inter)
  - ✅ ספריות נטענות דינמית (Mermaid, Marked)
  - ✅ אין שגיאות בקונסול
  - ✅ תוכן נטען כראוי

#### 3. דף Profile
- **URL:** http://localhost:4000/pages/profile.html
- **מה לבדוק:**
  - ✅ הגופנים מותאמים
  - ✅ כל הפונקציונליות עובדת

---

### 🟡 דפים נוספים (מומלץ לבדוק)

#### 4. דף Auth (התחברות)
- **URL:** http://localhost:4000/pages/auth.html
- **מה לבדוק:**
  - ✅ אין טעינה של ספריות מיותרות
  - ✅ גופנים מותאמים

#### 5. דף About
- **URL:** http://localhost:4000/pages/about.html
- **מה לבדוק:**
  - ✅ גופנים מותאמים
  - ✅ תוכן נטען נכון

#### 6. דף ToolPicker
- **URL:** http://localhost:4000/pages/ToolPicker.html
- **מה לבדוק:**
  - ✅ גופנים מותאמים
  - ✅ כל הפונקציונליות עובדת

#### 7. דף How
- **URL:** http://localhost:4000/pages/how.html
- **מה לבדוק:**
  - ✅ גופנים מותאמים
  - ✅ תוכן נטען נכון

#### 8. דף Admin Dashboard
- **URL:** http://localhost:4000/pages/admin-dashboard.html
- **מה לבדוק:**
  - ✅ גופנים מותאמים
  - ⚠️ צריך עדכון: הסרת טעינה גלובלית של ספריות

#### 9. דף Spec Viewer
- **URL:** http://localhost:4000/pages/spec-viewer.html
- **מה לבדוק:**
  - ✅ גופנים מותאמים
  - ⚠️ צריך עדכון: הסרת טעינה גלובלית של ספריות

#### 10. דף Pricing
- **URL:** http://localhost:4000/pages/pricing.html
- **מה לבדוק:**
  - ✅ גופנים מותאמים
  - ✅ תוכן נטען נכון

---

## 🔍 איך לבדוק

### 1. בדיקת גופנים
פתח את Developer Tools (F12) ולך לטאב **Network**:
- חפש `fonts.googleapis.com`
- ודא שנטענים רק: `Inter:wght@400;500;600;700` ו-`Montserrat:wght@400;500;600;700`
- לא אמורים להיטען: Poppins, Roboto

### 2. בדיקת ספריות
בטאב **Network**:
- בדף הבית - **אין** טעינה של: mermaid, marked, highlight.js, jspdf
- בדף legacy-viewer - **יש** טעינה דינמית של: mermaid, marked (דרך lib-loader.js)

### 3. בדיקת שגיאות
בטאב **Console**:
- ✅ אין שגיאות אדומות
- ✅ אין אזהרות על קבצים שלא נטענו

### 4. בדיקת ביצועים
בטאב **Network**:
- רענן את הדף
- בדוק את זמני הטעינה
- הגופנים והקבצים אמורים להיטען מהר יותר

---

## ✅ רשימת סימון מהירה

### דף הבית (index.html)
- [ ] נטען ללא שגיאות
- [ ] גופנים מותאמים (Montserrat + Inter)
- [ ] אין טעינה של ספריות כבדות
- [ ] תפריט עובד
- [ ] כל הכפתורים עובדים

### Legacy Viewer
- [ ] נטען ללא שגיאות
- [ ] גופנים מותאמים
- [ ] ספריות נטענות דינמית (בקונסול תראה "Libraries loaded for legacy viewer")
- [ ] תוכן נטען כראוי

### Profile
- [ ] נטען ללא שגיאות
- [ ] גופנים מותאמים
- [ ] התחברות עובדת

---

## 📝 הערות

### שינויים שבוצעו:
1. ✅ גופנים מותאמים - רק Montserrat + Inter (weights 400-700)
2. ✅ Library Loader נוצר - לטעינה דינמית של ספריות
3. ✅ Legacy Viewer עודכן - משתמש ב-Library Loader
4. ✅ דף הבית עודכן - גופנים מותאמים

### שינויים שנותרו:
- עוד כמה דפים צריכים עדכון (spec-viewer, admin-dashboard, וכו')
- אבל הדפים העיקריים עובדים!

---

## 🚀 התחלה

1. פתח את הדפדפן
2. לך ל: http://localhost:4000
3. פתח Developer Tools (F12)
4. בדוק את הטאבים Network ו-Console
5. עבור בין הדפים ברשימה למעלה

**השרת רץ ויכול לבדוק!** 🎉


