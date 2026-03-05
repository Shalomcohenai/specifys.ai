# Spec System Architecture – Full Reference

This document describes the complete architecture of the specification generation system in Specifys.ai (Spec Engine v2). It is intended for external readers who need to understand flows, components, APIs, data structures, and integration points end-to-end.

**Last updated:** March 2026 (post-v2 rebuild).

---

## Table of Contents

1. [Overview](#1-overview)
2. [Core Backend Components](#2-core-backend-components)
3. [Zod Schemas and Structured Outputs](#3-zod-schemas-and-structured-outputs)
4. [Specs API Reference](#4-specs-api-reference)
5. [Event System (spec-events)](#5-event-system-spec-events)
6. [Queue (spec-queue)](#6-queue-spec-queue)
7. [Firestore: specs Collection](#7-firestore-specs-collection)
8. [End-to-End Flows](#8-end-to-end-flows)
9. [Frontend: Spec Viewer](#9-frontend-spec-viewer)
10. [Workers (Non-Spec Generation)](#10-workers-non-spec-generation)
11. [Error Handling and Codes](#11-error-handling-and-codes)
12. [File and Code Reference](#12-file-and-code-reference)

---

## 1. Overview

The spec system generates application specifications in five stages:

1. **Overview** – Generated from user input (single prompt or planning data).
2. **Technical** – Generated after overview approval; covers tech stack, DB schema, API endpoints, security, devops, analytics, and data models.
3. **Market** – Industry overview, target audience, competition, SWOT, monetization, marketing strategy.
4. **Design** – Visual style guide, logo/iconography, UI layout, UX principles.
5. **Architecture** – Structured JSON (core functionality, third-party integrations, web performance, Mermaid diagrams) serialized to Markdown for storage and display.

### Key architectural decisions (v2)

| Aspect | v1 (Legacy) | v2 (Current) |
|--------|-------------|--------------|
| LLM API | Stateless Chat Completions via Cloudflare Worker | **OpenAI Assistants API v2** (direct from backend) |
| Model | gpt-4o-mini via Worker | **gpt-5-mini** (with fallback chain) |
| Output contract | Heuristic validators + repair prompts | **Structured Outputs** (`json_schema`, `strict: true`) via Zod |
| Context | String concatenation + truncation | **Persistent Threads** (`thread_id` in Firestore) |
| Validation | Manual JSON normalization | **Zod** schemas → `zod-to-json-schema` → OpenAI `response_format` |
| Worker role | Core spec generation | **Not used** for spec generation (still used for prompts, mockups, diagrams) |
| Architecture output | Raw Markdown (unstructured) | **Structured JSON** (ArchitectureSchema) → serialized to Markdown |

---

## 2. Core Backend Components

### 2.1 SpecGenerationServiceV2

**File:** `backend/server/spec-generation-service-v2.js`

Replaces the legacy `spec-generation-service.js`. All stages use OpenAI Assistants API with persistent threads and Zod-validated structured outputs.

**Public methods:**

| Method | Purpose | Inputs | Output |
|--------|---------|--------|--------|
| `generateOverview(specId, userInput)` | Generate overview JSON | `specId`, `userInput` | `Promise<string>` – JSON string of overview object |
| `generateSection(specId, stage, overview, answers)` | Generate one section (technical/market/design) | `specId`, `stage`, `overview`, `answers` | `Promise<string>` – JSON string; emits `spec.update` / `spec.error` |
| `generateAllSpecs(specId, overview, answers)` | Run technical → market → design → architecture sequentially | `specId`, `overview`, `answers` | `Promise<Object>` – `{ technical, market, design, architecture, successes[], errors[] }` |
| `generateArchitecture(specId, overview, technical, market, design)` | Generate architecture (structured → Markdown) | All four content strings | `Promise<string>` – Markdown string |

**Internal methods:**

| Method | Purpose |
|--------|---------|
| `_getThreadManager()` | Lazy-initialize SpecThreadManager singleton |
| `_buildTechnicalPrompt(...)` | Build technical stage prompt with overview context |
| `_buildMarketPrompt(...)` | Build market stage prompt (includes current date) |
| `_buildDesignPrompt(...)` | Build design stage prompt |
| `_buildArchitecturePrompt(...)` | Build opinionated, Mermaid-strict architecture prompt |
| `_architecturePayloadToMarkdown(payload)` | Convert validated ArchitectureSchema object to Markdown with Mermaid blocks |

**Architecture prompt design:**
- Explicitly states gpt-5-mini and requires specific, non-generic technical advice.
- References the Technical stage for integration names and tech stack.
- Requires `thirdPartyIntegrations[].id` slugs to match `integrationExternalApis.thirdPartyServices`.
- Mermaid rules: v10 syntax, no markdown wrappers in diagram strings, no illegal characters in labels, sequence diagrams for third-party flows.

**Events emitted (via specEvents):**
- `emitSpecUpdate(specId, stage, status, content)` with status `'generating'` or `'ready'`.
- `emitSpecError(specId, stage, error)` on failure.
- `emitSpecComplete(specId, processed)` when `generateAllSpecs` finishes.

---

### 2.2 SpecThreadManager

**File:** `backend/server/spec-thread-manager.js`

Manages one OpenAI thread per spec. Threads are reused across all five stages (overview → technical → market → design → architecture) so each stage has full conversation context.

**Model fallback chain** (used when creating assistants if no env var is set):

```
gpt-5.2 → gpt-5-mini → gpt-5-nano → gpt-5 → gpt-4o-mini → gpt-4o → gpt-4-turbo → gpt-4 → gpt-3.5-turbo
```

The first model that succeeds is used. Can be overridden with `OPENAI_SPEC_GENERATOR_ASSISTANT_ID` env var.

**Methods:**

| Method | Purpose |
|--------|---------|
| `getOrCreateThread(specId)` | Read `thread_id` from Firestore; if missing, create a new OpenAI thread and store it. Retries up to 3 times with exponential backoff (800ms, 1600ms) if the spec doc isn't committed yet. |
| `getGeneratorAssistantId()` | Return `OPENAI_SPEC_GENERATOR_ASSISTANT_ID` from env, or create a new assistant with the model fallback chain. |
| `getArchitectureAssistantId()` | Return `OPENAI_SPEC_ARCHITECTURE_ASSISTANT_ID` from env, or create. (Legacy — architecture now uses the generator assistant via `runStage`.) |
| `runStage(threadId, stage, userMessage)` | Build `response_format` via `buildResponseFormat(stage)`, call `openaiStorage.runSpecGeneration(...)`, parse JSON, validate with `parseAndValidateStage(stage, raw)`. Works for all 5 stages including architecture. |

**Error handling:**
- On Firestore NOT_FOUND during `thread_id` write: logs WARN and returns `threadId` (generation continues; subsequent writes fail gracefully in routes).
- On OpenAI run failure: logs the exact `sentSchema` JSON for debugging.
- On JSON parse failure: logs raw response excerpt.
- On Zod validation failure: logs received keys vs expected schema.

---

### 2.3 SpecQueue

**File:** `backend/server/spec-queue.js`

In-memory, single-concurrency queue for background spec generation.

| Method | Purpose |
|--------|---------|
| `add(specId, overview, answers)` | Enqueue a job; starts processing if idle |
| `processJob(job)` | Calls `specGenerationServiceV2.generateAllSpecs(specId, overview, answers)` |
| `getJob(specId)` | Get job by spec ID |
| `getStatus()` | Queue metrics: `{ queueLength, processing, activeJobs, totalJobs }` |

Jobs for the same `specId` are replaced if finished (failed/completed). Jobs are removed from the Map 5 minutes after completion.

---

### 2.4 SpecEvents

**File:** `backend/server/spec-events.js`

EventEmitter for spec generation progress. Decouples generation service from Firestore persistence.

| Event | When | Payload |
|-------|------|---------|
| `spec.update` | Stage status change (generating/ready) | `{ specId, stage, status, content, timestamp }` |
| `spec.complete` | `generateAllSpecs` finished | `{ specId, results, timestamp }` |
| `spec.error` | Stage failed | `{ specId, stage, error, timestamp }` |

Listeners are registered in `specs-routes.js` for `POST /:id/generate-all`.

---

## 3. Zod Schemas and Structured Outputs

**File:** `backend/schemas/spec-schemas.js`

All five stages use Zod schemas converted to JSON Schema for OpenAI's strict structured output mode.

### Strict-mode rules

1. No `.optional()` — all fields use `.nullable()` so they appear in JSON Schema `required[]`.
2. No `z.record()` / `z.any()` — replaced with explicit objects (`additionalProperties: false`).
3. No `z.union()` mixing types — single consistent shapes.

### Schema summary

| Payload Schema | Root Key | Key Fields |
|----------------|----------|------------|
| `OverviewPayloadSchema` | `overview` | ideaSummary, problemStatement, targetAudience, valueProposition, coreFeaturesOverview, userJourneySummary, detailedUserFlow, screenDescriptions, complexityScore, suggestionsIdeaSummary, suggestionsCoreFeatures |
| `TechnicalPayloadSchema` | `technical` | techStack, architectureOverview, databaseSchema, apiEndpoints, securityAuthentication, integrationExternalApis, devops, dataStorage, analytics, detailedDataModels, dataFlowDetailed |
| `MarketPayloadSchema` | `market` | industryOverview, targetAudienceInsights, competitiveLandscape, swotAnalysis, monetizationModel, marketingStrategy |
| `DesignPayloadSchema` | `design` | visualStyleGuide, logoIconography, uiLayout, uxPrinciples |
| `ArchitecturePayloadSchema` | `architecture` | coreFunctionalityLogic, thirdPartyIntegrations, webPerformanceStrategy, embeddedDiagrams |

### Architecture schema detail

- **coreFunctionalityLogic**: Array of `{ name, description, technicalImplementation }`.
- **thirdPartyIntegrations**: Array of `{ id (slug), name (nullable), purpose, integrationMethod }`. IDs match Technical stage's `integrationExternalApis.thirdPartyServices`.
- **webPerformanceStrategy**: `{ cachingStrategy (nullable), lazyLoadingStrategy (nullable), ssrSsgApproach (nullable) }`.
- **embeddedDiagrams**: `{ systemMapMermaid (nullable), sequenceDiagramThirdPartyMermaid (nullable) }`. Raw Mermaid strings (no markdown fences).

### `buildResponseFormat(stage)`

1. Looks up `STAGE_PAYLOAD_SCHEMAS[stage]`.
2. Converts via `zodToJsonSchema(schema, { name, $refStrategy: 'none' })`.
3. Unwraps `$ref` envelope so root has `type: "object"` (OpenAI rejects `$ref` roots).
4. Strips `$schema`, `definitions`, `$defs`.
5. Returns `{ type: 'json_schema', json_schema: { name, strict: true, schema } }`.

---

## 4. Specs API Reference

**Base path:** `/api/specs` (mounted in `backend/server/server.js`).
**Auth:** All endpoints require Firebase ID token via `Authorization: Bearer <token>`.

| Method | Path | Purpose | Request Body | Response |
|--------|------|---------|--------------|----------|
| GET | `/api/specs` | List current user's specs | — | `{ success, specs }` |
| POST | `/api/specs/generate-overview` | Start background overview generation | `{ userInput, specId? }` | **202** `{ success, specId, requestId }` |
| POST | `/api/specs/:id/generate-all` | Queue technical → market → design → architecture | `{ overview, answers }` | **202** `{ success, specId, jobId, status, requestId }` |
| POST | `/api/specs/:id/generate-section` | Generate one section in background | `{ section: 'technical'\|'market'\|'design' }` | **202** `{ success, specId, section, requestId }` |
| POST | `/api/specs/:id/generate-architecture` | Generate architecture in background | — | **202** `{ success, specId, requestId }` |
| GET | `/api/specs/:id/generation-status` | Get queue job status | — | `{ success, specId, job, queueStatus }` |
| POST | `/api/specs/:id/upload-to-openai` | Upload spec to OpenAI Storage | — | `{ success, fileId? }` |
| POST | `/api/specs/:id/record-activity` | Record spec creation activity + send email | — | `{ success }` |

### Route behaviors

**generate-overview:**
1. Validates `userInput`; if `specId` present, checks ownership.
2. **Anchor write:** `await db.update({ 'status.overview': 'generating' })` before background job — confirms doc is committed and writable.
3. Background: `specGenerationServiceV2.generateOverview(specId, userInput)` → updates `overview`, `status.overview: 'ready'`, `title`, `generationVersion: 'v2'`.
4. On error: `status.overview: 'error'` (with existence check to avoid NOT_FOUND).

**generate-all:**
1. Validates ownership; sets `status.technical: 'generating'`, `status.market/design: 'pending'`.
2. `specQueue.add(specId, overview, answers)`.
3. Registers `spec.update` / `spec.complete` / `spec.error` listeners.
4. On `spec.update`: writes `status[stage]`, section content, and `generationVersion: 'v2'` to Firestore.
5. On `spec.complete`: removes listeners, triggers OpenAI upload.
6. On `spec.error`: writes `status[stage]: 'error'`.

**generate-architecture:**
1. Checks ownership; requires all four sections (overview, technical, market, design).
2. **Anchor write:** `status.architecture: 'generating'` before background job.
3. Background: `specGenerationServiceV2.generateArchitecture(...)` → writes `architecture` (Markdown), `status.architecture: 'ready'`, `generationVersion: 'v2'`.
4. Emits `specEvents.emitSpecUpdate(...)` on success.
5. On error: writes `status.architecture: 'error'`.

All generation routes return **202 Accepted** immediately and process in the background.

---

## 5. Event System (spec-events)

- **Module:** `backend/server/spec-events.js` (singleton EventEmitter).
- **Producers:** `spec-generation-service-v2.js`.
- **Consumers:** `specs-routes.js` in the `generate-all` handler:
  - **spec.update:** Update Firestore with `status[stage]` and section content when ready.
  - **spec.complete:** Remove listeners and trigger `triggerOpenAIUploadForSpec(specId)`.
  - **spec.error:** Set `status[stage] = 'error'`.

---

## 6. Queue (spec-queue)

- **Module:** `backend/server/spec-queue.js` (singleton).
- **Used by:** `specs-routes.js` in `POST /:id/generate-all`.
- **Processing:** One job at a time; calls `specGenerationServiceV2.generateAllSpecs(specId, overview, answers)`.
- Events from that call drive Firestore updates via the listeners registered in the route handler.

---

## 7. Firestore: specs Collection

**Collection:** `specs`
**Document ID:** Auto-generated.

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Firebase UID (owner). |
| `title` | string | Display title (from overview ideaSummary). |
| `overview` | string \| null | JSON string of overview object. |
| `technical` | string \| null | JSON string of technical section. |
| `market` | string \| null | JSON string of market section. |
| `design` | string \| null | JSON string of design section. |
| `architecture` | string \| null | Markdown architecture document (serialized from structured JSON). |
| `status.overview` | string | `'generating'` \| `'ready'` \| `'error'` \| `'pending'`. |
| `status.technical` | string | Same values. |
| `status.market` | string | Same values. |
| `status.design` | string | Same values. |
| `status.architecture` | string | Same values. |
| `thread_id` | string \| null | OpenAI Assistants thread ID (set by v2 on first generation). |
| `generationVersion` | string | `'v2'` when generated by Spec Engine v2. |
| `answers` | array | User answers (3 strings) used for prompts. |
| `overviewApproved` | boolean | Whether user approved overview. |
| `mode` | string | e.g. `'unified'`. |
| `openaiFileId` | string \| null | OpenAI Storage file ID after upload. |
| `openaiUploadTimestamp` | timestamp | When spec was uploaded to OpenAI. |
| `createdAt` | timestamp | Creation time. |
| `updatedAt` | timestamp | Last update time. |

---

## 8. End-to-End Flows

### 8.1 Create new spec (Home → Spec Viewer)

1. **Frontend** (`assets/js/features/index/index.js`):
   - Check auth and credits; consume one credit via `POST /api/v3/credits/consume`.
   - Create an empty spec document in Firestore with `status.overview: 'generating'`.
   - Call `POST /api/specs/generate-overview` with `{ userInput, specId }` → receives 202.
   - Redirect to `/pages/spec-viewer.html?id=<specId>`.

2. **Backend** (generate-overview):
   - Anchor write: `status.overview: 'generating'`.
   - Background: `specGenerationServiceV2.generateOverview(specId, userInput)`.
   - Thread manager creates OpenAI thread, stores `thread_id` on spec.
   - Runs overview stage with `response_format` (strict JSON) → validates with Zod.
   - Updates Firestore: `overview`, `status.overview: 'ready'`, `title`, `generationVersion: 'v2'`.

3. **Spec Viewer:**
   - Firestore real-time listener (`onSnapshot`) detects `status.overview: 'ready'`.
   - Displays overview; user can approve and trigger generate-all.

### 8.2 Approve overview → Technical, Market, Design, Architecture

1. **Frontend:** User clicks "Approve Overview" → `POST /api/specs/:id/generate-all` with `{ overview, answers }`.

2. **Backend:**
   - Sets `status.technical: 'generating'`, `status.market/design: 'pending'`.
   - `specQueue.add(specId, overview, answers)`.

3. **SpecGenerationServiceV2.generateAllSpecs:**
   - For each stage in `['technical', 'market', 'design']`: emit `spec.update(..., 'generating')` → `generateSection(...)` → `tm.runStage(threadId, stage, userMessage)` → emit `spec.update(..., 'ready', result)` or `spec.error`.
   - If all three succeed: emit `spec.update(..., 'architecture', 'generating')` → `generateArchitecture(...)` → `runStage(threadId, 'architecture', prompt)` → `_architecturePayloadToMarkdown(payload)` → emit `spec.update(..., 'architecture', 'ready', markdown)`.
   - Emit `spec.complete(specId, processed)`.

4. **specs-routes listeners:** On each `spec.update`, write to Firestore. On `spec.complete`, trigger OpenAI upload.

5. **Frontend:** Firestore real-time listener updates UI as each section becomes ready.

### 8.3 Generate single section (retry or on-demand)

1. `POST /api/specs/:id/generate-section` with `{ section: 'technical' | 'market' | 'design' }`.
2. Backend: Set `status[section]: 'generating'`, run `generateSection` in background via `setImmediate`, update Firestore on success/error.

### 8.4 Generate architecture only

1. Frontend: Click "Generate Architecture" button → `POST /api/specs/:id/generate-architecture`.
2. Backend: Anchor write `status.architecture: 'generating'`; background: `generateArchitecture(...)` → structured JSON → Markdown → Firestore.
3. Frontend: Firestore listener updates architecture tab when `status.architecture` changes.

---

## 9. Frontend: Spec Viewer

**HTML:** `pages/spec-viewer.html`
**JS:** `assets/js/features/spec-viewer/spec-viewer-main.js`

### Active tabs (in order)

| Tab | ID | Notes |
|-----|----|-------|
| Overview | `overviewTab` | Expandable subsections |
| Technical | `technicalTab` | Expandable subsections |
| Market Research | `marketTab` | Expandable subsections |
| Design & Branding | `designTab` | Expandable subsections |
| Architecture | `architectureTab` | Disabled until tech+market+design ready |
| Prompts | `promptsTab` | Expandable subsections |
| Brain Dump | `brainDumpTab` | Enabled after architecture ready |
| AI Chat | `chatTab` | Available after overview |
| Mockup (Pro) | `mockupTab` | Pro feature |
| Export & Integration | `exportTab` | Always enabled |

**Diagrams tab has been removed.** Diagrams are now part of the Architecture output (Mermaid blocks rendered inline).

### Architecture display states

| State | UI |
|-------|----|
| Advanced specs not all ready | Locked message |
| `status.architecture === 'generating'` | Spinner: "Generating architecture document... 30–90 seconds" |
| No architecture, no error | Button: "Generate Architecture" |
| `status.architecture === 'error'` | Button: "Retry Architecture" |
| Architecture content exists | Rendered Markdown with inline Mermaid diagrams |

### v2 Badge

When `data.generationVersion === 'v2'`, a badge ("Spec Engine v2") is shown next to the spec title. Styled via `.spec-v2-badge` in `assets/css/pages/spec-viewer.css`.

### Keyboard shortcuts

| Shortcut | Tab |
|----------|-----|
| Alt+1 | Overview |
| Alt+2 | Technical |
| Alt+3 | Market |
| Alt+4 | Design |
| Alt+5 | Architecture |
| Alt+6 | Prompts |
| Alt+7 | Chat |
| Alt+8 | Mockup |
| Alt+9 | Export |

---

## 10. Workers (Non-Spec Generation)

These workers are **not** part of the v2 spec generation pipeline. The Cloudflare Worker `spspec` is no longer used for spec generation — all generation goes through the OpenAI Assistants API directly from the backend.

| Worker | URL | Use |
|--------|-----|-----|
| **promtmaker** | `https://promtmaker.shalom-cohen-111.workers.dev/generate` | Prompt generation in spec-viewer |
| **mockup** | `https://mockup.shalom-cohen-111.workers.dev` | Mockup generation |
| **generate-mindmap** | `https://generate-mindmap.shalom-cohen-111.workers.dev/` | Mind map in spec-viewer |
| **jiramaker** | `https://jiramaker.shalom-cohen-111.workers.dev/` | Jira features in spec-viewer chat |
| **healthcheck** | `https://healthcheck.shalom-cohen-111.workers.dev/health` | Worker health checks |
| **spspec** | `https://spspec.shalom-cohen-111.workers.dev/generate` | **Legacy only** — fallback for overview when no specId is provided |

---

## 11. Error Handling and Codes

**Module:** `backend/server/error-handler.js`

| Code | HTTP | When |
|------|------|------|
| `MISSING_REQUIRED_FIELD` | 400 | Missing `overview`, `answers`, `userInput`, `section` |
| `RESOURCE_NOT_FOUND` | 404 | Spec not found |
| `FORBIDDEN` | 403 | User does not own the spec |
| `EXTERNAL_SERVICE_ERROR` | 500 | OpenAI call or external service failed |
| `VALIDATION_ERROR` | 400 | Invalid section name |
| `UNAUTHORIZED` / `INVALID_TOKEN` | 401 | Auth header missing or invalid |

**v2-specific error handling:**
- **Firestore race condition:** `getOrCreateThread` retries 3 times with backoff. If the spec is deleted mid-flight, logs WARN and continues (does not throw).
- **OpenAI schema rejection:** Logs the exact `sentSchema` JSON and the `error.message` from OpenAI.
- **Zod validation failure:** Logs `receivedKeys` vs expected schema structure.
- **Schema errors in generateSection:** Detects `invalid_json_schema` / `response_format` patterns in error messages and logs the `attemptedSchema`.

---

## 12. File and Code Reference

| Concern | File path |
|---------|-----------|
| Spec generation service (v2) | `backend/server/spec-generation-service-v2.js` |
| Thread manager | `backend/server/spec-thread-manager.js` |
| Zod schemas + buildResponseFormat | `backend/schemas/spec-schemas.js` |
| Spec generation service (legacy) | `backend/server/spec-generation-service.js` |
| Spec queue | `backend/server/spec-queue.js` |
| Spec events | `backend/server/spec-events.js` |
| Specs API routes | `backend/server/specs-routes.js` |
| OpenAI storage service | `backend/server/openai-storage-service.js` |
| Error codes | `backend/server/error-handler.js` |
| Home page – start generation | `assets/js/features/index/index.js` |
| Spec viewer – load, approve, display | `assets/js/features/spec-viewer/spec-viewer-main.js` |
| Spec viewer HTML | `pages/spec-viewer.html` |
| Spec viewer CSS | `assets/css/pages/spec-viewer.css` |

### Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | Yes | OpenAI API authentication |
| `OPENAI_SPEC_GENERATOR_ASSISTANT_ID` | No | Reuse a pre-created generator assistant (skips auto-creation) |
| `OPENAI_SPEC_ARCHITECTURE_ASSISTANT_ID` | No | Reuse a pre-created architecture assistant (legacy; architecture now uses generator) |

---

*Document version: 2.0 — reflects v2 implementation including structured Architecture, gpt-5-mini model with fallback chain, Diagrams tab removal, and all Firestore race condition fixes.*
