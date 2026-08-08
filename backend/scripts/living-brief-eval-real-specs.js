#!/usr/bin/env node
/**
 * Living Brief → real SpecGenV2 overview (Firestore), then fidelity judge.
 *
 * Creates at least 2 real specs from Living Brief conversations and checks
 * that the final overview matches the user's idea.
 *
 * Usage:
 *   node backend/scripts/living-brief-eval-real-specs.js
 *   node backend/scripts/living-brief-eval-real-specs.js --keep   # do not delete on failure
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const livingBrief = require('../server/living-brief-service');
const { db, admin } = require('../server/firebase-admin');
const specGenerationServiceV2 = require('../server/spec-generation-service-v2');
const AIService = require('../server/ai-service');

const keep = process.argv.includes('--keep');
const outDir = path.resolve(__dirname, '../backups/living-brief-eval');
fs.mkdirSync(outDir, { recursive: true });

const CASES = [
  {
    id: 'ceo-calendar',
    turns: [
      'מערכת לניהול לוז של מנכלים',
      'Helps executive assistants keep CEO calendars conflict-free; today they juggle WhatsApp, Google Calendar, and sticky notes.',
      'Assist opens week view → proposes free slots → CEO confirms → meeting lands on calendar with buffer.',
      'For chiefs of staff on web — Google Calendar sync and conflict warnings are must-haves at launch.'
    ],
    mustMention: ['calendar', 'ceo', 'conflict'],
    mustNotBe: ['crm pipeline', 'fitness workout', 'marketplace lens'],
    minFidelity: 70
  },
  {
    id: 'freelancer-crm',
    turns: [
      'I want a CRM',
      'A simple CRM for freelancers so deals don’t die in spreadsheets — today they track everything in Excel.',
      'Sign up → add a contact → create a deal → move it to Won.',
      'For freelancers on web — contact timeline and pipeline board are must-haves.'
    ],
    mustMention: ['crm', 'deal', 'contact', 'freelance'],
    mustNotBe: ['ceo calendar', 'camera marketplace', 'workout plan'],
    minFidelity: 70
  }
];

function applyTurn(draft, turn) {
  let next = livingBrief.applyDraftPatch(draft, turn.draftPatch);
  (turn.proposals || []).forEach((p) => {
    next = livingBrief.applyProposalToDraft(next, p);
  });
  return next;
}

async function simulateBrief(turns) {
  let draft = livingBrief.emptyDraft();
  let messages = [];
  for (const content of turns) {
    messages = messages.concat([{ role: 'user', content }]);
    const turn = await livingBrief.processTurn({
      messages,
      draft,
      apiKey: process.env.OPENAI_API_KEY
    });
    draft = applyTurn(draft, turn);
    messages = messages.concat([{ role: 'assistant', content: turn.reply }]);
  }
  return {
    draft,
    messages,
    userInput: livingBrief.draftToUserInput(draft, messages),
    readiness: livingBrief.computeReadiness(draft, { messages })
  };
}

async function createSpecDoc(caseId, userInput) {
  const ref = db.collection('specs').doc();
  const payload = {
    title: `[LB-EVAL] ${caseId}`,
    overview: null,
    technical: null,
    market: null,
    design: null,
    status: {
      overview: 'generating',
      technical: 'pending',
      market: 'pending',
      design: 'pending'
    },
    overviewApproved: false,
    userId: process.env.LB_EVAL_USER_ID || 'living-brief-eval',
    userName: 'Living Brief Eval',
    mode: 'unified',
    answers: [userInput, '', ''],
    generationVersion: 'v2',
    tags: ['living-brief-eval', caseId],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  await ref.set(payload);
  // Anchor read/write so getOrCreateThread sees a committed doc
  await ref.update({ 'status.overview': 'generating' });
  return ref.id;
}

function getTitleFromOverview(overviewContent) {
  try {
    const obj = typeof overviewContent === 'string' ? JSON.parse(overviewContent) : overviewContent;
    return (
      obj.shortTitle ||
      obj.applicationName ||
      obj.title ||
      (obj.ideaSummary ? String(obj.ideaSummary).slice(0, 60) : 'Untitled')
    );
  } catch (e) {
    return 'Untitled';
  }
}

function keywordHits(text, keys) {
  const hay = String(text || '').toLowerCase();
  return keys.filter((k) => hay.includes(String(k).toLowerCase()));
}

async function judge(caseDef, userTurns, overviewObj) {
  const ai = new AIService(process.env.OPENAI_API_KEY);
  const raw = await ai.callJsonChatCompletion({
    system: `You judge whether a REAL product overview JSON matches the user's Living Brief conversation.
Score fidelity 0–100. Penalize wrong product category, missing core job/flow/features the user stated, or inventing a different product.
Return ONLY JSON: {
  "score": 0,
  "verdict": "good|weak|bad",
  "matched": ["..."],
  "missing": ["..."],
  "wrong": ["..."],
  "notes": "one short paragraph"
}`,
    user: JSON.stringify({
      caseId: caseDef.id,
      userTurns,
      overview: {
        shortTitle: overviewObj.shortTitle || overviewObj.applicationName,
        ideaSummary: overviewObj.ideaSummary,
        valueProposition: overviewObj.valueProposition,
        problemStatement: overviewObj.problemStatement,
        coreFeaturesOverview: overviewObj.coreFeaturesOverview,
        screens: (overviewObj.screenDescriptions && overviewObj.screenDescriptions.screens) || []
      }
    }),
    temperature: 0.1
  });
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { score: 0, verdict: 'bad', matched: [], missing: [], wrong: [e.message], notes: 'judge parse failed' };
  }
}

async function runCase(caseDef) {
  console.log(`\n======== ${caseDef.id} ========`);
  console.log('1) Living Brief conversation…');
  const brief = await simulateBrief(caseDef.turns);
  console.log(`   readiness=${brief.readiness.score} userInputChars=${brief.userInput.length}`);

  console.log('2) Creating Firestore spec…');
  const specId = await createSpecDoc(caseDef.id, brief.userInput);
  console.log(`   specId=${specId}`);

  console.log('3) Real SpecGenV2 overview generation (this can take a few minutes)…');
  const started = Date.now();
  let overviewJson;
  try {
    overviewJson = await specGenerationServiceV2.generateOverview(specId, brief.userInput);
  } catch (err) {
    console.error(`   GENERATION FAILED: ${err.message}`);
    if (!keep) {
      try {
        await db.collection('specs').doc(specId).delete();
      } catch (e) {}
    } else {
      await db.collection('specs').doc(specId).update({
        'status.overview': 'error',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    return { caseDef, specId, ok: false, error: err.message };
  }

  const title = getTitleFromOverview(overviewJson);
  await db.collection('specs').doc(specId).update({
    overview: overviewJson,
    title: `[LB-EVAL] ${title}`,
    'status.overview': 'ready',
    generationVersion: 'v2',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log(`   overview ready in ${Math.round((Date.now() - started) / 1000)}s · title=${title}`);

  const overviewObj = JSON.parse(overviewJson);
  const blob = JSON.stringify(overviewObj).toLowerCase();
  const hits = keywordHits(blob, caseDef.mustMention);
  const badHits = keywordHits(blob, caseDef.mustNotBe);
  const features = overviewObj.coreFeaturesOverview || [];
  const screens =
    (overviewObj.screenDescriptions && overviewObj.screenDescriptions.screens) || [];

  console.log('4) Judging fidelity…');
  const judgment = await judge(caseDef, caseDef.turns, overviewObj);

  const structuralOk =
    features.length >= 4 &&
    screens.length >= 1 &&
    String(overviewObj.ideaSummary || '').length >= 80;
  const keywordOk = hits.length >= Math.ceil(caseDef.mustMention.length * 0.66) && badHits.length === 0;
  const fidelityOk = Number(judgment.score) >= caseDef.minFidelity;
  const ok = structuralOk && keywordOk && fidelityOk;

  const report = {
    caseId: caseDef.id,
    specId,
    title,
    durationMs: Date.now() - started,
    readiness: brief.readiness.score,
    userInput: brief.userInput,
    keywordHits: hits,
    badKeywordHits: badHits,
    featureCount: features.length,
    screenCount: screens.length,
    ideaSummary: overviewObj.ideaSummary,
    coreFeaturesOverview: features,
    judgment,
    checks: { structuralOk, keywordOk, fidelityOk, ok }
  };

  const reportPath = path.join(outDir, `${caseDef.id}-${specId}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`   report → ${reportPath}`);
  console.log(
    `   RESULT: ${ok ? 'PASS' : 'FAIL'} · fidelity=${judgment.score} (${judgment.verdict}) · keywords=${hits.join('|')} · features=${features.length} screens=${screens.length}`
  );
  if (judgment.notes) console.log(`   notes: ${judgment.notes}`);
  if ((judgment.wrong || []).length) console.log(`   wrong: ${judgment.wrong.join('; ')}`);
  if ((judgment.missing || []).length) console.log(`   missing: ${judgment.missing.join('; ')}`);

  return { caseDef, specId, ok, report, reportPath };
}

async function main() {
  console.log('\nLiving Brief → REAL specs evaluation (SpecGenV2)\n');
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY required');
    process.exit(1);
  }

  const results = [];
  for (const c of CASES) {
    results.push(await runCase(c));
  }

  const summaryPath = path.join(outDir, `summary-${Date.now()}.json`);
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      results.map((r) => ({
        caseId: r.caseDef.id,
        specId: r.specId,
        ok: r.ok,
        fidelity: r.report?.judgment?.score,
        title: r.report?.title,
        error: r.error || null,
        viewerHint: r.specId ? `/pages/spec-viewer.html?id=${r.specId}` : null
      })),
      null,
      2
    )
  );

  console.log('\n======== SUMMARY ========');
  results.forEach((r) => {
    console.log(
      `${r.ok ? 'PASS' : 'FAIL'}  ${r.caseDef.id}  spec=${r.specId}  fidelity=${r.report?.judgment?.score ?? 'n/a'}  ${
        r.error || r.report?.title || ''
      }`
    );
    if (r.specId) console.log(`       open: /pages/spec-viewer.html?id=${r.specId}`);
  });
  console.log(`summary → ${summaryPath}`);

  const failed = results.filter((r) => !r.ok).length;
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
