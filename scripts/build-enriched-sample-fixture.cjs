#!/usr/bin/env node
/**
 * Ensures backend/fixtures/sample-spec-enriched.json exists and refreshes meta.generatedAt.
 * The curated RelayDesk fixture is the source of truth for enriched schema validation.
 * To rebuild content, edit the JSON (or re-run the generation heredoc used in development)
 * then: node scripts/validate-enriched-sample.mjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const fixturePath = path.join(root, 'backend/fixtures/sample-spec-enriched.json');

if (!fs.existsSync(fixturePath)) {
  console.error('Missing fixture:', fixturePath);
  console.error('Restore from git or regenerate the RelayDesk enriched sample.');
  process.exit(1);
}

const spec = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
spec.meta = spec.meta || {};
spec.meta.generatedAt = new Date().toISOString();
spec.meta.source = 'scripts/build-enriched-sample-fixture.cjs';
fs.writeFileSync(fixturePath, JSON.stringify(spec, null, 2));
console.log('Refreshed meta on', fixturePath);
