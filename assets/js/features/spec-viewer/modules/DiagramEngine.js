let diagramsData = [];
let drawflowInstance = null;
let mindMapGenerated = false;
let mermaidReadyPromise = null;
let specUnsubscribe = null;
let lastSpecDigest = '';
let retryClickBound = false;

const MERMAID_THEME = {
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#FF6B35',
    primaryTextColor: '#333333',
    primaryBorderColor: '#FF6B35',
    lineColor: '#333333',
    secondaryColor: '#f5f5f5',
    tertiaryColor: '#ffffff',
    background: '#ffffff',
    mainBkg: '#ffffff',
    secondBkg: '#f5f5f5',
    tertiaryBkg: '#ffffff'
  }
};

function getSpec() {
  return window.dataService?.getSpec?.() || window.currentSpecData || null;
}

function showNotification(message, type = 'info') {
  window.showNotification?.(message, type);
}

function buildRenderErrorCard({ message, retryType, diagramId, containerId }) {
  const safeMessage = window.escapeHtmlSpec ? window.escapeHtmlSpec(message || 'Unknown render error') : (message || 'Unknown render error');
  const attrs = [
    `data-render-retry="true"`,
    `data-retry-type="${retryType}"`,
    diagramId ? `data-diagram-id="${diagramId}"` : '',
    containerId ? `data-container-id="${containerId}"` : ''
  ].filter(Boolean).join(' ');
  return `
    <div class="diagram-error render-error-card">
      <h3><i class="fa fa-exclamation-triangle"></i> Render Error</h3>
      <p>${safeMessage}</p>
      <button type="button" class="btn btn-secondary render-retry-btn" ${attrs}>Retry</button>
    </div>
  `;
}

export async function ensureMermaid() {
  if (typeof mermaid !== 'undefined' && mermaid.render) {
    return mermaid;
  }
  if (!mermaidReadyPromise) {
    mermaidReadyPromise = (async () => {
      if (window.mermaidManager?.loadMermaid) {
        await window.mermaidManager.loadMermaid();
        if (!window.mermaidManager.isInitialized && window.mermaidManager.initialize) {
          await window.mermaidManager.initialize();
        }
      }
      if (typeof mermaid !== 'undefined' && mermaid.initialize) {
        try {
          mermaid.initialize(MERMAID_THEME);
        } catch (error) {}
      }
      return mermaid;
    })();
  }
  return mermaidReadyPromise;
}

export function displayDiagramsFromData(data) {
  const container = document.getElementById('diagrams-data');
  if (!container) return;
  if (!data?.overviewApproved) {
    container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-lock"></i> Diagrams</h3><p>Please approve the Overview and generate Technical & Market specifications first to create visual diagrams.</p></div>';
    return;
  }
  if (!data?.technical || !data?.market || data?.status?.technical !== 'ready' || data?.status?.market !== 'ready') {
    container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-lock"></i> Diagrams</h3><p>Please generate Technical & Market specifications first to create visual diagrams.</p></div>';
    return;
  }
  const list = data?.diagrams?.diagrams;
  if (!Array.isArray(list) || list.length === 0) {
    container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-bar-chart"></i> Diagrams</h3><p>Visual diagrams are generated inside the <strong>Technical Specification</strong> and <strong>Architecture</strong> tabs (Mermaid).</p></div>';
    return;
  }
  diagramsData = list.filter((d) => d?.mermaidCode);
  displayDiagrams(diagramsData);
}

export function displayDiagrams(diagramsArray) {
  const container = document.getElementById('diagrams-data');
  if (!container) return;
  if (!Array.isArray(diagramsArray) || diagramsArray.length === 0) {
    container.innerHTML = '<div class="diagram-error"><h3><i class="fa fa-times-circle"></i> No Diagrams Generated</h3></div>';
    return;
  }
  container.innerHTML = '';
  diagramsArray.forEach((diagram) => {
    const el = document.createElement('div');
    el.className = 'diagram-container';
    el.id = `diagram-${diagram.id}`;
    el.innerHTML = `
      <div class="diagram-header">
        <div class="diagram-header-content">
          <h3>${window.escapeHtmlSpec ? window.escapeHtmlSpec(diagram.title || 'Diagram') : (diagram.title || 'Diagram')}</h3>
        </div>
        <div class="diagram-controls">
          <button onclick="repairDiagram('${diagram.id}')" class="btn-icon hidden" title="Repair Diagram">
            <i class="fa fa-tools"></i>
          </button>
        </div>
      </div>
      <div class="diagram-content" id="diagram-${diagram.id}-content">
        <div class="diagram-status">
          <div class="status-indicator generating"></div>
          <span class="status-text">Generating...</span>
        </div>
      </div>
    `;
    container.appendChild(el);
    renderSingleDiagram(diagram, `diagram-${diagram.id}-content`);
  });
}

export async function renderSingleDiagram(diagramData, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const parentElement = container.parentElement;
  const statusIndicator = parentElement?.querySelector('.status-indicator');
  const statusText = parentElement?.querySelector('.status-text');
  try {
    await ensureMermaid();
    const source = (typeof window.sanitizeMermaidSource === 'function'
      ? window.sanitizeMermaidSource(diagramData.mermaidCode)
      : diagramData.mermaidCode) || diagramData.mermaidCode;
    const uniqueId = `mermaid-render-${diagramData.id}-${Date.now()}`;
    const { svg } = await mermaid.render(uniqueId, source);
    container.innerHTML = `<div class="mermaid-rendered" style="width:100%;overflow:auto;">${svg}</div>`;
    if (statusIndicator) statusIndicator.className = 'status-indicator ready';
    if (statusText) statusText.textContent = 'Ready';
    diagramData._isValid = true;
  } catch (error) {
    diagramData._isValid = false;
    container.innerHTML = buildRenderErrorCard({
      message: error.message,
      retryType: 'diagram',
      diagramId: diagramData?.id,
      containerId
    });
    if (statusIndicator) statusIndicator.className = 'status-indicator error';
    if (statusText) statusText.textContent = 'Error';
  }
}

export async function generateDiagrams() {
  if (window.dataService?.isLoading?.('diagramLoading')) return;
  const spec = getSpec();
  try {
    window.dataService?.setLoading?.('diagramLoading', true);
    const generateBtn = document.getElementById('generateDiagramsBtn');
    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Generating Diagrams...';
    }
    if (!spec?.technical || spec?.technical === 'error') {
      throw new Error('Technical specification must be generated first');
    }
    if (!firebase.auth().currentUser) {
      throw new Error('User must be authenticated');
    }
    const result = await window.api.post('/api/chat/diagrams/generate', { specId: spec.id });
    if (result?.deprecated) {
      showNotification(result.message || 'Diagrams are embedded in Technical and Architecture tabs.', 'info');
      return;
    }
    if (!Array.isArray(result?.diagrams)) {
      throw new Error('Invalid response format: missing diagrams array');
    }
    diagramsData = result.diagrams;
    displayDiagrams(diagramsData);
    showNotification('Diagrams generated successfully.', 'success');
  } catch (error) {
    showNotification(`Failed to generate diagrams: ${error.message}`, 'error');
  } finally {
    window.dataService?.setLoading?.('diagramLoading', false);
    const generateBtn = document.getElementById('generateDiagramsBtn');
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.innerHTML = 'Generate Diagrams';
    }
  }
}

export async function repairDiagram(diagramId) {
  const spec = getSpec();
  const diagram = diagramsData.find((d) => String(d.id) === String(diagramId));
  if (!diagram || !spec?.id) return;
  try {
    const result = await window.api.post('/api/chat/diagrams/repair', {
      specId: spec.id,
      diagramId: diagram.id,
      mermaidCode: diagram.mermaidCode,
      title: diagram.title
    });
    if (result?.mermaidCode) {
      diagram.mermaidCode = result.mermaidCode;
      await renderSingleDiagram(diagram, `diagram-${diagram.id}-content`, true);
      showNotification('Diagram repaired successfully.', 'success');
    } else {
      throw new Error('No repaired code received');
    }
  } catch (error) {
    showNotification(`Failed to repair diagram: ${error.message}`, 'error');
  }
}

export function updateDiagramsStatus(status) {
  const statusElement = document.getElementById('diagramsStatus');
  if (!statusElement) return;
  statusElement.textContent = status === 'ready' ? 'Ready' : 'Pending';
  statusElement.className = `status-value ${status}`;
}

export function initializeMindMapTab() {
  const container = document.getElementById('mindmap-container');
  const generateBtn = document.getElementById('generateMindMapBtn');
  const retryBtn = document.getElementById('retryMindMapBtn');
  const spec = getSpec();
  if (!container || !generateBtn || !retryBtn) return;
  if (!spec?.overview || !spec?.technical) {
    container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-lock"></i> Mind Map</h3><p>Please generate Technical specification first to create the mind map.</p></div>';
    generateBtn.style.display = 'none';
    return;
  }
  if (mindMapGenerated && drawflowInstance) {
    generateBtn.style.display = 'none';
    retryBtn.style.display = 'inline-block';
    return;
  }
  container.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-color,#666);"><i class="fa fa-project-diagram" style="font-size:4em;margin-bottom:20px;opacity:0.5;"></i><h3 style="margin-bottom:10px;">Visualize Your Product Architecture</h3></div>';
  generateBtn.style.display = 'inline-block';
  retryBtn.style.display = 'none';
}

export async function generateMindMap() {
  const container = document.getElementById('mindmap-container');
  const generateBtn = document.getElementById('generateMindMapBtn');
  const retryBtn = document.getElementById('retryMindMapBtn');
  const spec = getSpec();
  if (!container || !generateBtn || !retryBtn) return;
  if (!spec?.overview || !spec?.technical) return;
  generateBtn.disabled = true;
  generateBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Generating...';
  try {
    const result = await window.api.post('/api/auxiliary/mindmap/generate', {
      overview: spec.overview,
      technical: spec.technical
    }, { skipCache: true });
    await displayMindMap(result.mindMap);
    mindMapGenerated = true;
    generateBtn.style.display = 'none';
    retryBtn.style.display = 'inline-block';
    showNotification('Mind map generated successfully!', 'success');
  } catch (error) {
    container.innerHTML = `<div class="locked-tab-message"><h3><i class="fa fa-exclamation-triangle"></i> Error Generating Mind Map</h3><p>${error.message}</p></div>`;
    showNotification('Failed to generate mind map. Please try again.', 'error');
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<i class="fa fa-magic"></i> Generate Mind Map';
  }
}

export async function loadMindMap() {
  return generateMindMap();
}

export async function ensureDrawflowLoaded() {
  if (typeof Drawflow !== 'undefined') return;
  await new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="drawflow"]')) {
      const i = setInterval(() => {
        if (typeof Drawflow !== 'undefined') {
          clearInterval(i);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(i);
        reject(new Error('Drawflow library failed to load'));
      }, 10000);
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/gh/jerosoler/Drawflow/dist/drawflow.min.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/gh/jerosoler/Drawflow/dist/drawflow.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Drawflow'));
    document.head.appendChild(script);
  });
}

export function convertToDrawflow(mindElixirData) {
  if (!mindElixirData?.nodeData) throw new Error('Invalid MindElixir data format');
  return {
    drawflow: {
      Home: {
        data: {}
      }
    }
  };
}

export async function displayMindMap(data) {
  const container = document.getElementById('mindmap-container');
  if (!container) return;
  container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;"><i class="fa fa-spinner fa-spin"></i><span style="margin-left:10px;">Loading flow diagram viewer...</span></div>';
  try {
    await ensureDrawflowLoaded();
    container.innerHTML = '<div id="drawflow"></div>';
    drawflowInstance = new Drawflow(document.getElementById('drawflow'));
    drawflowInstance.start();
    const drawflowData = data?.drawflow ? data : convertToDrawflow(data);
    drawflowInstance.import(drawflowData);
  } catch (error) {
    container.innerHTML = buildRenderErrorCard({
      message: `Error displaying mind map: ${error.message}`,
      retryType: 'mindmap'
    });
  }
}

export function retryMindMap() {
  loadMindMap();
}

export async function renderArchitectureMermaid(targetElement, mermaidCode) {
  if (!targetElement || !mermaidCode) return false;
  try {
    await ensureMermaid();
    const source = (typeof window.sanitizeMermaidSource === 'function'
      ? window.sanitizeMermaidSource(mermaidCode)
      : mermaidCode) || mermaidCode;
    const uniqueId = `arch-mermaid-${Date.now()}`;
    const result = await mermaid.render(uniqueId, source);
    targetElement.innerHTML = result.svg;
    return true;
  } catch (error) {
    return false;
  }
}

export async function renderSpecMermaidPlaceholders(container) {
  if (!container) return;
  await ensureMermaid();
  const nodes = container.querySelectorAll('[data-spec-mermaid]');
  await Promise.all(Array.from(nodes).map(async (node, idx) => {
    const source = node.getAttribute('data-spec-mermaid');
    if (!source) return;
    try {
      const id = `spec-mermaid-${Date.now()}-${idx}`;
      const result = await mermaid.render(id, source);
      node.innerHTML = result.svg;
    } catch (error) {}
  }));
}

function digestSpec(spec) {
  return JSON.stringify({
    diagrams: spec?.diagrams,
    architecture: spec?.architecture,
    mindMap: spec?.mindMap
  });
}

function onSpecUpdated(spec) {
  const nextDigest = digestSpec(spec);
  if (nextDigest === lastSpecDigest) return;
  lastSpecDigest = nextDigest;
  const activeTab = window.tabManager?.getCurrentTab?.() || window.currentTab;
  if (activeTab === 'mindmap') initializeMindMapTab();
  if (activeTab === 'diagrams') displayDiagramsFromData(spec);
}

function onRetryClick(event) {
  const button = event.target.closest('[data-render-retry="true"]');
  if (!button) return;
  const retryType = button.getAttribute('data-retry-type');
  if (retryType === 'diagram') {
    const diagramId = button.getAttribute('data-diagram-id');
    const containerId = button.getAttribute('data-container-id');
    const diagram = diagramsData.find((d) => String(d.id) === String(diagramId));
    if (diagram && containerId) {
      renderSingleDiagram(diagram, containerId);
    }
    return;
  }
  if (retryType === 'mindmap') {
    retryMindMap();
  }
}

export function attach({ dataService } = {}) {
  if (!dataService?.on) return;
  teardown();
  specUnsubscribe = dataService.on('specUpdated', onSpecUpdated);
  if (!retryClickBound) {
    document.addEventListener('click', onRetryClick);
    retryClickBound = true;
  }
}

export function teardown() {
  if (specUnsubscribe) {
    specUnsubscribe();
    specUnsubscribe = null;
  }
  if (retryClickBound) {
    document.removeEventListener('click', onRetryClick);
    retryClickBound = false;
  }
}
