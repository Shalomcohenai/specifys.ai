/**
 * Hover explanations for non-obvious product / GTM / architecture terms in the Spec Viewer.
 */

/** @type {{ keys: string[], tip: string }[]} */
const SPEC_TERM_GLOSSARY = [
  {
    keys: ['gtm 30 / 60 / 90', 'gtm 30/60/90', 'gtm 30 /60 /90'],
    tip: 'Go-to-market plan in three phases: first 30, 60, and 90 days after launch — what to ship, sell, and measure in each window.'
  },
  {
    keys: ['gtm', 'go-to-market', 'go to market'],
    tip: 'Go-to-market: how you reach customers, win deals, and grow — channels, messaging, and launch sequence.'
  },
  {
    keys: ['positioning', 'product positioning', 'product positioning insights', 'positioning one-pager'],
    tip: 'How the product is framed in the market: who it is for, what category it sits in, and why it beats alternatives.'
  },
  {
    keys: ['icp scorecard', 'icp'],
    tip: 'Ideal Customer Profile: the company or buyer you are best built to win — used to focus sales and marketing.'
  },
  {
    keys: ['swot analysis', 'swot'],
    tip: 'Strengths, Weaknesses, Opportunities, Threats — a simple grid to weigh internal and external factors.'
  },
  {
    keys: ['personas & jtbd', 'jtbd', 'jobs to be done', 'jobs-to-be-done'],
    tip: 'Jobs to be Done: the progress a user is “hiring” the product to make — not just demographics.'
  },
  {
    keys: ['architecture decision records', 'architecture decision log', 'adr'],
    tip: 'Architecture Decision Record: a short log of a significant tech choice, alternatives, and when to revisit it.'
  },
  {
    keys: ['slo / sli', 'slo', 'sli'],
    tip: 'SLO = Service Level Objective (target). SLI = Service Level Indicator (the metric you measure against that target).'
  },
  {
    keys: ['threat model'],
    tip: 'Structured list of how the system could be attacked or fail securely, plus mitigations for this product.'
  },
  {
    keys: ['data classification'],
    tip: 'Labels data by sensitivity (e.g. public, internal, PII) and how each class must be stored and handled.'
  },
  {
    keys: ['geo & seo', 'geo readiness', 'geo'],
    tip: 'Generative Engine Optimization: making the product discoverable and citable by AI assistants, not only classic search.'
  },
  {
    keys: ['pillar topics'],
    tip: 'Core theme clusters for content SEO — each pillar anchors related articles and internal links.'
  },
  {
    keys: ['programmatic seo'],
    tip: 'Many similar pages generated from structured data (templates + datasets) to capture long-tail search intent.'
  },
  {
    keys: ['llms.txt', 'ai.txt', 'ai-info.txt'],
    tip: 'Machine-readable files that tell AI crawlers what your product is and how to cite or use it.'
  },
  {
    keys: ['json-ld'],
    tip: 'Structured data in JSON embedded in pages so search engines and AI systems understand entities (app, FAQ, org).'
  },
  {
    keys: ['non-goals'],
    tip: 'Explicitly out of scope — what you will not build now, to keep the product focused.'
  },
  {
    keys: ['epics & stories', 'user stories', 'acceptance criteria'],
    tip: 'Epics = large outcomes. Stories = user-facing slices. Acceptance criteria = testable conditions for “done”.'
  },
  {
    keys: ['north-star', 'north star', 'success metrics'],
    tip: 'The primary outcome metric that best tracks product value, plus leading indicators that move it.'
  },
  {
    keys: ['mvp'],
    tip: 'Minimum Viable Product: the smallest shippable version that validates the core value with real users.'
  },
  {
    keys: ['api contracts'],
    tip: 'Agreed request/response shapes, auth, and errors for each endpoint — a contract between frontend and backend.'
  },
  {
    keys: ['budgets & cost', 'performance budgets', 'mvp cost'],
    tip: 'Performance budgets = max latency/UX metrics. Cost model = rough monthly infra spend assumptions for an MVP.'
  },
  {
    keys: ['env / secrets', 'env secrets'],
    tip: 'Environment variables and secrets the app needs (API keys, DB URLs) — never commit real values to source control.'
  },
  {
    keys: ['competitor matrix'],
    tip: 'Side-by-side view of rivals vs you on features, pricing, and gaps — used for positioning and roadmap.'
  },
  {
    keys: ['pricing rationale'],
    tip: 'Why this pricing model and levels make sense for the value metric and comparable products.'
  },
  {
    keys: ['disqualify', 'disqualification'],
    tip: 'Signals that a lead is a poor fit — saves time by saying who not to sell to.'
  },
  {
    keys: ['design tokens', 'token export', 'live palette'],
    tip: 'Named design values (color, type, space) shared by UI and code so the product stays visually consistent.'
  },
  {
    keys: ['component inventory'],
    tip: 'Catalog of reusable UI pieces (button, input, modal) and their states — the building blocks of the interface.'
  },
  {
    keys: ['c4', 'context diagram', 'container diagram'],
    tip: 'C4 model levels: Context (system in the world) and Containers (apps/services) — clear architecture views.'
  },
  {
    keys: ['information architecture'],
    tip: 'How information and entities are organized — domains, sources of truth, and relationships.'
  },
  {
    keys: ['deployment topology'],
    tip: 'Where runtime pieces live (regions, services, networks) and how traffic and secrets flow in production.'
  },
  {
    keys: ['definition of done', 'dod'],
    tip: 'Checklist that must be true before a stage or story is considered complete.'
  },
  {
    keys: ['build / review / tests', 'agent ticket'],
    tip: 'Prompt variants: Build implements, Review checks a change, Tests verifies behavior — same stage, different jobs.'
  },
  {
    keys: ['lcp'],
    tip: 'Largest Contentful Paint — how fast the main content appears (Core Web Vital).'
  },
  {
    keys: ['inp'],
    tip: 'Interaction to Next Paint — how quickly the UI responds after a click or tap (Core Web Vital).'
  },
  {
    keys: ['cls'],
    tip: 'Cumulative Layout Shift — how much the page jumps around while loading (Core Web Vital).'
  },
  {
    keys: ['tam', 'sam', 'som', 'tam/sam/som'],
    tip: 'Market size layers: Total (TAM), Serviceable (SAM), and Obtainable (SOM) — who you could vs will realistically reach.'
  },
  {
    keys: ['rbac'],
    tip: 'Role-Based Access Control: permissions granted by role (e.g. owner, member) rather than per-user rules only.'
  },
  {
    keys: ['er diagram', 'erd'],
    tip: 'Entity-Relationship diagram of database tables and how they connect.'
  },
  {
    keys: ['idempotency'],
    tip: 'Safe retries: repeating the same request does not create duplicate side effects (e.g. double charges).'
  },
  {
    keys: ['complexity score'],
    tip: 'Rough score of how hard the product is to build across architecture, integrations, features, and user systems.'
  }
];

function normalizeHeadingText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function headingMatchesKey(norm, key) {
  if (!norm || !key) return false;
  if (norm === key) return true;
  // Short acronyms must be whole tokens (avoid "adr" in "administrator", "som" in "some")
  if (key.length <= 4) {
    return new RegExp(`(?:^|[^a-z0-9])${escapeRegex(key)}(?:[^a-z0-9]|$)`).test(norm);
  }
  return norm.includes(key);
}

/** Longest keys first so "GTM 30 / 60 / 90" wins over "GTM". */
const SORTED_TERMS = SPEC_TERM_GLOSSARY.map((entry) => ({
  ...entry,
  keys: entry.keys.map((k) => normalizeHeadingText(k)).sort((a, b) => b.length - a.length)
})).sort((a, b) => (b.keys[0]?.length || 0) - (a.keys[0]?.length || 0));

/**
 * @param {string} headingText
 * @returns {{ tip: string } | null}
 */
export function findSpecTerm(headingText) {
  const norm = normalizeHeadingText(headingText);
  if (!norm) return null;
  for (const entry of SORTED_TERMS) {
    for (const key of entry.keys) {
      if (headingMatchesKey(norm, key)) {
        return { tip: entry.tip };
      }
    }
  }
  return null;
}

function preserveLeadingIcons(el) {
  const icons = [];
  Array.from(el.childNodes).forEach((node) => {
    if (node.nodeType === 1 && node.matches && node.matches('i.fa, i.fas, i.far, i.fab, svg')) {
      icons.push(node);
    }
  });
  return icons;
}

/**
 * Attach hover tooltips to jargon headings / labels inside a rendered spec section.
 * @param {ParentNode | null | undefined} root
 */
export function enhanceSpecTermTooltips(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;

  const candidates = root.querySelectorAll(
    'h2, h3, h4, .enriched-heading, .architecture-h2, .kpi-label, .user-flow-rail-heading'
  );

  candidates.forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.classList.contains('spec-term') || el.querySelector(':scope > .spec-term')) return;

    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return;

    const match = findSpecTerm(text);
    if (!match) return;

    if (el.classList.contains('kpi-label')) {
      el.classList.add('spec-term');
      el.setAttribute('data-tooltip', match.tip);
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-description', match.tip);
      return;
    }

    const icons = preserveLeadingIcons(el);
    const span = document.createElement('span');
    span.className = 'spec-term';
    span.setAttribute('data-tooltip', match.tip);
    span.setAttribute('tabindex', '0');
    span.setAttribute('aria-description', match.tip);
    span.appendChild(document.createTextNode(text + ' '));
    const info = document.createElement('i');
    info.className = 'fa fa-info-circle spec-term-icon';
    info.setAttribute('aria-hidden', 'true');
    span.appendChild(info);

    el.textContent = '';
    icons.forEach((icon) => el.appendChild(icon));
    if (icons.length) el.appendChild(document.createTextNode(' '));
    el.appendChild(span);
  });
}

export { SPEC_TERM_GLOSSARY };
