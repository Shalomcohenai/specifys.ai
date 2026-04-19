/**
 * Normalizes Mermaid source: strips HTML from rich text / translation wrappers
 * and fixes common non-English "graph" keywords (e.g. Italian "grafico TD").
 */
(function (global) {
  'use strict';

  function sanitizeMermaidSource(raw) {
    if (raw == null) return '';
    var s = String(raw);
    s = s.replace(/<[^>]+>/g, '');
    s = s.replace(/\u00a0/g, ' ');
    s = s.replace(/\r\n/g, '\n');
    var lines = s.split('\n');
    var headRe = /^(\s*)(grafico|diagramma|grafiek|graphique|grafo)(\s+)(TB|TD|BT|RL|LR)(\b)/i;
    for (var i = 0; i < lines.length; i++) {
      lines[i] = lines[i].replace(headRe, function (_, indent, _word, sp, dir) {
        return indent + 'graph' + sp + dir;
      });
    }
    s = lines.join('\n');
    return s.trim();
  }

  global.sanitizeMermaidSource = sanitizeMermaidSource;
})(typeof window !== 'undefined' ? window : this);
