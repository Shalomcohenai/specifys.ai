#!/usr/bin/env node
/**
 * Homepage restructure verification checks.
 * Run: node scripts/verify-index-restructure.cjs
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

const index = read('index.html');
const indexCss = read('assets/css/pages/index.css');
const valueCss = read('assets/css/pages/index-value.css');
const critical = read('_includes/critical-lcp-home.html');
const frontMatter = index.split('---')[1] || '';

// --- Overlap / CSS root causes ---
check(
  'No negative margin on browser-window-preview',
  !/browser-window-preview[\s\S]{0,400}margin-bottom:\s*-\d+/.test(indexCss) &&
    !/margin-bottom:\s*-\d+px/.test(
      (indexCss.match(/\.browser-window-preview\s*\{[^}]+\}/g) || []).join('\n')
    ),
  'Negative margin-bottom on .browser-window-preview must be removed'
);

const previewBlocks = indexCss.match(/\.browser-window-preview[^{]*\{[^}]*\}/g) || [];
const hasNegPreviewMargin = previewBlocks.some((b) => /margin-bottom:\s*-/.test(b));
check('Preview blocks have no negative margin-bottom', !hasNegPreviewMargin);

check(
  'No obsolete why-section.prompt-section margin-top 150px',
  !/\.why-section\.prompt-section\s*\{[^}]*margin-top:\s*150px/.test(indexCss)
);

check(
  'Critical LCP uses flex-start / overflow visible',
  /justify-content:\s*flex-start/.test(critical) &&
    /overflow:\s*visible/.test(critical) &&
    !/align-items:\s*center;\s*\n\s*justify-content:\s*center/.test(critical)
);

check(
  'No !important in index-value.css',
  !valueCss.includes('!important')
);

check(
  'No !important in critical-lcp-home',
  !critical.includes('!important')
);

// --- Front matter / unused CSS ---
check(
  'Home does not load index-why-sections.css',
  !frontMatter.includes('index-why-sections.css')
);
check(
  'Home does not load index-process-flow.css',
  !frontMatter.includes('index-process-flow.css')
);
check(
  'Home does not load why.js',
  !frontMatter.includes('why.js')
);
check('Home loads index-value.css', frontMatter.includes('index-value.css'));

// --- IA: no why-sections on home ---
check(
  'No why-section blocks on homepage',
  !index.includes('class="why-section') && !index.includes("class='why-section")
);
check(
  'No promptAnimationContainer on homepage',
  !index.includes('promptAnimationContainer')
);

// --- Hero ATF ---
check(
  'Audience picker inside hero (drives H1)',
  (() => {
    const heroStart = index.indexOf('class="hero-section"');
    const heroEnd = index.indexOf('</section>', heroStart);
    const picker = index.indexOf('id="audiencePicker"');
    return picker > heroStart && picker < heroEnd;
  })()
);
check(
  'Audience picker before how-it-works',
  index.includes('id="audiencePicker"') &&
    index.indexOf('id="audiencePicker"') < index.indexOf('id="how-it-works"')
);
check(
  'Single H1 outcome messaging',
  (index.match(/class="hero-description-text"/g) || []).length === 1 &&
    index.includes('Plan your app before AI writes a single line of code')
);
check(
  'One supporting tagline',
  index.includes('Stop prompting. Start planning.') &&
    !index.includes('hero-value-subtext')
);
check(
  'Primary Start free CTA',
  index.includes('id="startButton"') && index.includes('Start free')
);
check(
  'Secondary See example scrolls to #example-specs',
  /hero-cta-see-example[^>]*href="#example-specs"/.test(index) ||
    /href="#example-specs"[^>]*hero-cta-see-example/.test(index)
);
check(
  'Spec browser preview in hero',
  index.includes('browser-window-preview') && index.includes('RelayDesk')
);
check(
  'planningContainer preserved',
  index.includes('id="planningContainer"')
);

// --- Section order ---
const markers = [
  { id: 'value', re: /id="value"|class="value-section"/ },
  { id: 'how-it-works', re: /id="how-it-works"/ },
  { id: 'example-specs', re: /id="example-specs"/ },
  { id: 'mcp-bridge', re: /id="mcp-bridge"/ },
  { id: 'faq', re: /id="faq"|class="extra-sections"/ },
  { id: 'final-cta', re: /class="final-cta"/ }
];

const positions = markers.map((m) => {
  const match = index.match(m.re);
  return { id: m.id, pos: match ? index.search(m.re) : -1 };
});

positions.forEach((p) => {
  check(`Section present: ${p.id}`, p.pos >= 0);
});

for (let i = 1; i < positions.length; i++) {
  const prev = positions[i - 1];
  const cur = positions[i];
  if (prev.pos >= 0 && cur.pos >= 0) {
    check(
      `Order: ${prev.id} before ${cur.id}`,
      prev.pos < cur.pos,
      `${prev.id}@${prev.pos} vs ${cur.id}@${cur.pos}`
    );
  }
}

check(
  'Hero before value section',
  index.indexOf('class="hero-section"') < index.search(/id="value"|class="value-section"/)
);

check(
  'How it works has 3 steps',
  index.includes('Questions') &&
    index.includes('how-works-step') &&
    (index.match(/how-works-step"/g) || []).length >= 3
);

check(
  'Merged value-numbers (no separate proof-strip)',
  index.includes('value-numbers') && !index.includes('proof-strip')
);

check(
  'No separate roi-grid on homepage',
  !index.includes('roi-grid')
);

check(
  'SEO home content buried or minimal',
  /id="seo-home-content"[^>]*class="[^"]*visually-hidden/.test(index) ||
    /class="visually-hidden"[^>]*id="seo-home-content"/.test(index)
);

check(
  'No Cursor promo box in FAQ',
  !index.includes('Learn About Cursor & Windsurf Integration')
);

check(
  'Final CTA Start free present',
  index.includes('id="finalStartButton"') ||
    (index.includes('final-cta') && index.includes('Start free'))
);

check(
  'Example specs demo links preserved',
  index.includes('demo-spec.html?example=crm') && index.includes('See example')
);

check(
  'No Tools Map / Pricing as homepage sections',
  !index.includes('Vibe Coding Tools Map') &&
    !/id="pricing"|class="pricing-section"/.test(index)
);

// Print report
console.log('\nHomepage restructure verification\n' + '='.repeat(40));
results.forEach((r) => {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail && !r.ok ? ' — ' + r.detail : ''}`);
});
console.log('='.repeat(40));
console.log(failed === 0 ? `All ${results.length} checks passed.` : `${failed} of ${results.length} checks failed.`);
process.exit(failed === 0 ? 0 : 1);
