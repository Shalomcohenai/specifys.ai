# Render Deployment Setup

## ⚠️ חשוב: מבנה הפרויקט

הפרויקט מורכב מ:
1. **Frontend** (תיקיית שורש) - אתר Jekyll סטטי
2. **Backend Server** (`backend/server/`) - שרת API שמגיש גם את ה-frontend

## 🚫 מה לא לעשות

**אל תיצור service ב-Render עבור התיקייה הראשית (root directory)!**

התיקייה הראשית מכילה את ה-frontend, אבל הוא מוגש על ידי ה-backend server (`specifys-backend`).

## ✅ Services שצריכים להיות ב-Render

### 1. specifys-backend
- **Type**: Web Service
- **Root Directory**: `backend`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment**: Node

זה השרת הראשי שמגיש:
- כל ה-API endpoints (`/api/*`)
- את ה-frontend הסטטי (קבצי HTML, CSS, JS מהתיקייה הראשית)
- כל שירותי החנות והתשלומים (Lemon Squeezy)

## 📝 הגדרת Render

אם אתה משתמש ב-`render.yaml`, הוא כבר מוגדר נכון. פשוט ודא שאין service נוסף ב-Render Dashboard שמנסה להריץ את התיקייה הראשית.

אם יש service כזה:
1. לך ל-Render Dashboard
2. מצא את ה-service שמנסה להריץ את התיקייה הראשית
3. מחק אותו או שנה את ה-Root Directory ל-`backend`

## 🔧 בדיקת תקינות

לאחר הפריסה, ודא:
- `specifys-backend` רץ בהצלחה
- אין service שמנסה להריץ את התיקייה הראשית

## 🐛 פתרון בעיות

אם אתה מקבל שגיאה:
```
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".html"
```

זה אומר שיש service שמנסה להריץ `node index.html` מהתיקייה הראשית. מחק את ה-service הזה ב-Render Dashboard.
