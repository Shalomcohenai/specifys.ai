/**
 * Demo Spec main — loads enriched example JSON and renders with Spec Viewer enriched UI.
 * Supports ?example=<id> (relaydesk|crm|marketplace|booking|ai-saas|social).
 */
import {
  renderEnrichedOverview,
  renderEnrichedTechnical,
  renderEnrichedMarket,
  renderEnrichedDesign,
  renderEnrichedArchitecture,
  renderEnrichedVisibility,
  renderEnrichedPrompts,
  renderDetailedUserFlowRail,
  normalizeOverviewDisplayFields,
  bindEnrichedDesignInteractions,
  bindCopyButtons,
  enhanceSpecTermTooltips
} from '../spec-viewer/modules/UiRenderer.js';
import { renderSpecMermaidPlaceholders } from '../spec-viewer/modules/DiagramEngine.js';

const MANIFEST_URL = '/assets/data/example-specs/manifest.json';
const DEFAULT_ID = 'relaydesk';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function exampleIdFromLocation() {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = (params.get('example') || params.get('spec') || '').toLowerCase();
    if (q) return q;
  } catch (_) {
    /* ignore */
  }
  const hash = (window.location.hash || '').replace(/^#/, '');
  // hash may be a tab name; ignore known tabs
  const tabs = new Set(['overview', 'technical', 'market', 'design', 'diagrams', 'prompts', 'chat', 'export', 'visibility']);
  if (hash && !tabs.has(hash)) return hash.toLowerCase();
  return DEFAULT_ID;
}

function tabFromLocation() {
  const hash = (window.location.hash || '').replace(/^#/, '').toLowerCase();
  const tabs = new Set(['overview', 'technical', 'market', 'design', 'diagrams', 'prompts', 'chat', 'export', 'visibility']);
  if (tabs.has(hash)) return hash;
  return 'overview';
}

function renderNarrativeOverview(overview) {
  if (!overview) return '';
  const o = normalizeOverviewDisplayFields(overview) || overview;
  const parts = ['<div class="content-section enriched-demo-summary">'];
  if (o.shortTitle) {
    parts.push(`<h2 class="demo-spec-product-title">${esc(o.shortTitle)}</h2>`);
  }
  if (o.ideaSummary) {
    parts.push('<h3><i class="fa fa-clipboard" aria-hidden="true"></i> Idea summary</h3>');
    parts.push(`<p>${esc(o.ideaSummary)}</p>`);
  }
  if (o.detailedUserFlow?.steps?.length) {
    parts.push(renderDetailedUserFlowRail(o.detailedUserFlow.steps));
  }
  if (o.problemStatement) {
    parts.push('<h3><i class="fa fa-exclamation-circle" aria-hidden="true"></i> Problem</h3>');
    parts.push(`<p>${esc(o.problemStatement)}</p>`);
  }
  if (o.valueProposition) {
    parts.push('<h3><i class="fa fa-lightbulb-o" aria-hidden="true"></i> Value proposition</h3>');
    parts.push(`<p>${esc(o.valueProposition)}</p>`);
  }
  if (Array.isArray(o.coreFeaturesOverview) && o.coreFeaturesOverview.length) {
    parts.push('<h3><i class="fa fa-star" aria-hidden="true"></i> Core features</h3><ul>');
    o.coreFeaturesOverview.forEach((f) => parts.push(`<li>${esc(f)}</li>`));
    parts.push('</ul>');
  }
  if (o.userJourneySummary) {
    parts.push('<h3><i class="fa fa-road" aria-hidden="true"></i> User journey</h3>');
    parts.push(`<p>${esc(o.userJourneySummary)}</p>`);
  }
  if (o.screenDescriptions?.screens?.length) {
    parts.push(
      `<h3><i class="fa fa-desktop" aria-hidden="true"></i> Screen descriptions</h3>`
    );
    parts.push(`<h4>Screens (${o.screenDescriptions.screens.length} total):</h4>`);
    parts.push('<div class="screens-grid">');
    o.screenDescriptions.screens.forEach((screen, index) => {
      const name = typeof screen === 'string' ? `Screen ${index + 1}` : screen.name || `Screen ${index + 1}`;
      const desc =
        typeof screen === 'string' ? screen : screen.description || screen.purpose || '';
      parts.push('<article class="screen-state-card">');
      parts.push(`<h4>${esc(name)}</h4>`);
      parts.push(`<p>${esc(desc)}</p>`);
      const comps = typeof screen === 'object' && Array.isArray(screen.uiComponents) ? screen.uiComponents : [];
      if (comps.length) {
        parts.push('<ul>' + comps.map((c) => `<li>${esc(c)}</li>`).join('') + '</ul>');
      }
      parts.push('</article>');
    });
    parts.push('</div>');
    if (o.screenDescriptions.navigationStructure) {
      parts.push('<h4>Navigation structure</h4>');
      parts.push(`<p>${esc(o.screenDescriptions.navigationStructure)}</p>`);
    }
  }
  if (o.targetAudience) {
    const ta = o.targetAudience;
    parts.push('<h3><i class="fa fa-users" aria-hidden="true"></i> Target audience</h3>');
    if (ta.sector) parts.push(`<p><strong>Sector:</strong> ${esc(ta.sector)}</p>`);
    if (ta.ageRange) parts.push(`<p><strong>Age range:</strong> ${esc(ta.ageRange)}</p>`);
    if (Array.isArray(ta.needs) && ta.needs.length) {
      parts.push('<p><strong>Needs:</strong></p><ul>');
      ta.needs.forEach((n) => parts.push(`<li>${esc(n)}</li>`));
      parts.push('</ul>');
    }
  }
  if (o.complexityScore) {
    const c = o.complexityScore;
    parts.push('<h3><i class="fa fa-tachometer" aria-hidden="true"></i> Complexity</h3>');
    parts.push('<div class="kpi-tile-grid">');
    ['architecture', 'integrations', 'functionality', 'userSystem'].forEach((k) => {
      if (c[k] == null) return;
      parts.push(
        `<div class="kpi-tile"><span class="kpi-label">${esc(k)}</span><span class="kpi-value">${esc(c[k])}</span></div>`
      );
    });
    parts.push('</div>');
  }
  parts.push('</div>');
  return parts.join('');
}

function renderMarketNarrative(market) {
  if (!market) return '';
  const parts = ['<div class="content-section">'];
  const ind = market.industryOverview;
  if (ind) {
    parts.push('<h3><i class="fa fa-line-chart" aria-hidden="true"></i> Industry overview</h3>');
    if (ind.trends) parts.push(`<p>${esc(ind.trends)}</p>`);
    if (ind.marketData) parts.push(`<p>${esc(ind.marketData)}</p>`);
    if (ind.growthProjections) parts.push(`<p>${esc(ind.growthProjections)}</p>`);
    if (ind.estimateDisclaimer) {
      parts.push(`<p class="method-note">${esc(ind.estimateDisclaimer)}</p>`);
    }
  }
  const aud = market.targetAudienceInsights;
  if (aud?.primaryAudience) {
    parts.push('<h3>Primary audience</h3>');
    parts.push(`<p>${esc(aud.primaryAudience.description)}</p>`);
  }
  if (market.marketingStrategy?.goToMarket) {
    parts.push('<h3>Go-to-market</h3>');
    parts.push(`<p>${esc(market.marketingStrategy.goToMarket)}</p>`);
  }
  parts.push('</div>');
  return parts.join('');
}

function renderTechnicalExtras(technical) {
  if (!technical || typeof technical !== 'object') return '';
  const parts = ['<div class="content-section technical-extras">'];
  const ao = technical.architectureOverview;
  if (ao?.narrative) {
    parts.push('<h3><i class="fa fa-building" aria-hidden="true"></i> Architecture overview</h3>');
    parts.push(`<p>${esc(ao.narrative)}</p>`);
    if (ao.systemContextDiagramMermaid) {
      parts.push(
        `<div class="spec-mermaid-placeholder" data-spec-mermaid="${encodeURIComponent(ao.systemContextDiagramMermaid)}"></div>`
      );
    }
  }
  const db = technical.databaseSchema;
  if (db?.description || db?.erDiagramMermaid) {
    parts.push('<h3><i class="fa fa-database" aria-hidden="true"></i> Database</h3>');
    if (db.description) parts.push(`<p>${esc(db.description)}</p>`);
    if (db.erDiagramMermaid) {
      parts.push(
        `<div class="spec-mermaid-placeholder" data-spec-mermaid="${encodeURIComponent(db.erDiagramMermaid)}"></div>`
      );
    }
  }
  const df = technical.dataFlow;
  if (df?.narrative || df?.diagramMermaid) {
    parts.push('<h3><i class="fa fa-exchange" aria-hidden="true"></i> Data flow</h3>');
    if (df.narrative) parts.push(`<p>${esc(df.narrative)}</p>`);
    if (df.diagramMermaid) {
      parts.push(
        `<div class="spec-mermaid-placeholder" data-spec-mermaid="${encodeURIComponent(df.diagramMermaid)}"></div>`
      );
    }
  }
  const sec = technical.securityAuthentication;
  if (sec) {
    parts.push('<h3><i class="fa fa-lock" aria-hidden="true"></i> Security &amp; Authentication</h3>');
    if (Array.isArray(sec.securityCriticalPoints) && sec.securityCriticalPoints.length) {
      sec.securityCriticalPoints.forEach((p) => {
        parts.push(
          `<div class="security-banner" style="display:flex;align-items:flex-start;gap:10px;padding:12px;margin-bottom:12px;background:#f8f9fa;border-radius:6px;border:1px solid #e0e0e0;"><i class="fa fa-exclamation-triangle" style="color:#dc3545;margin-top:2px;" aria-hidden="true"></i><span>${esc(p)}</span></div>`
        );
      });
    }
    if (sec.authentication) parts.push(`<p><strong>Authentication:</strong> ${esc(sec.authentication)}</p>`);
    if (sec.authorization) parts.push(`<p><strong>Authorization:</strong> ${esc(sec.authorization)}</p>`);
    if (sec.encryption) parts.push(`<p><strong>Encryption:</strong> ${esc(sec.encryption)}</p>`);
    if (sec.securityMeasures) parts.push(`<p><strong>Security measures:</strong> ${esc(sec.securityMeasures)}</p>`);
    if (sec.authFlowDiagramMermaid) {
      parts.push('<h4>Authentication flow</h4>');
      parts.push(
        `<div class="spec-mermaid-placeholder" data-spec-mermaid="${encodeURIComponent(sec.authFlowDiagramMermaid)}"></div>`
      );
    }
  }
  if (technical.apiDesign?.endpointsOverviewDiagramMermaid) {
    parts.push('<h3><i class="fa fa-project-diagram" aria-hidden="true"></i> API map</h3>');
    parts.push(
      `<div class="spec-mermaid-placeholder" data-spec-mermaid="${encodeURIComponent(technical.apiDesign.endpointsOverviewDiagramMermaid)}"></div>`
    );
  }
  parts.push('</div>');
  return parts.length > 2 ? parts.join('') : '';
}

function collectTechnicalDiagramEntries(spec) {
  const entries = [];
  const push = (name, code) => {
    if (code && String(code).trim()) entries.push({ name, code: String(code).trim() });
  };
  const t = spec.technical || {};
  push('System context', t.architectureOverview?.systemContextDiagramMermaid);
  push('ER diagram', t.databaseSchema?.erDiagramMermaid);
  push('API overview', t.apiDesign?.endpointsOverviewDiagramMermaid);
  push('Data flow', t.dataFlow?.diagramMermaid);
  push('Auth flow', t.securityAuthentication?.authFlowDiagramMermaid);
  push('Integrations', t.integrationExternalApis?.integrationLandscapeDiagramMermaid);
  push('CI/CD', t.devops?.cicdPipelineDiagramMermaid);
  return entries;
}

function renderTechnicalDiagramsOnly(spec) {
  const entries = collectTechnicalDiagramEntries(spec);
  if (!entries.length) return '<div class="loading-content"><p>No diagrams available</p></div>';
  const parts = ['<div class="enriched-stage-block enriched-diagrams">'];
  entries.forEach((d, i) => {
    parts.push('<section class="arch-section" style="margin-bottom:2rem;">');
    parts.push(`<h3 class="architecture-h2">${esc(d.name)}</h3>`);
    parts.push(
      `<div class="spec-mermaid-placeholder" data-spec-mermaid="${encodeURIComponent(d.code)}" id="demo-mermaid-${i}"></div>`
    );
    parts.push('</section>');
  });
  parts.push('</div>');
  return parts.join('');
}

function renderExportTab(productName) {
  return `<div class="content-section">
    <h3><i class="fa fa-download" aria-hidden="true"></i> Export</h3>
    <p>Export is available on your own generated specs from the Spec Viewer. This live demo shows the enriched ${esc(productName)} specification format.</p>
    <p><a class="example-spec-btn-primary" href="/?autoStart=true">Generate your spec</a></p>
  </div>`;
}

function renderChatTab() {
  return `<div class="content-section">
    <h3><i class="fa fa-comments" aria-hidden="true"></i> Chat with AI</h3>
    <p>Chat is available for logged-in users on their own specifications. <a href="/pages/auth.html">Log in</a> to continue, or <a href="/?autoStart=true">start a free spec</a>.</p>
  </div>`;
}

function setActiveTab(tabName) {
  const tabs = document.querySelectorAll('.spec-tab');
  const contents = document.querySelectorAll('.spec-content');
  tabs.forEach((t) => {
    const on = t.getAttribute('data-tab') === tabName;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  contents.forEach((c) => {
    const on = c.id === tabName;
    c.classList.toggle('active', on);
    c.setAttribute('aria-hidden', on ? 'false' : 'true');
  });
  if (tabName === 'diagrams' && typeof window.renderDiagrams === 'function') {
    window.renderDiagrams();
  }
}

function initTabs() {
  document.querySelectorAll('.spec-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      setActiveTab(target);
      try {
        history.replaceState(null, '', `#${target}`);
      } catch (_) {
        /* ignore */
      }
    });
  });
}

function renderExampleSwitcher(manifest, currentId) {
  const host = document.getElementById('demoExampleSwitcher');
  if (!host || !manifest?.examples?.length) return;
  const parts = ['<label class="demo-example-switcher-label" for="demoExampleSelect">Example</label>'];
  parts.push('<select id="demoExampleSelect" class="demo-example-select" aria-label="Choose example specification">');
  manifest.examples.forEach((ex) => {
    const sel = ex.id === currentId ? ' selected' : '';
    parts.push(`<option value="${esc(ex.id)}"${sel}>${esc(ex.category)} — ${esc(ex.title)}</option>`);
  });
  parts.push('</select>');
  host.innerHTML = parts.join('');
  const select = host.querySelector('#demoExampleSelect');
  select.addEventListener('change', () => {
    const id = select.value;
    const tab = tabFromLocation();
    window.location.href = `/pages/demo-spec.html?example=${encodeURIComponent(id)}#${tab}`;
  });
}

async function loadManifest() {
  const res = await fetch(MANIFEST_URL, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Could not load example manifest');
  return res.json();
}

async function loadSpec(exampleId, manifest) {
  const entry = (manifest.examples || []).find((e) => e.id === exampleId) ||
    (manifest.examples || []).find((e) => e.id === DEFAULT_ID);
  if (!entry) throw new Error('Example not found');
  const res = await fetch(entry.path, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Could not load ${entry.path}`);
  const spec = await res.json();
  return { spec, entry };
}

async function renderAll(spec, entry) {
  const productName = entry.title || spec.meta?.product || 'Example';
  const overview = normalizeOverviewDisplayFields(spec.overview) || spec.overview;

  const overviewEl = document.getElementById('overview');
  if (overviewEl && overview) {
    // Narrative base + enriched extras (personas/stories/KPIs) — no second Visual Style / SWOT path here
    overviewEl.innerHTML =
      renderNarrativeOverview(overview) + (renderEnrichedOverview(overview) || '');
  }

  const technicalEl = document.getElementById('technical');
  if (technicalEl && spec.technical) {
    // Enriched stack/API/budgets once; extras add narrative + security (no second Tech Stack)
    technicalEl.innerHTML =
      (renderEnrichedTechnical(spec.technical) || '') + renderTechnicalExtras(spec.technical);
    await renderSpecMermaidPlaceholders(technicalEl);
  }

  const marketEl = document.getElementById('market');
  if (marketEl && spec.market) {
    // Enriched SWOT/ICP/GTM once; narrative only industry/audience leftovers
    marketEl.innerHTML =
      (renderEnrichedMarket(spec.market) || '') + renderMarketNarrative(spec.market);
  }

  const designEl = document.getElementById('design');
  if (designEl && spec.design) {
    // Single enriched design path (palette + style notes — no legacy Visual Style Guide)
    designEl.innerHTML = renderEnrichedDesign(spec.design) || '';
    bindEnrichedDesignInteractions(designEl);
  }

  const diagramsEl = document.getElementById('diagrams');
  if (diagramsEl) {
    // Prefer architecture document once — do NOT re-list the same Mermaid blocks below
    const archHtml = renderEnrichedArchitecture(spec.architecture) || '';
    diagramsEl.innerHTML = archHtml || renderTechnicalDiagramsOnly(spec);
    diagramsEl.dataset.diagramsReady = 'true';
    window.renderDiagrams = async () => {
      await renderSpecMermaidPlaceholders(diagramsEl);
    };
  }

  const promptsEl = document.getElementById('prompts');
  if (promptsEl) {
    let html = '';
    if (spec.visibility) {
      html += renderEnrichedVisibility(spec.visibility) || '';
    }
    html += renderEnrichedPrompts(spec.prompts) || '';
    // Full prompt once, collapsed — tickets already summarize stages
    if (spec.prompts?.fullPrompt) {
      window.fullPromptText = spec.prompts.fullPrompt;
      html += `<details class="content-section demo-full-prompt"><summary>Full development prompt (copy)</summary>
        <button type="button" class="copy-code-btn" id="copyFullPromptBtn">Copy full prompt</button>
        <pre class="prompt-code"><code>${esc(spec.prompts.fullPrompt)}</code></pre></details>`;
    }
    promptsEl.innerHTML = html || '<p>No prompts available</p>';
    bindCopyButtons(promptsEl);
    const copyBtn = document.getElementById('copyFullPromptBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(window.fullPromptText || '');
          copyBtn.textContent = 'Copied';
          setTimeout(() => {
            copyBtn.textContent = 'Copy full prompt';
          }, 1500);
        } catch (_) {
          copyBtn.textContent = 'Failed';
        }
      });
    }
  }

  const exportEl = document.getElementById('export');
  if (exportEl) exportEl.innerHTML = renderExportTab(productName);

  const chatEl = document.getElementById('chat');
  if (chatEl) chatEl.innerHTML = renderChatTab();

  [overviewEl, technicalEl, marketEl, designEl, diagramsEl, promptsEl].forEach((el) => {
    if (el) enhanceSpecTermTooltips(el);
  });

  const header = document.querySelector('.demo-header h1');
  if (header) {
    header.textContent = `${productName}: live enriched spec demo`;
  }
  const sub = document.querySelector('.demo-header p');
  if (sub && entry.shortDesc) {
    sub.textContent =
      entry.shortDesc +
      ' — switch tabs to explore overview, technical, market, design, diagrams, and agent prompts.';
  }
}

async function main() {
  initTabs();
  const overview = document.getElementById('overview');
  if (overview) {
    overview.innerHTML =
      '<div class="loading-content"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Loading enriched example…</div>';
  }

  try {
    const manifest = await loadManifest();
    let id = exampleIdFromLocation();
    if (!(manifest.examples || []).some((e) => e.id === id)) id = manifest.defaultExampleId || DEFAULT_ID;
    renderExampleSwitcher(manifest, id);
    const { spec, entry } = await loadSpec(id, manifest);
    window.demoSpecData = spec;
    window.demoSpecMeta = entry;
    await renderAll(spec, entry);
    setActiveTab(tabFromLocation());
    if (tabFromLocation() === 'diagrams') {
      await window.renderDiagrams?.();
    }
  } catch (err) {
    if (overview) {
      overview.innerHTML = `<div class="loading-content" role="alert" style="color:#d32f2f;">
        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
        <p>Error loading demo specification: ${esc(err.message)}</p>
      </div>`;
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
