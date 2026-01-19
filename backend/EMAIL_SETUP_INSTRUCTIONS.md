# Email System Setup Instructions

## בעיות שזוהו

1. ✅ **Endpoint `/api/admin/analytics/email` עובד** - השרת רץ עם הקוד החדש
2. ❌ **`RESEND_API_KEY` לא מוגדר** - לכן מיילים לא נשלחים

## הוראות הגדרה

### 1. הגדרת Resend API Key

1. היכנס ל-Resend Dashboard: https://resend.com/api-keys
2. צור API Key חדש (או השתמש בקיים)
3. העתק את ה-API Key (מתחיל ב-`re_`)

### 2. הגדרת From Email

1. ודא שיש לך דומיין מאומת ב-Resend
2. היכנס ל-Resend Dashboard > Domains
3. אם אין דומיין מאומת, הוסף אותו ועקוב אחר ההוראות לאימות

### 3. עדכון .env File

ערוך את הקובץ `backend/.env` והוסף:

```bash
# Resend Configuration
RESEND_API_KEY=re_your_actual_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

**חשוב:**
- החלף `re_your_actual_api_key_here` ב-API Key האמיתי שלך
- החלף `noreply@yourdomain.com` בכתובת מייל מהדומיין המאומת שלך
- ה-From Email חייב להיות מהדומיין המאומת ב-Resend

### 4. Restart השרת

לאחר עדכון ה-.env, הפעל מחדש את השרת:

```bash
cd backend
pkill -f "node.*server.js"
npm start
```

### 5. בדיקה

לאחר ההגדרה, בדוק שהכל עובד:

1. **בדיקת Email Service:**
   - השרת צריך להדפיס: `✅ Resend email service configured (RESEND_API_KEY)`
   - אם אתה רואה: `⚠️ Email configuration not found` - ה-API Key לא מוגדר נכון

2. **בדיקת שליחת מייל:**
   - נסה ליצור משתמש חדש - צריך להישלח welcome email
   - נסה ליצור spec - צריך להישלח spec ready email

3. **בדיקת Analytics:**
   - פתח את Admin Dashboard > Analytics
   - Email Analytics section צריך להציג נתונים

## Troubleshooting

### מיילים לא נשלחים

1. **בדוק שה-API Key תקין:**
   ```bash
   cd backend
   grep RESEND_API_KEY .env
   ```
   - ודא שהערך מתחיל ב-`re_`
   - ודא שאין רווחים או תווים מיותרים

2. **בדוק שה-From Email תקין:**
   ```bash
   grep RESEND_FROM_EMAIL .env
   ```
   - ודא שזה כתובת מהדומיין המאומת
   - ודא שהפורמט נכון (email@domain.com)

3. **בדוק את הלוגים:**
   - חפש ב-logs: `[EmailService] RESEND_API_KEY not configured`
   - אם אתה רואה את זה, ה-API Key לא מוגדר

### Endpoint לא נמצא (404)

אם אתה רואה `404` על `/api/admin/analytics/email`:
- השרת לא רץ עם הקוד החדש
- הפעל מחדש: `pkill -f "node.*server.js" && npm start`

### שגיאות אחרות

אם אתה רואה שגיאות אחרות:
- בדוק את הלוגים של השרת
- ודא שכל ה-dependencies מותקנים: `npm install`
- ודא שה-Firebase מוגדר נכון

## הערות

- **ב-Render (Production):** הוסף את המשתנים ב-Dashboard > Environment
- **ב-Local Development:** עדכן את `backend/.env`
- **אבטחה:** לעולם אל תעלה את `.env` ל-Git (הוא ב-.gitignore)

