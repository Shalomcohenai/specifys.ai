/**
 * Advanced Analytics System for Specifys.ai
 * Comprehensive tracking system that integrates with Google Analytics 4
 * Tracks user interactions, performance metrics, and engagement data
 */

class AdvancedAnalytics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.pageStartTime = Date.now();
        this.lastActivity = Date.now();
        this.scrollDepth = 0;
        this.maxScrollDepth = 0;
        this.engagementScore = 0;
        this.interactionCount = 0;
        this.isIdle = false;
        this.idleTimeout = null;
        this.visibilityHidden = false;
        this.pageType = this.getPageType();
        this.userAgent = navigator.userAgent;
        this.screenResolution = `${screen.width}x${screen.height}`;
        this.viewportSize = `${window.innerWidth}x${window.innerHeight}`;
        this.referrer = document.referrer || 'direct';
        this.language = navigator.language;
        this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Performance tracking
        this.performanceMetrics = {};
        this.coreWebVitals = {};
        
        // Error tracking
        this.errorCount = 0;
        this.errors = [];
        
        // Form tracking
        this.formInteractions = new Map();
        this.formSubmissions = 0;
        
        // Modal tracking
        this.modalInteractions = new Map();
        this.modalOpens = 0;
        this.modalCloses = 0;
        
        // Tab tracking
        this.tabSwitches = 0;
        this.currentTab = null;
        
        // Button tracking
        this.buttonClicks = 0;
        this.buttonCategories = new Map();
        
        // Scroll tracking
        this.scrollMilestones = {
            25: false,
            50: false,
            75: false,
            90: false,
            100: false
        };
        
        // Initialize tracking
        this.init();
    }

    init() {
        console.log('🚀 Advanced Analytics initialized');
        
        // Setup all tracking
        this.setupEventListeners();
        this.trackPageLoad();
        this.setupVisibilityTracking();
        this.setupIdleTracking();
        this.setupScrollTracking();
        this.setupErrorTracking();
        this.setupPerformanceTracking();
        this.setupUnloadTracking();
        
        // Initialize specific tracking
        this.setupButtonTracking();
        this.setupFormTracking();
        this.setupModalTracking();
        this.setupTabTracking();
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    track(eventName, parameters = {}) {
        const enhancedParams = {
            ...parameters,
            session_id: this.sessionId,
            page_type: this.pageType,
            timestamp: new Date().toISOString(),
            user_agent: this.userAgent,
            screen_resolution: this.screenResolution,
            viewport_size: this.viewportSize,
            language: this.language,
            timezone: this.timezone,
            referrer: this.referrer,
            page_url: window.location.href,
            page_title: document.title,
            engagement_score: this.engagementScore,
            interaction_count: this.interactionCount,
            time_on_page: Date.now() - this.pageStartTime,
            scroll_depth: this.maxScrollDepth,
            is_idle: this.isIdle,
            visibility_hidden: this.visibilityHidden
        };

        // Send to Google Analytics
        if (this.isGtagAvailable()) {
            gtag('event', eventName, enhancedParams);
            console.log('📊 Analytics Event:', eventName, enhancedParams);
        } else {
            console.warn('⚠️ Google Analytics not available');
        }

        // Optional: Send to custom endpoint
        this.sendToCustomEndpoint(eventName, enhancedParams);
    }

    isGtagAvailable() {
        return typeof gtag !== 'undefined';
    }

    sendToCustomEndpoint(eventName, parameters) {
        // Optional: Send to your own analytics endpoint
        // This is useful for custom dashboards or additional analysis
        try {
            // Example: Send to custom endpoint
            // fetch('/api/analytics', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ event: eventName, data: parameters })
            // });
        } catch (error) {
            console.warn('Custom analytics endpoint error:', error);
        }
    }

    trackPageLoad() {
        const loadTime = Date.now() - this.pageStartTime;
        
        this.track('page_view', {
            page_path: window.location.pathname,
            page_title: document.title,
            load_time: loadTime,
            referrer: this.referrer,
            page_type: this.pageType
        });

        // Track performance metrics after page load
        setTimeout(() => {
            this.trackPerformanceMetrics();
        }, 2000);
    }

    getPageType() {
        const path = window.location.pathname;
        if (path.includes('/app-dashboard')) return 'dashboard';
        if (path.includes('/profile')) return 'profile';
        if (path.includes('/spec')) return 'specification';
        if (path.includes('/research')) return 'research';
        if (path.includes('/auth')) return 'authentication';
        if (path === '/' || path === '/index.html') return 'homepage';
        return 'other';
    }

    setupButtonTracking() {
        document.addEventListener('click', (event) => {
            const button = event.target.closest('button, .btn, [role="button"], .tab-button, .plus-button, .action-btn');
            if (button) {
                this.trackButtonClick(button, event);
            }
        });
    }

    extractButtonData(element) {
        return {
            id: element.id || null,
            text: this.getButtonText(element),
            type: this.getButtonType(element),
            location: this.getButtonLocation(element),
            category: this.getButtonCategory(element),
            position: this.getElementPosition(element),
            classes: element.className,
            attributes: this.getElementAttributes(element)
        };
    }

    getButtonText(element) {
        // Try different methods to get button text
        if (element.textContent) return element.textContent.trim();
        if (element.title) return element.title;
        if (element.ariaLabel) return element.ariaLabel;
        if (element.getAttribute('data-label')) return element.getAttribute('data-label');
        return 'Unknown Button';
    }

    getButtonType(element) {
        if (element.classList.contains('tab-button')) return 'tab';
        if (element.classList.contains('plus-button')) return 'add';
        if (element.classList.contains('modal-close')) return 'close';
        if (element.classList.contains('btn-primary')) return 'primary';
        if (element.classList.contains('btn-secondary')) return 'secondary';
        if (element.classList.contains('auth-btn')) return 'auth';
        return 'button';
    }

    getButtonLocation(element) {
        const header = element.closest('header');
        const modal = element.closest('.modal');
        const tab = element.closest('.tab-header');
        const footer = element.closest('footer');
        
        if (header) return 'header';
        if (modal) return 'modal';
        if (tab) return 'tab';
        if (footer) return 'footer';
        return 'content';
    }

    getButtonCategory(element) {
        if (element.onclick && element.onclick.toString().includes('switchUnifiedTab')) return 'navigation';
        if (element.onclick && element.onclick.toString().includes('openTaskModal')) return 'task_management';
        if (element.onclick && element.onclick.toString().includes('submit')) return 'form_submission';
        if (element.onclick && element.onclick.toString().includes('delete')) return 'deletion';
        if (element.onclick && element.onclick.toString().includes('toggle')) return 'toggle';
        return 'interaction';
    }

    getElementPosition(element) {
        const rect = element.getBoundingClientRect();
        return {
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
            viewport_x: Math.round((rect.left + rect.width / 2) / window.innerWidth * 100),
            viewport_y: Math.round((rect.top + rect.height / 2) / window.innerHeight * 100)
        };
    }

    getElementAttributes(element) {
        const attrs = {};
        for (let attr of element.attributes) {
            if (attr.name.startsWith('data-') || attr.name === 'title' || attr.name === 'aria-label') {
                attrs[attr.name] = attr.value;
            }
        }
        return attrs;
    }

    trackButtonClick(buttonData, event) {
        this.buttonClicks++;
        this.interactionCount++;
        this.updateLastActivity();

        // Update button category count
        const category = buttonData.category;
        this.buttonCategories.set(category, (this.buttonCategories.get(category) || 0) + 1);

        this.track('button_click', {
            button_id: buttonData.id,
            button_text: buttonData.text,
            button_type: buttonData.type,
            button_location: buttonData.location,
            button_category: buttonData.category,
            click_position: buttonData.position,
            click_x: event.clientX,
            click_y: event.clientY,
            click_timestamp: Date.now(),
            modifier_keys: {
                ctrl: event.ctrlKey,
                shift: event.shiftKey,
                alt: event.altKey,
                meta: event.metaKey
            },
            button_classes: buttonData.classes,
            button_attributes: buttonData.attributes
        });
    }

    setupFormTracking() {
        // Track form submissions
        document.addEventListener('submit', (event) => {
            this.trackFormSubmit(event);
        });

        // Track form field interactions
        document.addEventListener('input', (event) => {
            if (event.target.matches('input, textarea, select')) {
                this.trackFormInput(event);
            }
        });

        // Track form field changes
        document.addEventListener('change', (event) => {
            if (event.target.matches('input, textarea, select')) {
                this.trackFormChange(event);
            }
        });
    }

    trackFormSubmit(event) {
        const form = event.target;
        const formData = this.extractFormData(form);
        
        this.formSubmissions++;
        this.interactionCount++;
        this.updateLastActivity();

        this.track('form_submission', {
            form_id: form.id || 'unknown',
            form_class: form.className,
            form_action: form.action || 'none',
            form_method: form.method || 'get',
            field_count: formData.fields.length,
            field_types: formData.fieldTypes,
            validation_errors: this.getFormValidationErrors(form),
            submission_time: Date.now(),
            form_data: formData
        });
    }

    trackFormInput(event) {
        const field = event.target;
        const form = field.closest('form');
        
        if (!form) return;

        const formId = form.id || 'unknown';
        const fieldData = {
            field_id: field.id || 'unknown',
            field_name: field.name || 'unknown',
            field_type: field.type || 'text',
            field_value: field.value,
            field_required: field.required,
            form_id: formId
        };

        // Store field interaction
        if (!this.formInteractions.has(formId)) {
            this.formInteractions.set(formId, new Map());
        }
        this.formInteractions.get(formId).set(field.id || field.name, fieldData);

        this.track('form_input', fieldData);
    }

    trackFormChange(event) {
        const field = event.target;
        const form = field.closest('form');
        
        if (!form) return;

        this.track('form_change', {
            field_id: field.id || 'unknown',
            field_name: field.name || 'unknown',
            field_type: field.type || 'text',
            field_value: field.value,
            form_id: form.id || 'unknown',
            change_timestamp: Date.now()
        });
    }

    extractFormData(form) {
        const fields = Array.from(form.elements).filter(el => 
            el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
        );
        
        return {
            fields: fields.map(field => ({
                id: field.id,
                name: field.name,
                type: field.type,
                value: field.value,
                required: field.required
            })),
            fieldTypes: [...new Set(fields.map(field => field.type))]
        };
    }

    getFormValidationErrors(form) {
        const errors = [];
        const fields = Array.from(form.elements);
        
        fields.forEach(field => {
            if (!field.checkValidity()) {
                errors.push({
                    field_id: field.id,
                    field_name: field.name,
                    error_message: field.validationMessage,
                    error_type: field.validity
                });
            }
        });
        
        return errors;
    }

    setupModalTracking() {
        // Track modal opens and closes
        document.addEventListener('click', (event) => {
            if (event.target.matches('.modal-close, [onclick*="closeModal"]')) {
                this.trackModalInteraction(event.target, 'close');
            } else if (event.target.matches('[onclick*="openTaskModal"], [onclick*="openNoteModal"], [onclick*="openExpenseModal"]')) {
                this.trackModalInteraction(event.target, 'open');
            }
        });

        // Track modal content clicks
        document.addEventListener('click', (event) => {
            const modal = event.target.closest('.modal-overlay, .modal-content');
            if (modal) {
                this.trackModalContentClick(modal, event);
            }
        });
    }

    trackModalInteraction(element, action) {
        const modalType = this.getModalType(element);
        
        if (action === 'open') {
            this.modalOpens++;
        } else if (action === 'close') {
            this.modalCloses++;
        }
        
        this.interactionCount++;
        this.updateLastActivity();

        this.track('modal_interaction', {
            modal_type: modalType,
            action: action,
            element_id: element.id || 'unknown',
            element_text: element.textContent?.trim() || 'unknown',
            interaction_timestamp: Date.now()
        });
    }

    getModalType(element) {
        if (element.onclick && element.onclick.toString().includes('openTaskModal')) return 'task_creation';
        if (element.onclick && element.onclick.toString().includes('openNoteModal')) return 'note_creation';
        if (element.onclick && element.onclick.toString().includes('openExpenseModal')) return 'expense_creation';
        if (element.onclick && element.onclick.toString().includes('closeModal')) return 'modal_close';
        return 'unknown';
    }

    trackModalContentClick(modal, event) {
        this.track('modal_content_click', {
            modal_class: modal.className,
            click_element: event.target.tagName,
            click_text: event.target.textContent?.trim() || '',
            click_position: {
                x: event.clientX,
                y: event.clientY
            }
        });
    }

    setupTabTracking() {
        document.addEventListener('click', (event) => {
            if (event.target.matches('.tab-button, [onclick*="switchUnifiedTab"]')) {
                this.trackTabSwitch(event.target, event);
            }
        });
    }

    trackTabSwitch(element, event) {
        const tabName = element.getAttribute('data-tab') || 
                       element.onclick?.toString().match(/switchUnifiedTab\('([^']+)'\)/)?.[1] || 
                       'unknown';
        
        this.tabSwitches++;
        this.interactionCount++;
        this.updateLastActivity();

        this.track('tab_switch', {
            tab_name: tabName,
            previous_tab: this.currentTab,
            current_tab: tabName,
            switch_timestamp: Date.now(),
            element_id: element.id || 'unknown',
            element_text: element.textContent?.trim() || 'unknown'
        });

        this.currentTab = tabName;
    }

    setupScrollTracking() {
        let scrollTimeout;
        
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.updateScrollDepth();
            }, 100);
        });
    }

    updateScrollDepth() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = Math.round((scrollTop / documentHeight) * 100);
        
        this.scrollDepth = scrollPercent;
        this.maxScrollDepth = Math.max(this.maxScrollDepth, scrollPercent);

        // Track scroll milestones
        Object.keys(this.scrollMilestones).forEach(milestone => {
            const milestoneNum = parseInt(milestone);
            if (scrollPercent >= milestoneNum && !this.scrollMilestones[milestone]) {
                this.scrollMilestones[milestone] = true;
                this.track('scroll_depth', {
                    scroll_percentage: milestoneNum,
                    scroll_position: scrollTop,
                    document_height: documentHeight,
                    viewport_height: window.innerHeight
                });
            }
        });
    }

    setupIdleTracking() {
        const idleTimeout = 30000; // 30 seconds
        
        const resetIdleTimer = () => {
            clearTimeout(this.idleTimeout);
            this.idleTimeout = setTimeout(() => {
                this.isIdle = true;
                this.track('user_idle', {
                    idle_duration: Date.now() - this.lastActivity,
                    total_session_time: Date.now() - this.pageStartTime
                });
            }, idleTimeout);
        };

        // Reset idle timer on user activity
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, () => {
                if (this.isIdle) {
                    this.isIdle = false;
                    this.track('user_active', {
                        idle_duration: Date.now() - this.lastActivity,
                        total_session_time: Date.now() - this.pageStartTime
                    });
                }
                this.updateLastActivity();
                resetIdleTimer();
            });
        });

        resetIdleTimer();
    }

    updateLastActivity() {
        this.lastActivity = Date.now();
        this.engagementScore = this.calculateEngagementScore();
    }

    setupVisibilityTracking() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.visibilityHidden = true;
                this.track('page_hidden', {
                    time_on_page: Date.now() - this.pageStartTime,
                    engagement_score: this.engagementScore
                });
            } else {
                this.visibilityHidden = false;
                this.track('page_visible', {
                    time_on_page: Date.now() - this.pageStartTime,
                    engagement_score: this.engagementScore
                });
            }
        });

        window.addEventListener('focus', () => {
            this.track('window_focus', {
                time_on_page: Date.now() - this.pageStartTime
            });
        });

        window.addEventListener('blur', () => {
            this.track('window_blur', {
                time_on_page: Date.now() - this.pageStartTime
            });
        });
    }

    setupErrorTracking() {
        window.addEventListener('error', (event) => {
            this.errorCount++;
            this.errors.push({
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
                timestamp: Date.now()
            });

            this.track('javascript_error', {
                error_message: event.message,
                error_filename: event.filename,
                error_line: event.lineno,
                error_column: event.colno,
                error_stack: event.error?.stack || 'No stack trace',
                error_count: this.errorCount,
                page_url: window.location.href
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.errorCount++;
            this.track('unhandled_promise_rejection', {
                error_reason: event.reason,
                error_count: this.errorCount,
                page_url: window.location.href
            });
        });
    }

    setupPerformanceTracking() {
        // Wait for page to load completely
        window.addEventListener('load', () => {
            setTimeout(() => {
                this.trackPerformanceMetrics();
            }, 1000);
        });
    }

    trackPerformanceMetrics() {
        const navigation = performance.getEntriesByType('navigation')[0];
        const paint = performance.getEntriesByType('paint');
        
        const metrics = {
            // Core Web Vitals
            dom_content_loaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            load_complete: navigation.loadEventEnd - navigation.loadEventStart,
            first_contentful_paint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
            largest_contentful_paint: this.getLargestContentfulPaint(),
            time_to_interactive: this.getTimeToInteractive(),
            
            // Additional metrics
            memory_usage: this.getMemoryUsage(),
            connection_type: this.getConnectionType(),
            page_size: this.getPageSize(),
            resource_count: performance.getEntriesByType('resource').length
        };

        this.performanceMetrics = metrics;

        this.track('performance_metrics', metrics);
    }

    getLargestContentfulPaint() {
        // This would need to be implemented with the LCP API
        return 0;
    }

    getTimeToInteractive() {
        // Simplified TTI calculation
        const navigation = performance.getEntriesByType('navigation')[0];
        return navigation.loadEventEnd - navigation.navigationStart;
    }

    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }

    getConnectionType() {
        if (navigator.connection) {
            return {
                effective_type: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            };
        }
        return null;
    }

    getPageSize() {
        // Estimate page size based on DOM elements
        return {
            dom_elements: document.querySelectorAll('*').length,
            text_content_length: document.body.textContent.length,
            html_length: document.documentElement.outerHTML.length
        };
    }

    setupUnloadTracking() {
        window.addEventListener('beforeunload', () => {
            this.track('page_unload', {
                session_duration: Date.now() - this.pageStartTime,
                engagement_score: this.engagementScore,
                interaction_count: this.interactionCount,
                button_clicks: this.buttonClicks,
                form_submissions: this.formSubmissions,
                modal_interactions: this.modalOpens + this.modalCloses,
                tab_switches: this.tabSwitches,
                max_scroll_depth: this.maxScrollDepth,
                error_count: this.errorCount,
                time_idle: this.isIdle ? Date.now() - this.lastActivity : 0
            });
        });
    }

    calculateEngagementScore() {
        let score = 0;
        
        // Base score for page visit
        score += 10;
        
        // Interaction scoring
        score += this.interactionCount * 2;
        score += this.buttonClicks * 3;
        score += this.formSubmissions * 5;
        score += this.tabSwitches * 2;
        
        // Scroll engagement
        score += Math.round(this.maxScrollDepth / 10);
        
        // Time on page (in minutes)
        const timeOnPage = (Date.now() - this.pageStartTime) / 60000;
        score += Math.round(timeOnPage * 2);
        
        // Penalty for errors
        score -= this.errorCount * 2;
        
        return Math.max(0, Math.min(100, score));
    }

    setupEventListeners() {
        // Keyboard tracking
        document.addEventListener('keydown', (event) => {
            this.track('keyboard_interaction', {
                key: event.key,
                code: event.code,
                modifier_keys: {
                    ctrl: event.ctrlKey,
                    shift: event.shiftKey,
                    alt: event.altKey,
                    meta: event.metaKey
                }
            });
        });

        // Mouse movement tracking (throttled)
        let mouseMoveTimeout;
        document.addEventListener('mousemove', () => {
            clearTimeout(mouseMoveTimeout);
            mouseMoveTimeout = setTimeout(() => {
                this.track('mouse_movement', {
                    timestamp: Date.now(),
                    time_on_page: Date.now() - this.pageStartTime
                });
            }, 1000);
        });
    }

    // Public methods for custom tracking
    trackCustomEvent(eventName, parameters = {}) {
        this.track(eventName, parameters);
    }

    trackUserAction(action, details = {}) {
        this.track('user_action', {
            action: action,
            details: details,
            timestamp: Date.now()
        });
    }

    trackFeatureUsage(feature, action, details = {}) {
        this.track('feature_usage', {
            feature: feature,
            action: action,
            details: details,
            timestamp: Date.now()
        });
    }

    trackApiCall(endpoint, method, status, duration, details = {}) {
        this.track('api_call', {
            endpoint: endpoint,
            method: method,
            status: status,
            duration: duration,
            details: details,
            timestamp: Date.now()
        });
    }

    getSessionData() {
        return {
            sessionId: this.sessionId,
            pageStartTime: this.pageStartTime,
            lastActivity: this.lastActivity,
            engagementScore: this.engagementScore,
            interactionCount: this.interactionCount,
            buttonClicks: this.buttonClicks,
            formSubmissions: this.formSubmissions,
            modalOpens: this.modalOpens,
            modalCloses: this.modalCloses,
            tabSwitches: this.tabSwitches,
            maxScrollDepth: this.maxScrollDepth,
            errorCount: this.errorCount,
            isIdle: this.isIdle,
            visibilityHidden: this.visibilityHidden
        };
    }
}

// Initialize analytics when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.advancedAnalytics = new AdvancedAnalytics();
    console.log('✅ Advanced Analytics loaded and ready');
});

// Global helper functions for easy access
window.trackEvent = function(eventName, parameters) {
    if (window.advancedAnalytics) {
        window.advancedAnalytics.trackCustomEvent(eventName, parameters);
    }
};

window.trackUserAction = function(action, details) {
    if (window.advancedAnalytics) {
        window.advancedAnalytics.trackUserAction(action, details);
    }
};

window.trackFeatureUsage = function(feature, action, details) {
    if (window.advancedAnalytics) {
        window.advancedAnalytics.trackFeatureUsage(feature, action, details);
    }
};

window.trackApiCall = function(endpoint, method, status, duration, details) {
    if (window.advancedAnalytics) {
        window.advancedAnalytics.trackApiCall(endpoint, method, status, duration, details);
    }
};