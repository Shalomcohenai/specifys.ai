# Specifys.ai – Full Site Architecture

Comprehensive map of every directory, file, function, route, and dependency in the project. Designed for:
1. Identifying structural problems and inconsistencies
2. Understanding the system for optimization
3. Detecting dead code, duplicates, and legacy remnants

**Last updated:** March 2026

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Backend](#2-backend)
   - [Entry & Config](#21-entry--config)
   - [Routes](#22-routes)
   - [Services](#23-services)
   - [Spec Engine v2](#24-spec-engine-v2)
   - [Lemon Squeezy (Payments)](#25-lemon-squeezy-payments)
   - [Email & Notifications](#26-email--notifications)
   - [Admin & Analytics](#27-admin--analytics)
   - [Automation & Scheduled Jobs](#28-automation--scheduled-jobs)
   - [Backend Scripts](#29-backend-scripts)
3. [Frontend – JavaScript](#3-frontend--javascript)
   - [Root / Core / Utils](#31-root--core--utils)
   - [Components](#32-components)
   - [Services](#33-services)
   - [Features](#34-features)
   - [Pages JS](#35-pages-js)
   - [Admin Dashboard](#36-admin-dashboard)
   - [Bundles](#37-bundles)
4. [Frontend – HTML Pages](#4-frontend--html-pages)
5. [Layouts & Includes](#5-layouts--includes)
6. [CSS / SCSS](#6-css--scss)
7. [Packages (Monorepo)](#7-packages-monorepo)
8. [MCP Server](#8-mcp-server)
9. [Cloudflare Workers](#9-cloudflare-workers)
10. [Blog & Posts](#10-blog--posts)
11. [Tools](#11-tools)
12. [Scripts](#12-scripts)
13. [Root Config Files](#13-root-config-files)
14. [Firestore Collections](#14-firestore-collections)
15. [Environment Variables](#15-environment-variables)
16. [Dead Code & Issues Registry](#16-dead-code--issues-registry)

---

## 1. Project Structure

```
specifys-ai/
├── _config.yml                  # Jekyll config
├── _includes/                   # Jekyll HTML partials (11 files)
├── _layouts/                    # Jekyll layouts (5 files)
├── _plugins/                    # Jekyll plugins (1 file)
├── _posts/                      # Blog posts (45 markdown files)
├── assets/
│   ├── css/                     # SCSS + compiled CSS (~87 files)
│   ├── dist/                    # Vite build output
│   ├── icons/                   # SVG/PNG icons
│   ├── images/                  # Site images
│   └── js/                      # Frontend JavaScript (~111 files)
│       ├── bundles/             # Vite bundle entry points
│       ├── components/          # UI component classes
│       ├── core/                # Core modules (config, logger, security, store)
│       ├── features/            # Feature-specific JS
│       │   ├── demo-spec/
│       │   ├── index/
│       │   ├── legacy-viewer/
│       │   ├── planning/
│       │   ├── profile/
│       │   ├── question-flow/
│       │   ├── share-prompt/
│       │   └── spec-viewer/
│       ├── new-admin-dashboard/  # Admin dashboard SPA
│       ├── pages/               # Page-specific JS
│       ├── services/            # Shared frontend services
│       └── utils/               # Utility modules
├── backend/
│   ├── package.json             # Backend dependencies
│   ├── schemas/                 # Zod schemas (1 file)
│   ├── scripts/                 # Migration/utility scripts (5 files)
│   └── server/                  # Express app (~55 files)
├── blog/                        # Blog index page
├── config/                      # Standalone config package (legacy?)
├── docs/                        # Documentation
├── mcp-server/                  # MCP server for Cursor/Claude
├── packages/                    # Monorepo workspaces
│   ├── api-client/
│   ├── design-system/
│   └── ui/
├── pages/                       # HTML pages (29 files)
├── scripts/                     # Dev/deploy scripts
│   ├── archive/
│   ├── backend/
│   ├── blog/
│   └── localhost/
├── tools/                       # Tools Map feature
├── worker-mockup.js             # Cloudflare Worker source
├── worker-promtmaker-updated.js # Cloudflare Worker source
├── index.html                   # Homepage
├── package.json                 # Root workspace config
├── render.yaml                  # Render deployment
├── vite.config.js               # Vite build config
└── postcss.config.js            # PostCSS pipeline
```

---

## 2. Backend

All backend code lives in `backend/`. Entry point: `backend/server/server.js`. Deployed via Render (`render.yaml`).

### 2.1 Entry & Config

| File | Purpose | Exports |
|------|---------|---------|
| `server/server.js` | Express app entry, route mounting, CORS, compression | App startup (no named exports) |
| `server/config.js` | Central config: port, CORS origins, credits V3 config | `BACKEND_BASE_URL`, `port`, `googleAppsScriptUrl`, `productionServerUrl`, `allowedOrigins`, `creditsV3` |
| `server/firebase-admin.js` | Firebase Admin SDK init | `admin`, `app`, `db`, `auth` |
| `server/logger.js` | Pino logger + Firestore persistence | `logger`, `logRequest`, `logResponse`, `logError`, `logCORS`, `logAuth` |
| `server/error-handler.js` | Central error codes and middleware | `errorHandler`, `createError`, `asyncHandler`, `notFoundHandler`, `ERROR_CODES` |
| `server/error-logger.js` | Persist errors to Firestore `errorLogs` | `logError`, `getErrorLogs`, `getErrorSummary` |
| `server/security.js` | Helmet, rate limiters, Joi validation, admin auth | `securityHeaders`, `rateLimiters`, `validationSchemas`, `validateInput`, `validateBody`, `validateParams`, `securityLogger`, `requireAdmin` |
| `server/admin-config.js` | Admin email list | `ADMIN_EMAILS`, `isAdminEmail` |
| `server/render-error-capture.js` | Uncaught exception handler | `initializeErrorCapture` |
| `server/render-logger.js` | Server logs to Firestore | `saveRenderLog`, `getRenderLogs`, `getRenderLogsSummary` |
| `server/css-crash-logger.js` | CSS crash logs from client | `logCSCCrash`, `getCSCCrashLogs`, `getCSCCrashSummary` |
| `server/retry-handler.js` | Retry with backoff for OpenAI/chat | `retryWithBackoff`, `retryWithFixedDelays`, `isRetryableError`, `shouldRecreateAssistant`, `calculateDelay`, `DEFAULT_RETRY_CONFIG` |
| `server/swagger.js` | Swagger/OpenAPI setup | Swagger middleware |
| `server/mcp-auth.js` | MCP API key verification | `verifyApiKey`, `getApiKeyFromRequest`, `getMcpClientFromRequest`, `buildSpecUpdatePayload`, `ALLOWED_KEYS`, `MAX_FIELD_SIZE` |
| `server/user-management.js` | User init, sync (Auth ↔ Firestore) | `getAllUsers`, `getUserByUid`, `initializeUser`, `syncAllUsers`, `getUserStats`, `getLastUserSyncReport`, `cleanupOrphanedData`, `deleteUser` |

### 2.2 Routes

| File | Base Path | Purpose | Key Endpoints |
|------|-----------|---------|---------------|
| `specs-routes.js` | `/api/specs` | Spec CRUD, generation (v2), upload | `POST /generate-overview` (202), `POST /:id/generate-all` (202), `POST /:id/generate-section` (202), `POST /:id/generate-architecture` (202), `GET /:id/generation-status`, `POST /:id/upload-to-openai` |
| `user-routes.js` | `/api/users` | User init, profile, MCP key, email prefs | `POST /init`, `GET /me`, `PUT /me`, `POST /generate-mcp-key` |
| `credits-v3-routes.js` | `/api/v3/credits` | Credits V3: get, consume, share-prompt | `GET /`, `POST /consume`, `POST /share-prompt` |
| `chat-routes.js` | `/api/chat` | Chat: init, messages, diagrams, demo | `POST /init`, `POST /message`, `POST /:specId/diagrams`, `POST /demo` |
| `admin-routes.js` | `/api/admin` | Admin: users, specs, credits, payments | `GET /users`, `GET /users/:uid`, `POST /users/:uid/update-plan`, `GET /payments`, `GET /activity` |
| `lemon-routes.js` | `/api/lemon` | Lemon Squeezy checkout, webhooks | `POST /create-checkout`, `POST /webhook`, `GET /subscription-status` |
| `health-routes.js` | `/api/health` | Health checks | `GET /`, `GET /credits`, `GET /db`, `GET /openai` |
| `analytics-routes.js` | `/api/analytics` | Analytics recording and admin views | `POST /event`, `GET /admin/events` |
| `blog-routes.js` | `/api/blog` | Blog CRUD (admin) | `POST /`, `PUT /:id`, `DELETE /:id`, `GET /` |
| `blog-routes-public.js` | `/api/blog/public` | Blog public listing | `GET /posts` |
| `articles-routes.js` | `/api/articles` | Articles API, sitemap | `GET /`, `POST /`, `GET /sitemap` |
| `brain-dump-routes.js` | `/api/brain-dump` | Brain dump generate, apply to spec | `POST /generate`, `POST /apply-to-spec` |
| `mcp-routes.js` | `/api/mcp` | MCP: specs list/get/update, tools | `GET /specs`, `GET /specs/:id`, `PUT /specs/:id` |
| `share-prompt-routes.js` | `/api/share-prompt` | Share prompt page | `GET /:code`, `POST /redeem` |
| `live-brief-routes.js` | `/api/live-brief` | Voice transcription summary | `POST /transcribe`, `POST /summarize` |
| `tool-finder-routes.js` | `/api/tool-finder` | Tool finder API | `GET /`, `POST /search` |
| `tools-routes.js` | `/api/tools` | Tools management | `GET /`, `POST /`, `PUT /:id` |
| `stats-routes.js` | `/api/stats` | Public stats | `GET /` |
| `newsletter-routes.js` | `/api/newsletter` | Newsletter management (admin) | `POST /send`, `GET /subscribers` |
| `email-preview-routes.js` | `/api/email-preview` | Email template preview | `GET /:template` |
| `email-tracking-routes.js` | `/api/email-tracking` | Email open/click tracking | `GET /open/:id`, `GET /click/:id` |
| `automation-routes.js` | `/api/automation` | Automation job management | `POST /jobs/:type/run`, `GET /jobs` |
| `api-docs-routes.js` | `/api-docs` | Swagger UI and OpenAPI JSON/YAML | `GET /swagger`, `GET /swagger.json` |
| `academy-routes.js` | `/api/academy` | Academy view tracking | `POST /views/:guideId` |
| ~~`credits-v2-routes.js`~~ | — | ~~Credits V2~~ | **NOT MOUNTED** – dead code |

**Inline routes in server.js:**
- `POST /api/generate-spec` – Legacy Worker proxy for overview generation
- `POST /api/feedback` – Feedback email via Google Apps Script
- `POST /api/contact-us` – Contact form via Google Apps Script
- `POST /api/diagrams/repair` – Legacy diagram repair via Worker

### 2.3 Services

| File | Purpose | Key Exports |
|------|---------|-------------|
| `openai-storage-service.js` | OpenAI API: files, assistants, threads, chat, runs | `OpenAIStorageService` class: `uploadSpec`, `deleteFile`, `createThread`, `createAssistant`, `sendMessage`, `generateDiagrams`, `repairDiagram`, `runSpecGeneration` |
| `chat-service.js` | Chat: assistant creation, vector store, spec upload | `ChatService` class |
| `credits-v3-service.js` | Credits V3 (user_credits_v3, credit_ledger_v3) | `getUserCredits`, `getAvailableCredits`, `consumeCredit`, `grantCredits`, `enableProSubscription`, `disableProSubscription` |
| `credits-v2-service.js` | Credits V2 – **legacy** | Same surface as V3 (for migrations only) |
| `credits-sync-service.js` | Sync Lemon Squeezy → credits_v3 | `syncAllUsersCredits`, `syncUserCredits` |
| `credits-sync-job.js` | Daily credits sync job | `CreditsSyncJob` class |
| `admin-activity-service.js` | Admin activity log | `recordActivity`, `recordUserRegistration`, `recordSpecCreation`, `recordPurchase`, `recordSubscriptionChange` |
| `user-analytics-service.js` | User analytics aggregation | `getUserAnalytics` |
| `analytics-service.js` | Event recording | `recordEvent` |
| `automation-service.js` | OpenAI client, job registry | `OpenAIClient`, `BaseJob`, `JobRegistry`, `jobRegistry` |
| `tools-automation.js` | Tools finder job | `ToolsFinderJob` |
| `tools-export-service.js` | Tools export | Export helpers |
| `tools-migration-service.js` | Tools data migration | Migration helpers |
| `articles-automation.js` | Article writer job | `ArticleWriterJob` |
| `sitemap-generator.js` | Sitemap generation | Sitemap helpers |
| `stats-collector.js` | Daily/weekly stats | `collectDailyStats`, `collectWeeklyStats` |
| `google-apps-script.js` | Google Apps Script integration | Sheets/feedback helpers |
| `cloudflare-worker.js` | Cloudflare Worker proxy/config | Worker helpers |

### 2.4 Spec Engine v2

| File | Purpose | Key Exports |
|------|---------|-------------|
| `spec-generation-service-v2.js` | Core v2 service: OpenAI Assistants API | `generateOverview(specId, userInput)`, `generateSection(specId, stage, overview, answers)`, `generateAllSpecs(specId, overview, answers)`, `generateArchitecture(specId, overview, technical, market, design)` |
| `spec-thread-manager.js` | Thread management: one OpenAI thread per spec | `getSpecThreadManager(openaiStorage, db)` factory → `getOrCreateThread`, `getGeneratorAssistantId`, `runStage` |
| `spec-queue.js` | In-memory queue, concurrency=1 | `add(specId, overview, answers)`, `processJob(job)`, `getJob(specId)`, `getStatus()` |
| `spec-events.js` | EventEmitter for generation progress | `emitSpecUpdate`, `emitSpecComplete`, `emitSpecError` |
| `spec-generation-service.js` | **Legacy** v1: Cloudflare Worker proxy | `generateOverview`, `generateSection`, `generateAllSpecs`, `generateArchitecture` |
| `schemas/spec-schemas.js` | Zod schemas for all 5 stages | `OverviewPayloadSchema`, `TechnicalPayloadSchema`, `MarketPayloadSchema`, `DesignPayloadSchema`, `ArchitecturePayloadSchema`, `STAGE_PAYLOAD_SCHEMAS`, `STAGE_ROOT_KEYS`, `buildResponseFormat(stage)`, `parseAndValidateStage(stage, raw)` |

**Model strategy:** Fallback chain `gpt-5.2 → gpt-5-mini → gpt-5-nano → gpt-5 → gpt-4o-mini → gpt-4o → gpt-4-turbo → gpt-4 → gpt-3.5-turbo`. Override: `OPENAI_SPEC_GENERATOR_ASSISTANT_ID` env var.

**Flow:** `generateOverview` → `getOrCreateThread` → `runStage('overview', ...)` → JSON validated by Zod → stored in Firestore. Same for technical/market/design/architecture. Architecture outputs structured JSON, then `_architecturePayloadToMarkdown()` serializes to Markdown for storage.

### 2.5 Lemon Squeezy (Payments)

| File | Purpose | Key Exports |
|------|---------|-------------|
| `lemon-routes.js` | Checkout, webhooks | Router |
| `lemon-webhook-utils.js` | Webhook signature verification | Verification helpers |
| `lemon-purchase-service.js` | Purchase processing | Purchase handlers |
| `lemon-credits-service.js` | Credit grants from purchases | Credit grant logic |
| `lemon-products-config.js` | Product/plan definitions | `PRODUCTS`, `PLANS` |
| `lemon-subscription-resolver.js` | Subscription status resolution | `resolveSubscription` |
| `lemon-payments-cache.js` | Payments cache (periodic sync) | Cache helpers |

### 2.6 Email & Notifications

| File | Purpose | Key Exports |
|------|---------|-------------|
| `email-service.js` | Send emails via Resend SDK | `sendEmail`, `sendSpecReadyNotification`, `sendWelcomeEmail` |
| `email-templates.js` | HTML email templates | Template builders |
| `email-tracking-service.js` | Track opens/clicks | `trackOpen`, `trackClick`, `getTrackingStats` |

### 2.7 Admin & Analytics

| File | Purpose |
|------|---------|
| `admin-routes.js` | Full admin API (users, specs, credits, payments, activity, migrations) |
| `admin-activity-service.js` | Activity log (registrations, purchases, credits, specs) |
| `admin-config.js` | Admin email list |
| `user-analytics-service.js` | User analytics aggregation |
| `analytics-service.js` | Event recording to Firestore |

### 2.8 Automation & Scheduled Jobs

| File | Purpose |
|------|---------|
| `scheduled-jobs.js` | Cron-like scheduler: payments sync, inactive users, tools finder, article writer, credits sync, daily/weekly reports |
| `automation-service.js` | OpenAI client wrapper + job registry |
| `tools-automation.js` | Tools finder automation job |
| `articles-automation.js` | Article writer automation job |
| `credits-sync-job.js` | Daily credits sync job |
| `stats-collector.js` | Daily/weekly stats collection |

### 2.9 Backend Scripts

| File | Purpose | Status |
|------|---------|--------|
| `scripts/migrate-specs-to-openai.js` | Migrate specs to OpenAI Storage | One-time |
| `scripts/migrate-tools-to-firebase.js` | Migrate tools data to Firestore | One-time |
| `scripts/run-credits-sync.js` | Manual credits sync trigger | Active |
| `scripts/init-public-stats.js` | Initialize public stats document | One-time |
| `scripts/cleanup-orphaned-assistants.js` | Clean up unused OpenAI assistants | Maintenance |

**Root-level backend scripts** (in `backend/`):
- `reset-all-users.js`, `cleanup-v2-system.js`, `sync-free-specs-to-v3.js`, `fix-subscription-ids.js`, `validate-v3-migration.js`, `check-spec.js`, `create-academy-sample-data.js`, `generate-academy-content.js`, `create-v3-collections.js`, `check-webhook-errors.js`, `create-all-academy-data.js`, `migrate-to-v3.js`, `mark-demo-spec.js`, `export-users-csv.js`, `fix-pro-user.js`, `fix-spec-ownership.js`, `fix-academy-icons.js`, `migrate-pro-users-to-v3.js`, `migrate-newsletter-fields.js`, `create-test-user.js`, `generate-sitemap.js`, `migrate-entitlements-to-user-credits.js`, `migrate-credits-system.js`, `migrate-total-field.js`, `test-v3-system.js`

---

## 3. Frontend – JavaScript

All frontend JS in `assets/js/`. Loaded via `<script>` tags in HTML pages (not via Vite bundles at runtime — Vite is available but not actively used for page loads).

### 3.1 Root / Core / Utils

| File | Purpose | Global | Status |
|------|---------|--------|--------|
| `api-client.js` | API client with auth, retry, caching | `window.api` | **Active** (loaded in `_includes/head.html`) |
| `config.js` | Backend URL, API config, console suppression | `window.API_CONFIG`, `window.getApiBaseUrl`, `window.BACKEND_URL` | **Active** |
| `script.js` | Auth/landing page: login, register, theme, steps animation | `selectTopic`, `selectPlatform`, `handleLogin`, `handleRegister`, `toggleTheme`, `StepsAnimation` | **Active** |
| `credits-config.js` | Credits system constants | `window.CREDITS_CONFIG` | **Active** |
| `ga4-wrapper.js` | GA4 analytics wrapper | `GA4Wrapper` | **Active** |
| `paywall.js` | Entitlement checks, paywall UI | `checkEntitlement`, `showPaywall` | **Active** |
| `lib-loader.js` | Dynamic CDN script loader (Mermaid, Marked, etc.) | `LibraryLoader` | **Active** |
| `live-brief-modal.js` | Voice input modal (Web Speech API) | `LiveBriefModal`, `window.liveBriefModal` | **Active** |
| `mcp-modal.js` | MCP API key management | IIFE | **Active** |
| `contact-us-modal.js` | Contact form modal | `createContactModal`, `showContactModal` | **Active** |
| `mermaid.js` | Mermaid chart manager | `MermaidManager` | **Active** |
| `mermaid-simple.js` | Simple Mermaid wrapper | `SimpleMermaidManager` | **Active** |
| `app-logger.js` | Client-side logger → backend | `window.appLogger` | **DUPLICATE** of `core/app-logger.js` |
| `focus-manager.js` | Focus trap for modals | `window.focusManager` | **DUPLICATE** of `utils/focus-manager.js` |
| `web-vitals.js` | Core Web Vitals tracking | `initWebVitals` | **DUPLICATE** of `utils/web-vitals.js` |
| `analytics-schema.js` | GA4 event schema | `window.ANALYTICS_EVENT_MAP` | **DUPLICATE** of `pages/analytics-schema.js` |

**`core/` directory:**

| File | Purpose | Global | Status |
|------|---------|--------|--------|
| `core/app-logger.js` | Same as root `app-logger.js` | `window.appLogger` | Canonical copy |
| `core/config.js` | Same as root `config.js` | Same globals | **DUPLICATE** |
| `core/store.js` | Simple state store | `window.store`, `window.Store` | **Active** |
| `core/security-utils.js` | XSS sanitization | `sanitizeHTML`, `safeSetInnerHTML`, `escapeHTML` | **Active** |
| `core/css-monitor.js` | CSS crash monitoring | `window.CSSMonitor` | **Active** |

**`utils/` directory:**

| File | Purpose | Global | Status |
|------|---------|--------|--------|
| `utils/localStorage-safe.js` | Safe localStorage access | `window.localStorageSafe` | **Active** |
| `utils/focus-manager.js` | Focus trap | `window.focusManager` | Canonical copy |
| `utils/mobile-optimizations.js` | Touch gestures, carousels | `window.MobileOptimizations` | **Active** |
| `utils/typingEffect.js` | Typing placeholder for `#ideaInput` | Runs on DOMContentLoaded | **Active** (fragile: assumes `#ideaInput` exists) |
| `utils/spec-formatter.js` | Format JSON/plain spec content | `formatTextContent`, `formatJSONContent`, `formatPlainTextContent`, `formatDiagrams` | **Active** |
| `utils/web-vitals.js` | Same as root | `initWebVitals` | Canonical copy |

### 3.2 Components

| File | Purpose | Exports | Status |
|------|---------|---------|--------|
| `components/base.js` | Base component class | `Component`, `window.Component` | **Active** (mirrors `packages/ui`) |
| `components/Modal.js` | Modal component | `Modal`, `window.Components.Modal` | **Active** (mirrors `packages/ui`) |

### 3.3 Services

| File | Purpose | Global | Status |
|------|---------|--------|--------|
| `services/api-client.js` | Same as root `api-client.js` | `window.api` | **DUPLICATE** |
| `services/prompts.js` | Planning/spec prompt templates | `window.PROMPTS` | **Active** |
| `services/spec-cache.js` | Memory + localStorage + Firestore cache | `window.specCache` | **Active** |
| `services/analytics-tracker.js` | Analytics events → backend | `window.analyticsTracker` | **Active** (uses legacy `firebase.auth()`) |
| `services/spec-firestore-listener.js` | Firestore real-time listener for specs | `window.SpecEventListener` | **Active** |
| `services/spec-error-handler.js` | Spec generation error UI | `window.SpecErrorHandler` | **Active** |

### 3.4 Features

**`features/index/`** (Homepage)

| File | Purpose | Status |
|------|---------|--------|
| `index.js` | Spec generation, credit check, planning mode | **Active** – has fallback to legacy `/api/generate-spec` |
| `index-access-code.js` | Access code gate | **Disabled** (`ENABLE_ACCESS_CODE_MODAL = false`) |
| `index-vanta.js` | Vanta.NET hero animation | **Active** |
| `index-mermaid.js` | Mermaid init on index | **Active** |
| `index-demo-scroll.js` | Hero demo scroll phases | **Active** |

**`features/planning/`**

| File | Purpose | Status |
|------|---------|--------|
| `planning.js` | Planning page UI and logic (~1200 lines) | **Active** |

**`features/question-flow/`**

| File | Purpose | Status |
|------|---------|--------|
| `question-flow-controller.js` | Question flow controller | **Active** |
| `question-flow-state.js` | Question flow state management | **Active** |
| `question-flow-view.js` | Question flow DOM rendering | **Active** |

**`features/share-prompt/`**

| File | Purpose | Status |
|------|---------|--------|
| `share-prompt-modal.js` | Share-for-credit modal | **Active** |

**`features/profile/`**

| File | Purpose | Status |
|------|---------|--------|
| `profile.js` | Profile page (Firebase v9+ modular SDK) | **Active** |
| `profile-scroll.js` | Scroll-to-top button | **Active** |

**`features/demo-spec/`**

| File | Purpose | Status |
|------|---------|--------|
| `demo-spec-formatter.js` | Format demo spec for display | **Active** |
| `demo-spec-data.js` | Hardcoded demo spec data | **Active** |
| `demo-spec-charts.js` | Demo spec charts (Chart.js) | **Active** |

**`features/spec-viewer/`** (largest feature, ~9k lines in main file)

| File | Purpose | Status |
|------|---------|--------|
| `spec-viewer-main.js` | Main spec viewer: tabs, display, generation triggers, Mermaid rendering | **Active** – references Cloudflare Workers for mockup/mindmap/prompts |
| `spec-viewer-firebase.js` | Firebase config for spec-viewer | **Active** |
| `spec-viewer-auth.js` | Auth UI in spec-viewer | **Active** |
| `spec-viewer-api-helper.js` | Comment only, effectively empty | **DEAD CODE** |
| `spec-viewer-chat.js` | Chat feature in spec-viewer | **Active** – references jiramaker Worker |
| `spec-viewer-brain-dump.js` | Brain dump feature | **Active** |
| `spec-viewer-scroll.js` | Scroll behavior | **Active** |
| `spec-viewer-event-handlers.js` | Event handlers | **Active** |
| `cursor-windsurf-export.js` | Cursor/Windsurf export | **Active** |

**`features/legacy-viewer/`**

| File | Purpose | Status |
|------|---------|--------|
| `legacy-viewer-main.js` | Legacy spec viewer | **LEGACY** – kept for old URLs |
| `legacy-viewer-firebase.js` | Firebase config (legacy) | **LEGACY** |
| `legacy-viewer-scroll.js` | Scroll (legacy) | **LEGACY** |

### 3.5 Pages JS

| File | Purpose | Status |
|------|---------|--------|
| `pages/credits-v3-display.js` | Credits V3 display in header | **Active** |
| `pages/credits-v3-manager.js` | Credits API logic | **Active** (has V2 fallback) |
| `pages/pricing.js` | Pricing page logic | **Active** |
| `pages/academy.js` | Academy page | **Active** |
| `pages/articles.js` | Articles listing | **Active** |
| `pages/article.js` | Single article | **Active** |
| `pages/blog-loader.js` | Blog post loader (Firebase) | **Active** |
| `pages/blog-manager.js` | Blog management | **Active** |
| `pages/post-loader.js` | Post loader | **Active** |
| `pages/post.js` | Blog post page | **Active** |
| `pages/why.js` | Why page | **Active** |
| `pages/cursor-windsurf-integration.js` | Cursor/Windsurf integration page | **Active** |
| `pages/mcp.js` | MCP page | **Active** |
| `pages/toolpicker.js` | Tool picker | **Active** |
| `pages/admin-academy.js` | Admin academy | **Active** |
| `pages/articles-manager.js` | Articles manager | **Active** |
| `pages/analytics-schema.js` | Same as root | **DUPLICATE** |
| `pages/credits-v2-display.js` | Credits V2 display | **LEGACY** |

### 3.6 Admin Dashboard

`new-admin-dashboard/` – SPA loaded in `pages/new-admin-dashboard.html`.

| File | Purpose |
|------|---------|
| `main.js` | Entry: `NewAdminDashboard` class |
| `core/DataManager.js` | Data loading from Firebase/API |
| `core/StateManager.js` | UI state management |
| `core/FirebaseService.js` | Firebase init for admin |
| `core/MetricsCalculator.js` | Metrics calculations |
| `services/ApiService.js` | Admin API calls |
| `services/ActivityService.js` | Activity log service |
| `utils/helpers.js` | Shared helpers (debounce, throttle, formatDate) |
| `views/OverviewView.js` | Dashboard overview tab |
| `views/UsersView.js` | Users management tab |
| `views/PaymentsView.js` | Payments tab |
| `views/LogsView.js` | Server logs tab |
| `views/AnalyticsView.js` | Analytics tab |
| `views/SpecUsageView.js` | Spec usage tab |
| `views/McpView.js` | MCP tab |
| `views/ArticlesView.js` | Articles tab |
| `views/AcademyView.js` | Academy tab |
| `views/ToolsView.js` | Tools tab |
| `views/ContactView.js` | Contact tab |
| `views/UnsubscribeView.js` | Unsubscribe tab |
| `components/LoadingState.js` | Loading spinner component |
| `components/MetricCard.js` | Metric card component |
| `components/ChartComponent.js` | Chart component |
| `components/UserDetailsModal.js` | User details modal |

### 3.7 Bundles

`bundles/` – Vite entry points. Currently **not used at runtime** (pages load JS directly via `<script>` tags).

| File | Purpose | Status |
|------|---------|--------|
| `bundles/core.js` | Placeholder | **UNUSED** |
| `bundles/auth.js` | Placeholder | **UNUSED** |
| `bundles/home.js` | Home bundle | **UNUSED** |
| `bundles/utils.js` | Utils bundle | **UNUSED** |
| `bundles/blog.js` | Blog bundle | **UNUSED** |
| `bundles/post.js` | Post bundle | **UNUSED** |

---

## 4. Frontend – HTML Pages

| Page | Path | Layout | Purpose |
|------|------|--------|---------|
| Homepage | `index.html` | default | Hero, demo, planning flow, pricing, FAQ |
| Spec Viewer | `pages/spec-viewer.html` | default | Spec display, generation, chat, brain dump, export |
| Profile | `pages/profile.html` | default | User profile, MCP connect, admin link |
| Planning | `pages/planning.html` | default | Multi-step planning interface |
| Pricing | `pages/pricing.html` | default | Pricing plans, Lemon checkout |
| About | `pages/about.html` | default | About/mission page |
| How It Works | `pages/how.html` | default | 3-step process explanation |
| Why Specifys | `pages/why.html` | default | Value proposition |
| Contact | `pages/contact.html` | default | Contact form |
| Auth | `pages/auth.html` | auth | Login/signup standalone |
| Demo Spec | `pages/demo-spec.html` | default | Live spec demo with hardcoded data |
| Articles | `pages/articles.html` | default | Articles listing |
| Article | `pages/article.html` | default | Single article (dynamic) |
| Academy | `pages/academy/index.html` | default | Academy landing |
| Academy Category | `pages/academy/category.html` | default | Category view |
| Academy Guide | `pages/academy/guide.html` | default | Guide reader |
| Admin Dashboard | `pages/new-admin-dashboard.html` | standalone | Full admin SPA |
| Admin Academy | `pages/admin/academy/*.html` | standalone | Academy content management (4 pages) |
| MCP | `pages/mcp.html` | default | MCP documentation |
| Cursor/Windsurf | `pages/cursor-windsurf-integration.html` | default | Export documentation |
| Tool Picker | `pages/ToolPicker.html` | default | Tool finder |
| Blog | `blog/index.html` | default | Blog index |
| Dynamic Post | `pages/dynamic-post.html` | default | Firebase blog post loader |
| Legacy Viewer | `pages/legacy-viewer.html` | default | Old spec viewer |
| Privacy | `pages/privacy.html` | default | Privacy policy |
| Terms | `pages/terms.html` | default | Terms of service |
| Unsubscribe | `pages/unsubscribe.html` | default | Newsletter unsubscribe |
| 404 | `pages/404.html` | default | Error page |

### Spec Viewer Tabs

| Tab | Present | Notes |
|-----|---------|-------|
| Overview | Yes | Expandable subsections |
| Technical | Yes | Expandable subsections |
| Mind Map | Hidden | `class="hidden"` |
| Market Research | Yes | Expandable subsections |
| Design & Branding | Yes | Expandable subsections |
| Architecture | Yes | Generate button + Mermaid rendering |
| Prompts | Yes | Expandable subsections |
| Brain Dump | Yes | Pro feature |
| AI Chat | Yes | Chat interface |
| Mockup (Pro) | Yes | Pro feature |
| Export & Integration | Yes | Multiple export formats |
| MCP | Button | Not a tab |
| Raw Data | Hidden | `class="hidden"` |

---

## 5. Layouts & Includes

### Layouts (`_layouts/`)

| File | Purpose | Includes |
|------|---------|----------|
| `default.html` | Main layout | head, header, content, footer, scroll-to-top, firebase-init, firebase-auth, page JS |
| `standalone.html` | Minimal (admin) | head, firebase-init, content only |
| `auth.html` | Auth pages | head, content only (no Firebase) |
| `post.html` | Blog posts | Extends default; adds breadcrumbs, reading progress, TOC, share buttons |
| `dashboard.html` | Dashboard | head, header, dashboard container, footer, firebase-init, firebase-auth |

### Includes (`_includes/`)

| File | Purpose | Loaded By |
|------|---------|-----------|
| `head.html` | `<head>`: meta, OG, fonts, main-compiled.css, config.js, api-client.js, focus-manager.js, analytics, structured-data | All layouts |
| `header.html` | Site header: logo, nav, auth buttons, credits display | default, dashboard |
| `footer.html` | Footer: nav links, social, copyright, contact modal | default, dashboard |
| `analytics.html` | Google Analytics gtag | head.html |
| `analytics-events.html` | Tracking functions (trackButtonClick, trackCTA, etc.) | head.html |
| `scroll-to-top.html` | Scroll-to-top button + script | default |
| `firebase-init.html` | Firebase SDK init, config, lazy Firestore | default, standalone, dashboard |
| `firebase-auth.html` | Auth UI: updateAuthUI, showLoginModal, logout, ensureUserDocument | default, dashboard |
| `structured-data.html` | JSON-LD structured data | head.html |
| `mcp-connect-modal.html` | MCP API key modal | spec-viewer.html, profile.html |

---

## 6. CSS / SCSS

### Architecture

- **Entry:** `assets/css/main.scss` → imports core, layout, components, utilities, pages
- **Compiled:** `assets/css/main-compiled.css` (130.7 KB) – loaded by all pages via `head.html`
- **Page CSS:** Each page loads its own CSS file (e.g., `pages/spec-viewer.css`)
- **Build:** PostCSS (autoprefixer, cssnano, purgecss in production)

### Core

| File | Size | Purpose |
|------|------|---------|
| `core/_variables.scss` | 3.4 KB | CSS custom properties, color palette, spacing |
| `core/_reset.scss` | 2.5 KB | Browser reset |
| `core/_fonts.scss` | 5.2 KB | Font-face declarations |
| `core/_base.scss` | 5.0 KB | Base element styles |

### Layout

| File | Size | Purpose |
|------|------|---------|
| `layout/_header.scss` | 5.3 KB | Header styles |
| `layout/_header.css` | 6.9 KB | Compiled header (redundant?) |
| `layout/_footer.scss` | 3.4 KB | Footer styles |
| `layout/_containers.scss` | 1.6 KB | Container/grid system |

### Components

| File | Size | Purpose |
|------|------|---------|
| `components/buttons.scss` | 20.5 KB | All button variants |
| `components/_modals.scss` | 19.3 KB | Modal styles |
| `components/_cards.scss` | 17.5 KB | Card layouts |
| `components/_live-brief.scss` | 10.3 KB | Live brief voice input |
| `components/_tables.scss` | 9.1 KB | Table styles |
| `components/_icons.scss` | 5.0 KB | Icon styles |
| `components/_forms.scss` | 4.8 KB | Form styles |
| `components/mermaid.scss` | 524 B | Mermaid diagram styles |
| `components/badges.scss` | 277 B | Badge styles |

### Page CSS (largest files)

| File | Size | Page |
|------|------|------|
| `pages/admin-dashboard.css` | 109.5 KB | Legacy admin academy only |
| `pages/index.css` | 83.6 KB | Homepage |
| `pages/new-admin-dashboard.css` | 52.9 KB | Main admin dashboard |
| `pages/spec-viewer.css` | 48.5 KB | Spec viewer |
| `pages/academy.css` | 37.4 KB | Academy |
| `pages/planning.css` | 30.9 KB | Planning |
| `pages/profile.css` | 28 KB | Profile |

### Utilities

| File | Purpose |
|------|---------|
| `utilities/spacing.scss` | Spacing classes |
| `utilities/text.scss` | Text utilities |
| `utilities/display.scss` | Display utilities |
| `utilities/_responsive.scss` | Responsive breakpoints |
| `utilities/_flexbox.scss` | Flexbox helpers |
| `utilities/visually-hidden.css` | Screen reader only |
| `utilities/_position.scss` | Position utilities |
| `utilities/_width.scss`, `_height.scss`, `_border.scss`, `_shadow.scss`, `_overflow.scss` | Various utilities |

---

## 7. Packages (Monorepo)

Root `package.json` defines workspaces: `packages/*`. Vite config defines aliases (`@specifys/api-client`, `@specifys/ui`, `@specifys/design-system`).

| Package | Path | Purpose | Runtime Usage |
|---------|------|---------|---------------|
| `@specifys/api-client` | `packages/api-client/` | ApiClient class | **Not used at runtime** – `assets/js/api-client.js` (copy) loaded directly |
| `@specifys/ui` | `packages/ui/` | Component, Modal classes | **Not used at runtime** – `assets/js/components/` (copies) loaded directly |
| `@specifys/design-system` | `packages/design-system/` | Design tokens (colors, spacing, typography) | **Not used at runtime** – tokens in SCSS variables |

**Issue:** `design-system/package.json` declares exports `./colors`, `./spacing`, `./typography` but these files don't exist. All tokens are in `tokens/index.js`.

---

## 8. MCP Server

**Path:** `mcp-server/`
**Language:** TypeScript (compiled to `dist/`)
**Entry:** `mcp-server/src/index.ts`
**Published as:** `specifys-mcp-server` / `specifys-mcp` (npm bins)

**Tools:**

| Tool | Type | Purpose |
|------|------|---------|
| `list_my_specs` | Read | List user's specs |
| `get_spec` | Read | Get full spec |
| `get_spec_overview` | Read | Get overview section |
| `get_spec_technical` | Read | Get technical section |
| `get_spec_design` | Read | Get design section |
| `get_spec_prompts` | Read | Get prompts section |
| `get_spec_architecture` | Read | Get architecture section |
| `update_spec_overview` | Write | Update overview |
| `update_spec_technical` | Write | Update technical |
| `update_spec_design` | Write | Update design |
| `update_spec_market` | Write | Update market |
| `update_spec_architecture` | Write | Update architecture |

**Resources:** `spec://{specId}`, `specifys://tools`

---

## 9. Cloudflare Workers

| Worker | Source File | Deployed URL | Used By | Purpose |
|--------|------------|--------------|---------|---------|
| **mockup** | `worker-mockup.js` | `https://mockup.shalom-cohen-111.workers.dev` | `spec-viewer-main.js` | Mockup generation, screen analysis |
| **promtmaker** | `worker-promtmaker-updated.js` | `https://promtmaker.shalom-cohen-111.workers.dev` | `spec-viewer-main.js` | Prompt generation, diagram fixes |
| **spspec** | — (external) | `https://spspec.shalom-cohen-111.workers.dev` | `server.js` (legacy fallback) | **Legacy** spec generation |
| **generate-mindmap** | — (external) | `https://generate-mindmap.shalom-cohen-111.workers.dev` | `spec-viewer-main.js` | Mind map generation |
| **jiramaker** | — (external) | `https://jiramaker.shalom-cohen-111.workers.dev` | `spec-viewer-chat.js` | Jira export |
| **healthcheck** | — (external) | `https://healthcheck.shalom-cohen-111.workers.dev` | `health-routes.js` | Worker health check |

---

## 10. Blog & Posts

- **Blog index:** `blog/index.html` – loads Firebase posts + Jekyll posts
- **Posts directory:** `_posts/` – 45 markdown files (Jan 2025 – Nov 2025)
- **Post layout:** `_layouts/post.html` – extends default with breadcrumbs, TOC, share buttons
- **Dynamic post loader:** `pages/dynamic-post.html` – loads Firebase-stored posts
- **Admin:** Blog management via `admin-routes.js` and `blog-routes.js`

---

## 11. Tools

| File | Purpose | Status |
|------|---------|--------|
| `tools/map/vibe-coding-tools-map.html` | Vibe Coding Tools Map page | **Active** |
| `tools/map/tools-map-react.js` | React SPA for tools map | **Active** |
| `tools/map/tools.json` | Tools data (static JSON) | **Active** |
| `tools/processing-v2-simple.js` | Redirect to `spec-raw.html` | **DEAD** – target page doesn't exist |

---

## 12. Scripts

### `scripts/blog/`

| File | Purpose | Status |
|------|---------|--------|
| `create-post.js` | Interactive Jekyll post creator | **Active** |
| `create-post.sh` / `.bat` | Shell wrappers | **Active** |

### `scripts/backend/`

| File | Purpose | Status |
|------|---------|--------|
| `start-server.sh` | Start backend | **Active** (port 3001 – outdated, backend uses 10000) |
| `restart-server.sh` | Restart backend | **Active** (port 3002 – outdated) |
| `deploy.sh` | Lemon Squeezy deploy | **Active** |
| `setup.sh` | Lemon Squeezy setup | **Active** |
| `test-api.sh` | Test health/stats | **Active** |
| `test-wakeup.sh` | Test Render endpoint | **Active** |

### `scripts/localhost/`

| File | Purpose | Status |
|------|---------|--------|
| `start-localhost.sh` | Start backend + Jekyll | **Active** |
| `test-localhost.sh` | Test local endpoints | **Active** |
| `README.md`, `LOCALHOST-SETUP.md` | Documentation | **Active** |

### `scripts/archive/`

| File | Purpose | Status |
|------|---------|--------|
| `admin-dashboard.js` | Old admin dashboard | **LEGACY** |
| `admin.js` | Old admin bundle | **LEGACY** |
| `README.md` | Archive description | Documentation |

### `scripts/` root

| File | Purpose | Status |
|------|---------|--------|
| `test-prompts-worker.js` | Test promtmaker worker | **Active** |
| `README.md` | Scripts overview | Documentation |
| `REFACTORING-PLAN.md` | Refactoring plan (Hebrew) | Planning |

---

## 13. Root Config Files

| File | Purpose |
|------|---------|
| `package.json` | Root workspace: `workspaces: ["packages/*"]`, scripts (dev, build:vite, build:css), dependencies |
| `_config.yml` | Jekyll: site metadata, plugins (jekyll-redirect-from, jekyll-feed), excludes (backend, mcp-server, scripts, config, node_modules) |
| `render.yaml` | Render: web service `specifys-backend`, root `backend/`, `npm start` |
| `Procfile` | `web: cd backend && npm start` |
| `vite.config.js` | Vite: bundles (core, auth, home, utils, post, blog), aliases (@specifys/*), output to `assets/dist` |
| `postcss.config.js` | PostCSS: import, autoprefixer, cssnano, purgecss |
| `CNAME` | Custom domain |
| `robots.txt` | Search engine directives |
| `sitemap.xml` | Sitemap |
| `site.webmanifest` | PWA manifest |
| `favicon.ico` | Favicon |
| `_redirects` | Redirect rules |

---

## 14. Firestore Collections

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `users` | User profiles | `email`, `displayName`, `plan`, `mcpApiKey`, `createdAt` |
| `specs` | Specifications | `userId`, `title`, `overview`, `technical`, `market`, `design`, `architecture`, `status`, `thread_id`, `generationVersion`, `answers`, `openaiFileId` |
| `user_credits_v3` | Credits (V3) | `userId`, `total`, `used`, `remaining`, `plan` |
| `credit_ledger_v3` | Credit transactions | `userId`, `type`, `amount`, `timestamp` |
| `errorLogs` | Server errors | `message`, `stack`, `timestamp` |
| `renderLogs` | Server logs | `level`, `message`, `timestamp` |
| `analytics_events` | Analytics | `event`, `userId`, `timestamp` |
| `admin_activity_log` | Admin activity | `type`, `userId`, `details`, `timestamp` |
| `blog_posts` | Blog posts (Firebase) | `title`, `content`, `author`, `publishedAt` |
| `articles` | Auto-generated articles | `title`, `content`, `slug`, `publishedAt` |
| `academy_categories` | Academy categories | `name`, `description`, `order` |
| `academy_guides` | Academy guides | `categoryId`, `title`, `content`, `level` |
| `tools` | AI tools data | `name`, `description`, `url`, `categories` |
| `public_stats` | Public stats cache | `totalSpecs`, `totalUsers` |
| `newsletter_subscribers` | Newsletter | `email`, `subscribedAt` |
| `shared_prompts` | Share-for-credit | `code`, `prompt`, `createdBy` |
| `lemon_purchases` | Purchase records | `userId`, `orderId`, `productId` |
| `lemon_subscriptions` | Subscription records | `userId`, `subscriptionId`, `status` |

---

## 15. Environment Variables

### Required (Backend)

| Variable | Purpose |
|----------|---------|
| `FIREBASE_SERVICE_ACCOUNT` or `FIREBASE_SA_*` | Firebase Admin credentials |
| `OPENAI_API_KEY` | OpenAI API |
| `RESEND_API_KEY` | Email sending (Resend) |
| `LEMON_SQUEEZY_API_KEY` | Lemon Squeezy API |
| `LEMON_SQUEEZY_WEBHOOK_SECRET` | Webhook verification |

### Optional

| Variable | Purpose |
|----------|---------|
| `OPENAI_SPEC_GENERATOR_ASSISTANT_ID` | Pre-created generator assistant |
| `OPENAI_SPEC_ARCHITECTURE_ASSISTANT_ID` | Pre-created architecture assistant (legacy) |
| `NODE_ENV` | Environment (production/development) |
| `PORT` | Server port (default: 10000) |
| `GOOGLE_APPS_SCRIPT_URL` | Feedback/contact form webhook |

---

## 16. Dead Code & Issues Registry

### CRITICAL BUGS

| ID | Location | Description |
|----|----------|-------------|
| BUG-1 | `admin-routes.js` | Uses `recordSubscriptionChange` without importing it from `admin-activity-service.js`. Will throw `ReferenceError` when changing user plan to/from pro. |

### DEAD CODE (safe to remove)

| ID | Location | Description |
|----|----------|-------------|
| DEAD-1 | `credits-v2-routes.js` | Entire file. Not mounted in `server.js`. V3 is the only active system. |
| DEAD-2 | `credits-v2-service.js` | Only used by migration scripts. Consider archiving. |
| DEAD-3 | `spec-generation-service.js` (v1) | Legacy Worker-based service. V2 is active. Still imported in `specs-routes.js` and `mcp-routes.js`. |
| DEAD-4 | `spec-viewer-api-helper.js` | Contains only a comment. No functional code. |
| DEAD-5 | `index-access-code.js` | Access code gate disabled (`ENABLE_ACCESS_CODE_MODAL = false`). |
| DEAD-6 | `tools/processing-v2-simple.js` | Redirects to `spec-raw.html` which doesn't exist. |
| DEAD-7 | `bundles/*.js` | Vite bundle entry points. Not used at runtime (pages load JS directly). |
| DEAD-8 | `generate-demo-html.js` | Root file. Uses `eval()`, not referenced anywhere. |
| DEAD-9 | `scripts/archive/admin-dashboard.js` | Old admin dashboard. Replaced by `new-admin-dashboard`. |
| DEAD-10 | `scripts/archive/admin.js` | Old admin bundle. Not referenced. |
| DEAD-11 | `pages/credits-v2-display.js` | Legacy credits V2 display. |
| DEAD-12 | `features/legacy-viewer/` | Entire directory (3 files). Legacy spec viewer. |
| DEAD-13 | `config/` directory | Standalone config package. Purpose unclear; not part of main app. |
| DEAD-14 | `server.js` inline `POST /api/diagrams/repair` | Legacy diagram repair via Worker. |
| DEAD-15 | `server.js` inline `POST /api/generate-spec` | Legacy Worker proxy for overview. V2 handles this. |

### DUPLICATE FILES (should consolidate)

| ID | Files | Resolution |
|----|-------|------------|
| DUP-1 | `app-logger.js` ↔ `core/app-logger.js` | Keep `core/`, update `head.html` to load from `core/` |
| DUP-2 | `config.js` ↔ `core/config.js` | Keep `core/`, update `head.html` |
| DUP-3 | `focus-manager.js` ↔ `utils/focus-manager.js` | Keep `utils/`, update `head.html` |
| DUP-4 | `web-vitals.js` ↔ `utils/web-vitals.js` | Keep `utils/` |
| DUP-5 | `api-client.js` ↔ `services/api-client.js` | Keep root (loaded by `head.html`), delete `services/` copy |
| DUP-6 | `analytics-schema.js` ↔ `pages/analytics-schema.js` | Keep one, import from single location |
| DUP-7 | `assets/js/components/*` ↔ `packages/ui/src/components/*` | Runtime uses `assets/js/`. Packages unused at runtime. Decide: use Vite bundles or remove packages. |

### LEGACY PATTERNS

| ID | Location | Description |
|----|----------|-------------|
| LEG-1 | `server.js` | `delete require.cache` for hot reload in dev – fragile pattern |
| LEG-2 | `server.js` | Inline feedback/contact handlers with empty catch blocks |
| LEG-3 | `user-management.js` | `determineIfNewUser` marked deprecated but still present |
| LEG-4 | `services/analytics-tracker.js` | Uses `firebase.auth()` (legacy v8 syntax) |
| LEG-5 | `features/index/index.js` | Fallback to legacy `/api/generate-spec` Worker endpoint |
| LEG-6 | `pages/credits-v3-manager.js` | V2 credits API fallback |
| LEG-7 | `spec-viewer-main.js` | ~9k lines. References 5 Cloudflare Workers directly. Should extract Worker URLs to config. |
| LEG-8 | Multiple route files | `verifyFirebaseToken` duplicated in 5+ route files. Should centralize in middleware. |
| LEG-9 | `index.html` FAQ | "Is it really 100% free?" conflicts with paid plans |

### STRUCTURAL ISSUES

| ID | Location | Description |
|----|----------|-------------|
| STR-1 | `packages/` | Monorepo packages exist but are NOT used at runtime. Files are copied to `assets/js/`. Either commit to Vite bundles or remove packages. |
| STR-2 | `design-system/package.json` | Declares exports `./colors`, `./spacing`, `./typography` but files don't exist. |
| STR-3 | `scripts/backend/start-server.sh` | Uses port 3001; backend actually uses 10000. |
| STR-4 | `scripts/backend/restart-server.sh` | Uses port 3002; mismatch. |
| STR-5 | `_plugins/vite_manifest.rb` | Vite plugin exists but {% raw %}`{% vite_bundle %}`{% endraw %} tag is not used in any layout or page. |
| STR-6 | `health-routes.js` | References `error_logs` collection; `error-logger.js` uses `errorLogs`. Possible mismatch. |
| STR-7 | `layout/_header.css` | Compiled CSS alongside SCSS source. Redundant if SCSS is compiled via main pipeline. |
| STR-8 | `style.scss` | 207 bytes. Jekyll placeholder, mostly empty. |
| STR-9 | `pages/admin-dashboard.css` | 109.5 KB. Used only by 4 academy admin pages. Main admin uses `new-admin-dashboard.css`. |

---

*Document version: 1.0. Generated by scanning every file in the repository.*
