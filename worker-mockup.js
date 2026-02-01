// Cloudflare Worker: Mockup Generator
// File: worker-mockup.js
// Version: v1.0.0
// Purpose: Generate HTML/CSS/JS mockups from specifications
// Env var required: OPENAI_API_KEY

// Model configuration
const MODEL = "gpt-4o-mini";
const SCHEMA_VERSION = "1.0";

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const origin = request.headers.get("origin");

      // CORS preflight
      if (request.method === "OPTIONS") {
        return cors(new Response(null, { status: 204 }), origin);
      }

      // Health check endpoint
      if (request.method === "GET" && url.pathname === "/health") {
        return cors(json({ status: "ok", service: "mockup-worker", version: SCHEMA_VERSION }), origin);
      }

      // Only POST for main endpoints
      if (request.method !== "POST") {
        return cors(json({ error: { code: "METHOD_NOT_ALLOWED", message: "Use POST" } }, 405), origin);
      }

      // Route to appropriate handler
      if (url.pathname === "/analyze-screens") {
        return cors(await handleAnalyzeScreens(request, env), origin);
      }
      if (url.pathname === "/generate-single-mockup") {
        return cors(await handleGenerateSingleMockup(request, env), origin);
      }

      return cors(json({ error: { code: "NOT_FOUND", message: "Unknown route" } }, 404), origin);
    } catch (e) {
      const errorOrigin = request?.headers?.get("origin") || null;
      return cors(json({ error: { code: "UNEXPECTED", message: String(e) } }, 500), errorOrigin);
    }
  }
};

// ---------- HTTP utils ----------
function cors(res, origin = null) {
  // Allow requests from specifys-ai.com and localhost for development
  const allowedOrigins = [
    "https://specifys-ai.com",
    "https://www.specifys-ai.com",
    "http://localhost:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080"
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    // Same-origin requests (no origin header) - allow in development
    res.headers.set("Access-Control-Allow-Origin", "*");
  } else {
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

function cryptoRandomId() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- OpenAI caller ----------
async function callLLM(env, messages, temperature = 0.7) {
  const body = {
    model: MODEL,
    messages: messages,
    temperature: temperature
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
    Object.defineProperty(err, '__openaiStatus', { value: res.status, writable: false });
    Object.defineProperty(err, '__openaiBody', { value: text, writable: false });
    throw err;
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

// ---------- /analyze-screens handler ----------
async function handleAnalyzeScreens(request, env) {
  const correlationId = cryptoRandomId();
  
  try {
    const { overview, design, technical } = await request.json();

    if (!overview || !design) {
      return json({
        error: { code: "BAD_REQUEST", message: "overview and design are required" },
        correlationId
      }, 400);
    }

    // Build prompt to analyze screens from specification
    const systemPrompt = `You are an expert UI/UX analyst. Your task is to analyze application specifications and identify all screens that need to be created as mockups.

Analyze the provided specification and extract:
1. All screens mentioned in the overview.screenDescriptions.screens array
2. Additional screens that can be inferred from the user flow, features, and design requirements
3. The device type for each screen (web, mobile, or tablet)

Return a JSON array of screen objects. Each screen object must have:
- name: string (clear, descriptive screen name)
- deviceType: string (one of: "web", "mobile", "tablet")
- description: string (brief description of what this screen does)
- priority: number (1-10, where 10 is highest priority - main screens should be 8-10)

Focus on:
- Main user-facing screens (login, dashboard, main features)
- Critical user flows (onboarding, checkout, etc.)
- Key feature screens mentioned in the specification

IMPORTANT: Return ONLY valid JSON array, no markdown, no code fences, no explanations.`;

    const userPrompt = `Analyze this application specification and identify all screens that need mockups:

OVERVIEW:
${JSON.stringify(overview, null, 2)}

DESIGN:
${JSON.stringify(design, null, 2)}

${technical ? `TECHNICAL:
${JSON.stringify(technical, null, 2)}` : ''}

Return a JSON array of screen objects. Example format:
[
  {
    "name": "Login Screen",
    "deviceType": "web",
    "description": "User authentication screen with email/password login",
    "priority": 10
  },
  {
    "name": "Dashboard",
    "deviceType": "web",
    "description": "Main dashboard showing user overview and key metrics",
    "priority": 10
  }
]`;

    let screens;
    try {
      const response = await callLLM(env, [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ], 0.3);

      // Parse JSON response
      const cleaned = response.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      screens = JSON.parse(cleaned);

      // Validate screens array
      if (!Array.isArray(screens)) {
        throw new Error("Response is not an array");
      }

      // Validate each screen
      screens = screens.filter(screen => {
        return screen && 
               typeof screen.name === "string" && 
               typeof screen.deviceType === "string" &&
               ["web", "mobile", "tablet"].includes(screen.deviceType);
      });

      // Sort by priority (highest first)
      screens.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    } catch (parseError) {
      // If parsing fails, try to extract screens from overview
      screens = extractScreensFromOverview(overview);
    }

    if (!screens || screens.length === 0) {
      return json({
        error: { code: "NO_SCREENS_FOUND", message: "Could not identify any screens from the specification" },
        correlationId
      }, 422);
    }

    return json({
      screens: screens,
      correlationId,
      meta: {
        version: SCHEMA_VERSION,
        totalScreens: screens.length,
        analyzedAt: new Date().toISOString()
      }
    });

  } catch (e) {
    if (e && (e.__openaiStatus !== undefined || e.message?.includes("OPENAI_UPSTREAM"))) {
      return json({
        error: { code: "OPENAI_UPSTREAM_ERROR", message: String(e.message || e) },
        correlationId
      }, 502);
    }
    return json({
      error: { code: "SERVER_ERROR", message: String(e) },
      correlationId
    }, 500);
  }
}

// Fallback: Extract screens from overview if AI parsing fails
function extractScreensFromOverview(overview) {
  const screens = [];
  
  if (overview?.screenDescriptions?.screens && Array.isArray(overview.screenDescriptions.screens)) {
    overview.screenDescriptions.screens.forEach((screen, index) => {
      screens.push({
        name: screen.name || screen.title || `Screen ${index + 1}`,
        deviceType: screen.deviceType || "web",
        description: screen.description || screen.purpose || "",
        priority: screen.priority || 8
      });
    });
  }
  
  // If no screens found, create default screens based on common patterns
  if (screens.length === 0) {
    screens.push({
      name: "Home / Dashboard",
      deviceType: "web",
      description: "Main application screen",
      priority: 10
    });
  }
  
  return screens;
}

// ---------- /generate-single-mockup handler ----------
async function handleGenerateSingleMockup(request, env) {
  const correlationId = cryptoRandomId();
  
  try {
    const { overview, design, technical, screen, useMockData } = await request.json();

    if (!overview || !design || !screen) {
      return json({
        error: { code: "BAD_REQUEST", message: "overview, design, and screen are required" },
        correlationId
      }, 400);
    }

    // Build comprehensive prompt for mockup generation
    const systemPrompt = `You are an expert frontend developer specializing in creating pixel-perfect, interactive HTML/CSS/JS mockups.

Your task is to generate a complete, standalone HTML file that represents a realistic mockup of the specified screen.

REQUIREMENTS:
1. Generate a complete, standalone HTML file (no external dependencies)
2. Include ALL CSS inline in <style> tag
3. Include ALL JavaScript inline in <script> tag
4. Use modern, clean design matching the design specification
5. Make it interactive and realistic (buttons work, forms are functional, etc.)
6. Use the exact colors, typography, and spacing from the design specification
7. Make it responsive and mobile-friendly if needed
8. Include realistic content ${useMockData ? 'with sample data' : 'with placeholder text'}

DESIGN GUIDELINES:
- Follow the visual style guide from the design specification exactly
- Use the specified color palette, fonts, and spacing
- Match the UI layout and component structure
- Create a professional, polished appearance
- Ensure good UX with proper spacing and visual hierarchy

TECHNICAL REQUIREMENTS:
- Use semantic HTML5
- Use modern CSS (flexbox, grid, etc.)
- Make interactive elements functional (buttons, forms, etc.)
- Include smooth transitions and hover effects
- Ensure accessibility (proper labels, ARIA attributes)
- Make it work in modern browsers

IMPORTANT: Return ONLY the complete HTML code, no markdown, no code fences, no explanations. The HTML must be complete and runnable.`;

    const userPrompt = `Generate a complete HTML mockup for this screen:

SCREEN TO CREATE:
Name: ${screen.name}
Device Type: ${screen.deviceType}
Description: ${screen.description || 'N/A'}

SPECIFICATION DATA:

OVERVIEW:
${JSON.stringify(overview, null, 2)}

DESIGN:
${JSON.stringify(design, null, 2)}

${technical ? `TECHNICAL:
${JSON.stringify(technical, null, 2)}` : ''}

${useMockData ? `
USE MOCK DATA: Yes - Fill the mockup with realistic sample data (names, numbers, dates, etc.)
` : `
USE MOCK DATA: No - Use placeholder text like "Sample Text", "0", "Example"
`}

Generate a complete, standalone HTML file that:
1. Matches the design specification exactly (colors, fonts, spacing, layout)
2. Represents the screen "${screen.name}" accurately
3. Is fully interactive and functional
4. Looks professional and polished
5. ${useMockData ? 'Contains realistic sample data' : 'Uses placeholder content'}

Return ONLY the complete HTML code, starting with <!DOCTYPE html>.`;

    let htmlContent;
    try {
      htmlContent = await callLLM(env, [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ], 0.5);

      // Clean up the response
      htmlContent = htmlContent.trim();
      
      // Remove markdown code fences if present
      if (htmlContent.startsWith("```")) {
        htmlContent = htmlContent.replace(/^```html\s*/i, "").replace(/^```\s*/, "").replace(/```$/i, "").trim();
      }
      
      // Ensure it starts with DOCTYPE
      if (!htmlContent.toLowerCase().startsWith("<!doctype")) {
        htmlContent = "<!DOCTYPE html>\n" + htmlContent;
      }

      // Validate it's valid HTML
      if (!htmlContent.includes("<html") && !htmlContent.includes("<!DOCTYPE")) {
        throw new Error("Generated content is not valid HTML");
      }

    } catch (genError) {
      return json({
        error: { code: "GENERATION_FAILED", message: `Failed to generate mockup: ${String(genError)}` },
        correlationId
      }, 500);
    }

    // Build mockup object
    const mockup = {
      name: screen.name,
      deviceType: screen.deviceType || "web",
      description: screen.description || "",
      html: htmlContent,
      generatedAt: new Date().toISOString(),
      useMockData: useMockData || false
    };

    return json({
      mockup: mockup,
      correlationId,
      meta: {
        version: SCHEMA_VERSION,
        screenName: screen.name,
        deviceType: screen.deviceType
      }
    });

  } catch (e) {
    if (e && (e.__openaiStatus !== undefined || e.message?.includes("OPENAI_UPSTREAM"))) {
      return json({
        error: { code: "OPENAI_UPSTREAM_ERROR", message: String(e.message || e) },
        correlationId
      }, 502);
    }
    return json({
      error: { code: "SERVER_ERROR", message: String(e) },
      correlationId
    }, 500);
  }
}

