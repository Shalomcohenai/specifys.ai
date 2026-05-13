/**
 * Brand View - Brand kit / press kit
 *
 * Renders the Specifys.AI logos (icon-mark, wordmark, lockups) in every
 * approved color combination from the design system. Each variation can be
 * downloaded as PNG (multiple sizes), as SVG, or copied to the clipboard as
 * SVG markup / data URI.
 *
 * Everything is generated client-side from a single SVG source per logo type,
 * so adding a new variation or size is trivial.
 */

import { helpers } from '../utils/helpers.js';

// ============================================================================
// Design tokens
// ============================================================================

const TOKENS = {
  orange: '#FF6B35',
  orangeLight: '#FF8551',
  cream: '#FFF4F0',
  white: '#FFFFFF',
  gray50: '#F5F5F5',
  gray100: '#E9ECEF',
  gray400: '#999999',
  gray700: '#666666',
  gray900: '#333333',
  black: '#000000',
  transparent: 'transparent'
};

// Color variations. `bg` may be 'transparent' which means no rect/background is drawn.
// `dot` controls the colour of the period in the wordmark.
const VARIATIONS = [
  { id: 'orange-on-white',         label: 'Orange / White',           fg: TOKENS.orange,  bg: TOKENS.white,        dot: TOKENS.orange, theme: 'light' },
  { id: 'white-on-orange',         label: 'White / Orange',           fg: TOKENS.white,   bg: TOKENS.orange,       dot: TOKENS.white,  theme: 'dark'  },
  { id: 'orange-on-cream',         label: 'Orange / Cream',           fg: TOKENS.orange,  bg: TOKENS.cream,        dot: TOKENS.orange, theme: 'light' },
  { id: 'white-on-light-orange',   label: 'White / Light Orange',     fg: TOKENS.white,   bg: TOKENS.orangeLight,  dot: TOKENS.white,  theme: 'dark'  },
  { id: 'orange-on-dark',          label: 'Orange / Dark Gray',       fg: TOKENS.orange,  bg: TOKENS.gray900,      dot: TOKENS.orange, theme: 'dark'  },
  { id: 'white-on-dark',           label: 'White / Dark Gray',        fg: TOKENS.white,   bg: TOKENS.gray900,      dot: TOKENS.orange, theme: 'dark'  },
  { id: 'orange-on-black',         label: 'Orange / Black',           fg: TOKENS.orange,  bg: TOKENS.black,        dot: TOKENS.orange, theme: 'dark'  },
  { id: 'white-on-black',          label: 'White / Black',            fg: TOKENS.white,   bg: TOKENS.black,        dot: TOKENS.orange, theme: 'dark'  },
  { id: 'dark-on-white',           label: 'Dark Gray / White',        fg: TOKENS.gray900, bg: TOKENS.white,        dot: TOKENS.orange, theme: 'light' },
  { id: 'dark-on-light-gray',      label: 'Dark Gray / Light Gray',   fg: TOKENS.gray900, bg: TOKENS.gray50,       dot: TOKENS.orange, theme: 'light' },
  { id: 'black-on-white',          label: 'Black / White (mono)',     fg: TOKENS.black,   bg: TOKENS.white,        dot: TOKENS.black,  theme: 'light' },
  { id: 'gray-on-white',           label: 'Muted Gray / White',       fg: TOKENS.gray700, bg: TOKENS.white,        dot: TOKENS.orange, theme: 'light' },
  { id: 'gray-on-cream',           label: 'Muted Gray / Cream',       fg: TOKENS.gray700, bg: TOKENS.cream,        dot: TOKENS.orange, theme: 'light' },
  { id: 'orange-on-transparent',   label: 'Orange / Transparent',     fg: TOKENS.orange,  bg: TOKENS.transparent,  dot: TOKENS.orange, theme: 'light' },
  { id: 'white-on-transparent',    label: 'White / Transparent',      fg: TOKENS.white,   bg: TOKENS.transparent,  dot: TOKENS.orange, theme: 'dark'  },
  { id: 'dark-on-transparent',     label: 'Dark Gray / Transparent',  fg: TOKENS.gray900, bg: TOKENS.transparent,  dot: TOKENS.orange, theme: 'light' },
  { id: 'black-on-transparent',    label: 'Black / Transparent',      fg: TOKENS.black,   bg: TOKENS.transparent,  dot: TOKENS.black,  theme: 'light' }
];

const ICON_SIZES     = [32, 64, 128, 256, 512, 1024, 2048];
const WORDMARK_WIDTHS = [320, 640, 1280, 2560];
const LOCKUP_WIDTHS  = [480, 960, 1920, 3840];

// ============================================================================
// SVG generators
// ============================================================================

// Brand font stack used in every SVG. Inter is already loaded by the dashboard, so it renders
// consistently both in-page and when the SVG is rasterised through Canvas.
const BRAND_FONT_STACK = "'Inter', 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

/**
 * Build the rounded-square S icon. viewBox is 100x100. The squircle has 22% corner radius
 * (Apple-style soft icon). The "S" itself is rendered as text so it matches the website typeface.
 */
function buildIconMarkSvg({ fg, bg, width = 512, includeBg = true }) {
  const w = width;
  const h = width;
  const bgRect = (bg !== TOKENS.transparent && includeBg)
    ? `<rect width="100" height="100" rx="22" ry="22" fill="${bg}"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet">
  ${bgRect}
  <text x="50" y="52" text-anchor="middle" dominant-baseline="central"
        font-family="${BRAND_FONT_STACK}"
        font-size="78" font-weight="900" letter-spacing="-3" fill="${fg}">S</text>
</svg>`;
}

/**
 * Build the Specifys.AI wordmark. The dot in the middle gets its own colour.
 * viewBox is 400x100 (4:1 ratio).
 */
function buildWordmarkSvg({ fg, bg, dot, width = 1280, label = 'Specifys.AI' }) {
  const ratio = 4;
  const height = Math.round(width / ratio);
  const bgRect = (bg !== TOKENS.transparent)
    ? `<rect width="400" height="100" fill="${bg}"/>`
    : '';

  const dotIndex = label.indexOf('.');
  const left  = dotIndex >= 0 ? label.slice(0, dotIndex)  : label;
  const right = dotIndex >= 0 ? label.slice(dotIndex + 1) : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet">
  ${bgRect}
  <text x="200" y="52" text-anchor="middle" dominant-baseline="central"
        font-family="${BRAND_FONT_STACK}"
        font-size="56" font-weight="800" letter-spacing="-1">
    <tspan fill="${fg}">${escapeXml(left)}</tspan>${dotIndex >= 0 ? `<tspan fill="${dot}">.</tspan><tspan fill="${fg}">${escapeXml(right)}</tspan>` : ''}
  </text>
</svg>`;
}

/**
 * Pick a fill colour for the inner squircle inside a lockup. The squircle always exists
 * (the user explicitly asked for the "S inside a rounded square") regardless of the
 * surrounding background. Choose a sensible default that contrasts with the lockup bg.
 */
function lockupIconColors({ fg, bg }) {
  // Variation already has the orange palette baked in — re-use the same logic the
  // standalone icon would have: if fg is orange-ish, keep orange squircle + white S.
  // If bg is white/cream, orange squircle + white S. If bg is dark, orange squircle + white S.
  // The squircle stays orange because that's our brand mark — except for monochrome variations.
  const isMonoBlack = fg === TOKENS.black && bg === TOKENS.white;
  const isMonoWhite = fg === TOKENS.white && bg === TOKENS.black;
  const isMonoGray  = fg === TOKENS.gray700 || fg === TOKENS.gray900;

  if (isMonoBlack) return { iconBg: TOKENS.black, iconFg: TOKENS.white };
  if (isMonoWhite) return { iconBg: TOKENS.white, iconFg: TOKENS.black };
  if (isMonoGray && bg !== TOKENS.transparent && bg !== TOKENS.gray900 && bg !== TOKENS.black) {
    return { iconBg: fg, iconFg: bg === TOKENS.transparent ? TOKENS.white : bg };
  }
  // Default brand mark: orange squircle, white S.
  return { iconBg: TOKENS.orange, iconFg: TOKENS.white };
}

/**
 * Horizontal lockup: icon-mark on the left + wordmark on the right.
 * viewBox is 480x100. Lets users grab a "header logo" with the squircle next to the word.
 */
function buildLockupSvg({ fg, bg, dot, width = 960, label = 'Specifys.AI' }) {
  const ratio = 4.8;
  const height = Math.round(width / ratio);
  const bgRect = (bg !== TOKENS.transparent)
    ? `<rect width="480" height="100" fill="${bg}"/>`
    : '';

  const { iconBg, iconFg } = lockupIconColors({ fg, bg });

  const dotIndex = label.indexOf('.');
  const left  = dotIndex >= 0 ? label.slice(0, dotIndex)  : label;
  const right = dotIndex >= 0 ? label.slice(dotIndex + 1) : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 100" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet">
  ${bgRect}
  <g>
    <rect x="0" y="0" width="100" height="100" rx="22" ry="22" fill="${iconBg}"/>
    <text x="50" y="52" text-anchor="middle" dominant-baseline="central"
          font-family="${BRAND_FONT_STACK}"
          font-size="78" font-weight="900" letter-spacing="-3" fill="${iconFg}">S</text>
  </g>
  <text x="120" y="52" text-anchor="start" dominant-baseline="central"
        font-family="${BRAND_FONT_STACK}"
        font-size="56" font-weight="800" letter-spacing="-1">
    <tspan fill="${fg}">${escapeXml(left)}</tspan>${dotIndex >= 0 ? `<tspan fill="${dot}">.</tspan><tspan fill="${fg}">${escapeXml(right)}</tspan>` : ''}
  </text>
</svg>`;
}

/**
 * Stacked lockup: icon-mark on top + wordmark below. Good for square-ish placements.
 * viewBox is 400x300.
 */
function buildStackedLockupSvg({ fg, bg, dot, width = 600, label = 'Specifys.AI' }) {
  const ratio = 4 / 3;
  const height = Math.round(width / ratio);
  const bgRect = (bg !== TOKENS.transparent)
    ? `<rect width="400" height="300" fill="${bg}"/>`
    : '';

  const { iconBg, iconFg } = lockupIconColors({ fg, bg });

  const dotIndex = label.indexOf('.');
  const left  = dotIndex >= 0 ? label.slice(0, dotIndex)  : label;
  const right = dotIndex >= 0 ? label.slice(dotIndex + 1) : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet">
  ${bgRect}
  <g transform="translate(150 30)">
    <rect width="100" height="100" rx="22" ry="22" fill="${iconBg}"/>
    <text x="50" y="52" text-anchor="middle" dominant-baseline="central"
          font-family="${BRAND_FONT_STACK}"
          font-size="78" font-weight="900" letter-spacing="-3" fill="${iconFg}">S</text>
  </g>
  <text x="200" y="210" text-anchor="middle" dominant-baseline="central"
        font-family="${BRAND_FONT_STACK}"
        font-size="58" font-weight="800" letter-spacing="-1">
    <tspan fill="${fg}">${escapeXml(left)}</tspan>${dotIndex >= 0 ? `<tspan fill="${dot}">.</tspan><tspan fill="${fg}">${escapeXml(right)}</tspan>` : ''}
  </text>
</svg>`;
}

// ============================================================================
// Asset types — what's renderable on this page
// ============================================================================

const ASSET_TYPES = [
  {
    id: 'icon-mark',
    title: 'Icon Mark',
    description: 'Square logomark — the rounded-square S. Use for app icons, favicons, and avatars.',
    aspectRatio: '1 / 1',
    build: (v, opts = {}) => buildIconMarkSvg({ fg: v.fg, bg: v.bg, width: opts.width || 512 }),
    sizes: ICON_SIZES.map(s => ({ label: `${s}×${s}`, width: s, height: s })),
    defaultSize: 512
  },
  {
    id: 'wordmark',
    title: 'Wordmark',
    description: 'Text logo — "Specifys.AI" with the brand dot. Use in horizontal layouts and footers.',
    aspectRatio: '4 / 1',
    build: (v, opts = {}) => buildWordmarkSvg({ fg: v.fg, bg: v.bg, dot: v.dot, width: 400, ...opts }),
    sizes: WORDMARK_WIDTHS.map(w => ({ label: `${w}×${Math.round(w / 4)}`, width: w, height: Math.round(w / 4) })),
    defaultSize: 1280
  },
  {
    id: 'wordmark-lower',
    title: 'Wordmark (lowercase)',
    description: 'Lowercase version of the wordmark — matches the URL casing ("specifys.ai").',
    aspectRatio: '4 / 1',
    build: (v, opts = {}) => buildWordmarkSvg({ fg: v.fg, bg: v.bg, dot: v.dot, width: 400, label: 'specifys.ai', ...opts }),
    sizes: WORDMARK_WIDTHS.map(w => ({ label: `${w}×${Math.round(w / 4)}`, width: w, height: Math.round(w / 4) })),
    defaultSize: 1280
  },
  {
    id: 'lockup-horizontal',
    title: 'Horizontal Lockup',
    description: 'Icon + wordmark, side by side. The header-style logo for use in wide banners.',
    aspectRatio: '4.8 / 1',
    build: (v, opts = {}) => buildLockupSvg({ fg: v.fg, bg: v.bg, dot: v.dot, width: 480, ...opts }),
    sizes: LOCKUP_WIDTHS.map(w => ({ label: `${w}×${Math.round(w / 4.8)}`, width: w, height: Math.round(w / 4.8) })),
    defaultSize: 1920
  },
  {
    id: 'lockup-stacked',
    title: 'Stacked Lockup',
    description: 'Icon above the wordmark. Best for square-ish placements (Instagram, business cards).',
    aspectRatio: '4 / 3',
    build: (v, opts = {}) => buildStackedLockupSvg({ fg: v.fg, bg: v.bg, dot: v.dot, width: 400, ...opts }),
    sizes: [
      { label: '400×300', width: 400,  height: 300  },
      { label: '800×600', width: 800,  height: 600  },
      { label: '1600×1200', width: 1600, height: 1200 },
      { label: '3200×2400', width: 3200, height: 2400 }
    ],
    defaultSize: 1600
  }
];

// ============================================================================
// Utils
// ============================================================================

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

/**
 * Rasterize an SVG string to a PNG Blob at exact pixel dimensions.
 */
async function svgToPngBlob(svgString, targetWidth, targetHeight) {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = (e) => reject(new Error('Failed to load SVG into image element'));
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    // Preserve transparency for transparent variations
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('[BrandView] Clipboard error:', err);
    return false;
  }
}

function svgToDataUri(svgString) {
  // Use base64 to avoid URL-encoding quirks across consumers (e.g. CSS).
  const b64 = btoa(unescape(encodeURIComponent(svgString)));
  return `data:image/svg+xml;base64,${b64}`;
}

// ============================================================================
// View
// ============================================================================

export class BrandView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.rendered = false;
    this.rootSelector = '#brand-section';
    this.backdrop = 'auto';          // 'auto' | 'light' | 'dark' (for transparent backgrounds preview)
    this.activeAssetId = ASSET_TYPES[0].id;
  }

  show() {
    if (!this.rendered) {
      this.render();
      this.rendered = true;
    }
  }

  update() { /* no-op — brand view is static */ }

  // ============================================================
  // Render
  // ============================================================

  render() {
    const root = helpers.dom(this.rootSelector);
    if (!root) return;

    root.innerHTML = this.renderHeader() + this.renderTypeTabs() + this.renderGrids();

    this.attachListeners(root);
    this.applyBackdrop(root);
    this.showActiveAsset(root);
  }

  renderHeader() {
    return `
      <div class="section-header-modern">
        <div>
          <h1>Brand Kit</h1>
          <p>Logos, wordmarks and lockups in the system palette — ready to drop into press releases, social posts, Product Hunt launches, and partner pages.</p>
        </div>
        <div class="header-actions brand-toolbar">
          <div class="brand-toolbar-group" role="group" aria-label="Preview backdrop for transparent variations">
            <span class="brand-toolbar-label">Transparent preview on:</span>
            <button class="brand-backdrop-btn" data-backdrop="auto"  type="button" aria-pressed="true">Auto</button>
            <button class="brand-backdrop-btn" data-backdrop="light" type="button" aria-pressed="false">Light</button>
            <button class="brand-backdrop-btn" data-backdrop="dark"  type="button" aria-pressed="false">Dark</button>
          </div>
        </div>
      </div>
    `;
  }

  renderTypeTabs() {
    const buttons = ASSET_TYPES.map((t, i) => `
      <button class="payments-tab ${i === 0 ? 'active' : ''}" data-brand-asset="${t.id}" type="button">
        <span>${escapeHtml(t.title)}</span>
      </button>
    `).join('');
    return `<div class="payments-tabs brand-type-tabs">${buttons}</div>`;
  }

  renderGrids() {
    return ASSET_TYPES.map(asset => `
      <div class="brand-asset-pane" data-brand-pane="${asset.id}" hidden>
        <div class="brand-asset-intro">
          <h2>${escapeHtml(asset.title)}</h2>
          <p>${escapeHtml(asset.description)}</p>
        </div>
        <div class="brand-grid">
          ${VARIATIONS.map(v => this.renderCard(asset, v)).join('')}
        </div>
      </div>
    `).join('');
  }

  renderCard(asset, variation) {
    const svgPreview = asset.build(variation, { width: 480 });
    const defaultSize = asset.defaultSize;
    const defaultDim = asset.sizes.find(s => s.width === defaultSize) || asset.sizes[asset.sizes.length - 1];

    const sizeOptions = asset.sizes.map(s =>
      `<option value="${s.width}x${s.height}" ${s.width === defaultDim.width ? 'selected' : ''}>${escapeHtml(s.label)} px</option>`
    ).join('');

    const cardId = `brand-card-${asset.id}-${variation.id}`;
    const isTransparent = variation.bg === TOKENS.transparent;

    return `
      <article class="brand-card${isTransparent ? ' brand-card--transparent' : ''}"
               id="${cardId}"
               data-asset="${asset.id}"
               data-variation="${variation.id}"
               data-theme="${variation.theme}"
               data-bg="${isTransparent ? 'transparent' : 'solid'}">
        <header class="brand-card-header">
          <div class="brand-card-titles">
            <h3>${escapeHtml(variation.label)}</h3>
            <span class="brand-card-meta">fg ${variation.fg} · bg ${isTransparent ? 'transparent' : variation.bg}${asset.id.startsWith('wordmark') || asset.id.startsWith('lockup') ? ` · dot ${variation.dot}` : ''}</span>
          </div>
        </header>

        <div class="brand-card-preview" style="aspect-ratio: ${asset.aspectRatio};">
          <div class="brand-card-preview-inner">
            ${svgPreview}
          </div>
        </div>

        <div class="brand-card-actions">
          <div class="brand-action-row">
            <label class="brand-action-label" for="${cardId}-size">PNG size:</label>
            <select class="brand-size-select" id="${cardId}-size">
              ${sizeOptions}
            </select>
            <button class="btn-modern btn-primary brand-btn-download-png" type="button">
              <i class="fas fa-download"></i>
              <span>PNG</span>
            </button>
          </div>

          <div class="brand-action-row">
            <button class="btn-modern btn-secondary brand-btn-download-svg" type="button">
              <i class="fas fa-file-code"></i>
              <span>SVG</span>
            </button>
            <button class="btn-modern btn-secondary brand-btn-copy-svg" type="button">
              <i class="fas fa-clipboard"></i>
              <span>Copy SVG</span>
            </button>
            <button class="btn-modern btn-secondary brand-btn-copy-datauri" type="button">
              <i class="fas fa-link"></i>
              <span>Copy data: URI</span>
            </button>
          </div>

          <div class="brand-action-row brand-action-row--custom">
            <label class="brand-action-label" for="${cardId}-custom">Custom size (px):</label>
            <input class="brand-custom-size" type="number" min="16" max="8192" step="1" placeholder="${defaultDim.width}" id="${cardId}-custom" />
            <button class="btn-modern btn-secondary brand-btn-download-custom" type="button">
              <i class="fas fa-bolt"></i>
              <span>Download</span>
            </button>
          </div>

          <div class="brand-card-status" aria-live="polite" data-status></div>
        </div>
      </article>
    `;
  }

  // ============================================================
  // Event wiring
  // ============================================================

  attachListeners(root) {
    // Asset type tabs
    root.querySelectorAll('[data-brand-asset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-brand-asset');
        this.activeAssetId = id;
        root.querySelectorAll('[data-brand-asset]').forEach(b => b.classList.toggle('active', b === btn));
        this.showActiveAsset(root);
      });
    });

    // Backdrop toggle
    root.querySelectorAll('.brand-backdrop-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.backdrop = btn.getAttribute('data-backdrop');
        root.querySelectorAll('.brand-backdrop-btn').forEach(b => {
          const active = b === btn;
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        this.applyBackdrop(root);
      });
    });

    // Per-card actions (delegated for performance)
    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const card = btn.closest('.brand-card');
      if (!card) return;

      const assetId = card.getAttribute('data-asset');
      const variationId = card.getAttribute('data-variation');
      const asset = ASSET_TYPES.find(a => a.id === assetId);
      const variation = VARIATIONS.find(v => v.id === variationId);
      if (!asset || !variation) return;

      const statusEl = card.querySelector('[data-status]');

      if (btn.classList.contains('brand-btn-download-png')) {
        const sel = card.querySelector('.brand-size-select');
        const [w, h] = (sel?.value || '').split('x').map(n => parseInt(n, 10));
        await this.downloadPng(asset, variation, w, h, statusEl);
      } else if (btn.classList.contains('brand-btn-download-svg')) {
        this.downloadSvg(asset, variation, statusEl);
      } else if (btn.classList.contains('brand-btn-copy-svg')) {
        await this.copySvg(asset, variation, statusEl);
      } else if (btn.classList.contains('brand-btn-copy-datauri')) {
        await this.copyDataUri(asset, variation, statusEl);
      } else if (btn.classList.contains('brand-btn-download-custom')) {
        const input = card.querySelector('.brand-custom-size');
        const size = parseInt(input?.value || '', 10);
        if (!Number.isFinite(size) || size < 16 || size > 8192) {
          this.flashStatus(statusEl, 'Enter a size between 16 and 8192.', 'error');
          return;
        }
        const ar = asset.aspectRatio.split('/').map(n => parseFloat(n.trim()));
        const ratio = ar[0] / ar[1];
        const w = size;
        const h = Math.round(size / ratio);
        await this.downloadPng(asset, variation, w, h, statusEl);
      }
    });
  }

  // ============================================================
  // Helpers
  // ============================================================

  showActiveAsset(root) {
    root.querySelectorAll('[data-brand-pane]').forEach(pane => {
      const match = pane.getAttribute('data-brand-pane') === this.activeAssetId;
      pane.hidden = !match;
    });
  }

  applyBackdrop(root) {
    root.querySelectorAll('.brand-card--transparent').forEach(card => {
      card.setAttribute('data-backdrop', this.backdrop);
    });
  }

  flashStatus(el, message, kind = 'info') {
    if (!el) return;
    el.textContent = message;
    el.className = 'brand-card-status brand-status-' + kind;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
      el.textContent = '';
      el.className = 'brand-card-status';
    }, 3500);
  }

  filenameFor(asset, variation, ext, size) {
    const sizePart = size ? `-${size}` : '';
    return `specifys-${asset.id}-${variation.id}${sizePart}.${ext}`;
  }

  // ============================================================
  // Asset actions
  // ============================================================

  async downloadPng(asset, variation, width, height, statusEl) {
    try {
      this.flashStatus(statusEl, `Rendering ${width}×${height} PNG…`, 'info');
      const svg = asset.build(variation, { width: Math.max(width, 100) });
      const blob = await svgToPngBlob(svg, width, height);
      if (!blob) throw new Error('Canvas returned no blob');
      triggerDownload(blob, this.filenameFor(asset, variation, 'png', `${width}x${height}`));
      this.flashStatus(statusEl, `Downloaded ${width}×${height} PNG.`, 'success');
    } catch (err) {
      console.error('[BrandView] PNG download error', err);
      this.flashStatus(statusEl, 'PNG download failed. Check console.', 'error');
    }
  }

  downloadSvg(asset, variation, statusEl) {
    try {
      const svg = asset.build(variation, { width: 1000 });
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      triggerDownload(blob, this.filenameFor(asset, variation, 'svg'));
      this.flashStatus(statusEl, 'Downloaded SVG.', 'success');
    } catch (err) {
      console.error('[BrandView] SVG download error', err);
      this.flashStatus(statusEl, 'SVG download failed.', 'error');
    }
  }

  async copySvg(asset, variation, statusEl) {
    const svg = asset.build(variation, { width: 1000 });
    const ok = await copyToClipboard(svg);
    this.flashStatus(statusEl, ok ? 'SVG markup copied.' : 'Copy failed.', ok ? 'success' : 'error');
  }

  async copyDataUri(asset, variation, statusEl) {
    const svg = asset.build(variation, { width: 1000 });
    const uri = svgToDataUri(svg);
    const ok = await copyToClipboard(uri);
    this.flashStatus(statusEl, ok ? 'data: URI copied to clipboard.' : 'Copy failed.', ok ? 'success' : 'error');
  }
}
