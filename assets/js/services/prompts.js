// Prompts for Planning-Based Specification Flow
// This file contains all the prompts for the planning-based specification system
// The system now uses: App Description + Structured Cards (Pages, Workflows, Features, Design, Integrations, Target Audience, optional UI Screenshot References)

// Shared specification prompt builders for Specifys.ai
// @see packages/spec-prompts

function formatUserRequirements(answers) {
  const appDescription = (answers && answers[0]) || '';
  const workflow = (answers && answers[1]) || '';
  const additionalDetails = (answers && answers[2]) || '';
  if (!appDescription || appDescription === 'Not provided') {
    return '';
  }
  const lines = [`USER REQUIREMENTS (mandatory — do not omit or contradict):`, appDescription];
  if (workflow && workflow !== 'Not provided') {
    lines.push(`User Workflow: ${workflow}`);
  }
  if (additionalDetails && additionalDetails !== 'Not provided') {
    lines.push(`Additional Details: ${additionalDetails}`);
  }
  return lines.join('\n\n');
}

/**
 * Strict Mermaid rules block shared across stages that emit diagrams.
 * Mirrors mermaid-validator expectations (Mermaid 10 / mermaid.parse).
 */
const MERMAID_RULES_BLOCK = `MERMAID DIAGRAM RULES (strict — apply to every *Mermaid field):
- Output RAW Mermaid only. No \`\`\`mermaid fences, no surrounding prose, no comments outside the diagram.
- The first non-empty line MUST be a directive: flowchart TD/LR, graph TD/LR, erDiagram, sequenceDiagram, classDiagram, stateDiagram-v2, mindmap, pie, gantt, journey.
- Node IDs: ASCII letters, digits and underscore only. NO spaces, dots, hyphens, parentheses, slashes or non-ASCII characters in IDs.
- Labels with spaces or punctuation MUST be quoted: A["Login Page"]-->B["Dashboard"]. Never write A[Login Page] -- mermaid will reject it.
- No emoji, no smart quotes (use straight " and '), no HTML other than <br> inside labels.
- Edges: --> for solid, --- for plain, ==> for thick. Sequence arrows: ->>, -->>, ->, -->.
- erDiagram: keep cardinality tokens exact (||--o{, }o--||, |o--o|). Each entity body uses { } on its own lines.
- Keep diagrams under ~25 nodes; collapse detail into sub-systems if needed.
- Never repeat the same edge twice; never reference an undefined node ID.`;

const PROMPTS = {
  // Overview prompt - generates general app information
  overview: (answers) => {
    // In the new structure, all information comes in answers[0] as structured text
    // answers[1] and answers[2] are empty strings (kept for backward compatibility)
    const userInput = answers[0] || 'Not provided';

    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be overview. If a value is unknown, return an empty array/object—never omit required keys.

IMPORTANT: All output must be in English regardless of the input language.

INPUT STRUCTURE:
The user input below is structured into clear sections:
- "App Description:" - The main application description/vision
- "Pages:" - Specific pages the user has defined (if provided)
- "Workflows:" - Specific workflows with steps the user has defined (if provided)
- "Features:" - Specific features the user has selected/defined (if provided)
- "Design Style:" - Design preferences the user has selected (if provided)
- "Integrations:" - Third-party integrations the user has specified (if provided)
- "Target Audience:" - Audience details the user has provided (if provided)
- "UI Screenshot References:" - One or more English UI/visual requirements derived from user-uploaded screenshots plus optional short user notes (if provided)

CRITICAL WORKFLOW - FOLLOW THIS EXACT ORDER:

STEP 1: IDENTIFY USER-PROVIDED DATA
First, scan the user input and identify which sections exist:
- Does "Pages:" section exist? → List all pages mentioned
- Does "Workflows:" section exist? → List all workflows and their steps
- Does "Features:" section exist? → List all features mentioned
- Does "Design Style:" section exist? → Note the design style
- Does "Integrations:" section exist? → List all integrations
- Does "Target Audience:" section exist? → Extract all audience details
- Does "UI Screenshot References:" section exist? → List every reference line (layout, colors, components, dashboard type, etc.)

STEP 2: USE USER-PROVIDED DATA AS FOUNDATION (MANDATORY)
For each section that EXISTS in the user input:
- This data is MANDATORY and MUST appear in the specification
- Use it as the foundation/base for that field
- Do NOT replace, omit, or generalize user-provided information
- If user provided specific pages → those EXACT pages must appear in screenDescriptions.screens
- If user provided specific workflows → those EXACT workflows and steps must appear in detailedUserFlow.steps
- If user provided specific features → those EXACT features must appear in coreFeaturesOverview
- If user provided design style → it MUST be reflected in the design descriptions
- If user provided integrations → they MUST be included in complexityScore and relevant sections
- If user provided target audience details → those EXACT values must appear in targetAudience
- If user provided UI screenshot references → EVERY reference MUST be reflected in screenDescriptions (matching screens or new screen objects), valueProposition/visual language where relevant, and coreFeaturesOverview when the reference implies functionality (e.g. charts, metrics). Do NOT ignore colors, typography, or layout described in those lines.

STEP 3: MUST / MAY / INFERRED (CRITICAL)
After including all user-provided data, apply these priority rules:

MUST (mandatory — never omit or contradict):
- Every page, workflow step, feature, integration, design style, target audience detail, and UI screenshot reference from user input MUST appear verbatim/traceable in the output.
- User-provided names MUST match exactly (page names, feature names, integration names).

MAY (only when needed for coherence):
- Add screens ONLY to connect user-provided pages (e.g. navigation between two user-defined screens).
- Add workflow steps ONLY to bridge gaps between user-defined steps.
- Add features ONLY when required for user-defined pages/workflows to function.
- Keep additions minimal — prefer fewer, focused additions over padding lists.

INFERRED (not requested by user):
- Any screen, feature, workflow step, or integration NOT in user input MUST be marked with "[INFERRED]" in its name or description.
- List every inferred item in overview.inferredItems (array of short strings describing what was added and why).
- Do NOT add auth, real-time collaboration, AI, or mobile unless user requested them OR App Description explicitly requires them.

STEP 4: FILL GAPS (ONLY WHERE USER DATA DOES NOT EXIST)
For sections that DO NOT exist in the user input:
- You may infer and create content based on the App Description
- You may add additional pages if needed (but ONLY if "Pages:" section was empty)
- You may add additional workflows if needed (but ONLY if "Workflows:" section was empty)
- You may add additional features if needed (but ONLY if "Features:" section was empty)
- You may infer design style if not provided (but ONLY if "Design Style:" section was empty)
- You may infer integrations if not provided (but ONLY if "Integrations:" section was empty)
- You may infer target audience if not provided (but ONLY if "Target Audience:" section was empty)
- You may NOT invent conflicting UI/visual details if "UI Screenshot References:" exists—treat those lines as authoritative for the described screens

Create a comprehensive and detailed overview based on the user input. Follow the workflow above to ensure user-provided data is prioritized:

{
  "overview": {
    "shortTitle": "A concise display title (3-8 words) for the spec, e.g. 'Task Management for Teams' or 'Healthcare Patient Portal'",
    "ideaSummary": "A concise, clear description (250-750 characters) of what the application does, what problem it solves for users, why it's important, core functionality, and main benefits. Keep it focused and impactful.",
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
      "steps": ["Step 1: User action and system response description", "Step 2: User action and system response description", "Step 3: User action and system response description"]
    },
    "screenDescriptions": {
      "screens": [
        {
          "name": "Screen Name (e.g., Home Screen, Dashboard)",
          "description": "Detailed description of the screen's purpose, key elements, and user interactions",
          "uiComponents": ["Component 1: Purpose, placement, behavior", "Component 2: Purpose, placement, behavior"],
          "emptyState": "What the user sees when there is no data yet (null if not applicable)",
          "errorState": "What the user sees when this screen fails to load or an action fails (null if not applicable)",
          "edgeCases": ["Edge case 1", "Edge case 2"]
        }
      ],
      "navigationStructure": "Detailed navigation flow including: main navigation paths, side navigation, bottom navigation, modal flows, deep linking structure, and key transition points between screens"
    },
    "complexityScore": {
      "architecture": 0-100,
      "integrations": 0-100,
      "functionality": 0-100,
      "userSystem": 0-100
    },
    "suggestionsIdeaSummary": {
      "toInclude": [],
      "notToInclude": ["One specific benefit or angle derived from THIS app's idea (e.g. concrete outcome or differentiator)", "Another concrete phrase that could be merged into the idea summary to deepen it"]
    },
    "suggestionsCoreFeatures": {
      "toInclude": [],
      "notToInclude": ["Optional feature with brief description", "Another optional feature to consider"]
    },
    "inferredItems": ["Short description of each inferred screen/feature/step/integration added because user did not provide it — empty array if none"],
    "personas": [
      {
        "name": "Persona name",
        "role": "Job/role relative to the product",
        "goals": ["Goal 1", "Goal 2"],
        "pains": ["Pain 1", "Pain 2"],
        "jtbd": "When [situation], I want to [motivation], so I can [outcome]"
      }
    ],
    "epics": [
      {
        "name": "Epic name",
        "description": "What this epic delivers",
        "stories": [
          {
            "title": "Story title",
            "description": "As a [persona], I want [capability] so that [benefit]",
            "acceptanceCriteria": ["Given/When/Then or checklist AC 1", "AC 2"]
          }
        ]
      }
    ],
    "nonGoals": ["Explicitly out of scope for v1 — what we will NOT build"],
    "successMetrics": {
      "northStar": "Single primary success metric for the product",
      "leading": ["Leading indicator 1", "Leading indicator 2"]
    },
    "permissionsMatrix": [
      {
        "role": "Role name (e.g., Owner, Member, Viewer)",
        "permissions": ["permission.action", "another.permission"]
      }
    ],
    "glossary": [
      {
        "term": "Domain term",
        "definition": "Plain-language definition specific to this product"
      }
    ]
  }
}

IMPORTANT DETAILED REQUIREMENTS: 
- shortTitle MUST be a concise display title in 3-8 words (e.g. "Task Management for Teams", "Healthcare Patient Portal"). It will be shown as the spec title in the UI—do not use the first sentence of ideaSummary; create a dedicated catchy title.
- ideaSummary should be 250-750 characters with concise explanation of purpose, functionality, benefits, and value
- problemStatement should be 2-3 paragraphs (400-800 characters) covering: the problem, why it matters, pain points (practical and emotional), current workarounds, and solution gap
- targetAudience.ageRange should include reasoning for the age group
- targetAudience.sector should be specific with industry context
- targetAudience.interests should be 5-7 detailed interests or professional activities
- targetAudience.needs should be 5-7 specific needs with explanations
- valueProposition should be 2-3 sentences explaining uniqueness and competitive advantages
- coreFeaturesOverview: REQUIRED non-empty array of 4–8 feature strings with brief descriptions. NEVER return []. Include ALL user-provided features; add [INFERRED] features only when needed for coherence. Prefer populating this field over epics alone — epics complement features, they do not replace them.
- userJourneySummary should be 4-5 sentences describing complete user flow including onboarding and key interactions
- detailedUserFlow.steps: REQUIRED non-empty array of at least 3 concise steps (1-2 sentences each). NEVER return []. These steps display as a visual journey rail.
- screenDescriptions.screens MUST be a REQUIRED non-empty array of at least 3 screen objects (NEVER []). Each object: name, description, uiComponents array, emptyState (string|null), errorState (string|null), edgeCases (array|null)
- Each screen object MUST include at least 2-3 uiComponents specific to that screen
- For each screen: emptyState and errorState should describe real UX copy/behavior when relevant; use null only when truly N/A. edgeCases should list 1–3 realistic edge cases or null
- screenDescriptions.screens: include ALL user-provided pages; when Pages: is absent, infer 3–6 primary screens from the App Description and mark them [INFERRED] — never leave screens empty
- screenDescriptions.navigationStructure MUST be comprehensive with detailed navigation paths
- complexityScore MUST be an object with four numeric values (0-100) representing:
  * architecture: Frontend only = 20, Frontend+Backend = 60, Full stack with database = 90
  * integrations: 0 integrations = 0, 1-2 = 30, 3-5 = 60, 6+ = 90 (based on third-party services mentioned)
  * functionality: Based on number of features, screens, and user flow complexity (simple = 30, moderate = 60, complex = 90)
  * userSystem: No user system = 0, Basic authentication = 40, Full user system with profiles = 80
- suggestionsIdeaSummary and suggestionsCoreFeatures MUST be objects with exactly "toInclude" (array) and "notToInclude" (array). Put all generated suggestions in notToInclude (user can add them later). toInclude stays empty [].
- suggestionsIdeaSummary.notToInclude: 3-5 short, concrete phrases or sentences (one line each) that DEVELOP THIS SPECIFIC IDEA. Each suggestion must: (a) be directly derived from this app's ideaSummary, valueProposition, or problemStatement; (b) be something that could be merged into the idea summary to deepen or refine it (e.g. a specific benefit, differentiator, or angle for this app). Do NOT suggest generic directions (e.g. "add target audience" or "mention scalability"); every item must be specific content that extends this idea.
- suggestionsCoreFeatures.notToInclude: 3-5 optional features with brief descriptions (same format as coreFeaturesOverview items) that fit the app but were not included in the main list.
- personas: 2–4 personas with name, role, goals[], pains[], jtbd — grounded in targetAudience and App Description (null only if impossible)
- epics: 2–5 epics; each epic has stories with title, description, and acceptanceCriteria[] (testable Given/When/Then or checklist). Map stories to user-provided features/pages when present
- nonGoals: 3–6 explicit v1 non-goals (what we will NOT build)
- successMetrics: northStar string + leading[] indicators tied to this product
- permissionsMatrix: role → permissions[] for every meaningful role (Owner/Admin/Member/Viewer as applicable); null only if no user system
- glossary: 4–10 domain terms specific to THIS product
- All content should be detailed, comprehensive, and provide substantial value
- Nullable enriched fields (personas, epics, nonGoals, successMetrics, permissionsMatrix, glossary, screen empty/error/edgeCases) may be null when truly inapplicable — prefer populated values
- All other values must be strings, numbers, or arrays as shown — never omit required keys

DETAILED FIELD REQUIREMENTS WITH USER DATA PRIORITY:

1. screenDescriptions.screens:
   - CRITICAL: screens MUST be an array of objects, NOT strings. Each object must have: name, description, uiComponents (array), emptyState (string|null), errorState (string|null), edgeCases (array|null)
   - IF "Pages:" section EXISTS in user input:
     * EVERY page from "Pages:" MUST appear in screenDescriptions.screens as an object with name, description, and uiComponents
     * Use the exact page names provided
     * For each user-provided page, create a screen object with: name (page name), description (detailed screen description), uiComponents (array of 2-3 components for that screen), plus empty/error/edgeCases
     * MAY add [INFERRED] screens only to connect user pages — list each in inferredItems
   - IF "Pages:" section DOES NOT EXIST:
     * Create 3–6 screens based on App Description analysis; mark each as [INFERRED] in inferredItems
     * NEVER return an empty screens array

2. detailedUserFlow.steps:
   - CRITICAL: Only include "steps" array. Do NOT include decisionPoints, errorHandling, confirmations, or feedbackLoops
   - Each step should be concise (1-2 sentences) as it will be displayed in a visual journey rail
   - At least 3 steps required — NEVER return an empty steps array
   - IF "Workflows:" section EXISTS in user input:
     * EVERY workflow from "Workflows:" MUST appear in detailedUserFlow.steps
     * Include ALL steps from each workflow exactly as provided
     * MAY add [INFERRED] steps only to bridge gaps — list in inferredItems
   - IF "Workflows:" section DOES NOT EXIST:
     * Create at least 3–6 workflow steps based on App Description; mark additions in inferredItems

3. coreFeaturesOverview:
   - REQUIRED: at least 4 feature strings — NEVER return []
   - IF "Features:" section EXISTS in user input:
     * EVERY feature from "Features:" MUST appear in coreFeaturesOverview
     * Use the exact feature names provided
     * You may add brief descriptions, but feature names MUST match exactly
     * MAY add [INFERRED] features only when needed — list in inferredItems
   - IF "Features:" section DOES NOT EXIST:
     * Infer 4–8 features from App Description; mark each in inferredItems
     * Do NOT leave coreFeaturesOverview empty even if you also fill epics

4. Design Style (in screenDescriptions and valueProposition):
   - IF "Design Style:" section EXISTS in user input:
     * The design style MUST be reflected in screenDescriptions and valueProposition
     * Use the exact design style name and description provided
     * Incorporate the design style into visual descriptions
   - IF "Design Style:" section DOES NOT EXIST:
     * You may infer design style based on App Description and target audience

5. Integrations (in complexityScore.integrations and relevant sections):
   - IF "Integrations:" section EXISTS in user input:
     * EVERY integration from "Integrations:" MUST be considered in complexityScore.integrations
     * Each integration service name MUST appear in relevant sections
     * Use exact integration names provided
   - IF "Integrations:" section DOES NOT EXIST:
     * You may infer integrations based on App Description analysis
     * Set complexityScore.integrations accordingly (0 if no integrations inferred)

6. targetAudience:
   - IF "Target Audience:" section EXISTS in user input:
     * Platform (if provided) MUST be reflected in targetAudience.sector
     * ALL interests (if provided) MUST appear in targetAudience.interests array
     * Age range (if provided) MUST be used in targetAudience.ageRange
     * Gender (if provided) MUST be considered
     * Use EXACT values - do NOT infer or modify
   - IF "Target Audience:" section DOES NOT EXIST:
     * You may infer target audience based on App Description analysis

7. UI Screenshot References (screenDescriptions, valueProposition, coreFeaturesOverview):
   - IF "UI Screenshot References:" section EXISTS in user input:
     * EVERY numbered item MUST inform the spec: merge into relevant screenDescriptions.screens (add or extend screens to match), describe UI components and visual style explicitly, and mention metrics/widgets/features implied by the reference
     * Preserve concrete details: color palette, typography hints, chart types, card layouts, navigation patterns
   - IF "UI Screenshot References:" section DOES NOT EXIST:
     * Do not assume extra screenshot-based UI beyond App Description and other sections

8. ideaSummary, problemStatement, valueProposition:
   - MUST be based on "App Description:" section
   - Use the App Description as the foundation
   - You may expand and enhance, but core content MUST align with user's description

9. suggestionsIdeaSummary and suggestionsCoreFeatures:
   - MUST be present with toInclude: [] and notToInclude: [...] (arrays of strings)
   - suggestionsIdeaSummary.notToInclude: 3-5 concrete phrases that develop this specific idea (derived from ideaSummary/valueProposition); each must be mergeable into the idea summary. No generic directions.
   - suggestionsCoreFeatures.notToInclude: 3-5 optional feature descriptions (same style as coreFeaturesOverview)

10. personas, epics, nonGoals, successMetrics, permissionsMatrix, glossary:
   - Ground personas and epics in user-provided features, pages, workflows, and target audience
   - Epic stories MUST trace to coreFeaturesOverview / screens where possible
   - acceptanceCriteria MUST be testable
   - nonGoals MUST NOT contradict MUST user requirements
   - permissionsMatrix MUST match any auth/roles implied by App Description (mark inferred roles in inferredItems if added)

VALIDATION CHECKLIST (Before generating output):
✓ Did I include shortTitle as a 3-8 word display title (not the start of ideaSummary)?
✓ Did I check if "Pages:" section exists? If yes, did I include ALL pages in screenDescriptions.screens?
✓ Is screenDescriptions.screens a non-empty array with at least 3 screen objects? (NEVER return [])
✓ Did I mark any non-user screens with [INFERRED] and list them in inferredItems?
✓ Did I check if "Workflows:" section exists? If yes, did I include ALL workflows and steps?
✓ Is detailedUserFlow.steps a non-empty array with at least 3 steps?
✓ Did I check if "Features:" section exists? If yes, did I include ALL features in coreFeaturesOverview?
✓ Is coreFeaturesOverview a non-empty array with at least 4 feature strings? (NEVER return [] — epics do not replace this field)
✓ Did I check if "Design Style:" section exists? If yes, did I incorporate it in design descriptions?
✓ Did I check if "Integrations:" section exists? If yes, did I include ALL integrations?
✓ Did I check if "Target Audience:" section exists? If yes, did I use EXACT values?
✓ Did I check if "UI Screenshot References:" exists? If yes, did I apply EVERY reference?
✓ Did I base ideaSummary, problemStatement, and valueProposition on "App Description:"?
✓ Did I avoid adding auth/real-time/AI/mobile unless user requested or App Description requires?
✓ Did I populate inferredItems for every [INFERRED] addition (empty array if none)?
✓ Did I add suggestionsIdeaSummary and suggestionsCoreFeatures with toInclude: [] and notToInclude?
✓ Did each screen include emptyState, errorState, and edgeCases (or null where N/A)?
✓ Did I include personas, epics (with stories + acceptanceCriteria), nonGoals, successMetrics, permissionsMatrix, and glossary?

REMEMBER: User-provided data is MANDATORY. Additions must be minimal, marked [INFERRED], and listed in inferredItems.

User Input:
${userInput}

Note: The user input above uses a structured format with sections. Follow the workflow: (1) Identify which sections exist, (2) Use user-provided data as mandatory foundation, (3) Expand on user data where it exists, (4) Fill gaps only where user data is missing. The specification MUST accurately reflect what the user provided, and only supplement where the user did not provide information.`;
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

    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be technical. Never omit required keys.

Create a comprehensive technical specification with Mermaid diagrams in the designated fields (raw Mermaid syntax only—no markdown fences inside JSON strings). Return JSON with technical key containing:

{
  "technical": {
    "techStack": { "frontend": "", "backend": "", "database": "", "storage": "", "authentication": "" },
    "architectureOverview": { "narrative": "", "systemContextDiagramMermaid": null },
    "databaseSchema": { "description": "", "erDiagramMermaid": "", "tablesSupplement": null },
    "apiDesign": {
      "endpointsOverviewDiagramMermaid": null,
      "endpoints": [
        {
          "path": "/api/v1/resource",
          "method": "POST",
          "description": "",
          "parameters": null,
          "requestBody": "",
          "responseBody": "",
          "statusCodes": null,
          "errorResponses": "Map of error codes to payloads/meanings (e.g. 400 validation, 401, 403, 404, 409, 429)",
          "authScope": "Required role/scope or 'public'",
          "rateLimit": "e.g. 60 req/min per user — or null",
          "idempotency": "Idempotency-Key behavior for mutating routes — or null"
        }
      ]
    },
    "dataFlow": { "narrative": "", "diagramMermaid": null },
    "securityAuthentication": {
      "authentication": "How THIS product authenticates users (exact methods, sessions/tokens, identity providers named in the overview/integrations)",
      "authorization": "Roles/permissions model for THIS product's actors (from overview personas/permissions — not generic RBAC filler)",
      "encryption": "What THIS product encrypts and why (specific data classes: messages, PII, payments, files) — or null",
      "securityMeasures": "Concrete controls tied to THIS app's features, data, and third-party integrations",
      "securityCriticalPoints": [
        "Project-specific critical warning naming a real asset, flow, or integration from THIS spec"
      ],
      "authFlowDiagramMermaid": null
    },
    "integrationExternalApis": { "thirdPartyServices": [], "integrations": "", "dataFlow": "", "integrationLandscapeDiagramMermaid": null },
    "devops": { "deploymentStrategy": "", "infrastructure": "", "monitoring": "", "scaling": "", "backup": "", "automation": "", "cicdPipelineDiagramMermaid": null },
    "dataStorage": { "storageStrategy": "", "dataRetention": "", "dataBackup": "", "storageArchitecture": "" },
    "analytics": { "analyticsStrategy": "", "trackingMethods": "", "analysisTools": "", "reporting": "" },
    "eventCatalog": [
      {
        "name": "domain.event_name",
        "description": "",
        "payloadSummary": "Key fields in the event payload",
        "consumers": ["service-or-worker"],
        "deliveryGuarantees": "at-least-once / exactly-once notes — or null"
      }
    ],
    "envSecrets": [
      {
        "name": "ENV_VAR_NAME",
        "purpose": "",
        "required": true,
        "exampleHint": "non-secret shape hint — or null"
      }
    ],
    "migrationAndSeed": "How schema migrations and seed data work for local/staging/prod",
    "performanceBudgets": {
      "lcpMs": 2500,
      "inpMs": 200,
      "cls": 0.1,
      "apiP95Ms": 300,
      "notes": "Product-specific budget notes — or null"
    },
    "mvpCostModel": {
      "monthlyEstimateUsd": null,
      "assumptions": "Clearly labeled estimate assumptions (do not invent fake invoices)",
      "breakdown": [
        { "category": "Hosting", "monthlyEstimateUsd": null, "notes": "" }
      ]
    },
    "testPlan": {
      "unit": "",
      "integration": "",
      "e2e": "",
      "load": null,
      "security": null
    }
  }
}

${MERMAID_RULES_BLOCK}

Use erDiagram for databaseSchema.erDiagramMermaid; flowchart/graph for system context and API overview; sequenceDiagram for auth flow when relevant. tablesSupplement must list detailed tables (name, purpose, fields as objects with name, type, required, constraints, description, relationships string) when helpful.

CRITICAL FOR SECURITY (project-specific — no generic boilerplate):
- securityCriticalPoints MUST be 3–5 actionable CRITICAL warnings that are UNIQUE to THIS product.
- Each point MUST name a concrete asset, user flow, data type, screen, API, or third-party integration from the Overview / user input (e.g. "shared inbox attachments", "magic-link workspace invite", "Stripe webhook signature", "patient records export").
- FORBIDDEN generic lines such as: "use HTTPS", "hash passwords", "enable 2FA", "validate input", "keep dependencies updated", "use JWT carefully", "never store secrets in frontend" — unless rewritten with the exact secret/name/flow from THIS app.
- authentication, authorization, encryption, and securityMeasures MUST likewise describe THIS product's actors, data, and integrations — not textbook security advice.
- Prefer risks from: auth boundaries in the overview, PII/PHI/payment data, file uploads, multi-tenant isolation, webhooks, OAuth tokens, realtime channels, AI prompts/data leakage, admin impersonation, export/download paths.

IMPORTANT FOR API: apiDesign.endpoints must include requestBody and responseBody as detailed strings. Prefer populating errorResponses, authScope, rateLimit, and idempotency (null only when truly N/A).

ENRICHED FIELDS:
- eventCatalog: domain events this system emits/consumes (null only if none)
- envSecrets: every required env/secret with purpose (null only if none)
- migrationAndSeed: concrete migration + seed strategy
- performanceBudgets: realistic LCP/INP/CLS/apiP95 targets for this product
- mvpCostModel: labeled estimates only — never fabricate precise invoices; null monthlyEstimateUsd when unknown
- testPlan: unit/integration/e2e required; load/security nullable

Application Overview:
${isReference ? `[SPEC_REFERENCE]
Spec ID: ${specId}
Overview Location: Firebase > specs collection > ${specId} > overview field
Note: The system will retrieve the full overview content automatically. Use this reference to access the complete application overview details.` : overviewContent}

User Input:
${appDescription}

Note: The user input above may contain structured information organized into sections (App Description, Pages, Workflows, Features, Design Style, Integrations, Target Audience). If such sections exist, you MUST analyze and incorporate EVERY piece of information from EACH section. The technical specification MUST reflect the exact pages, workflows, features, design style, integrations, and target audience provided by the user.`;
  },

  // Market research prompt - generates market analysis
  market: (specId, answers) => {
    const appDescription = answers[0] || 'Not provided';
    const workflow = answers[1] || 'Not provided';
    const additionalDetails = answers[2] || 'Not provided';

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    const isReference = typeof specId === 'string' && specId.length < 100;
    const overviewContent = isReference ? null : specId;

    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be market. Never omit required keys. Use null for nullable fields when unknown — do not invent fake precision.

IMPORTANT: All output must be in English regardless of the input language.

PHILOSOPHY (qualitative + clearly labeled estimates):
- Current date context: ${currentDateStr}
- Prefer qualitative industry trends, competitive insight, and actionable GTM over fabricated numbers
- Do NOT invent precise statistics, TAM/SAM/SOM figures, CAGR %, market share %, or search volumes
- When you must estimate, label clearly as an estimate and explain methodology
- searchTrends is qualitative direction + confidence — NEVER numeric searchVolume charts

Create detailed market analysis matching MarketSchema exactly. Return JSON with market key containing:

{
  "market": {
    "industryOverview": {
      "trends": "Qualitative CURRENT industry trends as of ${currentDateStr} grounded in this product's domain",
      "marketData": "Qualitative market context and clearly labeled estimates only — no fabricated precise stats",
      "growthProjections": "Directional growth expectations with uncertainty — or null",
      "growthPotential": "Qualitative growth potential narrative — or null",
      "estimateDisclaimer": "Explicit disclaimer that figures are estimates / directional, not audited market research"
    },
    "targetAudienceInsights": {
      "primaryAudience": {
        "description": "Who the primary users are and why they buy/use",
        "ageRange": "e.g. 25-45 — or null",
        "occupation": "Roles/jobs — or null",
        "goals": "What they want to achieve — or null",
        "painPoints": "Practical and emotional pains — or null"
      },
      "secondaryAudience": {
        "description": "Secondary users/buyers who influence or benefit",
        "ageRange": null,
        "occupation": null,
        "goals": null,
        "painPoints": null
      },
      "needsAnalysis": "Needs and jobs-to-be-done analysis — or null",
      "usageHabits": "How they currently solve the problem — or null",
      "demographics": "High-level demographic notes — or null"
    },
    "competitiveLandscape": [
      {
        "name": "Competitor name (current as of ${currentDateStr})",
        "advantages": "Their strengths vs alternatives",
        "disadvantages": "Their weaknesses / friction",
        "strengths": "Optional strengths summary — or null",
        "weaknesses": "Optional weaknesses summary — or null",
        "differentiators": "How they position — or null",
        "marketPosition": "Niche / mid-market / enterprise etc. — or null",
        "features": ["Notable feature 1", "Notable feature 2"],
        "gaps": ["Gap they leave open"],
        "marketShare": "Qualitative share note only (e.g. 'leader in SMB segment') — NEVER fake % — or null",
        "pricingSummary": "Public pricing bands if known (e.g. Free / $29/seat) — labeled estimate if uncertain",
        "featureGapVsUs": ["Where we can win vs them", "Where they beat us"]
      }
    ],
    "swotAnalysis": {
      "strengths": ["Product-specific strength"],
      "weaknesses": ["Honest weakness"],
      "opportunities": ["Market opportunity tied to this domain"],
      "threats": ["Realistic threat"]
    },
    "monetizationModel": {
      "pricingStrategy": "Suggested pricing approach",
      "revenueStreams": "Primary + secondary streams",
      "rationale": "Why this monetization fits ICP and willingness-to-pay",
      "proposedModels": ["Subscription", "Freemium", "Usage-based"],
      "recommendations": "Recommended model and packaging",
      "methodology": "How pricing was reasoned (comparables, value metric, willingness-to-pay proxies) — no fake financial models"
    },
    "marketingStrategy": {
      "channels": "Priority acquisition channels for this ICP",
      "messaging": "Core messages and proof points",
      "goToMarket": "High-level GTM narrative (details live in gtmPlan)"
    },
    "icpScorecard": [
      {
        "criterion": "e.g. Budget authority / Problem urgency / Tech readiness",
        "weight": 0.25,
        "score": 4,
        "notes": "Why this score for THIS product"
      }
    ],
    "disqualificationCriteria": [
      "Explicit anti-ICP: who we should NOT sell to / support in v1"
    ],
    "gtmPlan": [
      {
        "days": "0-30",
        "goals": ["Goal 1"],
        "tactics": ["Tactic 1"],
        "successSignals": ["Signal 1"]
      },
      {
        "days": "31-60",
        "goals": ["Goal 1"],
        "tactics": ["Tactic 1"],
        "successSignals": ["Signal 1"]
      },
      {
        "days": "61-90",
        "goals": ["Goal 1"],
        "tactics": ["Tactic 1"],
        "successSignals": ["Signal 1"]
      }
    ],
    "interviewScripts": [
      {
        "audience": "ICP segment",
        "objective": "What we need to learn",
        "questions": ["Open question 1", "Open question 2", "Open question 3"]
      }
    ],
    "positioningOnePager": "Ready-to-paste positioning: for [ICP] who [problem], [product] is a [category] that [benefit]. Unlike [alt], we [differentiator].",
    "searchTrends": [
      {
        "topic": "Topic or intent cluster (not a fake keyword volume)",
        "direction": "rising | stable | declining | unclear",
        "confidence": "low | medium | high",
        "notes": "Qualitative rationale — no invented search volumes"
      }
    ]
  }
}

CRITICAL RULES:
- Match MarketSchema field names exactly (competitiveLandscape[].name — NOT competitor; AudienceSegmentSchema uses description — NOT definition)
- Do NOT include legacy keys (painPoints, businessModelsAnalysis, qualityAssessment, uniqueSellingProposition, pricingStrategy object, expectedROI, kpiFramework, nicheInformation, marketStatistics, threatsOverview, complexityRating, actionableInsights, searchTrends.historicalData, etc.)
- competitiveLandscape: 3–6 real/plausible competitors with pricingSummary + featureGapVsUs
- gtmPlan MUST include 30 / 60 / 90 day phases (days fields like "0-30", "31-60", "61-90")
- icpScorecard: 4–8 scored criteria; disqualificationCriteria: 3–6 anti-ICP rules
- interviewScripts: at least 1–2 scripts with 5–8 questions each
- monetizationModel.methodology and industryOverview.estimateDisclaimer MUST be present (non-empty strings)
- searchTrends entries: topic + direction + confidence only (notes optional) — NEVER numeric volumes

Application Overview:
${isReference ? `[SPEC_REFERENCE]
Spec ID: ${specId}
Overview Location: Firebase > specs collection > ${specId} > overview field
Note: The system will retrieve the full overview content automatically. Use this reference to access the complete application overview details.` : overviewContent}

User Input:
${appDescription}

Note: The user input above may contain structured information organized into sections (App Description, Pages, Workflows, Features, Design Style, Integrations, Target Audience). If such sections exist, you MUST analyze and incorporate EVERY piece of information from EACH section. The market research MUST reflect the exact pages, workflows, features, design style, integrations, and target audience provided by the user.`;
  },

  // Design & Branding prompt - generates design guidelines and branding
  design: (specId, answers) => {
    const appDescription = answers[0] || 'Not provided';
    const workflow = answers[1] || 'Not provided';
    const additionalDetails = answers[2] || 'Not provided';

    const isReference = typeof specId === 'string' && specId.length < 100;
    const overviewContent = isReference ? null : specId;

    return `Return ONLY valid JSON (no text/markdown). Top-level key MUST be design. Never omit required keys. Use null for nullable fields when unknown.

IMPORTANT: All output must be in English regardless of the input language.

Create comprehensive design guidelines and branding elements matching DesignSchema. Return JSON with design key containing:

{
  "design": {
    "visualStyleGuide": {
      "colors": {
        "primary": "#hex",
        "secondary": "#hex",
        "accent": "#hex",
        "background": "#hex",
        "text": "#hex",
        "success": "#hex",
        "warning": "#hex",
        "danger": "#hex",
        "muted": "#hex",
        "surface": "#hex",
        "border": "#hex"
      },
      "colorHarmony": "Monochromatic / analogous / complementary — how the palette relates",
      "colorReasoning": "Why these colors fit the product, audience, and brand emotion",
      "typography": {
        "headings": "Heading font family + usage summary",
        "body": "Body font family + usage summary",
        "captions": "Caption/meta font usage",
        "display": { "fontFamily": "", "fontSize": "", "fontWeight": "", "lineHeight": "", "letterSpacing": null },
        "h1": { "fontFamily": "", "fontSize": "", "fontWeight": "", "lineHeight": "", "letterSpacing": null },
        "h2": { "fontFamily": "", "fontSize": "", "fontWeight": "", "lineHeight": "", "letterSpacing": null },
        "h3": { "fontFamily": "", "fontSize": "", "fontWeight": "", "lineHeight": "", "letterSpacing": null },
        "bodyLg": { "fontFamily": "", "fontSize": "", "fontWeight": "", "lineHeight": "", "letterSpacing": null },
        "bodyMd": { "fontFamily": "", "fontSize": "", "fontWeight": "", "lineHeight": "", "letterSpacing": null },
        "bodySm": { "fontFamily": "", "fontSize": "", "fontWeight": "", "lineHeight": "", "letterSpacing": null },
        "label": { "fontFamily": "", "fontSize": "", "fontWeight": "", "lineHeight": "", "letterSpacing": null }
      },
      "spacing": "Narrative spacing / grid guidance",
      "buttons": "Button styles and variations",
      "animations": "Motion philosophy summary",
      "spacingScale": { "xs": "4px", "sm": "8px", "md": "16px", "lg": "24px", "xl": "32px", "xxl": "48px" },
      "radiiScale": { "sm": "4px", "md": "8px", "lg": "16px", "full": "9999px" },
      "shadowScale": { "sm": "...", "md": "...", "lg": "..." },
      "zIndexScale": { "base": 0, "dropdown": 1000, "sticky": 1100, "modal": 1300, "toast": 1400 },
      "themes": {
        "light": {
          "name": "Light",
          "background": "#hex",
          "surface": "#hex",
          "text": "#hex",
          "textMuted": "#hex",
          "primary": "#hex",
          "border": "#hex"
        },
        "dark": {
          "name": "Dark",
          "background": "#hex",
          "surface": "#hex",
          "text": "#hex",
          "textMuted": "#hex",
          "primary": "#hex",
          "border": "#hex"
        }
      }
    },
    "logoIconography": {
      "logoConcepts": "Logo design concepts and variations",
      "colorVersions": "Different color versions of the logo",
      "iconSet": "Icon set specifications and style",
      "appIcon": {
        "letters": "Two letters for the app icon (e.g., 'TP')",
        "bgColor": "Single hex or CSS gradient",
        "description": "Brief app icon concept"
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
      "accessibility": "Accessibility guidelines (WCAG targets, focus, contrast)",
      "informationHierarchy": "Information hierarchy and content organization"
    },
    "componentInventory": [
      {
        "name": "Button",
        "variants": ["primary", "secondary", "ghost"],
        "states": ["default", "hover", "focus", "disabled", "loading"],
        "a11yChecklist": ["keyboard focus visible", "aria-busy when loading"],
        "usageNotes": "When to use — or null"
      }
    ],
    "screenLayouts": [
      {
        "screenName": "Must match overview screens when possible",
        "layout": "Regions, columns, key components",
        "empty": "Empty-state layout/copy notes — or null",
        "loading": "Loading/skeleton notes — or null",
        "error": "Error-state notes — or null",
        "success": "Success-state notes — or null"
      }
    ],
    "motionSpecs": [
      {
        "name": "Page enter",
        "trigger": "Route change",
        "durationMs": 200,
        "easing": "ease-out",
        "notes": "Keep subtle — or null"
      }
    ],
    "toneOfVoice": "Brand voice: personality, do/don't examples",
    "microcopy": [
      { "context": "Primary CTA on landing", "copy": "Concrete button/label text" },
      { "context": "Empty dashboard", "copy": "Empty-state message" }
    ],
    "tokenExport": {
      "cssVariables": ":root { --color-primary: ...; --font-body: ...; }",
      "jsonTokens": "{ \"color\": { \"primary\": \"#...\" }, \"font\": { ... } }"
    }
  }
}

CRITICAL COLOR REQUIREMENTS:
- Provide a coherent semantic palette: primary/secondary/accent/background/text PLUS success/warning/danger/muted/surface/border
- Colors MUST be harmonious (monochromatic, analogous, or complementary with at most 2 families) — no broken clashing palettes
- themes.light is REQUIRED; themes.dark should be provided when the product supports dark mode (otherwise null)
- Contrast: text on background/surface must remain readable; danger/success must be distinguishable

CRITICAL TYPOGRAPHY REQUIREMENTS:
- Provide concrete font pairings with sizes/weights for display, h1, h2, h3, bodyLg, bodyMd, bodySm, label
- Each type style object MUST include fontFamily, fontSize, fontWeight, lineHeight (letterSpacing nullable)
- Typography MUST complement the color mood — do not default to Inter/Roboto without justification
- Example pairings: display serif + geometric sans body; or distinctive sans display + neutral body

ENRICHED FIELDS:
- spacingScale, radiiScale, shadowScale, zIndexScale: concrete token values
- componentInventory: 6–12 core components with variants/states/a11yChecklist
- screenLayouts: cover key screens from overview Pages when present
- motionSpecs: 3–6 intentional motions (not noise)
- toneOfVoice + microcopy: product-specific copy ready to use
- tokenExport.cssVariables and tokenExport.jsonTokens: ready-to-paste exports mirroring the style guide

CRITICAL APP ICON REQUIREMENTS:
- appIcon.letters MUST be exactly 2 letters representing the app
- bgColor MUST be a single hex or CSS gradient
- letters assumed white/bold on the bgColor

Make sure all descriptions are clear and actionable for designers and developers.

Application Overview:
${isReference ? `[SPEC_REFERENCE]
Spec ID: ${specId}
Overview Location: Firebase > specs collection > ${specId} > overview field
Note: The system will retrieve the full overview content automatically. Use this reference to access the complete application overview details.` : overviewContent}

User Input:
${appDescription}

CRITICAL FOR DESIGN SPECIFICATION:
If the user input contains a "Design Style:" section:
- The design style MUST be incorporated into the visualStyleGuide
- The design style description MUST influence color palettes, typography, and overall aesthetic
- If a specific design style is mentioned (e.g., "Minimalist", "Modern", "Corporate"), it MUST be reflected throughout the design specification
- The design must align with the design style preferences provided by the user

If the user input contains a "Pages:" section:
- ALL pages listed MUST be considered when defining the design system and screenLayouts
- The design must account for the specific pages mentioned by the user

If the user input contains a "Target Audience:" section:
- The design style MUST be appropriate for the target audience mentioned
- Platform preferences (mobile/web) from target audience MUST influence the design approach

Note: The user input above may contain structured information organized into sections (App Description, Pages, Workflows, Features, Design Style, Integrations, Target Audience). If such sections exist, you MUST analyze and incorporate EVERY piece of information from EACH section. The design specification MUST reflect the exact pages, workflows, features, design style, integrations, and target audience provided by the user.`;
  },

  // Diagrams prompt — legacy; product embeds Mermaid in Technical + Architecture JSON
  diagrams: (technicalContent, overviewContent) => {
    return `NOTE: Prefer embedded diagrams in the technical spec (erDiagramMermaid, systemContextDiagramMermaid, apiDesign, etc.). This standalone 7-diagram set is legacy.

Return ONLY valid JSON (no text/markdown). Top-level key MUST be diagrams. If a value is unknown, return an empty array/object—never omit required keys.

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
${appDescription}

Note: The user input above may contain structured information organized into sections (App Description, Pages, Workflows, Features, Design Style, Integrations, Target Audience). If such sections exist, you MUST analyze and incorporate EVERY piece of information from EACH section.`;
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
- MUST be EXTREMELY DETAILED (MINIMUM 25000 characters, ideally 30000-50000+ characters) - this is not optional
- MUST be organized in EXACTLY 10 DEVELOPMENT STAGES as shown in the template above
- MUST follow the exact order: Stage 1 → Stage 2 → ... → Stage 10
- MUST replace ALL placeholders in brackets [LIKE_THIS] with actual values from the specifications:
  * [APPLICATION_NAME] → actual app name from overview
  * [APPLICATION_DESCRIPTION] → ideaSummary from overview (use the FULL text, not a summary)
  * [FRAMEWORK] → exact framework from tech stack (e.g., "Next.js 14")
  * [CSS_FRAMEWORK] → exact CSS framework (e.g., "Tailwind CSS 3.4")
  * [AUTH_LIBRARY] → exact auth library (e.g., "NextAuth.js v5")
  * [BACKEND_FRAMEWORK] → exact backend framework (e.g., "Express.js 4.21")
  * [DATABASE_TYPE] → exact database (e.g., "PostgreSQL 15")
  * [ORM] → exact ORM (e.g., "Prisma 5.11")
  * [MAIN_FEATURE_1], [MAIN_FEATURE_2] → actual features from overview.coreFeaturesOverview (include ALL features, not just 2)
  * [MAIN_ENTITY_1], [MAIN_ENTITY_2] → actual entities from databaseSchema.tables (include ALL entities, not just 2)
  * [SERVICE_NAME] → actual third-party services from integrationExternalApis
  * [CLOUD_PLATFORM] → actual deployment platform from devops
  * [MONITORING_TOOL] → actual monitoring tool from devops
  * [HOSTING_PLATFORM] → actual frontend hosting platform
- MUST include ALL 10 stages even if some are conditional (mark conditional stages clearly)
- MUST provide detailed sub-steps (1.1, 1.2, etc.) for each stage
- MUST focus on OPERATIONAL DETAILS, not high-level concepts
- MUST include exact implementation details: function signatures, component props, API formats, database schemas
- MUST cover EVERY page with ALL its UI components (from overview.screenDescriptions.screens - include ALL screens mentioned)
- MUST detail EVERY function with exact parameters and logic
- MUST explain HOW data models connect (relationships, not just definitions)
- MUST provide step-by-step flows for ALL processes (authentication, user journeys, etc.)
- MUST include exact styling details (colors from design.visualStyleGuide.colors, fonts from design.visualStyleGuide.typography, spacing)
- MUST NOT include high-level concepts like "User Experience Principles" or abstract descriptions
- MUST be practical and actionable - a developer should be able to build the app exactly as imagined from this prompt
- MUST be in English

MANDATORY CONTENT INCLUSION - YOU MUST INCLUDE ALL OF THE FOLLOWING FROM THE SPECIFICATIONS:

FROM OVERVIEW SPECIFICATION:
- Include the COMPLETE ideaSummary (all 500-1500 characters) - do not summarize or shorten it
- Include the COMPLETE problemStatement (all 2-3 paragraphs) - explain the problem in detail
- Include ALL targetAudience details: ageRange, sector, ALL interests (5-7 items), ALL needs (5-7 items)
- Include the COMPLETE valueProposition (2-3 sentences explaining uniqueness)
- Include ALL coreFeaturesOverview items (6-8 features) - list each feature with its description
- Include the COMPLETE userJourneySummary (4-5 sentences describing the full flow)
- Include ALL detailedUserFlow details: ALL steps, decisionPoints, errorHandling, confirmations, feedbackLoops
- Include ALL screens from screenDescriptions.screens (5-7 screens) - describe each screen with its purpose, key elements, and user interactions
- Include ALL uiComponents from screenDescriptions.uiComponents (at least 3 components) - describe each component's purpose, placement, and behavior
- Include the COMPLETE navigationStructure - describe all navigation paths, side navigation, bottom navigation, modal flows, deep linking
- Include complexityScore values: architecture, integrations, functionality, userSystem

FROM TECHNICAL SPECIFICATION:
- Include ALL technologies from techStack: frontend, backend, database, authentication, and ALL other services
- Include database schema: erDiagramMermaid and/or tablesSupplement (or legacy databaseSchema.tables) — every entity with fields and relationships
- Include ALL API endpoints from apiDesign.endpoints (or legacy apiEndpoints) — method, path, parameters, request body, response format
- Include ALL security requirements: authentication methods, authorization rules, data encryption, rate limiting
- Include ALL third-party integrations from integrationExternalApis - describe each integration's purpose, setup, and usage
- Include ALL environment variables needed
- Include ALL deployment configurations from devops
- Include ALL monitoring and logging requirements

FROM DESIGN SPECIFICATION:
- Include ALL colors from visualStyleGuide.colors - list each color with its hex code and usage
- Include ALL typography details: font families, sizes, weights, line heights
- Include ALL spacing values and layout grid system
- Include ALL component specifications: buttons, inputs, cards, modals, etc.
- Include ALL responsive breakpoints
- Include ALL animation and transition specifications

CRITICAL: Do NOT create generic or placeholder content. Every single detail must come from the actual specifications provided. If a detail exists in the specifications, it MUST appear in the prompt. If you find yourself writing generic descriptions like "build a component" or "implement a feature", STOP and replace it with the SPECIFIC details from the specifications.

- MUST adapt stages 5, 6, and 8 based on whether those features exist in the spec:
  * Stage 5 (AI) - only if AI features are mentioned
  * Stage 6 (Real-time) - only if real-time features are mentioned
  * Stage 8 (Mobile) - only if mobile app is mentioned
- The prompt should be so detailed that it leads to perfect results on the first implementation attempt
- If the prompt is less than 25000 characters, you have NOT included enough detail - expand each section with more specific implementation details from the specifications

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
  module.exports = { PROMPTS, formatUserRequirements, MERMAID_RULES_BLOCK };
}if (typeof window !== 'undefined') {
  window.PROMPTS = PROMPTS;
  window.formatUserRequirements = formatUserRequirements;
}
