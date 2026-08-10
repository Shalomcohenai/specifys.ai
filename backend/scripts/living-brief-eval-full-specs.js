#!/usr/bin/env node
/**
 * Living Brief → full advanced SpecGenV2 quality evaluation.
 *
 * Covers:
 *   - Normal user chats vs edge-case chats
 *   - Free-style usage (casual / thin intake) vs Pro-style usage (structured / detailed)
 *   - Full pipeline: overview + advanced (technical, market, design, architecture,
 *     visibility, prompts)
 *   - Fidelity: chat requirements → overview AND advanced sections
 *
 * Usage:
 *   node backend/scripts/living-brief-eval-full-specs.js
 *   node backend/scripts/living-brief-eval-full-specs.js --keep
 *   node backend/scripts/living-brief-eval-full-specs.js --overview-only
 *   node backend/scripts/living-brief-eval-full-specs.js --cases=normal-free-habit,edge-pro-conflict
 *   node backend/scripts/living-brief-eval-full-specs.js --persona=pro
 *   node backend/scripts/living-brief-eval-full-specs.js --kind=edge
 *   node backend/scripts/living-brief-eval-full-specs.js --skip-chat   # use canned userInput
 *   node backend/scripts/living-brief-eval-full-specs.js --free-overview-only
 *     # free-persona cases stop after overview (product-accurate free path)
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const livingBrief = require('../server/living-brief-service');
const { db, admin } = require('../server/firebase-admin');
const specGenerationServiceV2 = require('../server/spec-generation-service-v2');

const keep = process.argv.includes('--keep');
const overviewOnly = process.argv.includes('--overview-only');
const freeOverviewOnly = process.argv.includes('--free-overview-only');
const skipChat = process.argv.includes('--skip-chat');
const casesArg = (process.argv.find((a) => a.startsWith('--cases=')) || '').split('=')[1];
const personaArg = (process.argv.find((a) => a.startsWith('--persona=')) || '').split('=')[1];
const kindArg = (process.argv.find((a) => a.startsWith('--kind=')) || '').split('=')[1];
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

/**
 * Case schema:
 *   id, label, kind ('normal'|'edge'), persona ('free'|'pro')
 *   turns[] — simulated Living Brief user messages
 *   mustMention / mustNotBe — overview product-scope keywords
 *   chatRequirements — fidelity checklist vs full advanced output:
 *     mustCarry[]     — phrases that must appear somewhere in overview+advanced
 *     mustNotCarry[]  — phrases that must NOT appear in product scope / advanced
 *     preferInStages{} — optional stage-specific keyword hints (soft fail if missing)
 *   preferAbsent[] — overview product-scope conflicts
 *   sizing bounds: maxGlossary, maxEpics, maxInferredTags, min/maxIdeaSummary, minPersonas?
 */
const CASES = [
  // ─── Normal + Free (casual everyday users) ─────────────────────────────
  {
    id: 'normal-free-habit',
    label: 'Normal free user — simple habit tracker',
    kind: 'normal',
    persona: 'free',
    turns: [
      'I want a habit tracker app',
      'Helps me stick to daily habits instead of forgetting them in notes',
      'Add habit → check in each day → see streak. Mobile. Reminders are must-have.'
    ],
    mustMention: ['habit', 'streak', 'reminder'],
    mustNotBe: ['soc2', 'agency milestone', 'marketplace checkout'],
    chatRequirements: {
      mustCarry: ['habit', 'streak', 'reminder', 'mobile'],
      mustNotCarry: ['enterprise sso', 'soc2 evidence locker'],
      preferInStages: {
        technical: ['mobile', 'push'],
        design: ['mobile']
      }
    },
    maxGlossary: 8,
    maxEpics: 5,
    maxInferredTags: 0,
    minIdeaSummary: 80,
    maxIdeaSummary: 900
  },
  {
    id: 'normal-free-freelancer-crm',
    label: 'Normal free user — freelancer CRM',
    kind: 'normal',
    persona: 'free',
    turns: [
      'simple crm for freelancers',
      'so deals dont die in spreadsheets — today everything is excel',
      'sign up → add contact → create deal → move to won. web. contact timeline + pipeline board.'
    ],
    mustMention: ['crm', 'contact', 'deal', 'pipeline'],
    mustNotBe: ['ceo calendar', 'receipt ocr', 'soc2'],
    chatRequirements: {
      mustCarry: ['contact', 'deal', 'pipeline', 'freelancer'],
      mustNotCarry: ['public marketplace', 'multi-tenant enterprise sso'],
      preferInStages: {
        technical: ['web'],
        market: ['freelancer']
      }
    },
    maxGlossary: 8,
    maxEpics: 5,
    maxInferredTags: 0,
    minIdeaSummary: 100,
    maxIdeaSummary: 900
  },

  // ─── Edge + Free ───────────────────────────────────────────────────────
  {
    id: 'edge-free-minimal',
    label: 'Edge free user — almost no text',
    kind: 'edge',
    persona: 'free',
    turns: ['Habit tracker'],
    mustMention: ['habit'],
    mustNotBe: ['ceo calendar', 'marketplace lens', 'soc2'],
    chatRequirements: {
      mustCarry: ['habit'],
      mustNotCarry: ['agency project status', 'compliance evidence']
    },
    maxGlossary: 8,
    maxEpics: 5,
    maxInferredTags: 0,
    minIdeaSummary: 80,
    maxIdeaSummary: 900
  },
  {
    id: 'edge-free-vague-pivot',
    label: 'Edge free user — vague then abrupt pivot',
    kind: 'edge',
    persona: 'free',
    turns: [
      'maybe something for teachers?',
      'actually no — invoice reminder tool for freelancers who forget to bill clients',
      'web. list invoices → send reminder → mark paid. no accounting suite.'
    ],
    mustMention: ['invoice', 'reminder', 'freelancer'],
    mustNotBe: ['lms', 'gradebook', 'classroom'],
    chatRequirements: {
      mustCarry: ['invoice', 'reminder', 'paid'],
      mustNotCarry: ['teacher gradebook', 'student roster', 'lms'],
      preferInStages: {
        technical: ['email', 'web'],
        market: ['freelancer']
      }
    },
    preferAbsent: ['gradebook', 'classroom', 'student portal'],
    maxGlossary: 8,
    maxEpics: 5,
    maxInferredTags: 0,
    minIdeaSummary: 100,
    maxIdeaSummary: 900
  },

  // ─── Normal + Pro (structured power users) ─────────────────────────────
  {
    id: 'normal-pro-agency',
    label: 'Normal pro user — detailed agency status hub',
    kind: 'normal',
    persona: 'pro',
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
    chatRequirements: {
      mustCarry: [
        'project',
        'milestone',
        'approval',
        'slack',
        'csv',
        'client'
      ],
      mustNotCarry: ['payroll module', 'hr onboarding', 'time tracking as v1 core'],
      preferInStages: {
        technical: ['slack', 'web', 'csv'],
        design: ['calm', 'professional'],
        architecture: ['client', 'approval'],
        market: ['agency', 'b2b'],
        prompts: ['milestone', 'approval']
      }
    },
    preferAbsent: ['payroll', 'full crm'],
    maxGlossary: 8,
    maxEpics: 5,
    maxInferredTags: 0,
    minIdeaSummary: 120,
    maxIdeaSummary: 900
  },
  {
    id: 'normal-pro-b2b-multipersona',
    label: 'Normal pro user — multi-persona B2B compliance',
    kind: 'normal',
    persona: 'pro',
    turns: [
      'B2B compliance evidence locker for SOC2 startups.',
      'Helps security engineers collect audit evidence; today they chase screenshots in Slack and shared drives.',
      'Personas: Security lead (owns controls), Engineer (uploads evidence), Auditor (read-only review), Admin (seats/SSO).',
      'Flow: Admin invites team → Security lead maps controls → Engineer uploads evidence to a control → Security lead marks ready → Auditor reviews pack.',
      'For security teams on web — SSO, control library, evidence versioning, auditor share link are must-haves. No mobile in v1.'
    ],
    mustMention: ['evidence', 'control', 'auditor', 'sso', 'compliance'],
    mustNotBe: ['fitness workout', 'camera marketplace'],
    chatRequirements: {
      mustCarry: ['evidence', 'control', 'auditor', 'sso', 'version'],
      mustNotCarry: ['mobile-first consumer', 'split bill'],
      preferInStages: {
        technical: ['sso', 'web'],
        architecture: ['auditor', 'evidence'],
        visibility: ['auditor', 'role'],
        market: ['soc2', 'compliance']
      }
    },
    maxGlossary: 10,
    maxEpics: 5,
    maxInferredTags: 0,
    minIdeaSummary: 120,
    maxIdeaSummary: 900,
    minPersonas: 3
  },

  // ─── Edge + Pro ────────────────────────────────────────────────────────
  {
    id: 'edge-pro-ambiguous-conflict',
    label: 'Edge pro user — conflicting marketplace vs internal',
    kind: 'edge',
    persona: 'pro',
    turns: [
      'Build a marketplace for freelancers.',
      'Wait — actually it is not a marketplace. It is an internal tool for one company to staff freelancers onto projects.',
      'Buyers and sellers? No. Only internal PMs request freelancers; freelancers apply; ops approves.',
      'But also add public listings so freelancers can browse open gigs like Upwork.',
      'Final decision: internal-only staffing. No public marketplace. No payments in v1 — just request → apply → approve → assign.'
    ],
    mustMention: ['freelance', 'approve', 'assign', 'internal'],
    mustNotBe: ['upwork clone payments', 'public checkout'],
    chatRequirements: {
      mustCarry: ['internal', 'approve', 'assign', 'freelance'],
      mustNotCarry: ['stripe checkout', 'public marketplace', 'buyer reviews'],
      preferInStages: {
        technical: ['internal', 'web'],
        market: ['staffing', 'internal'],
        architecture: ['approve', 'assign']
      }
    },
    preferAbsent: ['public marketplace', 'stripe checkout', 'buyer reviews'],
    maxGlossary: 8,
    maxEpics: 5,
    maxInferredTags: 0,
    minIdeaSummary: 100,
    maxIdeaSummary: 900
  },
  {
    id: 'edge-pro-mobile-consumer',
    label: 'Edge pro user — mobile-first consumer split bills',
    kind: 'edge',
    persona: 'pro',
    turns: [
      'Consumer app: split dinner bills with friends after restaurants.',
      'Helps groups settle who paid what without awkward Venmo math; today they use calculator screenshots in group chat.',
      'Open tab → add friends → snap receipt → assign items → see balances → pay via Apple Pay / link.',
      'Mobile-first iOS+Android. Must-haves: receipt OCR, item assignment, balance summary, push reminders. No web dashboard in v1.'
    ],
    mustMention: ['receipt', 'split', 'balance', 'mobile', 'friend'],
    mustNotBe: ['enterprise sso', 'soc2 evidence'],
    chatRequirements: {
      mustCarry: ['receipt', 'ocr', 'balance', 'mobile', 'push'],
      mustNotCarry: ['web dashboard as v1', 'enterprise sso'],
      preferInStages: {
        technical: ['ocr', 'mobile', 'push'],
        design: ['mobile'],
        architecture: ['receipt', 'balance'],
        prompts: ['receipt', 'split']
      }
    },
    maxGlossary: 8,
    maxEpics: 5,
    maxInferredTags: 0,
    minIdeaSummary: 100,
    maxIdeaSummary: 900
  },
  {
    id: 'edge-pro-hebrew-clinic',
    label: 'Edge pro user — Hebrew-heavy clinic intake',
    kind: 'edge',
    persona: 'pro',
    turns: [
      'אפליקציה לניהול תורים למרפאה קטנה',
      'עוזרת לקליטה לקבוע ולשנות תורים בלי טלפונים; היום הכל ביומן נייר וווטסאפ.',
      'מטופל קובע תור → המרפאה מאשרת → תזכורת נשלחת → צ׳ק אין ביום הביקור.',
      'לצוות קבלה בדפדפן — יומן שבועי, אישור תורים, תזכורות SMS הן חובה בגרסה ראשונה. בלי אפליקציית מטופל מלאה עדיין.'
    ],
    mustMention: ['appointment', 'clinic', 'reminder'],
    mustNotBe: ['marketplace', 'soc2'],
    chatRequirements: {
      mustCarry: ['appointment', 'clinic', 'reminder', 'sms'],
      mustNotCarry: ['public marketplace', 'patient mobile app as v1 core'],
      preferInStages: {
        technical: ['sms', 'web'],
        architecture: ['appointment', 'reminder'],
        market: ['clinic']
      }
    },
    maxGlossary: 8,
    maxEpics: 5,
    maxInferredTags: 0,
    minIdeaSummary: 100,
    maxIdeaSummary: 900
  },
  {
    id: 'edge-pro-scope-explosion',
    label: 'Edge pro user — tries to boil the ocean then constrains',
    kind: 'edge',
    persona: 'pro',
    turns: [
      'We need an all-in-one OS for restaurants: POS, inventory, staff, delivery, loyalty, accounting, and a customer social network.',
      'Priority is only table-side ordering for dine-in guests on tablets — skip POS hardware, skip delivery fleet, skip social.',
      'Flow: Seat guest → open table order on tablet → send to kitchen → pay at table. Web/tablet. Kitchen ticket print + simple item modifiers are must-haves. No loyalty in v1.'
    ],
    mustMention: ['table', 'order', 'kitchen', 'tablet'],
    mustNotBe: ['delivery fleet', 'social network', 'full accounting'],
    chatRequirements: {
      mustCarry: ['table', 'order', 'kitchen', 'tablet', 'modifier'],
      mustNotCarry: ['delivery fleet', 'loyalty program', 'customer social network'],
      preferInStages: {
        technical: ['tablet', 'print', 'web'],
        architecture: ['kitchen', 'order'],
        design: ['tablet'],
        market: ['restaurant']
      }
    },
    preferAbsent: ['loyalty', 'delivery fleet', 'social feed'],
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

async function createSpecDoc(caseId, userInput, caseDef) {
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
    tags: [
      'living-brief-eval',
      'full-spec',
      caseId,
      `persona:${caseDef.persona || 'unknown'}`,
      `kind:${caseDef.kind || 'unknown'}`
    ],
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

function keywordMisses(text, keys) {
  const hay = String(text || '').toLowerCase();
  return (keys || []).filter((k) => !hay.includes(String(k).toLowerCase()));
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

function flattenForSearch(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
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
  // Product-scope only: title, feature strings, screen/epic/story names.
  // Descriptions/narrative may correctly say "without payroll" / "not a marketplace".
  const productScopeBlob = JSON.stringify({
    shortTitle: overviewObj.shortTitle,
    coreFeaturesOverview: overviewObj.coreFeaturesOverview,
    screenNames: (overviewObj.screenDescriptions?.screens || []).map((s) => s?.name),
    epicNames: (overviewObj.epics || []).map((e) => e?.name),
    storyTitles: (overviewObj.epics || []).flatMap((e) => (e?.stories || []).map((st) => st?.title))
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

/**
 * Compare original chat requirements to the full advanced artifact set.
 * Hard fails on mustCarry / mustNotCarry; soft notes on preferInStages misses.
 */
function evaluateChatVsAdvanced(caseDef, overviewObj, processed) {
  const req = caseDef.chatRequirements || {};
  const issues = [];
  const softIssues = [];
  const byStage = {};

  const overviewBlob = flattenForSearch(overviewObj);
  const stageBlobs = {};
  for (const stage of ADVANCED_STAGES) {
    const raw = processed?.[stage];
    stageBlobs[stage] = flattenForSearch(raw);
    byStage[stage] = {
      chars: stageBlobs[stage].length,
      present: stageHasContent(raw)
    };
  }

  const fullBlob = [overviewBlob, ...Object.values(stageBlobs)].join('\n').toLowerCase();
  const advancedOnlyBlob = Object.values(stageBlobs).join('\n').toLowerCase();

  const mustCarry = req.mustCarry || caseDef.mustMention || [];
  const carried = keywordHits(fullBlob, mustCarry);
  const missingCarry = keywordMisses(fullBlob, mustCarry);
  // Require ~70% of chat requirements to survive into overview+advanced
  const carryThreshold = Math.ceil(mustCarry.length * 0.7);
  if (carried.length < carryThreshold) {
    issues.push(
      `chat→spec fidelity: only ${carried.length}/${mustCarry.length} requirements carried (${missingCarry.join('|') || 'none'})`
    );
  }

  // Prefer that advanced sections (not only overview) retain core requirements
  if (processed && mustCarry.length) {
    const advancedHits = keywordHits(advancedOnlyBlob, mustCarry);
    const advancedThreshold = Math.ceil(mustCarry.length * 0.5);
    if (advancedHits.length < advancedThreshold) {
      issues.push(
        `chat→advanced fidelity: advanced sections weak on requirements (hit ${advancedHits.join('|') || 'none'})`
      );
    }
  }

  const mustNotCarry = req.mustNotCarry || [];
  const leaked = keywordHits(fullBlob, mustNotCarry);
  if (leaked.length) {
    issues.push(`chat→spec forbidden concepts leaked (${leaked.join('|')})`);
  }

  const preferInStages = req.preferInStages || {};
  const stageCoverage = {};
  for (const [stage, keys] of Object.entries(preferInStages)) {
    const hay = (stageBlobs[stage] || '').toLowerCase();
    const hits = keywordHits(hay, keys);
    const misses = keywordMisses(hay, keys);
    stageCoverage[stage] = { hits, misses };
    // Soft: missing preferred stage keywords — only hard-fail when stage is empty of all prefs
    if (keys.length && hits.length === 0 && stageHasContent(processed?.[stage])) {
      softIssues.push(`${stage}: none of preferred chat cues present (${keys.join('|')})`);
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    softIssues,
    metrics: {
      carried,
      missingCarry,
      leaked,
      stageCoverage,
      byStage,
      mustCarryCount: mustCarry.length,
      carriedCount: carried.length
    }
  };
}

function evaluateAdvanced(caseDef, processed, overviewObj) {
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

  const fidelity = evaluateChatVsAdvanced(caseDef, overviewObj, processed);
  issues.push(...fidelity.issues);

  return {
    ok: issues.length === 0,
    issues,
    softIssues: fidelity.softIssues,
    present,
    fidelity: fidelity.metrics
  };
}

function shouldSkipAdvanced(caseDef) {
  if (overviewOnly) return true;
  if (freeOverviewOnly && caseDef.persona === 'free') return true;
  return false;
}

function conclusionFor(caseDef, overviewEval, advancedEval, fidelityNote, error) {
  if (error) {
    return `FAILED to generate: ${error}. Pipeline/infra issue, not just prompt quality.`;
  }
  const oIssues = overviewEval?.issues || [];
  const aIssues = advancedEval?.issues || [];
  const soft = advancedEval?.softIssues || [];
  const tag = `[${caseDef.kind}/${caseDef.persona}]`;
  if (!oIssues.length && (!advancedEval || !aIssues.length)) {
    const softBit = soft.length ? ` (soft notes: ${soft.slice(0, 2).join('; ')})` : '';
    return `PASS ${tag} — ${caseDef.label}: overview healthy, advanced complete, chat requirements carried into advanced${softBit}.`;
  }
  const top = [...oIssues, ...aIssues].slice(0, 5).join('; ');
  return `FAIL ${tag} ${caseDef.label}: ${top}`;
}

async function runCase(caseDef) {
  console.log(
    `\n======== ${caseDef.id} — ${caseDef.label} [${caseDef.kind}/${caseDef.persona}] ========`
  );
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
  const specId = await createSpecDoc(caseDef.id, brief.userInput, caseDef);
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
      conclusion: conclusionFor(caseDef, null, null, null, err.message)
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
  const skipAdv = shouldSkipAdvanced(caseDef);
  if (!skipAdv) {
    console.log('4) SpecGenV2 generateAllSpecs (advanced) + chat→advanced fidelity…');
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
      advancedEval = evaluateAdvanced(caseDef, processed, overviewObj || {});
      console.log(
        `   advanced: ${advancedEval.ok ? 'PASS' : 'FAIL'} · present=${JSON.stringify(advancedEval.present)}`
      );
      advancedEval.issues.forEach((i) => console.log(`     - ${i}`));
      (advancedEval.softIssues || []).forEach((i) => console.log(`     ~ soft: ${i}`));
      if (advancedEval.fidelity) {
        console.log(
          `   fidelity: carried ${advancedEval.fidelity.carriedCount}/${advancedEval.fidelity.mustCarryCount} · missing=${(advancedEval.fidelity.missingCarry || []).join('|') || 'none'}`
        );
      }
      if (processed.errors?.length) {
        console.log(
          `   generation errors: ${processed.errors.map((e) => e.stage + ':' + e.error?.message).join('; ')}`
        );
      }
    } catch (err) {
      console.error(`   ADVANCED FAILED: ${err.message}`);
      advancedEval = { ok: false, issues: [err.message], present: {}, softIssues: [] };
    }
  } else {
    const reason = overviewOnly
      ? '--overview-only'
      : '--free-overview-only (free persona)';
    console.log(`4) Skipping advanced (${reason})`);
    // Still score overview-only fidelity against chat requirements
    const fidelity = evaluateChatVsAdvanced(caseDef, overviewObj || {}, null);
    if (!fidelity.ok) {
      overviewEval.issues.push(...fidelity.issues);
      overviewEval.ok = overviewEval.issues.length === 0;
    }
    overviewEval.metrics.fidelity = fidelity.metrics;
    fidelity.issues.forEach((i) => console.log(`     - ${i}`));
  }

  const ok = overviewEval.ok && (skipAdv || (advancedEval && advancedEval.ok));
  const conclusion = conclusionFor(caseDef, overviewEval, advancedEval, null, null);

  const report = {
    caseId: caseDef.id,
    label: caseDef.label,
    kind: caseDef.kind,
    persona: caseDef.persona,
    specId,
    title,
    durationMs: Date.now() - started,
    readiness: brief.readiness.score,
    userInput: brief.userInput,
    chatTurns: caseDef.turns,
    chatRequirements: caseDef.chatRequirements || null,
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
          present: advancedEval?.present,
          fidelity: advancedEval?.fidelity || null,
          softIssues: advancedEval?.softIssues || []
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

  let selected = CASES.filter((c) => !caseFilter || caseFilter.includes(c.id));
  if (personaArg) {
    selected = selected.filter((c) => c.persona === personaArg);
  }
  if (kindArg) {
    selected = selected.filter((c) => c.kind === kindArg);
  }
  if (!selected.length) {
    console.error(
      'No cases selected. Available:',
      CASES.map((c) => `${c.id}(${c.kind}/${c.persona})`).join(', ')
    );
    process.exit(1);
  }

  console.log(
    `Mode: ${overviewOnly ? 'overview-only' : freeOverviewOnly ? 'full (free→overview)' : 'full-advanced'} · cases=${selected.map((c) => c.id).join(', ')}`
  );
  console.log(
    `Matrix: normal=${selected.filter((c) => c.kind === 'normal').length} edge=${selected.filter((c) => c.kind === 'edge').length} · free=${selected.filter((c) => c.persona === 'free').length} pro=${selected.filter((c) => c.persona === 'pro').length}`
  );

  const results = [];
  for (const c of selected) {
    results.push(await runCase(c));
  }

  const summaryPath = path.join(outDir, `full-summary-${Date.now()}.json`);
  const summary = results.map((r) => ({
    caseId: r.caseDef.id,
    label: r.caseDef.label,
    kind: r.caseDef.kind,
    persona: r.caseDef.persona,
    specId: r.specId,
    ok: r.ok,
    conclusion: r.conclusion || r.report?.conclusion,
    overviewIssues: r.report?.overviewEval?.issues || [],
    advancedIssues: r.report?.advancedEval?.issues || [],
    softIssues: r.report?.advancedEval?.softIssues || [],
    fidelity: r.report?.advancedEval?.fidelity || r.report?.overviewEval?.metrics?.fidelity || null,
    metrics: r.report?.overviewEval?.metrics || null,
    error: r.error || null,
    viewerHint: r.specId ? `/pages/spec-viewer.html?id=${r.specId}` : null
  }));
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log('\n======== SUMMARY ========');
  summary.forEach((s) => {
    console.log(`${s.ok ? 'PASS' : 'FAIL'}  ${s.caseId} [${s.kind}/${s.persona}]`);
    console.log(`       ${s.conclusion}`);
    if (s.fidelity) {
      console.log(
        `       fidelity carried ${s.fidelity.carriedCount}/${s.fidelity.mustCarryCount}`
      );
    }
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
