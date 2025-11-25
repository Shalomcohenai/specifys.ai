# מדריך התקנה והפעלה - Backend Server

## שלבים לפני הפעלה ראשונה

### 1. התקנת Dependencies

התקן את כל החבילות הנדרשות בשתי התיקיות:

```bash
# בתיקיית backend הראשית
cd backend
npm install

# בתיקיית server
cd server
npm install
```

**חשוב:** צריך להתקין dependencies בשתי התיקיות!

### 2. הגדרת משתני סביבה

צור קובץ `.env` בתיקיית `backend/` עם המשתנים:

```bash
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

**או** העתק את הקובץ `firebase-service-account.json` לתיקיית `backend/`

> **הערה:** הקובץ `.env` כבר ב-`.gitignore` כך שהוא לא יכנס ל-Git.

### 3. בדיקת הגדרות

ודא שיש לך:
- ✅ Node.js מותקן (גרסה 18+ מומלץ)
- ✅ npm מותקן
- ✅ קובץ `.env` עם `FIREBASE_SERVICE_ACCOUNT_KEY`
- ✅ כל ה-dependencies מותקנים (`node_modules` קיים)

## הפעלת השרת

### שיטה 1: שימוש בסקריפט (מומלץ)

```bash
cd backend/server
./start-server.sh
```

### שיטה 2: הפעלה ידנית

```bash
cd backend/server
node server.js
```

### שיטה 3: הפעלה ברקע עם לוגים

```bash
cd backend/server
nohup node server.js > ../server.log 2>&1 &
echo $! > ../server.pid
```

השרת יופעל על פורט **10000** (ברירת מחדל).

## בדיקת שהשרת עובד

לאחר הפעלה, בדוק:

```bash
curl http://localhost:10000/api/health
```

אם הכל תקין, תראה:
```json
{"status":"healthy","timestamp":"...","service":"Specifys.AI Backend"}
```

## עצירת השרת

אם השרת רץ ברקע:

```bash
cd backend
kill $(cat server.pid)
```

או עצור את כל תהליכי השרת:

```bash
pkill -f "node.*server.js"
```

## פתרון בעיות

### שגיאת "Port already in use"

הפורט 10000 תפוס. עצור את השרת הישן:

```bash
lsof -ti:10000 | xargs kill -9
```

### שגיאת "Could not load Firebase credentials"

1. ודא שקובץ `.env` קיים בתיקיית `backend/`
2. ודא שהמשתנה `FIREBASE_SERVICE_ACCOUNT_KEY` מוגדר נכון
3. הפעל מחדש את השרת

### שגיאת "Module not found"

התקן מחדש את ה-dependencies:

```bash
cd backend
npm install
```

## משתני סביבה נדרשים

הקובץ `.env` צריך לכלול:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=specify-ai
FIREBASE_STORAGE_BUCKET=specify-ai.appspot.com
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Optional - Other configurations
PORT=10000
NODE_ENV=development
```

## הערות חשובות

- הקובץ `.env` **לא** נכנס ל-Git (כבר ב-`.gitignore`)
- ב-Production (Render), הגדר את המשתנים ב-Environment Variables של Render
- השרת רץ על פורט 10000 (ברירת מחדל)
- הלוגים נשמרים ב-`backend/server.log` (אם רץ ברקע)

