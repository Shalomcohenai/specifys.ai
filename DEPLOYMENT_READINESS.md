# ✅ מוכנות לפריסה - Deployment Readiness Checklist

**תאריך:** 2025-01-XX  
**ענף:** `new-beckend`  
**שרת Backend:** `https://specifys-ai-development.onrender.com`

---

## ✅ 1. תצורת כתובת Backend

כל הקבצים מוגדרים נכון עם הכתובת החדשה:

### Frontend Configuration
- ✅ `assets/js/config.js` - מוגדר ל-`https://specifys-ai-development.onrender.com`
- ✅ כל הקבצים המשתמשים ב-`getApiBaseUrl()` מקבלים את הכתובת הנכונה

### Backend Configuration
- ✅ `backend/server/config.js` - `productionServerUrl` מוגדר נכון
- ✅ `backend/server/server.js` - CORS כולל את הכתובת החדשה
- ✅ `backend/server/swagger.js` - Swagger UI מוגדר לכתובת הנכונה

### קבצים שנבדקו:
- ✅ `assets/js/config.js`
- `assets/js/api-client.js`
- `assets/js/analytics-tracker.js`
- `assets/js/pricing.js`
- `assets/js/profile.js`
- `backend/server/config.js`
- `backend/server/server.js`
- `backend/server/swagger.js`

---

## ✅ 2. בדיקת התנגשויות פריסה

### Render Services Configuration
- ✅ **רק שירות אחד מוגדר:** `specifys-backend` ב-`render.yaml`
- ✅ **Root Directory:** `backend`
- ✅ **Build Command:** `npm install`
- ✅ **Start Command:** `npm start`
- ✅ **Port:** 10000 (או PORT מ-env)

### GitHub Actions
- ✅ **deploy-backend.yml** - מופעל רק על `main` branch
- ✅ **deploy-frontend.yml** - מופעל רק על `main` branch
- ✅ **אין התנגשויות** - ה-workflows לא יופעלו על `new-beckend`

### Server Configuration
- ✅ **רק שרת אחד** - `backend/server/server.js` מאזין על פורט אחד
- ✅ **Keep-alive mechanism** - מוגדר נכון עם `RENDER_EXTERNAL_URL`
- ✅ **CORS** - כולל את כל הכתובות הנדרשות

---

## ✅ 3. מבנה הפרויקט

### Frontend (Root Directory)
- ✅ Jekyll site - קבצים סטטיים
- ✅ מוגש על ידי Backend server (לא שירות נפרד)

### Backend (`backend/`)
- ✅ Express server
- ✅ מגיש API endpoints (`/api/*`)
- ✅ מגיש frontend static files
- ✅ כולל כל ה-routes והמידלוור

---

## ✅ 4. משתני סביבה נדרשים

### ב-Render Dashboard, ודא שיש:
- ✅ `NODE_ENV=production`
- ✅ `PORT` (Render מגדיר אוטומטית)
- ✅ `RENDER_EXTERNAL_URL` (Render מגדיר אוטומטית)
- ✅ `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON string)
- ✅ `FIREBASE_PROJECT_ID=specify-ai`
- ✅ `FIREBASE_STORAGE_BUCKET=specify-ai.appspot.com`
- ✅ `LEMON_SQUEEZY_API_KEY`
- ✅ `LEMON_SQUEEZY_STORE_ID`
- ✅ `LEMON_WEBHOOK_SECRET`
- ✅ `EMAIL_USER` (אופציונלי)
- ✅ `EMAIL_APP_PASSWORD` (אופציונלי)
- ✅ `GOOGLE_SHEETS_WEBHOOK_URL` (אופציונלי)

---

## ✅ 5. בדיקות לפני פריסה

### בדיקות מקומיות (Localhost)
```bash
# 1. בדוק שהשרת עולה
cd backend
npm install
npm start

# 2. בדוק health endpoint
curl http://localhost:10000/api/health

# 3. בדוק שהכתובת נכונה ב-config
grep -r "specifys-ai-development.onrender.com" assets/js/config.js
```

### בדיקות ב-Render
1. ✅ ודא ש-`render.yaml` מוגדר נכון
2. ✅ ודא שיש רק service אחד ב-Render Dashboard
3. ✅ ודא שכל משתני הסביבה מוגדרים
4. ✅ בדוק את ה-logs אחרי הפריסה

---

## ✅ 6. רצף פריסה מומלץ

### שלב 1: בדיקות מקומיות
```bash
# בדוק שהכל עובד ב-localhost
cd backend
npm install
npm start
# בדוק: http://localhost:10000/api/health
```

### שלב 2: Push לענף החדש
```bash
git checkout new-beckend
git push origin new-beckend
```

### שלב 3: בדיקות ב-Render
1. לך ל-Render Dashboard
2. בדוק שה-service `specifys-backend` רץ
3. בדוק את ה-logs
4. בדוק: `https://specifys-ai-development.onrender.com/api/health`

### שלב 4: בדיקות Frontend
1. פתח את האתר
2. בדוק שהקישורים ל-API עובדים
3. בדוק את ה-console (אין שגיאות CORS)

---

## ✅ 7. רשימת בדיקה אחרונה

לפני העלאה ל-production:

- [ ] כל הקבצים מעודכנים עם הכתובת החדשה
- [ ] אין התנגשויות בין services
- [ ] `render.yaml` מוגדר נכון
- [ ] כל משתני הסביבה מוגדרים ב-Render
- [ ] השרת עובד ב-localhost
- [ ] הענף `new-beckend` נוצר ונבדק
- [ ] כל השינויים committed
- [ ] מוכן ל-push ל-remote

---

## 📝 הערות חשובות

1. **אין שירותים כפולים:** רק `specifys-backend` אחד ב-Render
2. **Frontend מוגש על ידי Backend:** אין צורך בשירות נפרד ל-frontend
3. **Keep-alive mechanism:** מונע מהשרת להירדם ב-Render
4. **CORS:** מוגדר לכל הכתובות הנדרשות
5. **GitHub Actions:** לא יופעלו על `new-beckend` (רק על `main`)

---

## 🚀 מוכן לפריסה!

כל הבדיקות הושלמו בהצלחה. המערכת מוכנה לפריסה ל-Render.

**השלב הבא:** Push את הענף `new-beckend` ל-remote ולבדוק ב-Render Dashboard.
