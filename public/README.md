# Specifys.ai User System

מערכת משתמשים מלאה עם Firebase Authentication ו-Firestore Database.

## תכונות

- ✅ **הרשמה והתחברות** - Email/Password + Google OAuth
- ✅ **ניהול מפרטים אישיים** - יצירה, עריכה, מחיקה
- ✅ **עמוד פרופיל** - הצגת ועריכת פרטי משתמש
- ✅ **אינדיקטורים חזותיים** - הצגת מצב התחברות
- ✅ **אבטחה** - Route guards ו-Firestore security rules
- ✅ **עיצוב רספונסיבי** - תמיכה במובייל ודסקטופ
- ✅ **ממשק עברי** - תמיכה מלאה בעברית

## התקנה והפעלה

### 1. התקנת dependencies
```bash
cd public
npm install
```

### 2. הפעלת השרת
```bash
npm start
```

השרת יפעל על: http://localhost:3000

## מבנה הפרויקט

```
public/
├── index.html          # דף הבית
├── login.html          # דף התחברות
├── register.html       # דף הרשמה
├── dashboard.html      # לוח בקרה אישי
├── profile.html        # עמוד פרופיל משתמש
├── scripts/
│   ├── firebaseConfig.js   # הגדרות Firebase
│   ├── authService.js      # שירותי אימות
│   ├── specsService.js     # שירותי מפרטים
│   ├── navbar.js           # ניהול תפריט
│   └── routeGuards.js      # הגנות נתיבים
├── styles/
│   ├── main.css           # עיצוב כללי
│   ├── auth.css           # עיצוב דפי אימות
│   ├── dashboard.css      # עיצוב לוח בקרה
│   └── profile.css        # עיצוב עמוד פרופיל
└── server.js              # שרת פיתוח
```

## Firebase Setup

### 1. יצירת פרויקט Firebase
- לך ל-https://console.firebase.google.com
- צור פרויקט חדש בשם "specify-ai"

### 2. הגדרת Authentication
- הפעל Email/Password authentication
- הפעל Google Sign-In
- הוסף `localhost` לרשימת Authorized domains

### 3. הגדרת Firestore
- צור Firestore database
- הגדר security rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /specs/{document} {
      allow read, write: if request.auth != null && resource.data.userId == request.auth.uid;
    }
  }
}
```

### 4. קבלת פרטי קונפיגורציה
- הוסף Web App לפרויקט
- העתק את פרטי הקונפיגורציה ל-`scripts/firebaseConfig.js`

## שימוש

1. **הרשמה** - צור חשבון חדש עם אימייל וסיסמה או Google
2. **התחברות** - התחבר עם הפרטים שיצרת
3. **יצירת מפרטים** - צור מפרטים אישיים בלוח הבקרה
4. **פרופיל** - צפה וערוך את הפרופיל האישי שלך
5. **ניהול** - ערוך או מחק מפרטים קיימים
6. **חיפוש ומיון** - חפש ומיין מפרטים בעמוד הפרופיל

## אבטחה

- כל המפרטים שמורים לפי משתמש
- אי אפשר לגשת למפרטים של משתמשים אחרים
- Route guards מונעים גישה ללא הרשאה
- Firebase Authentication מספק אבטחה מלאה

## פיתוח

הפרויקט בנוי עם:
- **HTML5** - מבנה הדפים
- **CSS3** - עיצוב רספונסיבי
- **Vanilla JavaScript** - לוגיקה ללא frameworks
- **Firebase** - Backend services
- **Express.js** - שרת פיתוח פשוט

## תמיכה

לשאלות או בעיות, צור issue ב-GitHub או פנה לצוות הפיתוח.
