# Manual Render Deployment Instructions

## ✅ הבעיה שהייתה

Render היה מריץ את ענף `jekyll` אבל הקוד החדש (Lemon Squeezy API integration) היה על `purecash-system`.

## ✅ הפתרון

מיזגנו את כל השינויים מ‑`purecash-system` ל‑`jekyll` וה‑push בוצע בהצלחה!

**Status**: כל השינויים ב‑`jekyll` branch ב‑GitHub

## 🔄 איך לגרום ל‑Render לעשות Deploy

### אפשרות 1: אתחל ידני Deploy (מומלץ)

1. לך ל‑Render Dashboard → `specifys-ai` service
2. פתח את ה‑"Manual Deploy" menu
3. בחר "Deploy latest commit"
4. המתן 2–5 דקות

### אפשרות 2: Trigger Deploy דרך API

Render צריך להתחיל build אוטומטי אחרי push ל‑`jekyll`, אבל ניתן לכפות:

```bash
# אם יש לך API key
curl -X POST "https://api.render.com/owned/v1/services/{service_id}/deploys" \
  -H "Authorization: Bearer YOUR_RENDER_API_KEY"
```

### אפשרות 3: Force Restart Service

```bash
# Render dashboard → Service → Settings → Restart
```

## ✅ איך לוודא שה‑Deploy הצליח

### 1. בדוק Render Logs

Render Dashboard → `specifys-ai` → "Logs"

חפש:
```
✅ Server running on http://localhost:3001
✅ Available endpoints:
   POST /api/webhook/lemon - Lemon Squeezy webhook
   POST /api/checkout - Checkout API
```

### 2. בדוק `/api/status`

```bash
curl https://specifys-ai.onrender.com/api/status
```

Expected response:
```json
{"message":"Server is running"}
```

### 3. בדוק `/api/checkout` (עם Auth)

זה אמור לחזור 401 (Not Authorized) במקום 404 (Not Found):

```bash
curl -X POST https://specifys-ai.onrender.com/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"productId": "single_spec"}'
```

Expected response:
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

אם אתם מקבלים 404, הדפלוי לא הצליח. בדקו את הלוגים.

## 🔍 Debugging

### בעיה: עדיין 404 על `/api/checkout`

**פתרון:**
1. בדוק Render logs ל‑startup errors
2. ודא שה‑`backend/package.json` קיים
3. ודא שה‑`backend/server.js` קיים
4. ודא שה‑`backend/server/checkout-routes.js` קיים
5. ודא שה‑build command: `npm install` (ב‑backend directory)
6. ודא שה‑start command: `node server.js`

### בעיה: Server לא מתחיל

**בדקו logs:**
```
Loading environment variables...
OPENAI_API_KEY detected
🌐 Starting server on port 3001
✅ Server running on http://localhost:3001
```

אם מופיע **error**, חפשו:
- `Cannot find module` → חסר package ב‑package.json
- `Firebase initialization failed` → בעיה במשתני סביבה
- `Port already in use` → בעיה ב‑PORT configuration

### בעיה: Webhook לא עובד

**בדקו:**
1. `LEMON_WEBHOOK_SECRET` ב‑Render environment
2. Webhook URL ב‑Lemon Squeezy: `https://specifys-ai.onrender.com/api/webhook/lemon`
3. Logs ב‑Render בזמן webhook arrival

## 📊 Next Steps

לאחר דפלוי מוצלח:

1. ✅ בדוק `/api/status` מחזיר 200
2. ✅ בדוק `/api/checkout` מחזיר 401 (לא 404)
3. ✅ בדוק webhook test ב‑Lemon Squeezy → Render logs
4. ✅ הרץ רכישת test
5. ✅ ודא קרדיטים מתעדכנים

## 🎯 Success Indicators

הכל עובד אם:
- ✅ `/api/status` → 200
- ✅ `/api/checkout` → 401 (עם auth error, לא 404)
- ✅ Webhook test ב‑Lemon → 200
- ✅ Render logs מציגים Lemon Squeezy API calls
- ✅ רכישת test מעדכנת קרדיטים
- ✅ Polling מזהה שינויים

