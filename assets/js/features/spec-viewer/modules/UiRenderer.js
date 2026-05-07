/**
 * Render overview body content and complexity score.
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
  const formattedContent = formatTextContent(overview);
  container.innerHTML = formattedContent;
  const complexityScore = calculateComplexityScore(overview);
  const complexityHTML = renderComplexityScore(complexityScore);
  container.insertAdjacentHTML('beforeend', complexityHTML);
  enhanceClarificationUI(container, 'overview');
}

/**
 * Render technical body content.
 * @param {Object} params
 * @param {HTMLElement} params.container
 * @param {any} params.technical
 * @param {(content: any) => string} params.formatTextContent
 * @param {(container: HTMLElement, tabName: string) => void} params.enhanceClarificationUI
 * @param {(container: HTMLElement) => void} params.renderSpecMermaidPlaceholders
 */
export function renderTechnicalBody({
  container,
  technical,
  formatTextContent,
  enhanceClarificationUI,
  renderSpecMermaidPlaceholders
}) {
  const formattedContent = formatTextContent(technical);
  container.innerHTML = formattedContent;
  enhanceClarificationUI(container, 'technical');
  renderSpecMermaidPlaceholders(container);
}
