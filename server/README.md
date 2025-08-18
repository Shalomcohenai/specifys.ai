# Feedback Server Setup

שרת Node.js לניהול פידבק משתמשים עם שליחת מיילים ושמירה ב-Google Sheets.

## התקנה

1. **התקן דפנדנסיז:**
```bash
npm install
```

2. **צור קובץ .env:**
```bash
cp .env.example .env
```

3. **עדכן את המשתנים ב-.env:**
```env
# Server Configuration
PORT=10000

# API Keys
API_KEY=your_openai_api_key_here

# Email Configuration (for Nodemailer)
EMAIL_USER=your_gmail@gmail.com
EMAIL_APP_PASSWORD=your_gmail_app_password
FEEDBACK_EMAIL=feedback@yourdomain.com

# Google Sheets Configuration
GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec

# Alternative: Direct Google Sheets API
GOOGLE_SHEETS_CREDENTIALS_FILE=path/to/credentials.json
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
```

## הגדרת Email

### אפשרות 1: Gmail עם Nodemailer
1. הפעל "2-Factor Authentication" בחשבון Gmail
2. צור "App Password" ב-Google Account Settings
3. השתמש ב-App Password ב-EMAIL_APP_PASSWORD

### אפשרות 2: SendGrid
1. הירשם ל-SendGrid
2. צור API Key
3. עדכן את הקוד להשתמש ב-SendGrid במקום Nodemailer

### אפשרות 3: Cloudflare Workers
1. צור Worker חדש ב-Cloudflare
2. השתמש ב-Email Workers API
3. עדכן את הקוד להשתמש ב-Worker

## הגדרת Google Sheets

### אפשרות 1: Google Apps Script Webhook
1. צור Google Apps Script חדש
2. הוסף את הקוד הבא:

```javascript
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    sheet.appendRow([
      new Date(),
      data.email || 'Not provided',
      data.feedback,
      data.type || 'general',
      data.source || 'unknown'
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({success: true}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

3. Deploy כ-Web App
4. העתק את ה-URL ל-GOOGLE_SHEETS_WEBHOOK_URL

### אפשרות 2: Google Sheets API ישיר
1. הפעל Google Sheets API
2. צור Service Account
3. הורד credentials.json
4. שתף את ה-Spreadsheet עם Service Account Email

## הפעלת השרת

```bash
npm start
```

השרת יפעל על http://localhost:10000

## Endpoints

### POST /api/feedback
שולח פידבק ומייל, שומר ב-Sheets

**Body:**
```json
{
  "email": "user@example.com",
  "feedback": "This is great!",
  "type": "user_feedback"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback submitted successfully"
}
```

## בדיקת השרת

```bash
curl -X POST http://localhost:10000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","feedback":"Test feedback","type":"test"}'
```

## Troubleshooting

### בעיות Email:
- בדוק שה-App Password נכון
- וודא ש-2FA מופעל ב-Gmail
- בדוק שה-EMAIL_USER נכון

### בעיות Google Sheets:
- וודא שה-Webhook URL נכון
- בדוק שה-Spreadsheet נגיש
- בדוק את ה-Logs ב-Google Apps Script

### בעיות CORS:
- השרת מוגדר לאפשר CORS מ-* (לפיתוח)
- לפרודקשן, הגבל ל-domains ספציפיים
