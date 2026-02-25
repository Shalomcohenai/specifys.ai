/**
 * Brain Dump: feature/change questions in spec context with "Create personal prompt" (rate limited)
 */

let brainDumpThreadId = null;
let brainDumpAssistantId = null;
let brainDumpInitialized = false;

function enableBrainDumpTab() {
    const tab = document.getElementById('brain-dumpTab');
    if (tab) {
        tab.disabled = false;
    }
}

async function retryBrainDumpOperation(operation, maxRetries = 3, initialDelay = 1000) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                const delay = initialDelay * Math.pow(2, attempt);
                await new Promise(function (r) { return setTimeout(r, delay); });
            }
        }
    }
    throw lastError;
}

async function initBrainDump() {
    if (brainDumpInitialized) {
        return;
    }
    var user = firebase.auth().currentUser;
    if (!user) {
        if (typeof showNotification === 'function') {
            showNotification('Please log in to use Brain Dump', 'error');
        }
        return;
    }
    if (!currentSpecData || !currentSpecData.id) {
        if (typeof showNotification === 'function') {
            showNotification('No specification loaded', 'error');
        }
        return;
    }
    try {
        var token = await user.getIdToken();
        var response = await retryBrainDumpOperation(function () {
            return fetch((typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : window.getApiBaseUrl && window.getApiBaseUrl()) + '/api/brain-dump/init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ specId: currentSpecData.id })
            }).then(function (res) {
                if (!res.ok) {
                    return res.json().then(function (data) { throw new Error(data.error || 'Failed to initialize Brain Dump'); });
                }
                return res.json();
            });
        });
        brainDumpThreadId = response.threadId;
        brainDumpAssistantId = response.assistantId;
        brainDumpInitialized = true;
        loadBrainDumpHistory();
    } catch (error) {
        if (typeof showNotification === 'function') {
            showNotification('Failed to initialize Brain Dump: ' + error.message, 'error');
        }
    }
}

function loadBrainDumpHistory() {
    if (!currentSpecData || !currentSpecData.id) return;
    var user = firebase.auth().currentUser;
    if (!user) return;
    var apiBase = typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : (window.getApiBaseUrl && window.getApiBaseUrl());
    user.getIdToken().then(function (token) {
        return fetch(apiBase + '/api/brain-dump/history?specId=' + encodeURIComponent(currentSpecData.id), {
            headers: { 'Authorization': 'Bearer ' + token }
        });
    }).then(function (res) {
        if (!res.ok) throw new Error('Failed to load history');
        return res.json();
    }).then(function (data) {
        var messages = data.messages || [];
        var container = document.getElementById('brain-dump-messages');
        if (!container) return;
        var welcome = container.querySelector('.brain-dump-welcome');
        if (welcome) welcome.remove();
        messages.forEach(function (msg) {
            addBrainDumpMessageToUI(msg.role, msg.content, msg.id);
        });
        container.scrollTop = container.scrollHeight;
    }).catch(function () { });
}

function addBrainDumpMessageToUI(role, content, messageId) {
    var container = document.getElementById('brain-dump-messages');
    if (!container) return;
    var welcome = container.querySelector('.brain-dump-welcome');
    if (welcome) welcome.remove();
    var wrap = document.createElement('div');
    wrap.className = 'brain-dump-message-wrap ' + role;
    var bubble = document.createElement('div');
    bubble.className = 'brain-dump-message-bubble';
    if (typeof marked !== 'undefined') {
        bubble.innerHTML = marked.parse(content);
    } else {
        bubble.textContent = content;
    }
    wrap.appendChild(bubble);
    if (role === 'assistant' && messageId) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-secondary brain-dump-create-prompt-btn';
        btn.setAttribute('data-message-id', messageId);
        btn.innerHTML = '<i class="fa fa-file-text-o"></i> Create personal prompt for this change/feature';
        btn.onclick = function () { requestPersonalPrompt(messageId); };
        wrap.appendChild(btn);
    }
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
}

function showBrainDumpLoading(show) {
    var id = 'brain-dump-loading';
    var existing = document.getElementById(id);
    if (existing) existing.remove();
    if (!show) return;
    var container = document.getElementById('brain-dump-messages');
    if (!container) return;
    var div = document.createElement('div');
    div.id = id;
    div.className = 'brain-dump-message-wrap assistant';
    div.innerHTML = '<div class="brain-dump-loading">AI is thinking...</div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

async function sendBrainDumpMessage() {
    var input = document.getElementById('brain-dump-input');
    var message = input && input.value ? input.value.trim() : '';
    if (!message) return;
    if (!brainDumpInitialized) {
        await initBrainDump();
    }
    if (!brainDumpThreadId || !brainDumpAssistantId) {
        if (typeof showNotification === 'function') {
            showNotification('Brain Dump not ready. Try again.', 'error');
        }
        return;
    }
    addBrainDumpMessageToUI('user', message, null);
    input.value = '';
    showBrainDumpLoading(true);
    try {
        var user = firebase.auth().currentUser;
        var token = await user.getIdToken();
        var apiBase = typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : (window.getApiBaseUrl && window.getApiBaseUrl());
        var res = await fetch(apiBase + '/api/brain-dump/message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                specId: currentSpecData.id,
                threadId: brainDumpThreadId,
                assistantId: brainDumpAssistantId,
                message: message
            })
        });
        var data = await res.json().catch(function () { return {}; });
        showBrainDumpLoading(false);
        if (!res.ok) {
            throw new Error(data.error || data.details || 'Failed to send message');
        }
        if (data.threadId) brainDumpThreadId = data.threadId;
        if (data.assistantId) brainDumpAssistantId = data.assistantId;
        addBrainDumpMessageToUI('assistant', data.response || '', data.messageId);
    } catch (error) {
        showBrainDumpLoading(false);
        if (typeof showNotification === 'function') {
            showNotification(error.message || 'Failed to send message', 'error');
        }
    }
}

function requestPersonalPrompt(messageId) {
    var user = firebase.auth().currentUser;
    if (!user || !currentSpecData || !currentSpecData.id) return;
    var apiBase = typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : (window.getApiBaseUrl && window.getApiBaseUrl());
    user.getIdToken().then(function (token) {
        return fetch(apiBase + '/api/brain-dump/personal-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ specId: currentSpecData.id, messageId: messageId })
        });
    }).then(function (res) {
        return res.json().then(function (data) {
            if (res.status === 429) {
                if (typeof showNotification === 'function') {
                    showNotification('Limit reached (5 personal prompts per day). Try again tomorrow.', 'error');
                }
                return;
            }
            if (!res.ok) {
                throw new Error(data.error || data.details || 'Failed to generate prompt');
            }
            openBrainDumpPromptModal(data.prompt || '');
        });
    }).catch(function (err) {
        if (typeof showNotification === 'function') {
            showNotification(err.message || 'Failed to generate prompt', 'error');
        }
    });
}

function openBrainDumpPromptModal(promptText) {
    var modal = document.getElementById('brain-dump-prompt-modal');
    var textarea = document.getElementById('brain-dump-prompt-text');
    if (modal && textarea) {
        textarea.value = promptText;
        modal.classList.remove('hidden');
    }
}

function closeBrainDumpPromptModal() {
    var modal = document.getElementById('brain-dump-prompt-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function copyBrainDumpPrompt() {
    var textarea = document.getElementById('brain-dump-prompt-text');
    if (!textarea || !textarea.value) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textarea.value).then(function () {
            if (typeof showNotification === 'function') {
                showNotification('Prompt copied to clipboard', 'success');
            }
        }).catch(function () {
            fallbackCopyBrainDumpPrompt(textarea);
        });
    } else {
        fallbackCopyBrainDumpPrompt(textarea);
    }
}

function fallbackCopyBrainDumpPrompt(textarea) {
    textarea.select();
    try {
        document.execCommand('copy');
        if (typeof showNotification === 'function') {
            showNotification('Prompt copied to clipboard', 'success');
        }
    } catch (e) {
        if (typeof showNotification === 'function') {
            showNotification('Copy failed', 'error');
        }
    }
}

document.addEventListener('DOMContentLoaded', function () {
    var sendBtn = document.getElementById('brain-dump-send-btn');
    var input = document.getElementById('brain-dump-input');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendBrainDumpMessage);
    }
    if (input) {
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendBrainDumpMessage();
            }
        });
    }
    var modal = document.getElementById('brain-dump-prompt-modal');
    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                closeBrainDumpPromptModal();
            }
        });
    }

    var originalShowTab = window.showTab;
    if (typeof originalShowTab === 'function') {
        window.showTab = function (tabName) {
            originalShowTab(tabName);
            if (tabName === 'brain-dump' && !brainDumpInitialized && currentSpecData) {
                initBrainDump();
            }
        };
    } else {
        var checkShowTab = setInterval(function () {
            if (typeof window.showTab === 'function') {
                clearInterval(checkShowTab);
                var orig = window.showTab;
                window.showTab = function (tabName) {
                    orig(tabName);
                    if (tabName === 'brain-dump' && !brainDumpInitialized && currentSpecData) {
                        initBrainDump();
                    }
                };
            }
        }, 100);
        setTimeout(function () { clearInterval(checkShowTab); }, 5000);
    }
});
