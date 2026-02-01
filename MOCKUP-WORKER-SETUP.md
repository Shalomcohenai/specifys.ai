# Mockup Worker - הנחיות הטמעה

## סקירה כללית

ה-worker הזה (`worker-mockup.js`) הוא worker נפרד ליצירת mockups מ-specifications. הוא מטפל בשני endpoints:

1. **`/analyze-screens`** - מנתח את ה-specification ומזהה את כל המסכים שצריך ליצור
2. **`/generate-single-mockup`** - יוצר mockup HTML/CSS/JS בודד עבור מסך ספציפי

## שם ה-Worker

**Worker Name:** `mockup`  
**Full URL:** `https://mockup.shalom-cohen-111.workers.dev`

## שלבי ההטמעה

### 1. העלאת ה-Worker ל-Cloudflare

1. היכנס ל-[Cloudflare Dashboard](https://dash.cloudflare.com/)
2. בחר ב-**Workers & Pages**
3. לחץ על **Create application** → **Create Worker**
4. תן שם: `mockup`
5. העתק את כל התוכן מ-`worker-mockup.js` לתוך ה-editor
6. לחץ על **Save and deploy**

### 2. הגדרת Environment Variables

1. ב-Worker dashboard, לחץ על **Settings** → **Variables**
2. הוסף את המשתנה הבא:
   - **Variable Name:** `OPENAI_API_KEY`
   - **Value:** ה-API key שלך מ-OpenAI
   - **Type:** Secret (מומלץ)

### 3. בדיקת ה-Worker

#### בדיקת Health Check:
```bash
curl https://mockup.shalom-cohen-111.workers.dev/health
```

צריך להחזיר:
```json
{
  "status": "ok",
  "service": "mockup-worker",
  "version": "1.0"
}
```

#### בדיקת Analyze Screens:
```bash
curl -X POST https://mockup.shalom-cohen-111.workers.dev/analyze-screens \
  -H "Content-Type: application/json" \
  -d '{
    "overview": {
      "screenDescriptions": {
        "screens": [
          {
            "name": "Login Screen",
            "deviceType": "web"
          }
        ]
      }
    },
    "design": {
      "visualStyleGuide": {
        "colors": {
          "primary": "#FF6B35"
        }
      }
    }
  }'
```

### 4. עדכון CORS (אם נדרש)

ה-worker כבר מוגדר לאפשר requests מ:
- `https://specifys-ai.com`
- `https://www.specifys-ai.com`
- `http://localhost:3000` (לפיתוח)
- `http://localhost:8080` (לפיתוח)

אם אתה צריך להוסיף domains נוספים, עדכן את המערך `allowedOrigins` בפונקציה `cors()`.

## מבנה ה-Endpoints

### POST `/analyze-screens`

**Request Body:**
```json
{
  "overview": { ... },
  "design": { ... },
  "technical": { ... } // optional
}
```

**Response:**
```json
{
  "screens": [
    {
      "name": "Login Screen",
      "deviceType": "web",
      "description": "User authentication screen",
      "priority": 10
    }
  ],
  "correlationId": "...",
  "meta": {
    "version": "1.0",
    "totalScreens": 1,
    "analyzedAt": "2025-01-28T..."
  }
}
```

### POST `/generate-single-mockup`

**Request Body:**
```json
{
  "overview": { ... },
  "design": { ... },
  "technical": { ... }, // optional
  "screen": {
    "name": "Login Screen",
    "deviceType": "web",
    "description": "..."
  },
  "useMockData": true // optional, default: false
}
```

**Response:**
```json
{
  "mockup": {
    "name": "Login Screen",
    "deviceType": "web",
    "description": "...",
    "html": "<!DOCTYPE html>...",
    "generatedAt": "2025-01-28T...",
    "useMockData": true
  },
  "correlationId": "...",
  "meta": {
    "version": "1.0",
    "screenName": "Login Screen",
    "deviceType": "web"
  }
}
```

## עלויות ו-Limits

- **Model:** `gpt-4o-mini` (זול יחסית)
- **Temperature:** 
  - `analyze-screens`: 0.3 (יותר דטרמיניסטי)
  - `generate-single-mockup`: 0.5 (יותר יצירתי)

## טיפול בשגיאות

ה-worker מטפל בשגיאות הבאות:
- **400 BAD_REQUEST** - נתונים חסרים או לא תקינים
- **404 NOT_FOUND** - Route לא קיים
- **422 NO_SCREENS_FOUND** - לא נמצאו מסכים ב-specification
- **500 SERVER_ERROR** - שגיאה כללית
- **502 OPENAI_UPSTREAM_ERROR** - שגיאה מ-OpenAI API

## בדיקות נוספות

לאחר ההטמעה, בדוק:
1. ✅ Health check endpoint עובד
2. ✅ Analyze screens מחזיר מסכים
3. ✅ Generate mockup יוצר HTML תקין
4. ✅ CORS עובד מ-production domain
5. ✅ ה-mockups מוצגים נכון ב-spec-viewer

## Troubleshooting

### שגיאת 404
- ודא שה-worker נקרא `mockup` ב-Cloudflare
- ודא שה-endpoints נכונים: `/analyze-screens` ו-`/generate-single-mockup`

### שגיאת CORS
- ודא שה-origin מותר ב-`allowedOrigins`
- בדוק שה-request נשלח עם header `Origin`

### שגיאת OpenAI
- ודא ש-`OPENAI_API_KEY` מוגדר נכון
- בדוק שיש מספיק credits ב-OpenAI account
- בדוק את ה-logs ב-Cloudflare Workers dashboard

### Mockups לא נראים טוב
- בדוק שה-design specification מלא ומפורט
- נסה עם `useMockData: true` לראות אם זה עוזר
- בדוק את ה-HTML שנוצר ב-console

## הערות חשובות

1. **ביזור:** ה-worker הזה נפרד מה-worker של prompts (`worker-promtmaker-updated.js`) כדי לשמור על יציבות
2. **Performance:** כל mockup נוצר בנפרד, כך שאם אחד נכשל, האחרים עדיין יעבדו
3. **Retry Logic:** ה-retry logic נמצא ב-client (`spec-viewer-main.js`), לא ב-worker

## עדכונים עתידיים

אפשר להוסיף:
- Caching של mockups שכבר נוצרו
- Batch generation (יצירת כמה mockups בבת אחת)
- תמיכה ב-templates נוספים
- תמיכה ב-export ל-PDF/PNG

