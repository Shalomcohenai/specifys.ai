let currentSpecData = null;
window.currentTab = window.currentTab || 'overview';

function isFeatureLoading(scope) {
    return !!(window.dataService && typeof window.dataService.isLoading === 'function' && window.dataService.isLoading(scope));
}

function setFeatureLoading(scope, status) {
    if (window.dataService && typeof window.dataService.setLoading === 'function') {
        window.dataService.setLoading(scope, status);
    }
}

if (typeof window.loadGeoContext === 'function') {
    window.loadGeoContext().catch(() => {});
}

async function getAuxHeaders() {
    // Deprecated path: prefer window.api.getAuthHeaders().
    if (window.api && typeof window.api.getAuthHeaders === 'function') {
        return window.api.getAuthHeaders();
    }
    const headers = { 'Content-Type': 'application/json' };
    try {
        const user = firebase?.auth?.().currentUser;
        if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
    } catch (error) {}
    return headers;
}
window.getAuxHeaders = getAuxHeaders;

// Helper function to update currentSpecData and expose it to window
function updateCurrentSpecData(newData) {
    if (window.dataService && typeof window.dataService.setSpec === 'function') {
        currentSpecData = window.dataService.setSpec(newData);
        return currentSpecData;
    }
    currentSpecData = newData;
    window.currentSpecData = currentSpecData;
    return currentSpecData;
}

/** Admin emails allowed to view debug tools (Export tab advanced row data, etc.). Keep in sync with loadSpec permission check. */
const SPECVIEWER_ADMIN_EMAILS = ['specifysai@gmail.com'];

function isSpecViewerAdmin(user) {
    return !!(user && user.email && SPECVIEWER_ADMIN_EMAILS.includes(user.email));
}

function tryParseJsonField(value) {
    if (value == null) return value;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch (e) {
        return value;
    }
}

function serializeFirestoreFieldForDebug(v) {
    if (v == null) return v;
    if (typeof v.toDate === 'function') {
        try {
            return v.toDate().toISOString();
        } catch (e) {
            return String(v);
        }
    }
    if (typeof v === 'object' && typeof v._seconds === 'number') {
        return new Date(v._seconds * 1000).toISOString();
    }
    if (typeof v === 'object' && typeof v.seconds === 'number') {
        return new Date(v.seconds * 1000).toISOString();
    }
    return v;
}

function serializeObjectForDebug(value) {
    if (Array.isArray(value)) {
        return value.map((item) => serializeObjectForDebug(item));
    }
    if (value && typeof value === 'object') {
        // Firestore Timestamp / Date-like object support
        const maybeSerialized = serializeFirestoreFieldForDebug(value);
        if (typeof maybeSerialized !== 'object' || maybeSerialized == null) {
            return maybeSerialized;
        }
        const out = {};
        Object.keys(value).forEach((key) => {
            out[key] = serializeObjectForDebug(value[key]);
        });
        return out;
    }
    return serializeFirestoreFieldForDebug(value);
}

/**
 * Build a JSON-serializable object of advanced spec fields (including diagram strings) for admin debugging.
 */
function buildAdvancedSpecDebugPayload(data) {
    if (!data || typeof data !== 'object') return {};
    const normalizedSections = {
        overview: tryParseJsonField(data.overview),
        technical: tryParseJsonField(data.technical),
        market: tryParseJsonField(data.market),
        design: tryParseJsonField(data.design),
        architecture: data.architecture,
        visibility: tryParseJsonField(data.visibility),
        prompts: tryParseJsonField(data.prompts),
        diagrams: data.diagrams,
        mockups: data.mockups,
        mindMap: data.mindMap || data.mindmap,
        brainDump: data.brainDump
    };
    return {
        metadata: {
            id: data.id,
            title: data.title,
            userId: data.userId,
            generationVersion: data.generationVersion,
            mode: data.mode,
            status: data.status,
            createdAt: serializeFirestoreFieldForDebug(data.createdAt),
            updatedAt: serializeFirestoreFieldForDebug(data.updatedAt),
            overviewApproved: data.overviewApproved,
            answers: data.answers || [],
            openaiFileId: data.openaiFileId,
            openaiUploadTimestamp: serializeFirestoreFieldForDebug(data.openaiUploadTimestamp),
            thread_id: data.thread_id
        },
        sections: normalizedSections,
        // Keep the full row data for lossless debug/download (including future fields).
        completeRowData: serializeObjectForDebug(data)
    };
}

function updateExportAdminDebugSection(user) {
    const wrap = document.getElementById('export-admin-advanced-raw');
    if (!wrap) return;
    if (isSpecViewerAdmin(user)) {
        wrap.classList.remove('hidden');
        wrap.setAttribute('aria-hidden', 'false');
    } else {
        wrap.classList.add('hidden');
        wrap.setAttribute('aria-hidden', 'true');
    }
}

function openAdvancedRawModal() {
    const modal = document.getElementById('advanced-raw-modal');
    const pre = document.getElementById('advanced-raw-json-pre');
    if (!modal || !pre) return;
    const payload = buildAdvancedSpecDebugPayload(currentSpecData);
    pre.textContent = JSON.stringify(payload, null, 2);
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
}

function downloadAdvancedRawJson() {
    const payload = buildAdvancedSpecDebugPayload(currentSpecData);
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const specId = currentSpecData?.id || 'spec';
    const dateStr = new Date().toISOString().replace(/[:]/g, '-');
    link.href = url;
    link.download = `advanced-row-data-${specId}-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function closeAdvancedRawModal() {
    const modal = document.getElementById('advanced-raw-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.style.display = 'none';
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
}

function initExportAdminAdvancedRaw() {
    const openBtn = document.getElementById('btn-open-advanced-raw-modal');
    const closeBtn = document.getElementById('advanced-raw-modal-close');
    const modal = document.getElementById('advanced-raw-modal');
    const copyBtn = document.getElementById('btn-copy-advanced-raw');
    const downloadBtn = document.getElementById('btn-download-advanced-raw');
    if (openBtn) {
        openBtn.addEventListener('click', function () {
            openAdvancedRawModal();
        });
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', function () {
            closeAdvancedRawModal();
        });
    }
    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                closeAdvancedRawModal();
            }
        });
    }
    if (copyBtn) {
        copyBtn.addEventListener('click', function () {
            const pre = document.getElementById('advanced-raw-json-pre');
            if (!pre || !pre.textContent) return;
            navigator.clipboard.writeText(pre.textContent).then(function () {
                if (typeof showNotification === 'function') {
                    showNotification('Copied to clipboard', 'success');
                }
            }).catch(function () {});
        });
    }
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function () {
            downloadAdvancedRawJson();
            if (typeof showNotification === 'function') {
                showNotification('Advanced row data downloaded', 'success');
            }
        });
    }
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeAdvancedRawModal();
        }
    });
}

// OpenAI Storage helper function
async function triggerOpenAIUploadForSpec(specId) {
    try {
        const user = firebase.auth().currentUser;
        if (!user) {

            return;
        }
        
        await window.api.post(`/api/specs/${specId}/upload-to-openai`, {});
        

    } catch (error) {

    }
}

// Function to send spec ready notification email
async function sendSpecReadyNotification(specId) {
    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            return; // User not authenticated, skip notification
        }
        
        const result = await window.api.post(`/api/specs/${specId}/send-ready-notification`, {});
        if (result && result.success) {
            // Spec ready notification sent successfully
        }
    } catch (error) {
        // Silently fail - don't interrupt user experience
        // Failed to send spec ready notification
    }
}

// Diagrams variables
let diagramsData = [];
let currentZoom = 1;
let currentPanX = 0;
let currentPanY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
const CLARIFY_SUPPORTED_TABS = new Set(['overview', 'technical', 'market', 'design']);

// Get spec ID from URL if provided
const urlParams = new URLSearchParams(window.location.search);
const urlSpecId = urlParams.get('id');



// Mobile Side Menu Toggle
function initMobileSideMenu() {
    const sideMenuToggle = document.getElementById('sideMenuToggle');
    const sideMenu = document.getElementById('sideMenu');
    const content = document.querySelector('.content');
    
    if (!sideMenuToggle || !sideMenu) return;
    
    // Create overlay for mobile
    let overlay = document.querySelector('.side-menu-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'side-menu-overlay';
        document.body.appendChild(overlay);
    }
    
    function toggleMenu() {
        const isOpen = sideMenu.classList.contains('active');
        
        if (isOpen) {
            // Close menu
            sideMenu.classList.remove('active');
            sideMenuToggle.setAttribute('aria-expanded', 'false');
            overlay.classList.remove('active');
            if (content) {
                content.classList.remove('menu-open');
            }
            // Restore scrolling - use both methods for compatibility
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.documentElement.style.overflow = '';
        } else {
            // Open menu
            sideMenu.classList.add('active');
            sideMenuToggle.setAttribute('aria-expanded', 'true');
            overlay.classList.add('active');
            if (content) {
                content.classList.add('menu-open');
            }
            // Don't prevent scrolling - allow users to scroll even with menu open
            // This provides better UX on mobile
        }
    }
    
    // Toggle button click
    sideMenuToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleMenu();
    });
    
    // Close menu when clicking overlay
    overlay.addEventListener('click', function() {
        if (sideMenu.classList.contains('active')) {
            toggleMenu();
        }
    });
    
    // Close menu when clicking outside on mobile
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
            if (sideMenu.classList.contains('active') && 
                !sideMenu.contains(e.target) && 
                !sideMenuToggle.contains(e.target)) {
                toggleMenu();
            }
        }
    });
    
    // Close menu on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && sideMenu.classList.contains('active')) {
            toggleMenu();
        }
    });
    
    // Close menu when clicking a menu item on mobile
    const menuItems = sideMenu.querySelectorAll('.side-menu-button');
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Don't close if clicking on expand submenu button
            if (e.target.closest('.side-menu-expand-sub')) {
                return;
            }
            
            if (window.innerWidth <= 768) {
                // Close menu immediately after click
                setTimeout(() => {
                    if (sideMenu.classList.contains('active')) {
                        toggleMenu();
                    }
                }, 100);
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialize mobile side menu
    initMobileSideMenu();
    registerTabManagerRenderers();
    // Initialize rename spec modal (pencil icon next to title)
    initRenameSpecModal();
    initExportAdminAdvancedRaw();
    // Initialize Firebase auth state listener
    firebase.auth().onAuthStateChanged(function(user) {
        if (!user) {
            // User must be authenticated to view specs in spec-viewer
            showError('User must be authenticated to view specifications');
            return;
        }
        
        // User is authenticated - load spec
        if (urlSpecId) {
            loadSpec(urlSpecId);
        } else {
            showError('No specification ID provided in URL');
        }
        
        // Update edit button based on PRO access
        updateEditButton();
        // Update mockup tab based on PRO access
        updateMockupTab();
        updateVisibilityEngineTab();
        
        // Check if we need to show registration modal
        checkAuthenticationStatus(user);
        
        // Update storage status when auth state changes
        if (currentSpecData) {
            updateStorageStatus();
        }
        updateExportAdminDebugSection(user);
    });
    
    // Delegated listener for overview Suggestions toggle (event delegation so it works after dynamic content)
    document.addEventListener('click', function(e) {
        const item = e.target.closest('.suggestion-item');
        if (!item) return;
        e.preventDefault();
        toggleSuggestionSelection(item);
    });
    document.addEventListener('keydown', function(e) {
        const item = e.target.closest('.suggestion-item');
        if (!item) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleSuggestionSelection(item);
        }
    });

    document.addEventListener('click', function (e) {
        const clickedInside = e.target.closest('.clarify-inline-panel, .clarify-trigger');
        if (clickedInside) return;
        document.querySelectorAll('.clarify-inline-panel').forEach(function (panel) {
            panel.classList.add('hidden');
        });
    });

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        document.querySelectorAll('.clarify-inline-panel').forEach(function (panel) {
            panel.classList.add('hidden');
        });
    });
});

// Check authentication status and show modal if needed
function checkAuthenticationStatus(user) {
    const showModal = localStorage.getItem('showRegistrationModal');
    
    if (!user && showModal === 'true') {
        showRegistrationModal();
        localStorage.removeItem('showRegistrationModal');
    }
}

// Show registration modal
function showRegistrationModal() {
    const modal = document.getElementById('registrationModal');
    if (modal) {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        modal.style.display = 'flex';

    }
}

// Close registration modal
function closeRegistrationModal() {
    const modal = document.getElementById('registrationModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
    }
}

// Continue as guest
function continueAsGuest() {
    closeRegistrationModal();
    
    // Show a notification about guest mode
    showNotification('You are now in guest mode. Your specifications will only be saved locally.', 'info');
}

// Rename spec modal
function openRenameSpecModal() {
    if (!currentSpecData || !currentSpecData.id) return;
    const modal = document.getElementById('rename-spec-modal');
    const input = document.getElementById('rename-spec-input');
    if (!modal || !input) return;
    const raw = (currentSpecData.title && String(currentSpecData.title).trim()) ? String(currentSpecData.title).trim() : '';
    input.value = (raw && raw !== 'Generating...') ? raw : 'Project Spec';
    input.focus();
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
}

function closeRenameSpecModal() {
    const modal = document.getElementById('rename-spec-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
    }
    const saveText = document.querySelector('.rename-spec-save-text');
    const spinner = document.querySelector('.rename-spec-spinner');
    if (saveText) saveText.classList.remove('hidden');
    if (spinner) spinner.classList.add('hidden');
}

async function saveRenameSpec() {
    if (!currentSpecData || !currentSpecData.id) return;
    const input = document.getElementById('rename-spec-input');
    const saveText = document.querySelector('.rename-spec-save-text');
    const spinner = document.querySelector('.rename-spec-spinner');
    if (!input) return;
    const newTitle = input.value.trim();
    if (!newTitle) {
        showNotification('Please enter a name.', 'error');
        return;
    }
    if (saveText) saveText.classList.add('hidden');
    if (spinner) spinner.classList.remove('hidden');
    try {
        await firebase.firestore().collection('specs').doc(currentSpecData.id).update({
            title: newTitle,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        updateCurrentSpecData({ ...currentSpecData, title: newTitle });
        const specTitleEl = document.getElementById('spec-title');
        if (specTitleEl) specTitleEl.textContent = newTitle;
        document.title = `${newTitle} - Specifys.ai`;
        closeRenameSpecModal();
        showNotification('Spec name updated.', 'success');
    } catch (err) {
        showNotification('Failed to update name: ' + (err.message || 'Unknown error'), 'error');
    } finally {
        if (saveText) saveText.classList.remove('hidden');
        if (spinner) spinner.classList.add('hidden');
    }
}

function initRenameSpecModal() {
    const editBtn = document.getElementById('spec-title-edit-btn');
    const modal = document.getElementById('rename-spec-modal');
    const closeBtn = document.getElementById('rename-spec-modal-close');
    const cancelBtn = document.getElementById('rename-spec-cancel-btn');
    const saveBtn = document.getElementById('rename-spec-save-btn');
    const input = document.getElementById('rename-spec-input');
    if (editBtn) editBtn.addEventListener('click', openRenameSpecModal);
    if (closeBtn) closeBtn.addEventListener('click', closeRenameSpecModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeRenameSpecModal);
    if (saveBtn) saveBtn.addEventListener('click', saveRenameSpec);
    if (input) {
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeRenameSpecModal();
            if (e.key === 'Enter') saveRenameSpec();
        });
    }
    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeRenameSpecModal();
        });
    }
}

// Show notification function
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">
                ${type === 'success' ? '<i class="fa fa-check-circle"></i>' : 
                  type === 'error' ? '<i class="fa fa-exclamation-circle"></i>' : 
                  '<i class="fa fa-info-circle"></i>'}
            </div>
            <div class="notification-text">
                <span class="notification-message">${message}</span>
            </div>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fa fa-times"></i>
            </button>
        </div>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed !important;
        bottom: 150px !important;
        left: 50% !important;
        transform: translateX(-50%) translateY(100px) !important;
        background: #FF6B35 !important;
        backdrop-filter: blur(10px) !important;
        color: #ffffff !important;
        padding: 0 !important;
        border-radius: 12px !important;
        box-shadow: 0 8px 32px rgba(0,0,0,0.12) !important;
        z-index: 10000 !important;
        font-family: 'Inter', sans-serif !important;
        font-size: 14px !important;
        max-width: 700px !important;
        width: 95% !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        animation: slideUpIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards !important;
        overflow: hidden !important;
    `;
    
    // Add CSS for notification content - update or create
    let style = document.querySelector('#notification-styles');
    if (!style) {
        style = document.createElement('style');
        style.id = 'notification-styles';
        document.head.appendChild(style);
    }
    
    style.textContent = `
        .notification {
            background: #FF6B35 !important;
            color: #ffffff !important;
        }
        
        .notification-content {
            display: flex;
            align-items: center;
            padding: 16px 20px;
            gap: 12px;
        }
        
        .notification-icon {
            font-size: 18px;
            flex-shrink: 0;
            color: #ffffff !important;
        }
        
        .notification-text {
            flex: 1;
            line-height: 1.4;
        }
        
        .notification-message {
            font-weight: 500;
            color: #ffffff !important;
        }
        
        .notification-close {
            background: none !important;
            border: none !important;
            color: #ffffff !important;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            transition: all 0.2s ease;
            flex-shrink: 0;
        }
        
        .notification-close:hover {
            background: rgba(255, 255, 255, 0.2) !important;
            color: #ffffff !important;
        }
        
        @keyframes slideUpIn {
            from {
                transform: translateX(-50%) translateY(100px);
                opacity: 0;
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
        }
        
        @keyframes slideUpOut {
            from {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
            to {
                transform: translateX(-50%) translateY(100px);
                opacity: 0;
            }
        }
        
        .notification.notification-removing {
            animation: slideUpOut 0.3s ease forwards;
        }
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 6 seconds with smooth animation
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.add('notification-removing');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, 6000);
}

async function loadSpec(specId) {
    try {
        console.log('[loadSpec] Starting to load spec:', specId);
        showLoading();
        
        

        
        if (!specId) {
            console.error('[loadSpec] No specId provided');
            throw new Error('No specification ID provided');
        }
        
        const dataService = window.dataService;
        if (!dataService || typeof dataService.loadSpec !== 'function') {
            throw new Error('DataService is not initialized');
        }

        console.log('[loadSpec] Fetching spec from DataService...');
        const { data: specData, isOwner, isAdmin } = await dataService.loadSpec(specId, {
            isAdminCheck: isSpecViewerAdmin
        });
        console.log('[loadSpec] Spec data loaded:', {
            id: specData.id || specId,
            title: specData.title,
            status: specData.status,
            hasOverview: !!specData.overview,
            hasTechnical: !!specData.technical,
            hasMarket: !!specData.market,
            hasDesign: !!specData.design
        });
        
        // Check if user has permission to view this spec
        // spec-viewer.html only shows specs to their owner or admin (not public specs)
        if (!isOwner && !isAdmin) {
            showError('You do not have permission to view this specification. You can only view specifications that you created.');
            return;
        }
        
        updateCurrentSpecData(specData);
        console.log('[loadSpec] Current spec data set, status:', currentSpecData.status);
        
        const technicalPreview = specData.technical ? specData.technical.substring(0, 200) + (specData.technical.length > 200 ? '...' : '') : 'null';
        const marketPreview = specData.market ? specData.market.substring(0, 200) + (specData.market.length > 200 ? '...' : '') : 'null';
        const designPreview = specData.design ? specData.design.substring(0, 200) + (specData.design.length > 200 ? '...' : '') : 'null';
        











        

        // Set up Firestore real-time listener for spec updates
        console.log('[loadSpec] Setting up Firestore listener...');
        dataService.subscribeSpec(specId, {
            onUpdate: (updatedData, previousData) => {
                    const previousStatus = previousData?.status || {};
                    const newStatus = updatedData.status || {};
                    
                    console.log('[Firestore Listener] Spec updated:', {
                        id: updatedData.id,
                        previousStatus: previousStatus,
                        newStatus: newStatus,
                        hasOverview: !!updatedData.overview,
                        hasTechnical: !!updatedData.technical,
                        hasMarket: !!updatedData.market,
                        hasDesign: !!updatedData.design
                    });
                    
                    // Update current spec data
                    updateCurrentSpecData(updatedData);
                    
                    // Check if overview status changed
                    const prevOverviewStatus = previousStatus.overview;
                    const newOverviewStatus = newStatus.overview;
                    if (newOverviewStatus === 'ready' && prevOverviewStatus !== 'ready' && updatedData.overview) {
                        console.log('[Firestore Listener] Overview became ready, displaying...');
                        // Hide progress bar and chat bubbles when overview is ready
                        stopProgressBar();
                        const bubblesContainer = document.getElementById('chat-bubbles-container');
                        if (bubblesContainer) {
                            bubblesContainer.style.display = 'none';
                            console.log('[Firestore Listener] Progress bar and chat bubbles hidden - overview ready');
                        }
                    } else if (newOverviewStatus === 'generating' && prevOverviewStatus !== 'generating') {
                        console.log('[Firestore Listener] Overview started generating, showing skeleton...');
                        startProgressBar();
                        // Show chat bubbles during generation
                        const bubblesContainer = document.getElementById('chat-bubbles-container');
                        if (bubblesContainer) {
                            bubblesContainer.style.display = 'flex';
                            console.log('[Firestore Listener] Chat bubbles shown - overview generating');
                        }
                    }
                    
                    // Check for status changes and update UI accordingly
                    const stages = ['technical', 'market', 'design'];
                    stages.forEach(stage => {
                        const prevStageStatus = previousStatus[stage];
                        const newStageStatus = newStatus[stage];
                        
                        // If status changed to 'ready' and we have content, update UI
                        if (newStageStatus === 'ready' && prevStageStatus !== 'ready' && updatedData[stage]) {
                            // Update notification dot
                            updateNotificationDot(stage, 'ready');
                            updateTabLoadingState(stage, false);
                            
                            // Update tab states
                            if (stage === 'technical') {
                                const technicalTab = document.getElementById('technicalTab');
                                const mindmapTab = document.getElementById('mindmapTab');
                                if (technicalTab) technicalTab.disabled = false;
                                if (mindmapTab) mindmapTab.disabled = false;
                            } else if (stage === 'market') {
                                const marketTab = document.getElementById('marketTab');
                                if (marketTab) marketTab.disabled = false;
                            } else if (stage === 'design') {
                                const designTab = document.getElementById('designTab');
                                if (designTab) designTab.disabled = false;
                                refreshTabsAfterDesignReady();
                            }
                            
                            // Update export checkboxes
                            updateExportCheckboxes();
                            // Note: Upload and "all done" notification run below when all stages including architecture are terminal (ready or error).
                            // Update progress bar based on current status
                            // Only show progress bar and bubbles if overview is still generating
                            // Once overview is ready, hide them even if other stages are generating
                            const isOverviewGenerating = newStatus.overview === 'generating';
                            if (isOverviewGenerating) {
                                console.log('[Firestore Listener] Overview still generating, starting progress bar...');
                                startProgressBar();
                                // Show chat bubbles during generation
                                const bubblesContainer = document.getElementById('chat-bubbles-container');
                                if (bubblesContainer) {
                                    bubblesContainer.style.display = 'flex';
                                    console.log('[Firestore Listener] Chat bubbles shown');
                                }
                            } else if (newStatus.overview === 'ready') {
                                // Overview is ready - hide progress bar and bubbles
                                stopProgressBar();
                                const bubblesContainer = document.getElementById('chat-bubbles-container');
                                if (bubblesContainer) {
                                    bubblesContainer.style.display = 'none';
                                    console.log('[Firestore Listener] Progress bar and chat bubbles hidden - overview ready');
                                }
                            }
                            
                            // Enable diagrams tab if technical and market are ready
                            if (newStatus.technical === 'ready' && newStatus.market === 'ready') {
                                const diagramsTab = document.getElementById('diagramsTab');
                                if (diagramsTab) {
                                    diagramsTab.disabled = false;
                                }
                            }
                        } else if (newStageStatus === 'error' && prevStageStatus !== 'error') {
                            updateNotificationDot(stage, 'error');
                            updateTabLoadingState(stage, false);
                            showNotification(`Failed to generate ${stage} specification. You can retry using the retry buttons.`, 'error');
                        } else if (newStageStatus === 'generating' && prevStageStatus !== 'generating') {
                            console.log('[Firestore Listener] Stage started generating:', stage);
                            updateNotificationDot(stage, 'generating');
                            updateTabLoadingState(stage, true);

                            // Start progress bar if not already started
                            console.log('[Firestore Listener] Starting progress bar for stage:', stage);
                            startProgressBar();
                        }
                    });

                    // Architecture: handle status changes so UI updates without refresh (dot, tab state, content, orange icon)
                    const prevArchStatus = previousStatus.architecture;
                    const newArchStatus = newStatus.architecture;
                    if (newArchStatus === 'ready' && prevArchStatus !== 'ready' && updatedData.architecture) {
                        updateNotificationDot('architecture', 'ready');
                        updateTabLoadingState('architecture', false);
                        const architectureTab = document.getElementById('architectureTab');
                        if (architectureTab) architectureTab.classList.add('generated');
                        updateExportCheckboxes();
                    } else if (newArchStatus === 'generating' && prevArchStatus !== 'generating') {
                        updateNotificationDot('architecture', 'generating');
                        updateTabLoadingState('architecture', true);
                    } else if (newArchStatus === 'error' && prevArchStatus !== 'error') {
                        updateNotificationDot('architecture', 'error');
                        updateTabLoadingState('architecture', false);
                    }

                    // Upload only after all stages (including architecture) are finished (ready or error). Enables manual retry/upload of missing parts.
                    const allStagesForUpload = ['technical', 'market', 'design', 'architecture'];
                    const allTerminal = newStatus.overview === 'ready' && allStagesForUpload.every(s => newStatus[s] === 'ready' || newStatus[s] === 'error');
                    const prevAllTerminal = previousStatus.overview === 'ready' && allStagesForUpload.every(s => previousStatus[s] === 'ready' || previousStatus[s] === 'error');
                    if (allTerminal && !prevAllTerminal && updatedData.id) {
                        const allSuccessful = allStagesForUpload.every(s => newStatus[s] === 'ready');
                        showNotification(allSuccessful
                            ? 'All specifications generated successfully!'
                            : 'Some specifications failed. You can retry failed sections or upload what exists.', allSuccessful ? 'success' : 'error');
                        hideApproveButton();
                        stopProgressBar();
                        const bubblesContainer = document.getElementById('chat-bubbles-container');
                        if (bubblesContainer) bubblesContainer.style.display = 'none';
                        dataService.stopStatusPolling();
                        triggerOpenAIUploadForSpec(updatedData.id).catch(err => console.warn('Failed to upload spec to OpenAI:', err));
                    }

                    // Update all notification dots
                    updateAllNotificationDots();
                }
            },
            onError: (error) => {
                console.error('Firestore listener error:', error);
                // Fallback to polling if listener fails
                if (!dataService.isPolling()) {
                    startSpecStatusPolling(specId);
                }
            }
        });
        
        // Start polling as backup (especially if generation is in progress)
        if (specData.status?.technical === 'generating' ||
            specData.status?.market === 'generating' ||
            specData.status?.design === 'generating' ||
            specData.status?.architecture === 'generating') {
            startSpecStatusPolling(specId);
        }
        
        console.log('[loadSpec] Calling displaySpec...');
        displaySpec(currentSpecData);
        console.log('[loadSpec] Spec loaded successfully');
        
    } catch (error) {
        console.error('[loadSpec] Error loading spec:', error);
        showError(`Error loading spec: ${error.message}`);
        showNotification('Failed to load specification. Please try again.', 'error');
    }
}

function displaySpec(data) {
    console.log('[displaySpec] Starting to display spec:', {
        id: data.id,
        title: data.title,
        status: data.status,
        hasOverview: !!data.overview,
        hasTechnical: !!data.technical,
        hasMarket: !!data.market,
        hasDesign: !!data.design,
        createdAt: data.createdAt
    });
    
    // Check if spec was just created (within last 15 seconds)
    let isRecentlyCreated = false;
    if (data.createdAt) {
        try {
            const createdAtTime = data.createdAt.toMillis ? data.createdAt.toMillis() : 
                                 data.createdAt._seconds ? data.createdAt._seconds * 1000 :
                                 new Date(data.createdAt).getTime();
            const now = Date.now();
            isRecentlyCreated = (now - createdAtTime) < 15000; // 15 seconds
            console.log('[displaySpec] Spec creation time check:', {
                createdAtTime,
                now,
                diff: now - createdAtTime,
                isRecentlyCreated
            });
        } catch (e) {
            console.warn('[displaySpec] Error checking creation time:', e);
        }
    }
    
    const technicalPreview = data.technical ? data.technical.substring(0, 200) + (data.technical.length > 200 ? '...' : '') : 'null';
    const marketPreview = data.market ? data.market.substring(0, 200) + (data.market.length > 200 ? '...' : '') : 'null';
    const designPreview = data.design ? data.design.substring(0, 200) + (data.design.length > 200 ? '...' : '') : 'null';
    



    
    // Reset chat state when switching to a different spec
    chatThreadId = null;
    chatAssistantId = null;
    chatInitialized = false;
    chatHistory = [];
    
    // Clear chat UI when switching specs
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
    
    console.log('[displaySpec] Hiding loading, showing content...');
    hideLoading();
    hideError();
    const content = document.getElementById('content');
    if (content) {
        content.style.display = 'block';
        content.classList.remove('hidden');
        console.log('[displaySpec] Content div is now visible');
    } else {
        console.error('[displaySpec] Content div not found!');
    }
    
    // Display spec title (from overview or user edit); fallback when empty or placeholder
    const raw = (data.title && String(data.title).trim()) ? String(data.title).trim() : '';
    const displayTitle = (raw && raw !== 'Generating...') ? raw : 'Project Spec';
    const specTitleElement = document.getElementById('spec-title');
    if (specTitleElement) {
        specTitleElement.textContent = displayTitle;
    }
    const specTitleEditBtn = document.getElementById('spec-title-edit-btn');
    if (specTitleEditBtn) {
        specTitleEditBtn.classList.remove('hidden');
    }
    // Show "Spec Engine v2" badge when this spec was generated with the new system
    const v2Badge = document.getElementById('spec-v2-badge');
    if (v2Badge) {
        if (data.generationVersion === 'v2') {
            v2Badge.classList.remove('hidden');
        } else {
            v2Badge.classList.add('hidden');
        }
    }
    // Browser tab title
    document.title = `${displayTitle} - Specifys.ai`;
    
        // Update status indicators
        updateStatus('overview', data.status?.overview || 'ready');
        updateStatus('technical', data.status?.technical || 'pending');
        updateStatus('market', data.status?.market || 'pending');
        
        // Update tab statuses
        setTabStatus('overviewTab', data.status?.overview === 'ready' ? 'success' : 'pending');
        setTabStatus('technicalTab', data.status?.technical === 'ready' ? 'success' : 'pending');
        setTabStatus('marketTab', data.status?.market === 'ready' ? 'success' : 'pending');
    updateStatus('design', data.status?.design || 'pending');
    updateStatus('mockup', data.status?.mockup || 'pending');
    updateStorageStatus(); // Add storage status update
    
    // Update all notification dots
    updateAllNotificationDots();
    
    // Initialize share prompt and button only when spec is ready
    // The share button is part of the frame and always visible once spec is ready
    if (data.status?.overview === 'ready' && window.sharePrompt && data.id) {
        const specTitle = data.title || 'App Specification';
        // Initialize share prompt (which also initializes the share button)
        window.sharePrompt.init(data.id, specTitle);
    }
    
    // Check if any section is still generating OR spec was just created
    const status = data.status || {};
    const isGenerating = status.overview === 'generating' || 
                        status.technical === 'generating' || 
                        status.market === 'generating' || 
                        status.design === 'generating';
    
    // Show progress bar if generating OR if spec was just created (to show new UX)
    const shouldShowProgress = isGenerating || isRecentlyCreated;
    
    console.log('[displaySpec] Generation check:', {
        isGenerating,
        isRecentlyCreated,
        shouldShowProgress,
        status: status
    });
    
    // Make sure content is visible before showing progress bar
    if (content) {
        content.style.display = 'block';
    }
    
    if (shouldShowProgress) {
        // Start progress bar after a small delay to ensure DOM is ready
        setTimeout(() => {
            console.log('[displaySpec] Starting progress bar');
            startProgressBar();
        }, 100);
        // Show chat bubbles during generation
        const bubblesContainer = document.getElementById('chat-bubbles-container');
        if (bubblesContainer) {
            bubblesContainer.style.display = 'flex';
        }
        
        // If spec was just created but overview exists, show it after a delay
        if (isRecentlyCreated && !isGenerating && data.overview) {
            console.log('[displaySpec] Spec recently created with overview, will show after delay');
            setTimeout(() => {
                console.log('[displaySpec] Stopping progress bar after delay');
                stopProgressBar();
                const bubblesContainer = document.getElementById('chat-bubbles-container');
                if (bubblesContainer) {
                    bubblesContainer.style.display = 'none';
                }
            }, 3000); // Show progress for 3 seconds even if content exists
        }
    } else {
        stopProgressBar();
        // Hide chat bubbles when generation is complete
        const bubblesContainer = document.getElementById('chat-bubbles-container');
        if (bubblesContainer) {
            bubblesContainer.style.display = 'none';
        }
    }
    
    // Display content for each tab
    console.log('[displaySpec] Displaying all sections...');
    displayOverview(data.overview);
    displayTechnical(data.technical);
    displayMarket(data.market);
    displayDesign(data.design);
    console.log('[displaySpec] All sections displayed');
    Promise.resolve(window.displayMockup?.(data.mockups)).catch(err => {
        // Error displaying mockup
    });
    displayVisibilityEngine(data.visibility, data);
    displayArchitectureFromData(data);
    displayPromptsFromData(data);
    displayRaw(data);
    updateExportAdminDebugSection(firebase.auth().currentUser);
    
    // Update export checkboxes based on available sections
    updateExportCheckboxes();
    
    // Email notifications are now sent automatically when spec is created via /api/specs/:id/record-activity
    // No need to send email here - it would trigger every time user visits the spec page
    
    // Handle approval state (include fallback for existing specs that may lack overviewApproved)
    const overviewReady = data.overviewApproved || data.status?.overview === 'ready' || data.status?.technical === 'ready';
    if (overviewReady) {
        // Enable AI Chat and Brain Dump when overview is approved or spec already has technical
        enableChatTabOnly();
        
        // Only enable other tabs if their specs are ready
        if (data.status?.technical === 'ready') {
            const technicalTab = document.getElementById('technicalTab');
            if (technicalTab) {
                technicalTab.disabled = false;
            }
            // Enable Mind Map tab when technical is ready
            const mindmapTab = document.getElementById('mindmapTab');
            if (mindmapTab) {
                mindmapTab.disabled = false;
            }
        }
        if (data.status?.market === 'ready') {
            const marketTab = document.getElementById('marketTab');
            if (marketTab) {
                marketTab.disabled = false;
            }
        }
        if (data.status?.design === 'ready') {
            const designTab = document.getElementById('designTab');
            if (designTab) {
                designTab.disabled = false;
            }
            // Enable mockup tab when design is ready (only for PRO users)
            checkProAccess().then(hasProAccess => {
                if (hasProAccess) {
                    const mockupTab = document.getElementById('mockupTab');
                    if (mockupTab) {
                        mockupTab.disabled = false;
                    }
                }
            });
        }
        updateVisibilityEngineTab();
        
        // Enable architecture only when technical is ready (overview+technical dependency model)
        if (data.status?.technical === 'ready') {
            const architectureTab = document.getElementById('architectureTab');
            if (architectureTab) architectureTab.disabled = false;
        }
        // Enable Brain Dump only after advanced specs (technical, market, design) + architecture
        const advancedAndArchitecture = data.status?.technical === 'ready' && data.status?.market === 'ready' && data.status?.design === 'ready' && (data.architecture || data.status?.architecture === 'ready');
        if (advancedAndArchitecture && typeof enableBrainDumpTab === 'function') {
            enableBrainDumpTab();
        }
        
        // Enable diagrams only if both technical and market are ready
        if (data.status?.technical === 'ready' && data.status?.market === 'ready') {
            const diagramsTab = document.getElementById('diagramsTab');
            if (diagramsTab) {
                diagramsTab.disabled = false;
            }
            // Standalone diagram generation retired; diagrams live in Technical & Architecture
            const generateDiagramsBtn = document.getElementById('generateDiagramsBtn');
            if (generateDiagramsBtn) {
                generateDiagramsBtn.style.display = 'none';
            }
        }
        
        // Enable prompts only after all spec stages are ready
        const promptsPrerequisitesReady = data.status?.technical === 'ready'
            && data.status?.market === 'ready'
            && data.status?.design === 'ready'
            && data.status?.architecture === 'ready'
            && data.status?.visibility === 'ready';
        if (promptsPrerequisitesReady) {
            const promptsTab = document.getElementById('promptsTab');
            if (promptsTab) {
                promptsTab.disabled = false;
            }
            // Show Generate only if no prompts yet
            const parsedPrompts = typeof data.prompts === 'string' ? (() => { try { return JSON.parse(data.prompts); } catch (e) { return null; } })() : data.prompts;
            const hasPrompts = !!(parsedPrompts && parsedPrompts.generated);
            const generatePromptsBtn = document.getElementById('generatePromptsBtn');
            if (generatePromptsBtn) {
                generatePromptsBtn.style.display = hasPrompts ? 'none' : 'inline-block';
            }
        }
        
        // Refresh tabs menu to ensure all tabs are properly enabled
        // This is especially important when loading a spec that already has Design ready
        if (data.status?.design === 'ready') {
            refreshTabsAfterDesignReady();
        }
        
        // Check if advanced specs were actually created
        // Only hide approval button if at least one advanced spec is ready or error
        // This ensures the modal stays visible if generation failed or was interrupted
        const technicalStatus = data.status?.technical;
        const marketStatus = data.status?.market;
        const designStatus = data.status?.design;
        
        const hasAtLeastOneSpecReady = 
            technicalStatus === 'ready' || 
            marketStatus === 'ready' || 
            designStatus === 'ready' ||
            technicalStatus === 'error' || 
            marketStatus === 'error' || 
            designStatus === 'error';
        
        if (hasAtLeastOneSpecReady) {
            // At least one spec was created, safe to hide the approval modal
            hideApproveButton();
        } else {
            // Specs are still generating or never started - keep modal visible
            // This handles the case where internet was cut during generation
            showApproveButton();
            const approvalContainer = document.getElementById('approval-container');
            if (approvalContainer) {
                approvalContainer.style.display = 'flex';
            }
            // Show a message that generation is in progress or needs to be restarted
            showNotification('Advanced specifications are still being generated. Please wait or click Approve again if generation was interrupted.', 'info');
        }
    } else {
        showApproveButton();
        disableTechnicalTabs();
        // Show approval container when overview is not approved
        const approvalContainer = document.getElementById('approval-container');
        if (approvalContainer) {
            approvalContainer.style.display = 'flex';
        }
    }
    
    // Show overview tab by default
    showTab('overview');
    
    // Initialize all subsections after content is loaded
    setTimeout(() => {
        initializeAllSubsections();
    }, 500);
    
    // Spec is already saved to Firebase from processing page
}

function registerTabManagerRenderers() {
    const tabManager = window.tabManager;
    if (!tabManager || typeof tabManager.registerRenderer !== 'function') {
        return;
    }

    tabManager.registerRenderer('overview', (spec) => displayOverview(spec?.overview));
    tabManager.registerRenderer('technical', (spec) => displayTechnical(spec?.technical));
    tabManager.registerRenderer('market', (spec) => displayMarket(spec?.market));
    tabManager.registerRenderer('design', (spec) => displayDesign(spec?.design));
    tabManager.registerRenderer('architecture', (spec) => displayArchitectureFromData(spec || currentSpecData));
    tabManager.registerRenderer('visibility-engine', (spec) => displayVisibilityEngine(spec?.visibility, spec || currentSpecData));
    tabManager.registerRenderer('prompts', (spec) => {
        if (window.promptEngine?.displayPromptsFromData) {
            window.promptEngine.displayPromptsFromData(spec || currentSpecData);
            return;
        }
        displayPromptsFromData(spec || currentSpecData);
    });
    tabManager.registerRenderer('diagrams', (spec) => {
        if (window.diagramEngine?.displayDiagramsFromData) {
            window.diagramEngine.displayDiagramsFromData(spec || currentSpecData);
            return;
        }
        displayDiagramsFromData(spec || currentSpecData);
    });
    tabManager.registerRenderer('mindmap', (spec) => {
        if (spec?.mindMap) {
            if (window.diagramEngine?.displayMindMap) {
                window.diagramEngine.displayMindMap(spec.mindMap);
                return;
            }
            displayMindMap(spec.mindMap);
        } else {
            if (window.diagramEngine?.initializeMindMapTab) {
                window.diagramEngine.initializeMindMapTab();
                return;
            }
            initializeMindMapTab();
        }
    });

    ['chat', 'brain-dump', 'raw', 'export', 'mockup'].forEach((tab) => {
        tabManager.registerRenderer(tab, () => {});
    });
}

function displayOverview(overview) {
    console.log('[displayOverview] Called with:', {
        hasOverview: !!overview,
        overviewType: typeof overview,
        overviewLength: overview ? (typeof overview === 'string' ? overview.length : 'object') : 0
    });
    
    const container = document.getElementById('overview-data');
    const headerElement = document.querySelector('#overview-content .content-header');
    
    if (!container) {
        console.error('[displayOverview] Container not found!');
        return;
    }
    
    // Check if spec was just created - show skeleton even if overview exists
    const specData = currentSpecData;
    let isRecentlyCreated = false;
    if (specData?.createdAt) {
        try {
            const createdAtTime = specData.createdAt.toMillis ? specData.createdAt.toMillis() : 
                                 specData.createdAt._seconds ? specData.createdAt._seconds * 1000 :
                                 new Date(specData.createdAt).getTime();
            const now = Date.now();
            isRecentlyCreated = (now - createdAtTime) < 15000; // 15 seconds
        } catch (e) {
            console.warn('[displayOverview] Error checking creation time:', e);
        }
    }
    
    // Check if overview is null, undefined, or empty string OR if spec was just created
    const isEmpty = !overview || (typeof overview === 'string' && overview.trim() === '');
    const shouldShowSkeleton = isEmpty || (isRecentlyCreated && specData?.status?.overview !== 'ready');
    
    if (shouldShowSkeleton) {
        console.log('[displayOverview] Showing skeleton (empty or recently created):', {
            isEmpty,
            isRecentlyCreated,
            status: specData?.status?.overview
        });
        // Show skeleton if overview is not available or spec was just created
        displaySkeleton('overview-data', 'overview');
        displaySectionLoading(headerElement, true);
        
        // If overview exists but spec is recent, show it after a delay
        if (!isEmpty && isRecentlyCreated) {
            setTimeout(() => {
                console.log('[displayOverview] Showing overview after delay');
                displaySectionLoading(headerElement, false);
                // Store original overview for editing
                window.originalOverview = overview;
                
                const uiRenderer = window.uiRenderer;
                if (uiRenderer && typeof uiRenderer.renderOverviewBody === 'function') {
                    uiRenderer.renderOverviewBody({
                        container,
                        overview,
                        formatTextContent,
                        calculateComplexityScore,
                        renderComplexityScore,
                        enhanceClarificationUI
                    });
                } else {
                    const formattedContent = formatTextContent(overview);
                    container.innerHTML = formattedContent;
                    const complexityScore = calculateComplexityScore(overview);
                    const complexityHTML = renderComplexityScore(complexityScore);
                    container.insertAdjacentHTML('beforeend', complexityHTML);
                    enhanceClarificationUI(container, 'overview');
                }
                
                // Update subsections after content is loaded
                setTimeout(() => {
                    if (window.currentTab === 'overview') {
                        updateSubsections('overview');
                    }
                }, 100);
                
                // Update raw data
                const rawOverview = document.getElementById('raw-overview');
                if (rawOverview) {
                    rawOverview.textContent = JSON.stringify(overview, null, 2);
                }
                
                // Mark tab as generated with orange icon
                const overviewTab = document.getElementById('overviewTab');
                if (overviewTab) {
                    overviewTab.classList.add('generated');
                }
                
                // Update edit button based on PRO access
                updateEditButton();
                // Update mockup tab based on PRO access
                updateMockupTab();
            }, 2000); // Show skeleton for 2 seconds
        }
        return;
    }
    
    console.log('[displayOverview] Overview has content, displaying immediately...');
    // Hide loading state
    displaySectionLoading(headerElement, false);
    
    // Store original overview for editing
    window.originalOverview = overview;
    
    const uiRenderer = window.uiRenderer;
    if (uiRenderer && typeof uiRenderer.renderOverviewBody === 'function') {
        uiRenderer.renderOverviewBody({
            container,
            overview,
            formatTextContent,
            calculateComplexityScore,
            renderComplexityScore,
            enhanceClarificationUI
        });
    } else {
        const formattedContent = formatTextContent(overview);
        container.innerHTML = formattedContent;
        const complexityScore = calculateComplexityScore(overview);
        const complexityHTML = renderComplexityScore(complexityScore);
        container.insertAdjacentHTML('beforeend', complexityHTML);
        enhanceClarificationUI(container, 'overview');
    }
    
    // Update subsections after content is loaded
    setTimeout(() => {
        if (window.currentTab === 'overview') {
            updateSubsections('overview');
        }
    }, 100);
    
    // Update raw data
    const rawOverview = document.getElementById('raw-overview');
    if (rawOverview) {
        rawOverview.textContent = JSON.stringify(overview, null, 2);
    }
    
    // Mark tab as generated with orange icon
    const overviewTab = document.getElementById('overviewTab');
    if (overviewTab) {
        overviewTab.classList.add('generated');
    }
    
    // Update edit button based on PRO access
    updateEditButton();
    // Update mockup tab based on PRO access
    updateMockupTab();
}

function calculateComplexityScore(overview) {
    // Parse overview if it's a string
    let o = overview;
    if (typeof overview === 'string') {
        try {
            o = JSON.parse(overview);
        } catch (e) {
            o = overview;
        }
    }
    
    // Handle nested structure
    if (o.overview && typeof o.overview === 'object') {
        o = o.overview;
    }
    
    // Check if complexityScore already exists from AI
    if (o.complexityScore && 
        typeof o.complexityScore.architecture === 'number' &&
        typeof o.complexityScore.integrations === 'number' &&
        typeof o.complexityScore.functionality === 'number' &&
        typeof o.complexityScore.userSystem === 'number') {
        const scores = o.complexityScore;
        const total = Math.round(
            (scores.architecture * 0.3) + 
            (scores.integrations * 0.2) + 
            (scores.functionality * 0.3) + 
            (scores.userSystem * 0.2)
        );
        return {
            architecture: scores.architecture,
            integrations: scores.integrations,
            functionality: scores.functionality,
            userSystem: scores.userSystem,
            total: total
        };
    }
    
    // Fallback calculation if AI didn't provide scores
    const ideaText = (o.ideaSummary || '').toLowerCase();
    const allText = JSON.stringify(o).toLowerCase();
    
    // 1. Architecture (0-100)
    const hasBackend = ideaText.includes('backend') || ideaText.includes('server') || 
                       ideaText.includes('api') || ideaText.includes('database') ||
                       allText.includes('backend') || allText.includes('server');
    const hasDatabase = allText.includes('database') || allText.includes('db') || 
                        allText.includes('firestore') || allText.includes('mysql') ||
                        allText.includes('postgresql') || allText.includes('mongodb');
    let architecture = 20; // Frontend only default
    if (hasBackend && hasDatabase) {
        architecture = 90; // Full stack
    } else if (hasBackend) {
        architecture = 60; // Frontend + Backend
    }
    
    // 2. Integrations (0-100)
    const integrationKeywords = ['payment', 'stripe', 'paypal', 'email', 'sendgrid', 
                                 'storage', 's3', 'cloud', 'api', 'integration', 
                                 'third-party', 'external', 'service', 'oauth',
                                 'google', 'facebook', 'twitter', 'github', 'auth0'];
    const integrationCount = integrationKeywords.filter(kw => allText.includes(kw)).length;
    const integrations = Math.min(integrationCount * 12, 100);
    
    // 3. Functionality (0-100)
    const featuresCount = o.coreFeaturesOverview?.length || 0;
    const screensCount = o.screenDescriptions?.screens?.length || 0;
    const stepsCount = o.detailedUserFlow?.steps?.length || 0;
    const functionality = Math.min(
        (featuresCount * 8) + 
        (screensCount * 5) + 
        (stepsCount * 3), 
        100
    );
    
    // 4. User System (0-100)
    const userKeywords = ['login', 'signup', 'authentication', 'user account', 'profile', 
                          'registration', 'password', 'auth', 'user', 'account',
                          'sign in', 'sign up', 'register'];
    const hasUserSystem = userKeywords.some(kw => allText.includes(kw));
    const hasAuth = allText.includes('authentication') || allText.includes('auth');
    const hasProfiles = allText.includes('profile') || allText.includes('user profile');
    
    let userSystem = 0;
    if (hasProfiles && hasAuth) {
        userSystem = 80; // Full user system
    } else if (hasAuth || hasUserSystem) {
        userSystem = 40; // Basic authentication
    }
    
    const total = Math.round(
        (architecture * 0.3) + 
        (integrations * 0.2) + 
        (functionality * 0.3) + 
        (userSystem * 0.2)
    );
    
    return {
        architecture,
        integrations,
        functionality,
        userSystem,
        total
    };
}

function renderComplexityScore(score) {
    const getColorClass = (value) => {
        if (value <= 40) return 'score-low';
        if (value <= 70) return 'score-medium';
        return 'score-high';
    };
    
    const getColor = (value) => {
        if (value <= 40) return '#10B981'; // Green
        if (value <= 70) return '#F59E0B'; // Orange
        return '#EF4444'; // Red
    };
    
    const getLevelLabel = (value) => {
        if (value <= 40) return 'Low';
        if (value <= 70) return 'Medium';
        return 'High';
    };
    
    // Calculate circular progress (SVG)
    const circumference = 2 * Math.PI * 45; // radius = 45
    const offset = circumference - (score.total / 100) * circumference;
    const totalColor = getColor(score.total);
    
    return `
        <div class="complexity-score-section">
            <div class="complexity-header">
                <h3><i class="fa fa-chart-line"></i> Complexity Score</h3>
            </div>
            
            <div class="complexity-main-display">
                <div class="total-score-circle">
                    <svg class="circular-chart" viewBox="0 0 100 100">
                        <circle class="circle-bg" cx="50" cy="50" r="45"></circle>
                        <circle 
                            class="circle-progress" 
                            cx="50" 
                            cy="50" 
                            r="45"
                            style="stroke: ${totalColor}; stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};"
                        ></circle>
                    </svg>
                    <div class="circle-content">
                        <div class="circle-score ${getColorClass(score.total)}">${score.total}</div>
                        <div class="circle-label">/ 100</div>
                        <div class="circle-level ${getColorClass(score.total)}">${getLevelLabel(score.total)}</div>
                    </div>
                </div>
                
                <div class="complexity-legend">
                    <div class="legend-item">
                        <span class="legend-color score-low"></span>
                        <span class="legend-text">Low (0-40)</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color score-medium"></span>
                        <span class="legend-text">Medium (41-70)</span>
                    </div>
                    <div class="legend-item">
                        <span class="legend-color score-high"></span>
                        <span class="legend-text">High (71-100)</span>
                    </div>
                </div>
            </div>
            
            <div class="complexity-metrics">
                <div class="metric-item" data-tooltip="Architecture complexity: Frontend only vs Full stack with backend and database">
                    <div class="metric-header">
                        <div class="metric-label">
                            <i class="fa fa-sitemap"></i>
                            <span>Architecture</span>
                        </div>
                        <div class="metric-value-wrapper">
                            <span class="metric-value ${getColorClass(score.architecture)}">${score.architecture}</span>
                            <span class="metric-level ${getColorClass(score.architecture)}">${getLevelLabel(score.architecture)}</span>
                        </div>
                    </div>
                    <div class="metric-bar-container">
                        <div class="metric-bar">
                            <div class="metric-fill ${getColorClass(score.architecture)}" style="width: ${score.architecture}%; background: ${getColor(score.architecture)};"></div>
                        </div>
                    </div>
                </div>
                
                <div class="metric-item" data-tooltip="Number of external integrations and third-party services (payment, email, storage, APIs)">
                    <div class="metric-header">
                        <div class="metric-label">
                            <i class="fa fa-plug"></i>
                            <span>Integrations</span>
                        </div>
                        <div class="metric-value-wrapper">
                            <span class="metric-value ${getColorClass(score.integrations)}">${score.integrations}</span>
                            <span class="metric-level ${getColorClass(score.integrations)}">${getLevelLabel(score.integrations)}</span>
                        </div>
                    </div>
                    <div class="metric-bar-container">
                        <div class="metric-bar">
                            <div class="metric-fill ${getColorClass(score.integrations)}" style="width: ${score.integrations}%; background: ${getColor(score.integrations)};"></div>
                        </div>
                    </div>
                </div>
                
                <div class="metric-item" data-tooltip="Functionality complexity based on number of features, screens, and user flow steps">
                    <div class="metric-header">
                        <div class="metric-label">
                            <i class="fa fa-cogs"></i>
                            <span>Functionality</span>
                        </div>
                        <div class="metric-value-wrapper">
                            <span class="metric-value ${getColorClass(score.functionality)}">${score.functionality}</span>
                            <span class="metric-level ${getColorClass(score.functionality)}">${getLevelLabel(score.functionality)}</span>
                        </div>
                    </div>
                    <div class="metric-bar-container">
                        <div class="metric-bar">
                            <div class="metric-fill ${getColorClass(score.functionality)}" style="width: ${score.functionality}%; background: ${getColor(score.functionality)};"></div>
                        </div>
                    </div>
                </div>
                
                <div class="metric-item" data-tooltip="User system complexity: authentication, user accounts, profiles, and user management">
                    <div class="metric-header">
                        <div class="metric-label">
                            <i class="fa fa-users"></i>
                            <span>User System</span>
                        </div>
                        <div class="metric-value-wrapper">
                            <span class="metric-value ${getColorClass(score.userSystem)}">${score.userSystem}</span>
                            <span class="metric-level ${getColorClass(score.userSystem)}">${getLevelLabel(score.userSystem)}</span>
                        </div>
                    </div>
                    <div class="metric-bar-container">
                        <div class="metric-bar">
                            <div class="metric-fill ${getColorClass(score.userSystem)}" style="width: ${score.userSystem}%; background: ${getColor(score.userSystem)};"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function displayTechnical(technical) {
    console.log('[displayTechnical] Called with:', {
        hasTechnical: !!technical,
        technicalType: typeof technical,
        status: currentSpecData?.status?.technical
    });
    
    const container = document.getElementById('technical-data');
    const headerElement = document.querySelector('#technical-content .content-header');
    
    if (!container) {
        console.error('[displayTechnical] Container not found!');
        return;
    }
    
    if (!technical) {
        // Check if technical is in generating state - show skeleton
        const specData = currentSpecData;
        if (specData && specData.status && specData.status.technical === 'generating') {
            console.log('[displayTechnical] Technical is generating, showing skeleton...');
            displaySkeleton('technical-data', 'technical');
            displaySectionLoading(headerElement, true);
        } else {
            console.log('[displayTechnical] Technical is locked, showing locked message...');
            container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-lock"></i> Technical Specification</h3><p>Please approve the Overview first to generate the technical specification.</p></div>';
            displaySectionLoading(headerElement, false);
        }
        return;
    }
    
    console.log('[displayTechnical] Technical has content, displaying...');
    
    if (technical === 'error') {
        container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-exclamation-triangle"></i> Error Generating Technical Specification</h3><p>There was an error generating the technical specification. Please try again.</p></div>';
        displaySectionLoading(headerElement, false);
        const retryTechnicalBtn = document.getElementById('retryTechnicalBtn');
        if (retryTechnicalBtn) {
            retryTechnicalBtn.style.display = 'inline-block';
        }
        return;
    }
    
    // Hide loading state
    displaySectionLoading(headerElement, false);
    
    const uiRenderer = window.uiRenderer;
    if (uiRenderer && typeof uiRenderer.renderTechnicalBody === 'function') {
        uiRenderer.renderTechnicalBody({
            container,
            technical,
            formatTextContent,
            enhanceClarificationUI,
            renderSpecMermaidPlaceholders: (target) => {
                if (window.diagramEngine?.renderSpecMermaidPlaceholders) {
                    window.diagramEngine.renderSpecMermaidPlaceholders(target);
                    return;
                }
                renderSpecMermaidPlaceholders(target);
            }
        });
    } else {
        const formattedContent = formatTextContent(technical);
        container.innerHTML = formattedContent;
        enhanceClarificationUI(container, 'technical');
        if (window.diagramEngine?.renderSpecMermaidPlaceholders) {
            window.diagramEngine.renderSpecMermaidPlaceholders(container);
        } else {
            renderSpecMermaidPlaceholders(container);
        }
    }

    var technicalForMinimal = technical;
    if (typeof technical === 'string') {
        try { technicalForMinimal = JSON.parse(technical); } catch (e) { technicalForMinimal = null; }
    }
    // If content appears minimal, show a short notice so user can retry
    if (isTechnicalContentMinimal(technicalForMinimal)) {
        const notice = document.createElement('div');
        notice.className = 'technical-minimal-notice';
        notice.setAttribute('role', 'alert');
        notice.style.cssText = 'margin-top: 16px; padding: 12px 16px; background: #fff8e6; border: 1px solid #f0e6c8; border-radius: 8px; font-size: 14px; color: #5c4a00;';
        notice.innerHTML = '<i class="fa fa-info-circle" aria-hidden="true"></i> Some sections may be incomplete. You can use <strong>Retry</strong> to regenerate the technical specification for fuller content.';
        container.appendChild(notice);
    }
    
    // Update subsections after content is loaded
    setTimeout(() => {
        if (window.currentTab === 'technical') {
            updateSubsections('technical');
        }
    }, 100);
    
    // Update raw data
    const rawTechnical = document.getElementById('raw-technical');
    if (rawTechnical) {
        rawTechnical.textContent = JSON.stringify(technical, null, 2);
    }
    
    // Mark tab as generated with orange icon
    const technicalTab = document.getElementById('technicalTab');
    if (technicalTab) {
        technicalTab.classList.add('generated');
    }
}

/**
 * Detect if technical spec has minimal content (missing tables, short overview, or endpoints without request/response body)
 */
function isTechnicalContentMinimal(technical) {
    if (!technical || typeof technical !== 'object') return false;
    const arch = technical.architectureOverview;
    const hasArchLegacy = typeof arch === 'string' && arch.trim().length >= 80;
    const hasArchV2 = arch && typeof arch === 'object' && typeof arch.narrative === 'string' && arch.narrative.trim().length >= 80;
    const hasArch = hasArchLegacy || hasArchV2;
    const er = technical.databaseSchema && technical.databaseSchema.erDiagramMermaid;
    const hasEr = typeof er === 'string' && er.trim().length > 20;
    const tableList = technical.databaseSchema && (technical.databaseSchema.tables || technical.databaseSchema.tablesSupplement);
    const hasTables = Array.isArray(tableList) && tableList.length >= 2;
    const hasDb = hasEr || hasTables;
    const endpoints = (technical.apiDesign && technical.apiDesign.endpoints) || technical.apiEndpoints;
    const hasEndpoints = Array.isArray(endpoints) && endpoints.length > 0;
    const endpointsComplete = hasEndpoints && endpoints.some(function (e) {
        return (e.requestBody && String(e.requestBody).trim()) || (e.responseBody && String(e.responseBody).trim());
    });
    return !hasArch || !hasDb || !hasEndpoints || !endpointsComplete;
}

function displayMarket(market) {
    console.log('[displayMarket] Called with:', {
        hasMarket: !!market,
        marketType: typeof market,
        status: currentSpecData?.status?.market
    });
    
    const container = document.getElementById('market-data');
    const headerElement = document.querySelector('#market-content .content-header');
    
    if (!container) {
        console.error('[displayMarket] Container not found!');
        return;
    }
    
    if (!market) {
        // Check if market is in generating state - show skeleton
        const specData = currentSpecData;
        if (specData && specData.status && specData.status.market === 'generating') {
            console.log('[displayMarket] Market is generating, showing skeleton...');
            displaySkeleton('market-data', 'market');
            displaySectionLoading(headerElement, true);
        } else {
            console.log('[displayMarket] Market is locked, showing locked message...');
            container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-lock"></i> Market Research</h3><p>Please approve the Overview first to generate the market research.</p></div>';
            displaySectionLoading(headerElement, false);
        }
        return;
    }
    
    console.log('[displayMarket] Market has content, displaying...');
    
    if (market === 'error') {
        container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-exclamation-triangle"></i> Error Generating Market Research</h3><p>There was an error generating the market research. Please try again.</p></div>';
        displaySectionLoading(headerElement, false);
        const retryMarketBtn = document.getElementById('retryMarketBtn');
        if (retryMarketBtn) {
            retryMarketBtn.style.display = 'inline-block';
        }
        return;
    }
    
    // Hide loading state
    displaySectionLoading(headerElement, false);
    
    // Format the market content
    const formattedContent = formatTextContent(market);
    container.innerHTML = formattedContent;
    enhanceClarificationUI(container, 'market');
    
    // Update subsections after content is loaded
    setTimeout(() => {
        if (window.currentTab === 'market') {
            updateSubsections('market');
        }
    }, 100);
    
    // Update raw data
    const rawMarket = document.getElementById('raw-market');
    if (rawMarket) {
        rawMarket.textContent = JSON.stringify(market, null, 2);
    }
    
    // Mark tab as generated with orange icon
    const marketTab = document.getElementById('marketTab');
    if (marketTab) {
        marketTab.classList.add('generated');
    }
}

// Drawflow instance
let drawflowInstance = null;
let mindMapGenerated = false;

// Initialize Mind Map tab (show placeholder or existing map)
function initializeMindMapTab() {
    const container = document.getElementById('mindmap-container');
    const generateBtn = document.getElementById('generateMindMapBtn');
    const retryBtn = document.getElementById('retryMindMapBtn');
    
    if (!currentSpecData || !currentSpecData.overview || !currentSpecData.technical) {
        container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-lock"></i> Mind Map</h3><p>Please generate Technical specification first to create the mind map.</p></div>';
        generateBtn.style.display = 'none';
        return;
    }
    
    // If mind map already generated, show it
    if (mindMapGenerated && drawflowInstance) {
        generateBtn.style.display = 'none';
        retryBtn.style.display = 'inline-block';
        return;
    }
    
    // Show placeholder with generate button
    container.innerHTML = '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-color, #666);"><i class="fa fa-project-diagram" style="font-size: 4em; margin-bottom: 20px; opacity: 0.5;"></i><h3 style="margin-bottom: 10px;">Visualize Your Product Architecture</h3><p style="text-align: center; max-width: 500px;">Click "Generate Mind Map" to create an interactive visualization of your product structure, including features, screens, variables, permissions, integrations, and user flows.</p></div>';
    generateBtn.style.display = 'inline-block';
    retryBtn.style.display = 'none';
}

// Generate Mind Map from worker
async function generateMindMap() {
    const container = document.getElementById('mindmap-container');
    const generateBtn = document.getElementById('generateMindMapBtn');
    const retryBtn = document.getElementById('retryMindMapBtn');
    
    if (!currentSpecData || !currentSpecData.overview || !currentSpecData.technical) {
        container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-lock"></i> Mind Map</h3><p>Please generate Technical specification first to create the mind map.</p></div>';
        return;
    }
    
    // Disable generate button and show loading state
    generateBtn.disabled = true;
            generateBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Exporting...';
    retryBtn.style.display = 'none';
    
    // Show loading state
    container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%;"><i class="fa fa-spinner fa-spin" style="font-size: 2em; color: var(--primary-color);"></i><span style="margin-left: 15px;">Generating mind map...</span></div>';
    
    try {
        // Worker URL
        const WORKER_URL = '/api/auxiliary/mindmap/generate';
        
        const response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: await getAuxHeaders(),
            body: JSON.stringify({
                overview: currentSpecData.overview,
                technical: currentSpecData.technical
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Worker returned ${response.status}: ${errorText || response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error.message || 'Failed to generate mind map');
        }
        
        if (!result.mindMap) {
            throw new Error('Invalid mind map data received - no mindMap field');
        }
        
        // Mind map result from worker
        
        // Display the mind map
        await displayMindMap(result.mindMap);
        
        // Mark as generated and update buttons
        mindMapGenerated = true;
        generateBtn.style.display = 'none';
        retryBtn.style.display = 'inline-block';
        
        // Mark tab as generated
        const mindmapTab = document.getElementById('mindmapTab');
        if (mindmapTab) {
            mindmapTab.classList.add('generated');
        }
        
        showNotification('Mind map generated successfully!', 'success');
        
    } catch (error) {
        // Error generating mind map
        container.innerHTML = `<div class="locked-tab-message"><h3><i class="fa fa-exclamation-triangle"></i> Error Generating Mind Map</h3><p>${error.message || 'There was an error generating the mind map. Please try again.'}</p></div>`;
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fa fa-magic"></i> Generate Mind Map';
        retryBtn.style.display = 'inline-block';
        showNotification('Failed to generate mind map. Please try again.', 'error');
    }
}

// Load Mind Map from worker (kept for retry functionality)
async function loadMindMap() {
    await generateMindMap();
}

// Load Drawflow library dynamically if not already loaded
async function ensureDrawflowLoaded() {
    if (typeof Drawflow !== 'undefined') {
        return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
        // Check if script is already being loaded
        if (document.querySelector('script[src*="drawflow"]')) {
            // Wait for it to load
            const checkInterval = setInterval(() => {
                if (typeof Drawflow !== 'undefined') {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('Drawflow library failed to load'));
            }, 10000);
        } else {
            // Load Drawflow from CDN
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/gh/jerosoler/Drawflow/dist/drawflow.min.css';
            document.head.appendChild(link);
            
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/gh/jerosoler/Drawflow/dist/drawflow.min.js';
            script.onload = () => {
                // Wait a bit for the library to fully initialize
                setTimeout(() => {
                    if (typeof Drawflow !== 'undefined') {
                        resolve();
                    } else {
                        reject(new Error('Drawflow loaded but not available'));
                    }
                }, 200);
            };
            script.onerror = () => reject(new Error('Failed to load Drawflow library from CDN. Please check your internet connection.'));
            document.head.appendChild(script);
        }
    });
}

// Convert MindElixir format to Drawflow format
function convertToDrawflow(mindElixirData) {
    if (!mindElixirData || !mindElixirData.nodeData) {
        throw new Error('Invalid MindElixir data format');
    }
    
    const drawflowData = {
        drawflow: {
            Home: {
                data: {}
            }
        }
    };
    
    let nodeId = 1;
    const nodeMap = new Map(); // Map from original id to new node id
    
    function processNode(node, parentId = null, level = 0) {
        const currentNodeId = nodeId++;
        const nodeName = node.id || `node-${currentNodeId}`;
        const nodeLabel = node.topic || node.name || 'Untitled';
        
        // Calculate position based on level and order
        const posX = 100 + (level * 300);
        const posY = 100 + ((currentNodeId - 1) * 150);
        
        const drawflowNode = {
            id: currentNodeId,
            name: nodeName,
            data: {
                label: nodeLabel
            },
            class: level === 0 ? 'product' : level === 1 ? 'category' : 'item',
            html: `<div class="title-box" style="padding: 10px; background: ${level === 0 ? '#FF6B35' : level === 1 ? '#4A90E2' : '#7B68EE'}; color: white; border-radius: 5px; text-align: center; min-width: 150px;">${nodeLabel}</div>`,
            typenode: false,
            inputs: {},
            outputs: {},
            pos_x: posX,
            pos_y: posY
        };
        
        // Add input connection if has parent
        if (parentId !== null) {
            drawflowNode.inputs = {
                input_1: {
                    connections: [{
                        node: parentId.toString(),
                        output: 'output_1'
                    }]
                }
            };
        }
        
        // Add output connections if has children
        if (node.children && node.children.length > 0) {
            drawflowNode.outputs = {
                output_1: {
                    connections: []
                }
            };
        }
        
        nodeMap.set(node.id || currentNodeId, currentNodeId);
        drawflowData.drawflow.Home.data[currentNodeId.toString()] = drawflowNode;
        
        // Process children
        if (node.children && node.children.length > 0) {
            node.children.forEach((child, index) => {
                const childNodeId = processNode(child, currentNodeId, level + 1);
                // Add connection from parent to child
                if (drawflowNode.outputs.output_1) {
                    drawflowNode.outputs.output_1.connections.push({
                        node: childNodeId.toString(),
                        input: 'input_1'
                    });
                }
            });
        }
        
        return currentNodeId;
    }
    
    // Process root node
    processNode(mindElixirData.nodeData);
    
    return drawflowData;
}

// Display Mind Map using Drawflow
async function displayMindMap(data) {
    const container = document.getElementById('mindmap-container');
    
    // Show loading state
    container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%;"><i class="fa fa-spinner fa-spin" style="font-size: 2em; color: var(--primary-color);"></i><span style="margin-left: 15px;">Loading flow diagram viewer...</span></div>';
    
    try {
        // Ensure Drawflow is loaded
        await ensureDrawflowLoaded();
        
        // Clear container
        container.innerHTML = '<div id="drawflow"></div>';
        const drawflowElement = document.getElementById('drawflow');
        
        // Initialize Drawflow
        drawflowInstance = new Drawflow(drawflowElement);
        drawflowInstance.start();
        
        // Convert data format if needed
        let drawflowData;
        // Data received
        
        if (!data) {
            throw new Error('No data received from worker');
        }
        
        // Check if data is already in Drawflow format
        if (data.drawflow && data.drawflow.Home && data.drawflow.Home.data) {
            drawflowData = data;
        } else if (data.nodeData) {
            // Convert from MindElixir format to Drawflow
            // Converting MindElixir format to Drawflow
            drawflowData = convertToDrawflow(data);
        } else {
            throw new Error(`Unknown data format. Expected drawflow or nodeData structure. Got: ${JSON.stringify(Object.keys(data))}`);
        }
        
        // Drawflow data to import
        
        // Import the data
        drawflowInstance.import(drawflowData);
        
        // Mind Map initialized successfully with Drawflow
    } catch (error) {
        // Error initializing Drawflow
        container.innerHTML = `<div class="locked-tab-message"><h3><i class="fa fa-exclamation-triangle"></i> Error Displaying Mind Map</h3><p>Failed to initialize flow diagram viewer: ${error.message}</p><p>Please refresh the page and try again.</p></div>`;
    }
}

// Retry Mind Map generation
function retryMindMap() {
    loadMindMap();
}

function displayDesign(design) {
    console.log('[displayDesign] Called with:', {
        hasDesign: !!design,
        designType: typeof design,
        status: currentSpecData?.status?.design
    });
    
    const container = document.getElementById('design-data');
    const headerElement = document.querySelector('#design-content .content-header');
    
    if (!container) {
        console.error('[displayDesign] Container not found!');
        return;
    }
    
    if (!design) {
        // Check if design is in generating state - show skeleton
        const specData = currentSpecData;
        if (specData && specData.status && specData.status.design === 'generating') {
            console.log('[displayDesign] Design is generating, showing skeleton...');
            displaySkeleton('design-data', 'design');
            displaySectionLoading(headerElement, true);
        } else {
            console.log('[displayDesign] Design is locked, showing locked message...');
            container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-lock"></i> Design & Branding</h3><p>Please approve the Overview first to generate the design specification.</p></div>';
            displaySectionLoading(headerElement, false);
        }
        return;
    }
    
    if (design === 'error') {
        console.error('[displayDesign] Design generation error');
        container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-exclamation-triangle"></i> Error Generating Design Specification</h3><p>There was an error generating the design specification. Please try again.</p></div>';
        displaySectionLoading(headerElement, false);
        const retryDesignBtn = document.getElementById('retryDesignBtn');
        if (retryDesignBtn) {
            retryDesignBtn.style.display = 'inline-block';
        }
        return;
    }
    
    console.log('[displayDesign] Design has content, displaying...');
    // Hide loading state
    displaySectionLoading(headerElement, false);
    
    // Parse design data for colors and typography (for preview buttons)
    const designData = parseDesignData(design);

    // Format the remaining design content (which includes Visual Style Guide with Color Palette)
    const formattedContent = formatTextContent(design);
    
    // Update subsections after content is loaded
    setTimeout(() => {
        if (window.currentTab === 'design') {
            updateSubsections('design');
        }
    }, 100);

    // Build Preview buttons HTML to insert within Visual Style Guide
    let previewButtonsHTML = '';
    if (Object.keys(designData.colors).length > 0) {
        previewButtonsHTML = '<div style="text-align: center; margin: 20px 0;">';
        previewButtonsHTML += '<div style="display: inline-flex; gap: 15px; flex-wrap: wrap; justify-content: center;">';
        previewButtonsHTML += '<button class="btn btn-primary" onclick="openVisualizer(\'mobile\')" style="padding: 12px 24px; background: #FF6B35; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(255, 107, 53, 0.2);">';
        previewButtonsHTML += '<i class="fa fa-mobile" style="font-size: 18px; color: white;"></i>';
        previewButtonsHTML += '<span>Mobile Preview</span>';
        previewButtonsHTML += '</button>';
        previewButtonsHTML += '<button class="btn btn-primary" onclick="openVisualizer(\'web\')" style="padding: 12px 24px; background: #FF6B35; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(255, 107, 53, 0.2);">';
        previewButtonsHTML += '<i class="fa fa-desktop" style="font-size: 18px; color: white;"></i>';
        previewButtonsHTML += '<span>Web Preview</span>';
        previewButtonsHTML += '</button>';
        previewButtonsHTML += '</div>';
        previewButtonsHTML += '</div>';
    }

    // Add preview buttons after Visual Style Guide section
    let finalContent = formattedContent;
    if (previewButtonsHTML) {
        finalContent += previewButtonsHTML;
    }

    // Set the final content
    container.innerHTML = finalContent;
    enhanceClarificationUI(container, 'design');
    
    // Update raw data
    const rawDesign = document.getElementById('raw-design');
    if (rawDesign) {
        rawDesign.textContent = JSON.stringify(design, null, 2);
    }
    
    // Mark tab as generated with orange icon
    const designTab = document.getElementById('designTab');
    if (designTab) {
        designTab.classList.add('generated');
    }
}

function parseDesignData(designContent) {
    const result = {
        colors: {},
        typography: {},
        colorHarmony: '',
        colorReasoning: ''
    };
    

    
    try {
        let content = designContent;
        
        // Try to parse as JSON first
        let jsonData;
        try {
            jsonData = JSON.parse(designContent);

            
            // FIRST TRY: jsonData is already the design object (from generateDesignSpec)
            if (jsonData.visualStyleGuide) {
                if (jsonData.visualStyleGuide.colorHarmony) {
                    result.colorHarmony = jsonData.visualStyleGuide.colorHarmony;
                }
                if (jsonData.visualStyleGuide.colorReasoning) {
                    result.colorReasoning = jsonData.visualStyleGuide.colorReasoning;
                }
                // Extract colors from JSON (object map or semicolon-separated string)
                if (jsonData.visualStyleGuide.colors) {
                    const colorsObj = normalizeVisualStyleGuideColors(jsonData.visualStyleGuide.colors);
                    Object.entries(colorsObj).forEach(([key, value]) => {
                        const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
                        result.colors[capitalizedKey] = value;
                    });
                }
                // Extract typography from JSON
                if (jsonData.visualStyleGuide.typography) {
                    const typographyObj = jsonData.visualStyleGuide.typography;
                    if (typeof typographyObj === 'object' && typographyObj !== null && !Array.isArray(typographyObj)) {
                        Object.entries(typographyObj).forEach(([key, value]) => {
                            const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
                            result.typography[capitalizedKey] = value;
                        });
                    }
                }

                return result;
            }
            // FALLBACK: jsonData has nested structure jsonData.design.visualStyleGuide
            else if (jsonData.design && jsonData.design.visualStyleGuide) {
                if (jsonData.design.visualStyleGuide.colorHarmony) {
                    result.colorHarmony = jsonData.design.visualStyleGuide.colorHarmony;
                }
                if (jsonData.design.visualStyleGuide.colorReasoning) {
                    result.colorReasoning = jsonData.design.visualStyleGuide.colorReasoning;
                }
                // Extract colors from JSON (object map or semicolon-separated string)
                if (jsonData.design.visualStyleGuide.colors) {
                    const colorsObj = normalizeVisualStyleGuideColors(jsonData.design.visualStyleGuide.colors);
                    Object.entries(colorsObj).forEach(([key, value]) => {
                        const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
                        result.colors[capitalizedKey] = value;
                    });
                }
                // Extract typography from JSON
                if (jsonData.design.visualStyleGuide.typography) {
                    const typographyObj = jsonData.design.visualStyleGuide.typography;
                    if (typeof typographyObj === 'object' && typographyObj !== null && !Array.isArray(typographyObj)) {
                        Object.entries(typographyObj).forEach(([key, value]) => {
                            const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
                            result.typography[capitalizedKey] = value;
                        });
                    }
                }

                return result;
            }
        } catch (e) {

            // Not JSON, continue with text parsing
        }
        
        if (typeof designContent === 'string') {
            content = designContent;
        }
        
        // Extract colors using multiple patterns
        const colorPatterns = [
            /Colors?:\s*([\s\S]*?)(?=Typography|$)/i,
            /Color\s+Palette:\s*([\s\S]*?)(?=Typography|$)/i,
            /Primary:\s*(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})/i,
            /Secondary:\s*(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})/i,
            /Accent:\s*(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})/i,
            /Background:\s*(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})/i,
            /Text:\s*(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})/i
        ];
        
        colorPatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
                if (pattern.source.includes('Colors?:') || pattern.source.includes('Color\\s+Palette:')) {
                    const colorText = matches[1];
                    const colorLines = colorText.split('\n');
                    
                    colorLines.forEach(line => {
                        const match = line.match(/^\s*([^:]+):\s*(#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3})/);
                        if (match) {
                            const name = match[1].trim();
                            const code = match[2].trim();
                            result.colors[name] = code;
                        }
                    });
                } else {
                    const match = content.match(pattern);
                    if (match) {
                        const name = pattern.source.match(/([^:]+):/)[1].trim();
                        const code = match[1];
                        result.colors[name] = code;
                    }
                }
            }
        });
        
        // Extract typography using multiple patterns
        const typographyPatterns = [
            /Typography:\s*([\s\S]*?)(?=\n\n|$)/i,
            /Font\s+Family:\s*([\s\S]*?)(?=\n\n|$)/i,
            /Headings?:\s*([^,\n]+(?:,\s*[^,\n]+)*)/i,
            /Body:\s*([^,\n]+(?:,\s*[^,\n]+)*)/i,
            /Captions?:\s*([^,\n]+(?:,\s*[^,\n]+)*)/i
        ];
        
        typographyPatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
                if (pattern.source.includes('Typography:') || pattern.source.includes('Font\\s+Family:')) {
                    const typographyText = matches[1];
                    const typographyLines = typographyText.split('\n');
                    
                    typographyLines.forEach(line => {
                        const match = line.match(/^\s*([^:]+):\s*(.+)$/);
                        if (match) {
                            const name = match[1].trim();
                            const value = match[2].trim();
                            result.typography[name] = value;
                        }
                    });
                } else {
                    const match = content.match(pattern);
                    if (match) {
                        const name = pattern.source.match(/([^:]+):/)[1].trim();
                        const value = match[1].trim();
                        result.typography[name] = value;
                    }
                }
            }
        });
        
        // Fallback defaults if no colors/typography found
        if (Object.keys(result.colors).length === 0) {

            result.colors = {
                'Primary': '#4CAF50',
                'Secondary': '#FF9800',
                'Accent': '#2196F3',
                'Background': '#FFFFFF',
                'Text': '#212121'
            };
        } else {

        }
        
        if (Object.keys(result.typography).length === 0) {
            result.typography = {
                'Headings': 'Roboto, Bold, 24px',
                'Body': 'Roboto, Regular, 16px',
                'Captions': 'Roboto, Italic, 12px'
            };
        }
        
    } catch (error) {

        // Use fallback defaults
        result.colors = {
            'Primary': '#4CAF50',
            'Secondary': '#FF9800',
            'Accent': '#2196F3',
            'Background': '#FFFFFF',
            'Text': '#212121'
        };
        result.typography = {
            'Headings': 'Roboto, Bold, 24px',
            'Body': 'Roboto, Regular, 16px',
            'Captions': 'Roboto, Italic, 12px'
        };
    }
    
    return result;
}

// REMOVED: getTypographyStyle() - Function was never called/used

// REMOVED: copyToClipboard() - Function was never called/used

function openVisualizer(type) {
    const modal = document.getElementById('color-visualizer-modal');
    const title = document.getElementById('viz-title');
    const mobileTemplate = document.getElementById('mobile-template');
    const webTemplate = document.getElementById('web-template');
    
    // Check if elements exist before accessing them
    if (!modal || !title || !mobileTemplate || !webTemplate) {
        // Color visualizer modal elements not found
        return;
    }
    
    // Hide all templates
    mobileTemplate.style.display = 'none';
    webTemplate.style.display = 'none';
    
    if (type === 'mobile') {
        title.textContent = 'Mobile App Preview';
        mobileTemplate.style.display = 'block';
        applyColorsToTemplate('mobile');
    } else {
        title.textContent = 'Web App Preview';
        webTemplate.style.display = 'block';
        applyColorsToTemplate('web');
    }
    
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    modal.style.display = 'flex';
}

function applyColorsToTemplate(type) {
    const designData = parseDesignData(currentSpecData.design);
    const colors = designData.colors;
    const typography = designData.typography;
    

    
    const template = type === 'mobile' ? 
        document.getElementById('mobile-template') : 
        document.getElementById('web-template');
    
    // Check if template exists before accessing it
    if (!template) {
        // Template element not found
        return;
    }
    
    // Helper function to get color value case-insensitive
    const getColor = (name) => {
        // Try with capitalized first
        return colors[name] || colors[name.charAt(0).toUpperCase() + name.slice(1)] || 
               colors[name.toLowerCase()] || colors[name.toUpperCase()] ||
               // Fallback based on name
               (name === 'Primary' ? '#4CAF50' : 
                name === 'Secondary' ? '#FF9800' : 
                name === 'Accent' ? '#2196F3' : 
                name === 'Background' ? '#FFFFFF' : '#212121');
    };
    
    // Replace all colors
    template.style.setProperty('--primary-color', getColor('Primary'));
    template.style.setProperty('--secondary-color', getColor('Secondary'));
    template.style.setProperty('--accent-color', getColor('Accent'));
    template.style.setProperty('--background-color', getColor('Background'));
    template.style.setProperty('--text-color', getColor('Text'));
    
    // Replace all fonts
    template.style.setProperty('--heading-font', typography.Headings || 'Roboto, Bold, 24px');
    template.style.setProperty('--body-font', typography.Body || 'Roboto, Regular, 16px');
    template.style.setProperty('--caption-font', typography.Captions || 'Roboto, Italic, 12px');
}

function closeVisualizer() {
    const modal = document.getElementById('color-visualizer-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
    }
}

// Close the modal when clicking outside
document.addEventListener('click', function(e) {
    const modal = document.getElementById('color-visualizer-modal');
    if (e.target === modal) {
        closeVisualizer();
    }
});

// Close the modal with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeVisualizer();
    }
});

function getVisibilityEngineSignals(data) {
    const overview = tryParseJsonField(data?.overview) || {};
    const market = tryParseJsonField(data?.market) || {};
    const hasCoreMessaging = !!(overview.ideaSummary || overview.problemStatement || overview.valueProposition);
    const hasAudience = !!(overview.targetAudience || market.targetAudienceInsights);
    const hasCompetition = Array.isArray(market.competitiveLandscape) && market.competitiveLandscape.length > 0;
    const hasVisualStyle = !!(tryParseJsonField(data?.design)?.visualStyleGuide);
    const hasJourney = !!(overview.userJourneySummary || (overview.detailedUserFlow && Array.isArray(overview.detailedUserFlow.steps)));
    const hasProofPoints = Array.isArray(overview.coreFeaturesOverview) && overview.coreFeaturesOverview.length > 1;
    const hasArchitectureContext = !!(tryParseJsonField(data?.technical)?.architectureOverview || data?.architecture);

    return {
        hasCoreMessaging,
        hasAudience,
        hasCompetition,
        hasVisualStyle,
        hasJourney,
        hasProofPoints,
        hasArchitectureContext
    };
}

function buildReadinessMetricRows(signals) {
    return {
        seo: [
            { label: 'Messaging clarity', score: signals.hasCoreMessaging ? 95 : 40 },
            { label: 'Audience definition', score: signals.hasAudience ? 90 : 35 },
            { label: 'Content structure seed', score: signals.hasJourney ? 80 : 45 },
            { label: 'Site architecture hints', score: signals.hasArchitectureContext ? 70 : 35 }
        ],
        aio: [
            { label: 'Entity candidates', score: signals.hasCoreMessaging ? 90 : 35 },
            { label: 'Comparison context', score: signals.hasCompetition ? 85 : 30 },
            { label: 'Machine-readable facts', score: signals.hasProofPoints ? 65 : 25 },
            { label: 'Evidence coverage', score: signals.hasProofPoints ? 60 : 20 }
        ],
        brand: [
            { label: 'Voice baseline', score: signals.hasCoreMessaging ? 75 : 45 },
            { label: 'Style system', score: signals.hasVisualStyle ? 82 : 35 },
            { label: 'Consistency constraints', score: signals.hasCoreMessaging ? 68 : 30 },
            { label: 'Editorial confidence', score: signals.hasAudience ? 70 : 35 }
        ]
    };
}

function averageMetricScore(rows) {
    const total = rows.reduce((sum, row) => sum + row.score, 0);
    return Math.round(total / rows.length);
}

function getReadinessLevel(score) {
    if (score >= 75) return 'Strong';
    if (score >= 55) return 'Good';
    if (score >= 40) return 'Moderate';
    return 'Low';
}

function renderReadinessBreakdown(rows) {
    return `<ul class="visibility-breakdown-list">${rows.map((row) => `
        <li>
            <span class="visibility-breakdown-label">${escapeHtmlSpec(row.label)}</span>
            <span class="visibility-breakdown-score">${row.score}</span>
        </li>
    `).join('')}</ul>`;
}

function renderVisibilityReadinessCards(signals) {
    const metrics = buildReadinessMetricRows(signals);
    const seoScore = averageMetricScore(metrics.seo);
    const aioScore = averageMetricScore(metrics.aio);
    const brandScore = averageMetricScore(metrics.brand);
    const cards = [
        {
            title: 'SEO readiness',
            value: seoScore,
            level: getReadinessLevel(seoScore),
            rationale: signals.hasCoreMessaging ? 'Core positioning exists and can seed information architecture.' : 'Core messaging is still partial.',
            rows: metrics.seo
        },
        {
            title: 'AIO readiness',
            value: aioScore,
            level: getReadinessLevel(aioScore),
            rationale: signals.hasCompetition ? 'Competitor context can seed entity comparisons.' : 'Entity and comparison facts are still limited.',
            rows: metrics.aio
        },
        {
            title: 'Brand readiness',
            value: brandScore,
            level: getReadinessLevel(brandScore),
            rationale: signals.hasVisualStyle ? 'Visual style exists and can seed a voice kit.' : 'Voice kit will rely on defaults until brand rules are provided.',
            rows: metrics.brand
        }
    ];

    return `<div class="visibility-readiness-grid">${cards.map((card) => `
        <div class="visibility-readiness-card content-section">
            <h3><i class="fa fa-signal"></i> ${escapeHtmlSpec(card.title)}</h3>
            <div class="visibility-score-row">
                <span class="visibility-score-value">${card.value}</span>
                <span class="visibility-score-unit">/100</span>
                <span class="visibility-score-level">${escapeHtmlSpec(card.level)}</span>
            </div>
            <div class="visibility-score-bar"><div class="visibility-score-fill" style="width: ${card.value}%;"></div></div>
            <p>${escapeHtmlSpec(card.rationale)}</p>
            ${renderReadinessBreakdown(card.rows)}
        </div>
    `).join('')}</div>`;
}

function createMermaidPlaceholderHtml(code) {
    return `<div class="spec-mermaid-placeholder" data-spec-mermaid="${encodeURIComponent(code)}"></div>`;
}

function buildVisibilityEngineHtml(data) {
    const overview = tryParseJsonField(data?.overview) || {};
    const market = tryParseJsonField(data?.market) || {};
    const design = tryParseJsonField(data?.design) || {};
    const signals = getVisibilityEngineSignals(data);
    const primaryAudience = market?.targetAudienceInsights?.primaryAudience?.description || overview?.targetAudience?.sector || 'Digital product teams and founders';
    const brandTone = design?.visualStyleGuide ? 'Professional, clear, and technical.' : 'Professional and direct.';
    const competitorName = market?.competitiveLandscape?.[0]?.name || 'Main competitor';
    const competitorNames = (Array.isArray(market?.competitiveLandscape) ? market.competitiveLandscape : [])
        .map((item) => item && item.name)
        .filter(Boolean)
        .slice(0, 3);
    const topCompetitors = competitorNames.length ? competitorNames : [competitorName];
    const productName = data?.title || 'Your Product';
    const coreFeatures = Array.isArray(overview?.coreFeaturesOverview) ? overview.coreFeaturesOverview.slice(0, 4) : [];
    const featureEvidence = coreFeatures.length ? coreFeatures : ['Core features and user outcomes from your spec'];
    const topPainPoint = market?.targetAudienceInsights?.primaryAudience?.painPoints || overview?.problemStatement || 'Audience friction and unmet needs';
    const industry = market?.industryOverview?.trends || 'Your category';
    const longDescription = (overview.ideaSummary || overview.problemStatement || '').slice(0, 220);
    const topicPillars = [
        `${productName} use cases`,
        `${productName} workflows`,
        `${productName} vs alternatives`,
        `Best practices for ${productName}`
    ];
    const clusterTitles = [
        `How to get started with ${productName} in 10 minutes`,
        `${productName} setup mistakes and how to avoid them`,
        `${productName} for teams: workflow and collaboration guide`,
        `${productName} vs ${topCompetitors[0]}: feature-by-feature comparison`,
        `Advanced tips for power users of ${productName}`,
        `The ultimate checklist before publishing with ${productName}`
    ];

    const lifecycleMermaid = [
        'flowchart LR',
        '  specData[SpecifysOutput] --> phase1[Phase1_PreBuildStrategy]',
        '  phase1 --> readiness[ReadinessAndGaps]',
        '  readiness --> phase2[Phase2_PostLaunchOptimization]',
        '  phase2 --> impact[VisibilityImpactLoop]'
    ].join('\n');

    const entityMermaid = [
        'flowchart TD',
        '  org[Organization] --> product[Product]',
        '  product --> problem[ProblemSolved]',
        '  product --> audience[PrimaryAudience]',
        '  product --> proof[ProofPoints]',
        '  product --> competitor[CompetitorComparison]'
    ].join('\n');

    const programmaticMermaid = [
        'flowchart LR',
        '  dataSources[DataSources] --> templateEngine[TemplateEngine]',
        '  templateEngine --> qualityChecks[QualityChecks]',
        '  qualityChecks --> publishPlan[PublishPlan]',
        '  publishPlan --> monitorLoop[MonitorAndRefresh]'
    ].join('\n');

    return `
        <div class="content-section">
            <h3><i class="fa fa-info-circle"></i> SEO vs AIO Foundations</h3>
            <p><strong>SEO</strong> focuses on crawlability, indexation, structure, and ranking in traditional search engines.</p>
            <p><strong>AIO</strong> focuses on making your product facts machine-readable so AI systems can cite your brand accurately.</p>
            <p>This module combines both into one operational workflow with explicit pre-build and post-launch stages.</p>
        </div>
        ${renderVisibilityReadinessCards(signals)}
        <div class="content-section">
            <h3><i class="fa fa-random"></i> Product Lifecycle (Two Phases)</h3>
            ${createMermaidPlaceholderHtml(lifecycleMermaid)}
        </div>
        <div class="content-section">
            <h3><i class="fa fa-rocket"></i> Phase 1: Before Build (Strategy Blueprint)</h3>
            <p><span class="visibility-source-pill derived">Derived from your spec</span> Audience seed: ${escapeHtmlSpec(primaryAudience)}</p>
            <p><span class="visibility-source-pill template">Best-practice template</span> Generate <code>llms.txt</code> and <code>ai-info.txt</code> starter files for AI agents.</p>
            <p><span class="visibility-source-pill template">Best-practice template</span> Build a pillar/cluster map with intent tags (TOFU, MOFU, BOFU).</p>
            <p><span class="visibility-source-pill live">Needs live data</span> Final URL-level title/H1/meta recommendations after launch.</p>
        </div>
        <div class="content-section">
            <h3><i class="fa fa-sitemap"></i> Topic Cluster &amp; Pillar Map (SEO)</h3>
            <p><span class="visibility-source-pill derived">Derived from your spec</span> Industry context: ${escapeHtmlSpec(industry)}</p>
            <div class="visibility-two-col">
                <div>
                    <h4>Pillar pages</h4>
                    <ul>${topicPillars.map((pillar) => `<li>${escapeHtmlSpec(pillar)}</li>`).join('')}</ul>
                </div>
                <div>
                    <h4>Long-tail clusters</h4>
                    <ul>${clusterTitles.map((title) => `<li>${escapeHtmlSpec(title)}</li>`).join('')}</ul>
                </div>
            </div>
            <p><strong>Internal linking logic:</strong> each cluster article links back to one pillar and one conversion page, while pillar pages cross-link to 2-3 related clusters.</p>
        </div>
        <div class="content-section">
            <h3><i class="fa fa-sitemap"></i> AI Knowledge Base Schema (AIO)</h3>
            ${createMermaidPlaceholderHtml(entityMermaid)}
            <pre class="visibility-jsonld-preview">{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "${escapeHtmlSpec(productName)}",
  "audience": "${escapeHtmlSpec(primaryAudience)}",
  "description": "${escapeHtmlSpec(longDescription)}",
  "problemSolved": "${escapeHtmlSpec(topPainPoint)}",
  "competitor": "${escapeHtmlSpec(topCompetitors.join(', '))}",
  "evidence": [
    ${featureEvidence.map((feature) => `"${escapeHtmlSpec(feature)}"`).join(',\n    ')}
  ]
}</pre>
        </div>
        <div class="content-section">
            <h3><i class="fa fa-comments"></i> Voice of Brand Prompt Kit</h3>
            <p><strong>Style guide prompt:</strong> Write in the brand voice for ${escapeHtmlSpec(productName)}. Tone: ${escapeHtmlSpec(brandTone)} Explain concrete user outcomes and use specific examples from product workflows.</p>
            <p><strong>Negative constraints:</strong> avoid hype phrases, avoid unverifiable superlatives, avoid words like "revolutionary", "game-changing", "unleash", and "best-in-class".</p>
            <div class="visibility-two-col">
                <div>
                    <h4>Do use</h4>
                    <ul>
                        <li>Direct, short sentences</li>
                        <li>Feature plus user outcome framing</li>
                        <li>Clear calls to action</li>
                    </ul>
                </div>
                <div>
                    <h4>Do not use</h4>
                    <ul>
                        <li>Generic AI marketing language</li>
                        <li>Claims without evidence</li>
                        <li>Long abstract paragraphs</li>
                    </ul>
                </div>
            </div>
        </div>
        <div class="content-section">
            <h3><i class="fa fa-cubes"></i> Programmatic SEO Blueprint</h3>
            ${createMermaidPlaceholderHtml(programmaticMermaid)}
            <p>Template family example: <code>[Product] vs [Competitor]</code> pages with mandatory unique evidence blocks.</p>
            <div class="visibility-programmatic-table-wrap">
                <table class="visibility-programmatic-table">
                    <thead>
                        <tr>
                            <th>Template</th>
                            <th>Data source</th>
                            <th>Unique value rule</th>
                            <th>Quality gate</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${escapeHtmlSpec(productName)} vs ${escapeHtmlSpec(topCompetitors[0])}</td>
                            <td>Feature matrix + user outcomes</td>
                            <td>At least 3 differentiators per page</td>
                            <td>No duplicated body sections over 40%</td>
                        </tr>
                        <tr>
                            <td>${escapeHtmlSpec(productName)} for [UseCase]</td>
                            <td>Audience pain points + workflow steps</td>
                            <td>Use-case specific examples</td>
                            <td>Minimum one concrete scenario per page</td>
                        </tr>
                        <tr>
                            <td>[Problem] solved with ${escapeHtmlSpec(productName)}</td>
                            <td>Support FAQs + product capabilities</td>
                            <td>Problem-specific action checklist</td>
                            <td>Clear CTA and non-generic conclusion</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div class="content-section">
            <h3><i class="fa fa-satellite-dish"></i> Phase 2: After Launch (Live Optimization)</h3>
            <p>Upgrade from strategy to execution by connecting live URLs, crawl findings, and internal link graph signals.</p>
            <p>Deliverables: page-level metadata fixes, sitemap checks, and AI-citation consistency validation.</p>
        </div>
        <div class="content-section">
            <h3><i class="fa fa-lock"></i> Pro Access</h3>
            <p>Non-Pro users see a preview. Pro users unlock full generation, copy-ready assets, and phase-by-phase action plans.</p>
        </div>
    `;
}

async function displayVisibilityEngine(visibilityData, specContext = {}) {
    const container = document.getElementById('visibility-engine-data');
    if (!container) return;
    const hasProAccess = await checkProAccess();
    if (!hasProAccess) {
        container.innerHTML = `
            <div class="locked-tab-message">
                <h3><i class="fa fa-lock"></i> AIO &amp; SEO Visibility Engine</h3>
                <p>This module is available for PRO users. Upgrade to unlock full SEO and AIO planning outputs.</p>
                <p class="visibility-locked-preview">Preview includes readiness explanation, while export-ready assets remain locked.</p>
            </div>
        `;
        return;
    }

    let resolvedData = visibilityData;
    if (typeof resolvedData === 'string') {
        try {
            resolvedData = JSON.parse(resolvedData);
        } catch (error) {
            resolvedData = { strategySummary: visibilityData };
        }
    }
    const mergedData = {
        ...(specContext || {}),
        ...(resolvedData && typeof resolvedData === 'object' ? resolvedData : {})
    };
    container.innerHTML = buildVisibilityEngineHtml(mergedData);
    renderSpecMermaidPlaceholders(container);
    setTimeout(() => updateSubsections('visibility-engine'), 0);
}

function displayRaw(data) {
    // Display individual sections
    const rawOverview = document.getElementById('raw-overview');
    const rawTechnical = document.getElementById('raw-technical');
    const rawMarket = document.getElementById('raw-market');
    const rawDesign = document.getElementById('raw-design');
    const rawMockup = document.getElementById('raw-mockup');
    const rawDiagrams = document.getElementById('raw-diagrams');
    const rawPrompts = document.getElementById('raw-prompts');
    
    if (rawOverview) rawOverview.textContent = data.overview ? JSON.stringify(data.overview, null, 2) : 'No overview data available';
    if (rawTechnical) rawTechnical.textContent = data.technical ? JSON.stringify(data.technical, null, 2) : 'No technical data available';
    if (rawMarket) rawMarket.textContent = data.market ? JSON.stringify(data.market, null, 2) : 'No market data available';
    if (rawDesign) rawDesign.textContent = data.design ? JSON.stringify(data.design, null, 2) : 'No design data available';
    if (rawMockup) rawMockup.textContent = data.mockups ? JSON.stringify(data.mockups, null, 2) : 'No mockups data available';
    if (rawDiagrams) rawDiagrams.textContent = data.diagrams ? JSON.stringify(data.diagrams, null, 2) : 'No diagrams data available';
    if (rawPrompts) rawPrompts.textContent = data.prompts ? JSON.stringify(data.prompts, null, 2) : 'No prompts data available';
    
    // Display complete data
    const rawComplete = document.getElementById('raw-complete');
    if (rawComplete) {
        rawComplete.textContent = JSON.stringify(data, null, 2);
    }
}



function displayArchitectureFromData(data) {
    const container = document.getElementById('architecture-data');
    if (!container) return;

    const architectureTab = document.getElementById('architectureTab');
    if (architectureTab) architectureTab.classList.remove('generated');

    // Architecture content exists — render it and show orange icon
    if (data.architecture && typeof data.architecture === 'string' && data.architecture.trim()) {
        displayArchitecture(data.architecture, container);
        if (architectureTab) architectureTab.classList.add('generated');
        return;
    }

    const allAdvancedReady = data.status?.technical === 'ready'
        && data.status?.market === 'ready'
        && data.status?.design === 'ready';
    const archStatus = data.status?.architecture;

    // Loading state: same skeleton animation as other tabs
    if (archStatus === 'generating') {
        container.innerHTML = '<div class="skeleton-container" id="architecture-placeholder">'
            + '<div class="skeleton-header"><div class="skeleton-spinner"></div><div class="skeleton-text"></div></div>'
            + '<div class="skeleton-line long"></div><div class="skeleton-line medium"></div><div class="skeleton-line long"></div>'
            + '<div class="skeleton-line short"></div><div class="skeleton-line long"></div><div class="skeleton-line medium"></div><div class="skeleton-line long"></div>'
            + '</div>';
        return;
    }

    // Not generating and no architecture — always show Generate/Retry button (for testing and normal use)
    const isError = archStatus === 'error';
    const btnLabel = isError ? 'Retry Architecture' : 'Generate Architecture';
    const btnIcon  = isError ? 'fa-refresh'         : 'fa-magic';
    const msg      = isError
        ? 'Architecture generation failed. Click to try again.'
        : (allAdvancedReady
            ? 'Generate the architecture document now.'
            : 'Technical, Market, and Design are recommended first. You can still generate architecture now.');

    container.innerHTML = '<div class="locked-tab-message" id="architecture-placeholder">'
        + '<i class="fa fa-building" style="font-size:2.5em;opacity:0.35;margin-bottom:14px;"></i>'
        + '<p>' + msg + '</p>'
        + '<button class="btn-generate-arch" id="btn-generate-arch-main" '
        +   'onclick="triggerGenerateArchitecture(currentSpecData && currentSpecData.id)">'
        +   '<i class="fa ' + btnIcon + '"></i> ' + btnLabel
        + '</button>'
        + '</div>';
}

/**
 * Wrap raw Mermaid (erDiagram, graph TD, sequenceDiagram, etc.) in ```mermaid ... ``` so displayArchitecture can render them.
 * Skips regions already inside ```mermaid ... ``` to avoid double-wrapping.
 */
function normalizeArchitectureMermaidFences(content) {
    if (!content || typeof content !== 'string') return content;
    const fenced = /```mermaid\s*[\s\S]*?```/gi;
    const out = [];
    let last = 0;
    let m;
    while ((m = fenced.exec(content)) !== null) {
        out.push(wrapRawMermaidBlocksInPlainText(content.slice(last, m.index)));
        out.push(m[0]);
        last = m.index + m[0].length;
    }
    out.push(wrapRawMermaidBlocksInPlainText(content.slice(last)));
    return out.join('');
}

/**
 * Find diagram blocks that are not yet fenced and wrap them. Stops before next ## heading or closing ```.
 */
function wrapRawMermaidBlocksInPlainText(text) {
    if (!text || !text.trim()) return text;
    // Keywords at line start (or start of string). Most diagrams do not use a trailing semicolon on line 1.
    const diagramLine = [
        'graph\\s+[A-Za-z]+(?:\\s*;)?',
        'flowchart\\s+[A-Za-z]+(?:\\s*;)?',
        'sequenceDiagram\\s*;?',
        'erDiagram\\b',
        'classDiagram\\b',
        'stateDiagram-v2\\b',
        'stateDiagram\\b',
        'journey\\b',
        'gantt\\b',
        'pie\\b',
        'requirementDiagram\\b',
        'C4Context\\b',
        'blockDiagram\\b'
    ].join('|');
    const re = new RegExp(
        '(^|\\n)(' + diagramLine + ')([\\s\\S]*?)(?=\\n##\\s|\\n```|$)',
        'gim'
    );
    return text.replace(re, function (match, lead, keyword, rest) {
        var block = keyword + rest;
        if (block.length > 50000) block = block.slice(0, 50000) + '\n';
        return lead + '```mermaid\n' + block.trim() + '\n```';
    });
}

/**
 * Convert simple Markdown (## ### ** - list) to HTML for architecture text. Escapes HTML for safety.
 */
function architectureMarkdownToHtml(md) {
    if (!md || typeof md !== 'string') return '';
    var s = escapeHtmlSpec(md);
    s = s.replace(/^### (.+)$/gm, '<h3 class="architecture-h3">$1</h3>');
    s = s.replace(/^## (.+)$/gm, '<h2 class="architecture-h2">$1</h2>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/^- (.+)$/gm, '<li>$1</li>');
    s = s.replace(/(<li>.*<\/li>\n?)+/g, '<ul class="architecture-ul">$&</ul>');
    var paras = s.split(/\n\n+/);
    s = paras.map(function(seg) {
        var t = seg.trim();
        if (!t) return '';
        if (/^<(h[23]|ul)/i.test(t)) return t;
        return '<p class="architecture-p">' + t.replace(/\n/g, '<br>') + '</p>';
    }).join('');
    return s || '';
}

function displayArchitecture(content, containerEl) {
    const container = containerEl || document.getElementById('architecture-data');
    if (!container) return;
    container.innerHTML = '';
    content = normalizeArchitectureMermaidFences(content);
    const mermaidRegex = /```mermaid\s*([\s\S]*?)```/gi;
    let match;
    let lastIndex = 0;
    const mermaidParts = [];
    const textParts = [];
    while ((match = mermaidRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
            textParts.push(content.slice(lastIndex, match.index));
        }
        mermaidParts.push(match[1].trim());
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
        textParts.push(content.slice(lastIndex));
    }
    // Interleave text and diagrams in document order (previously all diagrams were rendered first, which broke layout).
    function appendArchitectureTextSegment(trimmed) {
        if (!trimmed) return;
        var textBlock = document.createElement('div');
        textBlock.className = 'architecture-text-block';
        textBlock.style.marginBottom = '1rem';
        textBlock.innerHTML = architectureMarkdownToHtml(trimmed);
        container.appendChild(textBlock);
    }
    var idx;
    for (idx = 0; idx < mermaidParts.length; idx++) {
        const seg = (textParts[idx] || '').trim();
        if (seg) {
            appendArchitectureTextSegment(seg);
        }
        const mermaidCode = mermaidParts[idx];
        const wrap = document.createElement('div');
        wrap.className = 'architecture-mermaid-wrap';
        wrap.innerHTML = '<div class="architecture-mermaid-loading">Rendering diagram...</div>';
        container.appendChild(wrap);
        const uniqueId = 'arch-mermaid-' + idx + '-' + Date.now();
        if (window.diagramEngine?.renderArchitectureMermaid) {
            window.diagramEngine.renderArchitectureMermaid(wrap, mermaidCode).then(function(ok) {
                if (!ok) {
                    wrap.innerHTML = '<pre class="architecture-mermaid-fallback">' + escapeHtmlSpec(mermaidCode) + '</pre><p class="architecture-mermaid-error">Diagram could not be rendered.</p>';
                }
            });
        } else if (typeof mermaid !== 'undefined' && mermaid.render) {
            var archMermaidCode = (typeof window.sanitizeMermaidSource === 'function'
                ? window.sanitizeMermaidSource(mermaidCode)
                : mermaidCode) || mermaidCode;
            mermaid.render(uniqueId, archMermaidCode).then(function(result) {
                wrap.innerHTML = '<div class="mermaid-rendered">' + result.svg + '</div>';
            }).catch(function() {
                wrap.innerHTML = '<pre class="architecture-mermaid-fallback">' + escapeHtmlSpec(mermaidCode) + '</pre><p class="architecture-mermaid-error">Diagram could not be rendered.</p>';
            });
        } else {
            wrap.innerHTML = '<pre class="architecture-mermaid-fallback">' + escapeHtmlSpec(mermaidCode) + '</pre>';
        }
    }
    var tail = (textParts[mermaidParts.length] || '').trim();
    if (tail) {
        appendArchitectureTextSegment(tail);
    }
}

var _architectureGenerationInProgress = false;
async function triggerGenerateArchitecture(specId) {
    if (_architectureGenerationInProgress) return;
    if (!specId) { showNotification('Spec ID not available. Please refresh.', 'error'); return; }
    if (!window.api || typeof window.api.post !== 'function') {
        showNotification('API not available. Please refresh the page.', 'error');
        return;
    }
    _architectureGenerationInProgress = true;

    // Show same skeleton as other tabs — Firestore real-time listener will update when done.
    var container = document.getElementById('architecture-data');
    if (container) {
        container.innerHTML = '<div class="skeleton-container" id="architecture-placeholder">'
            + '<div class="skeleton-header"><div class="skeleton-spinner"></div><div class="skeleton-text"></div></div>'
            + '<div class="skeleton-line long"></div><div class="skeleton-line medium"></div><div class="skeleton-line long"></div>'
            + '<div class="skeleton-line short"></div><div class="skeleton-line long"></div><div class="skeleton-line medium"></div><div class="skeleton-line long"></div>'
            + '</div>';
    }
    updateNotificationDot('architecture', 'generating');
    updateTabLoadingState('architecture', true);

    try {
        // Route returns 202 immediately; generation runs in the background on the server.
        await window.api.post('/api/specs/' + encodeURIComponent(specId) + '/generate-architecture', {});
        showNotification('Architecture generation started. The document will appear when ready.', 'info');
        // The Firestore real-time listener will call displayArchitectureFromData() automatically
        // when status.architecture changes to 'ready' or 'error'.
    } catch (err) {
        console.warn('Failed to start architecture generation:', err);
        showNotification('Could not start architecture generation. Please try again.', 'error');
        _architectureGenerationInProgress = false;
        // Re-render to show the retry button
        if (currentSpecData) displayArchitectureFromData(currentSpecData);
        return;
    }

    _architectureGenerationInProgress = false;
}

function displayDiagramsFromData(data) {
    const container = document.getElementById('diagrams-data');
    
    // FIRST CHECK: Overview must be approved
    if (!data.overviewApproved) {
        container.innerHTML = `
            <div class="locked-tab-message">
                <h3><i class="fa fa-lock"></i> Diagrams</h3>
                <p>Please approve the Overview and generate Technical & Market specifications first to create visual diagrams.</p>
            </div>
        `;
        return;
    }
    
    // SECOND CHECK: Technical and Market must be ready
    if (!data.technical || !data.market || 
        data.status?.technical !== 'ready' || 
        data.status?.market !== 'ready') {
        container.innerHTML = `
            <div class="locked-tab-message">
                <h3><i class="fa fa-lock"></i> Diagrams</h3>
                <p>Please generate Technical & Market specifications first to create visual diagrams.</p>
            </div>
        `;
        return;
    }
    
    // THIRD CHECK: Legacy standalone diagrams (optional); embedded Mermaid lives in Technical & Architecture
    if (!data.diagrams?.generated || 
        !data.diagrams?.diagrams || 
        !Array.isArray(data.diagrams.diagrams) || 
        data.diagrams.diagrams.length === 0) {
        container.innerHTML = `
            <div class="locked-tab-message">
                <h3><i class="fa fa-bar-chart"></i> Diagrams</h3>
                <p>Visual diagrams are generated inside the <strong>Technical Specification</strong> and <strong>Architecture</strong> tabs (Mermaid). Legacy standalone diagram sets are no longer created here.</p>
                <p style="margin-top:12px;">Open those tabs to view system, ER, API, and flow diagrams.</p>
            </div>
        `;
        return;
    }
    
    // FOURTH CHECK: Validate that diagrams have valid mermaidCode (but keep ALL diagrams)
    const diagramsWithCode = data.diagrams.diagrams.filter(d => 
        d && d.mermaidCode && 
        typeof d.mermaidCode === 'string' && 
        d.mermaidCode.trim().length > 0
    );
    
    if (diagramsWithCode.length === 0) {
        container.innerHTML = `
            <div class="locked-tab-message">
                <h3><i class="fa fa-bar-chart"></i> Diagrams</h3>
                <p>No valid legacy diagrams in this spec. Use the <strong>Technical</strong> and <strong>Architecture</strong> tabs for embedded Mermaid diagrams.</p>
            </div>
        `;
        return;
    }
    
    // ALL CHECKS PASSED - Display ALL diagrams (including broken ones)
    // Store ALL diagrams data globally (not just valid ones)
    diagramsData = diagramsWithCode;
    
    // Initialize flags for diagrams that don't have them
    diagramsData.forEach(diagram => {
        if (diagram._autoRepairSent === undefined) {
            diagram._autoRepairSent = false;
        }
    });
    
    // Display ALL diagrams
    displayDiagrams(diagramsData);
    
    // Check for broken diagrams that haven't been sent for auto-repair yet
    // This handles the refresh case - if user refreshes page while diagrams are broken
    autoRepairBrokenDiagrams();
    
    // Update raw data
    const rawDiagrams = document.getElementById('raw-diagrams');
    if (rawDiagrams) {
        rawDiagrams.textContent = JSON.stringify(data.diagrams, null, 2);
    }
}

function displayPromptsFromData(data) {
    const container = document.getElementById('prompts-data');
    
    // FIRST CHECK: Overview must be approved
    if (!data.overviewApproved) {
        container.innerHTML = `
            <div class="locked-tab-message">
                <h3><i class="fa fa-lock"></i> Prompts</h3>
                <p>Please approve the Overview and complete all specification stages first.</p>
            </div>
        `;
        return;
    }
    
    // SECOND CHECK: All prerequisite specs must be ready
    if (!data.technical || !data.market || !data.design || !data.architecture || !data.visibility ||
        data.status?.technical !== 'ready' || 
        data.status?.market !== 'ready' ||
        data.status?.design !== 'ready' ||
        data.status?.architecture !== 'ready' ||
        data.status?.visibility !== 'ready') {
        container.innerHTML = `
            <div class="locked-tab-message">
                <h3><i class="fa fa-lock"></i> Prompts</h3>
                <p>Prompts are generated automatically after Technical, Market, Design, Architecture, and Visibility are ready.</p>
            </div>
        `;
        return;
    }

    const promptsData = typeof data.prompts === 'string' ? (() => {
        try { return JSON.parse(data.prompts); } catch (e) { return null; }
    })() : data.prompts;
    
    // THIRD CHECK: Prompts must be generated and valid
    if (!promptsData?.generated || 
        !promptsData?.fullPrompt || 
        typeof promptsData.fullPrompt !== 'string' ||
        promptsData.fullPrompt.trim().length === 0) {
        container.innerHTML = `
            <div class="locked-tab-message">
                <h3><i class="fa fa-terminal"></i> Prompts</h3>
                <p>Prompts generation is in progress or failed. Retry generation if needed.</p>
            </div>
        `;
        return;
    }
    
    // ALL CHECKS PASSED - Display prompts
    displayPrompts(promptsData);
    
    // Update raw data
    const rawPrompts = document.getElementById('raw-prompts');
    if (rawPrompts) {
        rawPrompts.textContent = JSON.stringify(promptsData, null, 2);
    }
}

function formatTextContent(content) {
    if (!content) {
        return '<p>No content available</p>';
    }
    if (typeof content === 'object' && content !== null) {
        return formatJSONContent(content);
    }
    if (typeof content === 'string') {
        try {
            return formatJSONContent(JSON.parse(content));
        } catch (error) {
            return formatPlainTextContent(content);
        }
    }
    return formatPlainTextContent(String(content));
}

function getSectionPlainText(sectionElement) {
    if (!sectionElement) return '';
    const clone = sectionElement.cloneNode(true);
    clone.querySelectorAll('.clarify-trigger, .clarify-inline-panel').forEach(function (node) {
        node.remove();
    });
    return (clone.textContent || '').trim();
}

async function submitClarification(panel, context) {
    const textarea = panel.querySelector('.clarify-input');
    const submitBtn = panel.querySelector('.clarify-submit');
    const answerWrap = panel.querySelector('.clarify-answer');
    const answerText = panel.querySelector('.clarify-answer-text');
    if (!textarea || !submitBtn || !answerWrap || !answerText) return;

    const question = textarea.value.trim();
    if (!question) {
        showNotification('Please type a question first.', 'info');
        return;
    }
    if (!currentSpecData || !currentSpecData.id) {
        showNotification('Spec is not loaded yet.', 'error');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');
    answerWrap.classList.remove('hidden');
    answerText.classList.remove('clarify-answer-placeholder');
    answerText.innerHTML = '<span class="clarify-answer-loading">Getting answer…</span>';

    try {
        const result = await window.api.post(
            `/api/specs/${encodeURIComponent(currentSpecData.id)}/clarify`,
            {
                question,
                sectionTitle: context.sectionTitle,
                sectionText: context.sectionText,
                tabName: context.tabName
            }
        );

        const answer = result?.clarification?.answer || '';
        if (!answer) {
            throw new Error('No answer returned');
        }

        answerText.innerHTML = escapeHtmlSpec(answer).replace(/\n/g, '<br>');
    } catch (error) {
        answerText.classList.remove('clarify-answer-placeholder');
        answerText.innerHTML = escapeHtmlSpec('Could not get an answer. ' + (error.message || 'Please try again.'));
        showNotification('Failed to get clarification: ' + (error.message || 'Unknown error'), 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
    }
}

function createClarifyButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'clarify-trigger';
    button.setAttribute('aria-label', 'Ask for clarification');
    button.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 21h6v-1.5H9V21zm3-20C8.14 1 5 4.14 5 8c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-3.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.7 11.28-.7.49V16h-4v-3.23l-.7-.49A5 5 0 0 1 7 8a5 5 0 1 1 10 0 5 5 0 0 1-2.3 4.28z"/>
        </svg>
    `;
    return button;
}

function createClarifyPanel(sectionTitle) {
    const panel = document.createElement('div');
    panel.className = 'clarify-inline-panel hidden';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Ask for clarification: ' + sectionTitle);
    panel.innerHTML = `
        <form class="clarify-form">
            <input class="clarify-input" type="text" maxlength="1200" placeholder="Ask for clarification" />
            <button type="submit" class="clarify-submit" aria-label="Send clarification question">
                <span class="clarify-submit-label">Send</span>
                <span class="clarify-submit-spinner" aria-hidden="true"></span>
            </button>
            <button type="button" class="clarify-cancel" aria-label="Close clarification input">×</button>
        </form>
        <div class="clarify-answer">
            <div class="clarify-answer-title">Answer</div>
            <div class="clarify-answer-text clarify-answer-placeholder">The response will appear here after you send your question.</div>
        </div>
    `;
    return panel;
}

function enhanceClarificationUI(container, tabName) {
    if (!container || !CLARIFY_SUPPORTED_TABS.has(tabName)) return;
    const sections = container.querySelectorAll('.content-section');
    sections.forEach(function (sectionElement) {
        const heading = sectionElement.querySelector('h3');
        if (!heading || heading.querySelector('.clarify-trigger')) return;

        const sectionTitle = (heading.textContent || '').trim();
        if (!sectionTitle) return;

        heading.classList.add('clarify-heading');
        const trigger = createClarifyButton();
        const panel = createClarifyPanel(sectionTitle);

        trigger.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            const isHidden = panel.classList.contains('hidden');
            container.querySelectorAll('.clarify-inline-panel').forEach(function (otherPanel) {
                if (otherPanel !== panel) {
                    otherPanel.classList.add('hidden');
                }
            });
            if (isHidden) {
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
            }
            if (isHidden) {
                const input = panel.querySelector('.clarify-input');
                if (input) input.focus();
            }
        });

        panel.addEventListener('click', function (event) {
            event.stopPropagation();
        });

        const cancelBtn = panel.querySelector('.clarify-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function (event) {
                event.preventDefault();
                panel.classList.add('hidden');
            });
        }

        const form = panel.querySelector('.clarify-form');
        if (form) {
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                submitClarification(panel, {
                    tabName,
                    sectionTitle,
                    sectionText: getSectionPlainText(sectionElement)
                });
            });
        }

        heading.appendChild(trigger);
        sectionElement.insertBefore(panel, heading.nextSibling);
    });
}

/**
 * Merge selected suggestions (toInclude) into overview content for generate-all payload.
 * Returns overview JSON string with ideaSummary and coreFeaturesOverview including selected suggestions.
 */
function mergeSelectedSuggestionsIntoOverview(overviewString) {
    if (!overviewString) return overviewString;
    var root;
    try {
        root = typeof overviewString === 'string' ? JSON.parse(overviewString) : overviewString;
    } catch (e) {
        return overviewString;
    }
    var o = (root.overview && typeof root.overview === 'object') ? root.overview : root;
    var changed = false;
    if (o.suggestionsIdeaSummary && Array.isArray(o.suggestionsIdeaSummary.toInclude) && o.suggestionsIdeaSummary.toInclude.length > 0) {
        var extra = o.suggestionsIdeaSummary.toInclude.join(' ');
        o.ideaSummary = (o.ideaSummary || '') + '\n\nAdditional ideas: ' + extra;
        changed = true;
    }
    if (o.suggestionsCoreFeatures && Array.isArray(o.suggestionsCoreFeatures.toInclude) && o.suggestionsCoreFeatures.toInclude.length > 0) {
        o.coreFeaturesOverview = Array.isArray(o.coreFeaturesOverview) ? o.coreFeaturesOverview.slice() : [];
        o.suggestionsCoreFeatures.toInclude.forEach(function(t) { o.coreFeaturesOverview.push(t); });
        changed = true;
    }
    if (!changed) return overviewString;
    return JSON.stringify(root);
}

/**
 * Toggle a suggestion between toInclude and notToInclude, update Firestore and DOM.
 * @param {HTMLElement} item - .suggestion-item element with data-section and data-suggestion-text
 */
function toggleSuggestionSelection(item) {
    if (!currentSpecData || !currentSpecData.id) return;
    const section = item.getAttribute('data-section');
    const text = item.getAttribute('data-suggestion-text');
    if (!section || text == null) return;
    const overviewRaw = currentSpecData.overview;
    let root = typeof overviewRaw === 'string' ? (function() { try { return JSON.parse(overviewRaw); } catch (e) { return null; } })() : overviewRaw;
    if (!root) return;
    var overviewObj = (root.overview && typeof root.overview === 'object') ? root.overview : root;
    const key = section === 'ideaSummary' ? 'suggestionsIdeaSummary' : 'suggestionsCoreFeatures';
    const data = overviewObj[key];
    if (!data || !Array.isArray(data.notToInclude) || !Array.isArray(data.toInclude)) return;
    const isSelected = item.getAttribute('data-selected') === 'true';
    if (isSelected) {
        const i = data.toInclude.indexOf(text);
        if (i === -1) return;
        data.toInclude.splice(i, 1);
        data.notToInclude.push(text);
    } else {
        const i = data.notToInclude.indexOf(text);
        if (i === -1) return;
        data.notToInclude.splice(i, 1);
        data.toInclude.push(text);
    }
    var newOverviewString = (root.overview && typeof root.overview === 'object') ? JSON.stringify(root) : JSON.stringify(overviewObj);
    currentSpecData.overview = newOverviewString;
    if (window.originalOverview) window.originalOverview = newOverviewString;
    item.setAttribute('data-selected', isSelected ? 'false' : 'true');
    item.classList.toggle('suggestion-selected', !isSelected);
    const checkEl = item.querySelector('.suggestion-check');
    if (checkEl) {
        if (isSelected) checkEl.innerHTML = ''; else checkEl.innerHTML = '<i class="fa fa-check"></i>';
    }
    firebase.firestore().collection('specs').doc(currentSpecData.id).update({
        overview: newOverviewString,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function(err) {
        showNotification('Failed to save suggestion selection', 'error');
    });
}

/** Escape for HTML and attributes (used in overview suggestions) */
/**
 * Parse semicolon-separated color string from API (e.g. "#1E90FF - Blue (Primary); #FF4500 - ...")
 * into { RoleName: "#HEX - description" } so UI does not treat the string as per-character entries.
 */
function parseColorsSemicolonStringToObject(str) {
    const out = {};
    if (!str || typeof str !== 'string') return out;
    const parts = str.split(';').map(function (s) { return s.trim(); }).filter(function (s) { return s; });
    parts.forEach(function (part, i) {
        const m = part.match(/^#?([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\s*-\s*(.+)$/i);
        if (m) {
            let hex = m[1];
            if (hex.length === 3) {
                hex = '#' + hex.split('').map(function (c) { return c + c; }).join('');
            } else {
                hex = '#' + hex;
            }
            const rest = m[2].trim();
            const roleMatch = rest.match(/\(([^)]+)\)\s*$/);
            let key = roleMatch ? roleMatch[1].trim() : ('Color ' + (i + 1));
            if (out[key]) {
                key = key + ' (' + (i + 1) + ')';
            }
            out[key] = hex + ' - ' + rest;
            return;
        }
        const hexOnly = part.match(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})/i);
        if (hexOnly) {
            let h = hexOnly[1];
            if (h.length === 3) {
                h = '#' + h.split('').map(function (c) { return c + c; }).join('');
            } else {
                h = '#' + h;
            }
            out['Color ' + (i + 1)] = h;
        }
    });
    return out;
}

/** Normalize visualStyleGuide.colors whether it is an object map or one semicolon-separated string (v2 API). */
function normalizeVisualStyleGuideColors(colors) {
    if (colors == null) return {};
    if (typeof colors === 'object' && !Array.isArray(colors)) {
        return colors;
    }
    if (typeof colors === 'string') {
        return parseColorsSemicolonStringToObject(colors);
    }
    return {};
}

if (typeof window !== 'undefined') {
    window.normalizeVisualStyleGuideColors = normalizeVisualStyleGuideColors;
}

function escapeHtmlSpec(str) {
    if (str == null) return '';
    const s = String(str);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Render Mermaid blocks produced by formatJSONContent (.spec-mermaid-placeholder). */
function renderSpecMermaidPlaceholders(container) {
    if (!container || typeof mermaid === 'undefined' || !mermaid.render) return;
    const nodes = container.querySelectorAll('.spec-mermaid-placeholder[data-spec-mermaid]');
    nodes.forEach(function (el, index) {
        const raw = el.getAttribute('data-spec-mermaid');
        if (!raw) return;
        var code;
        try {
            code = decodeURIComponent(raw);
        } catch (e) {
            return;
        }
        const wrap = document.createElement('div');
        wrap.className = 'architecture-mermaid-wrap';
        wrap.innerHTML = '<div class="architecture-mermaid-loading">Rendering diagram...</div>';
        el.parentNode.replaceChild(wrap, el);
        const uniqueId = 'spec-mer-' + index + '-' + Date.now();
        var specMermaidCode = (typeof window.sanitizeMermaidSource === 'function'
            ? window.sanitizeMermaidSource(code)
            : code) || code;
        mermaid.render(uniqueId, specMermaidCode).then(function (result) {
            wrap.innerHTML = '<div class="mermaid-rendered">' + result.svg + '</div>';
        }).catch(function () {
            wrap.innerHTML = '<pre class="architecture-mermaid-fallback">' + escapeHtmlSpec(code) + '</pre><p class="architecture-mermaid-error">Diagram could not be rendered.</p>';
        });
    });
}

/** Render Suggestions block for a section (Idea Summary or Core Features) */
function renderSuggestionsBlock(sectionKey, data) {
    if (!data || (!Array.isArray(data.notToInclude) && !Array.isArray(data.toInclude))) return '';
    const notToInclude = data.notToInclude || [];
    const toInclude = data.toInclude || [];
    const all = [...notToInclude, ...toInclude];
    if (all.length === 0) return '';
    let html = '<div class="overview-suggestions-block content-section" data-suggestions-section="' + escapeHtmlSpec(sectionKey) + '">';
    html += '<h4 class="suggestions-heading"><i class="fa fa-lightbulb-o"></i> Suggestions</h4>';
    html += '<div class="suggestions-list">';
    notToInclude.forEach(function (text) {
        html += '<div class="suggestion-item" data-section="' + escapeHtmlSpec(sectionKey) + '" data-suggestion-text="' + escapeHtmlSpec(text) + '" data-selected="false" role="button" tabindex="0">';
        html += '<span class="suggestion-check" aria-hidden="true"></span>';
        html += '<span class="suggestion-text">' + escapeHtmlSpec(text) + '</span></div>';
    });
    toInclude.forEach(function (text) {
        html += '<div class="suggestion-item suggestion-selected" data-section="' + escapeHtmlSpec(sectionKey) + '" data-suggestion-text="' + escapeHtmlSpec(text) + '" data-selected="true" role="button" tabindex="0">';
        html += '<span class="suggestion-check" aria-hidden="true"><i class="fa fa-check"></i></span>';
        html += '<span class="suggestion-text">' + escapeHtmlSpec(text) + '</span></div>';
    });
    html += '</div></div>';
    return html;
}

function formatJSONContent(jsonData) {
    let html = '';
    
    // Parse JSON strings if they exist
    if (typeof jsonData === 'string') {
        try {
            jsonData = JSON.parse(jsonData);
        } catch (e) {

            return '<div class="error">Failed to parse JSON data</div>';
        }
    }
    
    // Debug logging to understand data structure

    
    // Handle nested overview structure (overview.overview)
    if (jsonData.overview && typeof jsonData.overview === 'object') {

        jsonData = jsonData.overview;
    }

    // Handle nested design structure (design.design) so Color Palette and App Icon come from spec
    if (jsonData.design && typeof jsonData.design === 'object') {
        jsonData = jsonData.design;
    }
    
    // Handle new Overview structure
    if (jsonData.ideaSummary) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-lightbulb-o"></i> Idea Summary</h3>';
        html += '<p>' + escapeHtmlSpec(jsonData.ideaSummary) + '</p>';
        html += '</div>';
        html += renderSuggestionsBlock('ideaSummary', jsonData.suggestionsIdeaSummary);
    }
    
    // Handle new Detailed User Flow (moved to position 2, after Idea Summary)
    if (jsonData.detailedUserFlow) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-sitemap"></i> Detailed User Flow</h3>';
        
        if (jsonData.detailedUserFlow.steps && Array.isArray(jsonData.detailedUserFlow.steps)) {
            html += '<div class="user-flow-diagram">';
            jsonData.detailedUserFlow.steps.forEach((step, index) => {
                // Remove "Step X:" prefix if it already exists in the step text
                const cleanedStep = step.replace(/^Step\s+\d+:\s*/i, '').trim();
                
                // Create flow box
                html += '<div class="flow-item">';
                html += `<div class="flow-box">`;
                html += `<div class="flow-step-number">Step ${index + 1}</div>`;
                html += `<div class="flow-step-text">${escapeHtml(cleanedStep)}</div>`;
                html += '</div>';
                
                // Add arrow between steps (not after last step) - DOWN arrow
                if (index < jsonData.detailedUserFlow.steps.length - 1) {
                    html += '<div class="flow-arrow">↓</div>';
                }
                
                html += '</div>';
            });
            html += '</div>';
        }
        
        html += '</div>';
    }
    
    // Handle new Target Audience structure
    if (jsonData.targetAudience) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-bullseye"></i> Target Audience</h3>';
        
        if (jsonData.targetAudience.ageRange) {
            html += `<p><strong>Age Range:</strong> ${jsonData.targetAudience.ageRange}</p>`;
        }
        
        if (jsonData.targetAudience.sector) {
            html += `<p><strong>Sector:</strong> ${jsonData.targetAudience.sector}</p>`;
        }
        
        if (jsonData.targetAudience.interests && Array.isArray(jsonData.targetAudience.interests)) {
            html += '<h4>Interests:</h4>';
            html += '<ul>';
            jsonData.targetAudience.interests.forEach(interest => {
                html += `<li>${interest}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.targetAudience.needs && Array.isArray(jsonData.targetAudience.needs)) {
            html += '<h4>Needs:</h4>';
            html += '<ul>';
            jsonData.targetAudience.needs.forEach(need => {
                html += `<li>${need}</li>`;
            });
            html += '</ul>';
        }
        
        html += '</div>';
    }
    
    // Handle new Value Proposition
    if (jsonData.valueProposition) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-diamond"></i> Value Proposition</h3>';
        html += `<p>${jsonData.valueProposition}</p>`;
        html += '</div>';
    }
    
    // Handle new Core Features Overview
    if (jsonData.coreFeaturesOverview && Array.isArray(jsonData.coreFeaturesOverview)) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-star"></i> Core Features Overview</h3>';
        html += '<ul>';
        jsonData.coreFeaturesOverview.forEach(feature => {
            html += `<li>${escapeHtmlSpec(feature)}</li>`;
        });
        html += '</ul>';
        html += '</div>';
        html += renderSuggestionsBlock('coreFeatures', jsonData.suggestionsCoreFeatures);
    }
    
    // Handle new User Journey Summary
    if (jsonData.userJourneySummary) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-road"></i> User Journey Summary</h3>';
        html += `<p>${jsonData.userJourneySummary}</p>`;
        html += '</div>';
    }
    
    // Handle new Problem Statement
    if (jsonData.problemStatement) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-exclamation-triangle"></i> Problem Statement</h3>';
        html += `<p>${jsonData.problemStatement}</p>`;
        html += '</div>';
    }
    
    // Handle new Screen Descriptions (unified with UI Components)
    if (jsonData.screenDescriptions) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-desktop"></i> Screen Descriptions</h3>';
        
        if (jsonData.screenDescriptions.screens && Array.isArray(jsonData.screenDescriptions.screens)) {
            html += '<h4>Screens (' + jsonData.screenDescriptions.screens.length + ' total):</h4>';
            
            // Create responsive grid for screen cards
            html += '<div class="screens-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0;">';
            
            jsonData.screenDescriptions.screens.forEach((screen, index) => {
                // Handle both old format (string) and new format (object)
                if (typeof screen === 'string') {
                    // Legacy format - convert to new format
                    html += '<div class="screen-card" style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform=\'translateY(-2px)\'; this.style.boxShadow=\'0 4px 8px rgba(0,0,0,0.15)\';" onmouseout="this.style.transform=\'translateY(0)\'; this.style.boxShadow=\'0 2px 4px rgba(0,0,0,0.1)\';">';
                    html += `<h5 style="margin: 0 0 12px 0; color: var(--primary-color, #0078d4); font-size: 1.1em; border-bottom: 2px solid var(--primary-color, #0078d4); padding-bottom: 8px;">Screen ${index + 1}</h5>`;
                    html += `<p style="margin: 0 0 15px 0; color: #333; line-height: 1.6;">${escapeHtml(screen)}</p>`;
                    html += '<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">';
                    html += '<p style="margin: 0; font-size: 0.85em; color: #666; font-style: italic;">UI Components: Not specified</p>';
                    html += '</div>';
                    html += '</div>';
                } else {
                    // New format - object with name, description, uiComponents
                    const screenName = screen.name || `Screen ${index + 1}`;
                    const screenDescription = screen.description || screen.purpose || 'No description provided';
                    const uiComponents = screen.uiComponents || [];
                    
                    html += '<div class="screen-card" style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform=\'translateY(-2px)\'; this.style.boxShadow=\'0 4px 8px rgba(0,0,0,0.15)\';" onmouseout="this.style.transform=\'translateY(0)\'; this.style.boxShadow=\'0 2px 4px rgba(0,0,0,0.1)\';">';
                    html += `<h5 style="margin: 0 0 12px 0; color: var(--primary-color, #0078d4); font-size: 1.1em; border-bottom: 2px solid var(--primary-color, #0078d4); padding-bottom: 8px;">${escapeHtml(screenName)}</h5>`;
                    html += `<p style="margin: 0 0 15px 0; color: #333; line-height: 1.6;">${escapeHtml(screenDescription)}</p>`;
                    
                    // UI Components section
                    if (uiComponents.length > 0) {
                        html += '<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">';
                        html += '<div style="font-size: 0.9em; font-weight: bold; color: #555; margin-bottom: 10px;">UI Components:</div>';
                        html += '<ul style="margin: 0; padding-left: 20px; list-style-type: disc;">';
                        uiComponents.forEach(component => {
                            const componentText = typeof component === 'string' ? component : component.name || component;
                            html += `<li style="margin-bottom: 6px; color: #666; font-size: 0.9em; line-height: 1.5;">${escapeHtml(componentText)}</li>`;
                        });
                        html += '</ul>';
                        html += '</div>';
                    } else {
                        html += '<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">';
                        html += '<p style="margin: 0; font-size: 0.85em; color: #666; font-style: italic;">UI Components: Not specified</p>';
                        html += '</div>';
                    }
                    
                    html += '</div>';
                }
            });
            
            html += '</div>'; // Close screens-grid
        }
        
        if (jsonData.screenDescriptions.navigationStructure) {
            html += '<div style="margin-top: 30px;">';
            html += '<h4>Navigation Structure:</h4>';
            html += `<p style="line-height: 1.6;">${escapeHtml(jsonData.screenDescriptions.navigationStructure)}</p>`;
            html += '</div>';
        }
        
        html += '</div>';
    }
    
    // Handle applicationSummary
    if (jsonData.applicationSummary && jsonData.applicationSummary.paragraphs) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-clipboard"></i> Application Summary</h3>';
        jsonData.applicationSummary.paragraphs.forEach(paragraph => {
            html += `<p>${paragraph}</p>`;
        });
        html += '</div>';
    }
    
    // Handle coreFeatures
    if (jsonData.coreFeatures && Array.isArray(jsonData.coreFeatures)) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-star"></i> Core Features</h3>';
        html += '<ul>';
        jsonData.coreFeatures.forEach(feature => {
            html += `<li>${feature}</li>`;
        });
        html += '</ul>';
        html += '</div>';
    }
    
    // Handle userJourney
    if (jsonData.userJourney && jsonData.userJourney.steps) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-road"></i> User Journey</h3>';
        html += '<ol>';
        jsonData.userJourney.steps.forEach(step => {
            html += `<li>${step}</li>`;
        });
        html += '</ol>';
        html += '</div>';
    }
    
    // Handle uniqueValueProposition
    if (jsonData.uniqueValueProposition) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-lightbulb-o"></i> Unique Value Proposition</h3>';
        html += `<p>${jsonData.uniqueValueProposition}</p>`;
        html += '</div>';
    }
    
    // Handle new Technical structure
    if (jsonData.techStack) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-wrench"></i> Tech Stack</h3>';
        
        if (jsonData.techStack.frontend) {
            html += `<p><strong>Frontend:</strong> ${jsonData.techStack.frontend}</p>`;
        }
        
        if (jsonData.techStack.backend) {
            html += `<p><strong>Backend:</strong> ${jsonData.techStack.backend}</p>`;
        }
        
        if (jsonData.techStack.database) {
            html += `<p><strong>Database:</strong> ${jsonData.techStack.database}</p>`;
        }
        
        if (jsonData.techStack.storage) {
            html += `<p><strong>Storage:</strong> ${jsonData.techStack.storage}</p>`;
        }
        
        if (jsonData.techStack.authentication) {
            html += `<p><strong>Authentication:</strong> ${jsonData.techStack.authentication}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle new Architecture Overview (string legacy or { narrative, systemContextDiagramMermaid })
    if (jsonData.architectureOverview) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-building"></i> Architecture Overview</h3>';
        const ao = jsonData.architectureOverview;
        if (typeof ao === 'string') {
            html += `<p>${escapeHtmlSpec(ao)}</p>`;
        } else if (typeof ao === 'object' && ao !== null) {
            if (ao.narrative) {
                html += `<p>${escapeHtmlSpec(ao.narrative)}</p>`;
            }
            if (ao.systemContextDiagramMermaid && String(ao.systemContextDiagramMermaid).trim()) {
                html += '<h4>System context</h4>';
                html += `<div class="spec-mermaid-placeholder" data-spec-mermaid="${encodeURIComponent(ao.systemContextDiagramMermaid)}"></div>`;
            }
        }
        html += '</div>';
    }
    
    // Handle new Database Schema
    if (jsonData.databaseSchema) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-database"></i> Database Schema</h3>';
        
        if (jsonData.databaseSchema.description) {
            html += `<p>${escapeHtmlSpec(jsonData.databaseSchema.description)}</p>`;
        }

        if (jsonData.databaseSchema.erDiagramMermaid && String(jsonData.databaseSchema.erDiagramMermaid).trim()) {
            html += '<h4>ER diagram</h4>';
            html += `<div class="spec-mermaid-placeholder" data-spec-mermaid="${encodeURIComponent(jsonData.databaseSchema.erDiagramMermaid)}"></div>`;
        }
        
        const dbTables = (jsonData.databaseSchema.tables && Array.isArray(jsonData.databaseSchema.tables))
            ? jsonData.databaseSchema.tables
            : (jsonData.databaseSchema.tablesSupplement && Array.isArray(jsonData.databaseSchema.tablesSupplement) ? jsonData.databaseSchema.tablesSupplement : null);
        if (dbTables) {
            html += '<h4>Tables:</h4>';
            dbTables.forEach(table => {
                // Check if table is a string or an object
                if (typeof table === 'string') {
                    // Handle string format (legacy)
                    html += `<h5>${table}</h5>`;
                } else if (typeof table === 'object' && table.name) {
                    // Handle object format with full details
                    html += `<h5 style="color: var(--primary-color); margin-top: 20px;">${table.name}</h5>`;
                    
                    if (table.purpose) {
                        html += `<p><strong>Purpose:</strong> ${table.purpose}</p>`;
                    }
                    
                    if (table.fields && Array.isArray(table.fields)) {
                        html += '<h6 style="margin-top: 10px; font-weight: bold;">Fields:</h6>';
                        // Check if fields are objects or strings
                        if (table.fields.length > 0 && typeof table.fields[0] === 'object') {
                            // Object format - create a table
                            html += '<table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.9em;">';
                            html += '<thead><tr style="background-color: #f5f5f5;"><th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Field</th>';
                            html += '<th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Type</th>';
                            html += '<th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Constraints</th>';
                            html += '<th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Description</th></tr></thead><tbody>';
                            
                            table.fields.forEach(field => {
                                html += `<tr><td style="padding: 8px; border: 1px solid #ddd;"><code>${field.name || 'N/A'}</code></td>`;
                                html += `<td style="padding: 8px; border: 1px solid #ddd;">${field.type || 'N/A'}</td>`;
                                html += `<td style="padding: 8px; border: 1px solid #ddd;">${field.constraints || 'N/A'}</td>`;
                                html += `<td style="padding: 8px; border: 1px solid #ddd;">${field.description || 'N/A'}</td></tr>`;
                            });
                            
                            html += '</tbody></table>';
                        } else {
                            // String format - simple list
                            html += '<ul style="margin-left: 20px;">';
                            table.fields.forEach(field => {
                                html += `<li style="margin-bottom: 5px;"><code>${field}</code></li>`;
                            });
                            html += '</ul>';
                        }
                    }
                    
                    if (table.relationships) {
                        html += `<p style="margin-top: 10px;"><strong>Relationships:</strong> ${table.relationships}</p>`;
                    }
                }
            });
        }
        
        if (jsonData.databaseSchema.relationships) {
            html += '<h4>Relationships:</h4>';
            html += `<p>${jsonData.databaseSchema.relationships}</p>`;
        }
        
        html += '</div>';
    }
    
    // API design (v2): overview diagram + endpoints array
    if (jsonData.apiDesign && typeof jsonData.apiDesign === 'object') {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-project-diagram"></i> API Design</h3>';
        if (jsonData.apiDesign.endpointsOverviewDiagramMermaid && String(jsonData.apiDesign.endpointsOverviewDiagramMermaid).trim()) {
            html += '<h4>API map</h4>';
            html += `<div class="spec-mermaid-placeholder" data-spec-mermaid="${encodeURIComponent(jsonData.apiDesign.endpointsOverviewDiagramMermaid)}"></div>`;
        }
        if (jsonData.apiDesign.endpoints && Array.isArray(jsonData.apiDesign.endpoints)) {
            jsonData.apiDesign.endpoints.forEach(endpoint => {
            html += `<h4>${escapeHtmlSpec(endpoint.method || 'N/A')} ${escapeHtmlSpec(endpoint.path || 'N/A')}</h4>`;
            html += `<p><strong>Description:</strong> ${escapeHtmlSpec(endpoint.description || 'No description provided')}</p>`;
            if (endpoint.parameters) {
                html += `<p><strong>Parameters:</strong> ${escapeHtmlSpec(endpoint.parameters)}</p>`;
            }
            if (endpoint.requestExample) {
                html += `<p><strong>Request Example:</strong></p>`;
                html += `<pre><code>${escapeHtmlSpec(String(endpoint.requestExample))}</code></pre>`;
            }
            if (endpoint.requestBody) {
                const rb = typeof endpoint.requestBody === 'string' ? endpoint.requestBody : JSON.stringify(endpoint.requestBody, null, 2);
                html += `<p><strong>Request Body:</strong></p>`;
                html += `<pre><code>${escapeHtmlSpec(rb)}</code></pre>`;
            }
            if (endpoint.responseExample) {
                html += `<p><strong>Response Example:</strong></p>`;
                html += `<pre><code>${escapeHtmlSpec(String(endpoint.responseExample))}</code></pre>`;
            }
            if (endpoint.responseBody) {
                const resb = typeof endpoint.responseBody === 'string' ? endpoint.responseBody : JSON.stringify(endpoint.responseBody, null, 2);
                html += `<p><strong>Response Body:</strong></p>`;
                html += `<pre><code>${escapeHtmlSpec(resb)}</code></pre>`;
            }
            if (endpoint.statusCodes) {
                html += `<p><strong>Status Codes:</strong> ${escapeHtmlSpec(endpoint.statusCodes)}</p>`;
            }
            });
        }
        html += '</div>';
    }

    // Data flow (v2)
    if (jsonData.dataFlow && typeof jsonData.dataFlow === 'object') {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-share-alt"></i> Data Flow</h3>';
        if (jsonData.dataFlow.narrative) {
            html += `<p>${escapeHtmlSpec(jsonData.dataFlow.narrative)}</p>`;
        }
        if (jsonData.dataFlow.diagramMermaid && String(jsonData.dataFlow.diagramMermaid).trim()) {
            html += '<h4>Flow diagram</h4>';
            html += `<div class="spec-mermaid-placeholder" data-spec-mermaid="${encodeURIComponent(jsonData.dataFlow.diagramMermaid)}"></div>`;
        }
        html += '</div>';
    }

    // Handle new API Endpoints (legacy top-level)
    if (jsonData.apiEndpoints && Array.isArray(jsonData.apiEndpoints)) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-plug"></i> API Endpoints</h3>';
        
        jsonData.apiEndpoints.forEach(endpoint => {
            html += `<h4>${endpoint.method || 'N/A'} ${endpoint.path || 'N/A'}</h4>`;
            html += `<p><strong>Description:</strong> ${endpoint.description || 'No description provided'}</p>`;
            if (endpoint.parameters) {
                html += `<p><strong>Parameters:</strong> ${endpoint.parameters}</p>`;
            }
            if (endpoint.requestExample) {
                html += `<p><strong>Request Example:</strong></p>`;
                html += `<pre><code>${escapeHtmlSpec(String(endpoint.requestExample))}</code></pre>`;
            }
            if (endpoint.requestBody) {
                const rb = typeof endpoint.requestBody === 'string' ? endpoint.requestBody : JSON.stringify(endpoint.requestBody, null, 2);
                html += `<p><strong>Request Body:</strong></p>`;
                html += `<pre><code>${escapeHtmlSpec(rb)}</code></pre>`;
            }
            if (endpoint.responseExample) {
                html += `<p><strong>Response Example:</strong></p>`;
                html += `<pre><code>${escapeHtmlSpec(String(endpoint.responseExample))}</code></pre>`;
            }
            if (endpoint.responseBody) {
                const resb = typeof endpoint.responseBody === 'string' ? endpoint.responseBody : JSON.stringify(endpoint.responseBody, null, 2);
                html += `<p><strong>Response Body:</strong></p>`;
                html += `<pre><code>${escapeHtmlSpec(resb)}</code></pre>`;
            }
            if (endpoint.statusCodes) {
                html += `<p><strong>Status Codes:</strong> ${endpoint.statusCodes}</p>`;
            }
        });
        
        html += '</div>';
    }
    
    // Handle new Security & Authentication
    if (jsonData.securityAuthentication) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-lock"></i> Security & Authentication</h3>';
        
        // Display Security Critical Points with normal styling
        if (jsonData.securityAuthentication.securityCriticalPoints && Array.isArray(jsonData.securityAuthentication.securityCriticalPoints) && jsonData.securityAuthentication.securityCriticalPoints.length > 0) {
            html += '<div class="security-critical-points" style="margin-bottom: 25px;">';
            jsonData.securityAuthentication.securityCriticalPoints.forEach((point, index) => {
                html += `
                    <div class="security-banner" style="display: flex; align-items: flex-start; gap: 10px; padding: 12px; margin-bottom: 12px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e0e0e0;">
                        <i class="fa fa-exclamation-triangle" style="font-size: 16px; color: #dc3545 !important; margin-top: 2px; flex-shrink: 0;"></i>
                        <p style="margin: 0; line-height: 1.6; color: #555; flex: 1;">${escapeHtml(point)}</p>
                    </div>
                `;
            });
            html += '</div>';
        }
        
        if (jsonData.securityAuthentication.authentication) {
            html += `<p><strong>Authentication:</strong> ${jsonData.securityAuthentication.authentication}</p>`;
        }
        
        if (jsonData.securityAuthentication.authorization) {
            html += `<p><strong>Authorization:</strong> ${jsonData.securityAuthentication.authorization}</p>`;
        }
        
        if (jsonData.securityAuthentication.encryption) {
            html += `<p><strong>Encryption:</strong> ${jsonData.securityAuthentication.encryption}</p>`;
        }
        
        if (jsonData.securityAuthentication.securityMeasures) {
            html += `<p><strong>Security Measures:</strong> ${jsonData.securityAuthentication.securityMeasures}</p>`;
        }

        if (jsonData.securityAuthentication.authFlowDiagramMermaid && String(jsonData.securityAuthentication.authFlowDiagramMermaid).trim()) {
            html += '<h4>Authentication flow</h4>';
            html += `<div class="spec-mermaid-placeholder" data-spec-mermaid="${encodeURIComponent(jsonData.securityAuthentication.authFlowDiagramMermaid)}"></div>`;
        }
        
        html += '</div>';
    }
    
    // Handle new Integration & External APIs
    if (jsonData.integrationExternalApis) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-link"></i> Integration & External APIs</h3>';
        
        if (jsonData.integrationExternalApis.thirdPartyServices && Array.isArray(jsonData.integrationExternalApis.thirdPartyServices)) {
            html += '<h4>Third Party Services:</h4>';
            html += '<ul>';
            jsonData.integrationExternalApis.thirdPartyServices.forEach(service => {
                html += `<li>${service}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.integrationExternalApis.integrations) {
            html += `<p><strong>Integrations:</strong> ${jsonData.integrationExternalApis.integrations}</p>`;
        }
        
        if (jsonData.integrationExternalApis.dataFlow) {
            html += `<p><strong>Data Flow:</strong> ${jsonData.integrationExternalApis.dataFlow}</p>`;
        }

        if (jsonData.integrationExternalApis.integrationLandscapeDiagramMermaid && String(jsonData.integrationExternalApis.integrationLandscapeDiagramMermaid).trim()) {
            html += '<h4>Integration landscape</h4>';
            html += `<div class="spec-mermaid-placeholder" data-spec-mermaid="${encodeURIComponent(jsonData.integrationExternalApis.integrationLandscapeDiagramMermaid)}"></div>`;
        }
        
        html += '</div>';
    }
    
    // Handle new DevOps
    if (jsonData.devops) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-server"></i> DevOps</h3>';
        
        if (jsonData.devops.deploymentStrategy) {
            html += `<p><strong>Deployment Strategy:</strong> ${jsonData.devops.deploymentStrategy}</p>`;
        }
        
        if (jsonData.devops.infrastructure) {
            html += `<p><strong>Infrastructure:</strong> ${jsonData.devops.infrastructure}</p>`;
        }
        
        if (jsonData.devops.monitoring) {
            html += `<p><strong>Monitoring:</strong> ${jsonData.devops.monitoring}</p>`;
        }
        
        if (jsonData.devops.scaling) {
            html += `<p><strong>Scaling:</strong> ${jsonData.devops.scaling}</p>`;
        }
        
        if (jsonData.devops.backup) {
            html += `<p><strong>Backup:</strong> ${jsonData.devops.backup}</p>`;
        }
        
        if (jsonData.devops.automation) {
            html += `<p><strong>Automation:</strong> ${jsonData.devops.automation}</p>`;
        }

        if (jsonData.devops.cicdPipelineDiagramMermaid && String(jsonData.devops.cicdPipelineDiagramMermaid).trim()) {
            html += '<h4>CI/CD pipeline</h4>';
            html += `<div class="spec-mermaid-placeholder" data-spec-mermaid="${encodeURIComponent(jsonData.devops.cicdPipelineDiagramMermaid)}"></div>`;
        }
        
        html += '</div>';
    }
    
    // Handle new Data Storage
    if (jsonData.dataStorage) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-hdd-o"></i> Data Storage Strategy</h3>';
        
        if (jsonData.dataStorage.storageStrategy) {
            html += `<p><strong>Storage Strategy:</strong> ${jsonData.dataStorage.storageStrategy}</p>`;
        }
        
        if (jsonData.dataStorage.dataRetention) {
            html += `<p><strong>Data Retention:</strong> ${jsonData.dataStorage.dataRetention}</p>`;
        }
        
        if (jsonData.dataStorage.dataBackup) {
            html += `<p><strong>Data Backup:</strong> ${jsonData.dataStorage.dataBackup}</p>`;
        }
        
        if (jsonData.dataStorage.storageArchitecture) {
            html += `<p><strong>Storage Architecture:</strong> ${jsonData.dataStorage.storageArchitecture}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle new Analytics
    if (jsonData.analytics) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-line-chart"></i> Analytics</h3>';
        
        if (jsonData.analytics.analyticsStrategy) {
            html += `<p><strong>Analytics Strategy:</strong> ${jsonData.analytics.analyticsStrategy}</p>`;
        }
        
        if (jsonData.analytics.trackingMethods) {
            html += `<p><strong>Tracking Methods:</strong> ${jsonData.analytics.trackingMethods}</p>`;
        }
        
        if (jsonData.analytics.analysisTools) {
            html += `<p><strong>Analysis Tools:</strong> ${jsonData.analytics.analysisTools}</p>`;
        }
        
        if (jsonData.analytics.reporting) {
            html += `<p><strong>Reporting:</strong> ${jsonData.analytics.reporting}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle new Detailed Data Models
    if (jsonData.detailedDataModels) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-database"></i> Detailed Data Models</h3>';
        
        if (jsonData.detailedDataModels.models && Array.isArray(jsonData.detailedDataModels.models)) {
            jsonData.detailedDataModels.models.forEach(model => {
                html += `<h4>${model.name || 'Unnamed Model'}</h4>`;
                
                if (model.purpose) {
                    html += `<p><strong>Purpose:</strong> ${model.purpose}</p>`;
                }
                
                if (model.fields && Array.isArray(model.fields)) {
                    html += '<h5>Fields:</h5>';
                    html += '<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">';
                    html += '<thead><tr style="background-color: #f5f5f5;"><th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Name</th>';
                    html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Type</th>';
                    html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Required</th>';
                    html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Constraints</th>';
                    html += '<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Description</th></tr></thead><tbody>';
                    
                    model.fields.forEach(field => {
                        html += `<tr><td style="padding: 10px; border: 1px solid #ddd;"><code>${field.name || 'N/A'}</code></td>`;
                        html += `<td style="padding: 10px; border: 1px solid #ddd;">${field.type || 'N/A'}</td>`;
                        html += `<td style="padding: 10px; border: 1px solid #ddd;">${field.required ? 'Yes' : 'No'}</td>`;
                        html += `<td style="padding: 10px; border: 1px solid #ddd;">${field.constraints || '-'}</td>`;
                        html += `<td style="padding: 10px; border: 1px solid #ddd;">${field.description || 'N/A'}</td></tr>`;
                    });
                    
                    html += '</tbody></table>';
                }
                
                if (model.relationships) {
                    html += '<h5>Relationships:</h5>';
                    html += `<p>${model.relationships}</p>`;
                }
                
                if (model.validationRules) {
                    html += '<h5>Validation Rules:</h5>';
                    html += `<p>${model.validationRules}</p>`;
                }
                
                if (model.indexes) {
                    html += '<h5>Database Indexes:</h5>';
                    html += `<p>${model.indexes}</p>`;
                }
                
                if (model.sampleData) {
                    html += '<h5>Sample Data:</h5>';
                    html += `<p>${model.sampleData}</p>`;
                }
            });
        }
        
        if (jsonData.detailedDataModels.overallStructure) {
            html += '<h4>Overall Structure:</h4>';
            html += `<p>${jsonData.detailedDataModels.overallStructure}</p>`;
        }
        
        if (jsonData.detailedDataModels.totalModelsCount) {
            html += '<h4>Total Models Count:</h4>';
            html += `<p>${jsonData.detailedDataModels.totalModelsCount}</p>`;
        }
        
        if (jsonData.detailedDataModels.crudOperations) {
            html += '<h4>CRUD Operations:</h4>';
            html += `<p>${jsonData.detailedDataModels.crudOperations}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle new Data Flow Detailed
    if (jsonData.dataFlowDetailed) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-share-alt"></i> Detailed Data Flow</h3>';
        
        if (jsonData.dataFlowDetailed.authenticationFlow) {
            html += '<h4>Authentication Flow:</h4>';
            html += `<p>${jsonData.dataFlowDetailed.authenticationFlow}</p>`;
        }
        
        if (jsonData.dataFlowDetailed.dataSubmissionFlow) {
            html += '<h4>Data Submission Flow:</h4>';
            html += `<p>${jsonData.dataFlowDetailed.dataSubmissionFlow}</p>`;
        }
        
        if (jsonData.dataFlowDetailed.queryPatterns) {
            html += '<h4>Query Patterns:</h4>';
            html += `<p>${jsonData.dataFlowDetailed.queryPatterns}</p>`;
        }
        
        if (jsonData.dataFlowDetailed.cachingStrategy) {
            html += '<h4>Caching Strategy:</h4>';
            html += `<p>${jsonData.dataFlowDetailed.cachingStrategy}</p>`;
        }
        
        if (jsonData.dataFlowDetailed.errorScenarios) {
            html += '<h4>Error Scenarios:</h4>';
            html += `<p>${jsonData.dataFlowDetailed.errorScenarios}</p>`;
        }
        
        if (jsonData.dataFlowDetailed.dataValidation) {
            html += '<h4>Data Validation:</h4>';
            html += `<p>${jsonData.dataFlowDetailed.dataValidation}</p>`;
        }
        
        if (jsonData.dataFlowDetailed.transactionFlow) {
            html += '<h4>Transaction Flow:</h4>';
            html += `<p>${jsonData.dataFlowDetailed.transactionFlow}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle Data Models (only if they exist)
    if (jsonData.dataModels && jsonData.dataModels.entities && Array.isArray(jsonData.dataModels.entities)) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-building"></i> Data Models</h3>';
        
        jsonData.dataModels.entities.forEach(entity => {
            html += `<h4>${entity.name || 'Unnamed Entity'}</h4>`;
            html += '<p>This entity represents the following data structure:</p>';
            html += '<ul>';
            if (entity.attributes && Array.isArray(entity.attributes)) {
                entity.attributes.forEach(attr => {
                    html += `<li><strong>${attr.name || 'Unnamed'}</strong> (${attr.type || 'Unknown'})${attr.required ? ' - Required' : ''}${attr.enum ? ` - Options: ${attr.enum.join(', ')}` : ''}</li>`;
                });
            }
            html += '</ul>';
        });
        
        html += '</div>';
    }
    
    // Handle old Database Schema format (legacy)
    if (jsonData.databaseSchema && !jsonData.databaseSchema.description) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-database"></i> Database Schema (Legacy Format)</h3>';
        
        if (jsonData.databaseSchema.tables && Array.isArray(jsonData.databaseSchema.tables)) {
            jsonData.databaseSchema.tables.forEach(table => {
                // Check if table is a string or an object
                if (typeof table === 'string') {
                    html += `<h4>${table}</h4>`;
                    html += '<p>This table stores the following information:</p>';
                } else if (typeof table === 'object' && table.name) {
                    html += `<h4>${table.name} Table</h4>`;
                    html += '<p>This table stores the following information:</p>';
                    html += '<ul>';
                    if (table.columns && Array.isArray(table.columns)) {
                        table.columns.forEach(column => {
                            html += `<li><strong>${column.name || 'Unnamed'}</strong> (${column.type || 'Unknown'})${column.constraints ? ` - ${column.constraints.join(', ')}` : ''}</li>`;
                        });
                    }
                    html += '</ul>';
                }
            });
        }
        html += '</div>';
    }
    
    // Handle old API Endpoints format (legacy)
    if (jsonData.api) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-plug"></i> API Endpoints (Legacy Format)</h3>';
        
        if (jsonData.api.endpoints && Array.isArray(jsonData.api.endpoints)) {
            jsonData.api.endpoints.forEach(endpoint => {
                html += `<h4>${endpoint.method || 'N/A'} ${endpoint.path || 'N/A'}</h4>`;
                html += `<p>${endpoint.description || 'No description provided'}</p>`;
                if (endpoint.requestBody) {
                    html += '<p><strong>Request Body:</strong> ' + (endpoint.requestBody.type || 'N/A') + '</p>';
                }
                if (endpoint.responses) {
                    html += '<p><strong>Responses:</strong></p>';
                    html += '<ul>';
                    Object.keys(endpoint.responses).forEach(statusCode => {
                        html += `<li>${statusCode}: ${endpoint.responses[statusCode].description || 'No description'}</li>`;
                    });
                    html += '</ul>';
                }
            });
        }
        html += '</div>';
    }
    
    // Handle old Security format (legacy)
    if (jsonData.security) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-lock"></i> Security (Legacy Format)</h3>';
        
        if (jsonData.security.authentication) {
            html += `<h4>Authentication</h4>`;
            html += `<p>Type: ${jsonData.security.authentication.type || 'N/A'}</p>`;
            html += `<p>${jsonData.security.authentication.description || 'No description'}</p>`;
        }
        
        if (jsonData.security.authorization && jsonData.security.authorization.roles) {
            html += '<h4>Authorization</h4>';
            html += '<p>The system supports the following user roles:</p>';
            html += '<ul>';
            jsonData.security.authorization.roles.forEach(role => {
                html += `<li><strong>${role.role || 'N/A'}</strong>: ${role.permissions ? role.permissions.join(', ') : 'No permissions'}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.security.dataProtection) {
            html += '<h4>Data Protection</h4>';
            if (jsonData.security.dataProtection.encryption) {
                html += `<p>Encryption: ${jsonData.security.dataProtection.encryption.algorithm || 'N/A'} (${jsonData.security.dataProtection.encryption.enabled ? 'Enabled' : 'Disabled'})</p>`;
            }
            if (jsonData.security.dataProtection.passwordHashing) {
                html += `<p>Password Hashing: ${jsonData.security.dataProtection.passwordHashing.algorithm || 'N/A'} (Work Factor: ${jsonData.security.dataProtection.passwordHashing.workFactor || 'N/A'})</p>`;
            }
        }
        html += '</div>';
    }
    
    // Handle old Integration Points format (legacy)
    if (jsonData.integrationPoints) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-link"></i> Integration Points (Legacy Format)</h3>';
        
        if (jsonData.integrationPoints.externalAPIs && Array.isArray(jsonData.integrationPoints.externalAPIs)) {
            html += '<h4>External APIs</h4>';
            html += '<ul>';
            jsonData.integrationPoints.externalAPIs.forEach(api => {
                html += `<li><strong>${api.name || 'N/A'}</strong>: ${api.description || 'No description'}${api.url ? ` (${api.url})` : ''}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.integrationPoints.internalServices && Array.isArray(jsonData.integrationPoints.internalServices)) {
            html += '<h4>Internal Services</h4>';
            html += '<ul>';
            jsonData.integrationPoints.internalServices.forEach(service => {
                html += `<li><strong>${service.name || 'N/A'}</strong>: ${service.description || 'No description'}</li>`;
            });
            html += '</ul>';
        }
        
        html += '</div>';
    }
    
    // Handle new Market structure
    if (jsonData.industryOverview) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-bar-chart"></i> Industry Overview</h3>';
        
        if (jsonData.industryOverview.trends) {
            html += `<p><strong>Trends:</strong> ${jsonData.industryOverview.trends}</p>`;
        }
        
        if (jsonData.industryOverview.marketData) {
            html += `<p><strong>Market Data:</strong> ${jsonData.industryOverview.marketData}</p>`;
        }
        
        if (jsonData.industryOverview.growthProjections) {
            html += `<p><strong>Growth Projections:</strong> ${jsonData.industryOverview.growthProjections}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle new Search Trends with chart
    if (jsonData.searchTrends) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-line-chart"></i> Search Trends</h3>';
        
        if (jsonData.searchTrends.keywords && Array.isArray(jsonData.searchTrends.keywords)) {
            html += '<h4>Keywords:</h4>';
            html += '<ul>';
            jsonData.searchTrends.keywords.forEach(keyword => {
                html += `<li>${keyword}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.searchTrends.historicalData && Array.isArray(jsonData.searchTrends.historicalData)) {
            html += '<h4>Historical Data (Last 3+ Months):</h4>';
            
            // Create a simple table for the data
            html += '<div style="overflow-x: auto;"><table class="search-trends-table" style="width: 100%; border-collapse: collapse; margin-top: 15px;">';
            html += '<thead><tr style="background-color: #f5f5f5;"><th style="padding: 10px; border: 1px solid #ddd;">Month</th>';
            html += '<th style="padding: 10px; border: 1px solid #ddd;">Search Volume</th>';
            html += '<th style="padding: 10px; border: 1px solid #ddd;">Trend</th>';
            html += '<th style="padding: 10px; border: 1px solid #ddd;">Competition</th></tr></thead><tbody>';
            
            jsonData.searchTrends.historicalData.forEach(data => {
                html += `<tr><td style="padding: 10px; border: 1px solid #ddd;">${data.month || 'N/A'}</td>`;
                html += `<td style="padding: 10px; border: 1px solid #ddd;">${data.searchVolume || 'N/A'}</td>`;
                html += `<td style="padding: 10px; border: 1px solid #ddd;">${data.trend || 'N/A'}</td>`;
                html += `<td style="padding: 10px; border: 1px solid #ddd;">${data.competition || 'N/A'}</td></tr>`;
            });
            
            html += '</tbody></table></div>';
            
            // Add simple visualization suggestion
            html += '<p style="margin-top: 15px; color: #666;"><i class="fa fa-info-circle"></i> This data can be visualized as a line chart showing search volume trends over time.</p>';
        }
        
        if (jsonData.searchTrends.insights) {
            html += `<p><strong>Insights:</strong> ${jsonData.searchTrends.insights}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle new Target Audience Insights
    if (jsonData.targetAudienceInsights) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-users"></i> Target Audience Insights</h3>';
        
        if (jsonData.targetAudienceInsights.needsAnalysis) {
            html += `<p><strong>Needs Analysis:</strong> ${jsonData.targetAudienceInsights.needsAnalysis}</p>`;
        }
        
        if (jsonData.targetAudienceInsights.usageHabits) {
            html += `<p><strong>Usage Habits:</strong> ${jsonData.targetAudienceInsights.usageHabits}</p>`;
        }
        
        if (jsonData.targetAudienceInsights.demographics) {
            html += `<p><strong>Demographics:</strong> ${jsonData.targetAudienceInsights.demographics}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle new Competitive Landscape
    if (jsonData.competitiveLandscape && Array.isArray(jsonData.competitiveLandscape)) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-building"></i> Competitive Landscape</h3>';
        
        jsonData.competitiveLandscape.forEach(competitor => {
            html += `<h4>${competitor.competitor || 'Unnamed Competitor'}</h4>`;
            html += `<p><strong>Advantages:</strong> ${competitor.advantages || 'No advantages listed'}</p>`;
            html += `<p><strong>Disadvantages:</strong> ${competitor.disadvantages || 'No disadvantages listed'}</p>`;
            html += `<p><strong>Market Position:</strong> ${competitor.marketPosition || 'No market position specified'}</p>`;
        });
        
        html += '</div>';
    }
    
    // Handle new SWOT Analysis
    if (jsonData.swotAnalysis) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-search"></i> SWOT Analysis</h3>';
        
        if (jsonData.swotAnalysis.strengths && Array.isArray(jsonData.swotAnalysis.strengths)) {
            html += '<h4>Strengths:</h4>';
            html += '<ul>';
            jsonData.swotAnalysis.strengths.forEach(strength => {
                html += `<li>${strength || 'No strength specified'}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.swotAnalysis.weaknesses && Array.isArray(jsonData.swotAnalysis.weaknesses)) {
            html += '<h4>Weaknesses:</h4>';
            html += '<ul>';
            jsonData.swotAnalysis.weaknesses.forEach(weakness => {
                html += `<li>${weakness || 'No weakness specified'}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.swotAnalysis.opportunities && Array.isArray(jsonData.swotAnalysis.opportunities)) {
            html += '<h4>Opportunities:</h4>';
            html += '<ul>';
            jsonData.swotAnalysis.opportunities.forEach(opportunity => {
                html += `<li>${opportunity || 'No opportunity specified'}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.swotAnalysis.threats && Array.isArray(jsonData.swotAnalysis.threats)) {
            html += '<h4>Threats:</h4>';
            html += '<ul>';
            jsonData.swotAnalysis.threats.forEach(threat => {
                html += `<li>${threat || 'No threat specified'}</li>`;
            });
            html += '</ul>';
        }
        
        html += '</div>';
    }
    
    // Handle new Monetization Model
    if (jsonData.monetizationModel) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-money"></i> Monetization Model</h3>';
        
        if (jsonData.monetizationModel.proposedModels && Array.isArray(jsonData.monetizationModel.proposedModels)) {
            html += '<h4>Proposed Models:</h4>';
            html += '<ul>';
            jsonData.monetizationModel.proposedModels.forEach(model => {
                html += `<li>${model}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.monetizationModel.recommendations) {
            html += `<p><strong>Recommendations:</strong> ${jsonData.monetizationModel.recommendations}</p>`;
        }
        
        if (jsonData.monetizationModel.pricingStrategy) {
            html += `<p><strong>Pricing Strategy:</strong> ${jsonData.monetizationModel.pricingStrategy}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle new Pain Points
    if (jsonData.painPoints && Array.isArray(jsonData.painPoints)) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-exclamation-circle"></i> Pain Points</h3>';
        
        jsonData.painPoints.forEach((painPoint, index) => {
            html += '<div style="margin-bottom: 20px; padding: 15px; border-left: 4px solid #dc3545; background: #fff5f5;">';
            html += `<h4>Pain Point ${index + 1}</h4>`;
            
            if (painPoint.pain) {
                html += `<p><strong>Problem:</strong> ${painPoint.pain}</p>`;
            }
            
            if (painPoint.impact) {
                html += `<p><strong>Impact:</strong> ${painPoint.impact}</p>`;
            }
            
            if (painPoint.frequency) {
                html += `<p><strong>Frequency:</strong> ${painPoint.frequency}</p>`;
            }
            
            if (painPoint.emotionalImpact) {
                html += `<p><strong>Emotional Impact:</strong> ${painPoint.emotionalImpact}</p>`;
            }
            
            if (painPoint.currentWorkarounds) {
                html += `<p><strong>Current Workarounds:</strong> ${painPoint.currentWorkarounds}</p>`;
            }
            
            if (painPoint.severity) {
                html += `<p><strong>Severity:</strong> ${painPoint.severity}</p>`;
            }
            
            html += '</div>';
        });
        
        html += '</div>';
    }
    
    // Handle new Business Models Analysis
    if (jsonData.businessModelsAnalysis && Array.isArray(jsonData.businessModelsAnalysis)) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-money"></i> Business Models Analysis</h3>';
        
        jsonData.businessModelsAnalysis.forEach((model, index) => {
            html += `<div style="margin-bottom: 25px; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">`;
            html += `<h4><i class="fa fa-cog"></i> ${model.model || 'Model ' + (index + 1)}</h4>`;
            
            if (model.description) {
                html += `<p><strong>Description:</strong> ${model.description}</p>`;
            }
            
            if (model.advantages && Array.isArray(model.advantages)) {
                html += '<h5>Advantages:</h5>';
                html += '<ul>';
                model.advantages.forEach(adv => {
                    html += `<li>${adv}</li>`;
                });
                html += '</ul>';
            }
            
            if (model.disadvantages && Array.isArray(model.disadvantages)) {
                html += '<h5>Disadvantages:</h5>';
                html += '<ul>';
                model.disadvantages.forEach(dis => {
                    html += `<li>${dis}</li>`;
                });
                html += '</ul>';
            }
            
            if (model.revenuePotential) {
                html += `<p><strong>Revenue Potential:</strong> ${model.revenuePotential}</p>`;
            }
            
            if (model.fitScore) {
                html += `<p><strong>Fit Score:</strong> ${model.fitScore}</p>`;
            }
            
            if (model.implementationComplexity) {
                html += `<p><strong>Implementation Complexity:</strong> ${model.implementationComplexity}</p>`;
            }
            
            html += '</div>';
        });
        
        html += '</div>';
    }
    
    // Handle new Quality Assessment
    if (jsonData.qualityAssessment) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-check-circle"></i> Quality Assessment</h3>';
        
        if (jsonData.qualityAssessment.marketFitRating) {
            html += `<p><strong>Market Fit Rating:</strong> ${jsonData.qualityAssessment.marketFitRating}</p>`;
        }
        
        if (jsonData.qualityAssessment.technicalFeasibility) {
            html += `<p><strong>Technical Feasibility:</strong> ${jsonData.qualityAssessment.technicalFeasibility}</p>`;
        }
        
        if (jsonData.qualityAssessment.executionRiskFactors && Array.isArray(jsonData.qualityAssessment.executionRiskFactors)) {
            html += '<h4>Execution Risk Factors:</h4>';
            html += '<ul>';
            jsonData.qualityAssessment.executionRiskFactors.forEach(risk => {
                html += `<li>${risk}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.qualityAssessment.marketReadiness) {
            html += `<p><strong>Market Readiness:</strong> ${jsonData.qualityAssessment.marketReadiness}</p>`;
        }
        
        if (jsonData.qualityAssessment.keySuccessFactors && Array.isArray(jsonData.qualityAssessment.keySuccessFactors)) {
            html += '<h4>Key Success Factors:</h4>';
            html += '<ul>';
            jsonData.qualityAssessment.keySuccessFactors.forEach(factor => {
                html += `<li>${factor}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.qualityAssessment.goToMarketReadiness) {
            html += `<p><strong>Go-To-Market Readiness:</strong> ${jsonData.qualityAssessment.goToMarketReadiness}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle new Unique Selling Proposition
    if (jsonData.uniqueSellingProposition) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-star"></i> Unique Selling Proposition</h3>';
        
        if (jsonData.uniqueSellingProposition.coreValue) {
            html += `<p><strong>Core Value:</strong> ${jsonData.uniqueSellingProposition.coreValue}</p>`;
        }
        
        if (jsonData.uniqueSellingProposition.differentiationFactors && Array.isArray(jsonData.uniqueSellingProposition.differentiationFactors)) {
            html += '<h4>Differentiation Factors:</h4>';
            html += '<ul>';
            jsonData.uniqueSellingProposition.differentiationFactors.forEach(factor => {
                html += `<li>${factor}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.uniqueSellingProposition.competitiveAdvantages && Array.isArray(jsonData.uniqueSellingProposition.competitiveAdvantages)) {
            html += '<h4>Competitive Advantages:</h4>';
            html += '<ul>';
            jsonData.uniqueSellingProposition.competitiveAdvantages.forEach(adv => {
                html += `<li>${adv}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.uniqueSellingProposition.sustainability) {
            html += `<p><strong>Sustainability:</strong> ${jsonData.uniqueSellingProposition.sustainability}</p>`;
        }
        
        if (jsonData.uniqueSellingProposition.proofPoints) {
            html += `<p><strong>Proof Points:</strong> ${jsonData.uniqueSellingProposition.proofPoints}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle new Monetization Model
    if (jsonData.monetizationModel) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-dollar"></i> Monetization Model</h3>';
        
        if (jsonData.monetizationModel.proposedModels && Array.isArray(jsonData.monetizationModel.proposedModels)) {
            html += '<h4>Proposed Models:</h4>';
            html += '<ul>';
            jsonData.monetizationModel.proposedModels.forEach(model => {
                html += `<li>${model}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.monetizationModel.recommendations) {
            html += `<p><strong>Recommendations:</strong> ${jsonData.monetizationModel.recommendations}</p>`;
        }
        
        if (jsonData.monetizationModel.pricingStrategy) {
            html += `<p><strong>Pricing Strategy:</strong> ${jsonData.monetizationModel.pricingStrategy}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle new Pricing Strategy
    if (jsonData.pricingStrategy) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-tag"></i> Detailed Pricing Strategy</h3>';
        
        if (jsonData.pricingStrategy.recommendations) {
            html += `<p><strong>Recommendations:</strong> ${jsonData.pricingStrategy.recommendations}</p>`;
        }
        
        if (jsonData.pricingStrategy.pricingComparison && Array.isArray(jsonData.pricingStrategy.pricingComparison)) {
            html += '<h4>Pricing Comparison:</h4>';
            html += '<table style="width: 100%; border-collapse: collapse; margin-top: 15px;">';
            html += '<thead><tr style="background-color: #f5f5f5;"><th style="padding: 10px; border: 1px solid #ddd;">Competitor</th>';
            html += '<th style="padding: 10px; border: 1px solid #ddd;">Pricing</th>';
            html += '<th style="padding: 10px; border: 1px solid #ddd;">Features</th>';
            html += '<th style="padding: 10px; border: 1px solid #ddd;">Value Prop</th></tr></thead><tbody>';
            
            jsonData.pricingStrategy.pricingComparison.forEach(comp => {
                html += `<tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>${comp.competitor || 'N/A'}</strong></td>`;
                html += `<td style="padding: 10px; border: 1px solid #ddd;">${comp.pricing || 'N/A'}</td>`;
                html += `<td style="padding: 10px; border: 1px solid #ddd;">${comp.features || 'N/A'}</td>`;
                html += `<td style="padding: 10px; border: 1px solid #ddd;">${comp.valueProposition || 'N/A'}</td></tr>`;
            });
            
            html += '</tbody></table>';
        }
        
        if (jsonData.pricingStrategy.justification) {
            html += '<h4>Justification:</h4>';
            html += `<p>${jsonData.pricingStrategy.justification}</p>`;
        }
        
        if (jsonData.pricingStrategy.suggestedPricing) {
            html += '<h4>Suggested Pricing:</h4>';
            html += `<p>${jsonData.pricingStrategy.suggestedPricing}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle new Expected ROI
    if (jsonData.expectedROI) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-chart-line"></i> Expected ROI</h3>';
        
        if (jsonData.expectedROI.scenarios && Array.isArray(jsonData.expectedROI.scenarios)) {
            jsonData.expectedROI.scenarios.forEach((scenario, index) => {
                html += `<div style="margin-bottom: 25px; padding: 20px; border: 1px solid ${index === 1 ? '#28a745' : index === 2 ? '#ffc107' : '#dc3545'}; border-radius: 8px; background: ${index === 1 ? '#f8fff8' : index === 2 ? '#fffef0' : '#fff5f5'};">`;
                html += `<h4>${scenario.scenario || 'Scenario ' + (index + 1)}</h4>`;
                
                if (scenario.assumptions) {
                    html += `<p><strong>Assumptions:</strong> ${scenario.assumptions}</p>`;
                }
                
                if (scenario.userProjections) {
                    html += `<p><strong>User Projections:</strong> ${scenario.userProjections}</p>`;
                }
                
                if (scenario.revenueProjections) {
                    html += `<p><strong>Revenue Projections:</strong> ${scenario.revenueProjections}</p>`;
                }
                
                if (scenario.costBreakdown) {
                    html += `<p><strong>Cost Breakdown:</strong> ${scenario.costBreakdown}</p>`;
                }
                
                if (scenario.roiCalculation) {
                    html += `<p><strong>ROI Calculation:</strong> ${scenario.roiCalculation}</p>`;
                }
                
                html += '</div>';
            });
        }
        
        if (jsonData.expectedROI.riskFactors && Array.isArray(jsonData.expectedROI.riskFactors)) {
            html += '<h4>Risk Factors:</h4>';
            html += '<ul>';
            jsonData.expectedROI.riskFactors.forEach(risk => {
                html += `<li>${risk}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.expectedROI.sensitivityAnalysis) {
            html += '<h4>Sensitivity Analysis:</h4>';
            html += `<p>${jsonData.expectedROI.sensitivityAnalysis}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle new KPI Framework
    if (jsonData.kpiFramework) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-key"></i> KPI Framework</h3>';
        
        if (jsonData.kpiFramework.userMetrics && Array.isArray(jsonData.kpiFramework.userMetrics)) {
            html += '<h4>User Metrics:</h4>';
            jsonData.kpiFramework.userMetrics.forEach(metric => {
                html += '<div style="margin-bottom: 15px; padding: 15px; background: #f8f9fa; border-radius: 6px;">';
                html += `<h5>${metric.metric || 'Unnamed Metric'}</h5>`;
                
                if (metric.definition) {
                    html += `<p><strong>Definition:</strong> ${metric.definition}</p>`;
                }
                
                if (metric.targetValue) {
                    html += `<p><strong>Target Value:</strong> ${metric.targetValue}</p>`;
                }
                
                if (metric.measurementMethod) {
                    html += `<p><strong>Measurement Method:</strong> ${metric.measurementMethod}</p>`;
                }
                
                if (metric.importance) {
                    html += `<p><strong>Importance:</strong> ${metric.importance}</p>`;
                }
                
                html += '</div>';
            });
        }
        
        if (jsonData.kpiFramework.businessMetrics && Array.isArray(jsonData.kpiFramework.businessMetrics)) {
            html += '<h4>Business Metrics:</h4>';
            html += '<ul>';
            jsonData.kpiFramework.businessMetrics.forEach(metric => {
                html += `<li>${metric}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.kpiFramework.productMetrics && Array.isArray(jsonData.kpiFramework.productMetrics)) {
            html += '<h4>Product Metrics:</h4>';
            html += '<ul>';
            jsonData.kpiFramework.productMetrics.forEach(metric => {
                html += `<li>${metric}</li>`;
            });
            html += '</ul>';
        }
        
        html += '</div>';
    }
    
    // Handle new Niche Information
    if (jsonData.nicheInformation) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-bullseye"></i> Niche Information</h3>';
        
        if (jsonData.nicheInformation.nicheDefinition) {
            html += `<p><strong>Niche Definition:</strong> ${jsonData.nicheInformation.nicheDefinition}</p>`;
        }
        
        if (jsonData.nicheInformation.trends && Array.isArray(jsonData.nicheInformation.trends)) {
            html += '<h4>Trends:</h4>';
            html += '<ul>';
            jsonData.nicheInformation.trends.forEach(trend => {
                html += `<li>${trend}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.nicheInformation.opportunities && Array.isArray(jsonData.nicheInformation.opportunities)) {
            html += '<h4>Opportunities:</h4>';
            html += '<ul>';
            jsonData.nicheInformation.opportunities.forEach(opp => {
                html += `<li>${opp}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.nicheInformation.challenges && Array.isArray(jsonData.nicheInformation.challenges)) {
            html += '<h4>Challenges:</h4>';
            html += '<ul>';
            jsonData.nicheInformation.challenges.forEach(challenge => {
                html += `<li>${challenge}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.nicheInformation.growthFactors && Array.isArray(jsonData.nicheInformation.growthFactors)) {
            html += '<h4>Growth Factors:</h4>';
            html += '<ul>';
            jsonData.nicheInformation.growthFactors.forEach(factor => {
                html += `<li>${factor}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.nicheInformation.marketMaturity) {
            html += `<p><strong>Market Maturity:</strong> ${jsonData.nicheInformation.marketMaturity}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle new Market Statistics
    if (jsonData.marketStatistics) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-bar-chart"></i> Market Statistics</h3>';
        
        if (jsonData.marketStatistics.globalStatistics && Array.isArray(jsonData.marketStatistics.globalStatistics)) {
            html += '<h4>Global Statistics:</h4>';
            html += '<ul>';
            jsonData.marketStatistics.globalStatistics.forEach(stat => {
                html += `<li>${stat}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.marketStatistics.targetMarketSize) {
            html += `<p><strong>Target Market Size (TAM/SAM/SOM):</strong> ${jsonData.marketStatistics.targetMarketSize}</p>`;
        }
        
        if (jsonData.marketStatistics.growthRate) {
            html += `<p><strong>Growth Rate:</strong> ${jsonData.marketStatistics.growthRate}</p>`;
        }
        
        if (jsonData.marketStatistics.keyNumbers) {
            html += '<h4>Key Numbers:</h4>';
            html += `<p>${jsonData.marketStatistics.keyNumbers}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle new Threats Overview
    if (jsonData.threatsOverview) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-shield"></i> Threats Overview</h3>';
        
        if (jsonData.threatsOverview.externalThreats && Array.isArray(jsonData.threatsOverview.externalThreats)) {
            html += '<h4>External Threats:</h4>';
            jsonData.threatsOverview.externalThreats.forEach(threat => {
                html += '<div style="margin-bottom: 15px; padding: 15px; border-left: 4px solid #dc3545; background: #fff5f5;">';
                html += `<h5>${threat.threat || 'Unknown Threat'}</h5>`;
                
                if (threat.probability) {
                    html += `<p><strong>Probability:</strong> ${threat.probability}</p>`;
                }
                
                if (threat.impact) {
                    html += `<p><strong>Impact:</strong> ${threat.impact}</p>`;
                }
                
                if (threat.mitigation) {
                    html += `<p><strong>Mitigation:</strong> ${threat.mitigation}</p>`;
                }
                
                html += '</div>';
            });
        }
        
        if (jsonData.threatsOverview.competitiveThreats && Array.isArray(jsonData.threatsOverview.competitiveThreats)) {
            html += '<h4>Competitive Threats:</h4>';
            html += '<ul>';
            jsonData.threatsOverview.competitiveThreats.forEach(threat => {
                html += `<li>${threat}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.threatsOverview.regulatoryThreats && Array.isArray(jsonData.threatsOverview.regulatoryThreats)) {
            html += '<h4>Regulatory Threats:</h4>';
            html += '<ul>';
            jsonData.threatsOverview.regulatoryThreats.forEach(threat => {
                html += `<li>${threat}</li>`;
            });
            html += '</ul>';
        }
        
        if (jsonData.threatsOverview.marketThreats && Array.isArray(jsonData.threatsOverview.marketThreats)) {
            html += '<h4>Market Threats:</h4>';
            html += '<ul>';
            jsonData.threatsOverview.marketThreats.forEach(threat => {
                html += `<li>${threat}</li>`;
            });
            html += '</ul>';
        }
        
        html += '</div>';
    }
    
    // Handle new Complexity Rating
    if (jsonData.complexityRating) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-cogs"></i> Complexity Rating</h3>';
        
        if (jsonData.complexityRating.overallRating) {
            html += `<p><strong>Overall Rating:</strong> ${jsonData.complexityRating.overallRating}/10</p>`;
        }
        
        if (jsonData.complexityRating.technicalComplexity) {
            html += `<p><strong>Technical Complexity:</strong> ${jsonData.complexityRating.technicalComplexity}</p>`;
        }
        
        if (jsonData.complexityRating.marketComplexity) {
            html += `<p><strong>Market Complexity:</strong> ${jsonData.complexityRating.marketComplexity}</p>`;
        }
        
        if (jsonData.complexityRating.operationalComplexity) {
            html += `<p><strong>Operational Complexity:</strong> ${jsonData.complexityRating.operationalComplexity}</p>`;
        }
        
        if (jsonData.complexityRating.mitigationStrategies) {
            html += '<h4>Mitigation Strategies:</h4>';
            html += `<p>${jsonData.complexityRating.mitigationStrategies}</p>`;
        }
        
        if (jsonData.complexityRating.developmentTimeline) {
            html += '<h4>Development Timeline:</h4>';
            html += `<p>${jsonData.complexityRating.developmentTimeline}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle new Actionable Insights
    if (jsonData.actionableInsights) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-lightbulb-o"></i> Actionable Insights</h3>';
        
        if (jsonData.actionableInsights.development) {
            html += '<div style="margin-bottom: 25px;">';
            html += '<h4><i class="fa fa-code"></i> Development Insights</h4>';
            
            if (jsonData.actionableInsights.development.priorities && Array.isArray(jsonData.actionableInsights.development.priorities)) {
                html += '<h5>Priorities:</h5>';
                html += '<ul>';
                jsonData.actionableInsights.development.priorities.forEach(priority => {
                    html += `<li>${priority}</li>`;
                });
                html += '</ul>';
            }
            
            if (jsonData.actionableInsights.development.recommendations) {
                html += `<p><strong>Recommendations:</strong> ${jsonData.actionableInsights.development.recommendations}</p>`;
            }
            
            if (jsonData.actionableInsights.development.phases) {
                html += `<p><strong>Phases:</strong> ${jsonData.actionableInsights.development.phases}</p>`;
            }
            
            if (jsonData.actionableInsights.development.mvpFeatures) {
                html += `<p><strong>MVP Features:</strong> ${jsonData.actionableInsights.development.mvpFeatures}</p>`;
            }
            
            html += '</div>';
        }
        
        if (jsonData.actionableInsights.marketFit) {
            html += '<div style="margin-bottom: 25px;">';
            html += '<h4><i class="fa fa-rocket"></i> Market Fit Insights</h4>';
            
            if (jsonData.actionableInsights.marketFit.strategies && Array.isArray(jsonData.actionableInsights.marketFit.strategies)) {
                html += '<h5>Strategies:</h5>';
                html += '<ul>';
                jsonData.actionableInsights.marketFit.strategies.forEach(strategy => {
                    html += `<li>${strategy}</li>`;
                });
                html += '</ul>';
            }
            
            if (jsonData.actionableInsights.marketFit.partnerships) {
                html += `<p><strong>Partnerships:</strong> ${jsonData.actionableInsights.marketFit.partnerships}</p>`;
            }
            
            if (jsonData.actionableInsights.marketFit.timing) {
                html += `<p><strong>Timing:</strong> ${jsonData.actionableInsights.marketFit.timing}</p>`;
            }
            
            if (jsonData.actionableInsights.marketFit.targetMarkets) {
                html += `<p><strong>Target Markets:</strong> ${jsonData.actionableInsights.marketFit.targetMarkets}</p>`;
            }
            
            html += '</div>';
        }
        
        if (jsonData.actionableInsights.productPositioning) {
            html += '<div style="margin-bottom: 25px;">';
            html += '<h4><i class="fa fa-bullseye"></i> Product Positioning Insights</h4>';
            
            if (jsonData.actionableInsights.productPositioning.branding) {
                html += `<p><strong>Branding:</strong> ${jsonData.actionableInsights.productPositioning.branding}</p>`;
            }
            
            if (jsonData.actionableInsights.productPositioning.messaging) {
                html += `<p><strong>Messaging:</strong> ${jsonData.actionableInsights.productPositioning.messaging}</p>`;
            }
            
            if (jsonData.actionableInsights.productPositioning.differentiation) {
                html += `<p><strong>Differentiation:</strong> ${jsonData.actionableInsights.productPositioning.differentiation}</p>`;
            }
            
            if (jsonData.actionableInsights.productPositioning.marketPosition) {
                html += `<p><strong>Market Position:</strong> ${jsonData.actionableInsights.productPositioning.marketPosition}</p>`;
            }
            
            html += '</div>';
        }
        
        html += '</div>';
    }
    
    // Handle new Marketing Strategy
    if (jsonData.marketingStrategy) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-bullhorn"></i> Marketing Strategy</h3>';
        
        if (jsonData.marketingStrategy.channels) {
            html += `<p><strong>Channels:</strong> ${jsonData.marketingStrategy.channels}</p>`;
        }
        
        if (jsonData.marketingStrategy.community) {
            html += `<p><strong>Community:</strong> ${jsonData.marketingStrategy.community}</p>`;
        }
        
        if (jsonData.marketingStrategy.partnerships) {
            html += `<p><strong>Partnerships:</strong> ${jsonData.marketingStrategy.partnerships}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle new Design structure
    if (jsonData.visualStyleGuide) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-paint-brush"></i> Visual Style Guide</h3>';
        
        if (jsonData.visualStyleGuide.colors) {
            html += '<h4>Color Palette</h4>';
            html += '<div class="feature-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; margin: 20px 0;">';
            
            const colorsMap = normalizeVisualStyleGuideColors(jsonData.visualStyleGuide.colors);
            const colorEntries = Object.entries(colorsMap).slice(0, 24);
            
            colorEntries.forEach(([key, value]) => {
                const colorMatch = String(value).match(/^#?([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})/);
                let color = colorMatch ? ('#' + colorMatch[1]) : (String(value).startsWith('#') ? value.split(/\s/)[0] : '#6366F1');
                if (color.length === 4 && color.startsWith('#')) {
                    const x = color.slice(1);
                    color = '#' + x.split('').map(function (c) { return c + c; }).join('');
                }
                if (!/^#[0-9A-Fa-f]{6}$/i.test(color)) {
                    color = '#6366F1';
                }
                
                const dashIndex = String(value).indexOf(' - ');
                const description = dashIndex > 0 ? String(value).substring(dashIndex + 3) : '';
                
                html += '<div style="background: white; padding: 20px; border-radius: 10px; border: 2px solid #e0e0e0; text-align: center;">';
                html += `<div style="width: 60px; height: 60px; border-radius: 12px; background: ${color}; margin: 0 auto 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"></div>`;
                html += `<div style="font-weight: 600; margin-bottom: 5px;">${escapeHtmlSpec(key.charAt(0).toUpperCase() + key.slice(1))}</div>`;
                html += `<div style="color: #666; font-size: 14px;">${escapeHtmlSpec(color)}</div>`;
                if (description) {
                    html += `<div style="color: #888; font-size: 13px; margin-top: 5px;">${escapeHtmlSpec(description)}</div>`;
                }
                html += '</div>';
            });
            
            html += '</div>';
        }
        
        // Handle Color Harmony and Reasoning (new fields)
        if (jsonData.visualStyleGuide.colorHarmony) {
            html += '<div style="margin-top: 15px; padding: 15px; background-color: #f0f8ff; border-left: 4px solid #2196F3; border-radius: 4px;">';
            html += '<h4><i class="fa fa-palette"></i> Color Harmony</h4>';
            html += `<p>${jsonData.visualStyleGuide.colorHarmony}</p>`;
            
            if (jsonData.visualStyleGuide.colorReasoning) {
                html += '<h4><i class="fa fa-lightbulb-o"></i> Color Reasoning</h4>';
                html += `<p>${jsonData.visualStyleGuide.colorReasoning}</p>`;
            }
            
            html += '</div>';
        }
        
        if (jsonData.visualStyleGuide.typography) {
            html += '<h4>Typography:</h4>';
            html += '<ul>';
            if (jsonData.visualStyleGuide.typography.headings) {
                html += `<li><strong>Headings:</strong> ${jsonData.visualStyleGuide.typography.headings}</li>`;
            }
            if (jsonData.visualStyleGuide.typography.body) {
                html += `<li><strong>Body:</strong> ${jsonData.visualStyleGuide.typography.body}</li>`;
            }
            if (jsonData.visualStyleGuide.typography.captions) {
                html += `<li><strong>Captions:</strong> ${jsonData.visualStyleGuide.typography.captions}</li>`;
            }
            html += '</ul>';
        }
        
        if (jsonData.visualStyleGuide.spacing) {
            html += `<p><strong>Spacing:</strong> ${jsonData.visualStyleGuide.spacing}</p>`;
        }
        
        if (jsonData.visualStyleGuide.buttons) {
            html += `<p><strong>Buttons:</strong> ${jsonData.visualStyleGuide.buttons}</p>`;
        }
        
        if (jsonData.visualStyleGuide.animations) {
            html += `<p><strong>Animations:</strong> ${jsonData.visualStyleGuide.animations}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle new Logo & Iconography
    if (jsonData.logoIconography) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-picture-o"></i> Logo & Iconography</h3>';
        
        if (jsonData.logoIconography.logoConcepts) {
            html += `<p><strong>Logo Concepts:</strong> ${jsonData.logoIconography.logoConcepts}</p>`;
        }
        
        if (jsonData.logoIconography.colorVersions) {
            html += `<p><strong>Color Versions:</strong> ${jsonData.logoIconography.colorVersions}</p>`;
        }
        
        if (jsonData.logoIconography.iconSet) {
            html += `<p><strong>Icon Set:</strong> ${jsonData.logoIconography.iconSet}</p>`;
        }
        
        // App Icon Design (like in demo-spec.html)
        if (jsonData.logoIconography.appIcon) {
            html += '<h4 style="margin-top: 25px; margin-bottom: 20px;"><i class="fa fa-mobile"></i> App Icon Design</h4>';
            html += '<div style="display: flex; gap: 30px; align-items: center; flex-wrap: wrap;">';
            
            const appIcon = jsonData.logoIconography.appIcon;
            const letters = appIcon.letters || 'AA'; // Default to AA if not provided
            const bgColor = appIcon.bgColor || 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)'; // Default gradient
            
            // iOS App Icon
            html += '<div style="text-align: center;">';
            html += `<div style="width: 120px; height: 120px; border-radius: 25px; background: ${bgColor}; display: flex; align-items: center; justify-content: center; font-size: 48px; font-weight: bold; color: white; box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);">${letters}</div>`;
            html += '<p style="margin-top: 15px; font-weight: 600;">iOS App Icon</p>';
            html += '</div>';
            
            // Android App Icon
            html += '<div style="text-align: center;">';
            html += `<div style="width: 120px; height: 120px; border-radius: 20px; background: ${bgColor}; display: flex; align-items: center; justify-content: center; font-size: 48px; font-weight: bold; color: white; box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);">${letters}</div>`;
            html += '<p style="margin-top: 15px; font-weight: 600;">Android App Icon</p>';
            html += '</div>';
            
            // Description
            if (appIcon.description) {
                html += '<div style="flex: 1; padding: 20px; min-width: 250px;">';
                html += `<p>${appIcon.description}</p>`;
                html += '</div>';
            }
            
            html += '</div>';
        }
        
        html += '</div>';
    }
    
    // Handle new UI Layout
    if (jsonData.uiLayout) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-mobile"></i> UI Layout</h3>';
        
        if (jsonData.uiLayout.landingPage) {
            html += `<p><strong>Landing Page:</strong> ${jsonData.uiLayout.landingPage}</p>`;
        }
        
        if (jsonData.uiLayout.dashboard) {
            html += `<p><strong>Dashboard:</strong> ${jsonData.uiLayout.dashboard}</p>`;
        }
        
        if (jsonData.uiLayout.navigation) {
            html += `<p><strong>Navigation:</strong> ${jsonData.uiLayout.navigation}</p>`;
        }
        
        if (jsonData.uiLayout.responsiveDesign) {
            html += `<p><strong>Responsive Design:</strong> ${jsonData.uiLayout.responsiveDesign}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle new UX Principles
    if (jsonData.uxPrinciples) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-bullseye"></i> UX Principles</h3>';
        
        if (jsonData.uxPrinciples.userFlow) {
            html += `<p><strong>User Flow:</strong> ${jsonData.uxPrinciples.userFlow}</p>`;
        }
        
        if (jsonData.uxPrinciples.accessibility) {
            html += `<p><strong>Accessibility:</strong> ${jsonData.uxPrinciples.accessibility}</p>`;
        }
        
        if (jsonData.uxPrinciples.informationHierarchy) {
            html += `<p><strong>Information Hierarchy:</strong> ${jsonData.uxPrinciples.informationHierarchy}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle Market Content
    if (jsonData.marketOverview) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-bar-chart"></i> Market Overview</h3>';
        html += `<p>${jsonData.marketOverview}</p>`;
        html += '</div>';
    }
    
    if (jsonData.competitors && jsonData.competitors.list && Array.isArray(jsonData.competitors.list)) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-building"></i> Competitors Analysis</h3>';
        html += '<ul>';
        jsonData.competitors.list.forEach(competitor => {
            if (typeof competitor === 'object' && competitor.name && competitor.description) {
                html += `<li><strong>${competitor.name}</strong>: ${competitor.description}</li>`;
            } else if (typeof competitor === 'string') {
                html += `<li>${competitor}</li>`;
            } else {
                html += `<li>${JSON.stringify(competitor)}</li>`;
            }
        });
        html += '</ul>';
        html += '</div>';
    }
    
    if (jsonData.targetAudience && jsonData.targetAudience.personas && Array.isArray(jsonData.targetAudience.personas)) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-users"></i> Target Audience Personas</h3>';
        html += '<ul>';
        jsonData.targetAudience.personas.forEach(persona => {
            if (typeof persona === 'object' && persona.name && persona.description) {
                html += `<li><strong>${persona.name}</strong> (Age: ${persona.age || 'N/A'}): ${persona.description}</li>`;
            } else if (typeof persona === 'string') {
                html += `<li>${persona}</li>`;
            } else {
                html += `<li>${JSON.stringify(persona)}</li>`;
            }
        });
        html += '</ul>';
        html += '</div>';
    }
    
    return html || '<div class="content-section"><p>No structured content available</p></div>';
}

function formatPlainTextContent(content) {
    if (!content || typeof content !== 'string') {
        return '<p>No content available</p>';
    }
    
    // Helper function to get icon based on section title
    function getIconForSection(title) {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.match(/summary|overview|introduction/i)) return 'fa-book';
        if (lowerTitle.match(/features|functionality|capabilities/i)) return 'fa-star';
        if (lowerTitle.match(/audience|users|target|demographics/i)) return 'fa-users';
        if (lowerTitle.match(/problem|issue|challenge/i)) return 'fa-exclamation-triangle';
        if (lowerTitle.match(/solution|value|proposition/i)) return 'fa-lightbulb-o';
        if (lowerTitle.match(/technology|tech|stack|architecture/i)) return 'fa-cog';
        if (lowerTitle.match(/design|ui|ux|interface|branding/i)) return 'fa-paint-brush';
        if (lowerTitle.match(/market|competition|competitor|analysis/i)) return 'fa-bar-chart';
        if (lowerTitle.match(/monetization|pricing|revenue|business|model/i)) return 'fa-dollar-sign';
        if (lowerTitle.match(/timeline|schedule|roadmap/i)) return 'fa-calendar';
        if (lowerTitle.match(/security|privacy|authentication/i)) return 'fa-shield';
        if (lowerTitle.match(/integration|api|third.party/i)) return 'fa-link';
        if (lowerTitle.match(/database|storage|data/i)) return 'fa-database';
        if (lowerTitle.match(/scalability|performance|optimization/i)) return 'fa-line-chart';
        if (lowerTitle.match(/sector|industry|vertical/i)) return 'fa-building';
        if (lowerTitle.match(/journey|flow|process/i)) return 'fa-road';
        if (lowerTitle.match(/screen|interface|ui|components/i)) return 'fa-desktop';
        return 'fa-check-circle';
    }
    
    // Helper function to format section content (handles bullets and paragraphs)
    function formatSectionContent(text) {
        if (!text) return '';
        
        const lines = text.split('\n').filter(line => line.trim());
        let html = '';
        let inList = false;
        let currentParagraph = '';
        
        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;
            
            // Detect bullet points
            if (trimmed.match(/^[-•*]\s/) || trimmed.match(/^\d+[\.\)]\s/)) {
                // Close paragraph if open
                if (currentParagraph) {
                    html += `<p>${currentParagraph}</p>`;
                    currentParagraph = '';
                }
                
                // Start list if not already in list
                if (!inList) {
                    html += '<ul>';
                    inList = true;
                }
                
                const listItem = trimmed.replace(/^[-•*]\s/, '').replace(/^\d+[\.\)]\s/, '');
                html += `<li>${listItem}</li>`;
            } 
            // Detect lines with colons (sub-headers)
            else if (trimmed.includes(':') && trimmed.length < 200 && !trimmed.startsWith('---')) {
                // Close paragraph/list if open
                if (currentParagraph) {
                    html += `<p>${currentParagraph}</p>`;
                    currentParagraph = '';
                }
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }
                
                const parts = trimmed.split(':');
                const subHeader = parts[0].trim();
                const subContent = parts.slice(1).join(':').trim();
                
                html += `<h4>${subHeader}:</h4>`;
                if (subContent) {
                    html += `<p>${subContent}</p>`;
                }
            }
            else {
                // Regular text - build paragraph
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }
                currentParagraph += (currentParagraph ? ' ' : '') + trimmed;
            }
        });
        
        // Add remaining paragraph
        if (currentParagraph) {
            html += `<p>${currentParagraph}</p>`;
        }
        
        // Close list if still open
        if (inList) {
            html += '</ul>';
        }
        
        return html;
    }
    
    // Split by the "---" separators that mark different sections
    let sections;
    if (content.includes('---')) {
        sections = content.split(/---+/).filter(s => s.trim().length > 0);
    } else {
        // Fallback: split by newlines if no separators found
        sections = content.split('\n').filter(s => s.trim().length > 0);
    }
    
    let html = '';
    
    sections.forEach((section, index) => {
        const trimmedSection = section.trim();
        if (!trimmedSection) return;
        
        // Find the section title (usually the first line or key phrase)
        const lines = trimmedSection.split('\n');
        let sectionTitle = '';
        let sectionContent = '';
        
        // Try to find a title in the first line
        const firstLine = lines[0].trim();
        
        // Check if first line is a title (contains colon, is short, or matches known patterns)
        if (firstLine.includes(':') && firstLine.length < 150 && !firstLine.startsWith('- ') && !firstLine.startsWith('* ')) {
            const parts = firstLine.split(':');
            sectionTitle = parts[0].trim();
            sectionContent = (parts.slice(1).join(':').trim() + '\n' + lines.slice(1).join('\n')).trim();
        } else {
            // Look for key phrases that indicate section titles
            const titlePatterns = [
                /^(Value Proposition|Problem Statement|User Journey|Screen Descriptions|Detailed User Flow|Sector|Target Audience|Technology Stack|Security|Integration)/i
            ];
            
            let foundTitle = false;
            for (const pattern of titlePatterns) {
                const match = trimmedSection.match(pattern);
                if (match) {
                    sectionTitle = match[1];
                    sectionContent = trimmedSection.replace(pattern, '').trim();
                    foundTitle = true;
                    break;
                }
            }
            
            // If no title pattern found, use first few words as title
            if (!foundTitle) {
                const words = trimmedSection.split(' ').slice(0, 4).join(' ');
                sectionTitle = words;
                sectionContent = trimmedSection.replace(words, '').trim();
            }
        }
        
        // If we couldn't extract a title, use index
        if (!sectionTitle || sectionTitle.length === 0) {
            sectionTitle = `Section ${index + 1}`;
            sectionContent = trimmedSection;
        }
        
        // Get appropriate icon
        const icon = getIconForSection(sectionTitle);
        
        // Build HTML for this section
        html += '<div class="content-section">';
        html += `<h3><i class="fa ${icon}"></i> ${sectionTitle}</h3>`;
        html += formatSectionContent(sectionContent);
        html += '</div>';
    });
    
    // Fallback if no sections were created
    if (!html) {
        html = `<div class="content-section"><p>${content.replace(/\n/g, '<br>')}</p></div>`;
    }
    
    return html;
}

function updateStatus(type, status) {
    const element = document.getElementById(`${type}Status`);
    if (element) {
        element.textContent = status;
        element.className = `status-value ${status}`;

    }
    // Update notification dot based on status
    updateNotificationDot(type, status);
}

// Get viewed tabs for current spec
function getViewedTabs() {
    if (!currentSpecData || !currentSpecData.id) return new Set();
    const key = `viewedTabs_${currentSpecData.id}`;
    const viewed = localStorage.getItem(key);
    return viewed ? new Set(JSON.parse(viewed)) : new Set();
}

// Mark tab as viewed
function markTabAsViewed(type) {
    if (!currentSpecData || !currentSpecData.id) return;
    const key = `viewedTabs_${currentSpecData.id}`;
    const viewed = getViewedTabs();
    viewed.add(type);
    localStorage.setItem(key, JSON.stringify(Array.from(viewed)));
}

// Update notification dot visibility based on status
function updateNotificationDot(type, status) {
    const notificationDot = document.getElementById(`${type}Notification`);
    if (!notificationDot) return;
    
    // Get tab button and check if active
    const tabButton = document.getElementById(`${type}Tab`);
    const isActive = tabButton && tabButton.classList.contains('active');
    
    // Also check for mockup status (which uses 'mockup' key)
    let actualStatus = status;
    if (type === 'mockup' && currentSpecData && currentSpecData.status) {
        actualStatus = currentSpecData.status.mockup || status;
    }
    
    // Check if tab was already viewed (except for chat which is always a one-time notification)
    const viewedTabs = getViewedTabs();
    const wasViewed = viewedTabs.has(type);
    
    // Remove all state classes
    notificationDot.classList.remove('generating', 'notification', 'chat-notification');
    if (tabButton) {
        tabButton.classList.remove('viewed');
    }
    
    // Handle different states
    if (actualStatus === 'generating') {
        // Generating state - blinking dot
        notificationDot.classList.add('generating');
        notificationDot.style.display = 'block';
    } else if (actualStatus === 'ready') {
        if (type === 'chat') {
            // Chat - blinking notification if ready and not active
            if (!isActive) {
                notificationDot.classList.add('chat-notification');
                notificationDot.style.display = 'block';
            } else {
                notificationDot.style.display = 'none';
            }
        } else {
            // Other tabs - show notification dot if not viewed yet
            if (!isActive && !wasViewed) {
                notificationDot.classList.add('notification');
                notificationDot.style.display = 'block';
            } else {
                notificationDot.style.display = 'none';
            }
            
            // Mark as viewed if status is ready (spec exists)
            if (wasViewed || isActive) {
                if (tabButton) {
                    tabButton.classList.add('viewed');
                }
            }
        }
    } else {
        // No status or other status - hide dot
        notificationDot.style.display = 'none';
    }
    
    // If status is ready and was viewed, mark button as viewed
    if (actualStatus === 'ready' && (wasViewed || isActive)) {
        if (tabButton) {
            tabButton.classList.add('viewed');
        }
    }
}

// Update all notification dots based on current spec data
function updateAllNotificationDots() {
    if (!currentSpecData || !currentSpecData.status) return;
    
    const statusMap = {
        'technical': currentSpecData.status.technical,
        'market': currentSpecData.status.market,
        'design': currentSpecData.status.design,
        'architecture': currentSpecData.status.architecture,
        'diagrams': currentSpecData.status.diagrams,
        'mockup': currentSpecData.status.mockup,
        'chat': currentSpecData.status.chat,
        'prompts': currentSpecData.status.prompts
    };
    
    Object.keys(statusMap).forEach(type => {
        if (statusMap[type]) {
            updateNotificationDot(type, statusMap[type]);
        }
    });
}

function updateTabLoadingState(type, isLoading) {
    // Tab loading animations removed - using notification system instead
    const tabButton = document.getElementById(`${type}Tab`);
    if (!tabButton) return;
    
    // Minimal visual feedback - just enable/disable the tab
    if (isLoading) {
        tabButton.disabled = true;
    } else {
        tabButton.disabled = false;
    }
}


function updateStorageStatus() {
    
    const user = firebase.auth().currentUser;
    const hasSpecId = currentSpecData && currentSpecData.id;
    const hasUserId = currentSpecData && currentSpecData.userId;
    
    let status, statusClass;
    
    if (hasSpecId && hasUserId && user && currentSpecData.userId === user.uid) {
        // Spec is saved in Firebase and belongs to current user
        status = 'Firebase';
        statusClass = 'firebase';
    } else {
        // Spec belongs to current user but not saved to Firebase yet (shouldn't happen now)
        status = 'Local';
        statusClass = 'local';
    }
    
    
    const element = document.getElementById('storageStatus');
    if (element) {
        element.textContent = status;
        element.className = `status-value ${statusClass}`;

    }
}

// Keyboard navigation for tabs
document.addEventListener('keydown', function(e) {
  // Only handle if we're on spec-viewer page
  if (!document.querySelector('.side-menu-nav')) return;
  
  // Alt + number keys to switch tabs (Alt+1 = Overview, Alt+2 = Technical, etc.)
  if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
    const tabMap = {
      '1': 'overview',
      '2': 'technical',
      '3': 'market',
      '4': 'design',
      '5': 'architecture',
      '6': 'visibility-engine',
      '7': 'prompts',
      '8': 'chat',
      '9': 'brain-dump',
      '0': 'export'
    };
    
    const tabName = tabMap[e.key];
    if (tabName && typeof window.showTab === 'function') {
      e.preventDefault();
      const tabButton = document.getElementById(`${tabName}Tab`);
      if (tabButton && !tabButton.disabled) {
        window.showTab(tabName);
        tabButton.focus();
      }
    }
  }
  
  // Arrow keys for tab navigation when side menu is focused
  const activeTab = document.querySelector('.side-menu-button.active');
  if (activeTab && activeTab === document.activeElement) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const tabs = Array.from(document.querySelectorAll('.side-menu-button:not([disabled])'));
      const currentIndex = tabs.indexOf(activeTab);
      
      if (e.key === 'ArrowDown' && currentIndex < tabs.length - 1) {
        tabs[currentIndex + 1].focus();
      } else if (e.key === 'ArrowUp' && currentIndex > 0) {
        tabs[currentIndex - 1].focus();
      }
    }
  }
});

// Update subsections in side menu based on active tab
function updateSubsections(tabName) {
    const submenuContainer = document.getElementById(`submenu-${tabName}`);
    if (!submenuContainer) return;
    
    // If submenu already has content, don't overwrite it (preserve expanded state)
    if (submenuContainer.innerHTML.trim() !== '') {
        return;
    }
    
    const tabContent = document.getElementById(`${tabName}-content`);
    if (!tabContent) {
        submenuContainer.innerHTML = '';
        // Hide expand button if no subsections
        const expandBtn = document.querySelector(`[data-tab="${tabName}"] .side-menu-expand-sub`);
        if (expandBtn) {
            expandBtn.style.display = 'none';
        }
        return;
    }
    
    // Find all content sections with h3 headings
    const sections = tabContent.querySelectorAll('.content-section h3');
    if (sections.length === 0) {
        submenuContainer.innerHTML = '';
        // Hide expand button if no subsections
        const expandBtn = document.querySelector(`[data-tab="${tabName}"] .side-menu-expand-sub`);
        if (expandBtn) {
            expandBtn.style.display = 'none';
        }
        return;
    }
    
    // Show expand button if there are subsections
    const expandBtn = document.querySelector(`[data-tab="${tabName}"] .side-menu-expand-sub`);
    if (expandBtn) {
        expandBtn.style.display = '';
    }
    
    // Create subsections list
    let html = '';
    sections.forEach((section, index) => {
        const sectionText = section.textContent.trim();
        const sectionId = `subsection-${tabName}-${index}`;
        
        // Add id to section for scrolling
        const sectionElement = section.closest('.content-section');
        if (sectionElement && !sectionElement.id) {
            sectionElement.id = sectionId;
        }
        
        // Remove icon from text if exists
        const cleanText = sectionText.replace(/^[^\s]+\s/, '');
        
        html += `
            <div class="subsection-item" onclick="scrollToSection('${sectionId}')">
                <span>${cleanText}</span>
            </div>
        `;
    });
    
    submenuContainer.innerHTML = html;
}

// Initialize all subsections when page loads
function initializeAllSubsections() {
    const tabs = ['overview', 'technical', 'market', 'design', 'architecture', 'visibility-engine', 'prompts'];
    tabs.forEach(tabName => {
        const tabContent = document.getElementById(`${tabName}-content`);
        if (tabContent) {
            updateSubsections(tabName);
        }
    });
}

window.showNotification = showNotification;
window.markTabAsViewed = markTabAsViewed;
window.updateNotificationDot = updateNotificationDot;
window.updateSubsections = updateSubsections;
window.initializeMindMapTab = initializeMindMapTab;

// Toggle submenu
window.toggleSubmenu = function(tabName) {
    const submenu = document.getElementById(`submenu-${tabName}`);
    const expandButton = document.querySelector(`[onclick*="toggleSubmenu('${tabName}')"]`);
    
    if (submenu) {
        const isExpanded = submenu.classList.contains('expanded');
        submenu.classList.toggle('expanded');
        
        // Update aria-expanded
        if (expandButton) {
            expandButton.setAttribute('aria-expanded', !isExpanded);
        }
        
        // Announce state change to screen readers
        if (window.focusManager) {
            window.focusManager.announce(
                isExpanded ? `${tabName} submenu collapsed` : `${tabName} submenu expanded`,
                'polite'
            );
        }
    }
};

// Filter menu items based on search
window.filterMenuItems = function(searchTerm) {
    const searchLower = searchTerm.toLowerCase().trim();
    const menuItems = document.querySelectorAll('.side-menu-item');
    const submenuItems = document.querySelectorAll('.subsection-item');
    
    if (!searchTerm || searchTerm.trim() === '') {
        // Show all items
        menuItems.forEach(item => {
            item.style.display = '';
        });
        submenuItems.forEach(item => {
            item.style.display = '';
        });
        return;
    }
    
    // Filter main menu items
    menuItems.forEach(item => {
        const button = item.querySelector('.side-menu-button');
        const buttonText = button ? button.textContent.toLowerCase() : '';
        const submenu = item.querySelector('.side-menu-submenu');
        let hasMatch = false;
        
        // Check if main item matches
        if (buttonText.includes(searchLower)) {
            hasMatch = true;
        }
        
        // Check if any subsection matches
        if (submenu) {
            const subsections = submenu.querySelectorAll('.subsection-item');
            let hasSubsectionMatch = false;
            
            subsections.forEach(subsection => {
                const subsectionText = subsection.textContent.toLowerCase();
                if (subsectionText.includes(searchLower)) {
                    hasSubsectionMatch = true;
                    subsection.style.display = '';
                    hasMatch = true;
                } else {
                    subsection.style.display = 'none';
                }
            });
            
            // Expand submenu if there's a match
            if (hasSubsectionMatch) {
                submenu.classList.add('expanded');
            }
        }
        
        // Show/hide main item
        if (hasMatch) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
};

// Scroll to section
window.scrollToSection = function(sectionId) {
    // First, make sure the correct tab is shown
    const section = document.getElementById(sectionId);
    if (!section) {
        // Section not found
        return;
    }
    
    // Find which tab content contains this section
    const tabContent = section.closest('.tab-content');
    if (tabContent) {
        // Show the tab content
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.style.display = 'none';
        });
        tabContent.style.display = 'block';
        
        // Update active tab button
        const tabName = tabContent.id.replace('-content', '');
        document.querySelectorAll('.side-menu-button').forEach(btn => {
            btn.classList.remove('active');
        });
        const tabButton = document.getElementById(`${tabName}Tab`);
        if (tabButton) {
            tabButton.classList.add('active');
        }
        
        // Update currentTab
        window.currentTab = tabName;
    }
    
    // Scroll to section - center it in the viewport
    setTimeout(() => {
        // Wait for tab content to be visible
        const sectionRect = section.getBoundingClientRect();
        const absoluteElementTop = sectionRect.top + window.pageYOffset;
        const viewportHeight = window.innerHeight;
        const sectionHeight = sectionRect.height;
        const middle = absoluteElementTop - (viewportHeight / 2) + (sectionHeight / 2);
        
        window.scrollTo({
            top: Math.max(0, middle),
            behavior: 'smooth'
        });
        
        // Highlight the subsection briefly
        const subsectionItems = document.querySelectorAll('.subsection-item');
        subsectionItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(sectionId)) {
                item.classList.add('active');
                setTimeout(() => item.classList.remove('active'), 2000);
            }
        });
    }, 200);
};

// Functions for tab loading states
function setTabLoading(tabId, isLoading = true) {
    const tabButton = document.getElementById(tabId);
    if (!tabButton) return;
    
    if (isLoading) {
        tabButton.classList.add('loading');
        // No spinner - just loading state
    } else {
        tabButton.classList.remove('loading');
    }
}

function setTabStatus(tabId, status) {
    const tabButton = document.getElementById(tabId);
    if (!tabButton) return;
    
    // Remove all status classes
    tabButton.classList.remove('success', 'error', 'pending', 'loading');
    
    // Add new status class
    if (status) {
        tabButton.classList.add(status);
    }
}

// Edit mode variables and functions
let isEditMode = false;
let originalHTML = '';
let userHasProAccess = false;

// Check if user has PRO access
async function checkProAccess() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            return false;
        }
        
        // Use V3 credits API to check for unlimited access
        try {
            const data = await window.api.get('/api/v3/credits');
            if (data && data.unlimited === true) {
                return true;
            }
            // API returned but unlimited is not true - fallback to users.plan (e.g. Pro not yet synced to V3)
            const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.plan === 'pro') {
                    return true;
                }
            }
        } catch (apiError) {
            // If API call fails, fallback to checking user plan
            const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.plan === 'pro') {
                    return true;
                }
            }
        }
        
        return false;
    } catch (error) {
        return false;
    }
}
window.checkProAccess = checkProAccess;

// Update edit button based on PRO access
async function updateEditButton() {
    const editBtn = document.getElementById('editBtn');
    if (!editBtn) return;
    
    userHasProAccess = await checkProAccess();
    
    if (userHasProAccess) {
        // PRO user - enable editing
        editBtn.disabled = false;
        editBtn.classList.remove('btn-disabled', 'locked');
        editBtn.innerHTML = '<i class="fa fa-pencil"></i> Edit';
        editBtn.onclick = toggleEditMode;
    } else {
        // Non-PRO user - disable editing
        editBtn.disabled = true;
        editBtn.classList.add('btn-disabled', 'locked');
        editBtn.innerHTML = '<i class="fa fa-lock"></i> Edit <span class="pro-badge">(PRO)</span>';
        editBtn.onclick = null;
        editBtn.title = 'Editing is available for PRO users only';
    }
}

// Update mockup tab based on PRO access
async function updateMockupTab() {
    const mockupTab = document.getElementById('mockupTab');
    if (!mockupTab) return;
    
    const hasProAccess = await checkProAccess();
    
    if (!hasProAccess) {
        // Non-PRO user - keep tab disabled and show Pro badge
        mockupTab.disabled = true;
        mockupTab.title = 'Mockup feature is available for PRO users only';
    }
    // If user has Pro access, tab will be enabled when design is ready (existing logic)
}

// Update visibility engine tab based on PRO access
async function updateVisibilityEngineTab() {
    const visibilityTab = document.getElementById('visibility-engineTab');
    if (!visibilityTab) return;
    const hasProAccess = await checkProAccess();
    const canOpenByStatus = !!(currentSpecData?.status?.architecture === 'ready' || currentSpecData?.visibility);
    visibilityTab.disabled = !canOpenByStatus;
    if (!hasProAccess) {
        visibilityTab.title = 'AIO & SEO Visibility Engine is available for PRO users only';
    } else if (!canOpenByStatus) {
        visibilityTab.title = 'Visibility engine is generated after Architecture is ready';
    } else {
        visibilityTab.title = '';
    }
}

// Refresh tabs menu after Design spec is ready - enables Prompts tab if conditions are met
function refreshTabsAfterDesignReady() {
    if (!currentSpecData) return;

    // Check if overview is approved
    if (!currentSpecData.overviewApproved) {
        return;
    }

    // Enable Design tab if ready
    if (currentSpecData.status?.design === 'ready') {
        const designTab = document.getElementById('designTab');
        if (designTab) {
            designTab.disabled = false;
        }

        // Enable Architecture tab when technical is ready (depends on overview+technical)
        if (currentSpecData.status?.technical === 'ready') {
            const architectureTab = document.getElementById('architectureTab');
            if (architectureTab) {
                architectureTab.disabled = false;
            }
        }
        // Enable Brain Dump only after advanced specs + architecture
        const advancedAndArch = currentSpecData.status?.technical === 'ready' && currentSpecData.status?.market === 'ready' && currentSpecData.status?.design === 'ready' && (currentSpecData.architecture || currentSpecData.status?.architecture === 'ready');
        if (advancedAndArch && typeof enableBrainDumpTab === 'function') {
            enableBrainDumpTab();
        }

        // Enable mockup tab when design is ready (only for PRO users)
        checkProAccess().then(hasProAccess => {
            if (hasProAccess) {
                const mockupTab = document.getElementById('mockupTab');
                if (mockupTab) {
                    mockupTab.disabled = false;
                }
            }
        });
    }
    updateVisibilityEngineTab();
    
    // Enable Prompts tab only after all upstream stages are ready
    if (
        currentSpecData.status?.technical === 'ready' &&
        currentSpecData.status?.market === 'ready' &&
        currentSpecData.status?.design === 'ready' &&
        currentSpecData.status?.architecture === 'ready' &&
        currentSpecData.status?.visibility === 'ready'
    ) {
        const promptsTab = document.getElementById('promptsTab');
        if (promptsTab) {
            promptsTab.disabled = false;
            // Show Generate button only if no prompts yet
            const parsedPrompts = typeof currentSpecData.prompts === 'string' ? (() => { try { return JSON.parse(currentSpecData.prompts); } catch (e) { return null; } })() : currentSpecData.prompts;
            const hasPrompts = !!(parsedPrompts && parsedPrompts.generated);
            const generatePromptsBtn = document.getElementById('generatePromptsBtn');
            if (generatePromptsBtn) {
                generatePromptsBtn.style.display = hasPrompts ? 'none' : 'inline-block';
            }
        }
    }
    
    // Enable Diagrams tab if both technical and market are ready
    if (currentSpecData.status?.technical === 'ready' && currentSpecData.status?.market === 'ready') {
        const diagramsTab = document.getElementById('diagramsTab');
        if (diagramsTab) {
            diagramsTab.disabled = false;
            const generateDiagramsBtn = document.getElementById('generateDiagramsBtn');
            if (generateDiagramsBtn) {
                generateDiagramsBtn.style.display = 'none';
            }
        }
    }
}

function toggleEditMode() {
    // Check PRO access before allowing edit
    if (!userHasProAccess) {
        showNotification('Editing is available for PRO users only. Please upgrade to PRO to edit specifications.', 'error');
        return;
    }
    
    const editBtn = document.getElementById('editBtn');
    const container = document.getElementById('overview-data');
    
    if (!isEditMode) {
        // Enter edit mode
        isEditMode = true;
        editBtn.innerHTML = '<i class="fa fa-save"></i> Save';
        editBtn.classList.remove('btn-secondary');
        editBtn.classList.add('btn-success');
        editBtn.onclick = saveOverviewEdit;
        
        // Save current HTML structure
        originalHTML = container.innerHTML;
        window.editModeHTML = originalHTML;
        
        // Make all content sections editable but preserve icons
        const contentSections = container.querySelectorAll('.content-section');
        contentSections.forEach(section => {
            section.classList.add('editing');
            
            // Lock icons - make them non-editable
            const icons = section.querySelectorAll('i');
            icons.forEach(icon => {
                icon.setAttribute('contenteditable', 'false');
                icon.classList.add('icon-locked');
            });
            
            // Make paragraphs editable
            const paragraphs = section.querySelectorAll('p');
            paragraphs.forEach(p => {
                p.setAttribute('contenteditable', 'true');
            });
            
            // Make headings editable - wrap text nodes in spans for finer control
            const headings = section.querySelectorAll('h3');
            headings.forEach(heading => {
                heading.setAttribute('contenteditable', 'true');
            });
        });
        
        container.classList.add('edit-mode-active');
    }
}

async function saveOverviewEdit() {
    const editBtn = document.getElementById('editBtn');
    const container = document.getElementById('overview-data');
    
    try {
        // Exit edit mode first
        const contentSections = container.querySelectorAll('.content-section');
        contentSections.forEach(section => {
            section.setAttribute('contenteditable', 'false');
            section.classList.remove('editing');
        });
        
        container.classList.remove('edit-mode-active');
        
        // Get the original content for comparison
        const originalContent = window.originalOverview || currentSpecData.overview;
        
        // Extract text content from HTML structure while preserving the original structure
        const sections = [];
        contentSections.forEach(section => {
            const heading = section.querySelector('h3');
            // Get all paragraphs, preserving their order and structure
            const paragraphs = Array.from(section.querySelectorAll('p'));
            const content = paragraphs.map(p => {
                // Preserve the text content, but handle multiple paragraphs correctly
                const text = p.textContent.trim();
                return text;
            }).filter(t => t);
            
            if (heading) {
                // Extract text from heading, ignoring icons
                const headingText = Array.from(heading.childNodes)
                    .filter(node => node.nodeType === 3 || (node.nodeType === 1 && node.tagName !== 'I'))
                    .map(node => {
                        if (node.nodeType === 3) {
                            return node.textContent;
                        } else if (node.nodeType === 1 && node.tagName !== 'I') {
                            // Get text from child text nodes only
                            return Array.from(node.childNodes)
                                .filter(n => n.nodeType === 3)
                                .map(n => n.textContent)
                                .join('');
                        }
                        return '';
                    })
                    .join('')
                    .trim();
                
                if (headingText && content.length > 0) {
                    // Join paragraphs with double newlines to preserve structure
                    const sectionContent = content.join('\n\n');
                    sections.push(headingText + '\n' + sectionContent);
                } else if (headingText && content.length === 0 && sections.length > 0) {
                    // If heading exists but no content, don't add it separately
                    // This prevents breaking the structure
                }
            }
        });
        
        const editedContent = sections.join('\n\n---\n\n');
        
        // Compare with original - if no changes, use original to preserve structure
        let finalContent = editedContent;
        
        // Check if content actually changed by comparing normalized versions
        const normalizedOriginal = (originalContent || '').trim().replace(/\s+/g, ' ');
        const normalizedEdited = editedContent.trim().replace(/\s+/g, ' ');
        
        if (normalizedOriginal === normalizedEdited && originalContent) {
            // No actual changes - keep original to preserve exact structure
            finalContent = originalContent;
        }
        
        // Update local data
        currentSpecData.overview = finalContent;
        window.originalOverview = finalContent;
        
        // Only save to Firebase if content actually changed
        if (normalizedOriginal !== normalizedEdited || !originalContent) {
            // Save to Firebase
            const user = firebase.auth().currentUser;
            if (user && currentSpecData.id) {
                await firebase.firestore().collection('specs').doc(currentSpecData.id).update({
                    overview: finalContent,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Reset chat history since spec was updated
                autoResetChatOnSpecUpdate();
                
                showNotification('Overview saved successfully!', 'success');
            }
        }
        
        // Exit edit mode
        isEditMode = false;
        editBtn.innerHTML = '<i class="fa fa-pencil"></i> Edit';
        editBtn.classList.remove('btn-success');
        editBtn.classList.add('btn-secondary');
        editBtn.onclick = toggleEditMode;
        
        // Display updated content (will use original if no changes)
        displayOverview(finalContent);
        
    } catch (error) {

        showNotification('Failed to save overview: ' + error.message, 'error');
    }
}

function enableAllTabs() {
    const technicalTab = document.getElementById('technicalTab');
    const marketTab = document.getElementById('marketTab');
    const designTab = document.getElementById('designTab');
    const diagramsTab = document.getElementById('diagramsTab');
    if (technicalTab) technicalTab.disabled = false;
    if (marketTab) marketTab.disabled = false;
    if (designTab) designTab.disabled = false;
    if (diagramsTab) diagramsTab.disabled = false;
    // Enable chat after overview approval; Brain Dump only after advanced specs + architecture
    enableChatTab();
}

function enableChatTabOnly() {
    // Enable AI Chat immediately after overview approval (Brain Dump stays disabled until advanced + architecture)
    enableChatTab();
}

function disableTechnicalTabs() {
    const technicalTab = document.getElementById('technicalTab');
    const mindmapTab = document.getElementById('mindmapTab');
    const marketTab = document.getElementById('marketTab');
    const designTab = document.getElementById('designTab');
    const diagramsTab = document.getElementById('diagramsTab');
    if (technicalTab) technicalTab.disabled = true;
    if (mindmapTab) mindmapTab.disabled = true;
    if (marketTab) marketTab.disabled = true;
    if (designTab) designTab.disabled = true;
    if (diagramsTab) diagramsTab.disabled = true;
    // Note: AI Chat tab is NOT disabled here - it stays enabled after overview approval
}

function showApproveButton() {
    const approveBtn = document.getElementById('approveBtn');
    if (approveBtn) {
        approveBtn.style.display = 'inline-block';
    }
}

function hideApproveButton() {
    // Double check that specs were actually created before hiding
    if (currentSpecData && currentSpecData.overviewApproved) {
        const technicalStatus = currentSpecData.status?.technical;
        const marketStatus = currentSpecData.status?.market;
        const designStatus = currentSpecData.status?.design;
        
        const hasAtLeastOneSpecReady = 
            technicalStatus === 'ready' || 
            marketStatus === 'ready' || 
            designStatus === 'ready' ||
            technicalStatus === 'error' || 
            marketStatus === 'error' || 
            designStatus === 'error';
        
        if (!hasAtLeastOneSpecReady) {
            // Don't hide if specs weren't created yet
            return;
        }
    }
    
    const approveBtn = document.getElementById('approveBtn');
    if (approveBtn) {
        approveBtn.style.display = 'none';
    }
    // Hide the entire approval container after approval
    const approvalContainer = document.getElementById('approval-container');
    if (approvalContainer) {
        approvalContainer.style.display = 'none';
    }
}

// Function to save spec to Firebase
async function saveSpecToFirebase(user, specData) {
    try {
        const dataService = window.dataService;
        if (!dataService || typeof dataService.saveSpec !== 'function') {
            throw new Error('DataService is not initialized');
        }

        const savedSpecId = await dataService.saveSpec({ user, spec: specData });

        
        // Show success notification
        showNotification('Specification saved successfully!', 'success');
        
        // Update storage status
        updateStorageStatus();
        
        return savedSpecId;
        
    } catch (error) {

        
        // Show error notification
        showNotification(`Failed to save specification: ${error.message}`, 'error');
        
        throw error;
    }
}

// Helper function to check content size
function checkContentSize(content, contentType) {
    if (!content || typeof content !== 'string') {
        return { tooLarge: false, size: 0 };
    }
    const sizeInBytes = new Blob([content]).size;
    const maxSize = 1000000; // 1MB Firestore limit
    const sizeInMB = (sizeInBytes / 1024 / 1024).toFixed(2);
    

    
    return {
        tooLarge: sizeInBytes > maxSize,
        size: sizeInBytes,
        sizeInMB: sizeInMB,
        percentage: ((sizeInBytes / maxSize) * 100).toFixed(2)
    };
}

async function approveOverview() {
    if (isFeatureLoading('overview')) return;
    
    try {




        
        setFeatureLoading('overview', true);
        const approveBtn = document.getElementById('approveBtn');
        if (approveBtn) {
            approveBtn.disabled = true;
            approveBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Generating specifications...';
        }
        
        showNotification('Starting specification generation...', 'info');
        

        
        // Check if user is authenticated
        const user = firebase.auth().currentUser;
        if (!user) {
            showRegistrationModal();
            return;
        }
        
        // Note: Spec should already be saved to Firebase from index.js
        // Only update the approval status here
        
        // Update Firebase if user is authenticated and spec has ID
        if (user && currentSpecData && currentSpecData.id) {
            try {



                
                await firebase.firestore().collection('specs').doc(currentSpecData.id).update({
                    overviewApproved: true,
                    status: {
                        overview: "ready",
                        technical: "generating",
                        market: "generating",
                        design: "generating",
                        architecture: "pending",
                        visibility: "pending",
                        prompts: "pending"
                    },
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Reset chat history since spec status changed
                autoResetChatOnSpecUpdate();
                

                showNotification('Overview approved successfully', 'success');
            } catch (error) {

                showNotification('Failed to update database. Continuing locally...', 'error');
            }
        }
        
        // Update local data
        currentSpecData.overviewApproved = true;
        currentSpecData.status.technical = "generating";
        currentSpecData.status.market = "generating";
        currentSpecData.status.design = "generating";
        currentSpecData.status.architecture = "pending";
        currentSpecData.status.visibility = "pending";
        currentSpecData.status.prompts = "pending";
        
        // Enable AI Chat immediately after overview approval
        enableChatTabOnly();
        
        // Update UI
        updateTabLoadingState('technical', true);
        updateTabLoadingState('market', true);
        updateTabLoadingState('design', true);
        
        // Update notification dots to show generating state
        updateNotificationDot('technical', 'generating');
        updateNotificationDot('market', 'generating');
        updateNotificationDot('design', 'generating');
        
        // Start generation via server queue (runs in background, continues even if user closes window)
        showNotification('Starting generation pipeline: Technical, Market, Design, Architecture, Visibility, then Prompts...', 'info');
        
        // Show email notification for advanced spec
        setTimeout(() => {
            showNotification('⚠️ Advanced specifications take longer to generate... 💌 Don\'t worry! We\'ll send it to your email once it\'s ready!', 'info');
        }, 1500);
        
        // Use server queue API - generation continues in background even if user closes window
        try {
            const overviewForGeneration = mergeSelectedSuggestionsIntoOverview(currentSpecData.overview);
            const response = await window.api.post(`/api/specs/${currentSpecData.id}/generate-all`, {
                overview: overviewForGeneration,
                answers: currentSpecData.answers || []
            });
            
            if (response.success) {
                showNotification('Specification generation started in background. You can close this window - we\'ll notify you when it\'s ready!', 'info');
                
                // Start polling as backup (in case Firestore listener doesn't work)
                startSpecStatusPolling(currentSpecData.id);
            } else {
                throw new Error('Failed to start generation');
            }
        } catch (error) {
            // Fallback to client-side generation if queue API fails
            console.warn('Queue API failed, falling back to client-side generation:', error);
            showNotification('Using client-side generation (window must stay open)...', 'warning');
            
            // Generate all three specifications in parallel (fallback)
            const generationPromises = [
                generateTechnicalSpec().then(content => ({ type: 'technical', content })),
                generateMarketSpec().then(content => ({ type: 'market', content })),
                generateDesignSpec().then(content => ({ type: 'design', content }))
            ];
            
            // Wait for all to complete (or fail)
            const results = await Promise.allSettled(generationPromises);
            
            // Process results and update Firebase
            const updates = {
                status: {
                    ...currentSpecData.status,
                    overview: "ready"
                },
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            results.forEach((result, index) => {
                const type = ['technical', 'market', 'design'][index];
                if (result.status === 'fulfilled') {
                    const { content } = result.value;
                    updates[type] = content;
                    updates.status[type] = 'ready';
                    
                    // Update local data
                    currentSpecData[type] = content;
                    currentSpecData.status[type] = 'ready';
                    
                    // Update notification dot to show ready state
                    updateNotificationDot(type, 'ready');
                    
                    // Display the content
                    if (type === 'technical') {
                        displayTechnical(content);
                        const technicalTab = document.getElementById('technicalTab');
                        const mindmapTab = document.getElementById('mindmapTab');
                        if (technicalTab) technicalTab.disabled = false;
                        if (mindmapTab) mindmapTab.disabled = false;
                    } else if (type === 'market') {
                        displayMarket(content);
                        const marketTab = document.getElementById('marketTab');
                        if (marketTab) marketTab.disabled = false;
                    } else if (type === 'design') {
                        displayDesign(content);
                        const designTab = document.getElementById('designTab');
                        if (designTab) designTab.disabled = false;
                        refreshTabsAfterDesignReady();
                    }
                    
                    updateTabLoadingState(type, false);
                    showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} specification generated successfully!`, 'success');
                } else {
                    updates.status[type] = 'error';
                    currentSpecData.status[type] = 'error';
                    updateTabLoadingState(type, false);
                    showNotification(`Failed to generate ${type} specification: ${result.reason?.message || 'Unknown error'}`, 'error');
                }
            });
            
            // Update Firebase with all results
            if (user && currentSpecData && currentSpecData.id) {
                try {
                    await firebase.firestore().collection('specs').doc(currentSpecData.id).update(updates);
                    
                    // Update localStorage backup
                    localStorage.setItem(`specBackup_${currentSpecData.id}`, JSON.stringify(currentSpecData));
                    
                    // Update export checkboxes
                    updateExportCheckboxes();
                    
                    // Enable diagrams tab if technical and market are ready
                    if (updates.status.technical === 'ready' && updates.status.market === 'ready') {
                        const diagramsTab = document.getElementById('diagramsTab');
                        if (diagramsTab) {
                            diagramsTab.disabled = false;
                        }
                        const generateDiagramsBtn = document.getElementById('generateDiagramsBtn');
                        if (generateDiagramsBtn) {
                            generateDiagramsBtn.style.display = 'none';
                        }
                    }
                    
                    // Upload and final notification only when all stages including architecture are finished (ready or error)
                    const mergedStatus = { ...currentSpecData?.status, ...updates?.status };
                    const allStagesForUpload = ['technical', 'market', 'design', 'architecture'];
                    const allDone = allStagesForUpload.every(stage =>
                        mergedStatus[stage] === 'ready' || mergedStatus[stage] === 'error'
                    );

                    if (allDone && currentSpecData?.id) {
                        const allSuccessful = allStagesForUpload.every(stage => mergedStatus[stage] === 'ready');
                        showNotification(allSuccessful
                            ? 'All specifications generated successfully!'
                            : 'Some specifications failed. You can retry failed sections or upload what exists.', allSuccessful ? 'success' : 'error');
                        triggerOpenAIUploadForSpec(currentSpecData.id).catch(err =>
                            console.warn('Failed to upload spec to OpenAI after generation:', err));
                        hideApproveButton();
                    } else if (!mergedStatus.architecture && ['technical', 'market', 'design'].every(s => mergedStatus[s] === 'ready') && currentSpecData?.id && !currentSpecData.architecture) {
                        // Fallback: trigger architecture if backend did not (e.g. single-section flow)
                        triggerGenerateArchitecture(currentSpecData.id);
                    }
                } catch (error) {
                    if (window.appLogger) {
                        window.appLogger.logError(error, { context: 'SpecViewer.updateFirebase' });
                    }
                    showNotification('Failed to update database, but specifications were generated locally.', 'error');
                }
            }
        }
        
        // Re-enable button
        setFeatureLoading('overview', false);
        if (approveBtn) {
            approveBtn.disabled = false;
            approveBtn.innerHTML = '<i class="fa fa-check"></i> Approve Overview';
        }
        
    } catch (error) {
        showNotification(`Error initiating specification generation: ${error.message}`, 'error');
        updateStatus('technical', 'error');
        updateStatus('market', 'error');
        updateStatus('design', 'error');
        updateTabLoadingState('technical', false);
        updateTabLoadingState('market', false);
        updateTabLoadingState('design', false);
        displayTechnical('error');
        displayMarket('error');
        displayDesign('error');
        hideApproveButton();
        setFeatureLoading('overview', false);
        const approveBtn = document.getElementById('approveBtn');
        if (approveBtn) {
            approveBtn.disabled = false;
            approveBtn.innerHTML = '<i class="fa fa-check"></i> Approve Overview';
        }
    }
}

/**
 * Start polling for spec generation status (backup mechanism)
 * Used when Firestore listener fails or when user closes and reopens window
 */
function startSpecStatusPolling(specId) {
    const dataService = window.dataService;
    if (!dataService || typeof dataService.startStatusPolling !== 'function') {
        return;
    }
    dataService.startStatusPolling(specId, {
        onSpecReloaded: async (updatedData) => {
            updateCurrentSpecData(updatedData);
            displaySpec(updatedData);
        }
    });
}

async function generateTechnicalSpec(retryCount = 0, maxRetries = 2) {
    
    // Use reference if spec has ID, otherwise fallback to full content
    const firstParam = currentSpecData.id ? currentSpecData.id : currentSpecData.overview;
    let prompt = PROMPTS.technical(firstParam, currentSpecData.answers);
    
    // If using reference (specId), replace it with actual overview content
    if (currentSpecData.id && currentSpecData.overview) {
        const referencePattern = /\[SPEC_REFERENCE\]\s+Spec ID: [^\n]+\s+Overview Location: [^\n]+\s+Note: [^\n]+\./s;
        if (prompt.includes('[SPEC_REFERENCE]')) {
            // Replace reference with actual overview content
            prompt = prompt.replace(referencePattern, `Application Overview:\n${currentSpecData.overview}`);

        }
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
    
    
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout (2 minutes)
    
    try {
        const response = await fetch('/api/auxiliary/prompts/generate', {
            method: 'POST',
            headers: await getAuxHeaders(),
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        



        
        if (!response.ok) {
            const errorText = await response.text();

            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }
        
        const responseText = await response.text();
        
        const data = JSON.parse(responseText);

        
        const result = data.technical ? JSON.stringify(data.technical, null, 2) : 'No technical specification generated';
        
        return result;
        
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {

            
            // Auto-retry on timeout if we haven't exceeded max retries
            if (retryCount < maxRetries) {

                showNotification(`Technical API timeout, retrying... (${retryCount + 1}/${maxRetries})`, 'info');
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                return await generateTechnicalSpec(retryCount + 1, maxRetries);
            } else {
                showNotification('Technical API timed out after multiple attempts. Please try again.', 'error');
                throw new Error('API call timed out after 120 seconds. Please try again.');
            }
        } else {

            throw error;
        }
    }
}

async function generateMarketSpec(retryCount = 0, maxRetries = 2) {

    
    // Use reference if spec has ID, otherwise fallback to full content
    const firstParam = currentSpecData.id ? currentSpecData.id : currentSpecData.overview;
    let prompt = PROMPTS.market(firstParam, currentSpecData.answers);
    
    // If using reference (specId), replace it with actual overview content
    if (currentSpecData.id && currentSpecData.overview) {
        const referencePattern = /\[SPEC_REFERENCE\]\s+Spec ID: [^\n]+\s+Overview Location: [^\n]+\s+Note: [^\n]+\./s;
        if (prompt.includes('[SPEC_REFERENCE]')) {
            // Replace reference with actual overview content
            prompt = prompt.replace(referencePattern, `Application Overview:\n${currentSpecData.overview}`);

        }
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
    
    
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout (2 minutes)
    
    try {
        const response = await fetch('/api/auxiliary/prompts/generate', {
            method: 'POST',
            headers: await getAuxHeaders(),
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        



        
        if (!response.ok) {
            const errorText = await response.text();

            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }
        
        const responseText = await response.text();
        
        const data = JSON.parse(responseText);

        
        const result = data.market ? JSON.stringify(data.market, null, 2) : 'No market research generated';
        
        return result;
        
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {

            
            // Auto-retry on timeout if we haven't exceeded max retries
            if (retryCount < maxRetries) {

                showNotification(`Market API timeout, retrying... (${retryCount + 1}/${maxRetries})`, 'info');
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                return await generateMarketSpec(retryCount + 1, maxRetries);
            } else {
                showNotification('Market API timed out after multiple attempts. Please try again.', 'error');
                throw new Error('API call timed out after 120 seconds. Please try again.');
            }
        } else {

            showNotification(`Market API error: ${error.message}`, 'error');
            throw error;
        }
    }
}

async function generateDesignSpec(retryCount = 0, maxRetries = 2) {

    
    // Use reference if spec has ID, otherwise fallback to full content
    const firstParam = currentSpecData.id ? currentSpecData.id : currentSpecData.overview;
    let prompt = PROMPTS.design(firstParam, currentSpecData.answers);
    
    // If using reference (specId), replace it with actual overview content
    if (currentSpecData.id && currentSpecData.overview) {
        const referencePattern = /\[SPEC_REFERENCE\]\s+Spec ID: [^\n]+\s+Overview Location: [^\n]+\s+Note: [^\n]+\./s;
        if (prompt.includes('[SPEC_REFERENCE]')) {
            // Replace reference with actual overview content
            prompt = prompt.replace(referencePattern, `Application Overview:\n${currentSpecData.overview}`);

        }
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
    
    
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout (2 minutes)
    
    try {
        const response = await fetch('/api/auxiliary/prompts/generate', {
            method: 'POST',
            headers: await getAuxHeaders(),
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        



        
        if (!response.ok) {
            const errorText = await response.text();

            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }
        
        const responseText = await response.text();
        
        const data = JSON.parse(responseText);

        
        const result = data.design ? JSON.stringify(data.design, null, 2) : 'No design specification generated';
        
        return result;
        
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {

            
            // Auto-retry on timeout if we haven't exceeded max retries
            if (retryCount < maxRetries) {

                showNotification(`Design API timeout, retrying... (${retryCount + 1}/${maxRetries})`, 'info');
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                return await generateDesignSpec(retryCount + 1, maxRetries);
            } else {
                showNotification('Design API timed out after multiple attempts. Please try again.', 'error');
                throw new Error('API call timed out after 120 seconds. Please try again.');
            }
        } else {

            showNotification(`Design API error: ${error.message}`, 'error');
            throw error;
        }
    }
}

async function retryTechnical() {
    const retryTechnicalBtn = document.getElementById('retryTechnicalBtn');
    if (retryTechnicalBtn) {
        retryTechnicalBtn.disabled = true;
        retryTechnicalBtn.textContent = '⏳ Generating...';
    }
    updateTabLoadingState('technical', true);

    try {
        await window.api.post(`/api/specs/${currentSpecData.id}/generate-section`, { section: 'technical' });
        showNotification('Technical specification generation started. The page will update when ready.', 'info');
        // Firestore listener will update UI when backend finishes (ready or error)
    } catch (error) {
        if (retryTechnicalBtn) {
            retryTechnicalBtn.disabled = false;
            retryTechnicalBtn.textContent = 'Retry';
        }
        updateTabLoadingState('technical', false);
        showNotification(`Failed to start technical generation: ${error.message || 'Please try again.'}`, 'error');
    }
}

async function retryMarket() {
    const retryMarketBtn = document.getElementById('retryMarketBtn');
    if (retryMarketBtn) {
        retryMarketBtn.disabled = true;
        retryMarketBtn.textContent = '⏳ Generating...';
    }
    updateTabLoadingState('market', true);

    try {
        await window.api.post(`/api/specs/${currentSpecData.id}/generate-section`, { section: 'market' });
        showNotification('Market research generation started. The page will update when ready.', 'info');
        // Firestore listener will update UI when backend finishes (ready or error)
    } catch (error) {
        if (retryMarketBtn) {
            retryMarketBtn.disabled = false;
            retryMarketBtn.textContent = 'Retry';
        }
        updateTabLoadingState('market', false);
        showNotification(`Failed to start market generation: ${error.message || 'Please try again.'}`, 'error');
    }
}

async function retryDesign() {
    const retryDesignBtn = document.getElementById('retryDesignBtn');
    if (retryDesignBtn) {
        retryDesignBtn.disabled = true;
        retryDesignBtn.textContent = '⏳ Generating...';
    }
    updateTabLoadingState('design', true);

    try {
        await window.api.post(`/api/specs/${currentSpecData.id}/generate-section`, { section: 'design' });
        showNotification('Design specification generation started. The page will update when ready.', 'info');
        // Firestore listener will update UI when backend finishes (ready or error)
    } catch (error) {
        if (retryDesignBtn) {
            retryDesignBtn.disabled = false;
            retryDesignBtn.textContent = 'Retry';
        }
        updateTabLoadingState('design', false);
        showNotification(`Failed to start design generation: ${error.message || 'Please try again.'}`, 'error');
    }
}

function showLoading() {
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const content = document.getElementById('content');
    if (loading) loading.style.display = 'block';
    if (error) error.style.display = 'none';
    if (content) content.style.display = 'none';
}

function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
    }
}

function showError(message) {
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const errorMessage = document.getElementById('error-message');
    const content = document.getElementById('content');
    if (loading) loading.style.display = 'none';
    if (error) error.style.display = 'block';
    if (errorMessage) errorMessage.textContent = message;
    if (content) content.style.display = 'none';
}

function hideError() {
    const error = document.getElementById('error');
    if (error) {
        error.style.display = 'none';
    }
}

function retryLoad() {
    if (urlSpecId) {
        loadSpec(urlSpecId);
    }
}

// Diagrams Functions

/**
 * Auto-repair broken diagrams (one time only per diagram)
 * This function sends broken diagrams for repair automatically in the background
 */
async function autoRepairBrokenDiagrams() {
    if (!currentSpecData || !currentSpecData.id) {

        return;
    }
    
    // Find broken diagrams that haven't been sent for auto-repair yet
    const brokenDiagrams = diagramsData.filter(diagram => 
        diagram._isValid === false && 
        !diagram._autoRepairSent &&
        diagram.mermaidCode && 
        typeof diagram.mermaidCode === 'string' && 
        diagram.mermaidCode.trim().length > 0
    );
    
    if (brokenDiagrams.length === 0) {
        return; // No broken diagrams to repair
    }
    

    
    // Send each broken diagram for repair in parallel (fire and forget)
    // We don't wait for completion to avoid blocking
    brokenDiagrams.forEach((diagram) => {
        // Mark as sent immediately to prevent duplicates
        diagram._autoRepairSent = true;
        
        // Update UI to show "Auto-repairing..." status
        const statusIndicator = document.querySelector(`#diagram-${diagram.id} .status-indicator`);
        const statusText = document.querySelector(`#diagram-${diagram.id} .status-text`);
        if (statusIndicator) statusIndicator.className = 'status-indicator repairing';
        if (statusText) statusText.textContent = 'Auto-repairing...';
        
        // Start repair process (don't await - run in background)
        (async () => {
            try {
                const user = firebase.auth().currentUser;
                if (!user) {

                    return;
                }
                
                // Call repair endpoint
                const result = await window.api.post('/api/chat/diagrams/repair', {
                    specId: currentSpecData.id,
                    diagramId: diagram.id,
                    brokenCode: diagram.mermaidCode,
                    diagramType: diagram.type,
                    errorMessage: diagram._lastError || ''
                });
                
                if (result.repairedDiagram && result.repairedDiagram.mermaidCode) {
                    // Update the diagram data with repaired code
                    diagram.mermaidCode = result.repairedDiagram.mermaidCode;
                    
                    // Try to re-render the diagram to validate it works
                    await renderSingleDiagram(diagram, `diagram-${diagram.id}-content`, true);
                    
                    // Check if diagram is now valid
                    if (diagram._isValid === true) {
                        // Save to Firebase if diagram renders successfully
                        await firebase.firestore().collection('specs').doc(currentSpecData.id).update({
                            'diagrams.diagrams': diagramsData,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });

                        
                        // Update local data
                        if (currentSpecData.diagrams) {
                            currentSpecData.diagrams.diagrams = diagramsData;
                        }
                        
                        showNotification(`Diagram "${diagram.title}" auto-repaired successfully!`, 'success');
                    } else {
                        // Diagram still has errors even after repair
                        // Retry once more with error details if first attempt didn't work
                        if (!diagram._retryAttempted && diagram._lastError) {
                            diagram._retryAttempted = true;


                            
                            // Update UI to show retry status
                            const statusIndicator = document.querySelector(`#diagram-${diagram.id} .status-indicator`);
                            const statusText = document.querySelector(`#diagram-${diagram.id} .status-text`);
                            if (statusIndicator) statusIndicator.className = 'status-indicator repairing';
                            if (statusText) statusText.textContent = 'Retrying repair...';
                            
                            // Retry repair with error message
                            try {
                                const retryResult = await window.api.post('/api/chat/diagrams/repair', {
                                    specId: currentSpecData.id,
                                    diagramId: diagram.id,
                                    brokenCode: diagram.mermaidCode,
                                    diagramType: diagram.type,
                                    errorMessage: diagram._lastError
                                });
                                if (retryResult) {
                                    
                                    if (retryResult.repairedDiagram && retryResult.repairedDiagram.mermaidCode) {
                                        diagram.mermaidCode = retryResult.repairedDiagram.mermaidCode;
                                        await renderSingleDiagram(diagram, `diagram-${diagram.id}-content`, true);
                                        
                                        if (diagram._isValid === true) {
                                            await firebase.firestore().collection('specs').doc(currentSpecData.id).update({
                                                'diagrams.diagrams': diagramsData,
                                                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                                            });

                                            if (currentSpecData.diagrams) {
                                                currentSpecData.diagrams.diagrams = diagramsData;
                                            }
                                            
                                            // Upload updated spec to OpenAI API for chat purposes (non-blocking)
                                            triggerOpenAIUploadForSpec(currentSpecData.id).catch(err => {
                                                // Non-blocking - don't interrupt user experience
                                                console.warn('Failed to upload spec to OpenAI after diagram repair:', err);
                                            });
                                            
                                            showNotification(`Diagram "${diagram.title}" auto-repaired successfully after retry!`, 'success');
                                            return; // Success - exit early
                                        }
                                    }
                                }
                            } catch (retryError) {

                            }
                        }
                        
                        // If we get here, both attempts failed




                        const statusIndicator = document.querySelector(`#diagram-${diagram.id} .status-indicator`);
                        const statusText = document.querySelector(`#diagram-${diagram.id} .status-text`);
                        if (statusIndicator) statusIndicator.className = 'status-indicator error';
                        if (statusText) statusText.textContent = 'Repair failed';
                    }
                }
                
            } catch (error) {

                
                // Reset status
                const statusIndicator = document.querySelector(`#diagram-${diagram.id} .status-indicator`);
                const statusText = document.querySelector(`#diagram-${diagram.id} .status-text`);
                if (statusIndicator) statusIndicator.className = 'status-indicator error';
                if (statusText) statusText.textContent = 'Auto-repair failed';
                
                // Note: We don't reset _autoRepairSent so we don't retry automatically
                // User can manually repair if needed
            }
            
            // Save updated flags to Firebase (even if repair failed)
            try {
                await firebase.firestore().collection('specs').doc(currentSpecData.id).update({
                    'diagrams.diagrams': diagramsData,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (error) {

            }
        })();
    });
}

async function generateDiagrams() {
    if (isFeatureLoading('diagrams')) return;
    
    try {
        setFeatureLoading('diagrams', true);
        const generateBtn = document.getElementById('generateDiagramsBtn');
        
        // Store original background color and styles
        const originalBgColor = window.getComputedStyle(generateBtn).backgroundColor;
        const originalClasses = generateBtn.className;
        
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Generating Diagrams...';
        generateBtn.style.cursor = 'wait';
        
        // Keep the original background color and prevent it from changing (important to override any CSS)
        generateBtn.style.backgroundColor = originalBgColor || '';
        generateBtn.style.opacity = '1'; // Prevent opacity changes on disabled
        
        // Update status to generating
        if (currentSpecData && currentSpecData.status) {
            currentSpecData.status.diagrams = 'generating';
            updateNotificationDot('diagrams', 'generating');
        }
        
        // Starting diagram generation...
        
        // Check if technical spec exists
        if (!currentSpecData.technical || currentSpecData.technical === 'error') {
            throw new Error('Technical specification must be generated first');
        }
        
        // Get Firebase auth token
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('User must be authenticated');
        }
        
        // Call new memory-based API endpoint - only send specId
        const result = await window.api.post('/api/chat/diagrams/generate', { specId: currentSpecData.id });

        if (result && result.deprecated) {
            showNotification(result.message || 'Diagrams are embedded in the Technical and Architecture tabs.', 'info');
            if (currentSpecData && currentSpecData.status) {
                currentSpecData.status.diagrams = 'ready';
                updateNotificationDot('diagrams', 'ready');
            }
            updateDiagramsStatus('ready');
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.style.display = 'none';
                generateBtn.innerHTML = 'Generate Diagrams';
                generateBtn.style.cursor = 'pointer';
            }
            return;
        }

        if (result && result.diagrams && Array.isArray(result.diagrams)) {
            // Store ALL diagrams data globally (including broken ones)
            diagramsData = result.diagrams;
            
            // Initialize flags for all diagrams
            diagramsData.forEach(diagram => {
                if (!diagram._autoRepairSent) {
                    diagram._autoRepairSent = false;
                }
            });
            
            // Display ALL diagrams first (to validate them)
            displayDiagrams(diagramsData);
            
            // Wait a bit for diagrams to render
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Count valid diagrams
            const validDiagramsCount = diagramsData.filter(d => d._isValid === true).length;
            

            
            // Save ALL diagrams to Firebase (including broken ones)
            if (currentSpecData && currentSpecData.id) {
                try {
                    await firebase.firestore().collection('specs').doc(currentSpecData.id).update({
                        diagrams: {
                            generated: true,
                            diagrams: diagramsData,
                            validatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        },
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    // Update local spec data immediately so UI reflects without refresh
                    currentSpecData.diagrams = { generated: true, diagrams: diagramsData };
                    // Update export checkboxes when diagrams are ready
                    updateExportCheckboxes();
                    
                    // Upload updated spec to OpenAI API for chat purposes (non-blocking)
                    triggerOpenAIUploadForSpec(currentSpecData.id).catch(err => {
                        // Non-blocking - don't interrupt user experience
                        console.warn('Failed to upload spec to OpenAI after diagrams generation:', err);
                    });
                } catch (error) {

                }
            }
            
            // Send broken diagrams for auto-repair (one time only)
            autoRepairBrokenDiagrams();
            
            // Update status
            updateDiagramsStatus('ready');
            if (currentSpecData && currentSpecData.status) {
                currentSpecData.status.diagrams = 'ready';
                updateNotificationDot('diagrams', 'ready');
            }
            
            // Reset button before hiding (in case it's shown again)
            generateBtn.disabled = false;
            generateBtn.innerHTML = 'Generate Diagrams';
            generateBtn.style.backgroundColor = '';
            generateBtn.style.cursor = 'pointer';
            
            // Hide generate button
            generateBtn.style.display = 'none';
            
            // Show notification based on results
            if (validDiagramsCount === result.diagrams.length) {
                showNotification(`All ${result.diagrams.length} diagrams generated successfully!`, 'success');
            } else {
                showNotification(`${validDiagramsCount} out of ${result.diagrams.length} diagrams working. ${result.diagrams.length - validDiagramsCount} being auto-repaired.`, 'warning');
            }
            
        } else {
            throw new Error('Invalid response format: missing diagrams array');
        }
        
    } catch (error) {

        showNotification(`Failed to generate diagrams: ${error.message}`, 'error');
        
        // Reset button
        const generateBtn = document.getElementById('generateDiagramsBtn');
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = 'Generate Diagrams';
            generateBtn.style.backgroundColor = '';
            generateBtn.style.cursor = 'pointer';
        }
    } finally {
        setFeatureLoading('diagrams', false);
    }
}

/**
 * Generate a single development stage
 * @param {number} stageNumber - Stage number (1-10)
 * @param {string} requestId - Request ID for logging
 * @param {string} overviewContent - Overview specification content
 * @param {string} technicalContent - Technical specification content
 * @param {string} designContent - Design specification content
 * @param {Array<string>} previousStages - Array of previously generated stages
 * @param {Function} updateProgress - Function to update progress UI
 * @returns {Promise<string>} Generated stage content
 */
async function generateSingleStage(stageNumber, requestId, overviewContent, technicalContent, designContent, previousStages, updateProgress) {
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
    
    const STAGE_TIMEOUT_MS = 120000; // 120 seconds per stage
    const stageName = STAGE_NAMES[stageNumber];
    const stageStartTime = Date.now();
    
    console.log(`[${requestId}] [generateSingleStage] Starting stage ${stageNumber}: ${stageName}`, {
        stageNumber,
        stageName,
        previousStagesCount: previousStages.length,
        timestamp: new Date().toISOString()
    });
    
    if (updateProgress) {
        updateProgress(stageNumber, 'generating', `Generating Stage ${stageNumber}: ${stageName}...`);
    }
    
    // Build stage-specific prompt
    const stagePrompt = `You are generating STAGE ${stageNumber}: ${stageName} for a development prompt.

CRITICAL REQUIREMENTS:
1. Generate ONLY the content for STAGE ${stageNumber} - do NOT include other stages
2. Keep it CONCISE and FOCUSED - aim for 1,000-2,000 characters (not 2,500-5,000)
3. Include sub-steps (${stageNumber}.1, ${stageNumber}.2, etc.) with clear, actionable instructions
4. Replace ALL placeholders [LIKE_THIS] with actual values from the specifications
5. Focus on WHAT to build and HOW to structure it, NOT on writing actual code
6. You can mention:
   - File/folder structure (e.g., "Create src/components/UserProfile.tsx")
   - Variable/function names (e.g., "Create a function called handleUserLogin")
   - Component structure (e.g., "Component should have props: userId, onSave")
   - API endpoint structure (e.g., "POST /api/users/:id/profile")
   - Database schema structure (e.g., "Table: users with columns: id, email, name")
7. DO NOT include:
   - Full code blocks with implementation
   - Complete function bodies with logic
   - Detailed code syntax
   - Import statements or package.json content
8. The stage must be self-contained but reference previous stages when needed

${previousStages.length > 0 ? `PREVIOUS STAGES CONTEXT:\n${previousStages.map((s, i) => `Stage ${i + 1} (summary): ${s.substring(0, 300)}...`).join('\n\n')}\n\n` : ''}

STAGE ${stageNumber} TEMPLATE:
═══════════════════════════════════════════════════════════════
STAGE ${stageNumber}: ${stageName}
═══════════════════════════════════════════════════════════════

${stageNumber}.1 [First sub-step - describe what to create, file structure, component names]
${stageNumber}.2 [Second sub-step - describe configuration, API endpoints, data models]
${stageNumber}.3 [Additional sub-steps as needed - keep concise and focused]

[Continue with clear, actionable instructions - mention structure and names, not full code]

Return ONLY the content for STAGE ${stageNumber} (without the stage header - just the content).`;

    const requestBody = {
        stage: 'prompt-stage', // Use new stage type for single stage generation
        locale: 'en-US',
        temperature: 0,
        prompt: {
            system: 'You are an expert software development prompt engineer. Generate concise, clear development stage content focused on structure and architecture, not full code implementation.',
            developer: `Generate ONLY STAGE ${stageNumber} content. Return ONLY valid JSON with structure: { "prompts": { "fullPrompt": "..." } }. The fullPrompt must contain ONLY the content for STAGE ${stageNumber} (without the stage header). Keep it CONCISE (1,000-2,000 characters). Include sub-steps (${stageNumber}.1, ${stageNumber}.2, etc.) with clear instructions. Focus on WHAT to build and structure, NOT on writing actual code. You can mention file names, component names, variable names, API endpoints, database schemas - but DO NOT include full code blocks or implementation details. Replace all placeholders with actual values from the specifications.`,
            user: `Application Overview:\n${overviewContent || 'Not provided'}\n\nTechnical Specification:\n${technicalContent || 'Not provided'}\n\nDesign Specification:\n${designContent || 'Not provided'}\n\n${stagePrompt}`
        }
    };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.error(`[${requestId}] [generateSingleStage] Stage ${stageNumber} timeout after ${STAGE_TIMEOUT_MS}ms`);
        controller.abort();
    }, STAGE_TIMEOUT_MS);
    
    const workerUrl = '/api/auxiliary/prompts/generate';
    const requestBodySize = JSON.stringify(requestBody).length;
    
    console.log(`[${requestId}] [generateSingleStage] Sending request for stage ${stageNumber}`, {
        stageNumber,
        stageName,
        requestBodySize,
        requestBodySizeKB: (requestBodySize / 1024).toFixed(2),
        timeout: STAGE_TIMEOUT_MS
    });
    
    try {
        const fetchStartTime = Date.now();
        const response = await fetch(workerUrl, {
            method: 'POST',
            headers: await getAuxHeaders(),
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        
        const fetchDuration = Date.now() - fetchStartTime;
        clearTimeout(timeoutId);
        
        console.log(`[${requestId}] [generateSingleStage] Stage ${stageNumber} response received`, {
            stageNumber,
            stageName,
            duration: fetchDuration,
            durationSeconds: (fetchDuration / 1000).toFixed(2),
            status: response.status,
            ok: response.ok
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[${requestId}] [generateSingleStage] Stage ${stageNumber} failed`, {
                stageNumber,
                stageName,
                status: response.status,
                errorText: errorText.substring(0, 500)
            });
            throw new Error(`Stage ${stageNumber} failed: ${response.status} - ${errorText.substring(0, 200)}`);
        }
        
        const responseText = await response.text();
        const data = JSON.parse(responseText);
        
        if (!data.prompts || !data.prompts.fullPrompt) {
            console.error(`[${requestId}] [generateSingleStage] Stage ${stageNumber} invalid response`, {
                stageNumber,
                stageName,
                dataKeys: Object.keys(data)
            });
            throw new Error(`Stage ${stageNumber} invalid response: missing fullPrompt`);
        }
        
        const stageContent = data.prompts.fullPrompt;
        const stageDuration = Date.now() - stageStartTime;
        
        console.log(`[${requestId}] [generateSingleStage] Stage ${stageNumber} completed successfully`, {
            stageNumber,
            stageName,
            duration: stageDuration,
            durationSeconds: (stageDuration / 1000).toFixed(2),
            contentLength: stageContent.length,
            contentSizeKB: (stageContent.length / 1024).toFixed(2)
        });
        
        // Don't update progress here - it will be updated in generatePrompts with content
        return stageContent;
        
    } catch (error) {
        clearTimeout(timeoutId);
        const stageDuration = Date.now() - stageStartTime;
        
        // Provide more detailed error information
        let errorMessage = error.message;
        if (error.name === 'AbortError' || error.message?.includes('aborted')) {
            errorMessage = `Request timed out after ${STAGE_TIMEOUT_MS / 1000} seconds. The worker may be overloaded or unresponsive.`;
        } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
            errorMessage = `Network error: Unable to reach the prompts service. Please check your internet connection.`;
        } else if (error.message?.includes('TypeError')) {
            errorMessage = `Request failed: ${error.message}`;
        }
        
        console.error(`[${requestId}] [generateSingleStage] Stage ${stageNumber} error`, {
            stageNumber,
            stageName,
            duration: stageDuration,
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack,
            workerUrl,
            requestBodySize: JSON.stringify(requestBody).length
        });
        
        if (updateProgress) {
            updateProgress(stageNumber, 'error', `Stage ${stageNumber} failed: ${errorMessage.substring(0, 50)}`);
        }
        
        // Create a more informative error
        const detailedError = new Error(`Stage ${stageNumber} (${stageName}) failed: ${errorMessage}`);
        detailedError.name = error.name;
        detailedError.originalError = error;
        throw detailedError;
    }
}

async function generatePrompts() {
    const startTime = Date.now();
    const requestId = `prompts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const STAGE_TIMEOUT_MS = 120000; // 120 seconds per stage
    const TOTAL_STAGES = 10;
    
    console.log(`[${requestId}] [generatePrompts] Starting staged prompts generation`, {
        timestamp: new Date().toISOString(),
        specId: currentSpecData?.id,
        isLoading: isFeatureLoading('prompts'),
        totalStages: TOTAL_STAGES,
        stageTimeout: STAGE_TIMEOUT_MS
    });
    
    if (window.appLogger) {
        window.appLogger.log('FeatureUsage', 'Starting staged prompts generation', {
            requestId,
            specId: currentSpecData?.id,
            feature: 'generatePrompts',
            totalStages: TOTAL_STAGES,
            stageTimeout: STAGE_TIMEOUT_MS
        });
    }
    
    if (isFeatureLoading('prompts')) {
        console.warn(`[${requestId}] [generatePrompts] Already loading, skipping request`);
        return;
    }
    
    try {
        setFeatureLoading('prompts', true);
        const generateBtn = document.getElementById('generatePromptsBtn');
        
        if (!generateBtn) {
            throw new Error('Generate prompts button not found in DOM');
        }
        
        console.log(`[${requestId}] [generatePrompts] Button found, updating UI`);
        
        // Store original background color and styles
        const originalBgColor = window.getComputedStyle(generateBtn).backgroundColor;
        const originalClasses = generateBtn.className;
        
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Generating Prompts (Staged)...';
        generateBtn.style.cursor = 'wait';
        
        // Create progress container
        const progressContainer = document.getElementById('prompts-data');
        let progressHTML = '<div class="prompts-progress-container" style="margin: 20px 0; padding: 20px; background: #f5f5f5; border-radius: 8px;">';
        progressHTML += '<h3 style="margin-bottom: 15px;"><i class="fa fa-spinner fa-spin" style="margin-right: 8px; color: #ff6b35;"></i> Generating Development Prompts (Staged Approach)</h3>';
        progressHTML += '<div class="progress-stages" id="progress-stages" style="display: flex; flex-direction: column; gap: 10px;">';
        for (let i = 1; i <= TOTAL_STAGES; i++) {
            progressHTML += `<div class="progress-stage" data-stage="${i}" style="padding: 10px; background: #fff; border-radius: 4px; border-left: 4px solid #ddd;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="stage-icon" style="width: 20px; text-align: center;">⏸</span>
                    <span class="stage-text">Stage ${i}: <span class="stage-name">-</span></span>
                    <span class="stage-status" style="margin-left: auto; color: #666; font-size: 12px;">Pending</span>
                </div>
                <div class="stage-content-container" data-stage-content="${i}" style="display: none; margin-top: 10px;"></div>
            </div>`;
        }
        progressHTML += '</div></div>';
        if (progressContainer) {
            progressContainer.innerHTML = progressHTML;
        }
        
        // Progress update function
        const updateProgress = (stageNumber, status, message, stageContent = null) => {
            const stageElement = document.querySelector(`.progress-stage[data-stage="${stageNumber}"]`);
            if (!stageElement) return;
            
            const icon = stageElement.querySelector('.stage-icon');
            const statusSpan = stageElement.querySelector('.stage-status');
            const contentContainer = stageElement.querySelector(`.stage-content-container[data-stage-content="${stageNumber}"]`);
            
            if (status === 'generating') {
                icon.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
                icon.style.color = '#ff6b35';
                statusSpan.textContent = message || 'Generating...';
                statusSpan.style.color = '#ff6b35';
                stageElement.style.borderLeftColor = '#ff6b35';
            } else if (status === 'completed') {
                icon.textContent = '✓';
                icon.style.color = '#28a745';
                statusSpan.textContent = message || 'Completed';
                statusSpan.style.color = '#28a745';
                stageElement.style.borderLeftColor = '#28a745';
                
                // Display stage content with copy button
                if (stageContent && contentContainer) {
                    const stageName = STAGE_NAMES[stageNumber];
                    const uniqueId = `stage-${stageNumber}-${Date.now()}`;
                    contentContainer.style.display = 'block';
                    contentContainer.innerHTML = `
                        <div style="margin-top: 10px; padding: 15px; background: #f9f9f9; border-radius: 4px; border: 1px solid #e0e0e0;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <h4 style="margin: 0; color: #333;">STAGE ${stageNumber}: ${stageName}</h4>
                                <button onclick="copyStageContent('${uniqueId}')" class="btn-copy-stage" style="padding: 6px 12px; font-size: 12px; background-color: #ff6b35; color: white; border: none; border-radius: 4px; cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#e55a2b'" onmouseout="this.style.backgroundColor='#ff6b35'">
                                    <i class="fa fa-copy"></i> Copy
                                </button>
                            </div>
                            <pre id="${uniqueId}" style="margin: 0; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; font-family: 'Monaco', 'Courier New', monospace; font-size: 12px; line-height: 1.5; color: #333; max-height: 300px; overflow-y: auto; padding: 10px; background: #fff; border: 1px solid #ddd; border-radius: 4px;">${escapeHtml(stageContent)}</pre>
                        </div>
                    `;
                }
            } else if (status === 'error') {
                icon.textContent = '✗';
                icon.style.color = '#dc3545';
                statusSpan.textContent = message || 'Error';
                statusSpan.style.color = '#dc3545';
                stageElement.style.borderLeftColor = '#dc3545';
            }
        };
        
        // Add copy function to window for onclick
        window.copyStageContent = function(stageId) {
            const stageElement = document.getElementById(stageId);
            if (!stageElement) return;
            
            const text = stageElement.textContent;
            navigator.clipboard.writeText(text).then(() => {
                const button = stageElement.closest('.stage-content-container').querySelector('.btn-copy-stage');
                if (button) {
                    const originalText = button.innerHTML;
                    button.innerHTML = '<i class="fa fa-check"></i> Copied!';
                    button.style.backgroundColor = '#28a745';
                    setTimeout(() => {
                        button.innerHTML = originalText;
                        button.style.backgroundColor = '#ff6b35';
                    }, 2000);
                }
                showNotification('Stage content copied to clipboard!', 'success');
            }).catch(err => {
                console.error('Failed to copy:', err);
                showNotification('Failed to copy to clipboard', 'error');
            });
        };
        
        // Helper function to escape HTML
        const escapeHtml = (text) => {
            if (typeof text !== 'string') return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
        
        // Update stage names
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
        
        for (let i = 1; i <= TOTAL_STAGES; i++) {
            const stageElement = document.querySelector(`.progress-stage[data-stage="${i}"]`);
            if (stageElement) {
                const nameSpan = stageElement.querySelector('.stage-name');
                if (nameSpan) {
                    nameSpan.textContent = STAGE_NAMES[i];
                }
            }
        }
        
        // Keep the original background color and prevent it from changing
        generateBtn.style.backgroundColor = originalBgColor || '';
        generateBtn.style.opacity = '1';
        
        // Update status to generating
        if (currentSpecData && currentSpecData.status) {
            currentSpecData.status.prompts = 'generating';
            updateNotificationDot('prompts', 'generating');
            console.log(`[${requestId}] [generatePrompts] Updated status to generating`);
        }
        
        // Check if all prerequisite specs exist
        console.log(`[${requestId}] [generatePrompts] Validating prerequisites`, {
            hasTechnical: !!currentSpecData?.technical,
            technicalIsError: currentSpecData?.technical === 'error',
            hasMarket: !!currentSpecData?.market,
            marketIsError: currentSpecData?.market === 'error',
            hasDesign: !!currentSpecData?.design,
            designIsError: currentSpecData?.design === 'error',
            hasArchitecture: !!currentSpecData?.architecture,
            architectureIsError: currentSpecData?.architecture === 'error',
            hasVisibility: !!currentSpecData?.visibility,
            visibilityIsError: currentSpecData?.visibility === 'error',
            hasOverview: !!currentSpecData?.overview
        });
        
        if (!currentSpecData) {
            throw new Error('No specification data available');
        }
        
        if (!currentSpecData.technical || currentSpecData.technical === 'error') {
            throw new Error('Technical specification must be generated first');
        }
        if (!currentSpecData.market || currentSpecData.market === 'error') {
            throw new Error('Market research must be generated first');
        }
        if (!currentSpecData.design || currentSpecData.design === 'error') {
            throw new Error('Design specification must be generated first');
        }
        if (!currentSpecData.architecture || currentSpecData.architecture === 'error') {
            throw new Error('Architecture must be generated first');
        }
        if (!currentSpecData.visibility || currentSpecData.visibility === 'error') {
            throw new Error('AIO & SEO Visibility Engine must be generated first');
        }
        
        console.log(`[${requestId}] [generatePrompts] Prerequisites validated successfully`);
        
        // Parse overview, technical, and design content
        let overviewContent = currentSpecData.overview;
        let technicalContent = currentSpecData.technical;
        let designContent = currentSpecData.design;
        
        const parseStartTime = Date.now();
        console.log(`[${requestId}] [generatePrompts] Starting content parsing`, {
            overviewType: typeof overviewContent,
            overviewLength: typeof overviewContent === 'string' ? overviewContent.length : 'N/A',
            technicalType: typeof technicalContent,
            technicalLength: typeof technicalContent === 'string' ? technicalContent.length : 'N/A',
            designType: typeof designContent,
            designLength: typeof designContent === 'string' ? designContent.length : 'N/A'
        });
        
        // If content is JSON string, parse it
        try {
            if (typeof overviewContent === 'string') {
                const parsedOverview = JSON.parse(overviewContent);
                overviewContent = JSON.stringify(parsedOverview, null, 2);
                console.log(`[${requestId}] [generatePrompts] Parsed overview JSON successfully`);
            }
        } catch (e) {
            console.log(`[${requestId}] [generatePrompts] Overview is not JSON, keeping as is:`, e.message);
        }
        
        try {
            if (typeof technicalContent === 'string') {
                const parsedTechnical = JSON.parse(technicalContent);
                technicalContent = JSON.stringify(parsedTechnical, null, 2);
                console.log(`[${requestId}] [generatePrompts] Parsed technical JSON successfully`);
            }
        } catch (e) {
            console.log(`[${requestId}] [generatePrompts] Technical is not JSON, keeping as is:`, e.message);
        }
        
        try {
            if (typeof designContent === 'string') {
                const parsedDesign = JSON.parse(designContent);
                designContent = JSON.stringify(parsedDesign, null, 2);
                console.log(`[${requestId}] [generatePrompts] Parsed design JSON successfully`);
            }
        } catch (e) {
            console.log(`[${requestId}] [generatePrompts] Design is not JSON, keeping as is:`, e.message);
        }
        
        const parseDuration = Date.now() - parseStartTime;
        console.log(`[${requestId}] [generatePrompts] Content parsing completed in ${parseDuration}ms`, {
            finalOverviewLength: typeof overviewContent === 'string' ? overviewContent.length : 'N/A',
            finalTechnicalLength: typeof technicalContent === 'string' ? technicalContent.length : 'N/A',
            finalDesignLength: typeof designContent === 'string' ? designContent.length : 'N/A'
        });
        
        // Generate all stages using staged approach
        const stagesGenerationStartTime = Date.now();
        console.log(`[${requestId}] [generatePrompts] Starting staged generation for ${TOTAL_STAGES} stages`);
        
        // Test worker connectivity first
        const workerUrl = '/api/auxiliary/prompts/generate';
        console.log(`[${requestId}] [generatePrompts] Worker URL: ${workerUrl}`);
        
        const generatedStages = [];
        const stageErrors = [];
        
        // Generate each stage sequentially
        for (let stageNum = 1; stageNum <= TOTAL_STAGES; stageNum++) {
            const stageStartTime = Date.now();
            console.log(`[${requestId}] [generatePrompts] Starting generation of stage ${stageNum}/${TOTAL_STAGES}`);
            
            try {
                const stageContent = await generateSingleStage(
                    stageNum,
                    requestId,
                    overviewContent,
                    technicalContent,
                    designContent,
                    generatedStages,
                    updateProgress
                );
                
                generatedStages.push(stageContent);
                const stageDuration = Date.now() - stageStartTime;
                
                console.log(`[${requestId}] [generatePrompts] Stage ${stageNum} completed successfully`, {
                    stageNumber: stageNum,
                    duration: stageDuration,
                    durationSeconds: (stageDuration / 1000).toFixed(2),
                    contentLength: stageContent.length,
                    totalStagesCompleted: generatedStages.length,
                    totalStagesRemaining: TOTAL_STAGES - generatedStages.length
                });
                
                // Update progress with stage content for immediate display
                if (updateProgress) {
                    updateProgress(stageNum, 'completed', `Stage ${stageNum} completed (${(stageDuration / 1000).toFixed(1)}s)`, stageContent);
                }
                
            } catch (stageError) {
                const stageDuration = Date.now() - stageStartTime;
                stageErrors.push({ stage: stageNum, error: stageError });
                
                console.error(`[${requestId}] [generatePrompts] Stage ${stageNum} failed`, {
                    stageNumber: stageNum,
                    duration: stageDuration,
                    errorName: stageError.name,
                    errorMessage: stageError.message
                });
                
                // Continue with other stages even if one fails
                // We'll handle errors at the end
            }
        }
        
        const stagesGenerationDuration = Date.now() - stagesGenerationStartTime;
        console.log(`[${requestId}] [generatePrompts] All stages generation completed`, {
            totalDuration: stagesGenerationDuration,
            totalDurationSeconds: (stagesGenerationDuration / 1000).toFixed(2),
            stagesCompleted: generatedStages.length,
            stagesFailed: stageErrors.length,
            totalStages: TOTAL_STAGES
        });
        
        // Check if we have enough stages
        if (generatedStages.length === 0) {
            // All stages failed - show detailed error
            const errorDetails = stageErrors.map(e => `Stage ${e.stage}: ${e.error.message || e.error.name || 'Unknown error'}`).join('\n');
            throw new Error(`All stages failed to generate. This might indicate a problem with the prompts service. Please try again later.\n\nFailed stages:\n${errorDetails}`);
        }
        
        if (generatedStages.length < 7) {
            // Some stages failed but we have some - warn but continue
            console.warn(`[${requestId}] [generatePrompts] Only ${generatedStages.length}/${TOTAL_STAGES} stages completed. Continuing with partial results.`);
            const errorDetails = stageErrors.map(e => `Stage ${e.stage}: ${e.error.message || e.error.name || 'Unknown error'}`).join('; ');
            console.warn(`[${requestId}] [generatePrompts] Failed stages: ${errorDetails}`);
        }
        
        // Merge all stages into final prompt
        const mergeStartTime = Date.now();
        console.log(`[${requestId}] [generatePrompts] Merging ${generatedStages.length} stages into final prompt`);
        
        // Build the full prompt with all stages
        let fullPrompt = `You are building [APPLICATION_NAME] - [APPLICATION_DESCRIPTION from overview].

PROJECT OVERVIEW:
[Use the ideaSummary and valueProposition from overview to describe what the application does and why it's important]

TECHNICAL STACK:
[Based on technical specification, list the exact technologies:
- Frontend: [exact framework, version, libraries]
- Backend: [exact runtime, framework, version]
- Database: [exact database types and versions]
- Authentication: [exact auth methods and libraries]
- Other services: [storage, real-time, etc.]
]

SECURITY REQUIREMENTS:
- End-to-end encryption for all sensitive data
- HTTPS/WSS for all communications
- JWT tokens with expiration and refresh mechanisms
- Rate limiting on all API endpoints
- CORS properly configured (no wildcards in production)
- Input validation and sanitization on backend
- Never store API keys or secrets in frontend code

DEVELOPMENT STAGES - BUILD IN THIS EXACT ORDER:

`;

        // Add each stage with proper formatting
        generatedStages.forEach((stageContent, index) => {
            const stageNum = index + 1;
            const stageName = STAGE_NAMES[stageNum];
            fullPrompt += `═══════════════════════════════════════════════════════════════\n`;
            fullPrompt += `STAGE ${stageNum}: ${stageName}\n`;
            fullPrompt += `═══════════════════════════════════════════════════════════════\n\n`;
            fullPrompt += stageContent;
            fullPrompt += `\n\n`;
        });
        
        fullPrompt += `═══════════════════════════════════════════════════════════════\n\n`;
        fullPrompt += `IMPORTANT NOTES:
- Follow this order strictly - each stage builds on the previous one
- Test thoroughly after each stage before moving to the next
- Commit code frequently with descriptive commit messages
- Document API endpoints and component props
- Follow TypeScript best practices and avoid 'any' types
- Ensure all code is accessible (WCAG 2.1 AA compliant)
- Optimize for performance from the start
- Write clean, maintainable, and scalable code

Please build this application following best practices, ensuring scalability, security, and excellent user experience.`;
        
        // Replace placeholders with actual values from specs
        try {
            const overviewData = typeof overviewContent === 'string' ? JSON.parse(overviewContent) : overviewContent;
            const technicalData = typeof technicalContent === 'string' ? JSON.parse(technicalContent) : technicalContent;
            
            if (overviewData?.overview?.ideaSummary) {
                fullPrompt = fullPrompt.replace(/\[APPLICATION_DESCRIPTION from overview\]/g, overviewData.overview.ideaSummary);
            }
            if (technicalData?.technical?.techStack) {
                const techStack = technicalData.technical.techStack;
                if (techStack.frontend) {
                    fullPrompt = fullPrompt.replace(/\[exact framework, version, libraries\]/g, techStack.frontend);
                }
                if (techStack.backend) {
                    fullPrompt = fullPrompt.replace(/\[exact runtime, framework, version\]/g, techStack.backend);
                }
                if (techStack.database) {
                    fullPrompt = fullPrompt.replace(/\[exact database types and versions\]/g, techStack.database);
                }
            }
        } catch (e) {
            console.warn(`[${requestId}] [generatePrompts] Failed to replace placeholders:`, e.message);
        }
        
        const mergeDuration = Date.now() - mergeStartTime;
        console.log(`[${requestId}] [generatePrompts] Stages merged successfully`, {
            mergeDuration,
            finalPromptLength: fullPrompt.length,
            finalPromptSizeKB: (fullPrompt.length / 1024).toFixed(2),
            finalPromptSizeMB: (fullPrompt.length / (1024 * 1024)).toFixed(2),
            stagesCount: generatedStages.length
        });
        
        // Generate third-party integrations (separate request)
        let thirdPartyIntegrations = [];
        const integrationsStartTime = Date.now();
        console.log(`[${requestId}] [generatePrompts] Generating third-party integrations`);
        
        try {
            const integrationsPrompt = `Generate third-party integration instructions based on the technical specification.

Application Overview:
${overviewContent || 'Not provided'}

Technical Specification:
${technicalContent || 'Not provided'}

Return ONLY a JSON array of integration objects, each with:
- service: Service name
- description: What this service does and why it's needed
- instructions: Array of detailed setup steps (minimum 3-4 steps)

If no third-party integrations are needed, return an empty array.`;

            const integrationsRequestBody = {
                stage: 'prompts',
                locale: 'en-US',
                temperature: 0,
                prompt: {
                    system: 'You are an expert software development prompt engineer. Generate detailed third-party integration instructions.',
                    developer: 'Return ONLY valid JSON array. Each integration must have: service, description, and instructions array.',
                    user: integrationsPrompt
                }
            };
            
            const integrationsResponse = await fetch('/api/auxiliary/prompts/generate', {
                method: 'POST',
                headers: await getAuxHeaders(),
                body: JSON.stringify(integrationsRequestBody),
                signal: AbortSignal.timeout(30000) // 30 seconds for integrations
            });
            
            if (integrationsResponse.ok) {
                const integrationsData = JSON.parse(await integrationsResponse.text());
                if (integrationsData.prompts?.thirdPartyIntegrations) {
                    thirdPartyIntegrations = integrationsData.prompts.thirdPartyIntegrations;
                }
            }
            
            const integrationsDuration = Date.now() - integrationsStartTime;
            console.log(`[${requestId}] [generatePrompts] Third-party integrations generated`, {
                duration: integrationsDuration,
                integrationsCount: thirdPartyIntegrations.length
            });
        } catch (integrationsError) {
            console.warn(`[${requestId}] [generatePrompts] Failed to generate integrations, continuing without them:`, integrationsError.message);
            // Continue without integrations - not critical
        }
        
        const promptsData = {
            generated: true,
            fullPrompt: fullPrompt,
            thirdPartyIntegrations: thirdPartyIntegrations,
            generatedAt: new Date().toISOString(),
            stagesGenerated: generatedStages.length,
            stagesFailed: stageErrors.length
        };
        
        console.log(`[${requestId}] [generatePrompts] Prompts data prepared`, {
            fullPromptLength: promptsData.fullPrompt.length,
            fullPromptSizeKB: (promptsData.fullPrompt.length / 1024).toFixed(2),
            fullPromptSizeMB: (promptsData.fullPrompt.length / (1024 * 1024)).toFixed(2),
            thirdPartyIntegrationsCount: promptsData.thirdPartyIntegrations.length,
            generatedAt: promptsData.generatedAt
        });
        
        // Save to Firebase
        if (currentSpecData && currentSpecData.id) {
            const firebaseStartTime = Date.now();
            const promptsDataSize = JSON.stringify(promptsData).length;
            const promptsDataSizeKB = (promptsDataSize / 1024).toFixed(2);
            const promptsDataSizeMB = (promptsDataSize / (1024 * 1024)).toFixed(2);
            
            console.log(`[${requestId}] [generatePrompts] Saving to Firebase`, {
                specId: currentSpecData.id,
                promptsDataSize,
                promptsDataSizeKB,
                promptsDataSizeMB
            });
            
            // Firebase Firestore has a 1MB limit per document
            // If data is too large, we'll save a compressed version or split it
            const MAX_FIREBASE_SIZE = 900 * 1024; // 900KB to be safe (leave room for other fields)
            
            try {
                let dataToSave = promptsData;
                
                // If data is too large, create a summary version for Firebase
                if (promptsDataSize > MAX_FIREBASE_SIZE) {
                    console.warn(`[${requestId}] [generatePrompts] Prompts data is too large (${promptsDataSizeMB}MB), creating summary version for Firebase`);
                    
                    // Save full data to a separate collection or compress
                    // For now, we'll save a truncated version with a note
                    dataToSave = {
                        ...promptsData,
                        fullPrompt: promptsData.fullPrompt.substring(0, MAX_FIREBASE_SIZE - 10000) + '\n\n[Note: Full prompt truncated due to size limit. Full content available in UI.]',
                        _truncated: true,
                        _originalSize: promptsDataSize
                    };
                }
                
                await firebase.firestore().collection('specs').doc(currentSpecData.id).update({
                    prompts: dataToSave,
                    'status.prompts': 'ready',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                const firebaseDuration = Date.now() - firebaseStartTime;
                console.log(`[${requestId}] [generatePrompts] Saved to Firebase successfully`, {
                    duration: firebaseDuration,
                    specId: currentSpecData.id,
                    savedSize: JSON.stringify(dataToSave).length,
                    wasTruncated: dataToSave._truncated || false
                });
                
                // Upload updated spec to OpenAI API for chat purposes (non-blocking)
                triggerOpenAIUploadForSpec(currentSpecData.id).catch(err => {
                    console.warn(`[${requestId}] [generatePrompts] Failed to upload spec to OpenAI after prompts generation:`, err);
                });
                
                // Update local spec data with FULL data (not truncated)
                currentSpecData.prompts = promptsData;
                currentSpecData.status = currentSpecData.status || {};
                currentSpecData.status.prompts = 'ready';
                // Update notification dot to show ready state
                updateNotificationDot('prompts', 'ready');
                // Update export checkboxes when prompts are ready
                updateExportCheckboxes();
                
                console.log(`[${requestId}] [generatePrompts] Local spec data updated`);
            } catch (error) {
                const firebaseDuration = Date.now() - firebaseStartTime;
                console.error(`[${requestId}] [generatePrompts] Failed to save prompts to Firebase`, {
                    duration: firebaseDuration,
                    error: error.message,
                    errorCode: error.code,
                    errorStack: error.stack,
                    specId: currentSpecData.id,
                    promptsDataSize,
                    promptsDataSizeMB
                });
                
                if (window.appLogger) {
                    window.appLogger.logError(error, {
                        requestId,
                        specId: currentSpecData.id,
                        stage: 'firebase_save',
                        promptsDataSize,
                        promptsDataSizeMB
                    });
                }
                
                // Show user-friendly error if it's a size issue
                if (error.message?.includes('size') || error.message?.includes('too large') || error.code === 'invalid-argument') {
                    console.warn(`[${requestId}] [generatePrompts] Firebase size limit exceeded. Data size: ${promptsDataSizeMB}MB`);
                    // Continue - we still have the data locally and can display it
                }
                
                // Continue even if Firebase save fails - we still have the data
            }
        } else {
            console.warn(`[${requestId}] [generatePrompts] No spec ID available, skipping Firebase save`);
        }
        
        // Display prompts
        const displayStartTime = Date.now();
        console.log(`[${requestId}] [generatePrompts] Displaying prompts`);
        displayPrompts(promptsData);
        const displayDuration = Date.now() - displayStartTime;
        console.log(`[${requestId}] [generatePrompts] Prompts displayed in ${displayDuration}ms`);
        
        // Reset button before hiding (in case it's shown again)
        generateBtn.disabled = false;
        generateBtn.innerHTML = 'Generate Prompts';
        generateBtn.style.backgroundColor = '';
        generateBtn.style.cursor = 'pointer';
        
        // Hide generate button
        generateBtn.style.display = 'none';
        
        // Update raw data
        const rawPrompts = document.getElementById('raw-prompts');
        if (rawPrompts) {
            rawPrompts.textContent = JSON.stringify(promptsData, null, 2);
            console.log(`[${requestId}] [generatePrompts] Raw prompts data updated`);
        }
        
        const totalDuration = Date.now() - startTime;
        console.log(`[${requestId}] [generatePrompts] SUCCESS - Prompts generated successfully`, {
            totalDuration,
            totalDurationSeconds: (totalDuration / 1000).toFixed(2),
            fullPromptLength: promptsData.fullPrompt.length,
            thirdPartyIntegrationsCount: promptsData.thirdPartyIntegrations.length
        });
        
        if (window.appLogger) {
            window.appLogger.log('FeatureUsage', 'Prompts generated successfully', {
                requestId,
                specId: currentSpecData?.id,
                totalDuration,
                fullPromptLength: promptsData.fullPrompt.length
            });
        }
        
        showNotification('Prompts generated successfully!', 'success');
        
    } catch (error) {
        const totalDuration = Date.now() - startTime;
        console.error(`[${requestId}] [generatePrompts] ERROR - Failed to generate prompts`, {
            totalDuration,
            totalDurationSeconds: (totalDuration / 1000).toFixed(2),
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack
        });
        
        if (window.appLogger) {
            window.appLogger.logError(error, {
                requestId,
                specId: currentSpecData?.id,
                totalDuration,
                stage: 'generatePrompts'
            });
        }
        
        // Error generating prompts
        // Provide user-friendly error message
        let errorMessage = error.message;
        
        // Handle specific error types
        if (error.name === 'AbortError' || error.message?.includes('aborted') || error.message?.includes('timed out')) {
            const totalTimeoutSeconds = (STAGE_TIMEOUT_MS * TOTAL_STAGES) / 1000;
            errorMessage = `Request timed out after ${totalTimeoutSeconds} seconds. The prompts generation is taking longer than expected. Please try again.`;
        } else if (error.message?.includes('Failed to connect') || error.message?.includes('Network error')) {
            errorMessage = 'Failed to connect to the prompts service. Please check your internet connection and try again.';
        } else if (error.message?.includes('API Error')) {
            // Keep API error messages as they are (they're already descriptive)
            errorMessage = error.message;
        }
        
        showNotification(`Failed to generate prompts: ${errorMessage}`, 'error');
        
        const container = document.getElementById('prompts-data');
        if (container) {
            container.innerHTML = `
                <div class="prompt-error">
                    <h3><i class="fa fa-times-circle"></i> Error Generating Prompts</h3>
                    <p>${escapeHtml(errorMessage)}</p>
                    <button onclick="generatePrompts()" class="btn btn-primary" style="margin-top: 10px;">
                        <i class="fa fa-refresh"></i> Try Again
                    </button>
                </div>
            `;
        }
    } finally {
        setFeatureLoading('prompts', false);
        const generateBtn = document.getElementById('generatePromptsBtn');
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = 'Generate Prompts';
            generateBtn.style.backgroundColor = '';
            generateBtn.style.cursor = 'pointer';
        }
        
        const totalDuration = Date.now() - startTime;
        console.log(`[${requestId}] [generatePrompts] Function completed`, {
            totalDuration,
            totalDurationSeconds: (totalDuration / 1000).toFixed(2),
            isLoading: false
        });
    }
}

function displayDiagrams(diagramsArray) {
    const container = document.getElementById('diagrams-data');
    
    // Safety check: ensure container exists and is the correct one
    if (!container) {
        console.error('diagrams-data container not found');
        return;
    }
    
    // Ensure we're only displaying in the diagrams-data container, not anywhere else
    if (container.id !== 'diagrams-data') {
        console.error('Invalid container for diagrams display');
        return;
    }
    
    if (!diagramsArray || diagramsArray.length === 0) {
        container.innerHTML = '<div class="diagram-error"><h3><i class="fa fa-times-circle"></i> No Diagrams Generated</h3><p>Failed to generate diagrams. Please try again.</p></div>';
        return;
    }
    
    // Validate diagrams - filter out any without valid mermaidCode
    const validDiagrams = diagramsArray.filter(d => 
        d && d.id && d.title && 
        d.mermaidCode && 
        typeof d.mermaidCode === 'string' && 
        d.mermaidCode.trim().length > 0
    );
    
    if (validDiagrams.length === 0) {
        container.innerHTML = '<div class="diagram-error"><h3><i class="fa fa-times-circle"></i> No Valid Diagrams</h3><p>No diagrams with valid content found. Please regenerate.</p></div>';
        return;
    }
    
    // Clear container
    container.innerHTML = '';
    
    // Create diagram containers for each VALID diagram
    validDiagrams.forEach((diagram, index) => {
        const diagramContainer = document.createElement('div');
        diagramContainer.className = 'diagram-container';
        diagramContainer.id = `diagram-${diagram.id}`;
        
        // Create header
        const header = document.createElement('div');
        header.className = 'diagram-header';
        header.innerHTML = `
            <div class="diagram-header-content">
                <h3>${escapeHtml(diagram.title)}</h3>
                ${diagram.description ? `<p class="diagram-description" style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 8px; margin-bottom: 0;">${escapeHtml(diagram.description)}</p>` : ''}
            </div>
            <div class="diagram-controls">
                <button onclick="openFullscreen('${diagram.id}')" class="btn-icon diagram-fullscreen-btn" title="Fullscreen">
                    <i class="fa fa-expand"></i>
                </button>
                <button onclick="refreshDiagram('${diagram.id}')" class="btn-icon hidden" title="Refresh">
                    <i class="fa fa-refresh"></i>
                </button>
                <button onclick="repairDiagram('${diagram.id}')" class="btn-icon hidden" title="Repair Diagram">
                    <i class="fa fa-tools"></i>
                </button>
            </div>
        `;
        
        // Create content area
        const content = document.createElement('div');
        content.className = 'diagram-content';
        content.id = `diagram-${diagram.id}-content`;
        
        // Create status indicator
        const status = document.createElement('div');
        status.className = 'diagram-status';
        status.innerHTML = `
            <div class="status-indicator generating"></div>
            <span class="status-text">Generating...</span>
        `;
        
        content.appendChild(status);
        
        // Add loading placeholder
        content.innerHTML += '<div class="diagram-loading">🔄 Rendering diagram...</div>';
        
        diagramContainer.appendChild(header);
        diagramContainer.appendChild(content);
        container.appendChild(diagramContainer);
        
        // Render diagram immediately
        renderSingleDiagram(diagram, `diagram-${diagram.id}-content`);
    });
}

/**
 * Check if Mermaid code has syntax errors (requires AI repair)
 * vs rendering errors (just needs re-render)
 */
function isSyntaxError(error) {
    if (!error || !error.message) return false;
    
    const errorMsg = error.message.toLowerCase();
    const syntaxErrorKeywords = [
        'syntax', 'parse', 'invalid', 'expecting', 'unexpected', 
        'missing', 'malformed', 'broken', 'error parsing',
        'syntax error', 'invalid character', 'unknown token'
    ];
    
    return syntaxErrorKeywords.some(keyword => errorMsg.includes(keyword));
}

function displayPrompts(promptsData) {
    const container = document.getElementById('prompts-data');
    
    if (!promptsData || !promptsData.fullPrompt) {
        container.innerHTML = '<div class="prompt-error"><h3><i class="fa fa-times-circle"></i> No Prompts Generated</h3><p>Failed to generate prompts. Please try again.</p></div>';
        return;
    }
    
    // Clear container
    container.innerHTML = '';
    
    // Create full prompt section
    const fullPromptSection = document.createElement('div');
    fullPromptSection.className = 'prompt-section';
    fullPromptSection.innerHTML = `
        <div class="prompt-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3><i class="fa fa-code"></i> Full Development Prompt</h3>
            <button onclick="copyPromptToClipboard()" class="btn btn-secondary" style="padding: 6px 12px; font-size: 14px; background-color: #ff6b35; color: white; border: none; margin-left: 15px; cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#e55a2b'" onmouseout="this.style.backgroundColor='#ff6b35'">
                <i class="fa fa-copy" style="color: white !important;"></i> Copy Prompt
            </button>
        </div>
        <div class="prompt-content" id="full-prompt-content" style="background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; overflow-x: auto; max-width: 100%;">
            <pre class="prompt-text" style="margin: 0; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; font-family: 'Monaco', 'Courier New', monospace; font-size: 13px; line-height: 1.6; color: #333;">${escapeHtml(promptsData.fullPrompt)}</pre>
        </div>
    `;
    container.appendChild(fullPromptSection);
    
    // Store full prompt globally for copy function
    window.fullPromptText = promptsData.fullPrompt;
    
    // Create third-party integrations section in a SEPARATE container
    if (promptsData.thirdPartyIntegrations && Array.isArray(promptsData.thirdPartyIntegrations) && promptsData.thirdPartyIntegrations.length > 0) {
        // Get or create separate container for integrations
        let integrationsDataContainer = document.getElementById('integrations-data');
        if (!integrationsDataContainer) {
            // Create new container if it doesn't exist
            const promptsContent = document.getElementById('prompts-content');
            if (promptsContent) {
                integrationsDataContainer = document.createElement('div');
                integrationsDataContainer.id = 'integrations-data';
                integrationsDataContainer.className = 'content-body';
                integrationsDataContainer.style.cssText = 'margin-top: 30px; padding-top: 30px; border-top: 3px solid #e0e0e0;';
                promptsContent.appendChild(integrationsDataContainer);
            } else {
                // Fallback: add to prompts-data but with clear separation
                integrationsDataContainer = container;
            }
        } else {
            // Clear existing content
            integrationsDataContainer.innerHTML = '';
        }
        
        const integrationsSection = document.createElement('div');
        integrationsSection.className = 'integrations-section';
        integrationsSection.style.cssText = 'width: 100%;';
        
        const integrationsHeader = document.createElement('div');
        integrationsHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;';
        integrationsHeader.innerHTML = `
            <h2 style="margin: 0; font-size: 24px; font-weight: 600; color: #333;"><i class="fa fa-plug" style="color: #ff6b35; margin-right: 10px;"></i> Third-Party Integration Instructions</h2>
            <button onclick="copyIntegrationsToClipboard()" class="btn btn-secondary" style="padding: 6px 12px; font-size: 14px; background-color: #ff6b35; color: white; border: none; cursor: pointer; transition: background-color 0.2s; border-radius: 4px;" onmouseover="this.style.backgroundColor='#e55a2b'" onmouseout="this.style.backgroundColor='#ff6b35'">
                <i class="fa fa-copy" style="color: white !important;"></i> Copy All
            </button>
        `;
        integrationsSection.appendChild(integrationsHeader);
        
        const integrationsCardsContainer = document.createElement('div');
        integrationsCardsContainer.className = 'integrations-container';
        integrationsCardsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';
        
        let allIntegrationsText = '';
        
        promptsData.thirdPartyIntegrations.forEach((integration, index) => {
            const integrationCard = document.createElement('div');
            integrationCard.className = 'integration-card';
            integrationCard.style.cssText = 'background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;';
            
            const serviceName = escapeHtml(integration.service || 'Unknown Service');
            const description = escapeHtml(integration.description || '');
            const instructions = integration.instructions || [];
            
            // Build text version for copy
            allIntegrationsText += `${serviceName}\n${description}\n\nImplementation Instructions:\n`;
            instructions.forEach((inst, idx) => {
                allIntegrationsText += `${inst}\n`;
            });
            allIntegrationsText += '\n';
            
            // Convert URLs in instructions to clickable links
            const instructionsWithLinks = instructions.map(instruction => {
                if (!instruction || typeof instruction !== 'string') return '';
                // Match URLs (http://, https://, www.) BEFORE escaping HTML
                const urlRegex = /(https?:\/\/[^\s<>]+|www\.[^\s<>]+)/gi;
                let match;
                let lastIndex = 0;
                let result = '';
                
                // Find all URLs and their positions
                while ((match = urlRegex.exec(instruction)) !== null) {
                    // Escape text before URL
                    result += escapeHtml(instruction.substring(lastIndex, match.index));
                    
                    // Create clickable link for URL
                    const url = match[0];
                    const fullUrl = url.startsWith('http') ? url : `http://${url}`;
                    result += `<a href="${escapeHtml(fullUrl)}" target="_blank" rel="noopener noreferrer" style="color: #ff6b35; text-decoration: underline; cursor: pointer;">${escapeHtml(url)}</a>`;
                    
                    lastIndex = match.index + match[0].length;
                }
                
                // Escape remaining text
                result += escapeHtml(instruction.substring(lastIndex));
                
                return result || escapeHtml(instruction);
            });
            
            const uniqueId = `integration-${index}-${Date.now()}`;
            
            integrationCard.innerHTML = `
                <div style="margin-bottom: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: #333; font-size: 18px; font-weight: 600;">
                        ${serviceName}
                    </h4>
                    <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">
                        ${description}
                    </p>
                </div>
                <div style="margin-top: 15px;">
                    <h5 style="margin: 0 0 10px 0; color: #333; font-size: 15px; font-weight: 600;">
                        Implementation Instructions:
                    </h5>
                    <div id="${uniqueId}" style="background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 4px; padding: 15px; font-family: 'Monaco', 'Courier New', monospace; font-size: 13px; line-height: 1.8; color: #333;">
                        ${instructionsWithLinks.map(instruction => `<div style="margin-bottom: 8px;">${instruction}</div>`).join('')}
                </div>
                    <button onclick="copyIntegrationText('${uniqueId}')" style="margin-top: 10px; padding: 6px 12px; font-size: 12px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#5a6268'" onmouseout="this.style.backgroundColor='#6c757d'">
                        <i class="fa fa-copy"></i> Copy
                    </button>
                </div>
            `;
            integrationsCardsContainer.appendChild(integrationCard);
        });
        
        // Store integrations text globally for copy function
        window.integrationsText = allIntegrationsText.trim();
        
        integrationsSection.appendChild(integrationsCardsContainer);
        
        // Append to separate container (not prompts-data)
        if (integrationsDataContainer.id === 'integrations-data') {
            integrationsDataContainer.appendChild(integrationsSection);
        } else {
            // Fallback: add to prompts-data but visually separated
            integrationsSection.style.cssText = 'margin-top: 40px; padding-top: 30px; border-top: 3px solid #e0e0e0; width: 100%;';
            container.appendChild(integrationsSection);
        }
        
        // Add copy functions to window
        window.copyIntegrationsToClipboard = function() {
            if (!window.integrationsText) {
                showNotification('No integrations text available', 'error');
                return;
            }
            navigator.clipboard.writeText(window.integrationsText).then(() => {
                showNotification('All integrations copied to clipboard!', 'success');
            }).catch(err => {
                showNotification('Failed to copy integrations', 'error');
            });
        };
        
        window.copyIntegrationText = function(elementId) {
            const element = document.getElementById(elementId);
            if (!element) return;
            
            const text = element.textContent || element.innerText;
            navigator.clipboard.writeText(text).then(() => {
                showNotification('Integration instructions copied!', 'success');
            }).catch(err => {
                showNotification('Failed to copy', 'error');
            });
        };
    }
}

// REMOVED: Duplicate escapeHtml() - Using the one defined later in the file
function copyPromptToClipboard() {
    if (!window.fullPromptText) {
        showNotification('No prompt text available', 'error');
        return;
    }
    
    navigator.clipboard.writeText(window.fullPromptText).then(() => {
        showNotification('Prompt copied to clipboard!', 'success');
    }).catch(err => {
        // Failed to copy
        showNotification('Failed to copy prompt', 'error');
    });
}

async function renderSingleDiagram(diagramData, containerId, isRefresh = false) {
    const container = document.getElementById(containerId);
    if (!container) {

        return;
    }
    
    // Get parent element BEFORE clearing container
    const parentElement = container.parentElement;
    const statusIndicator = parentElement?.querySelector('.status-indicator');
    const statusText = parentElement?.querySelector('.status-text');

    try {
        // Validate Mermaid code before rendering
        if (!diagramData.mermaidCode || typeof diagramData.mermaidCode !== 'string' || diagramData.mermaidCode.trim().length === 0) {
            throw new Error('Invalid or empty Mermaid code');
        }

        // Clear loading state
        container.innerHTML = '';

        // Wait for Mermaid to be available and initialized
        let mermaidAvailable = false;
        let attempts = 0;
        const maxAttempts = 50; // Wait up to 5 seconds (50 * 100ms)
        
        // Try to load Mermaid if mermaidManager exists and can load it
        if (window.mermaidManager && typeof mermaid === 'undefined') {
            try {
                await window.mermaidManager.loadMermaid();
            } catch (loadErr) {
                // Failed to load, will try to continue anyway
            }
        }
        
        while (attempts < maxAttempts) {
            if (typeof mermaid !== 'undefined') {
                // Try to initialize Mermaid if mermaidManager exists
                if (window.mermaidManager && !window.mermaidManager.isInitialized) {
                    await window.mermaidManager.initialize();
                } else if (!window.mermaidManager && mermaid.initialize) {
                    // Fallback: initialize with basic config if mermaidManager doesn't exist
                    try {
                        mermaid.initialize({
                            startOnLoad: false,
                            theme: 'base',
                            themeVariables: {
                                primaryColor: '#FF6B35',
                                primaryTextColor: '#333333',
                                primaryBorderColor: '#FF6B35',
                                lineColor: '#333333',
                                background: '#ffffff'
                            }
                        });
                    } catch (initErr) {
                        // Already initialized or error, continue
                    }
                }
                mermaidAvailable = true;
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!mermaidAvailable) {
            throw new Error('Mermaid library not loaded. Please refresh the page.');
        }

        // Generate unique ID for rendering
        const uniqueId = `mermaid-render-${diagramData.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        try {
            const diagramSource = (typeof window.sanitizeMermaidSource === 'function'
                ? window.sanitizeMermaidSource(diagramData.mermaidCode)
                : diagramData.mermaidCode) || diagramData.mermaidCode;
            // Render the diagram using mermaid.render()
            const { svg } = await mermaid.render(uniqueId, diagramSource);
            
            // Create container for the rendered SVG
            const mermaidContainer = document.createElement('div');
            mermaidContainer.className = 'mermaid-rendered';
            mermaidContainer.style.width = '100%';
            mermaidContainer.style.overflow = 'auto';
            mermaidContainer.innerHTML = svg;
            
            // Replace container content with rendered SVG
            container.innerHTML = '';
            container.appendChild(mermaidContainer);
            
            if (statusIndicator) statusIndicator.className = 'status-indicator ready';
            if (statusText) statusText.textContent = 'Ready';

            
            // Hide repair and refresh buttons when diagram is working
            hideDiagramControls(diagramData.id);
            
            // Mark diagram as valid in memory
            diagramData._isValid = true;
            diagramData._lastRenderAttempt = Date.now();
                
        } catch (renderError) {
            // Store error info for debugging
            diagramData._lastError = renderError.message;
            diagramData._isValid = false;
            
            throw renderError;
        }

    } catch (error) {

        if (statusIndicator) statusIndicator.className = 'status-indicator error';
        if (statusText) statusText.textContent = 'Error';
        
        // System automatically repairs broken diagrams - no manual buttons needed
        // Removed showDiagramControls call - system handles auto-repair
        
        // Determine if this is a syntax error (needs AI repair) or rendering error (just needs retry)
        const needsAIRepair = isSyntaxError(error);
        
        const errorUI = `
            <div class="diagram-error">
                <h4><i class="fa fa-exclamation-triangle"></i> ${needsAIRepair ? 'Syntax Error' : 'Rendering Error'}</h4>
                <p>${needsAIRepair ? 'Diagram has syntax errors. The system is automatically repairing this diagram...' : 'Failed to render diagram: ' + error.message + '. The system is automatically retrying...'}</p>
                <details style="margin-top: 10px;">
                    <summary style="cursor: pointer; color: #666;">Show Mermaid code</summary>
                    <pre style="background: #f8f9fa; padding: 10px; margin-top: 10px; border-radius: 4px; max-height: 200px; overflow-y: auto; font-size: 12px;">${diagramData.mermaidCode}</pre>
                </details>
            </div>
        `;
        
        container.innerHTML = errorUI;
    }
}

function openFullscreen(diagramId) {
    const diagramData = diagramsData.find(d => d.id === diagramId);
    if (!diagramData) return;
    
    const modal = document.getElementById('fullscreenModal');
    const title = document.getElementById('fullscreenTitle');
    const content = document.getElementById('fullscreenContent');
    
    title.textContent = diagramData.title;
    
    // Clear content initially
    content.innerHTML = '<div class="diagram-loading">Loading...</div>';
    
    // Re-render Mermaid in fullscreen
    if (typeof mermaid !== 'undefined') {
        // Render the diagram for fullscreen using mermaid.render()
        const uniqueId = `mermaid-fullscreen-${diagramId}-${Date.now()}`;
        const fullscreenSource = (typeof window.sanitizeMermaidSource === 'function'
            ? window.sanitizeMermaidSource(diagramData.mermaidCode)
            : diagramData.mermaidCode) || diagramData.mermaidCode;
        mermaid.render(uniqueId, fullscreenSource)
            .then(({ svg }) => {
                // Replace content with rendered SVG
                content.innerHTML = `<div class="mermaid-fullscreen">${svg}</div>`;
                // Apply transform after rendering
                updateTransform();
            })
            .catch(error => {

                // Try MermaidManager as fallback
                if (mermaidManager && mermaidManager.isInitialized) {
                    mermaidManager.renderChart(`${uniqueId}-fallback`, diagramData.mermaidCode).catch(managerError => {

                        content.innerHTML = `<pre style="color: white; padding: 20px;">${diagramData.mermaidCode}</pre>`;
                    });
                } else {
                    content.innerHTML = `<pre style="color: white; padding: 20px;">${diagramData.mermaidCode}</pre>`;
                }
            });
    } else if (mermaidManager && mermaidManager.isInitialized) {
        // Try MermaidManager if mermaid not available
        const uniqueId = `mermaid-fullscreen-${diagramId}-${Date.now()}`;
        mermaidManager.renderChart(uniqueId, diagramData.mermaidCode).catch(error => {

            content.innerHTML = `<pre style="color: white; padding: 20px;">${diagramData.mermaidCode}</pre>`;
        });
    }
    
    // Reset zoom and pan
    currentZoom = 1;
    currentPanX = 0;
    currentPanY = 0;
    updateTransform();
    
    // Show modal - remove hidden class and lock background scroll
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    modal.classList.remove('hidden');
    
    // Remove any existing listeners first to avoid duplicates
    document.removeEventListener('keydown', handleEscKey);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Add ESC key listener
    document.addEventListener('keydown', handleEscKey);
    
    // Add mouse event listeners for panning on the whole content area
    content.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Set initial transform
    content.style.transformOrigin = 'center center';
    content.style.transform = `translate(${currentPanX}px, ${currentPanY}px) scale(${currentZoom})`;
    

}

function closeFullscreen() {

    const modal = document.getElementById('fullscreenModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
    }
    
    // Remove event listeners
    document.removeEventListener('keydown', handleEscKey);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Reset zoom and pan
    currentZoom = 1;
    currentPanX = 0;
    currentPanY = 0;
    
    // Reset dragging state
    isDragging = false;
    
    // Clean up content
    const content = document.getElementById('fullscreenContent');
    if (content) {
        content.innerHTML = '';
    }
}

function handleEscKey(event) {
    if (event.key === 'Escape') {
        closeFullscreen();
    }
}

function handleMouseDown(event) {
    // Allow dragging on the fullscreen content area or mermaid diagrams
    const content = document.getElementById('fullscreenContent');
    if (content && (event.target.closest('.mermaid') || event.target.closest('.mermaid-rendered') || event.target.closest('.mermaid-fullscreen') || content.contains(event.target))) {
        isDragging = true;
        dragStartX = event.clientX - currentPanX;
        dragStartY = event.clientY - currentPanY;
        event.preventDefault();
    }
}

function handleMouseMove(event) {
    if (isDragging) {
        currentPanX = event.clientX - dragStartX;
        currentPanY = event.clientY - dragStartY;
        updateTransform();
    }
}

function handleMouseUp() {
    isDragging = false;
}

function zoomIn() {
    currentZoom = Math.min(currentZoom * 1.2, 3);
    updateTransform();
}

function zoomOut() {
    currentZoom = Math.max(currentZoom / 1.2, 0.5);
    updateTransform();
}

function resetZoom() {
    currentZoom = 1;
    currentPanX = 0;
    currentPanY = 0;
    updateTransform();
}

function updateTransform() {
    const content = document.getElementById('fullscreenContent');
    if (content) {
        content.style.transform = `translate(${currentPanX}px, ${currentPanY}px) scale(${currentZoom})`;
        content.style.transformOrigin = 'center center';
    }
}

/**
 * Hide repair and refresh buttons when diagram is working
 */
function hideDiagramControls(diagramId) {
    const controls = document.querySelector(`#diagram-${diagramId} .diagram-controls`);
    if (controls) {
        const refreshBtn = controls.querySelector('button[onclick*="refreshDiagram"]');
        const repairBtn = controls.querySelector('button[onclick*="repairDiagram"]');
        
        if (refreshBtn) refreshBtn.style.display = 'none';
        if (repairBtn) repairBtn.style.display = 'none';
    }
}

/**
 * Show repair and refresh buttons when there's an error
 */
function showDiagramControls(diagramId, error) {
    const controls = document.querySelector(`#diagram-${diagramId} .diagram-controls`);
    if (controls) {
        const refreshBtn = controls.querySelector('button[onclick*="refreshDiagram"]');
        const repairBtn = controls.querySelector('button[onclick*="repairDiagram"]');
        
        const needsAIRepair = isSyntaxError(error);
        
        // Always show refresh button for errors
        if (refreshBtn) {
            refreshBtn.style.display = 'flex';
        }
        
        // Show repair button only for syntax errors
        if (repairBtn) {
            repairBtn.style.display = needsAIRepair ? 'flex' : 'none';
        }
    }
}

async function refreshDiagram(diagramId) {
    const diagramData = diagramsData.find(d => d.id === diagramId);
    if (!diagramData) return;
    
    const statusIndicator = document.querySelector(`#diagram-${diagramId} .status-indicator`);
    const statusText = document.querySelector(`#diagram-${diagramId} .status-text`);
    
    if (statusIndicator) {
        statusIndicator.className = 'status-indicator refreshing';
    }
    if (statusText) {
        statusText.textContent = 'Refreshing...';
    }
    
    try {
        await renderSingleDiagram(diagramData, `diagram-${diagramId}-content`, true);

    } catch (error) {

    }
}

/**
 * Repair a broken diagram using AI
 */
async function repairDiagram(diagramId) {
    const diagramData = diagramsData.find(d => d.id === diagramId);
    if (!diagramData) return;
    
    const statusIndicator = document.querySelector(`#diagram-${diagramId} .status-indicator`);
    const statusText = document.querySelector(`#diagram-${diagramId} .status-text`);
    
    if (statusIndicator) {
        statusIndicator.className = 'status-indicator repairing';
    }
    if (statusText) {
        statusText.textContent = 'Repairing...';
    }
    
    try {
        // Get user authentication
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('Please log in to use repair');
        }
        
        // Call Assistant API repair endpoint
        const result = await window.api.post('/api/chat/diagrams/repair', {
            specId: currentSpecData?.id,
            diagramId: diagramId,
            brokenCode: diagramData.mermaidCode,
            diagramType: diagramData.type,
            errorMessage: diagramData._lastError || ''
        });
        
        if (result.repairedDiagram && result.repairedDiagram.mermaidCode) {
            // Update the diagram data with repaired code
            diagramData.mermaidCode = result.repairedDiagram.mermaidCode;
            
            // Try to re-render the diagram to validate it works
            try {
                await renderSingleDiagram(diagramData, `diagram-${diagramId}-content`, true);
                
                // Check if diagram is now valid before saving to Firebase
                if (diagramData._isValid === true) {
                    // Save to Firebase only if diagram renders successfully
                    if (currentSpecData && currentSpecData.id) {
                        await firebase.firestore().collection('specs').doc(currentSpecData.id).update({
                            'diagrams.diagrams': diagramsData,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });

                        
                        // Update local spec data immediately
                        if (currentSpecData.diagrams) {
                            currentSpecData.diagrams.diagrams = diagramsData;
                        }
                    }
                    
                    if (statusIndicator) statusIndicator.className = 'status-indicator ready';
                    if (statusText) statusText.textContent = 'Repaired';
                    
                    showNotification('Diagram repaired and saved successfully!', 'success');
                } else {
                    // Diagram still has errors even after repair

                    
                    if (statusIndicator) statusIndicator.className = 'status-indicator error';
                    if (statusText) statusText.textContent = 'Still has errors';
                    
                    showNotification('Diagram repaired but still has rendering issues. Try again.', 'warning');
                }
                
            } catch (renderError) {

                
                if (statusIndicator) statusIndicator.className = 'status-indicator error';
                if (statusText) statusText.textContent = 'Repair failed';
                
                showNotification('Failed to render repaired diagram: ' + renderError.message, 'error');
            }
        } else {
            throw new Error('No repaired diagram code received');
        }
        
    } catch (error) {

        
        if (statusIndicator) statusIndicator.className = 'status-indicator error';
        if (statusText) statusText.textContent = 'Repair failed';
        
        showNotification(`Failed to repair diagram: ${error.message}`, 'error');
    }
}

function updateDiagramsStatus(status) {
    const statusElement = document.getElementById('diagramsStatus');
    if (statusElement) {
        statusElement.textContent = status === 'ready' ? 'Ready' : 'Pending';
        statusElement.className = `status-value ${status}`;
    }
}

/**
 * Cleanup function to remove listeners and intervals
 * Called when leaving the page or switching specs
 */
function cleanupSpecListeners() {
    const dataService = window.dataService;
    if (dataService && typeof dataService.teardown === 'function') {
        dataService.teardown();
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanupSpecListeners);

// ============================================
// Skeleton UI Functions
// ============================================

/**
 * Display skeleton loading state for a section
 */
function displaySkeleton(containerId, sectionName) {
    console.log('[displaySkeleton] Displaying skeleton for:', containerId, sectionName);
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('[displaySkeleton] Container not found:', containerId);
        return;
    }
    
    const skeletonHTML = `
        <div class="skeleton-container">
            <div class="skeleton-header">
                <div class="skeleton-spinner"></div>
                <div class="skeleton-text"></div>
            </div>
            <div class="skeleton-line long"></div>
            <div class="skeleton-line medium"></div>
            <div class="skeleton-line long"></div>
            <div class="skeleton-line short"></div>
            <div class="skeleton-line long"></div>
            <div class="skeleton-line medium"></div>
            <div class="skeleton-line long"></div>
        </div>
    `;
    
    container.innerHTML = skeletonHTML;
    console.log('[displaySkeleton] Skeleton displayed successfully');
}

/**
 * Display section loading state with spinner
 */
function displaySectionLoading(headerElement, isLoading) {
    if (!headerElement) return;
    
    let loadingIndicator = headerElement.querySelector('.section-loading');
    
    if (isLoading) {
        if (!loadingIndicator) {
            loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'section-loading';
            loadingIndicator.innerHTML = `
                <div class="loading-spinner"></div>
                <span>Loading...</span>
            `;
            headerElement.appendChild(loadingIndicator);
        }
        loadingIndicator.style.display = 'flex';
    } else {
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
}

// ============================================
// Progress Bar with Rotating Messages
// ============================================

let progressMessageInterval = null;
let currentProgressMessageIndex = 0;

const progressMessages = [
    'Understanding your idea...',
    'Defining core features...',
    'Mapping user workflows...',
    'Analyzing technical requirements...',
    'Researching market opportunities...',
    'Designing user experience...',
    'Finalizing specification...'
];

/**
 * Start progress bar with rotating messages
 */
function startProgressBar() {
    console.log('[startProgressBar] Starting progress bar...');
    const progressContainer = document.getElementById('spec-generation-progress');
    if (!progressContainer) {
        console.error('[startProgressBar] Progress bar container not found!');
        return;
    }
    
    // Clear any existing interval
    if (progressMessageInterval) {
        console.log('[startProgressBar] Clearing existing interval');
        clearInterval(progressMessageInterval);
        progressMessageInterval = null;
    }
    
    progressContainer.classList.remove('hidden');
    console.log('[startProgressBar] Progress bar container is now visible');
    
    const messageElement = document.getElementById('progress-message');
    if (!messageElement) {
        console.error('[startProgressBar] Progress message element not found!');
        return;
    }
    
    // Set initial message
    messageElement.textContent = progressMessages[0];
    currentProgressMessageIndex = 0;
    console.log('[startProgressBar] Initial message set:', progressMessages[0]);
    
    // Rotate messages every 3.5 seconds
    progressMessageInterval = setInterval(() => {
        currentProgressMessageIndex = (currentProgressMessageIndex + 1) % progressMessages.length;
        messageElement.textContent = progressMessages[currentProgressMessageIndex];
        console.log('[startProgressBar] Message rotated to:', progressMessages[currentProgressMessageIndex]);
    }, 3500);
    
    console.log('[startProgressBar] Progress bar started successfully');
}

/**
 * Stop progress bar
 */
function stopProgressBar() {
    console.log('[stopProgressBar] Stopping progress bar...');
    const progressContainer = document.getElementById('spec-generation-progress');
    if (progressContainer) {
        progressContainer.classList.add('hidden');
        console.log('[stopProgressBar] Progress bar hidden');
    } else {
        console.warn('[stopProgressBar] Progress bar container not found');
    }
    
    if (progressMessageInterval) {
        clearInterval(progressMessageInterval);
        progressMessageInterval = null;
        console.log('[stopProgressBar] Interval cleared');
    }
}

// ============================================
// Chat Bubbles (Micro-Content)
// ============================================

/**
 * Toggle chat bubble card
 */
function toggleChatBubble(type) {
    console.log('[toggleChatBubble] Toggling chat bubble:', type);
    const card = document.getElementById(`${type}-card`);
    const bubble = document.getElementById(`${type}-bubble`);
    
    if (!card || !bubble) {
        console.error('[toggleChatBubble] Card or bubble not found:', type);
        return;
    }
    
    // Close all other cards first
    const allCards = document.querySelectorAll('.chat-bubble-card');
    allCards.forEach(c => {
        if (c !== card) {
            c.classList.add('hidden');
        }
    });
    
    // Toggle current card
    if (card.classList.contains('hidden')) {
        card.classList.remove('hidden');
        bubble.style.opacity = '0.8';
        console.log('[toggleChatBubble] Card opened:', type);
    } else {
        card.classList.add('hidden');
        bubble.style.opacity = '1';
        console.log('[toggleChatBubble] Card closed:', type);
    }
}

/**
 * Close chat bubble card
 */
function closeChatBubble(type) {
    const card = document.getElementById(`${type}-card`);
    const bubble = document.getElementById(`${type}-bubble`);
    
    if (card) {
        card.classList.add('hidden');
    }
    if (bubble) {
        bubble.style.opacity = '1';
    }
}

// Make functions globally accessible for onclick handlers
window.toggleChatBubble = toggleChatBubble;
window.closeChatBubble = closeChatBubble;

// Close chat bubbles when clicking outside
document.addEventListener('click', (e) => {
    const bubblesContainer = document.getElementById('chat-bubbles-container');
    if (!bubblesContainer) return;
    
    // Check if click is outside chat bubbles
    if (!bubblesContainer.contains(e.target)) {
        const allCards = document.querySelectorAll('.chat-bubble-card');
        allCards.forEach(card => {
            card.classList.add('hidden');
        });
        
        const allBubbles = document.querySelectorAll('.chat-bubble');
        allBubbles.forEach(bubble => {
            bubble.style.opacity = '1';
        });
    }
});
