// Cloudflare Worker: Structured 6-Stage Generator (updated structure)
// File: worker-new.js
// Version: v20250120-rev1
// Env var required: OPENAI_API_KEY

// SAFER default model; change if you have access to others:
const MODEL = "gpt-4o-mini";
const SCHEMA_VERSION = "1.0";
const MAX_LABEL_LEN = 60;

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      // CORS preflight
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

      // Lightweight upstream diagnostics
      if (request.method === "GET" && url.pathname === "/selftest") {
        return cors(await handleSelfTest(env));
      }

      // Only POST for main endpoint
      if (request.method !== "POST") {
        return cors(json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST" } }, 405));
      }

      if (url.pathname === "/generate") return cors(await handleGenerate(request, env));
      if (url.pathname === "/fix-diagram") return cors(await handleFixDiagram(request, env));
      if (url.pathname === "/generate-mockups") return cors(await handleGenerateMockups(request, env));

      return cors(json({ error: { code: "NOT_FOUND", message: "Unknown route" } }, 404));
    } catch (e) {
      return cors(json({ error: { code: "UNEXPECTED", message: String(e) } }, 500));
    }
  }
};

// ---------- HTTP utils ----------
function cors(res) {
  res.headers.set("Access-Control-Allow-Origin", "*"); // tighten to your domain in prod
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  return res;
}
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
function nowISO() { return new Date().toISOString(); }
function cryptoRandomId() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
function slugifyId(s) {
  return String(s || "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "id";
}
function trimLabel(s, max = MAX_LABEL_LEN) {
  const t = String(s || "").trim();
  return t.length <= max ? t : t.slice(0, max - 1) + "…";
}

// ---------- Validators & Sanitizers ----------
function validateMeta(x, stage) {
  const issues = [];
  if (typeof x !== "object" || !x) return { ok: false, issues: ["meta must be object"] };
  if (x.version !== SCHEMA_VERSION) issues.push(`meta.version must be "${SCHEMA_VERSION}"`);
  if (typeof x.locale !== "string") issues.push("meta.locale must be string");
  if (typeof x.generatedAt !== "string") issues.push("meta.generatedAt must be ISO string");
  if (x.stage !== stage) issues.push(`meta.stage must be "${stage}"`);
  return issues.length ? { ok: false, issues } : { ok: true, value: x };
}

function sanitizeDiagram(d) {
  if (!d || typeof d !== "object") return d;
  if (Array.isArray(d.nodes)) {
    d.nodes = d.nodes.map(n => ({
      id: slugifyId(n.id || n.label || cryptoRandomId()),
      label: trimLabel(n.label || n.id || "")
    }));
  }
  if (Array.isArray(d.edges)) {
    d.edges = d.edges.map(e => ({
      from: slugifyId(e.from),
      to: slugifyId(e.to),
      label: trimLabel(e.label || "")
    }));
  }
  if (Array.isArray(d.stages)) {
    d.stages = d.stages.map(sec => ({
      section: trimLabel(sec.section || ""),
      steps: Array.isArray(sec.steps) ? sec.steps.map(s => ({
        label: trimLabel(s.label || ""),
        score: Number(s.score || 0),
        actor: trimLabel(s.actor || "User")
      })) : []
    }));
  }
  if (Array.isArray(d.slices)) {
    d.slices = d.slices.map(s => ({ label: trimLabel(s.label || ""), value: Number(s.value || 0) }));
  }
  return d;
}

// Updated validation functions for new structure
function validateOverviewPayload(obj) {
  const issues = [];
  const o = obj?.overview;
  if (!o) return { ok: false, issues: ["overview missing"] };

  if (typeof o.ideaSummary !== "string") issues.push("overview.ideaSummary required");
  if (!o.targetAudience || typeof o.targetAudience !== "object") issues.push("overview.targetAudience required");
  if (typeof o.valueProposition !== "string") issues.push("overview.valueProposition required");
  if (!Array.isArray(o.coreFeaturesOverview) || !o.coreFeaturesOverview.length) issues.push("overview.coreFeaturesOverview[] required");
  if (typeof o.userJourneySummary !== "string") issues.push("overview.userJourneySummary required");

  return issues.length ? { ok: false, issues } : { ok: true, value: obj };
}

function validateTechnicalPayload(obj) {
  const issues = [];
  const t = obj?.technical;
  if (!t) return { ok: false, issues: ["technical missing"] };

  if (!t.techStack || typeof t.techStack !== "object") issues.push("technical.techStack required");
  if (typeof t.architectureOverview !== "string") issues.push("technical.architectureOverview required");
  if (!t.databaseSchema || typeof t.databaseSchema !== "object") issues.push("technical.databaseSchema required");
  if (!Array.isArray(t.apiEndpoints)) issues.push("technical.apiEndpoints[] required");
  if (!t.securityAuthentication || typeof t.securityAuthentication !== "object") issues.push("technical.securityAuthentication required");
  if (!t.integrationExternalApis || typeof t.integrationExternalApis !== "object") issues.push("technical.integrationExternalApis required");

  return issues.length ? { ok: false, issues } : { ok: true, value: obj };
}

function validateMarketPayload(obj) {
  const issues = [];
  const m = obj?.market;
  if (!m) return { ok: false, issues: ["market missing"] };

  if (!m.industryOverview || typeof m.industryOverview !== "object") issues.push("market.industryOverview required");
  if (!m.targetAudienceInsights || typeof m.targetAudienceInsights !== "object") issues.push("market.targetAudienceInsights required");
  if (!Array.isArray(m.competitiveLandscape)) issues.push("market.competitiveLandscape[] required");
  if (!m.swotAnalysis || typeof m.swotAnalysis !== "object") issues.push("market.swotAnalysis required");
  if (!m.monetizationModel || typeof m.monetizationModel !== "object") issues.push("market.monetizationModel required");
  if (!m.marketingStrategy || typeof m.marketingStrategy !== "object") issues.push("market.marketingStrategy required");

  return issues.length ? { ok: false, issues } : { ok: true, value: obj };
}

function validateDesignPayload(obj) {
  const issues = [];
  const d = obj?.design;
  if (!d) return { ok: false, issues: ["design missing"] };

  if (!d.visualStyleGuide || typeof d.visualStyleGuide !== "object") issues.push("design.visualStyleGuide required");
  if (!d.logoIconography || typeof d.logoIconography !== "object") issues.push("design.logoIconography required");
  if (!d.uiLayout || typeof d.uiLayout !== "object") issues.push("design.uiLayout required");
  if (!d.uxPrinciples || typeof d.uxPrinciples !== "object") issues.push("design.uxPrinciples required");

  return issues.length ? { ok: false, issues } : { ok: true, value: obj };
}

function validateDiagramsPayload(obj) {
  const issues = [];
  const d = obj?.diagrams;
  if (!d) return { ok: false, issues: ["diagrams missing"] };

  if (!Array.isArray(d) || d.length !== 6) issues.push("diagrams must be array of 6 diagram objects");
  
  const requiredIds = ["user_flow", "system_architecture", "information_architecture", "data_schema", "sequence", "frontend_components"];
  const receivedIds = d.map(diag => diag.id);
  
  for (const requiredId of requiredIds) {
    if (!receivedIds.includes(requiredId)) {
      issues.push(`diagrams missing required id: ${requiredId}`);
    }
  }

  return issues.length ? { ok: false, issues } : { ok: true, value: obj };
}

function validateRawTextPayload(obj) {
  const issues = [];
  const r = obj?.rawText;
  if (!r) return { ok: false, issues: ["rawText missing"] };

  if (typeof r.content !== "string") issues.push("rawText.content required");
  if (!Array.isArray(r.paragraphs)) issues.push("rawText.paragraphs[] required");
  if (typeof r.summary !== "string") issues.push("rawText.summary required");

  return issues.length ? { ok: false, issues } : { ok: true, value: obj };
}

function validatePromptsPayload(obj) {
  const issues = [];
  const p = obj?.prompts;
  if (!p) return { ok: false, issues: ["prompts missing"] };

  // NOTE: All content (fullPrompt, descriptions, instructions) MUST be in English
  // This is a site-wide requirement - all user-facing content is in English

  if (typeof p.fullPrompt !== "string" || p.fullPrompt.trim().length === 0) {
    issues.push("prompts.fullPrompt required and must be non-empty string");
  } else {
    // CRITICAL: Check minimum length requirement
    const minLength = 25000;
    const currentLength = p.fullPrompt.length;
    if (currentLength < minLength) {
      issues.push(`prompts.fullPrompt must be at least ${minLength} characters (currently ${currentLength}). The prompt must include all 10 development stages with detailed implementation instructions from the specifications.`);
    }
    
    // Check if all 10 stages are mentioned
    const stageMatches = p.fullPrompt.match(/STAGE \d+:/g) || [];
    const stageCount = stageMatches.length;
    if (stageCount < 10) {
      issues.push(`prompts.fullPrompt must include all 10 development stages (found only ${stageCount} stages). Each stage must be detailed with sub-steps (1.1, 1.2, etc.) and include ALL implementation details from the specifications.`);
    }
    
    // Check if it's just the introduction (common mistake - only PROJECT OVERVIEW without stages)
    if (currentLength < 2000 || (!p.fullPrompt.includes("STAGE 1:") && !p.fullPrompt.includes("STAGE 1"))) {
      issues.push("prompts.fullPrompt appears to be incomplete - it should include all 10 development stages starting with 'STAGE 1: PROJECT SETUP & BASIC STRUCTURE'. The prompt must be extremely detailed with implementation instructions, not just a high-level overview.");
    }
  }
  if (!Array.isArray(p.thirdPartyIntegrations)) {
    issues.push("prompts.thirdPartyIntegrations must be an array");
  } else {
    // Validate each integration object
    p.thirdPartyIntegrations.forEach((integration, index) => {
      if (!integration || typeof integration !== "object") {
        issues.push(`prompts.thirdPartyIntegrations[${index}] must be an object`);
      } else {
        if (typeof integration.service !== "string" || integration.service.trim().length === 0) {
          issues.push(`prompts.thirdPartyIntegrations[${index}].service required`);
        }
        if (typeof integration.description !== "string" || integration.description.trim().length === 0) {
          issues.push(`prompts.thirdPartyIntegrations[${index}].description required`);
        }
        if (!Array.isArray(integration.instructions) || integration.instructions.length === 0) {
          issues.push(`prompts.thirdPartyIntegrations[${index}].instructions must be a non-empty array`);
        } else {
          integration.instructions.forEach((instruction, instIndex) => {
            if (typeof instruction !== "string" || instruction.trim().length === 0) {
              issues.push(`prompts.thirdPartyIntegrations[${index}].instructions[${instIndex}] must be a non-empty string`);
            }
          });
        }
      }
    });
  }

  return issues.length ? { ok: false, issues } : { ok: true, value: obj };
}

// ---------- OpenAI caller (with upstream error surfacing) ----------
async function callLLM(env, { system, developer, user }) {
  // Combine developer instructions into system prompt (developer role is not supported by OpenAI API)
  const combinedSystem = developer 
    ? `${system}\n\nDEVELOPER INSTRUCTIONS:\n${developer}`
    : system;
  
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: combinedSystem },
      { role: "user", content: user }
    ],
    temperature: 0
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`OPENAI_UPSTREAM_${res.status}: ${text}`);
    err.__openaiStatus = res.status;
    err.__openaiBody = text;
    throw err;
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "";
  try {
    return JSON.parse(content);
  } catch {
    const cleaned = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    return JSON.parse(cleaned);
  }
}

function buildRepairPrompt(issues, originalJSON) {
  const isLengthIssue = issues.some(issue => 
    issue.includes("characters") || 
    issue.includes("stages") || 
    issue.includes("incomplete")
  );
  
  let repairInstructions = [
    "You returned JSON that failed validation.",
    "Fix ONLY the listed issues. Keep structure and IDs stable.",
    "Return ONLY valid JSON (no markdown, no code fences).",
    "",
    "Issues:",
    JSON.stringify(issues, null, 2)
  ];
  
  if (isLengthIssue) {
    repairInstructions.push(
      "",
      "═══════════════════════════════════════════════════════════════",
      "CRITICAL: The fullPrompt is too short or incomplete.",
      "═══════════════════════════════════════════════════════════════",
      "",
      "You MUST expand the fullPrompt to include:",
      "",
      "1. ALL 10 DEVELOPMENT STAGES in this exact order:",
      "   - STAGE 1: PROJECT SETUP & BASIC STRUCTURE",
      "   - STAGE 2: FRONTEND CORE FUNCTIONALITY",
      "   - STAGE 3: AUTHENTICATION & USER MANAGEMENT",
      "   - STAGE 4: BACKEND API DEVELOPMENT",
      "   - STAGE 5: AI INTEGRATION (if applicable)",
      "   - STAGE 6: REAL-TIME COLLABORATION (if applicable)",
      "   - STAGE 7: THIRD-PARTY INTEGRATIONS",
      "   - STAGE 8: MOBILE APP DEVELOPMENT (if applicable)",
      "   - STAGE 9: TESTING & QUALITY ASSURANCE",
      "   - STAGE 10: DEPLOYMENT & DEVOPS",
      "",
      "2. Each stage MUST have detailed sub-steps (1.1, 1.2, 2.1, 2.2, etc.)",
      "",
      "3. Include ALL details from the specifications provided:",
      "   - ALL features from overview.coreFeaturesOverview",
      "   - ALL screens from overview.screenDescriptions.screens",
      "   - ALL database entities from technical.databaseSchema.tables",
      "   - ALL API endpoints from technical.apiEndpoints",
      "   - ALL UI components from overview.screenDescriptions.uiComponents",
      "   - ALL colors, typography, spacing from design.visualStyleGuide",
      "",
      "4. Minimum 25,000 characters total - this is NOT optional",
      "",
      "5. Do NOT summarize or shorten - include EVERY detail",
      "   Replace ALL placeholders [LIKE_THIS] with actual values from the specifications",
      "",
      "6. Focus on OPERATIONAL DETAILS:",
      "   - Exact function signatures with parameters",
      "   - Specific component props and structure",
      "   - Detailed API endpoint formats",
      "   - Complete database schemas with relationships",
      "   - Step-by-step implementation flows",
      "",
      "The prompt must be so detailed that a developer can build the complete",
      "application from scratch on the first attempt without asking questions."
    );
  }
  
  repairInstructions.push(
    "",
    "Original JSON:",
    (originalJSON || "").slice(0, 15000)
  );
  
  return repairInstructions.join("\n");
}

// ---------- Retry with Repair (bubble upstream errors) ----------
async function retryWithRepair(env, msgs, stage, attachMetaAndValidate) {
  let out, issues;

  // 1) initial
  try {
    out = await callLLM(env, msgs);
  } catch (e) {
    if (e && e.__openaiStatus) throw e;
  }
  if (out) {
    const res = attachMetaAndValidate(out, stage);
    if (res.ok) return res.value;
    issues = res.issues;
  } else {
    issues = ["model call failed or empty content"];
  }

  // 2) repair
  // Combine developer instructions into system prompt (developer role is not supported by OpenAI API)
  const combinedSystemForRepair = msgs.developer 
    ? `${msgs.system}\n\nDEVELOPER INSTRUCTIONS:\n${msgs.developer}`
    : msgs.system;
  
  const repairedMsgs = {
    system: combinedSystemForRepair,
    developer: msgs.developer,
    user: buildRepairPrompt(issues, JSON.stringify(out || {}))
  };
  try {
    const rep = await callLLM(env, repairedMsgs);
    const res2 = attachMetaAndValidate(rep, stage);
    if (res2.ok) return res2.value;
    issues = res2.issues;
  } catch (e) {
    if (e && e.__openaiStatus) throw e;
  }

  // 3) final attempt
  try {
    const fin = await callLLM(env, msgs);
    const res3 = attachMetaAndValidate(fin, stage);
    if (res3.ok) return res3.value;
    issues = res3.issues;
  } catch (e) {
    if (e && e.__openaiStatus) throw e;
  }

  return { __failed: true, issues };
}

// ---------- /generate handler ----------
async function handleGenerate(request, env) {
  const correlationId = cryptoRandomId();
  try {
    const { stage, locale = "en-US", prompt } = await request.json();

    if (!stage || !prompt?.system || !prompt?.developer || !prompt?.user) {
      return json({
        error: { code: "BAD_REQUEST", message: "Expected { stage, prompt:{system,developer,user} }" },
        correlationId
      }, 400);
    }

    const attachMetaAndValidate = (obj, expectedStage) => {
      obj.meta = obj.meta || {};
      obj.meta.version = SCHEMA_VERSION;
      obj.meta.locale = locale;
      obj.meta.generatedAt = obj.meta.generatedAt || nowISO();
      obj.meta.stage = expectedStage;

      const m = validateMeta(obj.meta, expectedStage);
      if (!m.ok) return { ok: false, issues: m.issues };

      switch (expectedStage) {
        case "overview": {
          const v = validateOverviewPayload(obj);
          return v.ok ? { ok: true, value: { ...obj, correlationId } } : { ok: false, issues: v.issues };
        }
        case "technical": {
          const v = validateTechnicalPayload(obj);
          return v.ok ? { ok: true, value: { ...obj, correlationId } } : { ok: false, issues: v.issues };
        }
        case "market": {
          const v = validateMarketPayload(obj);
          return v.ok ? { ok: true, value: { ...obj, correlationId } } : { ok: false, issues: v.issues };
        }
        case "design": {
          const v = validateDesignPayload(obj);
          return v.ok ? { ok: true, value: { ...obj, correlationId } } : { ok: false, issues: v.issues };
        }
        case "diagrams": {
          const v = validateDiagramsPayload(obj);
          return v.ok ? { ok: true, value: { ...obj, correlationId } } : { ok: false, issues: v.issues };
        }
        case "rawText": {
          const v = validateRawTextPayload(obj);
          return v.ok ? { ok: true, value: { ...obj, correlationId } } : { ok: false, issues: v.issues };
        }
        case "prompts": {
          const v = validatePromptsPayload(obj);
          return v.ok ? { ok: true, value: { ...obj, correlationId } } : { ok: false, issues: v.issues };
        }
        default:
          return { ok: false, issues: [`Unknown stage "${expectedStage}"`] };
      }
    };

    let result;
    try {
      result = await retryWithRepair(env, prompt, stage, attachMetaAndValidate);
    } catch (e) {
      const msg = String(e && e.message || e);
      return json({
        error: { code: "OPENAI_UPSTREAM_ERROR", message: msg },
        correlationId
      }, 502);
    }

    if (result.__failed) {
      return json({
        error: { code: "INVALID_MODEL_OUTPUT", message: "Validation failed", issues: result.issues },
        correlationId
      }, 422);
    }

    return json(result);
  } catch (e) {
    return json({ error: { code: "SERVER_ERROR", message: String(e) }, correlationId }, 500);
  }
}

// ---------- /fix-diagram handler (single diagram repair) ----------
async function handleFixDiagram(request, env) {
  const correlationId = cryptoRandomId();
  try {
    const { diagramId, diagramType, brokenCode, technicalSpec, overview } = await request.json();

    if (!diagramId || !diagramType || !brokenCode) {
      return json({
        error: { code: "BAD_REQUEST", message: "Expected { diagramId, diagramType, brokenCode }" },
        correlationId
      }, 400);
    }

    const prompt = {
      system: 'You are a Mermaid diagram syntax expert. Fix broken Mermaid diagram code.',
      developer: 'Return ONLY the corrected Mermaid code without any explanations or additional text.',
      user: `Fix this broken ${diagramType} Mermaid diagram:\n\n${brokenCode}\n\nTechnical context: ${technicalSpec || 'N/A'}\nOverview: ${overview || 'N/A'}\n\nReturn ONLY the corrected Mermaid code.`
    };

    let result;
    try {
      result = await retryWithRepair(env, prompt, 'rawText', (obj) => {
        // For diagram fixing, we just want the raw corrected code
        return { ok: true, value: { correctedCode: obj.content || obj.text || obj } };
      });
    } catch (e) {
      const msg = String(e && e.message || e);
      return json({
        error: { code: "OPENAI_UPSTREAM_ERROR", message: msg },
        correlationId
      }, 502);
    }

    if (result.__failed) {
      return json({
        error: { code: "INVALID_MODEL_OUTPUT", message: "Validation failed", issues: result.issues },
        correlationId
      }, 422);
    }

    return json({
      diagramId,
      correctedCode: result.correctedCode,
      correlationId
    });
  } catch (e) {
    return json({ error: { code: "SERVER_ERROR", message: String(e) }, correlationId }, 500);
  }
}

// ---------- /generate-mockups handler ----------
async function handleGenerateMockups(request, env) {
  const correlationId = cryptoRandomId();
  try {
    const { overview, design, technical, useMockData = false } = await request.json();

    if (!overview || !design) {
      return json({
        error: { code: "BAD_REQUEST", message: "Expected { overview, design, technical (optional), useMockData (optional) }" },
        correlationId
      }, 400);
    }

    // Step 1: Analyze specification and identify screens
    const analyzePrompt = {
      system: "You are a frontend architecture expert. Analyze application specifications to identify all screens and pages.",
      developer: "Return ONLY valid JSON with a 'screens' array. Each screen object must have: id (string), name (string), description (string), deviceType (string: 'web', 'mobile', or 'both'), order (number).",
      user: `Analyze this application specification and identify all screens/pages that need mockups:

OVERVIEW:
${typeof overview === 'object' ? JSON.stringify(overview, null, 2) : overview}

DESIGN:
${typeof design === 'object' ? JSON.stringify(design, null, 2) : design}

${technical ? `TECHNICAL:\n${typeof technical === 'object' ? JSON.stringify(technical, null, 2) : technical}` : ''}

Return a JSON object with this structure:
{
  "screens": [
    {
      "id": "home-page",
      "name": "Home Page",
      "description": "Main landing page with hero section and navigation",
      "deviceType": "web",
      "order": 1
    }
  ]
}

Identify 5-8 key screens based on the user journey and screen descriptions.`
    };

    let screensData;
    try {
      screensData = await callLLM(env, analyzePrompt);
      if (!screensData.screens || !Array.isArray(screensData.screens)) {
        throw new Error("Invalid screens data structure");
      }
    } catch (e) {
      return json({
        error: { code: "ANALYSIS_FAILED", message: `Failed to analyze screens: ${String(e)}` },
        correlationId
      }, 500);
    }

    // Step 2: Generate HTML+CSS for each screen
    const mockups = [];
    const screens = screensData.screens.sort((a, b) => (a.order || 0) - (b.order || 0));

    for (let i = 0; i < screens.length; i++) {
      const screen = screens[i];
      
      // Extract design system from design spec
      let designSystem = "";
      try {
        const designObj = typeof design === 'string' ? JSON.parse(design) : design;
        if (designObj.design?.visualStyleGuide) {
          designSystem = JSON.stringify(designObj.design.visualStyleGuide, null, 2);
        } else if (designObj.visualStyleGuide) {
          designSystem = JSON.stringify(designObj.visualStyleGuide, null, 2);
        }
      } catch (e) {
        // Fallback: use design as string
        designSystem = typeof design === 'string' ? design : JSON.stringify(design);
      }

      const mockupPrompt = {
        system: "You are an expert frontend developer creating high-quality, production-ready HTML+CSS mockups. Create complete, standalone HTML pages that are visually stunning, modern, and match the design system perfectly.",
        developer: "Return ONLY valid HTML (no markdown, no code fences, no explanations). The HTML must be complete and standalone with embedded CSS in <style> tag. Include basic JavaScript for interactivity if needed.",
        user: `Create a high-quality HTML+CSS mockup for this screen:

SCREEN: ${screen.name}
DESCRIPTION: ${screen.description}
DEVICE TYPE: ${screen.deviceType}

APPLICATION OVERVIEW:
${typeof overview === 'object' ? JSON.stringify(overview, null, 2) : overview}

DESIGN SYSTEM:
${designSystem}

${technical ? `TECHNICAL CONTEXT:\n${typeof technical === 'object' ? JSON.stringify(technical, null, 2) : technical}` : ''}

${useMockData ? `IMPORTANT: Include realistic mock data in the mockup:
- Use realistic names, emails, dates, numbers
- Add sample content that demonstrates functionality
- Show example data in tables, lists, cards
- Make it look like a real, working application` : `IMPORTANT: Use placeholder content (e.g., "Sample Text", "Example Data")`}

REQUIREMENTS:
1. Create a complete, standalone HTML5 document
2. Embed all CSS in <style> tag (no external files)
3. Use the exact colors, typography, and design elements from the design system
4. Make it responsive (mobile-first approach)
5. Include modern UI elements: cards, buttons, forms, navigation
6. Add hover effects and basic interactivity with JavaScript
7. Use semantic HTML5 elements
8. Ensure the design is polished and professional
9. ${useMockData ? 'Fill with realistic mock data' : 'Use placeholder text'}
10. Complete any missing information intelligently based on context

PREMIUM DESIGN REQUIREMENTS (inspired by Stripe, Linear, Vercel, Notion):
- BUTTONS: Use sophisticated button designs with:
  * Subtle shadows (box-shadow: 0 2px 4px rgba(0,0,0,0.1))
  * Smooth hover transitions (transform: translateY(-1px), scale(1.02))
  * Gradient backgrounds where appropriate
  * Rounded corners (border-radius: 8-12px)
  * Proper padding (12px 24px minimum)
  * Active states with darker shades

- CARDS: Create elegant card components with:
  * Subtle borders (border: 1px solid rgba(0,0,0,0.1))
  * Soft shadows (box-shadow: 0 4px 6px rgba(0,0,0,0.07))
  * Rounded corners (border-radius: 12px)
  * Hover effects (elevation increase, slight scale)
  * Proper spacing (padding: 24px minimum)
  * Background colors that contrast nicely

- TYPOGRAPHY: Ensure excellent typography:
  * Proper line-height (1.5-1.6 for body, 1.2-1.3 for headings)
  * Letter-spacing for headings (-0.02em to -0.05em)
  * Font weights: 400 for body, 600-700 for headings
  * Proper hierarchy with size scale (1rem, 1.25rem, 1.5rem, 2rem, etc.)
  * Color contrast (WCAG AA minimum)

- ANIMATIONS & TRANSITIONS:
  * Smooth transitions on all interactive elements (transition: all 0.2s ease)
  * Fade-in animations for content (opacity, transform)
  * Hover effects on buttons, cards, links
  * Loading states with subtle animations
  * Micro-interactions (button press, card lift)

- COLORS & GRADIENTS:
  * Use subtle gradients for backgrounds (linear-gradient with low opacity)
  * Apply gradients to buttons and CTAs
  * Use color variations (lighter/darker shades) for depth
  * Implement proper color hierarchy

- SPACING & LAYOUT:
  * Consistent spacing system (4px, 8px, 16px, 24px, 32px, 48px)
  * Proper margins and padding
  * Grid-based layouts where appropriate
  * White space for breathing room

- FORMS & INPUTS:
  * Modern input designs with borders and focus states
  * Focus rings (outline: 2px solid primary color)
  * Placeholder styling
  * Error states with red accents
  * Labels with proper spacing

- NAVIGATION:
  * Clean navigation bars
  * Active state indicators
  * Hover effects on nav items
  * Proper spacing between items

- TABLES & DATA:
  * Clean table designs with alternating row colors
  * Proper cell padding
  * Hover effects on rows
  * Sortable headers with indicators

- DEPTH & SHADOWS:
  * Use multiple shadow layers for depth
  * Elevation system (0px, 2px, 4px, 8px, 16px shadows)
  * Shadows should be subtle and realistic

- INTERACTIVITY:
  * All interactive elements must have hover states
  * Click/tap feedback (active states)
  * Smooth transitions everywhere
  * Loading states for async actions

- RESPONSIVE DESIGN:
  * Mobile-first approach
  * Breakpoints: mobile (375px), tablet (768px), desktop (1024px+)
  * Flexible layouts (flexbox/grid)
  * Responsive typography (clamp or media queries)

Return ONLY the HTML code, nothing else.`
      };

      try {
        const htmlResponse = await callLLM(env, mockupPrompt);
        
        // Extract HTML from response (handle different response formats)
        let html = "";
        if (typeof htmlResponse === 'string') {
          html = htmlResponse;
        } else if (htmlResponse.html) {
          html = htmlResponse.html;
        } else if (htmlResponse.content) {
          html = htmlResponse.content;
        } else {
          html = JSON.stringify(htmlResponse);
        }

        // Clean up HTML (remove markdown code fences if present)
        html = html.replace(/^```html\s*/i, "").replace(/```$/i, "").trim();
        html = html.replace(/^```\s*/i, "").replace(/```$/i, "").trim();

        mockups.push({
          id: screen.id || `screen-${i + 1}`,
          name: screen.name,
          description: screen.description,
          html: html,
          deviceType: screen.deviceType || "both",
          order: screen.order || i + 1,
          interactive: true
        });
      } catch (e) {
        console.error(`Failed to generate mockup for ${screen.name}:`, e);
        // Continue with other screens even if one fails
      }
    }

    // Return mockups with metadata
    return json({
      mockups,
      meta: {
        version: SCHEMA_VERSION,
        generatedAt: nowISO(),
        totalScreens: mockups.length,
        useMockData,
        correlationId
      }
    });
  } catch (e) {
    return json({ error: { code: "SERVER_ERROR", message: String(e) }, correlationId }, 500);
  }
}

// ---------- /selftest handler (diagnostics) ----------
async function handleSelfTest(env) {
  try {
    const probe = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: "ping" }]
      })
    });
    const text = await probe.text();
    return new Response(text, {
      status: probe.status,
      headers: { "content-type": "application/json" }
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}




