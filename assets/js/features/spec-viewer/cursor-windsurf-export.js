// cursor-windsurf-export.js
// Export specification to Cursor & Windsurf format

/**
 * Generate and download Cursor & Windsurf export ZIP file
 */
async function generateCursorWindsurfExport() {
    const requestId = `cursor-export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[${requestId}] [generateCursorWindsurfExport] Starting export generation`);
    
    try {
        // Get current spec data - try multiple ways to access it
        let specData = null;
        
        // Method 1: Try to get from global scope (if exposed)
        if (typeof window !== 'undefined' && window.currentSpecData) {
            specData = window.currentSpecData;
        }
        // Method 2: Try to get from Firestore directly using spec ID from URL
        else {
            const urlParams = new URLSearchParams(window.location.search);
            const specId = urlParams.get('id');
            if (specId && typeof firebase !== 'undefined' && firebase.firestore) {
                try {
                    const specDoc = await firebase.firestore().collection('specs').doc(specId).get();
                    if (specDoc.exists) {
                        specData = { id: specDoc.id, ...specDoc.data() };
                    }
                } catch (firestoreError) {
                    console.warn('Failed to load spec from Firestore:', firestoreError);
                }
            }
        }
        
        if (!specData) {
            throw new Error('No specification data available. Please load a specification first.');
        }

        // Check if JSZip is loaded
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library not loaded. Please refresh the page.');
        }

        // Get UI elements
        const btn = document.getElementById('generate-cursor-windsurf-btn');
        const progressContainer = document.getElementById('cursor-windsurf-export-progress');
        const progressBar = document.getElementById('cursor-windsurf-progress-bar');
        const progressText = document.getElementById('cursor-windsurf-progress-text');

        // Show progress
        if (progressContainer) progressContainer.classList.remove('hidden');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Generating...';
        }

        // Update progress
        const updateProgress = (percent, text) => {
            if (progressBar) progressBar.style.width = percent + '%';
            if (progressText) progressText.textContent = text || 'Preparing export...';
        };

        updateProgress(10, 'Preparing export package...');

        // Initialize ZIP
        const zip = new JSZip();

        // Get spec title for file naming
        const specTitle = specData.title || 'specification';
        const sanitizedTitle = specTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();

        // 1. PROJECT_PLAN.md - Overview + Market
        updateProgress(20, 'Creating PROJECT_PLAN.md...');
        const projectPlan = generateProjectPlan(specData);
        zip.file('PROJECT_PLAN.md', projectPlan);

        // 2. ARCHITECTURE.md - Technical specifications
        updateProgress(30, 'Creating ARCHITECTURE.md...');
        const architecture = generateArchitecture(specData);
        zip.file('ARCHITECTURE.md', architecture);

        // 3. DESIGN_GUIDELINES.md - Design specifications
        updateProgress(40, 'Creating DESIGN_GUIDELINES.md...');
        const designGuidelines = generateDesignGuidelines(specData);
        zip.file('DESIGN_GUIDELINES.md', designGuidelines);

        // 4. DEVELOPMENT_ROADMAP.md - Full prompt (CRITICAL - includes all fullPrompt content)
        updateProgress(50, 'Creating DEVELOPMENT_ROADMAP.md...');
        const developmentRoadmap = generateDevelopmentRoadmap(specData);
        zip.file('DEVELOPMENT_ROADMAP.md', developmentRoadmap);

        // 5. DIAGRAMS.md - System diagrams
        updateProgress(60, 'Creating DIAGRAMS.md...');
        const diagrams = generateDiagramsDoc(specData);
        zip.file('DIAGRAMS.md', diagrams);

        // 6. .cursorrules - Cursor AI editor configuration
        updateProgress(70, 'Creating .cursorrules...');
        const cursorRules = generateCursorRules(specData);
        zip.file('.cursorrules', cursorRules);

        // 7. .windsurf/info.md - Windsurf AI agent context
        updateProgress(75, 'Creating .windsurf/info.md...');
        const windsurfInfo = generateWindsurfInfo(specData);
        zip.file('.windsurf/info.md', windsurfInfo);

        // 8. README.md - Quick start guide
        updateProgress(80, 'Creating README.md...');
        const readme = generateReadme(specData);
        zip.file('README.md', readme);

        // 9. metadata.json - Export information
        updateProgress(85, 'Creating metadata.json...');
        const metadata = generateMetadata(specData);
        zip.file('metadata.json', JSON.stringify(metadata, null, 2));

        // Generate ZIP file
        updateProgress(90, 'Generating ZIP file...');
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        // Download file
        updateProgress(95, 'Preparing download...');
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sanitizedTitle}_cursor_windsurf_export_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        updateProgress(100, 'Export completed!');

        // Show success notification
        if (typeof showNotification === 'function') {
            showNotification('Export generated successfully!', 'success');
        }

        // Reset UI
        setTimeout(() => {
            if (progressContainer) progressContainer.classList.add('hidden');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa fa-download"></i> Export to ZIP';
            }
        }, 1500);

        console.log(`[${requestId}] [generateCursorWindsurfExport] Export completed successfully`);

    } catch (error) {
        console.error(`[${requestId}] [generateCursorWindsurfExport] Error:`, error);
        
        // Show error notification
        if (typeof showNotification === 'function') {
            showNotification('Error generating export: ' + error.message, 'error');
        }

        // Reset UI
        const btn = document.getElementById('generate-cursor-windsurf-btn');
        const progressContainer = document.getElementById('cursor-windsurf-export-progress');
        if (progressContainer) progressContainer.classList.add('hidden');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa fa-download"></i> Export to ZIP';
        }
    }
}

/**
 * Generate PROJECT_PLAN.md content
 */
function generateProjectPlan(specData) {
    const title = specData.title || 'Application';
    let content = `# Project Plan: ${title}\n\n`;
    content += `Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
    content += `---\n\n`;

    // Overview section
    if (specData.overview) {
        try {
            const overview = typeof specData.overview === 'string' ? JSON.parse(specData.overview) : specData.overview;
            content += `## Project Overview\n\n`;
            if (overview.ideaSummary) {
                content += `### Idea Summary\n\n${overview.ideaSummary}\n\n`;
            }
            if (overview.problemStatement) {
                content += `### Problem Statement\n\n${overview.problemStatement}\n\n`;
            }
            if (overview.valueProposition) {
                content += `### Value Proposition\n\n${overview.valueProposition}\n\n`;
            }
            if (overview.targetAudience) {
                content += `### Target Audience\n\n`;
                if (overview.targetAudience.ageRange) content += `- **Age Range:** ${overview.targetAudience.ageRange}\n`;
                if (overview.targetAudience.sector) content += `- **Sector:** ${overview.targetAudience.sector}\n`;
                if (overview.targetAudience.interests && Array.isArray(overview.targetAudience.interests)) {
                    content += `- **Interests:** ${overview.targetAudience.interests.join(', ')}\n`;
                }
                content += `\n`;
            }
        } catch (e) {
            console.warn('Failed to parse overview:', e);
        }
    }

    // Market section
    if (specData.market) {
        try {
            const market = typeof specData.market === 'string' ? JSON.parse(specData.market) : specData.market;
            content += `## Market Analysis\n\n`;
            if (market.marketAnalysis) {
                content += `${market.marketAnalysis}\n\n`;
            }
            if (market.competitiveAnalysis) {
                content += `### Competitive Analysis\n\n${market.competitiveAnalysis}\n\n`;
            }
        } catch (e) {
            console.warn('Failed to parse market:', e);
        }
    }

    return content;
}

/**
 * Generate ARCHITECTURE.md content
 */
function generateArchitecture(specData) {
    const title = specData.title || 'Application';
    let content = `# Architecture: ${title}\n\n`;
    content += `Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
    content += `---\n\n`;

    if (specData.technical) {
        try {
            const technical = typeof specData.technical === 'string' ? JSON.parse(specData.technical) : specData.technical;
            
            // Tech Stack
            if (technical.techStack) {
                content += `## Technology Stack\n\n`;
                if (technical.techStack.frontend) content += `- **Frontend:** ${technical.techStack.frontend}\n`;
                if (technical.techStack.backend) content += `- **Backend:** ${technical.techStack.backend}\n`;
                if (technical.techStack.database) content += `- **Database:** ${technical.techStack.database}\n`;
                if (technical.techStack.authentication) content += `- **Authentication:** ${technical.techStack.authentication}\n`;
                content += `\n`;
            }

            // Database Schema
            if (technical.databaseSchema && technical.databaseSchema.tables) {
                content += `## Database Schema\n\n`;
                technical.databaseSchema.tables.forEach(table => {
                    content += `### ${table.name}\n\n`;
                    if (table.fields && Array.isArray(table.fields)) {
                        content += `| Field | Type | Description |\n`;
                        content += `|-------|------|-------------|\n`;
                        table.fields.forEach(field => {
                            content += `| ${field.name} | ${field.type || 'string'} | ${field.description || ''} |\n`;
                        });
                        content += `\n`;
                    }
                });
            }

            // API Endpoints
            if (technical.apiEndpoints && Array.isArray(technical.apiEndpoints)) {
                content += `## API Endpoints\n\n`;
                technical.apiEndpoints.forEach(endpoint => {
                    content += `### ${endpoint.method || 'GET'} ${endpoint.path || endpoint.url || ''}\n\n`;
                    if (endpoint.description) content += `${endpoint.description}\n\n`;
                    if (endpoint.parameters) {
                        content += `**Parameters:**\n`;
                        endpoint.parameters.forEach(param => {
                            content += `- ${param.name} (${param.type || 'string'}): ${param.description || ''}\n`;
                        });
                        content += `\n`;
                    }
                });
            }
        } catch (e) {
            console.warn('Failed to parse technical:', e);
        }
    }

    return content;
}

/**
 * Generate DESIGN_GUIDELINES.md content
 */
function generateDesignGuidelines(specData) {
    const title = specData.title || 'Application';
    let content = `# Design Guidelines: ${title}\n\n`;
    content += `Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
    content += `---\n\n`;

    if (specData.design) {
        try {
            const design = typeof specData.design === 'string' ? JSON.parse(specData.design) : specData.design;
            
            // Visual Style Guide
            if (design.visualStyleGuide) {
                content += `## Visual Style Guide\n\n`;
                
                if (design.visualStyleGuide.colors) {
                    content += `### Colors\n\n`;
                    Object.entries(design.visualStyleGuide.colors).forEach(([key, value]) => {
                        content += `- **${key}:** ${value}\n`;
                    });
                    content += `\n`;
                }

                if (design.visualStyleGuide.typography) {
                    content += `### Typography\n\n`;
                    if (design.visualStyleGuide.typography.fontFamily) {
                        content += `- **Font Family:** ${design.visualStyleGuide.typography.fontFamily}\n`;
                    }
                    if (design.visualStyleGuide.typography.fontSizes) {
                        content += `- **Font Sizes:** ${JSON.stringify(design.visualStyleGuide.typography.fontSizes, null, 2)}\n`;
                    }
                    content += `\n`;
                }
            }

            // UI Components
            if (specData.overview) {
                try {
                    const overview = typeof specData.overview === 'string' ? JSON.parse(specData.overview) : specData.overview;
                    if (overview.screenDescriptions && overview.screenDescriptions.screens) {
                        content += `## Screen Descriptions\n\n`;
                        overview.screenDescriptions.screens.forEach(screen => {
                            content += `### ${screen.name}\n\n`;
                            if (screen.description) content += `${screen.description}\n\n`;
                            if (screen.uiComponents && Array.isArray(screen.uiComponents)) {
                                content += `**UI Components:**\n`;
                                screen.uiComponents.forEach(component => {
                                    content += `- ${component}\n`;
                                });
                                content += `\n`;
                            }
                        });
                    }
                } catch (e) {
                    console.warn('Failed to parse overview for design:', e);
                }
            }
        } catch (e) {
            console.warn('Failed to parse design:', e);
        }
    }

    return content;
}

/**
 * Generate DEVELOPMENT_ROADMAP.md content
 * CRITICAL: This must include the FULL fullPrompt content
 */
function generateDevelopmentRoadmap(specData) {
    const title = specData.title || 'Application';
    let content = `# Development Roadmap: ${title}\n\n`;
    content += `Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
    content += `---\n\n`;

    // CRITICAL: Include the full fullPrompt content
    if (specData.prompts && specData.prompts.fullPrompt) {
        const fullPrompt = specData.prompts.fullPrompt;
        content += `## Complete Development Instructions\n\n`;
        content += `This document contains the complete, detailed development prompt with all 10 development stages.\n\n`;
        content += `---\n\n`;
        content += fullPrompt;
        content += `\n\n`;
    } else {
        content += `## Development Instructions\n\n`;
        content += `⚠️ **Note:** Development prompts have not been generated yet. Please generate prompts first.\n\n`;
    }

    // Include third-party integrations if available
    if (specData.prompts && specData.prompts.thirdPartyIntegrations && Array.isArray(specData.prompts.thirdPartyIntegrations) && specData.prompts.thirdPartyIntegrations.length > 0) {
        content += `\n---\n\n`;
        content += `## Third-Party Integrations\n\n`;
        specData.prompts.thirdPartyIntegrations.forEach((integration, index) => {
            content += `### ${index + 1}. ${integration.service || 'Integration'}\n\n`;
            if (integration.description) {
                content += `${integration.description}\n\n`;
            }
            if (integration.instructions && Array.isArray(integration.instructions)) {
                content += `**Setup Instructions:**\n\n`;
                integration.instructions.forEach((instruction, instIndex) => {
                    content += `${instIndex + 1}. ${instruction}\n`;
                });
                content += `\n`;
            }
        });
    }

    return content;
}

/**
 * Generate DIAGRAMS.md content
 */
function generateDiagramsDoc(specData) {
    const title = specData.title || 'Application';
    let content = `# System Diagrams: ${title}\n\n`;
    content += `Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
    content += `---\n\n`;

    if (specData.diagrams && specData.diagrams.diagrams && Array.isArray(specData.diagrams.diagrams)) {
        specData.diagrams.diagrams.forEach((diagram, index) => {
            content += `## ${index + 1}. ${diagram.title || diagram.name || `Diagram ${index + 1}`}\n\n`;
            if (diagram.description) {
                content += `${diagram.description}\n\n`;
            }
            if (diagram.mermaidCode) {
                content += `\`\`\`mermaid\n${diagram.mermaidCode}\n\`\`\`\n\n`;
            }
        });
    } else {
        content += `⚠️ **Note:** Diagrams have not been generated yet.\n\n`;
    }

    return content;
}

/**
 * Generate .cursorrules content
 */
function generateCursorRules(specData) {
    const title = specData.title || 'Application';
    let content = `# Cursor Rules for ${title}\n\n`;
    content += `This file contains coding standards, architecture guidelines, and project-specific rules for Cursor AI editor.\n\n`;
    content += `Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
    content += `---\n\n`;

    // Tech Stack
    if (specData.technical) {
        try {
            const technical = typeof specData.technical === 'string' ? JSON.parse(specData.technical) : specData.technical;
            if (technical.techStack) {
                content += `## Technology Stack\n\n`;
                if (technical.techStack.frontend) content += `- Frontend: ${technical.techStack.frontend}\n`;
                if (technical.techStack.backend) content += `- Backend: ${technical.techStack.backend}\n`;
                if (technical.techStack.database) content += `- Database: ${technical.techStack.database}\n`;
                content += `\n`;
            }
        } catch (e) {
            console.warn('Failed to parse technical for cursor rules:', e);
        }
    }

    // Coding Standards
    content += `## Coding Standards\n\n`;
    content += `- Follow TypeScript best practices and avoid 'any' types\n`;
    content += `- Ensure all code is accessible (WCAG 2.1 AA compliant)\n`;
    content += `- Optimize for performance from the start\n`;
    content += `- Write clean, maintainable, and scalable code\n`;
    content += `- Document API endpoints and component props\n`;
    content += `- Commit code frequently with descriptive commit messages\n\n`;

    // Reference to full prompt
    if (specData.prompts && specData.prompts.fullPrompt) {
        content += `## Development Instructions\n\n`;
        content += `For complete development instructions, see DEVELOPMENT_ROADMAP.md which contains the full development prompt with all 10 stages.\n\n`;
    }

    return content;
}

/**
 * Generate .windsurf/info.md content
 */
function generateWindsurfInfo(specData) {
    const title = specData.title || 'Application';
    let content = `# Windsurf Project Context: ${title}\n\n`;
    content += `This file provides project context for Windsurf AI agents.\n\n`;
    content += `Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
    content += `---\n\n`;

    // Project Overview
    if (specData.overview) {
        try {
            const overview = typeof specData.overview === 'string' ? JSON.parse(specData.overview) : specData.overview;
            if (overview.ideaSummary) {
                content += `## Project Overview\n\n${overview.ideaSummary}\n\n`;
            }
        } catch (e) {
            console.warn('Failed to parse overview for windsurf:', e);
        }
    }

    // Tech Stack
    if (specData.technical) {
        try {
            const technical = typeof specData.technical === 'string' ? JSON.parse(specData.technical) : specData.technical;
            if (technical.techStack) {
                content += `## Technology Stack\n\n`;
                if (technical.techStack.frontend) content += `- Frontend: ${technical.techStack.frontend}\n`;
                if (technical.techStack.backend) content += `- Backend: ${technical.techStack.backend}\n`;
                if (technical.techStack.database) content += `- Database: ${technical.techStack.database}\n`;
                content += `\n`;
            }
        } catch (e) {
            console.warn('Failed to parse technical for windsurf:', e);
        }
    }

    // Reference to full documentation
    content += `## Documentation\n\n`;
    content += `For complete project documentation, refer to:\n`;
    content += `- PROJECT_PLAN.md - Project overview and market analysis\n`;
    content += `- ARCHITECTURE.md - Technical specifications\n`;
    content += `- DESIGN_GUIDELINES.md - UI/UX guidelines\n`;
    content += `- DEVELOPMENT_ROADMAP.md - Complete development instructions with all stages\n`;
    content += `- DIAGRAMS.md - System diagrams\n\n`;

    return content;
}

/**
 * Generate README.md content
 */
function generateReadme(specData) {
    const title = specData.title || 'Application';
    let content = `# ${title}\n\n`;
    content += `This project was generated using [Specifys.ai](https://specifys-ai.com).\n\n`;
    content += `Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
    content += `---\n\n`;

    content += `## Quick Start\n\n`;
    content += `1. Review PROJECT_PLAN.md for project overview and market analysis\n`;
    content += `2. Review ARCHITECTURE.md for technical specifications\n`;
    content += `3. Review DESIGN_GUIDELINES.md for UI/UX guidelines\n`;
    content += `4. Follow DEVELOPMENT_ROADMAP.md for step-by-step development instructions\n`;
    content += `5. Review DIAGRAMS.md for system architecture diagrams\n\n`;

    content += `## AI Editor Integration\n\n`;
    content += `### Cursor\n`;
    content += `This project includes a \`.cursorrules\` file that Cursor will automatically detect and use for context-aware code suggestions.\n\n`;
    content += `### Windsurf\n`;
    content += `This project includes a \`.windsurf/info.md\` file that Windsurf AI agents will use to understand your project structure.\n\n`;

    content += `## Project Structure\n\n`;
    content += `- \`PROJECT_PLAN.md\` - Project overview and market analysis\n`;
    content += `- \`ARCHITECTURE.md\` - Technical specifications and API documentation\n`;
    content += `- \`DESIGN_GUIDELINES.md\` - UI/UX guidelines and design system\n`;
    content += `- \`DEVELOPMENT_ROADMAP.md\` - Complete development instructions with all 10 stages\n`;
    content += `- \`DIAGRAMS.md\` - System architecture diagrams (Mermaid format)\n`;
    content += `- \`.cursorrules\` - Cursor AI editor configuration\n`;
    content += `- \`.windsurf/info.md\` - Windsurf AI agent context\n\n`;

    return content;
}

/**
 * Generate metadata.json content
 */
function generateMetadata(specData) {
    return {
        exportType: 'cursor-windsurf',
        specTitle: specData.title || 'Application',
        specId: specData.id || null,
        exportDate: new Date().toISOString(),
        exportVersion: '1.0',
        includes: {
            projectPlan: true,
            architecture: true,
            designGuidelines: true,
            developmentRoadmap: true,
            diagrams: !!(specData.diagrams && specData.diagrams.diagrams),
            cursorRules: true,
            windsurfInfo: true,
            readme: true
        },
        hasFullPrompt: !!(specData.prompts && specData.prompts.fullPrompt),
        fullPromptLength: specData.prompts && specData.prompts.fullPrompt ? specData.prompts.fullPrompt.length : 0,
        thirdPartyIntegrationsCount: specData.prompts && specData.prompts.thirdPartyIntegrations ? specData.prompts.thirdPartyIntegrations.length : 0
    };
}

// Export function to global scope
if (typeof window !== 'undefined') {
    window.generateCursorWindsurfExport = generateCursorWindsurfExport;
}

