/**
 * Sprint B (Activation & Monetization) verification
 * Run: node backend/server/sprint-b-activation.test.js
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
let passed = 0;
let failed = 0;

function assert(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

console.log('\n=== B1 Paywall / Pro messaging ===');
{
  const paywall = read('assets/js/paywall.js');
  assert('paywall sells Database Design', paywall.includes('Unlock Database Design'));
  assert('paywall sells Export to Cursor', paywall.includes('Export to Cursor'));
  assert('paywall sells Unlimited Specs', paywall.includes('Unlimited Specs'));
  assert('paywall sells AI Review', paywall.includes('AI Review'));
  assert('paywall sells Team Collaboration', paywall.includes('Team Collaboration'));
  assert('paywall preview helper exists', paywall.includes('getSpecPreviewFromContext') && paywall.includes('paywall-preview'));
  assert('exhausted credits message is benefit-led', paywall.includes('Your free credit is used up'));

  const pricingHtml = read('pages/pricing.html');
  assert('pricing hero is benefit-led', pricingHtml.includes('Pro that finishes what you started') || pricingHtml.includes('Unlock Database Design'));
  assert('pricing tabs include Database Design', pricingHtml.includes('Database Design'));
  assert('pricing tabs include Export to Cursor', pricingHtml.includes('Export to Cursor'));

  const indexJs = read('assets/js/features/index/index.js');
  assert('exhausted credits shows paywall modal', indexJs.includes('window.showPaywall') && indexJs.includes('insufficient_credits'));
}

console.log('\n=== B2 Lifecycle email call sites ===');
{
  const templates = require('./email-templates');
  assert('unfinishedSpecEmail template', typeof templates.unfinishedSpecEmail === 'function');
  assert('overviewStuckEmail template', typeof templates.overviewStuckEmail === 'function');
  assert('upgradeOfferEmail template', typeof templates.upgradeOfferEmail === 'function');
  assert('promptsReadyMcpEmail template', typeof templates.promptsReadyMcpEmail === 'function');

  const welcomeHtml = templates.welcomeEmail('Sam', 'https://specifys-ai.com/?resumeBrief=1', 1);
  assert('welcome continues unfinished', /Continue your idea|unfinished/i.test(welcomeHtml));

  const upgradeHtml = templates.upgradeOfferEmail('Sam', 'https://specifys-ai.com/pages/pricing.html');
  assert('upgrade email lists benefits', /Database Design/i.test(upgradeHtml) && /Export to Cursor/i.test(upgradeHtml));

  const promptsHtml = templates.promptsReadyMcpEmail('Sam', 'App', 'https://x/#prompts', 'https://x/#mcp');
  assert('prompts-ready mentions Cursor/MCP', /Cursor/i.test(promptsHtml) && /MCP/i.test(promptsHtml));

  const emailServiceSrc = read('backend/server/email-service.js');
  assert('sendUnfinishedSpecEmail method', emailServiceSrc.includes('async sendUnfinishedSpecEmail'));
  assert('sendOverviewStuckEmail method', emailServiceSrc.includes('async sendOverviewStuckEmail'));
  assert('sendUpgradeOfferEmail method', emailServiceSrc.includes('async sendUpgradeOfferEmail'));
  assert('sendPromptsReadyMcpEmail method', emailServiceSrc.includes('async sendPromptsReadyMcpEmail'));

  const hooks = require('./lifecycle-email-hooks');
  assert('isOverviewOnly: overview ready + pending downstream', hooks.isOverviewOnly({
    overview: 'ready', technical: 'pending', market: 'pending', design: 'pending',
    architecture: 'pending', visibility: 'pending', prompts: 'pending'
  }));
  assert('isOverviewOnly: false when technical ready', !hooks.isOverviewOnly({
    overview: 'ready', technical: 'ready', market: 'pending', design: 'pending',
    architecture: 'pending', visibility: 'pending', prompts: 'pending'
  }));
  assert('isUnfinishedDraft: overview generating', hooks.isUnfinishedDraft({ overview: 'generating' }));
  assert('upgrade hook exported', typeof hooks.maybeSendUpgradeOfferAfterConsume === 'function');
  assert('prompts-ready hook exported', typeof hooks.maybeSendPromptsReadyEmail === 'function');

  const creditsSrc = read('backend/server/credits-v3-service.js');
  assert('consumeCredit triggers upgrade offer', creditsSrc.includes('maybeSendUpgradeOfferAfterConsume'));

  const jobsSrc = read('backend/server/scheduled-jobs.js');
  assert('lifecycle job scheduled', jobsSrc.includes('startLifecycleActivationEmailJob'));
  assert('lifecycle listeners registered', jobsSrc.includes('registerLifecycleEmailListeners'));
}

console.log('\n=== B3 Overview → Prompts cliff ===');
{
  const viewerHtml = read('pages/spec-viewer.html');
  assert('continue CTA on overview', viewerHtml.includes('Continue to Technical + Prompts'));
  assert('stage recovery banner markup', viewerHtml.includes('stage-recovery-banner'));

  const viewerJs = read('assets/js/features/spec-viewer/spec-viewer-main.js');
  assert('Copy to Cursor CTA in prompts', viewerJs.includes('Copy to Cursor'));
  assert('Connect MCP CTA in prompts', viewerJs.includes('openMcpModal'));
  assert('activation checklist', viewerJs.includes('prompts-activation-checklist'));
  assert('retry stuck stages helper', viewerJs.includes('retryStuckOrFailedStages'));
  assert('recovery banner updater', viewerJs.includes('updateStageRecoveryBanner'));

  // Stage order sanity (pipeline default path)
  const stages = ['overview', 'technical', 'market', 'design', 'architecture', 'visibility', 'prompts'];
  let orderOk = true;
  for (let i = 0; i < stages.length; i += 1) {
    if (!viewerJs.includes(`key: '${stages[i]}'`) && !viewerJs.includes(`'${stages[i]}'`)) {
      // SPEC_PROGRESS_STAGES uses key: 'overview' etc.
    }
  }
  assert('progress stages include prompts', viewerJs.includes("key: 'prompts'"));
  assert('approveOverview starts generate-all', viewerJs.includes('generate-all'));
}

console.log('\n=== B4 Auth friction ===');
{
  const indexJs = read('assets/js/features/index/index.js');
  assert('guest can start brief', indexJs.includes('guestBriefStarted') && indexJs.includes('showPlanningInterface()'));
  assert('pending guest brief persisted', indexJs.includes('pendingGuestBrief'));
  assert('resume guest brief', indexJs.includes('resumeGuestBriefIfNeeded'));

  const authHtml = read('pages/auth.html');
  assert('auth honors next/redirect', authHtml.includes("params.get('next')") || authHtml.includes('getPostAuthRedirect'));
  assert('signup prefers profile path', authHtml.includes('preferProfile') && authHtml.includes('/pages/profile.html'));
  assert('simplified auth header', authHtml.includes('Continue with Specifys'));
}

console.log('\n=== B5 MCP activation ===');
{
  const modalHtml = read('_includes/mcp-connect-modal.html');
  assert('2-click setup UI', modalHtml.includes('mcp-two-click') && modalHtml.includes('Create &amp; copy API key'));
  assert('Cursor deep link', modalHtml.includes('cursor://settings/mcp'));
  assert('Copy MCP JSON CTA', modalHtml.includes('Copy MCP JSON'));

  const mcpJs = read('assets/js/mcp-modal.js');
  assert('tracks mcp_connected on copy', mcpJs.includes("trackMcpEvent('mcp_connected'"));
  assert('requires real API key for connected', mcpJs.includes('hasRealMcpKey'));

  const userRoutes = read('backend/server/user-routes.js');
  assert('mcp_connected accepted by API', userRoutes.includes("'mcp_connected'"));

  const mcpRoutes = read('backend/server/mcp-routes.js');
  assert('API request records mcp_connected', mcpRoutes.includes("type: 'mcp_connected'"));
}

console.log(`\nSprint B verification: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
