function getSpec() {
  return window.dataService?.getSpec?.() || window.currentSpecData || null;
}

const STAGE_NAMES = {
  1: 'PROJECT SETUP & BASIC STRUCTURE',
  2: 'FRONTEND CORE FUNCTIONALITY',
  3: 'AUTHENTICATION & USER MANAGEMENT',
  4: 'BACKEND API DEVELOPMENT',
  5: 'AI INTEGRATION',
  6: 'REAL-TIME COLLABORATION',
  7: 'THIRD-PARTY INTEGRATIONS',
  8: 'MOBILE APP DEVELOPMENT',
  9: 'TESTING & QUALITY ASSURANCE',
  10: 'DEPLOYMENT & DEVOPS'
};

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

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryFetch(url, init, { maxRetries = 2, baseDelay = 500 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.status >= 500 || response.status === 429) {
        if (attempt === maxRetries) return response;
        throw new Error(`HTTP ${response.status}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) break;
      const delay = baseDelay * (2 ** attempt) + Math.floor(Math.random() * 100);
      await wait(delay);
    }
  }
  throw lastError;
}

function getPromptTimeoutMs() {
  return window.SPECIFYS_TIMEOUTS?.apiPromptMs || 120000;
}

async function postAuxWithApi(path, body, { maxRetries = 2 } = {}) {
  if (!window.api?.post) {
    const response = await retryFetch(path, {
      method: 'POST',
      headers: await window.getAuxHeaders(),
      body: JSON.stringify(body)
    }, { maxRetries });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error?.message || `HTTP ${response.status}`);
    }
    return payload;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), getPromptTimeoutMs());
  try {
    return await window.api.post(path, body, {
      skipCache: true,
      retryConfig: { maxRetries },
      signal: controller.signal
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function generateTechnicalSpec(retryCount = 0, maxRetries = 2) {
  const spec = getSpec();
  if (!spec) return null;
  const firstParam = spec.id ? spec.id : spec.overview;
  let prompt = window.PROMPTS?.technical?.(firstParam, spec.answers);
  if (!prompt) throw new Error('Technical prompt template is not available');
  if (spec.id && spec.overview && prompt.includes('[SPEC_REFERENCE]')) {
    const referencePattern = /\[SPEC_REFERENCE\]\s+Spec ID: [^\n]+\s+Overview Location: [^\n]+\s+Note: [^\n]+\./s;
    prompt = prompt.replace(referencePattern, `Application Overview:\n${spec.overview}`);
  }
  const requestBody = {
    stage: 'technical',
    locale: 'en-US',
    temperature: 0,
    prompt: {
      system: 'You are a highly experienced software architect and lead developer. Generate a detailed technical specification.',
      developer: 'Create a comprehensive technical specification including data models, database schema, API design, security, and integration points.',
      user: prompt
    }
  };
  const data = await postAuxWithApi('/api/auxiliary/prompts/generate', requestBody, { maxRetries });
  return data.technical ? JSON.stringify(data.technical, null, 2) : 'No technical specification generated';
}

export async function generateMarketSpec(retryCount = 0, maxRetries = 2) {
  const spec = getSpec();
  if (!spec) return null;
  const firstParam = spec.id ? spec.id : spec.overview;
  let prompt = window.PROMPTS?.market?.(firstParam, spec.answers);
  if (!prompt) throw new Error('Market prompt template is not available');
  if (spec.id && spec.overview && prompt.includes('[SPEC_REFERENCE]')) {
    const referencePattern = /\[SPEC_REFERENCE\]\s+Spec ID: [^\n]+\s+Overview Location: [^\n]+\s+Note: [^\n]+\./s;
    prompt = prompt.replace(referencePattern, `Application Overview:\n${spec.overview}`);
  }
  const requestBody = {
    stage: 'market',
    locale: 'en-US',
    temperature: 0,
    prompt: {
      system: 'You are a market research specialist and business analyst. Generate comprehensive market research insights.',
      developer: 'Create detailed market analysis including market overview, competitors analysis, target audience personas, and pricing strategy.',
      user: prompt
    }
  };
  const data = await postAuxWithApi('/api/auxiliary/prompts/generate', requestBody, { maxRetries });
  return data.market ? JSON.stringify(data.market, null, 2) : 'No market research generated';
}

export async function generateDesignSpec(retryCount = 0, maxRetries = 2) {
  const spec = getSpec();
  if (!spec) return null;
  const firstParam = spec.id ? spec.id : spec.overview;
  let prompt = window.PROMPTS?.design?.(firstParam, spec.answers);
  if (!prompt) throw new Error('Design prompt template is not available');
  if (spec.id && spec.overview && prompt.includes('[SPEC_REFERENCE]')) {
    const referencePattern = /\[SPEC_REFERENCE\]\s+Spec ID: [^\n]+\s+Overview Location: [^\n]+\s+Note: [^\n]+\./s;
    prompt = prompt.replace(referencePattern, `Application Overview:\n${spec.overview}`);
  }
  const requestBody = {
    stage: 'design',
    locale: 'en-US',
    temperature: 0,
    prompt: {
      system: 'You are a UX/UI design specialist and branding expert. Generate comprehensive design guidelines and branding elements.',
      developer: 'Create detailed design specifications including color schemes, typography, UI components, user experience guidelines, and branding elements.',
      user: prompt
    }
  };
  const data = await postAuxWithApi('/api/auxiliary/prompts/generate', requestBody, { maxRetries });
  return data.design ? JSON.stringify(data.design, null, 2) : 'No design specification generated';
}

export async function generateSingleStage(stageNumber, requestId, overviewContent, technicalContent, designContent, previousStages, updateProgress) {
  updateProgress?.(stageNumber, 'generating', `Generating Stage ${stageNumber}: ${STAGE_NAMES[stageNumber] || 'Stage'}...`);
  const requestBody = {
    stage: 'prompt-stage',
    locale: 'en-US',
    temperature: 0,
    prompt: {
      system: 'You are an expert software development prompt engineer. Generate concise, clear development stage content focused on structure and architecture, not full code implementation.',
      developer: `Generate ONLY STAGE ${stageNumber} content in JSON structure { "prompts": { "fullPrompt": "..." } }.`,
      user: `Application Overview:\n${overviewContent || 'Not provided'}\n\nTechnical Specification:\n${technicalContent || 'Not provided'}\n\nDesign Specification:\n${designContent || 'Not provided'}\n\nPrevious Stages:\n${(previousStages || []).join('\n\n')}`
    }
  };
  const data = await postAuxWithApi('/api/auxiliary/prompts/generate', requestBody, { maxRetries: 2 });
  if (!data?.prompts?.fullPrompt) throw new Error(`Stage ${stageNumber} invalid response: missing fullPrompt`);
  return data.prompts.fullPrompt;
}

export async function generatePrompts() {
  if (isPromptsLoading()) return;
  ensureAuth();
  setPromptsLoading(true);
  try {
    const spec = getSpec();
    if (!spec?.id) throw new Error('Specification is not loaded');
    const result = await postAuxWithApi('/api/auxiliary/prompts/generate', { specId: spec.id }, { maxRetries: 2 });
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
  const spec = getSpec();
  const retryTechnicalBtn = document.getElementById('retryTechnicalBtn');
  if (retryTechnicalBtn) {
    retryTechnicalBtn.disabled = true;
    retryTechnicalBtn.textContent = '⏳ Generating...';
  }
  window.updateTabLoadingState?.('technical', true);
  window.api.post(`/api/specs/${spec.id}/generate-section`, { section: 'technical' })
    .then(() => window.showNotification?.('Technical specification generation started. The page will update when ready.', 'info'))
    .catch((error) => {
      if (retryTechnicalBtn) {
        retryTechnicalBtn.disabled = false;
        retryTechnicalBtn.textContent = 'Retry';
      }
      window.updateTabLoadingState?.('technical', false);
      window.showNotification?.(`Failed to start technical generation: ${error.message || 'Please try again.'}`, 'error');
    });
}

export function retryMarket() {
  const spec = getSpec();
  const retryMarketBtn = document.getElementById('retryMarketBtn');
  if (retryMarketBtn) {
    retryMarketBtn.disabled = true;
    retryMarketBtn.textContent = '⏳ Generating...';
  }
  window.updateTabLoadingState?.('market', true);
  window.api.post(`/api/specs/${spec.id}/generate-section`, { section: 'market' })
    .then(() => window.showNotification?.('Market research generation started. The page will update when ready.', 'info'))
    .catch((error) => {
      if (retryMarketBtn) {
        retryMarketBtn.disabled = false;
        retryMarketBtn.textContent = 'Retry';
      }
      window.updateTabLoadingState?.('market', false);
      window.showNotification?.(`Failed to start market generation: ${error.message || 'Please try again.'}`, 'error');
    });
}

export function retryDesign() {
  const spec = getSpec();
  const retryDesignBtn = document.getElementById('retryDesignBtn');
  if (retryDesignBtn) {
    retryDesignBtn.disabled = true;
    retryDesignBtn.textContent = '⏳ Generating...';
  }
  window.updateTabLoadingState?.('design', true);
  window.api.post(`/api/specs/${spec.id}/generate-section`, { section: 'design' })
    .then(() => window.showNotification?.('Design specification generation started. The page will update when ready.', 'info'))
    .catch((error) => {
      if (retryDesignBtn) {
        retryDesignBtn.disabled = false;
        retryDesignBtn.textContent = 'Retry';
      }
      window.updateTabLoadingState?.('design', false);
      window.showNotification?.(`Failed to start design generation: ${error.message || 'Please try again.'}`, 'error');
    });
}
