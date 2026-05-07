import { test, expect } from '@playwright/test';

test('spec viewer modular smoke', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`);

  await page.setContent(`
    <div id="diagrams-data"></div>
    <button id="generateDiagramsBtn"></button>
    <div id="mindmap-container"></div>
    <button id="generateMindMapBtn"></button>
    <button id="retryMindMapBtn"></button>
    <div id="prompts-data"></div>
    <button id="generatePromptsBtn"></button>
    <button id="overviewTab" class="side-menu-button"></button>
    <button id="technicalTab" class="side-menu-button"></button>
    <div id="overview-content" class="tab-content"><div class="content-header"></div></div>
    <div id="technical-content" class="tab-content"><div class="content-header"></div></div>
  `);

  await page.evaluate(async () => {
    const DataService = await import('/assets/js/features/spec-viewer/modules/DataService.js');
    const TabManager = await import('/assets/js/features/spec-viewer/modules/TabManager.js');
    const DiagramEngine = await import('/assets/js/features/spec-viewer/modules/DiagramEngine.js');
    const PromptEngine = await import('/assets/js/features/spec-viewer/modules/PromptEngine.js');

    window.dataService = DataService;
    window.tabManager = TabManager;
    window.diagramEngine = DiagramEngine;
    window.promptEngine = PromptEngine;

    window.currentTab = 'overview';
    window.checkProAccess = async () => true;
    window.markTabAsViewed = () => {};
    window.updateNotificationDot = () => {};
    window.updateSubsections = () => {};
    window.initializeMindMapTab = () => {};
    window.focusManager = { announce: () => {} };
    window.showNotification = () => {};
    window.sanitizeMermaidSource = (s) => s;
    delete window.mermaid;

    window.firebase = {
      auth: () => ({
        currentUser: { getIdToken: async () => 'fake-token' }
      })
    };

    window.getAuxHeaders = async () => ({
      'Content-Type': 'application/json',
      Authorization: 'Bearer fake-token'
    });

    window.__requests = [];
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (url, options = {}) => {
      window.__requests.push({ url: String(url), headers: options.headers || {} });
      if (String(url).includes('/api/auxiliary/prompts/generate')) {
        return new Response(JSON.stringify({ prompts: { fullPrompt: 'ok', thirdPartyIntegrations: [] } }), { status: 200 });
      }
      if (String(url).includes('/api/auxiliary/mindmap/generate')) {
        return new Response(JSON.stringify({ mindMap: { drawflow: { Home: { data: {} } } } }), { status: 200 });
      }
      return originalFetch(url, options);
    };

    window.api = {
      post: async (url) => {
        if (url === '/api/auxiliary/prompts/generate') {
          const headers = await window.getAuxHeaders();
          window.__requests.push({ url, headers });
          return { prompts: { fullPrompt: 'ok', thirdPartyIntegrations: [] } };
        }
        if (url === '/api/chat/diagrams/generate') {
          return {
            diagrams: [{ id: 'd1', title: 'A', mermaidCode: 'graph TD;A-->B' }]
          };
        }
        return {};
      }
    };

    let mermaidLoads = 0;
    window.mermaidManager = {
      isInitialized: false,
      async loadMermaid() {
        mermaidLoads += 1;
        window.mermaid = {
          initialize: () => {},
          render: async () => ({ svg: '<svg><text>ok</text></svg>' })
        };
      },
      async initialize() {
        this.isInitialized = true;
      }
    };
    window.__mermaidLoads = () => mermaidLoads;

    DataService.setSpec({
      id: 'spec-1',
      overviewApproved: true,
      technical: '{}',
      market: '{}',
      design: '{}',
      architecture: '```mermaid\\ngraph TD;A-->B\\n```',
      visibility: { foo: 'bar' },
      status: { technical: 'ready', market: 'ready', design: 'ready', architecture: 'ready', visibility: 'ready' }
    });

    TabManager.attach({ dataService: DataService });
  });

  const legacyAdaptersRemoved = await page.evaluate(() => typeof window.generatePromptsLegacy === 'undefined');
  expect(legacyAdaptersRemoved).toBe(true);

  await page.evaluate(async () => {
    await window.tabManager.showTab('technical');
  });
  const activeTab = await page.evaluate(() => window.currentTab);
  expect(activeTab).toBe('technical');

  const beforeLoads = await page.evaluate(() => window.__mermaidLoads());
  expect(beforeLoads).toBe(0);

  await page.evaluate(async () => {
    await window.diagramEngine.generateDiagrams();
  });
  await page.waitForFunction(() => window.__mermaidLoads() > 0, null, { timeout: 10000 });

  const afterLoads = await page.evaluate(() => window.__mermaidLoads());
  expect(afterLoads).toBeGreaterThan(0);

  const diagramLoadingEnded = await page.evaluate(() => window.dataService.isLoading('diagramLoading'));
  expect(diagramLoadingEnded).toBe(false);

  await page.evaluate(async () => {
    await window.promptEngine.generatePrompts();
  });

  const authHeaderPresent = await page.evaluate(() =>
    window.__requests.some((r) => String(r.headers.Authorization || r.headers.authorization || '').startsWith('Bearer '))
  );
  expect(authHeaderPresent).toBe(true);
});
