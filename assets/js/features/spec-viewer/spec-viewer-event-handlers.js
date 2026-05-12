/**
 * Spec Viewer Event Handlers
 * Centralized event handling for spec-viewer.html
 * Replaces inline onclick/oninput handlers for better performance and maintainability
 */

(function() {
    'use strict';

    // Wait for DOM to be ready
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupEventHandlers);
        } else {
            setupEventHandlers();
        }
    }

    function setupEventHandlers() {
        // Search input handler
        const searchInput = document.getElementById('side-menu-search-input');
        if (searchInput && typeof filterMenuItems === 'function') {
            searchInput.addEventListener('input', function(e) {
                filterMenuItems(e.target.value);
            });
        }

        // Spec viewer top + bottom nav: single delegation path (querySelector('.side-menu-nav') only matched the first bar).
        function handleSpecNavClick(e) {
            const button = e.target.closest('.side-menu-button');
            if (!button) return;

            if (button.id === 'sideMenuMcpBtn' || button.getAttribute('data-nav-action') === 'mcp') {
                e.preventDefault();
                if (typeof window.openMcpModal === 'function') {
                    window.openMcpModal();
                }
                return;
            }

            if (button.disabled) return;

            const item = button.closest('.side-menu-item');
            const tabId = item && item.getAttribute('data-tab');
            if (!tabId) return;

            var st = typeof window.showTab === 'function' ? window.showTab : (typeof showTab === 'function' ? showTab : null);
            if (st) {
                e.preventDefault();
                st(tabId, { scrollToTop: true });
            }
        }

        ['specNavTop', 'specNavBottom'].forEach(function(navId) {
            var root = document.getElementById(navId);
            if (root) {
                root.addEventListener('click', handleSpecNavClick);
            }
        });

        // Content section buttons - use event delegation
        const contentArea = document.querySelector('.content-area');
        if (contentArea) {
            contentArea.addEventListener('click', function(e) {
                const button = e.target.closest('button');
                if (!button) return;

                // Retry buttons
                if (button.id === 'retryLoad' || (button.onclick && button.onclick.toString().includes('retryLoad'))) {
                    e.preventDefault();
                    if (typeof retryLoad === 'function') retryLoad();
                } else if (button.id === 'retryTechnicalBtn' || button.id === 'retryTechnical') {
                    e.preventDefault();
                    if (typeof retryTechnical === 'function') retryTechnical();
                } else if (button.id === 'retryMarketBtn') {
                    e.preventDefault();
                    if (typeof retryMarket === 'function') retryMarket();
                } else if (button.id === 'retryDesignBtn') {
                    e.preventDefault();
                    if (typeof retryDesign === 'function') retryDesign();
                } else if (button.id === 'retryMindMapBtn') {
                    e.preventDefault();
                    if (typeof retryMindMap === 'function') retryMindMap();
                } else if (button.id === 'retryMockupBtn') {
                    e.preventDefault();
                    if (typeof retryMockup === 'function') retryMockup();
                }
                // Generate buttons
                else if (button.id === 'generateMindMapBtn') {
                    e.preventDefault();
                    if (typeof generateMindMap === 'function') generateMindMap();
                } else if (button.id === 'generateDiagramsBtn') {
                    e.preventDefault();
                    if (typeof generateDiagrams === 'function') generateDiagrams();
                } else if (button.id === 'generatePromptsBtn') {
                    e.preventDefault();
                    if (typeof generatePrompts === 'function') generatePrompts();
                } else if (button.id === 'generateMockupBtn') {
                    e.preventDefault();
                    if (typeof generateMockupSpec === 'function') generateMockupSpec();
                }
                // Action buttons
                else if (button.id === 'editBtn') {
                    e.preventDefault();
                    if (typeof toggleEditMode === 'function') toggleEditMode();
                } else if (button.id === 'approveBtn') {
                    e.preventDefault();
                    if (typeof approveOverview === 'function') approveOverview();
                } else if (button.id === 'reset-chat-btn') {
                    e.preventDefault();
                    if (typeof resetChat === 'function') resetChat();
                } else if (button.id === 'generate-export-btn') {
                    e.preventDefault();
                    if (typeof generateExport === 'function') generateExport();
                } else if (button.id === 'generate-jira-btn') {
                    e.preventDefault();
                    if (typeof generateJiraExport === 'function') generateJiraExport();
                }
            });
        }

        // Export tabs
        const exportTabs = document.querySelectorAll('.export-inner-tab');
        exportTabs.forEach(tab => {
            tab.addEventListener('click', function(e) {
                e.preventDefault();
                const tabType = this.getAttribute('data-export-tab') || 
                               this.id.replace('export-', '').replace('-tab', '');
                if (tabType && typeof showExportTab === 'function') {
                    showExportTab(tabType);
                }
            });
        });

        // Fullscreen controls
        document.addEventListener('click', function(e) {
            const button = e.target.closest('.btn-icon');
            if (!button || !button.onclick) return;

            const onclickStr = button.onclick.toString();
            if (onclickStr.includes('zoomIn')) {
                e.preventDefault();
                if (typeof zoomIn === 'function') zoomIn();
            } else if (onclickStr.includes('zoomOut')) {
                e.preventDefault();
                if (typeof zoomOut === 'function') zoomOut();
            } else if (onclickStr.includes('resetZoom')) {
                e.preventDefault();
                if (typeof resetZoom === 'function') resetZoom();
            } else if (onclickStr.includes('closeFullscreen')) {
                e.preventDefault();
                if (typeof closeFullscreen === 'function') closeFullscreen();
            }
        });

        // Modal close buttons
        const modalCloseButtons = document.querySelectorAll('.close, [onclick*="closeRegistrationModal"]');
        modalCloseButtons.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                if (typeof closeRegistrationModal === 'function') {
                    closeRegistrationModal();
                }
            });
        });

        // Continue as guest buttons
        const guestButtons = document.querySelectorAll('[onclick*="continueAsGuest"]');
        guestButtons.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                if (typeof continueAsGuest === 'function') {
                    continueAsGuest();
                }
            });
        });
    }

    // Initialize
    init();
})();
