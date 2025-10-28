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
      "screens": ["Screen 1: Name, purpose, key elements, user interactions", "Screen 2: Name, purpose, key elements, user interactions"],
      "uiComponents": "Key UI components and their purposes",
      "navigationStructure": "How users move between screens"
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
- screenDescriptions.screens should describe each screen's name, purpose, key elements, and interactions
- All content should be detailed, comprehensive, and provide substantial value
- All values must be strings or arrays, never null or undefined

User Input:
App Description: ${appDescription}
User Workflow: ${workflow}
Additional Details: ${additionalDetails}
Target Audience: ${targetAudience}`;
  },

  // Technical specification prompt - generates detailed technical specs
  technical: (overviewContent, answers) => {
    const appDescription = answers[0] || 'Not provided';
    const workflow = answers[1] || 'Not provided';
    const additionalDetails = answers[2] || 'Not provided';
    const targetAudience = answers[3] || 'Not provided';

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
      "tables": ["Table 1 description", "Table 2 description"],
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
              "type": "field type (String, Integer, Boolean, etc.)",
              "required": true,
              "constraints": "Any constraints (unique, max length, etc.)",
              "description": "What this field stores"
            }
          ],
          "relationships": "Relationships with other models",
          "validationRules": "Validation rules for this model"
        }
      ],
      "overallStructure": "How all models relate to each other and the overall data architecture"
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

IMPORTANT FOR API ENDPOINTS:
- requestBody and responseBody must be detailed textual descriptions OR valid JSON strings (never [object Object])
- Include actual field names, types, and example values specific to the application
- Format as plain text descriptions or JSON strings, not JSON objects
- Example of good requestBody: "JSON string with fields: { \\"name\\": \\"John Doe\\", \\"email\\": \\"john@example.com\\", \\"age\\": 30 }"
- Example of good responseBody: "Returns JSON with fields: { \\"userId\\": 123, \\"status\\": \\"success\\" }"

Application Overview:
${overviewContent}

User Input:
App Description: ${appDescription}
User Workflow: ${workflow}
Additional Details: ${additionalDetails}
Target Audience: ${targetAudience}`;
  },

  // Market research prompt - generates market analysis
  market: (overviewContent, answers) => {
    const appDescription = answers[0] || 'Not provided';
    const workflow = answers[1] || 'Not provided';
    const additionalDetails = answers[2] || 'Not provided';
    const targetAudience = answers[3] || 'Not provided';

    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be market. If a value is unknown, return an empty array/object—never omit required keys.

Create detailed market analysis. Return JSON with market key containing:

{
  "market": {
    "industryOverview": {
      "trends": "Current industry trends and developments",
      "marketData": "Relevant market statistics and forecasts",
      "growthProjections": "Future market growth expectations"
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
        "competitor": "Competitor name",
        "advantages": "Their strengths",
        "disadvantages": "Their weaknesses",
        "marketPosition": "Their position in the market",
        "features": ["Feature list of competitor"],
        "uxStrengths": "What they do well in UX",
        "uxWeaknesses": "Where they fall short in UX",
        "monetization": "How they make money",
        "gaps": ["What they're missing", "Their weaknesses"],
        "marketShare": "Estimated market share"
      }
    ],
    "swotAnalysis": {
      "strengths": ["Strength 1", "Strength 2"],
      "weaknesses": ["Weakness 1", "Weakness 2"],
      "opportunities": ["Opportunity 1", "Opportunity 2"],
      "threats": ["Threat 1", "Threat 2"]
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
      "marketFitRating": "Rating 1-10 with detailed reasoning",
      "technicalFeasibility": "Feasibility rating and specific technical challenges",
      "executionRiskFactors": ["Risk factor 1", "Risk factor 2"],
      "marketReadiness": "Is the market ready? Why or why not",
      "keySuccessFactors": ["Factor 1", "Factor 2"],
      "goToMarketReadiness": "Ready/Not ready and specific reasons"
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
      "recommendations": "Recommended pricing approach with justification",
      "pricingComparison": [
        {
          "competitor": "Competitor name",
          "pricing": "$X/month or free",
          "features": "What they offer at this price",
          "valueProposition": "Why people pay for their service"
        }
      ],
      "justification": "Why this pricing structure makes sense",
      "suggestedPricing": "Recommended pricing structure with tiers"
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
      "trends": ["Trend 1 with context", "Trend 2 with context"],
      "opportunities": ["Opportunity 1", "Opportunity 2"],
      "challenges": ["Challenge 1", "Challenge 2"],
      "growthFactors": ["Factor 1 driving growth", "Factor 2 driving growth"],
      "marketMaturity": "Early stage/Growing/Mature/Declining"
    },
    "marketStatistics": {
      "globalStatistics": [
        "Stat 1 with context and source",
        "Stat 2 with context and source"
      ],
      "targetMarketSize": "Estimated TAM (Total Addressable Market) / SAM (Serviceable Addressable Market) / SOM (Serviceable Obtainable Market)",
      "growthRate": "Expected CAGR or growth rate",
      "keyNumbers": "Important numbers that support market viability"
    },
    "threatsOverview": {
      "externalThreats": [
        {
          "threat": "Specific threat description",
          "probability": "High/Medium/Low with reasoning",
          "impact": "High/Medium/Low and why",
          "mitigation": "How to mitigate or address this threat"
        }
      ],
      "competitiveThreats": ["Competitive threat 1", "Competitive threat 2"],
      "regulatoryThreats": ["Regulatory risk 1", "Regulatory risk 2"],
      "marketThreats": ["Market risk 1", "Market risk 2"]
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
        "recommendations": "What to focus on in development",
        "phases": "Suggested phased rollout approach (MVP, v1, v2)",
        "mvpFeatures": "Core features for Minimum Viable Product"
      },
      "marketFit": {
        "strategies": ["Go-to-market strategy 1", "Strategy 2"],
        "partnerships": "Recommended strategic partnerships",
        "timing": "Best time to launch (when, why)",
        "targetMarkets": "Which geographic or demographic markets to enter first"
      },
      "productPositioning": {
        "branding": "Branding recommendations and positioning",
        "messaging": "Key messages to use in marketing",
        "differentiation": "How to differentiate from competitors in messaging",
        "marketPosition": "Where to position in the market (premium, affordable, niche, etc.)"
      }
    },
    "marketingStrategy": {
      "channels": "Marketing channels to use",
      "community": "Community building strategies",
      "partnerships": "Potential partnerships and collaborations"
    }
  }
}

IMPORTANT: The searchTrends.historicalData should include at least 3 months of data with consistent formatting to enable easy chart/graph visualization.

Application Overview:
${overviewContent}

User Input:
App Description: ${appDescription}
User Workflow: ${workflow}
Additional Details: ${additionalDetails}
Target Audience: ${targetAudience}`;
  },

  // Design & Branding prompt - generates design guidelines and branding
  design: (overviewContent, answers) => {
    const appDescription = answers[0] || 'Not provided';
    const workflow = answers[1] || 'Not provided';
    const additionalDetails = answers[2] || 'Not provided';
    const targetAudience = answers[3] || 'Not provided';

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
      "iconSet": "Icon set specifications and style"
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
- ABSOLUTELY CRITICAL: All 4-5 colors MUST be from the SAME tone/shade/family - NO mixing of clashing colors (e.g., NO green+blue+yellow together, NO red+green+blue together)
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

Make sure all descriptions are clear and actionable for designers and developers.

Application Overview:
${overviewContent}

User Input:
App Description: ${appDescription}
User Workflow: ${workflow}
Additional Details: ${additionalDetails}
Target Audience: ${targetAudience}`;
  },

  // Diagrams prompt - generates Mermaid diagrams
  diagrams: (technicalContent, overviewContent) => {
    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be diagrams. If a value is unknown, return an empty array/object—never omit required keys.

Generate 6 Mermaid diagrams based on the technical specification. Return JSON with diagrams key containing an array of 6 diagram objects, each with:

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
      "description": "Entity structure, relationships, primary/foreign keys",
      "mermaidCode": "Valid Mermaid erDiagram syntax",
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

CRITICAL REQUIREMENTS:
- All mermaidCode must be valid Mermaid syntax
- Use proper node IDs and labels
- Include appropriate styling and formatting
- Ensure diagrams are comprehensive and detailed
- Each diagram should be self-contained and meaningful

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