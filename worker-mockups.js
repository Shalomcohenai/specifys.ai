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

      // Main mockup generation endpoint (legacy - generates all at once)
      if (url.pathname === "/generate" || url.pathname === "/generate-mockups") {
        return cors(await handleGenerateMockups(request, env));
      }

      // Batch mode endpoints
      if (url.pathname === "/analyze-screens") {
        return cors(await handleAnalyzeScreens(request, env));
      }

      if (url.pathname === "/generate-single-mockup") {
        return cors(await handleGenerateSingleMockup(request, env));
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

// ---------- /analyze-screens handler (Batch Mode Step 1) ----------
async function handleAnalyzeScreens(request, env) {
  const correlationId = cryptoRandomId();
  try {
    const { overview, design, technical } = await request.json();

    if (!overview || !design) {
      return json({
        error: { code: "BAD_REQUEST", message: "Expected { overview, design, technical (optional) }" },
        correlationId
      }, 400);
    }

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

    const screens = screensData.screens.sort((a, b) => (a.order || 0) - (b.order || 0));

    return json({
      screens,
      meta: {
        version: SCHEMA_VERSION,
        analyzedAt: nowISO(),
        totalScreens: screens.length,
        correlationId
      }
    });
  } catch (e) {
    return json({ error: { code: "SERVER_ERROR", message: String(e) }, correlationId }, 500);
  }
}

// ---------- /generate-single-mockup handler (Batch Mode Step 2) ----------
async function handleGenerateSingleMockup(request, env) {
  const correlationId = cryptoRandomId();
  try {
    const { overview, design, technical, screen, useMockData = false } = await request.json();

    if (!overview || !design || !screen) {
      return json({
        error: { code: "BAD_REQUEST", message: "Expected { overview, design, screen, technical (optional), useMockData (optional) }" },
        correlationId
      }, 400);
    }

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
      system: "You are an elite frontend designer and developer creating premium, production-ready HTML+CSS mockups. Your designs should match the quality of top-tier SaaS products like Stripe, Linear, Vercel, and Notion. Focus on sophisticated UI/UX, polished components, delightful micro-interactions, and professional aesthetics. Study patterns from: Stripe (clean typography, precise spacing), Linear (smooth animations, modern components), Vercel (sophisticated gradients, depth), Notion (content hierarchy, readability), Figma (polished components), Apple (minimalism, focus).",
      developer: "Return ONLY valid HTML (no markdown, no code fences, no explanations). The HTML must be complete and standalone with embedded CSS in <style> tag. Include JavaScript for interactivity, animations, hover effects, and micro-interactions.",
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

      return json({
        mockup: {
          id: screen.id || `screen-${screen.order || 0}`,
          name: screen.name,
          description: screen.description,
          html: html,
          deviceType: screen.deviceType || "both",
          order: screen.order || 0,
          interactive: true
        },
        meta: {
          version: SCHEMA_VERSION,
          generatedAt: nowISO(),
          correlationId
        }
      });
    } catch (e) {
      return json({
        error: { 
          code: "GENERATION_FAILED", 
          message: `Failed to generate mockup for ${screen.name}: ${String(e)}`,
          screenId: screen.id,
          screenName: screen.name
        },
        correlationId
      }, 500);
    }
  } catch (e) {
    return json({ error: { code: "SERVER_ERROR", message: String(e) }, correlationId }, 500);
  }
}


