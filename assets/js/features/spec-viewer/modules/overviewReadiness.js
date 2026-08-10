/**
 * Pure helpers for overview readiness / approval-banner gating.
 * Keeps "Overview ready" UI honest: status alone is not enough.
 */

/**
 * @param {unknown} overview
 * @returns {boolean}
 */
export function hasRenderableOverview(overview) {
  if (overview == null) return false;
  if (typeof overview === 'string') {
    const trimmed = overview.trim();
    if (!trimmed || trimmed === 'null' || trimmed === '{}') return false;
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return hasRenderableOverview(parsed);
      } catch (_) {
        // Non-JSON string content can still be shown as markdown/text
        return trimmed.length > 40;
      }
    }
    return trimmed.length > 40;
  }
  if (typeof overview === 'object') {
    const idea = overview.ideaSummary || overview.shortTitle || overview.valueProposition;
    const features = overview.coreFeaturesOverview;
    const screens = overview.screenDescriptions?.screens;
    if (typeof idea === 'string' && idea.trim().length > 0) return true;
    if (Array.isArray(features) && features.length > 0) return true;
    if (Array.isArray(screens) && screens.length > 0) return true;
    return false;
  }
  return false;
}

/**
 * True when the Continue / "Overview ready" banner may be shown.
 * Requires real overview content + ready status, and no advanced pipeline yet.
 * @param {object|null|undefined} data
 * @returns {boolean}
 */
export function shouldShowOverviewReadyBanner(data) {
  if (!data || typeof data !== 'object') return false;
  if (!hasRenderableOverview(data.overview)) return false;
  if (data.status?.overview !== 'ready') return false;

  const inFlightOrTerminal = (s) => s === 'ready' || s === 'error' || s === 'generating';
  const status = data.status || {};
  if (inFlightOrTerminal(status.technical) || inFlightOrTerminal(status.market) || inFlightOrTerminal(status.design)) {
    return false;
  }
  return true;
}

/**
 * Whether overview generation looks incomplete and needs resume/retry.
 * @param {object|null|undefined} data
 * @param {{ now?: number, stuckMs?: number }} [opts]
 * @returns {{ needsAttention: boolean, reason: 'missing'|'error'|'stuck'|'generating'|null }}
 */
export function getOverviewGenerationAttention(data, opts = {}) {
  const now = opts.now || Date.now();
  const stuckMs = opts.stuckMs != null ? opts.stuckMs : 5 * 60 * 1000;
  if (!data || typeof data !== 'object') {
    return { needsAttention: false, reason: null };
  }
  const status = data.status?.overview;
  const hasContent = hasRenderableOverview(data.overview);
  if (hasContent && status === 'ready') {
    return { needsAttention: false, reason: null };
  }
  if (status === 'error' || (status === 'ready' && !hasContent)) {
    return { needsAttention: true, reason: status === 'ready' ? 'missing' : 'error' };
  }
  if (status === 'generating') {
    const updatedAt = data.updatedAt?.toDate
      ? data.updatedAt.toDate()
      : data.updatedAt?._seconds
        ? new Date(data.updatedAt._seconds * 1000)
        : data.updatedAt
          ? new Date(data.updatedAt)
          : null;
    const age = updatedAt && !Number.isNaN(updatedAt.getTime()) ? now - updatedAt.getTime() : 0;
    if (age > stuckMs) {
      return { needsAttention: true, reason: 'stuck' };
    }
    return { needsAttention: false, reason: 'generating' };
  }
  if (!hasContent) {
    return { needsAttention: true, reason: 'missing' };
  }
  return { needsAttention: false, reason: null };
}

/**
 * Best-effort userInput recovery from a spec document.
 * @param {object|null|undefined} data
 * @returns {string}
 */
export function extractOverviewUserInput(data) {
  if (!data || typeof data !== 'object') return '';
  if (typeof data.userInput === 'string' && data.userInput.trim()) return data.userInput.trim();
  const answers = data.answers;
  if (Array.isArray(answers)) {
    const first = answers[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
  }
  return '';
}
