/**
 * Shared helpers for overview → title (used by specs routes and pipeline canary).
 */

const MAX_WORDS = 5;

/**
 * Get display title from overview JSON string.
 * @param {string} overviewContent
 * @returns {string}
 */
function getTitleFromOverview(overviewContent) {
  if (!overviewContent || typeof overviewContent !== 'string') return 'App Specification';
  try {
    const overviewObj = JSON.parse(overviewContent);
    const o = overviewObj.overview && typeof overviewObj.overview === 'object' ? overviewObj.overview : overviewObj;
    const shortTitle = o.shortTitle && typeof o.shortTitle === 'string' ? o.shortTitle.trim() : '';
    if (shortTitle.length > 0) return shortTitle;
    const ideaSummary = o.ideaSummary || overviewObj.ideaSummary;
    if (ideaSummary && typeof ideaSummary === 'string' && ideaSummary.trim().length > 0) {
      const trimmed = ideaSummary.trim();
      const firstSentence = trimmed.split(/[.!?]/)[0].trim();
      const words = firstSentence.split(/\s+/).filter(Boolean);
      if (words.length >= 1) return words.slice(0, MAX_WORDS).join(' ');
    }
    if (overviewObj.applicationSummary && Array.isArray(overviewObj.applicationSummary.paragraphs) && overviewObj.applicationSummary.paragraphs[0]) {
      const p = overviewObj.applicationSummary.paragraphs[0];
      if (typeof p === 'string' && p.trim().length > 0) {
        const words = p.trim().split(/\s+/).filter(Boolean);
        if (words.length >= 1) return words.slice(0, MAX_WORDS).join(' ');
      }
    }
  } catch (e) {
    // ignore parse errors
  }
  return 'App Specification';
}

module.exports = { getTitleFromOverview };
