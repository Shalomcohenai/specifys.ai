#!/usr/bin/env node
/**
 * Living Brief eval — Part 1: conversation timeline + follow-up quality.
 *
 * Simulates many thin-first pitches across product ideas, asserts:
 *   vision → flow → scope (never jump to flow while vision is thin)
 *   reply topic matches readiness.nextQuestion
 *   Ideas topic would match the gap (via classifyFollowUpTopic / nextQuestion.id)
 *
 * Usage:
 *   node backend/scripts/living-brief-eval-part1.js
 *   node backend/scripts/living-brief-eval-part1.js --ai          # also hit OpenAI
 *   node backend/scripts/living-brief-eval-part1.js --rounds=3
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const livingBrief = require('../server/living-brief-service');

const args = process.argv.slice(2);
const useAi = args.includes('--ai');
const rounds = Math.max(
  1,
  parseInt((args.find((a) => a.startsWith('--rounds=')) || '--rounds=2').split('=')[1], 10) || 2
);

const IDEAS = [
  { id: 'ceo-calendar-he', first: 'מערכת לניהול לוז של מנכלים' },
  { id: 'crm-thin', first: 'I want a CRM' },
  { id: 'ceo-calendar-en', first: 'A tool for managing CEO schedules' },
  { id: 'fitness', first: 'Fitness coaching app for busy professionals' },
  { id: 'inbox', first: 'Shared inbox for a tiny support team' },
  { id: 'marketplace', first: 'Marketplace for second-hand camera gear' },
  { id: 'habit-he', first: 'אפליקציה להרגלים יומיים' },
  { id: 'clinic', first: 'Clinic appointment booking system' }
];

const VISION_ANSWERS = {
  'ceo-calendar-he':
    'Helps executive assistants keep CEO calendars conflict-free; today they juggle WhatsApp, Google Calendar, and sticky notes.',
  'crm-thin':
    'A simple CRM for freelancers so deals don’t die in spreadsheets — today they track everything in Excel.',
  'ceo-calendar-en':
    'Helps chiefs of staff protect deep-work blocks for CEOs; currently they fight double-bookings across Outlook and Slack.',
  fitness:
    'Helps busy professionals finish short workouts without a personal trainer; today they bounce between YouTube and a notes app.',
  inbox:
    'Shared inbox so a 3-person support team answers customers in one place instead of a shared Gmail.',
  marketplace:
    'Lets photographers buy/sell used lenses with trusted ratings — today Facebook groups and shady DMs.',
  'habit-he':
    'עוזר לאנשים לבנות הרגל יומי אחד בלי אפליקציות מסובכות; היום הם משתמשים בפתקים וברימיינדרים בטלפון.',
  clinic:
    'Lets small clinics book and reschedule visits without phone tag; today the front desk uses a paper diary.'
};

const FLOW_ANSWERS = {
  'ceo-calendar-he':
    'Assist opens week view → proposes free slots → CEO confirms → meeting lands on calendar with buffer.',
  'crm-thin': 'Sign up → add a contact → create a deal → move it to Won.',
  'ceo-calendar-en':
    'Open calendar → block focus time → approve assistant-proposed meeting → send confirmation.',
  fitness: 'Onboard → set a goal → do today’s workout → see progress.',
  inbox: 'Sign up → connect email → triage a ticket → reply → resolve.',
  marketplace: 'Browse listings → open an item → checkout → track delivery.',
  'habit-he': 'נכנסים → בוחרים הרגל → מסמנים בוצע היום → רואים רצף.',
  clinic: 'Patient books slot → clinic confirms → reminder sent → check-in at visit.'
};

const SCOPE_ANSWERS = {
  default: 'For small teams on web — calendar sync + conflict warnings are must-haves at launch.'
};

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, cond, detail) {
  if (!cond) {
    failed += 1;
    failures.push({ name, detail });
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    return false;
  }
  passed += 1;
  console.log(`ok    ${name}`);
  return true;
}

function applyTurn(draft, turn) {
  let next = livingBrief.applyDraftPatch(draft, turn.draftPatch);
  (turn.proposals || []).forEach((p) => {
    next = livingBrief.applyProposalToDraft(next, p);
  });
  return next;
}

async function runTurn(messages, draft) {
  if (useAi && process.env.OPENAI_API_KEY) {
    return livingBrief.processTurn({
      messages,
      draft,
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return livingBrief.heuristicTurn(messages, draft);
}

function assertFirstAskIsVision(idea, turn, messages) {
  const readiness = livingBrief.computeReadiness(livingBrief.emptyDraft(), { messages });
  ok(
    `${idea.id}: thin pitch keeps vision incomplete`,
    readiness.checks.find((c) => c.id === 'vision')?.done === false,
    `score=${readiness.score}`
  );
  ok(
    `${idea.id}: nextQuestion is vision`,
    readiness.nextQuestion && readiness.nextQuestion.id === 'vision',
    `got=${readiness.nextQuestion && readiness.nextQuestion.id}`
  );

  const replyTopic = livingBrief.classifyFollowUpTopic(turn.reply);
  const enforced = livingBrief.enforceFollowUpQuestion(turn.reply, readiness.nextQuestion);
  const enforcedTopic = livingBrief.classifyFollowUpTopic(enforced);
  ok(
    `${idea.id}: reply asks vision (not flow)`,
    (replyTopic === 'vision' || enforcedTopic === 'vision') && replyTopic !== 'structure',
    `replyTopic=${replyTopic} enforced=${enforcedTopic} reply=${String(turn.reply).slice(0, 120)}`
  );
  ok(
    `${idea.id}: ideas topic would be vision`,
    (turn.readiness?.nextQuestion?.id || readiness.nextQuestion.id) === 'vision',
    `gap=${turn.readiness?.nextQuestion?.id}`
  );
}

async function runIdea(idea, round) {
  console.log(`\n— ${idea.id} (round ${round}) —`);
  let draft = livingBrief.emptyDraft();
  let messages = [{ role: 'user', content: idea.first }];

  let turn = await runTurn(messages, draft);
  assertFirstAskIsVision(idea, turn, messages);
  draft = applyTurn(draft, turn);
  messages = messages.concat([{ role: 'assistant', content: turn.reply }]);

  // Vision answer → should move toward flow (not stay forever, not skip to audience-only)
  messages = messages.concat([{ role: 'user', content: VISION_ANSWERS[idea.id] || VISION_ANSWERS['crm-thin'] }]);
  turn = await runTurn(messages, draft);
  draft = applyTurn(draft, turn);
  const afterVision = livingBrief.computeReadiness(draft, { messages });
  ok(
    `${idea.id}: after vision answer, vision complete`,
    afterVision.checks.find((c) => c.id === 'vision')?.done === true,
    `score=${afterVision.score} missing=${afterVision.missing.join(',')}`
  );
  const q2 = afterVision.nextQuestion?.id || turn.readiness?.nextQuestion?.id;
  const topic2 = livingBrief.classifyFollowUpTopic(turn.reply);
  if (!afterVision.ready) {
    ok(
      `${idea.id}: after vision, ask flow (not audience first unless flow done)`,
      q2 === 'structure' || topic2 === 'structure' || afterVision.checks.find((c) => c.id === 'structure')?.done,
      `q2=${q2} topic2=${topic2}`
    );
  }
  messages = messages.concat([{ role: 'assistant', content: turn.reply }]);

  // Flow answer
  messages = messages.concat([{ role: 'user', content: FLOW_ANSWERS[idea.id] || FLOW_ANSWERS['crm-thin'] }]);
  turn = await runTurn(messages, draft);
  draft = applyTurn(draft, turn);
  const afterFlow = livingBrief.computeReadiness(draft, { messages });
  ok(
    `${idea.id}: after flow answer, structure complete`,
    afterFlow.checks.find((c) => c.id === 'structure')?.done === true,
    `score=${afterFlow.score}`
  );
  messages = messages.concat([{ role: 'assistant', content: turn.reply }]);

  // Scope answer
  messages = messages.concat([{ role: 'user', content: SCOPE_ANSWERS.default }]);
  turn = await runTurn(messages, draft);
  draft = applyTurn(draft, turn);
  const ready = livingBrief.computeReadiness(draft, { messages });
  ok(
    `${idea.id}: reaches ready after vision→flow→scope`,
    ready.ready === true || ready.score >= 75,
    `score=${ready.score} missing=${ready.missing.join(',')}`
  );
}

async function staticGuards() {
  console.log('\n— static guards —');
  const thin = 'מערכת לניהול לוז של מנכלים';
  ok('isThinProductPitch detects Hebrew CEO tool', livingBrief.isThinProductPitch(thin));
  ok('isThinProductPitch detects I want a CRM', livingBrief.isThinProductPitch('I want a CRM'));

  const rich =
    'Helps executive assistants keep CEO calendars conflict-free; today they juggle WhatsApp and Google Calendar.';
  ok('rich vision is not thin', !livingBrief.isThinProductPitch(rich));

  const fakeAiFlow =
    'Great to hear about your system for managing CEOs schedules! To move forward, could you outline the main user flow in 3–4 steps?';
  const visionQ = {
    id: 'vision',
    text: 'Curious — what’s the product in one line: what job does it do, and what do people use today instead?'
  };
  const fixed = livingBrief.enforceFollowUpQuestion(fakeAiFlow, visionQ);
  ok(
    'enforceFollowUpQuestion replaces flow ask with vision',
    livingBrief.classifyFollowUpTopic(fixed) === 'vision' &&
      !/main user flow|3–4 steps|3-4 steps/i.test(fixed.split('\n\n').pop()),
    fixed.slice(0, 200)
  );

  // AI-written draft.vision must not unlock vision readiness
  const draft = livingBrief.emptyDraft();
  draft.vision =
    'A comprehensive executive calendar OS that replaces WhatsApp scheduling chaos for Fortune 500 chiefs of staff.';
  const r = livingBrief.computeReadiness(draft, {
    messages: [{ role: 'user', content: thin }]
  });
  ok(
    'AI draft.vision does not satisfy vision gap',
    r.checks.find((c) => c.id === 'vision')?.done === false && r.nextQuestion?.id === 'vision',
    `score=${r.score}`
  );
}

async function main() {
  console.log(`\nLiving Brief eval — Part 1 (timeline)`);
  console.log(`engine: ${useAi && process.env.OPENAI_API_KEY ? 'openai' : 'heuristic'} · rounds=${rounds}\n`);

  await staticGuards();

  for (let round = 1; round <= rounds; round++) {
    for (const idea of IDEAS) {
      await runIdea(idea, round);
    }
  }

  console.log(`\nPart 1 done: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.slice(0, 30).forEach((f) => console.log(` - ${f.name}: ${f.detail || ''}`));
  }
  process.exitCode = failed ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
