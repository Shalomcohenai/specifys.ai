/**
 * CSS Crash Monitoring System
 * Tracks CSS state, DOM mutations, errors, and timers to identify CSS crashes
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        checkInterval: 10000, // Check CSS state every 10 seconds
        sendInterval: 30000, // Send logs to backend every 30 seconds
        crashThreshold: 30000, // Consider it a crash if CSS broken for 30 seconds
        backendEndpoint: '/api/admin/css-crash-logs',
        enabled: true
    };

    // State
    const state = {
        cssFiles: new Map(), // Track all CSS files
        cssSnapshots: [], // Historical snapshots
        timers: new Map(), // Track active timers
        domMutations: [], // Track DOM mutations
        errors: [], // Track CSS-related errors
        lastCheckTime: Date.now(),
        lastSendTime: Date.now(),
        pageLoadTime: Date.now(),
        idleTime: 0,
        lastActivityTime: Date.now(),
        cssCheckTimeout: null, // Timeout for debounced CSS health checks
        mutationCount: 0, // Track mutation rate
        lastMutationBatch: Date.now(),
        lastCrashTime: 0, // Track crash frequency
        crashCount: 0 // Count crashes in short time
    };

    /**
     * Get CSS file information
     */
    function getCSSInfo() {
        const cssInfo = [];
        
        // Check all <link rel="stylesheet"> elements
        const linkElements = document.querySelectorAll('link[rel="stylesheet"]');
        linkElements.forEach((link, index) => {
            const info = {
                type: 'link',
                index: index,
                href: link.href,
                media: link.media,
                disabled: link.disabled,
                inHead: link.parentNode === document.head,
                loaded: link.sheet !== null,
                sheetDisabled: null,
                sheetHref: null,
                sheetRules: 0,
                corsBlocked: false,
                timestamp: Date.now()
            };
            
            // Check if CSS actually loaded
            try {
                if (link.sheet) {
                    info.sheetDisabled = link.sheet.disabled;
                    info.sheetHref = link.sheet.href || link.href;
                    
                    // Try to access cssRules - might fail due to CORS
                    try {
                        const rules = link.sheet.cssRules;
                        info.sheetRules = rules ? rules.length : 0;
                        info.cssText = rules && rules.length > 0 ? 
                            rules[0].cssText.substring(0, 50) : null;
                    } catch (corsError) {
                        // CORS error - external stylesheet
                        info.corsBlocked = true;
                        info.corsError = corsError.message;
                        // Estimate based on sheet existence
                        info.sheetRules = 'CORS blocked';
                    }
                }
            } catch (e) {
                info.loadError = e.message;
            }
            
            cssInfo.push(info);
            state.cssFiles.set(link.href, info);
        });
        
        // Check all <style> elements
        const styleElements = document.querySelectorAll('style');
        styleElements.forEach((style, index) => {
            const info = {
                type: 'style',
                index: index,
                inHead: style.parentNode === document.head,
                disabled: false,
                textLength: style.textContent.length,
                sheetDisabled: style.sheet ? style.sheet.disabled : null,
                sheetRules: style.sheet ? style.sheet.cssRules?.length || 0 : 0,
                timestamp: Date.now()
            };
            cssInfo.push(info);
        });
        
        // Check document.styleSheets
        const styleSheets = [];
        try {
            for (let i = 0; i < document.styleSheets.length; i++) {
                const sheet = document.styleSheets[i];
                const sheetInfo = {
                    index: i,
                    href: sheet.href || 'inline',
                    disabled: sheet.disabled,
                    rulesCount: 0,
                    corsBlocked: false,
                    ownerNode: sheet.ownerNode ? {
                        tagName: sheet.ownerNode.tagName,
                        id: sheet.ownerNode.id,
                        className: sheet.ownerNode.className
                    } : null
                };
                
                // Try to access cssRules - might fail due to CORS
                try {
                    if (sheet.cssRules) {
                        sheetInfo.rulesCount = sheet.cssRules.length;
                    }
                } catch (e) {
                    // CORS error - external stylesheet (Google Fonts, CDN, etc.)
                    sheetInfo.corsBlocked = true;
                    sheetInfo.error = 'CORS blocked - external stylesheet';
                    sheetInfo.errorMessage = e.message;
                    // This is normal for external stylesheets, not an error
                }
                
                styleSheets.push(sheetInfo);
            }
        } catch (e) {
            console.error('[CSS Monitor] Error reading styleSheets:', e);
        }
        
        return {
            linkElements: cssInfo.filter(c => c.type === 'link'),
            styleElements: cssInfo.filter(c => c.type === 'style'),
            styleSheets: styleSheets,
            totalCSSFiles: cssInfo.filter(c => c.type === 'link').length,
            totalStyleElements: cssInfo.filter(c => c.type === 'style').length,
            totalStyleSheets: styleSheets.length
        };
    }

    /**
     * Check if CSS is broken/crashed
     */
    function checkCSSHealth() {
        const cssInfo = getCSSInfo();
        const issues = [];
        
        // Check for missing stylesheets
        cssInfo.linkElements.forEach(link => {
            // CORS blocked is normal for external stylesheets - not an issue
            if (link.corsBlocked) {
                // This is expected for external CSS (Google Fonts, CDN, etc.)
                return;
            }
            
            if (!link.loaded && !link.loadError) {
                issues.push({
                    type: 'stylesheet_not_loaded',
                    href: link.href,
                    severity: 'high'
                });
            }
            
            if (link.sheetDisabled) {
                issues.push({
                    type: 'stylesheet_disabled',
                    href: link.href,
                    severity: 'high'
                });
            }
            
            if (link.loadError) {
                issues.push({
                    type: 'stylesheet_load_error',
                    href: link.href,
                    error: link.loadError,
                    severity: 'critical'
                });
            }
        });
        
        // Check if main.css is missing
        const mainCSS = cssInfo.linkElements.find(l => 
            l.href.includes('main.css') || l.href.includes('/assets/css/main.css')
        );
        if (!mainCSS || !mainCSS.loaded) {
            issues.push({
                type: 'main_css_missing',
                severity: 'critical'
            });
        }
        
        // Check if fonts loaded
        const fontCSS = cssInfo.linkElements.find(l => 
            l.href.includes('fonts.googleapis.com') || l.href.includes('googleapis.com/css2')
        );
        if (!fontCSS) {
            issues.push({
                type: 'fonts_not_loaded',
                severity: 'medium'
            });
        }
        
        return {
            healthy: issues.length === 0,
            issues: issues,
            cssInfo: cssInfo
        };
    }

    /**
     * Track active timers
     */
    function trackTimers() {
        // We can't directly track all timers, but we can track known ones
        // by overriding setTimeout/setInterval (dangerous, so we'll do it carefully)
        const trackedTimers = [];
        
        // Check document for any known timer patterns
        // This is limited but better than nothing
        const pageInfo = {
            activeTimers: trackedTimers.length,
            pageIdleTime: Date.now() - state.lastActivityTime,
            timeSinceLoad: Date.now() - state.pageLoadTime
        };
        
        return pageInfo;
    }

    /**
     * Create snapshot of current state
     */
    function createSnapshot() {
        const health = checkCSSHealth();
        const timers = trackTimers();
        
        const snapshot = {
            timestamp: Date.now(),
            timeSinceLoad: Date.now() - state.pageLoadTime,
            timeSinceLastActivity: Date.now() - state.lastActivityTime,
            url: window.location.href,
            userAgent: navigator.userAgent,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            cssHealth: health,
            timers: timers,
            domMutations: state.domMutations.slice(-10), // Last 10 mutations
            errors: state.errors.slice(-5), // Last 5 errors
            memory: performance.memory ? {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            } : null
        };
        
        state.cssSnapshots.push(snapshot);
        
        // Keep only last 50 snapshots
        if (state.cssSnapshots.length > 50) {
            state.cssSnapshots.shift();
        }
        
        return snapshot;
    }

    /**
     * Check if a node is related to livereload
     */
    function isLivereloadNode(node) {
        if (!node) return false;
        
        // Check if it's a script tag with livereload
        if (node.tagName === 'SCRIPT') {
            const src = node.src || node.getAttribute('src') || '';
            if (src.includes('livereload') || src.includes('35729')) {
                return true;
            }
        }
        
        // Check if it's a link to livereload
        if (node.tagName === 'LINK') {
            const href = node.href || node.getAttribute('href') || '';
            if (href.includes('livereload') || href.includes('35729')) {
                return true;
            }
        }
        
        // Check if parent is livereload script
        let parent = node.parentNode;
        while (parent && parent !== document) {
            if (parent.tagName === 'SCRIPT') {
                const src = parent.src || parent.getAttribute('src') || '';
                if (src.includes('livereload') || src.includes('35729')) {
                    return true;
                }
            }
            parent = parent.parentNode;
        }
        
        return false;
    }

    /**
     * Monitor DOM mutations in head
     */
    function setupDOMMonitoring() {
        let lastMutationTime = 0;
        const MUTATION_DEBOUNCE = 500; // Ignore mutations within 500ms of each other
        
        const observer = new MutationObserver((mutations) => {
            const now = Date.now();
            
            // More aggressive debouncing: ignore if too many mutations too quickly (likely livereload loop)
            if (now - lastMutationTime < 100) {
                // More than 10 mutations per 100ms = likely a loop
                state.mutationCount++;
                
                // If we get too many mutations too quickly, disable observer temporarily
                if (state.mutationCount > 20) {
                    console.warn('[CSS Monitor] Too many mutations detected - temporarily disabling observer to prevent loop');
                    observer.disconnect();
                    
                    // Re-enable after 5 seconds
                    setTimeout(() => {
                        state.mutationCount = 0;
                        observer.observe(document.head, {
                            childList: true,
                            attributes: true,
                            attributeOldValue: true,
                            subtree: true
                        });
                        console.log('[CSS Monitor] Observer re-enabled after cooldown');
                    }, 5000);
                    return;
                }
                return;
            }
            
            // Reset counter if enough time passed
            if (now - lastMutationTime > 1000) {
                state.mutationCount = 0;
            }
            
            lastMutationTime = now;
            
            mutations.forEach((mutation) => {
                if (mutation.target === document.head || 
                    mutation.target.parentNode === document.head) {
                    
                    // Ignore livereload-related mutations
                    const addedNodes = Array.from(mutation.addedNodes);
                    const removedNodes = Array.from(mutation.removedNodes);
                    
                    // Check if any of the added/removed nodes are livereload related
                    const hasLivereload = addedNodes.some(isLivereloadNode) || 
                                         removedNodes.some(isLivereloadNode);
                    
                    if (hasLivereload) {
                        // Ignore livereload mutations completely
                        return;
                    }
                    
                    // Ignore mutations to script tags in general (unless CSS-related)
                    const isScriptMutation = addedNodes.some(n => n.tagName === 'SCRIPT') ||
                                           removedNodes.some(n => n.tagName === 'SCRIPT');
                    
                    if (isScriptMutation && !addedNodes.some(n => n.tagName === 'LINK' || n.tagName === 'STYLE') &&
                        !removedNodes.some(n => n.tagName === 'LINK' || n.tagName === 'STYLE')) {
                        // Script mutations that aren't CSS-related - ignore
                        return;
                    }
                    
                    const record = {
                        type: mutation.type,
                        target: mutation.target.tagName || 'unknown',
                        addedNodes: addedNodes.map(n => ({
                            tagName: n.tagName,
                            href: n.href || n.src || null,
                            rel: n.rel || null
                        })),
                        removedNodes: removedNodes.map(n => ({
                            tagName: n.tagName,
                            href: n.href || n.src || null,
                            rel: n.rel || null
                        })),
                        attributeName: mutation.attributeName,
                        oldValue: mutation.oldValue,
                        timestamp: Date.now()
                    };
                    
                    state.domMutations.push(record);
                    
                    // Keep only last 100 mutations
                    if (state.domMutations.length > 100) {
                        state.domMutations.shift();
                    }
                    
                    // If CSS-related, check immediately (with debounce)
                    const isCSSRelated = record.target === 'LINK' || record.target === 'STYLE' ||
                                        addedNodes.some(n => n.tagName === 'LINK' || n.tagName === 'STYLE') ||
                                        removedNodes.some(n => n.tagName === 'LINK' || n.tagName === 'STYLE');
                    
                    if (isCSSRelated) {
                        // Debounce CSS health checks to avoid triggering too frequently
                        clearTimeout(state.cssCheckTimeout);
                        state.cssCheckTimeout = setTimeout(() => {
                            const health = checkCSSHealth();
                            if (!health.healthy) {
                                logCrash('css_removed_or_modified', {
                                    mutation: record,
                                    health: health
                                });
                            }
                        }, 500); // Wait 500ms before checking
                    }
                }
            });
        });
        
        observer.observe(document.head, {
            childList: true,
            attributes: true,
            attributeOldValue: true,
            subtree: true
        });
    }

    /**
     * Monitor CSS loading errors
     */
    function setupErrorMonitoring() {
        // Monitor resource loading errors
        window.addEventListener('error', (event) => {
            if (event.target && (
                event.target.tagName === 'LINK' || 
                (event.target.tagName === 'STYLE')
            )) {
                state.errors.push({
                    type: 'css_load_error',
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    target: {
                        tagName: event.target.tagName,
                        href: event.target.href || null,
                        src: event.target.src || null
                    },
                    timestamp: Date.now()
                });
                
                logCrash('css_load_error', {
                    error: event.message,
                    target: event.target
                });
            }
        }, true);
    }

    /**
     * Monitor user activity
     */
    function setupActivityMonitoring() {
        const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        
        activityEvents.forEach(event => {
            document.addEventListener(event, () => {
                state.lastActivityTime = Date.now();
            }, { passive: true });
        });
    }

    /**
     * Log CSS crash
     */
    function logCrash(crashType, details = {}) {
        // Don't log crashes in development mode with livereload
        const isDevelopment = window.location.hostname === 'localhost' || 
                              window.location.hostname === '127.0.0.1' ||
                              document.querySelector('script[src*="livereload"]');
        
        if (isDevelopment && crashType.includes('removed_or_modified')) {
            // Skip logging CSS modifications in dev mode (likely livereload)
            return;
        }
        
        // Check if we're in a reload loop (too many crashes too quickly)
        const now = Date.now();
        state.lastCrashTime = state.lastCrashTime || 0;
        state.crashCount = state.crashCount || 0;
        
        if (now - state.lastCrashTime < 5000) {
            // Crash within 5 seconds of previous - might be a loop
            state.crashCount++;
            if (state.crashCount > 5) {
                console.warn('[CSS Monitor] Too many crashes detected, likely in a reload loop. Skipping logging.');
                return;
            }
        } else {
            state.crashCount = 1;
        }
        state.lastCrashTime = now;
        
        const snapshot = createSnapshot();
        
        const crashLog = {
            crashType: crashType,
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            details: details,
            snapshot: snapshot,
            timeSinceLoad: Date.now() - state.pageLoadTime,
            timeSinceLastActivity: Date.now() - state.lastActivityTime
        };
        
        // Send immediately for critical crashes (but not in dev mode)
        if (!isDevelopment && (crashType.includes('critical') || crashType === 'css_crash_detected')) {
            sendLog(crashLog);
        } else if (!isDevelopment) {
            // Queue for batch sending (only in production)
            state.crashLogs = state.crashLogs || [];
            state.crashLogs.push(crashLog);
        }
        
        if (!isDevelopment) {
            console.warn('[CSS Monitor] Crash detected:', crashType, crashLog);
        }
    }

    /**
     * Send logs to backend
     */
    async function sendLog(logData) {
        try {
            console.log('[CSS Monitor] 📤 Sending crash log to backend:', logData.crashType);
            const response = await fetch(CONFIG.backendEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    log: logData,
                    pageInfo: {
                        url: window.location.href,
                        title: document.title,
                        referrer: document.referrer
                    }
                })
            });
            
            if (!response.ok) {
                console.error('[CSS Monitor] ❌ Failed to send log:', response.status, response.statusText);
            } else {
                console.log('[CSS Monitor] ✅ Crash log sent successfully');
            }
        } catch (error) {
            console.error('[CSS Monitor] ❌ Error sending log:', error);
        }
    }

    /**
     * Periodic CSS health check
     */
    function startPeriodicCheck() {
        let checkCount = 0;
        
        // First check immediately (with small delay to avoid interfering with page load)
        const doCheck = () => {
            checkCount++;
            
            // Only check if page is stable (not reloading)
            if (document.readyState === 'loading') {
                return; // Skip if page is still loading
            }
            
            const health = checkCSSHealth();
            const snapshot = createSnapshot();
            
            // Log periodic check (only every 5th check to avoid spam)
            if (checkCount % 5 === 0) {
                console.log('[CSS Monitor] 🔄 Periodic check - CSS healthy:', health.healthy, 'Issues:', health.issues.length);
            }
            
            // Detect crash (only if not in dev mode with livereload)
            const isDevelopment = window.location.hostname === 'localhost' || 
                                  window.location.hostname === '127.0.0.1' ||
                                  document.querySelector('script[src*="livereload"]');
            
            if (!health.healthy && !isDevelopment) {
                // Only report crashes in production or non-livereload environments
                const criticalIssues = health.issues.filter(i => 
                    i.severity === 'critical' || i.severity === 'high'
                );
                
                if (criticalIssues.length > 0) {
                    console.warn('[CSS Monitor] ⚠️ CSS crash detected!', criticalIssues);
                    logCrash('css_crash_detected', {
                        issues: health.issues,
                        criticalIssues: criticalIssues
                    });
                }
            }
            
            // Check if page is idle and CSS is broken (only in production)
            if (!isDevelopment) {
                const idleTime = Date.now() - state.lastActivityTime;
                if (idleTime > 120000 && !health.healthy) { // 2 minutes idle + CSS broken
                    console.error('[CSS Monitor] 🚨 CSS crash after idle period!', {
                        idleTime: idleTime,
                        issues: health.issues
                    });
                    logCrash('css_crash_after_idle', {
                        idleTime: idleTime,
                        issues: health.issues
                    });
                }
            }
        };
        
        // Run first check after page is loaded (avoid interfering with initial load)
        setTimeout(doCheck, 1000);
        
        // Then run periodically
        setInterval(doCheck, CONFIG.checkInterval);
    }

    /**
     * Periodic log sending
     */
    function startPeriodicSending() {
        setInterval(() => {
            if (state.crashLogs && state.crashLogs.length > 0) {
                state.crashLogs.forEach(log => sendLog(log));
                state.crashLogs = [];
            }
        }, CONFIG.sendInterval);
    }

    /**
     * Initialize monitoring
     */
    function init() {
        if (!CONFIG.enabled) return;
        
        console.log('[CSS Monitor] 🔍 Initializing CSS monitoring system...');
        
        // Setup monitoring
        setupDOMMonitoring();
        setupErrorMonitoring();
        setupActivityMonitoring();
        
        // Initial check
        const initialHealth = checkCSSHealth();
        if (!initialHealth.healthy) {
            console.warn('[CSS Monitor] Initial CSS health check found issues:', initialHealth.issues);
        }
        
        // Start periodic checks
        startPeriodicCheck();
        startPeriodicSending();
        
        // Create initial snapshot
        createSnapshot();
        
        console.log('[CSS Monitor] ✅ Initialized successfully - CSS monitoring is active!');
        console.log('[CSS Monitor] Monitoring every', CONFIG.checkInterval / 1000, 'seconds');
    }

    // Initialize when DOM is ready (with delay to avoid interfering with livereload)
    function safeInit() {
        // Check if livereload is active - multiple detection methods
        const hasLivereload = document.querySelector('script[src*="livereload"]') !== null ||
                             document.querySelector('script[src*="35729"]') !== null ||
                             window.location.hostname === 'localhost' ||
                             window.location.hostname === '127.0.0.1' ||
                             document.location.port === '4000';
        
        // More aggressive: Disable monitoring completely if livereload detected in first 5 seconds
        if (hasLivereload) {
            console.log('[CSS Monitor] 🛡️ LiveReload detected - using safe mode');
            
            // Wait longer and check again if page is stable
            setTimeout(() => {
                // Check if there are too many reloads happening (detect loops)
                const reloadCount = sessionStorage.getItem('css_monitor_reload_count') || 0;
                const lastReloadTime = sessionStorage.getItem('css_monitor_last_reload_time') || 0;
                const now = Date.now();
                
                // If reload happened less than 2 seconds ago, it might be a loop
                if (now - parseInt(lastReloadTime) < 2000 && parseInt(reloadCount) > 2) {
                    console.warn('[CSS Monitor] Rapid reloads detected - might be in a loop, skipping initialization');
                    // Increment counter
                    sessionStorage.setItem('css_monitor_reload_count', parseInt(reloadCount) + 1);
                    sessionStorage.setItem('css_monitor_last_reload_time', now);
                    
                    // If too many rapid reloads, disable monitor
                    if (parseInt(reloadCount) > 5) {
                        console.warn('[CSS Monitor] Too many rapid reloads - disabling monitor to prevent loop');
                        CONFIG.enabled = false;
                        return;
                    }
                    return;
                }
                
                // Normal reload - reset counter if enough time passed
                if (now - parseInt(lastReloadTime) > 10000) {
                    sessionStorage.setItem('css_monitor_reload_count', '0');
                } else {
                    // Increment counter for rapid reloads
                    sessionStorage.setItem('css_monitor_reload_count', parseInt(reloadCount) + 1);
                }
                sessionStorage.setItem('css_monitor_last_reload_time', now);
                
                // Initialize with extra delay in dev mode
                setTimeout(init, 3000);
            }, 3000);
        } else {
            // Normal initialization in production
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    setTimeout(init, 500);
                });
            } else {
                setTimeout(init, 500);
            }
        }
    }
    
    safeInit();
    
    // Also initialize on window load (backup, but only if not already initialized and not in livereload loop)
    window.addEventListener('load', () => {
        const hasLivereload = document.querySelector('script[src*="livereload"]') !== null;
        
        if (hasLivereload) {
            // In livereload mode, be very cautious
            const reloadCount = sessionStorage.getItem('css_monitor_reload_count') || 0;
            const lastReloadTime = sessionStorage.getItem('css_monitor_last_reload_time') || 0;
            const now = Date.now();
            
            // Only skip if there were rapid reloads (less than 2 seconds apart)
            if (parseInt(reloadCount) > 3 && (now - parseInt(lastReloadTime) < 2000)) {
                console.warn('[CSS Monitor] Skipping initialization - possible reload loop detected');
                return;
            }
        }
        
        if (!state.cssSnapshots.length) {
            console.log('[CSS Monitor] Window loaded, ensuring initialization...');
            setTimeout(init, 2000);
        }
    });

    // Export for debugging
    window.CSSMonitor = {
        getState: () => state,
        getHealth: checkCSSHealth,
        createSnapshot: createSnapshot,
        getCSSInfo: getCSSInfo
    };

})();

