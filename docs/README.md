# תיעוד Specifys.ai

מבנה התיעוד והקבצים המסדרים בפרויקט.

## ארכיטקטורה (`architecture/`)

| קובץ | תיאור |
|------|--------|
| [**ARCHITECTURE.md**](architecture/ARCHITECTURE.md) | **מסמך הארכיטקטורה המרכזי** — תיאור מלא של כל המערכת: backend, frontend, Firestore, spec engine v2, credits, payments, chat, MCP, workers, deployment, flows מרכזיים, בעיות ידועות |

## הגדרות (`setup/`)

הגדרות שירותים: Firebase, SEO, GA4, Lemon Squeezy, Render, webhooks ועוד.

- [mcp.md](setup/mcp.md) – התקנת שרת MCP (Cursor / Claude Desktop): API key, חיבור, כלים ומשאבים (specs, tools).
- [run-system-per-user.md](setup/run-system-per-user.md) – הפעלת המערכת במצב Per-User (מפתח MCP לכל משתמש), הוראות מפורטות בעברית.

## מדריכים (`guides/`)

מדריכי עבודה: יצירת דפים, Testing, Logging, Simulation.

## צ'קליסטים (`checklists/`)

תצורת דפים, אבטחה, migration, QA ל-Production.

## הפניות (`references/`)

| קובץ | תיאור |
|------|--------|
| [SITE-MAP.md](references/SITE-MAP.md) | מפת דפים, backend, Data Model, MCP, Tools Map, זרימות עיקריות |
| [TOOLS-MAP-DATA.md](references/TOOLS-MAP-DATA.md) | מפת כלי Vibe Coding: Firestore כ־source of truth, export ל־tools.json, automation |
| [WEBSITE-TECHNICAL-OPERATIONAL-GUIDE-HE.md](references/WEBSITE-TECHNICAL-OPERATIONAL-GUIDE-HE.md) | מדריך טכני־תפעולי בעברית |
| [API-EXAMPLES.md](references/API-EXAMPLES.md) | דוגמאות שימוש ב-API |
| [CI-CD.md](references/CI-CD.md) | אינטגרציה ופריסה |

## בדיקות (`testing/`)

דוחות בדיקות ו-migration (למשל V3).

---

**עדכון אחרון:** אפריל 2026
