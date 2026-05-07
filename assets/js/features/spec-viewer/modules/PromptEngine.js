function getSpec() {
  return window.dataService?.getSpec?.() || window.currentSpecData || null;
}

function ensureAuth() {
  const user = firebase.auth().currentUser;
  if (!user) throw new Error('User must be authenticated');
  return user;
}

function setPromptsLoading(status) {
  window.dataService?.setLoading?.('promptLoading', status);
}

function isPromptsLoading() {
  return !!window.dataService?.isLoading?.('promptLoading');
}

export async function generateTechnicalSpec(retryCount = 0, maxRetries = 2) {
  if (typeof window.generateTechnicalSpecLegacy === 'function') {
    return window.generateTechnicalSpecLegacy(retryCount, maxRetries);
  }
  return null;
}

export async function generateMarketSpec(retryCount = 0, maxRetries = 2) {
  if (typeof window.generateMarketSpecLegacy === 'function') {
    return window.generateMarketSpecLegacy(retryCount, maxRetries);
  }
  return null;
}

export async function generateDesignSpec(retryCount = 0, maxRetries = 2) {
  if (typeof window.generateDesignSpecLegacy === 'function') {
    return window.generateDesignSpecLegacy(retryCount, maxRetries);
  }
  return null;
}

export async function generateSingleStage(stageNumber, requestId, overviewContent, technicalContent, designContent, previousStages, updateProgress) {
  if (typeof window.generateSingleStageLegacy === 'function') {
    return window.generateSingleStageLegacy(stageNumber, requestId, overviewContent, technicalContent, designContent, previousStages, updateProgress);
  }
  throw new Error('generateSingleStage legacy adapter is not available');
}

export async function generatePrompts() {
  if (isPromptsLoading()) return;
  ensureAuth();
  setPromptsLoading(true);
  try {
    if (typeof window.generatePromptsLegacy === 'function') {
      return await window.generatePromptsLegacy();
    }
    const spec = getSpec();
    if (!spec?.id) throw new Error('Specification is not loaded');
    const response = await fetch('/api/auxiliary/prompts/generate', {
      method: 'POST',
      headers: await window.getAuxHeaders(),
      body: JSON.stringify({ specId: spec.id })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error?.message || 'Failed to generate prompts');
    displayPromptsFromData({ ...spec, prompts: result.prompts });
  } catch (error) {
    window.showNotification?.(`Failed to generate prompts: ${error.message}`, 'error');
  } finally {
    setPromptsLoading(false);
  }
}

export function displayPromptsFromData(data) {
  const container = document.getElementById('prompts-data');
  if (!container) return;
  if (!data?.overviewApproved) {
    container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-lock"></i> Prompts</h3><p>Please approve the Overview and complete all specification stages first.</p></div>';
    return;
  }
  const promptsData = typeof data.prompts === 'string' ? (() => {
    try { return JSON.parse(data.prompts); } catch (e) { return null; }
  })() : data.prompts;
  if (!promptsData?.fullPrompt) {
    container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-terminal"></i> Prompts</h3><p>Prompts generation is in progress or failed. Retry generation if needed.</p></div>';
    return;
  }
  displayPrompts(promptsData);
}

export function displayPrompts(promptsData) {
  if (typeof window.displayPromptsLegacy === 'function') {
    window.displayPromptsLegacy(promptsData);
    return;
  }
  const container = document.getElementById('prompts-data');
  if (!container) return;
  container.innerHTML = `
    <div class="prompt-section">
      <div class="prompt-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3><i class="fa fa-code"></i> Full Development Prompt</h3>
      </div>
      <div class="prompt-content" id="full-prompt-content" style="background:#f5f5f5;border:1px solid #e0e0e0;border-radius:8px;padding:20px;overflow-x:auto;max-width:100%;">
        <pre class="prompt-text" style="margin:0;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:break-word;font-family:'Monaco','Courier New',monospace;font-size:13px;line-height:1.6;color:#333;">${window.escapeHtmlSpec ? window.escapeHtmlSpec(promptsData.fullPrompt) : promptsData.fullPrompt}</pre>
      </div>
    </div>
  `;
}

export function retryTechnical() {
  window.retryTechnicalLegacy?.();
}

export function retryMarket() {
  window.retryMarketLegacy?.();
}

export function retryDesign() {
  window.retryDesignLegacy?.();
}
