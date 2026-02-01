# 🚀 מדריך התקנה והפעלה - Localhost Development

מדריך מקיף להגדרת סביבת פיתוח מקומית עבור Specifys.ai

## 📋 תוכן עניינים

1. [דרישות מוקדמות](#דרישות-מוקדמות)
2. [התקנה ראשונית](#התקנה-ראשונית)
3. [הגדרת משתני סביבה](#הגדרת-משתני-סביבה)
4. [הפעלת השרתים](#הפעלת-השרתים)
5. [בדיקות](#בדיקות)
6. [פתרון בעיות](#פתרון-בעיות)

---

## 🔧 דרישות מוקדמות

לפני שתתחיל, ודא שיש לך:

- ✅ **Node.js** (גרסה 18+ מומלץ)
  ```bash
  node --version  # צריך להציג v18.x.x או גבוה יותר
  ```

- ✅ **npm** (מגיע עם Node.js)
  ```bash
  npm --version
  ```

- ✅ **Ruby** (גרסה 2.7+)
  ```bash
  ruby --version
  ```

- ✅ **Bundler** (Gem manager ל-Ruby)
  ```bash
  gem install bundler
  ```

---

## 📦 התקנה ראשונית

### שלב 1: התקנת Dependencies

#### Backend Dependencies

```bash
cd backend
npm install
```

#### Frontend Dependencies (Jekyll)

```bash
# מתיקיית הפרויקט הראשית
bundle install
```

זה יתקין את כל ה-gems הנדרשים (Jekyll, plugins, וכו').

---

## ⚙️ הגדרת משתני סביבה

### שלב 1: יצירת קובץ .env

צור קובץ `.env` בתיקיית `backend/`:

```bash
cd backend
cp env-template.txt .env
```

### שלב 2: עדכון קובץ .env

ערוך את קובץ `.env` והוסף את הערכים הנדרשים:

#### משתנים קריטיים (חובה):

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=specify-ai
FIREBASE_STORAGE_BUCKET=specify-ai.appspot.com
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Server Configuration
PORT=10000
NODE_ENV=development
```

#### משתנים אופציונליים:

```env
# Lemon Squeezy (נדרש רק אם בודקים תכונות תשלום)
LEMON_SQUEEZY_API_KEY=your_key_here
LEMON_SQUEEZY_STORE_ID=your_store_id_here
LEMON_WEBHOOK_SECRET=your_secret_here

# OpenAI (נדרש רק אם בודקים תכונות Chat)
OPENAI_API_KEY=sk-your-key-here

# Email (אופציונלי)
RESEND_API_KEY=re_your_key_here
RESEND_FROM_EMAIL=your-email@domain.com
```

> **⚠️ חשוב:** 
> - הקובץ `.env` כבר ב-`.gitignore` - הוא לא יכנס ל-Git
> - לעולם אל תעלה את קובץ `.env` ל-Git!
> - עבור `FIREBASE_SERVICE_ACCOUNT_KEY`: העתק את כל התוכן מ-`firebase-service-account.json` והדבק בשורה אחת

---

## 🚀 הפעלת השרתים

### שיטה 1: הפעלה אוטומטית (מומלץ) ⭐

השתמש בסקריפט האוטומטי שיפעיל את שני השרתים יחד:

```bash
cd scripts/localhost
./start-localhost.sh
```

הסקריפט:
- ✅ בודק את כל הדרישות המוקדמות
- ✅ מתקין dependencies אם חסרים
- ✅ מפעיל את Backend server (פורט 10000)
- ✅ מפעיל את Jekyll server (פורט 4000)
- ✅ מציג את הכתובות והלוגים

### שיטה 2: הפעלה ידנית

#### הפעלת Backend:

```bash
cd backend
node server/server.js
```

השרת יופעל על: **http://localhost:10000**

#### הפעלת Frontend (בטרמינל נפרד):

```bash
# מתיקיית הפרויקט הראשית
bundle exec jekyll serve
```

האתר יהיה זמין ב: **http://localhost:4000**

---

## ✅ בדיקות

### בדיקת Backend

```bash
curl http://localhost:10000/api/health
```

צריך להחזיר:
```json
{"status":"healthy","timestamp":"...","service":"Specifys.AI Backend"}
```

### בדיקת Frontend

פתח בדפדפן:
- **http://localhost:4000** - דף הבית
- **http://localhost:4000/pages/auth.html** - דף התחברות
- **http://localhost:4000/pages/profile.html** - פרופיל משתמש

### בדיקה אוטומטית

השתמש בסקריפט הבדיקה:

```bash
cd scripts/localhost
./test-localhost.sh
```

---

## 🐛 פתרון בעיות

### בעיה: "Port already in use"

**פתרון:**
```bash
# עצור את השרת הישן על פורט 10000
lsof -ti:10000 | xargs kill -9

# או על פורט 4000
lsof -ti:4000 | xargs kill -9
```

### בעיה: "Could not load Firebase credentials"

**פתרון:**
1. ודא שקובץ `.env` קיים בתיקיית `backend/`
2. ודא שהמשתנה `FIREBASE_SERVICE_ACCOUNT_KEY` מוגדר נכון
3. ודא שה-JSON תקין (שורה אחת, ללא שבירת שורות)

### בעיה: "Module not found"

**פתרון:**
```bash
# התקן מחדש את ה-dependencies
cd backend
npm install

# או עבור Jekyll
bundle install
```

### בעיה: "Jekyll build failed"

**פתרון:**
```bash
# נקה את ה-cache
bundle exec jekyll clean

# נסה שוב
bundle exec jekyll serve
```

### בעיה: Frontend לא מתחבר ל-Backend

**פתרון:**
1. ודא ש-Backend רץ על פורט 10000
2. ודא ש-Frontend רץ על localhost (לא על כתובת אחרת)
3. בדוק את הקונסול בדפדפן (F12) לשגיאות CORS

---

## 📝 הערות חשובות

### פורטים

- **Frontend (Jekyll):** `http://localhost:4000`
- **Backend (Node.js):** `http://localhost:10000`

### CORS

ה-Backend מוגדר לאפשר גישה מ-localhost. אם אתה משתמש בכתובת אחרת, עדכן את `backend/server/config.js`.

### לוגים

- **Backend:** `/tmp/specifys-backend.log` (כשמשתמשים בסקריפט האוטומטי)
- **Jekyll:** `/tmp/specifys-jekyll.log` (כשמשתמשים בסקריפט האוטומטי)

או ישירות בטרמינל אם מפעילים ידנית.

### עצירת השרתים

אם השתמשת בסקריפט האוטומטי:
- לחץ `Ctrl+C` בטרמינל - זה יעצור את שני השרתים

אם הפעלת ידנית:
- לחץ `Ctrl+C` בכל טרמינל

---

## 🎯 צעדים הבאים

לאחר שהכל עובד:

1. ✅ בדוק את דף הבית: http://localhost:4000
2. ✅ בדוק התחברות: http://localhost:4000/pages/auth.html
3. ✅ בדוק יצירת spec: http://localhost:4000/pages/planning.html
4. ✅ בדוק API endpoints: http://localhost:10000/api/health

---

## 📞 תמיכה

אם נתקלת בבעיה שלא מופיעה כאן:

1. בדוק את הלוגים (`/tmp/specifys-*.log`)
2. בדוק את הקונסול בדפדפן (F12)
3. ודא שכל ה-dependencies מותקנים
4. ודא שקובץ `.env` מוגדר נכון

---

**🎉 בהצלחה!**

