#!/usr/bin/env node
/**
 * Generate / refresh the enriched sample specification fixture.
 *
 * Usage:
 *   node scripts/generate-enriched-sample.mjs
 *   node scripts/generate-enriched-sample.mjs --fixture-only   (default)
 *   node scripts/generate-enriched-sample.mjs --live           (optional OpenAI path; falls back to fixture)
 *
 * Outputs:
 *   backend/fixtures/sample-spec-enriched.json
 *   backend/fixtures/sample-spec-architecture.md
 *
 * Then runs scripts/validate-enriched-sample.mjs
 *
 * Re-validate anytime:
 *   node scripts/validate-enriched-sample.mjs
 */
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outJson = path.join(root, 'backend/fixtures/sample-spec-enriched.json');
const outMd = path.join(root, 'backend/fixtures/sample-spec-architecture.md');

const live = process.argv.includes('--live');

function loadDotEnv() {
  const envPath = path.join(root, 'backend/.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]]) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

function writeArchitectureMarkdown(architecture) {
  const lines = ['# Sample Architecture — RelayDesk', ''];
  if (architecture.executiveSummary) {
    lines.push('## Executive summary', '', architecture.executiveSummary, '');
  }
  if (architecture.contextDiagramMermaid) {
    lines.push('## Context', '', '```mermaid', architecture.contextDiagramMermaid.trim(), '```', '');
  }
  if (architecture.containerDiagramMermaid) {
    lines.push('## Containers', '', '```mermaid', architecture.containerDiagramMermaid.trim(), '```', '');
  }
  if (Array.isArray(architecture.adrs)) {
    lines.push('## ADRs', '');
    architecture.adrs.forEach((adr) => {
      lines.push(`### ${adr.title}`, '');
      lines.push(`**Context:** ${adr.context}`, '');
      lines.push('**Options:**', ...(adr.options || []).map((o) => `- ${o}`), '');
      lines.push(`**Decision:** ${adr.decision}`, '');
      lines.push('**Consequences:**', ...(adr.consequences || []).map((c) => `- ${c}`), '');
      lines.push(`**Revisit when:** ${adr.revisitWhen}`, '');
    });
  }
  if (Array.isArray(architecture.failureModes)) {
    lines.push('## Failure modes', '');
    architecture.failureModes.forEach((f) => {
      lines.push(`### ${f.failure}`, '');
      lines.push(`- Impact: ${f.impact}`);
      lines.push(`- Detection: ${f.detection}`);
      lines.push(`- Runbook: ${f.runbook}`, '');
    });
  }
  fs.writeFileSync(outMd, lines.join('\n'));
}

async function tryLiveGeneration() {
  loadDotEnv();
  const key = process.env.OPENAI_SPEC_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) {
    console.warn('[live] No OpenAI key — using fixture path');
    return null;
  }
  console.warn('[live] Live pipeline generation is expensive; this script keeps the curated fixture as source of truth.');
  console.warn('[live] Falling back to fixture-only. Use canary service for full E2E OpenAI runs.');
  return null;
}

async function main() {
  fs.mkdirSync(path.dirname(outJson), { recursive: true });

  if (live) {
    await tryLiveGeneration();
  }

  // Curated high-quality fixture is produced by the builder CJS (keeps Zod-compatible shapes).
  const builder = path.join(__dirname, 'build-enriched-sample-fixture.cjs');
  if (!fs.existsSync(builder)) {
    // Rebuild from existing JSON if builder missing but fixture exists
    if (!fs.existsSync(outJson)) {
      console.error('Missing builder and fixture. Restore scripts/build-enriched-sample-fixture.cjs');
      process.exit(1);
    }
    console.log('Using existing fixture:', outJson);
  } else {
    const r = spawnSync(process.execPath, [builder], { cwd: root, stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status || 1);
  }

  const spec = JSON.parse(fs.readFileSync(outJson, 'utf8'));
  if (spec.architecture) writeArchitectureMarkdown(spec.architecture);

  const v = spawnSync(process.execPath, [path.join(__dirname, 'validate-enriched-sample.mjs'), outJson], {
    cwd: root,
    stdio: 'inherit'
  });
  process.exit(v.status || 0);
}

main();
