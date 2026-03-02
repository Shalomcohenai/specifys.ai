# הפעלת המערכת – שימוש Per-User (מפתח לכל משתמש)

מדריך להפעלת Specifys.ai במצב **per-user**: כל משתמש מקבל מפתח MCP משלו, והמערכת מציגה רק את הספקים שלו. אין צורך להגדיר `MCP_API_KEY` או `MCP_API_USER_ID` ב-backend.

---

## 1. Backend (חובה)

### 1.1 התקנה

```bash
cd backend
npm install
cd server
npm install
```

### 1.2 משתני סביבה

צור קובץ `.env` בתיקיית `backend/` (או השתמש ב-`env-template.txt` כמקור).

**לשימוש Per-User – מינימום נדרש:**

- **Firebase:** אחד מהבאים:
  - `FIREBASE_SERVICE_ACCOUNT_KEY` – JSON מלא של Service Account (שורה אחת), **או**
  - קובץ `firebase-service-account.json` בתיקיית `backend/`
- לפי צורך: `PORT`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET` (אם שונים מברירת המחדל).

**לא נדרש ל-MCP Per-User:**  
אין צורך ב-`MCP_API_KEY` או `MCP_API_USER_ID`. המשתמשים יוצרים מפתחות דרך האתר או ה-API.

### 1.3 הפעלת השרת

```bash
cd backend/server
node server.js
```

השרת רץ על פורט **10000** (ברירת מחדל). בדיקה:

```bash
curl http://localhost:10000/api/health
```

תשובה תקינה: `{"status":"healthy",...}`.

---

## 2. אתר (Frontend) – אופציונלי ליצירת מפתח

אם האתר רץ (Jekyll / GitHub Pages וכו') ומחובר לאותו backend:

1. משתמש נכנס לחשבון.
2. **פרופיל** → **Personal Info** (פתיחת הפאנל).
3. בחלק **MCP API Key**:
   - **Create API key** – יצירת מפתח (מוצג פעם אחת; מומלץ להעתיק).
   - **Regenerate key** – החלפת מפתח (המפתח הישן מפסיק לעבוד).

המפתח מועתק ללוח; יש להדביק אותו ב-Cursor או Claude Desktop (ראה להלן).

אם אין גישה לאתר: אפשר ליצור מפתח דרך ה-API עם טוקן Firebase – ראה [MCP Setup](./mcp.md).

---

## 3. MCP Server (לשימוש ב-Cursor / Claude Desktop)

### 3.1 בנייה

```bash
cd mcp-server
npm install
npm run build
```

### 3.2 משתנים

- **חובה:** `SPECIFYS_API_KEY` – המפתח שקיבלת (מהאתר או מ-`POST /api/users/me/mcp-api-key`).
- **אופציונלי:** `SPECIFYS_API_BASE_URL` – אם ה-backend לא על `http://localhost:10000`, הגדר כאן (למשל `https://your-backend.onrender.com`).

### 3.3 הרצה ידנית (בדיקה)

```bash
SPECIFYS_API_KEY=המפתח_שלך node dist/index.js
```

עם backend מרוחק:

```bash
SPECIFYS_API_KEY=המפתח_שלך SPECIFYS_API_BASE_URL=https://your-backend.com node dist/index.js
```

---

## 4. חיבור Cursor

1. פתח **Cursor Settings** → **MCP** (או קובץ התצורה של MCP).
2. הוסף שרת בשם `specifys`:

```json
{
  "mcpServers": {
    "specifys": {
      "command": "node",
      "args": ["/נתיב/המלא/אל/specifys-ai/mcp-server/dist/index.js"],
      "env": {
        "SPECIFYS_API_KEY": "המפתח_שלך",
        "SPECIFYS_API_BASE_URL": "http://localhost:10000"
      }
    }
  }
}
```

- החלף `המפתח_שלך` במפתח שיצרת בפרופיל (או ב-API).
- אם ה-backend על שרת מרוחק, החלף את `SPECIFYS_API_BASE_URL` ב-URL הנכון.
- ב-Windows: השתמש בנתיב מלא עם `\\`, למשל `C:\\path\\to\\specifys-ai\\mcp-server\\dist\\index.js`.

3. אתחל מחדש את Cursor (או טען מחדש את MCP) כדי שהשינוי ייכנס לתוקף.

---

## 5. חיבור Claude Desktop

1. ערוך את קובץ התצורה:
   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
2. הוסף (או עדכן) את `mcpServers`:

```json
{
  "mcpServers": {
    "specifys": {
      "command": "node",
      "args": ["/נתיב/המלא/אל/specifys-ai/mcp-server/dist/index.js"],
      "env": {
        "SPECIFYS_API_KEY": "המפתח_שלך",
        "SPECIFYS_API_BASE_URL": "https://your-backend.com"
      }
    }
  }
}
```

3. הפעל מחדש את Claude Desktop.

---

## 6. צ'קליסט הפעלה

| שלב | פעולה | סטטוס |
|-----|--------|--------|
| 1 | Backend: `.env` עם Firebase (ללא MCP_API_KEY/MCP_API_USER_ID) | ☐ |
| 2 | Backend: `node server.js` רץ, `curl .../api/health` מחזיר healthy | ☐ |
| 3 | משתמש: כניסה לאתר → פרופיל → Personal Info → MCP API Key → Create (או Regenerate) | ☐ |
| 4 | העתקת המפתח ושמירה במקום בטוח | ☐ |
| 5 | MCP Server: `npm run build` ב-`mcp-server/` | ☐ |
| 6 | Cursor/Claude: הוספת `specifys` עם `SPECIFYS_API_KEY` ו-`SPECIFYS_API_BASE_URL` | ☐ |
| 7 | אתחול Cursor/Claude מחדש ובדיקה (למשל `list_my_specs`) | ☐ |

---

## פתרון בעיות

- **"API key required"** – וודא ש-`SPECIFYS_API_KEY` מוגדר ב-`env` של ה-MCP ב-Cursor/Claude.
- **401 / Invalid API key** – המפתח לא תואם. צור מפתח חדש בפרופיל (או ב-API) והחלף ב-`SPECIFYS_API_KEY`.
- **Connection refused** – וודא שה-backend רץ ושה-`SPECIFYS_API_BASE_URL` מצביע לכתובת הנכונה (localhost או שרת מרוחק).

מסמך MCP מפורט (אנגלית): [mcp.md](./mcp.md).
