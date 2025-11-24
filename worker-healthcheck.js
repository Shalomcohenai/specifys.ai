// Cloudflare Worker: Health Check Service
// Dedicated health check service for monitoring system health
// Endpoint: https://healthcheck.shalom-cohen-111.workers.dev/health

const MODEL = "gpt-4o-mini";

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const origin = request.headers.get("origin");

      // CORS preflight
      if (request.method === "OPTIONS") {
        return cors(new Response(null, { status: 204 }), origin);
      }

      // Root path - return service info
      if (url.pathname === "/" && request.method === "GET") {
        return cors(json({
          service: "healthcheck",
          status: "ok",
          endpoints: ["/health"],
          message: "Health check service is running"
        }), origin);
      }

      // Health check endpoint
      if (url.pathname === "/health") {
        if (request.method === "GET" || request.method === "POST") {
          return cors(await handleHealthCheck(request, env), origin);
        }
      }

      // Not found
      return cors(json({ 
        error: { 
          code: "NOT_FOUND", 
          message: "Endpoint not found. Use /health for health checks." 
        } 
      }, 404), origin);
    } catch (e) {
      const errorOrigin = request?.headers?.get("origin") || null;
      return cors(json({ 
        error: { 
          code: "UNEXPECTED", 
          message: String(e) 
        } 
      }, 500), errorOrigin);
    }
  }
};

function cors(res, origin = null) {
  if (origin && (
    origin.includes("specifys-ai.com") ||
    origin.includes("specifys-ai.onrender.com") ||
    origin.includes("localhost")
  )) {
    res.headers.set("Access-Control-Allow-Origin", origin);
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

async function handleHealthCheck(request, env) {
  try {
    if (!env.OPENAI_API_KEY) {
      return json({
        cloudflare: "ok",
        openai: "error",
        error: "OPENAI_API_KEY not configured",
        timestamp: new Date().toISOString()
      }, 500);
    }

    const startTime = Date.now();
    const probe = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 10,
        temperature: 0
      }),
      signal: AbortSignal.timeout(10000)
    });

    const responseTime = Date.now() - startTime;

    if (probe.ok) {
      return json({
        cloudflare: "ok",
        openai: "ok",
        responseTime: `${responseTime}ms`,
        model: MODEL,
        timestamp: new Date().toISOString()
      }, 200);
    } else {
      const errorText = await probe.text();
      let errorMessage = `OpenAI API returned status ${probe.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        errorMessage += `: ${errorText.substring(0, 200)}`;
      }

      return json({
        cloudflare: "ok",
        openai: "error",
        error: errorMessage,
        httpStatus: probe.status,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      }, 200);
    }
  } catch (e) {
    const errorMessage = e.message || String(e);
    return json({
      cloudflare: "ok",
      openai: "error",
      error: errorMessage.includes("timeout") 
        ? "OpenAI API timeout (10s exceeded)"
        : `OpenAI API connection failed: ${errorMessage}`,
      timestamp: new Date().toISOString()
    }, 200);
  }
}
