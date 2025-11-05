/**
 * Mermaid Charts Integration - Specifys.ai
 * Provides comprehensive Mermaid chart support with dark theme and responsive design
 */

class MermaidManager {
    constructor() {
        this.charts = new Map();
        this.isInitialized = false;
        this.config = {
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
            },
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true
            },
            sequence: {
                useMaxWidth: true,
                wrap: true
            },
            gantt: {
                useMaxWidth: true
            },
            pie: {
                useMaxWidth: true
            },
            gitgraph: {
                useMaxWidth: true
            }
        };
    }

    /**
     * Initialize Mermaid with configuration
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            // Wait for Mermaid to be available
            if (typeof mermaid === 'undefined') {
                await this.waitForMermaid();
            }

            // Initialize Mermaid with configuration
            mermaid.initialize(this.config);
            this.isInitialized = true;
        } catch (error) {

        }
    }

    /**
     * Wait for Mermaid to be available
     */
    async waitForMermaid() {
        return new Promise((resolve) => {
            const checkMermaid = () => {
                if (typeof mermaid !== 'undefined') {
                    resolve();
                } else {
                    setTimeout(checkMermaid, 100);
                }
            };
            checkMermaid();
        });
    }

    /**
     * Load Mermaid library from CDN
     */
    async loadMermaid() {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (typeof mermaid !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js';
            script.onload = () => {
                resolve();
            };
            script.onerror = (error) => {

                reject(error);
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Update theme based on current site theme
     */
    updateTheme() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        
        if (isDark) {
            this.config.theme = 'dark';
            this.config.themeVariables = {
                primaryColor: '#FF6B35',
                primaryTextColor: '#ffffff',
                primaryBorderColor: '#FF6B35',
                lineColor: '#ffffff',
                secondaryColor: '#2d2d2d',
                tertiaryColor: '#333333',
                background: '#1a1a1a',
                mainBkg: '#1a1a1a',
                secondBkg: '#2d2d2d',
                tertiaryBkg: '#333333'
            };
        } else {
            this.config.theme = 'base';
            this.config.themeVariables = {
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
            };
        }

        if (this.isInitialized) {
            mermaid.initialize(this.config);
            this.renderAllCharts();
        }
    }

    /**
     * Render a Mermaid chart
     */
    async renderChart(containerId, definition, options = {}) {
        try {
            await this.initialize();

            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error(`Container with id "${containerId}" not found`);
            }

            // Clear previous content
            container.innerHTML = '';

            // Generate unique ID for the chart
            const chartId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Create chart element
            const chartElement = document.createElement('div');
            chartElement.id = chartId;
            chartElement.className = 'mermaid-chart';
            
            // Add chart type class if specified
            if (options.type) {
                chartElement.classList.add(`mermaid-${options.type}`);
            }

            container.appendChild(chartElement);

            // Simple approach - use mermaid.parse and mermaid.render
            try {
                // Parse the definition first
                const parseResult = mermaid.parse(definition);
                if (!parseResult) {
                    throw new Error('Failed to parse chart definition');
                }

                // Render the chart
                const { svg } = await mermaid.render(chartId, definition);
                chartElement.innerHTML = svg;

                // Store chart info
                this.charts.set(containerId, {
                    id: chartId,
                    definition,
                    options,
                    element: chartElement
                });

                return chartId;
            } catch (parseError) {

                throw new Error(`Chart parsing failed: ${parseError.message}`);
            }
        } catch (error) {

            this.showError(containerId, error.message);
        }
    }

    /**
     * Render all charts (useful after theme change)
     */
    async renderAllCharts() {
        for (const [containerId, chartInfo] of this.charts) {
            try {
                await this.renderChart(containerId, chartInfo.definition, chartInfo.options);
            } catch (error) {

            }
        }
    }

    /**
     * Show error message in chart container
     */
    showError(containerId, message) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="mermaid-error">
                <div class="mermaid-error-icon">⚠️</div>
                <div class="mermaid-error-title">Chart Error</div>
                <div class="mermaid-error-message">Failed to render Mermaid chart</div>
                <div class="mermaid-error-code">${message}</div>
            </div>
        `;
    }

    /**
     * Show loading state
     */
    showLoading(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '<div class="mermaid-loading"></div>';
    }

    /**
     * Create a Mermaid editor
     */
    createEditor(containerId, initialDefinition = '', options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const editorId = `mermaid-editor-${Date.now()}`;
        
        container.innerHTML = `
            <div class="mermaid-editor" id="${editorId}">
                <div class="mermaid-editor-header">
                    <h3 class="mermaid-editor-title">Mermaid Chart Editor</h3>
                    <div class="mermaid-editor-actions">
                        <button class="mermaid-btn" onclick="mermaidManager.renderFromEditor('${editorId}')">
                            Render Chart
                        </button>
                        <button class="mermaid-btn" onclick="mermaidManager.clearEditor('${editorId}')">
                            Clear
                        </button>
                    </div>
                </div>
                <div class="mermaid-editor-content">
                    <div class="mermaid-editor-input">
                        <label class="mermaid-editor-label">Chart Definition</label>
                        <textarea class="mermaid-editor-textarea" placeholder="Enter your Mermaid chart definition here...">${initialDefinition}</textarea>
                    </div>
                    <div class="mermaid-editor-preview">
                        <label class="mermaid-editor-preview-label">Preview</label>
                        <div class="mermaid-editor-preview-content" id="${editorId}-preview">
                            <div class="mermaid-loading"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Auto-render if there's initial content
        if (initialDefinition.trim()) {
            setTimeout(() => this.renderFromEditor(editorId), 100);
        }
    }

    /**
     * Render chart from editor
     */
    async renderFromEditor(editorId) {
        const editor = document.getElementById(editorId);
        if (!editor) return;

        const textarea = editor.querySelector('.mermaid-editor-textarea');
        const preview = editor.querySelector('.mermaid-editor-preview-content');
        
        if (!textarea || !preview) return;

        const definition = textarea.value.trim();
        
        if (!definition) {
            preview.innerHTML = '<div class="mermaid-loading">Enter chart definition to see preview</div>';
            return;
        }

        try {
            preview.innerHTML = '<div class="mermaid-loading"></div>';
            await this.renderChart(`${editorId}-preview`, definition);
        } catch (error) {
            this.showError(`${editorId}-preview`, error.message);
        }
    }

    /**
     * Clear editor
     */
    clearEditor(editorId) {
        const editor = document.getElementById(editorId);
        if (!editor) return;

        const textarea = editor.querySelector('.mermaid-editor-textarea');
        const preview = editor.querySelector('.mermaid-editor-preview-content');
        
        if (textarea) textarea.value = '';
        if (preview) preview.innerHTML = '<div class="mermaid-loading">Enter chart definition to see preview</div>';
    }

    /**
     * Get chart examples
     */
    getExamples() {
        return {
            flowchart: `graph TD
    A[Start] --> B{Is it?}
    B -->|Yes| C[OK]
    C --> D[Rethink]
    D --> B
    B ---->|No| E[End]`,

            sequence: `sequenceDiagram
    participant Alice
    participant Bob
    Alice->>John: Hello John, how are you?
    loop Healthcheck
        John->>John: Fight against hypochondria
    end
    Note right of John: Rational thoughts <br/>prevail!
    John-->>Alice: Great!
    John->>Bob: How about you?
    Bob-->>John: Jolly good!`,

            gantt: `gantt
    title A Gantt Diagram
    dateFormat  YYYY-MM-DD
    section Section
    A task           :a1, 2014-01-01, 30d
    Another task     :after a1  , 20d
    section Another
    Task in sec      :2014-01-12  , 12d
    another task      : 24d`,

            class: `classDiagram
    Class01 <|-- AveryLongClass : Cool
    Class03 *-- Class04
    Class05 o-- Class06
    Class07 .. Class08
    Class09 --> C2 : Where am i?
    Class09 --* C3
    Class09 --|> Class07
    Class07 : equals()
    Class07 : Object[] elementData
    Class01 : size()
    Class01 : int chimp
    Class01 : int gorilla
    Class08 <--> C2: Cool label`,

            pie: `pie title Pets adopted by volunteers
    "Dogs" : 386
    "Cats" : 85
    "Rats" : 15`,

            state: `stateDiagram-v2
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]`
        };
    }
}

// Create global instance
const mermaidManager = new MermaidManager();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    mermaidManager.initialize();
    
    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                mermaidManager.updateTheme();
            }
        });
    });
    
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
    });
});

// Export for use in other scripts
window.mermaidManager = mermaidManager;
