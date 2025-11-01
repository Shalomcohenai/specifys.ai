// Prompts for New 4-Question Specification Flow
// This file contains all the prompts for the simplified specification system

const PROMPTS = {
  // Overview prompt - generates general app information
  overview: (answers) => {
    const appDescription = answers[0] || 'Not provided';
    const workflow = answers[1] || 'Not provided';
    const additionalDetails = answers[2] || 'Not provided';
    const targetAudience = answers[3] || 'Not provided';

    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be overview. If a value is unknown, return an empty array/object—never omit required keys.

IMPORTANT: All output must be in English regardless of the input language.

Create a comprehensive and detailed overview based on the user input. Analyze the provided information thoroughly and generate extensive content:

{
  "overview": {
    "ideaSummary": "A detailed, comprehensive description (500-1500 characters) of what the application does, what problem it solves for users, why it's important, core functionality, main benefits, how it addresses user pain points, and its value to the target audience. This should be substantial and provide complete context.",
    "problemStatement": "A detailed problem statement (2-3 paragraphs, 400-800 characters) describing: the core problem this app solves, why this problem matters, specific user pain points (both practical and emotional), current workarounds users employ, and the gap that exists in current solutions.",
    "targetAudience": {
      "ageRange": "Specific age range with reasoning (e.g., '25-45 years old, representing working professionals')",
      "sector": "Detailed industry or business sector with context (e.g., 'Healthcare sector, specifically telemedicine and patient management')",
      "interests": ["Array of 5-7 detailed interests, hobbies, or professional activities"],
      "needs": ["Array of 5-7 specific, detailed needs this app addresses with explanations"]
    },
    "valueProposition": "A comprehensive explanation (2-3 sentences) of what makes this app unique compared to competitors, including specific advantages, unique features, and the main value it provides to users",
    "coreFeaturesOverview": ["List of 6-8 main features with brief descriptions of what each feature does and how it benefits users"],
    "userJourneySummary": "A detailed, step-by-step description (4-5 sentences) of how a user would use the app from start to finish, including onboarding, main workflows, and key interactions",
    "detailedUserFlow": {
      "steps": ["Step 1: User action and system response description", "Step 2: User action and system response description", "Step 3: User action and system response description"],
      "decisionPoints": "Key user decisions and their implications",
      "errorHandling": "What happens when errors occur at each step",
      "confirmations": "What confirmations users receive",
      "feedbackLoops": "How the system provides feedback to users"
    },
    "screenDescriptions": {
      "screens": ["Screen 1: Name, purpose, key elements, user interactions", "Screen 2: Name, purpose, key elements, user interactions", "Screen 3: Name, purpose, key elements, user interactions", "Screen 4: Name, purpose, key elements, user interactions", "Screen 5: Name, purpose, key elements, user interactions"],
      "uiComponents": ["Component 1: Purpose, placement, behavior", "Component 2: Purpose, placement, behavior", "Component 3: Purpose, placement, behavior"],
      "navigationStructure": "Detailed navigation flow including: main navigation paths, side navigation, bottom navigation, modal flows, deep linking structure, and key transition points between screens"
    }
  }
}

IMPORTANT DETAILED REQUIREMENTS: 
- ideaSummary should be 500-1500 characters with comprehensive explanation of purpose, functionality, benefits, and value
- problemStatement should be 2-3 paragraphs (400-800 characters) covering: the problem, why it matters, pain points (practical and emotional), current workarounds, and solution gap
- targetAudience.ageRange should include reasoning for the age group
- targetAudience.sector should be specific with industry context
- targetAudience.interests should be 5-7 detailed interests or professional activities
- targetAudience.needs should be 5-7 specific needs with explanations
- valueProposition should be 2-3 sentences explaining uniqueness and competitive advantages
- coreFeaturesOverview should be 6-8 features with brief descriptions of functionality and benefits
- userJourneySummary should be 4-5 sentences describing complete user flow including onboarding and key interactions
- detailedUserFlow.steps should include specific user actions and system responses
- detailedUserFlow.decisionPoints should describe key decision moments
- detailedUserFlow.errorHandling should explain error scenarios
- screenDescriptions.screens MUST include 5-7 detailed screen descriptions (not just 2)
- screenDescriptions.uiComponents MUST include at least 3 detailed UI component descriptions
- screenDescriptions.navigationStructure MUST be comprehensive with detailed navigation paths
- All content should be detailed, comprehensive, and provide substantial value
- All values must be strings or arrays, never null or undefined

User Input:
App Description: ${appDescription}
User Workflow: ${workflow}
Additional Details: ${additionalDetails}
Target Audience: ${targetAudience}`;
  },

  // Technical specification prompt - generates detailed technical specs
  technical: (specId, answers) => {
    const appDescription = answers[0] || 'Not provided';
    const workflow = answers[1] || 'Not provided';
    const additionalDetails = answers[2] || 'Not provided';
    const targetAudience = answers[3] || 'Not provided';

    // Determine if using reference or full content
    const isReference = typeof specId === 'string' && specId.length < 100;
    const overviewContent = isReference ? null : specId;

    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be technical. If a value is unknown, return an empty array/object—never omit required keys.

Create a comprehensive technical specification with TEXTUAL descriptions only (no diagrams). Return JSON with technical key containing:

{
  "technical": {
    "techStack": {
      "frontend": "Client-side technologies",
      "backend": "Server-side technologies", 
      "database": "Database technology",
      "storage": "Storage solutions",
      "authentication": "Authentication methods"
    },
    "architectureOverview": "Textual description of system structure (client-server, API routes, data flow)",
    "databaseSchema": {
      "description": "Textual description of tables, relationships, and general data logic",
      "tables": [
        {
          "name": "Table name (e.g., Users)",
          "purpose": "What this table stores and why",
          "fields": ["id (Primary Key, Auto-increment)", "name (String, Required)", "email (String, Unique, Required)", "createdAt (Timestamp)"],
          "relationships": "How this table relates to other tables"
        }
      ],
      "relationships": "Description of how tables relate to each other"
    },
    "apiEndpoints": [
      {
        "path": "/api/endpoint",
        "method": "GET/POST/PUT/DELETE",
        "description": "What this endpoint does",
        "parameters": "List of URL parameters if any (e.g., ?userId=123)",
        "requestBody": "Textual description of request structure and example data as JSON-formatted string",
        "responseBody": "Textual description of response structure and example data as JSON-formatted string",
        "statusCodes": "Common HTTP status codes and their meanings for this endpoint"
      }
    ],
    "securityAuthentication": {
      "authentication": "Authentication methods and flow",
      "authorization": "Authorization and permissions",
      "encryption": "Data encryption methods",
      "securityMeasures": "Additional security measures"
    },
    "integrationExternalApis": {
      "thirdPartyServices": ["Service 1", "Service 2"],
      "integrations": "Description of external API integrations",
      "dataFlow": "How external data flows into the system"
    },
    "devops": {
      "deploymentStrategy": "Deployment approach (CI/CD, hosting platforms, containerization)",
      "infrastructure": "Infrastructure requirements and cloud services",
      "monitoring": "Monitoring and logging strategy",
      "scaling": "Scaling strategy and load balancing approach",
      "backup": "Backup and disaster recovery plan",
      "automation": "Automation tools and processes"
    },
    "dataStorage": {
      "storageStrategy": "Where and how data will be stored (database choice reasoning)",
      "dataRetention": "Data retention policies and lifecycle management",
      "dataBackup": "Backup strategy for data",
      "storageArchitecture": "Storage architecture and optimization"
    },
    "analytics": {
      "analyticsStrategy": "What metrics and analytics to track",
      "trackingMethods": "How to implement tracking (events, user behavior)",
      "analysisTools": "Recommended analytics tools and platforms",
      "reporting": "Reporting structure and dashboards"
    },
    "detailedDataModels": {
      "models": [
        {
          "name": "Model name (e.g., User, Product, Order)",
          "purpose": "What this model represents and stores",
          "fields": [
            {
              "name": "field_name",
              "type": "field type (String, Integer, Boolean, Timestamp, etc.)",
              "required": true,
              "constraints": "Any constraints (unique, max length, default value, etc.)",
              "description": "What this field stores and how it's used"
            }
          ],
          "relationships": "Relationships with other models",
          "validationRules": "Validation rules for this model",
          "indexes": "Database indexes for optimization",
          "sampleData": "Example of what data looks like in this model"
        }
      ],
      "overallStructure": "How all models relate to each other and the overall data architecture",
      "totalModelsCount": "Total number of data models in the system",
      "crudOperations": "Main CRUD operations for each model"
    },
    "dataFlowDetailed": {
      "authenticationFlow": "Step-by-step authentication process from user login to system access",
      "dataSubmissionFlow": "How data moves through the system from user input to storage",
      "queryPatterns": "Common database queries and their purposes",
      "cachingStrategy": "What data gets cached and why",
      "errorScenarios": "Error handling at each step of data flow",
      "dataValidation": "Where and how data is validated throughout the system",
      "transactionFlow": "Complex multi-step processes and their flow"
    }
  }
}

IMPORTANT: All descriptions must be textual only. Diagrams will be generated separately.

CRITICAL FOR DATABASE SCHEMA:
- databaseSchema.tables MUST be an array of objects, not just string descriptions
- Each table object MUST include: name, purpose, fields (array of field definitions), and relationships
- fields array MUST list ALL fields for each table with their types and constraints
- Provide COMPLETE database schema with ALL tables that will be used in the application
- Example of correct format: { "name": "Users", "purpose": "Stores user accounts", "fields": ["id (PK, auto-increment)", "email (string, unique, required)", "password (string, hashed, required)"], "relationships": "Users has many Orders" }

CRITICAL FOR DETAILED DATA MODELS:
- detailedDataModels.models MUST include ALL models/tables from databaseSchema
- Every model MUST include ALL fields with complete information: name, type, required status, constraints, and description
- Never omit models - if there are 10 tables, include all 10 models
- Each model must have comprehensive field definitions
- Must match and expand upon the databaseSchema.tables information

IMPORTANT FOR API ENDPOINTS:
- requestBody and responseBody must be detailed textual descriptions OR valid JSON strings (never [object Object])
- Include actual field names, types, and example values specific to the application
- Format as plain text descriptions or JSON strings, not JSON objects
- Example of good requestBody: "JSON string with fields: { \\"name\\": \\"John Doe\\", \\"email\\": \\"john@example.com\\", \\"age\\": 30 }"
- Example of good responseBody: "Returns JSON with fields: { \\"userId\\": 123, \\"status\\": \\"success\\" }"

Application Overview:
${isReference ? `[SPEC_REFERENCE]
Spec ID: ${specId}
Overview Location: Firebase > specs collection > ${specId} > overview field
Note: The system will retrieve the full overview content automatically. Use this reference to access the complete application overview details.` : overviewContent}

User Input:
App Description: ${appDescription}
User Workflow: ${workflow}
Additional Details: ${additionalDetails}
Target Audience: ${targetAudience}`;
  },

  // Market research prompt - generates market analysis
  market: (specId, answers) => {
    const appDescription = answers[0] || 'Not provided';
    const workflow = answers[1] || 'Not provided';
    const additionalDetails = answers[2] || 'Not provided';
    const targetAudience = answers[3] || 'Not provided';

    // Calculate current date and last 3 months for historical data
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11, so we add 1
    const currentDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    
    // Calculate last 3 months (including current month)
    const months = [];
    for (let i = 2; i >= 0; i--) {
      // Go back i months from current month
      const date = new Date(currentYear, currentMonth - 1 - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);
    }
    const last3Months = months.join(', ');

    // Determine if using reference or full content
    const isReference = typeof specId === 'string' && specId.length < 100;
    const overviewContent = isReference ? null : specId;

    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be market. If a value is unknown, return an empty array/object—never omit required keys.

🚨 CRITICAL: ALL DATA MUST BE CURRENT AND UP-TO-DATE 🚨
- Current date is ${currentDateStr}
- You MUST use the most recent and current information available
- NEVER use outdated statistics, trends, or market data from previous years
- All market data, statistics, trends, and competitor information MUST reflect the current state of the market as of ${currentDateStr}
- If information is from a specific year, it must be from 2024 or 2025 (most recent available)
- Industry trends, market statistics, and competitive analysis MUST be based on the most recent data possible

Create detailed market analysis. Return JSON with market key containing:

{
  "market": {
    "industryOverview": {
      "trends": "CURRENT industry trends and developments as of ${currentDateStr} - MUST reflect the most recent trends, not historical ones",
      "marketData": "Relevant and RECENT market statistics and forecasts - use data from 2024-2025 only, never outdated data",
      "growthProjections": "Future market growth expectations based on CURRENT market conditions"
    },
    "searchTrends": {
      "keywords": ["Key search term 1", "Key search term 2", "Key search term 3"],
      "historicalData": [
        {
          "month": "YYYY-MM",
          "searchVolume": 12345,
          "trend": "increasing/decreasing/stable",
          "competition": "low/medium/high"
        }
      ],
      "period": "3 months minimum",
      "dataFormat": "Each entry should have consistent month format and numeric values suitable for chart visualization",
      "insights": "Analysis of search trend patterns and what they indicate about market demand"
    },
    "targetAudienceInsights": {
      "primaryAudience": {
        "definition": "Detailed description of primary users",
        "demographics": "Age range, location, income, education, and other demographic details",
        "psychographics": "Values, motivations, lifestyle, and psychological factors",
        "behaviors": "How they currently behave, what products/services they use",
        "technologySkills": "Their comfort level with technology",
        "specificRoles": ["Role 1 description", "Role 2 description"]
      },
      "secondaryAudience": {
        "definition": "Secondary users who benefit from the app",
        "demographics": "Demographic details",
        "relationshipToPrimary": "How they relate to primary users"
      },
      "needsAnalysis": "Detailed analysis of user needs and pain points",
      "usageHabits": "How target audience currently behaves",
      "demographics": "Detailed demographic breakdown"
    },
    "competitiveLandscape": [
      {
        "competitor": "Competitor name (current/existing as of ${currentDateStr})",
        "advantages": "Their CURRENT strengths based on recent analysis",
        "disadvantages": "Their CURRENT weaknesses based on recent analysis",
        "marketPosition": "Their CURRENT position in the market as of ${currentDateStr}",
        "features": ["CURRENT feature list of competitor - recent features and capabilities"],
        "uxStrengths": "What they CURRENTLY do well in UX",
        "uxWeaknesses": "Where they CURRENTLY fall short in UX",
        "monetization": "How they CURRENTLY make money - recent pricing and revenue models",
        "gaps": ["CURRENT gaps - what they're missing NOW", "Their CURRENT weaknesses"],
        "marketShare": "CURRENT estimated market share (use recent data from 2024-2025)"
      }
    ],
    "swotAnalysis": {
      "strengths": ["CURRENT Strength 1", "CURRENT Strength 2"],
      "weaknesses": ["CURRENT Weakness 1", "CURRENT Weakness 2"],
      "opportunities": ["CURRENT Opportunity 1 based on recent market conditions", "CURRENT Opportunity 2 based on recent market conditions"],
      "threats": ["CURRENT Threat 1", "CURRENT Threat 2"]
    },
    "painPoints": [
      {
        "pain": "Specific problem description",
        "impact": "How it affects users (practical and emotional)",
        "frequency": "How often this happens",
        "emotionalImpact": "How it makes users feel",
        "currentWorkarounds": "What users do now to solve it",
        "severity": "High/Medium/Low"
      }
    ],
    "businessModelsAnalysis": [
      {
        "model": "Model name (Freemium/Subscription/Advertising/B2B/One-time purchase)",
        "description": "How this model works",
        "advantages": ["Advantage 1", "Advantage 2"],
        "disadvantages": ["Disadvantage 1", "Disadvantage 2"],
        "revenuePotential": "Estimated revenue potential",
        "fitScore": "How well it fits the product (1-10)",
        "implementationComplexity": "Easy/Medium/Hard"
      }
    ],
    "qualityAssessment": {
      "marketFitRating": "Rating 1-10 with detailed reasoning based on CURRENT market conditions as of ${currentDateStr}",
      "technicalFeasibility": "Feasibility rating and CURRENT specific technical challenges",
      "executionRiskFactors": ["CURRENT Risk factor 1", "CURRENT Risk factor 2"],
      "marketReadiness": "Is the market CURRENTLY ready? Why or why not - based on ${currentDateStr} market state",
      "keySuccessFactors": ["CURRENT Factor 1", "CURRENT Factor 2"],
      "goToMarketReadiness": "Ready/Not ready and specific reasons based on CURRENT market analysis"
    },
    "uniqueSellingProposition": {
      "coreValue": "The unique value offered that competitors don't provide",
      "differentiationFactors": ["What makes it unique", "Key differentiators"],
      "competitiveAdvantages": ["Advantage 1", "Advantage 2"],
      "sustainability": "Can this advantage be sustained? Why",
      "proofPoints": "Evidence of uniqueness or competitive advantage"
    },
    "monetizationModel": {
      "proposedModels": ["Subscription", "Pay-per-use", "Freemium"],
      "recommendations": "Recommended monetization strategy",
      "pricingStrategy": "Suggested pricing approach"
    },
    "pricingStrategy": {
      "proposedModels": ["Model 1", "Model 2"],
      "recommendations": "Recommended pricing approach with justification based on CURRENT market conditions",
      "pricingComparison": [
        {
          "competitor": "Competitor name",
          "pricing": "CURRENT pricing as of ${currentDateStr} ($X/month or free)",
          "features": "CURRENT features they offer at this price",
          "valueProposition": "Why people CURRENTLY pay for their service"
        }
      ],
      "justification": "Why this pricing structure makes sense based on CURRENT market analysis",
      "suggestedPricing": "Recommended pricing structure with tiers based on CURRENT market conditions"
    },
    "expectedROI": {
      "scenarios": [
        {
          "scenario": "Conservative/Optimistic/Realistic",
          "assumptions": "Key assumptions made",
          "userProjections": "Expected users over 3 years",
          "revenueProjections": "Expected revenue over 1-3 years",
          "costBreakdown": "Development costs + Marketing costs breakdown",
          "roiCalculation": "ROI percentage and time to breakeven"
        }
      ],
      "riskFactors": ["What could go wrong", "Market risks"],
      "sensitivityAnalysis": "Key variables that impact projections (e.g., conversion rate, CAC)"
    },
    "kpiFramework": {
      "userMetrics": [
        {
          "metric": "Metric name (e.g., DAU, MAU, Conversion Rate, Churn)",
          "definition": "What it measures",
          "targetValue": "Target to achieve in first year",
          "measurementMethod": "How to track and measure it",
          "importance": "Why this metric matters"
        }
      ],
      "businessMetrics": ["Revenue", "CAC (Customer Acquisition Cost)", "LTV (Lifetime Value)", "Churn Rate", "ARPU"],
      "productMetrics": ["Engagement Rate", "Retention Rate", "NPS", "Feature Adoption", "Time to Value"]
    },
    "nicheInformation": {
      "nicheDefinition": "What specific niche this app serves",
      "trends": ["CURRENT Trend 1 with context as of ${currentDateStr}", "CURRENT Trend 2 with context as of ${currentDateStr}"],
      "opportunities": ["CURRENT Opportunity 1 based on recent market developments", "CURRENT Opportunity 2 based on recent market developments"],
      "challenges": ["CURRENT Challenge 1", "CURRENT Challenge 2"],
      "growthFactors": ["CURRENT Factor 1 driving growth", "CURRENT Factor 2 driving growth"],
      "marketMaturity": "CURRENT market maturity status (Early stage/Growing/Mature/Declining) as of ${currentDateStr}"
    },
    "marketStatistics": {
      "globalStatistics": [
        "RECENT Stat 1 with context and source - MUST be from 2024-2025 data sources",
        "RECENT Stat 2 with context and source - MUST be from 2024-2025 data sources"
      ],
      "targetMarketSize": "CURRENT estimated TAM/SAM/SOM based on most recent market research (2024-2025 data only)",
      "growthRate": "CURRENT expected CAGR or growth rate based on recent market analysis",
      "keyNumbers": "CURRENT important numbers that support market viability - use 2024-2025 statistics only"
    },
    "threatsOverview": {
      "externalThreats": [
        {
          "threat": "CURRENT specific threat description",
          "probability": "High/Medium/Low with reasoning based on CURRENT market conditions",
          "impact": "High/Medium/Low and why - considering ${currentDateStr} market state",
          "mitigation": "How to mitigate or address this CURRENT threat"
        }
      ],
      "competitiveThreats": ["CURRENT Competitive threat 1", "CURRENT Competitive threat 2"],
      "regulatoryThreats": ["CURRENT Regulatory risk 1", "CURRENT Regulatory risk 2"],
      "marketThreats": ["CURRENT Market risk 1", "CURRENT Market risk 2"]
    },
    "complexityRating": {
      "overallRating": "Rating 1-10 (10 = very complex)",
      "technicalComplexity": "Tech challenges and why",
      "marketComplexity": "Market challenges and barriers",
      "operationalComplexity": "Operational challenges",
      "mitigationStrategies": "How to reduce complexity",
      "developmentTimeline": "Estimated timeline to launch MVP and full version"
    },
    "actionableInsights": {
      "development": {
        "priorities": ["Must-have feature 1", "Must-have feature 2"],
        "recommendations": "What to focus on in development based on CURRENT market needs",
        "phases": "Suggested phased rollout approach (MVP, v1, v2) based on CURRENT market timing",
        "mvpFeatures": "Core features for Minimum Viable Product based on CURRENT market demand"
      },
      "marketFit": {
        "strategies": ["CURRENT Go-to-market strategy 1", "CURRENT Strategy 2"],
        "partnerships": "Recommended strategic partnerships based on CURRENT market landscape",
        "timing": "CURRENT best time to launch (when, why) - consider ${currentDateStr} market conditions",
        "targetMarkets": "CURRENT best geographic or demographic markets to enter first"
      },
      "productPositioning": {
        "branding": "Branding recommendations and positioning for CURRENT market (${currentDateStr})",
        "messaging": "Key messages to use in marketing based on CURRENT market sentiment",
        "differentiation": "How to differentiate from competitors in messaging based on CURRENT competitive landscape",
        "marketPosition": "Where to position in the CURRENT market (premium, affordable, niche, etc.)"
      }
    },
    "marketingStrategy": {
      "channels": "CURRENT effective marketing channels (as of ${currentDateStr})",
      "community": "CURRENT community building strategies",
      "partnerships": "CURRENT potential partnerships and collaborations"
    }
  }
}

CRITICAL FOR searchTrends.historicalData:
- The "month" field MUST use CURRENT and RECENT dates only - NEVER use old dates from previous years
- Current date is ${currentDateStr}
- You MUST use the last 3 months up to the current date: ${last3Months}
- Date format MUST be YYYY-MM (e.g., "2025-01", "2025-02", "2025-03")
- NEVER use dates from past years (like 2023 or 2024 if we're in 2025)
- The historical data MUST reflect the most recent 3 months leading up to ${currentDateStr}
- If the current date is ${currentDateStr}, include data for the last 3 months including ${currentDateStr}

IMPORTANT: The searchTrends.historicalData MUST include at least 3 months of data with consistent formatting to enable easy chart/graph visualization.

🚨 REMINDER: ALL MARKET DATA MUST BE CURRENT 🚨
- Current date: ${currentDateStr}
- Use ONLY recent data from 2024-2025
- All statistics, trends, and market insights MUST reflect the CURRENT state of the market
- NEVER use outdated information from previous years (2023 or earlier)
- Competitive analysis MUST reflect CURRENT competitor status, features, and pricing
- Market statistics MUST use the most recent available data sources

Application Overview:
${isReference ? `[SPEC_REFERENCE]
Spec ID: ${specId}
Overview Location: Firebase > specs collection > ${specId} > overview field
Note: The system will retrieve the full overview content automatically. Use this reference to access the complete application overview details.` : overviewContent}

User Input:
App Description: ${appDescription}
User Workflow: ${workflow}
Additional Details: ${additionalDetails}
Target Audience: ${targetAudience}`;
  },

  // Design & Branding prompt - generates design guidelines and branding
  design: (specId, answers) => {
    const appDescription = answers[0] || 'Not provided';
    const workflow = answers[1] || 'Not provided';
    const additionalDetails = answers[2] || 'Not provided';
    const targetAudience = answers[3] || 'Not provided';

    // Determine if using reference or full content
    const isReference = typeof specId === 'string' && specId.length < 100;
    const overviewContent = isReference ? null : specId;

    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be design. If a value is unknown, return an empty array/object—never omit required keys.

Create comprehensive design guidelines and branding elements. Return JSON with design key containing:

{
  "design": {
    "visualStyleGuide": {
      "colors": {
        "primary": "#hexcode",
        "secondary": "#hexcode", 
        "accent": "#hexcode",
        "background": "#hexcode",
        "text": "#hexcode"
      },
      "colorHarmony": "Description of the color scheme harmony (monochromatic, analogous, or complementary with 2 tones maximum)",
      "colorReasoning": "Explanation of why these specific colors and tones were chosen and how they work together",
      "typography": {
        "headings": "Font family and specifications for headings",
        "body": "Font family and specifications for body text",
        "captions": "Font family and specifications for captions"
      },
      "spacing": "Spacing guidelines and grid system",
      "buttons": "Button styles and variations",
      "animations": "Animation guidelines and transitions"
    },
    "logoIconography": {
      "logoConcepts": "Logo design concepts and variations",
      "colorVersions": "Different color versions of the logo",
      "iconSet": "Icon set specifications and style",
      "appIcon": {
        "letters": "Two letters for the app icon (e.g., 'TP' for Taskify Pro, 'SM' for Smart Manager)",
        "bgColor": "Background color or gradient for the icon (e.g., 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' or single color '#6366F1')",
        "description": "Brief description of the app icon design concept"
      }
    },
    "uiLayout": {
      "landingPage": "Landing page layout structure",
      "dashboard": "Dashboard layout and components",
      "navigation": "Navigation structure and patterns",
      "responsiveDesign": "Responsive design guidelines"
    },
    "uxPrinciples": {
      "userFlow": "User flow and navigation principles",
      "accessibility": "Accessibility guidelines and considerations",
      "informationHierarchy": "Information hierarchy and content organization"
    }
  }
}

CRITICAL COLOR REQUIREMENTS:
- ABSOLUTELY CRITICAL: Use EXACTLY 5 colors maximum (no more, no less) - primary, secondary, accent, background, text
- ABSOLUTELY CRITICAL: All 5 colors MUST be from the SAME tone/shade/family - NO mixing of clashing colors (e.g., NO green+blue+yellow together, NO red+green+blue together)
- Colors MUST be contextual to the app type and target audience:
  - Professional/B2B apps: Trust-building blues, professional grays
  - Health/Medical apps: Calming greens, tranquil blues
  - Finance apps: Secure blues, reliability-focused tones
  - Creative/Design apps: Vibrant colors, artistic palettes
  - Education apps: Warm, approachable tones
  - Fitness/Wellness apps: Energetic colors with motivation-focused tones
  - Social apps: Friendly, inviting colors
  - Gaming/Entertainment apps: Bold, exciting colors
- Color scheme structure: Use 4-5 related colors in one tone/theme + ONE contrasting accent color for CTAs and important elements
- The color palette should reflect the app's purpose, brand personality, and user emotions
- Colors must be harmonious and coherent (use either monochromatic scheme with variations of the same tone, or analogous/complementary scheme with maximum 2 tones)

CRITICAL TYPOGRAPHY REQUIREMENTS:
- ABSOLUTELY CRITICAL: Typography MUST complement and enhance the color palette - DO NOT default to Roboto or generic fonts without considering color harmony
- Font choice MUST create visual harmony with the chosen colors:
  - Warm colors (browns, oranges, yellows) → warm fonts like Playfair Display, Merriweather
  - Cool colors (blues, teals, grays) → sleek fonts like Inter, Poppins, Work Sans
  - Vibrant colors → bold fonts like Montserrat, Oswald
  - Soft colors → friendly fonts like Nunito, Lato
  - Deep/rich colors → sophisticated fonts like Cormorant, Lora
  - Neutral colors → clean fonts like Space Grotesk, Atlas Grotesk
- Fonts MUST be selected based on app context AND color mood:
  - Professional apps: Clean, readable sans-serif (Inter, Work Sans, Roboto ONLY if it matches the color mood)
  - Creative apps: Distinctive display fonts that enhance the color personality
  - Editorial/Content apps: Serif fonts for readability (Merriweather, Georgia, Lora) matching color warmth
  - Technical apps: Monospace options for code/data, still chosen to complement colors
  - Luxury brands: Elegant, refined typefaces that enhance color sophistication
  - Youth-oriented apps: Playful, modern fonts matching color energy
- Include specific font recommendations with reasoning for each app type AND how they work with the color palette
- Typography should match the app's personality AND create visual harmony with the chosen colors

CRITICAL APP ICON REQUIREMENTS:
- The appIcon MUST include exactly 2 letters that represent the app (e.g., "TP" for Taskify Pro, "SM" for Smart Manager, "FD" for Food Delivery)
- The bgColor MUST be either a single color (e.g., "#6366F1") or a gradient (e.g., "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)")
- The letters should be white and bold, displayed in a simple, clean design
- The description should explain the design concept briefly

Make sure all descriptions are clear and actionable for designers and developers.

Application Overview:
${isReference ? `[SPEC_REFERENCE]
Spec ID: ${specId}
Overview Location: Firebase > specs collection > ${specId} > overview field
Note: The system will retrieve the full overview content automatically. Use this reference to access the complete application overview details.` : overviewContent}

User Input:
App Description: ${appDescription}
User Workflow: ${workflow}
Additional Details: ${additionalDetails}
Target Audience: ${targetAudience}`;
  },

  // Diagrams prompt - generates Mermaid diagrams
  diagrams: (technicalContent, overviewContent) => {
    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be diagrams. If a value is unknown, return an empty array/object—never omit required keys.

Generate 7 Mermaid diagrams based on the technical specification. Return JSON with diagrams key containing an array of 7 diagram objects, each with:

{
  "diagrams": [
    {
      "id": "user_flow",
      "type": "flowchart",
      "title": "User Flow Diagram",
      "description": "User journey through application screens and actions",
      "mermaidCode": "Valid Mermaid flowchart syntax",
      "status": "success"
    },
    {
      "id": "system_architecture",
      "type": "graph", 
      "title": "System Architecture Diagram",
      "description": "Overall system structure, layers, servers, APIs, and communication",
      "mermaidCode": "Valid Mermaid graph syntax",
      "status": "success"
    },
    {
      "id": "information_architecture",
      "type": "graph",
      "title": "Information System Architecture Diagram", 
      "description": "Information system including IO processes, integrations, and interfaces",
      "mermaidCode": "Valid Mermaid graph syntax",
      "status": "success"
    },
    {
      "id": "data_schema",
      "type": "erDiagram",
      "title": "Data Schema Diagram (ERD)",
      "description": "Entity structure, relationships, primary/foreign keys based on technical specification database schema",
      "mermaidCode": "Valid Mermaid erDiagram syntax",
      "status": "success"
    },
    {
      "id": "database_schema",
      "type": "erDiagram",
      "title": "Database Schema Diagram",
      "description": "Complete database schema with all tables, fields, data types, and relationships based on the technical specification",
      "mermaidCode": "Valid Mermaid erDiagram syntax with all entities and their attributes",
      "status": "success"
    },
    {
      "id": "sequence",
      "type": "sequenceDiagram",
      "title": "Sequence Diagram",
      "description": "Sequence of actions for specific events (login, purchase, etc.)",
      "mermaidCode": "Valid Mermaid sequenceDiagram syntax",
      "status": "success"
    },
    {
      "id": "frontend_components",
      "type": "graph",
      "title": "Component Diagram (Frontend)",
      "description": "Structure of main UI components, modules, and their relationships",
      "mermaidCode": "Valid Mermaid graph syntax",
      "status": "success"
    }
  ]
}

CRITICAL REQUIREMENTS FOR ERD DIAGRAMS (data_schema AND database_schema):
- ABSOLUTELY CRITICAL: ERD syntax MUST be exactly correct
- CORRECT format for erDiagram:
  erDiagram
      ENTITY1 {
          int id PK
          string name
          string email
      }
      ENTITY2 {
          int id PK
          string title
          int entity1Id FK
          date createdAt
      }
      ENTITY1 ||--o{ ENTITY2 : "has"
- NEVER write: USERS {id} ||--o{ TASKS {projectId} : belongs_to
- CORRECT: First define entity attributes, THEN relationships
- Relationships must ONLY show entity names separated by relationship symbols
- NEVER put field names like {id} or {projectId} inside relationship lines
- Define ALL entity attributes inside curly braces BEFORE writing any relationships
- Relationship format: ENTITY1 ||--o{ ENTITY2 : "label"

CRITICAL REQUIREMENTS FOR database_schema DIAGRAM:
- database_schema MUST include ALL entities from the technical specification
- MUST show all fields with their data types for each entity
- MUST accurately represent the databaseSchema.tables from technical specification
- MUST include all relationships between entities
- This diagram should be based on the databaseSchema.tables provided in the technical specification
- Use the detailed table information to create a complete ERD

CRITICAL REQUIREMENTS FOR ALL DIAGRAMS:
- All mermaidCode must be valid Mermaid syntax
- Use proper node IDs and labels
- Include appropriate styling and formatting
- Ensure diagrams are comprehensive and detailed
- Each diagram should be self-contained and meaningful
- database_schema diagram must match the actual databaseSchema from technical specification

Technical Specification:
${technicalContent}

Application Overview:
${overviewContent}`;
  },

  // Raw text prompt - generates raw AI response
  rawText: (answers) => {
    const appDescription = answers[0] || 'Not provided';
    const workflow = answers[1] || 'Not provided';
    const additionalDetails = answers[2] || 'Not provided';
    const targetAudience = answers[3] || 'Not provided';

    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be rawText. If a value is unknown, return an empty array/object—never omit required keys.

Create a comprehensive raw text response. Return JSON with rawText key containing:

{
  "rawText": {
    "content": "Complete raw text response from AI API - this should be the direct, unprocessed response that can be displayed as plain text",
    "paragraphs": ["Paragraph 1", "Paragraph 2", "Paragraph 3"],
    "summary": "Brief summary of the main points"
  }
}

User Input:
App Description: ${appDescription}
User Workflow: ${workflow}
Additional Details: ${additionalDetails}
Target Audience: ${targetAudience}`;
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PROMPTS;
} else {
  window.PROMPTS = PROMPTS;
}