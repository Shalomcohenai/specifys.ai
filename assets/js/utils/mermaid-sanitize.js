/**
 * Normalizes Mermaid source before mermaid.parse() runs.
 *
 * Defense in depth: the backend (`backend/schemas/mermaid-validator.js`) does
 * the same cleanup before storage, but specs created before that fix landed
 * still live in Firestore — so we run the same logic on the client to keep
 * old data renderable without re-generating.
 *
 * Cleanups applied (idempotent):
 *  - strip ```` ```mermaid `` ``` `` wrappers if the model leaked them
 *  - normalize smart quotes / dashes / nbsp into ASCII
 *  - strip emoji and bidi control characters
 *  - keep only <br>, drop other HTML tags inside labels
 *  - rewrite foreign-language directives (grafico TD → graph TD)
 *  - uppercase flowchart/graph direction tokens
 */
(function (global) {
  'use strict';

  var QUOTE_REPLACEMENTS = [
    [/[\u2018\u2019\u201A\u201B\u2032]/g, "'"],
    [/[\u201C\u201D\u201E\u201F\u2033]/g, '"'],
    [/[\u2013\u2014\u2015]/g, '-'],
    [/[\u00a0\u202f\u2007]/g, ' '],
    [/\u2026/g, '...']
  ];

  function stripUnsafeChars(s) {
    return s
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
      .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '');
  }

  function sanitizeMermaidSource(raw) {
    if (raw == null) return '';
    var s = String(raw);

    // Strip code fences if the model wrapped the diagram in ```mermaid ... ```.
    s = s.replace(/^\s*```(?:mermaid|mmd)?\s*\n?/i, '');
    s = s.replace(/\n?\s*```\s*$/i, '');
    s = s.replace(/^\s*~~~(?:mermaid|mmd)?\s*\n?/i, '');
    s = s.replace(/\n?\s*~~~\s*$/i, '');

    s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (var i = 0; i < QUOTE_REPLACEMENTS.length; i++) {
      s = s.replace(QUOTE_REPLACEMENTS[i][0], QUOTE_REPLACEMENTS[i][1]);
    }

    s = stripUnsafeChars(s);

    // Drop HTML other than <br>, then normalize <br> variants.
    s = s.replace(/<\s*br\s*\/?\s*>/gi, '\u0001BR\u0001');
    s = s.replace(/<[^>]+>/g, '');
    s = s.replace(/\u0001BR\u0001/g, '<br>');

    var lines = s.split('\n');
    var foreignDir = /^(\s*)(grafico|diagramma|grafiek|graphique|grafo|diagrama|diagramme)(\s+)(TB|TD|BT|RL|LR)(\b)/i;
    var dirCase = /^(\s*)(flowchart|graph)(\s+)([a-z]+)/i;
    for (var j = 0; j < lines.length; j++) {
      lines[j] = lines[j].replace(foreignDir, function (_, indent, _word, sp, dir) {
        return indent + 'graph' + sp + dir.toUpperCase();
      });
      lines[j] = lines[j].replace(dirCase, function (_, indent, kw, sp, dir) {
        return indent + kw + sp + dir.toUpperCase();
      });
      lines[j] = lines[j].replace(/[ \t]+$/g, '');
    }
    s = lines.join('\n');

    return s.trim();
  }

  global.sanitizeMermaidSource = sanitizeMermaidSource;
})(typeof window !== 'undefined' ? window : this);
