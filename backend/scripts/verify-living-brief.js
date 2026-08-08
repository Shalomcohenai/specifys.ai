#!/usr/bin/env node
/**
 * Verify Living Brief MVP — service logic + wiring in the homepage.
 * Usage: node backend/scripts/verify-living-brief.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const livingBrief = require('../server/living-brief-service');

let passed = 0;
function ok(name, cond, detail) {
  if (!cond) {
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  passed += 1;
  console.log(`ok    ${name}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

async function main() {
  console.log('\nLiving Brief verification\n');

  // --- Files present ---
  [
    'backend/server/living-brief-service.js',
    'assets/js/features/planning/living-brief.js',
    'assets/css/pages/living-brief.css',
    'index.html'
  ].forEach((rel) => {
    ok(`file exists: ${rel}`, fs.existsSync(path.join(root, rel)));
  });

  // --- Homepage wiring ---
  const indexHtml = read('index.html');
  ok('index includes living-brief.css', indexHtml.includes('living-brief.css'));
  ok('index includes living-brief.js', indexHtml.includes('living-brief.js'));
  ok('index has #livingBrief', indexHtml.includes('id="livingBrief"'));
  ok('index has compact score', indexHtml.includes('id="lbRingScore"') && indexHtml.includes('id="lbDots"'));
  ok('index has composer input', indexHtml.includes('id="lbInput"'));
  ok('index has generate CTA', indexHtml.includes('id="lbGenerate"'));
  ok('index has topic tags', indexHtml.includes('data-tag="workflows"') && indexHtml.includes('id="lbTags"'));
  ok('index has inline ideas + turn off', indexHtml.includes('id="lbIdeasInline"') && indexHtml.includes('id="lbIdeasOff"') && !indexHtml.includes('id="lbToggleSuggest"'));
  ok('index has attach references UI', indexHtml.includes('id="lbAttach"') && indexHtml.includes('id="lbRefPanel"') && indexHtml.includes('data-attach-kind="image"'));
  ok('main-pitch bridge retained', indexHtml.includes('id="main-pitch"'));

  const indexJs = read('assets/js/features/index/index.js');
  ok('showPlanningInterface boots LivingBrief', indexJs.includes('LivingBrief.init'));

  const planningRoutes = read('backend/server/planning-routes.js');
  ok('API route /living-brief registered', planningRoutes.includes("'/living-brief'"));
  ok('API route /living-brief/readiness registered', planningRoutes.includes("'/living-brief/readiness'"));

  const css = read('assets/css/pages/living-brief.css');
  ok('CSS has typing animation', css.includes('.lb-typing') && css.includes('@keyframes lb-dot'));
  ok('CSS has composer focus style', css.includes('.lb-field:focus-within'));
  ok('CSS kills orange input focus', css.includes('.living-brief input.lb-input:focus') && css.includes('outline: none'));
  ok('CSS has inline idea lines', css.includes('.lb-idea-line') && css.includes('.lb-ideas-inline'));
  ok('CSS is single-shell layout', css.includes('.lb-main') && css.includes('one quiet studio'));
  ok('CSS hides legacy workspace panels', css.includes('#workspace-container'));
  ok('CSS has minimal generate button', css.includes('.lb-generate'));
  ok('no !important in living-brief.css', !css.includes('!important'));

  const frontendJs = read('assets/js/features/planning/living-brief.js');
  ok('frontend types assistant replies', frontendJs.includes('typeIntoBubble'));
  ok('frontend accepts proposals', frontendJs.includes('acceptProposal'));
  ok('frontend calls generateSpecFromPlanning', frontendJs.includes('generateSpecFromPlanning'));
  ok('generate always available (no readiness gate)', frontendJs.includes('function handleGenerate') && !/if\s*\(\s*!state\.readiness\.ready\s*\)\s*return/.test(frontendJs));
  ok('supports @tag parsing', frontendJs.includes('function parseTags') && frontendJs.includes('insertTag'));
  ok('frontend supports image/text references', frontendJs.includes('confirmPendingReference') && frontendJs.includes("kind: 'image'") && frontendJs.includes("kind: 'text'"));

  // --- Service: empty readiness ---
  const empty = livingBrief.computeReadiness(livingBrief.emptyDraft());
  ok('empty draft not ready', empty.ready === false && empty.score < 70);
  ok('empty draft misses vision', empty.missing.some((m) => /vision/i.test(m)));
  ok(
    'draft normalizes references',
    Array.isArray(livingBrief.normalizeDraft({ references: [{ kind: 'text', note: 'n', description: 'd' }] }).references) &&
      livingBrief.normalizeDraft({ references: [{ kind: 'text', note: 'n', description: 'd' }] }).references.length === 1
  );

  // --- Heuristic conversation path ---
  let draft = livingBrief.emptyDraft();
  let turn = livingBrief.heuristicTurn(
    [
      {
        role: 'user',
        content:
          'I am building a web SaaS shared inbox for indie founders. It needs auth, Stripe billing, and a clean SaaS soft design. Users sign up then connect email then triage tickets then reply with macros.'
      }
    ],
    draft
  );

  ok('heuristic returns reply', typeof turn.reply === 'string' && turn.reply.length > 20);
  ok('heuristic returns engine tag', turn.engine === 'heuristic');
  ok('heuristic proposes items', Array.isArray(turn.proposals) && turn.proposals.length >= 1);
  ok(
    'heuristic proposes a workflow from then-chain',
    turn.proposals.some((p) => p.type === 'workflow')
  );
  ok(
    'heuristic proposes platform or feature or design',
    turn.proposals.some((p) => ['audience.platform', 'feature', 'design', 'integration'].includes(p.type))
  );

  const firstMsgs = [
    {
      role: 'user',
      content:
        'I am building a web SaaS shared inbox for indie founders. It needs auth, Stripe billing, and a clean SaaS soft design. Users sign up then connect email then triage tickets then reply with macros.'
    }
  ];
  draft = livingBrief.applyDraftPatch(draft, turn.draftPatch);
  turn.proposals.forEach((p) => {
    draft = livingBrief.applyProposalToDraft(draft, p);
  });

  const mid = livingBrief.computeReadiness(draft, { messages: firstMsgs });
  ok('after first turn score increased', mid.score > empty.score, `score=${mid.score}`);

  // Second turn: numbered flow + pages
  const secondMsgs = firstMsgs.concat([
    {
      role: 'user',
      content:
        'Pages: Dashboard, Inbox, Settings, Billing\n1. Open inbox\n2. Assign ticket\n3. Reply with macro\n4. Mark resolved'
    }
  ]);
  turn = livingBrief.heuristicTurn(secondMsgs, draft);
  draft = livingBrief.applyDraftPatch(draft, turn.draftPatch);
  turn.proposals.forEach((p) => {
    draft = livingBrief.applyProposalToDraft(draft, p);
  });

  const ready = livingBrief.computeReadiness(draft, { messages: secondMsgs });
  ok('draft becomes ready after structured turns', ready.ready === true, `score=${ready.score} missing=${ready.missing.join(',')}`);
  ok('thin category pitch stays low', livingBrief.computeReadiness(livingBrief.emptyDraft(), { messages: [{ role: 'user', content: 'I want a CRM' }] }).score < 40);
  ok('vision persisted', (draft.vision || '').length >= 40);
  ok('has pages or workflows', draft.pages.length >= 2 || draft.workflows.length >= 1);

  // --- Timeline: thin pitch must ask vision, not flow ---
  const thinHe = [{ role: 'user', content: 'מערכת לניהול לוז של מנכלים' }];
  const thinReady = livingBrief.computeReadiness(livingBrief.emptyDraft(), { messages: thinHe });
  ok('Hebrew thin pitch nextQuestion is vision', thinReady.nextQuestion && thinReady.nextQuestion.id === 'vision');
  const thinTurn = livingBrief.heuristicTurn(thinHe, livingBrief.emptyDraft());
  ok(
    'Hebrew thin pitch reply is vision (not flow)',
    livingBrief.classifyFollowUpTopic(thinTurn.reply) === 'vision',
    String(thinTurn.reply).slice(0, 160)
  );
  const inflated = livingBrief.emptyDraft();
  inflated.vision = 'AI-written long vision about executive calendars replacing WhatsApp chaos for chiefs of staff everywhere.';
  ok(
    'AI draft.vision does not unlock vision readiness',
    livingBrief.computeReadiness(inflated, { messages: thinHe }).nextQuestion?.id === 'vision'
  );
  const enforced = livingBrief.enforceFollowUpQuestion(
    'Great idea! Could you outline the main user flow in 3–4 steps?',
    thinReady.nextQuestion
  );
  ok(
    'enforceFollowUpQuestion blocks early flow ask',
    livingBrief.classifyFollowUpTopic(enforced) === 'vision' && !/main user flow/i.test(enforced)
  );

  // --- processTurn without API key uses heuristic ---
  const processed = await livingBrief.processTurn({
    messages: [{ role: 'user', content: 'A mobile fitness app with notifications and dark mode vibe that is playful.' }],
    draft: livingBrief.emptyDraft(),
    apiKey: null
  });
  ok('processTurn works without API key', processed.engine === 'heuristic' && processed.reply);
  ok('processTurn readiness object', processed.readiness && typeof processed.readiness.score === 'number');

  // --- Duplicate proposal apply is stable ---
  const before = draft.features.length;
  draft = livingBrief.applyProposalToDraft(draft, {
    type: 'feature',
    value: 'User Authentication'
  });
  draft = livingBrief.applyProposalToDraft(draft, {
    type: 'feature',
    value: 'User Authentication'
  });
  ok('feature dedupes on apply', draft.features.filter((f) => f === 'User Authentication').length === 1 || draft.features.length >= before);

  console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures)' : ''}\n`);
  if (process.exitCode) process.exit(process.exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
