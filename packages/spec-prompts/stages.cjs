const STAGE_NAMES = {
  1: 'PROJECT SETUP & BASIC STRUCTURE',
  2: 'FRONTEND CORE FUNCTIONALITY',
  3: 'AUTHENTICATION & USER MANAGEMENT',
  4: 'BACKEND API DEVELOPMENT',
  5: 'AI INTEGRATION',
  6: 'REAL-TIME COLLABORATION',
  7: 'THIRD-PARTY INTEGRATIONS',
  8: 'MOBILE APP DEVELOPMENT',
  9: 'TESTING & QUALITY ASSURANCE',
  10: 'DEPLOYMENT & DEVOPS'
};

const TOTAL_STAGES = 10;

function buildStageUserMessage(stageNumber, overviewContent, technicalContent, designContent, previousStages) {
  const stageName = STAGE_NAMES[stageNumber];
  const prevContext = previousStages.length > 0
    ? `PREVIOUS STAGES CONTEXT:\n${previousStages.map((s, i) => `Stage ${i + 1} (summary): ${s.substring(0, 300)}...`).join('\n\n')}\n\n`
    : '';

  return `Application Overview:
${overviewContent || 'Not provided'}

Technical Specification:
${technicalContent || 'Not provided'}

Design Specification:
${designContent || 'Not provided'}

You are generating STAGE ${stageNumber}: ${stageName} for a development prompt.

CRITICAL REQUIREMENTS:
1. Generate ONLY the content for STAGE ${stageNumber} - do NOT include other stages
2. Keep it CONCISE and FOCUSED - aim for 1,000-2,000 characters
3. Include sub-steps (${stageNumber}.1, ${stageNumber}.2, etc.) with clear, actionable instructions
4. Replace ALL placeholders [LIKE_THIS] with actual values from the specifications
5. Focus on WHAT to build and HOW to structure it, NOT on writing actual code
6. Skip Stage 3 (auth), Stage 5 (AI), Stage 6 (real-time), Stage 8 (mobile) content if the specs do not mention those capabilities
7. Every screen and feature from the overview MUST be referenced when relevant to this stage
8. DO NOT include full code blocks, import statements, or complete function bodies

${prevContext}Return ONLY the content for STAGE ${stageNumber} (without the stage header - just the content).`;
}

function assembleFullPrompt(generatedStages, overviewContent, technicalContent) {
  let fullPrompt = `You are building [APPLICATION_NAME] - [APPLICATION_DESCRIPTION from overview].

PROJECT OVERVIEW:
[Use the ideaSummary and valueProposition from overview to describe what the application does and why it's important]

TECHNICAL STACK:
[Based on technical specification, list the exact technologies:
- Frontend: [exact framework, version, libraries]
- Backend: [exact runtime, framework, version]
- Database: [exact database types and versions]
- Authentication: [exact auth methods and libraries]
- Other services: [storage, real-time, etc.]
]

SECURITY REQUIREMENTS:
- End-to-end encryption for all sensitive data
- HTTPS/WSS for all communications
- JWT tokens with expiration and refresh mechanisms
- Rate limiting on all API endpoints
- CORS properly configured (no wildcards in production)
- Input validation and sanitization on backend
- Never store API keys or secrets in frontend code

DEVELOPMENT STAGES - BUILD IN THIS EXACT ORDER:

`;

  generatedStages.forEach((stageContent, index) => {
    const stageNum = index + 1;
    const stageName = STAGE_NAMES[stageNum];
    fullPrompt += `═══════════════════════════════════════════════════════════════\n`;
    fullPrompt += `STAGE ${stageNum}: ${stageName}\n`;
    fullPrompt += `═══════════════════════════════════════════════════════════════\n\n`;
    fullPrompt += stageContent;
    fullPrompt += `\n\n`;
  });

  fullPrompt += `═══════════════════════════════════════════════════════════════\n\n`;
  fullPrompt += `IMPORTANT NOTES:
- Follow this order strictly - each stage builds on the previous one
- Test thoroughly after each stage before moving to the next
- Commit code frequently with descriptive commit messages
- Document API endpoints and component props
- Follow TypeScript best practices and avoid 'any' types
- Ensure all code is accessible (WCAG 2.1 AA compliant)
- Optimize for performance from the start
- Write clean, maintainable, and scalable code

Please build this application following best practices, ensuring scalability, security, and excellent user experience.`;

  try {
    const overviewData = typeof overviewContent === 'string' ? JSON.parse(overviewContent) : overviewContent;
    const technicalData = typeof technicalContent === 'string' ? JSON.parse(technicalContent) : technicalContent;
    const ideaSummary = overviewData?.overview?.ideaSummary || overviewData?.ideaSummary;
    if (ideaSummary) {
      fullPrompt = fullPrompt.replace(/\[APPLICATION_DESCRIPTION from overview\]/g, ideaSummary);
    }
    const techStack = technicalData?.technical?.techStack || technicalData?.techStack;
    if (techStack) {
      if (techStack.frontend) {
        fullPrompt = fullPrompt.replace(/\[exact framework, version, libraries\]/g, techStack.frontend);
      }
      if (techStack.backend) {
        fullPrompt = fullPrompt.replace(/\[exact runtime, framework, version\]/g, techStack.backend);
      }
      if (techStack.database) {
        fullPrompt = fullPrompt.replace(/\[exact database types and versions\]/g, techStack.database);
      }
    }
  } catch (_) {
    /* best-effort */
  }

  return fullPrompt;
}

function buildIntegrationsPrompt(overviewContent, technicalContent) {
  return `Generate third-party integration instructions based on the technical specification.

Application Overview:
${overviewContent || 'Not provided'}

Technical Specification:
${technicalContent || 'Not provided'}

Return ONLY valid JSON with key "thirdPartyIntegrations" containing an array. Each item must have:
- service: Service name
- description: What this service does and why it's needed
- instructions: Array of detailed setup steps (minimum 3-4 steps)

If no third-party integrations are needed, return { "thirdPartyIntegrations": [] }.`;
}

module.exports = {
  STAGE_NAMES,
  TOTAL_STAGES,
  buildStageUserMessage,
  assembleFullPrompt,
  buildIntegrationsPrompt
};
