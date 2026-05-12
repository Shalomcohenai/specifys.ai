import { attachUiBridge } from './modules/UiController.js';
import { attachDiagramBridge } from './modules/DiagramManager.js';
import { injectSpecSeo } from './modules/SeoInjector.js';
import { SPEC_SCROLL_ORDER } from './modules/specScrollOrder.js';
import * as MockupService from './modules/MockupService.js';
import * as DataService from './modules/DataService.js';
import * as TabManager from './modules/TabManager.js';
import * as UiRenderer from './modules/UiRenderer.js';
import * as DiagramEngine from './modules/DiagramEngine.js';
import * as PromptEngine from './modules/PromptEngine.js';

window.SPEC_SCROLL_ORDER = SPEC_SCROLL_ORDER;

window.dataService = DataService;
window.tabManager = TabManager;
window.uiRenderer = UiRenderer;
window.diagramEngine = DiagramEngine;
window.promptEngine = PromptEngine;

// Global bridge: TabManager.showTab for programmatic callers; nav clicks use delegation in spec-viewer-event-handlers.js.
window.addEventListener('load', () => {
  attachUiBridge(window);
  attachDiagramBridge(window);
  window.showTab = TabManager.showTab;
  TabManager.attach({ dataService: DataService });
  window.generateMockupSpec = MockupService.generate;
  window.retryMockup = MockupService.retry;
  window.displayMockup = MockupService.display;
  window.switchMockupScreen = MockupService.switchScreen;
  window.prevMockupScreen = MockupService.prevScreen;
  window.nextMockupScreen = MockupService.nextScreen;
  window.setMockupDevice = MockupService.setDevice;
  window.loadMockupScreen = MockupService.loadScreen;
  window.viewMockupCode = MockupService.viewCode;
  window.createCodeModal = MockupService.createCodeModal;
  window.closeMockupCodeModal = MockupService.closeCodeModal;
  window.copyMockupCode = MockupService.copyCode;
  window.downloadMockup = MockupService.downloadCurrent;
  window.generateDiagrams = DiagramEngine.generateDiagrams;
  window.repairDiagram = DiagramEngine.repairDiagram;
  window.generateMindMap = DiagramEngine.generateMindMap;
  window.retryMindMap = DiagramEngine.retryMindMap;
  window.displayMindMap = DiagramEngine.displayMindMap;

  window.generatePrompts = PromptEngine.generatePrompts;
  window.generateTechnicalSpec = PromptEngine.generateTechnicalSpec;
  window.generateMarketSpec = PromptEngine.generateMarketSpec;
  window.generateDesignSpec = PromptEngine.generateDesignSpec;
  window.retryTechnical = PromptEngine.retryTechnical;
  window.retryMarket = PromptEngine.retryMarket;
  window.retryDesign = PromptEngine.retryDesign;

  DiagramEngine.attach({ dataService: DataService });
  if (window.currentSpecData) injectSpecSeo(window.currentSpecData);

  let seoInterval = null;
  seoInterval = setInterval(() => {
    if (window.currentSpecData) {
      injectSpecSeo(window.currentSpecData);
      clearInterval(seoInterval);
    }
  }, 1000);
});

window.addEventListener('beforeunload', () => {
  TabManager.teardown();
  DiagramEngine.teardown();
});
