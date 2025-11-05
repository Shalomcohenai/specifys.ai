# Site Map and System Inventory

This document maps all pages, key files, backend services, core functions, and main user flows for the site. Keep this file updated when adding pages, APIs, or flows.

## Pages (Jekyll)
- `index.html` (home)
- `blog/index.html`
- `pages/404.html`
- `pages/about.html`
- `pages/how.html`
- `pages/ToolPicker.html`
- `pages/demo.html`
- `pages/demo-spec.html`
- `pages/legacy-viewer.html`
- `pages/spec.html` (spec creation UI)
- `pages/spec-viewer.html` (spec viewer)
- `pages/admin-dashboard.html`
- `pages/profile.html`
- `pages/pricing.html`
- `pages/research.html`

Blog posts live under `_posts/` and render via `_layouts/post.html`.

## Layouts and Includes
- Layouts: `_layouts/default.html`, `_layouts/dashboard.html`, `_layouts/post.html`, `_layouts/auth.html`, `_layouts/standalone.html`
- Includes: `_includes/head.html`, `header.html`, `footer.html`, `firebase-init.html`, `firebase-auth.html`, `analytics.html`, `analytics-events.html`, `index-hero.html`, `index-menu.html`, `index-styles.html`, `index-scripts.html`, `structured-data.html`, `welcome-modal.html`, `scroll-to-top.html`

## Frontend Scripts (`assets/js/`)
- `index.js` – Homepage/spec generation client logic (prompting, saving, UI states)
- `spec-formatter.js` – Formatting and rendering helpers for generated specs
- `paywall.js` – Lemon Squeezy checkout integration and paywall UX
- `credits-display.js` – Fetch and display user credit/entitlement state
- `entitlements-cache.js` – Client cache for entitlements
- `admin-dashboard.js` – Admin UI interactions
- `blog-manager.js` – Blog admin helpers
- `config.js` – API base URL/env detection
- `security-utils.js`, `mobile-optimizations.js`, `typingEffect.js`, `mermaid.js`, `mermaid-simple.js`, `post.js`, `script.js`

## Backend (Node, `backend/server/`)
- Entrypoint: `server.js`
- Auth/Users: `userAuth.js`, `user-management.js`, `firebase-admin.js`
- Security/Errors: `security.js`, `error-logger.js`, `health-routes.js`
- Specs API: `spec-routes.js` (create/read/ownership, token verification)
- Chat/LLM: `chat-routes.js`, `openai-storage-service.js`
- Payments/Credits: `lemon-webhook.js` (webhooks), `entitlement-service.js` (credits + entitlements)
- Admin/Stats/Blog: `admin-routes.js`, `stats-routes.js`, `blog-routes.js`
- Config/Test: `config.js`, `test-config.js`
- Scripts: `scripts/migrate-specs-to-openai.js`, `scripts/init-public-stats.js`, `scripts/cleanup-orphaned-assistants.js`

Related configuration and data:
- `config/lemon-products.json` – Lemon Squeezy products and webhook config
- `assets/data/lemon-products.json` – Frontend-accessible product definitions

## Data Model (Firestore - high level)
- `users/{userId}` – profile, `free_specs_remaining`, flags
- `entitlements/{userId}` – purchased credits, pro status, pending entitlements
- `specs/{specId}` – spec documents (owner, content, metadata)
- `purchases/*`, `subscriptions/*` – stored from webhooks (as applicable)

## Key Functions (selection)

Frontend:
- `generateSpecification()` in `assets/js/index.js` – Orchestrates spec generation
- `saveSpecToFirebase()` in `assets/js/index.js` – Persists spec to backend/Firestore
- `PaywallManager` in `assets/js/paywall.js` – Purchase flow via Lemon Squeezy
- `purchaseSpec()` (inline) in `pages/pricing.html` – Opens product checkout
- `updateCreditsUI()` family in `assets/js/credits-display.js` – Updates UI with entitlement state

Backend:
- `verifyFirebaseToken` in `backend/server/spec-routes.js` – Auth guard
- `consumeSpecCredit(userId)` and `refundSpecCredit(userId)` in `backend/server/entitlement-service.js` – Credit accounting
- `handleLemonWebhook(req, res)` and event handlers in `backend/server/lemon-webhook.js` – Webhook processing
- `createSpec`, `getSpec`, ownership helpers in `backend/server/spec-routes.js`
- `chat` endpoints in `backend/server/chat-routes.js`
- `getStats` in `backend/server/stats-routes.js`

## Systems and Relationships
- Spec Creation depends on: Auth (Firebase), Credits/Entitlements, LLM/Chat service, Spec storage
- Payment (Lemon Squeezy) updates Entitlements via Webhooks → `entitlements` collection
- Credits System mediates access to Spec Creation; UI surfaces via `credits-display.js`
- Admin/Stats/Blog are separated routes with auth checks

## Main Flows
1) User Purchase (Credits/Pro)
   - Frontend opens checkout (via `paywall.js` or `pricing.html`)
   - Lemon Squeezy → Webhook (`lemon-webhook.js`) → validate + upsert purchase/subscription
   - `entitlement-service.js` updates `entitlements/{userId}`
   - UI polls/refreshes credits (`credits-display.js`)

2) Create Spec
   - User authenticated → check entitlements
   - Attempt to consume credit (`consumeSpecCredit`) before generation
   - Call LLM/chat route if needed → produce content
   - Save spec (`saveSpecToFirebase` → `spec-routes.js`)
   - On failure: refund credit (`refundSpecCredit`)

3) Spec Viewing
   - `spec-viewer.html` loads spec by id with ownership/visibility checks

4) Tabs/Cards UI (pricing/options)
   - Implemented in `pages/pricing.html` (billing period toggle) and `assets/js/paywall.js` (options selection and state)

## Sitemaps and Redirects
- `sitemap.xml` – enumerates public pages
- `_redirects` – Netlify-style redirects

## How to Update this Map
- When adding a page: list it under Pages, and ensure `sitemap.xml` is updated
- When adding an API/route: add under Backend and describe inputs/outputs briefly
- When changing payments/credits/spec logic: update Systems, Key Functions, and Main Flows



