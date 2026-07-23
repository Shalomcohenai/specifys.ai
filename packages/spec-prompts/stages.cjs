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

/**
 * Agent-ticket quality stage prompt.
 * Each stage returns Build / Review / Tests variants inside one fullPrompt string.
 */
function buildStageUserMessage(stageNumber, overviewContent, technicalContent, designContent, previousStages) {
  const stageName = STAGE_NAMES[stageNumber];
  const prevContext = previousStages.length > 0
    ? `PREVIOUS STAGES CONTEXT:\n${previousStages.map((s, i) => `Stage ${i + 1} (summary): ${s.substring(0, 400)}...`).join('\n\n')}\n\n`
    : '';

  return `Application Overview:
${overviewContent || 'Not provided'}

Technical Specification:
${technicalContent || 'Not provided'}

Design Specification:
${designContent || 'Not provided'}

You are writing STAGE ${stageNumber}: ${stageName} as an Agent Ticket for an implementation agent.

OUTPUT FORMAT (mandatory — use these exact section headers):
## Goal
(1–2 sentences: what this stage delivers for THIS product)

## Non-goals
- Bullet list of what this stage must NOT do

## Files to create
- Concrete paths inferred from technical/repo structure (e.g. backend/server/..., assets/js/features/...)

## Files to modify
- Concrete existing paths when applicable

## Acceptance criteria
- [ ] Checkbox-style AC that are testable and product-specific
- [ ] Include at least 4 AC

## Commands
\`\`\`bash
# exact commands an agent can run (install, test, lint, migrate) — product-specific
\`\`\`

## Definition of done
- Bullet checklist covering build, tests, and handoff notes

## Pitfalls
- Concrete traps for this stack/product (not generic advice)

## Variant: Build
Step-by-step implementation order for this stage only (sub-steps ${stageNumber}.1, ${stageNumber}.2, …). Focus on WHAT to build and HOW to structure it — no full code bodies.

## Variant: Review
Checklist an agent uses to review the Build output (correctness, security, a11y, schema alignment).

## Variant: Tests
Which tests to add/run for this stage (unit/integration/e2e as relevant) and what each proves.

CRITICAL REQUIREMENTS:
1. Generate ONLY STAGE ${stageNumber} — do NOT include other stages
2. Quality over fluff: prefer concrete paths, AC, and commands over generic essays. Target 2,500–4,500 characters (not thin 1–2k fluff)
3. Replace ALL placeholders with actual values from the specifications
4. Skip Stage 3 (auth), Stage 5 (AI), Stage 6 (real-time), Stage 8 (mobile) content if the specs do not mention those capabilities — in that case write a short "Skipped: not in scope" Goal with Non-goals explaining why
5. Every screen and feature from the overview MUST be referenced when relevant
6. DO NOT include full code blocks, import statements, or complete function bodies
7. Tie Files to create/modify to repositoryStructure / technical stack when available

${prevContext}Return ONLY the stage content (without an outer STAGE header).`;
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
Each stage below is an Agent Ticket with Goal, Non-goals, Files, AC, Commands, DoD, Pitfalls, and Build/Review/Tests variants.

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
    const shortTitle = overviewData?.overview?.shortTitle || overviewData?.shortTitle;
    if (shortTitle) {
      fullPrompt = fullPrompt.replace(/\[APPLICATION_NAME\]/g, shortTitle);
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
      if (techStack.authentication) {
        fullPrompt = fullPrompt.replace(/\[exact auth methods and libraries\]/g, techStack.authentication);
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
