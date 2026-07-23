# Enriched sample specification

## Files

- `sample-spec-enriched.json` — full RelayDesk sample matching enriched Zod schemas (overview → prompts), with valid Mermaid diagrams.
- `sample-spec-architecture.md` — architecture dump (ADRs, diagrams) for quick reading.
- `examples/` — public Example Specs (distinct products) used by the homepage + `/pages/demo-spec.html`:
  - `relaydesk.json` — Support inbox (gold demo)
  - `crm.json` — Pipeboard
  - `marketplace.json` — Stallio
  - `booking.json` — Slotly
  - `ai-saas.json` — PromptForge
  - `social.json` — Trailfeed
  - `manifest.json` — catalog metadata

Static copies for the site live at `assets/data/example-specs/` (same JSON). Rebuild with:

```bash
npm run build:example-specs
```

## Validate

From repo root:

```bash
npm run validate:enriched-sample
npm run validate:example-specs
# or
node scripts/validate-enriched-sample.mjs
node scripts/validate-enriched-sample.mjs --all
```

## Refresh meta / re-run generate wrapper

```bash
npm run generate:enriched-sample
```

`--live` falls back to the curated fixture (full OpenAI E2E remains the pipeline canary).

## Product

**RelayDesk** — lightweight shared support inbox for indie SaaS (macros + SLA lite). Used to prove schema/prompt/UI enrichment and Mermaid integrity. Homepage Example Specs link to additional domain-specific enriched specs above.
