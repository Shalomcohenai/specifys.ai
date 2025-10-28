/**
 * Diagram Manager - Specifys.ai
 * Clean and robust Mermaid diagram management system
 * Version: 2.0
 */

class DiagramManager {
    constructor() {
        this.initialized = false;
        this.diagrams = new Map(); // Store diagram metadata
        this.failedDiagrams = new Set(); // Track failed diagrams
        this.retryCount = new Map(); // Track retry attempts
        this.maxRetries = 2;
        this.config = {
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            flowchart: { 
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            },
            sequence: { 
                useMaxWidth: true,
                wrap: true 
            },
            gantt: { 
                useMaxWidth: true 
            },
            er: {
                useMaxWidth: true
            },
            pie: {
                useMaxWidth: true
            }
        };
    }

    /**
     * Initialize Mermaid with proper configuration
     */
    async init() {
        if (this.initialized) {
            console.log('✅ Diagram Manager already initialized');
            return true;
        }

        try {
            // Wait for mermaid to be available
            if (typeof mermaid === 'undefined') {
                console.log('⏳ Waiting for Mermaid library...');
                await this.waitForMermaid();
            }

            // Initialize Mermaid
            mermaid.initialize(this.config);
            this.initialized = true;
            
            console.log('✅ Diagram Manager initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Diagram Manager:', error);
            return false;
        }
    }

    /**
     * Wait for Mermaid library to load
     */
    async waitForMermaid(timeout = 10000) {
        const startTime = Date.now();
        
        return new Promise((resolve, reject) => {
            const checkMermaid = () => {
                if (typeof mermaid !== 'undefined') {
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error('Mermaid library failed to load'));
                } else {
                    setTimeout(checkMermaid, 100);
                }
            };
            checkMermaid();
        });
    }

    /**
     * Extract diagram code from markdown/text
     * Clean and precise extraction
     */
    extractDiagramCode(codeBlock) {
        let code = codeBlock.textContent || codeBlock.innerText || '';
        
        // Remove markdown code fence if present
        code = code.replace(/^```mermaid\s*/i, '').replace(/```\s*$/i, '');
        
        // Trim whitespace
        code = code.trim();
        
        return code;
    }

    /**
     * Validate diagram syntax
     */
    validateDiagramSyntax(code) {
        // Check if code is not empty
        if (!code || code.trim().length === 0) {
            return { valid: false, error: 'Empty diagram code' };
        }

        // Check for valid diagram type
        const validTypes = [
            'graph', 'flowchart', 'sequenceDiagram', 'classDiagram',
            'stateDiagram', 'erDiagram', 'journey', 'gantt', 'pie', 'gitGraph'
        ];

        const hasValidType = validTypes.some(type => 
            code.trim().startsWith(type)
        );

        if (!hasValidType) {
            return { valid: false, error: 'Invalid diagram type' };
        }

        // Basic syntax validation
        try {
            // Check for balanced brackets/parentheses
            const brackets = { '(': ')', '[': ']', '{': '}' };
            const stack = [];
            
            for (let char of code) {
                if (brackets[char]) {
                    stack.push(char);
                } else if (Object.values(brackets).includes(char)) {
                    if (stack.length === 0 || brackets[stack.pop()] !== char) {
                        return { valid: false, error: 'Unbalanced brackets' };
                    }
                }
            }

            return { valid: true };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Render a single diagram
     */
    async renderDiagram(container, diagramCode, diagramId) {
        if (!this.initialized) {
            await this.init();
        }

        try {
            // Validate syntax first
            const validation = this.validateDiagramSyntax(diagramCode);
            if (!validation.valid) {
                throw new Error(`Syntax validation failed: ${validation.error}`);
            }

            // Create unique ID
            const id = diagramId || `diagram-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            // Clear container
            container.innerHTML = '<div class="diagram-loading">⏳ Rendering diagram...</div>';
            
            // Render diagram
            const { svg } = await mermaid.render(id, diagramCode);
            
            // Insert SVG
            container.innerHTML = svg;
            
            // Store diagram metadata
            this.diagrams.set(id, {
                code: diagramCode,
                container: container,
                rendered: true,
                timestamp: Date.now()
            });

            // Remove from failed list if it was there
            this.failedDiagrams.delete(id);
            this.retryCount.delete(id);
            
            console.log(`✅ Diagram rendered successfully: ${id}`);
            return { success: true, id };

        } catch (error) {
            console.error(`❌ Failed to render diagram:`, error);
            
            // Show user-friendly error
            this.showDiagramError(container, error.message, diagramId);
            
            // Track failed diagram
            if (diagramId) {
                this.failedDiagrams.add(diagramId);
            }
            
            return { success: false, error: error.message };
        }
    }

    /**
     * Show error message in diagram container
     */
    showDiagramError(container, errorMessage, diagramId) {
        const retries = this.retryCount.get(diagramId) || 0;
        const canRetry = retries < this.maxRetries;

        container.innerHTML = `
            <div class="diagram-error">
                <div class="diagram-error-icon">⚠️</div>
                <div class="diagram-error-title">Diagram Rendering Failed</div>
                <div class="diagram-error-message">${this.sanitizeErrorMessage(errorMessage)}</div>
                ${canRetry ? `
                    <button class="diagram-retry-btn" onclick="window.diagramManager.retryDiagram('${diagramId}')">
                        🔄 Try Again
                    </button>
                ` : `
                    <div class="diagram-error-help">
                        This diagram has syntax errors. Please regenerate it.
                    </div>
                `}
            </div>
        `;
    }

    /**
     * Sanitize error message for display
     */
    sanitizeErrorMessage(message) {
        // Make error message user-friendly
        if (message.includes('Expecting')) {
            return 'Syntax error: Invalid diagram structure';
        }
        if (message.includes('Parse error')) {
            return 'Syntax error: Cannot parse diagram code';
        }
        return 'Unable to render diagram due to syntax error';
    }

    /**
     * Retry rendering a failed diagram
     */
    async retryDiagram(diagramId) {
        const diagram = this.diagrams.get(diagramId);
        if (!diagram) {
            console.error(`❌ Diagram not found: ${diagramId}`);
            return;
        }

        // Increment retry count
        const retries = (this.retryCount.get(diagramId) || 0) + 1;
        this.retryCount.set(diagramId, retries);

        if (retries > this.maxRetries) {
            console.warn(`⚠️ Max retries reached for diagram: ${diagramId}`);
            return;
        }

        console.log(`🔄 Retrying diagram (attempt ${retries}/${this.maxRetries}): ${diagramId}`);
        
        // Try to render again
        await this.renderDiagram(diagram.container, diagram.code, diagramId);
    }

    /**
     * Scan and render all diagrams in a container
     */
    async renderAllDiagrams(rootContainer) {
        if (!rootContainer) {
            console.error('❌ Root container not provided');
            return;
        }

        console.log('🔍 Scanning for diagrams...');

        // Find all code blocks that might contain mermaid diagrams
        const codeBlocks = rootContainer.querySelectorAll('pre code, code.language-mermaid, pre.mermaid');
        console.log(`📊 Found ${codeBlocks.length} potential diagram blocks`);

        const renderPromises = [];

        codeBlocks.forEach((block, index) => {
            const code = this.extractDiagramCode(block);
            
            // Check if this looks like a mermaid diagram
            if (this.isMermaidDiagram(code)) {
                console.log(`✅ Valid Mermaid diagram found (block ${index + 1})`);
                
                // Create diagram container
                const diagramContainer = document.createElement('div');
                diagramContainer.className = 'mermaid-diagram-container';
                diagramContainer.dataset.index = index;
                
                // Replace code block with diagram container
                if (block.parentElement && block.parentElement.tagName === 'PRE') {
                    block.parentElement.replaceWith(diagramContainer);
                } else {
                    block.replaceWith(diagramContainer);
                }
                
                // Render diagram
                const diagramId = `diagram-${index}`;
                renderPromises.push(
                    this.renderDiagram(diagramContainer, code, diagramId)
                );
            } else {
                console.log(`⏭️  Skipping non-Mermaid block (block ${index + 1})`);
            }
        });

        // Wait for all diagrams to render
        const results = await Promise.allSettled(renderPromises);
        
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.length - successful;

        console.log(`📊 Diagram rendering complete: ${successful} successful, ${failed} failed`);

        return { successful, failed, total: results.length };
    }

    /**
     * Check if code is a Mermaid diagram
     */
    isMermaidDiagram(code) {
        const mermaidKeywords = [
            'graph', 'flowchart', 'sequenceDiagram', 'classDiagram',
            'stateDiagram', 'erDiagram', 'journey', 'gantt', 'pie', 'gitGraph'
        ];

        const trimmedCode = code.trim().toLowerCase();
        return mermaidKeywords.some(keyword => trimmedCode.startsWith(keyword.toLowerCase()));
    }

    /**
     * Get list of failed diagrams
     */
    getFailedDiagrams() {
        return Array.from(this.failedDiagrams);
    }

    /**
     * Clear all diagram data
     */
    clear() {
        this.diagrams.clear();
        this.failedDiagrams.clear();
        this.retryCount.clear();
        console.log('🧹 Diagram Manager cleared');
    }
}

// Create global instance
window.diagramManager = new DiagramManager();

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📊 Diagram Manager ready');
        window.diagramManager.init();
    });
} else {
    console.log('📊 Diagram Manager ready');
    window.diagramManager.init();
}
