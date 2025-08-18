# Cloudflare Workers Deployment Guide

מדריך לפריסת שרת הפידבק על Cloudflare Workers

## יתרונות Cloudflare Workers

- **מהירות גבוהה** - רץ ב-200+ locations בעולם
- **עלות נמוכה** - $5 לחודש ל-10 מיליון requests
- **Scalability** - מתאים אוטומטית לעומס
- **אבטחה** - DDoS protection מובנה
- **Caching** - ביצועים מעולים

## שלב 1: יצירת Worker

1. היכנס ל-[Cloudflare Dashboard](https://dash.cloudflare.com/)
2. בחר את הדומיין שלך
3. לך ל-"Workers & Pages"
4. לחץ על "Create application"
5. בחר "Create Worker"
6. תן שם: `specifys-feedback`

## שלב 2: העתקת הקוד

1. העתק את התוכן מ-`cloudflare-worker.js`
2. הדבק בקוד ב-Worker editor
3. לחץ על "Save and deploy"

## שלב 3: הגדרת Environment Variables

1. ב-Worker editor, לך ל-"Settings" > "Variables"
2. הוסף את המשתנים הבאים:

### Environment Variables:
```
FEEDBACK_EMAIL=your-email@gmail.com
GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

### Secrets (אם נדרש):
```
SENDGRID_API_KEY=your_sendgrid_key
MAILGUN_API_KEY=your_mailgun_key
```

## שלב 4: הגדרת Custom Domain (אופציונלי)

1. ב-Worker editor, לך ל-"Settings" > "Triggers"
2. תחת "Custom Domains", לחץ על "Add Custom Domain"
3. הוסף: `feedback.yourdomain.com`
4. הגדר DNS records בהתאם

## שלב 5: בדיקת השרת

### בדיקה מקומית:
```bash
curl -X POST https://your-worker.your-subdomain.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","feedback":"Test feedback","type":"test"}'
```

### בדיקה מה-frontend:
עדכן את ה-URL ב-`try/index.html`:
```javascript
const serverUrl = 'https://your-worker.your-subdomain.workers.dev/api/feedback';
```

## שלב 6: הגדרת Email (אופציונלי)

### אפשרות 1: SendGrid
1. הירשם ל-[SendGrid](https://sendgrid.com/)
2. צור API Key
3. הוסף ל-Secrets: `SENDGRID_API_KEY`
4. עדכן את הקוד להשתמש ב-SendGrid

### אפשרות 2: Mailgun
1. הירשם ל-[Mailgun](https://www.mailgun.com/)
2. צור API Key
3. הוסף ל-Secrets: `MAILGUN_API_KEY`
4. עדכן את הקוד להשתמש ב-Mailgun

### אפשרות 3: Cloudflare Email Workers
1. הפעל Email Workers ב-Dashboard
2. הגדר domain verification
3. השתמש ב-Email Workers API

## שלב 7: Monitoring ו-Logs

### View Logs:
1. ב-Worker editor, לך ל-"Logs"
2. בדוק את ה-requests וה-responses
3. חפש שגיאות או בעיות

### Analytics:
1. ב-Worker editor, לך ל-"Analytics"
2. בדוק את ה-performance metrics
3. עקוב אחר ה-error rates

## Troubleshooting

### בעיות נפוצות:

#### CORS Errors:
- וודא שה-CORS headers מוגדרים נכון
- בדוק שה-Origin מותר

#### Email לא נשלח:
- בדוק שה-API keys נכונים
- וודא שה-email addresses תקינים
- בדוק את ה-logs לראות מה השתבש

#### Google Sheets לא עובד:
- בדוק שה-webhook URL נכון
- וודא שה-Script מוגדר נכון
- בדוק את ה-permissions

### Debug Mode:
הוסף console.log statements לקוד כדי לעקוב אחר הבעיות:

```javascript
console.log('Request received:', data)
console.log('Processing feedback...')
console.log('Email sent successfully')
```

## Cost Optimization

### Free Tier:
- 100,000 requests per day
- מתאים לרוב האתרים

### Paid Tier:
- $5/month ל-10M requests
- $0.50 per additional million

### Tips:
- השתמש ב-caching ככל האפשר
- הגבל את ה-request size
- השתמש ב-compression

## Security Considerations

### Rate Limiting:
```javascript
// Add rate limiting to prevent abuse
const rateLimit = new Map()
const MAX_REQUESTS = 10 // per minute per IP
```

### Input Validation:
```javascript
// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
if (email && !emailRegex.test(email)) {
  throw new Error('Invalid email format')
}
```

### CORS Restrictions:
```javascript
// Restrict to specific domains in production
'Access-Control-Allow-Origin': 'https://yourdomain.com'
```

## Backup & Recovery

### Version Control:
1. שמור גרסאות שונות של ה-Worker
2. השתמש ב-Git לניהול הקוד
3. תעד שינויים ב-README

### Rollback:
1. ב-Worker editor, לך ל-"Deployments"
2. בחר גרסה קודמת
3. לחץ על "Rollback"

## Support

### Cloudflare Support:
- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [Community Forum](https://community.cloudflare.com/)
- [Discord Server](https://discord.gg/cloudflare)

### Troubleshooting Resources:
- [Workers Examples](https://developers.cloudflare.com/workers/examples/)
- [Workers Tutorials](https://developers.cloudflare.com/workers/tutorials/)
- [Workers Recipes](https://developers.cloudflare.com/workers/recipes/)
