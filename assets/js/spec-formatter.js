// Spec Formatter - Reused formatting functions from spec-viewer.html

/**
 * Format text content - determines if JSON or plain text
 */
function formatTextContent(content) {
    if (!content) {
        return '<p>No content available</p>';
    }
    
    // Check if content is JSON
    let parsedContent;
    try {
        parsedContent = typeof content === 'string' ? JSON.parse(content) : content;
        return formatJSONContent(parsedContent);
    } catch (error) {
        return formatPlainTextContent(content);
    }
}

/**
 * Format JSON content - comprehensive version from spec-viewer
 */
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
    
    if (!jsonData || typeof jsonData !== 'object') {
        return '<p>No content available</p>';
    }
    
    // Helper function to get icon based on field name
    function getIcon(fieldName) {
        const lower = fieldName.toLowerCase();
        if (lower.includes('summary') || lower.includes('overview')) return 'fa-book';
        if (lower.includes('feature')) return 'fa-star';
        if (lower.includes('audience') || lower.includes('user') || lower.includes('persona')) return 'fa-users';
        if (lower.includes('problem')) return 'fa-exclamation-triangle';
        if (lower.includes('value') || lower.includes('proposition') || lower.includes('idea')) return 'fa-lightbulb-o';
        if (lower.includes('tech') || lower.includes('stack')) return 'fa-wrench';
        if (lower.includes('design') || lower.includes('ui') || lower.includes('ux')) return 'fa-paint-brush';
        if (lower.includes('market') || lower.includes('competition') || lower.includes('competitor')) return 'fa-bar-chart';
        if (lower.includes('price') || lower.includes('revenue') || lower.includes('monetization')) return 'fa-dollar-sign';
        if (lower.includes('journey') || lower.includes('flow')) return 'fa-road';
        if (lower.includes('screen')) return 'fa-desktop';
        if (lower.includes('database') || lower.includes('data') || lower.includes('schema') || lower.includes('model')) return 'fa-database';
        if (lower.includes('api') || lower.includes('endpoint')) return 'fa-plug';
        if (lower.includes('security') || lower.includes('auth')) return 'fa-lock';
        if (lower.includes('integration')) return 'fa-link';
        if (lower.includes('devops') || lower.includes('deployment')) return 'fa-server';
        if (lower.includes('analytics')) return 'fa-line-chart';
        if (lower.includes('swot')) return 'fa-search';
        if (lower.includes('pricing')) return 'fa-tag';
        return 'fa-cog';
    }
    
    // Helper to format a value recursively
    function formatValue(value, depth = 0) {
        if (depth > 3) return ''; // Prevent infinite recursion
        
        if (value === null || value === undefined) return '';
        
        if (typeof value === 'string') {
            return value.trim();
        }
        
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        
        if (Array.isArray(value)) {
            if (value.length === 0) return '';
            return value.map(item => typeof item === 'string' ? item : JSON.stringify(item)).join(', ');
        }
        
        if (typeof value === 'object') {
            if (Object.keys(value).length === 0) return '';
            // For objects, return structured display
            let result = '';
            for (let key in value) {
                if (value.hasOwnProperty(key) && value[key] !== null && value[key] !== undefined) {
                    result += `<strong>${key}:</strong> ${formatValue(value[key], depth + 1)}; `;
                }
            }
            return result;
        }
        
        return String(value);
    }
    
    // Format each field
    for (let key in jsonData) {
        const value = jsonData[key];
        
        // Skip metadata fields
        if (key === 'meta' || key === '__proto__' || key.includes('Id') || key.includes('Time') || key.includes('Date') || key.includes('timestamp') || key === 'userId' || key === 'userName') continue;
        if (!value || value === null || value === undefined) continue;
        
        // Get icon
        const icon = getIcon(key);
        
        // Create section
        html += '<div class="content-section">';
        html += `<h3><i class="fa ${icon}"></i> ${key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}</h3>`;
        
        // Format based on type
        if (typeof value === 'string') {
            html += `<p>${value}</p>`;
        } else if (Array.isArray(value)) {
            if (value.length === 0) {
                html += '<p>No items</p>';
            } else {
                html += '<ul>';
                value.forEach(item => {
                    if (typeof item === 'string') {
                        html += `<li>${item}</li>`;
                    } else if (typeof item === 'object') {
                        html += '<li>';
                        for (let itemKey in item) {
                            const itemValue = item[itemKey];
                            if (typeof itemValue === 'string') {
                                html += `<strong>${itemKey}:</strong> ${itemValue} `;
                            } else if (Array.isArray(itemValue)) {
                                html += `<strong>${itemKey}:</strong> ${itemValue.join(', ')} `;
                            }
                        }
                        html += '</li>';
                    } else {
                        html += `<li>${item}</li>`;
                    }
                });
                html += '</ul>';
            }
        } else if (typeof value === 'object') {
            // Check if it's a special structure we should handle
            if (value.data && Array.isArray(value.data)) {
                // Handle table structures
                html += '<table><thead><tr>';
                const firstRow = value.data[0];
                if (typeof firstRow === 'object') {
                    for (let col in firstRow) {
                        html += `<th>${col}</th>`;
                    }
                    html += '</tr></thead><tbody>';
                    value.data.forEach(row => {
                        html += '<tr>';
                        for (let col in row) {
                            html += `<td>${row[col] || ''}</td>`;
                        }
                        html += '</tr>';
                    });
                    html += '</tbody></table>';
                }
            } else {
                // Regular object - show as formatted list
                html += '<ul>';
                for (let subKey in value) {
                    if (value.hasOwnProperty(subKey)) {
                        const subValue = value[subKey];
                        if (subValue !== null && subValue !== undefined && subValue !== '') {
                            if (typeof subValue === 'string') {
                                html += `<li><strong>${subKey}:</strong> ${subValue}</li>`;
                            } else if (Array.isArray(subValue)) {
                                html += `<li><strong>${subKey}:</strong> ${subValue.join(', ')}</li>`;
                            } else if (typeof subValue === 'object') {
                                html += `<li><strong>${subKey}:</strong> <pre>${JSON.stringify(subValue, null, 2)}</pre></li>`;
                            }
                        }
                    }
                }
                html += '</ul>';
            }
        }
        
        html += '</div>';
    }
    
    return html || '<p>No structured content available</p>';
}

/**
 * Format plain text content
 */
function formatPlainTextContent(content) {
    if (!content || typeof content !== 'string') {
        return '<p>No content available</p>';
    }
    
    // Helper function to get icon
    function getIconForSection(title) {
        const lower = title.toLowerCase();
        if (lower.match(/summary|overview|introduction/i)) return 'fa-book';
        if (lower.match(/features/i)) return 'fa-star';
        if (lower.match(/audience|users|target|demographics/i)) return 'fa-users';
        if (lower.match(/problem/i)) return 'fa-exclamation-triangle';
        if (lower.match(/value|proposition/i)) return 'fa-lightbulb-o';
        if (lower.match(/tech|stack/i)) return 'fa-cog';
        if (lower.match(/design|ui|ux/i)) return 'fa-paint-brush';
        if (lower.match(/market|competition/i)) return 'fa-bar-chart';
        if (lower.match(/monetization|pricing|revenue/i)) return 'fa-dollar-sign';
        if (lower.match(/journey|flow/i)) return 'fa-road';
        return 'fa-check-circle';
    }
    
    // Format section content
    function formatSectionContent(text) {
        if (!text) return '';
        
        const lines = text.split('\n').filter(line => line.trim());
        let html = '';
        let inList = false;
        let currentParagraph = '';
        
        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;
            
            if (trimmed.match(/^[-•*]\s/) || trimmed.match(/^\d+[\.\)]\s/)) {
                if (currentParagraph) {
                    html += `<p>${currentParagraph}</p>`;
                    currentParagraph = '';
                }
                if (!inList) {
                    html += '<ul>';
                    inList = true;
                }
                const listItem = trimmed.replace(/^[-•*]\s/, '').replace(/^\d+[\.\)]\s/, '');
                html += `<li>${listItem}</li>`;
            } else if (trimmed.includes(':') && trimmed.length < 200) {
                if (currentParagraph) {
                    html += `<p>${currentParagraph}</p>`;
                    currentParagraph = '';
                }
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }
                const parts = trimmed.split(':');
                html += `<h4>${parts[0].trim()}:</h4>`;
                if (parts.slice(1).join(':').trim()) {
                    html += `<p>${parts.slice(1).join(':').trim()}</p>`;
                }
            } else {
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }
                currentParagraph += (currentParagraph ? ' ' : '') + trimmed;
            }
        });
        
        if (currentParagraph) html += `<p>${currentParagraph}</p>`;
        if (inList) html += '</ul>';
        
        return html;
    }
    
    // Split by "---"
    let sections = content.includes('---') 
        ? content.split(/---+/).filter(s => s.trim()) 
        : [content];
    
    let html = '';
    sections.forEach((section, index) => {
        const trimmed = section.trim();
        if (!trimmed) return;
        
        const lines = trimmed.split('\n');
        const firstLine = lines[0].trim();
        let sectionTitle = '';
        let sectionContent = '';
        
        if (firstLine.includes(':') && firstLine.length < 150) {
            const parts = firstLine.split(':');
            sectionTitle = parts[0].trim();
            sectionContent = (parts.slice(1).join(':') + '\n' + lines.slice(1).join('\n')).trim();
        } else {
            sectionTitle = `Section ${index + 1}`;
            sectionContent = trimmed;
        }
        
        const icon = getIconForSection(sectionTitle);
        html += '<div class="content-section">';
        html += `<h3><i class="fa ${icon}"></i> ${sectionTitle}</h3>`;
        html += formatSectionContent(sectionContent);
        html += '</div>';
    });
    
    return html || `<p>${content.replace(/\n/g, '<br>')}</p>`;
}

/**
 * Format diagrams with title and description
 */
function formatDiagrams(diagrams) {
    if (!diagrams) {
        return '<div class="content-section"><p>No diagrams available</p></div>';
    }
    
    if (diagrams.diagrams && Array.isArray(diagrams.diagrams) && diagrams.diagrams.length > 0) {
        const validDiagrams = diagrams.diagrams.filter(d => 
            d && d.mermaidCode && typeof d.mermaidCode === 'string' && d.mermaidCode.trim().length > 0
        );
        
        if (validDiagrams.length === 0) {
            return '<div class="content-section"><p>No valid diagrams found</p></div>';
        }
        
        let html = '';
        validDiagrams.forEach(diagram => {
            html += '<div class="content-section">';
            if (diagram.name) {
                html += `<h3><i class="fa fa-project-diagram"></i> ${diagram.name}</h3>`;
            }
            if (diagram.description) {
                html += `<p style="color: #666; margin-bottom: 15px;">${diagram.description}</p>`;
            }
            html += '<div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; background: #fafafa;">';
            html += `<div class="mermaid" style="margin: 0;">${diagram.mermaidCode}</div>`;
            html += '</div>';
            html += '</div>';
        });
        
        return html;
    }
    
    if (diagrams.mermaid) {
        return `<div class="content-section"><div class="mermaid">${diagrams.mermaid}</div></div>`;
    }
    
    return '<div class="content-section"><p>No diagrams available</p></div>';
}

