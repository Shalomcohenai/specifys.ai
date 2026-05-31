# Specifys.ai Next-Gen — System Architecture & Detailed Design

> **Status:** Working blueprint for the next-generation Specifys.ai application that will run **in parallel** to the current production system ([ARCHITECTURE.md](./ARCHITECTURE.md)). This document defines the target system end-to-end. It deliberately **does not** try to reconcile differences with the legacy stack — the two systems are isolated and will not run together within the same process.

**Document version:** 3.0.0 (Next-Gen Blueprint)
**Target stack:** Next.js 15+ (App Router) · Supabase (PostgreSQL 15 + pgvector) · Drizzle ORM · React Flow (`@xyflow/react`) · OpenAI Structured Outputs · Model Context Protocol (MCP)
**Last updated:** May 2026

---

## Table of Contents

1. [Vision & The Multi-State Engine](#1-vision--the-multi-state-engine)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure (Monorepo)](#3-project-structure-monorepo)
4. [Data Model — Supabase + Drizzle](#4-data-model--supabase--drizzle)
5. [Spec Generation Pipeline (v3)](#5-spec-generation-pipeline-v3)
6. [Bidirectional Synchronization Engine](#6-bidirectional-synchronization-engine)
   - [6.1 Synchronization policy — explicit, on-demand only](#61-synchronization-policy--explicit-on-demand-only)
   - [6.2 Endpoint A — State-driven sync (graph → derived projections)](#62-endpoint-a--state-driven-sync-graph--derived-projections)
   - [6.3 Endpoint B — Text-driven reverse sync (markdown → canonical_state)](#63-endpoint-b--text-driven-reverse-sync-markdown--canonical_state)
   - [6.4 Endpoint C — Prompt-driven graph mutation (`chat-modify`)](#64-endpoint-c--prompt-driven-graph-mutation-chat-modify)
   - [6.5 Endpoint D — Streamed chat with spec (SSE + RAG)](#65-endpoint-d--streamed-chat-with-spec-sse--rag)
   - [6.6 Realtime broadcast & conflict handling](#66-realtime-broadcast--conflict-handling)
7. [Visual Workspace — React Flow](#7-visual-workspace--react-flow)
   - [7.1 Workspace layout — three fixed regions](#71-workspace-layout--three-fixed-regions)
   - [7.2 Center-top view switcher (two-toggle cluster)](#72-center-top-view-switcher-two-toggle-cluster)
   - [7.3 Bottom Sync trigger — explicit recompilation gate](#73-bottom-sync-trigger--explicit-recompilation-gate)
   - [7.4 Visual canvas (React Flow)](#74-visual-canvas-react-flow)
   - [7.5 Textual specification view (markdown editor)](#75-textual-specification-view-markdown-editor)
   - [7.6 Node kinds & edges](#76-node-kinds--edges)
   - [7.7 Pending-changes buffer (Zustand)](#77-pending-changes-buffer-zustand)
8. [Authentication, Users & Credits](#8-authentication-users--credits)
9. [Payments — Lemon Squeezy](#9-payments--lemon-squeezy)
10. [Code Scaffolding & Export](#10-code-scaffolding--export)
11. [MCP Server Integration](#11-mcp-server-integration)
12. [Public Site — SEO & GEO](#12-public-site--seo--geo)
13. [Admin, Analytics & Content Automation](#13-admin-analytics--content-automation)
14. [Infrastructure & Deployment](#14-infrastructure--deployment)
15. [Parallel Operation with Legacy System](#15-parallel-operation-with-legacy-system)
16. [Implementation Roadmap](#16-implementation-roadmap)

---

## 1. Vision & The Multi-State Engine

Next-Gen Specifys is a **live generative spec engine**. A user describes an app idea once, and the platform maintains **three coherent representations** of that product simultaneously, fully synchronized at all times:

| Representation | Surface | Source of truth |
|----------------|---------|-----------------|
| **Canonical JSON state** | Database (`specifications.canonical_state` JSONB) | **Yes** — single source of truth |
| **Node-graph view** | React Flow canvas (UI, DB entities, logic flows) | Derived projection |
| **Code scaffolding map** | Generated file blueprint (downloadable ZIP) | Derived projection |
| **Text sections** | Overview / Technical / Architecture markdown | Derived projection |

Every interaction vector — natural-language chat, dragging a node, drawing an edge, editing a property panel, or an external MCP write — is funneled into one and the same **state-delta** pipeline, then projected back onto all surfaces.

### Bidirectional synchronization

```
┌──────────────────────────────────────────────────────────────────────┐
│                Client (Next.js Client Components)                    │
│   ┌────────────────┐   ┌──────────────────┐   ┌────────────────┐     │
│   │ Chat assistant │   │ React Flow canvas│   │ Markdown panes │     │
│   └────────┬───────┘   └────────┬─────────┘   └────────┬───────┘     │
└────────────┼────────────────────┼──────────────────────┼─────────────┘
             │  POST /api/specs/[id]/sync (state delta)  │
             └─────────────┬──────┴──────────┬───────────┘
                           ▼                 ▼
            ┌──────────────────────────────────────┐
            │  Next.js API Route — Sync Engine     │
            │  • Authz (Supabase session)          │
            │  • Validate delta (Zod)              │
            │  • Persist new canonical_state       │
            │  • Append specification_history      │
            │  • Run OpenAI Structured Outputs     │
            │    → derive overview/technical/arch  │
            │    → derive code_scaffolding_map     │
            │  • Realtime broadcast (Supabase)     │
            └──────────────┬───────────────────────┘
                           │
            ┌──────────────┴───────────────┐
            ▼                              ▼
   ┌──────────────────┐         ┌────────────────────┐
   │  Supabase Postgres│         │  OpenAI API        │
   │  • specifications │         │  Chat Completions  │
   │  • spec_history   │         │  + Structured      │
   │  • credits_ledger │         │    Outputs (Zod)   │
   │  • pgvector index │         └────────────────────┘
   └──────────────────┘
            │
            └── Realtime subscription ──▶ all connected clients
```

### OpenAI calling patterns

Three patterns, each chosen for a specific job:

| Pattern | Where it's used | API surface |
|---------|-----------------|-------------|
| **Chat Completions + Structured Outputs (Zod-derived JSON Schema)** | Spec generation per stage, sync engine, diagram repair, brain dump, prompt bundle | `POST /v1/chat/completions` with `response_format.json_schema.strict = true` |
| **Chat Completions + `file_search` tool** | "Chat with spec" — RAG over the spec's serialized markdown | `POST /v1/chat/completions` with `tools: [{ type: "file_search" }]` and a vector store attached |
| **Whisper transcription** | Live brief voice input | `POST /v1/audio/transcriptions` |

> Next-gen drops the legacy Assistants API + threads+runs stack entirely. Conversation state is owned by **us** (rows in `chat_sessions`), not by OpenAI.

---

## 2. Technology Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Framework** | Next.js 15+ (App Router) | Single repo for public SSR/ISR pages + private SPA + API; React Server Components for SEO surfaces |
| **Language** | TypeScript 5+ (strict) | End-to-end types from DB → API → UI |
| **UI library** | React 19 + Tailwind CSS 4 + shadcn/ui | Component primitives, accessible by default |
| **Visual canvas** | `@xyflow/react` (React Flow) | First-class state model for nodes + edges; integrates cleanly with our canonical JSON |
| **State (client)** | Zustand (canvas + ephemeral UI) + React Server Components (data) | Avoid hydration of server-fetched data; Zustand only for canvas interactions |
| **Database** | Supabase Postgres 15 + `pgvector` | Managed Postgres, Row Level Security, Realtime, Edge Functions, Storage |
| **ORM** | Drizzle ORM | Type-safe SQL builder, fast, no decorators, plays well with RSC |
| **Auth** | Supabase Auth (email + OAuth: Google) | Built-in session cookies, JWT for RLS, no extra service |
| **Storage** | Supabase Storage | Spec exports (ZIP), avatars, mockup screenshots |
| **AI / LLM** | OpenAI SDK (`openai@^5`) | Chat Completions + Structured Outputs + `file_search` + Whisper |
| **Payments** | Lemon Squeezy | Reuse existing products + webhooks (single source for Pro entitlements) |
| **Email** | Resend | Transactional + audiences |
| **MCP** | Hosted MCP endpoint (`/api/mcp`) + stdio shim | Same Specifys MCP tools, served from Next.js |
| **Hosting** | Vercel (web) + Supabase (DB) | Edge runtime for public reads, Node for OpenAI/Drizzle handlers |
| **CI** | GitHub Actions | Type-check, lint, Drizzle migration check, Playwright smoke |

### Why a clean break from the legacy stack

| Legacy pain | Next-gen resolution |
|-------------|---------------------|
| ~10k-line `spec-viewer-main.js`, ad-hoc `window.*` bridges | App Router file-system routing + typed RSC/Client boundaries |
| Jekyll + vanilla JS + per-page `<script>` | One framework, one bundler, one router |
| Express monolith serving both API and static `_site` | Vercel serves SSR/ISR/static + serverless handlers automatically |
| Firestore document-store, no SQL joins | Postgres relational + JSONB for flexible parts |
| Assistants API threads/runs (vendor-locked, polling) | Stateless Chat Completions; our DB owns conversation history |
| In-process scheduled jobs in Express | Supabase Edge Functions + `pg_cron`, observable per-run |
| Two credit collections + legacy `entitlements` | One `credits_ledger` (event-sourced) with materialized balance view |

---

## 3. Project Structure (Monorepo)

```
specifys-nextgen/
├── app/                                # Next.js App Router root
│   ├── (public)/                       # SSR + ISR — fully crawlable
│   │   ├── page.tsx                    # Homepage (single prompt input)
│   │   ├── pricing/page.tsx
│   │   ├── blog/                       # ISR articles (revalidate: 86400)
│   │   │   ├── page.tsx                # Index
│   │   │   └── [slug]/page.tsx
│   │   ├── glossary/[term]/page.tsx
│   │   ├── compare/[a]-vs-[b]/page.tsx
│   │   ├── for-ai-assistants/page.tsx  # GEO hub
│   │   └── sitemap.ts                  # Dynamic sitemap
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── callback/route.ts           # Supabase OAuth callback
│   ├── (dashboard)/                    # Private — Supabase session required
│   │   ├── layout.tsx                  # Auth guard + nav
│   │   ├── page.tsx                    # User home (specs list)
│   │   ├── spec/[id]/                  # Visual spec workspace
│   │   │   ├── page.tsx                # RSC shell — fetches initial state
│   │   │   ├── canvas.tsx              # Client — React Flow
│   │   │   ├── chat.tsx                # Client — generation/chat panel
│   │   │   ├── code.tsx                # Client — scaffolding preview
│   │   │   └── prompts.tsx             # Client — export prompts
│   │   ├── billing/page.tsx
│   │   └── settings/
│   │       ├── profile/page.tsx
│   │       └── mcp-key/page.tsx
│   ├── (admin)/
│   │   ├── layout.tsx                  # Admin email allowlist guard
│   │   └── ...                         # Users, Specs, Payments, Logs, Page Views, Content
│   └── api/                            # Route handlers
│       ├── specs/
│       │   ├── route.ts                # POST create / GET list
│       │   └── [id]/
│       │       ├── route.ts            # GET / PATCH / DELETE
│       │       ├── generate/route.ts   # Start stage generation (queued)
│       │       ├── sync/route.ts       # Bidirectional sync delta
│       │       ├── chat/route.ts       # SSE stream — chat with spec
│       │       └── export/route.ts     # ZIP scaffolding
│       ├── credits/
│       │   ├── route.ts                # GET balance
│       │   ├── consume/route.ts        # POST consume (idempotent)
│       │   └── ledger/route.ts         # GET history
│       ├── lemon/
│       │   ├── checkout/route.ts
│       │   └── webhook/route.ts        # Raw body, HMAC verify
│       ├── mcp/route.ts                # MCP JSON-RPC over HTTP
│       ├── live-brief/route.ts         # Whisper + summarize
│       ├── analytics/
│       │   ├── page-view/route.ts
│       │   └── event/route.ts
│       └── admin/...                   # Admin-only handlers
├── components/
│   ├── graph/
│   │   ├── SpecGraph.tsx               # React Flow canvas orchestrator
│   │   ├── nodes/                      # Custom node renderers
│   │   │   ├── UiScreenNode.tsx
│   │   │   ├── DbTableNode.tsx
│   │   │   ├── LogicFlowNode.tsx
│   │   │   └── ExternalServiceNode.tsx
│   │   ├── edges/                      # Custom edge types
│   │   └── PropertyPanel.tsx           # Right-side node properties
│   ├── chat/                           # Assistant chat UI (SSE)
│   ├── ui/                             # shadcn primitives
│   └── seo/                            # JSON-LD components
├── lib/
│   ├── db/
│   │   ├── index.ts                    # Drizzle client singleton
│   │   ├── schema.ts                   # All Drizzle tables
│   │   ├── relations.ts                # Relational config
│   │   └── migrations/                 # SQL migration files
│   ├── supabase/
│   │   ├── server.ts                   # Server-side client (cookies)
│   │   ├── browser.ts                  # Browser client
│   │   └── service.ts                  # Service-role client (server only)
│   ├── ai/
│   │   ├── client.ts                   # OpenAI client + retry/backoff
│   │   ├── schemas/                    # Zod schemas per stage
│   │   │   ├── overview.ts
│   │   │   ├── technical.ts
│   │   │   ├── market.ts
│   │   │   ├── design.ts
│   │   │   ├── architecture.ts
│   │   │   ├── visibility.ts
│   │   │   ├── prompts.ts
│   │   │   └── sync-output.ts
│   │   ├── stage-runner.ts             # Generic per-stage runner
│   │   ├── sync-engine.ts              # Delta → derived projections
│   │   ├── mermaid/                    # sanitize / validate / repair
│   │   └── prompts/                    # System prompts per stage
│   ├── credits/
│   │   ├── service.ts                  # Pure functions; uses Drizzle tx
│   │   └── balance-view.ts             # Read from materialized view
│   ├── lemon/
│   │   ├── webhook.ts                  # HMAC + dispatch
│   │   └── products.ts                 # Product/plan map
│   ├── mcp/
│   │   ├── handler.ts                  # JSON-RPC dispatcher
│   │   └── tools/                      # Tool implementations
│   ├── seo/
│   │   ├── llms-txt.ts                 # llms.txt generator
│   │   └── json-ld.ts                  # Schema.org builders
│   └── content/
│       ├── article-writer.ts           # Daily article job
│       ├── tools-finder.ts             # Weekly tools job
│       └── sitemap.ts                  # Sitemap builder
├── drizzle.config.ts
├── next.config.ts
├── tsconfig.json
├── package.json
└── supabase/
    ├── config.toml
    ├── migrations/                     # Native Supabase migrations (RLS, functions)
    └── functions/                      # Edge Functions (cron-triggered jobs)
        ├── article-writer/index.ts
        ├── tools-finder/index.ts
        ├── credits-sync/index.ts
        └── pipeline-canary/index.ts
```

---

## 4. Data Model — Supabase + Drizzle

### Design principles

1. **One canonical source per concept.** No "primary collection + shadow collection" patterns.
2. **Event-sourced credits.** The ledger is the truth; balances are a materialized view.
3. **JSONB where the shape is fluid** (`canonical_state`, derived snapshots), **typed columns** for everything queryable.
4. **Row Level Security (RLS) on every table.** Service-role client used only for server-internal jobs.
5. **`pgvector` for semantic context** — eventual chat-with-spec embeddings.

### Drizzle schema (`lib/db/schema.ts`)

```typescript
import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── Enums ──────────────────────────────────────────────────────────────
export const planEnum = pgEnum('plan', ['free', 'pro']);
export const specStatusEnum = pgEnum('spec_stage_status', ['pending', 'generating', 'ready', 'error']);
export const ledgerKindEnum = pgEnum('ledger_kind', ['grant_welcome', 'grant_purchase', 'grant_admin', 'consume_spec', 'refund', 'expire']);
export const balanceBucketEnum = pgEnum('balance_bucket', ['paid', 'free', 'bonus']);

// ─── Users (mirrors auth.users one-to-one) ──────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),                                  // = auth.users.id
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  plan: planEnum('plan').default('free').notNull(),
  mcpApiKeyHash: text('mcp_api_key_hash'),                      // sha256, never store plaintext
  emailPreferences: jsonb('email_preferences').$type<{
    newsletter: boolean;
    operational: boolean;
    marketing: boolean;
  }>().default(sql`'{"newsletter":true,"operational":true,"marketing":true}'::jsonb`).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Specifications (the product) ───────────────────────────────────────
export const specifications = pgTable('specifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  promptSummary: text('prompt_summary').notNull(),

  // The single source of truth — projects into canvas, scaffolding, and text.
  canonicalState: jsonb('canonical_state').$type<CanonicalSpecState>().notNull(),

  // Per-stage status mirror (cheap to query without parsing JSONB).
  overviewStatus:     specStatusEnum('overview_status').default('pending').notNull(),
  technicalStatus:    specStatusEnum('technical_status').default('pending').notNull(),
  marketStatus:       specStatusEnum('market_status').default('pending').notNull(),
  designStatus:       specStatusEnum('design_status').default('pending').notNull(),
  architectureStatus: specStatusEnum('architecture_status').default('pending').notNull(),
  visibilityStatus:   specStatusEnum('visibility_status').default('pending').notNull(),
  promptsStatus:      specStatusEnum('prompts_status').default('pending').notNull(),

  // Derived text projections (markdown, regenerated by sync engine).
  overviewText:     text('overview_text'),
  technicalText:    text('technical_text'),
  marketText:       text('market_text'),
  designText:       text('design_text'),
  architectureText: text('architecture_text'),
  visibilityText:   text('visibility_text'),
  promptsBundle:    jsonb('prompts_bundle').$type<PromptsBundle>(),

  // Code scaffolding projection.
  codeScaffoldingMap: jsonb('code_scaffolding_map').$type<{
    files: Array<{ path: string; content: string }>;
  }>(),

  generationVersion: text('generation_version').default('v3').notNull(),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byUserCreated: index('specs_user_created_idx').on(t.userId, t.createdAt),
}));

// Canonical state shape used in JSONB.
export type CanonicalSpecState = {
  modules: Array<{
    id: string;
    kind: 'ui_screen' | 'db_table' | 'logic_flow' | 'external_service';
    name: string;
    description: string;
    position: { x: number; y: number };
    properties: Record<string, unknown>;
  }>;
  connections: Array<{
    id: string;
    source: string;
    target: string;
    kind: 'data_flow' | 'navigation' | 'dependency' | 'fk';
    label?: string;
  }>;
  meta: { lastEditedBy: 'user' | 'ai'; updatedAt: string };
};

export type PromptsBundle = {
  stages: Array<{ name: string; prompt: string }>;
  integrations: Array<{ name: string; prompt: string }>;
};

// ─── Specification history (event log for undo / audit) ─────────────────
export const specificationHistory = pgTable('specification_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  specId: uuid('spec_id').references(() => specifications.id, { onDelete: 'cascade' }).notNull(),
  version: integer('version').notNull(),
  canonicalStateSnapshot: jsonb('canonical_state_snapshot').$type<CanonicalSpecState>().notNull(),
  changeLog: text('change_log').notNull(),
  source: text('source', { enum: ['canvas', 'chat', 'mcp', 'system'] }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  bySpecVersion: uniqueIndex('spec_history_spec_version_idx').on(t.specId, t.version),
}));

// ─── Chat sessions (we own conversation history) ────────────────────────
export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  specId: uuid('spec_id').references(() => specifications.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  vectorStoreId: text('vector_store_id'),                       // OpenAI file_search vector store
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => chatSessions.id, { onDelete: 'cascade' }).notNull(),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),         // pgvector for semantic recall
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  bySession: index('chat_msgs_session_idx').on(t.sessionId, t.createdAt),
}));

// ─── Credits — event-sourced ledger ─────────────────────────────────────
export const creditsLedger = pgTable('credits_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  kind: ledgerKindEnum('kind').notNull(),
  bucket: balanceBucketEnum('bucket').notNull(),
  amount: integer('amount').notNull(),                          // signed: +grant / -consume
  idempotencyKey: text('idempotency_key').notNull(),            // e.g. consume_{specId}_{userId}
  specId: uuid('spec_id').references(() => specifications.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byUser: index('credits_ledger_user_idx').on(t.userId, t.createdAt),
  uniqIdem: uniqueIndex('credits_ledger_idem_uidx').on(t.idempotencyKey),
}));

// Balance is a materialized view (refreshed on every ledger insert via trigger):
//   CREATE MATERIALIZED VIEW user_credit_balances AS
//     SELECT user_id, bucket, COALESCE(SUM(amount),0)::int AS balance
//     FROM credits_ledger GROUP BY user_id, bucket;

// ─── Subscriptions (mirrors Lemon Squeezy) ──────────────────────────────
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  lemonSubscriptionId: text('lemon_subscription_id').notNull().unique(),
  productKey: text('product_key', { enum: ['pro_monthly', 'pro_yearly'] }).notNull(),
  status: text('status').notNull(),                             // active / on_trial / paused / past_due / cancelled / expired
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
  rawWebhookPayload: jsonb('raw_webhook_payload'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const purchases = pgTable('purchases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  lemonOrderId: text('lemon_order_id').notNull().unique(),
  productKey: text('product_key').notNull(),
  creditsGranted: integer('credits_granted').default(0).notNull(),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull(),
  rawWebhookPayload: jsonb('raw_webhook_payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const processedWebhookEvents = pgTable('processed_webhook_events', {
  eventId: text('event_id').primaryKey(),
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Content (articles for SEO/GEO) ─────────────────────────────────────
export const articles = pgTable('articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  shortTitle: text('short_title'),
  description160: text('description_160'),
  teaser90: text('teaser_90'),
  contentMarkdown: text('content_markdown').notNull(),
  tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
  status: text('status', { enum: ['draft', 'published'] }).default('draft').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  sourcesJson: jsonb('sources_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tools = pgTable('tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  url: text('url').notNull(),
  pricingModel: text('pricing_model'),
  refreshedAt: timestamp('refreshed_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Analytics ──────────────────────────────────────────────────────────
export const pageViews = pgTable('page_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  sessionId: text('session_id').notNull(),
  path: text('path').notNull(),
  referrer: text('referrer'),
  country: text('country'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byPath: index('page_views_path_idx').on(t.path, t.createdAt),
}));

export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  type: text('type').notNull(),
  properties: jsonb('properties').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Automation ─────────────────────────────────────────────────────────
export const automationRuns = pgTable('automation_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  job: text('job').notNull(),                                   // article-writer / tools-finder / credits-sync / pipeline-canary
  status: text('status', { enum: ['queued', 'running', 'ok', 'error'] }).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  result: jsonb('result'),
  errorMessage: text('error_message'),
});

// ─── MCP request log ────────────────────────────────────────────────────
export const mcpRequests = pgTable('mcp_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  method: text('method').notNull(),
  toolName: text('tool_name'),
  durationMs: integer('duration_ms'),
  status: integer('status'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### Row Level Security (RLS) snapshot

Every public-facing table gets a policy that locks reads/writes to the authenticated user, except for service-role internal jobs:

```sql
ALTER TABLE specifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "specs_owner_select" ON specifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "specs_owner_modify" ON specifications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- credits_ledger: read own, no client writes (server-only via service role)
CREATE POLICY "ledger_owner_select" ON credits_ledger
  FOR SELECT USING (auth.uid() = user_id);
```

Admin policies use `auth.jwt() ->> 'email' IN (...)` against the same `ADMIN_EMAILS` allowlist concept as today.

---

## 5. Spec Generation Pipeline (v3)

The v3 pipeline keeps the **stage shape** from production (overview → technical / market / design → architecture → visibility → prompts) but runs each stage as a stateless Chat Completions call validated by Zod, and projects results back into the `specifications` row plus an updated `canonical_state`.

### Stages

| Stage | Schema file | Updates |
|-------|-------------|---------|
| `overview` | `lib/ai/schemas/overview.ts` | `overview_text`, `title`, seeds initial `canonical_state.modules` |
| `technical` | `lib/ai/schemas/technical.ts` | `technical_text`, adds `db_table` + `external_service` modules, Mermaid diagrams |
| `market` | `lib/ai/schemas/market.ts` | `market_text` |
| `design` | `lib/ai/schemas/design.ts` | `design_text`, attaches visual tokens to `ui_screen` modules |
| `architecture` | `lib/ai/schemas/architecture.ts` | `architecture_text` (markdown w/ Mermaid), adds `logic_flow` modules + connections |
| `visibility` | `lib/ai/schemas/visibility.ts` | `visibility_text` (AIO/SEO) — **Pro only** |
| `prompts` | `lib/ai/schemas/prompts.ts` | `prompts_bundle` |

### Generic stage runner (`lib/ai/stage-runner.ts`)

```typescript
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { openai } from '@/lib/ai/client';

export async function runStage<TSchema extends z.ZodTypeAny>(opts: {
  stage: string;
  schema: TSchema;
  systemPrompt: string;
  userPrompt: string;
  model?: string;
}): Promise<z.infer<TSchema>> {
  const response = await openai.chat.completions.create({
    model: opts.model ?? process.env.OPENAI_SPEC_MODEL ?? 'gpt-4o-mini',
    messages: [
      { role: 'system', content: opts.systemPrompt },
      { role: 'user',   content: opts.userPrompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: `${opts.stage}_schema`,
        strict: true,
        schema: zodToJsonSchema(opts.schema, { target: 'openAi' }) as Record<string, unknown>,
      },
    },
  });

  const raw = response.choices[0]?.message?.content ?? '';
  const parsed = opts.schema.parse(JSON.parse(stripJsonFences(raw)));
  return parsed;
}
```

### Mermaid QA pipeline — preserved

The legacy `sanitize → validate → repair → degrade` pipeline (Section 4.3 of `ARCHITECTURE.md`) is preserved as `lib/ai/mermaid/`:

| Step | Module | Behavior |
|------|--------|----------|
| Sanitize | `sanitize.ts` | Strip fences, normalize quotes/emoji/bidi, fix foreign directives |
| Validate | `validate.ts` | First-line directive check, bracket balance, per-directive sanity |
| Repair | `repair.ts` | Tiny strict Chat Completions call returning `{ corrected: string }` |
| Degrade | inline in stage projection | nullable → `null`; non-nullable → keep sanitized + inline fallback card in UI |

### Pipeline canary

A Supabase Edge Function `pipeline-canary` runs daily via `pg_cron`, creating a throwaway spec through the full v3 pipeline and recording the result to `automation_runs`. Failures alert the admin via Resend.

---

## 6. Bidirectional Synchronization Engine

The sync engine is the heart of the next-gen system. Any one of **four** mutation vectors — visual canvas, raw markdown editor, natural-language prompt, or external MCP write — can drive the canonical state. The server validates each request, persists the new state under transactional version control, derives every dependent projection through OpenAI Structured Outputs, and broadcasts the result back via Supabase Realtime.

The engine is exposed as **four sibling endpoints** mounted under `app/api/specs/[id]/`:

| Endpoint | Input vector | Direction |
|----------|--------------|-----------|
| `POST /sync`         | New canonical JSON state (graph) | **State → derived** (canvas drives) |
| `POST /sync/text`    | Edited markdown panel content    | **Text → state** (reverse compile) |
| `POST /chat-modify`  | Natural-language instruction     | **Prompt → state delta** |
| `GET  /chat/stream`  | Free-form question (SSE)         | **Read-only RAG** over current spec |

### 6.1 Synchronization policy — explicit, on-demand only

A core product principle: **the system never recompiles spontaneously**. Granular client interactions (dragging a node, typing a property value, editing a markdown paragraph, drafting an instruction in the chat composer) accumulate in **ephemeral client memory only**. No LLM call, no Postgres write, no Realtime fan-out occurs until the user explicitly clicks the dedicated bottom **"Sync"** action button (see §7.3).

**Why on-demand:**

| Reason | Consequence |
|--------|-------------|
| LLM cost | Each `/sync` triggers Chat Completions with Structured Outputs against the full spec context. Throttling at the user action layer caps spend. |
| Latency budget | The user pays for projection time only when intentionally committing changes — not on every drag or keystroke. |
| Determinism | Aggregating deltas into one atomic commit makes `specification_history` rows meaningful (one row = one user intent), and makes undo coherent. |
| Conflict surface | Single batched commit minimizes optimistic-lock collisions when multiple tabs are open. |

**Client-side accumulation contract:** the workspace maintains a `PendingChanges` object (Zustand store, §7.7) tagged with `{ source, dirty: boolean, lastEditedAt }`. Until `dirty` is reduced to `false` by a successful sync response, the bottom Sync button stays in the **"Pending changes — click to compile"** state.

### 6.2 Endpoint A — State-driven sync (graph → derived projections)

The graph vector. The client posts the *complete* aggregated canonical state captured at the moment the bottom Sync button was clicked.

**File:** `app/api/specs/[id]/sync/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { specifications, specificationHistory } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getServerUser } from '@/lib/supabase/server';
import { runSync } from '@/lib/ai/sync-engine';
import { canonicalStateSchema } from '@/lib/ai/schemas/canonical-state';

export const runtime = 'nodejs';

const SyncRequestSchema = z.object({
  newCanonicalState: canonicalStateSchema,
  changeLog: z.string().min(1).max(500),
  source: z.enum(['canvas', 'mcp']),
  expectedVersion: z.number().int().nonnegative(),              // optimistic locking
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: specId } = await ctx.params;
  const body = SyncRequestSchema.parse(await req.json());

  return await db.transaction(async (tx) => {
    const current = await tx.query.specifications.findFirst({
      where: eq(specifications.id, specId),
    });
    if (!current || current.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (current.version !== body.expectedVersion) {
      return NextResponse.json(
        { error: 'Version conflict', currentVersion: current.version },
        { status: 409 },
      );
    }

    // Snapshot previous state for undo.
    await tx.insert(specificationHistory).values({
      specId: current.id,
      version: current.version,
      canonicalStateSnapshot: current.canonicalState,
      changeLog: body.changeLog,
      source: body.source,
    });

    // Project new canonical_state → derived text + scaffolding via OpenAI Structured Outputs.
    const projections = await runSync({
      previous: current.canonicalState,
      next: body.newCanonicalState,
      changeLog: body.changeLog,
    });

    const nextVersion = current.version + 1;
    const [updated] = await tx.update(specifications).set({
      canonicalState: body.newCanonicalState,
      overviewText: projections.overview,
      technicalText: projections.technical,
      architectureText: projections.architecture,
      codeScaffoldingMap: projections.codeScaffolding,
      version: nextVersion,
      updatedAt: sql`now()`,
    }).where(eq(specifications.id, specId)).returning();

    return NextResponse.json({
      version: nextVersion,
      overview: updated.overviewText,
      technical: updated.technicalText,
      architecture: updated.architectureText,
      codeScaffolding: updated.codeScaffoldingMap,
    });
  });
}
```

**`runSync()` — projection contract** (`lib/ai/sync-engine.ts`):

```typescript
import { z } from 'zod';
import { runStage } from './stage-runner';
import type { CanonicalSpecState } from '@/lib/db/schema';

export const SyncOutputSchema = z.object({
  overview:        z.string(),
  technical:       z.string(),
  architecture:    z.string(),
  codeScaffolding: z.object({
    files: z.array(z.object({ path: z.string(), content: z.string() })).max(80),
  }),
});

export type SyncOutput = z.infer<typeof SyncOutputSchema>;

export async function runSync(input: {
  previous: CanonicalSpecState;
  next: CanonicalSpecState;
  changeLog: string;
}): Promise<SyncOutput> {
  return runStage({
    stage: 'sync',
    schema: SyncOutputSchema,
    systemPrompt: `You are the Specifys.ai projection compiler. Given the previous and next canonical state JSON, plus a human change-log, regenerate the four derived projections: overview markdown, technical markdown, architecture markdown (Mermaid blocks where applicable), and a scaffolding file map. Maintain semantic parity with the canonical_state — never invent modules or connections that are not represented in 'next'.`,
    userPrompt: JSON.stringify(input),
  });
}
```

### 6.3 Endpoint B — Text-driven reverse sync (markdown → canonical_state)

The reverse direction. When the user manually edits any of the markdown panels (Overview, Technical, Architecture) and clicks **Sync**, the edited text is shipped upstream. The server invokes a dedicated structured-output schema to **re-derive** the canonical state graph from the prose so the visual canvas stays consistent with the user's text edits.

**Key behavior:**

- The endpoint accepts *only* the markdown payloads (not a new canonical state).
- An OpenAI call with strict JSON Schema returns a fully-formed `canonical_state`.
- The result is fed into the **exact same** `runSync()` pipeline (Endpoint A) so derived text/scaffolding stay coherent. The user's submitted markdown is **not** trusted as the final projection — it is normalized through the compiler.

**File:** `app/api/specs/[id]/sync/text/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { specifications, specificationHistory } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getServerUser } from '@/lib/supabase/server';
import { runStage } from '@/lib/ai/stage-runner';
import { runSync } from '@/lib/ai/sync-engine';
import { canonicalStateSchema } from '@/lib/ai/schemas/canonical-state';

export const runtime = 'nodejs';

const TextSyncRequestSchema = z.object({
  overviewText:     z.string().nullable(),
  technicalText:    z.string().nullable(),
  architectureText: z.string().nullable(),
  changeLog:        z.string().min(1).max(500),
  expectedVersion:  z.number().int().nonnegative(),
});

// Strict reverse-compile schema: prose → typed canonical state.
const TextToStateSchema = z.object({
  canonicalState: canonicalStateSchema,
  diffSummary:    z.string(),                                    // human-readable summary of structural delta
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: specId } = await ctx.params;
  const body = TextSyncRequestSchema.parse(await req.json());

  return await db.transaction(async (tx) => {
    const current = await tx.query.specifications.findFirst({
      where: eq(specifications.id, specId),
    });
    if (!current || current.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (current.version !== body.expectedVersion) {
      return NextResponse.json(
        { error: 'Version conflict', currentVersion: current.version },
        { status: 409 },
      );
    }

    // 1. Reverse-compile: prose → canonical_state via Structured Outputs.
    const compiled = await runStage({
      stage: 'text_to_state',
      schema: TextToStateSchema,
      systemPrompt: `You are the Specifys.ai inverse compiler. Convert edited specification markdown into a strictly-typed canonical_state graph that captures every UI screen, DB table, logic flow, and external service mentioned in the prose, plus their connections. Preserve existing module ids when the text clearly refers to the same concept; introduce new ids only for genuinely new modules.`,
      userPrompt: JSON.stringify({
        previousCanonicalState: current.canonicalState,
        editedOverview: body.overviewText ?? current.overviewText,
        editedTechnical: body.technicalText ?? current.technicalText,
        editedArchitecture: body.architectureText ?? current.architectureText,
      }),
    });

    // 2. Snapshot prior state.
    await tx.insert(specificationHistory).values({
      specId: current.id,
      version: current.version,
      canonicalStateSnapshot: current.canonicalState,
      changeLog: `${body.changeLog} — text-driven (${compiled.diffSummary})`,
      source: 'text',
    });

    // 3. Run the same forward projection so all derived fields are re-normalized.
    const projections = await runSync({
      previous: current.canonicalState,
      next: compiled.canonicalState,
      changeLog: body.changeLog,
    });

    const nextVersion = current.version + 1;
    const [updated] = await tx.update(specifications).set({
      canonicalState: compiled.canonicalState,
      overviewText: projections.overview,
      technicalText: projections.technical,
      architectureText: projections.architecture,
      codeScaffoldingMap: projections.codeScaffolding,
      version: nextVersion,
      updatedAt: sql`now()`,
    }).where(eq(specifications.id, specId)).returning();

    return NextResponse.json({
      version: nextVersion,
      diffSummary: compiled.diffSummary,
      canonicalState: updated.canonicalState,
      overview: updated.overviewText,
      technical: updated.technicalText,
      architecture: updated.architectureText,
      codeScaffolding: updated.codeScaffoldingMap,
    });
  });
}
```

> **DB migration:** add `'text'` to the `specificationHistory.source` enum: `text('source', { enum: ['canvas', 'chat', 'mcp', 'system', 'text'] })`.

### 6.4 Endpoint C — Prompt-driven graph mutation (`chat-modify`)

The natural-language vector. The user types an instruction such as *"Add a Stripe billing screen wired to a new `subscriptions` table"* and presses send in the assistant composer. The endpoint produces a **structured state delta** by feeding the current canonical state and the user instruction into Chat Completions with a strict schema; the result then goes through the same `runSync()` projection pipeline.

This endpoint is also the write surface used by external MCP agents (`source: 'mcp'`).

**File:** `app/api/specs/[id]/chat-modify/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { specifications, specificationHistory } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getServerUser } from '@/lib/supabase/server';
import { runStage } from '@/lib/ai/stage-runner';
import { runSync } from '@/lib/ai/sync-engine';
import { canonicalStateSchema } from '@/lib/ai/schemas/canonical-state';

export const runtime = 'nodejs';

const ChatModifyRequestSchema = z.object({
  prompt: z.string().min(3).max(2000),
  source: z.enum(['chat', 'mcp']).default('chat'),
  expectedVersion: z.number().int().nonnegative(),
});

// Strict prompt-to-state-delta schema.
const PromptToStateSchema = z.object({
  canonicalState: canonicalStateSchema,
  diffSummary:    z.string(),
  appliedChanges: z.array(
    z.object({
      kind: z.enum(['added', 'removed', 'updated', 'connected', 'disconnected']),
      target: z.enum(['module', 'connection']),
      id: z.string(),
      note: z.string(),
    }),
  ),
  reasoning: z.string(),                                         // for chat transcript
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: specId } = await ctx.params;
  const body = ChatModifyRequestSchema.parse(await req.json());

  return await db.transaction(async (tx) => {
    const current = await tx.query.specifications.findFirst({
      where: eq(specifications.id, specId),
    });
    if (!current || current.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (current.version !== body.expectedVersion) {
      return NextResponse.json(
        { error: 'Version conflict', currentVersion: current.version },
        { status: 409 },
      );
    }

    // 1. Resolve the user instruction into a typed canonical_state delta.
    const mutated = await runStage({
      stage: 'chat_modify',
      schema: PromptToStateSchema,
      systemPrompt: `You are the Specifys.ai mutation planner. Given the current canonical_state and a user instruction in natural language, produce a NEW canonical_state that applies the instruction faithfully. Preserve all unrelated modules and connections verbatim. Return a list of appliedChanges describing every structural mutation, and a short reasoning paragraph suitable for chat display.`,
      userPrompt: JSON.stringify({
        currentCanonicalState: current.canonicalState,
        instruction: body.prompt,
      }),
    });

    // 2. Snapshot previous state.
    await tx.insert(specificationHistory).values({
      specId: current.id,
      version: current.version,
      canonicalStateSnapshot: current.canonicalState,
      changeLog: `chat-modify: ${mutated.diffSummary}`,
      source: body.source,
    });

    // 3. Project derived fields through the canonical sync pipeline.
    const projections = await runSync({
      previous: current.canonicalState,
      next: mutated.canonicalState,
      changeLog: mutated.diffSummary,
    });

    const nextVersion = current.version + 1;
    const [updated] = await tx.update(specifications).set({
      canonicalState: mutated.canonicalState,
      overviewText: projections.overview,
      technicalText: projections.technical,
      architectureText: projections.architecture,
      codeScaffoldingMap: projections.codeScaffolding,
      version: nextVersion,
      updatedAt: sql`now()`,
    }).where(eq(specifications.id, specId)).returning();

    return NextResponse.json({
      version: nextVersion,
      reasoning: mutated.reasoning,
      diffSummary: mutated.diffSummary,
      appliedChanges: mutated.appliedChanges,
      canonicalState: updated.canonicalState,
      overview: updated.overviewText,
      technical: updated.technicalText,
      architecture: updated.architectureText,
      codeScaffolding: updated.codeScaffoldingMap,
    });
  });
}
```

### 6.5 Endpoint D — Streamed chat with spec (SSE + RAG)

The **read-only** read-side companion to `chat-modify`. The user asks a question about the existing spec (*"Which screens depend on the auth flow?"*, *"Summarize the data model in one paragraph"*) and receives a streamed answer over **Server-Sent Events**. No state mutation occurs.

This endpoint uses **Chat Completions with `file_search`** against the spec's vector store (managed in `chat_sessions.vector_store_id`). It does **not** use the Assistants API or threads/runs.

**File:** `app/api/specs/[id]/chat/stream/route.ts`

```typescript
import { z } from 'zod';
import { db } from '@/lib/db';
import { specifications, chatSessions, chatMessages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getServerUser } from '@/lib/supabase/server';
import { openai } from '@/lib/ai/client';
import { ensureSpecVectorStore } from '@/lib/ai/vector-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const StreamQuerySchema = z.object({
  q: z.string().min(1).max(2000),
  sessionId: z.string().uuid().optional(),
});

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getServerUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { id: specId } = await ctx.params;
  const url = new URL(req.url);
  const { q, sessionId } = StreamQuerySchema.parse({
    q: url.searchParams.get('q') ?? '',
    sessionId: url.searchParams.get('sessionId') ?? undefined,
  });

  const spec = await db.query.specifications.findFirst({
    where: eq(specifications.id, specId),
  });
  if (!spec || spec.userId !== user.id) {
    return new Response('Not found', { status: 404 });
  }

  // Resolve or create a chat session + OpenAI vector store for this spec.
  const session = await (async () => {
    if (sessionId) {
      const existing = await db.query.chatSessions.findFirst({
        where: eq(chatSessions.id, sessionId),
      });
      if (existing && existing.userId === user.id) return existing;
    }
    const vectorStoreId = await ensureSpecVectorStore(spec);
    const [created] = await db.insert(chatSessions).values({
      specId: spec.id,
      userId: user.id,
      vectorStoreId,
    }).returning();
    return created;
  })();

  // Persist the user turn before streaming so transcript stays consistent.
  await db.insert(chatMessages).values({
    sessionId: session.id,
    role: 'user',
    content: q,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      send('session', { sessionId: session.id });

      let assembled = '';
      try {
        const completion = await openai.chat.completions.create({
          model: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
          stream: true,
          tools: [{ type: 'file_search' }],
          tool_resources: {
            file_search: { vector_store_ids: [session.vectorStoreId!] },
          },
          messages: [
            {
              role: 'system',
              content: `You are Specifys.ai's read-only spec assistant. Answer questions about the user's specification grounded ONLY in the file_search results from the attached vector store. Cite sections by name (Overview / Technical / Architecture). Do not invent modules. If the answer is not in the spec, say so plainly.`,
            },
            { role: 'user', content: q },
          ],
        });

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content ?? '';
          if (delta) {
            assembled += delta;
            send('token', { delta });
          }
        }

        send('done', { length: assembled.length });
      } catch (err) {
        send('error', { message: (err as Error).message });
      } finally {
        // Persist the assistant turn for transcript history.
        if (assembled.length > 0) {
          await db.insert(chatMessages).values({
            sessionId: session.id,
            role: 'assistant',
            content: assembled,
          });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
```

**Vector store maintenance** (`lib/ai/vector-store.ts`) — recreated lazily whenever a successful `/sync`, `/sync/text`, or `/chat-modify` bumps `specifications.version`: the prior vector store is invalidated and rebuilt from the freshly-projected markdown. The cache key is `(specId, version)`.

### 6.6 Realtime broadcast & conflict handling

After **any** of the four endpoints commits, Supabase Realtime emits a `postgres_changes` event on `specifications`. The dashboard's `spec/[id]/page.tsx` subscribes via `supabase.channel(...).on('postgres_changes', ...)` and patches local state on every connected tab without re-fetching.

| Concern | Strategy |
|---------|----------|
| **Optimistic locking** | All four mutation endpoints require `expectedVersion`. Mismatch → `409 Conflict` with the actual current version. |
| **Client recovery on 409** | Refetch spec, replay local pending changes against the new base if structurally compatible, then re-submit. Capped at 3 retries. |
| **Undo** | `POST /api/specs/[id]/undo` reads the previous row from `specification_history` and replays the snapshot through `runSync()` so derived fields are regenerated — never restored from stale text. |
| **Audit** | Every mutation writes one `specification_history` row with `source` tagging the entry point (`canvas` / `text` / `chat` / `mcp` / `system`). |
| **Cost ceiling** | Each endpoint counts as **one** billable structured-output call. Combined with §6.1's manual-trigger policy, this keeps per-user LLM spend deterministic. |

---

## 7. Visual Workspace — React Flow

### 7.1 Workspace layout — three fixed regions

The spec workspace (`app/(dashboard)/spec/[id]/page.tsx`) is composed of three immutable layout regions plus a swappable main area. The chrome never reflows; only the **main area** changes content when the user toggles views.

```
┌──────────────────────────────────────────────────────────────────────┐
│  TopBar  (spec title · breadcrumbs · profile)                        │ ← 56px
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│           ┌──────────────────────────────────────────┐               │
│           │  Center-Top View Switcher (2 toggles)    │               │ ← floats over main
│           │  [ Visual System Graph ] [ Spec Text ]   │               │
│           └──────────────────────────────────────────┘               │
│                                                                      │
│                                                                      │
│                                                                      │
│                       MAIN AREA (swappable)                          │
│                                                                      │
│           one of:                                                    │
│             • <SpecGraph />   — React Flow canvas                    │
│             • <SpecText />    — Markdown editor (Overview /          │
│                                  Technical / Architecture panes)     │
│                                                                      │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  Bottom Action Bar                                                   │ ← 64px, fixed
│  [ Pending: 7 changes · canvas, text ]    [ ▶ Sync (Recompile) ]     │
└──────────────────────────────────────────────────────────────────────┘
```

**File layout:**

| Component | Type | Responsibility |
|-----------|------|----------------|
| `app/(dashboard)/spec/[id]/page.tsx` | RSC | Auth check, initial spec fetch, render `<SpecWorkspace />` |
| `components/workspace/SpecWorkspace.tsx` | Client | Top bar + center-top switcher + main area + bottom sync bar |
| `components/workspace/ViewSwitcher.tsx` | Client | The two-toggle cluster (§7.2) |
| `components/workspace/SyncBar.tsx` | Client | Bottom Sync trigger + pending summary (§7.3) |
| `components/graph/SpecGraph.tsx` | Client | React Flow canvas (§7.4) |
| `components/workspace/SpecText.tsx` | Client | Markdown editor for Overview / Technical / Architecture (§7.5) |
| `components/chat/ChatDrawer.tsx` | Client | Side drawer hosting `/chat-modify` composer + SSE chat stream |
| `lib/state/pendingChanges.ts` | Client | Zustand store — the single accumulator for unsynced deltas (§7.7) |

### 7.2 Center-top view switcher (two-toggle cluster)

A prominent, persistent navigation cluster pinned to the **top-center** of the workspace contains **exactly two** toggle buttons. It lets the user flip the main area between the two canonical workspace surfaces **without any page reload, navigation, or re-fetch** — the toggle is a pure client-side state flip.

| Toggle | Label | Renders | Icon |
|--------|-------|---------|------|
| Left   | **Visual System Graph** | `<SpecGraph />` (React Flow canvas) | `<Network />` |
| Right  | **Spec Text** | `<SpecText />` (Markdown editor) | `<FileText />` |

**Behavior contract:**

- Exactly one toggle is `aria-pressed="true"` at any moment.
- Toggling preserves all unsynced changes — they live in the Zustand `PendingChanges` store (§7.7), not in the unmounted component.
- The toggle is keyboard-navigable (`Tab` + `Enter` / `Space`).
- The cluster floats `position: absolute; top: 12px; left: 50%; transform: translateX(-50%);` over the main area; it never participates in layout reflow.

**Implementation** — `components/workspace/ViewSwitcher.tsx`:

```tsx
'use client';

import { Network, FileText } from 'lucide-react';
import { useWorkspaceView, type WorkspaceView } from '@/lib/state/workspaceView';

const TOGGLES: Array<{ id: WorkspaceView; label: string; Icon: typeof Network }> = [
  { id: 'graph', label: 'Visual System Graph', Icon: Network },
  { id: 'text',  label: 'Spec Text',           Icon: FileText },
];

export function ViewSwitcher() {
  const { view, setView } = useWorkspaceView();

  return (
    <div
      role="tablist"
      aria-label="Workspace view"
      className="absolute top-3 left-1/2 -translate-x-1/2 z-30
                 flex items-center gap-1 rounded-full border border-slate-700
                 bg-slate-900/80 backdrop-blur px-1 py-1 shadow-lg"
    >
      {TOGGLES.map(({ id, label, Icon }) => {
        const active = view === id;
        return (
          <button
            key={id}
            role="tab"
            aria-pressed={active}
            aria-selected={active}
            onClick={() => setView(id)}
            className={[
              'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-emerald-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white',
            ].join(' ')}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

**View store** — `lib/state/workspaceView.ts` (Zustand):

```typescript
import { create } from 'zustand';

export type WorkspaceView = 'graph' | 'text';

interface WorkspaceViewState {
  view: WorkspaceView;
  setView: (v: WorkspaceView) => void;
}

export const useWorkspaceView = create<WorkspaceViewState>((set) => ({
  view: 'graph',
  setView: (view) => set({ view }),
}));
```

### 7.3 Bottom Sync trigger — explicit recompilation gate

The bottom action bar hosts the **single, dedicated `Sync` button** that drives the recompilation pipeline. **No other interaction in the workspace** — neither dragging a node, editing a property field, typing markdown, nor switching the center-top view — issues an API call to the sync engine. Every mutation accumulates in the `PendingChanges` store (§7.7) until the user explicitly commits.

**States of the Sync button:**

| Pending count | Visual state | Disabled? | Tooltip |
|---------------|--------------|-----------|---------|
| 0 | Muted gray | yes | "No changes to sync" |
| ≥ 1 | Emerald primary, pulsing dot | no | "Compile {N} change{s} ({source list})" |
| Syncing | Spinner | yes | "Compiling specification…" |
| Failed | Red outline | no | "Sync failed. Click to retry" |

**Implementation** — `components/workspace/SyncBar.tsx`:

```tsx
'use client';

import { Loader2, AlertTriangle, Sparkles } from 'lucide-react';
import { usePendingChanges } from '@/lib/state/pendingChanges';
import { useSpecSyncer } from '@/lib/hooks/useSpecSyncer';

export function SyncBar({ specId, version }: { specId: string; version: number }) {
  const { count, sources, dirty } = usePendingChanges();
  const { sync, status, lastError } = useSpecSyncer({ specId, version });

  const label = (() => {
    if (status === 'syncing') return 'Compiling…';
    if (status === 'error')   return 'Retry sync';
    if (count === 0)          return 'No changes to sync';
    return `Sync ${count} change${count > 1 ? 's' : ''}`;
  })();

  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4">
        <div className="text-sm text-slate-400">
          {dirty
            ? <>Pending: <span className="font-medium text-slate-200">{count}</span> change{count > 1 ? 's' : ''} · <span className="text-slate-500">{sources.join(', ')}</span></>
            : 'All changes synced'}
          {status === 'error' && lastError && (
            <span className="ml-3 inline-flex items-center gap-1 text-rose-400">
              <AlertTriangle className="h-3.5 w-3.5" /> {lastError}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => sync()}
          disabled={status === 'syncing' || !dirty}
          aria-label={label}
          className={[
            'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition',
            dirty && status !== 'syncing'
              ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-900/40 shadow-lg'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed',
          ].join(' ')}
        >
          {status === 'syncing'
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Sparkles className="h-4 w-4" />}
          <span>{label}</span>
        </button>
      </div>
    </footer>
  );
}
```

**`useSpecSyncer` hook** dispatches to the correct backend endpoint based on the dominant pending source:

| Pending source(s) | Endpoint invoked |
|-------------------|------------------|
| `canvas` only | `POST /api/specs/[id]/sync` (Endpoint A — §6.2) |
| `text` only | `POST /api/specs/[id]/sync/text` (Endpoint B — §6.3) |
| Mixed `canvas` + `text` | `POST /api/specs/[id]/sync` first, then `POST /api/specs/[id]/sync/text` on the freshly returned version (two-phase commit; both run inside the same user click) |
| `chat` instruction submitted from drawer | `POST /api/specs/[id]/chat-modify` (Endpoint C — §6.4) — submitted on send, **not** via the bottom Sync button |

On success the store calls `clearAll()`; on `409 Conflict` the hook refetches and retries up to 3 times before surfacing the error state.

### 7.4 Visual canvas (React Flow)

The canvas is now strictly a **pending-state buffer**. It never reaches out to `/api/specs/[id]/sync` directly — instead it pushes deltas into the `PendingChanges` Zustand store on every meaningful change.

**`components/graph/SpecGraph.tsx`:**

```tsx
'use client';

import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge,
  type Connection, type Edge, type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  UiScreenNode, DbTableNode, LogicFlowNode, ExternalServiceNode,
} from './nodes';
import { PropertyPanel } from './PropertyPanel';
import { usePendingChanges } from '@/lib/state/pendingChanges';
import type { CanonicalSpecState } from '@/lib/db/schema';

const nodeTypes = {
  ui_screen: UiScreenNode,
  db_table: DbTableNode,
  logic_flow: LogicFlowNode,
  external_service: ExternalServiceNode,
};

interface Props {
  specId: string;
  initial: CanonicalSpecState;
}

export function SpecGraph({ specId, initial }: Props) {
  const initialNodes = useMemo<Node[]>(
    () => initial.modules.map((m) => ({
      id: m.id,
      type: m.kind,
      position: m.position,
      data: { name: m.name, description: m.description, properties: m.properties },
    })),
    [initial],
  );
  const initialEdges = useMemo<Edge[]>(
    () => initial.connections.map((c) => ({
      id: c.id, source: c.source, target: c.target, label: c.label, data: { kind: c.kind },
    })),
    [initial],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selected, setSelected] = useStateNode();
  const markCanvasDirty = usePendingChanges((s) => s.markCanvasDirty);
  const stashCanvasSnapshot = usePendingChanges((s) => s.stashCanvasSnapshot);

  // Every meaningful change snapshots the current canvas into the pending store.
  // The store is read by `useSpecSyncer` when the user clicks the bottom Sync button.
  useEffect(() => {
    stashCanvasSnapshot({
      modules: nodes.map((n) => ({
        id: n.id,
        kind: n.type as CanonicalSpecState['modules'][number]['kind'],
        name: n.data.name as string,
        description: n.data.description as string,
        position: n.position,
        properties: n.data.properties as Record<string, unknown>,
      })),
      connections: edges.map((e) => ({
        id: e.id, source: e.source, target: e.target,
        kind: (e.data?.kind as CanonicalSpecState['connections'][number]['kind']) ?? 'data_flow',
        label: e.label as string | undefined,
      })),
      meta: { lastEditedBy: 'user', updatedAt: new Date().toISOString() },
    });
  }, [nodes, edges, stashCanvasSnapshot]);

  const onConnect = useCallback(
    (c: Connection) => {
      setEdges((es) => addEdge({ ...c, data: { kind: 'data_flow' } }, es));
      markCanvasDirty('connect');
    },
    [setEdges, markCanvasDirty],
  );

  return (
    <div className="grid grid-cols-[1fr_320px] h-[calc(100vh-56px-64px)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(c) => { onNodesChange(c); markCanvasDirty('nodes-change'); }}
        onEdgesChange={(c) => { onEdgesChange(c); markCanvasDirty('edges-change'); }}
        onConnect={onConnect}
        onNodeClick={(_, n) => setSelected(n)}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background gap={20} />
        <MiniMap pannable zoomable />
        <Controls />
        {/* No inline save button — recompilation is owned by SyncBar (§7.3). */}
      </ReactFlow>
      <PropertyPanel
        node={selected}
        onChange={(patch) => {
          if (!selected) return;
          setNodes((ns) =>
            ns.map((n) => (n.id === selected.id ? { ...n, data: { ...n.data, ...patch } } : n)),
          );
          markCanvasDirty('property-edit');
        }}
      />
    </div>
  );
}

function useStateNode() {
  const [n, set] = React.useState<Node | null>(null);
  return [n, set] as const;
}
```

### 7.5 Textual specification view (markdown editor)

The text view exposes three independently-edited markdown panes — Overview, Technical, Architecture — backed by `@codemirror/lang-markdown` for syntax highlighting and bracket matching. **Every keystroke** mutates the local pane buffer and stamps the `text` source into the `PendingChanges` store. **No keystroke triggers an API call.**

| UI element | Behavior |
|------------|----------|
| Tab strip (Overview / Technical / Architecture) | Switches active pane; unsynced edits persist across pane switches |
| Diff badge | Shows "modified" badge on a tab when its buffer differs from the server-known projection |
| Inline Mermaid preview | Renders fenced ` ```mermaid ` blocks in a split preview pane |
| Discard button (per pane) | Reverts the pane buffer to the server projection (clears that pane's pending mark) |

**`components/workspace/SpecText.tsx` (abridged):**

```tsx
'use client';

import { useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { usePendingChanges } from '@/lib/state/pendingChanges';

type Pane = 'overview' | 'technical' | 'architecture';

interface Props {
  initialOverview:     string | null;
  initialTechnical:    string | null;
  initialArchitecture: string | null;
}

export function SpecText({ initialOverview, initialTechnical, initialArchitecture }: Props) {
  const [active, setActive] = useState<Pane>('overview');
  const [buffers, setBuffers] = useState({
    overview: initialOverview ?? '',
    technical: initialTechnical ?? '',
    architecture: initialArchitecture ?? '',
  });
  const stashTextSnapshot = usePendingChanges((s) => s.stashTextSnapshot);
  const markTextDirty = usePendingChanges((s) => s.markTextDirty);

  // Buffers flow into the pending store on every keystroke; no network call here.
  useEffect(() => {
    stashTextSnapshot({
      overviewText:     buffers.overview     !== (initialOverview     ?? '') ? buffers.overview     : null,
      technicalText:    buffers.technical    !== (initialTechnical    ?? '') ? buffers.technical    : null,
      architectureText: buffers.architecture !== (initialArchitecture ?? '') ? buffers.architecture : null,
    });
  }, [buffers, initialOverview, initialTechnical, initialArchitecture, stashTextSnapshot]);

  return (
    <div className="flex h-[calc(100vh-56px-64px)] flex-col">
      <nav role="tablist" className="flex gap-1 border-b border-slate-800 px-4 pt-3">
        {(['overview', 'technical', 'architecture'] as const).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={active === p}
            onClick={() => setActive(p)}
            className={[
              'rounded-t-md px-3 py-1.5 text-sm capitalize',
              active === p ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-white',
            ].join(' ')}
          >
            {p}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={buffers[active]}
          extensions={[markdown()]}
          theme="dark"
          onChange={(value) => {
            setBuffers((b) => ({ ...b, [active]: value }));
            markTextDirty(active);
          }}
        />
      </div>
    </div>
  );
}
```

When the user clicks the bottom **Sync** button, `useSpecSyncer` (§7.3) routes the accumulated text deltas to `POST /api/specs/[id]/sync/text` (§6.3), which reverse-compiles the prose into a new `canonical_state` and re-projects everything atomically.

### 7.6 Node kinds & edges

| Node kind | Renders | Property panel | Allowed inbound edges | Allowed outbound edges |
|-----------|---------|----------------|------------------------|-------------------------|
| `ui_screen` | Phone/screen frame with title + bullet list | Screen name, layout type, primary action, theme tokens | `navigation`, `data_flow` | `navigation`, `data_flow` |
| `db_table` | Table header + field rows | Field list (name, type, PK?, FK?), indexes | `fk`, `data_flow` | `fk`, `data_flow` |
| `logic_flow` | Decision-diamond / step block | Trigger, steps, expected output | `dependency`, `data_flow` | `data_flow`, `dependency` |
| `external_service` | Icon + provider name | Provider, auth model, env vars | `dependency` | `data_flow` |

Edge validation is enforced **both** client-side (instant feedback when a connection is attempted) and server-side inside the `canonicalStateSchema` Zod refinement.

### 7.7 Pending-changes buffer (Zustand)

The single source of truth for **unsynced** state. The store deliberately contains no business logic — it is a typed accumulator.

```typescript
// lib/state/pendingChanges.ts
import { create } from 'zustand';
import type { CanonicalSpecState } from '@/lib/db/schema';

type CanvasSnapshot = CanonicalSpecState | null;
type TextSnapshot = {
  overviewText:     string | null;
  technicalText:    string | null;
  architectureText: string | null;
} | null;

interface PendingChangesState {
  canvas: CanvasSnapshot;
  text:   TextSnapshot;
  canvasDirtyEvents: number;
  textDirtyEvents:   number;
  sources: Array<'canvas' | 'text'>;

  stashCanvasSnapshot: (s: CanonicalSpecState) => void;
  stashTextSnapshot:   (s: NonNullable<TextSnapshot>) => void;
  markCanvasDirty: (reason: string) => void;
  markTextDirty:   (pane: 'overview' | 'technical' | 'architecture') => void;
  clearAll: () => void;

  // Derived helpers (read-only).
  count: number;
  dirty: boolean;
}

export const usePendingChanges = create<PendingChangesState>((set, get) => ({
  canvas: null,
  text: null,
  canvasDirtyEvents: 0,
  textDirtyEvents: 0,
  sources: [],

  stashCanvasSnapshot: (canvas) => set({ canvas }),
  stashTextSnapshot:   (text)   => set({ text }),

  markCanvasDirty: () => set((s) => ({
    canvasDirtyEvents: s.canvasDirtyEvents + 1,
    sources: s.sources.includes('canvas') ? s.sources : [...s.sources, 'canvas'],
  })),
  markTextDirty: () => set((s) => ({
    textDirtyEvents: s.textDirtyEvents + 1,
    sources: s.sources.includes('text') ? s.sources : [...s.sources, 'text'],
  })),

  clearAll: () => set({
    canvas: null, text: null,
    canvasDirtyEvents: 0, textDirtyEvents: 0,
    sources: [],
  }),

  get count() {
    const s = get();
    return s.canvasDirtyEvents + s.textDirtyEvents;
  },
  get dirty() {
    const s = get();
    return s.canvasDirtyEvents > 0 || s.textDirtyEvents > 0;
  },
}));
```

**Why Zustand and not React Server Components state:** persisted spec data lives in Postgres + RSC fetches; pending UI state is **strictly ephemeral**, must survive view toggles (§7.2) and route-stable mounts/unmounts, and must be readable from both the bottom `SyncBar` and the active main-area component. Zustand is the smallest viable shared-store primitive for that. The store is **never** serialized to the server or persisted to localStorage — a tab reload deliberately discards unsynced edits.

---

## 8. Authentication, Users & Credits

### Supabase Auth flow

1. User clicks "Sign in with Google" → Supabase OAuth → callback at `/auth/callback`.
2. Callback handler upserts a row in `public.users` (mirroring `auth.users.id`) — uses a Postgres trigger so it stays in sync.
3. Welcome flow runs once: insert `+1` row into `credits_ledger` (`kind: 'grant_welcome'`, `bucket: 'free'`, idempotency key `welcome_{userId}`), and call Resend to send the welcome email + add to audience.

### Server-side session helper

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function getServerUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
```

### Credits — event-sourced

| Concept | Detail |
|---------|--------|
| **Ledger** | `credits_ledger` is append-only. Every change is a row. |
| **Buckets** | `paid`, `free`, `bonus` — consumed in order `free → bonus → paid` |
| **Pro override** | If user has an active subscription (`subscriptions.status IN ('active','on_trial','past_due','paid')` AND `current_period_end > now()`), consume writes a ledger row with `amount: 0` and `metadata.unlimited = true` |
| **Idempotency** | `idempotency_key = consume_${specId}_${userId}` for consume; `purchase_${lemonOrderId}` for grants |
| **Balance view** | `user_credit_balances` materialized view, refreshed by `AFTER INSERT` trigger on `credits_ledger` |
| **Expiry** | Subscription expiry triggers `kind: 'expire'` row that zeroes leftover `paid` and re-credits as `paid` on renewal |

### Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `GET`  | `/api/credits` | Session | `{ paid, free, bonus, total, pro: { active, expiresAt } }` |
| `POST` | `/api/credits/consume` | Session | `{ specId }` → returns new balance, idempotent |
| `GET`  | `/api/credits/ledger` | Session | Paginated history |
| `POST` | `/api/admin/credits/grant` | Admin | `{ userId, amount, bucket, reason }` |

---

## 9. Payments — Lemon Squeezy

The Lemon Squeezy integration is the **one place** that grants paid credits or toggles Pro state. Same products as today (`single_spec`, `three_pack`, `pro_monthly`, `pro_yearly`).

### Webhook handler — `app/api/lemon/webhook/route.ts`

Raw body required for HMAC; Next.js App Router supports it directly:

```typescript
export const runtime = 'nodejs';                                // not edge — needs crypto + DB
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get('x-signature') ?? '';
  if (!verifyHmacSha256(raw, signature, process.env.LEMON_WEBHOOK_SECRET!)) {
    return new Response('Bad signature', { status: 401 });
  }

  const event = JSON.parse(raw);
  const eventId = event.meta.event_id as string;

  // Idempotent: skip if already processed.
  const exists = await db.query.processedWebhookEvents.findFirst({
    where: eq(processedWebhookEvents.eventId, eventId),
  });
  if (exists) return Response.json({ ok: true, skipped: true });

  await db.transaction(async (tx) => {
    await tx.insert(processedWebhookEvents).values({ eventId });
    await dispatchLemonEvent(tx, event);                        // grant credits / upsert subscription
  });

  return Response.json({ ok: true });
}
```

### Event dispatch table

| Lemon event | Action |
|-------------|--------|
| `order_created` (one-time product) | Insert `purchases` row; insert `credits_ledger` row (`kind: 'grant_purchase'`, `bucket: 'paid'`, idempotency `purchase_${orderId}`) |
| `order_created` (subscription product) | Insert `purchases` row; upsert `subscriptions` (active); set `users.plan = 'pro'` |
| `subscription_updated/payment_success` | Update `subscriptions.status`, `current_period_end` |
| `subscription_cancelled/expired` | Mark subscription inactive; if `current_period_end < now()` set `users.plan = 'free'` |

### Sensitive env

| Variable | Used by |
|----------|---------|
| `LEMON_SQUEEZY_API_KEY` | Checkout creation, subscription cancel |
| `LEMON_WEBHOOK_SECRET` | HMAC verification |
| `LEMON_SQUEEZY_STORE_ID` | Checkout |

---

## 10. Code Scaffolding & Export

The sync engine derives `code_scaffolding_map` on every spec change. Users export it as a ZIP that boots into a working Next.js + Drizzle + Supabase starter pre-wired to their spec's modules.

### Export endpoint — `app/api/specs/[id]/export/route.ts`

```typescript
import archiver from 'archiver';
import { Readable } from 'node:stream';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getServerUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { id } = await ctx.params;
  const spec = await db.query.specifications.findFirst({ where: eq(specifications.id, id) });
  if (!spec || spec.userId !== user.id) return new Response('Not found', { status: 404 });
  if (!spec.codeScaffoldingMap) return new Response('Scaffolding not ready', { status: 425 });

  const zip = archiver('zip', { zlib: { level: 9 } });

  zip.append(JSON.stringify({
    name: spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    version: '0.1.0',
    private: true,
    scripts: { dev: 'next dev', build: 'next build', 'db:migrate': 'drizzle-kit migrate' },
    dependencies: {
      next: '15.x', react: '19.x', 'drizzle-orm': '^0.30.0',
      '@supabase/ssr': '^0.5.0', '@supabase/supabase-js': '^2.45.0',
    },
  }, null, 2), { name: 'package.json' });

  zip.append(
    [
      '# Generated by Specifys.ai',
      'NEXT_PUBLIC_SUPABASE_URL=',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY=',
      'SUPABASE_SERVICE_ROLE_KEY=',
      'OPENAI_API_KEY=',
    ].join('\n'),
    { name: '.env.example' },
  );

  // AI-generated files (validated paths to prevent traversal).
  for (const f of spec.codeScaffoldingMap.files) {
    if (f.path.includes('..') || f.path.startsWith('/')) continue;
    zip.append(f.content, { name: f.path });
  }

  zip.finalize();

  return new Response(Readable.toWeb(zip as unknown as Readable) as ReadableStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${spec.title}-${spec.id}.zip"`,
    },
  });
}
```

### What's inside a generated ZIP

1. `package.json`, `tsconfig.json`, `next.config.ts`, `.env.example`, `README.md`.
2. `lib/db/schema.ts` — Drizzle schema reflecting the user's `db_table` nodes.
3. `app/(public)/page.tsx` + one file per `ui_screen` module.
4. `app/api/.../route.ts` per `logic_flow` module.
5. `supabase/migrations/*.sql` — initial DDL.
6. `prompts/*.md` — every entry from `prompts_bundle` (Cursor/Windsurf-friendly).

---

## 11. MCP Server Integration

The MCP server is **inside Next.js** (`app/api/mcp/route.ts`) — no separate Node binary. The legacy `mcp-server/` stdio shim is still published to npm so users can `npx specifys-mcp-server` from Cursor/Claude Desktop, but it just forwards JSON-RPC to the HTTPS endpoint.

### Auth model

| Layer | Auth |
|-------|------|
| HTTPS endpoint | `X-API-Key` header → `sha256(key) == users.mcp_api_key_hash` |
| Key management | Web UI at `/(dashboard)/settings/mcp-key` → `POST` returns key once, server stores only hash |
| Rate limit | Vercel + Supabase Edge Function rate limiter per user (60 req/min) |
| Logging | Every call → `mcp_requests` row (method, tool, status, duration) |

### Tools registered

| Tool | Backing query |
|------|---------------|
| `list_my_specs` | `SELECT id, title, updated_at FROM specifications WHERE user_id = ?` |
| `get_spec` | Full row by id |
| `get_spec_section` | Returns one of: overview / technical / market / design / architecture / visibility / prompts |
| `update_spec_canonical_state` | Calls the same sync engine as the canvas (`source: 'mcp'`) — writes are first-class |
| `get_active_spec_context` | Compact text blob for context injection (used by external agents) |
| `list_prompt_templates` | Static prompt seeds |
| `list_tools` | Vibe Coding Tools Map (`tools` table) |

### Endpoint sketch — `app/api/mcp/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateMcpKey } from '@/lib/mcp/auth';
import { dispatch } from '@/lib/mcp/handler';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const user = await authenticateMcpKey(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const packet = await req.json();                              // JSON-RPC 2.0
  const result = await dispatch(packet, { user, db });
  return NextResponse.json(result);
}
```

`dispatch()` handles both `tools/list` (advertisement) and `tools/call` (execution). Each tool is a separate file in `lib/mcp/tools/`, returning the MCP `content[]` envelope.

---

## 12. Public Site — SEO & GEO

### Routing

| Path pattern | Render mode | Notes |
|--------------|-------------|-------|
| `/` (homepage) | RSC (static) | Single prompt input → `POST /api/specs` → redirect |
| `/blog` | ISR (`revalidate: 86400`) | Index from `articles` table |
| `/blog/[slug]` | ISR (`revalidate: 3600`) + `generateStaticParams` | Article content |
| `/glossary/[term]` | ISR | Term definitions |
| `/compare/[a]-vs-[b]` | ISR | Generated comparison pages |
| `/for-ai-assistants` | Static | Plain HTML hub for LLM crawlers |
| `/pricing` | Static | RSC, Lemon checkout links |
| `/sitemap.xml` | `app/sitemap.ts` | Dynamic from DB |
| `/robots.txt` | `app/robots.ts` | Same AI bot allowlist as today |
| `/llms.txt` | `app/llms.txt/route.ts` | Generated from `articles` + glossary |
| `/ai.txt` | static | Pointers to `llms.txt` + `for-ai-assistants` |

### ISR index page — example

```typescript
// app/(public)/blog/page.tsx
import { db } from '@/lib/db';
import { articles } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';

export const revalidate = 86400;

export default async function BlogIndex() {
  const posts = await db.query.articles.findMany({
    where: eq(articles.status, 'published'),
    orderBy: [desc(articles.publishedAt)],
    limit: 50,
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Vibe coding & AI dev tools</h1>
      <ul className="mt-8 space-y-6">
        {posts.map((p) => (
          <li key={p.id}>
            <Link href={`/blog/${p.slug}`} className="text-blue-600 hover:underline">
              <h2 className="text-xl font-semibold">{p.title}</h2>
            </Link>
            <p className="text-sm text-slate-600">{p.teaser90}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

### JSON-LD coverage

`components/seo/` ships server components that emit `<script type="application/ld+json">` blocks:

| Surface | Schema.org types |
|---------|------------------|
| Site-wide | `Organization`, `WebSite` |
| Homepage / how / pricing | `SoftwareApplication`, `FAQPage`, `Product` |
| `/blog/[slug]` | `Article` + `Person` author + `BreadcrumbList` |
| `/compare/...` | `FAQPage` + comparison table markup |
| `/(dashboard)/spec/[id]` (private) | `WebApplication` (light, since not crawled) |

### The "Golden Sync Triad"

Every content publish (manual or automation) updates **three indexes together** in a single transaction:

1. **`sitemap.xml`** — `app/sitemap.ts` reads from `articles` + static page list; cache busted via `revalidatePath('/')`.
2. **`llms.txt`** — `app/llms.txt/route.ts` generator includes new entry with summary.
3. **Footer cross-links** — shared layout component reads the same `articles` table for "Recent guides" block.

Optional: ping IndexNow via `INDEXNOW_KEY` after each publish.

---

## 13. Admin, Analytics & Content Automation

### Admin SPA

Lives under `app/(admin)/` with an email-allowlist layout guard. Views:

| Route | View |
|-------|------|
| `/admin` | Overview cards (DAU, new specs, Pro conversions, contact queue, canary health) |
| `/admin/users` | List, drill-down, grant credits, view ledger |
| `/admin/specs` | All specs, filter by status / generation_version, retry stage |
| `/admin/payments` | Reinstated — full Lemon Squeezy view, refund actions |
| `/admin/page-views` | Filters: by-page, by-referrer, by-country |
| `/admin/content` | Articles, Tools, Academy guides (CRUD) |
| `/admin/email` | Resend audience sync, draft assistant (3 modes), newsletters |
| `/admin/logs` | `automation_runs`, server errors, MCP requests |
| `/admin/brand` | Brand kit downloads |

### Analytics

Two collections (`page_views`, `analytics_events`) + Supabase `pg_cron` jobs that roll up hourly into `analytics_daily` (materialized view) for the dashboard.

### Content automation (Supabase Edge Functions, scheduled by `pg_cron`)

| Job | Frequency | Function | Behavior |
|-----|-----------|----------|----------|
| `article-writer` | Daily 09:00 UTC | `supabase/functions/article-writer` | OpenAI `gpt-4o-mini-search-preview` → insert `articles` row (`status: 'published'`) → `revalidatePath('/blog')` |
| `tools-finder` | Weekly Mon 06:00 | `supabase/functions/tools-finder` | Refresh `tools` table |
| `credits-sync` | Daily 02:00 | `supabase/functions/credits-sync` | Reconcile `subscriptions` with Lemon Squeezy API |
| `pipeline-canary` | Daily 03:00 | `supabase/functions/pipeline-canary` | Generate throwaway spec end-to-end; alert on failure |
| `payments-cache` | 24h | `supabase/functions/payments-cache` | Cache Lemon payments for admin view |
| `inactive-user-email` | Daily | `supabase/functions/inactive-user-email` | 30/60/90-day reminders via Resend |

Every run writes to `automation_runs` for observability.

### Email (Resend)

Same triggers as today:

| Event | Resend template |
|-------|-----------------|
| User created | Welcome |
| First spec ready | Spec ready |
| Subsequent spec ready | Spec ready (subsequent) |
| Purchase confirmed | Purchase confirmation |
| Subscription cancelled | Pro cancelled |
| Inactivity (30 / 60 / 90d) | Re-engagement |
| Weekly digest (admin) | Stats summary |
| Feedback submission | Feedback to ops |

Admin email-draft assistant (`POST /api/admin/email/draft`) preserved — three modes (`product` / `marketing` / `general`) emit dark-card HTML.

---

## 14. Infrastructure & Deployment

### Topology

```
                       ┌──────────────────────────────┐
   specifys-ai.com ──▶ │ Vercel (Edge Network + CDN)  │
                       │   • RSC / ISR pages          │
                       │   • Route handlers (Node 20) │
                       └────────────┬─────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
    ┌──────────────┐    ┌──────────────────────┐    ┌────────────────┐
    │ Supabase     │    │ OpenAI API           │    │ Lemon Squeezy  │
    │ • Postgres   │    │ • Chat Completions   │    │ • Checkout     │
    │ • Auth       │    │ • Whisper            │    │ • Webhooks     │
    │ • Storage    │    └──────────────────────┘    └────────────────┘
    │ • Realtime   │
    │ • Edge Fns   │
    │ • pg_cron    │
    └──────────────┘
            │
            ▼
    ┌──────────────┐
    │ Resend       │  (transactional email + audiences)
    └──────────────┘
```

### Environments

| Env | Vercel project | Supabase project | Domain |
|-----|----------------|------------------|--------|
| `production` | `specifys-nextgen-prod` | `prod` | `app.specifys-ai.com` (initially) → `specifys-ai.com` (cutover) |
| `preview` | per-PR auto | `staging` | `*.vercel.app` |
| `development` | local | local Supabase | `localhost:3000` |

### Required environment variables

| Variable | Surface |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + server |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only — for Edge Functions and admin tasks |
| `DATABASE_URL` | Drizzle migrations + server queries |
| `OPENAI_API_KEY` | Server |
| `OPENAI_SPEC_MODEL` | Default `gpt-4o-mini`; override per env |
| `LEMON_SQUEEZY_API_KEY` | Server |
| `LEMON_WEBHOOK_SECRET` | Server |
| `LEMON_SQUEEZY_STORE_ID` | Server |
| `RESEND_API_KEY` | Server |
| `RESEND_AUDIENCE_ID` | Server |
| `MCP_RATE_LIMIT_PER_MINUTE` | Server (default 60) |
| `INDEXNOW_KEY` | Server (optional) |
| `ADMIN_EMAILS` | Server (comma-separated) |

### CI/CD (`/.github/workflows/`)

| Workflow | Triggers | Steps |
|----------|----------|-------|
| `ci.yml` | All PRs | `pnpm typecheck`, `pnpm lint`, `pnpm test`, Drizzle migration dry-run |
| `e2e.yml` | PRs to `main` | Playwright against Vercel preview URL |
| `migrate.yml` | Manual / merge to `main` | `drizzle-kit migrate` against prod Supabase |
| `seed-content.yml` | Manual | Backfill `articles`/`tools` for new envs |

Vercel handles deploys automatically on push to `main`.

---

## 15. Parallel Operation with Legacy System

Next-Gen ships **alongside** the existing Jekyll + Render stack. There is no shared runtime, no shared database, no shared codebase. The two systems coexist behind one brand until cutover.

### Coexistence plan

| Concern | Strategy |
|---------|----------|
| **Hostnames** | Legacy: `specifys-ai.com`. Next-Gen: `app.specifys-ai.com` during beta. Cutover swaps DNS at the apex once parity is reached. |
| **Auth** | No SSO between systems. Users wishing to use Next-Gen sign up fresh (one welcome credit grant). Migration tool (admin-only) copies opted-in users into Supabase. |
| **Specs** | Not migrated. Legacy users keep reading old specs on the old domain; new specs created in Next-Gen. Optional CSV export from Firestore for power users. |
| **Payments** | Single Lemon Squeezy store. Webhook for next-gen registered at `https://app.specifys-ai.com/api/lemon/webhook`. **Add a `system: 'next-gen'` field to checkout `custom_data`** so a legacy webhook misroute is detected and ignored. |
| **MCP** | npm package `specifys-mcp-server` gets a `--target=legacy|next-gen` flag (or two distinct keys) so existing MCP users aren't broken. |
| **Content / SEO** | Articles automation writes to **both** systems during the parallel period (a thin adapter posts to legacy `articles` API + new `articles` table). After cutover, legacy is read-only and frozen. |
| **Analytics** | Both systems write to their own stores. Admin dashboards live separately. After cutover, legacy data exported once into Supabase for historical reporting. |
| **Domain & CDN** | Each system owns its origin. A small Cloudflare/Vercel rewrite at `specifys-ai.com/app/*` can later proxy to Next-Gen for trial periods. |

### Cutover checklist (executed only once parity is verified)

1. Freeze writes on legacy (`/api/specs` returns 410 with a "moved" payload).
2. Optional one-shot export script (Firestore → Postgres) for users who opt in.
3. DNS: `specifys-ai.com` apex points at Vercel; `legacy.specifys-ai.com` kept up for one quarter.
4. Resend audience: merge legacy audience into Next-Gen audience (idempotent — email is the key).
5. Lemon Squeezy: switch webhook URL; rotate `LEMON_WEBHOOK_SECRET`.
6. Update marketing copy, social profiles, `llms.txt`, JSON-LD `Organization.sameAs`.

---

## 16. Implementation Roadmap

### Phase 0 — Foundations (Week 1–2)
- [ ] Vercel + Supabase projects (prod / staging)
- [ ] `pnpm create next-app` scaffold + Drizzle + Supabase clients
- [ ] Auth (Supabase) with Google OAuth + email; users + RLS policies
- [ ] `app/(public)/page.tsx` shell, design tokens, shadcn install
- [ ] CI: typecheck + lint + Drizzle dry-run

### Phase 1 — Spec engine v3 (Week 3–5)
- [ ] Drizzle schema for `specifications`, `specification_history`, enums
- [ ] Zod stage schemas (overview → prompts) + `runStage` helper
- [ ] `POST /api/specs` create + `POST /api/specs/[id]/generate` per stage
- [ ] Mermaid sanitize / validate / repair pipeline
- [ ] Pipeline canary Edge Function + admin alert

### Phase 2 — Visual workspace (Week 6–8)
- [ ] React Flow integration; four node kinds + edge validators
- [ ] Property panel with type-safe forms
- [ ] `POST /api/specs/[id]/sync` with optimistic locking + history snapshot
- [ ] Realtime broadcast → multi-tab sync
- [ ] Undo via `specification_history` replay

### Phase 3 — Monetization (Week 9)
- [ ] Credits ledger + materialized balance view + RLS
- [ ] Lemon Squeezy checkout + webhook + idempotency
- [ ] Pricing page with live entitlement state
- [ ] Resend welcome + spec-ready emails

### Phase 4 — MCP & exports (Week 10)
- [ ] `/api/mcp` JSON-RPC handler + per-user key (hashed)
- [ ] All MCP tools (read + write) + rate limit
- [ ] Update `specifys-mcp-server` npm package to dual-target
- [ ] ZIP code export endpoint + scaffolding templates

### Phase 5 — Public surfaces & GEO (Week 11–12)
- [ ] `/blog` ISR + article generator Edge Function (daily)
- [ ] `sitemap.ts`, `robots.ts`, `llms.txt` route, `ai.txt` static
- [ ] JSON-LD components on every public route
- [ ] `/for-ai-assistants` static hub + glossary + compare pages

### Phase 6 — Admin (Week 13)
- [ ] `(admin)` views: users, specs, payments, content, page views, logs
- [ ] Email draft assistant (3 modes) + Resend audience sync
- [ ] Brand kit page

### Phase 7 — Parallel beta (Week 14)
- [ ] Deploy to `app.specifys-ai.com`
- [ ] Closed-beta invite list (10–20 users) — opt-in migration
- [ ] Monitor canary, error rates, p95 latencies, AI cost per spec
- [ ] Document parity gaps; fix or accept consciously

### Phase 8 — Cutover (Week 15+)
- [ ] Final parity review; sign-off
- [ ] Execute cutover checklist (Section 15)
- [ ] Decommission legacy automation jobs; freeze legacy writes
- [ ] Archive `docs/architecture/ARCHITECTURE.md` as historical reference; promote this document to the canonical architecture

---

*This document is the working blueprint. Sections will be promoted into `ARCHITECTURE.md` once each phase ships and stabilizes. Until then, the production system continues to be described by [ARCHITECTURE.md](./ARCHITECTURE.md).*
