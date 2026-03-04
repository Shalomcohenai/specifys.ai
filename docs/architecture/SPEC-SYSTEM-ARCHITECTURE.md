# Spec System Architecture – Full Reference

This document describes the complete architecture of the specification generation system in Specifys.ai. It is intended for external readers who need to understand flows, components, APIs, worker contracts, and data structures end-to-end.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Core Backend Components](#2-core-backend-components)
3. [Specs API Reference](#3-specs-api-reference)
4. [Cloudflare Worker (spspec) Contract](#4-cloudflare-worker-spspec-contract)
5. [Other Workers (Related to Specs)](#5-other-workers-related-to-specs)
6. [Event System (spec-events)](#6-event-system-spec-events)
7. [Queue (spec-queue)](#7-queue-spec-queue)
8. [Firestore: specs Collection](#8-firestore-specs-collection)
9. [End-to-End Flows](#9-end-to-end-flows)
10. [Error Handling and Codes](#10-error-handling-and-codes)
11. [File and Code Reference](#11-file-and-code-reference)

---

## 1. Overview

The spec system generates application specifications in stages:

1. **Overview** – Generated from user input (single prompt or planning data).
2. **Technical, Market, Design** – Generated in sequence after the user approves the overview (run in background via a queue).
3. **Architecture** – Optional; generated from overview + technical + market + design (Markdown with optional Mermaid).

All generation for Overview and the three advanced sections (and Architecture) goes through a single **Cloudflare Worker** (`spspec`). The backend coordinates jobs, persistence (Firestore), events, and optional OpenAI upload.

---

## 2. Core Backend Components

### 2.1 SpecGenerationService

**File:** `backend/server/spec-generation-service.js`

**Purpose:** Calls the Cloudflare Worker to generate overview, technical, market, design, and architecture content. Handles retries (e.g. on 422), timeouts, and normalizes Worker responses.

**Configuration:**
- Worker URL: `https://spspec.shalom-cohen-111.workers.dev/generate`
- Timeout: 120 seconds (per request)

**Main functions:**

| Function | Purpose | Inputs | Output |
|----------|---------|--------|--------|
| `generateOverview(userInput)` | Generate overview JSON from free-text user input | `userInput: string` | `Promise<string>` – JSON string of overview object (with normalized suggestions) |
| `generateSection(specId, stage, overview, answers)` | Generate one section: technical, market, or design | `specId`, `stage`, `overview` (string), `answers` (array) | `Promise<string>` – JSON string of that section; emits `spec.update` / `spec.error` |
| `generateAllSpecs(specId, overview, answers)` | Run technical → market → design → architecture in sequence | Same as above | `Promise<Object>` – `{ technical, market, design, architecture, successes[], errors[] }`; emits update/complete/error events |
| `generateArchitecture(specId, overview, technical, market, design)` | Produce single Architecture Markdown document | All four content strings | `Promise<string>` – Markdown (with optional Mermaid blocks) |
| `buildPrompt(stage, specId, overview, answers)` | Build user prompt for a stage | Stage + context | `string` |
| `buildTechnicalPrompt(...)` / `buildMarketPrompt(...)` / `buildDesignPrompt(...)` | Stage-specific prompt builders | Overview, answers, optional reference mode | `string` |
| `getSystemPrompt(stage)` / `getDeveloperPrompt(stage)` | System and developer instructions per stage | `stage` | `string` |
| `normalizeOverviewSuggestions(overview)` | Normalize Worker suggestions (array → `{ toInclude, notToInclude }`) | Overview object | Normalized overview object |
| `processResults(results)` | Convert Promise.allSettled-style results to `{ technical, market, design, successes, errors }` | Array of results | Processed object |
| `isRetryable(error)` | Whether to retry on timeout/network errors | `Error` | `boolean` |

**Events emitted (via specEvents):**
- Before/after each stage: `emitSpecUpdate(specId, stage, status, content)` with `status` = `'generating'` or `'ready'`.
- On failure: `emitSpecError(specId, stage, error)`.
- When `generateAllSpecs` finishes: `emitSpecComplete(specId, processed)`.

---

### 2.2 SpecQueue

**File:** `backend/server/spec-queue.js`

**Purpose:** In-memory queue for background spec generation. Processes one job at a time (concurrency = 1). Each job runs `generateAllSpecs` (technical → market → design → architecture).

**Main functions:**

| Function | Purpose | Inputs | Output |
|----------|---------|--------|--------|
| `add(specId, overview, answers)` | Enqueue a job; starts processing if idle | `specId`, `overview`, `answers` | Job object `{ id, overview, answers, status, createdAt, ... }` |
| `process()` | Dequeue and run up to `maxConcurrent` jobs | — | — |
| `processJob(job)` | Calls `specGenerationService.generateAllSpecs(specId, overview, answers)`; sets job status to completed/failed | Job object | — |
| `getJob(specId)` | Get job by spec ID | `specId` | Job object or `null` |
| `getStatus()` | Queue metrics | — | `{ queueLength, processing, activeJobs, totalJobs }` |

**Behaviour:**
- If a job for the same `specId` already exists and is not finished, `add` returns the existing job.
- If the existing job is `failed` or `completed`, it is replaced.
- After a job finishes (success or failure), it is removed from the `jobs` Map after 5 minutes.

---

### 2.3 SpecEvents

**File:** `backend/server/spec-events.js`

**Purpose:** EventEmitter for spec generation progress. Decouples the generation service from route handlers that update Firestore and trigger side effects (e.g. OpenAI upload).

**Events:**

| Event | When | Payload |
|-------|------|---------|
| `spec.update` | Each stage status change (generating / ready) | `{ specId, stage, status, content, timestamp }` |
| `spec.complete` | When `generateAllSpecs` has finished | `{ specId, results, timestamp }` |
| `spec.error` | A stage failed | `{ specId, stage, error: { message, stack, name, code?, issues? }, timestamp }` |

**Methods:**
- `emitSpecUpdate(specId, stage, status, content)`
- `emitSpecComplete(specId, results)`
- `emitSpecError(specId, stage, error)`

The only listeners are registered in `specs-routes.js` for `POST /:id/generate-all`: they update Firestore on `spec.update`, remove listeners and trigger OpenAI upload on `spec.complete`, and persist error status on `spec.error`.

---

## 3. Specs API Reference

**Base path:** `/api/specs` (mounted in `backend/server/server.js`).  
**Auth:** All endpoints below that accept `:id` or create/update specs require Firebase ID token in `Authorization: Bearer <token>`.

| Method | Path | Purpose | Request body / params | Response |
|--------|------|---------|------------------------|----------|
| GET | `/api/specs` | List current user's specs | — | `{ success: true, specs: [...] }` |
| POST | `/api/specs/:id/upload-to-openai` | Upload spec to OpenAI Storage | — | `{ success, fileId?, message? }` |
| POST | `/api/specs/:id/send-ready-notification` | Send “spec ready” email | — | 200 |
| POST | `/api/specs/:id/generate-all` | Start background generation of technical, market, design (then architecture) | `{ overview: string, answers: array }` | **202** `{ success, specId, jobId, status, requestId }` |
| POST | `/api/specs/:id/generate-section` | Generate a single section (technical / market / design) | `{ section: 'technical' \| 'market' \| 'design' }` | **202** `{ success, specId, section, requestId }` |
| POST | `/api/specs/:id/generate-architecture` | Generate architecture from overview + technical + market + design | — | 200 `{ success, architecture, specId, requestId }` |
| POST | `/api/specs/generate-overview` | Start background overview generation | `{ userInput: string, specId?: string }` | **202** `{ success, specId, requestId }` |
| GET | `/api/specs/:id/generation-status` | Get queue job status for a spec | — | `{ success, specId, job, queueStatus }` |

**Direct overview generation (no spec document):**

| Method | Path | Purpose | Request body | Response |
|--------|------|---------|---------------|----------|
| POST | `/api/generate-spec` | Generate overview only via Worker (legacy/fallback; no Firestore spec) | `{ userInput: string }` | 200 `{ specification: string }` (overview JSON string) |

- **generate-all:** Validates ownership, sets Firestore status (e.g. technical = generating, market/design = pending), enqueues via `specQueue.add`, registers listeners for `spec.update` / `spec.complete` / `spec.error`, returns 202.
- **generate-section:** Sets status to generating, runs `specGenerationService.generateSection` in background (`setImmediate`), then updates Firestore and optionally triggers OpenAI upload.
- **generate-overview:** Runs `specGenerationService.generateOverview(userInput)` in background; if `specId` is provided, updates that spec’s overview, title, and status in Firestore and emits `spec.update` / `spec.error`.
- **generate-architecture:** Synchronous: reads overview + technical + market + design from Firestore, calls `generateArchitecture`, writes `architecture` and `status.architecture`, returns the Markdown.

---

## 4. Cloudflare Worker (spspec) Contract

**Base URL:** `https://spspec.shalom-cohen-111.workers.dev`  
**Endpoint:** `POST /generate`

### 4.1 Request (from backend)

Same shape for all stages:

```json
{
  "stage": "overview" | "technical" | "market" | "design" | "architecture",
  "locale": "en-US",
  "temperature": 0,
  "prompt": {
    "system": "string",
    "developer": "string",
    "user": "string"
  }
}
```

- **Overview:** `stage: "overview"`, `user` = raw user input (or combined planning text).
- **Technical / Market / Design:** `stage` set accordingly; `user` is built from overview + answers (see `buildTechnicalPrompt` etc. in spec-generation-service).
- **Architecture:** `stage: "architecture"`, `user` = concatenation of overview + technical + market + design (with length limits) plus structure instructions.

`temperature` is optional (e.g. 0 for sections, 0.2 for architecture).

### 4.2 Response – Success (200)

- **Overview:** `{ overview: { ... }, meta?: { ... } }`. Backend normalizes `overview` (e.g. suggestions) and returns a JSON string.
- **Technical / Market / Design:** `{ [stage]: <object> }`. Backend returns `JSON.stringify(data[stage], null, 2)`.
- **Architecture:** `{ architecture: string }` or raw string. Backend returns the Markdown string.

### 4.3 Response – Error (4xx / 5xx)

```json
{
  "error": {
    "code": "string",
    "message": "string",
    "issues": ["optional array"]
  },
  "correlationId": "optional"
}
```

Backend parses this and attaches `code` and `issues` to the Error object where applicable.

---

## 5. Other Workers (Related to Specs)

These are used by the frontend or health checks; they are **not** part of `spec-generation-service.js`:

| Worker | URL | Use |
|--------|-----|-----|
| **spspec** | `https://spspec.shalom-cohen-111.workers.dev/generate` | **Core spec system:** overview, technical, market, design, architecture. |
| **promtmaker** | `https://promtmaker.shalom-cohen-111.workers.dev/generate` | Prompt generation in spec-viewer (e.g. generatePrompts, integrations). |
| **mockup** | `https://mockup.shalom-cohen-111.workers.dev` (`/generate`, `/analyze-screens`, `/generate-single-mockup`) | Mockup generation in spec-viewer. |
| **generate-mindmap** | `https://generate-mindmap.shalom-cohen-111.workers.dev/` | Mind map in spec-viewer. |
| **jiramaker** | `https://jiramaker.shalom-cohen-111.workers.dev/` | Jira-related features in spec-viewer chat. |
| **healthcheck** | `https://healthcheck.shalom-cohen-111.workers.dev/health` | Health routes (Worker + OpenAI connectivity). |

Only **spspec** is used by the backend for spec generation.

---

## 6. Event System (spec-events)

- **Module:** `backend/server/spec-events.js` (singleton EventEmitter).
- **Producers:** `spec-generation-service.js` (emitSpecUpdate, emitSpecComplete, emitSpecError).
- **Consumers:** `specs-routes.js` in the `generate-all` handler only:
  - **spec.update:** Update Firestore `specs/{specId}` with `status[stage]` and, when status is `ready`, the section content field (e.g. `technical`, `market`, `design`, `architecture`).
  - **spec.complete:** Remove listeners and call `triggerOpenAIUploadForSpec(specId)` (non-blocking).
  - **spec.error:** Set `status[stage] = 'error'` in Firestore.

No other modules subscribe to these events.

---

## 7. Queue (spec-queue)

- **Module:** `backend/server/spec-queue.js` (singleton).
- **Used by:** `specs-routes.js` in `POST /:id/generate-all` (add job) and `GET /:id/generation-status` (get job + queue status).
- **Processing:** One job at a time; each job runs `specGenerationService.generateAllSpecs(specId, overview, answers)`. Events from that call drive Firestore updates via the listeners registered in the same request.

---

## 8. Firestore: specs Collection

**Collection:** `specs`  
**Document ID:** Auto-generated (Firestore).

**Relevant fields used by the spec system:**

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | Firebase UID (owner). |
| `title` | string | Display title (e.g. from overview ideaSummary). |
| `overview` | string \| null | JSON string of overview object. |
| `technical` | string \| null | JSON string of technical section. |
| `market` | string \| null | JSON string of market section. |
| `design` | string \| null | JSON string of design section. |
| `architecture` | string \| null | Markdown architecture document. |
| `status` | object | Per-section status. |
| `status.overview` | string | `'generating'` \| `'ready'` \| `'error'` \| `'pending'`. |
| `status.technical` | string | Same values. |
| `status.market` | string | Same values. |
| `status.design` | string | Same values. |
| `status.architecture` | string | Same values. |
| `answers` | array | User answers (e.g. 3 strings) used for prompts. |
| `overviewApproved` | boolean | Whether user approved overview (triggers generate-all from UI). |
| `mode` | string | e.g. `'unified'`. |
| `openaiFileId` | string \| null | OpenAI Storage file ID after upload. |
| `openaiUploadTimestamp` | timestamp | When spec was uploaded to OpenAI. |
| `createdAt` | timestamp | Creation time. |
| `updatedAt` | timestamp | Last update time. |

Initial document (created by frontend before calling generate-overview) may have `title: "Generating..."`, `status.overview: "generating"`, and other sections null/pending.

---

## 9. End-to-End Flows

### 9.1 Create new spec (Home → Spec Viewer)

1. **Frontend (e.g. `assets/js/features/index/index.js` – `generateSpecification`):**
   - Check auth and credits; consume one credit via `POST /api/v3/credits/consume`.
   - Create an empty spec document in Firestore `specs` with `status.overview: 'generating'`.
   - Call `POST /api/specs/generate-overview` with `{ userInput, specId }` → receives 202.
   - Redirect to `/pages/spec-viewer.html?id=<specId>`.

2. **Backend (generate-overview):**
   - Runs `specGenerationService.generateOverview(userInput)` in background.
   - Worker returns `{ overview }` → backend normalizes and updates Firestore: `overview`, `status.overview: 'ready'`, `title` (from overview); optionally `emitSpecUpdate(specId, 'overview', 'ready', content)`.

3. **Spec Viewer:**
   - Loads spec from Firestore (e.g. onSnapshot) and optionally polls `GET /api/specs/:id/generation-status`. When overview is ready, user can approve and trigger generate-all.

### 9.2 Approve overview → Technical, Market, Design, Architecture

1. **Frontend:** User clicks “Approve Overview” → `POST /api/specs/:id/generate-all` with `{ overview, answers }`.

2. **Backend (generate-all):**
   - Validates ownership; sets Firestore: `status.technical: 'generating'`, `status.market/design: 'pending'`.
   - `specQueue.add(specId, overview, answers)` → queue runs `generateAllSpecs`.

3. **SpecGenerationService.generateAllSpecs:**
   - For each stage in `['technical','market','design']`: emit `spec.update(..., 'generating')` → `generateSection(...)` → Worker → emit `spec.update(..., 'ready', result)` or `spec.error`.
   - If technical, market, and design all exist: emit `spec.update(..., 'architecture', 'generating')` → `generateArchitecture(...)` → Worker → emit `spec.update(..., 'architecture', 'ready', architecture)` or `spec.error`.
   - Emit `spec.complete(specId, processed)`.

4. **specs-routes listeners:** On each `spec.update`, update Firestore (status + section content). On `spec.complete`, remove listeners and call `triggerOpenAIUploadForSpec(specId)`.

5. **Frontend:** Firestore updates (or polling) cause the spec viewer to refresh and show new sections.

### 9.3 Generate single section (retry or on-demand)

1. Frontend: `POST /api/specs/:id/generate-section` with `{ section: 'technical' | 'market' | 'design' }`.
2. Backend: Set `status[section] = 'generating'`, run `generateSection` in background, then write result or error to Firestore and optionally trigger OpenAI upload.

### 9.4 Generate architecture only

1. Frontend: `POST /api/specs/:id/generate-architecture` (no body).
2. Backend: Read overview, technical, market, design from Firestore; call `generateArchitecture`; write `architecture` and `status.architecture`; return architecture in response.

### 9.5 Fallback: direct overview (no queue)

1. Frontend may call `POST /api/generate-spec` with `{ userInput }` when not using the queue (e.g. unauthenticated or queue failed).
2. `server.js` builds Worker payload (stage: overview), calls `spspec.../generate`, parses JSON, returns `{ specification }` (overview JSON string). Saving to Firestore and further steps are handled elsewhere (e.g. frontend or different flow).

---

## 10. Error Handling and Codes

**Module:** `backend/server/error-handler.js`

**Relevant error codes:**

- `MISSING_REQUIRED_FIELD` (400) – e.g. missing `overview`, `answers`, `userInput`, `section`.
- `RESOURCE_NOT_FOUND` (404) – Spec not found.
- `FORBIDDEN` (403) – User does not own the spec.
- `EXTERNAL_SERVICE_ERROR` (500) – Worker or external call failed.
- `VALIDATION_ERROR` (400) – e.g. invalid section name.
- `UNAUTHORIZED` / `INVALID_TOKEN` (401) – Auth header missing or invalid.

Failed Worker responses (e.g. 422) are parsed; `error.code` and `error.issues` are attached to the thrown Error. The service may retry once on 422/INVALID_MODEL_OUTPUT for section generation.

---

## 11. File and Code Reference

| Concern | File path |
|--------|-----------|
| Spec generation service | `backend/server/spec-generation-service.js` |
| Spec queue | `backend/server/spec-queue.js` |
| Spec events | `backend/server/spec-events.js` |
| Specs API routes | `backend/server/specs-routes.js` |
| Direct generate-spec endpoint | `backend/server/server.js` (POST `/api/generate-spec`) |
| Error codes | `backend/server/error-handler.js` |
| Home page – start generation | `assets/js/features/index/index.js` (`generateSpecification`) |
| Spec viewer – load, approve, poll | `assets/js/features/spec-viewer/spec-viewer-main.js` |
| Health check (Worker) | `backend/server/health-routes.js` (e.g. GET `/api/health/cloudflare-worker`) |

**Worker URL used by backend for spec generation:**  
`https://spspec.shalom-cohen-111.workers.dev/generate`

---

*Document version: 1.0. For the codebase state at the time of writing.*
