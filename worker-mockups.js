// Cloudflare Worker: Mockups Generator
// File: worker-mockups.js
// Version: v1.0.0
// Purpose: Generate HTML+CSS mockups for frontend specifications
// Env var required: OPENAI_API_KEY

// Model configuration
const MODEL = "gpt-4o-mini";
const SCHEMA_VERSION = "1.0";

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      // CORS preflight
      if (request.method === "OPTIONS") {
        return cors(new Response(null, { status: 204 }));
      }

      // Health check endpoint
      if (request.method === "GET" && url.pathname === "/health") {
        return cors(json({ status: "ok", service: "mockups-generator", version: SCHEMA_VERSION }));
      }

      // Only POST for main endpoint
      if (request.method !== "POST") {
        return cors(json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST" } }, 405));
      }

      // Main mockup generation endpoint
      if (url.pathname === "/generate" || url.pathname === "/generate-mockups") {
        return cors(await handleGenerateMockups(request, env));
      }

      return cors(json({ error: { code: "NOT_FOUND", message: "Unknown route" } }, 404));
    } catch (e) {
      return cors(json({ error: { code: "UNEXPECTED", message: String(e) } }, 500));
    }
  }
};

// ---------- HTTP utils ----------
function cors(res) {
  res.headers.set("Access-Control-Allow-Origin", "*");
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

function nowISO() {
  return new Date().toISOString();
}

function cryptoRandomId() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- OpenAI caller ----------
async function callLLM(env, { system, developer, user }) {
  // Combine developer instructions into system prompt
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
    try {
      return JSON.parse(cleaned);
    } catch {
      // If still not JSON, return as string
      return content;
    }
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

