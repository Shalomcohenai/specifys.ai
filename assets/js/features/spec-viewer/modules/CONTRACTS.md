# Spec Viewer Module Contracts

## Module Map

- `PromptEngine.js`: orchestrates prompts generation calls, staged prompt generation, prompts rendering, and retry actions for technical/market/design sections.
- `DiagramEngine.js`: handles diagrams and mind map generation, Mermaid rendering, repair flow, and render-failure recovery UX.
- `DataService.js`: owns `currentSpecData`, validates incoming data, emits event-bus updates, and manages scoped loading states.

## PromptEngine Contracts

- `generatePrompts()`
  - Request: `POST /api/auxiliary/prompts/generate`
  - Body: `{ "specId": "string" }`
  - Success: `{ "prompts": { "fullPrompt": "string", "thirdPartyIntegrations": [] } }`
  - Error envelope: `{ "error": { "message": "string" } }`
- `generateSingleStage(stageNumber, requestId, overviewContent, technicalContent, designContent, previousStages, updateProgress)`
  - Request: `POST /api/auxiliary/prompts/generate`
  - Body: `{ "stage": "prompt-stage", "locale": "en-US", "temperature": 0, "prompt": { ... } }`
  - Success: `{ "prompts": { "fullPrompt": "string" } }`
  - Error: HTTP 4xx/5xx, thrown as `Error`
- `generateTechnicalSpec()`, `generateMarketSpec()`, `generateDesignSpec()`
  - Request: `POST /api/auxiliary/prompts/generate`
  - Body: `{ "stage": "technical|market|design", "locale": "en-US", "temperature": 0, "prompt": { ... } }`
  - Success: section object returned by backend and normalized to formatted JSON string
  - Error: HTTP 4xx/5xx, thrown as `Error`

## DiagramEngine Contracts

- `generateDiagrams()`
  - Request: `POST /api/chat/diagrams/generate`
  - Body: `{ "specId": "string" }`
  - Success: `{ "diagrams": [{ "id": "string", "title": "string", "mermaidCode": "string" }] }`
- `repairDiagram(diagramId)`
  - Request: `POST /api/chat/diagrams/repair`
  - Body: `{ "specId": "string", "diagramId": "string", "mermaidCode": "string", "title": "string" }`
  - Success: `{ "mermaidCode": "string" }`
- `generateMindMap()`
  - Request: `POST /api/auxiliary/mindmap/generate`
  - Body: `{ "overview": "string|object", "technical": "string|object" }`
  - Success: `{ "mindMap": { "drawflow"?: object, "nodeData"?: object } }`

## DataService Schema Contract

- `setSpec(spec)` input guard:
  - `spec` must be object
  - `spec.id` must be `string` when present
  - `spec.status` must be `object` when present
  - `spec.overview|technical|market|design|architecture` must be `string|object|null|undefined`
- On malformed input:
  - Logs via `window.appLogger.logError(..., { context: "DataService.setSpec", spec })`
  - Rejects update (keeps previous state)
  - Does not emit `specUpdated`

## Event Bus Contracts

- `specUpdated` payload: full validated spec object
- `loadingChanged` payload: `{ "scope": "overview|diagrams|prompts|mockups|mindmap|general", "status": boolean }`

## Backwards-Compat Surface

The following globals intentionally remain for classic inline handlers in `pages/spec-viewer.html`:

- `window.showTab`
- `window.generatePrompts`
- `window.retryTechnical`
- `window.retryMarket`
- `window.retryDesign`
- `window.generateDiagrams`
- `window.repairDiagram`
- `window.generateMindMap`
- `window.retryMindMap`
