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
  return [
    "You returned JSON that failed validation.",
    "Fix ONLY the listed issues. Keep structure and IDs stable.",
    "Return ONLY valid JSON (no markdown, no code fences).",
    "",
    "Issues:",
    JSON.stringify(issues, null, 2),
    "",
    "Original JSON:",
    (originalJSON || "").slice(0, 15000)
  ].join("\n");
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




