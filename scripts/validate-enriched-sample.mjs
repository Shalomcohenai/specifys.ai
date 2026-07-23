#!/usr/bin/env node
/**
 * Validate the enriched sample specification.
 *
 * Usage:
 *   node scripts/validate-enriched-sample.mjs
 *   node scripts/validate-enriched-sample.mjs path/to/spec.json
 *
 * Checks:
 *  - Zod parseAndValidateStage for overview/technical/market/design/architecture/visibility/prompts
 *  - Mermaid sanitize + validate for all DIAGRAM_FIELDS
 *  - Design color hex coherence
 *  - Architecture ADRs >= 3 when present
 *
 * Exit 0 on PASS, 1 on FAIL.
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const { parseAndValidateStage } = require(path.join(root, 'backend/schemas/spec-schemas.js'));
const {
  DIAGRAM_FIELDS,
  sanitizeMermaid,
  validateMermaid,
  getByPath
} = require(path.join(root, 'backend/schemas/mermaid-validator.js'));

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function loadSpec(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function checkColors(design, errors) {
  const colors = design?.visualStyleGuide?.colors;
  if (!colors || typeof colors !== 'object') return;
  for (const [key, val] of Object.entries(colors)) {
    if (val == null) continue;
    if (typeof val !== 'string' || !HEX_RE.test(val.trim())) {
      errors.push(`design.colors.${key} is not a hex color: ${val}`);
    }
  }
  const themes = design?.visualStyleGuide?.themes;
  if (themes?.light) {
    for (const [key, val] of Object.entries(themes.light)) {
      if (key === 'name' || val == null) continue;
      if (typeof val === 'string' && val.startsWith('#') && !HEX_RE.test(val.trim())) {
        errors.push(`design.themes.light.${key} invalid hex: ${val}`);
      }
    }
  }
}

function validateOne(fixturePath, { quiet } = {}) {
  if (!quiet) console.log(`Validating: ${fixturePath}`);
  const spec = loadSpec(fixturePath);
  const errors = [];
  const stages = ['overview', 'technical', 'market', 'design', 'architecture', 'visibility', 'prompts'];

  for (const stage of stages) {
    if (spec[stage] == null) {
      errors.push(`missing stage key: ${stage}`);
      continue;
    }
    try {
      parseAndValidateStage(stage, { [stage]: spec[stage] });
      if (!quiet) console.log(`  ✓ schema ${stage}`);
    } catch (e) {
      const detail = e.errors ? JSON.stringify(e.errors, null, 2) : e.message;
      errors.push(`schema ${stage}: ${detail}`);
      if (!quiet) console.log(`  ✗ schema ${stage}`);
    }
  }

  for (const [stage, fields] of Object.entries(DIAGRAM_FIELDS)) {
    const rootObj = spec[stage];
    if (!rootObj) continue;
    for (const field of fields) {
      const raw = getByPath(rootObj, field.path);
      if (raw == null || raw === '') {
        if (!field.nullable) errors.push(`${stage}.${field.path}: required diagram missing`);
        continue;
      }
      const sanitized = sanitizeMermaid(raw);
      if (sanitized !== raw && /[\u2018\u2019\u201C\u201D]/.test(raw)) {
        errors.push(`${stage}.${field.path}: contains smart quotes (will sanitize but prefer clean source)`);
      }
      const verdict = validateMermaid(sanitized, { allowEmpty: field.nullable });
      if (!verdict.ok) {
        errors.push(`${stage}.${field.path}: ${verdict.errors.join('; ')}`);
        if (!quiet) console.log(`  ✗ mermaid ${stage}.${field.path}`);
      } else if (!quiet) {
        console.log(`  ✓ mermaid ${stage}.${field.path}`);
      }
    }
  }

  checkColors(spec.design, errors);

  if (Array.isArray(spec.architecture?.adrs) && spec.architecture.adrs.length < 3) {
    errors.push('architecture.adrs must have at least 3 entries when present');
  } else if (Array.isArray(spec.architecture?.adrs) && !quiet) {
    console.log(`  ✓ architecture.adrs (${spec.architecture.adrs.length})`);
  }

  if (!spec.prompts?.fullPrompt || spec.prompts.fullPrompt.length < 500) {
    errors.push('prompts.fullPrompt too short');
  } else if (!quiet) {
    console.log(`  ✓ prompts.fullPrompt (${spec.prompts.fullPrompt.length} chars)`);
  }

  const hasVariants =
    /## Variant: Build/i.test(spec.prompts?.fullPrompt || '') &&
    /## Variant: Review/i.test(spec.prompts?.fullPrompt || '') &&
    /## Variant: Tests/i.test(spec.prompts?.fullPrompt || '');
  if (!hasVariants) {
    errors.push('prompts.fullPrompt missing Build/Review/Tests variants');
  } else if (!quiet) {
    console.log('  ✓ prompts Build/Review/Tests variants');
  }

  return errors;
}

function listExampleFixtures() {
  const dir = path.join(root, 'backend/fixtures/examples');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== 'manifest.json')
    .map((f) => path.join(dir, f));
}

function main() {
  const arg = process.argv[2];

  if (arg === '--all' || arg === 'all') {
    const gold = path.join(root, 'backend/fixtures/sample-spec-enriched.json');
    const files = [gold, ...listExampleFixtures()];
    let failed = 0;
    for (const file of files) {
      if (!fs.existsSync(file)) {
        console.error(`FAIL: missing ${file}`);
        failed += 1;
        continue;
      }
      const errors = validateOne(file, { quiet: false });
      if (errors.length) {
        failed += 1;
        console.error(`\nFAIL — ${path.basename(file)}:`);
        errors.forEach((e) => console.error(' -', e));
      } else {
        console.log(`PASS — ${path.basename(file)}\n`);
      }
    }
    if (failed) {
      console.error(`\n${failed} fixture(s) failed.`);
      process.exit(1);
    }
    console.log(`All ${files.length} enriched fixtures passed.`);
    process.exit(0);
  }

  const fixturePath = path.resolve(
    arg || path.join(root, 'backend/fixtures/sample-spec-enriched.json')
  );

  if (!fs.existsSync(fixturePath)) {
    console.error(`FAIL: fixture not found at ${fixturePath}`);
    console.error('Run: node scripts/generate-enriched-sample.mjs');
    process.exit(1);
  }

  const errors = validateOne(fixturePath);
  if (errors.length) {
    console.error('\nFAIL — issues:');
    errors.forEach((e) => console.error(' -', e));
    process.exit(1);
  }

  console.log('\nPASS — enriched sample is schema-valid with intact Mermaid.');
  console.log(`Fixture: ${fixturePath}`);
}

main();
