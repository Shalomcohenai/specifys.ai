/**
 * Demo Spec Data — compatibility shim.
 *
 * Public demo content is the NEW enriched schema, loaded from:
 *   /assets/data/example-specs/<id>.json
 *   (source of truth: backend/fixtures/examples/ + sample-spec-enriched.json)
 *
 * Prefer demo-spec-main.js which fetches JSON and renders via Enriched* UI modules.
 * This file no longer embeds the legacy Taskify Pro shape.
 */
(function (global) {
  'use strict';

  global.DEMO_SPEC_ENRICHED = true;
  global.DEMO_SPEC_DATA_URL = '/assets/data/example-specs/relaydesk.json';
  global.DEMO_SPEC_MANIFEST_URL = '/assets/data/example-specs/manifest.json';

  // Lazy placeholder — real data is assigned by demo-spec-main.js after fetch.
  global.demoSpecData = global.demoSpecData || null;
})(typeof window !== 'undefined' ? window : globalThis);
