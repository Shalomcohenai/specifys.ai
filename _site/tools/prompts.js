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

Create a detailed overview that includes applicationSummary with paragraphs array, coreFeatures array, userJourney with steps and diagram, targetAudience with primary/secondary arrays and diagram, problemStatement string, and uniqueValueProposition string.

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

Create a comprehensive technical specification with readable text descriptions. Return JSON with technical key containing:

1. dataModels: Object with entities array containing entities with name and attributes array
2. databaseSchema: Object with tables array containing tables with name and columns array  
3. api: Object with endpoints array containing endpoints with path, method, description, requestBody, and responses
4. security: Object with authentication, authorization (roles array), and dataProtection details
5. integrationPoints: Object with externalAPIs and internalServices arrays

CRITICAL: The dataModels must have an "entities" array and databaseSchema must have a "tables" array. These are required fields.

Make sure all descriptions are clear and readable text, not technical jargon.

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

Create detailed market analysis with readable text descriptions. Return JSON with market key containing:

1. marketOverview: String with comprehensive market analysis and trends
2. competitors: Object with list array containing competitor names and brief descriptions
3. targetAudience: Object with personas array containing detailed user personas
4. pricingStrategy: String with detailed pricing recommendations and rationale

Make sure all descriptions are clear and readable text, not technical jargon.

Application Overview:
${overviewContent}

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