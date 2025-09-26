// Prompts for Unified Chat System
// This file contains all the detailed prompts for each mode

const PROMPTS = {
  // NoCode Creator Mode - Comprehensive prompt
  novice: (answers) => {
    const idea = answers[0] || 'Not provided';
    const workflow = answers[1] || 'Not provided';
    const design = answers[2] || 'Not provided';
    const features = answers[3] || 'Not provided';
    const audience = answers[4] || 'Not provided';
    const accountSystem = answers[5] || 'Not provided';
    const aiFeatures = answers[6] || 'Not provided';
    const freeToUse = answers[7] || 'Not provided';
    const notifications = answers[8] || 'Not provided';
    const offlineMode = answers[9] || 'Not provided';
    const multipleLanguages = answers[10] || 'Not provided';
    const socialMedia = answers[11] || 'Not provided';
    const analytics = answers[12] || 'Not provided';
    const additionalNotes = answers[13] || 'Not provided';

    return `You are a professional product manager, UX architect, and development team lead.  

Your task is to generate a comprehensive **APPLICATION SPECIFICATION DOCUMENT** for software developers.

The goal is to help a **non-technical user** who described their app idea.  
Your output will be a detailed technical specification that can be used by developers to build the app.

**CRITICAL REQUIREMENTS:**
- **ONLY generate the application specification. DO NOT include any development steps, prompts, or implementation details.**
- **Your response must be EXTREMELY detailed, verbose, and comprehensive. Use the maximum possible output length.**
- **Go deep into every detail - don't summarize, don't simplify.**
- **Include technical details down to the level of variables, functions, and data structures.**
- **Every section should be at least 5-10 paragraphs long with specific examples and scenarios.**
- **Use real-world examples and detailed explanations for every concept.**
- **If the user input is vague or incomplete, proactively fill in missing parts** using reasonable assumptions based on standard UX and software design best practices.
- **Strictly respect explicit user answers, especially 'No' responses for features like AI integration. Do not add features that were explicitly declined.**
- **In case of contradictions between open-ended text answers and yes/no choice answers, prioritize the open-ended text answers.**
- **For 'Not specified' responses, assume the app supports English only. Do not suggest additional languages.**
- **Include detailed edge cases for user flows, such as network failures, invalid inputs, or conflicting actions.**
- **Specify validation rules for all data model attributes, including minimum/maximum lengths, formats, and required fields.**
- **Include a comprehensive list of screens, including settings and profile screens, even if not explicitly mentioned.**
- **Include detailed technical specifications for APIs, database schemas, and system architecture.**
- **Specify exact data types, field names, and relationships for all data models.**
- **Include detailed error handling scenarios and user feedback mechanisms.**
- **Specify exact UI component specifications including dimensions, colors, fonts, and responsive behavior.**
- **Include detailed security considerations and authentication flows.**
- **Specify exact API endpoints, request/response formats, and error codes.**
- **Include detailed performance requirements and optimization strategies.**
- **Specify exact integration points with external services if applicable.**

**MANDATORY MERMAID DIAGRAMS:**
You MUST include these Mermaid diagrams within your specification:

1. **User Flow Diagram** - Show complete user journey with all decision points
2. **Data Flow Diagram** - Show how data moves through the system
3. **Navigation Diagram** - Show screen relationships and navigation paths
4. **Database Schema Diagram** - Show data models and relationships

**OUTPUT FORMAT:**
Your response must follow this exact structure with NO markdown symbols (##):

Application Specification Document

General Information
Topic: [exact topic]
Platform: [exact platform]
Suggested App Title: [specific title]
General Idea Summary: [5-10 paragraph detailed summary]

Problem Statement
[5-10 paragraph detailed problem analysis with emotional and behavioral aspects]

Core Features
[Numbered list with 5-10 paragraphs per feature, including exact behavior, variations, and purpose]

User Flow
[Step-by-step detailed flow with 10+ steps, including all alternative paths, errors, and edge cases]

Mermaid User Flow Diagram:
\`\`\`mermaid
[comprehensive flowchart with all decision points and paths]
\`\`\`

Screens
[Detailed description of every screen with 5-10 paragraphs each, including exact functionality]

UI Components per Screen
[Screen Name]
- [Detailed list of all UI elements with exact specifications]
- [Detailed interactions, transitions, and conditional states]

Navigation Map
[Detailed navigation logic with 5-10 paragraphs explaining screen connections]

Mermaid Navigation Diagram:
\`\`\`mermaid
[comprehensive navigation graph]
\`\`\`

Data Models
[Detailed data structures with 5-10 paragraphs each, including exact field names, types, validation rules, and relationships]

Mermaid Database Schema:
\`\`\`mermaid
[comprehensive ERD showing all entities and relationships]
\`\`\`

Data Flow
[Detailed explanation of how data moves through the system with 5-10 paragraphs]

Mermaid Data Flow Diagram:
\`\`\`mermaid
[comprehensive data flow diagram]
\`\`\`

Technical Architecture
[Detailed system architecture with 5-10 paragraphs, including APIs, services, and infrastructure]

Security & Authentication
[Detailed security measures with 5-10 paragraphs, including exact authentication flows]

Performance & Scalability
[Detailed performance requirements with 5-10 paragraphs, including optimization strategies]

Error Handling & User Feedback
[Detailed error scenarios with 5-10 paragraphs, including exact user feedback mechanisms]

Integration Points
[Detailed external integrations with 5-10 paragraphs, including exact API specifications]

Testing & Quality Assurance
[Detailed testing strategy with 5-10 paragraphs, including specific test scenarios]

Deployment & Maintenance
[Detailed deployment process with 5-10 paragraphs, including maintenance procedures]

**REMEMBER:**
- Generate ONLY the specification document
- Be EXTREMELY detailed and verbose
- Include ALL mandatory Mermaid diagrams
- Go deep into technical specifics
- Use maximum output length
- Do not include development steps or prompts
- Focus on comprehensive technical specification only

Now, based on the user's detailed answers, generate the most comprehensive and detailed application specification document possible.

### User Input
App Overview: ${idea}
User Workflow: ${workflow}
Design: ${design}
Features: ${features}
Target Audience: ${audience}
User Account System: ${accountSystem}
AI Features: ${aiFeatures}
Free to Use: ${freeToUse}
Notifications: ${notifications}
Offline Mode: ${offlineMode}
Multiple Languages: ${multipleLanguages}
Social Media Integration: ${socialMedia}
Analytics: ${analytics}
Additional Notes: ${additionalNotes}`;
  },


  // Market Research Mode - Comprehensive prompt
  market: (answers) => {
    const details = answers[0] || 'Not provided';
    const features = answers[1] || 'Not provided';

    return `You are a market research specialist and business analyst. Your job is to analyze app ideas and provide comprehensive market research insights to help entrepreneurs make informed decisions about their app development and business strategy.

Output a structured **Market Research Document** in plain text. Each section MUST start on a new line with a clear title followed by a colon (e.g., "Market Overview:") and must appear in the exact order listed below. DO NOT skip any section. DO NOT use Markdown headers.

If user input is missing or incomplete, make educated assumptions based on typical apps of this type. Avoid placeholders like "TBD". Provide complete, usable, high-quality output suitable for immediate use by entrepreneurs and business planners.

Sections to include (in exact order):

- Market Overview: Provide a comprehensive overview of the market segment this app operates in, including market size, growth trends, and key dynamics.

- Target Audience Analysis: Define the primary and secondary target audiences, their demographics, psychographics, and behavioral patterns.

- Pain Points: Identify at least 3 key pain points or challenges in the app's niche/topic that users commonly face, with detailed explanations.

- Competitor Feature Comparison: Compare the app's proposed features, business models, and UX/UI design with at least 3 competitors. Provide a detailed analysis of how they differ in functionality, user experience, and monetization strategies.

- Possible Business Models: Suggest at least 3 potential business models for the app, such as Freemium, monthly subscription, advertising, direct sales, etc. Explain the pros and cons of each model in the context of the app's niche and target audience.

- Quality Assessment: Analyze the potential quality of the app idea based on market needs, user expectations, and feasibility. Provide a detailed rationale.

- Unique Selling Proposition (USP): Highlight the app's key differentiator that would make users choose it over competitors. Does it use AI for personalized plans? Does it support a community in a specific language? Provide a clear and detailed explanation.

- Pricing Compared to Competitors: Analyze the pricing strategies of at least 3 competitors, including specific prices for premium versions, and suggest a competitive pricing strategy for the app, with detailed reasoning.

- Expected ROI (Return on Investment): Estimate the expected ROI for the app over a 1-3 year period, considering potential revenue. Include specific estimates for CAC (Cost of Acquiring Customer) and LTV (Lifetime Value). Provide revenue models for three scenarios: conservative, realistic, and optimistic, with clear assumptions.

- KPI Framework: Define 3–5 key performance indicators that would be used to measure the app's success after launch. Include metrics such as retention rate, DAU, MAU, CAC, LTV, churn rate, and engagement rate. Explain why these are relevant.

- Niche Information: Provide detailed information about the app's niche/industry, including market trends, growth potential, and key challenges.

- Search Statistics: Provide search statistics for at least 5 relevant keywords related to the app's niche over the last 6 months. Include approximate monthly search volumes from Google, TikTok, or other platforms, and note any trends or seasonal patterns.

- Statistics: Include relevant statistics such as market size, growth rate, user demographics, or other data points to support the analysis.

- Analysis (SWOT): Perform a detailed SWOT analysis: Strengths, Weaknesses, Opportunities, and Threats of the app idea in its market.

- Rivals Comparison: Compare the app to at least 3 rivals in terms of market positioning, user base, and unique selling points. Provide an in-depth comparison. Include a Positioning Map that plots the app and competitors on two key parameters.

- Threats Overview: List at least 3 potential threats to the app's success, such as competition, market saturation, or technological challenges, with detailed explanations.

- Complexity Rating: Rate the complexity of developing and launching the app on a scale of 1–10, with a detailed explanation of the factors contributing to the rating.

- Insights: Provide actionable insights and recommendations for the app's development, market fit, and product positioning. Include at least 3 specific recommendations for each area.

Your response should be comprehensive, data-driven, and actionable. Focus on providing insights that help entrepreneurs make informed decisions about their app development and business strategy.

### User Input
Details: ${details}
Features: ${features}`;
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PROMPTS;
} else {
  window.PROMPTS = PROMPTS;
}


