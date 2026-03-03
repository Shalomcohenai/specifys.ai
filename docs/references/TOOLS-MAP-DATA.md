# Tools Map – Source of Truth and Export

## Source of truth

**Firestore** (collection `tools`) is the single source of truth for the Vibe Coding Tools Map. All additions, updates, and deletes are done in Firestore.

## The `tools.json` file

The file `tools/map/tools.json` is **derived from Firestore only**. It is not used as a source for updates.

- **Purpose:** Static build (Jekyll copies it to `_site/`), fallback when the API is unavailable, and homepage tools count when API is available.
- **How it is updated:**
  - **Export (recommended):** Admin dashboard → Tools → "Export to JSON", or `POST /api/tools/export` (admin only).
  - **Scheduled:** After each successful run of the weekly tools-finder job, the backend runs an export so `tools.json` stays in sync.

## When to run what

| Action | When to use |
|--------|-------------|
| **Migration (JSON → Firestore)** | One-time seed or restore from backup. Use `tools-migration-service` (e.g. script or admin-triggered). |
| **Export (Firestore → JSON)** | After automation runs, before a static build, or on demand from Admin → Tools → Export to JSON. |

## Backend services

- **Read:** `GET /api/tools`, `GET /api/tools/count` — data from Firestore.
- **Export:** `POST /api/tools/export` — writes current Firestore tools to `tools/map/tools.json` (admin only).
- **Tools finder job:** Runs weekly; new tools are written to Firestore; after success, export runs to update `tools.json`.
