/**
 * Living Brief — chat turn → structured draft proposals + readiness.
 * Works with OpenAI when configured; otherwise uses a deterministic heuristic engine.
 */

const AIService = require('./ai-service');

function emptyDraft() {
  return {
    vision: '',
    pages: [],
    workflows: [],
    features: [],
    design: null,
    integrations: [],
    audience: { platform: null, interests: [], ageRange: null },
    references: []
  };
}

function normalizeReference(r) {
  if (!r || typeof r !== 'object') return null;
  const kind = r.kind === 'image' ? 'image' : 'text';
  const note = String(r.note || '').trim().slice(0, 500);
  const description = String(r.description || '').trim().slice(0, 4000);
  if (!description && !note) return null;
  return {
    id: String(r.id || '').slice(0, 80),
    kind,
    note,
    description: description || note
  };
}

function normalizeDraft(raw) {
  const base = emptyDraft();
  if (!raw || typeof raw !== 'object') return base;
  return {
    vision: typeof raw.vision === 'string' ? raw.vision : '',
    pages: Array.isArray(raw.pages) ? raw.pages.filter(Boolean).map(normalizePage) : [],
    workflows: Array.isArray(raw.workflows) ? raw.workflows.filter(Boolean).map(normalizeWorkflow) : [],
    features: Array.isArray(raw.features) ? raw.features.map(String).filter(Boolean) : [],
    design: raw.design ? String(raw.design) : null,
    integrations: Array.isArray(raw.integrations) ? raw.integrations.map(String).filter(Boolean) : [],
    audience: {
      platform: raw.audience && raw.audience.platform ? String(raw.audience.platform) : null,
      interests: Array.isArray(raw.audience?.interests) ? raw.audience.interests.map(String) : [],
      ageRange: raw.audience?.ageRange || null
    },
    references: Array.isArray(raw.references)
      ? raw.references.map(normalizeReference).filter(Boolean).slice(0, 10)
      : []
  };
}

function normalizePage(p) {
  if (typeof p === 'string') return { name: p, description: '' };
  return {
    name: String(p.name || 'Untitled page'),
    description: String(p.description || '')
  };
}

function normalizeWorkflow(w) {
  if (typeof w === 'string') return { name: w, steps: [] };
  return {
    name: String(w.name || 'Untitled flow'),
    steps: Array.isArray(w.steps) ? w.steps.map(String).filter(Boolean) : []
  };
}

function userMessagesCorpus(messages) {
  // USER messages only — assistant copy and AI-written draft.vision must never inflate readiness
  if (!Array.isArray(messages)) return '';
  return messages
    .filter((m) => m && m.role === 'user' && m.content)
    .map((m) => m.content)
    .join(' ')
    .toLowerCase()
    .trim();
}

/** @deprecated use userMessagesCorpus — kept for call sites that still pass draft */
function corpusFrom(draft, messages) {
  return userMessagesCorpus(messages);
}

function isThinProductPitch(text) {
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return true;
  if (t.length < 80) return true;
  // Long category titles still count as thin until job + current alternative show up
  const hasJobOrPain =
    /\b(helps?|lets?|so that|instead of|today|currently|workaround|problem|pain|replace|without|because)\b/i.test(
      t
    ) || /(במקום|היום|בעיה|כדי ש|עוזר|בלי |במקום לעבוד)/.test(t);
  if (t.length < 140 && !hasJobOrPain) return true;
  return false;
}

function classifyFollowUpTopic(text) {
  const t = String(text || '').toLowerCase();
  if (
    /design vibe|design direction|look and feel|visual style|brand|minimal|saas soft|brutalist|glassmorph|ui style/.test(
      t
    ) &&
    !/must-have feature|main path|who is it for|product in one line|what job/.test(t)
  ) {
    return 'design';
  }
  if (
    /3–4 steps|3-4 steps|main path|happiest path|user flow|plain steps|first →|first ->|outline the main|walk me through|key screens|list the main path/.test(
      t
    )
  ) {
    return 'structure';
  }
  if (
    /product in one line|what job does it|current workaround|core job|one sentence|what (are we|does this product) do|what problem|painful alternative|people use today instead/.test(
      t
    )
  ) {
    return 'vision';
  }
  if (/who is it for|must-have feature|web\/mobile|platform|who.?s it for|target audience|2 must-have/.test(t)) {
    return 'audience';
  }
  return null;
}

/**
 * Keep the assistant's closing question on the readiness timeline.
 * Prevents jumping to flow while vision is still thin.
 */
function enforceFollowUpQuestion(reply, nextQuestion) {
  const ask = nextQuestion && nextQuestion.text ? String(nextQuestion.text).trim() : '';
  if (!ask) return String(reply || '').trim();
  let base = String(reply || '').trim();
  const want = nextQuestion.id;
  const have = classifyFollowUpTopic(base);

  if (have === want) {
    // Already asking the right gap — keep AI wording
    return base;
  }

  // Keep acknowledgments; drop sentences/paragraphs that ask a different gap
  const scrubChunk = (chunk) => {
    const sentences = String(chunk).match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [chunk];
    return sentences
      .map((s) => s.trim())
      .filter((s) => {
        if (!s) return false;
        const topic = classifyFollowUpTopic(s);
        if (topic && topic !== want) return false;
        if (/\?/.test(s) && topic !== want) return false;
        return true;
      })
      .join(' ')
      .trim();
  };

  base = base
    .split(/\n\n+/)
    .map(scrubChunk)
    .filter(Boolean)
    .join('\n\n')
    .trim();

  if (want === 'vision') {
    base = base
      .replace(/\s*(To move forward|Almost there|Next)[,:]?[^.?!]*\?/gi, '')
      .replace(/\s*could you outline[^.?!]*\?/gi, '')
      .trim();
  }

  if (!base) return ask;
  if (base.includes(ask) || classifyFollowUpTopic(base) === want) return base;
  return `${base}\n\n${ask}`;
}

function isWaiverText(text) {
  return /\b(i don'?t know|don'?t know|not sure|no idea|you (can )?decide|you choose|up to you|doesn'?t matter|no preference|skip (that|it|this)|whatever works|you (figure|handle) it|לא יודע|אין לי מושג|לא משנה|כמו שאתה חושב|תכריע אתה)\b/i.test(
    String(text || '')
  );
}

function describesUserFlow(text) {
  const t = String(text || '').toLowerCase();
  if (!t || t.replace(/\s+/g, ' ').trim().length < 10) return false;
  if (/\b(then|after that|afterwards|first|next|finally|before|once|later|followed by|and then|after which)\b/.test(t)) {
    return true;
  }
  if (/(?:^|\n)\s*\d+[\).\-:]\s+\S/.test(t)) return true;
  if (/→|->|➜|⟶|⇒/.test(t)) return true;
  if (/(ואז|אחר כך|קודם כל|קודם|בשלב|לאחר מכן|ואחרי זה|בהתחלה|בסוף|נכנס|לוחץ|פותח)/.test(t)) {
    return true;
  }
  const actions =
    t.match(
      /\b(open|opens|opening|create|creates|creating|add|adds|adding|send|sends|move|moves|click|clicks|select|selects|upload|uploads|view|views|assign|assigns|reply|replies|import|imports|log|logs|pay|pays|checkout|sign\s?up|log\s?in|onboard|go to|goes to|start|starts|finish|finishes|complete|completes)\b/g
    ) || [];
  if (actions.length >= 2) return true;
  if (
    /\b(user (can|will|should|opens?|goes|starts?)|they (open|create|add|go|start)|customer (opens?|creates?|adds?))\b/.test(
      t
    )
  ) {
    return true;
  }
  const screens =
    t.match(/\b(page|pages|screen|screens|dashboard|inbox|pipeline|stage|stages|tab|tabs|view|views|home)\b/g) || [];
  if (screens.length >= 2) return true;
  if ((t.match(/,/g) || []).length >= 2 && /\b(and|then)\b/.test(t) && actions.length >= 1) return true;
  return false;
}

function flowExampleForCorpus(userText) {
  const c = String(userText || '').toLowerCase();
  if (/crm|sales|pipeline|lead|deal/.test(c)) {
    return 'e.g. “Sign up → add a contact → create a deal → move it to Won.”';
  }
  if (/inbox|ticket|support|helpdesk/.test(c)) {
    return 'e.g. “Sign up → connect email → triage a ticket → reply → resolve.”';
  }
  if (/fitness|workout|coach|habit/.test(c)) {
    return 'e.g. “Onboard → set a goal → do today’s workout → see progress.”';
  }
  return 'e.g. “Sign up → reach the main screen → finish the core action → see success.”';
}

/**
 * Realistic “enough info to generate a spec?” score (0–100).
 * USER text only (assistant questions never inflate). Vision 40 · Flow 35 · Scope 25.
 */
function computeReadiness(draft, opts = {}) {
  const d = normalizeDraft(draft);
  const messages = opts.messages || [];
  const waivers = opts.waivers || {};
  const missing = [];
  const checks = [];
  const userText = userMessagesCorpus(messages);
  const userLen = userText.length;
  const userTurns = messages.filter((m) => m && m.role === 'user').length;

  // Vision only from what the USER wrote — never from AI draft.vision paraphrases
  const hasVision = !isThinProductPitch(userText);

  const hasStructureDraft =
    d.workflows.some((wf) => (wf.steps || []).length >= 2) || d.pages.length >= 2;
  const hasStructure =
    describesUserFlow(userText) || Boolean(waivers.structure) || hasStructureDraft;

  const hasFeaturesChat =
    /\b(contact|pipeline|deal|lead|ticket|invoice|notif|notification|payment|stripe|auth|login|chat|search|report|analytics|calendar|email|sms|dashboard|permission|role|billing|subscription|upload|export|integrat)\b/.test(
      userText
    );
  const hasWho =
    Boolean(waivers.audience) ||
    /\b(for (my |our )?(sales|teachers|students|sellers|buyers|founders|teams?|agents?|customers?)|b2b|b2c|sales team|support team|indie)\b/.test(
      userText
    ) ||
    /\b(mobile app|ios|android|web app|on the web|web and mobile)\b/.test(userText);
  const hasScope =
    (hasFeaturesChat && hasWho) || (hasFeaturesChat && userTurns >= 2) || (hasWho && hasFeaturesChat);

  if (hasVision) checks.push({ id: 'vision', label: 'Vision', done: true });
  else {
    checks.push({ id: 'vision', label: 'Vision', done: false });
    missing.push('a clearer product vision');
  }
  if (hasStructure) checks.push({ id: 'structure', label: 'Flow', done: true });
  else {
    checks.push({ id: 'structure', label: 'Flow', done: false });
    missing.push('at least one user flow or a few key pages');
  }
  if (hasScope) checks.push({ id: 'audience', label: 'Scope', done: true });
  else {
    checks.push({ id: 'audience', label: 'Scope', done: false });
    missing.push('who it is for (platform) or core features');
  }

  let score = 0;
  if (hasVision) score += 40;
  if (hasStructure) score += 35;
  if (hasScope) score += 25;

  const nextQuestion = pickNextFollowUp({
    missing,
    hasStructure,
    hasVision,
    hasAudienceOrFeatures: hasScope,
    waivers,
    userText
  });
  return {
    score,
    missing,
    checks,
    nextQuestion,
    ready: hasVision && hasStructure && hasScope
  };
}

function pickNextFollowUp(ctx) {
  const { missing, waivers, userText } = ctx || {};
  const miss = missing || [];
  if (miss.some((m) => /vision/i.test(m))) {
    return {
      id: 'vision',
      text:
        'For 100% we still need the product in one line: what job does it do, and what do people use today instead? (e.g. “A CRM for freelancers — today they track deals in spreadsheets.”)'
    };
  }
  if (miss.some((m) => /flow|page/i.test(m)) && !waivers?.structure) {
    return {
      id: 'structure',
      text: `Almost there — list the main path in 3–4 steps (first → next → done). ${flowExampleForCorpus(userText)} Or say “you decide” and I’ll draft one.`
    };
  }
  if (miss.some((m) => /who it is for|platform|feature/i.test(m)) && !waivers?.audience) {
    return {
      id: 'audience',
      text:
        'Last piece for 100%: who is it for + web/mobile/both, and 2 must-have features at launch? (e.g. “Sales teams on web — pipeline board + follow-up reminders.”)'
    };
  }
  return null;
}

function lastUserMessage(messages) {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i] && messages[i].role === 'user' && messages[i].content) {
      return String(messages[i].content).trim();
    }
  }
  return '';
}

function conversationText(messages) {
  if (!Array.isArray(messages)) return '';
  return messages
    .filter((m) => m && m.content)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');
}

function uniqueByName(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = (item.name || item).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Deterministic local engine — keeps the UX alive without OpenAI.
 */
function heuristicTurn(messages, draftInput) {
  const draft = normalizeDraft(draftInput);
  const userText = lastUserMessage(messages);
  const proposals = [];
  const draftPatch = {};

  if (userText) {
    const visionBase = draft.vision || '';
    if (!visionBase || userText.length > 30) {
      const merged = visionBase
        ? (visionBase.includes(userText.slice(0, 40)) ? visionBase : `${visionBase} ${userText}`.trim())
        : userText;
      draftPatch.vision = merged.slice(0, 2000);
      draft.vision = draftPatch.vision;
    }

    const lower = userText.toLowerCase();

    // Platform
    if (!draft.audience.platform) {
      if (/\b(ios|android|mobile app|mobile)\b/.test(lower) && /\b(web|desktop|browser)\b/.test(lower)) {
        proposals.push({
          id: `prop-platform-both-${Date.now()}`,
          type: 'audience.platform',
          label: 'Platform',
          value: 'both',
          summary: 'Target both mobile and web'
        });
      } else if (/\b(ios|android|mobile app|mobile)\b/.test(lower)) {
        proposals.push({
          id: `prop-platform-mobile-${Date.now()}`,
          type: 'audience.platform',
          label: 'Platform',
          value: 'mobile',
          summary: 'Target mobile'
        });
      } else if (/\b(web app|saas|browser|desktop)\b/.test(lower)) {
        proposals.push({
          id: `prop-platform-web-${Date.now()}`,
          type: 'audience.platform',
          label: 'Platform',
          value: 'web',
          summary: 'Target web'
        });
      }
    }

    // Design hints
    const designMap = [
      [/minimal|clean|simple/, 'Minimal'],
      [/saas|soft|friendly/, 'SaaS Soft'],
      [/cyber|neon|futur/, 'Cyberpunk'],
      [/corporate|enterprise|professional/, 'Corporate'],
      [/playful|fun|game/, 'Toy/Playful'],
      [/glass/, 'Glassmorphic'],
      [/brutal/, 'Neo-Brutalist'],
      [/elegant|luxury|premium/, 'Elegant']
    ];
    if (!draft.design) {
      for (const [re, name] of designMap) {
        if (re.test(lower)) {
          proposals.push({
            id: `prop-design-${name}-${Date.now()}`,
            type: 'design',
            label: 'Design style',
            value: name,
            summary: `Use ${name} design language`
          });
          break;
        }
      }
    }

    // Feature keywords
    const featureHints = [
      [/auth|login|sign\s?up|sign-in/, 'User Authentication'],
      [/notif/, 'Notifications'],
      [/pay|stripe|billing|subscription/, 'Payment Processing'],
      [/chat|messaging/, 'Real-time Chat'],
      [/dashboard|analytics/, 'Analytics Dashboard'],
      [/upload|files?/, 'File Upload'],
      [/search/, 'Search Functionality'],
      [/profile/, 'User Profiles'],
      [/admin/, 'Admin Panel'],
      [/dark mode/, 'Dark Mode']
    ];
    const existingFeatures = new Set(draft.features.map((f) => f.toLowerCase()));
    for (const [re, name] of featureHints) {
      if (re.test(lower) && !existingFeatures.has(name.toLowerCase())) {
        proposals.push({
          id: `prop-feat-${name.replace(/\s+/g, '-')}-${Date.now()}`,
          type: 'feature',
          label: 'Feature',
          value: name,
          summary: `Add feature: ${name}`
        });
        existingFeatures.add(name.toLowerCase());
      }
    }

    // Integration keywords
    const integrationHints = [
      [/stripe/, 'Stripe Payments'],
      [/firebase/, 'Firebase Database'],
      [/supabase/, 'Supabase'],
      [/openai|gpt|ai chat/, 'OpenAI / AI Chat'],
      [/slack/, 'Slack Notifications'],
      [/mailchimp/, 'Mailchimp Email'],
      [/analytics|ga4|google analytics/, 'Google Analytics'],
      [/auth0/, 'Auth0 Login'],
      [/maps/, 'Google Maps']
    ];
    const existingInt = new Set(draft.integrations.map((i) => i.toLowerCase()));
    for (const [re, name] of integrationHints) {
      if (re.test(lower) && !existingInt.has(name.toLowerCase())) {
        proposals.push({
          id: `prop-int-${name.replace(/\s+/g, '-')}-${Date.now()}`,
          type: 'integration',
          label: 'Integration',
          value: name,
          summary: `Connect ${name}`
        });
        existingInt.add(name.toLowerCase());
      }
    }

    // Flow extraction: "flow:", numbered lists, "then" chains
    const flowMatch = userText.match(/(?:flow|workflow|journey)\s*(?:called|named|:)?\s*["']?([^"'\n:]+)["']?\s*:?\s*([\s\S]+)/i);
    const numbered = userText.match(/(?:^|\n)\s*1[\).\-:]\s+.+/m);
    const thenChain = userText.match(/(.+?)\s+then\s+(.+)/i);

    const existingFlowNames = new Set(draft.workflows.map((w) => w.name.toLowerCase()));

    if (flowMatch) {
      const name = flowMatch[1].trim().slice(0, 80);
      const body = flowMatch[2];
      const steps = body
        .split(/\n|;|→|->|\s+then\s+/i)
        .map((s) => s.replace(/^\s*\d+[\).\-:]\s*/, '').trim())
        .filter((s) => s.length > 2 && s.toLowerCase() !== name.toLowerCase())
        .slice(0, 12);
      if (!existingFlowNames.has(name.toLowerCase())) {
        proposals.push({
          id: `prop-flow-${Date.now()}`,
          type: 'workflow',
          label: 'Workflow',
          value: { name, steps: steps.length ? steps : ['User starts', 'System responds', 'Done'] },
          summary: `Add flow: ${name}`
        });
      }
    } else if (numbered) {
      const steps = userText
        .split('\n')
        .map((line) => line.replace(/^\s*\d+[\).\-:]\s*/, '').trim())
        .filter((s) => s.length > 2)
        .slice(0, 12);
      if (steps.length >= 2) {
        const name = steps[0].length < 40 ? steps[0] : 'Primary user flow';
        const flowSteps = steps[0].length < 40 ? steps.slice(1) : steps;
        if (!existingFlowNames.has(name.toLowerCase())) {
          proposals.push({
            id: `prop-flow-num-${Date.now()}`,
            type: 'workflow',
            label: 'Workflow',
            value: { name, steps: flowSteps },
            summary: `Add flow: ${name}`
          });
        }
      }
    } else if (thenChain && userText.length < 400) {
      const parts = userText
        .split(/\s+then\s+/i)
        .map((s) => s.replace(/^when\s+/i, '').trim())
        .filter(Boolean)
        .slice(0, 8);
      if (parts.length >= 2) {
        const name = 'User journey';
        if (!existingFlowNames.has(name.toLowerCase()) || draft.workflows.length === 0) {
          proposals.push({
            id: `prop-flow-then-${Date.now()}`,
            type: 'workflow',
            label: 'Workflow',
            value: { name, steps: parts },
            summary: 'Add flow: User journey'
          });
        }
      }
    }

    // Page hints
    const pageHints = userText.match(/(?:pages?|screens?)\s*:?\s*([^.!?]+)/i);
    if (pageHints) {
      const names = pageHints[1]
        .split(/,| and |\/|&/i)
        .map((s) => s.trim().replace(/^the\s+/i, ''))
        .filter((s) => s.length > 1 && s.length < 40)
        .slice(0, 8);
      const existingPages = new Set(draft.pages.map((p) => p.name.toLowerCase()));
      names.forEach((name, idx) => {
        if (existingPages.has(name.toLowerCase())) return;
        proposals.push({
          id: `prop-page-${idx}-${Date.now()}`,
          type: 'page',
          label: 'Page',
          value: { name: name.replace(/^\w/, (c) => c.toUpperCase()), description: '' },
          summary: `Add page: ${name}`
        });
      });
    }
  }

  const nextDraft = applyDraftPatch(draft, draftPatch);
  const waivers = Object.assign({}, optsWaiversFromMessages(messages));
  if (waivers.structure && !nextDraft.workflows.length && !proposals.some((p) => p.type === 'workflow')) {
    proposals.push({
      id: `prop-default-flow-${Date.now()}`,
      type: 'workflow',
      label: 'Workflow',
      value: {
        name: 'Core happy path',
        steps: ['Land on home', 'Complete the main action', 'See confirmation / next step']
      },
      summary: 'Add flow: Core happy path'
    });
  }
  const readiness = computeReadiness(nextDraft, { messages, waivers });
  const reply = buildHeuristicReply(userText, nextDraft, readiness, proposals);

  return {
    reply,
    proposals: proposals.slice(0, 6),
    draftPatch,
    readiness,
    engine: 'heuristic'
  };
}

function optsWaiversFromMessages(messages) {
  const waivers = {};
  const last = lastUserMessage(messages);
  const priorAssistant = [...(messages || [])]
    .reverse()
    .find((m) => m && m.role === 'assistant' && m.content);
  if (
    priorAssistant &&
    /happiest path|first,\s*then|plain steps|key (screens|pages)|user do first/i.test(
      String(priorAssistant.content)
    )
  ) {
    waivers.structureAsked = true;
  }
  if (!isWaiverText(last)) return waivers;
  // User can't / won't answer the last ask — don't punish structure/audience gaps
  waivers.structure = true;
  waivers.audience = true;
  waivers.polish = true;
  return waivers;
}

function applyDraftPatch(draft, patch) {
  const next = normalizeDraft(draft);
  if (!patch) return next;
  if (typeof patch.vision === 'string') next.vision = patch.vision;
  if (Array.isArray(patch.pages)) next.pages = uniqueByName([...next.pages, ...patch.pages.map(normalizePage)]);
  if (Array.isArray(patch.workflows)) {
    next.workflows = uniqueByName([...next.workflows, ...patch.workflows.map(normalizeWorkflow)]);
  }
  if (Array.isArray(patch.features)) {
    next.features = [...new Set([...next.features, ...patch.features.map(String)])];
  }
  if (patch.design) next.design = String(patch.design);
  if (Array.isArray(patch.integrations)) {
    next.integrations = [...new Set([...next.integrations, ...patch.integrations.map(String)])];
  }
  if (patch.audience) {
    if (patch.audience.platform) next.audience.platform = patch.audience.platform;
    if (Array.isArray(patch.audience.interests)) {
      next.audience.interests = [...new Set([...next.audience.interests, ...patch.audience.interests])];
    }
  }
  return next;
}

function buildHeuristicReply(userText, draft, readiness, proposals) {
  if (!userText) {
    return "Tell me what you're building — the problem, who it's for, and what the first experience looks like. I'll listen and start shaping your brief live.";
  }

  const bits = [];
  const featureProps = proposals.filter((p) => p && p.type === 'feature');
  if (featureProps.length) {
    bits.push(
      featureProps.length === 1
        ? `I added **${featureProps[0].summary.replace(/^Add feature:\s*/i, '')}** to your brief.`
        : `I added ${featureProps.length} features from what you said — hover a feature to remove it if something’s off.`
    );
  } else if (proposals.length) {
    bits.push("Got it — I folded that into your brief.");
  } else if (draft.references && draft.references.length) {
    bits.push(
      `Got it — I’m using your ${draft.references.length} attached reference${draft.references.length === 1 ? '' : 's'} as constraints while we shape the brief.`
    );
  } else {
    bits.push("Got it — I'm folding that into your vision.");
  }

  const ask = readiness.nextQuestion;
  if (ask && ask.text) {
    bits.push(ask.text);
  } else if (readiness.ready || readiness.score >= 80) {
    bits.push("We have enough to generate a full specification whenever you're ready — or keep refining.");
  }

  return bits.join('\n\n');
}

const SYSTEM_PROMPT = `You are Specifys Living Brief — a sharp product partner helping founders/PMs/devs shape an app brief before generating a full PRD.

Tone: warm, concise, alive. 2–4 short paragraphs max.
Never invent company names or fake metrics. Prefer concrete product language.

QUESTION TIMELINE (strict — do not skip ahead):
You MUST ask ONLY the gap in readiness.nextQuestion (id + text). Order is always:
1) vision — if nextQuestion.id is "vision"
2) structure/flow — only after vision is satisfied
3) who + platform + must-have features — only after flow is satisfied

A short category / job-title pitch is NOT vision yet (e.g. “CEO calendar tool”, “מערכת לניהול לוז של מנכלים”, “I want a CRM”).
When nextQuestion.id is "vision", DO NOT ask for user flows, steps, pages, or screens — deepen the product job + current workaround first.
When nextQuestion.id is "structure", ask for 3–4 concrete steps (first → next → done) with a product-specific example.
When nextQuestion.id is "audience", ask who + web/mobile/both + 2 launch features.
If readiness.nextQuestion is null, celebrate briefly and invite Generate — still allow refining.

Do NOT ask about design style or integrations unless the user brings it up — those are optional and must not block progress.
If the user says they don't know / you decide / doesn't matter, accept it, propose a sensible default workflow/features in proposals, and move to the next gap (or invite Generate).
Never re-ask for flow if the user already described a sequence of actions.
Ideas the UI shows must match your question — so your closing question must match nextQuestion.

Return ONLY valid JSON with this shape:
{
  "reply": "assistant message to the user (markdown ok, keep light) — MUST end with the one follow-up question when gaps remain",
  "draftPatch": {
    "vision": "updated cumulative vision paragraph or omit",
    "pages": [{"name":"","description":""}],
    "workflows": [{"name":"","steps":["..."]}],
    "features": ["..."],
    "design": "one of: Minimal|SaaS Soft|Cyberpunk|Corporate|Toy/Playful|Glassmorphic|Neo-Brutalist|Elegant or omit",
    "integrations": ["..."],
    "audience": { "platform": "mobile|web|both", "interests": [] }
  },
  "proposals": [
    {
      "type": "workflow|page|feature|integration|design|audience.platform",
      "label": "short label",
      "summary": "Add flow: Onboarding",
      "value": "string OR {name,steps} OR {name,description}"
    }
  ]
}

Rules:
- Put structural items (flows, pages, features, integrations, design, platform) in proposals — they are auto-applied; features should be concrete product capabilities.
- Use draftPatch.vision to maintain a running product vision summary.
- Only propose NEW items not already in the current draft.
- If the user describes a multi-step journey, propose a workflow with clear steps.
- When structure is missing, ask for the happiest path; if they waive, invent a reasonable default workflow in proposals.
- currentDraft.references may include image/text references (note + description). Treat them as hard UI/product constraints; mention them briefly when relevant. Do not ask the user to re-paste attached references.
- If ready enough and no critical gaps, celebrate briefly and invite them to generate — still allow refining.`;

async function aiTurn(messages, draftInput, apiKey) {
  const draft = normalizeDraft(draftInput);
  const waivers = optsWaiversFromMessages(messages);
  const ai = new AIService(apiKey);
  const readinessBefore = computeReadiness(draft, { messages, waivers });
  const userPayload = JSON.stringify({
    currentDraft: draft,
    readiness: readinessBefore,
    nextQuestion: readinessBefore.nextQuestion,
    recentMessages: (messages || []).slice(-12)
  });

  const raw = await ai.callJsonChatCompletion({
    system: SYSTEM_PROMPT,
    user: userPayload,
    temperature: 0.55,
    model: process.env.OPENAI_AUX_MODEL || 'gpt-4o-mini'
  });

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return heuristicTurn(messages, draft);
  }

  const proposals = Array.isArray(parsed.proposals)
    ? parsed.proposals.slice(0, 6).map((p, i) => ({
        id: `ai-${Date.now()}-${i}`,
        type: String(p.type || 'feature'),
        label: String(p.label || p.type || 'Update'),
        summary: String(p.summary || p.label || 'Suggested update'),
        value: p.value
      }))
    : [];

  // If user waived structure, invent a sensible default flow when none exists
  if (waivers.structure && !draft.workflows.length && !proposals.some((p) => p.type === 'workflow')) {
    proposals.push({
      id: `ai-default-flow-${Date.now()}`,
      type: 'workflow',
      label: 'Workflow',
      value: {
        name: 'Core happy path',
        steps: ['Land on home', 'Complete the main action', 'See confirmation / next step']
      },
      summary: 'Add flow: Core happy path'
    });
  }

  const draftPatch = parsed.draftPatch && typeof parsed.draftPatch === 'object' ? parsed.draftPatch : {};
  const nextDraft = applyDraftPatch(draft, draftPatch);
  // Recompute from USER messages — AI vision paraphrases must not skip the timeline
  const readiness = computeReadiness(nextDraft, { messages, waivers });
  // Prefer the pre-turn gap so a thin first message always gets a vision ask
  const question = readinessBefore.nextQuestion || readiness.nextQuestion;

  let reply = String(parsed.reply || '').trim();
  if (!reply) {
    reply = buildHeuristicReply(lastUserMessage(messages), nextDraft, readiness, proposals);
  } else {
    reply = enforceFollowUpQuestion(reply, question);
  }

  return {
    reply,
    proposals,
    draftPatch,
    readiness: {
      ...readiness,
      nextQuestion: question || readiness.nextQuestion
    },
    engine: 'openai'
  };
}

function applyProposalToDraft(draft, proposal) {
  const next = normalizeDraft(draft);
  if (!proposal || !proposal.type) return next;
  const type = proposal.type;
  const value = proposal.value;

  if (type === 'workflow') {
    next.workflows = uniqueByName([...next.workflows, normalizeWorkflow(value)]);
  } else if (type === 'page') {
    next.pages = uniqueByName([...next.pages, normalizePage(value)]);
  } else if (type === 'feature') {
    const name = typeof value === 'string' ? value : value?.name;
    if (name) next.features = [...new Set([...next.features, name])];
  } else if (type === 'integration') {
    const name = typeof value === 'string' ? value : value?.name;
    if (name) next.integrations = [...new Set([...next.integrations, name])];
  } else if (type === 'design') {
    next.design = typeof value === 'string' ? value : value?.name || next.design;
  } else if (type === 'audience.platform') {
    next.audience.platform = typeof value === 'string' ? value : value?.platform || next.audience.platform;
  }
  return next;
}

async function processTurn({ messages, draft, apiKey }) {
  const normalizedMessages = Array.isArray(messages)
    ? messages
        .filter((m) => m && m.content && (m.role === 'user' || m.role === 'assistant'))
        .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
        .slice(-20)
    : [];

  if (apiKey) {
    try {
      return await aiTurn(normalizedMessages, draft, apiKey);
    } catch (err) {
      const fallback = heuristicTurn(normalizedMessages, draft);
      fallback.engine = 'heuristic-fallback';
      fallback.warning = err.message || 'AI unavailable';
      return fallback;
    }
  }
  return heuristicTurn(normalizedMessages, draft);
}

function draftToUserInput(draft, messages) {
  const d = normalizeDraft(draft);
  const userBits = userMessagesCorpus(messages);
  const parts = [];
  // Match planning → SpecGenV2 input shape (index.js uses "App Description:")
  if (d.vision) parts.push(`App Description: ${d.vision}`);
  else if (userBits) parts.push(`App Description: ${userBits}`);
  if (d.pages.length) {
    parts.push(
      'Pages:\n' +
        d.pages
          .map((p, i) => `${i + 1}. ${p.name}${p.description ? ' - ' + p.description : ''}`)
          .join('\n')
    );
  }
  if (d.workflows.length) {
    parts.push(
      'Workflows:\n' +
        d.workflows
          .map((w, i) => {
            let text = `${i + 1}. ${w.name || 'Unnamed Workflow'}`;
            if (w.steps && w.steps.length) {
              text += '\n' + w.steps.map((s, si) => `   Step ${si + 1}: ${s}`).join('\n');
            }
            return text;
          })
          .join('\n\n')
    );
  }
  if (d.features.length) {
    parts.push('Features:\n' + d.features.map((f, i) => `${i + 1}. ${f}`).join('\n'));
  }
  if (d.design) parts.push(`Design Style: ${d.design}`);
  if (d.integrations.length) parts.push('Integrations: ' + d.integrations.join(', '));
  if (d.audience.platform || d.audience.interests.length || d.audience.ageRange) {
    const audienceLines = ['Target Audience:'];
    if (d.audience.platform) audienceLines.push(`Platform: ${d.audience.platform}`);
    if (d.audience.interests.length) {
      audienceLines.push(`Interests: ${d.audience.interests.join(', ')}`);
    }
    if (d.audience.ageRange) audienceLines.push(`Age Range: ${d.audience.ageRange}`);
    parts.push(audienceLines.join('\n'));
  }
  if (userBits && d.vision && !String(d.vision).toLowerCase().includes(userBits.slice(0, 40))) {
    parts.push(`User notes: ${userBits.slice(0, 1500)}`);
  }
  return parts.join('\n\n').trim();
}

module.exports = {
  emptyDraft,
  normalizeDraft,
  computeReadiness,
  heuristicTurn,
  processTurn,
  applyDraftPatch,
  applyProposalToDraft,
  conversationText,
  userMessagesCorpus,
  isThinProductPitch,
  classifyFollowUpTopic,
  enforceFollowUpQuestion,
  draftToUserInput,
  pickNextFollowUp,
  describesUserFlow
};
