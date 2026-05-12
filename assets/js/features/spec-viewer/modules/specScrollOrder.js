/**
 * Canonical vertical order for top-bar spec sections (wheel + scroll-into-view).
 * Keep in sync with spec viewer DOM tab ids: `${name}Tab` / `${name}-content`.
 */
export const SPEC_SCROLL_ORDER = [
  'overview',
  'technical',
  'mindmap',
  'market',
  'design',
  'architecture',
  'visibility-engine',
  'prompts',
  'mockup',
  'raw'
];

export function isTopSpecScrollTab(tabName) {
  return SPEC_SCROLL_ORDER.includes(tabName);
}
