/**
 * Mermaid sanitizer + heuristic validator for spec generation.
 *
 * Why this exists:
 * - OpenAI structured outputs give us a guaranteed JSON shape, but the *content*
 *   of every Mermaid string is freeform — the model can (and does) emit code
 *   fences, smart quotes, emoji labels, unescaped parentheses, mixed RTL text,
 *   or simply miss the leading directive. The frontend `mermaid.parse()` then
 *   throws and the whole diagram disappears.
 * - We catch the highest-volume breakage modes here, before content reaches
 *   Firestore. Anything we can't auto-fix is reported to the caller so the
 *   spec-generation flow can ask the model to repair just that diagram.
 *
 * Goals:
 * - No new heavy dependency. Heuristic checks only — we don't ship a full
 *   Mermaid grammar.
 * - Idempotent: passing already-clean code returns it unchanged.
 * - Conservative: we never silently drop content; if we strip something
 *   we either keep an equivalent label or fail loudly via the validator.
 */

'use strict';

/** Mermaid 10 directives we accept. Anything else triggers a retry. */
const ALLOWED_DIRECTIVES = [
  'flowchart',
  'graph',
  'erDiagram',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'stateDiagram-v2',
  'mindmap',
  'gantt',
  'pie',
  'gitGraph',
  'journey',
  'timeline',
  'requirementDiagram',
  'C4Context',
  'C4Container',
  'C4Component',
  'quadrantChart'
];

const DIRECTIVE_REGEX = new RegExp(
  `^(${ALLOWED_DIRECTIVES.map((d) => d.replace(/-/g, '\\-')).join('|')})\\b`,
  'i'
);

/** Smart quotes / typographic chars → ASCII equivalents (Mermaid only handles ASCII). */
const QUOTE_REPLACEMENTS = [
  [/[\u2018\u2019\u201A\u201B\u2032]/g, "'"],
  [/[\u201C\u201D\u201E\u201F\u2033]/g, '"'],
  [/[\u2013\u2014\u2015]/g, '-'],
  [/[\u00a0\u202f\u2007]/g, ' '],
  [/\u2026/g, '...']
];

/** Common foreign-language directives the model occasionally emits. */
const DIRECTIVE_ALIASES = [
  [/^(\s*)(grafico|diagramma|grafiek|graphique|grafo|diagrama|diagramme)(\s+)(TB|TD|BT|RL|LR)\b/i, '$1graph$3$4'],
  [/^(\s*)flowchart(\s+)([a-z]+)/i, (m, indent, sp, dir) => `${indent}flowchart${sp}${dir.toUpperCase()}`],
  [/^(\s*)graph(\s+)([a-z]+)/i, (m, indent, sp, dir) => `${indent}graph${sp}${dir.toUpperCase()}`]
];

/** Strip emoji + non-printable / RTL marks (Mermaid 10 chokes on most of them in node IDs). */
function stripUnsafeChars(s) {
  return s
    // Emojis & pictographs
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    // Bidi / formatting controls
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '');
}

/**
 * Lightweight, idempotent cleanup. Never returns null.
 * Use this on every Mermaid string before it leaves the backend.
 */
function sanitizeMermaid(input) {
  if (input == null) return '';
  let s = String(input);

  // 1. Drop ```mermaid fences / ``` wrappers if the model leaked them into JSON.
  s = s.replace(/^\s*```(?:mermaid|mmd)?\s*\n?/i, '');
  s = s.replace(/\n?\s*```\s*$/i, '');
  s = s.replace(/^\s*~~~(?:mermaid|mmd)?\s*\n?/i, '');
  s = s.replace(/\n?\s*~~~\s*$/i, '');

  // 2. Normalize newlines + smart quotes / dashes / spaces.
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (const [re, repl] of QUOTE_REPLACEMENTS) {
    s = s.replace(re, repl);
  }

  // 3. Strip emoji / bidi controls.
  s = stripUnsafeChars(s);

  // 4. Translation drift — `grafico TD` → `graph TD`, lowercase direction → uppercase.
  for (const [re, repl] of DIRECTIVE_ALIASES) {
    s = s.replace(re, repl);
  }

  // 5. `<br>` variants → `<br>` (Mermaid accepts only this exact form in labels).
  s = s.replace(/<\s*br\s*\/?\s*>/gi, '<br>');

  // 6. Mermaid is whitespace-sensitive — collapse trailing spaces but keep internal layout.
  s = s
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .trim();

  return s;
}

/**
 * Heuristic validator. Returns `{ ok, errors, directive }`.
 * `errors` is an array of short strings suitable to feed back to the model.
 */
function validateMermaid(input, { allowEmpty = false } = {}) {
  const s = String(input || '');
  if (!s.trim()) {
    return allowEmpty
      ? { ok: true, errors: [], directive: null }
      : { ok: false, errors: ['Diagram is empty.'], directive: null };
  }

  const errors = [];

  // Directive line — first non-comment, non-empty line.
  const firstMeaningfulLine = s
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('%%'));

  let directive = null;
  if (firstMeaningfulLine) {
    const m = firstMeaningfulLine.match(DIRECTIVE_REGEX);
    if (!m) {
      errors.push(
        `Diagram must start with a Mermaid directive (one of: ${ALLOWED_DIRECTIVES.slice(0, 8).join(', ')}, ...). Got: "${firstMeaningfulLine.slice(0, 60)}".`
      );
    } else {
      directive = m[1];
    }
  } else {
    errors.push('Diagram has no directive line.');
  }

  // Forbid leftover code fences mid-string (sanitizer should have stripped, defense in depth).
  if (/```/.test(s)) {
    errors.push('Diagram contains markdown code fences.');
  }

  // Forbid HTML tags other than <br> (mermaid.parse rejects them).
  const stray = s.match(/<(?!br>)\/?[a-z][^>]*>/gi);
  if (stray && stray.length) {
    errors.push(`Diagram contains stray HTML tags: ${stray.slice(0, 3).join(', ')}.`);
  }

  // Bracket / paren balance — count outside of quoted strings.
  // Skip for erDiagram: cardinality symbols like `||--o{` and `}o--||` reuse
  // `{` `}` as part of relationship tokens, not as scoping characters.
  if (directive !== 'erDiagram') {
    const balance = checkBracketBalance(s);
    if (!balance.ok) {
      errors.push(`Bracket imbalance: ${balance.reason}.`);
    }
  }

  // Per-directive sanity checks.
  if (directive === 'sequenceDiagram') {
    if (!/->>|-->>|->|-->|-x|--x/.test(s)) {
      errors.push('sequenceDiagram has no message arrows (->>, -->>, ->, -->).');
    }
  }
  if (directive === 'erDiagram') {
    // Need at least one relationship line: e.g. `USER ||--o{ ORDER : places`
    if (!/\b\w+\s*[|}]?[o|}\-]+[|{]?\s*\w+\s*:/m.test(s) && !/\{\s*\w+\s+\w+/m.test(s)) {
      errors.push('erDiagram has no relationships or entity bodies.');
    }
  }
  if (directive === 'flowchart' || directive === 'graph') {
    if (!/-->|---|==>|-\.->|\.->|-->|-\.\-/.test(s) && s.split('\n').length < 3) {
      errors.push('flowchart/graph has no edges (-->, ---, ==>).');
    }
  }
  if (directive === 'mindmap') {
    if (s.split('\n').filter((l) => l.trim()).length < 2) {
      errors.push('mindmap has no child nodes.');
    }
  }

  return { ok: errors.length === 0, errors, directive };
}

/**
 * Bracket / paren / quote balance checker that tolerates Mermaid's quoted labels.
 * Returns `{ ok, reason }`.
 */
function checkBracketBalance(s) {
  const stack = [];
  const pairs = { ')': '(', ']': '[', '}': '{' };
  let inString = false;
  let stringChar = '';
  let inLineComment = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const next = s[i + 1];

    if (inLineComment) {
      if (c === '\n') inLineComment = false;
      continue;
    }
    if (!inString && c === '%' && next === '%') {
      inLineComment = true;
      i++;
      continue;
    }

    if (inString) {
      if (c === '\\' && next) {
        i++;
        continue;
      }
      if (c === stringChar) {
        inString = false;
        stringChar = '';
      }
      continue;
    }

    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
      continue;
    }

    if (c === '(' || c === '[' || c === '{') {
      stack.push(c);
    } else if (c === ')' || c === ']' || c === '}') {
      const expected = pairs[c];
      if (!stack.length || stack[stack.length - 1] !== expected) {
        return { ok: false, reason: `unmatched '${c}' near offset ${i}` };
      }
      stack.pop();
    }
  }

  if (inString) return { ok: false, reason: `unterminated ${stringChar} string` };
  if (stack.length) return { ok: false, reason: `unclosed '${stack[stack.length - 1]}'` };
  return { ok: true, reason: null };
}

/**
 * Spec-aware list of every Mermaid field per stage. Used by the generation
 * service to walk a parsed payload and sanitize / validate each diagram.
 *
 * Each entry is the dotted path from the stage payload root (e.g. `technical`).
 * Entries marked `nullable: true` are allowed to come back as null/empty.
 */
const DIAGRAM_FIELDS = {
  technical: [
    { path: 'architectureOverview.systemContextDiagramMermaid', nullable: true, kind: 'flowchart' },
    { path: 'databaseSchema.erDiagramMermaid', nullable: false, kind: 'erDiagram' },
    { path: 'apiDesign.endpointsOverviewDiagramMermaid', nullable: true, kind: 'flowchart' },
    { path: 'dataFlow.diagramMermaid', nullable: true, kind: 'flowchart' },
    { path: 'securityAuthentication.authFlowDiagramMermaid', nullable: true, kind: 'sequenceDiagram' },
    { path: 'integrationExternalApis.integrationLandscapeDiagramMermaid', nullable: true, kind: 'flowchart' },
    { path: 'devops.cicdPipelineDiagramMermaid', nullable: true, kind: 'flowchart' }
  ],
  architecture: [
    { path: 'logicalSystemArchitecture.diagramMermaid', nullable: true, kind: 'flowchart' },
    { path: 'informationArchitecture.diagramMermaid', nullable: true, kind: 'flowchart' },
    { path: 'functionalArchitecture.diagramMermaid', nullable: true, kind: 'flowchart' },
    { path: 'coreFlows.primarySequenceDiagramMermaid', nullable: true, kind: 'sequenceDiagram' },
    { path: 'integrationLandscape.diagramMermaid', nullable: true, kind: 'flowchart' },
    { path: 'deploymentTopology.diagramMermaid', nullable: true, kind: 'flowchart' }
  ]
};

function getByPath(obj, path) {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function setByPath(obj, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  const target = parts.reduce((acc, k) => {
    if (acc == null) return acc;
    if (acc[k] == null || typeof acc[k] !== 'object') return null;
    return acc[k];
  }, obj);
  if (target) target[last] = value;
}

module.exports = {
  ALLOWED_DIRECTIVES,
  DIAGRAM_FIELDS,
  sanitizeMermaid,
  validateMermaid,
  checkBracketBalance,
  getByPath,
  setByPath
};
