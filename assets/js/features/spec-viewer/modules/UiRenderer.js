/**
 * Render overview body content and complexity score.
 * Injects enriched visual sections (personas, stories, KPIs) when present.
 */
import {
  renderEnrichedOverview,
  renderDetailedUserFlowRail,
  normalizeOverviewDisplayFields,
  parseFlowStep
} from './EnrichedOverviewRenderer.js';
import { renderEnrichedTechnical, renderEnrichedMarket, renderEnrichedVisibility, renderEnrichedPrompts, bindCopyButtons } from './EnrichedStageRenderers.js';
import { renderEnrichedDesign, bindEnrichedDesignInteractions } from './EnrichedDesignRenderer.js';
import { renderEnrichedArchitecture } from './EnrichedArchitectureRenderer.js';
import { enhanceSpecTermTooltips } from './SpecTermTooltips.js';

function parseMaybeJson(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

/** Shallow clone without listed keys (avoids enriched + legacy double sections). */
function omitKeys(obj, keys) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = { ...obj };
  keys.forEach((k) => {
    delete out[k];
  });
  return out;
}

/**
 * @param {Object} params
 * @param {HTMLElement} params.container
 * @param {any} params.overview
 * @param {(content: any) => string} params.formatTextContent
 * @param {(overview: any) => any} params.calculateComplexityScore
 * @param {(score: any) => string} params.renderComplexityScore
 * @param {(container: HTMLElement, tabName: string) => void} params.enhanceClarificationUI
 */
export function renderOverviewBody({
  container,
  overview,
  formatTextContent,
  calculateComplexityScore,
  renderComplexityScore,
  enhanceClarificationUI
}) {
  const data = parseMaybeJson(overview) || overview;
  const unwrapped = data?.overview && typeof data.overview === 'object' ? data.overview : data;
  const normalized = normalizeOverviewDisplayFields(unwrapped);
  const enriched = renderEnrichedOverview(normalized);
  // Pass normalized object so formatTextContent sees healed features/screens
  const formattedContent = formatTextContent(
    data?.overview && typeof data.overview === 'object' ? { overview: normalized } : normalized
  );
  container.innerHTML = (enriched || '') + formattedContent;
  const complexityScore = calculateComplexityScore(normalized);
  const complexityHTML = renderComplexityScore(complexityScore);
  container.insertAdjacentHTML('beforeend', complexityHTML);
  enhanceClarificationUI(container, 'overview');
  enhanceSpecTermTooltips(container);
}

/**
 * Render technical body content with enriched API/stack visuals.
 */
export function renderTechnicalBody({
  container,
  technical,
  formatTextContent,
  enhanceClarificationUI,
  renderSpecMermaidPlaceholders
}) {
  const data = parseMaybeJson(technical) || technical;
  const unwrapped = data?.technical && typeof data.technical === 'object' ? data.technical : data;
  const enriched = renderEnrichedTechnical(unwrapped);
  // Fields already shown in enriched chrome — omit from legacy formatter.
  let legacyPayload = unwrapped && typeof unwrapped === 'object' ? unwrapped : technical;
  if (enriched && legacyPayload && typeof legacyPayload === 'object') {
    const drop = ['techStack', 'envSecrets', 'performanceBudgets', 'mvpCostModel'];
    legacyPayload = omitKeys(legacyPayload, drop);
  }
  const formattedContent = formatTextContent(legacyPayload);
  container.innerHTML = (enriched || '') + formattedContent;
  enhanceClarificationUI(container, 'technical');
  renderSpecMermaidPlaceholders(container);
  enhanceSpecTermTooltips(container);
}

export function appendEnrichedMarket(container, market, formatTextContent) {
  const data = parseMaybeJson(market) || market;
  const unwrapped = data?.market && typeof data.market === 'object' ? data.market : data;
  const enriched = renderEnrichedMarket(unwrapped);
  let legacyPayload = unwrapped && typeof unwrapped === 'object' ? { ...unwrapped } : market;
  if (enriched && legacyPayload && typeof legacyPayload === 'object') {
    // Visual SWOT / competitor matrix / pricing already rendered above.
    legacyPayload = omitKeys(legacyPayload, [
      'swotAnalysis',
      'competitiveLandscape',
      'icpScorecard',
      'gtmPlan',
      'positioningOnePager',
      'disqualificationCriteria',
      'interviewScripts'
    ]);
    // Keep proposedModels/recommendations in Monetization; drop pricingStrategy (shown in enriched).
    if (legacyPayload.monetizationModel && typeof legacyPayload.monetizationModel === 'object') {
      const mm = { ...legacyPayload.monetizationModel };
      delete mm.pricingStrategy;
      delete mm.methodology;
      legacyPayload.monetizationModel = mm;
    }
  }
  const formatted = formatTextContent(legacyPayload);
  container.innerHTML = (enriched || '') + formatted;
  enhanceSpecTermTooltips(container);
}

export function appendEnrichedDesign(container, design, formatTextContent) {
  const data = parseMaybeJson(design) || design;
  const unwrapped = data?.design && typeof data.design === 'object' ? data.design : data;
  const enriched = renderEnrichedDesign(unwrapped);
  let legacyPayload = unwrapped && typeof unwrapped === 'object' ? { ...unwrapped } : design;
  if (enriched && legacyPayload && typeof legacyPayload === 'object') {
    // Enriched covers palette, themes, icon, components, and style notes — skip legacy Visual Style Guide.
    legacyPayload = omitKeys(legacyPayload, [
      'visualStyleGuide',
      'componentInventory',
      'motionSpecs',
      'microcopy',
      'a11yChecklist',
      'tokenExport',
      'screenLayouts'
    ]);
    if (legacyPayload.logoIconography && typeof legacyPayload.logoIconography === 'object') {
      const logo = { ...legacyPayload.logoIconography };
      delete logo.appIcon;
      legacyPayload.logoIconography = logo;
    }
  }
  const formatted = formatTextContent(legacyPayload);
  container.innerHTML = (enriched || '') + formatted;
  bindEnrichedDesignInteractions(container);
  enhanceSpecTermTooltips(container);
}

export function appendEnrichedVisibility(container, visibility) {
  const data = parseMaybeJson(visibility) || visibility;
  const unwrapped = data?.visibility && typeof data.visibility === 'object' ? data.visibility : data;
  const enriched = renderEnrichedVisibility(unwrapped);
  if (enriched) {
    container.insertAdjacentHTML('afterbegin', enriched);
    bindCopyButtons(container);
  }
  enhanceSpecTermTooltips(container);
}

export function appendEnrichedPrompts(container, prompts) {
  const data = parseMaybeJson(prompts) || prompts;
  const unwrapped = data?.prompts && typeof data.prompts === 'object' ? data.prompts : data;
  const enriched = renderEnrichedPrompts(unwrapped);
  if (enriched) {
    container.insertAdjacentHTML('afterbegin', enriched);
  }
  enhanceSpecTermTooltips(container);
}

/**
 * Prefer structured architecture object; returns HTML or '' to fall back to markdown path.
 */
export function tryRenderStructuredArchitecture(architecture) {
  const data = parseMaybeJson(architecture) || architecture;
  if (!data || typeof data !== 'object') return '';
  // Stored architecture is often markdown string; structured object has executiveSummary + diagrams
  if (typeof architecture === 'string' && !parseMaybeJson(architecture)) return '';
  const unwrapped = data.architecture && typeof data.architecture === 'object' ? data.architecture : data;
  if (!unwrapped.executiveSummary && !unwrapped.adrs && !unwrapped.logicalSystemArchitecture) return '';
  return renderEnrichedArchitecture(unwrapped);
}

export {
  renderEnrichedOverview,
  renderDetailedUserFlowRail,
  normalizeOverviewDisplayFields,
  parseFlowStep,
  renderEnrichedTechnical,
  renderEnrichedMarket,
  renderEnrichedDesign,
  renderEnrichedArchitecture,
  renderEnrichedVisibility,
  renderEnrichedPrompts,
  bindEnrichedDesignInteractions,
  bindCopyButtons,
  enhanceSpecTermTooltips
};
