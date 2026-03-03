/**
 * Standalone MCP modal logic for spec-viewer (and any page that includes the modal HTML).
 * Uses window.auth.currentUser and window.getApiBaseUrl (or API_BASE_URL / BACKEND_URL).
 */
(function () {
  'use strict';

  function getCurrentUser() {
    return window.auth && window.auth.currentUser;
  }

  function getApiBaseUrl() {
    return (typeof window.getApiBaseUrl === 'function' && window.getApiBaseUrl()) || window.API_BASE_URL || window.BACKEND_URL || 'https://specifys-ai-backend.onrender.com';
  }

  function showToast(message) {
    if (typeof window.showSuccess === 'function') {
      window.showSuccess(message);
      return;
    }
    var t = document.createElement('div');
    t.className = 'mcp-toast';
    t.textContent = message;
    t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:8px 16px;border-radius:8px;font-size:14px;z-index:10000;animation:fadeIn 0.2s ease;';
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2500);
  }

  async function loadMcpApiKeyStatus() {
    var statusEl = document.getElementById('mcp-key-status');
    var createBtn = document.getElementById('mcp-create-key-btn');
    var regenBtn = document.getElementById('mcp-regenerate-key-btn');
    var messageEl = document.getElementById('mcp-key-message');
    var user = getCurrentUser();
    if (!statusEl) return;
    if (!user) {
      statusEl.textContent = 'Sign in to create an API key';
      if (createBtn) createBtn.style.display = 'none';
      if (regenBtn) regenBtn.style.display = 'none';
      return;
    }
    try {
      var token = await user.getIdToken();
      var apiBaseUrl = getApiBaseUrl();
      var response = await fetch(apiBaseUrl + '/api/users/me/mcp-api-key', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
      });
      if (messageEl) messageEl.style.display = 'none';
      if (response.ok) {
        var data = await response.json();
        var hasKey = data.hasKey === true;
        statusEl.textContent = hasKey ? 'You have an API key' : 'No key';
        if (createBtn) createBtn.style.display = hasKey ? 'none' : 'inline-block';
        if (regenBtn) regenBtn.style.display = hasKey ? 'inline-block' : 'none';
      } else {
        statusEl.textContent = 'Unable to check';
        if (createBtn) createBtn.style.display = 'inline-block';
        if (regenBtn) regenBtn.style.display = 'none';
      }
    } catch (e) {
      statusEl.textContent = 'Unable to check';
      if (createBtn) createBtn.style.display = 'inline-block';
      if (regenBtn) regenBtn.style.display = 'none';
    }
  }

  function updateMcpJsonConfig(apiKey) {
    var baseUrl = getApiBaseUrl();
    var pathPlaceholder = '<FULL_PATH_TO_specifys-ai/mcp-server/dist/index.js>';
    var keyValue = apiKey && apiKey.trim() ? apiKey.trim() : '<YOUR_API_KEY_FROM_THIS_PAGE>';
    var config = {
      mcpServers: {
        specifys: {
          command: 'node',
          args: [pathPlaceholder],
          env: {
            SPECIFYS_API_KEY: keyValue,
            SPECIFYS_API_BASE_URL: baseUrl
          }
        }
      }
    };
    var textarea = document.getElementById('mcp-json-config');
    if (textarea) textarea.value = JSON.stringify(config, null, 2);
  }

  function trackMcpEvent(type) {
    var user = getCurrentUser();
    if (!user) return;
    var apiBaseUrl = getApiBaseUrl();
    user.getIdToken().then(function (token) {
      fetch(apiBaseUrl + '/api/users/me/mcp-event', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: type })
      }).catch(function () {});
    }).catch(function () {});
  }

  window.openMcpModal = function () {
    var modal = document.getElementById('mcpModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
      updateMcpJsonConfig(window._mcpCurrentKeyForModal || '');
      loadMcpApiKeyStatus();
      trackMcpEvent('mcp_modal_open');
    }
  };

  window.closeMcpModal = function () {
    var modal = document.getElementById('mcpModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  };

  window.switchMcpSetupTab = function (tab) {
    var cursorTab = document.getElementById('mcp-tab-cursor');
    var claudeTab = document.getElementById('mcp-tab-claude');
    var cursorPanel = document.getElementById('mcp-setup-cursor');
    var claudePanel = document.getElementById('mcp-setup-claude');
    if (!cursorTab || !claudeTab || !cursorPanel || !claudePanel) return;
    if (tab === 'claude') {
      cursorTab.classList.remove('active');
      claudeTab.classList.add('active');
      cursorPanel.classList.add('hidden');
      claudePanel.classList.remove('hidden');
    } else {
      claudeTab.classList.remove('active');
      cursorTab.classList.add('active');
      claudePanel.classList.add('hidden');
      cursorPanel.classList.remove('hidden');
    }
  };

  window.createMcpApiKey = async function () {
    var user = getCurrentUser();
    if (!user) return;
    var messageEl = document.getElementById('mcp-key-message');
    var keyWrap = document.getElementById('mcp-key-display-wrap');
    var keyInput = document.getElementById('mcp-key-input');
    if (messageEl) messageEl.style.display = 'none';
    try {
      var token = await user.getIdToken();
      var apiBaseUrl = getApiBaseUrl();
      var response = await fetch(apiBaseUrl + '/api/users/me/mcp-api-key', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.error || 'Failed to create key');
      if (data.apiKey) {
        window._mcpCurrentKeyForModal = data.apiKey;
        if (keyInput) keyInput.value = data.apiKey;
        if (keyWrap) keyWrap.style.display = 'flex';
        updateMcpJsonConfig(data.apiKey);
        try { await navigator.clipboard.writeText(data.apiKey); } catch (_) {}
        showToast('Key created and copied to clipboard');
        loadMcpApiKeyStatus();
      }
    } catch (e) {
      if (messageEl) {
        messageEl.textContent = e.message || 'Failed to create key';
        messageEl.style.backgroundColor = '#f8d7da';
        messageEl.style.color = '#721c24';
        messageEl.style.display = 'block';
      }
    }
  };

  window.regenerateMcpApiKey = async function () {
    var user = getCurrentUser();
    if (!user) return;
    if (!confirm('A new key will replace the current one. You will need to update Cursor/Claude with the new key. Continue?')) return;
    var messageEl = document.getElementById('mcp-key-message');
    var keyWrap = document.getElementById('mcp-key-display-wrap');
    var keyInput = document.getElementById('mcp-key-input');
    if (messageEl) messageEl.style.display = 'none';
    try {
      var token = await user.getIdToken();
      var apiBaseUrl = getApiBaseUrl();
      var response = await fetch(apiBaseUrl + '/api/users/me/mcp-api-key', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate: true })
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.error || 'Failed to regenerate key');
      if (data.apiKey) {
        window._mcpCurrentKeyForModal = data.apiKey;
        if (keyInput) keyInput.value = data.apiKey;
        if (keyWrap) keyWrap.style.display = 'flex';
        updateMcpJsonConfig(data.apiKey);
        try { await navigator.clipboard.writeText(data.apiKey); } catch (_) {}
        showToast('New key created and copied');
        loadMcpApiKeyStatus();
      }
    } catch (e) {
      if (messageEl) {
        messageEl.textContent = e.message || 'Failed to regenerate key';
        messageEl.style.backgroundColor = '#f8d7da';
        messageEl.style.color = '#721c24';
        messageEl.style.display = 'block';
      }
    }
  };

  window.copyMcpKey = function () {
    var input = document.getElementById('mcp-key-input');
    if (!input || !input.value) return;
    navigator.clipboard.writeText(input.value).then(function () { showToast('Key copied'); }).catch(function () {});
  };

  window.copyMcpJson = function () {
    var textarea = document.getElementById('mcp-json-config');
    if (!textarea || !textarea.value) return;
    navigator.clipboard.writeText(textarea.value).then(function () { showToast('JSON copied'); }).catch(function () {});
  };

  if (typeof window.location !== 'undefined' && window.location.hash === '#mcp') {
    setTimeout(function () { window.openMcpModal(); }, 600);
  }
})();
