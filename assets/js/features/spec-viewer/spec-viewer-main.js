let currentSpecData = null;
let currentTab = 'overview';
let isLoading = false;

// Worker endpoints configuration
const MOCKUPS_WORKER_URL = 'https://mockup.shalom-cohen-111.workers.dev/generate';
const MOCKUPS_ANALYZE_URL = 'https://mockup.shalom-cohen-111.workers.dev/analyze-screens';
const MOCKUPS_SINGLE_URL = 'https://mockup.shalom-cohen-111.workers.dev/generate-single-mockup';

// OpenAI Storage helper function
async function triggerOpenAIUploadForSpec(specId) {
    try {
        const user = firebase.auth().currentUser;
        if (!user) {

            return;
        }
        
        const token = await user.getIdToken();
        const response = await fetch(`${getApiBaseUrl()}/api/specs/${specId}/upload-to-openai`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }
        

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
        
        const token = await user.getIdToken();
        const apiBaseUrl = window.getApiBaseUrl ? window.getApiBaseUrl() : 'https://specifys-ai-development.onrender.com';
        
        const response = await fetch(`${apiBaseUrl}/api/specs/${specId}/send-ready-notification`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to send notification');
        }
        
        const result = await response.json();
        if (result.success) {
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
    // Initialize Mermaid with custom theme
    try {
        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({
                startOnLoad: false, // Prevent automatic rendering - we render diagrams manually
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
            });

        }
    } catch (error) {

    }
    
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
        
        // Check if we need to show registration modal
        checkAuthenticationStatus(user);
        
        // Update storage status when auth state changes
        if (currentSpecData) {
            updateStorageStatus();
        }
    });
    
    // Load spec will be triggered after user authentication
    

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
        modal.style.display = 'flex';

    }
}

// Close registration modal
function closeRegistrationModal() {
    const modal = document.getElementById('registrationModal');
    if (modal) {
        modal.style.display = 'none';

    }
}

// Continue as guest
function continueAsGuest() {
    closeRegistrationModal();
    
    // Show a notification about guest mode
    showNotification('You are now in guest mode. Your specifications will only be saved locally.', 'info');
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
        showLoading();
        


        
        if (!specId) {
            throw new Error('No specification ID provided');
        }
        
        // Load from Firebase - user must be authenticated (checked in onAuthStateChanged)
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('User must be authenticated to view specifications');
        }
        
        const doc = await firebase.firestore().collection('specs').doc(specId).get();
        if (!doc.exists) {
            throw new Error('Specification not found');
        }
        
        const specData = doc.data();
        
        // Check if user has permission to view this spec
        // spec-viewer.html only shows specs to their owner or admin (not public specs)
        const adminEmails = ['specifysai@gmail.com', 'admin@specifys.ai', 'shalom@specifys.ai'];
        const isOwner = specData.userId === user.uid;
        const isAdmin = adminEmails.includes(user.email);
        
        if (!isOwner && !isAdmin) {
            showError('You do not have permission to view this specification. You can only view specifications that you created.');
            return;
        }
        
        currentSpecData = { id: doc.id, ...specData };
        
        const technicalPreview = specData.technical ? specData.technical.substring(0, 200) + (specData.technical.length > 200 ? '...' : '') : 'null';
        const marketPreview = specData.market ? specData.market.substring(0, 200) + (specData.market.length > 200 ? '...' : '') : 'null';
        const designPreview = specData.design ? specData.design.substring(0, 200) + (specData.design.length > 200 ? '...' : '') : 'null';
        











        

        displaySpec(currentSpecData);
        
    } catch (error) {

        showError(`Error loading spec: ${error.message}`);
        showNotification('Failed to load specification. Please try again.', 'error');
    }
}

function displaySpec(data) {



    
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
    
    hideLoading();
    hideError();
    const content = document.getElementById('content');
    if (content) {
        content.style.display = 'block';
    }
    
    // Extract app name from title (first word)
    const appName = data.title ? data.title.split(' ')[0] : '';
    const fullTitle = appName ? `App Specification - ${appName}` : 'App Specification';
    
    // Update page title in browser tab
    document.title = `${fullTitle} - Specifys.ai`;
    
    // Update page title if element exists
    const specTitleElement = document.getElementById('spec-title');
    if (specTitleElement) {
        specTitleElement.textContent = fullTitle;
    }
    
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
    updateDiagramsStatus(data.diagrams?.generated ? 'ready' : 'pending');
    updateStorageStatus(); // Add storage status update
    
    // Update all notification dots
    updateAllNotificationDots();
    
    // Display content for each tab

    displayOverview(data.overview);
    displayTechnical(data.technical);
    displayMarket(data.market);
    displayDesign(data.design);
    displayMockup(data.mockups).catch(err => console.error('Error displaying mockup:', err));
    displayDiagramsFromData(data);
    displayPromptsFromData(data);
    displayRaw(data);
    
    // Update export checkboxes based on available sections
    updateExportCheckboxes();
    
    // Send email notification if overview is ready and email hasn't been sent yet
    if (data.status?.overview === 'ready' && !data.emailNotificationSent) {
        sendSpecReadyNotification(data.id).catch(err => {
            // Silently fail - don't interrupt user experience
            // Failed to send spec ready notification
        });
    }
    
    // Handle approval state
    if (data.overviewApproved) {
        // Enable AI Chat immediately when overview is approved
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
        
        // Enable diagrams only if both technical and market are ready
        if (data.status?.technical === 'ready' && data.status?.market === 'ready') {
            const diagramsTab = document.getElementById('diagramsTab');
            if (diagramsTab) {
                diagramsTab.disabled = false;
            }
            // Show Generate only if no diagrams yet
            const hasDiagrams = !!(data.diagrams && Array.isArray(data.diagrams.diagrams) && data.diagrams.diagrams.length > 0);
            const generateDiagramsBtn = document.getElementById('generateDiagramsBtn');
            if (generateDiagramsBtn) {
                generateDiagramsBtn.style.display = hasDiagrams ? 'none' : 'inline-block';
            }
        }
        
        // Enable prompts only if both technical and design are ready
        if (data.status?.technical === 'ready' && data.status?.design === 'ready') {
            const promptsTab = document.getElementById('promptsTab');
            if (promptsTab) {
                promptsTab.disabled = false;
            }
            // Show Generate only if no prompts yet
            const hasPrompts = !!(data.prompts && data.prompts.generated);
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
        
        hideApproveButton();
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

function displayOverview(overview) {
    const container = document.getElementById('overview-data');
    
    // Debug logging

    
    if (!overview) {
        container.innerHTML = '<p class="text-muted">Overview not available...</p>';
        return;
    }
    
    // Store original overview for editing
    window.originalOverview = overview;
    
    // Format and display
    const formattedContent = formatTextContent(overview);
    container.innerHTML = formattedContent;
    
    // Update subsections after content is loaded
    setTimeout(() => {
        if (currentTab === 'overview') {
            updateSubsections('overview');
        }
    }, 100);
    
    // Calculate and display complexity score
    const complexityScore = calculateComplexityScore(overview);
    const complexityHTML = renderComplexityScore(complexityScore);
    container.innerHTML += complexityHTML;
    
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
    
    const container = document.getElementById('technical-data');
    
    if (!technical) {
        container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-lock"></i> Technical Specification</h3><p>Please approve the Overview first to generate the technical specification.</p></div>';
        return;
    }
    
    if (technical === 'error') {
        container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-exclamation-triangle"></i> Error Generating Technical Specification</h3><p>There was an error generating the technical specification. Please try again.</p></div>';
        const retryTechnicalBtn = document.getElementById('retryTechnicalBtn');
        if (retryTechnicalBtn) {
            retryTechnicalBtn.style.display = 'inline-block';
        }
        return;
    }
    
    // Format the technical content
    const formattedContent = formatTextContent(technical);
    container.innerHTML = formattedContent;
    
    // Update subsections after content is loaded
    setTimeout(() => {
        if (currentTab === 'technical') {
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

function displayMarket(market) {
    const container = document.getElementById('market-data');
    
    if (!market) {
        container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-lock"></i> Market Research</h3><p>Please approve the Overview first to generate the market research.</p></div>';
        return;
    }
    
    if (market === 'error') {
        container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-exclamation-triangle"></i> Error Generating Market Research</h3><p>There was an error generating the market research. Please try again.</p></div>';
        const retryMarketBtn = document.getElementById('retryMarketBtn');
        if (retryMarketBtn) {
            retryMarketBtn.style.display = 'inline-block';
        }
        return;
    }
    
    // Format the market content
    const formattedContent = formatTextContent(market);
    container.innerHTML = formattedContent;
    
    // Update subsections after content is loaded
    setTimeout(() => {
        if (currentTab === 'market') {
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
        const WORKER_URL = 'https://generate-mindmap.shalom-cohen-111.workers.dev/';
        
        const response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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
    const container = document.getElementById('design-data');
    
    if (!design) {
        container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-lock"></i> Design & Branding</h3><p>Please approve the Overview first to generate the design specification.</p></div>';
        return;
    }
    
    if (design === 'error') {
        container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-exclamation-triangle"></i> Error Generating Design Specification</h3><p>There was an error generating the design specification. Please try again.</p></div>';
        const retryDesignBtn = document.getElementById('retryDesignBtn');
        if (retryDesignBtn) {
            retryDesignBtn.style.display = 'inline-block';
        }
        return;
    }
    
    // Parse design data for colors and typography (for preview buttons)
    const designData = parseDesignData(design);

    // Format the remaining design content (which includes Visual Style Guide with Color Palette)
    const formattedContent = formatTextContent(design);
    
    // Update subsections after content is loaded
    setTimeout(() => {
        if (currentTab === 'design') {
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
                // Extract colors from JSON
                if (jsonData.visualStyleGuide.colors) {
                    const colorsObj = jsonData.visualStyleGuide.colors;
                    Object.entries(colorsObj).forEach(([key, value]) => {
                        const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
                        result.colors[capitalizedKey] = value;
                    });
                }
                // Extract typography from JSON
                if (jsonData.visualStyleGuide.typography) {
                    const typographyObj = jsonData.visualStyleGuide.typography;
                    Object.entries(typographyObj).forEach(([key, value]) => {
                        const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
                        result.typography[capitalizedKey] = value;
                    });
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
                // Extract colors from JSON
                if (jsonData.design.visualStyleGuide.colors) {
                    const colorsObj = jsonData.design.visualStyleGuide.colors;
                    Object.entries(colorsObj).forEach(([key, value]) => {
                        const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
                        result.colors[capitalizedKey] = value;
                    });
                }
                // Extract typography from JSON
                if (jsonData.design.visualStyleGuide.typography) {
                    const typographyObj = jsonData.design.visualStyleGuide.typography;
                    Object.entries(typographyObj).forEach(([key, value]) => {
                        const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
                        result.typography[capitalizedKey] = value;
                    });
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
        console.warn('Color visualizer modal elements not found. The visualizer feature may not be available.');
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
        console.warn(`Template element for ${type} not found.`);
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
    
    // THIRD CHECK: Diagrams must be generated and valid
    if (!data.diagrams?.generated || 
        !data.diagrams?.diagrams || 
        !Array.isArray(data.diagrams.diagrams) || 
        data.diagrams.diagrams.length === 0) {
        container.innerHTML = `
            <div class="locked-tab-message">
                <h3><i class="fa fa-bar-chart"></i> Diagrams</h3>
                <p>Click "Generate Diagrams" to create visual representations of your specification.</p>
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
                <p>No valid diagrams found. Click "Generate Diagrams" to create visual representations.</p>
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
                <p>Please approve the Overview and generate Technical & Design specifications first to create development prompts.</p>
            </div>
        `;
        return;
    }
    
    // SECOND CHECK: Technical and Design must be ready
    if (!data.technical || !data.design || 
        data.status?.technical !== 'ready' || 
        data.status?.design !== 'ready') {
        container.innerHTML = `
            <div class="locked-tab-message">
                <h3><i class="fa fa-lock"></i> Prompts</h3>
                <p>Please generate Technical & Design specifications first to create development prompts.</p>
            </div>
        `;
        return;
    }
    
    // THIRD CHECK: Prompts must be generated and valid
    if (!data.prompts?.generated || 
        !data.prompts?.fullPrompt || 
        typeof data.prompts.fullPrompt !== 'string' ||
        data.prompts.fullPrompt.trim().length === 0) {
        container.innerHTML = `
            <div class="locked-tab-message">
                <h3><i class="fa fa-terminal"></i> Prompts</h3>
                <p>Click "Generate Prompts" to create comprehensive development prompts and third-party integration instructions.</p>
            </div>
        `;
        return;
    }
    
    // ALL CHECKS PASSED - Display prompts
    displayPrompts(data.prompts);
    
    // Update raw data
    const rawPrompts = document.getElementById('raw-prompts');
    if (rawPrompts) {
        rawPrompts.textContent = JSON.stringify(data.prompts, null, 2);
    }
}

function formatTextContent(content) {
    
    if (!content) {
        return '<p>No content available</p>';
    }
    
    // Debug logging

    
    // Check if content is JSON
    let parsedContent;
    try {
        parsedContent = JSON.parse(content);

        return formatJSONContent(parsedContent);
    } catch (error) {

        return formatPlainTextContent(content);
    }
}

// REMOVED: Duplicate escapeHtml() - Using the one defined later in the file
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
    
    // Handle new Overview structure
    if (jsonData.ideaSummary) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-lightbulb-o"></i> Idea Summary</h3>';
        html += `<p>${jsonData.ideaSummary}</p>`;
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
            html += `<li>${feature}</li>`;
        });
        html += '</ul>';
        html += '</div>';
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
    
    // Handle new Detailed User Flow
    if (jsonData.detailedUserFlow) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-list-ol"></i> Detailed User Flow</h3>';
        
        if (jsonData.detailedUserFlow.steps && Array.isArray(jsonData.detailedUserFlow.steps)) {
            html += '<h4>Steps:</h4>';
            html += '<ol>';
            jsonData.detailedUserFlow.steps.forEach((step, index) => {
                // Remove "Step X:" prefix if it already exists in the step text
                const cleanedStep = step.replace(/^Step\s+\d+:\s*/i, '').trim();
                html += `<li><strong>Step ${index + 1}:</strong> ${cleanedStep}</li>`;
            });
            html += '</ol>';
        }
        
        if (jsonData.detailedUserFlow.decisionPoints) {
            html += '<h4>Decision Points:</h4>';
            html += `<p>${jsonData.detailedUserFlow.decisionPoints}</p>`;
        }
        
        if (jsonData.detailedUserFlow.errorHandling) {
            html += '<h4>Error Handling:</h4>';
            html += `<p>${jsonData.detailedUserFlow.errorHandling}</p>`;
        }
        
        if (jsonData.detailedUserFlow.confirmations) {
            html += '<h4>Confirmations:</h4>';
            html += `<p>${jsonData.detailedUserFlow.confirmations}</p>`;
        }
        
        if (jsonData.detailedUserFlow.feedbackLoops) {
            html += '<h4>Feedback Loops:</h4>';
            html += `<p>${jsonData.detailedUserFlow.feedbackLoops}</p>`;
        }
        
        html += '</div>';
    }
    
    // Handle new Screen Descriptions
    if (jsonData.screenDescriptions) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-desktop"></i> Screen Descriptions</h3>';
        
        if (jsonData.screenDescriptions.screens && Array.isArray(jsonData.screenDescriptions.screens)) {
            html += '<h4>Screens (' + jsonData.screenDescriptions.screens.length + ' total):</h4>';
            jsonData.screenDescriptions.screens.forEach((screen, index) => {
                if (typeof screen === 'string') {
                    html += `<div style="margin-bottom: 15px; padding: 15px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid var(--primary-color);">`;
                    html += `<p style="margin: 0;"><strong>Screen ${index + 1}:</strong> ${screen}</p>`;
                    html += '</div>';
                } else {
                    html += `<div style="margin-bottom: 15px; padding: 15px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid var(--primary-color);">`;
                    html += `<p style="margin: 0;"><strong>Screen ${index + 1} - ${screen.name || 'Unnamed Screen'}:</strong> ${screen.purpose || 'No purpose specified'}</p>`;
                    if (screen.elements) {
                        html += `<p style="margin-top: 8px; margin-bottom: 0; font-size: 0.9em; color: #666;"><strong>Key Elements:</strong> ${screen.elements}</p>`;
                    }
                    if (screen.interactions) {
                        html += `<p style="margin-top: 8px; margin-bottom: 0; font-size: 0.9em; color: #666;"><strong>Interactions:</strong> ${screen.interactions}</p>`;
                    }
                    html += '</div>';
                }
            });
        }
        
        if (jsonData.screenDescriptions.uiComponents) {
            html += '<h4>UI Components:</h4>';
            // Check if uiComponents is an array or string
            if (Array.isArray(jsonData.screenDescriptions.uiComponents)) {
                html += '<ul style="margin-left: 20px;">';
                jsonData.screenDescriptions.uiComponents.forEach(component => {
                    html += `<li style="margin-bottom: 8px;">${component}</li>`;
                });
                html += '</ul>';
            } else {
                html += `<p>${jsonData.screenDescriptions.uiComponents}</p>`;
            }
        }
        
        if (jsonData.screenDescriptions.navigationStructure) {
            html += '<h4>Navigation Structure:</h4>';
            html += `<p>${jsonData.screenDescriptions.navigationStructure}</p>`;
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
    
    // Handle new Architecture Overview
    if (jsonData.architectureOverview) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-building"></i> Architecture Overview</h3>';
        html += `<p>${jsonData.architectureOverview}</p>`;
        html += '</div>';
    }
    
    // Handle new Database Schema
    if (jsonData.databaseSchema) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-database"></i> Database Schema</h3>';
        
        if (jsonData.databaseSchema.description) {
            html += `<p>${jsonData.databaseSchema.description}</p>`;
        }
        
        if (jsonData.databaseSchema.tables && Array.isArray(jsonData.databaseSchema.tables)) {
            html += '<h4>Tables:</h4>';
            jsonData.databaseSchema.tables.forEach(table => {
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
    
    // Handle new API Endpoints
    if (jsonData.apiEndpoints && Array.isArray(jsonData.apiEndpoints)) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-plug"></i> API Endpoints</h3>';
        
        jsonData.apiEndpoints.forEach(endpoint => {
            html += `<h4>${endpoint.method || 'N/A'} ${endpoint.path || 'N/A'}</h4>`;
            html += `<p><strong>Description:</strong> ${endpoint.description || 'No description provided'}</p>`;
            
            if (endpoint.requestExample) {
                html += `<p><strong>Request Example:</strong></p>`;
                html += `<pre><code>${endpoint.requestExample}</code></pre>`;
            }
            
            if (endpoint.responseExample) {
                html += `<p><strong>Response Example:</strong></p>`;
                html += `<pre><code>${endpoint.responseExample}</code></pre>`;
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
            
            // Limit to 5 colors maximum
            const colorEntries = Object.entries(jsonData.visualStyleGuide.colors).slice(0, 5);
            
            colorEntries.forEach(([key, value]) => {
                // Extract color code (everything before the first space or dash)
                const colorMatch = String(value).match(/^#?[0-9A-Fa-f]{6}/);
                const color = colorMatch ? colorMatch[0] : (String(value).startsWith('#') ? value : '#6366F1');
                
                // Extract description if available (after dash)
                const dashIndex = String(value).indexOf(' - ');
                const description = dashIndex > 0 ? String(value).substring(dashIndex + 3) : '';
                
                html += '<div style="background: white; padding: 20px; border-radius: 10px; border: 2px solid #e0e0e0; text-align: center;">';
                html += `<div style="width: 60px; height: 60px; border-radius: 12px; background: ${color}; margin: 0 auto 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"></div>`;
                html += `<div style="font-weight: 600; margin-bottom: 5px;">${key.charAt(0).toUpperCase() + key.slice(1)}</div>`;
                html += `<div style="color: #666; font-size: 14px;">${color}</div>`;
                if (description) {
                    html += `<div style="color: #888; font-size: 13px; margin-top: 5px;">${description}</div>`;
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
      '5': 'diagrams',
      '6': 'prompts',
      '7': 'chat',
      '8': 'mockup',
      '9': 'export'
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

window.showTab = async function(tabName) {
    // Close mobile menu if open
    if (window.innerWidth <= 768) {
        const sideMenu = document.getElementById('sideMenu');
        const sideMenuToggle = document.getElementById('sideMenuToggle');
        const overlay = document.querySelector('.side-menu-overlay');
        
        if (sideMenu && sideMenu.classList.contains('active')) {
            sideMenu.classList.remove('active');
            if (sideMenuToggle) {
                sideMenuToggle.setAttribute('aria-expanded', 'false');
            }
            if (overlay) {
                overlay.classList.remove('active');
            }
            document.body.style.overflow = '';
        }
    }
    // Check PRO access for mockup tab
    if (tabName === 'mockup') {
        const hasProAccess = await checkProAccess();
        if (!hasProAccess) {
            showNotification('Mockup feature is available for PRO users only. Please upgrade to PRO to access mockups.', 'error');
            return;
        }
    }
    
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.side-menu-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab content
    const tabContent = document.getElementById(`${tabName}-content`);
    if (tabContent) {
        tabContent.style.display = 'block';
        
        // Scroll to the tab content header (not the page title)
        // Use requestAnimationFrame to ensure the element is rendered before scrolling
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const contentHeader = tabContent.querySelector('.content-header');
                if (contentHeader) {
                    // Calculate absolute position from top of document
                    let offsetTop = 0;
                    let element = contentHeader;
                    
                    // Traverse up the DOM tree to calculate absolute position
                    while (element) {
                        offsetTop += element.offsetTop;
                        element = element.offsetParent;
                    }
                    
                    // Add small offset to account for any fixed headers
                    const scrollOffset = 20;
                    
                    // Scroll to the header position
                    window.scrollTo({ 
                        top: Math.max(0, offsetTop - scrollOffset), 
                        behavior: 'smooth' 
                    });
                } else {
                    // Fallback: scroll to tab content
                    let offsetTop = 0;
                    let element = tabContent;
                    
                    while (element) {
                        offsetTop += element.offsetTop;
                        element = element.offsetParent;
                    }
                    
                    const scrollOffset = 20;
                    
                    window.scrollTo({ 
                        top: Math.max(0, offsetTop - scrollOffset), 
                        behavior: 'smooth' 
                    });
                }
            });
        });
    }
    
    // Add active class to selected button
    const tabButton = document.getElementById(`${tabName}Tab`);
    if (tabButton && !tabButton.disabled) {
        tabButton.classList.add('active');
        tabButton.setAttribute('aria-selected', 'true');
        
        // Update other tabs
        document.querySelectorAll('.side-menu-button').forEach(btn => {
            if (btn !== tabButton) {
                btn.setAttribute('aria-selected', 'false');
            }
        });
        
        // Announce tab change to screen readers
        if (window.focusManager) {
            window.focusManager.announce(`Switched to ${tabName} tab`, 'polite');
        }
    }
    
    // Hide notification dot for active tab and mark as viewed (except chat which is one-time)
    const notificationDot = document.getElementById(`${tabName}Notification`);
    if (notificationDot) {
        notificationDot.style.display = 'none';
        notificationDot.classList.remove('generating', 'notification', 'chat-notification');
    }
    
    // Mark tab as viewed (except chat - it's a one-time notification)
    if (tabName !== 'chat') {
        markTabAsViewed(tabName);
        
        // Mark button as viewed (icon turns orange)
        if (tabButton) {
            tabButton.classList.add('viewed');
        }
    }
    
    // Update notification dots after marking as viewed
    if (currentSpecData && currentSpecData.status) {
        const status = currentSpecData.status[tabName] || currentSpecData.status[tabName === 'mockup' ? 'mockup' : tabName];
        if (status) {
            updateNotificationDot(tabName, status);
        }
    }
    
    // Update subsections for the active tab (but don't close other submenus)
    updateSubsections(tabName);
    
    // Show Mind Map container when tab is opened (but don't auto-generate)
    if (tabName === 'mindmap') {
        initializeMindMapTab();
    }
    
    currentTab = tabName;
}

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
    const tabs = ['overview', 'technical', 'market', 'design', 'diagrams', 'prompts'];
    tabs.forEach(tabName => {
        const tabContent = document.getElementById(`${tabName}-content`);
        if (tabContent) {
            updateSubsections(tabName);
        }
    });
}

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
        currentTab = tabName;
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
    
    // Enable Prompts tab only if both technical and design are ready
    if (currentSpecData.status?.technical === 'ready' && currentSpecData.status?.design === 'ready') {
        const promptsTab = document.getElementById('promptsTab');
        if (promptsTab) {
            promptsTab.disabled = false;
            // Show Generate button only if no prompts yet
            const hasPrompts = !!(currentSpecData.prompts && currentSpecData.prompts.generated);
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
            // Show Generate only if no diagrams yet
            const hasDiagrams = !!(currentSpecData.diagrams && Array.isArray(currentSpecData.diagrams.diagrams) && currentSpecData.diagrams.diagrams.length > 0);
            const generateDiagramsBtn = document.getElementById('generateDiagramsBtn');
            if (generateDiagramsBtn) {
                generateDiagramsBtn.style.display = hasDiagrams ? 'none' : 'inline-block';
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
    // Enable chat tab after overview approval
    enableChatTab();
}

function enableChatTabOnly() {
    // Enable AI Chat tab immediately after overview approval
    // without waiting for other specs to be generated
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

        
        if (!user) {
            throw new Error('User must be authenticated to save to Firebase');
        }
        
        const specDoc = {
            title: specData.title || 'App Specification',
            overview: specData.overview,
            technical: specData.technical,
            market: specData.market,
            status: specData.status || {
                overview: "ready",
                technical: "pending",
                market: "pending"
            },
            overviewApproved: specData.overviewApproved || false,
            answers: specData.answers || [],
            userId: user.uid,
            userName: user.displayName || user.email || 'Anonymous User',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        

        
        const docRef = await firebase.firestore().collection('specs').add(specDoc);

        
        // Show success notification
        showNotification('Specification saved successfully!', 'success');
        
        // Update storage status
        updateStorageStatus();
        
        return docRef.id;
        
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
    if (isLoading) return;
    
    try {




        
        isLoading = true;
        const approveBtn = document.getElementById('approveBtn');
        if (approveBtn) {
            approveBtn.disabled = true;
            approveBtn.innerHTML = '<span class="loading-spinner"></span> Generating specifications...';
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
                        design: "generating"
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
        
        // Start parallel generation directly via Cloudflare Worker (like retry functions)
        showNotification('Starting parallel generation of Technical, Market, and Design specifications...', 'info');
        
        // Generate all three specifications in parallel
        const generationPromises = [
            generateTechnicalSpec().then(content => ({ type: 'technical', content })),
            generateMarketSpec().then(content => ({ type: 'market', content })),
            generateDesignSpec().then(content => ({ type: 'design', content }))
        ];
        
        // Wait for all to complete (or fail)
        const results = await Promise.allSettled(generationPromises);
        
        // Process results and update Firebase
        // user is already defined above (line 4551), don't redeclare
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
                    const hasDiagrams = !!(currentSpecData.diagrams && Array.isArray(currentSpecData.diagrams.diagrams) && currentSpecData.diagrams.diagrams.length > 0);
                    const generateDiagramsBtn = document.getElementById('generateDiagramsBtn');
                    if (generateDiagramsBtn) {
                        generateDiagramsBtn.style.display = hasDiagrams ? 'none' : 'inline-block';
                    }
                }
                
                // Check if all are ready or errored to show final notification
                const allDone = ['technical', 'market', 'design'].every(stage =>
                    updates.status[stage] === 'ready' || updates.status[stage] === 'error'
                );

                if (allDone) {
                    const allSuccessful = ['technical', 'market', 'design'].every(stage =>
                        updates.status[stage] === 'ready'
                    );
                    if (allSuccessful) {
                        showNotification('All specifications generated successfully!', 'success');
                        
                        // Upload updated spec to OpenAI API for chat purposes (non-blocking)
                        if (currentSpecData && currentSpecData.id) {
                            triggerOpenAIUploadForSpec(currentSpecData.id).catch(err => {
                                // Non-blocking - don't interrupt user experience
                                console.warn('Failed to upload spec to OpenAI after generation:', err);
                            });
                        }
                    } else {
                        showNotification('Some specifications failed to generate. You can retry using the retry buttons.', 'error');
                    }
                    hideApproveButton();
                }
            } catch (error) {
                if (window.appLogger) {
                    window.appLogger.logError(error, { context: 'SpecViewer.updateFirebase' });
                }
                showNotification('Failed to update database, but specifications were generated locally.', 'error');
            }
        }
        
        // Re-enable button
        isLoading = false;
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
        isLoading = false;
        const approveBtn = document.getElementById('approveBtn');
        if (approveBtn) {
            approveBtn.disabled = false;
            approveBtn.innerHTML = '<i class="fa fa-check"></i> Approve Overview';
        }
    }
}

async function triggerOpenAIUploadForSpec(specId) {
    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            return;
        }
        
        const token = await user.getIdToken();
        const response = await fetch(`${getApiBaseUrl()}/api/specs/${specId}/upload-to-openai`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }
    } catch (error) {
        // Silently fail - don't interrupt user experience
    }
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
        const response = await fetch('https://spspec.shalom-cohen-111.workers.dev/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
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
        const response = await fetch('https://spspec.shalom-cohen-111.workers.dev/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
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
        const response = await fetch('https://spspec.shalom-cohen-111.workers.dev/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
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
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            const retryTechnicalBtn = document.getElementById('retryTechnicalBtn');
            if (retryTechnicalBtn) {
                retryTechnicalBtn.disabled = true;
                retryTechnicalBtn.textContent = `⏳ Retrying... (${retryCount + 1}/${maxRetries})`;
            }
            
            // Add loading animation
            updateTabLoadingState('technical', true);
            
            const technicalContent = await generateTechnicalSpec();
            
            // Update Firebase
            const user = firebase.auth().currentUser;
            if (user && currentSpecData) {
                await firebase.firestore().collection('specs').doc(currentSpecData.id).update({
                    technical: technicalContent,
                    status: {
                        ...currentSpecData.status,
                        technical: "ready"
                    },
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Upload updated spec to OpenAI API for chat purposes (non-blocking)
                triggerOpenAIUploadForSpec(currentSpecData.id).catch(err => {
                    console.warn('Failed to upload spec to OpenAI after technical retry:', err);
                });
            }
            
            // Update local data
            currentSpecData.technical = technicalContent;
            currentSpecData.status.technical = "ready";
            
            // Update export checkboxes when technical section is ready
            updateExportCheckboxes();
            
            // Update localStorage backup
            localStorage.setItem(`specBackup_${currentSpecData.id}`, JSON.stringify(currentSpecData));
            
            // Update UI
            updateStatus('technical', 'ready');
            updateTabLoadingState('technical', false);
            displayTechnical(technicalContent);
            if (retryTechnicalBtn) {
                retryTechnicalBtn.style.display = 'none';
            }
            
            // Enable Mind Map tab when technical is ready
            const mindmapTab = document.getElementById('mindmapTab');
            if (mindmapTab) {
                mindmapTab.disabled = false;
            }
            
            showNotification('Technical specification generated successfully!', 'success');

            return;
            
        } catch (error) {
            retryCount++;

            
            if (retryCount >= maxRetries) {
                // Final failure
                const retryTechnicalBtn = document.getElementById('retryTechnicalBtn');
                if (retryTechnicalBtn) {
                    retryTechnicalBtn.disabled = false;
                    retryTechnicalBtn.textContent = 'Retry';
                }
                updateTabLoadingState('technical', false);
                
                showNotification(`Failed to generate technical specification after ${maxRetries} attempts. ${error.message}`, 'error');
                updateStatus('technical', 'error');

                return;
            } else {
                // Wait before next retry
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
}

async function retryMarket() {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            const retryMarketBtn = document.getElementById('retryMarketBtn');
            if (retryMarketBtn) {
                retryMarketBtn.disabled = true;
                retryMarketBtn.textContent = `⏳ Retrying... (${retryCount + 1}/${maxRetries})`;
            }
            
            // Add loading animation
            updateTabLoadingState('market', true);
            
            const marketContent = await generateMarketSpec();
            
            // Update Firebase
            const user = firebase.auth().currentUser;
            if (user && currentSpecData) {
                await firebase.firestore().collection('specs').doc(currentSpecData.id).update({
                    market: marketContent,
                    status: {
                        ...currentSpecData.status,
                        market: "ready"
                    },
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Upload updated spec to OpenAI API for chat purposes (non-blocking)
                triggerOpenAIUploadForSpec(currentSpecData.id).catch(err => {
                    console.warn('Failed to upload spec to OpenAI after market retry:', err);
                });
            }
            
            // Update local data
            currentSpecData.market = marketContent;
            currentSpecData.status.market = "ready";
            
            // Update export checkboxes when market section is ready
            updateExportCheckboxes();
            
            // Update localStorage backup
            localStorage.setItem(`specBackup_${currentSpecData.id}`, JSON.stringify(currentSpecData));
            
            // Update UI
            updateStatus('market', 'ready');
            updateTabLoadingState('market', false);
            displayMarket(marketContent);
            if (retryMarketBtn) {
                retryMarketBtn.style.display = 'none';
            }
            
            showNotification('Market research generated successfully!', 'success');

            return;
            
        } catch (error) {
            retryCount++;

            
            if (retryCount >= maxRetries) {
                // Final failure
                const retryMarketBtn = document.getElementById('retryMarketBtn');
                if (retryMarketBtn) {
                    retryMarketBtn.disabled = false;
                    retryMarketBtn.textContent = 'Retry';
                }
                updateTabLoadingState('market', false);
                
                showNotification(`Failed to generate market research after ${maxRetries} attempts. ${error.message}`, 'error');
                updateStatus('market', 'error');

                return;
            } else {
                // Wait before next retry
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
}

async function retryDesign() {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            const retryDesignBtn = document.getElementById('retryDesignBtn');
            if (retryDesignBtn) {
                retryDesignBtn.disabled = true;
                retryDesignBtn.textContent = `⏳ Retrying... (${retryCount + 1}/${maxRetries})`;
            }
            
            // Add loading animation
            updateTabLoadingState('design', true);
            
            const designContent = await generateDesignSpec();
            
            // Update Firebase
            const user = firebase.auth().currentUser;
            if (user && currentSpecData) {
                await firebase.firestore().collection('specs').doc(currentSpecData.id).update({
                    design: designContent,
                    'status.design': 'ready',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Upload updated spec to OpenAI API for chat purposes (non-blocking)
                triggerOpenAIUploadForSpec(currentSpecData.id).catch(err => {
                    console.warn('Failed to upload spec to OpenAI after design retry:', err);
                });
            }
            
            // Update local data
            currentSpecData.design = designContent;
            currentSpecData.status.design = "ready";
            
            // Update export checkboxes when design section is ready
            updateExportCheckboxes();
            
            // Update localStorage backup
            localStorage.setItem(`specBackup_${currentSpecData.id}`, JSON.stringify(currentSpecData));
            
            // Update UI
            updateStatus('design', 'ready');
            updateTabLoadingState('design', false);
            displayDesign(designContent);
            if (retryDesignBtn) {
                retryDesignBtn.style.display = 'none';
            }
            
            // Refresh tabs menu to enable Prompts tab if conditions are met
            refreshTabsAfterDesignReady();
            
            showNotification('Design specification generated successfully!', 'success');

            return;
            
        } catch (error) {
            retryCount++;

            
            if (retryCount >= maxRetries) {
                // Final failure
                const retryDesignBtn = document.getElementById('retryDesignBtn');
                if (retryDesignBtn) {
                    retryDesignBtn.disabled = false;
                    retryDesignBtn.textContent = 'Retry';
                }
                updateTabLoadingState('design', false);
                
                showNotification(`Failed to generate design specification after ${maxRetries} attempts. ${error.message}`, 'error');
                updateStatus('design', 'error');

                return;
            } else {
                // Wait before next retry
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }
}

// ---------- Mockup Functions ----------
async function displayMockup(mockupData) {
    const container = document.getElementById('mockup-data');
    if (!container) return;
    
    // Check PRO access first - prevent unauthorized access
    const hasProAccess = await checkProAccess();
    if (!hasProAccess) {
        container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-lock"></i> Frontend Mockups</h3><p>Mockup feature is available for PRO users only. Please upgrade to PRO to access mockups.</p></div>';
        return;
    }
    
    let generateSection = document.getElementById('mockup-generate-section');
    let viewerSection = document.getElementById('mockup-viewer-section');
    
    // If sections don't exist (e.g., were removed by innerHTML), recreate them
    if (!generateSection || !viewerSection) {
        // Restore the container structure
        container.innerHTML = `
            <div id="mockup-generate-section" class="hidden">
                <div class="mockup-generate-content">
                    <i class="fa fa-desktop mockup-icon"></i>
                    <h3>Create Frontend Mockups</h3>
                    <p class="mockup-description">Generate interactive HTML+CSS mockups based on your specifications</p>
                    <div class="mockup-checkbox-container">
                        <label class="mockup-checkbox-label">
                            <input type="checkbox" id="useMockDataCheckbox" class="mockup-checkbox">
                            <span>Use mock data (fill with realistic sample data)</span>
                        </label>
                    </div>
                    <button id="generateMockupBtn" class="btn btn-primary mockup-generate-btn" onclick="generateMockupSpec()">
                        <i class="fa fa-magic"></i> Create Mockups
                    </button>
                </div>
            </div>
            <div id="mockup-viewer-section" class="hidden"></div>
        `;
        generateSection = document.getElementById('mockup-generate-section');
        viewerSection = document.getElementById('mockup-viewer-section');
    }
    
    if (!generateSection || !viewerSection) {
        // Failed to create mockup sections
        return;
    }
    
    if (!mockupData || !mockupData.mockups || mockupData.mockups.length === 0) {
        // Check if design is ready
        if (currentSpecData && currentSpecData.design && currentSpecData.status && currentSpecData.status.design === 'ready') {
            // Design is ready, show generate section
            generateSection.style.display = 'block';
            viewerSection.style.display = 'none';
        } else {
            // Design not ready, show locked message
            container.innerHTML = '<div class="locked-tab-message"><h3><i class="fa fa-lock"></i> Frontend Mockups</h3><p>Please approve the Overview and generate Design specification first to create mockups. <strong>Note: Mockup feature is available for PRO users only.</strong></p></div>';
        }
        return;
    }
    
    // Hide generate section, show viewer
    generateSection.style.display = 'none';
    viewerSection.style.display = 'block';
    
    const mockups = mockupData.mockups || [];
    let currentIndex = 0;
    
    // Build viewer HTML
    let partialWarningHTML = '';
    if (mockupData.meta && mockupData.meta.partial && mockupData.meta.total) {
        partialWarningHTML = `
            <div style="padding: 12px 20px; margin-bottom: 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; color: #856404; font-size: 14px;">
                <i class="fa fa-info-circle"></i> Generating in progress: ${mockupData.meta.completed} of ${mockupData.meta.total} screens completed
            </div>
        `;
    }
    
    let viewerHTML = `
        ${partialWarningHTML}
        <div class="mockup-viewer-container" style="display: flex; flex-direction: column; height: 100%;">
            <!-- Screens List -->
            <div class="mockup-screens-list" style="display: flex; gap: 10px; padding: 15px; background: #f5f5f5; border-bottom: 2px solid #ddd; overflow-x: auto; flex-wrap: wrap;">
    `;
    
    mockups.forEach((mockup, index) => {
        viewerHTML += `
            <button class="mockup-screen-btn ${index === 0 ? 'active' : ''}" 
                    onclick="switchMockupScreen(${index})" 
                    data-index="${index}"
                    style="padding: 10px 20px; border: 2px solid ${index === 0 ? '#FF6B35' : '#ddd'}; 
                           background: ${index === 0 ? '#FF6B35' : 'white'}; 
                           color: ${index === 0 ? 'white' : '#333'}; 
                           border-radius: 8px; cursor: pointer; 
                           font-size: 14px; font-weight: ${index === 0 ? '600' : '400'};
                           transition: all 0.3s ease; white-space: nowrap;">
                <i class="fa fa-${mockup.deviceType === 'mobile' ? 'mobile' : mockup.deviceType === 'web' ? 'desktop' : 'desktop'}"></i> ${mockup.name}
            </button>
        `;
    });
    
    viewerHTML += `
            </div>
            
            <!-- Controls Bar -->
            <div class="mockup-controls" style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: white; border-bottom: 1px solid #ddd;">
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button onclick="prevMockupScreen()" 
                            class="btn btn-secondary" 
                            style="padding: 8px 16px;">
                        <i class="fa fa-chevron-left"></i> Prev
                    </button>
                    <span style="font-weight: 600; color: #333;">
                        <span id="current-screen-index">1</span> / ${mockups.length}
                    </span>
                    <button onclick="nextMockupScreen()" 
                            class="btn btn-secondary" 
                            style="padding: 8px 16px;">
                        Next <i class="fa fa-chevron-right"></i>
                    </button>
                </div>
                
                <div style="display: flex; gap: 10px; align-items: center;">
                    <div class="device-selector" style="display: flex; gap: 5px; background: #f5f5f5; padding: 5px; border-radius: 6px;">
                        <button onclick="setMockupDevice('desktop')" 
                                class="device-btn active" 
                                data-device="desktop"
                                style="padding: 6px 12px; border: none; background: #FF6B35; color: white; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            <i class="fa fa-desktop"></i> Desktop
                        </button>
                        <button onclick="setMockupDevice('tablet')" 
                                class="device-btn" 
                                data-device="tablet"
                                style="padding: 6px 12px; border: none; background: transparent; color: #666; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            <i class="fa fa-tablet"></i> Tablet
                        </button>
                        <button onclick="setMockupDevice('mobile')" 
                                class="device-btn" 
                                data-device="mobile"
                                style="padding: 6px 12px; border: none; background: transparent; color: #666; border-radius: 4px; cursor: pointer; font-size: 12px;">
                            <i class="fa fa-mobile"></i> Mobile
                        </button>
                    </div>
                    <button onclick="viewMockupCode()" class="btn btn-secondary" style="padding: 8px 16px;">
                        <i class="fa fa-code"></i> View Code
                    </button>
                    <button onclick="downloadMockup()" class="btn btn-secondary" style="padding: 8px 16px;">
                        <i class="fa fa-download"></i> Download
                    </button>
                </div>
            </div>
            
            <!-- Preview Area -->
            <div class="mockup-preview-area" style="flex: 1; overflow: auto; padding: 20px; background: #f0f0f0; display: flex; justify-content: center; align-items: flex-start; min-height: 600px;">
                <div id="mockup-preview-container" style="background: white; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; transition: all 0.3s ease; width: 100%; max-width: 1920px;">
                    <iframe id="mockup-iframe" 
                            sandbox="allow-scripts" 
                            style="width: 100%; min-height: 600px; border: none; display: block;"></iframe>
                </div>
            </div>
        </div>
    `;
    
    viewerSection.innerHTML = viewerHTML;
    
    // Store mockups globally
    window.currentMockups = mockups;
    window.currentMockupIndex = 0;
    window.currentMockupDevice = 'desktop';
    
    // Load first mockup
    loadMockupScreen(0, 'desktop');
}

function switchMockupScreen(index) {
    window.currentMockupIndex = index;
    loadMockupScreen(index, window.currentMockupDevice);
    
    // Update active button
    document.querySelectorAll('.mockup-screen-btn').forEach((btn, i) => {
        if (i === index) {
            btn.classList.add('active');
            btn.style.background = '#FF6B35';
            btn.style.color = 'white';
            btn.style.borderColor = '#FF6B35';
            btn.style.fontWeight = '600';
        } else {
            btn.classList.remove('active');
            btn.style.background = 'white';
            btn.style.color = '#333';
            btn.style.borderColor = '#ddd';
            btn.style.fontWeight = '400';
        }
    });
    
    // Update index display
    const currentScreenIndex = document.getElementById('current-screen-index');
    if (currentScreenIndex) {
        currentScreenIndex.textContent = index + 1;
    }
}

function prevMockupScreen() {
    if (!window.currentMockups) return;
    const newIndex = window.currentMockupIndex > 0 ? window.currentMockupIndex - 1 : window.currentMockups.length - 1;
    switchMockupScreen(newIndex);
}

function nextMockupScreen() {
    if (!window.currentMockups) return;
    const newIndex = window.currentMockupIndex < window.currentMockups.length - 1 ? window.currentMockupIndex + 1 : 0;
    switchMockupScreen(newIndex);
}

function setMockupDevice(device) {
    window.currentMockupDevice = device;
    loadMockupScreen(window.currentMockupIndex, device);
    
    // Update active device button
    document.querySelectorAll('.device-btn').forEach(btn => {
        if (btn.dataset.device === device) {
            btn.classList.add('active');
            btn.style.background = '#FF6B35';
            btn.style.color = 'white';
        } else {
            btn.classList.remove('active');
            btn.style.background = 'transparent';
            btn.style.color = '#666';
        }
    });
    
    // Update container width
    const container = document.getElementById('mockup-preview-container');
    if (device === 'desktop') {
        container.style.width = '100%';
        container.style.maxWidth = '1920px';
    } else if (device === 'tablet') {
        container.style.width = '768px';
        container.style.maxWidth = '768px';
    } else {
        container.style.width = '375px';
        container.style.maxWidth = '375px';
    }
}

function loadMockupScreen(index, device) {
    if (!window.currentMockups || !window.currentMockups[index]) return;
    
    const mockup = window.currentMockups[index];
    const iframe = document.getElementById('mockup-iframe');
    
    if (!iframe) return;
    
    // Create blob URL from HTML
    const blob = new Blob([mockup.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    iframe.src = url;
    
    // Set container width based on device
    const container = document.getElementById('mockup-preview-container');
    if (!container) return;
    
    if (device === 'desktop') {
        container.style.width = '100%';
        container.style.maxWidth = '1920px';
    } else if (device === 'tablet') {
        container.style.width = '768px';
        container.style.maxWidth = '768px';
    } else {
        container.style.width = '375px';
        container.style.maxWidth = '375px';
    }
    
    // Update iframe height after load
    iframe.onload = function() {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const height = Math.max(iframeDoc.body.scrollHeight, iframeDoc.body.offsetHeight, 600);
            iframe.style.height = height + 'px';
        } catch (e) {
            // Cross-origin or other error, use default
            iframe.style.height = '600px';
        }
    };
}

function viewMockupCode() {
    if (!window.currentMockups || !window.currentMockups[window.currentMockupIndex]) return;
    
    const mockup = window.currentMockups[window.currentMockupIndex];
    const codeModal = document.getElementById('mockup-code-modal') || createCodeModal();
    
    const codeContent = document.getElementById('mockup-code-content');
    codeContent.textContent = mockup.html;
    
    codeModal.style.display = 'flex';
}

function createCodeModal() {
    const modal = document.createElement('div');
    modal.id = 'mockup-code-modal';
    modal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10000; align-items: center; justify-content: center;';
    
    modal.innerHTML = `
        <div style="background: white; width: 90%; max-width: 1200px; height: 90%; border-radius: 8px; display: flex; flex-direction: column;">
            <div style="padding: 20px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0;">Mockup Code - ${window.currentMockups[window.currentMockupIndex].name}</h3>
                <button onclick="closeMockupCodeModal()" style="background: #f0f0f0; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                    <i class="fa fa-times"></i> Close
                </button>
            </div>
            <pre id="mockup-code-content" style="flex: 1; overflow: auto; padding: 20px; margin: 0; background: #f5f5f5; font-family: 'Courier New', monospace; font-size: 12px; white-space: pre-wrap; word-wrap: break-word;"></pre>
            <div style="padding: 15px; border-top: 1px solid #ddd; display: flex; gap: 10px;">
                <button onclick="copyMockupCode()" class="btn btn-primary" style="padding: 8px 16px;">
                    <i class="fa fa-copy"></i> Copy Code
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    return modal;
}

function closeMockupCodeModal() {
    const modal = document.getElementById('mockup-code-modal');
    if (modal) modal.style.display = 'none';
}

function copyMockupCode() {
    const codeContent = document.getElementById('mockup-code-content');
    navigator.clipboard.writeText(codeContent.textContent).then(() => {
        showNotification('Code copied to clipboard!', 'success');
    }).catch(() => {
        showNotification('Failed to copy code', 'error');
    });
}

function downloadMockup() {
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
    
    showNotification('Mockup downloaded!', 'success');
}

// Batch Mockup Generation Manager
let mockupBatchManager = {
    isRunning: false,
    screens: [],
    mockups: [],
    failedScreens: [],
    currentIndex: 0,
    useMockData: false
};

async function generateMockupSpec() {
    // Check PRO access first
    const hasProAccess = await checkProAccess();
    if (!hasProAccess) {
        showNotification('Mockup feature is available for PRO users only. Please upgrade to PRO to generate mockups.', 'error');
        return;
    }
    
    if (!currentSpecData) {
        showNotification('No specification data available', 'error');
        return;
    }
    
    if (!currentSpecData.design || currentSpecData.status?.design !== 'ready') {
        showNotification('Please generate Design specification first', 'error');
        return;
    }
    
    // Prevent multiple simultaneous generations
    if (mockupBatchManager.isRunning) {
        showNotification('Mockup generation is already in progress', 'info');
        return;
    }
    
    const useMockData = document.getElementById('useMockDataCheckbox').checked;
    const generateBtn = document.getElementById('generateMockupBtn');
    
    // Initialize batch manager
    mockupBatchManager.isRunning = true;
    mockupBatchManager.screens = [];
    mockupBatchManager.mockups = [];
    mockupBatchManager.failedScreens = [];
    mockupBatchManager.currentIndex = 0;
    mockupBatchManager.useMockData = useMockData;
    
    // Disable button and show loading
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Analyzing Screens...';
    updateTabLoadingState('mockup', true);
    
    const container = document.getElementById('mockup-data');
    
    try {
        // Step 1: Analyze screens
        updateMockupProgress(0, 0, 'Analyzing screens...');
        
        const analyzeResponse = await fetch(MOCKUPS_ANALYZE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                overview: currentSpecData.overview,
                design: currentSpecData.design,
                technical: currentSpecData.technical || null
            })
        });
        
        if (!analyzeResponse.ok) {
            const errorData = await analyzeResponse.json();
            throw new Error(errorData.error?.message || 'Failed to analyze screens');
        }
        
        const analyzeData = await analyzeResponse.json();
        mockupBatchManager.screens = analyzeData.screens || [];
        
        if (mockupBatchManager.screens.length === 0) {
            throw new Error('No screens identified for mockup generation');
        }
        
        // Step 2: Generate mockups one by one
        generateBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Generating Mockups...';
        
        for (let i = 0; i < mockupBatchManager.screens.length; i++) {
            mockupBatchManager.currentIndex = i;
            const screen = mockupBatchManager.screens[i];
            
            updateMockupProgress(i + 1, mockupBatchManager.screens.length, `Generating: ${screen.name}...`);
            
            // Try to generate with retry logic
            const mockup = await generateSingleMockupWithRetry(screen, 3);
            
            if (mockup) {
                mockupBatchManager.mockups.push(mockup);
                // Update UI incrementally
                updateMockupProgress(i + 1, mockupBatchManager.screens.length, `Completed: ${screen.name}`);
                // Show partial results
                await displayMockup({
                    mockups: mockupBatchManager.mockups,
                    meta: {
                        partial: true,
                        total: mockupBatchManager.screens.length,
                        completed: mockupBatchManager.mockups.length
                    }
                });
            } else {
                mockupBatchManager.failedScreens.push(screen);
                // Failed to generate mockup for screen
            }
            
            // Small delay between requests to avoid rate limiting
            if (i < mockupBatchManager.screens.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        // Final update
        if (mockupBatchManager.mockups.length === 0) {
            throw new Error('Failed to generate any mockups');
        }
        
        const finalMockupData = {
            mockups: mockupBatchManager.mockups,
            meta: {
                version: '1.0',
                generatedAt: new Date().toISOString(),
                totalScreens: mockupBatchManager.mockups.length,
                failedScreens: mockupBatchManager.failedScreens.length,
                useMockData: useMockData
            }
        };
        
        // Update Firebase
        const user = firebase.auth().currentUser;
        if (user && currentSpecData) {
            await firebase.firestore().collection('specs').doc(currentSpecData.id).update({
                mockups: finalMockupData,
                'status.mockup': 'ready',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Upload updated spec to OpenAI API for chat purposes (non-blocking)
            triggerOpenAIUploadForSpec(currentSpecData.id).catch(err => {
                console.warn('Failed to upload spec to OpenAI after mockups generation:', err);
            });
        }
        
        // Update local data
        currentSpecData.mockups = finalMockupData;
        if (!currentSpecData.status) currentSpecData.status = {};
        currentSpecData.status.mockup = 'ready';
        
        // Update export checkboxes when mockups are ready
        updateExportCheckboxes();
        
        // Update localStorage backup
        localStorage.setItem(`specBackup_${currentSpecData.id}`, JSON.stringify(currentSpecData));
        
        // Update UI
        updateStatus('mockup', 'ready');
        updateTabLoadingState('mockup', false);
        await displayMockup(finalMockupData);
        
        // Mark tab as generated (only enable for PRO users)
        const mockupTab = document.getElementById('mockupTab');
        if (mockupTab) {
            mockupTab.classList.add('generated');
            checkProAccess().then(hasProAccess => {
                if (hasProAccess) {
                    mockupTab.disabled = false;
                }
            });
        }
        
        const successMsg = mockupBatchManager.failedScreens.length > 0
            ? `Generated ${mockupBatchManager.mockups.length} of ${mockupBatchManager.screens.length} mockups (${mockupBatchManager.failedScreens.length} failed)`
            : 'Mockups generated successfully!';
        showNotification(successMsg, mockupBatchManager.failedScreens.length > 0 ? 'warning' : 'success');
        
    } catch (error) {
        // Error generating mockups
        container.innerHTML = `
            <div class="locked-tab-message">
                <h3><i class="fa fa-exclamation-triangle"></i> Error Generating Mockups</h3>
                <p>${error.message}</p>
                ${mockupBatchManager.mockups.length > 0 ? `
                    <p style="margin-top: 15px; color: #666;">
                        Partial results: ${mockupBatchManager.mockups.length} mockups generated successfully.
                    </p>
                ` : ''}
                <button onclick="generateMockupSpec()" class="btn btn-primary" style="margin-top: 15px;">
                    <i class="fa fa-refresh"></i> Try Again
                </button>
            </div>
        `;
        updateTabLoadingState('mockup', false);
        showNotification(`Failed to generate mockups: ${error.message}`, 'error');
    } finally {
        mockupBatchManager.isRunning = false;
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fa fa-magic"></i> Create Mockups';
    }
}

// Generate single mockup with retry logic
async function generateSingleMockupWithRetry(screen, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(MOCKUPS_SINGLE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    overview: currentSpecData.overview,
                    design: currentSpecData.design,
                    technical: currentSpecData.technical || null,
                    screen: screen,
                    useMockData: mockupBatchManager.useMockData
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to generate mockup');
            }
            
            const data = await response.json();
            return data.mockup;
            
        } catch (error) {
            // Attempt failed for screen
            
            if (attempt === maxRetries) {
                // Last attempt failed
                return null;
            }
            
            // Wait before retry (exponential backoff)
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return null;
}

// Update progress UI
function updateMockupProgress(current, total, status) {
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

async function retryMockup() {
    const retryMockupBtn = document.getElementById('retryMockupBtn');
    if (retryMockupBtn) {
        retryMockupBtn.disabled = true;
        retryMockupBtn.textContent = '⏳ Retrying...';
    }

    updateTabLoadingState('mockup', true);

    try {
        await generateMockupSpec();
        if (retryMockupBtn) {
            retryMockupBtn.style.display = 'none';
        }
    } catch (error) {
        if (retryMockupBtn) {
            retryMockupBtn.disabled = false;
            retryMockupBtn.textContent = 'Retry';
        }
        showNotification(`Failed to generate mockups: ${error.message}`, 'error');
    } finally {
        updateTabLoadingState('mockup', false);
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
                
                const token = await user.getIdToken();
                
                // Call repair endpoint
                const response = await fetch(`${getApiBaseUrl()}/api/chat/diagrams/repair`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        specId: currentSpecData.id,
                        diagramId: diagram.id,
                        brokenCode: diagram.mermaidCode,
                        diagramType: diagram.type,
                        errorMessage: diagram._lastError || ''
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to repair diagram');
                }
                
                const result = await response.json();
                
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
                                const retryResponse = await fetch(`${getApiBaseUrl()}/api/chat/diagrams/repair`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify({
                                        specId: currentSpecData.id,
                                        diagramId: diagram.id,
                                        brokenCode: diagram.mermaidCode,
                                        diagramType: diagram.type,
                                        errorMessage: diagram._lastError
                                    })
                                });
                                
                                if (retryResponse.ok) {
                                    const retryResult = await retryResponse.json();
                                    
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
    if (isLoading) return;
    
    try {
        isLoading = true;
        const generateBtn = document.getElementById('generateDiagramsBtn');
        
        // Store original background color and styles
        const originalBgColor = window.getComputedStyle(generateBtn).backgroundColor;
        const originalClasses = generateBtn.className;
        
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="loading-spinner"></span> Generating Diagrams...';
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
        
        const token = await user.getIdToken();
        
        // Call new memory-based API endpoint - only send specId
        const response = await fetch(`${getApiBaseUrl()}/api/chat/diagrams/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                specId: currentSpecData.id
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate diagrams');
        }
        
        const result = await response.json();

        
        if (result.diagrams && Array.isArray(result.diagrams)) {
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
        isLoading = false;
    }
}

async function generatePrompts() {
    if (isLoading) return;
    
    try {
        isLoading = true;
        const generateBtn = document.getElementById('generatePromptsBtn');
        
        // Store original background color and styles
        const originalBgColor = window.getComputedStyle(generateBtn).backgroundColor;
        const originalClasses = generateBtn.className;
        
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="loading-spinner"></span> Generating Prompts...';
        generateBtn.style.cursor = 'wait';
        
        // Keep the original background color and prevent it from changing
        generateBtn.style.backgroundColor = originalBgColor || '';
        generateBtn.style.opacity = '1';
        
        // Update status to generating
        if (currentSpecData && currentSpecData.status) {
            currentSpecData.status.prompts = 'generating';
            updateNotificationDot('prompts', 'generating');
        }
        
        // Check if technical and design specs exist
        if (!currentSpecData.technical || currentSpecData.technical === 'error') {
            throw new Error('Technical specification must be generated first');
        }
        if (!currentSpecData.design || currentSpecData.design === 'error') {
            throw new Error('Design specification must be generated first');
        }
        
        // Parse overview, technical, and design content
        let overviewContent = currentSpecData.overview;
        let technicalContent = currentSpecData.technical;
        let designContent = currentSpecData.design;
        
        // If content is JSON string, parse it
        try {
            if (typeof overviewContent === 'string') {
                const parsedOverview = JSON.parse(overviewContent);
                overviewContent = JSON.stringify(parsedOverview, null, 2);
            }
        } catch (e) {
            // Keep as is if not JSON
        }
        
        try {
            if (typeof technicalContent === 'string') {
                const parsedTechnical = JSON.parse(technicalContent);
                technicalContent = JSON.stringify(parsedTechnical, null, 2);
            }
        } catch (e) {
            // Keep as is if not JSON
        }
        
        try {
            if (typeof designContent === 'string') {
                const parsedDesign = JSON.parse(designContent);
                designContent = JSON.stringify(parsedDesign, null, 2);
            }
        } catch (e) {
            // Keep as is if not JSON
        }
        
        // Build prompt using PROMPTS.prompts function
        const prompt = PROMPTS.prompts(overviewContent, technicalContent, designContent);
        
        const requestBody = {
            stage: 'prompts',
            locale: 'en-US',
            temperature: 0,
            prompt: {
                system: 'You are an expert software development prompt engineer. Create EXTREMELY DETAILED, PRACTICAL development prompts that guide developers to build complete applications perfectly on the first try. Focus on operational implementation details, not high-level concepts. You MUST include ALL details from the provided specifications - do not summarize, shorten, or omit any information.',
                developer: 'CRITICAL REQUIREMENTS - READ CAREFULLY:\n\n' +
                '1. MINIMUM LENGTH: The fullPrompt MUST be at least 25,000 characters (ideally 30,000-50,000+). This is NOT optional - if your response is shorter, you have FAILED the task.\n\n' +
                '2. ALL 10 STAGES REQUIRED: You MUST include ALL 10 development stages in this exact order:\n' +
                '   - STAGE 1: PROJECT SETUP & BASIC STRUCTURE\n' +
                '   - STAGE 2: FRONTEND CORE FUNCTIONALITY\n' +
                '   - STAGE 3: AUTHENTICATION & USER MANAGEMENT\n' +
                '   - STAGE 4: BACKEND API DEVELOPMENT\n' +
                '   - STAGE 5: AI INTEGRATION (if applicable)\n' +
                '   - STAGE 6: REAL-TIME COLLABORATION (if applicable)\n' +
                '   - STAGE 7: THIRD-PARTY INTEGRATIONS\n' +
                '   - STAGE 8: MOBILE APP DEVELOPMENT (if applicable)\n' +
                '   - STAGE 9: TESTING & QUALITY ASSURANCE\n' +
                '   - STAGE 10: DEPLOYMENT & DEVOPS\n\n' +
                '3. Each stage MUST have detailed sub-steps (1.1, 1.2, 2.1, 2.2, etc.) with specific implementation instructions.\n\n' +
                '4. INCLUDE ALL DETAILS FROM SPECIFICATIONS:\n' +
                '   - ALL features from overview.coreFeaturesOverview (list each one with full description)\n' +
                '   - ALL screens from overview.screenDescriptions.screens (describe each screen with purpose, key elements, user interactions)\n' +
                '   - ALL database entities from technical.databaseSchema.tables (list EVERY table with ALL fields, data types, constraints, relationships)\n' +
                '   - ALL API endpoints from technical.apiEndpoints (describe each with method, path, parameters, request body, response format)\n' +
                '   - ALL UI components from overview.screenDescriptions.uiComponents (describe purpose, placement, behavior)\n' +
                '   - ALL colors from design.visualStyleGuide.colors (list each color with hex code and usage)\n' +
                '   - ALL typography from design.visualStyleGuide.typography (font families, sizes, weights, line heights)\n' +
                '   - ALL spacing values and layout grid system\n' +
                '   - ALL third-party integrations with detailed setup instructions\n\n' +
                '5. REPLACE ALL PLACEHOLDERS: Replace [APPLICATION_NAME], [FRAMEWORK], [MAIN_FEATURE_1], [MAIN_ENTITY_1], etc. with ACTUAL values from the specifications.\n\n' +
                '6. OPERATIONAL DETAILS ONLY: Focus on WHAT TO BUILD and HOW TO BUILD IT with:\n' +
                '   - Exact function signatures with parameters\n' +
                '   - Specific component props and structure\n' +
                '   - Detailed API endpoint formats\n' +
                '   - Complete database schemas with relationships\n' +
                '   - Step-by-step implementation flows\n' +
                '   - Do NOT include abstract concepts or high-level descriptions\n\n' +
                '7. DO NOT SUMMARIZE: Include the COMPLETE ideaSummary, problemStatement, userJourneySummary, navigationStructure - do not shorten them.\n\n' +
                'The prompt must be so detailed that a developer can build the complete application from scratch on the first attempt without asking any questions.',
                user: prompt
            }
        };
        
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes timeout
        
        let response;
        try {
            response = await fetch('https://promtmaker.shalom-cohen-111.workers.dev/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
        } catch (fetchError) {
            clearTimeout(timeoutId);
            
            // Handle AbortError specifically
            if (fetchError.name === 'AbortError' || fetchError.message?.includes('aborted')) {
                throw new Error('Request timed out after 3 minutes. The prompts generation is taking longer than expected. Please try again.');
            }
            
            // Re-throw other fetch errors
            throw new Error(`Failed to connect to prompts API: ${fetchError.message}`);
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }
        
        const responseText = await response.text();
        const data = JSON.parse(responseText);
        
        if (!data.prompts) {
            throw new Error('Invalid response from prompts API');
        }
        
        const promptsData = {
            generated: true,
            fullPrompt: data.prompts.fullPrompt,
            thirdPartyIntegrations: data.prompts.thirdPartyIntegrations || [],
            generatedAt: new Date().toISOString()
        };
        
        // Save to Firebase
        if (currentSpecData && currentSpecData.id) {
            try {
                await firebase.firestore().collection('specs').doc(currentSpecData.id).update({
                    prompts: promptsData,
                    'status.prompts': 'ready',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Upload updated spec to OpenAI API for chat purposes (non-blocking)
                triggerOpenAIUploadForSpec(currentSpecData.id).catch(err => {
                    console.warn('Failed to upload spec to OpenAI after prompts generation:', err);
                });
                
                // Update local spec data
                currentSpecData.prompts = promptsData;
                currentSpecData.status = currentSpecData.status || {};
                currentSpecData.status.prompts = 'ready';
                // Update notification dot to show ready state
                updateNotificationDot('prompts', 'ready');
                // Update export checkboxes when prompts are ready
                updateExportCheckboxes();
            } catch (error) {
                // Failed to save prompts to Firebase
            }
        }
        
        // Display prompts
        displayPrompts(promptsData);
        
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
        }
        
        showNotification('Prompts generated successfully!', 'success');
        
    } catch (error) {
        // Error generating prompts
        // Provide user-friendly error message
        let errorMessage = error.message;
        
        // Handle specific error types
        if (error.name === 'AbortError' || error.message?.includes('aborted') || error.message?.includes('timed out')) {
            errorMessage = 'Request timed out. The prompts generation is taking longer than expected. Please try again.';
        } else if (error.message?.includes('Failed to connect')) {
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
        isLoading = false;
        const generateBtn = document.getElementById('generatePromptsBtn');
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = 'Generate Prompts';
            generateBtn.style.backgroundColor = '';
            generateBtn.style.cursor = 'pointer';
        }
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
    
    // Create third-party integrations section
    if (promptsData.thirdPartyIntegrations && Array.isArray(promptsData.thirdPartyIntegrations) && promptsData.thirdPartyIntegrations.length > 0) {
        const integrationsSection = document.createElement('div');
        integrationsSection.className = 'integrations-section';
        integrationsSection.innerHTML = '<h3><i class="fa fa-plug"></i> Third-Party Integration Instructions</h3>';
        
        const integrationsContainer = document.createElement('div');
        integrationsContainer.className = 'integrations-container';
        
        promptsData.thirdPartyIntegrations.forEach((integration, index) => {
            const integrationCard = document.createElement('div');
            integrationCard.className = 'integration-card';
            
            // Convert URLs in instructions to clickable links
            const instructionsWithLinks = integration.instructions.map(instruction => {
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
            
            integrationCard.innerHTML = `
                <div class="integration-header">
                    <h4><i class="fa fa-link"></i> ${escapeHtml(integration.service)}</h4>
                </div>
                <div class="integration-description">
                    <p>${escapeHtml(integration.description)}</p>
                </div>
                <div class="integration-instructions">
                    <h5>Setup Instructions:</h5>
                    <ol>
                        ${instructionsWithLinks.map(instruction => `<li>${instruction}</li>`).join('')}
                    </ol>
                </div>
            `;
            integrationsContainer.appendChild(integrationCard);
        });
        
        integrationsSection.appendChild(integrationsContainer);
        container.appendChild(integrationsSection);
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
            // Render the diagram using mermaid.render()
            const { svg } = await mermaid.render(uniqueId, diagramData.mermaidCode);
            
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
        mermaid.render(uniqueId, diagramData.mermaidCode)
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
    
    // Show modal - remove hidden class
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
        
        const token = await user.getIdToken();
        
        // Call Assistant API repair endpoint
        const response = await fetch(`${getApiBaseUrl()}/api/chat/diagrams/repair`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                specId: currentSpecData?.id,
                diagramId: diagramId,
                brokenCode: diagramData.mermaidCode,
                diagramType: diagramData.type,
                errorMessage: diagramData._lastError || ''
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to repair diagram');
        }
        
        const result = await response.json();
        
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
