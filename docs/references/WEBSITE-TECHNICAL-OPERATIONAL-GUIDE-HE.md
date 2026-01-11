### מסמך טכני־תפעולי מקיף של האתר

המסמך מסביר את מבנה המערכת, הדפים, הזרימות העיקריות, שכבות ה-frontend וה-backend, הסכמות ב-Firestore, מנגנוני הרשאות/קרדיטים/תשלום, וכלים תפעוליים.

## 1) מבנה וסטאק
- **Frontend (Jekyll + Vanilla JS)**
  - דפים תחת `index.html`, `pages/*.html`, בלוג `_posts/` + `_layouts/post.html`.
  - Includes ו־Layouts: `_includes/*`, `_layouts/*`.
  - סקריפטים: `assets/js/*.js` (לוגיקת homepage/spec/credits/admin/mermaid וכו').
  - סטיילינג: `assets/css/**/*`.
- **Backend (Node/Express)**
  - שרת: `backend/server/server.js` (Unified Server v2.0.0)
  - ראוטרים: `user-routes.js`, `specs-routes.js`, `credits-routes.js`, `chat-routes.js`, `admin-routes.js`, `blog-routes.js`, `lemon-routes.js`, `health-routes.js`, `stats-routes.js`, `live-brief-routes.js`
  - אימות Firebase Admin, עדכוני entitlements, webhookים (לרכישות).
- **AI Services**
  - **Cloudflare Worker**: `https://spspec.shalom-cohen-111.workers.dev/generate` - יצירת ספקיפיקציות (Overview, Technical, Market, Design)
  - **OpenAI API**: 
    - OpenAI Storage Service (`openai-storage-service.js`) - העלאה ל-Files API, יצירת Assistants, Chat, Diagrams
    - OpenAI Whisper API - תמלול קול ב-Live Brief
- **Data**
  - Firestore: `users`, `entitlements`, `specs`, `purchases`, `subscriptions`, `blog_posts`, `public_stats`
- **אימות**
  - Firebase Auth בפרונט; אימות ID Token בבקאנד לכל endpoint רגיש.
- **תשלום/קרדיטים**
  - Lemon Squeezy (Checkout + webhookים), ניהול יתרות ב־`entitlements`.
- **Build/Deploy**
  - Jekyll לסטטי, Vite לבאנדלים, שרת Node מתארח (Render), CDN לסטטי.

## 2) מפת דפים מרכזיים
- `index.html` – דף הבית: Hero, CTA Start, Demo, Pricing, תכונות, FAQ, ועוד.
- `pages/auth.html` – Login/Signup (Firebase UI מותאם).
- `pages/spec.html` – עורך יצירה (מצב עריכה/הרחבה קיים חלקית).
- `pages/spec-viewer.html` – צפייה/אישור Overview, יצירת Technical/Market/Design, Diagrams, Raw Data, AI Chat.
- `pages/profile.html` – פרופיל: רשימת Specs, סטטוסים, יתרות, קישורים ל-Viewer/Editor.
- `pages/pricing.html` – תמחור ורכישה (Single/3-Pack/Pro).
- `pages/admin-dashboard.html` – אדמין: ניהול משתמשים/Specs/בלוג/מדדים.
- `pages/how.html`, `pages/about.html`, `pages/demo-spec.html`, `pages/legacy-viewer.html`, `pages/ToolPicker.html`.
- בלוג: `/blog/` ו-`_posts/*` דרך `_layouts/post.html`.

## 3) זרימות משתמש עיקריות

### 3.1 הרשמה/התחברות
- משתמש לוחץ Start ב־`/index.html`.
- אם לא מחובר → Redirect ל־`/pages/auth.html`.
- לאחר התחברות:
  - קליינט: `onAuthStateChanged` יורה `ensure user` ל־`/api/users/ensure` עם Bearer Token.
  - שרת: מאמת טוקן, יוצר/מעדכן `users/{uid}`, ו־`entitlements/{uid}` עם ברירת־מחדל (תוכנית free, יתרות ראשוניות).
  - חזרה ל־Home או לזרימה שנדרשה.

### 3.2 יצירת Spec חדש (Question Flow)
- המשתמש עונה על שאלון קצר (Question Flow) שמוגדר ב־`assets/js/index.js` + `question-flow-*.js`.
- בדיקת זכאות/קרדיט:
  - אם אין זכאות: פרומפט לרכישה ב־`/pages/pricing.html`.
- יצירה:
  - `generateSpecification()` יוצר פרומפט מפורט באמצעות `PROMPTS.overview(answers)` מ-`tools/prompts.js`
  - שולח `POST /api/generate-spec` עם `userInput` (הפרומפט המפורט)
  - השרת (`server.js`) מקבל את הבקשה, מאמת, ושולח ל-Cloudflare Worker:
    - Worker URL: `https://spspec.shalom-cohen-111.workers.dev/generate`
    - Payload: `{ stage: "overview", locale: "en-US", prompt: { system, developer, user } }`
  - Cloudflare Worker:
    - קורא ל-OpenAI API (gpt-4o-mini) עם הפרומפט
    - בודק ולידציה (validateOverviewPayload) - דורש: ideaSummary, targetAudience, valueProposition, coreFeaturesOverview, userJourneySummary
    - מנסה 3 פעמים עם תיקון אוטומטי אם נכשל
    - מחזיר: `{ overview: {...}, meta: {...}, correlationId }`
  - השרת ממיר את התגובה לפורמט: `{ specification: JSON.stringify(data.overview) }`
  - `saveSpecToFirebase(overview, answers)` יוצר מסמך `specs/{id}` עם:
    - `overview`, `answers`, `status.overview="ready"`, `technical/market/design=null`, `overviewApproved=false`, `userId`, `createdAt/updatedAt`.
- Redirect ל־`/pages/spec-viewer.html?id={id}`.

### 3.3 אישור Overview ויצירת מפרטים
- משתמש רואה Overview בלשונית Overview.
- משתמש PRO יכול לערוך Overview (שומר ל-Firestore). כל שמירה מאפסת היסטוריית Chat לרלוונטיות.
- לחיצה “Approve Overview”:
  - עדכון `overviewApproved=true`, `status.technical/market/design="generating"`.
  - הפעלת לשונית AI Chat מידית.
  - יצירה סדרתית:
    - Technical → Market → Design.
    - כל מודול נשמר בשדה נפרד במסמך, עם `status.*="ready"` או `"error"`.
  - Diagrams: יצירה/הצגה (Mermaid) בלשונית Diagrams.
  - Raw Data: חשיפת JSON גולמי לייצוא/בדיקה.

### 3.4 צפייה/שיתוף/עריכה
- הרשאות צפייה:
  - ציבורי (`isPublic=true`) או בעלים (`userId`) או אדמין.
- פעולות:
  - צפייה: Overview/Technical/Market/Design/Diagrams/Raw.
  - עריכה: PRO יכול לערוך Overview (ואפשרויות נוספות אם מופעלות).
  - העלאה ל־OpenAI Storage (אופציונלי) דרך API מאובטח לטובת המשך אינטראקציות בצד AI.

### 3.5 ניהול דרך Profile
- `pages/profile.html`: טבלת Specs של המשתמש, סטטוסים, תאריכים, יתרות קרדיטים/מנוי.
- קישורים מהירים ל־Viewer/Editor, ומעקב אחר רכישות/יתרות.

### 3.6 רכישה ומנויים
- Free: לפחות Spec אחד ראשוני.
- רכישות: Single/3-Pack/Pro ב־`pages/pricing.html` עם Lemon Squeezy.
- לאחר רכישה:
  - Webhookים בשרת מעדכנים `entitlements/{uid}`: `spec_credits`, `unlimited`, `can_edit`.
  - הקליינט מרענן תצוגת קרדיטים/אפשרויות.

## 4) שכבת ה-Frontend

- Scripts עיקריים:
  - `assets/js/index.js`: ה־CTA, Question Flow, יצירה/שמירה, Redirect ל-Viewer.
  - `assets/js/spec-formatter.js`: עזרה לעיבוד/רינדור טקסטואלי.
  - `assets/js/credits-display.js`, `assets/js/entitlements-cache.js`: הצגת יתרות/Cache.
  - `assets/js/mermaid.js`: טעינת דיאגרמות Mermaid.
  - `assets/js/admin-dashboard.js`: UI אדמין.
  - `assets/js/live-brief-modal.js`: UX מודאלי תומך.
- UI מותנה הרשאות:
  - הצגת כפתורי Edit/Approve/Share בהתאם ל־user state ו־entitlements.
- Includes/Layouts:
  - `_includes/firebase-init.html`, `_includes/firebase-auth.html`: אתחול/מצבי Auth.
  - `_layouts/*`: `default`, `dashboard`, `post`, `auth`, `standalone`.

## 5) שכבת ה-Backend

### 5.1 Routes ו-Endpoints

**Users (`/api/users`)**:
- `POST /api/users/ensure` - יצירה/עדכון משתמש ו-entitlements
- `GET /api/users/me` - מידע משתמש נוכחי
- `GET /api/users/:userId` - מידע משתמש ספציפי

**Specs (`/api/specs`)**:
- `POST /api/specs/create` - יצירת spec חדש
- `GET /api/specs/:id` - קבלת spec
- `PUT /api/specs/:id` - עדכון spec
- `POST /api/specs/:id/upload-to-openai` - העלאה ל-OpenAI Storage
- `POST /api/specs/:id/approve-overview` - אישור Overview

**Credits (`/api/credits`)**:
- `POST /api/credits/consume` - שריפת קרדיט ביצירה
- `POST /api/credits/refund` - החזר קרדיט במקרה כשל
- `GET /api/credits/entitlements` - קבלת entitlements

**Chat (`/api/chat`)**:
- `POST /api/chat/init` - אתחול chat thread
- `POST /api/chat/message` - שליחת הודעה וקבלת תגובה
- `POST /api/chat/diagrams/generate` - יצירת דיאגרמות

**Lemon Squeezy (`/api/lemon`)**:
- `POST /api/lemon/checkout` - יצירת checkout session
- `POST /api/lemon/webhook` - קבלת webhookי תשלום

**Admin (`/api/admin`)**:
- ניהול משתמשים, specs, בלוג, מדדים
- `GET /api/admin/error-logs` - לוגי שגיאות
- `GET /api/admin/css-crash-logs` - לוגי CSS crashes

**Health (`/api/health`)**:
- `GET /api/health` - בדיקת בריאות בסיסית
- `GET /api/health/comprehensive` - בדיקה מקיפה (DB, OpenAI, Worker)
- `GET /api/health/cloudflare-worker` - בדיקת Worker

**Stats (`/api/stats`)**:
- `GET /api/stats/public` - סטטיסטיקות ציבוריות
- `GET /api/stats/admin` - סטטיסטיקות אדמין

**Live Brief (`/api/live-brief`)**:
- `POST /api/live-brief/transcribe` - תמלול קול (Whisper)

**Generate Spec (`/api/generate-spec`)**:
- `POST /api/generate-spec` - יצירת Overview דרך Cloudflare Worker

### 5.2 אימות ואבטחה

- **Middleware**: אימות Firebase ID Token לכל `/api/*` רגיש
- **Rate Limiting**: 
  - General: 100 requests/15min
  - Generation: 10 requests/15min
  - Auth: 20 requests/15min
  - Admin: 200 requests/15min
- **Security Headers**: Helmet.js עם CSP, HSTS, ועוד
- **CORS**: מוגבל ל-domains מורשים
- **Error Handling**: טיפול מרכזי בשגיאות עם לוגים מפורטים

### 5.3 שירותים

**OpenAI Storage Service** (`openai-storage-service.js`):
- `uploadSpec()` - העלאה ל-Files API
- `createAssistant()` - יצירת Assistant עם vector store
- `ensureAssistantHasVectorStore()` - וידוא vector store
- `generateDiagrams()` - יצירת דיאגרמות
- `sendMessage()` - שליחת הודעות Chat
- `createThread()` - יצירת thread חדש

**Cloudflare Worker Integration**:
- Worker URL: `https://spspec.shalom-cohen-111.workers.dev/generate`
- Stages: overview, technical, market, design, diagrams, prompts
- Retry logic: 3 ניסיונות עם תיקון אוטומטי
- Validation: בדיקת שדות חובה לפני החזרה

## 6) סכמות נתונים (Firestore – עיקריות)

### 6.1 Collections עיקריות

**`users/{uid}`**:
- `email`, `displayName`, `emailVerified`, `createdAt`, `lastActive`, `plan`, `newsletterSubscription`
- `disabled` (boolean) - משתמש מושבת
- `admin` (boolean) - הרשאות אדמין
- `free_specs_remaining` (number) - יתרת ספקס חינמיים

**`entitlements/{uid}`**:
- `userId`, `spec_credits` (number), `unlimited` (boolean - Pro), `can_edit` (boolean)
- `updated_at` (timestamp)
- `subscription_status` - סטטוס מנוי (active, cancelled, expired)
- `subscription_id` - מזהה מנוי ב-Lemon Squeezy

**`specs/{specId}`**:
- `userId`, `title`, `overview` (JSON string), `technical` (JSON string), `market` (JSON string), `design` (JSON string)
- `answers` (array) - תשובות השאלון המקורי
- `overviewApproved` (boolean)
- `status`: `{ overview: "ready"|"pending"|"error", technical: "...", market: "...", design: "..." }`
- `isPublic` (boolean) - שיתוף ציבורי
- `openaiFileId` (string) - מזהה קובץ ב-OpenAI Files API
- `openaiAssistantId` (string) - מזהה Assistant ב-OpenAI
- `openaiUploadTimestamp` (timestamp)
- `createdAt`, `updatedAt` (timestamps)

**`purchases/{purchaseId}`**:
- `userId`, `orderId`, `variantId`, `total`, `currency`, `status`
- `createdAt` (timestamp)
- `lemonSqueezyData` (object) - נתונים מלאים מ-Lemon Squeezy

**`subscriptions/{subscriptionId}`**:
- `userId`, `subscriptionId`, `status`, `variantId`, `currentPeriodEnd`
- `createdAt`, `updatedAt` (timestamps)

**`blog_posts/{postId}`**:
- `title`, `content`, `excerpt`, `author`, `published`, `createdAt`, `updatedAt`
- `slug`, `tags`, `category`

**`public_stats`** (single document):
- `totalSpecs`, `totalUsers`, `totalPurchases`, `lastUpdated`

### 6.2 הערות חשובות

- שמירה/עדכון תמיד מעדכנים `updatedAt`
- בדיקות גודל תוכן (הגבלת ~1MB למסמך) לפני עדכון
- Indexes נדרשים ב-Firestore:
  - `specs`: `userId`, `createdAt`
  - `users`: `email`, `createdAt`
  - `entitlements`: `userId`

## 7) הרשאות ואבטחה

- פרונט:
  - Gate לפני פעולות יצירה/צפייה פרטיות; Redirect ל־Auth כשצריך.
  - הצגת UI בהתאם ל־auth role ו־entitlements.
- בקאנד:
  - אימות ID Token לכל endpoint רגיש; החזרת 401/403 ולוגינג.
  - `requireAdmin` להגנה על פעולות אדמין.
- Firestore Rules:
  - בעלות על מסמכים; מניעת כתיבה/קריאה לא מאושרת בצד קליינט.
- שיתוף:
  - `isPublic` מאפשר צפייה ללא בעלות מלאה; עדיין נהוג לדרוש auth עבור viewer כדי לאפשר תכונות מתקדמות (Chat/Actions).

## 8) תמחור, קרדיטים וגבייה

- תוכניות:
  - Free: לפחות Spec אחד.
  - Single: חבילת Spec בודד.
  - 3-Pack: 3 ספקס.
  - Pro: Unlimited + יכולות עריכה מתקדמות.
- תהליך:
  - Checkout ב־`/pages/pricing.html` (Lemon Squeezy).
  - שרת מקבל webhook → עדכון `entitlements`.
  - קליינט מרענן תצוגת יתרות ומאפשר יצירה/עריכה בהתאם.

## 9) ניהול אדמין

- `pages/admin-dashboard.html`:
  - ניהול משתמשים/entitlements.
  - עיון/פתיחה של Specs (Viewer/Editor).
  - ניהול בלוג ותכני מערכת.
- הרשאות:
  - `requireAdmin` על ה-API; UI מוסתר/נחסם בצד לקוח למשתמשים לא אדמינים.

## 10) בלוג ותוכן

- `_posts/*` עם `_layouts/post.html`.
- ניהול דרך אדמין או תהליכי build.
- SEO/Structured Data via includes.

## 11) תפעול, ניטור ותחזוקה

### 11.1 Health Checks
- `GET /api/health` - בדיקה בסיסית (200 OK)
- `GET /api/health/comprehensive` - בדיקה מקיפה:
  - Firestore connectivity
  - OpenAI API status
  - Cloudflare Worker status
- `GET /api/health/cloudflare-worker` - בדיקה ספציפית של Worker

### 11.2 לוגים וניטור
- **שרת**: Pino logger עם structured logging
  - כל בקשה מקבלת `requestId` ייחודי
  - לוגים מפורטים לכל פעולה קריטית
  - Error logging עם stack traces
- **קליינט**: Google Analytics (`_includes/analytics*.html`)
  - Event tracking לכל פעולה משמעותית
  - Page views, button clicks, errors

### 11.3 ניהול תקלות
- **החזר קרדיטים אוטומטי**: כששמירה נכשלה אחרי צריכה
- **Error Recovery**: 
  - Worker retry logic (3 ניסיונות עם תיקון)
  - Assistant corruption detection ו-recreation אוטומטי
  - Vector store validation ו-fix אוטומטי
- **UI Fallbacks**: Question Flow controller → זרימה ישנה אם נדרש

### 11.4 Build & Deploy
- **Frontend**:
  - Jekyll build: `bundle exec jekyll build`
  - Vite build: `npm run build:vite`
  - Combined: `npm run build:all`
- **Backend**:
  - Node.js server on Render
  - Environment variables: `backend/.env`
  - Auto-restart on deploy
- **Static Files**: CDN לקבצים סטטיים

### 11.5 אבטחת תוכן
- בדיקות גודל תוכן לפני כתיבה ל-Firestore (~1MB limit)
- ולידציה בסיסית בצד שרת למבנים/קלט (Joi schemas)
- Input sanitization למניעת XSS
- Rate limiting על כל endpoints

## 12) תרשים רצף ליבה (תקצירי)

### 12.1 יצירת Spec חדש (Overview)
```
Client (Start) 
  → Auth gate 
  → Question Flow 
  → generateSpecification() 
    → POST /api/generate-spec עם פרומפט מפורט (PROMPTS.overview)
  → Server validates
  → POST Cloudflare Worker (https://spspec.shalom-cohen-111.workers.dev/generate)
    → Worker calls OpenAI API (gpt-4o-mini)
    → Worker validates response
    → Returns { overview, meta, correlationId }
  → Server converts to { specification }
  → saveSpecToFirebase()
  → Redirect to Viewer
```

### 12.2 אישור Overview ויצירת מפרטים מלאים
```
Client (Viewer Approve)
  → POST /api/specs/:id/approve-overview
  → Update spec: overviewApproved=true, statuses=generating
  → Generate Technical (Cloudflare Worker stage="technical")
  → Save to Firestore
  → Generate Market (Cloudflare Worker stage="market")
  → Save to Firestore
  → Generate Design (Cloudflare Worker stage="design")
  → Save to Firestore
  → Update statuses=ready
  → Enable AI Chat (upload to OpenAI if needed)
```

### 12.3 תשלום ורכישת קרדיטים
```
Client (Checkout)
  → POST /api/lemon/checkout
  → Redirect to Lemon Squeezy
  → User completes payment
  → Lemon Squeezy sends webhook
  → POST /api/lemon/webhook
  → Verify signature
  → Update entitlements/{uid}
  → Client refreshes entitlements display
```

### 12.4 OpenAI Storage ו-Chat Flow
```
Client (Approve Overview)
  → POST /api/specs/:id/upload-to-openai
  → OpenAIStorageService.uploadSpec()
  → Create OpenAI File
  → Update spec with openaiFileId
  → POST /api/chat/diagrams/generate
  → Create Assistant (if needed)
  → Ensure Vector Store
  → Generate Diagrams via Assistant API
  → Return diagrams to client
  → POST /api/chat/message
  → Send message to Assistant
  → Get response
  → Display in Chat UI
```

## 13) UX עיקרי (לפי תוכנית מנוי)

### 13.1 Free Plan
- יצירה אחת לפחות (free_specs_remaining)
- צפייה מלאה ב־Viewer אחרי אישור Overview
- אין עריכה של Overview
- Chat מוגבל (אם בכלל)
- להמשך – רכישה דרך `/pages/pricing.html`

### 13.2 Single/3-Pack Plans
- יצירת כמות מוגדרת (spec_credits)
- עריכה בסיסית של Specs
- צפייה מלאה בכל המפרטים
- Chat מוגבל

### 13.3 Pro Plan (Unlimited)
- יצירה ללא הגבלה (`unlimited: true`)
- יכולות עריכה מתקדמות (`can_edit: true`):
  - עריכת Overview
  - עריכת Technical/Market/Design
- Chat עשיר עם OpenAI Assistant
- אפשרויות אינטגרציה מורחבות
- OpenAI Storage אוטומטי

## 14) טכנולוגיות וכלים

### 14.1 Frontend Stack
- **Jekyll** (v4.x) - Static Site Generator
- **Vite** (v5.x) - Build tool for CSS/JS bundles
- **PostCSS** - CSS processing עם autoprefixer, cssnano
- **Vanilla JavaScript** - ללא frameworks
- **Firebase SDK** - Auth, Firestore client-side

### 14.2 Backend Stack
- **Node.js** (v18+) - Runtime
- **Express** (v5.x) - Web framework
- **Firebase Admin SDK** - Server-side Firebase operations
- **Pino** - Structured logging
- **Helmet** - Security headers
- **express-rate-limit** - Rate limiting
- **Joi** - Input validation

### 14.3 AI & External Services
- **Cloudflare Workers** - Spec generation (gpt-4o-mini)
- **OpenAI API**:
  - Chat Completions (gpt-4o-mini)
  - Files API (spec storage)
  - Assistants API (chat & diagrams)
  - Whisper API (audio transcription)
- **Lemon Squeezy** - Payment processing

### 14.4 Infrastructure
- **Render** - Backend hosting
- **Cloudflare** - Worker hosting + CDN
- **Firebase**:
  - Authentication
  - Firestore (database)
  - Hosting (optional)

## 15) Environment Variables

### 15.1 Required (Backend)
- `OPENAI_API_KEY` - OpenAI API key (לצורך OpenAI Storage, לא ל-Worker)
- `FIREBASE_SERVICE_ACCOUNT` - Firebase Admin credentials (JSON)
- `LEMON_WEBHOOK_SECRET` - Lemon Squeezy webhook signature verification
- `NODE_ENV` - production/development

### 15.2 Optional (Backend)
- `EMAIL_USER` - Email for notifications
- `EMAIL_APP_PASSWORD` - Email app password
- `GOOGLE_SHEETS_WEBHOOK_URL` - Google Apps Script webhook
- `RENDER_URL` - Render deployment URL
- `LEMON_ALLOW_TEST_WEBHOOKS` - Allow test webhooks (true/false)

### 15.3 Cloudflare Worker
- `OPENAI_API_KEY` - OpenAI API key (נפרד מהשרת)

## 16) קבצים מרכזיים

### 16.1 Frontend
- `index.html` - דף הבית
- `assets/js/index.js` - לוגיקת יצירת Specs
- `assets/js/question-flow-controller.js` - ניהול Question Flow
- `assets/js/spec-formatter.js` - עיצוב Specs
- `tools/prompts.js` - פרומפטים מפורטים ל-AI

### 16.2 Backend
- `backend/server/server.js` - Entry point (Unified Server)
- `backend/server/user-routes.js` - ניהול משתמשים
- `backend/server/specs-routes.js` - ניהול Specs
- `backend/server/chat-routes.js` - Chat & Diagrams
- `backend/server/openai-storage-service.js` - OpenAI integration
- `backend/server/lemon-routes.js` - תשלומים
- `backend/server/admin-routes.js` - ניהול אדמין

### 16.3 Worker
- `worker-new.js` - Cloudflare Worker ליצירת Specs

—
**הערה**: כל הטקסטים באתר למשתמשים עצמם נשמרים באנגלית בהתאם להנחיות המותג; המסמך שלמעלה בעברית לצורך תפעולי/פנימי.

**עודכן לאחרונה**: 2025-11-19


