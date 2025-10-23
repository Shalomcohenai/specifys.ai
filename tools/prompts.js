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
    "ideaSummary": "A detailed, comprehensive description (3-4 sentences) of what the application does, what problem it solves for users, and why it's important. Include the core functionality, main benefits, and how it addresses user pain points.",
    "targetAudience": {
      "ageRange": "Specific age range with reasoning (e.g., '25-45 years old, representing working professionals')",
      "sector": "Detailed industry or business sector with context (e.g., 'Healthcare sector, specifically telemedicine and patient management')",
      "interests": ["Array of 5-7 detailed interests, hobbies, or professional activities"],
      "needs": ["Array of 5-7 specific, detailed needs this app addresses with explanations"]
    },
    "valueProposition": "A comprehensive explanation (2-3 sentences) of what makes this app unique compared to competitors, including specific advantages, unique features, and the main value it provides to users",
    "coreFeaturesOverview": ["List of 6-8 main features with brief descriptions of what each feature does and how it benefits users"],
    "userJourneySummary": "A detailed, step-by-step description (4-5 sentences) of how a user would use the app from start to finish, including onboarding, main workflows, and key interactions"
  }
}

IMPORTANT DETAILED REQUIREMENTS: 
- ideaSummary should be 3-4 sentences with comprehensive explanation of purpose, functionality, and benefits
- targetAudience.ageRange should include reasoning for the age group
- targetAudience.sector should be specific with industry context
- targetAudience.interests should be 5-7 detailed interests or professional activities
- targetAudience.needs should be 5-7 specific needs with explanations
- valueProposition should be 2-3 sentences explaining uniqueness and competitive advantages
- coreFeaturesOverview should be 6-8 features with brief descriptions of functionality and benefits
- userJourneySummary should be 4-5 sentences describing complete user flow including onboarding and key interactions
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
        "requestExample": "Example request body",
        "responseExample": "Example response"
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
    }
  }
}

IMPORTANT: All descriptions must be textual only. Diagrams will be generated separately.

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
    "targetAudienceInsights": {
      "needsAnalysis": "Analysis of user needs and pain points",
      "usageHabits": "How target audience currently behaves",
      "demographics": "Detailed demographic breakdown"
    },
    "competitiveLandscape": [
      {
        "competitor": "Competitor name",
        "advantages": "Their strengths",
        "disadvantages": "Their weaknesses",
        "marketPosition": "Their position in the market"
      }
    ],
    "swotAnalysis": {
      "strengths": ["Strength 1", "Strength 2"],
      "weaknesses": ["Weakness 1", "Weakness 2"],
      "opportunities": ["Opportunity 1", "Opportunity 2"],
      "threats": ["Threat 1", "Threat 2"]
    },
    "monetizationModel": {
      "proposedModels": ["Subscription", "Pay-per-use", "Freemium"],
      "recommendations": "Recommended monetization strategy",
      "pricingStrategy": "Suggested pricing approach"
    },
    "marketingStrategy": {
      "channels": "Marketing channels to use",
      "community": "Community building strategies",
      "partnerships": "Potential partnerships and collaborations"
    }
  }
}

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