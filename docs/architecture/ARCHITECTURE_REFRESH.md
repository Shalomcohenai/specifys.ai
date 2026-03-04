# Spec Generation Engine v2 — Architecture Refresh

This document is the canonical reference for the greenfield spec-generation system (v2). It replaces the legacy Worker-based flow with OpenAI Assistants API v2, persistent threads, and structured outputs.

---

## 1. Legacy Stack (Retired for Spec Gen)

The previous system used a three-layer retry pyramid with no schema contract:

- **Backend** (`spec-generation-service.js`): 2-attempt loop + 1 repair attempt per section, string truncation, heuristic “minimal content” checks and repair prompts.
- **Cloudflare Worker** (spspec): 3-attempt `retryWithRepair`, manual JSON validators, `gpt-4o-mini` Chat Completions.
- **Queue** (`spec-queue.js`): In-memory, one job at a time, lost on restart.

**Retired logic (no longer used for v2):** `isTechnicalContentMinimal`, `isStageContentMinimal`, `getRepairPromptSuffix`, `normalizeOverviewSuggestions`, Worker HTTP call for spec generation. The Worker is **deprecated for spec generation**; the backend calls OpenAI directly.

---

## 2. New Technology Stack

| Layer | Old | New |
|-------|-----|-----|
| LLM API | Stateless Chat Completions via Worker | **OpenAI Assistants API v2** (direct from backend) |
| Model (structured) | gpt-4o-mini | **gpt-5-mini** |
| Model (architecture) | gpt-4o-mini | **gpt-5-mini** (structured JSON, serialized to Markdown for storage) |
| Output contract | Heuristic validators + repair prompts | **Structured Outputs** (`json_schema`, `strict: true`) |
| Context | String concatenation + truncation | **Persistent Threads** (`thread_id` in Firestore) |
| Validation | None | **Zod** → `zod-to-json-schema` for `response_format` |
| Worker | Core spec generation | **Not used** for spec gen |

---

## 3. Data Contract — Zod Schemas

**File:** [backend/schemas/spec-schemas.js](../../backend/schemas/spec-schemas.js)

Schemas define the **full** output structure for each stage (same sections as before), so the model returns complete specs, not partial ones.

- **Overview:** `OverviewPayloadSchema` — `overview` with ideaSummary, problemStatement, targetAudience, valueProposition, coreFeaturesOverview, userJourneySummary, detailedUserFlow, screenDescriptions, complexityScore, suggestionsIdeaSummary, suggestionsCoreFeatures.
- **Technical:** `TechnicalPayloadSchema` — `technical` with techStack, architectureOverview, databaseSchema, apiEndpoints, securityAuthentication, integrationExternalApis, devops, dataStorage, analytics, detailedDataModels, dataFlowDetailed.
- **Market:** `MarketPayloadSchema` — `market` with industryOverview, targetAudienceInsights, competitiveLandscape, swotAnalysis, monetizationModel, marketingStrategy.
- **Design:** `DesignPayloadSchema` — `design` with visualStyleGuide, logoIconography, uiLayout, uxPrinciples.
- **Architecture:** `ArchitecturePayloadSchema` — `architecture` with coreFunctionalityLogic, thirdPartyIntegrations, webPerformanceStrategy, embeddedDiagrams (systemMapMermaid, sequenceDiagramThirdPartyMermaid). Backend serializes validated JSON to Markdown for storage so the frontend continues to receive a string.

Helpers:

- `buildResponseFormat(stage)` — returns `response_format` for `runs.create` (strict JSON schema).
- `parseAndValidateStage(stage, raw)` — parses and validates API response with Zod.

---

## 4. State Machine: Firestore ↔ OpenAI Run

- **Firestore statuses:** `pending` → `generating` → `ready` or `error`.
- **OpenAI Run:** `queued` / `in_progress` → Firestore `generating`; `completed` → content written, status `ready`; `failed` / `expired` / `cancelled` → status `error`.

`openai-storage-service.runSpecGeneration()` handles: add message → create run (with optional `response_format`) → poll until completed → return assistant message text.

---

## 5. Thread Management

**File:** [backend/server/spec-thread-manager.js](../../backend/server/spec-thread-manager.js)

- **One thread per spec.** `thread_id` is stored on the spec document (Firestore).
- **getOrCreateThread(specId):** Reads `specs/{specId}.thread_id`; if missing, creates a thread via OpenAI, updates the spec with `thread_id`, returns it.
- **runStage(threadId, stage, userMessage):** Adds user message, creates run with `response_format` from `buildResponseFormat(stage)` (including `stage === 'architecture'`), polls, parses JSON, validates with Zod, returns payload (e.g. `{ overview: {...} }` or `{ architecture: {...} }`). Architecture uses the same generator assistant; no separate runArchitecture.

Assistants:

- **All stages (overview, technical, market, design, architecture):** One gpt-5-mini assistant. ID from `OPENAI_SPEC_GENERATOR_ASSISTANT_ID` or created on first use. (OPENAI_SPEC_ARCHITECTURE_ASSISTANT_ID is no longer used for the architecture stage.)

---

## 6. Model Strategy

| Stage | Model | response_format |
|-------|--------|------------------|
| Overview | gpt-5-mini | `json_schema` strict (OverviewPayloadSchema) |
| Technical | gpt-5-mini | `json_schema` strict (TechnicalPayloadSchema) |
| Market | gpt-5-mini | `json_schema` strict (MarketPayloadSchema) |
| Design | gpt-5-mini | `json_schema` strict (DesignPayloadSchema) |
| Architecture | gpt-5-mini | `json_schema` strict (ArchitecturePayloadSchema); backend serializes to Markdown for storage |

---

## 7. Generation Service v2

**File:** [backend/server/spec-generation-service-v2.js](../../backend/server/spec-generation-service-v2.js)

- **generateOverview(specId, userInput):** getOrCreateThread(specId), runStage(threadId, 'overview', userMessage), return overview JSON string.
- **generateSection(specId, stage, overview, answers):** getOrCreateThread, build prompt, runStage, emit `spec.update` / `spec.error`, return section JSON string.
- **generateAllSpecs(specId, overview, answers):** Sequential technical → market → design; then generateArchitecture; emits `spec.update` / `spec.complete` / `spec.error`.
- **generateArchitecture(specId, overview, technical, market, design):** getOrCreateThread, runStage(threadId, 'architecture', userMessage), then _architecturePayloadToMarkdown(payload) to produce Markdown string for Firestore and frontend.

No retries, no repair prompts, no “minimal content” heuristics. If the API returns, structured output is validated by schema.

---

## 8. Routes and Queue

- **specs-routes.js:** Uses `specGenerationServiceV2` for overview (when specId present), generate-all (via queue), generate-section, generate-architecture. On success, writes `generationVersion: 'v2'` and (via thread manager) `thread_id` where applicable.
- **spec-queue.js:** Calls `specGenerationServiceV2.generateAllSpecs(specId, overview, answers)`; same in-memory queue shape, one job at a time.

---

## 9. Firestore Schema Additions

On `specs` documents:

- **thread_id** (string | null): OpenAI thread ID for this spec (set when v2 generation runs).
- **generationVersion** (string): Set to `'v2'` when any section is generated or updated by v2 so the frontend can show the “Spec Engine v2” badge.

---

## 10. Frontend: v2 Indicator

- Spec viewer reads `data.generationVersion === 'v2'`.
- When true, the badge **“Spec Engine v2”** is shown next to the spec title ([pages/spec-viewer.html](../../pages/spec-viewer.html), [assets/js/features/spec-viewer/spec-viewer-main.js](../../assets/js/features/spec-viewer/spec-viewer-main.js), [assets/css/pages/spec-viewer.css](../../assets/css/pages/spec-viewer.css)).

---

## 11. System Impact Summary

| Subsystem | Impact |
|-----------|--------|
| specs-routes.js | Uses v2 service; writes `generationVersion: 'v2'` and (via v2) `thread_id`. |
| spec-queue.js | Calls v2 `generateAllSpecs`. |
| spec-events.js | Unchanged. |
| Credits / notifications | Unchanged. |
| Brain Dump | Unchanged (separate Assistants usage). |
| Cloudflare Worker (spspec) | Not used for spec generation. |
| New env (optional) | `OPENAI_SPEC_GENERATOR_ASSISTANT_ID`, `OPENAI_SPEC_ARCHITECTURE_ASSISTANT_ID`; if unset, assistants are created on first use. |

---

## 12. File Reference

| Concern | Path |
|--------|------|
| Zod schemas | backend/schemas/spec-schemas.js |
| Thread lifecycle | backend/server/spec-thread-manager.js |
| Generation v2 | backend/server/spec-generation-service-v2.js |
| OpenAI run + poll | backend/server/openai-storage-service.js (`runSpecGeneration`) |
| Routes | backend/server/specs-routes.js |
| Queue | backend/server/spec-queue.js |
| Events | backend/server/spec-events.js |
| v2 badge | pages/spec-viewer.html, spec-viewer-main.js, spec-viewer.css |

---

*Document version: 1.0 — reflects v2 implementation as of architecture refresh.*
