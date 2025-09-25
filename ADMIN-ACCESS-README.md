# Admin Access Control - הוראות הגדרה

## סקירה כללית
מערכת הגישה לדף ה-Admin Dashboard מוגבלת כעת רק למשתמשים עם מיילים ספציפיים.

## קבצים שעודכנו
1. `pages/profile.html` - הסתרת כפתור Admin Dashboard עבור משתמשים רגילים
2. `pages/admin-dashboard.html` - בדיקת הרשאות בדף ה-Admin Dashboard
3. `assets/js/admin-dashboard.js` - בדיקת הרשאות בקובץ JavaScript

## איך להוסיף מיילים נוספים של אדמינים

### שלב 1: עדכון דף הפרופיל
בקובץ `pages/profile.html`, מצא את הפונקציה `checkAdminAccess` (שורה ~2900) ועדכן את המערך `adminEmails`:

```javascript
const adminEmails = [
    'specifysai@gmail.com',
    'admin@specifys.ai',
    'shalom@specifys.ai',
    'your-new-admin@example.com'  // הוסף כאן את המייל החדש
];
```

### שלב 2: עדכון דף ה-Admin Dashboard
בקובץ `pages/admin-dashboard.html`, מצא את הפונקציה `checkAdminAccess` (שורה ~767) ועדכן את המערך `adminEmails`:

```javascript
const adminEmails = [
    'specifysai@gmail.com',
    'admin@specifys.ai',
    'shalom@specifys.ai',
    'your-new-admin@example.com'  // הוסף כאן את המייל החדש
];
```

### שלב 3: עדכון קובץ JavaScript
בקובץ `assets/js/admin-dashboard.js`, מצא את הפונקציה `checkAdminAccess` (שורה ~857) ועדכן את המערך `adminEmails`:

```javascript
const adminEmails = [
    'specifysai@gmail.com',
    'admin@specifys.ai',
    'shalom@specifys.ai',
    'your-new-admin@example.com'  // הוסף כאן את המייל החדש
];
```

## איך המערכת עובדת

### עבור משתמשים רגילים:
- כפתור ה-Admin Dashboard לא יוצג בדף הפרופיל
- אם ינסו לגשת ישירות לדף ה-Admin Dashboard, יועברו לדף הבית עם הודעת שגיאה

### עבור משתמשים עם מייל אדמין:
- כפתור ה-Admin Dashboard יוצג בדף הפרופיל
- יוכלו לגשת לדף ה-Admin Dashboard ללא בעיות

## בדיקת המיילים הנוכחיים
המיילים המוגדרים כרגע כאדמינים:
- `specifysai@gmail.com`
- `admin@specifys.ai`
- `shalom@specifys.ai`

## הערות חשובות
1. המיילים נבדקים ללא תלות באותיות גדולות/קטנות
2. יש לעדכן את שלושת הקבצים בכל פעם שמוסיפים מייל חדש
3. המערכת בודקת את המייל של המשתמש המחובר ב-Firebase Authentication
4. אם משתמש לא מחובר, הוא יועבר לדף הבית

## פתרון בעיות
אם אדמין לא יכול לגשת לדף:
1. בדוק שהמייל שלו נמצא בכל שלושת הקבצים
2. בדוק שהמשתמש מחובר למערכת
3. בדוק שהמייל נכתב בדיוק כמו שהוא מופיע ב-Firebase
