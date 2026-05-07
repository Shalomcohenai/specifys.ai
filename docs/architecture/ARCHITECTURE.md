# Specifys.ai — System Architecture

Single source of truth for the system architecture. Describes every subsystem, service, data store, and flow as they exist in production.

**Last updated:** May 2026 (Phase 2 stabilization + Phase 1 spec-viewer data backbone extraction)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Backend](#4-backend)
   - [Entry & Middleware](#41-entry--middleware)
   - [Routes](#42-routes)
   - [Spec Engine v2](#43-spec-engine-v2)
   - [User Management](#44-user-management)
   - [Credits System (V3)](#45-credits-system-v3)
   - [Payments — Lemon Squeezy](#46-payments--lemon-squeezy)
   - [Chat & Brain Dump](#47-chat--brain-dump)
   - [Email — Resend Integration](#48-email--resend-integration)
   - [Admin, Analytics & Content](#49-admin-analytics--content)
   - [Automation & Scheduled Jobs](#410-automation--scheduled-jobs)
   - [Auxiliary API Migration](#411-auxiliary-api-migration)
5. [Frontend](#5-frontend)
   - [Page Loading Model](#51-page-loading-model)
   - [Core Modules](#52-core-modules)
   - [Features](#53-features)
   - [Admin Dashboard](#54-admin-dashboard)
   - [CSS / Design System](#55-css--design-system)
6. [MCP Server](#6-mcp-server)
7. [Data Layer — Firestore](#7-data-layer--firestore)
8. [Infrastructure & Deployment](#8-infrastructure--deployment)
9. [Key Flows](#9-key-flows)
10. [Environment Variables](#10-environment-variables)
11. [Known Issues & Legacy](#11-known-issues--legacy)

---

## 1. System Overview

Specifys.ai is an AI-powered specification generator. Users describe an app idea and the system produces a dependency-driven specification pipeline: Overview -> Technical / Market / Design -> Architecture / AIO & SEO Visibility Engine -> Prompts. Additional features (AI Chat Assistant, Brain Dump, Export & Integration, MCP) consume these generated outputs.

### Communication Architecture

The system uses three OpenAI integration patterns:

1. **Spec Generation (v2):** Direct **Chat Completions API** with **Structured Outputs** (strict JSON schema via Zod). No threads, no assistants runs — a single `POST /v1/chat/completions` call per stage. This replaced the legacy Cloudflare Worker approach.

2. **Chat & Brain Dump:** OpenAI **Assistants API** with threads, runs, and `file_search` (spec uploaded to vector store). Conversational context is maintained via real OpenAI threads.

3. **Auxiliary features** (mockups, prompts, mindmap, jira export): now use backend `/api/auxiliary/*` endpoints on Express.

```
┌──────────────────┐     ┌──────────────────────┐     ┌────────────────────────┐
│  Jekyll Static   │     │  Express Backend      │     │  OpenAI API            │
│  Site + Firebase │────▶│  (Render)             │     │                        │
│  Client SDK      │     │                       │─────│─▶ Chat Completions     │
└──────┬───────────┘     │  ┌─────────────────┐  │     │   (spec generation v2) │
       │                 │  │ Spec Engine v2   │──│─────│─▶ Structured Outputs   │
       │                 │  │ Chat Completions │  │     │   (Zod JSON schema)    │
       │                 │  └─────────────────┘  │     │                        │
       │                 │  ┌─────────────────┐  │     │─▶ Assistants API       │
       │                 │  │ Chat Service     │──│─────│   (threads + runs +    │
       │                 │  │ Assistants API   │  │     │    file_search)        │
       │                 │  └─────────────────┘  │     │                        │
       │                 │  ┌─────────────────┐  │     │─▶ Whisper API          │
       │                 │  │ Live Brief       │──│─────│   (audio transcription)│
       │                 │  └─────────────────┘  │     └────────────────────────┘
       │                 │                       │
       │                 │                       │────▶ Firestore
       │                 │                       │────▶ Lemon Squeezy (payments)
       │                 │                       │────▶ Resend (email)
       │                 └──────────────────────┘
       │
       │                 │  ┌─────────────────┐  │
       └────────────────▶│  │ Auxiliary API    │──│─────▶ Chat Completions
                         │  │ /api/auxiliary/* │  │       (gpt-4o-mini)
                         │  └─────────────────┘  │
                         └──────────────────────┘

┌──────────────┐
│  MCP Server  │───▶ Backend REST API (API key auth)
│  (stdio)     │
└──────────────┘
```

### Three OpenAI Calling Patterns

| Pattern | Used By | How |
|---------|---------|-----|
| **Chat Completions + Structured Outputs** | Spec Engine v2, Live Brief summary, Clarify | `POST /v1/chat/completions` with `response_format: { type: 'json_schema', json_schema: { strict: true } }` |
| **Assistants API (threads + runs + file_search)** | Chat with spec, Brain Dump, Diagram repair | `POST /v1/threads`, `POST /v1/threads/:id/messages`, `POST /v1/threads/:id/runs` |
| **Auxiliary API (frontend → backend → OpenAI)** | Mockups, Prompts, Mindmap, Jira | Frontend `fetch()` → `/api/auxiliary/*` → backend `ai-service.js` |

---

## 2. Technology Stack

| Layer | Technology |
|-------|-----------|
| Static Site Generator | Jekyll (Ruby) + Liquid templates |
| Frontend JS | Vanilla JS (no framework), per-page `<script>` tags |
| CSS | SCSS → compiled `main-compiled.css` + per-page CSS; PostCSS pipeline (autoprefixer, cssnano, purgecss) |
| Build Tool | Vite (configured but bundles not used at runtime — pages load JS directly) |
| Backend | Node.js + Express 5 |
| Database | Google Firestore (Firebase Admin SDK) |
| Auth | Firebase Authentication (client SDK + server token verification) |
| AI / LLM (spec gen) | OpenAI Chat Completions API with Structured Outputs (strict JSON schema via Zod) |
| AI / LLM (chat, brain dump) | OpenAI Assistants API v2 (threads, runs, file_search with vector stores) |
| AI / LLM (auxiliary) | Express auxiliary routes + OpenAI Chat Completions (`gpt-4o-mini`) |
| AI / LLM (live brief) | OpenAI Whisper (transcription) + Chat Completions (summary) |
| Payments | Lemon Squeezy (checkout + webhooks) |
| Email | Resend SDK |
| Edge Functions | Deprecated (auxiliary worker runtime removed) |
| MCP | TypeScript MCP server (`@modelcontextprotocol/sdk`) via stdio |
| Deployment | Render (backend), GitHub Pages (Jekyll site) |
| Monorepo | npm workspaces (`packages/*`) — packages exist but are not used at runtime |

---

## 3. Project Structure

```
specifys-ai/
├── _config.yml                  # Jekyll config
├── _includes/                   # Jekyll HTML partials (10 files)
├── _layouts/                    # Jekyll layouts (5: default, standalone, auth, post, dashboard)
├── _plugins/                    # Jekyll plugins (vite_manifest.rb)
├── _posts/                      # Blog posts (Markdown)
├── assets/
│   ├── css/                     # SCSS + compiled CSS (~87 files)
│   ├── dist/                    # Vite build output (not used at runtime)
│   ├── icons/                   # SVG/PNG icons
│   ├── images/                  # Site images
│   └── js/                      # Frontend JavaScript
│       ├── core/                # Config, logger, security, store
│       ├── services/            # API client, caches, analytics, Firestore listeners
│       ├── components/          # Base component, Modal
│       ├── features/            # Feature modules (index, planning, spec-viewer, profile, etc.)
│       ├── new-admin-dashboard/ # Admin SPA
│       ├── pages/               # Page-specific JS
│       ├── utils/               # Utilities
│       └── bundles/             # Vite entry points (unused at runtime)
├── backend/
│   ├── package.json             # Backend dependencies (Express 5, Firebase Admin, OpenAI, etc.)
│   ├── schemas/                 # Zod schemas (spec-schemas.js)
│   ├── scripts/                 # Migration/utility scripts
│   └── server/                  # Express app (~60+ files)
│       └── server.js            # Entry point
├── blog/                        # Blog index page
├── docs/                        # Documentation
├── mcp-server/                  # MCP server (TypeScript)
│   └── src/                     # index.ts, api.ts
├── packages/                    # Monorepo workspaces (not used at runtime)
│   ├── api-client/
│   ├── design-system/
│   └── ui/
├── pages/                       # HTML pages (~29 files)
├── scripts/                     # Dev/deploy scripts
├── tools/                       # Vibe Coding Tools Map
├── index.html                   # Homepage
├── package.json                 # Root workspace config
├── render.yaml                  # Render deployment config
└── vite.config.js               # Vite config
```

---

## 4. Backend

All backend code lives in `backend/`. Entry point: `backend/server/server.js`. Deployed via Render.

### 4.1 Entry & Middleware

**File:** `backend/server/server.js`

Middleware chain (in order):
1. Trust proxy
2. Security headers (Helmet)
3. Compression
4. CORS (custom, reflects `allowedOrigins` from `config.js`)
5. Lemon Squeezy webhook routes (mounted before JSON parser — needs raw body)
6. Rate limiters (general: 100/15min, auth: 5/15min, feedback: 10/15min)
7. `express.json()`
8. Request logging (Pino + Firestore)
9. Geo enrichment middleware (`middleware/geo.js`)
10. Route handlers
11. Error handler middleware

**Config** (`backend/server/config.js`): `BACKEND_BASE_URL`, `BACKEND_URL`, `API_VERSION`, port (default 10000), CORS origins, Google Apps Script URL, credits V3 enabled flag.
**Startup validation:** `env-check.js` (`assertEnv`) validates required env vars before server boot.

### 4.2 Routes

| Route File | Base Path | Purpose |
|-----------|-----------|---------|
| `specs-routes.js` | `/api/specs` | Spec CRUD, generation (v2), upload to OpenAI |
| `auxiliary-routes.js` | `/api/auxiliary` | Mockup, prompts, mindmap, jira auxiliary generation |
| `user-routes.js` | `/api/users` | User init, profile, MCP key management |
| `credits-v3-routes.js` | `/api/v3/credits` | Credits: get, consume, share-prompt (mounted only when `CREDITS_V3_ENABLED=true`) |
| `chat-routes.js` | `/api/chat` | Chat: init, message, diagrams, demo |
| `brain-dump-routes.js` | `/api/brain-dump` | Brain dump: generate, apply to spec, legacy chat endpoints |
| `admin-routes.js` | `/api/admin` | Admin: users, specs, credits, payments, activity |
| `lemon-routes.js` | `/api/lemon` | Lemon Squeezy: checkout, webhooks, subscription status |
| `health-routes.js` | `/api/health` | Health checks (general, DB, OpenAI, credits) |
| `analytics-routes.js` | `/api/analytics` | Analytics event recording |
| `blog-routes.js` | `/api/blog` | Blog CRUD (admin) |
| `blog-routes-public.js` | `/api/blog/public` | Blog public listing |
| `articles-routes.js` | `/api/articles` | Articles API + sitemap |
| `mcp-routes.js` | `/api/mcp` | MCP: specs list/get/update, tools (API key auth) |
| `share-prompt-routes.js` | `/api/share-prompt` | Share prompt codes |
| `live-brief-routes.js` | `/api/live-brief` | Voice input: Whisper transcription + GPT summary |
| `planning-routes.js` | `/api/planning` | Planning flow API |
| `tools-routes.js` | `/api/tools` | Vibe Coding Tools management + export |
| `tool-finder-routes.js` | `/api/tool-finder` | Tool finder search |
| `stats-routes.js` | `/api/stats` | Public stats |
| `newsletter-routes.js` | `/api/admin/newsletters` | Newsletter management |
| `email-preview-routes.js` | `/api/email` | Email template preview |
| `email-tracking-routes.js` | `/api/email` | Email open/click tracking |
| `automation-routes.js` | `/api/automation` | Automation job management |
| `academy-routes.js` | `/api/academy` | Academy view tracking |
| `api-docs-routes.js` | `/api-docs` | Swagger UI |

**Inline routes in `server.js`:**

| Path | Purpose | Notes |
|------|---------|-------|
| `POST /api/feedback` | Feedback email via `email-service.sendFeedbackEmail` (Resend) + Google Apps Script | Email now unified under Resend; Sheets write remains best-effort |
| `POST /api/contact` | Contact form → Firestore `contactSubmissions` | |
| `GET /api/geo/context` | Lightweight region context for localized suggestions | Public, cache-control 1h |

### 4.3 Spec Engine v2

The core product engine. Replaced the legacy Cloudflare Worker–based flow with **direct Chat Completions API calls** and **Structured Outputs** (strict JSON schema generated from Zod). No OpenAI threads or assistant runs are used for spec generation — each stage is a single stateless `POST /v1/chat/completions` call.

**Components:**

| File | Role |
|------|------|
| `spec-generation-service-v2.js` | Orchestrates generation for overview, technical, market, design, architecture, visibility, prompts. Builds prompts, calls thread manager, emits events |
| `spec-thread-manager.js` | Model resolution (`resolveSpecGeneratorTarget`), calls `openaiStorage.runSpecGeneration`, Zod validation of response |
| `openai-storage-service.js` | Low-level OpenAI HTTP: `runSpecGeneration` → `POST /v1/chat/completions`. Also has Assistants API methods for chat/brain-dump (separate from spec gen) |
| `spec-queue.js` | In-memory queue (concurrency=1) for `generateAllSpecs` background jobs |
| `spec-queue-firestore-listeners.js` | Attaches `spec.update`/`spec.complete`/`spec.error` listeners that sync generation status to Firestore |
| `spec-events.js` | EventEmitter for generation progress (`spec.update`, `spec.complete`, `spec.error`) |
| `spec-overview-utils.js` | Extracts title from overview content |
| `schemas/spec-schemas.js` | Zod schemas for overview, technical, market, design, architecture, visibility, prompts + `buildResponseFormat(stage)` + `parseAndValidateStage(stage, raw)` |
| `pipeline-canary-service.js` | Automated pipeline health test — creates a canary spec through the full v2 pipeline |

#### How It Calls OpenAI (the key innovation)

The v2 engine uses **Chat Completions with Structured Outputs** — not the Assistants API:

1. **`resolveSpecGeneratorTarget()`** (in `spec-thread-manager.js`):
   - If `OPENAI_SPEC_GENERATOR_ASSISTANT_ID` env var is set → `{ mode: 'assistant', assistantId }` (fetches model + instructions from the assistant record via `GET /v1/assistants/:id`, but does **not** use threads/runs)
   - Otherwise → `{ mode: 'direct', model: OPENAI_SPEC_GENERATION_MODEL || 'gpt-4o-mini', instructions }` (no assistant at all)

2. **`runSpecGeneration(threadId, target, userMessage, responseFormat)`** (in `openai-storage-service.js`):
   - `threadId` parameter is **unused** (legacy correlation — for new specs the value is `'chat-completions'`)
   - Resolves `model` and `instructions` from target (either from assistant record or direct config)
   - Builds: `{ model, messages: [{ role: 'system', content: instructions }, { role: 'user', content: userMessage }], response_format }`
   - Token limit: models matching `/^o[0-9]/` or `/^gpt-5/` → `max_completion_tokens: 16384`; others → `max_tokens: 16384`
   - Calls **`POST https://api.openai.com/v1/chat/completions`**

3. **`buildResponseFormat(stage)`** (in `spec-schemas.js`):
   - Converts Zod schema → JSON Schema via `zod-to-json-schema`
   - Unwraps `$ref` envelope so root is `type: "object"` (OpenAI requirement)
   - Returns `{ type: 'json_schema', json_schema: { name, strict: true, schema } }`

4. **Zod validation**: Response is parsed with `parseAndValidateStage(stage, raw)` — fenced JSON markers are stripped if present

**No fallback chain.** A single model is used per deployment (configured once, cached). The documentation references to "gpt-5.2 → gpt-5-mini → ..." are aspirational comments, not implemented code.

#### Stages and Schemas

| Stage | Schema | Root Key | Key Fields |
|-------|--------|----------|------------|
| Overview | `OverviewPayloadSchema` | `overview` | ideaSummary, problemStatement, targetAudience, valueProposition, coreFeaturesOverview, userJourneySummary, detailedUserFlow, screenDescriptions, complexityScore |
| Technical | `TechnicalPayloadSchema` | `technical` | techStack, architectureOverview (with Mermaid), databaseSchema (with Mermaid), apiDesign (with Mermaid), dataFlow (with Mermaid), securityAuthentication, integrationExternalApis, devops, dataStorage, analytics |
| Market | `MarketPayloadSchema` | `market` | industryOverview, targetAudienceInsights, competitiveLandscape, swotAnalysis, monetizationModel, marketingStrategy |
| Design | `DesignPayloadSchema` | `design` | visualStyleGuide, logoIconography, uiLayout, uxPrinciples |
| Architecture | `ArchitecturePayloadSchema` | `architecture` | executiveSummary, systemBoundaries, logicalSystemArchitecture (with Mermaid), informationArchitecture (with Mermaid), functionalArchitecture (with Mermaid), repositoryStructure, coreFlows (sequence Mermaid), integrationLandscape (with Mermaid), deploymentTopology (with Mermaid), nonFunctionalQuality, observabilityOperability, securityArchitectureDeepDive, architectureDecisionLog, risksAndOpenDecisions |

Zod strict-mode rules: no `.optional()` (use `.nullable()`), no `z.record()`/`z.any()`, no mixed `z.union()`.

#### Generation Flow

```
generateOverview(specId, userInput)
  → resolveSpecGeneratorTarget() → model + instructions
  → POST /v1/chat/completions (OverviewPayloadSchema, strict JSON)
  → Zod validation → parseAndValidateStage('overview', raw)
  → Store JSON string in Firestore, set status.overview='ready'

generateAllSpecs(specId, overview, answers)  [via specQueue]
  → generateSection('technical', prompt) → POST /v1/chat/completions → Zod → emitSpecUpdate
  → generateSection('market', prompt)    → POST /v1/chat/completions → Zod → emitSpecUpdate
  → generateSection('design', prompt)    → POST /v1/chat/completions → Zod → emitSpecUpdate
  → generateArchitecture(overview, technical, market, design)
      → POST /v1/chat/completions (ArchitecturePayloadSchema, strict JSON)
      → Zod validation
      → _architecturePayloadToMarkdown(payload) → fenced Mermaid blocks
      → emitSpecUpdate (Markdown stored in Firestore)
  → emitSpecComplete
```

#### Queue and Events

**Queue** (`spec-queue.js`): Single-concurrency in-memory. `processJob` calls `specGenerationServiceV2.generateAllSpecs`. Jobs for the same `specId` replace finished ones. Cleanup after 5 minutes.

**Events** (`spec-events.js`): `spec.update`, `spec.complete`, `spec.error`.

**Firestore listeners** (`spec-queue-firestore-listeners.js`): Attached per `generate-all` request in `specs-routes.js`. On each event, patches the Firestore spec document: `status.{stage}`, section content, `generationVersion: 'v2'`. On `spec.complete`, optionally triggers OpenAI file upload (for chat).

#### Pipeline Canary

`pipeline-canary-service.js` — automated health test. Creates a canary spec (`pipelineCanary: true`) through the full v2 pipeline: `generateOverview` → `specQueue.add` → waits for all stages → records results. Runs daily if `PIPELINE_CANARY_ENABLED=true`. Expired canary specs are cleaned up automatically.

### 4.4 User Management

**Files:** `user-routes.js` (routes), `user-management.js` (service), `admin-config.js` (admin emails).

**Endpoints** (base: `/api/users`):

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/initialize` | Firebase | Initialize user: create/update `users` doc + `user_credits_v3` doc, welcome credit, welcome email, Resend audience |
| GET | `/me` | Firebase | Get profile + credits |
| GET | `/me/mcp-api-key` | Firebase | Check if MCP key exists (key never returned) |
| POST | `/me/mcp-api-key` | Firebase | Create/regenerate MCP API key (returned once) |
| POST | `/me/mcp-event` | Firebase | Record MCP modal/page views |
| PUT | `/preferences/email` | Firebase | Update email preferences (newsletter, operational, marketing) |
| GET | `/preferences/email` | Firebase | Get email preferences |

**User initialization flow** (`initializeUser`):
1. Firestore transaction on `users/{uid}` and `user_credits_v3/{uid}`
2. Determines if new user (from client flag or doc existence)
3. New users: `plan: 'free'`, welcome credit (`balances.free: 1`)
4. Records `user_created` analytics event
5. Adds to Resend audience
6. Sends welcome email

**Admin:** `ADMIN_EMAILS` list in `admin-config.js` (currently `specifysai@gmail.com`). `isAdminEmail(email)` — case-insensitive check.

### 4.5 Credits System (V3)

**Service:** `credits-v3-service.js`
**Collections:** `user_credits_v3` (primary), `credit_ledger_v3` (transactions), `subscriptions_v3` (archive)

| Concept | Detail |
|---------|--------|
| Balance types | `paid`, `free`, `bonus` — stored in `balances` object |
| Total | Computed: `paid + free + bonus` |
| Consumption order | `free → bonus → paid` (configurable via `priority` param) |
| Pro subscription | `subscription.type === 'pro'` + `status in ['active', 'paid']` + `expiresAt` not past → unlimited creation |
| Welcome credit | New users get 1 free credit (`balances.free: 1`, `metadata.welcomeCreditGranted: true`) |
| Idempotency | Consume: ledger doc ID `consume_{specId}_{userId}`. Grant: idempotent by transaction ID |
| Pro consume | Records ledger entry with `unlimited: true` without decrementing balances |
| Expiry | On `getAvailableCredits`, if Pro expired → auto-updates status to `'expired'`, restores `preservedCredits` to `paid` |

**Endpoints** (base: `/api/v3/credits`, mounted only when `CREDITS_V3_ENABLED=true`):

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/` | Firebase | Get available credits (unlimited status, total, breakdown, subscription, permissions) |
| POST | `/consume` | Firebase | Consume 1 credit for a spec |
| POST | `/grant` | Admin | Grant credits to a user |
| POST | `/refund` | Firebase (admin for other users) | Refund credits |
| GET | `/ledger` | Firebase (admin for other users) | Credit transaction ledger |
| GET | `/history` | Firebase | Credit history summary |

**Credits sync** (`credits-sync-service.js` + `credits-sync-job.js`):
- Daily job (if `CREDITS_SYNC_ENABLED=true`): compares expected paid credits from `purchases` against `user_credits_v3.balances.paid`
- Syncs Lemon Squeezy subscription status → local Pro state
- Calls `enableProSubscription` / `disableProSubscription` when out of sync

Routes mounted at `/api/v3/credits` only when `CREDITS_V3_ENABLED=true`.

### 4.6 Payments — Lemon Squeezy

| File | Role |
|------|------|
| `lemon-routes.js` | Checkout, webhook handler, subscription cancel |
| `lemon-webhook-utils.js` | HMAC-SHA256 signature verification |
| `lemon-purchase-service.js` | Purchase recording in `purchases` collection |
| `lemon-credits-service.js` | Test purchase recording in `test_purchases` collection |
| `lemon-products-config.js` | Product/plan definitions (loaded from `assets/data/lemon-products.json`) |
| `lemon-subscription-resolver.js` | Subscription status resolution, Lemon API calls |
| `lemon-payments-cache.js` | Periodic payment data sync (24h cache in `payments_cache`) |

**Products:**

| Key | Name | Type | Credits |
|-----|------|------|---------|
| `single_spec` | Single AI Specification | one_time | 1 |
| `three_pack` | 3-Pack AI Specifications | one_time | 3 |
| `pro_monthly` | Specifys Pro – Monthly | subscription | unlimited |
| `pro_yearly` | Specifys Pro – Yearly | subscription | unlimited |

**Endpoints** (base: `/api/lemon`):

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/checkout` | Firebase | Create Lemon Squeezy checkout session |
| POST | `/subscription/cancel` | Firebase | Cancel subscription via Lemon API |
| POST | `/webhook` | Lemon signature | Process order_created + subscription_* events |
| GET | `/counter` | Public | Test purchase count |

**Webhook flow:**
1. Verify HMAC-SHA256 signature (`lemon-webhook-utils.js`)
2. Parse payload → extract `custom_data` (userId, email)
3. `order_created` → `creditsV3Service.grantCredits` (one-time) or `enableProSubscription` (subscription)
4. `subscription_updated/cancelled/expired` → `upsertSubscriptionFromWebhook` → `enableProSubscription` / `disableProSubscription`
5. Record in `purchases`, `subscriptions_v3`, `audit_logs`

**External APIs:** Lemon Squeezy REST API (`api.lemonsqueezy.com/v1/`) for checkout, subscription cancel, order/subscription/customer lookups.

**Subscription status logic:** Active statuses: `active`, `on_trial`, `paused`, `past_due`, `paid`. Cancelled: `cancelled`, `expired`, `unpaid`.

### 4.7 Chat & Brain Dump

These features use the **OpenAI Assistants API** (threads + runs + file_search) — a different OpenAI pattern than spec generation (which uses Chat Completions).

**Chat** (`chat-service.js` + `chat-routes.js`):
- Uses **Assistants API with `file_search`**: spec is uploaded to OpenAI Files, attached to a vector store, linked to an assistant
- Per-spec assistant (cached in memory: `assistantCache`, `threadCache`)
- Real OpenAI threads maintain conversation history
- `ensureSpecUploaded` → `getOrCreateAssistant` (with vector store) → `createThread`
- Model: `gpt-4o-mini` (hardcoded in `createAssistant`)
- Endpoints: `POST /api/chat/init`, `/message`, `/demo` (demo is rate-limited, no auth)
- `POST /api/chat/diagrams/generate` returns `{ deprecated: true }` — diagrams are now embedded in Technical/Architecture sections
- `POST /api/chat/diagrams/repair` uses `openaiStorage.repairDiagram` (Assistants path)

**Brain Dump** (`brain-dump-routes.js`):
- Also uses **Assistants API** (threads + messages via `openaiStorage`)
- `POST /api/brain-dump/generate`: single-shot — creates thread, sends message, returns `{ plainText, mermaidCode, fullPrompt }`
- Rate limited: 5 per day per user (`brainDumpRateLimit` collection)
- Pro-only `POST /api/brain-dump/apply-to-spec`: merges change into overview + technical sections in Firestore
- Gate: requires technical, market, design all `status: 'ready'` + architecture present
- Legacy endpoints still mounted: `/init`, `/message`, `/history`, `/personal-prompt`

### 4.8 Email — Resend Integration

**Provider:** Resend SDK (`email-service.js`). From: `RESEND_FROM_EMAIL` (default `Specifys-Ai-Team@specifys-ai.com`).

**Email types sent via Resend:**

| Method | When | Triggered By |
|--------|------|-------------|
| `sendWelcomeEmail` | New user registration | `user-routes.js` POST `/initialize` |
| `sendSpecReadyEmail` | First spec completed | `specs-routes.js` |
| `sendSpecReadyEmailSubsequent` | Later specs completed | `specs-routes.js` |
| `sendAdvancedSpecReadyEmail` | Advanced spec sections ready | `specs-routes.js` |
| `sendPurchaseConfirmationEmail` | After purchase | `lemon-routes.js` webhook |
| `sendInactiveUserEmail` | 30+ days inactive | `scheduled-jobs.js` daily |
| `sendNewsletterEmail` | Newsletter send | `newsletter-routes.js` |
| `sendToolFinderUsageEmail` | Tool finder follow-up | `tools-automation.js` |
| `sendDailyReport` | Daily stats | `scheduled-jobs.js` |
| `sendWeeklyReport` | Weekly stats | `scheduled-jobs.js` |
| `sendWeeklyErrorSummary` | Error digest | `scheduled-jobs.js` |
| `sendTestEmail` | Admin test | Admin API |
| `addSignupToResendAudience` | New user | `user-routes.js` — adds contact to Resend audience |
| `sendFeedbackEmail` | Feedback submissions | `server.js` `/api/feedback` |

**Templates:** `email-templates.js` — HTML templates for each email type with `getBaseTemplate` wrapper.

**Tracking** (`email-tracking-service.js`):
- `generateTrackingUrl` — wraps links with UTM params + redirect through `/api/email/track`
- Click tracking: `email_clicks` collection
- Send recording: `email_sent` collection
- Admin stats: `/api/email/stats`, `/api/email/journey/:userId`

**Newsletter** (`newsletter-routes.js`, base: `/api/admin/newsletters`):
- Full CRUD for newsletters (admin only)
- `sendNow` flag triggers async send to all users where `newsletterSubscribed == true`
- Batches of 10, respects `emailPreferences.newsletter`
- Public unsubscribe endpoint

**Legacy:** nodemailer/Gmail feedback path removed from runtime `server.js`.  
**Note:** a duplicate `backend/server/package.json` still lists `nodemailer` and is tracked as follow-up cleanup (runtime uses `backend/package.json`).

### 4.9 Admin, Analytics & Content

**Admin dashboard:** SPA at `/pages/new-admin-dashboard.html` with views for overview, users, payments, logs, analytics, spec usage, MCP, articles, academy, tools, contact, unsubscribe.

**Admin API** (`admin-routes.js`): users management, spec listing, credit operations, payment history, activity log. Protected by `requireAdmin` middleware (checks email against `ADMIN_EMAILS` list).

**Analytics** (`analytics-routes.js`, base `/api/analytics`):
- Public: `POST /page-view`, `POST /event`, `POST /web-vitals`
- Admin: `GET /content-stats`, `GET /top-articles`, `GET /top-guides`, `GET /funnel`, `GET /buy-now-clicks`, `GET /planning-stats`
- Collections: `analytics_events`, `article_views`, `guide_views`, `page_views`, `webVitals`

**Activity tracking** (`admin-activity-service.js`): Records to `admin_activity_log` — types: `user` (registration), `spec` (creation), `payment` (purchase), `subscription` (change), `credit` (consumption).

**Blog** (`blog-routes.js` + `blog-routes-public.js`):
- Admin: create/list/get/update/delete posts (Firestore `blogQueue` collection)
- Public: `GET /api/blog/public/posts`, `GET /api/blog/public/post?slug=...`
- Blog also has Jekyll markdown posts in `_posts/` rendered at build time

**Academy** (`academy-routes.js`):
- Single endpoint: `POST /api/academy/guides/:guideId/view` — records view via `analytics-service`
- Content stored in Firestore: `academy_categories`, `academy_guides`
- Frontend pages: `pages/academy/index.html`, `category.html`, `guide.html`
- Admin pages: `pages/admin/academy/` (4 HTML pages for content management)

**Articles** (`articles-routes.js` + `articles-automation.js`):
- Admin: `POST /api/articles/generate` (calls Cloudflare Worker for generation), update, delete
- Public: list, featured, get by slug, view tracking
- Automation: `ArticleWriterJob` — weekly batch article generation via OpenAI `gpt-4` (JSON mode), saves to `articles` collection
- Sitemap: `sitemap-generator.js` — generates `sitemap.xml` from static pages + published articles

**Share Prompt** (`share-prompt-routes.js`, base `/api/share-prompt`):
- `GET /check` — should the share prompt be shown? (based on spec state + user dismissal history)
- `POST /action` — record user action: `maybe_later`, `dismissed`, `shared`
- UX tracking only — no credit granting in this module

### 4.10 Automation & Scheduled Jobs

**Scheduler:** `scheduled-jobs.js` — starts on server boot.

| Job | Frequency | What it does |
|-----|-----------|-------------|
| Payments sync | 24h | Sync Lemon Squeezy payments cache |
| Inactive users email | 24h | Email users inactive 30+ days |
| Tools finder | 7 days | Run AI tools finder + export to `tools.json` |
| Article writer | Weekly | Generate blog articles via OpenAI |
| Credits sync | Daily | Sync Lemon Squeezy subscriptions → credits V3 |
| Daily report | Daily (configured hour) | Collect stats + email report |
| Weekly report | Sundays | Collect weekly stats + email report |
| Pipeline canary | Daily (if enabled) | Test spec generation pipeline health |

### 4.11 Auxiliary API Migration

Auxiliary generation moved from workers to Express routes.

| Endpoint | Purpose |
|----------|---------|
| `POST /api/auxiliary/mockup/analyze-screens` | Screen analysis for mockups |
| `POST /api/auxiliary/mockup/generate-single` | Per-screen mockup generation |
| `POST /api/auxiliary/prompts/generate` | Prompt generation |
| `POST /api/auxiliary/prompts/fix-diagram` | Diagram fixing |
| `POST /api/auxiliary/mindmap/generate` | Mind map generation |
| `POST /api/auxiliary/jira/export` | Jira CSV export |

Worker runtime dependencies were removed from the main frontend flow.
All auxiliary endpoints now pass through centralized auth middleware and backend rate limiting.

---

## 5. Frontend

### 5.1 Page Loading Model

Jekyll generates static HTML pages. Each page uses a Jekyll layout (`default.html`, `standalone.html`, `auth.html`, `post.html`, `dashboard.html`) that pulls in shared includes.

**Loading chain:**
1. `_includes/head.html` — meta tags, fonts, `main-compiled.css`, `core/config.js`, `core/api-client.js`, `core/focus-manager.js`, analytics
2. `_includes/header.html` — navigation, auth buttons, credits display
3. Page content (HTML + page-specific JS via `<script>` tags)
4. `_includes/footer.html` — links, social, contact modal
5. `_includes/firebase-init.html` — Firebase SDK initialization
6. `_includes/firebase-auth.html` — Auth UI: login modal, session management, user document sync

JS is loaded directly via `<script>` tags — Vite bundles exist in config but are **not used at runtime**.

### 5.2 Core Modules

| File | Global | Purpose |
|------|--------|---------|
| `core/config.js` | `window.API_CONFIG`, `window.BACKEND_URL` | Backend URL, API config |
| `core/api-client.js` | `window.api` | API client with auth, retry, caching |
| `core/store.js` | `window.store` | Simple state store |
| `core/security-utils.js` | `sanitizeHTML`, `escapeHTML` | XSS sanitization |
| `core/app-logger.js` | `window.appLogger` | Client-side logger → backend |
| `credits-config.js` | `window.CREDITS_CONFIG` | Credits system constants |
| `ga4-wrapper.js` | `GA4Wrapper` | Google Analytics wrapper |
| `paywall.js` | `checkEntitlement`, `showPaywall` | Entitlement checks, paywall UI |
| `lib-loader.js` | `LibraryLoader` | Dynamic CDN script loader (Mermaid, Marked, etc.) |
| `mermaid.js` | `MermaidManager` | Mermaid diagram rendering |

### 5.3 Features

**Homepage** (`features/index/`):
- `index.js` — Spec creation flow: auth check → credit consume → create spec doc → call generate-overview → redirect to spec-viewer
- `index-vanta.js` — Hero animation (Vanta.NET)
- `index-demo-scroll.js` — Demo scroll phases

**Spec Viewer** (`features/spec-viewer/`) — the largest feature (main file still ~10k lines, with compatibility bridge):
- `spec-viewer-main.js` — Primary orchestrator + backward-compatible `window.*` handlers; delegates state to `window.dataService`, tab routing to `window.showTab` (TabManager bridge), and partial HTML rendering to `window.uiRenderer`
- `spec-viewer-coordinator.js` — module bridge that attaches compatibility wrappers, SEO hook, and exposes `window.dataService`, `window.tabManager`, `window.uiRenderer`, `window.diagramEngine`, `window.promptEngine`, and `window.showTab`
- `modules/DataService.js` — canonical spec state module (`setSpec/getState/patchState`), scoped loading (`setLoading/isLoading`), Firestore `onSnapshot`, polling fallback, save helpers, internal pub/sub (`specUpdated`, `loadingChanged`), and legacy `window.currentSpecData` sync
- `modules/TabManager.js` — centralized tab navigation/orchestration, active-tab renderer registry, and `specUpdated` subscription to re-render only current tab
- `modules/UiRenderer.js` — partial template isolation for heavy Overview/Technical HTML rendering
- `modules/DiagramEngine.js` — mind map + standalone diagram pipeline, Mermaid lazy-loading via `mermaidManager`, and architecture/spec Mermaid render helpers
- `modules/PromptEngine.js` — staged prompt generation and retry/display adapters with scoped loading via `window.dataService`
- `modules/UiController.js`, `MockupService.js`, `PromptService.js`, `DiagramManager.js`, `MindMapService.js`, `SeoInjector.js` — extracted modular layer
- `spec-viewer-firebase.js` — Firebase config
- `spec-viewer-auth.js` — Auth UI
- `spec-viewer-chat.js` — Chat feature
- `spec-viewer-brain-dump.js` — Brain dump feature
- `spec-viewer-event-handlers.js` — Event handlers
- `cursor-windsurf-export.js` — Export to Cursor/Windsurf

Tabs: Overview, Technical, Market Research, Design & Branding, Architecture (Mermaid), AIO & SEO Visibility Engine (Pro), Prompts, AI Chat, Brain Dump (Pro), Mockup (Pro), Export & Integration, MCP.

**Planning** (`features/planning/`): Multi-step planning interface (~1200 lines).

**Question Flow** (`features/question-flow/`): MVC pattern — controller, state, view.

**Profile** (`features/profile/`): User profile page with Firebase v9+ modular SDK.

**Demo Spec** (`features/demo-spec/`): Hardcoded demo data + Chart.js charts.

**Other page JS:** pricing, academy, articles, blog, MCP docs, tool picker, cursor/windsurf integration.

### 5.4 Admin Dashboard

SPA in `assets/js/new-admin-dashboard/`, loaded by `pages/new-admin-dashboard.html`.

| Layer | Files |
|-------|-------|
| Entry | `main.js` → `NewAdminDashboard` class |
| Core | `DataManager.js`, `StateManager.js`, `FirebaseService.js`, `MetricsCalculator.js` |
| Services | `ApiService.js`, `ActivityService.js` |
| Views | Overview, Users, Payments, Logs, Analytics, SpecUsage, MCP, Articles, Academy, Tools, Contact, Unsubscribe |
| Components | LoadingState, MetricCard, ChartComponent, UserDetailsModal |

### 5.5 CSS / Design System

**Architecture:**
- Entry: `assets/css/main.scss` → imports core, layout, components, utilities
- Compiled: `assets/css/main-compiled.css` (~130 KB) — loaded by all pages via `head.html`
- Per-page CSS: loaded separately (e.g., `pages/spec-viewer.css`, `pages/index.css`)
- Build: PostCSS pipeline (autoprefixer, cssnano, purgecss in production)

**Structure:**

| Directory | Purpose | Key files |
|-----------|---------|-----------|
| `core/` | Variables, reset, fonts, base | `_variables.scss` (CSS custom properties, colors, spacing, typography) |
| `layout/` | Header, footer, containers | `_header.scss`, `_footer.scss`, `_containers.scss` |
| `components/` | Reusable components | `buttons.scss`, `_modals.scss`, `_cards.scss`, `_forms.scss`, `_tables.scss`, `_live-brief.scss` |
| `utilities/` | Utility classes | spacing, text, display, responsive, flexbox, position, etc. |
| `pages/` | Page-specific styles | `index.css`, `spec-viewer.css`, `planning.css`, `profile.css`, `new-admin-dashboard.css`, etc. |

**Design tokens** (CSS custom properties in `_variables.scss`):
- Colors: primary (`#FF6B35`), secondary, semantic (success, warning, danger, info), backgrounds, text, borders
- Spacing: xs (4px) through 2xl (48px)
- Typography: Montserrat (headings), Inter (body); sizes xs–4xl
- Shadows, border-radius, transitions, z-index scale

---

## 6. MCP Server

**Path:** `mcp-server/`
**Language:** TypeScript
**Entry:** `src/index.ts`
**Transport:** stdio (for Cursor / Claude Desktop)
**Published as:** `specifys-mcp-server` v1.0.1 (npm)
**Dependencies:** `@modelcontextprotocol/sdk`, `zod`

### Tools (14 registered)

| Tool | Backend Call | Type |
|------|-------------|------|
| `list_my_specs` | `GET /api/mcp/specs` | Read |
| `get_spec` | `GET /api/mcp/specs/:id` | Read |
| `get_spec_overview` | `GET /api/mcp/specs/:id` | Read |
| `get_spec_technical` | `GET /api/mcp/specs/:id` | Read |
| `get_spec_design` | `GET /api/mcp/specs/:id` | Read |
| `get_spec_prompts` | `GET /api/mcp/prompt-templates` | Read |
| `get_spec_architecture` | `GET /api/mcp/specs/:id` | Read |
| `update_spec_overview` | `PUT /api/mcp/specs/:id` | Write |
| `update_spec_technical` | `PUT /api/mcp/specs/:id` | Write |
| `update_spec_design` | `PUT /api/mcp/specs/:id` | Write |
| `update_spec_market` | `PUT /api/mcp/specs/:id` | Write |
| `update_spec_architecture` | `PUT /api/mcp/specs/:id` | Write |

### Resources (2)

| URI | Backend Call |
|-----|-------------|
| `spec://{specId}` | `GET /api/mcp/specs/:id` (with `list` → `GET /api/mcp/specs`) |
| `specifys://tools` | `GET /api/mcp/tools` |

### Auth & Communication

- **MCP → Backend:** All calls go to `{SPECIFYS_API_BASE_URL}/api/mcp/*` (default `http://localhost:10000`)
- **Auth header:** `X-API-Key: {SPECIFYS_API_KEY}` + `Authorization: Bearer {SPECIFYS_API_KEY}`
- **Backend side** (`mcp-auth.js`): `verifyApiKey` middleware checks key against:
  1. `MCP_API_KEY` env var (dev/single-user mode) → maps to `MCP_API_USER_ID`
  2. Firestore `users` collection where `mcpApiKey == key` → resolves userId
- **Per-user key generation:** `POST /api/users/me/mcp-api-key` (Firebase auth) → returns key once, stored as `users/{uid}.mcpApiKey`
- **MCP request logging:** All requests logged to Firestore `mcp_requests` collection

### Backend MCP Routes (`/api/mcp`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/specs` | List user's specs (metadata) |
| GET | `/specs/:id` | Get full spec |
| PUT | `/specs/:id` | Partial update (allowed fields: overview, technical, design, market, architecture, title) |
| GET | `/prompt-templates` | Static prompt templates |
| GET | `/tools` | List Vibe Coding tools |

---

## 7. Data Layer — Firestore

### Collections

**Core:**

| Collection | Doc ID | Purpose |
|------------|--------|---------|
| `users` | Firebase UID | User profile: email, displayName, plan, mcpApiKey, emailPreferences, timestamps |
| `specs` | Auto | Specifications: userId, title, overview/technical/market/design/architecture, status (per-stage), generationVersion, answers, openaiFileId |
| `user_credits_v3` | Firebase UID | Credits V3 (primary): balances {paid, free, bonus}, total, subscription info, permissions, metadata |
| `credit_ledger_v3` | Auto | Credit transaction ledger (consume, grant, refund) |

**Payments:**

| Collection | Doc ID | Purpose |
|------------|--------|---------|
| `purchases` | Auto | Purchase records (Lemon Squeezy) |
| `subscriptions_v3` | Auto | Subscription event archive (from webhook processing) |
| `subscriptions` | Firebase UID | Subscription records (used by cancel flow) |
| `pending_entitlements` | Auto | Pre-signup purchases (claimed on user registration) |
| `processed_webhook_events` | Event ID | Webhook idempotency |
| `test_purchases` | Auto | Test purchase records |
| `audit_logs` | Auto | Debugging / compliance |
| `payments_cache` | `main` | Cached Lemon Squeezy payment data (24h expiry) |

**Content:**

| Collection | Doc ID | Purpose |
|------------|--------|---------|
| `blogQueue` | Auto | Blog posts (admin CRUD) |
| `articles` | Auto | Auto-generated articles |
| `academy_categories` | Auto | Academy categories |
| `academy_guides` | Auto | Academy guides |
| `tools` | Auto | Vibe Coding tools (source of truth; `tools.json` is derived export) |

**Analytics & Tracking:**

| Collection | Doc ID | Purpose |
|------------|--------|---------|
| `analytics_events` | Auto | Generic analytics events |
| `article_views` | Auto | Article view tracking |
| `guide_views` | Auto | Academy guide view tracking |
| `page_views` | Auto | Page view tracking |
| `webVitals` | Auto | Core Web Vitals data |
| `admin_activity_log` | Auto | Admin activity (registrations, purchases, specs, credits) |
| `email_clicks` | Auto | Email click tracking |
| `email_sent` | Auto | Email send records |
| `mcp_requests` | Auto | MCP server request log |

**Rate Limiting & State:**

| Collection | Doc ID | Purpose |
|------------|--------|---------|
| `brainDumpRateLimit` | Firebase UID | Brain dump daily limit (5/day) |
| `mcp_events` | Auto | MCP UI events |
| `automation_state` | Job key | Automation job state (e.g., `weekly_articles`) |

**Other:**

| Collection | Doc ID | Purpose |
|------------|--------|---------|
| `public_stats` | — | Public stats cache |
| `newsletter_subscribers` | Auto | Newsletter subscribers |
| `contactSubmissions` | Auto | Contact form submissions |
| `errorLogs` | Auto | Server errors |
| `renderLogs` | Auto | Server logs |
| `entitlements` | Firebase UID | Legacy credits (deprecated — use `user_credits_v3`) |

### Key relationships

```
Firebase Auth (UID)
  └─▶ users/{uid}
        ├─▶ user_credits_v3/{uid}  (primary credits)
        │     └─▶ credit_ledger_v3  (transactions)
        ├─▶ specs (userId field)
        ├─▶ purchases (userId field)
        ├─▶ subscriptions/{uid}
        └─▶ brainDumpRateLimit/{uid}
```

### Spec document schema

| Field | Type | Notes |
|-------|------|-------|
| `userId` | string | Owner UID |
| `title` | string | From overview ideaSummary |
| `overview` | string/null | JSON string |
| `technical` | string/null | JSON string |
| `market` | string/null | JSON string |
| `design` | string/null | JSON string |
| `architecture` | string/null | Markdown (serialized from structured JSON) |
| `status.{stage}` | string | `'pending'` / `'generating'` / `'ready'` / `'error'` |
| `thread_id` | string/null | OpenAI thread ID (legacy) or `'chat-completions'` |
| `generationVersion` | string | `'v2'` for v2-generated specs |
| `answers` | array | User answers (3 strings) |
| `openaiFileId` | string/null | OpenAI Storage file ID |
| `createdAt` / `updatedAt` | timestamp | |

---

## 8. Infrastructure & Deployment

### Backend (Render)

**Config:** `render.yaml` — web service `specifys-backend`, root `backend/`, `npm install` → `npm start`.
**Port:** 10000 (default).
**Process:** `cd backend && npm start` → `node server/server.js`.

### Frontend (GitHub Pages + Jekyll)

Jekyll builds the static site from root. `_config.yml` excludes `backend/`, `mcp-server/`, `node_modules/`, `scripts/`, etc.

### CSS Build

`npm run build:css` — Sass compilation → `main-compiled.css`. PostCSS handles autoprefixer, cssnano, purgecss.

### Domains

- Site: `specifys-ai.com` (CNAME)
- Backend: `specifys-ai-backend.onrender.com`
- Workers: deprecated from runtime path (legacy deployment artifacts may still exist externally)

---

## 9. Key Flows

### 9.1 New Spec Creation (Homepage → Spec Viewer)

```
User (Homepage — assets/js/features/index/index.js)
  │
  ├─ Auth check (Firebase client SDK)
  ├─ Credit check + consume (POST /api/v3/credits/consume)
  ├─ Create empty spec doc in Firestore client-side (status.overview: 'generating')
  ├─ POST /api/specs/generate-overview {userInput, specId} → 202 (with specId = v2 path)
  ├─ POST /api/specs/:id/record-activity (email notification)
  └─ Redirect to /pages/spec-viewer.html?id=<specId>

Backend (specs-routes.js → generate-overview)
  │
  ├─ Anchor write: status.overview = 'generating' (Firestore)
  ├─ Background (setImmediate):
  │    ├─ resolveSpecGeneratorTarget() → { mode: 'direct', model: 'gpt-4o-mini' }
  │    ├─ POST https://api.openai.com/v1/chat/completions
  │    │    body: { model, messages: [system, user], response_format: OverviewPayloadSchema }
  │    ├─ Zod validation: parseAndValidateStage('overview', raw)
  │    └─ Firestore update: overview (JSON), status.overview='ready', title, generationVersion='v2'
  └─ emitSpecUpdate(specId, 'overview', 'ready', content)

Spec Viewer (spec-viewer-main.js + modules/DataService.js)
  │
  └─ DataService.subscribeSpec(specId)
       → Firestore onSnapshot on specs/{specId}
       → detects status.overview='ready'
       → renders overview tab
       → (fallback: DataService.startStatusPolling → GET /api/specs/:id/generation-status if listener fails)
```

### 9.2 Generate All Sections (After Overview Approval)

```
User approves overview → POST /api/specs/:id/generate-all {overview, answers} → 202

Backend (specs-routes.js)
  │
  ├─ Set status:
  │    technical='generating', market='pending', design='pending',
  │    architecture='pending', visibility='pending', prompts='pending'
  ├─ attachSpecQueueFirestoreListeners(specId, requestId, onGenerationComplete)
  │    → registers spec.update / spec.complete / spec.error listeners
  └─ specQueue.add(specId, overview, answers) → queued

specQueue.processJob → specGenerationServiceV2.generateAllSpecs:
  │
  ├─ Group A (overview-only)
  │
  ├─ generateSection('technical')
  │    ├─ _buildTechnicalPrompt(...)
  │    ├─ POST /v1/chat/completions (TechnicalPayloadSchema, strict JSON)
  │    ├─ Zod validation
  │    └─ emitSpecUpdate → listener writes to Firestore (status.technical='ready', content)
  │
  ├─ generateSection('market')
  │    ├─ POST /v1/chat/completions (MarketPayloadSchema)
  │    └─ emitSpecUpdate → Firestore
  │
  ├─ generateSection('design')
  │    ├─ POST /v1/chat/completions (DesignPayloadSchema)
  │    └─ emitSpecUpdate → Firestore
  │
  ├─ Group B (overview + technical dependency model)
  │
  ├─ generateArchitecture(overview, technical, market, design)
  │    ├─ _buildArchitecturePrompt(...)
  │    ├─ POST /v1/chat/completions (ArchitecturePayloadSchema, strict JSON)
  │    ├─ Zod validation
  │    ├─ _architecturePayloadToMarkdown(payload) → Markdown with fenced Mermaid
  │    └─ emitSpecUpdate → Firestore (architecture=Markdown, status='ready')
  │
  ├─ generateVisibility(overview, technical)
  │    ├─ POST /v1/chat/completions (VisibilityPayloadSchema, strict JSON)
  │    ├─ Zod validation
  │    └─ emitSpecUpdate → Firestore (visibility JSON, status='ready')
  │
  ├─ Group C (depends on all generated sections)
  │
  ├─ generatePromptsBundle(...)
  │    └─ emitSpecUpdate → Firestore (prompts JSON, status='ready')
  │
  └─ emitSpecComplete
       → listener: remove event subscriptions
       → delayed triggerOpenAIUploadForSpec (upload spec to OpenAI Files for chat)

Spec Viewer
  │
  └─ Firestore onSnapshot → updates each tab progressively as sections become ready
```

### 9.3 Auxiliary Features (Backend-based, Frontend-Initiated)

```
Mockup Generation (Pro):
  Frontend → POST /api/auxiliary/mockup/analyze-screens {overview, design, technical}
  Backend ai-service → OpenAI gpt-4o-mini → screen list
  Frontend → POST /api/auxiliary/mockup/generate-single per screen
  Backend ai-service → OpenAI → HTML mockup
  Frontend → save to Firestore (specs/{id}.mockups)

Prompt Generation:
  Frontend → POST /api/auxiliary/prompts/generate × stages + integrations
  Backend ai-service → OpenAI gpt-4o-mini → structured prompts
  Frontend → save to Firestore (specs/{id}.prompts)

Mind Map:
  Frontend → POST /api/auxiliary/mindmap/generate {overview, technical}
  Backend ai-service → OpenAI → mind map JSON
  Frontend → render with Drawflow library

Jira Export:
  Frontend → POST /api/auxiliary/jira/export
  Backend ai-service → OpenAI → CSV content
  Frontend → downloads CSV
```

### 9.4 Purchase Flow

```
User → Pricing page → Lemon Squeezy checkout (external)
  │
  └─ Lemon webhook → POST /api/lemon/webhook
       ├─ Verify signature (lemon-webhook-utils.js)
       ├─ Check idempotency (processed_webhook_events collection)
       ├─ Grant credits / enable subscription (user_credits_v3)
       ├─ Record purchase (purchases collection)
       └─ Record in audit_logs
```

### 9.5 Chat with Spec (Assistants API)

```
User → Spec Viewer → Chat tab → POST /api/chat/init {specId}
  ├─ chatService.ensureSpecUploaded(specId) → POST /v1/files (purpose: assistants)
  ├─ chatService.getOrCreateAssistant(specId)
  │    → POST /v1/assistants (gpt-4o-mini, file_search tool)
  │    → POST /v1/vector_stores → attach file
  └─ chatService.createThread() → POST /v1/threads
     Return { threadId, assistantId }

User sends message → POST /api/chat/message {threadId, assistantId, message}
  ├─ POST /v1/threads/{threadId}/messages (user message)
  ├─ POST /v1/threads/{threadId}/runs (with assistantId)
  ├─ Poll GET /v1/threads/{threadId}/runs/{runId} until completed
  └─ GET /v1/threads/{threadId}/messages → return assistant response
```

### 9.6 Brain Dump

```
User → Spec Viewer → Brain Dump tab → POST /api/brain-dump/generate {specId, description}
  ├─ Rate limit check (brainDumpRateLimit/{userId} — 5/day)
  ├─ openaiStorage.createThread() → POST /v1/threads
  ├─ openaiStorage.sendMessage(threadId, assistantId, prompt)
  │    → POST /v1/threads/{threadId}/messages + runs + poll
  └─ Return { plainText, mermaidCode, fullPrompt }

Pro user → POST /api/brain-dump/apply-to-spec {specId, plainText, fullPrompt}
  └─ Update overview + technical sections in Firestore
```

### 9.7 Live Brief (Voice Input)

```
User → Live Brief modal → record audio
Frontend → POST /api/live-brief/transcribe (audio file)
  └─ Backend → POST https://api.openai.com/v1/audio/transcriptions (Whisper)
     Return { text }

Frontend → POST /api/live-brief/summarize {text}
  └─ Backend → POST /v1/chat/completions (gpt-4o-mini) → structured summary
     Return { summary, answers }
```

---

## 10. Environment Variables

### Required

| Variable | Purpose |
|----------|---------|
| `FIREBASE_SERVICE_ACCOUNT` or `FIREBASE_SA_*` | Firebase Admin credentials |
| `OPENAI_API_KEY` | OpenAI API |
| `RESEND_API_KEY` | Email (Resend) |
| `LEMON_SQUEEZY_API_KEY` | Lemon Squeezy API |
| `LEMON_SQUEEZY_WEBHOOK_SECRET` | Webhook verification |

### Optional

| Variable | Purpose |
|----------|---------|
| `OPENAI_SPEC_GENERATOR_ASSISTANT_ID` | Pre-created generator assistant (skips auto-creation) |
| `OPENAI_SPEC_GENERATION_MODEL` | Model override (default: `gpt-4o-mini`) |
| `OPENAI_SPEC_API_KEY` | Separate key for spec generation |
| `CREDITS_V3_ENABLED` | Enable V3 credits routes (`true`/`false`) |
| `NODE_ENV` | `production` / `development` |
| `PORT` | Server port (default: 10000) |
| `GOOGLE_APPS_SCRIPT_URL` | Feedback/contact webhook |
| `MCP_API_KEY` / `MCP_API_USER_ID` | Single-user MCP auth (dev) |
| `PIPELINE_CANARY_ENABLED` | Enable pipeline health canary |
| `TOOLS_AUTOMATION_ENABLED` | Enable weekly tools finder |
| `ARTICLES_AUTOMATION_ENABLED` | Enable weekly article writer |
| `CREDITS_SYNC_ENABLED` | Enable daily credits sync |

---

## 11. Known Issues & Legacy

### Legacy code still in codebase

| Item | Location | Status |
|------|----------|--------|
| Credits V2 routes | `credits-v2-routes.js` | Not mounted in server.js — dead code |
| Credits V2 service | `credits-v2-service.js` | Referenced by migration scripts only |
| Credits V2 UI | `pages/credits-v2-display.js` | Legacy |
| Spec v1 service | `spec-generation-service.js` | Still imported in MCP routes; also used as fallback for overview generation without specId |
| Legacy viewer | `features/legacy-viewer/` | 3 files, kept for old URLs |
| Vite bundles | `bundles/*.js` | Not used at runtime |
| Monorepo packages | `packages/*` | Exist but not used at runtime — JS loaded directly via `<script>` |
| `POST /api/generate-spec` | Removed | Replaced by v2 generation and `/api/auxiliary/*` |
| `POST /api/diagrams/repair` | Removed | Replaced by authenticated repair routes |
| `POST /api/chat/diagrams/generate` | `chat-routes.js` | Returns `{ deprecated: true }` stub |
| `thread_id` on specs | Firestore field | Legacy — v2 sets `'chat-completions'` as value; real thread IDs from v1 still exist on old specs |
| Client-side Worker fallback | Removed | Frontend now calls backend APIs directly |

### Geo & SEO updates

| Item | Location | Status |
|------|----------|--------|
| Geo middleware | `backend/server/middleware/geo.js` | Active |
| Geo context endpoint | `GET /api/geo/context` | Active |
| Frontend geo context | `assets/js/core/geo-context.js` | Active |
| Spec viewer dynamic SEO | `features/spec-viewer/modules/SeoInjector.js` | Active |

### Structural issues

| Issue | Details |
|-------|---------|
| Duplicate files | Resolved — canonical shared files are under `assets/js/core/` |
| spec-viewer-main.js | Still large (~10k lines), but Mockup pipeline/viewer were extracted and Phase 1 Data Backbone moved state/listener/polling/save concerns into `features/spec-viewer/modules/DataService.js` |
| `verifyFirebaseToken` | Resolved — centralized in `backend/server/middleware/auth.js` |
| Worker URLs | Resolved — frontend uses `/api/auxiliary/*` |
| `design-system` package | `package.json` declares exports that don't match actual file structure |
| Scripts port mismatch | Resolved — env/examples/scripts/swagger aligned to backend default `process.env.PORT || 10000` |
| Feedback email | Resolved — `/api/feedback` now uses Resend `email-service.sendFeedbackEmail` |

### Gaps & follow-ups after latest refactor

| Area | Current state | Recommended completion |
|------|---------------|------------------------|
| Auxiliary contract parity | Worker-based behavior was replaced by backend `ai-service` JSON handlers; edge-case output parity may differ | Add endpoint-level contract tests for mockup/prompts/mindmap/jira payloads and error envelopes |
| Auth propagation for auxiliary endpoints | Main spec-viewer flow now sends bearer tokens for auxiliary calls | Audit all non-spec-viewer callers to ensure they send Firebase bearer token as well |
| Spec-viewer modularization depth | Mockup/Data Backbone/TabManager/Event Bus/Scoped Loading + DiagramEngine/PromptEngine extraction are in place with compatibility bridge; some legacy wrappers still exist in `spec-viewer-main.js` for safe rollout | Continue gradual removal of legacy wrappers after additional runtime validation in production-like env |
| Sitemap publish coverage | Sitemap generation now uses shared generator and is triggered from multiple flows | Add integration test validating `/sitemap.xml` after publish/update/delete events |
| Spec-viewer E2E coverage | Playwright smoke test added at `tests/e2e/spec-viewer.spec.js` (module boot, tab switch, lazy Mermaid load, bearer header assertion) | Expand to authenticated end-to-end flow against real Firebase test project and include retry/error-path assertions |
| Port drift prevention | Runtime/default ports are aligned to 10000 across scripts and swagger; repo now includes `npm run check:ports` as a guardrail scan | Enforce `check:ports` in CI and maintain an allowlist for non-port numeric literals (timeouts/sizes) |

---

*This document replaces all previous architecture documents in `docs/architecture/`.*
