# Render Deploy Failure Debugging

## הבעיה
Deploys נכשלים:
- 2ac8976: Fix variant_id normalization - Deploy failed
- 1282d62: Add variant_id type normalization - Deploy failed

## איך לבדוק מה הבעיה

### שלב 1: לך ל-Render Dashboard
1. פתח את service "specifys-ai"
2. לחץ על "Logs"
3. גלול למטה ל-deploy שנכשל
4. העתק את ה-error message

### שלב 2: בדוק Build Errors
בתוך ה-Logs, חפש:

**אם זה Build Error:**
```
npm ERR! ...
Cannot find module ...
Package.json error
```

**פתרון:**
- בדוק `backend/package.json` תקין
- בדוק `backend/package-lock.json` tracked ב-Git

### שלב 3: בדוק Runtime Errors
חפש ב-Logs:

**אם זה Runtime Error:**
```
❌ Firebase Admin SDK initialization failed
Cannot read property ...
TypeError: ...
```

**פתרון:**
- בדוק FIREBASE_SERVICE_ACCOUNT_KEY תקין (json אחד על שורה אחת)
- בדוק משתנים אחרים ב-Environment

## 🔍 Debugging Steps

### צעד 1: בדוק שהקוד תקין מקומית
```bash
cd backend
npm install
node server.js
```

אם זה עובד מקומית - הבעיה ב-Render environment.

### צעד 2: בדוק package.json
```bash
cd backend
cat package.json
```

ודא שכל הדפנדנסים קיימים.

### צעד 3: בדוק Build Command ב-Render
Render Dashboard → Settings → Build & Deploy

Build Command צריך להיות: `npm install`

אם לא - שנה ל-npm install

### צעד 4: בדוק Start Command
Start Command צריך להיות: `node server.js`

אם לא - שנה ל-node server.js

### צעד 5: בדוק Root Directory
Root Directory צריך להיות: `backend`

אם לא - שנה ל-backend

## 🐛 Common Deploy Errors

### Error 1: Cannot find module 'express'
**סיבה:** npm install לא רץ

**פתרון:** ודא Build Command = `npm install`

### Error 2: Cannot find module '../config/lemon-products.json'
**סיבה:** Root Directory לא נכון

**פתרון:** שנה Root Directory ל-`backend`

### Error 3: Firebase initialization failed
**סיבה:** FIREBASE_SERVICE_ACCOUNT_KEY לא תקין

**פתרון:** בדוק שה-JSON שורה אחת, לא multi-line

### Error 4: Port already in use
**סיבה:** PORT environment variable לא מוגדר

**פתרון:** הוסף PORT=3001 ב-Environment

## ✅ Quick Fix Checklist

1. Render Dashboard → Environment:
   - [ ] PORT=3001
   - [ ] FIREBASE_PROJECT_ID=specify-ai
   - [ ] FIREBASE_SERVICE_ACCOUNT_KEY (עם כל ה-JSON בשורה אחת)
   - [ ] LEMON_WEBHOOK_SECRET=specifys_ai_secret_2025
   - [ ] LEMON_SQUEEZY_API_KEY (עם ה-API key)
   - [ ] RENDER_URL=specifys-ai.onrender.com

2. Render Dashboard → Settings:
   - [ ] Root Directory = `backend`
   - [ ] Build Command = `npm install`
   - [ ] Start Command = `node server.js`

3. Trigger Manual Deploy:
   - [ ] Manual Deploy → Deploy latest commit

4. Check Logs:
   - [ ] מחכה 2-5 דקות
   - [ ] בודק Logs ל-errors
   - [ ] מחפש "Server running"

## 📞 אם זה עדיין לא עובד

תעתיק אלי:
1. ה-Syntax Error מה-Logs
2. ה-Stack Trace (אם יש)
3. איזה שלב נכשל (Build/Runtime)
4. מה Build/Start Commands מוגדרים

אז אני יכול לתקן בדיוק.

