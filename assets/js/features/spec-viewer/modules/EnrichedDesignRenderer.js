/**
 * Visual-first Design tab: live palette, theme toggle, tokens.
 */

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseHex(hex) {
  if (!hex || typeof hex !== 'string') return null;
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function relLum({ r, g, b }) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(a, b) {
  const L1 = relLum(a);
  const L2 = relLum(b);
  const light = Math.max(L1, L2);
  const dark = Math.min(L1, L2);
  return (light + 0.05) / (dark + 0.05);
}

function contrastBadge(fgHex, bgHex) {
  const fg = parseHex(fgHex);
  const bg = parseHex(bgHex);
  if (!fg || !bg) return '<span class="contrast-badge contrast-unknown">—</span>';
  const ratio = contrastRatio(fg, bg);
  const label = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA large' : 'Fail';
  const cls = ratio >= 4.5 ? 'contrast-pass' : ratio >= 3 ? 'contrast-large' : 'contrast-fail';
  return `<span class="contrast-badge ${cls}" title="${ratio.toFixed(2)}:1">${label}</span>`;
}

export function renderEnrichedDesign(design) {
  if (!design || typeof design !== 'object') return '';
  const vsg = design.visualStyleGuide || {};
  const colors = vsg.colors || {};
  const parts = [];

  parts.push('<div class="enriched-stage-block enriched-design">');

  // Palette
  const entries = Object.entries(colors).filter(([, v]) => typeof v === 'string' && v.trim());
  if (entries.length) {
    const textColor = colors.text || '#111';
    const bgColor = colors.background || colors.surface || '#fff';
    parts.push('<section class="enriched-block"><h3 class="enriched-heading">Live palette</h3>');
    parts.push('<div class="design-palette-grid">');
    entries.forEach(([role, hex]) => {
      parts.push('<div class="design-swatch-card">');
      parts.push(`<div class="design-swatch" style="background:${esc(hex)}"></div>`);
      parts.push(`<div class="design-swatch-meta"><strong>${esc(role)}</strong><code>${esc(hex)}</code>`);
      parts.push(contrastBadge(role === 'background' || role === 'surface' ? textColor : hex, role === 'background' || role === 'surface' ? hex : bgColor));
      parts.push('</div></div>');
    });
    parts.push('</div></section>');
  }

  // Theme preview
  if (vsg.themes?.light) {
    const dark = vsg.themes.dark;
    parts.push('<section class="enriched-block"><h3 class="enriched-heading">Theme preview</h3>');
    parts.push('<div class="theme-preview-toolbar">');
    parts.push('<button type="button" class="theme-toggle-btn" data-theme-target="light">Light</button>');
    if (dark) parts.push('<button type="button" class="theme-toggle-btn" data-theme-target="dark">Dark</button>');
    parts.push('</div>');
    const L = vsg.themes.light;
    parts.push(
      `<div class="theme-preview-panel" data-theme-panel style="background:${esc(L.background)};color:${esc(L.text)};border-color:${esc(L.border || L.text)}">`
    );
    parts.push(
      `<div class="theme-preview-surface" style="background:${esc(L.surface)};border-color:${esc(L.border || 'transparent')}"><strong style="color:${esc(L.primary)}">Relay sample</strong><p style="color:${esc(L.textMuted || L.text)}">Inbox · Macros · Settings</p><button type="button" style="background:${esc(L.primary)};color:#fff;border:0;padding:8px 14px;border-radius:8px">Primary CTA</button></div>`
    );
    parts.push('</div>');
    if (dark) {
      parts.push(
        `<script type="application/json" class="theme-preview-data">${esc(JSON.stringify({ light: L, dark }))}</script>`
      );
    }
    parts.push('</section>');
  }

  // App icon
  const icon = design.logoIconography?.appIcon;
  if (icon?.letters) {
    parts.push('<section class="enriched-block"><h3 class="enriched-heading">App icon</h3>');
    parts.push(
      `<div class="app-icon-preview" style="background:${esc(icon.bgColor || '#333')}"><span>${esc(icon.letters)}</span></div>`
    );
    if (icon.description) parts.push(`<p>${esc(icon.description)}</p>`);
    parts.push('</section>');
  }

  // Component gallery
  if (Array.isArray(design.componentInventory) && design.componentInventory.length) {
    parts.push('<section class="enriched-block"><h3 class="enriched-heading">Component inventory</h3>');
    parts.push('<div class="component-gallery">');
    design.componentInventory.forEach((c) => {
      parts.push('<article class="component-card">');
      parts.push(`<h4>${esc(c.name)}</h4>`);
      parts.push(
        '<div class="chip-list">' +
          (c.variants || []).map((v) => `<span class="chip">${esc(v)}</span>`).join('') +
          '</div>'
      );
      parts.push(
        '<div class="chip-list">' +
          (c.states || []).map((v) => `<span class="chip chip-muted">${esc(v)}</span>`).join('') +
          '</div>'
      );
      if (c.a11yChecklist?.length) {
        parts.push('<ul class="ac-checklist">' + c.a11yChecklist.map((a) => `<li>${esc(a)}</li>`).join('') + '</ul>');
      }
      parts.push('</article>');
    });
    parts.push('</div></section>');
  }

  // Narrative style notes (once — replaces legacy "Visual Style Guide" block)
  const noteBits = [];
  if (vsg.colorHarmony) noteBits.push(`<p><strong>Color harmony</strong> ${esc(vsg.colorHarmony)}</p>`);
  if (vsg.colorReasoning) noteBits.push(`<p><strong>Color reasoning</strong> ${esc(vsg.colorReasoning)}</p>`);
  if (vsg.typography) {
    const t = vsg.typography;
    if (typeof t === 'string' && t.trim()) {
      noteBits.push(`<p><strong>Typography</strong> ${esc(t)}</p>`);
    } else if (t && typeof t === 'object') {
      const lines = ['headings', 'body', 'captions', 'display', 'h1', 'h2', 'bodyMd']
        .map((k) => {
          const v = t[k];
          if (!v) return '';
          if (typeof v === 'string') return `<li><strong>${esc(k)}:</strong> ${esc(v)}</li>`;
          if (typeof v === 'object' && v.fontFamily) {
            return `<li><strong>${esc(k)}:</strong> ${esc(v.fontFamily)}${v.fontSize ? ` · ${esc(v.fontSize)}` : ''}${v.fontWeight ? ` · ${esc(v.fontWeight)}` : ''}</li>`;
          }
          return '';
        })
        .filter(Boolean);
      if (lines.length) noteBits.push(`<p><strong>Typography</strong></p><ul>${lines.join('')}</ul>`);
    }
  }
  if (vsg.spacing) noteBits.push(`<p><strong>Spacing</strong> ${esc(typeof vsg.spacing === 'string' ? vsg.spacing : JSON.stringify(vsg.spacing))}</p>`);
  if (vsg.buttons) noteBits.push(`<p><strong>Buttons</strong> ${esc(vsg.buttons)}</p>`);
  if (vsg.animations) noteBits.push(`<p><strong>Animations</strong> ${esc(vsg.animations)}</p>`);
  if (noteBits.length) {
    parts.push('<section class="enriched-block"><h3 class="enriched-heading">Style notes</h3>');
    parts.push(noteBits.join(''));
    parts.push('</section>');
  }

  parts.push('</div>');
  return parts.join('');
}

export function bindEnrichedDesignInteractions(container) {
  if (!container) return;
  const dataEl = container.querySelector('.theme-preview-data');
  let themes = null;
  try {
    themes = dataEl ? JSON.parse(dataEl.textContent) : null;
  } catch (_) {
    themes = null;
  }
  const panel = container.querySelector('[data-theme-panel]');
  container.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-theme-target');
      const t = themes?.[key];
      if (!t || !panel) return;
      panel.style.background = t.background;
      panel.style.color = t.text;
      panel.style.borderColor = t.border || t.text;
      const surface = panel.querySelector('.theme-preview-surface');
      if (surface) {
        surface.style.background = t.surface;
        surface.style.borderColor = t.border || 'transparent';
        const strong = surface.querySelector('strong');
        if (strong) strong.style.color = t.primary;
        const p = surface.querySelector('p');
        if (p) p.style.color = t.textMuted || t.text;
        const cta = surface.querySelector('button');
        if (cta) cta.style.background = t.primary;
      }
    });
  });
  container.querySelectorAll('.copy-code-btn').forEach((btn) => {
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
