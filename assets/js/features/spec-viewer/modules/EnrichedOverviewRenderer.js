/**
 * Visual-first enriched Overview sections (personas, stories, permissions, KPIs).
 * Backward compatible: returns '' when enriched fields are absent.
 * Also exports Detailed User Flow journey-rail markup shared with legacy formatters.
 */

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Lightly parse a step string into { title, detail } for the journey rail.
 * Handles "Step N: …", first-sentence titles, and plain text.
 */
export function parseFlowStep(step, index) {
  const n = index + 1;
  let raw = String(step ?? '').trim();
  if (!raw) {
    return { n, title: `Step ${n}`, detail: '' };
  }

  raw = raw.replace(/^Step\s+\d+\s*[:.\u2013\u2014\-]\s*/i, '').trim();

  const titled = raw.match(/^(.{3,72}?):\s+(.+)$/s);
  if (titled) {
    return { n, title: titled[1].trim(), detail: titled[2].trim() };
  }

  const sentence = raw.match(/^([^.!?]{8,80}[.!?])\s+(.+)$/s);
  if (sentence) {
    return {
      n,
      title: sentence[1].replace(/[.!?]+$/, '').trim(),
      detail: sentence[2].trim()
    };
  }

  // Short single phrase → use as title; longer blob → Step N + full body
  if (raw.length <= 72 && !/[.!?].+/.test(raw)) {
    return { n, title: raw.replace(/[.!?]+$/, '').trim(), detail: '' };
  }
  return { n, title: `Step ${n}`, detail: raw };
}

/**
 * Journey-rail markup for Detailed User Flow (enriched + legacy + demo).
 * @param {string[]} steps
 * @param {{ heading?: boolean, headingHtml?: string }} [opts]
 */
export function renderDetailedUserFlowRail(steps, opts = {}) {
  if (!Array.isArray(steps) || !steps.length) return '';
  const includeHeading = opts.heading !== false;
  const headingHtml =
    opts.headingHtml ||
    '<h3 class="enriched-heading user-flow-rail-heading"><i class="fa fa-sitemap" aria-hidden="true"></i> Detailed User Flow</h3>';

  const parts = [];
  parts.push('<section class="content-section detailed-user-flow-section enriched-block">');
  if (includeHeading) parts.push(headingHtml);
  parts.push('<ol class="user-flow-rail" aria-label="Detailed user flow">');

  steps.forEach((step, i) => {
    const { n, title, detail } = parseFlowStep(step, i);
    const isLast = i === steps.length - 1;
    parts.push(`<li class="user-flow-rail-step${isLast ? ' is-last' : ''}">`);
    parts.push('<div class="user-flow-rail-track" aria-hidden="true">');
    parts.push(`<span class="user-flow-rail-node"><span class="user-flow-rail-index">${n}</span></span>`);
    if (!isLast) parts.push('<span class="user-flow-rail-line"></span>');
    parts.push('</div>');
    parts.push('<div class="user-flow-rail-content">');
    parts.push(`<h4 class="user-flow-rail-title">${esc(title)}</h4>`);
    if (detail) {
      parts.push(`<p class="user-flow-rail-detail">${esc(detail)}</p>`);
    }
    parts.push('</div></li>');
  });

  parts.push('</ol></section>');
  return parts.join('');
}

/**
 * Normalize overview field aliases so UI can render older / drifted payloads.
 * Mutates a shallow copy — does not mutate the original object deeply beyond arrays assigned.
 */
export function normalizeOverviewDisplayFields(overview) {
  if (!overview || typeof overview !== 'object') return overview;
  const o = { ...overview };

  // Legacy alias: coreFeatures → coreFeaturesOverview
  if (
    (!Array.isArray(o.coreFeaturesOverview) || o.coreFeaturesOverview.length === 0) &&
    Array.isArray(o.coreFeatures) &&
    o.coreFeatures.length
  ) {
    o.coreFeaturesOverview = o.coreFeatures.map((f) => {
      if (typeof f === 'string') return f;
      if (f && typeof f === 'object') {
        return [f.name, f.description].filter(Boolean).join(': ') || JSON.stringify(f);
      }
      return String(f ?? '');
    });
  }

  // Derive feature list from epics when coreFeaturesOverview is empty (broken enriched gens)
  if (
    (!Array.isArray(o.coreFeaturesOverview) || o.coreFeaturesOverview.length === 0) &&
    Array.isArray(o.epics) &&
    o.epics.length
  ) {
    o.coreFeaturesOverview = o.epics
      .map((e) => {
        if (!e || typeof e !== 'object') return '';
        const name = e.name || e.title || '';
        const desc = e.description || '';
        if (name && desc) return `${name}: ${desc}`;
        return name || desc;
      })
      .filter(Boolean);
  }

  // Coerce string features / object features
  if (Array.isArray(o.coreFeaturesOverview)) {
    o.coreFeaturesOverview = o.coreFeaturesOverview
      .map((f) => {
        if (typeof f === 'string') return f.trim();
        if (f && typeof f === 'object') {
          return [f.name, f.description || f.summary].filter(Boolean).join(': ');
        }
        return String(f ?? '').trim();
      })
      .filter(Boolean);
  }

  // screenDescriptions: accept top-level screens[] or screens as object map
  let screens = o.screenDescriptions?.screens;
  if ((!Array.isArray(screens) || screens.length === 0) && Array.isArray(o.screens)) {
    screens = o.screens;
  }
  if (Array.isArray(screens) && screens.length) {
    const normalizedScreens = screens
      .map((s, i) => {
        if (typeof s === 'string') {
          return {
            name: `Screen ${i + 1}`,
            description: s,
            uiComponents: [],
            emptyState: null,
            errorState: null,
            edgeCases: null
          };
        }
        if (!s || typeof s !== 'object') return null;
        return {
          name: s.name || s.title || `Screen ${i + 1}`,
          description: s.description || s.purpose || s.summary || '',
          uiComponents: Array.isArray(s.uiComponents)
            ? s.uiComponents
            : Array.isArray(s.components)
              ? s.components
              : [],
          emptyState: s.emptyState ?? null,
          errorState: s.errorState ?? null,
          edgeCases: Array.isArray(s.edgeCases) ? s.edgeCases : null
        };
      })
      .filter(Boolean);

    o.screenDescriptions = {
      ...(typeof o.screenDescriptions === 'object' && o.screenDescriptions ? o.screenDescriptions : {}),
      screens: normalizedScreens,
      navigationStructure:
        (o.screenDescriptions && o.screenDescriptions.navigationStructure) ||
        o.navigationStructure ||
        ''
    };
  }

  return o;
}

export function renderEnrichedOverview(overview) {
  if (!overview || typeof overview !== 'object') return '';
  const o = normalizeOverviewDisplayFields(overview);
  const parts = [];

  if (Array.isArray(o.personas) && o.personas.length) {
    parts.push('<section class="enriched-block enriched-personas">');
    parts.push('<h3 class="enriched-heading">Personas &amp; JTBD</h3>');
    parts.push('<div class="persona-card-grid">');
    o.personas.forEach((p) => {
      parts.push('<article class="persona-card">');
      parts.push(`<h4>${esc(p.name)}</h4>`);
      parts.push(`<p class="persona-role">${esc(p.role)}</p>`);
      parts.push(`<p class="persona-jtbd">${esc(p.jtbd)}</p>`);
      if (Array.isArray(p.goals) && p.goals.length) {
        parts.push('<ul class="persona-list">' + p.goals.map((g) => `<li>${esc(g)}</li>`).join('') + '</ul>');
      }
      if (Array.isArray(p.pains) && p.pains.length) {
        parts.push(
          '<ul class="persona-list persona-pains">' + p.pains.map((g) => `<li>${esc(g)}</li>`).join('') + '</ul>'
        );
      }
      parts.push('</article>');
    });
    parts.push('</div></section>');
  }

  // Detailed User Flow is rendered by formatJSONContent / demo narrative via
  // renderDetailedUserFlowRail to keep a single placement after Idea Summary.

  if (o.successMetrics) {
    parts.push('<section class="enriched-block enriched-kpis">');
    parts.push('<h3 class="enriched-heading">Success metrics</h3>');
    parts.push('<div class="kpi-tile-grid">');
    parts.push(
      `<div class="kpi-tile kpi-north"><span class="kpi-label">North star</span><span class="kpi-value">${esc(o.successMetrics.northStar)}</span></div>`
    );
    (o.successMetrics.leading || []).forEach((m) => {
      parts.push(
        `<div class="kpi-tile"><span class="kpi-label">Leading</span><span class="kpi-value">${esc(m)}</span></div>`
      );
    });
    parts.push('</div></section>');
  }

  if (Array.isArray(o.nonGoals) && o.nonGoals.length) {
    parts.push('<section class="enriched-block"><h3 class="enriched-heading">Non-goals</h3>');
    parts.push(
      '<div class="chip-list">' + o.nonGoals.map((n) => `<span class="chip chip-muted">${esc(n)}</span>`).join('') + '</div></section>'
    );
  }

  if (Array.isArray(o.epics) && o.epics.length) {
    parts.push('<section class="enriched-block enriched-stories"><h3 class="enriched-heading">Epics &amp; stories</h3>');
    o.epics.forEach((epic, ei) => {
      parts.push(`<details class="stories-accordion"${ei === 0 ? ' open' : ''}>`);
      parts.push(`<summary>${esc(epic.name)}</summary>`);
      parts.push(`<p>${esc(epic.description)}</p>`);
      (epic.stories || []).forEach((st) => {
        parts.push('<div class="story-card">');
        parts.push(`<h4>${esc(st.title)}</h4><p>${esc(st.description)}</p>`);
        parts.push('<ul class="ac-checklist">');
        (st.acceptanceCriteria || []).forEach((ac) => {
          parts.push(`<li><label><input type="checkbox" disabled> ${esc(ac)}</label></li>`);
        });
        parts.push('</ul></div>');
      });
      parts.push('</details>');
    });
    parts.push('</section>');
  }

  if (Array.isArray(o.permissionsMatrix) && o.permissionsMatrix.length) {
    parts.push('<section class="enriched-block"><h3 class="enriched-heading">Permissions</h3>');
    parts.push('<div class="permissions-matrix">');
    o.permissionsMatrix.forEach((row) => {
      parts.push('<div class="permissions-row">');
      parts.push(`<div class="permissions-role">${esc(row.role)}</div>`);
      parts.push(
        '<div class="permissions-cells">' +
          (row.permissions || []).map((p) => `<span class="chip">${esc(p)}</span>`).join('') +
          '</div></div>'
      );
    });
    parts.push('</div></section>');
  }

  if (Array.isArray(o.screenDescriptions?.screens)) {
    const screens = o.screenDescriptions.screens.filter(
      (s) => s && (s.emptyState || s.errorState || (s.edgeCases && s.edgeCases.length))
    );
    if (screens.length) {
      parts.push('<section class="enriched-block"><h3 class="enriched-heading">Screen states</h3>');
      parts.push('<div class="screen-state-grid">');
      screens.forEach((s) => {
        parts.push('<article class="screen-state-card">');
        parts.push(`<h4>${esc(s.name)}</h4>`);
        if (s.emptyState) parts.push(`<p><span class="state-chip state-empty">Empty</span> ${esc(s.emptyState)}</p>`);
        if (s.errorState) parts.push(`<p><span class="state-chip state-error">Error</span> ${esc(s.errorState)}</p>`);
        if (s.edgeCases?.length) {
          parts.push(
            '<p><span class="state-chip state-edge">Edge</span> ' + s.edgeCases.map(esc).join('; ') + '</p>'
          );
        }
        parts.push('</article>');
      });
      parts.push('</div></section>');
    }
  }

  if (Array.isArray(o.glossary) && o.glossary.length) {
    parts.push('<section class="enriched-block"><h3 class="enriched-heading">Glossary</h3><dl class="glossary-list">');
    o.glossary.forEach((g) => {
      parts.push(`<dt>${esc(g.term)}</dt><dd>${esc(g.definition)}</dd>`);
    });
    parts.push('</dl></section>');
  }

  if (!parts.length) return '';
  return `<div class="enriched-stage-block enriched-overview">${parts.join('')}</div>`;
}
