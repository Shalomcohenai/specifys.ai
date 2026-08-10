/**
 * Living Brief — single chat intake (tags + compact % + always-on generate)
 */
(function () {
  'use strict';

  const OPENING = "What are we building?";

  const PLACEHOLDER_EXAMPLES = [
    'A CRM for freelance designers…',
    'Marketplace for local artisans…',
    'Habit tracker for remote teams…',
    'Booking app for yoga studios…',
    'Expense splitter for roommates…',
    'Meal planner with grocery lists…',
    'Client portal for agencies…',
    'Inventory app for small shops…'
  ];

  const TAG_DEFS = [
    { tag: 'pages', types: ['page'] },
    { tag: 'workflows', types: ['workflow'] },
    { tag: 'features', types: ['feature'] },
    { tag: 'design', types: ['design'] },
    { tag: 'integrations', types: ['integration'] },
    { tag: 'audience', types: ['audience.platform'] }
  ];

  const SUGGEST_KEY = 'livingBriefSuggestionsOn';
  const MAX_REFS = 10;
  /** Max user chat turns before composer locks (Generate still allowed). */
  const MAX_USER_MESSAGES = 15;

  const state = {
    messages: [],
    draft: emptyDraft(),
    proposals: [],
    readiness: { score: 0, missing: [], checks: [], ready: false },
    busy: false,
    initialized: false,
    activeTags: [],
    suggestionsOn: true,
    suggestTimer: null,
    lastSuggestions: [],
    ideasUnlocked: false,
    addedIdeaKeys: {},
    ideaSeed: 0,
    activeSuggestions: [],
    ideasRoundDismissed: false,
    waivers: {},
    lastAskedGap: null,
    askedGaps: {},
    ideaTopic: null,
    flowCaptured: false,
    confettiPlayed: false,
    pendingRef: null,
    limitNoticeShown: false,
    ringDisplayPct: 0,
    ringAnimFrame: null,
    energyTimer: null,
    placeholderTimer: null,
    placeholderIndex: 0
  };

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

  function apiBase() {
    if (typeof window.getApiBaseUrl === 'function') {
      const u = window.getApiBaseUrl();
      if (u) return u.replace(/\/$/, '');
    }
    return (window.API_BASE_URL || window.BACKEND_URL || window.SPECIFYS_BACKEND_URL || '').replace(/\/$/, '');
  }

  function els() {
    return {
      root: document.getElementById('livingBrief'),
      layout: document.getElementById('lbLayout'),
      scroll: document.getElementById('lbChatScroll'),
      messages: document.getElementById('lbMessages'),
      input: document.getElementById('lbInput'),
      form: document.getElementById('lbComposerForm'),
      send: document.getElementById('lbSend'),
      generate: document.getElementById('lbGenerate'),
      score: document.getElementById('lbRingScore'),
      meter: document.getElementById('lbRingMeter'),
      progress: document.getElementById('lbProgress'),
      ring: document.getElementById('lbRing'),
      dots: document.getElementById('lbDots'),
      chips: document.getElementById('lbChips'),
      tags: document.getElementById('lbTags'),
      suggestInline: document.getElementById('lbIdeasInline'),
      suggestList: document.getElementById('lbSuggestList'),
      ideasOff: document.getElementById('lbIdeasOff'),
      readyMsg: document.getElementById('lbReadyMsg'),
      confetti: document.getElementById('lbConfetti'),
      composer: document.getElementById('lbComposer'),
      limitMsg: document.getElementById('lbLimitMsg'),
      pitch: document.getElementById('main-pitch'),
      topActions: document.getElementById('lbTopActions'),
      refs: document.getElementById('lbRefs'),
      attach: document.getElementById('lbAttach'),
      attachMenu: document.getElementById('lbAttachMenu'),
      refFile: document.getElementById('lbRefFile'),
      refPanel: document.getElementById('lbRefPanel'),
      refPanelTitle: document.getElementById('lbRefPanelTitle'),
      refPanelClose: document.getElementById('lbRefPanelClose'),
      refPanelPreview: document.getElementById('lbRefPanelPreview'),
      refPanelImg: document.getElementById('lbRefPanelImg'),
      refPanelNote: document.getElementById('lbRefPanelNote'),
      refPanelNoteLabel: document.getElementById('lbRefPanelNoteLabel'),
      refPanelText: document.getElementById('lbRefPanelText'),
      refPanelTextLabel: document.getElementById('lbRefPanelTextLabel'),
      refPanelHint: document.getElementById('lbRefPanelHint'),
      refPanelAdd: document.getElementById('lbRefPanelAdd')
    };
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatBubbleHtml(text) {
    return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  function parseTags(text) {
    const found = [];
    const re = /@([a-z]+)/gi;
    let m;
    while ((m = re.exec(text))) {
      const tag = m[1].toLowerCase();
      if (TAG_DEFS.some((t) => t.tag === tag) && !found.includes(tag)) found.push(tag);
    }
    return found;
  }

  function stripTags(text) {
    return String(text || '')
      .replace(/@([a-z]+)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function scrollChatToEnd() {
    const { scroll } = els();
    if (!scroll) return;
    requestAnimationFrame(() => {
      scroll.scrollTop = scroll.scrollHeight;
    });
  }

  function appendMessage(role, content, { typing = false } = {}) {
    const { messages } = els();
    if (!messages) return null;
    const row = document.createElement('div');
    row.className = `lb-msg lb-msg--${role}`;
    row.innerHTML = `<div class="lb-bubble"></div>`;
    const bubble = row.querySelector('.lb-bubble');
    if (typing) {
      bubble.innerHTML = '<div class="lb-typing" aria-label="Thinking"><span></span><span></span><span></span></div>';
    } else {
      bubble.innerHTML = formatBubbleHtml(content);
    }
    messages.appendChild(row);
    scrollChatToEnd();
    return { row, bubble };
  }

  function typeIntoBubble(bubble, text) {
    return new Promise((resolve) => {
      const full = String(text || '');
      let i = 0;
      bubble.innerHTML = '';
      const caret = document.createElement('span');
      caret.className = 'lb-caret';
      caret.textContent = '|';
      bubble.appendChild(caret);
      const step = () => {
        if (i >= full.length) {
          caret.remove();
          bubble.innerHTML = formatBubbleHtml(full);
          resolve();
          return;
        }
        const chunk = full.slice(i, i + (full[i] === ' ' ? 1 : 2 + Math.floor(Math.random() * 2)));
        i += chunk.length;
        bubble.textContent = full.slice(0, i);
        bubble.appendChild(caret);
        scrollChatToEnd();
        setTimeout(step, /[.?!\n]/.test(chunk) ? 36 : 10 + Math.random() * 16);
      };
      step();
    });
  }

  function replyInvitesGenerate(text) {
    const t = String(text || '');
    return /generat(e|ing)\s+(the\s+)?(full\s+)?(prd|spec)|move forward with generat|whenever you.?re ready|ready to create a spec|shall we (generate|move forward)|create (the|your) (full )?(prd|spec)|full prd/i.test(
      t
    );
  }

  /**
   * When chat invites Generate, treat the brief as complete for the progress ring.
   * AI can invite slightly before local heuristics mark all pillars — keep UI aligned.
   */
  function markBriefReadyForGenerate(opts) {
    const options = opts || {};
    const missing = (state.readiness && state.readiness.missing) || [];
    if (missing.some((m) => /flow|page|structure/i.test(String(m)))) {
      state.waivers.structure = true;
      state.flowCaptured = true;
    }
    if (missing.some((m) => /audience|scope|feature|who/i.test(String(m)))) {
      state.waivers.audience = true;
      state.waivers.polish = true;
    }
    state.readiness = computeLocalReadiness(state.draft);
    if (!state.readiness.ready || state.readiness.score < 100) {
      state.readiness = {
        ...state.readiness,
        score: 100,
        ready: true,
        nextQuestion: null,
        missing: [],
        checks: [
          { id: 'vision', label: 'Vision', done: true },
          { id: 'structure', label: 'Flow', done: true },
          { id: 'audience', label: 'Scope', done: true }
        ]
      };
    }
    state.lastAskedGap = null;
    renderStatus({ skipConfetti: !!options.skipConfetti });
  }

  function appendInlineGenerate(row) {
    if (!row || row.querySelector('.lb-inline-generate')) return;
    const wrap = document.createElement('div');
    wrap.className = 'lb-inline-generate-wrap';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lb-inline-generate';
    btn.textContent = 'Generate';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      handleGenerate();
    });
    wrap.appendChild(btn);
    row.appendChild(wrap);
    scrollChatToEnd();
    // Prefer celebrating from the inline Generate CTA once it lands in chat
    requestAnimationFrame(() => celebrateReady(btn));
  }

  function userCorpus(draft) {
    const d = draft || state.draft;
    // Score only from what the USER said + structured draft — never assistant prompts
    const chat = (state.messages || [])
      .filter((m) => m && m.role === 'user' && m.content)
      .map((m) => stripTags(m.content))
      .join(' ');
    const draftBits = [
      d.vision || '',
      ...(d.features || []),
      ...(d.pages || []).map((p) => `${p.name || ''} ${p.description || ''}`),
      ...(d.workflows || []).map((w) => `${w.name || ''} ${(w.steps || []).join(' ')}`)
    ].join(' ');
    return `${draftBits} ${chat}`.toLowerCase();
  }

  function conversationCorpus(draft) {
    return userCorpus(draft);
  }

  function isWaiverText(text) {
    return /\b(i don'?t know|don'?t know|not sure|no idea|you (can )?decide|you choose|up to you|doesn'?t matter|no preference|skip (that|it|this)|whatever works|you (figure|handle) it|לא יודע|אין לי מושג|לא משנה|כמו שאתה חושב|תכריע אתה)\b/i.test(
      String(text || '')
    );
  }

  function describesUserFlow(text) {
    const t = String(text || '').toLowerCase();
    if (!t || t.replace(/\s+/g, ' ').trim().length < 10) return false;
    if (
      /\b(then|after that|afterwards|first|next|finally|before|once|later|followed by|and then|after which)\b/.test(t)
    ) {
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
    // "does A, B, and C" style journeys
    if ((t.match(/,/g) || []).length >= 2 && /\b(and|then)\b/.test(t) && actions.length >= 1) return true;
    return false;
  }

  function extractFlowSteps(text) {
    const body = stripTags(text || '').trim();
    if (!body) return [];
    let steps = [];
    if (/(?:^|\n)\s*\d+[\).\-:]\s+/.test(body)) {
      steps = body
        .split(/(?:^|\n)\s*\d+[\).\-:]\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1 && s.length < 120);
    } else if (/→|->|➜|⟶|⇒/.test(body)) {
      steps = body
        .split(/\s*(?:→|->|➜|⟶|⇒)\s*/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1 && s.length < 120);
    } else if (/\bthen\b/i.test(body) || /ואז|אחר כך/.test(body)) {
      steps = body
        .split(/\s+then\s+|ואז|אחר כך|לאחר מכן/i)
        .map((s) => s.replace(/^[,.\s]+|[,.\s]+$/g, '').trim())
        .filter((s) => s.length > 1 && s.length < 120);
    } else if (describesUserFlow(body)) {
      steps = body
        .split(/[,;]|\band\b/i)
        .map((s) => s.trim())
        .filter((s) => s.length > 2 && s.length < 100)
        .slice(0, 6);
    }
    return steps.slice(0, 8);
  }

  function captureFlowFromUserText(text) {
    const steps = extractFlowSteps(text);
    if (steps.length >= 2) {
      addWorkflowWithData('Core happy path', steps);
    } else if (describesUserFlow(text) || (state.lastAskedGap === 'structure' && stripTags(text).length >= 28)) {
      const one = stripTags(text).trim().slice(0, 160);
      addWorkflowWithData('Core happy path', ['Start', one, 'Done']);
    } else {
      return false;
    }
    state.flowCaptured = true;
    state.waivers.structure = true;
    return true;
  }

  function flowExampleForProduct() {
    const c = productCorpus();
    if (/crm|sales|pipeline|lead|deal/.test(c)) {
      return 'e.g. “Sign up → add a contact → create a deal → move it to Won.”';
    }
    if (/inbox|ticket|support|helpdesk/.test(c)) {
      return 'e.g. “Sign up → connect email → triage a ticket → reply → resolve.”';
    }
    if (/fitness|workout|coach|habit/.test(c)) {
      return 'e.g. “Onboard → set a goal → do today’s workout → see progress.”';
    }
    if (/marketplace|shop|store|seller/.test(c)) {
      return 'e.g. “Browse → open a listing → checkout → track delivery.”';
    }
    return 'e.g. “Sign up → reach the main screen → finish the core action → see success.”';
  }

  function describesProductCapability(text) {
    const t = String(text || '');
    if (
      /(מאפשר|מאפשרת|מאפשרים|מנהל את|מנהלת את|לנהל את|עוזר ל|עוזרת ל|עוזרים ל|מארגן|מארגנת|שומר על|עוקב אחרי|מיועדת? ל|נותנת ל|כוללת את|מרכזת את)/.test(
        t
      )
    ) {
      return true;
    }
    return /\b(allows?|enables?|lets?\s+(users?|people|teams?)|helps?\s+(users?|people|teams?|you)|manages?\s+\w+|tracks?\s+\w+|organi[sz]es?|keeps?\s+track|designed\s+to|so\s+that)\b/i.test(
      t
    );
  }

  function isAlreadyAnsweredText(text) {
    return /(כתבתי לך|כבר כתבתי|כבר אמרתי|כבר עניתי|אמרתי לך|עניתי כבר|I already (told|said|answered|wrote)|already (told|said|answered) you|I just (told|said|wrote)|as I (already )?(said|wrote)|I (already )?gave you)/i.test(
      String(text || '')
    );
  }

  function pickNextFollowUp(missing, waivers) {
    const miss = missing || [];
    const w = waivers || state.waivers || {};
    // Topic briefs — the model (or local heuristic) should invent the wording
    if (miss.includes('vision') || miss.some((m) => /vision/i.test(m))) {
      return {
        id: 'vision',
        topic: 'vision',
        guidance:
          'Topic: product vision. Explore the job-to-be-done, who hurts today, and what they use instead.',
        nudge: 'What’s the core job this product does, and what do people improvise with today?',
        text:
          'Curious — what’s the product in one line: what job does it do, and what do people use today instead? (e.g. “A CRM for freelancers — today they track deals in spreadsheets.”)'
      };
    }
    if ((miss.includes('flows') || miss.some((m) => /flow|page/i.test(m))) && !w.structure && !state.flowCaptured) {
      return {
        id: 'structure',
        topic: 'structure',
        guidance: 'Topic: main user journey / screens. Ask for the happiest path or dig into a moment they mentioned.',
        nudge: `Walk me through the main path in a few steps — ${flowExampleForProduct()}`,
        text: `Almost there — list the main path in 3–4 steps (first → next → done). ${flowExampleForProduct()} Or say “you decide” and I’ll draft one.`
      };
    }
    if ((miss.includes('audience') || miss.some((m) => /audience|platform|feature/i.test(m))) && !w.audience) {
      return {
        id: 'audience',
        topic: 'audience',
        guidance:
          'Topic: audience & launch scope. Explore who it’s for, web/mobile/both, and must-have launch capabilities.',
        nudge: 'Who is this for first, web or mobile (or both), and what’s a must-have at launch?',
        text:
          'I’d love to know who it’s for + web/mobile/both, and 2 must-have features at launch? (e.g. “Sales teams on web — pipeline board + follow-up reminders.”)'
      };
    }
    return null;
  }

  /**
   * Realistic “enough info to generate a spec?” score.
   * Uses USER text + draft only (assistant questions must not inflate the score).
   * Vision 40 · Flow 35 · Scope 25 — 100% only when all three are truly covered.
   * Partial vision credit after the first user message so the ring shows early momentum.
   */
  function computeLocalReadiness(draft) {
    const d = draft || state.draft;
    const missing = [];
    const checks = [];
    const userText = (state.messages || [])
      .filter((m) => m && m.role === 'user' && m.content)
      .map((m) => stripTags(m.content))
      .join(' ')
      .trim();
    const userLen = userText.length;
    const userTurns = (state.messages || []).filter((m) => m.role === 'user').length;
    const waivers = state.waivers || {};
    const userLower = userText.toLowerCase();

    // Vision: USER text only — short category pitches stay incomplete;
    // concrete “what it does” (incl. Hebrew) counts even when short.
    const hasJobOrPain =
      /\b(helps?|lets?|so that|instead of|today|currently|workaround|problem|pain|replace|without|because)\b/i.test(
        userLower
      ) || /(במקום|היום|בעיה|כדי ש|עוזר|בלי )/.test(userText);
    const hasCapability = describesProductCapability(userText);
    const thinVision = (() => {
      if (!userText) return true;
      if ((hasJobOrPain || hasCapability) && userLen >= 28) return false;
      if (userLen < 80) return true;
      if (userLen < 140 && !hasJobOrPain && !hasCapability) return true;
      return false;
    })();
    const hasVision =
      Boolean(waivers.vision) || !thinVision || (userTurns >= 2 && hasCapability);

    const hasStructureDraft =
      (d.workflows && d.workflows.some((wf) => (wf.steps || []).length >= 2)) ||
      (d.pages && d.pages.length >= 2);
    const hasStructure =
      describesUserFlow(userLower) ||
      Boolean(waivers.structure) ||
      state.flowCaptured ||
      hasStructureDraft;

    // Scope: concrete capabilities / audience from the USER — not category labels like “CRM”
    const hasFeaturesChat =
      /\b(contact|pipeline|deal|lead|ticket|invoice|notif|notification|payment|stripe|auth|login|chat|search|report|analytics|calendar|email|sms|dashboard|permission|role|billing|subscription|upload|export|integrat)\b/.test(
        userLower
      ) || Object.keys(state.addedIdeaKeys || {}).length >= 1;
    const hasWho =
      waivers.audience ||
      /\b(for (my |our )?(sales|teachers|students|sellers|buyers|founders|teams?|agents?|customers?)|b2b|b2c|sales team|support team|indie)\b/.test(
        userLower
      ) ||
      /\b(mobile app|ios|android|web app|on the web|web and mobile)\b/.test(userLower);
    const hasScope = (hasFeaturesChat && hasWho) || (hasFeaturesChat && userTurns >= 2) || (hasWho && hasFeaturesChat);

    if (hasVision) checks.push({ id: 'vision', label: 'Vision', done: true });
    else {
      checks.push({ id: 'vision', label: 'Vision', done: false });
      missing.push('vision');
    }
    if (hasStructure) checks.push({ id: 'structure', label: 'Flow', done: true });
    else {
      checks.push({ id: 'structure', label: 'Flow', done: false });
      missing.push('flows');
    }
    if (hasScope) checks.push({ id: 'audience', label: 'Scope', done: true });
    else {
      checks.push({ id: 'audience', label: 'Scope', done: false });
      missing.push('audience');
    }

    let score = 0;
    if (hasVision) {
      score += 40;
    } else if (userTurns >= 1 && userLen >= 8) {
      // First-message momentum — ring should move even before vision is "done"
      if (userLen >= 70) score += 22;
      else if (userLen >= 35) score += 16;
      else score += 12;
    }
    if (hasStructure) score += 35;
    if (hasScope) score += 25;

    const nextQuestion = pickNextFollowUp(missing, waivers);
    return {
      score,
      missing,
      checks,
      nextQuestion,
      ready: hasVision && hasStructure && hasScope
    };
  }

  function localHeuristicTurn(userText) {
    const draft = JSON.parse(JSON.stringify(state.draft));
    const proposals = [];
    const draftPatch = {};
    const tags = parseTags(userText);
    const body = stripTags(userText);
    const lower = (body || userText).toLowerCase();

    if (!draft.vision || body.length > 20) {
      draftPatch.vision = (draft.vision ? `${draft.vision} ${body || userText}` : body || userText).trim().slice(0, 2000);
      draft.vision = draftPatch.vision;
    }

    if (tags.includes('audience') || tags.includes('workflows') || !draft.audience.platform) {
      if (/\b(ios|android|mobile)\b/.test(lower) && /\b(web|saas|browser)\b/.test(lower)) {
        proposals.push({ id: `lp-${Date.now()}-p`, type: 'audience.platform', label: 'Platform', value: 'both', summary: 'Target both mobile and web' });
      } else if (/\b(ios|android|mobile)\b/.test(lower)) {
        proposals.push({ id: `lp-${Date.now()}-p`, type: 'audience.platform', label: 'Platform', value: 'mobile', summary: 'Target mobile' });
      } else if (/\b(web|saas|browser)\b/.test(lower)) {
        proposals.push({ id: `lp-${Date.now()}-p`, type: 'audience.platform', label: 'Platform', value: 'web', summary: 'Target web' });
      }
    }

    if (tags.includes('features') || /auth|login|pay|stripe|chat|notif|dashboard/.test(lower)) {
      [
        [/auth|login|sign\s?up/, 'User Authentication'],
        [/pay|stripe|billing/, 'Payment Processing'],
        [/chat|messaging/, 'Real-time Chat'],
        [/dashboard|analytics/, 'Analytics Dashboard'],
        [/notif/, 'Notifications']
      ].forEach(([re, name]) => {
        if (re.test(lower) && !(draft.features || []).some((f) => f.toLowerCase() === name.toLowerCase())) {
          proposals.push({ id: `lp-f-${name}-${Date.now()}`, type: 'feature', label: 'Feature', value: name, summary: `Add feature: ${name}` });
        }
      });
    }

    if (tags.includes('integrations') || /stripe|firebase|openai|slack/.test(lower)) {
      [
        [/stripe/, 'Stripe Payments'],
        [/firebase/, 'Firebase Database'],
        [/openai|gpt/, 'OpenAI / AI Chat']
      ].forEach(([re, name]) => {
        if (re.test(lower) && !(draft.integrations || []).some((i) => i.toLowerCase() === name.toLowerCase())) {
          proposals.push({ id: `lp-i-${name}-${Date.now()}`, type: 'integration', label: 'Integration', value: name, summary: `Connect ${name}` });
        }
      });
    }

    if (tags.includes('design') || /minimal|saas|cyber|corporate|playful|elegant/.test(lower)) {
      const designMap = [
        [/minimal|clean/, 'Minimal'],
        [/saas|soft/, 'SaaS Soft'],
        [/cyber|neon/, 'Cyberpunk'],
        [/corporate|enterprise/, 'Corporate'],
        [/playful|fun/, 'Toy/Playful'],
        [/elegant|premium/, 'Elegant']
      ];
      for (const [re, name] of designMap) {
        if (re.test(lower)) {
          proposals.push({ id: `lp-d-${Date.now()}`, type: 'design', label: 'Design', value: name, summary: `Use ${name} design` });
          break;
        }
      }
    }

    if (tags.includes('workflows') || /\bthen\b/i.test(body) || /(?:^|\n)\s*1[\).\-:]\s+/.test(body)) {
      let steps = [];
      let name = 'User journey';
      if (/(?:^|\n)\s*1[\).\-:]\s+/.test(body)) {
        steps = body
          .split('\n')
          .map((l) => l.replace(/^\s*\d+[\).\-:]\s*/, '').trim())
          .filter((s) => s.length > 2)
          .slice(0, 12);
      } else if (/\bthen\b/i.test(body)) {
        steps = body
          .split(/\s+then\s+/i)
          .map((s) => s.replace(/^when\s+/i, '').trim())
          .filter(Boolean)
          .slice(0, 8);
      } else if (body) {
        name = body.length < 48 ? body.replace(/^\w/, (c) => c.toUpperCase()) : 'Primary user flow';
        steps = body.length < 48 ? ['User starts', body, 'Done'] : [body];
      }
      if (steps.length) {
        proposals.push({
          id: `lp-flow-${Date.now()}`,
          type: 'workflow',
          label: 'Workflow',
          value: { name, steps },
          summary: `Add flow: ${name}`
        });
      }
    }

    if (tags.includes('pages') || /pages?:|screens?:/i.test(body)) {
      const pageHints = body.match(/(?:pages?|screens?)\s*:?\s*([^.!?]+)/i);
      const names = pageHints
        ? pageHints[1].split(/,| and |\/|&/i).map((s) => s.trim()).filter((s) => s.length > 1 && s.length < 40)
        : body && tags.includes('pages')
          ? [body.slice(0, 40)]
          : [];
      names.slice(0, 6).forEach((name, idx) => {
        const clean = name.replace(/^\w/, (c) => c.toUpperCase());
        proposals.push({
          id: `lp-page-${idx}-${Date.now()}`,
          type: 'page',
          label: 'Page',
          value: { name: clean, description: '' },
          summary: `Add page: ${clean}`
        });
      });
    }

    const readiness = computeLocalReadiness(draft);
    const featureCount = proposals.filter((p) => p.type === 'feature').length;
    let reply = featureCount
      ? featureCount === 1
        ? 'Added that feature to your brief — hover it to remove if needed.'
        : `Added ${featureCount} features to your brief — hover any to remove.`
      : proposals.length
        ? tags.length
          ? `Captured under ${tags.map((t) => '@' + t).join(' ')} — added to your brief.`
          : 'Got it — I folded that into your brief.'
        : "Noted — I'm updating your brief.";

    if (readiness.nextQuestion && readiness.nextQuestion.text) {
      reply += `\n\n${readiness.nextQuestion.nudge || readiness.nextQuestion.text}`;
      state.lastAskedGap = readiness.nextQuestion.id;
      state.askedGaps[readiness.nextQuestion.id] = true;
    } else if (readiness.ready) {
      reply += `\n\nWe have enough to generate whenever you're ready — or keep refining.`;
      state.lastAskedGap = null;
    }

    return { reply, proposals: proposals.slice(0, 6), draftPatch, readiness, engine: 'local' };
  }

  function applyDraftPatch(patch) {
    if (!patch || typeof patch !== 'object') return;
    if (typeof patch.vision === 'string' && patch.vision.trim()) {
      state.draft.vision = patch.vision.trim().slice(0, 2000);
      syncPitch();
    }
  }

  function syncPitch() {
    const { pitch } = els();
    if (!pitch) return;
    pitch.value = state.draft.vision || '';
    if (typeof window.updateCharacterCount === 'function') window.updateCharacterCount();
  }

  function syncDraftFromDom() {
    if (typeof window.generateJSON !== 'function') {
      state.readiness = computeLocalReadiness(state.draft);
      renderStatus();
      return;
    }
    const result = window.generateJSON();
    const obj = result && result.object;
    if (!obj) return;

    const visionFromPitch = (els().pitch && els().pitch.value) || state.draft.vision || '';
    state.draft.vision = visionFromPitch || obj.vision?.description || state.draft.vision;
    if (state.draft.vision === 'No vision description provided') state.draft.vision = visionFromPitch;

    state.draft.pages = (obj.pages?.list || []).map((p) => ({ name: p.name, description: p.description || '' }));
    state.draft.workflows = (obj.workflows?.list || []).map((w) => ({ name: w.name, steps: w.steps || [] }));
    state.draft.features = [...(obj.features?.selected || []), ...(obj.features?.custom || [])];
    state.draft.design = obj.design?.selected || null;
    state.draft.integrations = obj.integrations?.list || [];
    state.draft.audience = {
      platform: obj.audience?.platform?.type || null,
      interests: obj.audience?.interests?.list || [],
      ageRange: obj.audience?.ageRange || null
    };
    // Living Brief owns references; don't wipe them when syncing other planning fields
    if (!Array.isArray(state.draft.references)) state.draft.references = [];
    state.readiness = computeLocalReadiness(state.draft);
    renderStatus();
  }

  function normalizeFeatureName(value) {
    return String(value || '')
      .replace(/^add\s+(a\s+)?feature\s*(for|to|:)?\s*/i, '')
      .replace(/^add\s+/i, '')
      .replace(/^feature:\s*/i, '')
      .trim();
  }

  function featureAlreadyInDraft(name) {
    const key = String(name || '').toLowerCase();
    return (state.draft.features || []).some((f) => String(f).toLowerCase() === key);
  }

  function selectFeatureByName(name) {
    const buttons = document.querySelectorAll('.feature-btn');
    for (const btn of buttons) {
      const text = (btn.querySelector('span') || btn).textContent.trim();
      if (text.toLowerCase() === String(name).toLowerCase()) {
        if (!btn.classList.contains('selected')) btn.click();
        return true;
      }
    }
    if (!featureAlreadyInDraft(name)) state.draft.features.push(name);
    return false;
  }

  function deselectFeatureByName(name) {
    const key = String(name || '').toLowerCase();
    const buttons = document.querySelectorAll('.feature-btn.selected');
    for (const btn of buttons) {
      const text = (btn.querySelector('span') || btn).textContent.trim();
      if (text.toLowerCase() === key) {
        btn.click();
        break;
      }
    }
    state.draft.features = (state.draft.features || []).filter((f) => String(f).toLowerCase() !== key);
  }

  function selectIntegrationByName(name) {
    const buttons = document.querySelectorAll('.integration-btn');
    for (const btn of buttons) {
      const text = (btn.querySelector('span') || btn).textContent.trim();
      if (text.toLowerCase() === String(name).toLowerCase()) {
        if (!btn.classList.contains('selected')) btn.click();
        return true;
      }
    }
    if (!state.draft.integrations.includes(name)) state.draft.integrations.push(name);
    return false;
  }

  function selectDesignByName(name) {
    const cards = document.querySelectorAll('.design-card');
    for (const card of cards) {
      const n = card.querySelector('.design-name')?.textContent?.trim();
      if (n && n.toLowerCase() === String(name).toLowerCase()) {
        card.click();
        return true;
      }
    }
    state.draft.design = name;
    return false;
  }

  function addWorkflowWithData(name, steps) {
    const area = document.getElementById('workflow-area');
    if (!area || typeof window.createNewFlow !== 'function') {
      state.draft.workflows.push({ name, steps: steps || [] });
      return;
    }
    window.createNewFlow();
    const wrappers = area.querySelectorAll('.workflow-wrapper');
    const wrapper = wrappers[wrappers.length - 1];
    if (!wrapper) return;
    const nameTa = wrapper.querySelector('.workflow-name-textarea');
    if (nameTa) {
      nameTa.value = name || 'Untitled flow';
      nameTa.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const flowId = wrapper.id.replace('workflow-', '');
    (steps || []).forEach((step) => {
      if (typeof window.addStep === 'function') window.addStep(flowId);
      const stepBoxes = wrapper.querySelectorAll('.workflow-step-textarea:not(.workflow-name-textarea)');
      const last = stepBoxes[stepBoxes.length - 1];
      if (last) {
        last.value = step;
        last.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }

  function acceptProposal(id, { silent, announceFeature } = {}) {
    const proposal = state.proposals.find((p) => p.id === id);
    if (!proposal) return;

    const type = proposal.type;
    const value = proposal.value;

    if (type === 'workflow') {
      const wf = typeof value === 'object' && value ? value : { name: String(value), steps: [] };
      addWorkflowWithData(wf.name || 'User journey', wf.steps || []);
    } else if (type === 'page') {
      const page = typeof value === 'object' && value ? value : { name: String(value), description: '' };
      if (typeof window.addPage === 'function') window.addPage(page.name, page.description || '');
      else state.draft.pages.push({ name: page.name, description: page.description || '' });
    } else if (type === 'feature') {
      const raw = typeof value === 'string' ? value : value?.name || proposal.summary || '';
      const name = normalizeFeatureName(raw);
      if (name && !featureAlreadyInDraft(name)) {
        selectFeatureByName(name);
        if (announceFeature) appendFeatureAdded(name);
      }
    } else if (type === 'integration') {
      selectIntegrationByName(typeof value === 'string' ? value : value?.name);
    } else if (type === 'design') {
      selectDesignByName(typeof value === 'string' ? value : value?.name);
    } else if (type === 'audience.platform') {
      const platform = typeof value === 'string' ? value : value?.platform;
      if (platform && typeof window.selectPlatform === 'function') window.selectPlatform(platform);
      else state.draft.audience.platform = platform;
    }

    state.proposals = state.proposals.filter((p) => p.id !== id);
    setTimeout(syncDraftFromDom, 60);
    if (!silent) renderStatus();
  }

  function featureRowsForKey(key) {
    return Array.from(document.querySelectorAll('[data-feature-key]')).filter(
      (n) => n.getAttribute('data-feature-key') === key
    );
  }

  function appendFeatureAdded(featureName) {
    const { messages } = els();
    if (!messages || !featureName) return;
    const key = featureName.toLowerCase();
    if (featureRowsForKey(key).length) return;

    const row = document.createElement('div');
    row.className = 'lb-msg lb-msg--feature';
    row.setAttribute('data-feature-key', key);
    row.innerHTML = `
      <div class="lb-feature-added" role="status">
        <span class="lb-feature-check" aria-hidden="true">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
            <circle cx="10" cy="10" r="9" fill="#1f9d55"/>
            <path d="M6.2 10.2l2.4 2.4 5.2-5.2" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="lb-feature-text">${escapeHtml(featureName)}</span>
        <button type="button" class="lb-feature-remove" data-remove-feature="${escapeHtml(featureName)}" aria-label="Remove feature">Remove</button>
      </div>`;
    messages.appendChild(row);
    scrollChatToEnd();
    window.setTimeout(() => {
      if (!row.isConnected) return;
      row.classList.add('is-leaving');
      window.setTimeout(() => {
        if (row.isConnected) row.remove();
      }, 280);
    }, 5000);
  }

  function removeAddedFeature(featureName) {
    const name = normalizeFeatureName(featureName);
    if (!name) return;
    const key = name.toLowerCase();
    deselectFeatureByName(name);
    Object.keys(state.addedIdeaKeys).forEach((k) => {
      if (normalizeFeatureName(k).toLowerCase() === key || k.toLowerCase().includes(key)) {
        delete state.addedIdeaKeys[k];
      }
    });
    featureRowsForKey(key).forEach((n) => n.remove());
    syncDraftFromDom();
    renderStatus();
  }

  function readinessTone(pct) {
    // Kept for compatibility; visual tone no longer shifts to green.
    if (pct >= 100) return 'complete';
    return 'progress';
  }

  function setRingMeter(pct) {
    const { meter, score } = els();
    if (!meter) return;
    const target = Math.max(0, Math.min(100, Number(pct) || 0));
    const from = typeof state.ringDisplayPct === 'number' ? state.ringDisplayPct : 0;

    if (state.ringAnimFrame) {
      cancelAnimationFrame(state.ringAnimFrame);
      state.ringAnimFrame = null;
    }

    // Instant settle when already there (avoid tiny restarts)
    if (Math.abs(from - target) < 0.15) {
      state.ringDisplayPct = target;
      meter.style.strokeDasharray = '100';
      meter.style.strokeDashoffset = String(100 - target);
      if (score) score.textContent = `${Math.round(target)}%`;
      return;
    }

    // Always start from the current drawn value so the arc visibly “stretches”
    meter.style.strokeDasharray = '100';
    meter.style.strokeDashoffset = String(100 - from);
    // Force a paint so the next frames interpolate from `from`
    void meter.getBoundingClientRect();

    const delta = Math.abs(target - from);
    const duration = Math.min(1100, Math.max(520, 420 + delta * 7));
    const start = performance.now();
    // Ease-out quint — grows fast at first, then settles into place
    const easeOut = (t) => 1 - Math.pow(1 - t, 4);

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const value = from + (target - from) * easeOut(t);
      state.ringDisplayPct = value;
      meter.style.strokeDashoffset = String(100 - value);
      if (score) score.textContent = `${Math.round(value)}%`;
      if (t < 1) {
        state.ringAnimFrame = requestAnimationFrame(tick);
      } else {
        state.ringDisplayPct = target;
        meter.style.strokeDashoffset = String(100 - target);
        if (score) score.textContent = `${Math.round(target)}%`;
        state.ringAnimFrame = null;
      }
    };

    state.ringAnimFrame = requestAnimationFrame(tick);
  }

  function setProgressThinking(on) {
    const { progress } = els();
    if (!progress) return;
    if (on) {
      progress.classList.remove('is-settling');
      progress.classList.add('is-thinking');
      progress.setAttribute('aria-busy', 'true');
      return;
    }
    const wasThinking = progress.classList.contains('is-thinking');
    progress.classList.remove('is-thinking');
    progress.removeAttribute('aria-busy');
    if (wasThinking) {
      progress.classList.add('is-settling');
      window.setTimeout(() => {
        const p = els().progress;
        if (p) p.classList.remove('is-settling');
      }, 560);
    }
  }

  function burstOrangeConfetti(originEl) {
    const { confetti, ring, generate } = els();
    if (!confetti) return;
    confetti.innerHTML = '';

    const origin = originEl || ring || generate || confetti;
    const layerRect = confetti.getBoundingClientRect();
    const originRect = origin.getBoundingClientRect();
    const ox = originRect.left + originRect.width / 2 - layerRect.left;
    const oy = originRect.top + originRect.height / 2 - layerRect.top;

    const colors = ['#ff6b35', '#ff8a5b', '#ff9f1c', '#e85d04', '#f4a261', '#ffb703', '#ffa07a'];
    const count = 48;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('span');
      piece.className = 'lb-confetti-piece';
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
      const dist = 48 + Math.random() * 170;
      const driftX = Math.cos(angle) * dist;
      const driftY = Math.sin(angle) * dist * 0.8 + 40 + Math.random() * 120;
      const rot = 160 + Math.random() * 560;
      const delay = Math.random() * 0.28;
      const dur = 2.1 + Math.random() * 1.4;
      piece.style.left = `${ox}px`;
      piece.style.top = `${oy}px`;
      piece.style.background = colors[i % colors.length];
      piece.style.setProperty('--lb-cx', `${driftX}px`);
      piece.style.setProperty('--lb-cy', `${driftY}px`);
      piece.style.setProperty('--lb-cr', `${rot}deg`);
      piece.style.animationDuration = `${dur}s`;
      piece.style.animationDelay = `${delay}s`;
      if (Math.random() > 0.45) {
        piece.style.width = `${10 + Math.random() * 8}px`;
        piece.style.height = `${10 + Math.random() * 8}px`;
        piece.style.borderRadius = '50%';
      } else {
        piece.style.width = `${11 + Math.random() * 7}px`;
        piece.style.height = `${14 + Math.random() * 8}px`;
      }
      confetti.appendChild(piece);
    }
    window.setTimeout(() => {
      if (confetti) confetti.innerHTML = '';
    }, 4200);
  }

  function celebrateReady(originEl) {
    if (state.confettiPlayed) return;
    state.confettiPlayed = true;

    const { ring, progress } = els();
    const origin = ring || originEl;
    const progressEl = progress || (ring && ring.closest('.lb-progress'));

    if (progressEl) {
      progressEl.classList.remove('is-thinking');
      progressEl.classList.add('is-complete', 'is-energizing');
      progressEl.classList.remove('is-charged');
    }

    if (state.energyTimer) {
      window.clearTimeout(state.energyTimer);
      state.energyTimer = null;
    }

    // Charge the ring with energy, then burst confetti from it
    state.energyTimer = window.setTimeout(() => {
      state.energyTimer = null;
      if (progressEl) {
        progressEl.classList.remove('is-energizing');
        progressEl.classList.add('is-charged');
      }
      burstOrangeConfetti(origin);
    }, 820);
  }

  function syncProgressVisibility() {
    const { progress, ring, topActions, generate } = els();
    const revealed = countUserMessages() >= 1;

    if (progress) {
      progress.classList.toggle('is-idle', !revealed);
      progress.classList.toggle('is-visible', revealed);
      progress.setAttribute('aria-hidden', revealed ? 'false' : 'true');
    }
    if (ring) ring.setAttribute('aria-hidden', revealed ? 'false' : 'true');

    if (topActions) {
      topActions.classList.toggle('is-idle', !revealed);
      topActions.classList.toggle('is-visible', revealed);
      topActions.setAttribute('aria-hidden', revealed ? 'false' : 'true');
    }
    if (generate) {
      generate.tabIndex = revealed ? 0 : -1;
      generate.setAttribute('aria-hidden', revealed ? 'false' : 'true');
    }
  }

  function renderStatus(opts) {
    const options = opts || {};
    const { score, dots, generate, readyMsg, progress } = els();
    const readiness = state.readiness || computeLocalReadiness(state.draft);
    state.readiness = readiness;
    const pct = Math.round(readiness.score || 0);
    const isComplete = pct >= 100;

    syncProgressVisibility();

    // Arc + % animate together via setRingMeter (stretch into place)
    setRingMeter(pct);

    const progressEl = progress || (score && score.closest('.lb-progress'));
    if (progressEl) {
      progressEl.classList.toggle('is-complete', isComplete);
      progressEl.removeAttribute('data-tone');
      if (isComplete) {
        progressEl.classList.remove('is-thinking');
      } else {
        progressEl.classList.remove('is-energizing', 'is-charged');
      }
    }

    if (dots) {
      dots.hidden = true;
      dots.innerHTML = '';
    }

    if (readyMsg) {
      readyMsg.hidden = !isComplete;
    }
    if (isComplete) {
      if (!options.skipConfetti) {
        const { ring, generate: genBtn } = els();
        celebrateReady(ring || genBtn);
      }
    } else {
      state.confettiPlayed = false;
    }

    if (generate) {
      generate.disabled = false;
      generate.setAttribute('aria-disabled', 'false');
    }
  }

  async function requestTurn(userText) {
    const base = apiBase();
    // state.messages already includes the latest user turn (pushed in handleSend)
    const payload = {
      messages: state.messages,
      draft: state.draft,
      tags: parseTags(userText)
    };
    if (!base) return localHeuristicTurn(userText);
    try {
      const res = await fetch(`${base}/api/planning/living-brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const err = new Error(
          (data && data.error && data.error.message) ||
            `Message limit of ${MAX_USER_MESSAGES} reached. Click Generate to create your spec.`
        );
        err.code = 'LIVING_BRIEF_MESSAGE_LIMIT';
        throw err;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || !data.success) throw new Error('Bad response');
      return {
        reply: data.reply,
        proposals: data.proposals || [],
        draftPatch: data.draftPatch || {},
        readiness: data.readiness || computeLocalReadiness(state.draft),
        engine: data.engine
      };
    } catch (err) {
      if (err && err.code === 'LIVING_BRIEF_MESSAGE_LIMIT') throw err;
      return localHeuristicTurn(userText);
    }
  }

  function insertTag(tag) {
    const { input } = els();
    if (!input || isChatLimitReached()) return;
    const token = `@${tag}`;
    const has = new RegExp(`@${tag}\\b`, 'i').test(input.value);
    if (has) {
      input.value = input.value.replace(new RegExp(`@${tag}\\s*`, 'ig'), '').replace(/\s+/g, ' ').trim();
    } else {
      input.value = `${token} ${input.value}`.replace(/\s+/g, ' ').trim();
    }
    state.activeTags = parseTags(input.value);
    refreshTagButtons();
    updateSendReady();
    autoGrowInput();
    input.focus();
    const len = input.value.length;
    input.setSelectionRange(len, len);
  }

  function refreshTagButtons() {
    const { tags, input } = els();
    if (!tags) return;
    const active = parseTags((input && input.value) || '');
    tags.classList.toggle('has-active', active.length > 0);
    tags.querySelectorAll('.lb-tag').forEach((btn) => {
      btn.classList.toggle('is-active', active.includes(btn.getAttribute('data-tag')));
    });
  }

  function dismissActiveIdeas() {
    if (!state.activeSuggestions.length && state.ideasRoundDismissed) {
      const { suggestInline } = els();
      if (suggestInline && !suggestInline.hidden) suggestInline.hidden = true;
      return;
    }
    state.activeSuggestions = [];
    state.ideasRoundDismissed = true;
    state.lastSuggestions = [];
    const { suggestInline, suggestList } = els();
    if (suggestList) suggestList.innerHTML = '';
    if (suggestInline) suggestInline.hidden = true;
  }

  async function handleSend() {
    const { input } = els();
    if (!input || state.busy) return;
    if (isChatLimitReached()) {
      applyChatLimitState();
      return;
    }
    const text = input.value.trim();
    if (!text) return;

    dismissActiveIdeas();

    const tags = parseTags(text);
    state.busy = true;
    setProgressThinking(true);
    input.value = '';
    autoGrowInput();
    state.activeTags = [];
    refreshTagButtons();
    updateSendReady();

    appendMessage('user', text);
    state.messages.push({ role: 'user', content: text });
    state.readiness = computeLocalReadiness(state.draft);
    renderStatus({ skipConfetti: true });
    syncProgressVisibility();
    applyChatLimitState();

    // If the user can't answer the last gap, don't let it hurt the score
    if (isWaiverText(text)) {
      const gap = state.lastAskedGap;
      if (gap === 'structure' || !gap) {
        state.waivers.structure = true;
        state.flowCaptured = true;
      }
      if (gap === 'audience' || !gap) state.waivers.audience = true;
      state.waivers.polish = true;
    } else if (isAlreadyAnsweredText(text)) {
      // “I already told you” — accept vision and stop re-asking the template
      state.waivers.vision = true;
    } else if (
      state.lastAskedGap === 'structure' ||
      describesUserFlow(text) ||
      /→|->|➜/.test(text)
    ) {
      // Credit + capture flow whenever the user describes a path (or answers a flow question)
      captureFlowFromUserText(text);
    }

    // After a capability answer (or a second user turn with product language), clear vision gap
    if (
      describesProductCapability(text) ||
      (state.askedGaps.vision &&
        countUserMessages() >= 2 &&
        userCorpus(state.draft).replace(/\s+/g, ' ').trim().length >= 45)
    ) {
      state.waivers.vision = true;
    }

    const typing = appendMessage('assistant', '', { typing: true });
    try {
      const result = await requestTurn(text);
      if (typing && typing.row) typing.row.remove();

      applyDraftPatch(result.draftPatch);

      const incoming = Array.isArray(result.proposals) ? result.proposals : [];
      incoming.forEach((p) => {
        if (!state.proposals.some((x) => x.summary === p.summary)) state.proposals.push(p);
      });

      if (
        state.waivers.structure &&
        !(state.draft.workflows && state.draft.workflows.length) &&
        !state.proposals.some((p) => p.type === 'workflow')
      ) {
        state.proposals.push({
          id: `lb-default-flow-${Date.now()}`,
          type: 'workflow',
          label: 'Workflow',
          value: {
            name: 'Core happy path',
            steps: ['Land on home', 'Complete the main action', 'See confirmation / next step']
          },
          summary: 'Add flow: Core happy path'
        });
      }

      // Auto-apply everything — features announce with a checked row (no Add/Skip)
      [...state.proposals].forEach((p) => {
        acceptProposal(p.id, { silent: true, announceFeature: p.type === 'feature' });
      });

      syncDraftFromDom();

      state.readiness = computeLocalReadiness(state.draft);
      let replyText = result.reply || '…';
      // Strip the stuck English vision template if it was already asked
      if (state.askedGaps.vision) {
        replyText = replyText
          .split(/\n\n+/)
          .filter(
            (p) =>
              !/product in one line|CRM for freelancers|people use today instead|Curious — what’s the product/i.test(
                p
              )
          )
          .join('\n\n')
          .trim() || replyText;
      }
      const localReady = computeLocalReadiness(state.draft);
      const aiInvitesGenerate = replyInvitesGenerate(replyText);
      const forcedAsk = localReady.nextQuestion || state.readiness.nextQuestion;

      // If the model already invites Generate, trust that signal: don't re-ask gaps
      // and snap the progress ring to 100% so Generate ↔ score stay aligned.
      if (aiInvitesGenerate || (localReady.ready && !localReady.nextQuestion)) {
        state.readiness = { ...localReady, nextQuestion: null };
        state.lastAskedGap = null;
        // Snap ring now; wait for Generate CTA (or final render) to fire confetti
        markBriefReadyForGenerate({ skipConfetti: true });
      } else if (forcedAsk && forcedAsk.text) {
        // Soft topic guard: keep AI wording when it already asks something useful.
        // Only inject a nudge if there is no question, or the ask clearly skipped the topic.
        const askTopic = forcedAsk.id;
        const hasQuestion = /\?/.test(replyText);
        const replyLooksFlow = /main path|3–4 steps|3-4 steps|happiest path|outline the main|user flow/i.test(
          replyText
        );
        const replyLooksVision = /product in one line|what job|workaround|one sentence|core job/i.test(
          replyText
        );
        const replyLooksAudience =
          /\b(who (is|are)|audience|for (my|our|sales|teachers)|web or mobile|web\/mobile|must-have|launch feature)/i.test(
            replyText
          );
        const clearlyWrong =
          (askTopic === 'vision' && replyLooksFlow && !replyLooksVision) ||
          (askTopic === 'structure' && replyLooksVision && !replyLooksFlow) ||
          (askTopic === 'audience' && (replyLooksFlow || replyLooksVision) && !replyLooksAudience);

        if (clearlyWrong && askTopic === 'vision' && replyLooksFlow) {
          replyText = replyText
            .split(/\n\n+/)
            .filter((p) => !/main path|3–4 steps|3-4 steps|happiest path|outline the main|user flow/i.test(p))
            .join('\n\n')
            .trim();
        }

        const alreadyAskedThisGap = Boolean(state.askedGaps[askTopic]);
        const softNudge = forcedAsk.nudge || forcedAsk.text;
        // Never re-paste the long CRM vision template once we've already asked vision
        if (
          (!/\?/.test(replyText) || clearlyWrong) &&
          !(alreadyAskedThisGap && askTopic === 'vision')
        ) {
          if (softNudge && !replyText.includes(softNudge.slice(0, 28))) {
            replyText = `${replyText}\n\n${softNudge}`.trim();
          }
        }

        state.readiness = { ...state.readiness, ...localReady, nextQuestion: forcedAsk };
        state.lastAskedGap = forcedAsk.id;
        state.askedGaps[forcedAsk.id] = true;
      } else {
        state.lastAskedGap = null;
      }

      const assistant = appendMessage('assistant', '');
      await typeIntoBubble(assistant.bubble, replyText);
      state.messages.push({ role: 'assistant', content: replyText });

      const inviteGenerate =
        aiInvitesGenerate ||
        (state.readiness && state.readiness.score >= 100) ||
        (state.readiness && state.readiness.ready && !state.readiness.nextQuestion);
      if (inviteGenerate) {
        markBriefReadyForGenerate({ skipConfetti: true });
        if (assistant.row) {
          appendInlineGenerate(assistant.row);
        } else {
          const { ring, generate: genBtn } = els();
          celebrateReady(ring || genBtn);
        }
      } else {
        state.readiness = computeLocalReadiness(state.draft);
        renderStatus();
      }

      if (isChatLimitReached() && !state.limitNoticeShown) {
        state.limitNoticeShown = true;
        markBriefReadyForGenerate({ skipConfetti: true });
        const limitRow = appendMessage(
          'assistant',
          `You've reached the ${MAX_USER_MESSAGES}-message limit. Click Generate to create your specification.`
        );
        if (limitRow && limitRow.row) {
          appendInlineGenerate(limitRow.row);
        } else {
          const { ring, generate: genBtn } = els();
          celebrateReady(ring || genBtn);
        }
      }

      // Ideas only after the first completed user turn; new round (max 3) after each send
      if (!state.ideasUnlocked) {
        state.ideasUnlocked = true;
        renderSuggestions({ refresh: true });
      } else {
        if (Math.random() < 0.45 || tags.includes('features')) {
          state.ideaSeed = (state.ideaSeed || 0) + 1 + Math.floor(Math.random() * 2);
        }
        scheduleSuggestions({ refresh: true });
      }
    } catch (err) {
      if (typing && typing.row) typing.row.remove();
      state.readiness = computeLocalReadiness(state.draft);
      renderStatus();
      if (err && err.code === 'LIVING_BRIEF_MESSAGE_LIMIT') {
        applyChatLimitState();
        appendMessage(
          'assistant',
          `You've reached the ${MAX_USER_MESSAGES}-message limit. Click Generate to create your specification.`
        );
      } else {
        appendMessage('assistant', 'Something hiccuped on my side — try sending that again?');
      }
    } finally {
      setProgressThinking(false);
      state.busy = false;
      applyChatLimitState();
      updateSendReady();
      if (input && !isChatLimitReached()) input.focus();
    }
  }

  function ensureVisionForGenerate() {
    if ((state.draft.vision || '').trim().length >= 20) return;
    const userBits = state.messages
      .filter((m) => m.role === 'user')
      .map((m) => stripTags(m.content))
      .filter(Boolean)
      .join(' ');
    state.draft.vision = (userBits || 'Product idea captured in Living Brief. Fill gaps with sensible defaults.').slice(0, 2000);
    syncPitch();
  }

  function showCreatingSpecStatus() {
    const { messages, generate } = els();
    if (generate) {
      generate.disabled = true;
      generate.setAttribute('aria-busy', 'true');
    }
    document.querySelectorAll('.lb-inline-generate').forEach((btn) => {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
    });

    if (!messages) return null;
    const existing = messages.querySelector('.lb-msg--creating');
    if (existing) {
      scrollChatToEnd();
      return existing;
    }

    const row = document.createElement('div');
    row.className = 'lb-msg lb-msg--assistant lb-msg--creating';
    row.setAttribute('role', 'status');
    row.setAttribute('aria-live', 'polite');
    row.innerHTML = `
      <div class="lb-creating" aria-label="Creating your spec">
        <div class="lb-creating-row">
          <span class="lb-creating-orbit" aria-hidden="true"></span>
          <span class="lb-creating-copy">
            <span class="lb-creating-label">Creating your spec</span>
            <span class="lb-creating-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
          </span>
        </div>
        <span class="lb-creating-bar" aria-hidden="true"><span class="lb-creating-bar-fill"></span></span>
      </div>
    `;
    messages.appendChild(row);
    scrollChatToEnd();
    return row;
  }

  function handleGenerate() {
    if (state.busy) return;
    state.busy = true;
    // Accept anything still pending — user asked to generate; system completes the rest
    [...state.proposals].forEach((p) => acceptProposal(p.id, { silent: true }));
    ensureVisionForGenerate();
    syncDraftFromDom();
    syncPitch();
    showCreatingSpecStatus();
    setProgressThinking(true);

    // Let the in-chat “Creating…” cue paint before the heavier generate handoff
    window.setTimeout(() => {
      if (typeof window.generateSpecFromPlanning === 'function') {
        window.generateSpecFromPlanning();
      } else {
        state.busy = false;
        setProgressThinking(false);
        alert('Error: Could not generate specification.');
      }
    }, 720);
  }

  function countUserMessages() {
    return (state.messages || []).filter(
      (m) => m && m.role === 'user' && String(m.content || '').trim()
    ).length;
  }

  function isChatLimitReached() {
    return countUserMessages() >= MAX_USER_MESSAGES;
  }

  function ensureLimitNotice() {
    const { composer, limitMsg } = els();
    if (limitMsg) return limitMsg;
    if (!composer) return null;
    const el = document.createElement('p');
    el.id = 'lbLimitMsg';
    el.className = 'lb-limit-msg';
    el.hidden = true;
    el.setAttribute('role', 'status');
    el.textContent =
      'Message limit reached (15). You can still click Generate to create your spec.';
    composer.insertAdjacentElement('afterbegin', el);
    return el;
  }

  function stopPlaceholderRotation() {
    if (state.placeholderTimer) {
      window.clearTimeout(state.placeholderTimer);
      state.placeholderTimer = null;
    }
    const { input } = els();
    if (input) input.classList.remove('is-placeholder-fading');
  }

  function canRotatePlaceholder() {
    const { input } = els();
    if (!input || isChatLimitReached()) return false;
    return !String(input.value || '').trim();
  }

  function setPlaceholderExample(text, { animate } = { animate: true }) {
    const { input } = els();
    if (!input) return;
    const next = String(text || '').trim();
    if (!next) return;

    if (!animate) {
      input.classList.remove('is-placeholder-fading');
      input.placeholder = next;
      return;
    }

    input.classList.add('is-placeholder-fading');
    window.setTimeout(() => {
      if (!canRotatePlaceholder()) {
        input.classList.remove('is-placeholder-fading');
        return;
      }
      input.placeholder = next;
      input.classList.remove('is-placeholder-fading');
    }, 220);
  }

  function schedulePlaceholderRotation() {
    stopPlaceholderRotation();
    if (!canRotatePlaceholder()) return;

    const tick = () => {
      if (!canRotatePlaceholder()) {
        state.placeholderTimer = null;
        return;
      }
      state.placeholderIndex = (state.placeholderIndex + 1) % PLACEHOLDER_EXAMPLES.length;
      setPlaceholderExample(PLACEHOLDER_EXAMPLES[state.placeholderIndex], { animate: true });
      state.placeholderTimer = window.setTimeout(tick, 3200);
    };

    state.placeholderTimer = window.setTimeout(tick, 3200);
  }

  function startPlaceholderRotation() {
    const { input } = els();
    if (!input) return;
    if (isChatLimitReached()) {
      stopPlaceholderRotation();
      input.placeholder = 'Message limit reached — click Generate';
      return;
    }
    if (!canRotatePlaceholder()) {
      stopPlaceholderRotation();
      return;
    }
    if (!PLACEHOLDER_EXAMPLES.includes(input.placeholder)) {
      state.placeholderIndex = 0;
      setPlaceholderExample(PLACEHOLDER_EXAMPLES[0], { animate: false });
    }
    schedulePlaceholderRotation();
  }

  function applyChatLimitState() {
    const { input, send, composer, tags, attach, generate } = els();
    const capped = isChatLimitReached();
    const notice = ensureLimitNotice();
    if (notice) notice.hidden = !capped;
    if (composer) composer.classList.toggle('is-chat-capped', capped);
    if (input) {
      input.disabled = capped;
      input.readOnly = capped;
      input.setAttribute('aria-disabled', capped ? 'true' : 'false');
      if (capped) {
        stopPlaceholderRotation();
        input.placeholder = 'Message limit reached — click Generate';
        input.value = '';
        autoGrowInput();
      } else {
        startPlaceholderRotation();
      }
    }
    if (send) {
      send.disabled = capped;
      send.classList.toggle('is-ready', false);
      send.setAttribute('aria-disabled', 'true');
    }
    if (tags) {
      tags.querySelectorAll('.lb-tag').forEach((btn) => {
        btn.disabled = capped;
        btn.setAttribute('aria-disabled', capped ? 'true' : 'false');
      });
    }
    if (attach) {
      attach.disabled = capped;
      attach.setAttribute('aria-disabled', capped ? 'true' : 'false');
    }
    if (generate) {
      generate.disabled = false;
      generate.setAttribute('aria-disabled', 'false');
      generate.classList.toggle('is-limit-cta', capped);
    }
  }

  function updateSendReady() {
    const { input, send } = els();
    if (!send || !input) return;
    if (isChatLimitReached()) {
      applyChatLimitState();
      return;
    }
    const has = input.value.trim().length > 0 && !state.busy;
    send.disabled = false;
    send.classList.toggle('is-ready', has);
    send.setAttribute('aria-disabled', has ? 'false' : 'true');
  }

  function autoGrowInput() {
    const { input } = els();
    if (!input || input.tagName !== 'TEXTAREA') return;
    const max = Math.min(window.innerHeight * 0.36, 200);
    const minH = Math.round(
      (parseFloat(window.getComputedStyle(input).lineHeight) ||
        (parseFloat(window.getComputedStyle(input).fontSize) || 16) * 1.45)
    );
    const prev = input.offsetHeight;
    // Measure without transition so scrollHeight is accurate
    input.style.transition = 'none';
    input.style.height = '0px';
    const measured = Math.max(input.scrollHeight, minH);
    const next = Math.min(measured, max);
    input.style.height = prev + 'px';
    // Force reflow, then animate to target height
    void input.offsetHeight;
    input.style.transition = 'height 0.18s ease';
    input.style.height = next + 'px';
    input.style.overflowY = measured > max ? 'auto' : 'hidden';
  }

  function productCorpus() {
    const recent = state.messages
      .filter((m) => m.role === 'user')
      .map((m) => stripTags(m.content))
      .join(' ');
    return `${recent} ${state.draft.vision || ''}`.toLowerCase();
  }

  function lastAssistantText() {
    for (let i = (state.messages || []).length - 1; i >= 0; i--) {
      const m = state.messages[i];
      if (m && m.role === 'assistant' && m.content) return String(m.content);
    }
    return '';
  }

  /** Ideas must match the readiness gap / question just asked — never pull to another stage. */
  function detectIdeaTopic() {
    const ask = lastAssistantText().toLowerCase();
    const gap = state.lastAskedGap;
    // Prefer the gap we are solving — Ideas must not fight the chat timeline
    if (gap === 'vision' || gap === 'structure' || gap === 'audience') return gap;
    if (
      /design vibe|design direction|look and feel|visual style|brand|minimal|saas soft|brutalist|glassmorph|ui style|colors?\b/.test(
        ask
      ) &&
      !/must-have feature|happiest path|who is this|core job|plain steps|product in one line/.test(ask)
    ) {
      return 'design';
    }
    if (
      /happiest path|plain steps|first,\s*then|user journey|what does someone do first|key screens|walk me through|main path|3–4 steps|3-4 steps/.test(
        ask
      )
    ) {
      return 'structure';
    }
    if (
      /core job|one sentence|painful alternative|what (are we|does this product) do|what problem|product in one line|current workaround/.test(
        ask
      )
    ) {
      return 'vision';
    }
    if (/who is this|mobile, web|must-have feature|platform|who.?s it for|target audience/.test(ask)) {
      return 'audience';
    }
    return gap || 'vision';
  }

  function ideaTopicLabel(topic) {
    if (topic === 'structure') return 'Flow ideas';
    if (topic === 'vision') return 'Vision ideas';
    if (topic === 'design') return 'Design ideas';
    if (topic === 'audience') return 'Scope ideas';
    return 'Ideas';
  }

  /**
   * Suggestions tied to the latest assistant question + product context.
   */
  function buildSuggestions() {
    if (!state.ideasUnlocked || !state.suggestionsOn) return [];

    const corpus = productCorpus();
    if (corpus.trim().length < 8) return [];

    const topic = detectIdeaTopic();
    state.ideaTopic = topic;
    const pool = [];
    const push = (value, kind) => {
      if (!value) return;
      const key = value.toLowerCase();
      if (state.addedIdeaKeys[key]) return;
      if (pool.some((i) => i.value.toLowerCase() === key)) return;
      pool.push({ value, kind: kind || topic });
    };

    if (topic === 'design') {
      push('Minimal — clean whitespace, simple type, few colors', 'design');
      push('SaaS Soft — rounded cards, gentle shadows, friendly UI', 'design');
      push('Corporate — structured layout, navy/gray palette, dense data', 'design');
      push('Elegant — refined typography, restrained accents', 'design');
    } else if (topic === 'structure') {
      if (/crm|sales|pipeline|lead/.test(corpus)) {
        push('Sign up → import contacts → create a deal → move it across pipeline stages', 'flow');
        push('Open inbox → claim a lead → log a call → set next follow-up', 'flow');
        push('Dashboard → filter by owner → open a deal → update stage + note', 'flow');
      } else if (/inbox|ticket|support|helpdesk/.test(corpus)) {
        push('Sign up → connect email → triage tickets → reply with a macro', 'flow');
        push('Open inbox → assign ticket → resolve → archive', 'flow');
        push('Customer sends message → agent claims it → reply → mark done', 'flow');
      } else if (/fitness|workout|coach|habit/.test(corpus)) {
        push('Onboard → set a goal → get this week’s plan → log a session', 'flow');
        push('Open today’s workout → complete sets → see progress → plan adjusts', 'flow');
      } else if (/marketplace|shop|store|seller/.test(corpus)) {
        push('Browse listings → open an item → checkout → track delivery', 'flow');
        push('Seller lists an item → buyer purchases → fulfill → review', 'flow');
      } else {
        push('Land on home → complete the main action → see a clear success state', 'flow');
        push('Sign up → short setup → reach the core screen → do the job once', 'flow');
        push('Open the app → pick a task → finish it → get a next-step prompt', 'flow');
      }
      push('Pages: Home, Main workspace, Settings', 'flow');
    } else if (topic === 'vision') {
      if (/crm|sales|pipeline/.test(corpus)) {
        push('A CRM that helps small sales teams close deals without drowning in admin', 'vision');
        push('Replace messy spreadsheets with one place for contacts, deals, and follow-ups', 'vision');
        push('Give founders a simple pipeline so nothing falls through the cracks', 'vision');
      } else if (/inbox|ticket|support/.test(corpus)) {
        push('A shared inbox so a small team answers customers in one place', 'vision');
        push('Cut reply time by routing tickets to the right person automatically', 'vision');
      } else {
        push('Help people finish one painful job faster than their current workaround', 'vision');
        push('A simple product that replaces a messy mix of tools and spreadsheets', 'vision');
        push('Give a small team clarity on what to do next, every day', 'vision');
      }
    } else {
      // audience / scope — features + who, matched to the ask
      const askingWho = /who is|audience|for\b|platform|mobile, web/.test(lastAssistantText().toLowerCase());
      const askingFeatures = /feature|must-have|launch/.test(lastAssistantText().toLowerCase()) || !askingWho;

      if (askingWho) {
        push('For small sales teams on web', 'audience');
        push('For indie founders — web first, mobile later', 'audience');
        push('B2B teams on both web and mobile', 'audience');
      }
      if (askingFeatures || !askingWho) {
        if (/crm|sales|pipeline|lead/.test(corpus)) {
          push('add contact timeline with emails, calls, and next follow-up date', 'feature');
          push('add pipeline board with drag-and-drop deal stages', 'feature');
          push('add task reminders when a deal goes stale', 'feature');
        } else if (/inbox|ticket|support|helpdesk/.test(corpus)) {
          push('add shared inbox with assignment and macros', 'feature');
          push('add SLA timers that warn before a reply is late', 'feature');
          push('add customer context sidebar on every ticket', 'feature');
        } else if (/fitness|workout|coach/.test(corpus)) {
          push('add adaptive weekly plan that rewrites workouts when a session is skipped', 'feature');
          push('add progress charts tied to the user’s goal', 'feature');
        } else if (/marketplace|shop|store/.test(corpus)) {
          push('add seller performance score by fulfillment speed and disputes', 'feature');
          push('add smart price suggestions from similar sold items', 'feature');
        } else {
          push('add a simple dashboard for the core daily job', 'feature');
          push('add notifications for the moments that need a human reply', 'feature');
          push('add roles so owners and members see the right actions', 'feature');
        }
      }
    }

    if (!pool.length) return [];
    const seed = state.ideaSeed || 0;
    const offset = seed % pool.length;
    const rotated = pool.slice(offset).concat(pool.slice(0, offset));
    return rotated.slice(0, 3).map((item, i) => ({
      id: `sg-${topic}-${seed}-${i}`,
      value: item.value,
      kind: item.kind
    }));
  }

  function renderSuggestions({ refresh } = {}) {
    const { suggestList, suggestInline } = els();
    if (!suggestList || !suggestInline) return;

    if (!state.suggestionsOn || !state.ideasUnlocked) {
      suggestInline.hidden = true;
      suggestList.innerHTML = '';
      return;
    }

    // New round only after a completed chat turn — never refill after dismiss/type
    if (refresh) {
      state.ideasRoundDismissed = false;
      state.activeSuggestions = buildSuggestions().slice(0, 3);
    } else if (state.ideasRoundDismissed || !state.activeSuggestions.length) {
      suggestInline.hidden = true;
      suggestList.innerHTML = '';
      return;
    }

    // Drop taken ideas only — never backfill mid-round
    state.activeSuggestions = state.activeSuggestions.filter(
      (idea) => !state.addedIdeaKeys[idea.value.toLowerCase()]
    );
    const ideas = state.activeSuggestions;
    state.lastSuggestions = ideas;

    if (!ideas.length) {
      suggestInline.hidden = true;
      suggestList.innerHTML = '';
      return;
    }

    suggestInline.hidden = false;
    const label = suggestInline.querySelector('.lb-ideas-label');
    if (label) {
      const topic = state.ideaTopic || detectIdeaTopic();
      const icon = label.querySelector('.lb-ideas-label-icon');
      const iconHtml = icon ? icon.outerHTML : '';
      label.innerHTML = `${iconHtml}${escapeHtml(ideaTopicLabel(topic))}`;
    }
    const bulb =
      '<span class="lb-idea-bulb" aria-hidden="true"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg></span>';
    suggestList.innerHTML = ideas
      .map(
        (idea) =>
          `<button type="button" class="lb-idea-line" data-suggest="${escapeHtml(idea.value)}" data-idea-kind="${escapeHtml(idea.kind || 'feature')}">${bulb}<span class="lb-idea-text">${escapeHtml(idea.value)}</span></button>`
      )
      .join('');
  }

  function scheduleSuggestions(opts) {
    if (!state.suggestionsOn || !state.ideasUnlocked) return;
    clearTimeout(state.suggestTimer);
    state.suggestTimer = setTimeout(() => renderSuggestions(opts), 200);
  }

  function applySuggestion(value, kindHint) {
    if (!value) return;
    const key = value.toLowerCase();
    if (state.addedIdeaKeys[key]) return;

    const fromList = (state.activeSuggestions || []).find((i) => i.value.toLowerCase() === key);
    const kind = kindHint || (fromList && fromList.kind) || state.ideaTopic || 'feature';

    state.addedIdeaKeys[key] = true;
    state.activeSuggestions = (state.activeSuggestions || []).filter((idea) => idea.value.toLowerCase() !== key);

    if (kind === 'design') {
      const name = value.split('—')[0].split('-')[0].trim();
      selectDesignByName(name);
      state.draft.design = name;
      appendFeatureAdded(`Design: ${name}`);
      state.messages.push({ role: 'system', content: `Set design: ${name}` });
    } else if (kind === 'flow') {
      const parts = value
        .replace(/^pages:\s*/i, '')
        .split(/\s*→\s*|\s*->\s*|\n|\d+\.\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (/^pages:/i.test(value)) {
        parts.forEach((name) => {
          if (typeof window.addPage === 'function') window.addPage(name, '');
          else state.draft.pages.push({ name, description: '' });
        });
        appendFeatureAdded(`Pages: ${parts.join(', ')}`);
        state.messages.push({ role: 'system', content: `Added pages: ${parts.join(', ')}` });
      } else {
        const steps = parts.length >= 2 ? parts : [value];
        const name = 'Core happy path';
        addWorkflowWithData(name, steps);
        appendFeatureAdded(`Flow: ${steps.join(' → ')}`);
        state.messages.push({ role: 'system', content: `Added flow: ${steps.join(' → ')}` });
      }
      state.waivers.structure = true;
    } else if (kind === 'vision') {
      const prev = (state.draft.vision || '').trim();
      state.draft.vision = (prev ? `${prev} ${value}` : value).trim().slice(0, 2000);
      syncPitch();
      appendFeatureAdded(value);
      state.messages.push({ role: 'system', content: `Vision note: ${value}` });
    } else if (kind === 'audience') {
      const lower = value.toLowerCase();
      if (/mobile|ios|android/.test(lower) && /web/.test(lower)) {
        if (typeof window.selectPlatform === 'function') window.selectPlatform('both');
        else state.draft.audience.platform = 'both';
      } else if (/mobile|ios|android/.test(lower)) {
        if (typeof window.selectPlatform === 'function') window.selectPlatform('mobile');
        else state.draft.audience.platform = 'mobile';
      } else if (/web|saas/.test(lower)) {
        if (typeof window.selectPlatform === 'function') window.selectPlatform('web');
        else state.draft.audience.platform = 'web';
      }
      state.waivers.audience = true;
      appendFeatureAdded(value);
      state.messages.push({ role: 'system', content: `Audience: ${value}` });
    } else {
      const featureName = normalizeFeatureName(value);
      if (!featureName) return;
      if (!featureAlreadyInDraft(featureName)) selectFeatureByName(featureName);
      if (!featureAlreadyInDraft(featureName)) {
        state.draft.features = [...(state.draft.features || []), featureName];
      }
      appendFeatureAdded(featureName);
      state.messages.push({ role: 'system', content: `Added feature: ${featureName}` });
    }

    syncDraftFromDom();
    renderStatus();
    renderSuggestions({ refresh: false });
  }

  function refsList() {
    if (!Array.isArray(state.draft.references)) state.draft.references = [];
    return state.draft.references;
  }

  function closeAttachMenu() {
    const { attach, attachMenu } = els();
    if (attachMenu) attachMenu.hidden = true;
    if (attach) attach.setAttribute('aria-expanded', 'false');
  }

  function toggleAttachMenu() {
    const { attach, attachMenu } = els();
    if (!attachMenu) return;
    const open = attachMenu.hidden;
    attachMenu.hidden = !open;
    if (attach) attach.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function clearPendingRef() {
    if (state.pendingRef && state.pendingRef.previewUrl && state.pendingRef.previewUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(state.pendingRef.previewUrl);
      } catch (e) {
        /* ignore */
      }
    }
    state.pendingRef = null;
  }

  function closeRefPanel() {
    const {
      refPanel,
      refPanelNote,
      refPanelText,
      refPanelPreview,
      refPanelHint,
      refPanelAdd
    } = els();
    clearPendingRef();
    if (refPanel) refPanel.hidden = true;
    if (refPanelNote) refPanelNote.value = '';
    if (refPanelText) {
      refPanelText.value = '';
      refPanelText.hidden = true;
    }
    if (refPanelPreview) refPanelPreview.hidden = true;
    if (refPanelHint) {
      refPanelHint.hidden = true;
      refPanelHint.textContent = '';
    }
    if (refPanelAdd) {
      refPanelAdd.disabled = false;
      refPanelAdd.textContent = 'Add reference';
    }
  }

  function openImageRefPanel(file, previewUrl) {
    const {
      refPanel,
      refPanelTitle,
      refPanelPreview,
      refPanelImg,
      refPanelNote,
      refPanelNoteLabel,
      refPanelText,
      refPanelTextLabel,
      refPanelHint
    } = els();
    state.pendingRef = { kind: 'image', file, previewUrl };
    if (refPanelTitle) refPanelTitle.textContent = 'Image reference';
    if (refPanelImg) refPanelImg.src = previewUrl;
    if (refPanelPreview) refPanelPreview.hidden = false;
    if (refPanelNoteLabel) refPanelNoteLabel.hidden = false;
    if (refPanelNote) {
      refPanelNote.hidden = false;
      refPanelNote.placeholder = 'e.g. "Match this dashboard layout and colors"';
    }
    if (refPanelText) refPanelText.hidden = true;
    if (refPanelTextLabel) refPanelTextLabel.hidden = true;
    if (refPanelHint) {
      const signedIn = !!(window.auth && window.auth.currentUser);
      refPanelHint.hidden = false;
      refPanelHint.textContent = signedIn
        ? 'We’ll analyze the image into editable spec text.'
        : 'Sign in for AI image analysis — or add a note and we’ll use that as the reference.';
    }
    if (refPanel) refPanel.hidden = false;
    if (refPanelNote) refPanelNote.focus();
  }

  function openTextRefPanel() {
    const {
      refPanel,
      refPanelTitle,
      refPanelPreview,
      refPanelNote,
      refPanelNoteLabel,
      refPanelText,
      refPanelTextLabel,
      refPanelHint
    } = els();
    clearPendingRef();
    state.pendingRef = { kind: 'text' };
    if (refPanelTitle) refPanelTitle.textContent = 'Text reference';
    if (refPanelPreview) refPanelPreview.hidden = true;
    if (refPanelNoteLabel) refPanelNoteLabel.hidden = false;
    if (refPanelNote) {
      refPanelNote.hidden = false;
      refPanelNote.placeholder = 'Short label (optional)';
      refPanelNote.value = '';
    }
    if (refPanelTextLabel) refPanelTextLabel.hidden = false;
    if (refPanelText) {
      refPanelText.hidden = false;
      refPanelText.value = '';
    }
    if (refPanelHint) {
      refPanelHint.hidden = false;
      refPanelHint.textContent = 'Paste competitor copy, requirements, or notes to include in the brief.';
    }
    if (refPanel) refPanel.hidden = false;
    if (refPanelText) refPanelText.focus();
  }

  function truncate(str, n) {
    const s = String(str || '').trim();
    if (s.length <= n) return s;
    return `${s.slice(0, n - 1)}…`;
  }

  function appendRefAddedNote(ref) {
    const { messages } = els();
    if (!messages || !ref) return;
    const label =
      ref.kind === 'image'
        ? truncate(ref.note || 'Image reference', 80)
        : truncate(ref.note || ref.description || 'Text reference', 80);
    const row = document.createElement('div');
    row.className = 'lb-msg lb-msg--feature lb-msg--ref';
    row.setAttribute('data-ref-note', ref.id);
    row.innerHTML = `
      <div class="lb-feature-added" role="status">
        <span class="lb-feature-check" aria-hidden="true">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
            <circle cx="10" cy="10" r="9" fill="#1f9d55"/>
            <path d="M6.2 10.2l2.4 2.4 5.2-5.2" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="lb-feature-text">${escapeHtml(`${ref.kind === 'image' ? 'Image' : 'Text'} reference: ${label}`)}</span>
      </div>`;
    messages.appendChild(row);
    scrollChatToEnd();
  }

  function syncRefToPlanningDom(ref) {
    const list = document.getElementById('screenshot-confirmed-list');
    if (!list || !ref) return;
    if (list.querySelector(`[data-lb-ref-id="${ref.id}"]`)) return;

    if (ref.kind === 'image' && ref.previewUrl && typeof appendScreenshotRefCard === 'function') {
      appendScreenshotRefCard(ref.previewUrl, ref.note || '', ref.description || '');
      const cards = list.querySelectorAll('.screenshot-ref-card');
      const last = cards[cards.length - 1];
      if (last) {
        last.setAttribute('data-lb-ref-id', ref.id);
        const removeBtn = last.querySelector('.screenshot-ref-remove');
        if (removeBtn) {
          const next = removeBtn.cloneNode(true);
          removeBtn.replaceWith(next);
          next.addEventListener('click', () => removeReference(ref.id, { fromDom: true }));
        }
      }
      return;
    }

    const card = document.createElement('div');
    card.className = 'screenshot-ref-card';
    card.setAttribute('data-lb-ref-id', ref.id);
    card.innerHTML = `
      <div class="screenshot-ref-thumb-wrap">
        <div class="screenshot-ref-thumb" style="display:flex;align-items:center;justify-content:center;background:#f3faf5;color:#1f9d55;font-size:11px;font-weight:700;">TXT</div>
      </div>
      <div class="screenshot-ref-body">
        <p class="screenshot-ref-note"><strong>Your note: </strong><span class="screenshot-ref-note-text"></span></p>
        <textarea class="screenshot-ref-description" rows="5"></textarea>
        <button type="button" class="screenshot-ref-remove">Remove</button>
      </div>`;
    const noteSpan = card.querySelector('.screenshot-ref-note-text');
    const desc = card.querySelector('.screenshot-ref-description');
    const removeBtn = card.querySelector('.screenshot-ref-remove');
    if (noteSpan) noteSpan.textContent = ref.note || 'Text reference';
    if (desc) desc.value = ref.description || '';
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        removeReference(ref.id, { fromDom: true });
      });
    }
    if (desc) {
      desc.addEventListener('input', () => {
        const item = refsList().find((r) => r.id === ref.id);
        if (item) item.description = desc.value;
        if (typeof window.updateAllIndicators === 'function') {
          setTimeout(window.updateAllIndicators, 50);
        }
      });
    }
    list.appendChild(card);
    if (typeof window.updateAllIndicators === 'function') window.updateAllIndicators();
    if (typeof window.updateScreenshotLimitUI === 'function') window.updateScreenshotLimitUI();
  }

  function removeRefFromPlanningDom(id) {
    const list = document.getElementById('screenshot-confirmed-list');
    if (!list) return;
    const card = list.querySelector(`[data-lb-ref-id="${id}"]`);
    if (card) card.remove();
    if (typeof window.updateAllIndicators === 'function') window.updateAllIndicators();
    if (typeof window.updateScreenshotLimitUI === 'function') window.updateScreenshotLimitUI();
  }

  function renderRefsStrip() {
    const { refs } = els();
    if (!refs) return;
    const list = refsList();
    if (!list.length) {
      refs.hidden = true;
      refs.innerHTML = '';
      return;
    }
    refs.hidden = false;
    refs.innerHTML = list
      .map((ref) => {
        const label =
          ref.kind === 'image'
            ? truncate(ref.note || 'Image', 42)
            : truncate(ref.note || ref.description || 'Text', 42);
        const media =
          ref.kind === 'image' && ref.previewUrl
            ? `<img class="lb-ref-chip-thumb" src="${escapeHtml(ref.previewUrl)}" alt="" />`
            : `<span class="lb-ref-chip-badge">TXT</span>`;
        return `<div class="lb-ref-chip" data-ref-id="${escapeHtml(ref.id)}">${media}<span class="lb-ref-chip-text">${escapeHtml(label)}</span><button type="button" class="lb-ref-chip-remove" data-remove-ref="${escapeHtml(ref.id)}" aria-label="Remove reference">×</button></div>`;
      })
      .join('');
  }

  function removeReference(id, { fromDom } = {}) {
    state.draft.references = refsList().filter((r) => r.id !== id);
    if (!fromDom) removeRefFromPlanningDom(id);
    document.querySelectorAll(`[data-ref-note="${id}"]`).forEach((n) => n.remove());
    renderRefsStrip();
    state.readiness = computeLocalReadiness(state.draft);
    renderStatus();
  }

  async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read image'));
      reader.readAsDataURL(file);
    });
  }

  async function confirmPendingReference() {
    const { refPanelNote, refPanelText, refPanelAdd, refPanelHint } = els();
    const pending = state.pendingRef;
    if (!pending) return;
    if (refsList().length >= MAX_REFS) {
      if (refPanelHint) {
        refPanelHint.hidden = false;
        refPanelHint.textContent = `Maximum ${MAX_REFS} references per brief.`;
      }
      return;
    }

    const note = (refPanelNote && refPanelNote.value.trim()) || '';
    if (refPanelAdd) {
      refPanelAdd.disabled = true;
      refPanelAdd.textContent = pending.kind === 'image' ? 'Adding…' : 'Adding…';
    }

    try {
      let description = '';
      let previewUrl = '';

      if (pending.kind === 'text') {
        description = (refPanelText && refPanelText.value.trim()) || '';
        if (!description) {
          if (refPanelHint) {
            refPanelHint.hidden = false;
            refPanelHint.textContent = 'Paste the reference text first.';
          }
          return;
        }
      } else if (pending.kind === 'image') {
        if (!note) {
          if (refPanelHint) {
            refPanelHint.hidden = false;
            refPanelHint.textContent = 'Add a short note about what to match.';
          }
          return;
        }
        const file = pending.file;
        if (!file) return;

        if (window.auth && window.auth.currentUser && typeof postScreenshotAnalyze === 'function') {
          try {
            description = await postScreenshotAnalyze(file, note);
          } catch (err) {
            description = note;
            if (refPanelHint) {
              refPanelHint.hidden = false;
              refPanelHint.textContent = 'Analysis unavailable — saved your note as the reference.';
            }
          }
        } else {
          description = note;
        }
        previewUrl = await fileToDataUrl(file);
      }

      const ref = {
        id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: pending.kind,
        note: note || (pending.kind === 'text' ? 'Text reference' : 'Image reference'),
        description,
        previewUrl: previewUrl || ''
      };

      refsList().push(ref);
      syncRefToPlanningDom(ref);
      renderRefsStrip();
      appendRefAddedNote(ref);
      state.messages.push({
        role: 'system',
        content: `Added ${ref.kind} reference: ${ref.note}. ${truncate(ref.description, 240)}`
      });
      closeRefPanel();
      state.readiness = computeLocalReadiness(state.draft);
      renderStatus();
    } finally {
      if (refPanelAdd) {
        refPanelAdd.disabled = false;
        refPanelAdd.textContent = 'Add reference';
      }
    }
  }

  function setSuggestionsOn(on) {
    state.suggestionsOn = !!on;
    try {
      sessionStorage.setItem(SUGGEST_KEY, state.suggestionsOn ? '1' : '0');
    } catch (e) {
      /* ignore */
    }
    const { suggestInline } = els();
    if (!state.suggestionsOn && suggestInline) {
      suggestInline.hidden = true;
      const list = document.getElementById('lbSuggestList');
      if (list) list.innerHTML = '';
    } else if (state.ideasUnlocked) {
      renderSuggestions({ refresh: false });
    }
  }

  function bindEvents() {
    const {
      input,
      form,
      generate,
      tags,
      messages,
      ideasOff,
      composer,
      attach,
      attachMenu,
      refFile,
      refs,
      refPanelClose,
      refPanelAdd
    } = els();

    if (input) {
      input.addEventListener('input', () => {
        if (input.value.trim()) {
          dismissActiveIdeas();
          stopPlaceholderRotation();
        } else {
          startPlaceholderRotation();
        }
        updateSendReady();
        refreshTagButtons();
        autoGrowInput();
      });
      input.addEventListener('focus', () => {
        if (composer) composer.classList.add('is-focused');
      });
      input.addEventListener('blur', () => {
        setTimeout(() => {
          if (composer && document.activeElement !== input && !composer.contains(document.activeElement)) {
            composer.classList.remove('is-focused');
          }
        }, 120);
        if (!String(input.value || '').trim()) startPlaceholderRotation();
      });
      // Enter sends; Shift+Enter inserts a new line
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.code !== 'Enter' && e.keyCode !== 13) return;
        if (e.shiftKey || e.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        handleSend();
      });
      autoGrowInput();
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleSend();
      });
    }

    if (generate) {
      generate.addEventListener('click', (e) => {
        e.preventDefault();
        handleGenerate();
      });
    }

    if (ideasOff) {
      ideasOff.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setSuggestionsOn(false);
      });
    }

    if (tags) {
      tags.addEventListener('click', (e) => {
        const btn = e.target.closest('.lb-tag');
        if (!btn) return;
        insertTag(btn.getAttribute('data-tag'));
      });
    }

    if (messages) {
      messages.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('[data-remove-feature]');
        if (removeBtn) {
          e.preventDefault();
          removeAddedFeature(removeBtn.getAttribute('data-remove-feature'));
        }
      });
    }

    const chatScroll = document.getElementById('lbChatScroll');
    if (chatScroll) {
      chatScroll.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('[data-remove-feature]');
        if (removeBtn) {
          e.preventDefault();
          removeAddedFeature(removeBtn.getAttribute('data-remove-feature'));
          return;
        }
        const btn = e.target.closest('.lb-idea-line[data-suggest]');
        if (!btn || btn.disabled) return;
        applySuggestion(btn.getAttribute('data-suggest'), btn.getAttribute('data-idea-kind'));
      });
    }

    if (attach) {
      attach.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isChatLimitReached()) return;
        toggleAttachMenu();
      });
    }

    if (attachMenu) {
      attachMenu.addEventListener('click', (e) => {
        const opt = e.target.closest('[data-attach-kind]');
        if (!opt) return;
        e.preventDefault();
        closeAttachMenu();
        const kind = opt.getAttribute('data-attach-kind');
        if (kind === 'image') {
          if (refsList().length >= MAX_REFS) return;
          if (refFile) {
            refFile.value = '';
            refFile.click();
          }
        } else if (kind === 'text') {
          if (refsList().length >= MAX_REFS) return;
          openTextRefPanel();
        }
      });
    }

    if (refFile) {
      refFile.addEventListener('change', () => {
        const file = refFile.files && refFile.files[0];
        if (!file) return;
        if (!/^image\/(jpeg|png|gif|webp)$/i.test(file.type)) return;
        if (file.size > 5 * 1024 * 1024) return;
        const previewUrl = URL.createObjectURL(file);
        openImageRefPanel(file, previewUrl);
      });
    }

    if (refPanelClose) {
      refPanelClose.addEventListener('click', () => closeRefPanel());
    }
    if (refPanelAdd) {
      refPanelAdd.addEventListener('click', () => {
        confirmPendingReference();
      });
    }
    if (refs) {
      refs.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-remove-ref]');
        if (!btn) return;
        removeReference(btn.getAttribute('data-remove-ref'));
      });
    }

    document.addEventListener('click', (e) => {
      const wrap = e.target.closest('.lb-attach-wrap');
      if (!wrap) closeAttachMenu();
    });
  }

  function mountOpening() {
    const { messages } = els();
    if (!messages || messages.childElementCount) return;
    const row = appendMessage('assistant', '');
    typeIntoBubble(row.bubble, OPENING).then(() => {
      state.messages.push({ role: 'assistant', content: OPENING });
    });
  }

  function ensurePlanningDomReady() {
    if (typeof renderDesign === 'function') renderDesign();
    if (typeof renderIntegrations === 'function') renderIntegrations();
    if (typeof renderFeatures === 'function') renderFeatures();
    if (typeof renderAudience === 'function') renderAudience();
    if (typeof renderPredefinedPages === 'function') renderPredefinedPages();
  }

  function initLivingBrief() {
    const { root, input } = els();
    if (!root || state.initialized) {
      if (root && state.initialized && input) input.focus();
      return;
    }
    state.initialized = true;
    try {
      const saved = sessionStorage.getItem(SUGGEST_KEY);
      if (saved === '0') state.suggestionsOn = false;
      if (saved === '1') state.suggestionsOn = true;
    } catch (e) {
      /* ignore */
    }
    ensurePlanningDomReady();
    bindEvents();
    setSuggestionsOn(state.suggestionsOn);
    renderStatus();
    mountOpening();
    applyChatLimitState();
    startPlaceholderRotation();
    updateSendReady();
    // Do not render ideas on open — only after the first user message
    setTimeout(() => {
      if (input && !isChatLimitReached()) input.focus();
    }, 350);

    try {
      if (window.analyticsTracker && typeof window.analyticsTracker.trackEvent === 'function') {
        window.analyticsTracker.trackEvent('living_brief_open', 'living_brief', 'planning', {});
      }
    } catch (e) {
      /* ignore */
    }
  }

  window.LivingBrief = {
    init: initLivingBrief,
    send: handleSend,
    sendFromForm: function (event) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      handleSend();
      return false;
    },
    syncFromDom: syncDraftFromDom,
    getState: () => ({
      draft: state.draft,
      readiness: state.readiness,
      proposals: state.proposals,
      messages: state.messages
    }),
    _test: {
      computeLocalReadiness,
      localHeuristicTurn,
      emptyDraft,
      parseTags,
      stripTags
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('livingBrief') && !document.getElementById('planningContainer')?.classList.contains('hidden')) {
      initLivingBrief();
    }
  });
})();
