const MOCKUPS_ANALYZE_URL = '/api/auxiliary/mockup/analyze-screens';
const MOCKUPS_SINGLE_URL = '/api/auxiliary/mockup/generate-single';

/**
 * @typedef {Object} MockupScreen
 * @property {string} name
 * @property {'desktop'|'tablet'|'mobile'|'web'} [deviceType]
 * @property {string} [description]
 * @property {number} [priority]
 */

/**
 * @typedef {Object} GeneratedMockup
 * @property {string} [id]
 * @property {string} name
 * @property {'desktop'|'tablet'|'mobile'|'web'} [deviceType]
 * @property {string} html
 */

export const mockupBatchManager = {
  isRunning: false,
  screens: [],
  mockups: [],
  failedScreens: [],
  currentIndex: 0,
  useMockData: false
};

function logError(error, context) {
  window.appLogger?.logError?.(error, { feature: 'MockupService', ...context });
}

async function getHeaders() {
  if (typeof window.getAuxHeaders === 'function') {
    return window.getAuxHeaders();
  }
  return { 'Content-Type': 'application/json' };
}

export async function analyzeMockupScreens(payload) {
  try {
    const response = await fetch(MOCKUPS_ANALYZE_URL, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error?.message || 'Failed to analyze screens');
    }
    return response.json();
  } catch (error) {
    logError(error, { stage: 'analyze' });
    throw error;
  }
}

export async function generateSingleMockup(payload) {
  try {
    const response = await fetch(MOCKUPS_SINGLE_URL, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error?.message || 'Failed to generate mockup');
    }
    return response.json();
  } catch (error) {
    logError(error, { stage: 'generate-single' });
    throw error;
  }
}

export async function generateSingleWithRetry(screen, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const spec = window.currentSpecData;
      const data = await generateSingleMockup({
        overview: spec?.overview,
        design: spec?.design,
        technical: spec?.technical || null,
        screen,
        useMockData: mockupBatchManager.useMockData
      });
      return data.mockup || null;
    } catch (error) {
      logError(error, { stage: 'generate-single-retry', attempt, screen: screen?.name });
      if (attempt === maxRetries) return null;
      const delay = Math.min(1000 * (2 ** (attempt - 1)), 5000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return null;
}

export function updateProgress(current, total, status) {
  const container = document.getElementById('mockup-data');
  if (!container) return;
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  container.innerHTML = `
    <div style="text-align: center; padding: 40px 20px;">
      <div class="spinner" style="margin: 0 auto 20px;"></div>
      <h3>Generating Mockups...</h3>
      <p style="color: #666; margin: 20px 0;">${status}</p>
      <div style="width: 100%; max-width: 400px; margin: 20px auto; background: #f0f0f0; border-radius: 10px; overflow: hidden;">
        <div style="width: ${percentage}%; background: linear-gradient(90deg, #FF6B35, #FF8C42); height: 30px; transition: width 0.3s ease; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
          ${percentage}%
        </div>
      </div>
      <p style="color: #999; font-size: 14px; margin-top: 15px;">
        Screen ${current} of ${total}
        ${mockupBatchManager.mockups.length > 0 ? ` • ${mockupBatchManager.mockups.length} completed` : ''}
        ${mockupBatchManager.failedScreens.length > 0 ? ` • ${mockupBatchManager.failedScreens.length} failed` : ''}
      </p>
    </div>
  `;
}

export async function display(mockupData) {
  const container = document.getElementById('mockup-data');
  if (!container) return;
  const hasProAccess = await window.checkProAccess();
  if (!hasProAccess) {
    container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-lock"></i> Frontend Mockups</h3><p>Mockup feature is available for PRO users only. Please upgrade to PRO to access mockups.</p></div>';
    return;
  }

  let generateSection = document.getElementById('mockup-generate-section');
  let viewerSection = document.getElementById('mockup-viewer-section');
  if (!generateSection || !viewerSection) {
    container.innerHTML = `
      <div id="mockup-generate-section" class="hidden"><div class="mockup-generate-content"><i class="fa fa-desktop mockup-icon"></i><h3>Create Frontend Mockups</h3><p class="mockup-description">Generate interactive HTML+CSS mockups based on your specifications</p><div class="mockup-checkbox-container"><label class="mockup-checkbox-label"><input type="checkbox" id="useMockDataCheckbox" class="mockup-checkbox"><span>Use mock data (fill with realistic sample data)</span></label></div><button id="generateMockupBtn" class="btn btn-primary mockup-generate-btn" onclick="generateMockupSpec()"><i class="fa fa-magic"></i> Create Mockups</button></div></div>
      <div id="mockup-viewer-section" class="hidden"></div>
    `;
    generateSection = document.getElementById('mockup-generate-section');
    viewerSection = document.getElementById('mockup-viewer-section');
  }
  if (!generateSection || !viewerSection) return;

  if (!mockupData || !mockupData.mockups || mockupData.mockups.length === 0) {
    const spec = window.currentSpecData;
    if (spec && spec.design && spec.status && spec.status.design === 'ready') {
      generateSection.style.display = 'block';
      viewerSection.style.display = 'none';
    } else {
      container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-lock"></i> Frontend Mockups</h3><p>Please approve the Overview and wait for Design & Branding to be ready before creating mockups.</p></div>';
    }
    return;
  }

  generateSection.style.display = 'none';
  viewerSection.style.display = 'block';
  const mockups = mockupData.mockups || [];
  let partialWarningHTML = '';
  if (mockupData.meta && mockupData.meta.partial && mockupData.meta.total) {
    partialWarningHTML = `<div style="padding: 12px 20px; margin-bottom: 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; color: #856404; font-size: 14px;"><i class="fa fa-info-circle"></i> Generating in progress: ${mockupData.meta.completed} of ${mockupData.meta.total} screens completed</div>`;
  }
  let viewerHTML = `${partialWarningHTML}<div class="mockup-viewer-container" style="display: flex; flex-direction: column; height: 100%;"><div class="mockup-screens-list" style="display: flex; gap: 10px; padding: 15px; background: #f5f5f5; border-bottom: 2px solid #ddd; overflow-x: auto; flex-wrap: wrap;">`;
  mockups.forEach((mockup, index) => {
    viewerHTML += `<button class="mockup-screen-btn ${index === 0 ? 'active' : ''}" onclick="switchMockupScreen(${index})" data-index="${index}" style="padding: 10px 20px; border: 2px solid ${index === 0 ? '#FF6B35' : '#ddd'}; background: ${index === 0 ? '#FF6B35' : 'white'}; color: ${index === 0 ? 'white' : '#333'}; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: ${index === 0 ? '600' : '400'}; transition: all 0.3s ease; white-space: nowrap;"><i class="fa fa-${mockup.deviceType === 'mobile' ? 'mobile' : mockup.deviceType === 'web' ? 'desktop' : 'desktop'}"></i> ${mockup.name}</button>`;
  });
  viewerHTML += `</div><div class="mockup-controls" style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: white; border-bottom: 1px solid #ddd;"><div style="display: flex; gap: 10px; align-items: center;"><button onclick="prevMockupScreen()" class="btn btn-secondary" style="padding: 8px 16px;"><i class="fa fa-chevron-left"></i> Prev</button><span style="font-weight: 600; color: #333;"><span id="current-screen-index">1</span> / ${mockups.length}</span><button onclick="nextMockupScreen()" class="btn btn-secondary" style="padding: 8px 16px;">Next <i class="fa fa-chevron-right"></i></button></div><div style="display: flex; gap: 10px; align-items: center;"><div class="device-selector" style="display: flex; gap: 5px; background: #f5f5f5; padding: 5px; border-radius: 6px;"><button onclick="setMockupDevice('desktop')" class="device-btn active" data-device="desktop" style="padding: 6px 12px; border: none; background: #FF6B35; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;"><i class="fa fa-desktop"></i> Desktop</button><button onclick="setMockupDevice('tablet')" class="device-btn" data-device="tablet" style="padding: 6px 12px; border: none; background: transparent; color: #666; border-radius: 4px; cursor: pointer; font-size: 12px;"><i class="fa fa-tablet"></i> Tablet</button><button onclick="setMockupDevice('mobile')" class="device-btn" data-device="mobile" style="padding: 6px 12px; border: none; background: transparent; color: #666; border-radius: 4px; cursor: pointer; font-size: 12px;"><i class="fa fa-mobile"></i> Mobile</button></div><button onclick="viewMockupCode()" class="btn btn-secondary" style="padding: 8px 16px;"><i class="fa fa-code"></i> View Code</button><button onclick="downloadMockup()" class="btn btn-secondary" style="padding: 8px 16px;"><i class="fa fa-download"></i> Download</button></div></div><div class="mockup-preview-area" style="flex: 1; overflow: auto; padding: 20px; background: #f0f0f0; display: flex; justify-content: center; align-items: flex-start; min-height: 600px;"><div id="mockup-preview-container" style="background: white; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; transition: all 0.3s ease; width: 100%; max-width: 1920px;"><iframe id="mockup-iframe" sandbox="allow-scripts" style="width: 100%; min-height: 600px; border: none; display: block;"></iframe></div></div></div>`;
  viewerSection.innerHTML = viewerHTML;
  window.currentMockups = mockups;
  window.currentMockupIndex = 0;
  window.currentMockupDevice = 'desktop';
  await loadScreen(0, 'desktop');
}

export function switchScreen(index) {
  window.currentMockupIndex = index;
  loadScreen(index, window.currentMockupDevice);
  document.querySelectorAll('.mockup-screen-btn').forEach((btn, i) => {
    const active = i === index;
    btn.classList.toggle('active', active);
    btn.style.background = active ? '#FF6B35' : 'white';
    btn.style.color = active ? 'white' : '#333';
    btn.style.borderColor = active ? '#FF6B35' : '#ddd';
    btn.style.fontWeight = active ? '600' : '400';
  });
  const currentScreenIndex = document.getElementById('current-screen-index');
  if (currentScreenIndex) currentScreenIndex.textContent = index + 1;
}

export function prevScreen() {
  if (!window.currentMockups) return;
  const newIndex = window.currentMockupIndex > 0 ? window.currentMockupIndex - 1 : window.currentMockups.length - 1;
  switchScreen(newIndex);
}

export function nextScreen() {
  if (!window.currentMockups) return;
  const newIndex = window.currentMockupIndex < window.currentMockups.length - 1 ? window.currentMockupIndex + 1 : 0;
  switchScreen(newIndex);
}

export function setDevice(device) {
  window.currentMockupDevice = device;
  loadScreen(window.currentMockupIndex, device);
  document.querySelectorAll('.device-btn').forEach((btn) => {
    const active = btn.dataset.device === device;
    btn.classList.toggle('active', active);
    btn.style.background = active ? '#FF6B35' : 'transparent';
    btn.style.color = active ? 'white' : '#666';
  });
}

export async function loadScreen(index, device) {
  if (!window.currentMockups || !window.currentMockups[index]) return;
  const mockup = window.currentMockups[index];
  const iframe = document.getElementById('mockup-iframe');
  const container = document.getElementById('mockup-preview-container');
  if (!iframe || !container) return;
  const blob = new Blob([mockup.html], { type: 'text/html' });
  iframe.src = URL.createObjectURL(blob);
  container.style.width = device === 'desktop' ? '100%' : device === 'tablet' ? '768px' : '375px';
  container.style.maxWidth = device === 'desktop' ? '1920px' : device === 'tablet' ? '768px' : '375px';
  iframe.onload = function onload() {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      const height = Math.max(iframeDoc.body.scrollHeight, iframeDoc.body.offsetHeight, 600);
      iframe.style.height = `${height}px`;
    } catch (_error) {
      iframe.style.height = '600px';
    }
  };
}

export function viewCode() {
  if (!window.currentMockups || !window.currentMockups[window.currentMockupIndex]) return;
  const mockup = window.currentMockups[window.currentMockupIndex];
  const codeModal = document.getElementById('mockup-code-modal') || createCodeModal();
  const codeContent = document.getElementById('mockup-code-content');
  codeContent.textContent = mockup.html;
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  codeModal.style.display = 'flex';
}

export function createCodeModal() {
  const modal = document.createElement('div');
  modal.id = 'mockup-code-modal';
  modal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10000; align-items: center; justify-content: center;';
  modal.innerHTML = `<div style="background: white; width: 90%; max-width: 1200px; height: 90%; border-radius: 8px; display: flex; flex-direction: column;"><div style="padding: 20px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;"><h3 style="margin: 0;">Mockup Code - ${window.currentMockups[window.currentMockupIndex].name}</h3><button onclick="closeMockupCodeModal()" style="background: #f0f0f0; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;"><i class="fa fa-times"></i> Close</button></div><pre id="mockup-code-content" style="flex: 1; overflow: auto; padding: 20px; margin: 0; background: #f5f5f5; font-family: 'Courier New', monospace; font-size: 12px; white-space: pre-wrap; word-wrap: break-word;"></pre><div style="padding: 15px; border-top: 1px solid #ddd; display: flex; gap: 10px;"><button onclick="copyMockupCode()" class="btn btn-primary" style="padding: 8px 16px;"><i class="fa fa-copy"></i> Copy Code</button></div></div>`;
  document.body.appendChild(modal);
  return modal;
}

export function closeCodeModal() {
  const modal = document.getElementById('mockup-code-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
}

export function copyCode() {
  const codeContent = document.getElementById('mockup-code-content');
  navigator.clipboard.writeText(codeContent.textContent).then(() => {
    window.showNotification('Code copied to clipboard!', 'success');
  }).catch(() => {
    window.showNotification('Failed to copy code', 'error');
  });
}

export function downloadCurrent() {
  if (!window.currentMockups || !window.currentMockups[window.currentMockupIndex]) return;
  const mockup = window.currentMockups[window.currentMockupIndex];
  const blob = new Blob([mockup.html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${mockup.id || 'mockup'}-${mockup.name.replace(/\s+/g, '-').toLowerCase()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  window.showNotification('Mockup downloaded!', 'success');
}

export async function generate() {
  const hasProAccess = await window.checkProAccess();
  if (!hasProAccess) {
    window.showNotification('Mockup feature is available for PRO users only. Please upgrade to PRO to generate mockups.', 'error');
    return;
  }
  const spec = window.currentSpecData;
  if (!spec) return window.showNotification('No specification data available', 'error');
  if (!spec.design || spec.status?.design !== 'ready') return window.showNotification('Please generate Design specification first', 'error');
  if (mockupBatchManager.isRunning) return window.showNotification('Mockup generation is already in progress', 'info');

  const checkboxEl = document.getElementById('useMockDataCheckbox');
  const useMockData = checkboxEl ? checkboxEl.checked : false;
  const generateBtn = document.getElementById('generateMockupBtn');
  mockupBatchManager.isRunning = true;
  mockupBatchManager.screens = [];
  mockupBatchManager.mockups = [];
  mockupBatchManager.failedScreens = [];
  mockupBatchManager.currentIndex = 0;
  mockupBatchManager.useMockData = useMockData;
  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Analyzing Screens...';
  }
  window.updateTabLoadingState('mockup', true);
  const container = document.getElementById('mockup-data');

  try {
    updateProgress(0, 0, 'Analyzing screens...');
    const analyzeData = await analyzeMockupScreens({
      overview: spec.overview,
      design: spec.design,
      technical: spec.technical || null
    });
    mockupBatchManager.screens = analyzeData.screens || [];
    if (mockupBatchManager.screens.length === 0) throw new Error('No screens identified for mockup generation');
    if (generateBtn) generateBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Generating Mockups...';

    for (let i = 0; i < mockupBatchManager.screens.length; i += 1) {
      const screen = mockupBatchManager.screens[i];
      mockupBatchManager.currentIndex = i;
      updateProgress(i + 1, mockupBatchManager.screens.length, `Generating: ${screen.name}...`);
      const mockup = await generateSingleWithRetry(screen, 3);
      if (mockup) {
        mockupBatchManager.mockups.push(mockup);
        updateProgress(i + 1, mockupBatchManager.screens.length, `Completed: ${screen.name}`);
        await display({ mockups: mockupBatchManager.mockups, meta: { partial: true, total: mockupBatchManager.screens.length, completed: mockupBatchManager.mockups.length } });
      } else {
        mockupBatchManager.failedScreens.push(screen);
      }
      if (i < mockupBatchManager.screens.length - 1) await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (mockupBatchManager.mockups.length === 0) throw new Error('Failed to generate any mockups');

    const finalMockupData = { mockups: mockupBatchManager.mockups, meta: { version: '1.0', generatedAt: new Date().toISOString(), totalScreens: mockupBatchManager.mockups.length, failedScreens: mockupBatchManager.failedScreens.length, useMockData } };
    const user = firebase.auth().currentUser;
    if (user && spec) {
      await firebase.firestore().collection('specs').doc(spec.id).update({
        mockups: finalMockupData,
        'status.mockup': 'ready',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      window.triggerOpenAIUploadForSpec(spec.id).catch(() => {});
    }

    spec.mockups = finalMockupData;
    if (!spec.status) spec.status = {};
    spec.status.mockup = 'ready';
    window.updateExportCheckboxes();
    localStorage.setItem(`specBackup_${spec.id}`, JSON.stringify(spec));
    window.updateStatus('mockup', 'ready');
    window.updateTabLoadingState('mockup', false);
    await display(finalMockupData);
    const mockupTab = document.getElementById('mockupTab');
    if (mockupTab) {
      mockupTab.classList.add('generated');
      window.checkProAccess().then((pro) => { if (pro) mockupTab.disabled = false; });
    }
    const successMsg = mockupBatchManager.failedScreens.length > 0
      ? `Generated ${mockupBatchManager.mockups.length} of ${mockupBatchManager.screens.length} mockups (${mockupBatchManager.failedScreens.length} failed)`
      : 'Mockups generated successfully!';
    window.showNotification(successMsg, mockupBatchManager.failedScreens.length > 0 ? 'warning' : 'success');
  } catch (error) {
    logError(error, { stage: 'generate', specId: window.currentSpecData?.id });
    if (container) {
      container.innerHTML = `<div class="locked-tab-message"><h3><i class="fa fa-exclamation-triangle"></i> Error Generating Mockups</h3><p>${error.message}</p>${mockupBatchManager.mockups.length > 0 ? `<p style="margin-top: 15px; color: #666;">Partial results: ${mockupBatchManager.mockups.length} mockups generated successfully.</p>` : ''}<button onclick="generateMockupSpec()" class="btn btn-primary" style="margin-top: 15px;"><i class="fa fa-refresh"></i> Try Again</button></div>`;
    }
    window.updateTabLoadingState('mockup', false);
    window.showNotification(`Failed to generate mockups: ${error.message}`, 'error');
    throw error;
  } finally {
    mockupBatchManager.isRunning = false;
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.innerHTML = '<i class="fa fa-magic"></i> Create Mockups';
    }
  }
}

export async function retry() {
  const retryMockupBtn = document.getElementById('retryMockupBtn');
  if (retryMockupBtn) {
    retryMockupBtn.disabled = true;
    retryMockupBtn.textContent = '⏳ Retrying...';
  }
  window.updateTabLoadingState('mockup', true);
  try {
    await generate();
    if (retryMockupBtn) retryMockupBtn.style.display = 'none';
  } catch (error) {
    if (retryMockupBtn) {
      retryMockupBtn.disabled = false;
      retryMockupBtn.textContent = 'Retry';
    }
    logError(error, { stage: 'retry', specId: window.currentSpecData?.id });
    window.showNotification(`Failed to generate mockups: ${error.message}`, 'error');
  } finally {
    window.updateTabLoadingState('mockup', false);
  }
}
