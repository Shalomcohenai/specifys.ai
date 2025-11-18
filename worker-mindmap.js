// Cloudflare Worker: Mind Map Generator
// File: worker-mindmap.js
// Version: v1.0
// Env var required: OPENAI_API_KEY
// 
// This worker receives spec data (overview + technical) and generates
// a MindElixir-compatible JSON structure representing the product architecture

const MODEL = "gpt-4o-mini";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://specifys-ai.com',
  'https://www.specifys-ai.com',
  'https://specifys-ai.onrender.com'
];

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const origin = request.headers.get("origin");

      // CORS preflight
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }), origin);

      // Health check
      if (request.method === "GET" && url.pathname === "/health") {
        return cors(json({ status: "ok", service: "mindmap-generator" }), origin);
      }

      // Only POST for main endpoint
      if (request.method !== "POST") {
        return cors(json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST" } }, 405), origin);
      }

      // Handle both root path and /generate-mindmap path
      if (url.pathname === "/" || url.pathname === "/generate-mindmap") {
        return cors(await handleGenerateMindMap(request, env), origin);
      }

      return cors(json({ error: { code: "NOT_FOUND", message: "Unknown route" } }, 404), origin);
    } catch (e) {
      console.error("Worker error:", e);
      // Get origin from request (may not be available in catch, so use null as fallback)
      const errorOrigin = request?.headers?.get("origin") || null;
      return cors(json({ error: { code: "UNEXPECTED", message: String(e) } }, 500), errorOrigin);
    }
  }
};

// ---------- HTTP utils ----------
function cors(res, origin = null) {
  // Check if origin is allowed
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    // Same-origin requests (no origin header) - allow in development
    res.headers.set("Access-Control-Allow-Origin", "*");
  } else {
    // Origin not allowed - don't set header (browser will block)
    // But for now, allow it with warning (can be tightened later)
    console.warn(`[CORS] Origin not allowed: ${origin}`);
    res.headers.set("Access-Control-Allow-Origin", "*");
  }
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

// ---------- OpenAI caller ----------
async function callLLM(env, prompt) {
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user }
    ],
    temperature: 0.7
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
    // Store additional error info as properties
    Object.assign(err, {
      openaiStatus: res.status,
      openaiBody: text
    });
    throw err;
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "";
  
  try {
    return JSON.parse(content);
  } catch {
    // Try to extract JSON from markdown code blocks
    const cleaned = content
      .replace(/^```json\s*/i, "")
      .replace(/```$/i, "")
      .replace(/^```\s*/i, "")
      .trim();
    return JSON.parse(cleaned);
  }
}

// ---------- /generate-mindmap handler ----------
async function handleGenerateMindMap(request, env) {
  try {
    // Check if OPENAI_API_KEY is set
    if (!env.OPENAI_API_KEY) {
      return json({
        error: { code: "CONFIGURATION_ERROR", message: "OPENAI_API_KEY is not configured" }
      }, 500);
    }

    let requestBody;
    try {
      requestBody = await request.json();
    } catch (e) {
      return json({
        error: { code: "BAD_REQUEST", message: "Invalid JSON in request body" }
      }, 400);
    }

    const { overview, technical } = requestBody;

    if (!overview || !technical) {
      return json({
        error: { code: "BAD_REQUEST", message: "overview and technical are required" }
      }, 400);
    }

    // Build the prompt for OpenAI
    const systemPrompt = `You are an expert at analyzing software product specifications and creating visual flow diagrams. 
Your task is to analyze the provided product specification (overview and technical details) and create a comprehensive flow diagram structure in Drawflow JSON format.

The diagram should represent:
1. Features - Core product features and functionalities
2. Screens - User interface screens and pages
3. Variables - Internal state variables and settings
4. Permissions - Access control and user permissions
5. Integrations - Third-party services and APIs
6. User Flows - User journey flows and scenarios

Return ONLY valid JSON in Drawflow format. The structure should be:
{
  "drawflow": {
    "Home": {
      "data": {
        "1": {
          "id": 1,
          "name": "product-root",
          "data": { "label": "<Product Name>" },
          "class": "product",
          "html": "<div class=\"title-box\"><Product Name></div>",
          "typenode": false,
          "inputs": {},
          "outputs": { "output_1": { "connections": [{ "node": "2", "output": "input_1" }] } },
          "pos_x": 400,
          "pos_y": 100
        },
        "2": {
          "id": 2,
          "name": "features",
          "data": { "label": "Features" },
          "class": "category",
          "html": "<div class=\"title-box\">Features</div>",
          "typenode": false,
          "inputs": { "input_1": { "connections": [{ "node": "1", "input": "output_1" }] } },
          "outputs": {},
          "pos_x": 200,
          "pos_y": 300
        }
      }
    }
  }
}

Important:
- Extract the product name from the overview
- Create nodes for each major component (Features, Screens, Variables, Permissions, Integrations, User Flows)
- Create child nodes for each feature, screen, variable, etc.
- Connect nodes logically - features connect to screens, screens to variables, etc.
- Each node needs: id (unique number), name (kebab-case), data.label (display name), class (category), html (HTML content), pos_x and pos_y (position)
- Use connections to link nodes: outputs of one node connect to inputs of another
- Position nodes in a logical flow layout (left to right, top to bottom)
- Return ONLY the JSON object, no markdown, no code fences`;

    const userPrompt = `Analyze this product specification and create a mind map:

OVERVIEW DATA:
${JSON.stringify(overview, null, 2)}

TECHNICAL DATA:
${JSON.stringify(technical, null, 2)}

Create a comprehensive mind map showing all features, screens, variables, permissions, integrations, and user flows with their relationships.`;

    // Call OpenAI
    const mindMapData = await callLLM(env, {
      system: systemPrompt,
      user: userPrompt
    });

    // Validate the response structure
    if (!mindMapData.drawflow || !mindMapData.drawflow.Home || !mindMapData.drawflow.Home.data) {
      throw new Error("Invalid Drawflow structure returned from AI");
    }

    return json({
      success: true,
      mindMap: mindMapData
    });

  } catch (error) {
    console.error("Error generating mind map:", error);
    
    // Check for OpenAI API errors
    const openaiStatus = error.openaiStatus || error.__openaiStatus;
    if (openaiStatus) {
      const openaiBody = error.openaiBody || error.__openaiBody || error.message;
      return json({
        error: {
          code: "OPENAI_ERROR",
          message: `OpenAI API error: ${openaiStatus}`,
          details: openaiBody
        }
      }, 500);
    }

    return json({
      error: {
        code: "GENERATION_ERROR",
        message: error.message || "Failed to generate mind map"
      }
    }, 500);
  }
}

