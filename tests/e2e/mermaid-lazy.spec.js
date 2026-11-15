import { test, expect } from '@playwright/test';

test('a hidden diagram does not load Mermaid until it is shown', async ({ page }) => {
  const loads = [];
  page.on('request', (request) => {
    if (request.url().includes('mermaid.min.js')) loads.push(request.url());
  });
  await page.route((url) => url.pathname === '/mermaid-fixture', (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html><body>
    <div id="hidden" style="display:none">
      <div class="spec-mermaid-placeholder" data-spec-mermaid="${encodeURIComponent('flowchart TD\n  A["Start"] --> B["End"]')}"></div>
    </div>
  </body></html>`
  }));
  await page.goto('/mermaid-fixture');
  await page.addScriptTag({
    type: 'module',
    content: `import { renderSpecMermaidPlaceholders } from '/assets/js/features/spec-viewer/modules/DiagramEngine.js';
      window.renderSpecMermaidPlaceholders = renderSpecMermaidPlaceholders;`
  });
  await page.waitForFunction(() => typeof window.renderSpecMermaidPlaceholders === 'function');
  await page.evaluate(() => window.renderSpecMermaidPlaceholders(document.getElementById('hidden')));
  await page.waitForTimeout(250);
  expect(loads).toEqual([]);
  await page.evaluate(() => {
    const hidden = document.getElementById('hidden');
    hidden.style.display = 'block';
  });
  await page.waitForRequest((request) => request.url().includes('mermaid.min.js'), { timeout: 5000 });
});
