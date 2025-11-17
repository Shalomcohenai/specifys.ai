// Prompts for New 3-Question Specification Flow
// This file contains all the prompts for the simplified specification system

const PROMPTS = {
  // Overview prompt - generates general app information
  overview: (answers) => {
    const appDescription = answers[0] || 'Not provided';
    const workflow = answers[1] || 'Not provided';
    const additionalDetails = answers[2] || 'Not provided';
    // Target Audience information should be inferred from app description and workflow

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
    },
    "complexityScore": {
      "architecture": 0-100,
      "integrations": 0-100,
      "functionality": 0-100,
      "userSystem": 0-100
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
- complexityScore MUST be an object with four numeric values (0-100) representing:
  * architecture: Frontend only = 20, Frontend+Backend = 60, Full stack with database = 90
  * integrations: 0 integrations = 0, 1-2 = 30, 3-5 = 60, 6+ = 90 (based on third-party services mentioned)
  * functionality: Based on number of features, screens, and user flow complexity (simple = 30, moderate = 60, complex = 90)
  * userSystem: No user system = 0, Basic authentication = 40, Full user system with profiles = 80
- All content should be detailed, comprehensive, and provide substantial value
- All values must be strings or arrays, never null or undefined

User Input:
App Description: ${appDescription}
User Workflow: ${workflow}
Additional Details: ${additionalDetails}
Note: Target Audience information should be inferred from the app description and workflow provided above.`;
  },

  // Technical specification prompt - generates detailed technical specs
  technical: (specId, answers) => {
    const appDescription = answers[0] || 'Not provided';
    const workflow = answers[1] || 'Not provided';
    const additionalDetails = answers[2] || 'Not provided';
    // Target Audience information should be inferred from app description and workflow

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
      "securityCriticalPoints": [
        "CRITICAL: Never store API keys, secrets, or sensitive credentials in frontend code. Always use backend server or environment variables.",
        "CRITICAL: Always validate and sanitize all user inputs on the backend to prevent injection attacks (SQL injection, XSS, etc.).",
        "CRITICAL: Use HTTPS for all API communications and never send sensitive data over unencrypted connections.",
        "CRITICAL: Implement proper authentication tokens (JWT) with expiration and refresh mechanisms. Never store passwords in plain text.",
        "CRITICAL: Use CORS properly configured on the backend to prevent unauthorized cross-origin requests. Never use wildcard (*) in production."
      ],
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

CRITICAL FOR SECURITY & AUTHENTICATION:
- securityAuthentication.securityCriticalPoints MUST be an array of 3-5 critical security warnings
- Each security critical point MUST be a clear, actionable warning about common security mistakes in vibe coding
- Generate warnings that are SPECIFIC to this application based on its features and integrations
- Focus on critical issues that developers often miss when building quickly:
  * If the app uses API keys or third-party services: "CRITICAL: Never store API keys, secrets, or sensitive credentials in frontend code. Always use backend server or environment variables."
  * If the app has user input or forms: "CRITICAL: Always validate and sanitize all user inputs on the backend to prevent injection attacks (SQL injection, XSS, etc.)."
  * If the app handles authentication: "CRITICAL: Implement proper authentication tokens (JWT) with expiration and refresh mechanisms. Never store passwords in plain text - always use hashing (bcrypt, argon2)."
  * If the app makes API calls: "CRITICAL: Use HTTPS for all API communications and never send sensitive data over unencrypted connections."
  * If the app has a backend API: "CRITICAL: Use CORS properly configured on the backend to prevent unauthorized cross-origin requests. Never use wildcard (*) in production."
  * If the app uses a database: "CRITICAL: Use parameterized queries or ORM to prevent SQL injection attacks. Never concatenate user input directly into SQL queries."
  * If the app displays user-generated content: "CRITICAL: Sanitize all user-generated content before displaying to prevent XSS attacks. Use Content Security Policy (CSP) headers."
- These warnings MUST be specific, actionable, and critical for application security
- The security field is very vulnerable in vibe coding - these warnings are ESSENTIAL
- Generate 3-5 warnings that are MOST RELEVANT to this specific application

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
Note: Target Audience information should be inferred from the app description and workflow provided above.`;
  },

  // Market research prompt - generates market analysis
  market: (specId, answers) => {
    const appDescription = answers[0] || 'Not provided';
    const workflow = answers[1] || 'Not provided';
    const additionalDetails = answers[2] || 'Not provided';
    // Target Audience information should be inferred from app description and workflow

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
Note: Target Audience information should be inferred from the app description and workflow provided above.`;
  },

  // Design & Branding prompt - generates design guidelines and branding
  design: (specId, answers) => {
    const appDescription = answers[0] || 'Not provided';
    const workflow = answers[1] || 'Not provided';
    const additionalDetails = answers[2] || 'Not provided';
    // Target Audience information should be inferred from app description and workflow

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
Note: Target Audience information should be inferred from the app description and workflow provided above.`;
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
    // Target Audience information should be inferred from app description and workflow

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
Note: Target Audience information should be inferred from the app description and workflow provided above.`;
  },

  // Prompts generation - creates comprehensive development prompt and third-party integration instructions
  prompts: (overviewContent, technicalContent, designContent) => {
    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be prompts. If a value is unknown, return an empty array/object—never omit required keys.

IMPORTANT: All output must be in English regardless of the input language.

Create an EXTREMELY DETAILED, PRACTICAL development prompt that guides a developer to build the complete application from scratch. This prompt must be organized in 10 CLEAR DEVELOPMENT STAGES that must be followed in exact order. Each stage builds on the previous one. The prompt must be so detailed that it leads to a perfect result on the first try. Focus on OPERATIONAL DETAILS, not high-level concepts.

{
  "prompts": {
    "fullPrompt": "You are building [APPLICATION_NAME] - [APPLICATION_DESCRIPTION from overview].\n\nPROJECT OVERVIEW:\n[Use the ideaSummary and valueProposition from overview to describe what the application does and why it's important]\n\nTECHNICAL STACK:\n[Based on technical specification, list the exact technologies:\n- Frontend: [exact framework, version, libraries]\n- Backend: [exact runtime, framework, version]\n- Database: [exact database types and versions]\n- Authentication: [exact auth methods and libraries]\n- Other services: [storage, real-time, etc.]\n]\n\nSECURITY REQUIREMENTS:\n- End-to-end encryption for all sensitive data\n- HTTPS/WSS for all communications\n- JWT tokens with expiration and refresh mechanisms\n- Rate limiting on all API endpoints\n- CORS properly configured (no wildcards in production)\n- Input validation and sanitization on backend\n- Never store API keys or secrets in frontend code\n\nDEVELOPMENT STAGES - BUILD IN THIS EXACT ORDER:\n\n═══════════════════════════════════════════════════════════════\nSTAGE 1: PROJECT SETUP & BASIC STRUCTURE\n═══════════════════════════════════════════════════════════════\n\n1.1 Initialize Project Structure\n   - Create [FRAMEWORK] project with TypeScript\n   - Set up folder structure: [list exact folders based on tech stack]\n   - Configure [CSS_FRAMEWORK] with custom design tokens\n   - Set up ESLint, Prettier, and TypeScript strict mode\n   - Initialize Git repository and create .gitignore\n\n1.2 Environment Configuration\n   - Set up .env.local with required environment variables\n   - Configure environment variables for API keys\n   - Set up development, staging, and production configs\n   - Never commit .env files to Git\n\n1.3 Basic Layout & Navigation\n   - Create main layout component with header and sidebar\n   - Implement responsive navigation menu\n   - Set up routing structure for main pages\n   - Create basic page components [list pages from overview]\n   - Add loading states and error boundaries\n\n1.4 Design System Setup\n   - Create design tokens file (colors, typography, spacing from design spec)\n   - Set up component library structure\n   - Create base UI components (Button, Input, Card, Modal)\n   - Implement dark mode support if needed\n   - Set up icon system\n\n═══════════════════════════════════════════════════════════════\nSTAGE 2: FRONTEND CORE FUNCTIONALITY\n═══════════════════════════════════════════════════════════════\n\n2.1 [MAIN_FEATURE_1] UI Components\n   [For each main feature from overview, detail:\n   - Build [ComponentName] component with [specific functionality]\n   - Create [ListComponent] component with filtering and sorting\n   - Implement [FormComponent] for creating/editing\n   - Build [DetailComponent] modal/view\n   - Add [status indicators, badges, etc.]\n   - Implement search and filter functionality\n   ]\n\n2.2 [MAIN_FEATURE_2] UI\n   [Repeat for each major feature area]\n\n2.3 Dashboard & Analytics UI\n   - Build dashboard layout with widgets\n   - Create metrics cards\n   - Implement progress bars and charts\n   - Add visualization components\n   - Build insights display component\n\n2.4 User Interface Polish\n   - Implement smooth animations and transitions\n   - Add loading skeletons for better UX\n   - Create empty states with helpful messages\n   - Implement toast notifications system\n   - Add keyboard shortcuts support\n   - Ensure mobile responsiveness\n\n═══════════════════════════════════════════════════════════════\nSTAGE 3: AUTHENTICATION & USER MANAGEMENT\n═══════════════════════════════════════════════════════════════\n\n3.1 Authentication Setup\n   - Install and configure [AUTH_LIBRARY] from tech stack\n   - Set up OAuth providers [list from tech spec]\n   - Implement email/password authentication\n   - Create login and signup pages\n   - Add magic link authentication option if needed\n   - Implement password reset flow\n\n3.2 User Session Management\n   - Set up JWT token handling\n   - Implement refresh token mechanism\n   - Create session management utilities\n   - Add automatic session refresh\n   - Implement logout functionality\n\n3.3 User Profile & Settings\n   - Build user profile page\n   - Create settings page with preferences\n   - Implement [timezone, locale, notification] settings\n   - Create account deletion functionality\n\n3.4 Multi-Factor Authentication (if needed)\n   - Implement 2FA via TOTP\n   - Add QR code generation for authenticator apps\n   - Create backup codes system\n   - Add MFA enforcement for sensitive actions\n\n═══════════════════════════════════════════════════════════════\nSTAGE 4: BACKEND API DEVELOPMENT\n═══════════════════════════════════════════════════════════════\n\n4.1 Backend Project Setup\n   - Initialize [BACKEND_FRAMEWORK] server with TypeScript\n   - Set up API route structure\n   - Configure middleware (CORS, body parser, compression)\n   - Set up request logging and error handling\n   - Create API response utilities\n\n4.2 Database Setup & Models\n   - Set up [DATABASE_TYPE] connection with [ORM]\n   - Create database schema for [list all entities from databaseSchema]\n   - Set up [additional databases if needed]\n   - Configure [search engine if needed]\n   - Create database migration scripts\n   - Set up database seeding for development\n\n4.3 [MAIN_ENTITY_1] Management API\n   - Create POST /api/v1/[entity] (create)\n   - Create GET /api/v1/[entity] (list with filters)\n   - Create GET /api/v1/[entity]/:id (get details)\n   - Create PUT /api/v1/[entity]/:id (update)\n   - Create DELETE /api/v1/[entity]/:id (delete/archive)\n   - Implement validation and sanitization\n   - Add optimistic locking for conflict prevention\n\n4.4 [MAIN_ENTITY_2] Management API\n   [Repeat for each main entity]\n\n4.5 User & Team Management API\n   - Create user profile endpoints\n   - Implement [team/group] creation and management\n   - Add member invitation system\n   - Create role-based access control endpoints\n   - Implement permission checking middleware\n\n═══════════════════════════════════════════════════════════════\nSTAGE 5: AI INTEGRATION & INTELLIGENT FEATURES (if applicable)\n═══════════════════════════════════════════════════════════════\n\n[Only include if AI features are mentioned in overview or technical spec]\n\n5.1 [AI_SERVICE] API Integration\n   - Set up [AI_SERVICE] client with environment variables\n   - Implement rate limiting and error handling\n   - Create caching layer for AI suggestions\n   - Build fallback mechanism if needed\n\n5.2 AI [FEATURE_NAME] Engine\n   - Create API endpoint: GET /api/v1/ai/[feature]\n   - Implement algorithm to [specific AI functionality]\n   - Build [specific AI logic]\n   - Create [specific AI features]\n\n5.3 Natural Language Processing (if needed)\n   - Implement NLP for [specific use case]\n   - Create intent recognition for user commands\n   - Build [specific NLP features]\n\n5.4 Analytics AI (if needed)\n   - Create API endpoint: POST /api/v1/ai/analyze-[feature]\n   - Implement [specific analytics algorithm]\n   - Build [specific insights system]\n\n═══════════════════════════════════════════════════════════════\nSTAGE 6: REAL-TIME COLLABORATION (if applicable)\n═══════════════════════════════════════════════════════════════\n\n[Only include if real-time features are mentioned]\n\n6.1 WebSocket Setup\n   - Install and configure Socket.io v4\n   - Set up Redis Adapter for horizontal scaling\n   - Create WebSocket connection handler\n   - Implement automatic reconnection logic\n\n6.2 Real-Time Features\n   - Implement live [specific real-time features]\n   - Create activity stream broadcasting\n   - Add typing indicators\n   - Build presence tracking system\n   - Implement real-time [entity] updates\n\n6.3 Conflict Resolution\n   - Implement Operational Transformation (OT) algorithm\n   - Create conflict detection system\n   - Build merge strategies for concurrent edits\n   - Add conflict resolution UI\n\n6.4 Notification System\n   - Create notification service\n   - Implement real-time push notifications\n   - Add email notification system\n   - Build notification preferences management\n\n═══════════════════════════════════════════════════════════════\nSTAGE 7: THIRD-PARTY INTEGRATIONS\n═══════════════════════════════════════════════════════════════\n\n[For each third-party service from technical spec]\n\n7.1 [SERVICE_NAME] Integration\n   - Implement OAuth 2.0 flow for [SERVICE]\n   - Set up webhook listeners for [SERVICE] events\n   - Create sync job for bi-directional sync\n   - Implement conflict resolution if needed\n\n7.2 [SERVICE_NAME] Integration\n   [Repeat for each integration]\n\n7.3 Email Integration\n   - Set up [EMAIL_SERVICE] for email sending\n   - Implement email parsing for [specific use case]\n   - Create email notification templates\n   - Add email-based [feature] flow\n\n7.4 Additional Integrations\n   [List any other integrations from tech spec]\n\n═══════════════════════════════════════════════════════════════\nSTAGE 8: MOBILE APP DEVELOPMENT (if applicable)\n═══════════════════════════════════════════════════════════════\n\n[Only include if mobile app is mentioned]\n\n8.1 React Native Setup\n   - Initialize React Native project\n   - Set up navigation (React Navigation)\n   - Configure state management\n   - Set up API client for backend communication\n\n8.2 Core Mobile Features\n   - Implement [main feature] list and detail views\n   - Create [feature] creation and editing forms\n   - Add offline-first data synchronization\n   - Implement push notifications\n\n8.3 Mobile-Specific Features\n   - Add gesture support for [feature]\n   - Implement quick actions from home screen\n   - Create mobile-optimized dashboard\n   - Add [specific mobile features]\n\n═══════════════════════════════════════════════════════════════\nSTAGE 9: TESTING & QUALITY ASSURANCE\n═══════════════════════════════════════════════════════════════\n\n9.1 Unit Testing\n   - Write unit tests for utility functions\n   - Test API endpoints with Jest/Supertest\n   - Test React components with React Testing Library\n   - Achieve minimum 80% code coverage\n\n9.2 Integration Testing\n   - Test API integration flows\n   - Test authentication flows\n   - Test real-time collaboration features (if applicable)\n   - Test third-party integrations\n\n9.3 End-to-End Testing\n   - Set up Playwright/Cypress for E2E tests\n   - Test critical user flows\n   - Test cross-browser compatibility\n   - Test mobile responsiveness\n\n9.4 Performance Testing\n   - Load testing for API endpoints\n   - Test WebSocket connection limits (if applicable)\n   - Optimize database queries\n   - Implement caching strategies\n\n═══════════════════════════════════════════════════════════════\nSTAGE 10: DEPLOYMENT & DEVOPS\n═══════════════════════════════════════════════════════════════\n\n10.1 Infrastructure Setup\n   - Set up Docker containers for services\n   - Configure [CLOUD_PLATFORM] for deployment\n   - Set up CI/CD pipeline with GitHub Actions\n   - Configure environment-specific deployments\n\n10.2 Monitoring & Logging\n   - Set up [MONITORING_TOOL] for error tracking\n   - Implement structured logging\n   - Create monitoring dashboards\n   - Set up alerting for critical issues\n\n10.3 Security Hardening\n   - Perform security audit\n   - Set up WAF and DDoS protection\n   - Implement rate limiting at infrastructure level\n   - Configure SSL/TLS certificates\n\n10.4 Production Deployment\n   - Deploy frontend to [HOSTING_PLATFORM]\n   - Deploy backend to [CLOUD_PLATFORM]\n   - Set up database backups\n   - Configure CDN for static assets\n\n═══════════════════════════════════════════════════════════════\n\nIMPORTANT NOTES:\n- Follow this order strictly - each stage builds on the previous one\n- Test thoroughly after each stage before moving to the next\n- Commit code frequently with descriptive commit messages\n- Document API endpoints and component props\n- Follow TypeScript best practices and avoid 'any' types\n- Ensure all code is accessible (WCAG 2.1 AA compliant)\n- Optimize for performance from the start\n- Write clean, maintainable, and scalable code\n\nPlease build this application following best practices, ensuring scalability, security, and excellent user experience.",
    "thirdPartyIntegrations": [
      {
        "service": "Service name (e.g., Lemon Squeezy, Stripe, AWS S3, SendGrid)",
        "description": "What this service does and why it's needed for the application",
        "instructions": [
          "Step 1: Detailed instruction (e.g., 'Sign up for Lemon Squeezy at https://lemonsqueezy.com and create an account')",
          "Step 2: Detailed instruction (e.g., 'Create a JSON file named products.json containing all product details with the following structure: {\\"name\\": \\"Product Name\\", \\"price\\": 9.99, \\"description\\": \\"Product description\\"}')",
          "Step 3: Detailed instruction (e.g., 'Store the API key in environment variable LEMON_SQUEEZY_API_KEY and ensure it's never committed to version control')",
          "Step 4: Additional steps as needed for complete integration setup"
        ]
      }
    ]
  }
}

CRITICAL REQUIREMENTS FOR FULLPROMPT:
- MUST be EXTREMELY DETAILED (20000-40000+ characters) - this is not optional
- MUST be organized in EXACTLY 10 DEVELOPMENT STAGES as shown in the template above
- MUST follow the exact order: Stage 1 → Stage 2 → ... → Stage 10
- MUST replace ALL placeholders in brackets [LIKE_THIS] with actual values from the specifications:
  * [APPLICATION_NAME] → actual app name from overview
  * [APPLICATION_DESCRIPTION] → ideaSummary from overview
  * [FRAMEWORK] → exact framework from tech stack (e.g., "Next.js 14")
  * [CSS_FRAMEWORK] → exact CSS framework (e.g., "Tailwind CSS 3.4")
  * [AUTH_LIBRARY] → exact auth library (e.g., "NextAuth.js v5")
  * [BACKEND_FRAMEWORK] → exact backend framework (e.g., "Express.js 4.21")
  * [DATABASE_TYPE] → exact database (e.g., "PostgreSQL 15")
  * [ORM] → exact ORM (e.g., "Prisma 5.11")
  * [MAIN_FEATURE_1], [MAIN_FEATURE_2] → actual features from overview.coreFeaturesOverview
  * [MAIN_ENTITY_1], [MAIN_ENTITY_2] → actual entities from databaseSchema.tables
  * [SERVICE_NAME] → actual third-party services from integrationExternalApis
  * [CLOUD_PLATFORM] → actual deployment platform from devops
  * [MONITORING_TOOL] → actual monitoring tool from devops
  * [HOSTING_PLATFORM] → actual frontend hosting platform
- MUST include ALL 10 stages even if some are conditional (mark conditional stages clearly)
- MUST provide detailed sub-steps (1.1, 1.2, etc.) for each stage
- MUST focus on OPERATIONAL DETAILS, not high-level concepts
- MUST include exact implementation details: function signatures, component props, API formats, database schemas
- MUST cover EVERY page with ALL its UI components (from overview.screenDescriptions)
- MUST detail EVERY function with exact parameters and logic
- MUST explain HOW data models connect (relationships, not just definitions)
- MUST provide step-by-step flows for ALL processes (authentication, user journeys, etc.)
- MUST include exact styling details (colors from design.visualStyleGuide.colors, fonts from design.visualStyleGuide.typography, spacing)
- MUST NOT include high-level concepts like "User Experience Principles" or abstract descriptions
- MUST be practical and actionable - a developer should be able to build the app exactly as imagined from this prompt
- MUST be in English
- MUST adapt stages 5, 6, and 8 based on whether those features exist in the spec:
  * Stage 5 (AI) - only if AI features are mentioned
  * Stage 6 (Real-time) - only if real-time features are mentioned
  * Stage 8 (Mobile) - only if mobile app is mentioned
- The prompt should be so detailed that it leads to perfect results on the first implementation attempt

CRITICAL REQUIREMENTS FOR THIRD-PARTY INTEGRATIONS:
- thirdPartyIntegrations MUST identify ALL third-party services mentioned in technical specification
- Each integration MUST have detailed, actionable instructions (minimum 3-4 steps per integration)
- Instructions MUST be in English and provide clear steps the user needs to take
- Include instructions for: API keys, configuration files, account setup, data formats, webhook setup, etc.
- If no third-party integrations are needed, return an empty array (but still include the key)

Application Overview:
${overviewContent || 'Not provided'}

Technical Specification:
${technicalContent || 'Not provided'}

Design Specification:
${designContent || 'Not provided'}`;
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PROMPTS;
} else {
  window.PROMPTS = PROMPTS;
}