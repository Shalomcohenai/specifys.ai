// Chat functionality
let chatThreadId = null;
let chatAssistantId = null;
let chatHistory = [];
let chatInitialized = false;

// Enable chat tab after overview approval
function enableChatTab() {
    const chatTab = document.getElementById('chatTab');
    if (chatTab) {
        chatTab.disabled = false;
    }
}

/**
 * Initialize chat when tab is opened
 */
/**
 * Retry a chat operation with exponential backoff
 */
async function retryChatOperation(operation, maxRetries = 3, initialDelay = 1000) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                const delay = initialDelay * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}

async function initializeChat() {
    if (chatInitialized) {
        return; // Already initialized
    }
    
    try {
        // Don't show loading for init - it's too fast
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('Please log in to use chat');
        }
        
        if (!currentSpecData || !currentSpecData.id) {
            throw new Error('No specification loaded');
        }
        
        const token = await user.getIdToken();
        const response = await retryChatOperation(async () => {
            const res = await fetch(`${getApiBaseUrl()}/api/chat/init`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    specId: currentSpecData.id
                })
            });
            
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to initialize chat');
            }
            
            return await res.json();
        });
        
        chatThreadId = response.threadId;
        chatAssistantId = response.assistantId;
        chatInitialized = true;
        
        // Load history from localStorage
        loadChatHistory();
        
    } catch (error) {
        showNotification('Failed to initialize chat: ' + error.message, 'error');
    }
}

/**
 * Send chat message
 */
async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    if (!chatInitialized) {
        await initializeChat();
    }
    
    // Optimistic update: Add user message to UI immediately
    addChatMessage('user', message);
    input.value = '';
    
    // Save to history
    chatHistory.push({ role: 'user', content: message, timestamp: Date.now() });
    saveChatHistory();
    
    // Show loading
    showChatLoading('AI is thinking...');
    
    try {
        const user = firebase.auth().currentUser;
        const token = await user.getIdToken();
        
        const data = await retryChatOperation(async () => {
            const response = await fetch(`${getApiBaseUrl()}/api/chat/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    specId: currentSpecData.id,
                    threadId: chatThreadId,
                    assistantId: chatAssistantId,
                    message: message
                })
            });
            
            if (!response.ok) {
                let errorMessage = 'Failed to send message';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.details || errorMessage;
                    if (errorData.details) {
                        errorMessage += ': ' + errorData.details;
                    }
                } catch (e) {
                    errorMessage = `Server error (${response.status})`;
                }
                throw new Error(errorMessage);
            }
            
            return await response.json();
        }, 2, 1000);
        
        // Update thread/assistant IDs if they changed (e.g., after assistant recreation)
        if (data.threadId && data.threadId !== chatThreadId) {
            chatThreadId = data.threadId;
        }
        if (data.assistantId && data.assistantId !== chatAssistantId) {
            chatAssistantId = data.assistantId;
        }
        
        // Add assistant response to UI
        addChatMessage('assistant', data.response);
        
        // Save to history
        chatHistory.push({ role: 'assistant', content: data.response, timestamp: Date.now() });
        saveChatHistory();
        
        hideChatLoading();
        
    } catch (error) {
        // Error recovery: Try to reinitialize chat if it might be a connection issue
        if (error.message.includes('Failed to initialize') || error.message.includes('Unauthorized')) {
            chatInitialized = false;
            showNotification('Connection issue. Please try again.', 'error');
        } else {
            showNotification('Failed to send message: ' + error.message, 'error');
        }
        
        hideChatLoading();
    }
}

/**
 * Detect if text is RTL (Hebrew, Arabic, etc.)
 */
function isRTL(text) {
    if (!text || text.length === 0) return false;
    
    // Check for Hebrew characters (Unicode range: \u0590-\u05FF)
    const hebrewPattern = /[\u0590-\u05FF]/;
    // Check for Arabic characters (Unicode range: \u0600-\u06FF)
    const arabicPattern = /[\u0600-\u06FF]/;
    
    // Check if text contains RTL characters
    const hasRTLChars = hebrewPattern.test(text) || arabicPattern.test(text);
    
    // If more than 30% of characters are RTL, consider it RTL
    if (hasRTLChars) {
        const rtlChars = text.match(/[\u0590-\u05FF\u0600-\u06FF]/g);
        if (rtlChars && rtlChars.length / text.length > 0.3) {
            return true;
        }
    }
    
    // Check for RTL text content (content contains mainly Hebrew/Arabic)
    const nonWhitespaceChars = text.replace(/\s/g, '');
    if (nonWhitespaceChars.length > 0) {
        const rtlChars = nonWhitespaceChars.match(/[\u0590-\u05FF\u0600-\u06FF]/g);
        if (rtlChars && rtlChars.length / nonWhitespaceChars.length > 0.5) {
            return true;
        }
    }
    
    return false;
}

/**
 * Add message to chat UI
 */
function addChatMessage(role, content) {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    // Remove welcome message if exists
    const welcome = messagesContainer.querySelector('.chat-welcome');
    if (welcome) {
        welcome.remove();
    }
    
    // Detect text direction (only for content alignment, not message position)
    const isRTLText = isRTL(content);
    const textDir = isRTLText ? 'rtl' : 'ltr';
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    
    // Message position: always user on right, assistant on left
    messageDiv.style.alignItems = role === 'user' ? 'flex-end' : 'flex-start';
    messageDiv.style.cssText += 'margin-bottom: 16px; display: flex; flex-direction: column;';
    
    const bubble = document.createElement('div');
    bubble.className = 'chat-message-bubble';
    bubble.setAttribute('dir', textDir);
    bubble.style.cssText = 'max-width: 70%; padding: 12px 16px; border-radius: 8px; word-wrap: break-word; word-break: break-word;';
    
    if (role === 'user') {
        bubble.style.background = 'white';
        bubble.style.color = '#333';
        bubble.style.border = '1px solid #ff6b35';
    } else {
        bubble.style.background = 'white';
        bubble.style.color = '#333';
        bubble.style.border = '1px solid #ddd';
    }
    
    // Handle RTL-specific styling
    if (isRTLText) {
        bubble.style.direction = 'rtl';
        bubble.style.textAlign = 'right';
        bubble.style.unicodeBidi = 'embed';
    }
    
    // Parse markdown if available
    if (typeof marked !== 'undefined') {
        const parsedContent = marked.parse(content);
        
        // Wrap content in RTL-aware div
        if (isRTLText) {
            bubble.innerHTML = `<div dir="rtl" style="direction: rtl; text-align: right; unicode-bidi: embed;">${parsedContent}</div>`;
        } else {
            bubble.innerHTML = parsedContent;
        }
    } else {
        bubble.textContent = content;
    }
    
    const time = document.createElement('div');
    time.className = 'chat-message-time';
    time.style.cssText = 'font-size: 11px; color: #999; margin-top: 4px;';
    time.textContent = new Date().toLocaleTimeString();
    
    messageDiv.appendChild(bubble);
    messageDiv.appendChild(time);
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Show loading indicator
 */
function showChatLoading(text = 'Loading...') {
    // Check if loading already exists, if so just update it
    const existingLoading = document.getElementById('chat-loading');
    if (existingLoading) {
        const textSpan = existingLoading.querySelector('span');
        if (textSpan) {
            textSpan.textContent = text;
        }
        return;
    }
    
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message assistant';
    loadingDiv.id = 'chat-loading';
    loadingDiv.style.cssText = 'margin-bottom: 16px; display: flex; flex-direction: column; align-items: flex-start;';
    
    const loading = document.createElement('div');
    loading.className = 'chat-loading';
    loading.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: white; border-radius: 4px; border: 1px solid #ddd; max-width: 70%;';
    loading.innerHTML = `
        <span>${text}</span>
        <div class="chat-loading-dots" style="display: flex; gap: 4px;">
            <div class="chat-loading-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #ff6b35; animation: bounce 1.4s infinite ease-in-out;"></div>
            <div class="chat-loading-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #ff6b35; animation: bounce 1.4s infinite ease-in-out; animation-delay: -0.32s;"></div>
            <div class="chat-loading-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #ff6b35; animation: bounce 1.4s infinite ease-in-out; animation-delay: -0.16s;"></div>
        </div>
    `;
    
    loadingDiv.appendChild(loading);
    messagesContainer.appendChild(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Hide loading indicator
 */
function hideChatLoading() {
    const loading = document.getElementById('chat-loading');
    if (loading) {
        loading.remove();
    }
}

/**
 * Save chat history to localStorage
 */
function saveChatHistory() {
    if (currentSpecData && currentSpecData.id) {
        localStorage.setItem(`chat_${currentSpecData.id}`, JSON.stringify(chatHistory));
    }
}

/**
 * Load chat history from localStorage
 */
function loadChatHistory() {
    if (currentSpecData && currentSpecData.id) {
        const saved = localStorage.getItem(`chat_${currentSpecData.id}`);
        if (saved) {
            chatHistory = JSON.parse(saved);
            chatHistory.forEach(msg => {
                addChatMessage(msg.role, msg.content);
            });
        }
    }
}

// Add CSS for RTL support in chat messages
document.addEventListener('DOMContentLoaded', function() {
    // Add RTL-specific styles
    const style = document.createElement('style');
    style.textContent = `
        /* RTL support for chat messages */
        [dir="rtl"] {
            direction: rtl;
            text-align: right;
            unicode-bidi: embed;
        }
        
        /* Ensure proper punctuation in RTL */
        [dir="rtl"] p, [dir="rtl"] div, [dir="rtl"] span {
            direction: rtl;
            text-align: right;
        }
        
        /* Mixed content support */
        .chat-message-bubble[dir="rtl"] {
            direction: rtl;
            text-align: right;
            unicode-bidi: embed;
        }
        
        .chat-message-bubble[dir="ltr"] {
            direction: ltr;
            text-align: left;
        }
        
        /* Hebrew punctuation and quotation marks */
        [dir="rtl"] {
            font-variant-ligatures: none;
        }
        
        /* Proper handling of Hebrew quotation marks ״ ׳ - technical note for RTL support */
        [dir="rtl"]::before {
            direction: rtl;
        }
        
        /* Ensure Hebrew text is properly aligned */
        .hebrew-text, [lang="he"] {
            direction: rtl;
            text-align: right;
            unicode-bidi: embed;
        }
    `;
    document.head.appendChild(style);
});

/**
 * Clear chat history - manual reset
 */
function clearChatHistory() {
    if (currentSpecData && currentSpecData.id) {
        localStorage.removeItem(`chat_${currentSpecData.id}`);
    }
    chatHistory = [];
}

/**
 * Reset chat - clear UI and history
 */
function resetChat() {
    // Clear chat history
    clearChatHistory();
    
    // Clear chat UI
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
        messagesContainer.innerHTML = `
            <div class="chat-welcome" style="text-align: center; padding: 30px 20px; color: #666;">
                <i class="fa fa-comments" style="font-size: 48px; color: #ff6b35; margin-bottom: 15px; display: block;"></i>
                <h3 style="margin: 0 0 10px 0; color: #333;">Welcome to AI Chat</h3>
                <p style="margin: 0; color: #666;">Ask me anything about your specification. I have access to all the details and can help clarify, explain, or suggest improvements.</p>
            </div>
        `;
    }
    
    // Reset input field
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.value = '';
        chatInput.style.direction = 'ltr';
        chatInput.style.textAlign = 'left';
    }
    
    // Reset chat variables (will create new thread on next message)
    chatThreadId = null;
    chatInitialized = false;
    
    showNotification('Chat reset successfully', 'success');
}

/**
 * Auto-reset chat when spec is updated
 */
function autoResetChatOnSpecUpdate() {
    // Clear chat history when spec is updated
    clearChatHistory();
    
    // Reset chat initialization to force re-upload to OpenAI
    chatThreadId = null;
    chatInitialized = false;
    chatAssistantId = null;
    

}

// Event listeners for chat
document.addEventListener('DOMContentLoaded', function() {
    const sendBtn = document.getElementById('send-chat-btn');
    const chatInput = document.getElementById('chat-input');
    
    if (sendBtn) {
        sendBtn.addEventListener('click', sendChatMessage);
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
        
        // Auto-detect text direction and update input field
        chatInput.addEventListener('input', (e) => {
            const value = e.target.value;
            if (isRTL(value)) {
                e.target.style.direction = 'rtl';
                e.target.style.textAlign = 'right';
            } else {
                e.target.style.direction = 'ltr';
                e.target.style.textAlign = 'left';
            }
        });
    }
    
    // Initialize chat when chat tab is clicked
    const chatTab = document.getElementById('chatTab');
    if (chatTab) {
        chatTab.addEventListener('click', function() {
            if (!chatInitialized && currentSpecData) {
                initializeChat();
            }
        });
    }
});

// Update showTab to handle chat initialization (must run after showTab is defined)
if (typeof showTab !== 'undefined') {
    const originalShowTab = showTab;
    showTab = function(tabName) {
        originalShowTab(tabName);
        
        if (tabName === 'chat' && !chatInitialized && currentSpecData) {
            initializeChat();
        }
    };
} else {
    // If showTab not defined yet, wait for it
    const checkShowTab = setInterval(() => {
        if (typeof showTab !== 'undefined') {
            clearInterval(checkShowTab);
            const originalShowTab = showTab;
            showTab = function(tabName) {
                originalShowTab(tabName);
                
                if (tabName === 'chat' && !chatInitialized && currentSpecData) {
                    initializeChat();
                }
            };
        }
    }, 100);
    
    // Timeout after 5 seconds
    setTimeout(() => {
        clearInterval(checkShowTab);
    }, 5000);
}

// ===== EXPORT FUNCTIONALITY =====

/**
 * Show export inner tab
 */
function showExportTab(tabName) {
    // Hide all inner content
    document.querySelectorAll('.export-inner-content').forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.export-inner-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected content
    const content = document.getElementById(`export-${tabName}-content`);
    const tab = document.getElementById(`export-${tabName}-tab`);
    
    if (content) {
        content.classList.add('active');
        content.style.display = 'block';
    }
    
    if (tab) {
        tab.classList.add('active');
    }
}

/**
 * Check if a section exists in the spec data
 */
function sectionExists(sectionName, specData) {
    if (!specData) return false;
    
    switch(sectionName) {
        case 'overview':
            return !!(specData.overview && specData.overview.trim());
        case 'technical':
            return !!(specData.technical && specData.technical.trim() && specData.technical !== 'error');
        case 'market':
            return !!(specData.market && specData.market.trim() && specData.market !== 'error');
        case 'design':
            return !!(specData.design && specData.design.trim() && specData.design !== 'error');
        case 'diagrams':
            return !!(specData.diagrams && specData.diagrams.diagrams && Array.isArray(specData.diagrams.diagrams) && specData.diagrams.diagrams.length > 0);
        case 'prompts':
            if (specData.prompts) {
                if (typeof specData.prompts === 'object' && specData.prompts.fullPrompt) {
                    return !!(specData.prompts.fullPrompt && specData.prompts.fullPrompt.trim());
                } else if (typeof specData.prompts === 'string') {
                    return !!(specData.prompts.trim());
                }
            }
            return false;
        case 'mockups':
            return !!(specData.mockups && specData.mockups.mockups && Array.isArray(specData.mockups.mockups) && specData.mockups.mockups.length > 0);
        default:
            return false;
    }
}

/**
 * Update export checkboxes based on available sections
 */
function updateExportCheckboxes() {
    if (!currentSpecData) return;
    
    const sections = [
        { id: 'export-overview', name: 'overview' },
        { id: 'export-technical', name: 'technical' },
        { id: 'export-market', name: 'market' },
        { id: 'export-design', name: 'design' },
        { id: 'export-diagrams', name: 'diagrams' },
        { id: 'export-prompts', name: 'prompts' },
        { id: 'export-mockups', name: 'mockups' }
    ];
    
    sections.forEach(section => {
        const checkbox = document.getElementById(section.id);
        if (checkbox) {
            const exists = sectionExists(section.name, currentSpecData);
            checkbox.disabled = !exists;
            if (!exists) {
                checkbox.checked = false;
            } else {
                // Only check if it was previously checked and the section exists
                // Otherwise leave it unchecked initially
                if (!checkbox.hasAttribute('data-initialized')) {
                    checkbox.checked = true; // Default to checked for existing sections
                    checkbox.setAttribute('data-initialized', 'true');
                }
            }
        }
    });
    
    // Update select all checkbox
    updateSelectAll();
}

/**
 * Toggle all sections selection (only enabled sections)
 */
function toggleAllSections(checked, type = 'html') {
    const selector = type === 'html' ? '.html-checkbox' : '.jira-checkbox';
    const checkboxes = document.querySelectorAll(selector);
    checkboxes.forEach(checkbox => {
        // Only toggle enabled checkboxes
        if (!checkbox.disabled) {
            checkbox.checked = checked;
        }
    });
    updateSelectAll();
}

/**
 * Update select all checkbox based on individual checkboxes (only enabled ones)
 */
function updateSelectAll() {
    // Update HTML select all
    const htmlCheckboxes = document.querySelectorAll('.html-checkbox:not(:disabled)');
    const selectAllHtml = document.getElementById('select-all-html');
    if (selectAllHtml && htmlCheckboxes.length > 0) {
        const allChecked = Array.from(htmlCheckboxes).every(cb => cb.checked);
        const someChecked = Array.from(htmlCheckboxes).some(cb => cb.checked);
        selectAllHtml.checked = allChecked;
        selectAllHtml.indeterminate = someChecked && !allChecked;
    }
}

// Add event listeners to section checkboxes
document.addEventListener('DOMContentLoaded', function() {
    const checkboxes = document.querySelectorAll('.html-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateSelectAll);
    });
});

/**
 * Render Mermaid diagram to SVG
 */
async function renderMermaidToSVG(mermaidCode, diagramId) {
    if (!mermaidCode || typeof mermaidCode !== 'string' || mermaidCode.trim().length === 0) {
        return null;
    }
    
    if (typeof mermaid === 'undefined') {
        // Fallback: return code block
        return `<pre class="code-block"><code>${escapeHtml(mermaidCode)}</code></pre>`;
    }
    
    try {
        const uniqueId = `mermaid-export-${diagramId}-${Date.now()}`;
        const { svg } = await mermaid.render(uniqueId, mermaidCode);
        return svg;
    } catch (error) {
        // Error rendering Mermaid diagram
        // Fallback: return code block
        return `<pre class="code-block"><code>${escapeHtml(mermaidCode)}</code></pre>`;
    }
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Get formatted content for a section
 */
function getSectionContent(sectionName, specData) {
    switch(sectionName) {
        case 'overview':
            return specData.overview ? formatTextContent(specData.overview) : null;
        case 'technical':
            return specData.technical ? formatTextContent(specData.technical) : null;
        case 'market':
            return specData.market ? formatTextContent(specData.market) : null;
        case 'design':
            return specData.design ? formatTextContent(specData.design) : null;
        case 'diagrams':
            return specData.diagrams ? specData.diagrams : null;
        case 'prompts':
            // Prompts can be an object with fullPrompt property or a string
            if (specData.prompts) {
                if (typeof specData.prompts === 'object' && specData.prompts.fullPrompt) {
                    return formatTextContent(specData.prompts.fullPrompt);
                } else if (typeof specData.prompts === 'string') {
                    return formatTextContent(specData.prompts);
                }
            }
            return null;
        case 'mockups':
            return specData.mockups ? specData.mockups : null;
        default:
            return null;
    }
}

/**
 * Generate HTML export
 */
async function generateExport() {
    if (!currentSpecData) {
        showNotification('No specification data available', 'error');
        return;
    }
    
    // Get selected sections (only from enabled checkboxes)
    const selectedSections = [];
    const overviewCheckbox = document.getElementById('export-overview');
    const technicalCheckbox = document.getElementById('export-technical');
    const marketCheckbox = document.getElementById('export-market');
    const designCheckbox = document.getElementById('export-design');
    const diagramsCheckbox = document.getElementById('export-diagrams');
    const promptsCheckbox = document.getElementById('export-prompts');
    const mockupsCheckbox = document.getElementById('export-mockups');
    
    if (overviewCheckbox?.checked && !overviewCheckbox.disabled) selectedSections.push('overview');
    if (technicalCheckbox?.checked && !technicalCheckbox.disabled) selectedSections.push('technical');
    if (marketCheckbox?.checked && !marketCheckbox.disabled) selectedSections.push('market');
    if (designCheckbox?.checked && !designCheckbox.disabled) selectedSections.push('design');
    if (diagramsCheckbox?.checked && !diagramsCheckbox.disabled) selectedSections.push('diagrams');
    if (promptsCheckbox?.checked && !promptsCheckbox.disabled) selectedSections.push('prompts');
    if (mockupsCheckbox?.checked && !mockupsCheckbox.disabled) selectedSections.push('mockups');
    
    if (selectedSections.length === 0) {
        showNotification('Please select at least one section to export', 'error');
        return;
    }
    
    // Show progress
    const progressContainer = document.getElementById('export-progress');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const generateBtn = document.getElementById('generate-export-btn');
    
    progressContainer.style.display = 'block';
    generateBtn.disabled = true;
            generateBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Exporting...';
    
    try {
        // Step 1: Prepare content
        updateProgress(10, 'Preparing content...');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const sections = {};
        for (const section of selectedSections) {
            const content = getSectionContent(section, currentSpecData);
            if (content) {
                sections[section] = content;
            }
        }
        
        // Step 2: Render Mermaid diagrams
        updateProgress(30, 'Rendering diagrams...');
        const diagramSVGs = {};
        
        if (sections.diagrams && sections.diagrams.diagrams) {
            const diagrams = sections.diagrams.diagrams;
            for (let i = 0; i < diagrams.length; i++) {
                const diagram = diagrams[i];
                if (diagram.mermaidCode) {
                    updateProgress(30 + (i / diagrams.length) * 30, `Rendering diagram ${i + 1} of ${diagrams.length}...`);
                    const svg = await renderMermaidToSVG(diagram.mermaidCode, diagram.id || `diagram-${i}`);
                    if (svg) {
                        diagramSVGs[diagram.id || `diagram-${i}`] = {
                            svg: svg,
                            title: diagram.title || diagram.name || `Diagram ${i + 1}`,
                            description: diagram.description || ''
                        };
                    }
                }
            }
        }
        
        // Step 3: Generate HTML
        updateProgress(70, 'Generating HTML document...');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const htmlContent = generateHTMLExport(currentSpecData, sections, diagramSVGs);
        
        // Step 4: Download file
        updateProgress(90, 'Preparing download...');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        downloadHTML(htmlContent, currentSpecData.title || 'specification');
        
        updateProgress(100, 'Export completed!');
        
        setTimeout(() => {
            progressContainer.style.display = 'none';
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fa fa-file-download"></i> Export';
            showNotification('Export generated successfully!', 'success');
        }, 1000);
        
    } catch (error) {
        // Error generating export
        showNotification('Error generating export: ' + error.message, 'error');
        progressContainer.style.display = 'none';
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fa fa-file-download"></i> Export';
    }
}

/**
 * Update progress bar
 */
function updateProgress(percent, text) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    
    if (progressBar) {
        progressBar.style.width = percent + '%';
    }
    if (progressText) {
        progressText.textContent = text;
    }
}

/**
 * Generate HTML export document
 */
function generateHTMLExport(specData, sections, diagramSVGs) {
    const title = specData.title || 'App Specification';
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // Logo SVG (centered and styled)
    const logoSVG = `
        <svg width="140" height="35" xmlns="http://www.w3.org/2000/svg">
            <text x="70" y="25" font-family="Inter, sans-serif" font-size="24" font-weight="700" fill="#333" text-anchor="middle">
                Specifys<tspan fill="#FF6B35">.</tspan>AI
            </text>
        </svg>
    `;
    
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} - Specifys.ai</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #fff;
            padding: 0;
            margin: 0;
        }
        
        .export-header {
            background: #fff;
            border-bottom: 2px solid #FF6B35;
            padding: 30px 40px;
            display: flex;
            justify-content: center;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .export-logo {
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .export-meta {
            display: none;
        }
        
        .export-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px;
        }
        
        .export-title {
            font-size: 36px;
            font-weight: 700;
            color: #333;
            margin-bottom: 10px;
            border-bottom: 3px solid #FF6B35;
            padding-bottom: 15px;
        }
        
        .export-section {
            margin: 40px 0;
            page-break-inside: avoid;
        }
        
        .export-section-title {
            font-size: 28px;
            font-weight: 600;
            color: #333;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e0e0e0;
        }
        
        .export-content {
            font-size: 16px;
            line-height: 1.8;
            color: #444;
        }
        
        .export-content h1, .export-content h2, .export-content h3, .export-content h4 {
            margin-top: 25px;
            margin-bottom: 15px;
            color: #333;
        }
        
        .export-content h1 { font-size: 32px; }
        .export-content h2 { font-size: 26px; }
        .export-content h3 { font-size: 22px; }
        .export-content h4 { font-size: 18px; }
        
        .export-content p {
            margin-bottom: 15px;
        }
        
        .export-content ul, .export-content ol {
            margin-left: 30px;
            margin-bottom: 15px;
        }
        
        .export-content li {
            margin-bottom: 8px;
        }
        
        .export-content code {
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
        }
        
        .code-block {
            background: #f8f8f8;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
            overflow-x: auto;
        }
        
        .code-block code {
            background: none;
            padding: 0;
            font-size: 14px;
            line-height: 1.5;
        }
        
        .diagram-container {
            margin: 30px 0;
            padding: 20px;
            background: #fafafa;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            page-break-inside: avoid;
        }
        
        .diagram-title {
            font-size: 20px;
            font-weight: 600;
            color: #333;
            margin-bottom: 10px;
        }
        
        .diagram-description {
            color: #666;
            margin-bottom: 15px;
            font-size: 14px;
        }
        
        .diagram-svg {
            width: 100%;
            max-width: 100%;
            height: auto;
            margin: 15px 0;
        }
        
        .diagram-svg svg {
            max-width: 100%;
            height: auto;
        }
        
        @media print {
            .export-header {
                position: static;
            }
            
            .export-section {
                page-break-inside: avoid;
            }
            
            .diagram-container {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="export-header">
        <div class="export-logo">
            ${logoSVG}
        </div>
    </div>
    
    <div class="export-container">
        <h1 class="export-title">${escapeHtml(title)}</h1>`;
    
    // Add sections
    if (sections.overview) {
        html += `
        <div class="export-section">
            <h2 class="export-section-title"><i class="fa fa-book"></i> Overview</h2>
            <div class="export-content">${sections.overview}</div>
        </div>`;
    }
    
    if (sections.technical) {
        html += `
        <div class="export-section">
            <h2 class="export-section-title"><i class="fa fa-cog"></i> Technical Specification</h2>
            <div class="export-content">${sections.technical}</div>
        </div>`;
    }
    
    if (sections.market) {
        html += `
        <div class="export-section">
            <h2 class="export-section-title"><i class="fa fa-bar-chart"></i> Market Research</h2>
            <div class="export-content">${sections.market}</div>
        </div>`;
    }
    
    if (sections.design) {
        html += `
        <div class="export-section">
            <h2 class="export-section-title"><i class="fa fa-paint-brush"></i> Design & Branding</h2>
            <div class="export-content">${sections.design}</div>
        </div>`;
    }
    
    if (sections.diagrams && diagramSVGs && Object.keys(diagramSVGs).length > 0) {
        html += `
        <div class="export-section">
            <h2 class="export-section-title"><i class="fa fa-sitemap"></i> Diagrams</h2>`;
        
        for (const diagramId in diagramSVGs) {
            const diagram = diagramSVGs[diagramId];
            html += `
            <div class="diagram-container">
                <div class="diagram-title">${escapeHtml(diagram.title)}</div>
                ${diagram.description ? `<div class="diagram-description">${escapeHtml(diagram.description)}</div>` : ''}
                <div class="diagram-svg">${diagram.svg}</div>
            </div>`;
        }
        
        html += `
        </div>`;
    }
    
    if (sections.prompts) {
        html += `
        <div class="export-section">
            <h2 class="export-section-title"><i class="fa fa-terminal"></i> Development Prompts</h2>
            <div class="export-content">${sections.prompts}</div>
        </div>`;
    }
    
    if (sections.mockups && sections.mockups.mockups && Array.isArray(sections.mockups.mockups) && sections.mockups.mockups.length > 0) {
        html += `
        <div class="export-section">
            <h2 class="export-section-title"><i class="fa fa-desktop"></i> Frontend Mockups</h2>`;
        
        const mockups = sections.mockups.mockups;
        for (let i = 0; i < mockups.length; i++) {
            const mockup = mockups[i];
            const screenName = mockup.screenName || mockup.name || `Screen ${i + 1}`;
            const deviceType = mockup.deviceType || 'desktop';
            const htmlContent = mockup.html || '';
            
            html += `
            <div class="mockup-container" style="margin: 30px 0; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="background: #f8f9fa; padding: 15px 20px; border-bottom: 1px solid #e0e0e0;">
                    <h3 style="margin: 0; font-size: 20px; font-weight: 600; color: #333;">
                        ${escapeHtml(screenName)}
                        <span style="font-size: 14px; font-weight: 400; color: #666; margin-left: 10px;">(${deviceType})</span>
                    </h3>
                </div>
                <div style="padding: 20px; background: white;">
                    ${htmlContent}
                </div>
            </div>`;
        }
        
        html += `
        </div>`;
    }
    
    html += `
    </div>
</body>
</html>`;
    
    return html;
}

/**
 * Download HTML file
 */
function downloadHTML(htmlContent, filename) {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename.replace(/[^a-z0-9]/gi, '_')}_export_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Generate Jira Export
 */
async function generateJiraExport() {
    if (!currentSpecData) {
        showNotification('No specification data available', 'error');
        return;
    }
    
    const projectKey = document.getElementById('jira-project-key')?.value?.trim().toUpperCase();
    if (!projectKey) {
        showNotification('Please enter a project key', 'error');
        return;
    }
    
    const priority = document.getElementById('jira-priority')?.value || 'High';
    const labelsInput = document.getElementById('jira-labels')?.value || '';
    const labels = labelsInput.split(',').map(l => l.trim()).filter(l => l);
    
    // Show progress
    const progressContainer = document.getElementById('jira-export-progress');
    const progressBar = document.getElementById('jira-progress-bar');
    const progressText = document.getElementById('jira-progress-text');
    const generateBtn = document.getElementById('generate-jira-btn');
    
    progressContainer.style.display = 'block';
    generateBtn.disabled = true;
            generateBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Exporting...';
    
    try {
        updateJiraProgress(10, 'Preparing specification data...');
        
        // Prepare spec data for worker
        const specPayload = {
            projectKey: projectKey,
            priority: priority,
            labels: labels,
            spec: {
                title: currentSpecData.title || 'App Specification',
                overview: currentSpecData.overview,
                technical: currentSpecData.technical,
                market: currentSpecData.market,
                design: currentSpecData.design,
                diagrams: currentSpecData.diagrams
            }
        };
        
        updateJiraProgress(30, 'Sending to Jira export service...');
        
        // Call worker endpoint
        const response = await fetch('https://jiramaker.shalom-cohen-111.workers.dev/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(specPayload)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }
        
        updateJiraProgress(70, 'Processing Jira issues...');
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error.message || 'Failed to generate Jira export');
        }
        
        updateJiraProgress(90, 'Preparing download...');
        
        // Download CSV file
        downloadJiraCSV(result.csv, projectKey);
        
        updateJiraProgress(100, 'Export completed!');
        
        setTimeout(() => {
            progressContainer.style.display = 'none';
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fa fa-tasks"></i> Export';
            showNotification('Jira export generated successfully!', 'success');
        }, 1000);
        
    } catch (error) {
        // Error generating Jira export
        showNotification('Error generating Jira export: ' + error.message, 'error');
        progressContainer.style.display = 'none';
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fa fa-tasks"></i> Export';
    }
}

/**
 * Update Jira progress bar
 */
function updateJiraProgress(percent, text) {
    const progressBar = document.getElementById('jira-progress-bar');
    const progressText = document.getElementById('jira-progress-text');
    
    if (progressBar) {
        progressBar.style.width = percent + '%';
    }
    if (progressText) {
        progressText.textContent = text;
    }
}

/**
 * Download Jira CSV file
 */
function downloadJiraCSV(csvContent, projectKey) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectKey}_jira_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
