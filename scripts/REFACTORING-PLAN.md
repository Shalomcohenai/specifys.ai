---
name: Project Structure Refactoring
overview: "ארגון מחדש מלא של מבנה הפרויקט: העברת scripts לתיקייה מאורגנת, ארגון קבצי JavaScript לפי features, ניקוי קבצים מיותרים, וארגון תיקיית docs - כולל עדכון כל הלינקים והקישורים."
todos:
  - id: scripts-org
    content: יצירת scripts/ וארגון כל ה-scripts (blog + backend)
    status: completed
  - id: js-features
    content: ארגון JavaScript files לפי features (spec-viewer, legacy-viewer, demo-spec, index, profile, question-flow, planning)
    status: completed
  - id: js-core-services-utils
    content: ארגון JavaScript files ל-core, services, utils, pages
    status: completed
  - id: update-html-links
    content: עדכון כל הלינקים ב-HTML files (spec-viewer, legacy-viewer, demo-spec, profile, planning, ToolPicker, index)
    status: completed
    dependencies:
      - js-features
      - js-core-services-utils
  - id: update-bundles-imports
    content: עדכון imports ב-bundles files (home.js, utils.js)
    status: completed
    dependencies:
      - js-features
      - js-core-services-utils
  - id: update-head-includes
    content: עדכון _includes/head.html עם paths חדשים
    status: completed
    dependencies:
      - js-core-services-utils
  - id: move-prompts
    content: העברת tools/prompts.js ל-assets/js/services/
    status: completed
  - id: delete-backup-files
    content: מחיקת קבצי backup, test, duplicates
    status: completed
  - id: organize-docs
    content: ארגון docs/ לתת-תיקיות (setup, guides, architecture, checklists, references)
    status: completed
  - id: update-config-files
    content: עדכון _config.yml, .gitignore, README.md, backend/SETUP.md, docs/TESTING-WAKEUP.md
    status: completed
    dependencies:
      - scripts-org
  - id: create-plan-file
    content: יצירת scripts/REFACTORING-PLAN.md עם התכנון המלא
    status: in_progress
  - id: testing
    content: "בדיקות: Jekyll build, Vite build, HTML links, scripts functionality"
    status: pending
    dependencies:
      - update-html-links
      - update-bundles-imports
      - update-head-includes
      - update-config-files
---

# תכנון ארגון מחדש של מבנה הפרויקט

## סקירה כללית

התכנון כולל:

1. יצירת תיקיית `scripts/` וארגון כל ה-scripts
2. ארגון קבצי JavaScript לפי features
3. מחיקת קבצים מיותרים (backup, test, duplicates)
4. ארגון תיקיית `docs/` לתת-תיקיות
5. עדכון כל הלינקים והקישורים
6. עדכון קבצי תצורה

## שלב 1: יצירת מבנה Scripts מאורגן

### 1.1 יצירת תיקיית scripts/

```
scripts/
  ├── blog/
  │   ├── create-post.js
  │   ├── create-post.sh
  │   └── create-post.bat
  ├── backend/
  │   ├── start-server.sh
  │   ├── restart-server.sh
  │   ├── deploy.sh
  │   ├── setup.sh
  │   ├── test-api.sh
  │   └── test-wakeup.sh
  └── README.md
```

**קבצים להעביר:**

- `create-post.js`, `create-post.sh`, `create-post.bat` → `scripts/blog/`
- `backend/start-server.sh`, `backend/restart-server.sh`, `backend/deploy.sh`, `backend/setup.sh`, `backend/test-api.sh`, `backend/test-wakeup.sh` → `scripts/backend/`

**קבצים למחוק (כפילות):**

- `backend/server/start-server.sh` (כפילות)
- `backend/server/start-server.bat` (כפילות)

**קבצים לעדכן:**

- `backend/restart-server.sh` - עדכון path (שורה 14: `/Users/shalom/Desktop/new/specifys-dark-mode/backend` → path יחסי)
- `README.md` - עדכון הפניה ל-`scripts/backend/start-server.sh`
- `docs/TESTING-WAKEUP.md` - עדכון הפניות ל-scripts
- `backend/SETUP.md` - עדכון הפניות ל-scripts

## שלב 2: ארגון קבצי JavaScript

### 2.1 מבנה חדש ל-assets/js/

```
assets/js/
  ├── bundles/ (להישאר)
  ├── components/ (להישאר)
  ├── new-admin-dashboard/ (להישאר)
  ├── features/
  │   ├── spec-viewer/
  │   │   ├── spec-viewer-main.js
  │   │   ├── spec-viewer-auth.js
  │   │   ├── spec-viewer-chat.js
  │   │   ├── spec-viewer-firebase.js
  │   │   ├── spec-viewer-event-handlers.js
  │   │   ├── spec-viewer-api-helper.js
  │   │   └── spec-viewer-scroll.js
  │   ├── legacy-viewer/
  │   │   ├── legacy-viewer-main.js
  │   │   ├── legacy-viewer-firebase.js
  │   │   └── legacy-viewer-scroll.js
  │   ├── demo-spec/
  │   │   ├── demo-spec-formatter.js
  │   │   ├── demo-spec-charts.js
  │   │   └── demo-spec-data.js
  │   ├── index/
  │   │   ├── index.js
  │   │   ├── index-demo-scroll.js
  │   │   ├── index-mermaid.js
  │   │   ├── index-vanta.js
  │   │   └── index-access-code.js
  │   ├── profile/
  │   │   ├── profile.js
  │   │   └── profile-scroll.js
  │   ├── question-flow/
  │   │   ├── question-flow-controller.js
  │   │   ├── question-flow-state.js
  │   │   └── question-flow-view.js
  │   └── planning/
  │       └── planning.js
  ├── core/
  │   ├── config.js
  │   ├── security-utils.js
  │   ├── css-monitor.js
  │   ├── store.js
  │   └── app-logger.js
  ├── services/
  │   ├── api-client.js
  │   ├── spec-cache.js
  │   ├── spec-error-handler.js
  │   ├── spec-events.js
  │   └── analytics-tracker.js
  ├── utils/
  │   ├── spec-formatter.js
  │   ├── typingEffect.js
  │   ├── mobile-optimizations.js
  │   ├── focus-manager.js
  │   └── web-vitals.js
  └── pages/ (קבצי pages ספציפיים)
      ├── academy.js
      ├── admin-academy.js
      ├── admin-dashboard.js
      ├── article.js
      ├── articles.js
      ├── articles-manager.js
      ├── blog-loader.js
      ├── blog-manager.js
      ├── post-loader.js
      ├── post.js
      ├── pricing.js
      ├── toolpicker.js
      ├── why.js
      ├── analytics-schema.js
      ├── credits-v3-display.js
      └── credits-v3-manager.js
```

### 2.2 קבצים להעביר

**ל-features/spec-viewer/:**

- `spec-viewer-main.js`
- `spec-viewer-auth.js`
- `spec-viewer-chat.js`
- `spec-viewer-firebase.js`
- `spec-viewer-event-handlers.js`
- `spec-viewer-api-helper.js`
- `spec-viewer-scroll.js`

**ל-features/legacy-viewer/:**

- `legacy-viewer-main.js`
- `legacy-viewer-firebase.js`
- `legacy-viewer-scroll.js`

**ל-features/demo-spec/:**

- `demo-spec-formatter.js`
- `demo-spec-charts.js`
- `demo-spec-data.js`

**ל-features/index/:**

- `index.js`
- `index-demo-scroll.js`
- `index-mermaid.js`
- `index-vanta.js`
- `index-access-code.js`

**ל-features/profile/:**

- `profile.js`
- `profile-scroll.js`

**ל-features/question-flow/:**

- `question-flow-controller.js`
- `question-flow-state.js`
- `question-flow-view.js`

**ל-features/planning/:**

- `planning.js`

**ל-core/:**

- `config.js`
- `security-utils.js`
- `css-monitor.js`
- `store.js`
- `app-logger.js`

**ל-services/:**

- `api-client.js`
- `spec-cache.js`
- `spec-error-handler.js`
- `spec-events.js`
- `analytics-tracker.js`

**ל-utils/:**

- `spec-formatter.js`
- `typingEffect.js`
- `mobile-optimizations.js`
- `focus-manager.js`
- `web-vitals.js`

**ל-pages/ (להישאר ב-root):**

- כל הקבצים הנותרים

### 2.3 עדכון לינקים ב-HTML

**קבצים לעדכן:**

1. **`pages/spec-viewer.html`** (שורות 13-30):

   - `/assets/js/spec-viewer-*.js` → `/assets/js/features/spec-viewer/spec-viewer-*.js`
   - `/assets/js/spec-cache.js` → `/assets/js/services/spec-cache.js`
   - `/assets/js/spec-error-handler.js` → `/assets/js/services/spec-error-handler.js`
   - `/assets/js/spec-events.js` → `/assets/js/services/spec-events.js`

2. **`pages/legacy-viewer.html`** (שורות 12-19):

   - `/assets/js/legacy-viewer-*.js` → `/assets/js/features/legacy-viewer/legacy-viewer-*.js`

3. **`pages/demo-spec.html`** (בסוף הקובץ - inline script):

   - `demo-spec-formatter.js`, `demo-spec-charts.js`, `demo-spec-data.js` → paths חדשים

4. **`pages/profile.html`** (שורות 11-14):

   - `/assets/js/profile.js` → `/assets/js/features/profile/profile.js`
   - `/assets/js/profile-scroll.js` → `/assets/js/features/profile/profile-scroll.js`

5. **`pages/planning.html`** (שורה 9):

   - `/assets/js/planning.js` → `/assets/js/features/planning/planning.js`

6. **`pages/ToolPicker.html`** (שורות 9-11):

   - `/assets/js/index.js` → `/assets/js/features/index/index.js`
   - `/assets/js/toolpicker.js` → להישאר (pages/)
   - `/assets/js/typingEffect.js` → `/assets/js/utils/typingEffect.js`

7. **`index.html`** (inline scripts):

   - בדיקת שימושים ב-`index-*.js` files

### 2.4 עדכון imports ב-bundles

**קבצים לעדכן:**

1. **`assets/js/bundles/home.js`**:

   - `import '../index.js'` → `import '../features/index/index.js'`
   - `import '../paywall.js'` → להישאר (UI component)

2. **`assets/js/bundles/utils.js`**:

   - `import '../spec-formatter.js'` → `import '../utils/spec-formatter.js'`
   - `import '../typingEffect.js'` → `import '../utils/typingEffect.js'`
   - `import '../mobile-optimizations.js'` → `import '../utils/mobile-optimizations.js'`

### 2.5 עדכון _includes/head.html

**קבצים לעדכן (שורות 198-223):**

- `/assets/js/config.js` → `/assets/js/core/config.js`
- `/assets/js/api-client.js` → `/assets/js/services/api-client.js`
- `/assets/js/focus-manager.js` → `/assets/js/utils/focus-manager.js`
- `/assets/js/store.js` → `/assets/js/core/store.js`
- `/assets/js/app-logger.js` → `/assets/js/core/app-logger.js`
- `/assets/js/web-vitals.js` → `/assets/js/utils/web-vitals.js`
- `/assets/js/css-monitor.js` → `/assets/js/core/css-monitor.js`
- `/assets/js/security-utils.js` → `/assets/js/core/security-utils.js`

## שלב 3: העברת tools/prompts.js

**קובץ להעביר:**

- `tools/prompts.js` → `assets/js/services/prompts.js` (יותר הגיוני ליד spec-services)

**קבצים לעדכן:**

- `pages/spec-viewer.html` (שורה 15): `/tools/prompts.js` → `/assets/js/services/prompts.js`
- `index.html` - בדיקה אם יש שימוש

## שלב 4: מחיקת קבצים מיותרים

### 4.1 Backend Scripts Backups

**קבצים למחוק:**

- `backend/scripts/credits_backup_1765663867440.json`
- `backend/scripts/credits_backup_1765663925200.json`

### 4.2 CSS Test Files

**קבצים למחוק:**

- `assets/css/main-compiled-test.css`
- `assets/css/main-compiled-test.css.map`
- `assets/css/main-compiled-new.css.map`

### 4.3 Docs Files

**קבצים למחוק:**

- `docs/old-demo.html` (לא שייך ל-docs)

**קבצים להעביר:**

- `docs/SITE-VALIDATION-REPORT.json` → `docs/reports/` (אם צריך, אחרת למחוק)

### 4.4 Config Directory

**לבדוק:**

- `config/package.json` - אם לא בשימוש, למחוק

## שלב 5: ארגון תיקיית docs/

### 5.1 מבנה חדש

```
docs/
  ├── setup/
  │   ├── firebase-setup.md
  │   ├── lemon-squeezy-setup.md
  │   ├── ga4-setup.md
  │   └── webhook-setup-checklist.md
  ├── guides/
  │   ├── PAGE-CREATION-GUIDE.md
  │   ├── LOGGING_GUIDE.md
  │   ├── SIMULATION_GUIDE.md
  │   └── TESTING-WAKEUP.md
  ├── architecture/
  │   ├── API.md
  │   ├── DATABASE_SCHEMA.md
  │   ├── DESIGN-SYSTEM.md
  │   ├── MONOREPO.md
  │   └── JEKYLL-STYLE-SCSS-SOLUTION.md
  ├── checklists/
  │   ├── security-checklist.md
  │   ├── lemon-prod-qa-checklist.md
  │   ├── REGISTRATION_FLOW_VERIFICATION.md
  │   └── PAGES-CONFIGURATION.md
  ├── references/
  │   ├── API-EXAMPLES.md
  │   ├── SITE-MAP.md
  │   ├── CI-CD.md
  │   └── WEBSITE-TECHNICAL-OPERATIONAL-GUIDE-HE.md
  └── README.md
```

### 5.2 קבצים להעביר

**ל-setup/:**

- `firebase-setup.md`
- `lemon-squeezy-setup.md`
- `ga4-setup.md`
- `webhook-setup-checklist.md`

**ל-guides/:**

- `PAGE-CREATION-GUIDE.md`
- `LOGGING_GUIDE.md`
- `SIMULATION_GUIDE.md`
- `TESTING-WAKEUP.md`

**ל-architecture/:**

- `API.md`
- `DATABASE_SCHEMA.md`
- `DESIGN-SYSTEM.md`
- `MONOREPO.md`
- `JEKYLL-STYLE-SCSS-SOLUTION.md`

**ל-checklists/:**

- `security-checklist.md`
- `lemon-prod-qa-checklist.md`
- `REGISTRATION_FLOW_VERIFICATION.md`
- `PAGES-CONFIGURATION.md`

**ל-references/:**

- `API-EXAMPLES.md`
- `SITE-MAP.md`
- `CI-CD.md`
- `WEBSITE-TECHNICAL-OPERATIONAL-GUIDE-HE.md`

## שלב 6: עדכון קבצי תצורה

### 6.1 _config.yml

**לעדכן (שורות 53-55):**

- `create-post.js`, `create-post.sh`, `create-post.bat` → `scripts/blog/create-post.*`

**להוסיף ל-exclude:**

- `scripts/` (אם צריך)

### 6.2 .gitignore

**להוסיף:**

- `*_backup_*.json` (בנוסף ל-`*.backup` שכבר יש)

### 6.3 README.md

**לעדכן (שורה 191):**

- `cd backend && ./start-server.sh` → `cd scripts/backend && ./start-server.sh`

**לעדכן (שורה 197):**

- `cd backend && node server.js` → `cd backend/server && node server.js`

### 6.4 backend/SETUP.md

**לעדכן:**

- כל ההפניות ל-`start-server.sh` → `../../scripts/backend/start-server.sh`

### 6.5 docs/TESTING-WAKEUP.md

**לעדכן:**

- כל ההפניות ל-scripts → paths חדשים

## שלב 7: יצירת קובץ התכנון

**ליצור:**

- `scripts/REFACTORING-PLAN.md` - קובץ זה (התכנון המלא)

## שלב 8: בדיקות וסיכום

### 8.1 בדיקות נדרשות

1. בדיקה שכל הלינקים עובדים
2. בדיקה ש-Jekyll build עובד
3. בדיקה ש-Vite build עובד
4. בדיקה ש-backend scripts עובדים
5. בדיקה שהדפים נטענים נכון

### 8.2 קבצים שדורשים תשומת לב מיוחדת

- `backend/restart-server.sh` - יש path קשיח שצריך לתקן
- `backend/server/package.json` - יש scripts שמפנים ל-`../scripts/` - לבדוק
- כל ה-HTML files עם inline scripts שמפנים ל-JS files

## סדר ביצוע מומלץ

1. שלב 1: Scripts (קל ביותר, פחות תלויות)
2. שלב 4: מחיקת קבצים (לפני שינויי paths)
3. שלב 2: JavaScript organization (הכי מורכב, הכי הרבה עדכונים)
4. שלב 3: tools/prompts.js (פשוט)
5. שלב 5: Docs organization (בינוני)
6. שלב 6: עדכון תצורה (חשוב לעשות אחרי כל השינויים)
7. שלב 7: יצירת קובץ התכנון
8. שלב 8: בדיקות

## הערות חשובות

- כל השינויים חייבים להיעשות באופן שיטתי
- חשוב לעדכן את כל הלינקים ב-commit אחד
- לבדוק build אחרי כל שלב מרכזי
- לשמור backup לפני התחלה (אם צריך)