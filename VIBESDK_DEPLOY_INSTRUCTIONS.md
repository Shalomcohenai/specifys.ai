# הוראות Deploy ל-VibeSDK Worker

## הבעיה
ה-Worker מחזיר שגיאה: "Application domain is not set"
זה אומר שה-APPLICATION_DOMAIN לא הוגדר ב-Worker.

## פתרון

### שלב 1: ודא שה-wrangler.jsonc מעודכן
הקובץ צריך להכיל:
```jsonc
"vars": {
  ...
  "APPLICATION_DOMAIN": "vibesdk-production.shalom-cohen-111.workers.dev",
  ...
}
```

### שלב 2: Deploy את ה-Worker
```bash
cd /path/to/vibesdk-repo
npx wrangler deploy
```

### שלב 3: בדוק שה-deploy הצליח
לאחר ה-deploy, נסה:
```bash
curl -X POST "https://vibesdk-production.shalom-cohen-111.workers.dev/build?domain=vibesdk-production.shalom-cohen-111.workers.dev" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test","userId":"test"}'
```

אם אתה מקבל שגיאה אחרת (לא "Application domain is not set"), זה אומר שה-deploy הצליח.

### שלב 4: בדוק ב-Cloudflare Dashboard
1. לך ל-Cloudflare Dashboard > Workers & Pages
2. בחר את `vibesdk-production`
3. לך ל-Settings > Variables
4. ודא ש-APPLICATION_DOMAIN מוגדר שם

## הערה חשובה
אם ה-deploy לא עובד, ייתכן שצריך להגדיר את ה-var גם ב-Cloudflare Dashboard ישירות.
