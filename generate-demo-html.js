#!/usr/bin/env node
/**
 * Generate demo HTML snippets from an enriched example fixture.
 * Usage: node generate-demo-html.js [exampleId]
 * Default: relaydesk
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exampleId = process.argv[2] || 'relaydesk';
const fixturePath = path.join(__dirname, 'assets/data/example-specs', `${exampleId}.json`);
if (!fs.existsSync(fixturePath)) {
  console.error(`Missing fixture: ${fixturePath}`);
  console.error('Run: npm run build:example-specs');
  process.exit(1);
}

const demoSpecData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

const formatterPath = path.join(__dirname, 'assets/js/features/demo-spec/demo-spec-formatter.js');
const formatterContent = fs.readFileSync(formatterPath, 'utf8');
const sandbox = {
  window: {},
  console,
  demoSpecData,
  document: {
    createElement() {
      return {
        set textContent(v) {
          this._t = String(v ?? '');
        },
        get innerHTML() {
          return String(this._t ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        }
      };
    }
  }
};
vm.runInNewContext(
  formatterContent +
    '\nthis.formatOverview=formatOverview;this.formatTechnical=formatTechnical;this.formatMarket=formatMarket;this.formatDesign=formatDesign;this.formatPrompts=formatPrompts;',
  sandbox
);

const { formatOverview, formatTechnical, formatMarket, formatDesign, formatPrompts } = sandbox;

const overviewHtml = formatOverview(demoSpecData.overview);
const technicalHtml = formatTechnical(demoSpecData.technical);
const marketHtml = formatMarket(demoSpecData.market);
const designHtml = formatDesign(demoSpecData.design);
const promptsHtml = formatPrompts(demoSpecData.prompts);

let diagramsHtml = '';
const arch = demoSpecData.architecture || {};
const tech = demoSpecData.technical || {};
const diagramPairs = [
  ['System context', tech.architectureOverview?.systemContextDiagramMermaid],
  ['Architecture context', arch.contextDiagramMermaid],
  ['Containers', arch.containerDiagramMermaid],
  ['ER diagram', tech.databaseSchema?.erDiagramMermaid]
];
diagramPairs.forEach(([name, code], index) => {
  if (!code) return;
  diagramsHtml += `<div class="diagram-section-container">`;
  diagramsHtml += `<h3 class="diagram-section-title"><i class="fa fa-project-diagram" aria-hidden="true"></i> ${name}</h3>`;
  diagramsHtml += `<div class="diagram-container">`;
  diagramsHtml += `<div class="mermaid" id="mermaid-diagram-${index}">${String(code).trim()}</div>`;
  diagramsHtml += `</div></div>`;
});

const output = {
  exampleId,
  product: demoSpecData.meta?.product || exampleId,
  overview: overviewHtml,
  technical: technicalHtml,
  market: marketHtml,
  design: designHtml,
  diagrams: diagramsHtml,
  prompts: promptsHtml
};

const outPath = '/tmp/demo-html-output.json';
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`HTML generated for ${exampleId} (${output.product}) → ${outPath}`);
