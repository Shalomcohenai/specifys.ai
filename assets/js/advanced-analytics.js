/**
 * Advanced Analytics System for Specifys.ai
 * High-resolution tracking for user interactions, time spent, and detailed behavior analysis
 * Integrates with existing Google Analytics 4 setup
 */

class AdvancedAnalytics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.pageStartTime = Date.now();
        this.interactionCount = 0;
        this.scrollDepth = 0;
        this.maxScrollDepth = 0;
        this.isPageVisible = true;
        this.lastActivityTime = Date.now();
        this.idleTimer = null;
        this.engagementThreshold = 30000; // 30 seconds
        this.scrollThresholds = [25, 50, 75, 90, 100];
        this.scrollTracked = {};
        this.buttonClicks = new Map();
        this.formInteractions = new Map();
        this.modalInteractions = new Map();
        this.tabSwitches = new Map();
        this.apiCalls = new Map();
        this.errorCount = 0;
        this.performanceMetrics = {};
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.trackPageLoad();
        this.setupVisibilityTracking();
        this.setupScrollTracking();
        this.setupButtonTracking();
        this.setupFormTracking();
        this.setupModalTracking();
        this.setupTabTracking();
        this.setupErrorTracking();
        this.setupPerformanceTracking();
        this.setupIdleTracking();
        this.setupUnloadTracking();
        
        console.log('🚀 Advanced Analytics initialized');
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Core tracking functions
    track(eventName, parameters = {}) {
        if (!this.isGtagAvailable()) {
            console.warn('Google Analytics not available');
            return;
        }

        const enhancedParams = {
            ...parameters,
            session_id: this.sessionId,
            page_url: window.location.href,
            page_title: document.title,
            timestamp: Date.now(),
            user_agent: navigator.userAgent,
            screen_resolution: `${screen.width}x${screen.height}`,
            viewport_size: `${window.innerWidth}x${window.innerHeight}`,
            interaction_count: this.interactionCount++,
            scroll_depth: this.scrollDepth,
            time_on_page: Date.now() - this.pageStartTime,
            is_mobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        };

        gtag('event', eventName, enhancedParams);
        
        // Also send to custom analytics endpoint if available
        this.sendToCustomEndpoint(eventName, enhancedParams);
    }

    isGtagAvailable() {
        return typeof gtag !== 'undefined';
    }

    sendToCustomEndpoint(eventName, parameters) {
        // Optional: Send to custom analytics endpoint
        if (window.ANALYTICS_ENDPOINT) {
            fetch(window.ANALYTICS_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    event: eventName,
                    parameters: parameters,
                    timestamp: new Date().toISOString()
                })
            }).catch(error => console.warn('Analytics endpoint error:', error));
        }
    }

    // Page load and navigation tracking
    trackPageLoad() {
        const loadTime = Date.now() - this.pageStartTime;
        this.performanceMetrics.pageLoadTime = loadTime;
        
        this.track('page_view', {
            page_path: window.location.pathname,
            page_title: document.title,
            page_location: window.location.href,
            load_time: loadTime,
            referrer: document.referrer,
            page_type: this.getPageType(),
            user_engagement: this.calculateEngagementScore()
        });

        // Track page performance
        this.trackPerformanceMetrics();
    }

    getPageType() {
        const path = window.location.pathname;
        if (path.includes('/dashboard')) return 'dashboard';
        if (path.includes('/spec')) return 'specification';
        if (path.includes('/research')) return 'research';
        if (path.includes('/profile')) return 'profile';
        if (path.includes('/auth')) return 'authentication';
        if (path === '/' || path === '/index.html') return 'homepage';
        return 'other';
    }

    // Enhanced button click tracking
    setupButtonTracking() {
        document.addEventListener('click', (event) => {
            const element = event.target;
            const buttonData = this.extractButtonData(element);
            
            if (buttonData) {
                this.trackButtonClick(buttonData, event);
            }
        });
    }

    extractButtonData(element) {
        // Find the closest clickable element
        const clickableElement = element.closest('button, a, [onclick], [role="button"], .btn, .tab-button, .plus-button, .action-btn');
        
        if (!clickableElement) return null;

        const buttonId = clickableElement.id || 
                        clickableElement.getAttribute('data-id') || 
                        clickableElement.className.split(' ')[0] ||
                        'unknown';
        
        const buttonText = this.getButtonText(clickableElement);
        const buttonType = this.getButtonType(clickableElement);
        const buttonLocation = this.getButtonLocation(clickableElement);
        const buttonCategory = this.getButtonCategory(clickableElement);

        return {
            id: buttonId,
            text: buttonText,
            type: buttonType,
            location: buttonLocation,
            category: buttonCategory,
            element: clickableElement,
            position: this.getElementPosition(clickableElement)
        };
    }

    getButtonText(element) {
        return element.textContent?.trim() || 
               element.getAttribute('aria-label') || 
               element.getAttribute('title') || 
               element.alt || 
               'No text';
    }

    getButtonType(element) {
        if (element.tagName === 'BUTTON') return 'button';
        if (element.tagName === 'A') return 'link';
        if (element.onclick) return 'onclick';
        if (element.getAttribute('role') === 'button') return 'role-button';
        return 'other';
    }

    getButtonLocation(element) {
        const container = element.closest('.header, .footer, .modal, .sidebar, .main-content, .tab-content, .dashboard-section');
        return container ? container.className.split(' ')[0] : 'unknown';
    }

    getButtonCategory(element) {
        if (element.classList.contains('tab-button')) return 'navigation';
        if (element.classList.contains('plus-button')) return 'action';
        if (element.classList.contains('auth-btn')) return 'authentication';
        if (element.classList.contains('modal-close')) return 'modal';
        if (element.onclick && element.onclick.toString().includes('delete')) return 'destructive';
        if (element.onclick && element.onclick.toString().includes('submit')) return 'form';
        return 'general';
    }

    getElementPosition(element) {
        const rect = element.getBoundingClientRect();
        return {
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
            visible: rect.top >= 0 && rect.left >= 0 && 
                    rect.bottom <= window.innerHeight && 
                    rect.right <= window.innerWidth
        };
    }

    trackButtonClick(buttonData, event) {
        const clickData = {
            button_id: buttonData.id,
            button_text: buttonData.text,
            button_type: buttonData.type,
            button_location: buttonData.location,
            button_category: buttonData.category,
            click_position: buttonData.position,
            click_timestamp: Date.now(),
            time_since_page_load: Date.now() - this.pageStartTime,
            mouse_x: event.clientX,
            mouse_y: event.clientY,
            ctrl_key: event.ctrlKey,
            shift_key: event.shiftKey,
            alt_key: event.altKey,
            meta_key: event.metaKey
        };

        // Track in local map for analytics
        this.buttonClicks.set(buttonData.id, {
            count: (this.buttonClicks.get(buttonData.id)?.count || 0) + 1,
            lastClick: Date.now(),
            data: clickData
        });

        this.track('button_click', clickData);
        this.updateLastActivity();
    }

    // Enhanced form tracking
    setupFormTracking() {
        document.addEventListener('submit', (event) => {
            this.trackFormSubmit(event);
        });

        document.addEventListener('input', (event) => {
            this.trackFormInput(event);
        });

        document.addEventListener('change', (event) => {
            this.trackFormChange(event);
        });
    }

    trackFormSubmit(event) {
        const form = event.target;
        const formData = this.extractFormData(form);
        
        this.track('form_submit', {
            form_id: form.id || 'unknown',
            form_name: form.name || 'unknown',
            form_action: form.action || 'unknown',
            form_method: form.method || 'get',
            field_count: formData.fields.length,
            required_fields: formData.requiredFields,
            optional_fields: formData.optionalFields,
            validation_errors: formData.validationErrors,
            time_to_complete: Date.now() - (this.formInteractions.get(form.id)?.startTime || this.pageStartTime)
        });
    }

    trackFormInput(event) {
        const input = event.target;
        if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA' || input.tagName === 'SELECT') {
            const formId = input.closest('form')?.id || 'unknown';
            
            if (!this.formInteractions.has(formId)) {
                this.formInteractions.set(formId, {
                    startTime: Date.now(),
                    fieldInteractions: new Map()
                });
            }

            const fieldId = input.id || input.name || 'unknown';
            const fieldData = this.formInteractions.get(formId).fieldInteractions.get(fieldId) || {
                interactionCount: 0,
                firstInteraction: Date.now(),
                lastInteraction: Date.now()
            };

            fieldData.interactionCount++;
            fieldData.lastInteraction = Date.now();
            this.formInteractions.get(formId).fieldInteractions.set(fieldId, fieldData);

            this.track('form_input', {
                form_id: formId,
                field_id: fieldId,
                field_type: input.type || input.tagName.toLowerCase(),
                field_name: input.name || 'unknown',
                field_required: input.required,
                input_length: input.value?.length || 0,
                interaction_count: fieldData.interactionCount
            });
        }
    }

    trackFormChange(event) {
        const input = event.target;
        if (input.tagName === 'SELECT' || input.type === 'checkbox' || input.type === 'radio') {
            const formId = input.closest('form')?.id || 'unknown';
            
            this.track('form_change', {
                form_id: formId,
                field_id: input.id || input.name || 'unknown',
                field_type: input.type || input.tagName.toLowerCase(),
                old_value: input.getAttribute('data-old-value') || '',
                new_value: input.value,
                change_timestamp: Date.now()
            });

            input.setAttribute('data-old-value', input.value);
        }
    }

    extractFormData(form) {
        const fields = Array.from(form.elements).filter(el => 
            el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT'
        );

        return {
            fields: fields.map(field => ({
                id: field.id,
                name: field.name,
                type: field.type || field.tagName.toLowerCase(),
                required: field.required,
                value: field.value
            })),
            requiredFields: fields.filter(field => field.required).length,
            optionalFields: fields.filter(field => !field.required).length,
            validationErrors: this.getFormValidationErrors(form)
        };
    }

    getFormValidationErrors(form) {
        const errors = [];
        const elements = form.elements;
        
        for (let element of elements) {
            if (!element.validity.valid) {
                errors.push({
                    field: element.name || element.id,
                    error: element.validationMessage,
                    validity: element.validity
                });
            }
        }
        
        return errors;
    }

    // Enhanced modal tracking
    setupModalTracking() {
        // Track modal opens
        document.addEventListener('click', (event) => {
            const element = event.target;
            if (element.classList.contains('modal-close') || 
                element.onclick?.toString().includes('closeModal') ||
                element.onclick?.toString().includes('openModal')) {
                this.trackModalInteraction(element, event);
            }
        });

        // Track modal content interactions
        document.addEventListener('click', (event) => {
            const modal = event.target.closest('.modal-content, .modal-overlay');
            if (modal) {
                this.trackModalContentClick(modal, event);
            }
        });
    }

    trackModalInteraction(element, event) {
        const modal = element.closest('.modal-content, .modal-overlay');
        const modalId = modal?.id || 'unknown';
        const action = element.classList.contains('modal-close') ? 'close' : 'open';
        
        this.track('modal_interaction', {
            modal_id: modalId,
            action: action,
            element_clicked: element.className,
            modal_title: modal?.querySelector('.modal-header h3')?.textContent || 'unknown',
            time_since_page_load: Date.now() - this.pageStartTime
        });
    }

    trackModalContentClick(modal, event) {
        const modalId = modal.id || 'unknown';
        const clickedElement = event.target;
        
        this.track('modal_content_click', {
            modal_id: modalId,
            clicked_element: clickedElement.tagName,
            clicked_class: clickedElement.className,
            clicked_text: clickedElement.textContent?.trim().substring(0, 50) || '',
            click_position: {
                x: event.clientX,
                y: event.clientY
            }
        });
    }

    // Enhanced tab tracking
    setupTabTracking() {
        document.addEventListener('click', (event) => {
            const element = event.target;
            if (element.classList.contains('tab-button') || 
                element.onclick?.toString().includes('switchTab') ||
                element.onclick?.toString().includes('switchUnifiedTab')) {
                this.trackTabSwitch(element, event);
            }
        });
    }

    trackTabSwitch(element, event) {
        const tabName = element.getAttribute('data-tab') || 
                       element.onclick?.toString().match(/switchTab\(['"]([^'"]+)['"]\)/)?.[1] ||
                       element.onclick?.toString().match(/switchUnifiedTab\(['"]([^'"]+)['"]\)/)?.[1] ||
                       'unknown';
        
        const tabContainer = element.closest('.tabbed-section, .unified-dashboard');
        const containerId = tabContainer?.id || 'unknown';
        
        this.track('tab_switch', {
            tab_name: tabName,
            container_id: containerId,
            tab_text: element.textContent?.trim() || '',
            tab_position: Array.from(element.parentNode.children).indexOf(element),
            time_since_page_load: Date.now() - this.pageStartTime,
            previous_tab: this.tabSwitches.get(containerId)?.lastTab || 'none'
        });

        this.tabSwitches.set(containerId, {
            lastTab: tabName,
            switchCount: (this.tabSwitches.get(containerId)?.switchCount || 0) + 1,
            lastSwitch: Date.now()
        });
    }

    // Enhanced scroll tracking
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
        this.scrollThresholds.forEach(threshold => {
            if (scrollPercent >= threshold && !this.scrollTracked[threshold]) {
                this.scrollTracked[threshold] = true;
                this.track('scroll_depth', {
                    scroll_percentage: threshold,
                    scroll_position: scrollTop,
                    document_height: document.documentElement.scrollHeight,
                    viewport_height: window.innerHeight,
                    time_to_scroll: Date.now() - this.pageStartTime
                });
            }
        });
    }

    // Enhanced time tracking
    setupIdleTracking() {
        this.idleTimer = setInterval(() => {
            const timeSinceLastActivity = Date.now() - this.lastActivityTime;
            
            if (timeSinceLastActivity > this.engagementThreshold) {
                this.track('user_idle', {
                    idle_duration: timeSinceLastActivity,
                    total_time_on_page: Date.now() - this.pageStartTime,
                    interaction_count: this.interactionCount,
                    scroll_depth: this.scrollDepth,
                    max_scroll_depth: this.maxScrollDepth
                });
            }
        }, 10000); // Check every 10 seconds
    }

    updateLastActivity() {
        this.lastActivityTime = Date.now();
    }

    // Enhanced visibility tracking
    setupVisibilityTracking() {
        document.addEventListener('visibilitychange', () => {
            this.isPageVisible = !document.hidden;
            
            this.track('page_visibility_change', {
                is_visible: this.isPageVisible,
                time_on_page: Date.now() - this.pageStartTime,
                interaction_count: this.interactionCount,
                scroll_depth: this.scrollDepth
            });
        });

        window.addEventListener('focus', () => {
            this.track('window_focus', {
                time_on_page: Date.now() - this.pageStartTime,
                interaction_count: this.interactionCount
            });
        });

        window.addEventListener('blur', () => {
            this.track('window_blur', {
                time_on_page: Date.now() - this.pageStartTime,
                interaction_count: this.interactionCount
            });
        });
    }

    // Enhanced error tracking
    setupErrorTracking() {
        window.addEventListener('error', (event) => {
            this.errorCount++;
            this.track('javascript_error', {
                error_message: event.message,
                error_filename: event.filename,
                error_line: event.lineno,
                error_column: event.colno,
                error_stack: event.error?.stack || '',
                error_count: this.errorCount,
                time_on_page: Date.now() - this.pageStartTime
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.errorCount++;
            this.track('unhandled_promise_rejection', {
                error_reason: event.reason?.toString() || 'Unknown',
                error_count: this.errorCount,
                time_on_page: Date.now() - this.pageStartTime
            });
        });
    }

    // Enhanced performance tracking
    setupPerformanceTracking() {
        if ('performance' in window) {
            window.addEventListener('load', () => {
                setTimeout(() => {
                    this.trackPerformanceMetrics();
                }, 1000);
            });
        }
    }

    trackPerformanceMetrics() {
        if (!('performance' in window)) return;

        const navigation = performance.getEntriesByType('navigation')[0];
        const paint = performance.getEntriesByType('paint');
        
        const metrics = {
            dom_content_loaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            load_complete: navigation.loadEventEnd - navigation.loadEventStart,
            first_paint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
            first_contentful_paint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
            time_to_interactive: this.getTimeToInteractive(),
            memory_usage: this.getMemoryUsage(),
            connection_type: this.getConnectionType()
        };

        this.performanceMetrics = { ...this.performanceMetrics, ...metrics };

        this.track('performance_metrics', metrics);
    }

    getTimeToInteractive() {
        // Simplified TTI calculation
        const navigation = performance.getEntriesByType('navigation')[0];
        return navigation.loadEventEnd - navigation.fetchStart;
    }

    getMemoryUsage() {
        if ('memory' in performance) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        return null;
    }

    getConnectionType() {
        if ('connection' in navigator) {
            return {
                effective_type: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            };
        }
        return null;
    }

    // Enhanced unload tracking
    setupUnloadTracking() {
        window.addEventListener('beforeunload', () => {
            this.track('page_unload', {
                total_time_on_page: Date.now() - this.pageStartTime,
                interaction_count: this.interactionCount,
                max_scroll_depth: this.maxScrollDepth,
                error_count: this.errorCount,
                button_clicks: Array.from(this.buttonClicks.entries()).map(([id, data]) => ({
                    button_id: id,
                    click_count: data.count
                })),
                form_interactions: Array.from(this.formInteractions.entries()).map(([id, data]) => ({
                    form_id: id,
                    field_count: data.fieldInteractions.size,
                    duration: Date.now() - data.startTime
                })),
                tab_switches: Array.from(this.tabSwitches.entries()).map(([id, data]) => ({
                    container_id: id,
                    switch_count: data.switchCount
                })),
                engagement_score: this.calculateEngagementScore()
            });
        });
    }

    calculateEngagementScore() {
        const timeScore = Math.min((Date.now() - this.pageStartTime) / 60000, 10); // Max 10 points for time
        const interactionScore = Math.min(this.interactionCount * 0.5, 10); // Max 10 points for interactions
        const scrollScore = Math.min(this.maxScrollDepth / 10, 10); // Max 10 points for scroll
        const errorPenalty = Math.min(this.errorCount * 2, 10); // Penalty for errors
        
        return Math.max(0, timeScore + interactionScore + scrollScore - errorPenalty);
    }

    // Event listeners setup
    setupEventListeners() {
        // Track all clicks
        document.addEventListener('click', (event) => {
            this.updateLastActivity();
        });

        // Track keyboard interactions
        document.addEventListener('keydown', (event) => {
            this.track('keyboard_interaction', {
                key: event.key,
                code: event.code,
                ctrl_key: event.ctrlKey,
                shift_key: event.shiftKey,
                alt_key: event.altKey,
                meta_key: event.metaKey,
                time_on_page: Date.now() - this.pageStartTime
            });
            this.updateLastActivity();
        });

        // Track mouse movements (throttled)
        let mouseMoveTimeout;
        document.addEventListener('mousemove', (event) => {
            clearTimeout(mouseMoveTimeout);
            mouseMoveTimeout = setTimeout(() => {
                this.track('mouse_movement', {
                    mouse_x: event.clientX,
                    mouse_y: event.clientY,
                    time_on_page: Date.now() - this.pageStartTime
                });
            }, 1000);
        });
    }

    // Public API methods
    trackCustomEvent(eventName, parameters = {}) {
        this.track(eventName, parameters);
    }

    trackUserAction(action, details = {}) {
        this.track('user_action', {
            action: action,
            ...details,
            time_on_page: Date.now() - this.pageStartTime
        });
    }

    trackFeatureUsage(feature, action, details = {}) {
        this.track('feature_usage', {
            feature: feature,
            action: action,
            ...details,
            time_on_page: Date.now() - this.pageStartTime
        });
    }

    trackApiCall(endpoint, method, status, duration, details = {}) {
        this.track('api_call', {
            endpoint: endpoint,
            method: method,
            status: status,
            duration: duration,
            ...details,
            time_on_page: Date.now() - this.pageStartTime
        });
    }

    getSessionData() {
        return {
            sessionId: this.sessionId,
            pageStartTime: this.pageStartTime,
            interactionCount: this.interactionCount,
            scrollDepth: this.scrollDepth,
            maxScrollDepth: this.maxScrollDepth,
            errorCount: this.errorCount,
            performanceMetrics: this.performanceMetrics,
            buttonClicks: Object.fromEntries(this.buttonClicks),
            formInteractions: Object.fromEntries(this.formInteractions),
            tabSwitches: Object.fromEntries(this.tabSwitches)
        };
    }
}

// Initialize advanced analytics when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.advancedAnalytics = new AdvancedAnalytics();
    
    // Make it globally available
    window.trackCustomEvent = (eventName, parameters) => window.advancedAnalytics.trackCustomEvent(eventName, parameters);
    window.trackUserAction = (action, details) => window.advancedAnalytics.trackUserAction(action, details);
    window.trackFeatureUsage = (feature, action, details) => window.advancedAnalytics.trackFeatureUsage(feature, action, details);
    window.trackApiCall = (endpoint, method, status, duration, details) => window.advancedAnalytics.trackApiCall(endpoint, method, status, duration, details);
    
    console.log('✅ Advanced Analytics system loaded and ready');
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvancedAnalytics;
}