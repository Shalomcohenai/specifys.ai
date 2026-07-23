#!/usr/bin/env node
/**
 * Sprint A (Value Communication) verification checks.
 * Run: node scripts/verify-sprint-a.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let failed = 0;
const results = [];

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed += 1;
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

// A1 — Hero + single message
check('index.html exists', exists('index.html'));
const index = read('index.html');
check(
  'A1 tagline locked',
  index.includes('Stop prompting. Start planning.'),
  'Expected hero tagline'
);
check(
  'A1 outcome H1',
  /Plan your app before AI writes a single line of code/.test(index),
  'Expected outcome-oriented H1'
);
check(
  'A1 Start free CTA',
  index.includes('Start free') && index.includes('id="startButton"'),
  'Primary CTA Start free'
);
check(
  'A1 See example CTA',
  (index.includes('See example') && index.includes('href="#example-specs"')) ||
    (index.includes('See example') && index.includes('/pages/demo-spec.html')),
  'Secondary See example (scroll or demo)'
);
check(
  'A1 no Why? competing CTA in hero',
  !/hero-cta-button-secondary[^>]*>\s*Why\?/.test(index),
  'Why? should be removed from hero'
);
check(
  'A1 MCP teaser removed from hero',
  !index.includes('hero-mcp-teaser'),
  'MCP teaser should not clutter above the fold'
);
check(
  'A1 real Spec preview present',
  index.includes('browser-window-preview') && index.includes('RelayDesk'),
  'Browser Spec preview with enriched RelayDesk content'
);

// A2 — Value Before/After + merged numbers (proof+ROI)
check(
  'A2 value numbers or legacy proof',
  (index.includes('value-numbers') || index.includes('proof-strip')) && index.includes('450+')
);
check('A2 before/after', index.includes('before-after') && index.includes('Without Specifys'));
check('A2 ROI numbers', index.includes('70%') && index.includes('~4 min') && index.includes('~25 pages'));
check('A2 value CSS', exists('assets/css/pages/index-value.css'));
check(
  'A2 no !important in value CSS',
  !read('assets/css/pages/index-value.css').includes('!important')
);

// A3 — Example Specs
check('A3 homepage section', index.includes('id="example-specs"') && index.includes('See example'));
check('A3 example page', exists('pages/example-specs.html'));
const examplesPage = read('pages/example-specs.html');
['CRM', 'Marketplace', 'Booking', 'AI SaaS', 'Social', 'RelayDesk', 'Pipeboard'].forEach((name) => {
  check(`A3 example: ${name}`, examplesPage.includes(name));
});
check(
  'A3 demo uses enriched example query',
  examplesPage.includes('demo-spec.html?example=') || index.includes('demo-spec.html?example='),
  'Example links should target ?example='
);
check('A3 templates JS', exists('assets/js/features/index/example-templates.js'));
check(
  'A3 example demo links',
  index.includes('demo-spec.html?example=crm') && index.includes('See example')
);

// A4 — Blog CTAs
check('A4 product-cta include', exists('_includes/product-cta.html'));
const cta = read('_includes/product-cta.html');
check(
  'A4 CTA copy',
  cta.includes('Generate this PRD automatically') &&
    cta.includes('Try Free') &&
    cta.includes('Create your Spec')
);
check(
  'A4 post layout includes CTA',
  read('_layouts/post.html').includes('product-cta.html')
);
check(
  'A4 article.js injects CTA',
  read('assets/js/pages/article.js').includes('Generate this PRD automatically')
);
check(
  'A4 post.js lazy images',
  read('assets/js/pages/post.js').includes("setAttribute('loading', 'lazy')")
);

// A5 — Audience picker
check('A5 audience picker markup', index.includes('id="audiencePicker"') && index.includes('Founder'));
check('A5 audience JS', exists('assets/js/features/index/audience-picker.js'));
const audJs = read('assets/js/features/index/audience-picker.js');
['founder', 'developer', 'pm', 'agency'].forEach((id) => {
  check(`A5 persona: ${id}`, audJs.includes(id));
});

// Header Examples link
check(
  'Nav Examples link',
  read('_includes/header.html').includes('example-specs.html')
);

// Print report
console.log('\nSprint A verification\n' + '='.repeat(40));
results.forEach((r) => {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail && !r.ok ? ' — ' + r.detail : ''}`);
});
console.log('='.repeat(40));
console.log(failed === 0 ? `All ${results.length} checks passed.` : `${failed} of ${results.length} checks failed.`);
process.exit(failed === 0 ? 0 : 1);
