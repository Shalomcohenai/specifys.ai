/**
 * Regression tests for overview readiness gating (false "Overview ready" banner).
 * Run: node backend/server/overview-readiness.test.js
 */

const path = require('path');
const assert = require('assert');

// Node can load the ESM-ish module via dynamic import if package is module;
// these helpers are plain exports — require via createRequire after transpile isn't available.
// Load by evaluating the source as CommonJS-compatible copy:
const fs = require('fs');
const src = fs.readFileSync(
  path.join(__dirname, '../../assets/js/features/spec-viewer/modules/overviewReadiness.js'),
  'utf8'
);
// Strip ESM export keywords for a quick eval harness
const transformed = src
  .replace(/export function/g, 'function')
  .replace(/export \{[^}]+\};?/g, '');
const scope = {};
// eslint-disable-next-line no-new-func
new Function(
  'exports',
  `${transformed}
  exports.hasRenderableOverview = hasRenderableOverview;
  exports.shouldShowOverviewReadyBanner = shouldShowOverviewReadyBanner;
  exports.getOverviewGenerationAttention = getOverviewGenerationAttention;
  exports.extractOverviewUserInput = extractOverviewUserInput;
`
)(scope);

const {
  hasRenderableOverview,
  shouldShowOverviewReadyBanner,
  getOverviewGenerationAttention,
  extractOverviewUserInput
} = scope;

let passed = 0;
let failed = 0;
function ok(name, condition) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
}

console.log('\n=== Overview readiness gating ===');

ok('empty overview not renderable', !hasRenderableOverview(null));
ok('empty string not renderable', !hasRenderableOverview(''));
ok('tiny string not renderable', !hasRenderableOverview('hi'));
ok(
  'valid overview object renderable',
  hasRenderableOverview({
    ideaSummary: 'A CRM for freelancers',
    coreFeaturesOverview: ['Invoices'],
    screenDescriptions: { screens: [{ name: 'Home' }] }
  })
);
ok(
  'JSON string overview renderable',
  hasRenderableOverview(
    JSON.stringify({
      ideaSummary: 'Agency hub',
      coreFeaturesOverview: ['Templates'],
      screenDescriptions: { screens: [{ name: 'Dashboard' }] }
    })
  )
);

ok(
  'banner hidden while generating with no content',
  !shouldShowOverviewReadyBanner({
    overview: null,
    status: { overview: 'generating', technical: 'pending', market: 'pending', design: 'pending' },
    overviewApproved: false
  })
);

ok(
  'banner hidden when status ready but content missing',
  !shouldShowOverviewReadyBanner({
    overview: null,
    status: { overview: 'ready', technical: 'pending', market: 'pending', design: 'pending' },
    overviewApproved: false
  })
);

const readySpec = {
  overview: JSON.stringify({
    ideaSummary: 'Agency hub for client status',
    coreFeaturesOverview: ['Milestones'],
    screenDescriptions: { screens: [{ name: 'Projects' }] }
  }),
  status: { overview: 'ready', technical: 'pending', market: 'pending', design: 'pending' },
  overviewApproved: false
};
ok('banner shown when overview truly ready', shouldShowOverviewReadyBanner(readySpec));

ok(
  'banner hidden once technical generating',
  !shouldShowOverviewReadyBanner({
    ...readySpec,
    status: { ...readySpec.status, technical: 'generating' },
    overviewApproved: true
  })
);

ok(
  'attention on error',
  getOverviewGenerationAttention({
    overview: null,
    status: { overview: 'error' },
    updatedAt: new Date()
  }).needsAttention === true
);

ok(
  'no attention while freshly generating',
  getOverviewGenerationAttention({
    overview: null,
    status: { overview: 'generating' },
    updatedAt: new Date()
  }).needsAttention === false
);

ok(
  'stuck generating needs attention',
  getOverviewGenerationAttention(
    {
      overview: null,
      status: { overview: 'generating' },
      updatedAt: new Date(Date.now() - 6 * 60 * 1000)
    },
    { stuckMs: 5 * 60 * 1000 }
  ).reason === 'stuck'
);

ok(
  'extracts userInput field',
  extractOverviewUserInput({ userInput: 'Build a CRM', answers: ['other'] }) === 'Build a CRM'
);
ok(
  'falls back to answers[0]',
  extractOverviewUserInput({ answers: ['From answers'] }) === 'From answers'
);

// Source-level guards (catch regressions that reintroduce false-ready banner)
const viewerMain = fs.readFileSync(
  path.join(__dirname, '../../assets/js/features/spec-viewer/spec-viewer-main.js'),
  'utf8'
);
const viewerHtml = fs.readFileSync(
  path.join(__dirname, '../../pages/spec-viewer.html'),
  'utf8'
);

ok('viewer wires syncOverviewReadyBanner', viewerMain.includes('syncOverviewReadyBanner'));
ok('viewer never defaults missing overview status to ready', viewerMain.includes("data.status?.overview || 'pending'"));
ok(
  'approval container starts hidden',
  viewerHtml.includes('id="approval-container"') &&
    /id="approval-container"[^>]*\bhidden\b/.test(viewerHtml.replace(/\s+/g, ' '))
);
ok('viewer polls while overview generating', viewerMain.includes("specData.status?.overview === 'generating'"));
ok('viewer can retry overview', viewerMain.includes('retryOverviewGeneration'));

const indexJs = fs.readFileSync(
  path.join(__dirname, '../../assets/js/features/index/index.js'),
  'utf8'
);
ok('create flow persists userInput on spec', indexJs.includes('userInput: rawUserInputForApi'));
ok('create flow retries dead useDirectAPI path', indexJs.includes('data.useDirectAPI && data.userInput'));

console.log(`\nOverview readiness: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
