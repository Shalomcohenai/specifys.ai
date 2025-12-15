# מיפוי מקיף של האתר - Specifys.ai

## תוכן עניינים
1. [מיפוי דפים](#מיפוי-דפים)
2. [מיפוי מערכות](#מיפוי-מערכות)
3. [מיפוי APIs ו-Workers](#מיפוי-apis-ו-workers)
4. [מיפוי קבצי CSS/JS גלובליים](#מיפוי-קבצי-cssjs-גלובליים)

---

## מיפוי דפים

### 1. `index.html` - דף הבית

#### קבצי CSS:
- **Core CSS** (גלובלי):
  - `/assets/css/core/variables.css` - משתנים
  - `/assets/css/core/fonts.css` - פונטים
  - `/assets/css/core/reset.css` - איפוס
  - `/assets/css/core/typography.css` - טיפוגרפיה
  - `/assets/css/core/base.css` - בסיס
- **Components CSS** (גלובלי):
  - `/assets/css/components/buttons.css`
  - `/assets/css/components/header.css`
  - `/assets/css/components/footer.css`
  - `/assets/css/components/icons.css`
  - `/assets/css/components/mermaid.css`
  - `/assets/css/components/tables.css`
- **Main CSS** (גלובלי):
  - `/assets/css/main.css`
- **Page-specific CSS**:
  - `/assets/css/pages/index.css`
  - `/assets/css/components/live-brief-modal.css`
  - `/assets/css/pages/why.css`

#### קבצי JS:
- **Core JS** (גלובלי):
  - `/assets/js/config.js` - הגדרות API
  - `/assets/js/app-logger.js` - לוגים
  - `/assets/js/css-monitor.js` - ניטור CSS
- **Credits & Paywall**:
  - `/assets/js/credits-display.js` - הצגת קרדיטים
  - `/assets/js/paywall.js` - בדיקת זכאות
- **Question Flow**:
  - `/tools/prompts.js` - פרומפטים
  - `/assets/js/question-flow-state.js` - ניהול מצב
  - `/assets/js/question-flow-view.js` - תצוגה
  - `/assets/js/question-flow-controller.js` - בקר
- **Live Brief**:
  - `/assets/js/live-brief-modal.js` - מודל Live Brief
- **Page-specific JS**:
  - `/assets/js/index.js` - לוגיקת דף הבית
  - `/assets/js/why.js` - סקשן Why
- **Libraries**:
  - `mermaid.min.js` (CDN) - דיאגרמות

#### פונקציות JS עיקריות (`index.js`):
1. **Modal Functions**:
   - `showWelcomeModal()` - הצגת מודל ברכה
   - `closeWelcomeModal()` - סגירת מודל ברכה
   - `showRegistrationModal()` - הצגת מודל רישום
   - `closeRegistrationModal()` - סגירת מודל רישום

2. **UI Functions**:
   - `checkFirstVisit()` - בדיקת ביקור ראשון
   - `toggleMenu()` - פתיחה/סגירה של תפריט
   - `toggleFAQ(index)` - פתיחה/סגירה של שאלות נפוצות
   - `loadDynamicStats()` - טעינת סטטיסטיקות דינמיות
   - `animateCounter(element, target, duration)` - אנימציית מונה
   - `animateToolsShowcase()` - אנימציית כלים

3. **Authentication**:
   - `isUserAuthenticated()` - בדיקת אימות
   - `handleStartButtonClick()` - טיפול בלחיצה על כפתור Start

4. **Question Flow**:
   - `proceedWithAppPlanning()` - התחלת תהליך תכנון
   - `showModernInput(prefilledAnswers)` - הצגת טופס שאלות
   - `showCurrentQuestion()` - הצגת שאלה נוכחית
   - `updateProgressDots()` - עדכון נקודות התקדמות
   - `nextQuestion()` - מעבר לשאלה הבאה
   - `previousQuestion()` - חזרה לשאלה הקודמת
   - `jumpToQuestion(questionIndex)` - קפיצה לשאלה ספציפית
   - `setupModernInput()` - הגדרת טופס שאלות

5. **Spec Generation**:
   - `generateSpecification()` - יצירת מפרט
   - `saveSpecToFirebase(overviewContent, answers)` - שמירת מפרט ל-Firebase
   - `triggerOpenAIUpload(specId)` - העלאה ל-OpenAI Storage

6. **UI Helpers**:
   - `showLoadingOverlay()` - הצגת מסך טעינה
   - `hideLoadingOverlay()` - הסתרת מסך טעינה
   - `initSpeechRecognition()` - אתחול זיהוי קול
   - `toggleRecording()` - הפעלה/כיבוי הקלטה

#### API Calls:
- `POST /api/users/initialize` - אתחול משתמש (יצירת users + entitlements ב-Transaction)
- `POST /api/generate-spec` - יצירת Overview
- `POST /api/specs/consume-credit` - צריכת קרדיט
- `POST /api/credits/refund` - החזר קרדיט (במקרה כשל)
- `POST /api/specs/{specId}/upload-to-openai` - העלאה ל-OpenAI

#### Workers:
- `https://spspec.shalom-cohen-111.workers.dev/generate` - יצירת Overview (דרך Backend)

---

### 2. `pages/spec-viewer.html` - צפייה ועריכה במפרט

#### קבצי CSS:
- **Core CSS** (גלובלי) - כמו index.html
- **Page-specific CSS**:
  - `/assets/css/pages/spec-viewer.css`

#### קבצי JS:
- **Core JS** (גלובלי):
  - `/assets/js/config.js`
  - `/assets/js/app-logger.js`
  - `/assets/js/css-monitor.js`
- **Page-specific JS**:
  - `/tools/prompts.js`
  - `/assets/js/mermaid.js` - דיאגרמות Mermaid

#### פונקציות JS עיקריות (99 פונקציות):
1. **Spec Loading & Display**:
   - `loadSpec(specId)` - טעינת מפרט
   - `displaySpec(data)` - הצגת מפרט
   - `displayOverview(overview)` - הצגת Overview
   - `displayTechnical(technical)` - הצגת Technical
   - `displayMarket(market)` - הצגת Market
   - `displayDesign(design)` - הצגת Design
   - `displayRaw(data)` - הצגת Raw Data
   - `displayDiagramsFromData(data)` - הצגת דיאגרמות
   - `displayPromptsFromData(data)` - הצגת פרומפטים

2. **Tab Management**:
   - `showTab(tabName)` - מעבר בין טאבים
   - `updateStatus(type, status)` - עדכון סטטוס טאב
   - `updateNotificationDot(type, status)` - עדכון נקודת התראה
   - `updateTabLoadingState(type, isLoading)` - עדכון מצב טעינה

3. **Edit Mode**:
   - `toggleEditMode()` - הפעלה/כיבוי מצב עריכה
   - `saveOverviewEdit()` - שמירת עריכת Overview

4. **Approval & Generation**:
   - `approveOverview()` - אישור Overview
   - `generateTechnicalSpec(retryCount, maxRetries)` - יצירת Technical
   - `generateMarketSpec(retryCount, maxRetries)` - יצירת Market
   - `generateDesignSpec(retryCount, maxRetries)` - יצירת Design
   - `retryTechnical()` - ניסיון חוזר ל-Technical
   - `retryMarket()` - ניסיון חוזר ל-Market
   - `retryDesign()` - ניסיון חוזר ל-Design

5. **Mind Map**:
   - `initializeMindMapTab()` - אתחול טאב Mind Map
   - `generateMindMap()` - יצירת Mind Map
   - `displayMindMap(data)` - הצגת Mind Map
   - `retryMindMap()` - ניסיון חוזר

6. **Mockups**:
   - `generateMockupSpec()` - יצירת Mockups
   - `generateSingleMockupWithRetry(screen, maxRetries)` - יצירת Mockup יחיד
   - `displayMockup(mockupData)` - הצגת Mockups
   - `switchMockupScreen(index)` - מעבר בין מסכים
   - `retryMockup()` - ניסיון חוזר

7. **Diagrams**:
   - `generateDiagrams()` - יצירת דיאגרמות
   - `autoRepairBrokenDiagrams()` - תיקון אוטומטי של דיאגרמות שבורות
   - `renderSingleDiagram(diagramData, containerId, isRefresh)` - רינדור דיאגרמה

8. **Prompts**:
   - `generatePrompts()` - יצירת פרומפטים

9. **Chat**:
   - `initializeChat()` - אתחול Chat (עם retry mechanism)
   - `sendChatMessage()` - שליחת הודעה (עם optimistic updates, retry mechanism)
   - `retryChatOperation()` - Retry mechanism ב-frontend
   - `addChatMessage()` - הוספת הודעה ל-UI
   - `showChatLoading()` / `hideChatLoading()` - מצבי טעינה
   - `saveChatHistory()` / `loadChatHistory()` - שמירה/טעינה מ-localStorage

10. **Firebase Operations**:
    - `saveSpecToFirebase(user, specData)` - שמירה ל-Firebase
    - `triggerOpenAIUploadForSpec(specId)` - העלאה ל-OpenAI

#### API Calls:
- `POST /api/specs/{specId}/upload-to-openai` - העלאה ל-OpenAI
- `POST /api/specs/{specId}/send-ready-notification` - שליחת התראה
- `POST /api/specs/{specId}/approve-overview` - אישור Overview
- `POST /api/chat/init` - אתחול Chat
- `POST /api/chat/message` - שליחת הודעה
- `POST /api/chat/diagrams/generate` - יצירת דיאגרמות
- `POST /api/chat/diagrams/repair` - תיקון דיאגרמות

#### Workers:
- `https://spspec.shalom-cohen-111.workers.dev/generate` - יצירת Technical/Market/Design
- `https://mockup.shalom-cohen-111.workers.dev/generate` - יצירת Mockups
- `https://mockup.shalom-cohen-111.workers.dev/analyze-screens` - ניתוח מסכים
- `https://mockup.shalom-cohen-111.workers.dev/generate-single-mockup` - יצירת Mockup יחיד
- `https://generate-mindmap.shalom-cohen-111.workers.dev/` - יצירת Mind Map
- `https://promtmaker.shalom-cohen-111.workers.dev/generate` - יצירת פרומפטים
- `https://jiramaker.shalom-cohen-111.workers.dev/` - יצירת Jira

---

### 3. `pages/profile.html` - פרופיל משתמש

#### קבצי CSS:
- **Core CSS** (גלובלי) - כמו index.html
- **Page-specific CSS**:
  - `/assets/css/pages/profile.css`

#### קבצי JS:
- **Core JS** (גלובלי):
  - `/assets/js/css-monitor.js`
  - `/assets/js/lib-loader.js` - טעינה דינמית של ספריות
  - `/assets/js/config.js`
- **Page-specific JS**:
  - `/assets/js/script.js` - לוגיקת פרופיל

#### API Calls:
- `GET /api/specs/entitlements` - קבלת entitlements
- `GET /api/specs` - רשימת מפרטים
- `POST /api/lemon/subscription/cancel` - ביטול מנוי

---

### 4. `pages/auth.html` - התחברות/הרשמה

#### קבצי CSS:
- **Core CSS** (גלובלי) - כמו index.html
- **Page-specific CSS**:
  - `/assets/css/pages/auth.css`

#### קבצי JS:
- **Core JS** (גלובלי):
  - `/assets/js/css-monitor.js`
  - `/assets/js/credits-config.js` - הגדרות קרדיטים
- **Page-specific JS**:
  - `/assets/js/script.js`
  - `/assets/js/mobile-optimizations.js` - אופטימיזציות למובייל

#### API Calls:
- Firebase Authentication (client-side)

---

### 5. `pages/admin-dashboard.html` - לוח בקרה למנהלים

#### קבצי CSS:
- **Core CSS** (גלובלי) - כמו index.html
- **Page-specific CSS**:
  - `/assets/css/pages/admin-dashboard.css`
  - `/assets/css/pages/articles-manager.css`

#### קבצי JS:
- **Core JS** (גלובלי):
  - `/assets/js/config.js`
- **Page-specific JS**:
  - `/assets/js/admin-dashboard.js` (module)
  - `/assets/js/articles-manager.js` (module)

#### API Calls:
- `GET /api/admin/*` - כל ה-endpoints של Admin
- `GET /api/health/test-spec` - בדיקת בריאות (קורא ל-worker-healthcheck)

#### Workers:
- `https://healthcheck.shalom-cohen-111.workers.dev/health` - בדיקת בריאות

---

### 6. `pages/legacy-viewer.html` - צפייה במפרטים ישנים

#### קבצי CSS:
- **Core CSS** (גלובלי) - כמו index.html

#### קבצי JS:
- **Libraries** (conditional):
  - `mermaid` - דיאגרמות
  - `marked` - Markdown

---

### 7. `pages/dynamic-post.html` - דף דינמי לבלוג

#### קבצי CSS:
- **Core CSS** (גלובלי) - כמו index.html

#### קבצי JS:
- `/assets/js/post.js` - לוגיקת פוסט

---

### 8. דפים נוספים:
- `pages/about.html` - אודות
- `pages/how.html` - איך זה עובד
- `pages/why.html` - למה
- `pages/pricing.html` - תמחור
- `pages/articles.html` - מאמרים
- `pages/article.html` - מאמר בודד
- `pages/demo-spec.html` - דמו מפרט
- `pages/ToolPicker.html` - בוחר כלים
- `pages/maintenance.html` - תחזוקה
- `pages/404.html` - שגיאה 404

---

## מיפוי מערכות

### 1. מערכת קרדיטים (Credits System)

#### Backend Files:
- `backend/server/credits-service.js` - לוגיקת קרדיטים (1,036 שורות)
- `backend/server/credits-routes.js` - API routes (239 שורות)

#### API Endpoints:
- `POST /api/credits/grant` - הענקת קרדיטים (Admin only)
- `POST /api/credits/refund` - החזר קרדיטים
- `GET /api/credits/transactions` - היסטוריית עסקאות
- `GET /api/credits/entitlements` - קבלת זכאויות
- `POST /api/specs/consume-credit` - צריכת קרדיט (במהלך יצירת מפרט)
- `GET /api/specs/entitlements` - קבלת זכאויות (alias)

#### Frontend Files:
- `assets/js/credits-display.js` - הצגת קרדיטים (עם Firestore listeners)
- `assets/js/paywall.js` - בדיקת זכאות ו-checkout
- `assets/js/credits-config.js` - הגדרות
- `assets/js/entitlements-cache.js` - Cache לזכאויות (TTL 5 דקות)

#### Firestore Collections:
- `credits_transactions` - היסטוריית עסקאות (transactionId = document ID)
- `entitlements` - זכאויות משתמשים (userId = document ID)
- `users` - משתמשים (מכיל free_specs_remaining)
- `subscriptions` - מנויי Pro

#### Flow:
1. **צריכת קרדיט**:
   - משתמש יוצר מפרט → `generateSpecification()` ב-`index.js`
   - בדיקת זכאות דרך `checkEntitlement()` ב-`paywall.js`
   - אם יש קרדיטים → `POST /api/specs/consume-credit`
   - Backend קורא ל-`creditsService.consumeCredit()`
   - Firestore Transaction אטומי: עדכון `entitlements` + רישום ב-`credits_transactions`
   - אם נכשל → `POST /api/credits/refund` (rollback)
   - Frontend: `clearEntitlementsCache()` + `updateCreditsDisplay()`

2. **הענקת קרדיט**:
   - Admin → `POST /api/credits/grant`
   - או דרך Lemon Squeezy webhook → `POST /api/lemon/webhook`
   - `creditsService.grantCredits()` מעדכן Firestore (Transaction אטומי)
   - Firestore listeners מעדכנים UI אוטומטית

3. **הצגת קרדיטים** (Real-time):
   - `credits-display.js` → `initCreditsListeners()` - Firestore listeners
   - מאזין ל-`entitlements` ו-`users` collections
   - עדכון מיידי כשמסמכים משתנים (ללא polling)
   - Fallback: `GET /api/specs/entitlements` או cache (`window.getEntitlements()`)
   - Retry mechanism למשתמש חדש (3 ניסיונות עם exponential backoff)

4. **רכישת קרדיטים**:
   - `startCheckout()` ב-`paywall.js` → `POST /api/lemon/checkout`
   - אחרי checkout success: `clearEntitlementsCache()` + `updateCreditsDisplay({ forceRefresh: true })`
   - Retry אחרי 2 ו-5 שניות (לתת זמן ל-webhook)
   - Firestore listeners מעדכנים UI אוטומטית כשהקרדיטים מתווספים

#### מאפיינים טכניים:
- **Real-time Updates**: Firestore listeners לעדכון מיידי (ללא polling)
- **Idempotency**: כל עסקה עם `transactionId` ייחודי
- **Atomicity**: Firestore Transactions למניעת race conditions
- **Retry Mechanism**: למשתמש חדש (3 ניסיונות, delays: 1s, 2s, 3s)
- **Cache**: localStorage + memory cache (TTL 5 דקות)
- **Error Handling**: Fallback ל-API אם Firestore לא זמין

#### Dependencies:
- Firebase Admin SDK (Backend)
- Firebase/Firestore (Frontend - compat mode)
- Lemon Squeezy (לתשלומים)

---

### 2. מערכת יוזרים (User System)

#### Backend Files:
- `backend/server/user-routes.js` - API routes
- `backend/server/user-management.js` - ניהול משתמשים

#### API Endpoints:
- `POST /api/users/initialize` - אתחול משתמש (יצירת users + entitlements ב-Transaction אטומית)
- `GET /api/users/me` - מידע משתמש נוכחי
- `GET /api/users/:userId` - מידע משתמש ספציפי

#### Frontend Files:
- Firebase Auth (client-side)
- `assets/js/script.js` - לוגיקת אימות
- `_includes/firebase-auth.html` - אתחול משתמשים אוטומטי

#### Firestore Collections:
- `users` - מסמכי משתמשים
- `entitlements` - זכאויות

#### Flow:
1. **רישום/התחברות**:
   - משתמש נרשם/מתחבר דרך Firebase Auth
   - `POST /api/users/initialize` נקרא אוטומטית (עם retry mechanism)
   - `initializeUser()` ב-`user-management.js` יוצר/מעדכן מסמכים ב-`users` ו-`entitlements` ב-Transaction אטומית אחת
   - למשתמש חדש: `spec_credits: 1`, `free_specs_remaining: 1`

2. **עדכון פרופיל**:
   - משתמש מעדכן פרופיל
   - `user-management.js` מעדכן Firestore

3. **סנכרון**:
   - `POST /api/sync-users` (Admin only) - סנכרון מ-Firebase Auth ל-Firestore
   - `POST /api/admin/users/sync` - סנכרון דרך Admin Dashboard
   - משתמש ב-`initializeUser()` עם batch processing (50 משתמשים בכל batch)

#### מאפיינים טכניים:
- **Atomicity**: Firestore Transaction ליצירת users + entitlements יחד
- **Idempotency**: אם שני המסמכים קיימים, מחזיר מיד ללא שינוי
- **Retry Mechanism**: 3 ניסיונות עם exponential backoff (500ms, 1s, 2s)
- **Batch Processing**: `syncAllUsers()` מעבד 50 משתמשים במקביל

#### Dependencies:
- Firebase Auth
- Firebase Admin SDK
- Firestore

---

### 3. מערכת Chat (Chat System)

#### Backend Files:
- `backend/server/chat-routes.js` - API routes (משתמש ב-Chat Service)
- `backend/server/chat-service.js` - Service מרכזי לניהול Chat (חדש)
- `backend/server/retry-handler.js` - Retry mechanism מרכזי (חדש)
- `backend/server/openai-storage-service.js` - ניהול OpenAI Storage (לוגים משופרים)

#### API Endpoints:
- `POST /api/chat/init` - אתחול Chat session
- `POST /api/chat/message` - שליחת הודעה ל-AI
- `POST /api/chat/diagrams/generate` - יצירת דיאגרמות
- `POST /api/chat/diagrams/repair` - תיקון דיאגרמות שבורות
- `POST /api/chat/demo` - Chat פומבי לדמו

#### Frontend Files:
- `pages/spec-viewer.html` - פונקציות Chat מובנות (עם retry mechanism, optimistic updates)

#### Firestore Collections:
- `specs` - מפרטים (מכיל `openaiFileId`, `openaiAssistantId`)

#### Flow:
1. **אתחול Chat**:
   - משתמש לוחץ על טאב Chat
   - `initializeChat()` ב-`spec-viewer.html` קורא ל-`POST /api/chat/init`
   - `ChatService.ensureSpecReadyForChat()` מבטיח שהמפרט מועלה ל-OpenAI
   - `ChatService.getOrCreateAssistant()` יוצר/מקבל Assistant עם Vector Store
   - `ChatService.createThread()` יוצר Thread חדש
   - Frontend מקבל `threadId` ו-`assistantId`
   - טעינת היסטוריית Chat מ-localStorage

2. **שליחת הודעה**:
   - משתמש שולח הודעה
   - Optimistic update: הודעת המשתמש מוצגת מיד
   - `sendChatMessage()` ב-`spec-viewer.html` קורא ל-`POST /api/chat/message`
   - Backend משתמש ב-`retryWithBackoff()` לשליחת הודעה
   - אם Assistant מקולקל → `ChatService.handleAssistantError()` יוצר Assistant חדש
   - תגובת AI מוחזרת ומוצגת ב-UI
   - שמירה ל-localStorage

3. **יצירת דיאגרמות**:
   - משתמש מבקש ליצור דיאגרמות
   - `POST /api/chat/diagrams/generate`
   - Backend משתמש ב-`ChatService.ensureSpecReadyForChat()`
   - `retryWithBackoff()` ליצירת דיאגרמות
   - אם Assistant מקולקל → יצירה מחדש אוטומטית
   - דיאגרמות מוחזרות ומוצגות

4. **תיקון דיאגרמות**:
   - משתמש מבקש לתקן דיאגרמה שבורה
   - `POST /api/chat/diagrams/repair`
   - Backend משתמש ב-`retryWithBackoff()`
   - דיאגרמה מתוקנת מוחזרת

#### מאפיינים טכניים:
- **Chat Service מרכזי**: איחוד כל הלוגיקה הכפולה (הפחתה של ~40% בקוד)
- **Retry Mechanism**: Retry עם exponential backoff לכל הפעולות
- **Caching**: In-memory cache של Assistant IDs ו-Thread IDs
- **Error Handling**: טיפול אוטומטי בשגיאות Assistant (recreation)
- **Optimistic Updates**: הודעות משתמש מוצגות מיד (Frontend)
- **Error Recovery**: ניסיון אוטומטי להתחבר מחדש (Frontend)
- **Idempotency**: כל פעולה עם retry mechanism
- **Atomicity**: Firestore Transactions למניעת race conditions

#### Dependencies:
- OpenAI Storage Service (Assistants API)
- Firebase/Firestore
- Retry Handler

---

### 4. מערכת יצירת מפרטים (Spec Generation System)

#### Backend Files:
- `backend/server/specs-routes.js` - API routes
- `backend/server/server.js` - `/api/generate-spec` endpoint
- `backend/server/openai-storage-service.js` - ניהול OpenAI Storage (לוגים משופרים)

#### API Endpoints:
- `POST /api/generate-spec` - יצירת Overview
- `POST /api/specs/create` - יצירת spec חדש
- `GET /api/specs/:id` - קבלת spec
- `PUT /api/specs/:id` - עדכון spec
- `POST /api/specs/:id/upload-to-openai` - העלאה ל-OpenAI Storage
- `POST /api/specs/:id/approve-overview` - אישור Overview
- `GET /api/specs/entitlements` - קבלת entitlements

#### Frontend Files:
- `assets/js/index.js` - יצירת Overview
- `pages/spec-viewer.html` - צפייה ועריכה
- `tools/prompts.js` - פרומפטים

#### Workers:
- `https://spspec.shalom-cohen-111.workers.dev/generate` - יצירת Overview/Technical/Market/Design
- `https://mockup.shalom-cohen-111.workers.dev/*` - יצירת Mockups
- `https://generate-mindmap.shalom-cohen-111.workers.dev/` - יצירת Mind Map
- `https://promtmaker.shalom-cohen-111.workers.dev/generate` - יצירת פרומפטים

#### Firestore Collections:
- `specs` - מפרטים

#### Flow:
1. **יצירת Overview**:
   - משתמש עונה על שאלות ב-`index.html`
   - `generateSpecification()` ב-`index.js` בונה פרומפט
   - `POST /api/generate-spec` עם הפרומפט
   - Backend שולח ל-`https://spspec.shalom-cohen-111.workers.dev/generate`
   - Worker קורא ל-OpenAI API (gpt-4o-mini)
   - Worker מחזיר Overview
   - Backend ממיר ומחזיר
   - `saveSpecToFirebase()` שומר ל-Firestore
   - Redirect ל-`spec-viewer.html`

2. **אישור Overview ויצירת מפרטים מלאים**:
   - משתמש מאשר Overview
   - `approveOverview()` ב-`spec-viewer.html`
   - `POST /api/specs/:id/approve-overview`
   - Backend יוצר סדרתית: Technical → Market → Design
   - כל אחד קורא ל-`https://spspec.shalom-cohen-111.workers.dev/generate` עם stage מתאים
   - שמירה ל-Firestore

3. **יצירת Mockups**:
   - משתמש PRO לוחץ "Generate Mockups"
   - `generateMockupSpec()` ב-`spec-viewer.html`
   - `POST https://mockup.shalom-cohen-111.workers.dev/analyze-screens` - ניתוח מסכים
   - `POST https://mockup.shalom-cohen-111.workers.dev/generate-single-mockup` - יצירת Mockup לכל מסך
   - שמירה ל-Firestore

4. **יצירת Mind Map**:
   - `generateMindMap()` ב-`spec-viewer.html`
   - `POST https://generate-mindmap.shalom-cohen-111.workers.dev/`
   - Worker מחזיר Drawflow JSON
   - הצגה ב-UI

5. **Chat עם AI**:
   - `POST /api/chat/init` - אתחול Chat (משתמש ב-Chat Service)
   - `POST /api/chat/message` - שליחת הודעה (עם retry mechanism)
   - `POST /api/chat/diagrams/generate` - יצירת דיאגרמות (עם retry mechanism)
   - `POST /api/chat/diagrams/repair` - תיקון דיאגרמות (עם retry mechanism)
   - Backend משתמש ב-Chat Service (מרכזי) ו-OpenAI Storage Service
   - Retry mechanism מרכזי עם exponential backoff
   - Caching של Assistant IDs ו-Thread IDs
   - תגובה מוחזרת למשתמש

#### Dependencies:
- Cloudflare Workers
- OpenAI API
- Firebase/Firestore
- OpenAI Storage (Assistants API)

---

## מיפוי APIs ו-Workers

### Backend API Endpoints:

#### Users (`/api/users`):
- `POST /api/users/initialize` - אתחול משתמש (יצירת users + entitlements ב-Transaction אטומית)
- `GET /api/users/me` - מידע משתמש נוכחי
- `GET /api/users/:userId` - מידע משתמש ספציפי

#### Specs (`/api/specs`):
- `POST /api/specs/create` - יצירת spec חדש
- `GET /api/specs/:id` - קבלת spec
- `PUT /api/specs/:id` - עדכון spec
- `POST /api/specs/:id/upload-to-openai` - העלאה ל-OpenAI Storage
- `POST /api/specs/:id/approve-overview` - אישור Overview
- `GET /api/specs/entitlements` - קבלת entitlements
- `POST /api/specs/consume-credit` - צריכת קרדיט

#### Credits (`/api/credits`):
- `POST /api/credits/grant` - הענקת קרדיטים (Admin)
- `POST /api/credits/refund` - החזר קרדיטים
- `GET /api/credits/transactions` - היסטוריית עסקאות

#### Chat (`/api/chat`):
- `POST /api/chat/init` - אתחול Chat (משתמש ב-Chat Service, retry mechanism)
- `POST /api/chat/message` - שליחת הודעה (עם retry mechanism, טיפול בשגיאות משופר)
- `POST /api/chat/diagrams/generate` - יצירת דיאגרמות (עם retry mechanism)
- `POST /api/chat/diagrams/repair` - תיקון דיאגרמות (עם retry mechanism)
- `POST /api/chat/demo` - Chat פומבי לדמו (עם retry mechanism)

#### Generate Spec (`/api/generate-spec`):
- `POST /api/generate-spec` - יצירת Overview דרך Worker

#### Admin (`/api/admin`):
- `GET /api/admin/*` - כל ה-endpoints של Admin
- `GET /api/admin/error-logs` - לוגי שגיאות
- `GET /api/admin/css-crash-logs` - לוגי CSS crashes

#### Health (`/api/health`):
- `GET /api/health` - בדיקת בריאות בסיסית
- `GET /api/health/comprehensive` - בדיקה מקיפה
- `GET /api/health/test-spec` - בדיקת Worker

#### Stats (`/api/stats`):
- `GET /api/stats/public` - סטטיסטיקות ציבוריות
- `GET /api/stats/admin` - סטטיסטיקות אדמין

#### Live Brief (`/api/live-brief`):
- `POST /api/live-brief/transcribe` - תמלול קול (Whisper)

#### Blog (`/api/blog`):
- `GET /api/blog/public/posts` - רשימת פוסטים (public)
- `GET /api/blog/public/post` - פוסט בודד (public)
- `POST /api/blog/create-post` - יצירת פוסט (Admin)
- `GET /api/blog/list-posts` - רשימת פוסטים (Admin)
- `POST /api/blog/update-post` - עדכון פוסט (Admin)
- `POST /api/blog/delete-post` - מחיקת פוסט (Admin)

#### Articles (`/api/articles`):
- `POST /api/articles/generate` - יצירת מאמר (Admin)
- `GET /api/articles/list` - רשימת מאמרים
- `GET /api/articles/featured` - מאמרים מומלצים
- `GET /api/articles/:slug` - מאמר בודד
- `POST /api/articles/:slug/view` - עדכון צפיות

#### Academy (`/api/academy`):
- `POST /api/academy/guides/:guideId/view` - עדכון צפיות

#### Lemon Squeezy (`/api/lemon`):
- `POST /api/lemon/checkout` - יצירת checkout session
- `POST /api/lemon/webhook` - קבלת webhook תשלום

---

### Cloudflare Workers:

#### 1. `worker-new.js` (spspec.shalom-cohen-111.workers.dev):
- **Endpoints**:
  - `POST /generate` - יצירת Overview/Technical/Market/Design
  - `POST /fix-diagram` - תיקון דיאגרמה
  - `POST /generate-mockups` - יצירת Mockups
  - `GET /selftest` - בדיקה עצמית
- **Model**: gpt-4o-mini
- **Usage**: יצירת מפרטים

#### 2. `worker-mockups.js` (mockup.shalom-cohen-111.workers.dev):
- **Endpoints**:
  - `POST /generate` - יצירת Mockups
  - `POST /analyze-screens` - ניתוח מסכים
  - `POST /generate-single-mockup` - יצירת Mockup יחיד
  - `GET /health` - בדיקת בריאות
- **Usage**: יצירת Mockups HTML+CSS

#### 3. `worker-mindmap.js` (generate-mindmap.shalom-cohen-111.workers.dev):
- **Endpoints**:
  - `POST /` - יצירת Mind Map
  - `POST /generate-mindmap` - יצירת Mind Map
- **Usage**: יצירת Mind Map ב-Drawflow format

#### 4. `worker-promtmaker-updated.js` (promtmaker.shalom-cohen-111.workers.dev):
- **Endpoints**:
  - `POST /generate` - יצירת פרומפטים מפורטים
- **Usage**: יצירת פרומפטים למפרט

#### 5. `worker-healthcheck.js` (healthcheck.shalom-cohen-111.workers.dev):
- **Endpoints**:
  - `GET /health` - בדיקת בריאות
  - `GET /` - בדיקת בריאות
- **Usage**: בדיקת בריאות המערכת

#### 6. Worker נוסף (jiramaker.shalom-cohen-111.workers.dev):
- **Endpoints**:
  - `POST /` - יצירת Jira
- **Usage**: יצירת Jira tickets

---

## מיפוי קבצי CSS/JS גלובליים

### קבצי CSS גלובליים:

#### Core CSS (חובה לכל דף):
1. `/assets/css/core/variables.css` - משתני CSS
2. `/assets/css/core/fonts.css` - הגדרות פונטים
3. `/assets/css/core/reset.css` - איפוס CSS
4. `/assets/css/core/typography.css` - טיפוגרפיה
5. `/assets/css/core/base.css` - סגנונות בסיס

#### Components CSS (חובה לכל דף):
1. `/assets/css/components/buttons.css` - כפתורים
2. `/assets/css/components/header.css` - כותרת
3. `/assets/css/components/footer.css` - תחתית
4. `/assets/css/components/icons.css` - אייקונים
5. `/assets/css/components/mermaid.css` - דיאגרמות Mermaid
6. `/assets/css/components/tables.css` - טבלאות

#### Main CSS (חובה לכל דף):
1. `/assets/css/main.css` - סגנונות ראשיים

#### Page-specific CSS:
- `/assets/css/pages/index.css` - דף הבית
- `/assets/css/pages/spec-viewer.css` - צפייה במפרט
- `/assets/css/pages/profile.css` - פרופיל
- `/assets/css/pages/auth.css` - התחברות
- `/assets/css/pages/admin-dashboard.css` - לוח בקרה
- `/assets/css/pages/articles-manager.css` - ניהול מאמרים
- `/assets/css/pages/blog-dashboard.css` - (נמחק)

#### Component-specific CSS:
- `/assets/css/components/live-brief-modal.css` - מודל Live Brief
- `/assets/css/pages/why.css` - סקשן Why

---

### קבצי JS גלובליים:

#### Core JS (חובה לכל דף):
1. `/assets/js/config.js` - הגדרות API base URL
2. `/assets/js/app-logger.js` - מערכת לוגים
3. `/assets/js/css-monitor.js` - ניטור שגיאות CSS

#### Credits & Paywall:
1. `/assets/js/credits-display.js` - הצגת קרדיטים (עם Firestore listeners, retry mechanism)
2. `/assets/js/paywall.js` - בדיקת זכאות ו-checkout
3. `/assets/js/credits-config.js` - הגדרות קרדיטים
4. `/assets/js/entitlements-cache.js` - Cache לזכאויות (TTL 5 דקות)

#### Question Flow:
1. `/tools/prompts.js` - פרומפטים
2. `/assets/js/question-flow-state.js` - ניהול מצב
3. `/assets/js/question-flow-view.js` - תצוגה
4. `/assets/js/question-flow-controller.js` - בקר

#### Live Brief:
1. `/assets/js/live-brief-modal.js` - מודל Live Brief

#### Libraries:
1. `/assets/js/lib-loader.js` - טעינה דינמית של ספריות
2. `/assets/js/mermaid.js` - דיאגרמות Mermaid
3. `/assets/js/script.js` - סקריפטים כלליים
4. `/assets/js/mobile-optimizations.js` - אופטימיזציות למובייל

#### Page-specific JS:
1. `/assets/js/index.js` - דף הבית
2. `/assets/js/why.js` - סקשן Why
3. `/assets/js/post.js` - פוסטים
4. `/assets/js/admin-dashboard.js` - לוח בקרה
5. `/assets/js/articles-manager.js` - ניהול מאמרים

#### External Libraries (CDN):
- Firebase SDK (app, auth, firestore)
- Font Awesome
- Google Fonts
- Mermaid.js
- Google Analytics

---

## סיכום

### סטטיסטיקות:
- **דפים פעילים**: ~20 דפים
- **API Endpoints**: ~50 endpoints
- **Cloudflare Workers**: 6 workers
- **קבצי CSS גלובליים**: 12 קבצים
- **קבצי JS גלובליים**: 15+ קבצים
- **פונקציות JS**: 200+ פונקציות

### תלויות מרכזיות:
- Firebase (Auth, Firestore)
- Cloudflare Workers
- OpenAI API
- Lemon Squeezy (תשלומים)
- Google Analytics

---

*עודכן: 2025-01-21*

---

## עדכונים אחרונים

### מערכת הקרדיטים (2025-01-20):
- ✅ הסרת polling (60 שניות) - הוחלף ב-Firestore listeners
- ✅ הוספת Firestore listeners לעדכון מיידי
- ✅ Retry mechanism למשתמש חדש (3 ניסיונות, exponential backoff)
- ✅ Callback אחרי checkout success עם retry
- ✅ שיפור error handling ו-fallback logic

### מערכת המשתמשים (2025-01-20):
- ✅ איחוד קוד - הסרת `createOrUpdateUserDocument()` (79 שורות)
- ✅ יצירת `initializeUser()` עם Firestore Transaction אטומית
- ✅ מחיקת endpoint `/api/users/ensure` (71 שורות)
- ✅ יצירת endpoint חדש `/api/users/initialize` עם Transaction
- ✅ עדכון כל המקומות ב-Frontend לקרוא ל-`/api/users/initialize`
- ✅ הוספת Retry mechanism בכל המקומות (3 ניסיונות, exponential backoff)
- ✅ שיפור `syncAllUsers()` עם batch processing (50 משתמשים במקביל)
- ✅ מחיקת `userAuth.js` (לא היה בשימוש)
- ✅ איחוד כל הקריאות דרך API אחד במקום יצירה ישירה ב-Firestore

### מערכת Chat (2025-01-20):
- ✅ יצירת `retry-handler.js` - Retry mechanism מרכזי עם exponential backoff
- ✅ יצירת `chat-service.js` - Service מרכזי לניהול Chat (איחוד קוד כפול)
- ✅ עדכון `chat-routes.js` - כל ה-endpoints משתמשים ב-Chat Service (הפחתה של ~40% בקוד)
- ✅ ניקוי לוגים - החלפת console.log ב-logger ב-`openai-storage-service.js` (פונקציות עיקריות)
- ✅ שיפור Frontend - הוספת retry mechanism, optimistic updates, error recovery ב-`spec-viewer.html`
- ✅ Caching - In-memory cache של Assistant IDs ו-Thread IDs
- ✅ טיפול בשגיאות משופר - Assistant recreation אוטומטי, retry mechanism לכל הפעולות

