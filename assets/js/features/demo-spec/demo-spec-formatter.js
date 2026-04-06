// ============================================
// Demo Spec Formatter - Format functions for demo spec display
// ============================================
// This file contains all formatting functions extracted from old demo-spec.html
// These functions format the demo spec data for display

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format Overview section
function formatOverview(data) {
    let html = '';
    
    // Application Summary
    if (data.applicationSummary && data.applicationSummary.paragraphs) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-clipboard"></i> Application Summary</h3>';
        // Show only first half of paragraphs (rounded up)
        const paragraphsToShow = Math.ceil(data.applicationSummary.paragraphs.length / 2);
        data.applicationSummary.paragraphs.slice(0, paragraphsToShow).forEach(p => {
            html += `<p>${p}</p>`;
        });
        html += '</div>';
    }
    
    // Screens
    if (data.screenDescriptions && data.screenDescriptions.screens && Array.isArray(data.screenDescriptions.screens)) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-desktop"></i> Screens (' + data.screenDescriptions.screens.length + ' total)</h3>';
        
        html += '<div class="screens-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0;">';
        
        data.screenDescriptions.screens.forEach((screen, index) => {
            const screenName = screen.name || `Screen ${index + 1}`;
            const screenDescription = screen.description || 'No description provided';
            const uiComponents = screen.uiComponents || [];
            
            html += '<div class="screen-card" style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform=\'translateY(-2px)\'; this.style.boxShadow=\'0 4px 8px rgba(0,0,0,0.15)\';" onmouseout="this.style.transform=\'translateY(0)\'; this.style.boxShadow=\'0 2px 4px rgba(0,0,0,0.1)\';">';
            html += '<h5 style="margin: 0 0 12px 0; color: #FF6B35; font-size: 1.1em; border-bottom: 2px solid #FF6B35; padding-bottom: 8px;">' + escapeHtml(screenName) + '</h5>';
            html += '<p style="margin: 0 0 15px 0; color: #333; line-height: 1.6;">' + escapeHtml(screenDescription) + '</p>';
            
            if (uiComponents.length > 0) {
                html += '<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">';
                html += '<div style="font-size: 0.9em; font-weight: bold; color: #555; margin-bottom: 10px;">UI Components:</div>';
                html += '<ul style="margin: 0; padding-left: 20px; list-style-type: disc;">';
                uiComponents.forEach(component => {
                    const componentText = typeof component === 'string' ? component : component.name || component;
                    html += '<li style="margin-bottom: 6px; color: #666; font-size: 0.9em; line-height: 1.5;">' + escapeHtml(componentText) + '</li>';
                });
                html += '</ul>';
                html += '</div>';
            }
            
            html += '</div>';
        });
        
        html += '</div>';
        
        if (data.screenDescriptions.navigationStructure) {
            html += '<div style="margin-top: 30px;">';
            html += '<h4>Navigation Structure:</h4>';
            html += '<p style="line-height: 1.6;">' + escapeHtml(data.screenDescriptions.navigationStructure) + '</p>';
            html += '</div>';
        }
        
        html += '</div>';
    }
    
    // Core Features
    if (data.coreFeatures && Array.isArray(data.coreFeatures)) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-star"></i> Core Features</h3>';
        html += '<ul>';
        data.coreFeatures.forEach(feature => {
            html += `<li>${feature}</li>`;
        });
        html += '</ul>';
        html += '</div>';
    }
    
    // Unique Value Proposition
    if (data.uniqueValueProposition) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-lightbulb-o"></i> Unique Value Proposition</h3>';
        html += `<p>${data.uniqueValueProposition}</p>`;
        html += '</div>';
    }
    
    // Target Audience
    if (data.targetAudience) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-users"></i> Target Audience</h3>';
        if (data.targetAudience.primary) {
            html += `<p><strong>Primary Users:</strong> ${data.targetAudience.primary}</p>`;
        }
        if (data.targetAudience.characteristics) {
            html += `<p><strong>Characteristics:</strong> ${data.targetAudience.characteristics}</p>`;
        }
        if (data.targetAudience.painPoints) {
            html += `<p><strong>Pain Points:</strong> ${data.targetAudience.painPoints}</p>`;
        }
        html += '</div>';
    }
    
    // Problem Statement
    if (data.problemStatement) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-exclamation-triangle"></i> Problem Statement</h3>';
        html += `<p style="font-size: 18px; line-height: 1.8; color: #DC2626;">${data.problemStatement}</p>`;
        html += '</div>';
    }
    
    // Business Model
    if (data.businessModel) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-building"></i> Business Model</h3>';
        html += `<p style="font-size: 18px; line-height: 1.8;">${data.businessModel}</p>`;
        html += '</div>';
    }
    
    // Competitive Advantage
    if (data.competitiveAdvantage) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-trophy"></i> Competitive Advantage</h3>';
        html += `<p style="font-size: 18px; line-height: 1.8;">${data.competitiveAdvantage}</p>`;
        html += '</div>';
    }
    
    // Success Metrics
    if (data.successMetrics) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-bar-chart"></i> Success Metrics</h3>';
        
        if (data.successMetrics.userEngagement) {
            html += '<div style="background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%); padding: 20px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #6366F1;">';
            html += '<h4><i class="fa fa-users" style="color: #6366F1; margin-right: 10px;"></i>User Engagement</h4>';
            html += `<p style="font-size: 16px;">${data.successMetrics.userEngagement}</p>`;
            html += '</div>';
        }
        
        if (data.successMetrics.productivityImprovement) {
            html += '<div style="background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%); padding: 20px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #10B981;">';
            html += '<h4><i class="fa fa-line-chart" style="color: #10B981; margin-right: 10px;"></i>Productivity Improvement</h4>';
            html += `<p style="font-size: 16px;">${data.successMetrics.productivityImprovement}</p>`;
            html += '</div>';
        }
        
        if (data.successMetrics.businessMetrics) {
            html += '<div style="background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%); padding: 20px; border-radius: 10px; border-left: 4px solid #F59E0B;">';
            html += '<h4><i class="fa fa-dollar-sign" style="color: #F59E0B; margin-right: 10px;"></i>Business Metrics</h4>';
            html += `<p style="font-size: 16px;">${data.successMetrics.businessMetrics}</p>`;
            html += '</div>';
        }
        
        html += '</div>';
    }
    
    // Complexity Score
    const complexityScore = {
        architecture: 90,
        integrations: 85,
        functionality: 88,
        userSystem: 80,
        total: 87
    };
    html += renderComplexityScore(complexityScore);

    return html;
}

// Render Complexity Score
function renderComplexityScore(score) {
    return `
        <div class="content-section" style="margin-top: 30px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                <h3><i class="fa fa-chart-line"></i> Complexity Score</h3>
                <div style="font-size: 32px; font-weight: bold; color: ${score.total <= 40 ? '#10B981' : score.total <= 70 ? '#F59E0B' : '#EF4444'};">
                    ${score.total}/100
                </div>
            </div>
            
            <div style="display: grid; gap: 20px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="flex: 0 0 150px; font-weight: 600; color: #374151;">Architecture</div>
                    <div style="flex: 1; height: 24px; background: #E5E7EB; border-radius: 12px; overflow: hidden; position: relative;">
                        <div style="height: 100%; width: ${score.architecture}%; background: ${score.architecture <= 40 ? '#10B981' : score.architecture <= 70 ? '#F59E0B' : '#EF4444'}; transition: width 0.3s;"></div>
                    </div>
                    <div style="flex: 0 0 50px; text-align: right; font-weight: 600; color: #6B7280;">${score.architecture}</div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="flex: 0 0 150px; font-weight: 600; color: #374151;">Integrations</div>
                    <div style="flex: 1; height: 24px; background: #E5E7EB; border-radius: 12px; overflow: hidden; position: relative;">
                        <div style="height: 100%; width: ${score.integrations}%; background: ${score.integrations <= 40 ? '#10B981' : score.integrations <= 70 ? '#F59E0B' : '#EF4444'}; transition: width 0.3s;"></div>
                    </div>
                    <div style="flex: 0 0 50px; text-align: right; font-weight: 600; color: #6B7280;">${score.integrations}</div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="flex: 0 0 150px; font-weight: 600; color: #374151;">Functionality</div>
                    <div style="flex: 1; height: 24px; background: #E5E7EB; border-radius: 12px; overflow: hidden; position: relative;">
                        <div style="height: 100%; width: ${score.functionality}%; background: ${score.functionality <= 40 ? '#10B981' : score.functionality <= 70 ? '#F59E0B' : '#EF4444'}; transition: width 0.3s;"></div>
                    </div>
                    <div style="flex: 0 0 50px; text-align: right; font-weight: 600; color: #6B7280;">${score.functionality}</div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="flex: 0 0 150px; font-weight: 600; color: #374151;">User System</div>
                    <div style="flex: 1; height: 24px; background: #E5E7EB; border-radius: 12px; overflow: hidden; position: relative;">
                        <div style="height: 100%; width: ${score.userSystem}%; background: ${score.userSystem <= 40 ? '#10B981' : score.userSystem <= 70 ? '#F59E0B' : '#EF4444'}; transition: width 0.3s;"></div>
                    </div>
                    <div style="flex: 0 0 50px; text-align: right; font-weight: 600; color: #6B7280;">${score.userSystem}</div>
                </div>
            </div>
        </div>
    `;
}

// Format Technical section
function formatTechnical(data) {
    let html = '';
    
    if (data.technologyStackHighlights && Array.isArray(data.technologyStackHighlights) && data.technologyStackHighlights.length) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-cubes"></i> Technology Stack Highlights</h3>';
        data.technologyStackHighlights.forEach(section => {
            html += '<div>';
            html += `<h4>${section.title}</h4>`;
            if (section.description) {
                html += `<p>${section.description}</p>`;
            }
            if (Array.isArray(section.points) && section.points.length) {
                html += '<ul>';
                section.points.forEach(point => {
                    html += `<li>${point}</li>`;
                });
                html += '</ul>';
            }
            html += '</div>';
        });
        html += '</div>';
    }

    // Tech Stack
    if (data.techStack) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-wrench"></i> Technology Stack</h3>';
        
        // Iterate through each category (frontend, backend, database, etc.)
        for (let category in data.techStack) {
            const categoryData = data.techStack[category];
            
            // Check if it's the new nested structure
            if (typeof categoryData === 'object' && !Array.isArray(categoryData)) {
                html += `<h4 style="margin-top: 25px; margin-bottom: 15px; color: #6366F1; font-size: 20px;"><i class="fa fa-folder-open"></i> ${category.charAt(0).toUpperCase() + category.slice(1).replace(/([A-Z])/g, ' $1')}</h4>`;
                html += '<ul>';
                for (let item in categoryData) {
                    html += `<li style="margin-bottom: 10px;"><strong>${item.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</strong> ${categoryData[item]}</li>`;
                }
                html += '</ul>';
            } else {
                // Fallback for old structure
                html += `<li><strong>${category.charAt(0).toUpperCase() + category.slice(1)}:</strong> ${categoryData}</li>`;
            }
        }
        
        html += '</div>';
    }
    
    // Architecture Overview (string legacy or v2 object)
    if (data.architectureOverview) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-building"></i> Architecture Overview</h3>';
        if (typeof data.architectureOverview === 'string') {
            html += `<p>${data.architectureOverview}</p>`;
        } else if (typeof data.architectureOverview === 'object' && data.architectureOverview.narrative) {
            html += `<p>${data.architectureOverview.narrative}</p>`;
        }
        html += '</div>';
    }
    
    // Database Schema
    if (data.databaseSchema) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-database"></i> Database Schema</h3>';
        if (data.databaseSchema.description) {
            html += `<p>${data.databaseSchema.description}</p>`;
        }
        const dbTables = (data.databaseSchema.tables && Array.isArray(data.databaseSchema.tables))
            ? data.databaseSchema.tables
            : (data.databaseSchema.tablesSupplement && Array.isArray(data.databaseSchema.tablesSupplement) ? data.databaseSchema.tablesSupplement : null);
        if (dbTables) {
            html += '<h4>Database Tables:</h4>';
            html += '<ul>';
            dbTables.forEach(table => {
                if (typeof table === 'object' && table.name) {
                    html += `<li><strong>${table.name}:</strong> ${table.columns ? table.columns.join(', ') : 'No columns specified'}</li>`;
                } else {
                    html += `<li>${table}</li>`;
                }
            });
            html += '</ul>';
        }
        html += '</div>';
    }
    
    // API Endpoints (v2: apiDesign.endpoints)
    const demoApiList = (data.apiDesign && data.apiDesign.endpoints) || data.apiEndpoints;
    if (demoApiList && Array.isArray(demoApiList)) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-plug"></i> API Endpoints</h3>';
        html += '<ul>';
        demoApiList.forEach(endpoint => {
            html += `<li><strong>${endpoint.method}</strong> <code>${endpoint.path}</code> - ${endpoint.description}</li>`;
        });
        html += '</ul>';
        html += '</div>';
    }
    
    // Security & Authentication with Critical Points
    html += '<div class="content-section">';
    html += '<h3><i class="fa fa-lock"></i> Security & Authentication</h3>';
    
    // Security Critical Points
    const securityCriticalPoints = [
        "CRITICAL: Never store API keys, secrets, or sensitive credentials in frontend code. Always use backend server or environment variables for OpenAI API keys, database credentials, and third-party service tokens.",
        "CRITICAL: Always validate and sanitize all user inputs on the backend to prevent injection attacks (SQL injection, XSS, etc.). This is especially important for task creation, user comments, and AI prompt inputs.",
        "CRITICAL: Use HTTPS for all API communications and never send sensitive data over unencrypted connections. All WebSocket connections for real-time collaboration must use WSS (WebSocket Secure).",
        "CRITICAL: Implement proper authentication tokens (JWT) with expiration and refresh mechanisms. Never store passwords in plain text - use bcrypt or similar hashing algorithms with salt.",
        "CRITICAL: Use CORS properly configured on the backend to prevent unauthorized cross-origin requests. Never use wildcard (*) in production - specify exact allowed origins.",
        "CRITICAL: Implement rate limiting on all API endpoints, especially for AI-powered features and task creation, to prevent abuse and ensure fair usage.",
        "CRITICAL: Encrypt sensitive task data at rest in the database, especially for enterprise customers with compliance requirements (SOC 2, GDPR, HIPAA)."
    ];
    
    if (securityCriticalPoints && Array.isArray(securityCriticalPoints) && securityCriticalPoints.length > 0) {
        html += '<div style="margin-bottom: 25px;">';
        securityCriticalPoints.forEach((point, index) => {
            html += `
                <div style="background-color: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; padding: 12px; margin-bottom: 10px; border-radius: 6px; border-left: 4px solid #dc2626; display: flex; align-items: flex-start;">
                    <i class="fa fa-exclamation-triangle" style="font-size: 18px; margin-right: 10px; margin-top: 2px; flex-shrink: 0; color: #dc2626;"></i>
                    <div style="flex: 1;">
                        <strong style="display: block; margin-bottom: 5px; font-size: 14px; color: #991b1b;">CRITICAL SECURITY WARNING</strong>
                        <p style="margin: 0; line-height: 1.5; color: #991b1b;">${point}</p>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    html += '<h4>Authentication Methods</h4>';
    html += '<p>Taskify Pro uses NextAuth.js v5 with OAuth 2.0 providers (Google, Microsoft, GitHub, Apple) for social login, JWT tokens with refresh mechanism, and secure cookie storage.</p>';
    
    html += '<h4>Authorization & Permissions</h4>';
    html += '<p>Granular role-based access control (RBAC) with roles: owners, admins, members, and viewers. Each role has specific permissions for tasks, projects, and team management.</p>';
    
    html += '<h4>Data Encryption</h4>';
    html += '<p>End-to-end encryption for all task data, TLS/SSL for data in transit, and encrypted storage at rest using AES-256 encryption for sensitive fields.</p>';
    
    html += '<h4>Additional Security Measures</h4>';
    html += '<ul>';
    html += '<li>Multi-factor authentication (MFA) via TOTP for sensitive actions</li>';
    html += '<li>Session management with automatic timeout and secure session storage</li>';
    html += '<li>Audit logs for all user actions and system changes</li>';
    html += '<li>Regular security audits and penetration testing</li>';
    html += '<li>Compliance with SOC 2, GDPR, and HIPAA standards</li>';
    html += '</ul>';
    
    html += '</div>';
    
    return html;
}

// Format Market section
function formatMarket(data) {
    let html = '';
    
    // Market Size with Stats
    if (data.marketSize) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-line-chart"></i> Market Opportunity</h3>';
        html += `<p style="font-size: 18px; line-height: 1.8;">${data.marketSize}</p>`;
        
        // Add stat cards
            html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 25px 0;">';
            html += '<div class="stat-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">';
            html += '<h4 style="color: white !important;">Market Size 2024</h4><div class="stat-value" style="color: white !important;">$6.76B</div></div>';
            html += '<div class="stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">';
            html += '<h4 style="color: white !important;">Projected 2030</h4><div class="stat-value" style="color: white !important;">$14.6B</div></div>';
            html += '<div class="stat-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">';
            html += '<h4 style="color: white !important;">CAGR Growth</h4><div class="stat-value" style="color: white !important;">14.2%</div></div>';
            html += '</div>';
        
        html += '</div>';
    }
    
    // Market Trends
    if (data.marketTrends && Array.isArray(data.marketTrends)) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-trending-up"></i> Market Trends</h3>';
        html += '<ul>';
        data.marketTrends.forEach(trend => {
            html += `<li style="font-size: 16px; margin-bottom: 15px;">${trend}</li>`;
        });
        html += '</ul>';
        html += '</div>';
    }
    
    // Target Customers
    if (data.targetCustomers) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-bullseye"></i> Target Market</h3>';
        html += `<p style="font-size: 18px; line-height: 1.8;">${data.targetCustomers}</p>`;
        html += '</div>';
    }
    
    // Market Growth Chart
    if (data.charts && data.charts.marketGrowth) {
        html += '<div class="content-section">';
        html += `<h3><i class="fa fa-area-chart"></i> ${data.charts.marketGrowth.title}</h3>`;
        html += '<div class="chart-container"><canvas id="marketGrowthChart"></canvas></div>';
        html += '</div>';
    }
    
    // Search Trends Chart
    if (data.charts && data.charts.searchTrends) {
        html += '<div class="content-section">';
        html += `<h3><i class="fa fa-trending-up"></i> ${data.charts.searchTrends.title}</h3>`;
        html += '<div class="chart-container"><canvas id="searchTrendsChart"></canvas></div>';
        html += '<p style="color: #666; font-size: 14px; margin-top: 15px;"><i class="fa fa-info-circle"></i> Data shows relative search interest over time. Values are normalized to 0-100 scale where 100 represents peak popularity.</p>';
        html += '</div>';
    }
    
    // Keyword Demand
    if (data.charts && data.charts.keywordDemand) {
        html += '<div class="content-section">';
        html += `<h3><i class="fa fa-search"></i> ${data.charts.keywordDemand.title}</h3>`;
        html += '<div class="chart-container"><canvas id="keywordDemandChart"></canvas></div>';
        html += '<p style="color: #666; font-size: 14px; margin-top: 15px;"><i class="fa fa-info-circle"></i> Monthly search volume estimates based on Google Keyword Planner data.</p>';
        html += '</div>';
    }
    
    // Competitive Landscape
    if (data.competitiveLandscape && Array.isArray(data.competitiveLandscape)) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-bar-chart"></i> Competitive Analysis</h3>';
        
        data.competitiveLandscape.forEach(competitor => {
            html += '<div style="margin-bottom: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; border-left: 4px solid #6366F1;">';
            html += `<h4 style="color: #333; margin-bottom: 15px;">${competitor.competitor}</h4>`;
            html += `<p><strong style="color: #10B981;">Advantages:</strong> ${competitor.advantages}</p>`;
            html += `<p><strong style="color: #EF4444;">Disadvantages:</strong> ${competitor.disadvantages}</p>`;
            html += `<p><strong>Market Position:</strong> ${competitor.marketPosition}</p>`;
            html += '</div>';
        });
        
        html += '</div>';
    }
    
    // Pricing Strategy
    if (data.pricingStrategy && data.pricingStrategy.pricing) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-dollar-sign"></i> Pricing Strategy</h3>';
        if (data.pricingStrategy.recommendations) {
            html += `<p>${data.pricingStrategy.recommendations}</p>`;
        }
        
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 20px;">';
        data.pricingStrategy.pricing.forEach(plan => {
            html += '<div style="border: 2px solid #e0e0e0; border-radius: 12px; padding: 25px; background: white; display: flex; flex-direction: column; min-height: 400px;">';
            html += `<h4 style="margin-bottom: 10px; color: #333; font-size: 20px;">${plan.plan}</h4>`;
            html += `<div style="font-size: 32px; font-weight: bold; color: #6366F1; margin-bottom: 20px; word-break: break-word;">${plan.price}</div>`;
            html += '<ul style="list-style: none; padding: 0; margin: 15px 0; flex: 1;">';
            plan.features.forEach(feature => {
                html += `<li style="margin-bottom: 10px; font-size: 14px; line-height: 1.5;"><i class="fa fa-check" style="color: #10B981; margin-right: 8px;"></i><span style="word-wrap: break-word;">${feature}</span></li>`;
            });
            html += '</ul>';
            html += `<p style="color: #666; font-size: 14px; margin-top: auto;"><strong>Target:</strong> ${plan.target}</p>`;
            html += '</div>';
        });
        html += '</div>';
        html += '</div>';
    }
    
    // Market Opportunity
    if (data.marketOpportunity) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-chart-line"></i> Market Opportunity</h3>';
        html += `<p>${data.marketOpportunity}</p>`;
        html += '</div>';
    }
    
    return html;
}

// Format Design section - simplified version for demo
function formatDesign(data) {
    let html = '';
    
    // Design Philosophy
    if (data.designPhilosophy) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-paint-brush"></i> Design Philosophy</h3>';
        html += `<p style="font-size: 18px; line-height: 1.8;">${data.designPhilosophy}</p>`;
        html += '</div>';
    }
    
    // Brand Identity
    if (data.brandIdentity) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-lightbulb-o"></i> Brand Identity</h3>';
        
        if (data.brandIdentity.mission) {
            html += `<h4>Mission</h4>`;
            html += `<p>${data.brandIdentity.mission}</p>`;
        }
        
        if (data.brandIdentity.personality) {
            html += `<h4>Personality</h4>`;
            html += `<p>${data.brandIdentity.personality}</p>`;
        }
        
        if (data.brandIdentity.voice) {
            html += `<h4>Brand Voice</h4>`;
            html += `<p>${data.brandIdentity.voice}</p>`;
        }
        
        if (data.brandIdentity.values && Array.isArray(data.brandIdentity.values)) {
            html += '<h4>Core Values</h4>';
            html += '<ul>';
            data.brandIdentity.values.forEach(value => {
                html += `<li style="font-size: 16px; margin-bottom: 10px;">${value}</li>`;
            });
            html += '</ul>';
        }
        
        html += '</div>';
    }
    
    // Color Palette
    if (data.colorPalette) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-palette"></i> Color Palette</h3>';
        html += '<div class="feature-grid">';
        for (let key in data.colorPalette) {
            const value = data.colorPalette[key];
            const colorMatch = value.match(/^#?[0-9A-Fa-f]{6}/);
            const color = colorMatch ? colorMatch[0] : '#6366F1';
            const dashIndex = value.indexOf(' - ');
            const description = dashIndex > 0 ? value.substring(dashIndex + 3) : '';
            
            html += '<div style="background: white; padding: 20px; border-radius: 10px; border: 2px solid #e0e0e0; text-align: center;">';
            html += `<div style="width: 60px; height: 60px; border-radius: 12px; background: ${color}; margin: 0 auto 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"></div>`;
            html += `<div style="font-weight: 600; margin-bottom: 5px;">${key.charAt(0).toUpperCase() + key.slice(1)}</div>`;
            html += `<div style="color: #666; font-size: 14px;">${color}</div>`;
            if (description) {
                html += `<div style="color: #888; font-size: 13px; margin-top: 5px;">${description}</div>`;
            }
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';
    }
    
    // Typography
    if (data.typography) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-font"></i> Typography System</h3>';
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">';
        for (let key in data.typography) {
            html += '<div style="background: #f9f9f9; padding: 20px; border-radius: 10px; border-left: 4px solid #6366F1;">';
            html += `<h4 style="margin-bottom: 10px;">${key.charAt(0).toUpperCase() + key.slice(1)}</h4>`;
            html += `<p>${data.typography[key]}</p>`;
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';
    }
    
    // App Icon Mockup
    if (data.appIcon) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-mobile"></i> App Icon Design</h3>';
        html += '<div style="display: flex; gap: 30px; align-items: center; flex-wrap: wrap;">';
        html += '<div style="text-align: center;">';
        html += '<div style="width: 120px; height: 120px; border-radius: 25px; background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); display: flex; align-items: center; justify-content: center; font-size: 48px; font-weight: bold; color: white; box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);">TP</div>';
        html += '<p style="margin-top: 15px; font-weight: 600;">iOS App Icon</p>';
        html += '</div>';
        html += '<div style="text-align: center;">';
        html += '<div style="width: 120px; height: 120px; border-radius: 20px; background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); display: flex; align-items: center; justify-content: center; font-size: 48px; font-weight: bold; color: white; box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);">TP</div>';
        html += '<p style="margin-top: 15px; font-weight: 600;">Android App Icon</p>';
        html += '</div>';
        if (data.appIcon.design) {
            html += '<div style="flex: 1; padding: 20px;">';
            html += `<p>${data.appIcon.design}</p>`;
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';
    }
    
    // Spacing System
    if (data.spacingSystem) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-ruler"></i> Spacing System</h3>';
        html += '<ul>';
        for (let key in data.spacingSystem) {
            html += `<li style="font-size: 16px; margin-bottom: 10px;"><strong>${key}:</strong> ${data.spacingSystem[key]}</li>`;
        }
        html += '</ul>';
        html += '</div>';
    }
    
    // UI Components
    if (data.components && Array.isArray(data.components)) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-cubes"></i> UI Components</h3>';
        html += '<div class="feature-grid">';
        data.components.forEach(component => {
            html += '<div class="feature-card">';
            html += '<i class="fa fa-check" style="color: #10B981; margin-right: 10px; font-size: 18px;"></i>';
            html += `<span style="font-size: 16px;">${component}</span>`;
            html += '</div>';
        });
        html += '</div>';
        html += '</div>';
    }
    
    // UI Principles
    if (data.uiPrinciples && Array.isArray(data.uiPrinciples)) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-gavel"></i> UI Design Principles</h3>';
        html += '<ul>';
        data.uiPrinciples.forEach(principle => {
            html += `<li style="font-size: 16px; margin-bottom: 10px;">${principle}</li>`;
        });
        html += '</ul>';
        html += '</div>';
    }
    
    // Design Tokens
    if (data.designTokens) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-code"></i> Design Tokens</h3>';
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px;">';
        for (let key in data.designTokens) {
            html += '<div style="background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%); padding: 20px; border-radius: 10px; border-left: 4px solid #6366F1;">';
            html += `<div style="font-weight: 600; margin-bottom: 8px; color: #4338CA;">${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</div>`;
            html += `<div style="color: #6B7280; font-size: 15px;">${data.designTokens[key]}</div>`;
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';
    }
    
    // Brand Assets
    if (data.brandAssets) {
        html += '<div class="content-section">';
        html += '<h3><i class="fa fa-diamond"></i> Brand Assets</h3>';
        html += '<div class="feature-grid">';
        for (let key in data.brandAssets) {
            html += '<div class="feature-card">';
            html += `<i class="fa fa-file-image-o" style="color: #6366F1; margin-right: 10px; font-size: 20px;"></i>`;
            html += `<div><strong>${key.charAt(0).toUpperCase() + key.slice(1)}:</strong> ${data.brandAssets[key]}</div>`;
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';
    }
    
    // Note: Interface Mockups are very large and detailed, 
    // keeping the function manageable by including key sections only
    // Full mockups would be added if needed in a separate file
    
    return html;
}

// Format Prompts section - includes full development prompt
function formatPrompts() {
    const fullPrompt = `You are building Taskify Pro - an intelligent, AI-powered task management platform that revolutionizes productivity for modern professionals and teams.

PROJECT OVERVIEW:
Taskify Pro is a comprehensive productivity intelligence system that learns, adapts, and optimizes workflows in real-time. The platform targets busy professionals, team managers, entrepreneurs, and executives who regularly juggle 10-50 concurrent tasks across multiple projects.

TECHNICAL STACK:
- Frontend: React 18, TypeScript 5.5, Next.js 14, Tailwind CSS 3.4
- Backend: Node.js 20 LTS, Express.js 4.21, TypeScript 5.5
- Database: PostgreSQL 15, MongoDB Atlas 7.1, Elasticsearch 8.15, TimescaleDB 2.14
- AI Service: OpenAI GPT-4 Turbo API with custom fine-tuned models
- Authentication: NextAuth.js v5 with OAuth 2.0, JWT tokens, 2FA via TOTP
- Real-time: WebSocket with Socket.io v4, Redis Adapter for scaling
- Storage: AWS S3, CloudFront CDN
- Infrastructure: Docker 24, Kubernetes on AWS EKS, GitHub Actions CI/CD

SECURITY REQUIREMENTS:
- End-to-end encryption for all task data
- HTTPS/WSS for all communications
- JWT tokens with expiration and refresh mechanisms
- Rate limiting on all API endpoints
- CORS properly configured (no wildcards in production)
- Input validation and sanitization on backend
- Never store API keys or secrets in frontend code

DEVELOPMENT STAGES - BUILD IN THIS EXACT ORDER:

═══════════════════════════════════════════════════════════════
STAGE 1: PROJECT SETUP & BASIC STRUCTURE
═══════════════════════════════════════════════════════════════

1.1 Initialize Project Structure
   - Create Next.js 14 project with TypeScript
   - Set up folder structure: /app, /components, /lib, /types, /api
   - Configure Tailwind CSS 3.4 with custom design tokens
   - Set up ESLint, Prettier, and TypeScript strict mode
   - Initialize Git repository and create .gitignore

1.2 Environment Configuration
   - Set up .env.local with required environment variables
   - Configure Next.js environment variables for API keys
   - Set up development, staging, and production configs
   - Never commit .env files to Git

1.3 Basic Layout & Navigation
   - Create main layout component with header and sidebar
   - Implement responsive navigation menu
   - Set up routing structure for main pages
   - Create basic page components (Dashboard, Tasks, Projects, Settings)
   - Add loading states and error boundaries

1.4 Design System Setup
   - Create design tokens file (colors, typography, spacing)
   - Set up component library structure
   - Create base UI components (Button, Input, Card, Modal)
   - Implement dark mode support
   - Set up icon system (Font Awesome integration)

═══════════════════════════════════════════════════════════════
STAGE 2: FRONTEND CORE FUNCTIONALITY
═══════════════════════════════════════════════════════════════

2.1 Task Management UI Components
   - Build TaskCard component with drag-and-drop support
   - Create TaskList component with filtering and sorting
   - Implement TaskForm for creating/editing tasks
   - Build TaskDetail modal/view
   - Add task status indicators and priority badges
   - Implement task search and filter functionality

2.2 Project Management UI
   - Create ProjectCard and ProjectList components
   - Build ProjectDetail view with task grouping
   - Implement project creation and editing forms
   - Add project color coding and icon selection
   - Create project navigation sidebar

2.3 Dashboard & Analytics UI
   - Build dashboard layout with widgets
   - Create productivity metrics cards
   - Implement progress bars and completion charts
   - Add time tracking visualization components
   - Build weekly insights display component

2.4 User Interface Polish
   - Implement smooth animations and transitions
   - Add loading skeletons for better UX
   - Create empty states with helpful messages
   - Implement toast notifications system
   - Add keyboard shortcuts support
   - Ensure mobile responsiveness

═══════════════════════════════════════════════════════════════
STAGE 3: AUTHENTICATION & USER MANAGEMENT
═══════════════════════════════════════════════════════════════

3.1 Authentication Setup
   - Install and configure NextAuth.js v5
   - Set up OAuth providers (Google, Microsoft, GitHub, Apple)
   - Implement email/password authentication
   - Create login and signup pages
   - Add magic link authentication option
   - Implement password reset flow

3.2 User Session Management
   - Set up JWT token handling
   - Implement refresh token mechanism
   - Create session management utilities
   - Add automatic session refresh
   - Implement logout functionality

3.3 User Profile & Settings
   - Build user profile page
   - Create settings page with preferences
   - Implement timezone and locale settings
   - Add notification preferences
   - Create account deletion functionality

3.4 Multi-Factor Authentication
   - Implement 2FA via TOTP
   - Add QR code generation for authenticator apps
   - Create backup codes system
   - Add MFA enforcement for sensitive actions

═══════════════════════════════════════════════════════════════
STAGE 4: BACKEND API DEVELOPMENT
═══════════════════════════════════════════════════════════════

4.1 Backend Project Setup
   - Initialize Express.js server with TypeScript
   - Set up API route structure
   - Configure middleware (CORS, body parser, compression)
   - Set up request logging and error handling
   - Create API response utilities

4.2 Database Setup & Models
   - Set up PostgreSQL connection with Prisma ORM
   - Create database schema for users, tasks, projects, teams
   - Set up MongoDB for flexible document storage
   - Configure Elasticsearch for search functionality
   - Create database migration scripts
   - Set up database seeding for development

4.3 Task Management API
   - Create POST /api/v1/tasks (create task)
   - Create GET /api/v1/tasks (list tasks with filters)
   - Create GET /api/v1/tasks/:id (get task details)
   - Create PUT /api/v1/tasks/:id (update task)
   - Create DELETE /api/v1/tasks/:id (delete/archive task)
   - Implement task validation and sanitization
   - Add optimistic locking for conflict prevention

4.4 Project Management API
   - Create project CRUD endpoints
   - Implement project task grouping
   - Add project member management endpoints
   - Create project sharing and permissions API

4.5 User & Team Management API
   - Create user profile endpoints
   - Implement team creation and management
   - Add team member invitation system
   - Create role-based access control endpoints
   - Implement permission checking middleware

═══════════════════════════════════════════════════════════════
STAGE 5: AI INTEGRATION & INTELLIGENT FEATURES
═══════════════════════════════════════════════════════════════

5.1 OpenAI API Integration
   - Set up OpenAI client with environment variables
   - Implement rate limiting and error handling
   - Create caching layer for AI suggestions
   - Build fallback mechanism using local LLM (Ollama)

5.2 AI Task Prioritization Engine
   - Create API endpoint: GET /api/v1/ai/suggestions
   - Implement algorithm to analyze deadlines and dependencies
   - Build energy-based scheduling logic
   - Create predictive analytics for optimal task timing
   - Add context-aware task grouping algorithm

5.3 Natural Language Processing
   - Implement NLP for task creation from text
   - Create intent recognition for user commands
   - Build date/time extraction from natural language
   - Add task parsing from email content

5.4 Productivity Analytics AI
   - Create API endpoint: POST /api/v1/ai/analyze-workload
   - Implement bottleneck detection algorithm
   - Build burnout detection system
   - Create workflow optimization suggestions

═══════════════════════════════════════════════════════════════
STAGE 6: REAL-TIME COLLABORATION
═══════════════════════════════════════════════════════════════

6.1 WebSocket Setup
   - Install and configure Socket.io v4
   - Set up Redis Adapter for horizontal scaling
   - Create WebSocket connection handler
   - Implement automatic reconnection logic

6.2 Real-Time Features
   - Implement live cursors for collaborative editing
   - Create activity stream broadcasting
   - Add typing indicators
   - Build presence tracking system
   - Implement real-time task updates

6.3 Conflict Resolution
   - Implement Operational Transformation (OT) algorithm
   - Create conflict detection system
   - Build merge strategies for concurrent edits
   - Add conflict resolution UI

6.4 Notification System
   - Create notification service
   - Implement real-time push notifications
   - Add email notification system
   - Build notification preferences management

═══════════════════════════════════════════════════════════════
STAGE 7: THIRD-PARTY INTEGRATIONS
═══════════════════════════════════════════════════════════════

7.1 Google Calendar Integration
   - Implement OAuth 2.0 flow for Google Calendar
   - Set up webhook listeners for calendar events
   - Create sync job for bi-directional calendar sync
   - Implement conflict resolution for calendar overlaps

7.2 Slack Integration
   - Set up Slack App with required OAuth scopes
   - Implement Slack webhook for message processing
   - Create notification service for Slack channels
   - Build natural language parser for Slack messages

7.3 Email Integration
   - Set up SendGrid/AWS SES for email sending
   - Implement email parsing for task creation
   - Create email notification templates
   - Add email-based task creation flow

7.4 Additional Integrations
   - GitHub API integration for development tracking
   - Payment processing with Stripe
   - Analytics integration (Mixpanel/Amplitude)
   - Storage integration with AWS S3

═══════════════════════════════════════════════════════════════
STAGE 8: MOBILE APP DEVELOPMENT
═══════════════════════════════════════════════════════════════

8.1 React Native Setup
   - Initialize React Native project
   - Set up navigation (React Navigation)
   - Configure state management (Redux/Context)
   - Set up API client for backend communication

8.2 Core Mobile Features
   - Implement task list and detail views
   - Create task creation and editing forms
   - Add offline-first data synchronization
   - Implement push notifications

8.3 Mobile-Specific Features
   - Add gesture support for task management
   - Implement quick actions from home screen
   - Create mobile-optimized dashboard
   - Add voice input for task creation

═══════════════════════════════════════════════════════════════
STAGE 9: TESTING & QUALITY ASSURANCE
═══════════════════════════════════════════════════════════════

9.1 Unit Testing
   - Write unit tests for utility functions
   - Test API endpoints with Jest/Supertest
   - Test React components with React Testing Library
   - Achieve minimum 80% code coverage

9.2 Integration Testing
   - Test API integration flows
   - Test authentication flows
   - Test real-time collaboration features
   - Test third-party integrations

9.3 End-to-End Testing
   - Set up Playwright/Cypress for E2E tests
   - Test critical user flows
   - Test cross-browser compatibility
   - Test mobile responsiveness

9.4 Performance Testing
   - Load testing for API endpoints
   - Test WebSocket connection limits
   - Optimize database queries
   - Implement caching strategies

═══════════════════════════════════════════════════════════════
STAGE 10: DEPLOYMENT & DEVOPS
═══════════════════════════════════════════════════════════════

10.1 Infrastructure Setup
   - Set up Docker containers for services
   - Configure Kubernetes on AWS EKS
   - Set up CI/CD pipeline with GitHub Actions
   - Configure environment-specific deployments

10.2 Monitoring & Logging
   - Set up Datadog/Sentry for error tracking
   - Implement structured logging
   - Create monitoring dashboards
   - Set up alerting for critical issues

10.3 Security Hardening
   - Perform security audit
   - Set up WAF and DDoS protection
   - Implement rate limiting at infrastructure level
   - Configure SSL/TLS certificates

10.4 Production Deployment
   - Deploy frontend to Vercel/Netlify
   - Deploy backend to AWS EKS
   - Set up database backups
   - Configure CDN for static assets

═══════════════════════════════════════════════════════════════

IMPORTANT NOTES:
- Follow this order strictly - each stage builds on the previous one
- Test thoroughly after each stage before moving to the next
- Commit code frequently with descriptive commit messages
- Document API endpoints and component props
- Follow TypeScript best practices and avoid 'any' types
- Ensure all code is accessible (WCAG 2.1 AA compliant)
- Optimize for performance from the start
- Write clean, maintainable, and scalable code

Please build this application following best practices, ensuring scalability, security, and excellent user experience.`;

    const thirdPartyIntegrations = [
        {
            service: "OpenAI API",
            description: "Integration for AI-powered task prioritization, natural language processing for task creation, and intelligent suggestions based on user patterns.",
            instructions: [
                "Set up OpenAI API client with environment variables for API key (never expose in frontend)",
                "Implement rate limiting and error handling for API calls",
                "Create caching layer for AI suggestions to reduce API costs",
                "Build fallback mechanism using local LLM (Ollama) for offline capabilities"
            ]
        },
        {
            service: "Google Calendar API",
            description: "Bi-directional calendar sync for automatic deadline reminders, meeting conflict detection, and suggested focus time blocks.",
            instructions: [
                "Implement OAuth 2.0 flow for Google Calendar access",
                "Set up webhook listeners for calendar event changes",
                "Create sync job that runs every 15 minutes to update task deadlines",
                "Implement conflict resolution when calendar events overlap with scheduled tasks"
            ]
        },
        {
            service: "Slack API",
            description: "Integration for team notifications, task creation from Slack messages, and status updates posted to Slack channels.",
            instructions: [
                "Set up Slack App with OAuth scopes: channels:read, chat:write, users:read",
                "Implement Slack webhook for receiving messages and creating tasks",
                "Create notification service that posts task updates to configured Slack channels",
                "Build natural language parser to extract task details from Slack messages"
            ]
        }
    ];

    let html = '';
    
    // Full Prompt Section
    html += '<div class="content-section">';
    html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">';
    html += '<h3><i class="fa fa-code"></i> Full Development Prompt</h3>';
    html += '<button onclick="copyPromptToClipboard()" class="btn btn-secondary" style="padding: 8px 16px; font-size: 14px; background-color: #FF6B35; color: white; border: none; border-radius: 6px; cursor: pointer;">';
    html += '<i class="fa fa-copy" style="color: white !important;"></i> Copy Prompt';
    html += '</button>';
    html += '</div>';
    html += '<div style="background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; overflow-x: auto;">';
    html += `<pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: 'Monaco', 'Courier New', monospace; font-size: 13px; line-height: 1.6;">${fullPrompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
    html += '</div>';
    html += '</div>';
    
    // Third-Party Integrations Section
    html += '<div class="content-section">';
    html += '<h3><i class="fa fa-plug"></i> Third-Party Integration Instructions</h3>';
    
    thirdPartyIntegrations.forEach((integration, index) => {
        html += '<div style="margin-bottom: 30px; padding: 20px; background: #f9f9f9; border-radius: 8px; border-left: 4px solid #6366F1;">';
        html += `<h4 style="color: #333; margin-bottom: 10px;"><i class="fa fa-link" style="color: #6366F1; margin-right: 8px;"></i>${integration.service}</h4>`;
        html += `<p style="color: #666; margin-bottom: 15px;">${integration.description}</p>`;
        html += '<h5 style="color: #555; margin-bottom: 10px;">Implementation Instructions:</h5>';
        html += '<ol style="margin-left: 20px; color: #555;">';
        integration.instructions.forEach(instruction => {
            html += `<li style="margin-bottom: 8px;">${instruction}</li>`;
        });
        html += '</ol>';
        html += '</div>';
    });
    
    html += '</div>';
    
    // Store full prompt globally for copy function
    window.fullPromptText = fullPrompt;
    
    return html;
}

// Copy prompt to clipboard function
window.copyPromptToClipboard = function() {
    if (window.fullPromptText) {
        navigator.clipboard.writeText(window.fullPromptText).then(() => {
            alert('Prompt copied to clipboard!');
        }).catch(err => {
            alert('Failed to copy prompt. Please select and copy manually.');
        });
    }
};

// Format Export section
function formatExport() {
    let html = '';
    
    html += '<div class="content-section">';
    html += '<h3><i class="fa fa-download"></i> Export Specification</h3>';
    html += '<p style="margin-bottom: 25px; color: #666;">Export your Taskify Pro specification in various formats for sharing with your team or importing into project management tools.</p>';
    
    // Inner tabs
    html += '<div style="display: flex; gap: 10px; margin-bottom: 30px; border-bottom: 2px solid #e0e0e0;">';
    html += '<button class="export-inner-tab-btn active" onclick="showExportInnerTab(\'html\')" id="export-html-tab-btn" style="padding: 12px 24px; background: #FF6B35; color: white; border: none; border-radius: 8px 8px 0 0; cursor: pointer; font-weight: 600;">';
    html += '<i class="fa fa-file-code" style="color: white !important;"></i> HTML Export';
    html += '</button>';
    html += '<button class="export-inner-tab-btn" onclick="showExportInnerTab(\'jira\')" id="export-jira-tab-btn" style="padding: 12px 24px; background: #f0f0f0; color: #666; border: none; border-radius: 8px 8px 0 0; cursor: pointer; font-weight: 600;">';
    html += '<i class="fa fa-tasks" style="color: #666 !important;"></i> Jira Export';
    html += '</button>';
    html += '<button class="export-inner-tab-btn" onclick="showExportInnerTab(\'cursor-windsurf\')" id="export-cursor-windsurf-tab-btn" style="padding: 12px 24px; background: #f0f0f0; color: #666; border: none; border-radius: 8px 8px 0 0; cursor: pointer; font-weight: 600;">';
    html += '<i class="fa fa-code" style="color: #666 !important;"></i> Cursor & Windsurf';
    html += '</button>';
    html += '</div>';
    
    // HTML Export Content
    html += '<div id="export-html-content" class="export-inner-content" style="display: block;">';
    html += '<div style="background: #f9f9f9; padding: 25px; border-radius: 8px; margin-bottom: 20px;">';
    html += '<p style="margin-bottom: 20px; color: #555;">Select the sections you want to include in your exported HTML document.</p>';
    
    html += '<div style="margin-bottom: 20px;">';
    html += '<label style="display: flex; align-items: center; padding: 12px; background: white; border-radius: 6px; margin-bottom: 10px; cursor: pointer;">';
    html += '<input type="checkbox" checked style="margin-right: 10px; width: 18px; height: 18px;">';
    html += '<span><strong>Select All</strong></span>';
    html += '</label>';
    html += '</div>';
    
    const sections = [
        { id: 'overview', name: 'Overview', icon: 'fa-book' },
        { id: 'technical', name: 'Technical Specification', icon: 'fa-cog' },
        { id: 'market', name: 'Market Research', icon: 'fa-bar-chart' },
        { id: 'design', name: 'Design & Branding', icon: 'fa-paint-brush' },
        { id: 'diagrams', name: 'Diagrams', icon: 'fa-sitemap' },
        { id: 'prompts', name: 'Development Prompts', icon: 'fa-terminal' }
    ];
    
    sections.forEach(section => {
        html += '<label style="display: flex; align-items: center; padding: 12px; background: white; border-radius: 6px; margin-bottom: 10px; cursor: pointer;">';
        html += `<input type="checkbox" checked style="margin-right: 10px; width: 18px; height: 18px;">`;
        html += `<span><i class="fa ${section.icon}" style="margin-right: 8px; color: #6366F1;"></i>${section.name}</span>`;
        html += '</label>';
    });
    
    html += '</div>';
    
    html += '<div style="text-align: center;">';
    html += '<button onclick="generateHTMLExport()" style="padding: 14px 28px; background: #FF6B35; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">';
    html += '<i class="fa fa-file-download" style="color: white !important;"></i> Generate HTML Export';
    html += '</button>';
    html += '</div>';
    
    html += '</div>';
    
    // Jira Export Content
    html += '<div id="export-jira-content" class="export-inner-content" style="display: none;">';
    html += '<div style="background: #f9f9f9; padding: 25px; border-radius: 8px;">';
    html += '<p style="margin-bottom: 25px; color: #555;">Generate Jira issues from your Taskify Pro specification. The system will automatically create Epics, Stories, Tasks, and Sub-tasks based on your spec content.</p>';
    
    html += '<div style="margin-bottom: 20px;">';
    html += '<label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;"><i class="fa fa-key" style="margin-right: 8px; color: #6366F1;"></i>Project Key <span style="color: #EF4444;">*</span></label>';
    html += '<input type="text" placeholder="e.g., TASKIFY" maxlength="10" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">';
    html += '<small style="color: #666; font-size: 13px;">The project key for your Jira project (e.g., TASKIFY, PROJ, APP)</small>';
    html += '</div>';
    
    html += '<div style="margin-bottom: 20px;">';
    html += '<label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;"><i class="fa fa-flag" style="margin-right: 8px; color: #6366F1;"></i>Default Priority</label>';
    html += '<select style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; background: white;">';
    html += '<option value="Highest">Highest</option>';
    html += '<option value="High" selected>High</option>';
    html += '<option value="Medium">Medium</option>';
    html += '<option value="Low">Low</option>';
    html += '<option value="Lowest">Lowest</option>';
    html += '</select>';
    html += '</div>';
    
    html += '<div style="margin-bottom: 25px;">';
    html += '<label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;"><i class="fa fa-tags" style="margin-right: 8px; color: #6366F1;"></i>Labels (comma-separated)</label>';
    html += '<input type="text" placeholder="e.g., taskify-pro, ai-generated, v1.0" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">';
    html += '<small style="color: #666; font-size: 13px;">Optional labels to add to all issues</small>';
    html += '</div>';
    
    html += '<div style="text-align: center;">';
    html += '<button onclick="generateJiraExport()" style="padding: 14px 28px; background: #FF6B35; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">';
    html += '<i class="fa fa-tasks" style="color: white !important;"></i> Generate Jira Export';
    html += '</button>';
    html += '</div>';
    
    html += '</div>';
    html += '</div>';
    
    // Cursor & Windsurf Export Content
    html += '<div id="export-cursor-windsurf-content" class="export-inner-content" style="display: none;">';
    html += '<div style="background: #f9f9f9; padding: 25px; border-radius: 8px;">';
    html += '<div style="margin-bottom: 25px;">';
    html += '<p style="margin-bottom: 15px; color: #555;">Export your specification as a structured project package for <strong>Cursor integration</strong> and <strong>Windsurf integration</strong> AI editors.</p>';
    html += '<p style="color: #666; font-size: 14px;">';
    html += '<i class="fa fa-info-circle" style="color: #FF6B35; margin-right: 8px;"></i>';
    html += '<strong>Includes:</strong> Project plan, architecture docs, design guidelines, development roadmap, diagrams, and AI editor configuration files.';
    html += '</p>';
    html += '</div>';
    
    html += '<div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e0e0e0;">';
    html += '<h4 style="margin: 0 0 15px 0; color: #333; font-size: 1.1em;"><i class="fa fa-folder-open" style="color: #FF6B35; margin-right: 8px;"></i>Export Package Contents:</h4>';
    html += '<ul style="margin: 0; padding-left: 20px; color: #666; line-height: 1.8;">';
    html += '<li><strong>PROJECT_PLAN.md</strong> - Project overview and market analysis</li>';
    html += '<li><strong>ARCHITECTURE.md</strong> - Technical specifications</li>';
    html += '<li><strong>DESIGN_GUIDELINES.md</strong> - UI/UX guidelines</li>';
    html += '<li><strong>DEVELOPMENT_ROADMAP.md</strong> - Step-by-step development plan</li>';
    html += '<li><strong>DIAGRAMS.md</strong> - System diagrams</li>';
    html += '<li><strong>.cursorrules</strong> - Cursor AI editor configuration</li>';
    html += '<li><strong>.windsurf/info.md</strong> - Windsurf AI agent context</li>';
    html += '<li><strong>README.md</strong> - Quick start guide</li>';
    html += '<li><strong>metadata.json</strong> - Export information</li>';
    html += '</ul>';
    html += '</div>';
    
    html += '<div style="text-align: center; padding: 20px; background: #fff4f0; border-radius: 8px; border: 2px dashed #FF6B35;">';
    html += '<p style="margin: 0; color: #666; font-size: 14px;">';
    html += '<i class="fa fa-info-circle" style="color: #FF6B35; margin-right: 8px;"></i>';
    html += 'In the full version, this would generate a ZIP file ready for <strong>Cursor integration</strong> and <strong>Windsurf integration</strong>.';
    html += '</p>';
    html += '<a href="/pages/cursor-windsurf-integration.html" style="display: inline-block; margin-top: 15px; padding: 10px 20px; background: #FF6B35; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">';
    html += 'Learn More About Cursor & Windsurf Integration';
    html += '</a>';
    html += '</div>';
    
    html += '</div>';
    html += '</div>';
    
    html += '</div>';
    
    return html;
}

// Export tab switching functions
window.showExportInnerTab = function(tab) {
    // Hide all content
    document.querySelectorAll('.export-inner-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.export-inner-tab-btn').forEach(btn => {
        btn.style.background = '#f0f0f0';
        btn.style.color = '#666';
        const icon = btn.querySelector('i');
        if (icon) {
            icon.style.setProperty('color', '#666', 'important');
        }
    });
    
    // Show selected content
    const contentId = tab === 'cursor-windsurf' ? 'export-cursor-windsurf-content' : `export-${tab}-content`;
    document.getElementById(contentId).style.display = 'block';
    const btnId = tab === 'cursor-windsurf' ? 'export-cursor-windsurf-tab-btn' : `export-${tab}-tab-btn`;
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.style.background = '#FF6B35';
        btn.style.color = 'white';
        const icon = btn.querySelector('i');
        if (icon) {
            icon.style.setProperty('color', 'white', 'important');
        }
    }
};

window.generateHTMLExport = function() {
    alert('In the full version, this would generate and download an HTML file containing all selected sections of your Taskify Pro specification.');
};

window.generateJiraExport = function() {
    alert('In the full version, this would generate Jira issues (Epics, Stories, Tasks) based on your Taskify Pro specification and allow you to import them into your Jira project.');
};

// Initialize Chat UI
function initializeChatUI() {
    const chatContent = document.getElementById('chat');
    if (!chatContent) return;
    
    chatContent.innerHTML = `
        <div class="chat-container">
            <div class="chat-messages" id="chat-messages">
                <div class="chat-welcome">
                    <i class="fas fa-comments"></i>
                    <h3>Welcome to AI Chat</h3>
                    <p>Ask me anything about this specification. I can help explain, clarify, or provide more details about any section.</p>
                    <p style="font-size: 14px; color: #999; margin-top: 10px;">After creating a specification, you will be able to have a conversation with the AI about it.<br> <span style='color: #e29200'>In this demo, chat is disabled.</span></p>
                </div>
            </div>
            <div class="chat-input-container">
                <input type="text" class="chat-input" id="chat-input" placeholder="Chat is disabled in this demo" disabled />
                <button class="chat-send-btn" disabled>
                    <i class="fas fa-paper-plane"></i> Send
                </button>
            </div>
        </div>
    `;
}

// Export functions for use in other modules
if (typeof window !== 'undefined') {
    window.formatOverview = formatOverview;
    window.renderComplexityScore = renderComplexityScore;
    window.formatTechnical = formatTechnical;
    window.formatMarket = formatMarket;
    window.formatDesign = formatDesign;
    window.formatPrompts = formatPrompts;
    window.formatExport = formatExport;
    window.initializeChatUI = initializeChatUI;
}
