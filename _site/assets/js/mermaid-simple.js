/**
 * Simple Mermaid Integration - Specifys.ai
 * Simplified version that definitely works
 */

// Simple Mermaid manager
const SimpleMermaidManager = {
    initialized: false,
    
    // Initialize Mermaid
    async init() {
        if (this.initialized) return;
        
        try {
            // Wait for mermaid to be available
            while (typeof mermaid === 'undefined') {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Initialize with simple config
            mermaid.initialize({
                startOnLoad: false,
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
            
            this.initialized = true;
        } catch (error) {

        }
    },
    
    // Render a simple chart
    async renderChart(containerId, definition) {
        try {
            await this.init();
            
            const container = document.getElementById(containerId);
            if (!container) {

                return;
            }
            
            // Clear container
            container.innerHTML = '';
            
            // Create unique ID
            const chartId = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            
            // Create div for chart
            const chartDiv = document.createElement('div');
            chartDiv.id = chartId;
            chartDiv.className = 'mermaid-chart';
            container.appendChild(chartDiv);
            
            // Render chart
            const { svg } = await mermaid.render(chartId, definition);
            chartDiv.innerHTML = svg;
            
        } catch (error) {

            this.showError(containerId, error.message);
        }
    },
    
    // Show error
    showError(containerId, message) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div class="mermaid-error">
                <div class="mermaid-error-icon">⚠️</div>
                <div class="mermaid-error-title">Chart Error</div>
                <div class="mermaid-error-message">${message}</div>
            </div>
        `;
    },
    
    // Get examples
    getExamples() {
        return {
            flowchart: `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`,
            
            sequence: `sequenceDiagram
    participant Alice
    participant Bob
    Alice->>Bob: Hello Bob, how are you?
    Bob-->>Alice: Great!
    Alice->>Bob: See you later!`,
            
            pie: `pie title Pets adopted by volunteers
    "Dogs" : 386
    "Cats" : 85
    "Rats" : 15`
        };
    }
};

// Make it global
window.SimpleMermaidManager = SimpleMermaidManager;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    SimpleMermaidManager.init();
});
