# Site Map and System Inventory

This document maps all pages, key files, backend services, core functions, and main user flows for the site. Keep this file updated when adding pages, APIs, or flows.

## Pages (Jekyll)

Most pages use `layout: default` and live under `pages/` or `pages/academy/`.

- `index.html` (home)
- `blog/index.html`
- `pages/404.html`, `pages/about.html`, `pages/how.html`, `pages/why.html`, `pages/contact.html`
- `pages/ToolPicker.html`, `pages/demo-spec.html`, `pages/legacy-viewer.html`
- `pages/spec-viewer.html` (spec viewer)
- `pages/planning.html` (spec creation / planning UI)
- `pages/profile.html`, `pages/pricing.html`, `pages/auth.html` (standalone HTML, no layout)
- `pages/articles.html`, `pages/article.html`, `pages/dynamic-post.html`
- `pages/new-admin-dashboard.html`, `pages/cursor-windsurf-integration.html`
- `pages/privacy.html`, `pages/terms.html`, `pages/unsubscribe.html`
- `pages/academy/index.html`, `pages/academy/category.html`, `pages/academy/guide.html`

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
- Entrypoint: `server.js` (run via `cd backend && npm start` or root `npm run dev`)
- Auth/Users: `user-management.js`, `firebase-admin.js`, `user-routes.js`
- Security/Errors: `security.js`, `error-handler.js`, `error-logger.js`, `health-routes.js`
- Specs: `specs-routes.js` (create/read/update/ownership, token verification)
- Chat/LLM: `chat-routes.js`, `openai-storage-service.js`
- Credits V3 (primary): `credits-v3-service.js`, `credits-v3-routes.js`; sync: `credits-sync-service.js`, `lemon-subscription-resolver.js`
- Lemon: `lemon-routes.js`, `lemon-webhook-utils.js`, `lemon-purchase-service.js`, `lemon-credits-service.js`, `lemon-products-config.js`
- Admin/Stats/Blog/Articles: `admin-routes.js`, `stats-routes.js`, `blog-routes.js`, `blog-routes-public.js`, `articles-routes.js`
- Other: `brain-dump-routes.js`, `mcp-routes.js`, `mcp-auth.js`, `academy-routes.js`, `tools-routes.js`, `tool-finder-routes.js`, `live-brief-routes.js`, `share-prompt-routes.js`, `analytics-routes.js`, `newsletter-routes.js`, `email-tracking-routes.js`, `automation-routes.js`, `api-docs-routes.js`
- Config: `config.js`

Related configuration and data:
- `backend/server/config.js` – Port, CORS, credits V3 flag
- `assets/data/lemon-products.json` – Frontend-accessible product definitions

## Data Model (Firestore - high level)
- `users/{userId}` – profile, flags (credits **not** here; use `user_credits_v3`)
- `user_credits_v3/{userId}` – **single source of truth**: balances (paid/free/bonus), total, subscription, permissions
- `credit_ledger_v3` – credit transaction log; `subscriptions_v3` – subscription event archive
- `entitlements/{userId}` – legacy (deprecated)
- `specs/{specId}` – spec documents (owner, content, metadata)
- `purchases/*`, `subscriptions/*` – from webhooks; `brainDumpRateLimit/{userId}` – Brain Dump daily limit

## Key Functions (selection)

Frontend:
- Spec generation / planning: `assets/js/features/planning/`, `assets/js/features/index/`
- Spec viewer: `assets/js/features/spec-viewer/` (spec-viewer-main.js, spec-viewer-api-helper.js, etc.)
- `PaywallManager` in `assets/js/paywall.js` – Purchase flow via Lemon Squeezy
- Credits display: `assets/js/services/api-client.js`, `window.api` (from packages/api-client or assets copy)
- Admin: `assets/js/new-admin-dashboard/` (DataManager, FirebaseService, UsersView, etc.)

Backend:
- Auth: `verifyFirebaseToken` (e.g. in security or route middleware), `user-management.js`
- Credits V3: `credits-v3-service.js` – getCredits, consumeCredit, refund, subscription sync
- Lemon: `lemon-routes.js`, `lemon-subscription-resolver.js`, webhook handlers
- Specs: `specs-routes.js` – create, get, update, ownership
- Chat: `chat-routes.js`; Brain Dump: `brain-dump-routes.js`
- Stats: `stats-routes.js`

## Systems and Relationships
- Spec creation depends on: Auth (Firebase), Credits V3 (`user_credits_v3`), LLM/Chat service, Spec storage
- Payment (Lemon Squeezy) → Webhooks → `lemon-routes.js` / `lemon-subscription-resolver.js` → update `user_credits_v3` and ledger
- Credits V3 is single source of truth; admin and frontend read from `user_credits_v3`
- Admin/Stats/Blog/Articles/MCP are separate route modules with auth where required

## Main Flows
1) User Purchase (Credits/Pro)
   - Frontend: checkout via `paywall.js` or `pricing.html`
   - Lemon Squeezy → Webhook → `lemon-routes.js` / `lemon-subscription-resolver.js` → update `user_credits_v3` (and ledger/subscriptions_v3)
   - UI refreshes credits (API client / credits endpoints)

2) Create Spec
   - User authenticated → credits checked via V3 (`user_credits_v3`)
   - Consume credit (credits-v3-service) before generation
   - LLM/chat route → produce content; save spec via `specs-routes.js`
   - On failure: refund credit (credits-v3-service)

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



