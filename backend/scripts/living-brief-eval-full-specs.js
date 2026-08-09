#!/usr/bin/env node
/**
 * Living Brief → full advanced SpecGenV2 quality evaluation.
 *
 * Simulates extreme chat conversations, generates overview + advanced sections
 * (technical, market, design, architecture, visibility, prompts), then scores
 * structure/order, [INFERRED]/loading junk, glossary/epics bloat, and completeness.
 *
 * Usage:
 *   node backend/scripts/living-brief-eval-full-specs.js
 *   node backend/scripts/living-brief-eval-full-specs.js --keep
 *   node backend/scripts/living-brief-eval-full-specs.js --overview-only
 *   node backend/scripts/living-brief-eval-full-specs.js --cases=long-chat,minimal
 *   node backend/scripts/living-brief-eval-full-specs.js --skip-chat   # use canned userInput
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const livingBrief = require('../server/living-brief-service');
const { db, admin } = require('../server/firebase-admin');
const specGenerationServiceV2 = require('../server/spec-generation-service-v2');

const keep = process.argv.includes('--keep');
const overviewOnly = process.argv.includes('--overview-only');
const skipChat = process.argv.includes('--skip-chat');
const casesArg = (process.argv.find((a) => a.startsWith('--cases=')) || '').split('=')[1];
const caseFilter = casesArg
  ? casesArg.split(',').map((s) => s.trim()).filter(Boolean)
  : null;

const outDir = path.resolve(__dirname, '../backups/living-brief-eval');
fs.mkdirSync(outDir, { recursive: true });

/** Ideal overview section order for human-readable specs (core first, enrichment later). */
const CORE_OVERVIEW_KEYS = [
  'shortTitle',
  'ideaSummary',
  'problemStatement',
  'valueProposition',
  'coreFeaturesOverview',
  'detailedUserFlow',
  'screenDescriptions',
  'targetAudience',
  'userJourneySummary'
];

const ENRICHED_OVERVIEW_KEYS = [
  'personas',
  'successMetrics',
  'nonGoals',
  'epics',
  'permissionsMatrix',
  'glossary'
];

const ADVANCED_STAGES = ['technical', 'market', 'design', 'architecture', 'visibility', 'prompts'];

const CASES = [
  {
    id: 'long-chat',
    label: 'Very long chat with lots of text',
    turns: [
      'I need an app for my company, something about projects maybe?',
      'Actually let me explain more. We are a 40-person digital agency. Account managers live in Notion, Slack, Google Sheets, and email. Every client project has a kickoff, weekly status, deliverable reviews, and invoicing handoff to finance. Today status is tribal knowledge.',
      'Primary users: account managers (day-to-day), creative leads (capacity), clients (read-only portal). Secondary: finance needs invoice-ready milestones.',
      'Core flow: Create project from template → assign team → client sees milestone timeline → AM posts weekly update → client comments → mark deliverable approved → finance gets ready-to-invoice signal.',
      'Must-haves for v1 web: project templates, milestone timeline, weekly update composer, client comment thread, approval checkbox, finance export CSV. Nice-to-have later: time tracking, AI summary, mobile app.',
      'Please ignore anything about HR or payroll — that is out of scope. Also we do NOT want a full CRM; contacts are just client company + primary contact.',
      'Design should feel calm and professional, not startup-neon. Integrations: Slack notifications for approvals, Google Drive link field per deliverable.',
      'One more thing: Hebrew and English UI labels later, but the product spec can be English. Clients are mostly Israeli B2B SaaS companies.',
      'When the chat gets long people forget the overview. Keep the product crisp: Agency Project Status Hub — one source of truth for client project status and approvals.'
    ],
    mustMention: ['project', 'milestone', 'client', 'approval', 'agency'],
    mustNotBe: ['payroll', 'crm pipeline', 'fitness'],
    maxGlossary: 8,
    maxEpics: 5,
    maxInferredTags: 0,
    minIdeaSummary: 120,
    maxIdeaSummary: 900
  },
  {
    id: 'minimal',
    label: 'Almost no text / minimal chat',
    turns: ['Habit tracker'],
    mustMention: ['habit'],
    mustNotBe: ['ceo calendar', 'marketplace lens'],
    maxGlossary: 8,
    maxEpics: 5,
    maxInferredTags: 0,
    minIdeaSummary: 80,
    maxIdeaSummary: 900
  },
  {
    id: 'ambiguous-conflict',
    label: 'Ambiguous / conflicting requirements',
    turns: [
      'Build a marketplace for freelancers.',
      'Wait — actually it is not a marketplace. It is an internal tool for one company to staff freelancers onto projects.',
      'Buyers and sellers? No. Only internal PMs request freelancers; freelancers apply; ops approves.',
      'But also add public listings so freelancers can browse open gigs like Upwork.',
      'Final decision: internal-only staffing. No public marketplace. No payments in v1 — just request → apply → approve → assign.'
    ],
    mustMention: ['freelance', 'approve', 'assign', 'internal'],
    mustNotBe: ['upwork clone payments', 'public checkout'],
    maxGlossary: 8,
    maxEpics: 5,
    maxInferredTags: 0,
    minIdeaSummary: 100,
    maxIdeaSummary: 900,
    preferAbsent: ['public marketplace', 'stripe checkout', 'buyer reviews']
  },
  {
    id: 'b2b-multipersona',
    label: 'Complex multi-persona B2B app',
    turns: [
      'B2B compliance evidence locker for SOC2 startups.',
      'Helps security engineers collect audit evidence; today they chase screenshots in Slack and shared drives.',
      'Personas: Security lead (owns controls), Engineer (uploads evidence), Auditor (read-only review), Admin (seats/SSO).',
      'Flow: Admin invites team → Security lead maps controls → Engineer uploads evidence to a control → Security lead marks ready → Auditor reviews pack.',
      'For security teams on web — SSO, control library, evidence versioning, auditor share link are must-haves. No mobile in v1.'
    ],
    mustMention: ['evidence', 'control', 'auditor', 'sso', 'compliance'],
    mustNotBe: ['fitness workout', 'camera marketplace'],
    maxGlossary: 10,
    maxEpics: 5,
    maxInferredTags: 0,
    minIdeaSummary: 120,
    maxIdeaSummary: 900,
    minPersonas: 3
  },
  {
    id: 'mobile-consumer',
    label: 'Mobile-first consumer edge case',
    turns: [
      'Consumer app: split dinner bills with friends after restaurants.',
      'Helps groups settle who paid what without awkward Venmo math; today they use calculator screenshots in group chat.',
      'Open tab → add friends → snap receipt → assign items → see balances → pay via Apple Pay / link.',
      'Mobile-first iOS+Android. Must-haves: receipt OCR, item assignment, balance summary, push reminders. No web dashboard in v1.'
    ],
    mustMention: ['receipt', 'split', 'balance', 'mobile', 'friend'],
    mustNotBe: ['enterprise sso', 'soc2 evidence'],
    maxGlossary: 8,
    maxEpics: 5,
    maxInferredTags: 0,
    minIdeaSummary: 100,
    maxIdeaSummary: 900
  },
  {
    id: 'hebrew-long',
    label: 'Hebrew-heavy long intake (edge language)',
    turns: [
      'אפליקציה לניהול תורים למרפאה קטנה',
      'עוזרת לקליטה לקבוע ולשנות תורים בלי טלפונים; היום הכל ביומן נייר וווטסאפ.',
      'מטופל קובע תור → המרפאה מאשרת → תזכורת נשלחת → צ׳ק אין ביום הביקור.',
      'לצוות קבלה בדפדפן — יומן שבועי, אישור תורים, תזכורות SMS הן חובה בגרסה ראשונה. בלי אפליקציית מטופל מלאה עדיין.'
    ],
    mustMention: ['appointment', 'clinic', 'reminder'],
    mustNotBe: ['marketplace', 'soc2'],
    maxGlossary: 8,
    maxEpics: 5,
    maxInferredTags: 0,
    minIdeaSummary: 100,
    maxIdeaSummary: 900
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

function cannedUserInput(caseDef) {
  return `App Description: ${caseDef.turns.join(' ')}`;
}

async function createSpecDoc(caseId, userInput) {
  const ref = db.collection('specs').doc();
  const payload = {
    title: `[LB-FULL-EVAL] ${caseId}`,
    overview: null,
    technical: null,
    market: null,
    design: null,
    architecture: null,
    visibility: null,
    prompts: null,
    status: {
      overview: 'generating',
      technical: 'pending',
      market: 'pending',
      design: 'pending',
      architecture: 'pending',
      visibility: 'pending',
      prompts: 'pending'
    },
    overviewApproved: false,
    userId: process.env.LB_EVAL_USER_ID || 'living-brief-eval',
    userName: 'Living Brief Full Eval',
    mode: 'unified',
    answers: [userInput, '', ''],
    generationVersion: 'v2',
    tags: ['living-brief-eval', 'full-spec', caseId],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  await ref.set(payload);
  await ref.update({ 'status.overview': 'generating' });
  return ref.id;
}

function countInferredTags(value) {
  const s = typeof value === 'string' ? value : JSON.stringify(value || '');
  const matches = s.match(/\[INFERRED\]/gi);
  return matches ? matches.length : 0;
}

function countLoadingJunk(value) {
  const s = typeof value === 'string' ? value : JSON.stringify(value || '');
  // Only flag placeholder-like tokens, not phrases such as "lazy loading" / "loading spinner UX"
  const matches = s.match(/(?:^|[":])\s*loading(?:\.\.\.|…)?\s*(?=["}]|$)/gi);
  return matches ? matches.length : 0;
}

function keywordHits(text, keys) {
  const hay = String(text || '').toLowerCase();
  return (keys || []).filter((k) => hay.includes(String(k).toLowerCase()));
}

function parseMaybe(json) {
  if (json == null) return null;
  if (typeof json === 'object') return json;
  try {
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

function evaluateOverview(caseDef, overviewObj, userInput) {
  const issues = [];
  const features = overviewObj.coreFeaturesOverview || [];
  const screens = overviewObj.screenDescriptions?.screens || [];
  const glossary = overviewObj.glossary || [];
  const epics = overviewObj.epics || [];
  const personas = overviewObj.personas || [];
  const idea = String(overviewObj.ideaSummary || '');
  const blob = JSON.stringify(overviewObj);

  const inferredInUserFacing = countInferredTags({
    coreFeaturesOverview: features,
    screenDescriptions: overviewObj.screenDescriptions,
    personas,
    epics,
    glossary,
    ideaSummary: overviewObj.ideaSummary,
    problemStatement: overviewObj.problemStatement,
    valueProposition: overviewObj.valueProposition,
    detailedUserFlow: overviewObj.detailedUserFlow,
    userJourneySummary: overviewObj.userJourneySummary
  });
  // inferredItems metadata may still list inferences — that is OK
  const inferredInMetadata = countInferredTags(overviewObj.inferredItems || []);
  const loadingJunk = countLoadingJunk(overviewObj);

  if (!idea || idea.length < caseDef.minIdeaSummary) {
    issues.push(`ideaSummary too short (${idea.length})`);
  }
  if (idea.length > caseDef.maxIdeaSummary) {
    issues.push(`ideaSummary too long (${idea.length})`);
  }
  if (features.length < 4) issues.push(`coreFeaturesOverview sparse (${features.length})`);
  if (screens.length < 1) issues.push('screens empty');
  if (inferredInUserFacing > caseDef.maxInferredTags) {
    issues.push(`[INFERRED] leaked into user-facing fields (${inferredInUserFacing})`);
  }
  if (loadingJunk > 0) issues.push(`loading junk tokens (${loadingJunk})`);
  if (glossary.length > caseDef.maxGlossary) {
    issues.push(`glossary bloated (${glossary.length} > ${caseDef.maxGlossary})`);
  }
  if (epics.length > caseDef.maxEpics) {
    issues.push(`epics bloated (${epics.length} > ${caseDef.maxEpics})`);
  }
  const storyCount = epics.reduce((n, e) => n + ((e && e.stories) || []).length, 0);
  if (storyCount > 16) issues.push(`stories bloated (${storyCount})`);

  if (caseDef.minPersonas && personas.length < caseDef.minPersonas) {
    issues.push(`personas sparse (${personas.length} < ${caseDef.minPersonas})`);
  }

  const hits = keywordHits(blob, caseDef.mustMention);
  // Product-scope only: titles/features/screens/epics. Narrative may correctly say
  // "not payroll" / "not a public marketplace" when rejecting out-of-scope ideas.
  const productScopeBlob = JSON.stringify({
    shortTitle: overviewObj.shortTitle,
    coreFeaturesOverview: overviewObj.coreFeaturesOverview,
    screens: (overviewObj.screenDescriptions?.screens || []).map((s) => ({
      name: s?.name,
      description: s?.description
    })),
    epics: (overviewObj.epics || []).map((e) => ({
      name: e?.name,
      description: e?.description,
      stories: (e?.stories || []).map((st) => st?.title)
    }))
  }).toLowerCase();
  const badHits = keywordHits(productScopeBlob, caseDef.mustNotBe);
  if (hits.length < Math.ceil((caseDef.mustMention || []).length * 0.66)) {
    issues.push(`missing keywords (hit ${hits.join('|') || 'none'})`);
  }
  if (badHits.length) issues.push(`wrong-domain keywords (${badHits.join('|')})`);

  for (const phrase of caseDef.preferAbsent || []) {
    if (productScopeBlob.includes(phrase.toLowerCase())) {
      issues.push(`conflicting concept present in product scope: ${phrase}`);
    }
  }

  // Structure: core messaging should exist; enriched is optional but if present shouldn't replace core
  const hasCore =
    !!overviewObj.ideaSummary &&
    !!overviewObj.problemStatement &&
    !!overviewObj.valueProposition &&
    features.length > 0;
  if (!hasCore) issues.push('missing core overview messaging (starts conceptually at enrichment)');

  // Input format health: living-brief should produce App Description for prompt alignment
  if (userInput && !/App Description:/i.test(userInput) && !/Vision:/i.test(userInput)) {
    issues.push('userInput missing App Description/Vision header');
  }

  const presentCore = CORE_OVERVIEW_KEYS.filter((k) => {
    const v = overviewObj[k];
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return String(v).trim().length > 0;
  });
  const presentEnriched = ENRICHED_OVERVIEW_KEYS.filter((k) => {
    const v = overviewObj[k];
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  });

  return {
    ok: issues.length === 0,
    issues,
    metrics: {
      ideaSummaryLen: idea.length,
      featureCount: features.length,
      screenCount: screens.length,
      glossaryCount: glossary.length,
      epicCount: epics.length,
      storyCount,
      personaCount: personas.length,
      inferredInUserFacing,
      inferredInMetadata,
      loadingJunk,
      keywordHits: hits,
      badKeywordHits: badHits,
      presentCore,
      presentEnriched,
      shortTitle: overviewObj.shortTitle || null
    }
  };
}

function stageHasContent(raw) {
  if (raw == null) return false;
  if (typeof raw === 'string') return raw.trim().length > 40;
  if (typeof raw === 'object') return Object.keys(raw).length > 0;
  return false;
}

function evaluateAdvanced(processed) {
  const issues = [];
  const present = {};
  for (const stage of ADVANCED_STAGES) {
    const raw = processed[stage];
    // Architecture may be markdown (not JSON); other stages are JSON strings/objects.
    const obj = typeof raw === 'string' && raw.trim().startsWith('#') ? { markdown: raw } : parseMaybe(raw);
    const ok = stageHasContent(raw) || !!obj;
    present[stage] = ok;
    if (!ok) {
      issues.push(`missing advanced stage: ${stage}`);
      continue;
    }
    // Only flag [INFERRED] leakage — "loading" is a legitimate UX state in design/prompts.
    if (countInferredTags(raw) > 3) {
      issues.push(`${stage}: heavy [INFERRED] (${countInferredTags(raw)})`);
    }
  }

  // Lightweight completeness signals
  const technical = parseMaybe(processed.technical);
  if (technical && !technical.techStack) issues.push('technical missing techStack');
  const market = parseMaybe(processed.market);
  if (market && !(market.competitiveLandscape || market.swotAnalysis || market.marketOverview)) {
    issues.push('market looks empty of core analysis');
  }
  const design = parseMaybe(processed.design);
  if (design && !(design.visualStyleGuide || design.colorPalette || design.componentInventory)) {
    issues.push('design missing visual foundations');
  }
  const prompts = parseMaybe(processed.prompts);
  const fullPrompt = prompts?.fullPrompt || '';
  if (prompts && String(fullPrompt).length < 400) {
    issues.push(`prompts.fullPrompt too short (${String(fullPrompt).length})`);
  }

  return { ok: issues.length === 0, issues, present };
}

function conclusionFor(caseDef, overviewEval, advancedEval, error) {
  if (error) {
    return `FAILED to generate: ${error}. Pipeline/infra issue, not just prompt quality.`;
  }
  const oIssues = overviewEval?.issues || [];
  const aIssues = advancedEval?.issues || [];
  if (!oIssues.length && (!advancedEval || !aIssues.length)) {
    return `PASS — ${caseDef.label}: core overview is purposeful, no [INFERRED]/loading junk, glossary/epics bounded, advanced sections complete.`;
  }
  const top = [...oIssues, ...aIssues].slice(0, 4).join('; ');
  return `FAIL modes for ${caseDef.label}: ${top}`;
}

async function runCase(caseDef) {
  console.log(`\n======== ${caseDef.id} — ${caseDef.label} ========`);
  let brief;
  if (skipChat) {
    brief = {
      draft: livingBrief.emptyDraft(),
      messages: caseDef.turns.map((t) => ({ role: 'user', content: t })),
      userInput: cannedUserInput(caseDef),
      readiness: { score: 0 }
    };
    console.log('1) Skipping chat — canned App Description userInput');
  } else {
    console.log('1) Living Brief conversation…');
    brief = await simulateBrief(caseDef.turns);
  }
  console.log(
    `   readiness=${brief.readiness.score} userInputChars=${brief.userInput.length}`
  );
  console.log(`   userInput head: ${brief.userInput.slice(0, 160).replace(/\n/g, ' | ')}`);

  console.log('2) Creating Firestore spec…');
  const specId = await createSpecDoc(caseDef.id, brief.userInput);
  console.log(`   specId=${specId}`);

  const started = Date.now();
  let overviewJson;
  try {
    console.log('3) SpecGenV2 overview…');
    overviewJson = await specGenerationServiceV2.generateOverview(specId, brief.userInput);
  } catch (err) {
    console.error(`   OVERVIEW FAILED: ${err.message}`);
    if (!keep) {
      try {
        await db.collection('specs').doc(specId).delete();
      } catch (_) {}
    }
    return {
      caseDef,
      specId,
      ok: false,
      error: err.message,
      conclusion: conclusionFor(caseDef, null, null, err.message)
    };
  }

  const overviewObj = parseMaybe(overviewJson);
  const title =
    overviewObj?.shortTitle || overviewObj?.applicationName || caseDef.id;

  await db.collection('specs').doc(specId).update({
    overview: overviewJson,
    title: `[LB-FULL-EVAL] ${title}`,
    'status.overview': 'ready',
    overviewApproved: true,
    generationVersion: 'v2',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const overviewEval = evaluateOverview(caseDef, overviewObj || {}, brief.userInput);
  console.log(
    `   overview: ${overviewEval.ok ? 'PASS' : 'FAIL'} · issues=${overviewEval.issues.length || 0}`
  );
  overviewEval.issues.forEach((i) => console.log(`     - ${i}`));

  let advancedEval = null;
  let processed = null;
  if (!overviewOnly) {
    console.log('4) SpecGenV2 generateAllSpecs (advanced)…');
    try {
      processed = await specGenerationServiceV2.generateAllSpecs(
        specId,
        overviewJson,
        [brief.userInput, '', '']
      );
      const patch = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      for (const stage of ADVANCED_STAGES) {
        if (processed[stage]) {
          patch[stage] = processed[stage];
          patch[`status.${stage}`] = 'ready';
        } else {
          patch[`status.${stage}`] = 'error';
        }
      }
      await db.collection('specs').doc(specId).update(patch);
      advancedEval = evaluateAdvanced(processed);
      console.log(
        `   advanced: ${advancedEval.ok ? 'PASS' : 'FAIL'} · present=${JSON.stringify(advancedEval.present)}`
      );
      advancedEval.issues.forEach((i) => console.log(`     - ${i}`));
      if (processed.errors?.length) {
        console.log(
          `   generation errors: ${processed.errors.map((e) => e.stage + ':' + e.error?.message).join('; ')}`
        );
      }
    } catch (err) {
      console.error(`   ADVANCED FAILED: ${err.message}`);
      advancedEval = { ok: false, issues: [err.message], present: {} };
    }
  } else {
    console.log('4) Skipping advanced (--overview-only)');
  }

  const ok = overviewEval.ok && (overviewOnly || (advancedEval && advancedEval.ok));
  const conclusion = conclusionFor(caseDef, overviewEval, advancedEval, null);

  const report = {
    caseId: caseDef.id,
    label: caseDef.label,
    specId,
    title,
    durationMs: Date.now() - started,
    readiness: brief.readiness.score,
    userInput: brief.userInput,
    overviewEval,
    advancedEval,
    conclusion,
    checks: { ok },
    viewerHint: `/pages/spec-viewer.html?id=${specId}`,
    overviewSnippet: {
      shortTitle: overviewObj?.shortTitle,
      ideaSummary: overviewObj?.ideaSummary,
      featureSample: (overviewObj?.coreFeaturesOverview || []).slice(0, 3),
      personaNames: (overviewObj?.personas || []).map((p) => p?.name).filter(Boolean),
      glossaryTerms: (overviewObj?.glossary || []).map((g) => g?.term).filter(Boolean),
      epicNames: (overviewObj?.epics || []).map((e) => e?.name).filter(Boolean)
    }
  };

  const reportPath = path.join(outDir, `full-${caseDef.id}-${specId}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  // Also dump raw overview for careful inspection
  fs.writeFileSync(
    path.join(outDir, `full-${caseDef.id}-${specId}-overview.json`),
    typeof overviewJson === 'string' ? overviewJson : JSON.stringify(overviewObj, null, 2)
  );
  if (processed) {
    fs.writeFileSync(
      path.join(outDir, `full-${caseDef.id}-${specId}-advanced-meta.json`),
      JSON.stringify(
        {
          successes: (processed.successes || []).map((s) => s.stage),
          errors: (processed.errors || []).map((e) => ({
            stage: e.stage,
            message: e.error?.message || String(e.error)
          })),
          present: advancedEval?.present
        },
        null,
        2
      )
    );
  }

  console.log(`   report → ${reportPath}`);
  console.log(`   CONCLUSION: ${conclusion}`);
  return { caseDef, specId, ok, report, reportPath, conclusion };
}

async function main() {
  console.log('\nLiving Brief → FULL advanced specs quality evaluation\n');
  if (!process.env.OPENAI_API_KEY && !process.env.OPENAI_SPEC_API_KEY) {
    console.error('OPENAI_API_KEY or OPENAI_SPEC_API_KEY required');
    process.exit(1);
  }

  const selected = CASES.filter((c) => !caseFilter || caseFilter.includes(c.id));
  if (!selected.length) {
    console.error('No cases selected. Available:', CASES.map((c) => c.id).join(', '));
    process.exit(1);
  }

  console.log(
    `Mode: ${overviewOnly ? 'overview-only' : 'full-advanced'} · cases=${selected.map((c) => c.id).join(', ')}`
  );

  const results = [];
  for (const c of selected) {
    results.push(await runCase(c));
  }

  const summaryPath = path.join(outDir, `full-summary-${Date.now()}.json`);
  const summary = results.map((r) => ({
    caseId: r.caseDef.id,
    label: r.caseDef.label,
    specId: r.specId,
    ok: r.ok,
    conclusion: r.conclusion || r.report?.conclusion,
    overviewIssues: r.report?.overviewEval?.issues || [],
    advancedIssues: r.report?.advancedEval?.issues || [],
    metrics: r.report?.overviewEval?.metrics || null,
    error: r.error || null,
    viewerHint: r.specId ? `/pages/spec-viewer.html?id=${r.specId}` : null
  }));
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log('\n======== SUMMARY ========');
  summary.forEach((s) => {
    console.log(`${s.ok ? 'PASS' : 'FAIL'}  ${s.caseId}`);
    console.log(`       ${s.conclusion}`);
    if (s.viewerHint) console.log(`       open: ${s.viewerHint}`);
  });
  console.log(`summary → ${summaryPath}`);

  const failed = results.filter((r) => !r.ok).length;
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
