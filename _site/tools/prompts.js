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
  },

  // Design & Branding prompt - generates design guidelines and branding
  design: (overviewContent, answers) => {
    const appDescription = answers[0] || 'Not provided';
    const workflow = answers[1] || 'Not provided';
    const additionalDetails = answers[2] || 'Not provided';
    const targetAudience = answers[3] || 'Not provided';

    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be design. If a value is unknown, return an empty array/object—never omit required keys.

Create comprehensive design guidelines and branding elements. Return JSON with design key containing:

1. colorPalette: Object with primary, secondary, accent colors and their hex codes
2. typography: Object with heading, body, and caption font specifications
3. uiComponents: Object with button, input, card, and navigation component styles
4. brandingGuidelines: Object with logo concepts, brand personality, and visual identity
5. layoutPrinciples: Object with spacing, grid system, and responsive design guidelines
6. accessibility: Object with contrast ratios, font sizes, and accessibility considerations

Make sure all descriptions are clear and actionable for designers and developers.

Application Overview:
${overviewContent}

User Input:
App Description: ${appDescription}
User Workflow: ${workflow}
Additional Details: ${additionalDetails}
Target Audience: ${targetAudience}`;
  },

  diagrams: (technicalContent, overviewContent) => {
    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be diagrams. If a value is unknown, return an empty array/object—never omit required keys.

Generate 6 Mermaid diagrams based on the technical specification. Return JSON with diagrams key containing an array of 6 diagram objects, each with:

1. id: String identifier (user_flow, system_architecture, information_architecture, data_schema, sequence, frontend_components)
2. type: String Mermaid diagram type (flowchart, graph, erDiagram, sequenceDiagram)
3. title: String descriptive title
4. description: String brief description of what the diagram shows
5. mermaidCode: String valid Mermaid syntax for the diagram
6. status: String always "success"

DIAGRAM REQUIREMENTS:

1. User Flow Diagram (id: "user_flow", type: "flowchart"):
   - Show complete user journey through application screens
   - Include all navigation paths, decision points, and user actions
   - Use flowchart syntax with nodes and edges
   - Example: graph TD\n    A[Start] --> B[Login] --> C{Dashboard}

2. System Architecture Diagram (id: "system_architecture", type: "graph"):
   - Show overall system structure and layers
   - Include frontend, backend, database, external APIs, services
   - Use graph syntax with subgraphs for layers
   - Example: graph TB\n    subgraph Frontend\n        A[React App]\n    end

3. Information System Architecture Diagram (id: "information_architecture", type: "graph"):
   - Show data flows, input/output processes, integration points
   - Include information processing workflows
   - Use graph syntax with directional edges
   - Example: graph LR\n    A[Input] --> B[Process] --> C[Output]

4. Data Schema Diagram (id: "data_schema", type: "erDiagram"):
   - Show all data entities, attributes, relationships
   - Include primary keys, foreign keys, and constraints
   - Use erDiagram syntax with entities and relationships
   - Example: erDiagram\n    USER ||--o{ ORDER : places\n    USER {\n        int id PK\n        string name\n    }

5. Sequence Diagram (id: "sequence", type: "sequenceDiagram"):
   - Show interaction flow for key user process (login, purchase, etc.)
   - Include all actors, messages, and time sequence
   - Use sequenceDiagram syntax with participants and messages
   - Example: sequenceDiagram\n    participant U as User\n    participant S as System\n    U->>S: Login Request

6. Frontend Components Diagram (id: "frontend_components", type: "graph"):
   - Show main UI components, modules, and their relationships
   - Include frontend application structure
   - Use graph syntax with component nodes
   - Example: graph TD\n    A[App Component] --> B[Header]\n    A --> C[Main Content]

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
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PROMPTS;
} else {
  window.PROMPTS = PROMPTS;
}