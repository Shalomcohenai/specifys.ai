# 🗺️ מיפוי מקיף של האתר - Specifys.ai

**תאריך יצירה:** 2025-01-27  
**גרסה:** 2.0  
**מצב:** ✅ מעודכן

---

## 📋 תוכן עניינים

1. [סקירה כללית](#סקירה-כללית)
2. [מבנה וארגון דפים](#מבנה-וארגון-דפים)
3. [פונקציות מרכזיות](#פונקציות-מרכזיות)
4. [טכנולוגיות](#טכנולוגיות)
5. [אינטגרציות עם גורמי צד שלישי](#אינטגרציות-עם-גורמי-צד-שלישי)
6. [מבנה האתר הכללי](#מבנה-האתר-הכללי)
7. [המלצות להמשך](#המלצות-להמשך)

---

## 📊 סקירה כללית

**Specifys.ai** הוא פלטפורמה מבוססת AI ליצירת מפרטי אפליקציות. האתר מספק כלים ליצירת מפרטים מפורטים, מחקר שוק, עיצוב, דיאגרמות טכניות, ושיחה עם AI.

### ארכיטקטורה כללית

האתר בנוי על **ארכיטקטורה היברידית**:
- **Frontend**: Jekyll (Static Site Generator) + Next.js (חלק מהדפים) + Vanilla JavaScript
- **Backend**: Node.js/Express (Unified Server v2.0.0)
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **AI Services**: OpenAI API + Cloudflare Workers
- **Payments**: Lemon Squeezy

---

## 📄 מבנה וארגון דפים

### 1. דפים ציבוריים (Public Pages)

#### דף הבית (`index.html`)
- **תפקיד**: נקודת הכניסה הראשית
- **תכונות**:
  - Hero Section עם CTA
  - תהליך יצירת מפרט (3 שאלות)
  - Live Brief (הקלטת קול)
  - Demo של מפרט
  - Pricing
  - Features
  - FAQ
- **קבצים קשורים**:
  - `assets/js/index.js` - לוגיקת יצירת מפרט
  - `assets/css/pages/index.css` - עיצוב
  - `tools/prompts.js` - פרומפטים ל-AI

#### דפי מידע (`pages/`)
- **`about.html`** - אודות החברה
- **`how.html`** - איך זה עובד
- **`why.html`** - למה להשתמש ב-Specifys
- **`pricing.html`** - תמחור ותוכניות
- **`articles.html`** - מאמרים
- **`article.html`** - מאמר בודד
- **`demo-spec.html`** - דמו מפרט (ציבורי)

### 2. דפי משתמש (User Pages)

#### `pages/auth.html`
- **תפקיד**: התחברות והרשמה
- **טכנולוגיה**: Firebase Auth UI
- **תכונות**: Login, Signup, Password Reset

#### `pages/profile.html`
- **תפקיד**: ניהול פרופיל משתמש
- **תכונות**:
  - הצגת קרדיטים
  - רשימת מפרטים
  - היסטוריית רכישות
  - ניהול מנוי
- **API Calls**: `/api/specs/entitlements`, `/api/specs`

#### `pages/spec-viewer.html`
- **תפקיד**: צפייה ועריכה במפרט
- **תכונות**:
  - טאבים: Overview, Technical, Market, Design, Diagrams, Mockups, Mind Map, Prompts, Chat, Raw Data, Export
  - עריכת Overview
  - אישור Overview ויצירת מפרטים מלאים
  - יצירת Mockups (PRO only)
  - יצירת Mind Map
  - Chat עם AI
  - יצירת דיאגרמות Mermaid
  - ייצוא ל-Jira
- **קבצים קשורים**:
  - `assets/js/mermaid.js` - דיאגרמות
  - `tools/prompts.js` - פרומפטים

### 3. דפי ניהול (Admin Pages)

#### `pages/admin-dashboard.html`
- **תפקיד**: לוח בקרה למנהלים
- **תכונות**:
  - ניהול משתמשים
  - ניהול מפרטים
  - ניהול בלוג
  - ניהול מאמרים
  - ניהול Academy
  - לוגי שגיאות
  - סטטיסטיקות
- **API Calls**: `/api/admin/*`

#### `pages/admin/academy/*`
- **תפקיד**: ניהול Academy (מדריכים וקטגוריות)
- **דפים**:
  - `index.html` - רשימת מדריכים
  - `new-guide.html` - יצירת מדריך חדש
  - `edit-guide.html` - עריכת מדריך
  - `new-category.html` - יצירת קטגוריה

### 4. דפי Academy (Public)

#### `pages/academy/*`
- **תפקיד**: מדריכים וכלים למפתחים
- **דפים**:
  - `index.html` - רשימת קטגוריות
  - `category.html` - מדריכים בקטגוריה
  - `guide.html` - מדריך בודד

### 5. דפים נוספים

- **`pages/404.html`** - דף שגיאה 404
- **`pages/maintenance.html`** - דף תחזוקה
- **`pages/legacy-viewer.html`** - צפייה במפרטים ישנים
- **`pages/ToolPicker.html`** - בוחר כלים לפיתוח
- **`pages/dynamic-post.html`** - דף דינמי לבלוג

### 6. בלוג (`_posts/`)

- פוסטים בפורמט Markdown
- Layout: `_layouts/post.html`
- דף רשימה: `blog/index.html`

---

## ⚙️ פונקציות מרכזיות

### 1. מערכת יצירת מפרטים (Spec Generation)

#### תהליך יצירת מפרט:
1. **שאלות ראשוניות** (3 שאלות):
   - תיאור האפליקציה
   - תיאור ה-workflow
   - פרטים נוספים
2. **יצירת Overview**:
   - Frontend: `generateSpecification()` ב-`assets/js/index.js`
   - Backend: `POST /api/generate-spec`
   - Worker: `https://spspec.shalom-cohen-111.workers.dev/generate`
   - שמירה ל-Firestore
3. **אישור Overview**:
   - משתמש מאשר את ה-Overview
   - יצירה סדרתית: Technical → Market → Design
4. **תכונות נוספות**:
   - Live Brief (הקלטת קול → תמלול → יצירת מפרט)
   - עריכת Overview
   - יצירת Mockups (PRO)
   - יצירת Mind Map
   - יצירת דיאגרמות

#### קבצים מרכזיים:
- **Frontend**: `assets/js/index.js`, `tools/prompts.js`
- **Backend**: `backend/server/specs-routes.js`, `backend/server/spec-generation-service.js`
- **Workers**: `worker-new.js` (Cloudflare)

### 2. מערכת קרדיטים (Credits System)

#### תכונות:
- **Real-time Updates**: Firestore listeners לעדכון מיידי
- **Atomic Transactions**: Firestore Transactions למניעת race conditions
- **Idempotency**: כל עסקה עם `transactionId` ייחודי
- **Retry Mechanism**: למשתמש חדש (3 ניסיונות)
- **Cache**: localStorage + memory cache (TTL 5 דקות)

#### Flow:
1. **צריכת קרדיט**:
   - בדיקת זכאות דרך `checkEntitlement()`
   - `POST /api/specs/consume-credit`
   - Firestore Transaction אטומית
   - אם נכשל → `POST /api/credits/refund`
2. **הענקת קרדיט**:
   - דרך Admin או Lemon Squeezy webhook
   - `POST /api/credits/grant`
3. **הצגת קרדיטים**:
   - Firestore listeners לעדכון מיידי
   - Fallback ל-API אם Firestore לא זמין

#### קבצים מרכזיים:
- **Frontend**: `assets/js/credits-display.js`, `assets/js/paywall.js`
- **Backend**: `backend/server/credits-service.js`, `backend/server/credits-routes.js`

### 3. מערכת Chat עם AI

#### תכונות:
- **Chat Service מרכזי**: איחוד כל הלוגיקה
- **Retry Mechanism**: עם exponential backoff
- **Caching**: In-memory cache של Assistant IDs
- **Error Recovery**: Assistant recreation אוטומטי
- **Optimistic Updates**: הודעות משתמש מוצגות מיד

#### Flow:
1. **אתחול Chat**:
   - `POST /api/chat/init`
   - העלאה ל-OpenAI Storage (אם צריך)
   - יצירת Assistant עם Vector Store
   - יצירת Thread
2. **שליחת הודעה**:
   - Optimistic update
   - `POST /api/chat/message`
   - Retry mechanism
   - תגובת AI מוצגת
3. **יצירת דיאגרמות**:
   - `POST /api/chat/diagrams/generate`
   - `POST /api/chat/diagrams/repair`

#### קבצים מרכזיים:
- **Backend**: `backend/server/chat-service.js`, `backend/server/chat-routes.js`, `backend/server/openai-storage-service.js`
- **Frontend**: `pages/spec-viewer.html` (פונקציות Chat מובנות)

### 4. מערכת משתמשים (User System)

#### תכונות:
- **Atomicity**: Firestore Transaction ליצירת users + entitlements יחד
- **Idempotency**: אם המסמכים קיימים, מחזיר מיד
- **Retry Mechanism**: 3 ניסיונות עם exponential backoff
- **Batch Processing**: `syncAllUsers()` מעבד 50 משתמשים במקביל

#### Flow:
1. **רישום/התחברות**:
   - Firebase Auth
   - `POST /api/users/initialize` (אוטומטי)
   - יצירת/עדכון `users` + `entitlements` ב-Transaction
   - למשתמש חדש: `spec_credits: 1`, `free_specs_remaining: 1`
2. **עדכון פרופיל**:
   - עדכון Firestore דרך `user-management.js`

#### קבצים מרכזיים:
- **Backend**: `backend/server/user-routes.js`, `backend/server/user-management.js`
- **Frontend**: Firebase Auth (client-side)

### 5. מערכת תשלומים (Payments)

#### תכונות:
- **Lemon Squeezy Integration**: Checkout + Webhooks
- **Webhook Processing**: עיבוד אוטומטי של רכישות
- **Subscription Management**: ניהול מנויי Pro
- **Credit Granting**: הענקת קרדיטים אוטומטית

#### Flow:
1. **Checkout**:
   - `startCheckout()` ב-`paywall.js`
   - `POST /api/lemon/checkout`
   - Redirect ל-Lemon Squeezy
2. **Webhook**:
   - `POST /api/lemon/webhook`
   - עיבוד רכישה
   - הענקת קרדיטים
   - עדכון Firestore

#### קבצים מרכזיים:
- **Frontend**: `assets/js/paywall.js`
- **Backend**: `backend/server/lemon-routes.js`, `backend/server/lemon-purchase-service.js`, `backend/server/lemon-credits-service.js`

### 6. מערכת בלוג ומאמרים

#### תכונות:
- **ניהול בלוג**: יצירה, עריכה, מחיקה של פוסטים
- **ניהול מאמרים**: יצירה, עריכה, מחיקה של מאמרים
- **Public API**: קריאה ציבורית של פוסטים ומאמרים

#### קבצים מרכזיים:
- **Backend**: `backend/server/blog-routes.js`, `backend/server/articles-routes.js`
- **Frontend**: `assets/js/blog-manager.js`, `assets/js/articles-manager.js`

### 7. מערכת Academy

#### תכונות:
- **קטגוריות**: ארגון מדריכים לפי קטגוריות
- **מדריכים**: תוכן מפורט עם אייקונים
- **ניהול**: יצירה, עריכה, מחיקה (Admin)

#### קבצים מרכזיים:
- **Backend**: `backend/server/academy-routes.js`
- **Frontend**: `assets/js/academy.js`, `assets/js/admin-academy.js`

---

## 🛠️ טכנולוגיות

### Frontend

#### Static Site Generation
- **Jekyll** - Static Site Generator
  - Layouts: `_layouts/`
  - Includes: `_includes/`
  - Collections: `_posts/`
  - Configuration: `_config.yml`

#### Modern Framework (חלק מהדפים)
- **Next.js 16.0.7** - React Framework
  - Location: `apps/web/`
  - Pages: `apps/web/app/`
  - Components: `apps/web/components/`
  - TypeScript support

#### Styling
- **CSS Custom Properties** - Design Tokens
- **SCSS/SASS** - Preprocessing
- **Tailwind CSS 3.4** - Utility-first CSS
- **PostCSS** - CSS Processing

#### JavaScript
- **Vanilla JavaScript** - ללא frameworks (רוב הדפים)
- **React 19.2.0** - (חלק מהדפים)
- **TypeScript** - (חלק מהקבצים)

#### Libraries
- **Mermaid.js** - דיאגרמות
- **Marked** - Markdown parsing
- **Font Awesome** - אייקונים
- **Google Fonts** - פונטים

### Backend

#### Runtime
- **Node.js** - Runtime environment
- **Express 4.18.2** - Web framework

#### Services
- **Firebase Admin SDK** - ניהול Firestore ו-Auth
- **OpenAI API 4.20.0** - AI services
- **Nodemailer** - שליחת אימיילים

#### Security
- **Helmet** - Security headers
- **express-rate-limit** - Rate limiting
- **Joi** - Validation

### Database

- **Firebase Firestore** - NoSQL database
  - Collections: `users`, `entitlements`, `specs`, `purchases`, `subscriptions`, `blog_posts`, `public_stats`

### Authentication

- **Firebase Auth** - Authentication service
  - Client-side: Firebase SDK
  - Server-side: Firebase Admin SDK

### Build Tools

- **Vite 5.4.8** - Build tool
- **Sass** - CSS preprocessing
- **PostCSS** - CSS processing
- **Bundler** - Package bundling

### Deployment

- **Jekyll Build** - Static site generation
- **Render** - Backend hosting
- **CDN** - Static assets

---

## 🔌 אינטגרציות עם גורמי צד שלישי

### 1. Firebase (Google)

#### Firebase Auth
- **תפקיד**: אימות משתמשים
- **שימוש**: Login, Signup, Password Reset
- **קבצים**: `_includes/firebase-init.html`, `_includes/firebase-auth.html`

#### Firebase Firestore
- **תפקיד**: Database
- **Collections**: `users`, `entitlements`, `specs`, `purchases`, `subscriptions`, `blog_posts`, `public_stats`
- **קבצים**: `backend/server/firebase-admin.js`

#### Firebase Storage
- **תפקיד**: אחסון קבצים (אם יש)

### 2. OpenAI

#### OpenAI API
- **תפקיד**: AI services
- **שימושים**:
  - יצירת מפרטים (דרך Cloudflare Workers)
  - Chat עם AI (Assistants API)
  - יצירת דיאגרמות
  - תמלול קול (Whisper API) - Live Brief
- **קבצים**: `backend/server/openai-storage-service.js`, `backend/server/chat-service.js`

#### OpenAI Storage Service
- **תפקיד**: ניהול Files API, Assistants, Threads
- **תכונות**:
  - העלאה ל-Files API
  - יצירת Assistants עם Vector Store
  - ניהול Threads
  - Chat עם AI

### 3. Cloudflare Workers

#### Workers שונים:
1. **spspec.shalom-cohen-111.workers.dev**
   - יצירת Overview/Technical/Market/Design
   - תיקון דיאגרמות
   - יצירת Mockups

2. **mockup.shalom-cohen-111.workers.dev**
   - יצירת Mockups HTML+CSS
   - ניתוח מסכים
   - יצירת Mockup יחיד

3. **generate-mindmap.shalom-cohen-111.workers.dev**
   - יצירת Mind Map ב-Drawflow format

4. **promtmaker.shalom-cohen-111.workers.dev**
   - יצירת פרומפטים מפורטים

5. **healthcheck.shalom-cohen-111.workers.dev**
   - בדיקת בריאות המערכת

6. **jiramaker.shalom-cohen-111.workers.dev**
   - יצירת Jira tickets

### 4. Lemon Squeezy

#### תפקיד: מערכת תשלומים
- **Checkout**: יצירת checkout sessions
- **Webhooks**: עיבוד רכישות
- **Subscriptions**: ניהול מנויי Pro
- **קבצים**: `backend/server/lemon-routes.js`, `backend/server/lemon-purchase-service.js`, `backend/server/lemon-credits-service.js`

### 5. Google Services

#### Google Analytics
- **תפקיד**: ניתוח תנועה
- **ID**: G-RWBT69JCM7
- **קבצים**: `_includes/analytics.html`

#### Google Fonts
- **תפקיד**: פונטים
- **פונטים**: Inter, Montserrat

#### Google Apps Script (אופציונלי)
- **תפקיד**: אינטגרציה עם Google Sheets
- **קבצים**: `backend/server/google-apps-script.js`

### 6. CDN Services

#### Font Awesome
- **תפקיד**: אייקונים
- **CDN**: cdnjs.cloudflare.com

#### Mermaid.js
- **תפקיד**: דיאגרמות
- **CDN**: unpkg.com

---

## 🏗️ מבנה האתר הכללי

### מבנה תיקיות

```
specifys-ai/
├── _config.yml              # Jekyll configuration
├── _layouts/                 # Jekyll layouts
│   ├── default.html
│   ├── dashboard.html
│   ├── post.html
│   └── ...
├── _includes/                # Jekyll includes
│   ├── header.html
│   ├── footer.html
│   ├── firebase-init.html
│   └── ...
├── _posts/                  # Blog posts
├── pages/                   # Main pages
│   ├── index.html (דף הבית)
│   ├── auth.html
│   ├── profile.html
│   ├── spec-viewer.html
│   └── ...
├── apps/                    # Next.js app
│   └── web/
│       ├── app/             # Next.js pages
│       ├── components/      # React components
│       └── lib/             # Utilities
├── backend/                 # Backend server
│   └── server/
│       ├── server.js        # Main server
│       ├── *-routes.js      # API routes
│       └── *-service.js     # Business logic
├── assets/                  # Static assets
│   ├── css/                 # Stylesheets
│   │   ├── core/           # Core styles
│   │   ├── components/    # Component styles
│   │   ├── pages/         # Page-specific styles
│   │   └── utilities/     # Utility classes
│   └── js/                 # JavaScript files
│       ├── index.js        # Homepage logic
│       ├── credits-display.js
│       └── ...
├── tools/                   # Tools and utilities
│   ├── prompts.js          # AI prompts
│   └── ...
└── docs/                    # Documentation
```

### זרימת נתונים

```
User → Frontend (Jekyll/Next.js)
  ↓
Firebase Auth (Authentication)
  ↓
Backend API (Express)
  ↓
Firebase Firestore (Database)
  ↓
Cloudflare Workers / OpenAI (AI Services)
  ↓
Response → Frontend → User
```

### API Structure

```
/api/
├── users/           # User management
├── specs/          # Spec management
├── credits/        # Credits system
├── chat/           # AI chat
├── lemon/          # Payments (Lemon Squeezy)
├── admin/          # Admin operations
├── blog/           # Blog management
├── articles/       # Articles management
├── academy/        # Academy management
├── health/         # Health checks
└── stats/          # Statistics
```

### Data Flow - יצירת מפרט

```
1. User answers questions (Frontend)
   ↓
2. generateSpecification() (Frontend)
   ↓
3. POST /api/generate-spec (Backend)
   ↓
4. Cloudflare Worker (AI Generation)
   ↓
5. Response → Backend
   ↓
6. saveSpecToFirebase() (Frontend)
   ↓
7. Firestore (Database)
   ↓
8. Redirect to spec-viewer.html
```

### Data Flow - Chat עם AI

```
1. User sends message (Frontend)
   ↓
2. POST /api/chat/message (Backend)
   ↓
3. Chat Service (Backend)
   ↓
4. OpenAI Storage Service
   ↓
5. OpenAI Assistants API
   ↓
6. Response → Backend
   ↓
7. Frontend displays response
```

---

## 💡 המלצות להמשך

### 1. אופטימיזציה טכנית

#### Performance
- ✅ **Code Splitting**: פיצול קבצי JS גדולים
- ✅ **Lazy Loading**: טעינה דינמית של components
- ✅ **Image Optimization**: אופטימיזציה של תמונות
- ✅ **Caching Strategy**: שיפור אסטרטגיית cache

#### Code Quality
- ✅ **TypeScript Migration**: מעבר מלא ל-TypeScript
- ✅ **Testing**: הוספת Unit Tests ו-Integration Tests
- ✅ **Error Monitoring**: שיפור ניטור שגיאות (Sentry)
- ✅ **Documentation**: תיעוד API מקיף

### 2. שיפורי UX/UI

#### User Experience
- ✅ **Loading States**: שיפור מצבי טעינה
- ✅ **Error Messages**: הודעות שגיאה ברורות יותר
- ✅ **Onboarding**: תהליך onboarding למשתמשים חדשים
- ✅ **Accessibility**: שיפור נגישות (WCAG 2.1 Level AA)

#### Design System
- ✅ **Component Library**: ספריית components מרכזית
- ✅ **Design Tokens**: הרחבת Design Tokens
- ✅ **Responsive Design**: שיפור responsive design

### 3. תכונות חדשות

#### AI Features
- ✅ **Multi-language Support**: תמיכה בשפות נוספות
- ✅ **Voice Commands**: פקודות קוליות
- ✅ **AI Suggestions**: הצעות AI חכמות יותר
- ✅ **Template Library**: ספריית תבניות

#### Collaboration
- ✅ **Team Workspaces**: עבודה בצוותים
- ✅ **Sharing**: שיתוף מפרטים
- ✅ **Comments**: מערכת הערות
- ✅ **Version Control**: ניהול גרסאות

#### Integrations
- ✅ **GitHub Integration**: אינטגרציה עם GitHub
- ✅ **Slack Integration**: אינטגרציה עם Slack
- ✅ **Notion Integration**: אינטגרציה עם Notion
- ✅ **Figma Integration**: אינטגרציה עם Figma

### 4. אבטחה

#### Security Improvements
- ✅ **Rate Limiting**: שיפור rate limiting
- ✅ **Input Validation**: ולידציה מקיפה יותר
- ✅ **CSRF Protection**: הגנה מפני CSRF
- ✅ **Security Headers**: שיפור security headers

### 5. ניטור ואנליטיקה

#### Monitoring
- ✅ **Error Tracking**: שיפור ניטור שגיאות
- ✅ **Performance Monitoring**: ניטור ביצועים
- ✅ **User Analytics**: אנליטיקה מתקדמת
- ✅ **A/B Testing**: מערכת A/B testing

### 6. תחזוקה

#### Code Maintenance
- ✅ **Code Review**: תהליך code review
- ✅ **Automated Testing**: בדיקות אוטומטיות
- ✅ **CI/CD**: שיפור תהליך CI/CD
- ✅ **Documentation**: תיעוד מתעדכן

### 7. Scalability

#### Infrastructure
- ✅ **Database Optimization**: אופטימיזציה של Firestore
- ✅ **Caching Layer**: שכבת cache מתקדמת
- ✅ **CDN**: שימוש ב-CDN לתמונות
- ✅ **Load Balancing**: Load balancing (אם צריך)

### 8. Business

#### Monetization
- ✅ **Pricing Tiers**: תוכניות תמחור נוספות
- ✅ **Enterprise Plans**: תוכניות Enterprise
- ✅ **API Access**: גישה ל-API (למפתחים)
- ✅ **White-label**: פתרון White-label

#### Marketing
- ✅ **SEO**: שיפור SEO
- ✅ **Content Marketing**: תוכן שיווקי
- ✅ **Social Media**: נוכחות ברשתות חברתיות
- ✅ **Partnerships**: שותפויות אסטרטגיות

---

## 📊 סיכום סטטיסטיקות

### דפים
- **דפים ציבוריים**: ~15 דפים
- **דפי משתמש**: ~5 דפים
- **דפי ניהול**: ~5 דפים
- **פוסטי בלוג**: 7+ פוסטים

### API Endpoints
- **Users**: 3 endpoints
- **Specs**: 7 endpoints
- **Credits**: 3 endpoints
- **Chat**: 5 endpoints
- **Admin**: 10+ endpoints
- **Blog/Articles**: 8 endpoints
- **Academy**: 1 endpoint
- **Health/Stats**: 4 endpoints
- **Lemon**: 2 endpoints
- **סה"כ**: ~50 endpoints

### Cloudflare Workers
- **6 workers** פעילים

### קבצים
- **CSS**: 50+ קבצים
- **JavaScript**: 40+ קבצים
- **Backend Routes**: 10+ routes
- **Backend Services**: 8+ services

### תלויות מרכזיות
- **Firebase** (Auth, Firestore)
- **OpenAI** (API, Assistants)
- **Cloudflare Workers** (AI Generation)
- **Lemon Squeezy** (Payments)
- **Google Analytics** (Analytics)

---

## 📝 הערות חשובות

### ארכיטקטורה היברידית
האתר משתמש ב-**ארכיטקטורה היברידית**:
- **Jekyll** לדפים סטטיים
- **Next.js** לחלק מהדפים (בתהליך מיגרציה)
- **Vanilla JavaScript** לרוב הדפים

### מיגרציה ל-Next.js
חלק מהדפים כבר בנויים ב-Next.js (`apps/web/`), אך רוב האתר עדיין ב-Jekyll. יש להמשיך את המיגרציה בהדרגה.

### Backend Unified Server
השרת הוא **Unified Server v2.0.0** המאחד את כל ה-API endpoints במקום אחד.

### Real-time Updates
מערכת הקרדיטים משתמשת ב-**Firestore Listeners** לעדכון מיידי ללא polling.

### Retry Mechanisms
רוב הפעולות כוללות **Retry Mechanisms** עם exponential backoff לטיפול בשגיאות.

---

**תאריך עדכון אחרון:** 2025-01-27  
**עודכן על ידי:** AI Assistant  
**גרסה:** 2.0

