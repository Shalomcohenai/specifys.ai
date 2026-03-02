# תיעוד Specifys.ai

מבנה התיעוד והקבצים המסדרים בפרויקט.

## ארכיטקטורה (`architecture/`)

| קובץ | תיאור |
|------|--------|
| [API.md](architecture/API.md) | תיעוד API: endpoints, אימות, rate limits, דוגמאות |
| [DATABASE_SCHEMA.md](architecture/DATABASE_SCHEMA.md) | סכמת Firestore: collections, שדות, קשרים, user_credits_v3 |
| [DESIGN-SYSTEM.md](architecture/DESIGN-SYSTEM.md) | מערכת עיצוב: tokens, קומפוננטות, utilities, SCSS |
| [MONOREPO.md](architecture/MONOREPO.md) | מבנה Monorepo: packages, backend, workspaces |
| [JEKYLL-STYLE-SCSS-SOLUTION.md](architecture/JEKYLL-STYLE-SCSS-SOLUTION.md) | פתרון היסטורי ל-style.scss ב-Jekyll |

## הגדרות (`setup/`)

הגדרות שירותים: Firebase, SEO, GA4, Lemon Squeezy, Render, MCP, webhooks ועוד.

- [run-system-per-user.md](setup/run-system-per-user.md) – הפעלת המערכת במצב Per-User (מפתח MCP לכל משתמש), הוראות מפורטות בעברית.

## מדריכים (`guides/`)

מדריכי עבודה: יצירת דפים, Testing, Logging, Simulation.

## צ'קליסטים (`checklists/`)

תצורת דפים, אבטחה, migration, QA ל-Production.

## הפניות (`references/`)

| קובץ | תיאור |
|------|--------|
| [SITE-MAP.md](references/SITE-MAP.md) | מפת דפים, backend, Data Model, זרימות עיקריות |
| [WEBSITE-TECHNICAL-OPERATIONAL-GUIDE-HE.md](references/WEBSITE-TECHNICAL-OPERATIONAL-GUIDE-HE.md) | מדריך טכני־תפעולי בעברית |
| [API-EXAMPLES.md](references/API-EXAMPLES.md) | דוגמאות שימוש ב-API |
| [CI-CD.md](references/CI-CD.md) | אינטגרציה ופריסה |

## בדיקות (`testing/`)

דוחות בדיקות ו-migration (למשל V3).

---

**עדכון אחרון:** מרץ 2025
