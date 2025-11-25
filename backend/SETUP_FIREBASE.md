# הגדרת Firebase Service Account

## שיטה 1: משתנה סביבה (מומלץ ל-Production/Render)

1. פתח את קובץ ה-`firebase-service-account.json` ב-Render (או מהמחשב שלך)
2. העתק את כל התוכן של הקובץ (כולל הסוגריים `{}`)
3. ב-Render Dashboard:
   - לך ל-Environment Variables
   - הוסף משתנה חדש:
     - **Key**: `FIREBASE_SERVICE_ACCOUNT_KEY`
     - **Value**: הדבק את כל התוכן של הקובץ JSON כ-string אחד (ללא שורות חדשות)
   
   **דוגמה:**
   ```
   FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"specify-ai","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}
   ```

4. שמור והפעל מחדש את השרת

## שיטה 2: קובץ מקומי (ל-Development בלבד)

1. העתק את קובץ `firebase-service-account.json` לתיקיית `backend/`
2. הקובץ כבר ב-`.gitignore` אז הוא לא יכנס ל-Git
3. השרת יזהה אותו אוטומטית

## שיטה 3: משתנה סביבה מקומי (.env)

1. צור קובץ `.env` בתיקיית `backend/` (אם עדיין לא קיים)
2. הוסף את השורה:
   ```
   FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
   ```
   (הדבק את כל התוכן של הקובץ JSON כ-string אחד)

3. השרת יקרא את זה אוטומטית דרך `dotenv`

## אימות שההגדרה עובדת

לאחר ההגדרה, הפעל מחדש את השרת ובדוק:
```bash
curl http://localhost:10000/api/health
```

אם הכל תקין, תראה תשובה עם `"status":"healthy"`.

## הערות חשובות

- **אל תעשה commit** של קובץ `firebase-service-account.json` או של קובץ `.env` ל-Git
- הקובץ `.env` כבר ב-`.gitignore` אז הוא בטוח
- ב-Render, השתמש תמיד במשתנה סביבה `FIREBASE_SERVICE_ACCOUNT_KEY`

