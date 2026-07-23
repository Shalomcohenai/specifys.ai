/**
 * Enriched renderers for Technical, Market, Visibility, and Prompts stages.
 */

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderEnrichedTechnical(technical) {
  if (!technical || typeof technical !== 'object') return '';
  const parts = ['<div class="enriched-stage-block enriched-technical">'];

  if (technical.techStack) {
    parts.push('<section class="enriched-block"><h3 class="enriched-heading">Stack</h3><div class="stack-badge-row">');
    Object.entries(technical.techStack).forEach(([k, v]) => {
      if (!v) return;
      parts.push(`<span class="stack-badge"><strong>${esc(k)}</strong> ${esc(v)}</span>`);
    });
    parts.push('</div></section>');
  }

  // Security critical points render once under Security & Authentication in formatJSONContent.

  if (technical.apiDesign?.endpoints?.length) {
    parts.push('<section class="enriched-block"><h3 class="enriched-heading">API contracts</h3><div class="api-table">');
    technical.apiDesign.endpoints.forEach((ep) => {
      const method = String(ep.method || 'GET').toUpperCase();
      parts.push('<div class="api-row">');
      parts.push(`<span class="method-badge method-${esc(method.toLowerCase())}">${esc(method)}</span>`);
      parts.push(`<code class="api-path">${esc(ep.path)}</code>`);
      parts.push(`<span class="api-desc">${esc(ep.description)}</span>`);
      if (ep.authScope || ep.rateLimit || ep.idempotency) {
        parts.push('<div class="api-meta">');
        if (ep.authScope) parts.push(`<span class="chip">auth: ${esc(ep.authScope)}</span>`);
        if (ep.rateLimit) parts.push(`<span class="chip">rate: ${esc(ep.rateLimit)}</span>`);
        if (ep.idempotency) parts.push(`<span class="chip">idempotent</span>`);
        parts.push('</div>');
      }
      if (ep.errorResponses) parts.push(`<p class="api-errors">${esc(ep.errorResponses)}</p>`);
      parts.push('</div>');
    });
    parts.push('</div></section>');
  }

  if (technical.performanceBudgets || technical.mvpCostModel) {
    parts.push('<section class="enriched-block"><h3 class="enriched-heading">Budgets &amp; cost</h3><div class="kpi-tile-grid">');
    const pb = technical.performanceBudgets;
    if (pb) {
      if (pb.lcpMs != null) parts.push(`<div class="kpi-tile"><span class="kpi-label">LCP</span><span class="kpi-value">${esc(pb.lcpMs)}ms</span></div>`);
      if (pb.inpMs != null) parts.push(`<div class="kpi-tile"><span class="kpi-label">INP</span><span class="kpi-value">${esc(pb.inpMs)}ms</span></div>`);
      if (pb.apiP95Ms != null) parts.push(`<div class="kpi-tile"><span class="kpi-label">API p95</span><span class="kpi-value">${esc(pb.apiP95Ms)}ms</span></div>`);
    }
    if (technical.mvpCostModel?.monthlyEstimateUsd != null) {
      parts.push(
        `<div class="kpi-tile"><span class="kpi-label">MVP $/mo (est.)</span><span class="kpi-value">$${esc(technical.mvpCostModel.monthlyEstimateUsd)}</span></div>`
      );
    }
    parts.push('</div></section>');
  }

  if (Array.isArray(technical.envSecrets) && technical.envSecrets.length) {
    parts.push('<section class="enriched-block"><h3 class="enriched-heading">Env / secrets</h3><ul class="env-secret-list">');
    technical.envSecrets.forEach((e) => {
      parts.push(
        `<li><code>${esc(e.name)}</code> ${e.required ? '<span class="chip">required</span>' : ''} — ${esc(e.purpose)}</li>`
      );
    });
    parts.push('</ul></section>');
  }

  parts.push('</div>');
  return parts.length > 2 ? parts.join('') : '';
}

export function renderEnrichedMarket(market) {
  if (!market || typeof market !== 'object') return '';
  const parts = ['<div class="enriched-stage-block enriched-market">'];

  if (market.swotAnalysis) {
    const s = market.swotAnalysis;
    parts.push('<section class="enriched-block"><h3 class="enriched-heading">SWOT</h3><div class="swot-grid">');
    [
      ['Strengths', s.strengths],
      ['Weaknesses', s.weaknesses],
      ['Opportunities', s.opportunities],
      ['Threats', s.threats]
    ].forEach(([label, items]) => {
      parts.push(`<div class="swot-cell"><h4>${esc(label)}</h4><ul>${(items || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`);
    });
    parts.push('</div></section>');
  }

  if (Array.isArray(market.competitiveLandscape) && market.competitiveLandscape.length) {
    parts.push('<section class="enriched-block"><h3 class="enriched-heading">Competitor matrix</h3>');
    parts.push('<div class="competitor-matrix">');
    market.competitiveLandscape.forEach((c) => {
      parts.push('<article class="competitor-card">');
      parts.push(`<h4>${esc(c.name)}</h4>`);
      if (c.pricingSummary) parts.push(`<p class="comp-pricing">${esc(c.pricingSummary)}</p>`);
      if (c.featureGapVsUs?.length) {
        parts.push('<p><strong>Gap vs us</strong></p><ul>' + c.featureGapVsUs.map((g) => `<li>${esc(g)}</li>`).join('') + '</ul>');
      }
      parts.push(`<p>${esc(c.advantages)}</p><p class="comp-weak">${esc(c.disadvantages)}</p>`);
      parts.push('</article>');
    });
    parts.push('</div></section>');
  }

  if (Array.isArray(market.icpScorecard) && market.icpScorecard.length) {
    parts.push('<section class="enriched-block"><h3 class="enriched-heading">ICP scorecard</h3>');
    market.icpScorecard.forEach((row) => {
      const score = Number(row.score) || 0;
      const pct = Math.max(0, Math.min(100, score * 10));
      parts.push('<div class="score-bar-row">');
      parts.push(`<span class="score-label">${esc(row.criterion)}</span>`);
      parts.push(`<div class="score-bar"><div class="score-bar-fill" style="width:${pct}%"></div></div>`);
      parts.push(`<span class="score-num">${esc(score)}</span></div>`);
    });
    parts.push('</section>');
  }

  if (Array.isArray(market.gtmPlan) && market.gtmPlan.length) {
    parts.push('<section class="enriched-block"><h3 class="enriched-heading">GTM 30 / 60 / 90</h3><div class="gtm-timeline">');
    market.gtmPlan.forEach((phase) => {
      parts.push('<div class="gtm-phase">');
      parts.push(`<div class="gtm-days">${esc(phase.days)}</div>`);
      parts.push('<ul>' + (phase.goals || []).map((g) => `<li>${esc(g)}</li>`).join('') + '</ul>');
      parts.push('</div>');
    });
    parts.push('</div></section>');
  }

  if (market.monetizationModel) {
    const m = market.monetizationModel;
    parts.push('<section class="enriched-block"><h3 class="enriched-heading">Pricing rationale</h3>');
    if (m.pricingStrategy) parts.push(`<p>${esc(m.pricingStrategy)}</p>`);
    if (m.methodology) parts.push(`<p class="method-note"><strong>Methodology</strong> ${esc(m.methodology)}</p>`);
    parts.push('</section>');
  }

  if (market.positioningOnePager) {
    parts.push(
      `<section class="enriched-block"><h3 class="enriched-heading">Positioning</h3><p class="positioning-onepager">${esc(market.positioningOnePager)}</p></section>`
    );
  }

  if (Array.isArray(market.disqualificationCriteria) && market.disqualificationCriteria.length) {
    parts.push(
      '<section class="enriched-block"><h3 class="enriched-heading">Disqualify</h3><div class="chip-list">' +
        market.disqualificationCriteria.map((d) => `<span class="chip chip-muted">${esc(d)}</span>`).join('') +
        '</div></section>'
    );
  }

  parts.push('</div>');
  return parts.length > 2 ? parts.join('') : '';
}

export function renderEnrichedVisibility(visibility) {
  if (!visibility || typeof visibility !== 'object') return '';
  const parts = ['<div class="enriched-stage-block enriched-visibility">'];

  const topics = visibility.seoFoundation?.pillarTopics || [];
  if (topics.length) {
    parts.push(
      '<section class="enriched-block"><h3 class="enriched-heading">Pillar topics</h3><div class="chip-list">' +
        topics.map((t) => `<span class="chip">${esc(t)}</span>`).join('') +
        '</div></section>'
    );
  }

  const cal = visibility.contentEngine?.contentCalendar;
  if (Array.isArray(cal) && cal.length) {
    parts.push('<section class="enriched-block"><h3 class="enriched-heading">Content calendar</h3><div class="calendar-grid">');
    cal.forEach((item) => {
      parts.push(
        `<div class="calendar-cell"><span class="cal-week">${esc(item.week)}</span><span class="cal-channel">${esc(item.channel)}</span><span>${esc(item.topic)}</span></div>`
      );
    });
    parts.push('</div></section>');
  }

  const checklist = [
    ...(visibility.launchChecklist || []),
    ...(visibility.technicalSeoChecklist || [])
  ];
  if (checklist.length) {
    const done = 0;
    const pct = Math.round((done / checklist.length) * 100);
    parts.push('<section class="enriched-block"><h3 class="enriched-heading">Checklist</h3>');
    parts.push(`<div class="checklist-progress"><div class="checklist-fill" style="width:${pct}%"></div></div>`);
    parts.push('<ul class="ac-checklist">');
    checklist.forEach((c) => parts.push(`<li><label><input type="checkbox" disabled> ${esc(c)}</label></li>`));
    parts.push('</ul></section>');
  }

  const geo = visibility.geoReadiness || {};
  if (geo.llmsTxt || geo.jsonLd || geo.aiInfoTxt) {
    parts.push('<section class="enriched-block"><h3 class="enriched-heading">Paste-ready assets</h3>');
    [
      ['llms.txt', geo.llmsTxt, 'llms'],
      ['ai.txt', geo.aiInfoTxt, 'ai'],
      ['JSON-LD', geo.jsonLd, 'jsonld']
    ].forEach(([label, body, id]) => {
      if (!body) return;
      parts.push(`<div class="code-panel"><div class="code-panel-bar"><span>${esc(label)}</span><button type="button" class="copy-code-btn" data-copy-target="${id}">Copy</button></div>`);
      parts.push(`<pre class="code-panel-body" data-copy-id="${id}">${esc(body)}</pre></div>`);
    });
    parts.push('</section>');
  }

  parts.push('</div>');
  return parts.length > 2 ? parts.join('') : '';
}

export function renderEnrichedPrompts(prompts) {
  if (!prompts || typeof prompts !== 'object') return '';
  const full = prompts.fullPrompt || '';
  if (!full) return '';

  const stageBlocks = full.split(/═{10,}/).filter((b) => /STAGE\s+\d+/i.test(b) || /## Goal/i.test(b));
  const tickets = [];
  const stageHeaderRe = /STAGE\s+(\d+)\s*:\s*([^\n]+)/i;
  let current = null;
  full.split('\n').forEach((line) => {
    const hm = line.match(stageHeaderRe);
    if (hm) {
      if (current) tickets.push(current);
      current = { num: hm[1], name: hm[2].trim(), body: '' };
      return;
    }
    if (current) current.body += line + '\n';
  });
  if (current) tickets.push(current);

  if (!tickets.length && stageBlocks.length) {
    // fallback single card
    tickets.push({ num: '1', name: 'Development prompts', body: full.slice(0, 4000) });
  }

  if (!tickets.length) return '';

  const parts = ['<div class="enriched-stage-block enriched-prompts">'];
  parts.push('<div class="prompt-pipeline-stepper">');
  tickets.forEach((t, i) => {
    parts.push(`<div class="pipeline-step${i === 0 ? ' is-active' : ''}"><span class="pipeline-num">${esc(t.num)}</span><span>${esc(t.name)}</span></div>`);
  });
  parts.push('</div>');

  tickets.forEach((t) => {
    const goal = (t.body.match(/## Goal\n([\s\S]*?)(?=\n## |$)/i) || [])[1]?.trim();
    const acBlock = (t.body.match(/## Acceptance criteria\n([\s\S]*?)(?=\n## |$)/i) || [])[1] || '';
    const acLines = acBlock
      .split('\n')
      .map((l) => l.replace(/^[-*]\s*\[[ xX]?\]\s*/, '').replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);
    const files = (t.body.match(/## Files to create\n([\s\S]*?)(?=\n## |$)/i) || [])[1] || '';
    const fileChips = files
      .split('\n')
      .map((l) => l.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);

    parts.push('<article class="prompt-ticket-card">');
    parts.push(`<header><span class="pipeline-num">${esc(t.num)}</span><h4>${esc(t.name)}</h4></header>`);
    if (goal) parts.push(`<p class="ticket-goal">${esc(goal)}</p>`);
    if (fileChips.length) {
      parts.push('<div class="chip-list">' + fileChips.slice(0, 8).map((f) => `<span class="chip chip-file">${esc(f)}</span>`).join('') + '</div>');
    }
    if (acLines.length) {
      parts.push('<ul class="ac-checklist">');
      acLines.slice(0, 8).forEach((ac) => parts.push(`<li><label><input type="checkbox" disabled> ${esc(ac)}</label></li>`));
      parts.push('</ul>');
    }
    const hasVariants = /Variant:\s*Build/i.test(t.body);
    if (hasVariants) {
      parts.push('<div class="ticket-variants"><span class="chip">Build</span><span class="chip">Review</span><span class="chip">Tests</span></div>');
    }
    parts.push('</article>');
  });

  parts.push('</div>');
  return parts.join('');
}

export function bindCopyButtons(container) {
  if (!container) return;
  container.querySelectorAll('.copy-code-btn').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-copy-target');
      const pre = container.querySelector(`[data-copy-id="${id}"]`);
      if (!pre) return;
      try {
        await navigator.clipboard.writeText(pre.textContent || '');
        btn.textContent = 'Copied';
        setTimeout(() => {
          btn.textContent = 'Copy';
        }, 1500);
      } catch (_) {
        btn.textContent = 'Failed';
      }
    });
  });
}
