/**
 * Architecture document-style renderer: diagrams first, ADR cards, collapsible narratives.
 */

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mermaidPlaceholder(code) {
  if (!code || !String(code).trim()) return '';
  return `<div class="spec-mermaid-placeholder architecture-mermaid-wrap" data-spec-mermaid="${encodeURIComponent(String(code).trim())}"></div>`;
}

function collapsibleNarrative(title, narrative) {
  if (!narrative || !String(narrative).trim()) return '';
  return `<details class="arch-narrative"><summary>${esc(title)} — details</summary><p>${esc(narrative)}</p></details>`;
}

/**
 * @param {object|string} architecture - structured object or markdown string
 */
export function renderEnrichedArchitecture(architecture) {
  if (architecture == null) return '';
  if (typeof architecture === 'string') {
    // Markdown path handled by existing displayArchitecture; optional hint only
    return '';
  }
  if (typeof architecture !== 'object') return '';

  const parts = ['<div class="enriched-stage-block enriched-architecture arch-document">'];

  if (architecture.executiveSummary) {
    parts.push('<section class="arch-section"><h2 class="architecture-h2">Executive summary</h2>');
    parts.push(`<p class="architecture-p">${esc(architecture.executiveSummary)}</p></section>`);
  }

  const diagramSections = [
    ['Context diagram', architecture.contextDiagramMermaid, null],
    ['Container diagram', architecture.containerDiagramMermaid, null],
    [
      'Logical system architecture',
      architecture.logicalSystemArchitecture?.diagramMermaid,
      architecture.logicalSystemArchitecture?.narrative
    ],
    [
      'Information architecture',
      architecture.informationArchitecture?.diagramMermaid,
      architecture.informationArchitecture?.narrative
    ],
    [
      'Functional architecture',
      architecture.functionalArchitecture?.diagramMermaid,
      architecture.functionalArchitecture?.narrative
    ],
    [
      'Core flows',
      architecture.coreFlows?.primarySequenceDiagramMermaid,
      architecture.coreFlows?.narrative
    ],
    [
      'Integration landscape',
      architecture.integrationLandscape?.diagramMermaid,
      architecture.integrationLandscape?.narrative
    ],
    [
      'Deployment topology',
      architecture.deploymentTopology?.diagramMermaid,
      architecture.deploymentTopology?.narrative
    ]
  ];

  diagramSections.forEach(([title, diagram, narrative]) => {
    if (!diagram && !narrative) return;
    parts.push(`<section class="arch-section"><h2 class="architecture-h2">${esc(title)}</h2>`);
    if (diagram) parts.push(mermaidPlaceholder(diagram));
    if (narrative) parts.push(collapsibleNarrative(title, narrative));
    parts.push('</section>');
  });

  if (architecture.systemBoundaries) {
    parts.push(
      `<section class="arch-section"><h2 class="architecture-h2">System boundaries</h2><p class="architecture-p">${esc(architecture.systemBoundaries)}</p></section>`
    );
  }

  if (architecture.repositoryStructure) {
    parts.push(
      `<section class="arch-section"><h2 class="architecture-h2">Repository structure</h2><pre class="arch-repo-pre">${esc(architecture.repositoryStructure)}</pre></section>`
    );
  }

  if (architecture.repoToPromptsMap) {
    parts.push(
      `<section class="arch-section"><h2 class="architecture-h2">Repo → Prompts map</h2><p class="architecture-p">${esc(architecture.repoToPromptsMap)}</p></section>`
    );
  }

  if (Array.isArray(architecture.adrs) && architecture.adrs.length) {
    parts.push('<section class="arch-section"><h2 class="architecture-h2">Architecture decision records</h2>');
    parts.push('<div class="adr-card-grid">');
    architecture.adrs.forEach((adr) => {
      parts.push('<article class="adr-card">');
      parts.push(`<h3>${esc(adr.title)}</h3>`);
      parts.push(`<p><strong>Context</strong> ${esc(adr.context)}</p>`);
      if (adr.options?.length) {
        parts.push('<ul>' + adr.options.map((o) => `<li>${esc(o)}</li>`).join('') + '</ul>');
      }
      parts.push(`<p class="adr-decision"><strong>Decision</strong> ${esc(adr.decision)}</p>`);
      if (adr.consequences?.length) {
        parts.push(
          '<p><strong>Consequences</strong></p><ul>' +
            adr.consequences.map((c) => `<li>${esc(c)}</li>`).join('') +
            '</ul>'
        );
      }
      parts.push(`<p class="adr-revisit"><strong>Revisit when</strong> ${esc(adr.revisitWhen)}</p>`);
      parts.push('</article>');
    });
    parts.push('</div></section>');
  }

  if (Array.isArray(architecture.threatModel) && architecture.threatModel.length) {
    parts.push('<section class="arch-section"><h2 class="architecture-h2">Threat model</h2><div class="severity-card-grid">');
    architecture.threatModel.forEach((t) => {
      const sev = String(t.severity || '').toLowerCase();
      parts.push(`<article class="severity-card severity-${esc(sev)}">`);
      parts.push(`<span class="severity-badge">${esc(t.severity)}</span>`);
      parts.push(`<h4>${esc(t.threat)}</h4><p>${esc(t.mitigation)}</p></article>`);
    });
    parts.push('</div></section>');
  }

  if (Array.isArray(architecture.sloSli) && architecture.sloSli.length) {
    parts.push('<section class="arch-section"><h2 class="architecture-h2">SLO / SLI</h2><div class="kpi-tile-grid">');
    architecture.sloSli.forEach((s) => {
      parts.push(
        `<div class="kpi-tile"><span class="kpi-label">${esc(s.name)}</span><span class="kpi-value">${esc(s.target)}</span><span class="kpi-sub">${esc(s.sli)}${s.window ? ' · ' + esc(s.window) : ''}</span></div>`
      );
    });
    parts.push('</div></section>');
  }

  if (Array.isArray(architecture.dataClassification) && architecture.dataClassification.length) {
    parts.push('<section class="arch-section"><h2 class="architecture-h2">Data classification</h2><table class="arch-table"><thead><tr><th>Data</th><th>Class</th><th>Handling</th></tr></thead><tbody>');
    architecture.dataClassification.forEach((d) => {
      parts.push(`<tr><td>${esc(d.name)}</td><td>${esc(d.classification)}</td><td>${esc(d.handling)}</td></tr>`);
    });
    parts.push('</tbody></table></section>');
  }

  if (Array.isArray(architecture.failureModes) && architecture.failureModes.length) {
    parts.push('<section class="arch-section"><h2 class="architecture-h2">Failure modes &amp; runbooks</h2>');
    architecture.failureModes.forEach((f) => {
      parts.push('<article class="runbook-card">');
      parts.push(`<h4>${esc(f.failure)}</h4>`);
      parts.push(`<p><strong>Impact</strong> ${esc(f.impact)}</p>`);
      parts.push(`<p><strong>Detection</strong> ${esc(f.detection)}</p>`);
      parts.push(`<p><strong>Runbook</strong> ${esc(f.runbook)}</p>`);
      parts.push('</article>');
    });
    parts.push('</section>');
  }

  ['nonFunctionalQuality', 'observabilityOperability', 'securityArchitectureDeepDive', 'risksAndOpenDecisions'].forEach(
    (key) => {
      if (!architecture[key]) return;
      const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
      parts.push(
        `<section class="arch-section"><h2 class="architecture-h2">${esc(title)}</h2>${collapsibleNarrative(title, architecture[key])}</section>`
      );
    }
  );

  parts.push('</div>');
  return parts.join('');
}
