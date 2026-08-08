#!/usr/bin/env node
/**
 * Living Brief eval — Part 2: generate a spec-like overview from the brief
 * and judge whether it matches the user's idea.
 *
 * Richness modes:
 *   100% — vision + flow + scope answers
 *   60%  — vision + flow only (system must fill sensible defaults)
 *   30%  — thin pitch + short vision only
 *
 * Usage:
 *   node backend/scripts/living-brief-eval-part2.js
 *   node backend/scripts/living-brief-eval-part2.js --ai
 *   SKIP_JUDGE=1 node backend/scripts/living-brief-eval-part2.js   # draft-only checks
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const livingBrief = require('../server/living-brief-service');
const AIService = require('../server/ai-service');

const args = process.argv.slice(2);
const useAi = args.includes('--ai');
const skipJudge = process.env.SKIP_JUDGE === '1' || args.includes('--skip-judge');
const apiKey = process.env.OPENAI_API_KEY;

const SCENARIOS = [
  {
    id: 'ceo-calendar',
    richness: 100,
    turns: [
      'מערכת לניהול לוז של מנכלים',
      'Helps executive assistants keep CEO calendars conflict-free; today they juggle WhatsApp, Google Calendar, and sticky notes.',
      'Assist opens week view → proposes free slots → CEO confirms → meeting lands on calendar with buffer.',
      'For chiefs of staff on web — Google Calendar sync and conflict warnings are must-haves.'
    ],
    mustMention: ['calendar', 'ceo', 'conflict', 'assist'],
    minFidelity: 70
  },
  {
    id: 'crm-60',
    richness: 60,
    turns: [
      'I want a CRM',
      'A simple CRM for freelancers so deals don’t die in spreadsheets — today they track everything in Excel.',
      'Sign up → add a contact → create a deal → move it to Won.'
    ],
    mustMention: ['crm', 'deal', 'contact', 'freelance'],
    minFidelity: 55
  },
  {
    id: 'inbox-30',
    richness: 30,
    turns: [
      'Shared inbox for a tiny support team',
      'We need one place for customer email instead of a shared Gmail.'
    ],
    mustMention: ['inbox', 'email', 'support'],
    minFidelity: 40
  },
  {
    id: 'fitness-100',
    richness: 100,
    turns: [
      'Fitness coaching app for busy professionals',
      'Helps busy professionals finish short workouts without a trainer; today they bounce between YouTube and notes.',
      'Onboard → set a goal → do today’s workout → see progress.',
      'For individuals on mobile — adaptive plans and progress charts at launch.'
    ],
    mustMention: ['workout', 'goal', 'progress', 'professional'],
    minFidelity: 70
  },
  {
    id: 'marketplace-60',
    richness: 60,
    turns: [
      'Marketplace for second-hand camera gear',
      'Lets photographers buy/sell used lenses with trusted ratings — today Facebook groups and shady DMs.',
      'Browse listings → open an item → checkout → track delivery.'
    ],
    mustMention: ['camera', 'listing', 'sell', 'photo'],
    minFidelity: 55
  }
];

let passed = 0;
let failed = 0;

function ok(name, cond, detail) {
  if (!cond) {
    failed += 1;
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

async function chatTurn(messages, draft) {
  if (useAi && apiKey) {
    return livingBrief.processTurn({ messages, draft, apiKey });
  }
  return livingBrief.heuristicTurn(messages, draft);
}

async function simulate(scenario) {
  let draft = livingBrief.emptyDraft();
  let messages = [];
  for (const content of scenario.turns) {
    messages = messages.concat([{ role: 'user', content }]);
    const turn = await chatTurn(messages, draft);
    draft = applyTurn(draft, turn);
    messages = messages.concat([{ role: 'assistant', content: turn.reply }]);
  }
  const readiness = livingBrief.computeReadiness(draft, { messages });
  const userInput = livingBrief.draftToUserInput(draft, messages);
  return { draft, messages, readiness, userInput };
}

function keywordCoverage(userInput, overviewText, mustMention) {
  const hay = `${userInput}\n${overviewText}`.toLowerCase();
  const hits = mustMention.filter((k) => hay.includes(String(k).toLowerCase()));
  return { hits, ratio: hits.length / Math.max(1, mustMention.length) };
}

async function generateOverview(userInput, scenario) {
  if (!apiKey) {
    // Deterministic stand-in when no key: mirror the brief
    return {
      title: scenario.id,
      ideaSummary: userInput.slice(0, 400),
      valueProposition: userInput.slice(0, 200),
      keyFeatures: (userInput.match(/Features: (.+)/) || [, ''])[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 6),
      primaryFlow: (userInput.match(/Workflows:\n- ([^\n]+)/) || [, ''])[1],
      engine: 'mirror'
    };
  }

  const ai = new AIService(apiKey);
  const raw = await ai.callJsonChatCompletion({
    system: `You generate a compact product overview JSON from a Living Brief userInput.
Stay faithful to the user's idea — do not invent a different product category.
Return ONLY JSON:
{
  "title": "",
  "ideaSummary": "",
  "valueProposition": "",
  "keyFeatures": ["..."],
  "primaryFlow": "step → step → step"
}`,
    user: userInput || scenario.turns.join('\n'),
    temperature: 0.3
  });
  try {
    const parsed = JSON.parse(raw);
    parsed.engine = 'openai';
    return parsed;
  } catch (e) {
    return {
      title: 'parse-error',
      ideaSummary: raw.slice(0, 500),
      valueProposition: '',
      keyFeatures: [],
      primaryFlow: '',
      engine: 'parse-error'
    };
  }
}

async function judgeFidelity(scenario, userText, overview) {
  if (skipJudge || !apiKey) {
    const blob = JSON.stringify(overview).toLowerCase();
    const { hits, ratio } = keywordCoverage('', blob, scenario.mustMention);
    return {
      score: Math.round(ratio * 100),
      reasons: [`keyword coverage ${hits.join(', ') || 'none'}`],
      mismatches: ratio < 0.5 ? ['low keyword overlap'] : [],
      engine: 'keywords'
    };
  }

  const ai = new AIService(apiKey);
  const raw = await ai.callJsonChatCompletion({
    system: `You judge whether a generated product overview matches the user's stated idea.
Score fidelity 0–100. Penalize wrong product category, missing core job, or invented unrelated domains.
Return ONLY JSON: { "score": 0, "reasons": ["..."], "mismatches": ["..."] }`,
    user: JSON.stringify({
      richness: scenario.richness,
      userTurns: scenario.turns,
      overview
    }),
    temperature: 0.1
  });
  try {
    const parsed = JSON.parse(raw);
    parsed.engine = 'openai';
    return parsed;
  } catch (e) {
    return { score: 0, reasons: ['judge parse failed'], mismatches: [e.message], engine: 'error' };
  }
}

async function runScenario(scenario) {
  console.log(`\n— ${scenario.id} (richness ${scenario.richness}%) —`);
  const sim = await simulate(scenario);
  ok(
    `${scenario.id}: produced userInput from brief`,
    sim.userInput.length > 20,
    `len=${sim.userInput.length}`
  );

  if (scenario.richness >= 100) {
    ok(
      `${scenario.id}: 100% path reaches high readiness`,
      sim.readiness.score >= 75,
      `score=${sim.readiness.score}`
    );
  } else if (scenario.richness >= 60) {
    ok(
      `${scenario.id}: 60% path has vision+flow signal`,
      sim.readiness.score >= 40 ||
        (sim.draft.workflows.length >= 1 || livingBrief.describesUserFlow(sim.messages.map((m) => m.content).join(' '))),
      `score=${sim.readiness.score}`
    );
  } else {
    ok(
      `${scenario.id}: 30% path stays incomplete (expected)`,
      sim.readiness.ready === false,
      `score=${sim.readiness.score}`
    );
  }

  const overview = await generateOverview(sim.userInput, scenario);
  const overviewText = JSON.stringify(overview);
  const { hits, ratio } = keywordCoverage(sim.userInput, overviewText, scenario.mustMention);
  ok(
    `${scenario.id}: overview keeps core keywords`,
    ratio >= (scenario.richness >= 60 ? 0.5 : 0.34),
    `hits=${hits.join('|')} ratio=${ratio.toFixed(2)}`
  );

  const judgment = await judgeFidelity(scenario, sim.userInput, overview);
  ok(
    `${scenario.id}: fidelity >= ${scenario.minFidelity}`,
    Number(judgment.score) >= scenario.minFidelity,
    `score=${judgment.score} mismatches=${(judgment.mismatches || []).join('; ')}`
  );

  return { scenario, sim, overview, judgment };
}

async function main() {
  console.log('\nLiving Brief eval — Part 2 (generate + compare)');
  console.log(
    `chat engine: ${useAi && apiKey ? 'openai' : 'heuristic'} · judge: ${
      skipJudge || !apiKey ? 'keywords/skip' : 'openai'
    }\n`
  );

  const results = [];
  for (const scenario of SCENARIOS) {
    results.push(await runScenario(scenario));
  }

  console.log(`\nPart 2 done: ${passed} passed, ${failed} failed`);
  if (failed) {
    console.log('\nLow-fidelity cases:');
    results
      .filter((r) => Number(r.judgment?.score) < r.scenario.minFidelity)
      .forEach((r) => {
        console.log(
          ` - ${r.scenario.id}: score=${r.judgment.score} overview=${(r.overview.ideaSummary || '').slice(0, 120)}`
        );
      });
  }
  process.exitCode = failed ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
