# Specifys.ai Documentation

Documentation layout and index for this repository.

## Architecture (`architecture/`)

| File | Description |
|------|-------------|
| [**ARCHITECTURE.md**](architecture/ARCHITECTURE.md) | **Primary architecture document (production)** — the system as deployed |
| [**NEW-ARCHITECTURE.md**](architecture/NEW-ARCHITECTURE.md) | **Next-generation draft** — working copy for the new site; baseline from current architecture + §0 for planning |

## Setup (`setup/`)

Service configuration: Firebase, SEO, GA4, Lemon Squeezy, Render, webhooks, and more.

- [mcp.md](setup/mcp.md) – MCP server setup (Cursor / Claude Desktop): API key, connection, tools and resources (specs, tools).
- [run-system-per-user.md](setup/run-system-per-user.md) – Run the system in Per-User mode (one MCP key per user).

## Guides (`guides/`)

How-to guides: creating pages, testing, logging, simulation.

## Checklists (`checklists/`)

Page configuration, security, migration, production QA.

## References (`references/`)

| File | Description |
|------|-------------|
| [SITE-MAP.md](references/SITE-MAP.md) | Site map, backend, data model, MCP, tools map, main flows |
| [TOOLS-MAP-DATA.md](references/TOOLS-MAP-DATA.md) | Vibe Coding tools map: Firestore as source of truth, export to `tools.json`, automation |
| [API-EXAMPLES.md](references/API-EXAMPLES.md) | API usage examples |
| [CI-CD.md](references/CI-CD.md) | Integration and deployment |

For a full technical and operational overview in English, use [ARCHITECTURE.md](architecture/ARCHITECTURE.md) and [SITE-MAP.md](references/SITE-MAP.md).

## Testing (`testing/`)

Test reports and migration notes (e.g. V3).

---

**Last updated:** April 2026
