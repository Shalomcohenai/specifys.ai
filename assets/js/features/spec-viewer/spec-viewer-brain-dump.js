/**
 * Brain Dump: single-shot feature/change description -> 4-part result (plain text, Mermaid, full prompt, Add to main architecture for Pro)
 */

let lastBrainDumpResult = null;

function enableBrainDumpTab() {
  var tab = document.getElementById('brain-dumpTab');
  if (tab) {
    tab.disabled = false;
  }
}

function getApiBase() {
  return typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : (window.getApiBaseUrl && window.getApiBaseUrl());
}

function setBrainDumpLoading(show) {
  var loading = document.getElementById('brain-dump-loading');
  var result = document.getElementById('brain-dump-result');
  var btn = document.getElementById('brain-dump-generate-btn');
  if (loading) loading.classList.toggle('hidden', !show);
  if (result) result.classList.toggle('hidden', show);
  if (btn) btn.disabled = show;
}

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function ensureMermaidReady() {
  if (typeof mermaid !== 'undefined' && typeof mermaid.render === 'function') {
    return Promise.resolve();
  }
  if (window.mermaidManager && typeof window.mermaidManager.loadMermaid === 'function') {
    return window.mermaidManager.loadMermaid().then(function () {
      if (typeof window.mermaidManager.initialize === 'function') {
        return window.mermaidManager.initialize();
      }
    });
  }
  return Promise.resolve();
}

function renderBrainDumpMermaid(container, mermaidCode) {
  if (!container || !mermaidCode) return Promise.resolve();
  return ensureMermaidReady().then(function () {
    if (typeof mermaid === 'undefined' || !mermaid.render) {
      container.textContent = 'Diagram (Mermaid not loaded): ' + mermaidCode.substring(0, 300) + (mermaidCode.length > 300 ? '...' : '');
      return;
    }
    var uniqueId = 'brain-dump-mermaid-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    return mermaid.render(uniqueId, mermaidCode).then(function (result) {
      var wrap = document.createElement('div');
      wrap.className = 'brain-dump-mermaid-rendered';
      wrap.style.overflow = 'auto';
      wrap.innerHTML = result.svg;
      container.innerHTML = '';
      container.appendChild(wrap);
    }).catch(function (err) {
      container.textContent = 'Diagram could not be rendered. Raw code: ' + mermaidCode.substring(0, 200) + '...';
    });
  });
}

function displayBrainDumpResult(data) {
  lastBrainDumpResult = data;
  var resultEl = document.getElementById('brain-dump-result');
  if (!resultEl) return;

  var contextWrap = document.getElementById('brain-dump-context-wrap');
  var plainEl = document.getElementById('brain-dump-plain');
  var mermaidWrap = document.getElementById('brain-dump-mermaid-wrap');
  var promptWrap = document.getElementById('brain-dump-prompt-wrap');
  var fullPromptEl = document.getElementById('brain-dump-full-prompt');
  var applyWrap = document.getElementById('brain-dump-apply-wrap');
  var applyBtn = document.getElementById('brain-dump-apply-btn');

  resultEl.classList.remove('hidden');

  if (contextWrap && plainEl) {
    var hasContext = !!(data.plainText && data.plainText.trim());
    contextWrap.classList.toggle('hidden', !hasContext);
    plainEl.textContent = data.plainText || '';
  }

  if (mermaidWrap) {
    mermaidWrap.classList.add('hidden');
    mermaidWrap.innerHTML = '';
    if (data.mermaidCode && data.mermaidCode.trim()) {
      mermaidWrap.classList.remove('hidden');
      renderBrainDumpMermaid(mermaidWrap, data.mermaidCode.trim());
    }
  }

  if (fullPromptEl) {
    fullPromptEl.textContent = data.fullPrompt || '';
  }

  if (applyWrap && applyBtn) {
    applyWrap.classList.add('hidden');
    if (typeof checkProAccess === 'function') {
      checkProAccess().then(function (isPro) {
        if (isPro) {
          applyWrap.classList.remove('hidden');
        }
      });
    }
  }
}

function copyBrainDumpPromptToClipboard() {
  var el = document.getElementById('brain-dump-full-prompt');
  var text = el ? el.textContent || '' : '';
  if (!text) {
    if (typeof showNotification === 'function') showNotification('No prompt to copy', 'error');
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () {
      if (typeof showNotification === 'function') showNotification('Prompt copied to clipboard', 'success');
    }).catch(function () {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    if (typeof showNotification === 'function') showNotification('Prompt copied to clipboard', 'success');
  } catch (e) {
    if (typeof showNotification === 'function') showNotification('Copy failed', 'error');
  }
  document.body.removeChild(ta);
}

async function runBrainDumpGenerate() {
  var input = document.getElementById('brain-dump-input');
  var description = input && input.value ? input.value.trim() : '';
  if (!description) {
    if (typeof showNotification === 'function') showNotification('Please describe the feature or change', 'error');
    return;
  }
  var user = firebase.auth().currentUser;
  if (!user) {
    if (typeof showNotification === 'function') showNotification('Please log in to use Brain Dump', 'error');
    return;
  }
  if (!currentSpecData || !currentSpecData.id) {
    if (typeof showNotification === 'function') showNotification('No specification loaded', 'error');
    return;
  }

  setBrainDumpLoading(true);
  try {
    var token = await user.getIdToken();
    var res = await fetch(getApiBase() + '/api/brain-dump/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ specId: currentSpecData.id, description: description })
    });
    var data = await res.json().catch(function () { return {}; });
    setBrainDumpLoading(false);
    if (res.status === 429) {
      if (typeof showNotification === 'function') showNotification(data.error || 'Limit reached (5 per day). Try again tomorrow.', 'error');
      return;
    }
    if (!res.ok) {
      throw new Error(data.error || data.details || 'Failed to generate');
    }
    displayBrainDumpResult({
      plainText: data.plainText,
      mermaidCode: data.mermaidCode,
      fullPrompt: data.fullPrompt
    });
  } catch (err) {
    setBrainDumpLoading(false);
    if (typeof showNotification === 'function') showNotification(err.message || 'Failed to generate', 'error');
  }
}

async function runBrainDumpApplyToSpec() {
  if (!lastBrainDumpResult || !lastBrainDumpResult.plainText || !lastBrainDumpResult.fullPrompt) {
    if (typeof showNotification === 'function') showNotification('No result to apply', 'error');
    return;
  }
  if (typeof checkProAccess !== 'function') return;
  var isPro = await checkProAccess();
  if (!isPro) {
    if (typeof showNotification === 'function') showNotification('Add to main architecture is available for PRO users only', 'error');
    return;
  }
  var user = firebase.auth().currentUser;
  if (!user || !currentSpecData || !currentSpecData.id) return;

  var btn = document.getElementById('brain-dump-apply-btn');
  if (btn) btn.disabled = true;
  try {
    var token = await user.getIdToken();
    var res = await fetch(getApiBase() + '/api/brain-dump/apply-to-spec', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        specId: currentSpecData.id,
        plainText: lastBrainDumpResult.plainText,
        fullPrompt: lastBrainDumpResult.fullPrompt
      })
    });
    var data = await res.json().catch(function () { return {}; });
    if (res.status === 403) {
      if (typeof showNotification === 'function') showNotification(data.error || 'PRO users only', 'error');
      return;
    }
    if (!res.ok) {
      throw new Error(data.error || data.details || 'Failed to apply');
    }
    if (typeof showNotification === 'function') showNotification('Spec updated. Overview and technical have been updated.', 'success');
    if (typeof updateCurrentSpecData === 'function' && currentSpecData) {
      var specId = currentSpecData.id;
      var ref = firebase.firestore().collection('specs').doc(specId);
      ref.get().then(function (doc) {
        if (doc.exists) {
          var d = doc.data();
          d.id = doc.id;
          if (d.updatedAt && d.updatedAt.toDate) d.updatedAt = d.updatedAt.toDate().toISOString();
          if (d.createdAt && d.createdAt.toDate) d.createdAt = d.createdAt.toDate().toISOString();
          updateCurrentSpecData(d);
          if (typeof displaySpec === 'function') displaySpec(d);
        }
      }).catch(function () {});
    }
  } catch (err) {
    if (typeof showNotification === 'function') showNotification(err.message || 'Failed to apply', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', function () {
  var genBtn = document.getElementById('brain-dump-generate-btn');
  var input = document.getElementById('brain-dump-input');
  var copyBtn = document.querySelector('.brain-dump-copy-prompt-btn');
  var applyBtn = document.getElementById('brain-dump-apply-btn');

  if (genBtn) {
    genBtn.addEventListener('click', runBrainDumpGenerate);
  }
  if (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        runBrainDumpGenerate();
      }
    });
  }
  if (copyBtn) {
    copyBtn.addEventListener('click', copyBrainDumpPromptToClipboard);
  }
  if (applyBtn) {
    applyBtn.addEventListener('click', runBrainDumpApplyToSpec);
  }
});
