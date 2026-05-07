const express = require('express');
const crypto = require('crypto');
const { verifyFirebaseToken } = require('./middleware/auth');
const { rateLimiters } = require('./security');
const { fail } = require('./middleware/error-response');
const AIService = require('./ai-service');

const router = express.Router();
const aiService = new AIService();

function correlationId(req) {
  return req.requestId || crypto.randomUUID();
}

async function generateJson({ system, developer, user }) {
  const raw = await aiService.callJsonChatCompletion({
    system,
    developer,
    user,
    responseFormat: 'json_object',
    temperature: 0.3
  });
  return JSON.parse(raw || '{}');
}

router.post('/mockup/analyze-screens', verifyFirebaseToken, rateLimiters.generation, async (req, res) => {
  const cid = correlationId(req);
  try {
    const { overview, design, technical } = req.body || {};
    if (!overview || !design) {
      return fail(res, 'BAD_REQUEST', 'overview and design are required', 400, { correlationId: cid });
    }

    const data = await generateJson({
      system: 'You identify UI screens for product mockups.',
      developer: 'Return JSON with key "screens" array. Each item: {name,deviceType,description,priority}.',
      user: `Overview:\n${overview}\n\nDesign:\n${design}\n\nTechnical:\n${technical || ''}`
    });

    return res.json({
      screens: Array.isArray(data.screens) ? data.screens : [],
      correlationId: cid,
      meta: { source: 'express-auxiliary' }
    });
  } catch (error) {
    return fail(res, 'MOCKUP_ANALYZE_FAILED', error.message || 'Failed to analyze screens', 500, { correlationId: cid });
  }
});

router.post('/mockup/generate-single', verifyFirebaseToken, rateLimiters.generation, async (req, res) => {
  const cid = correlationId(req);
  try {
    const { overview, design, technical, screen, useMockData } = req.body || {};
    if (!overview || !design || !screen) {
      return fail(res, 'BAD_REQUEST', 'overview, design and screen are required', 400, { correlationId: cid });
    }

    const data = await generateJson({
      system: 'You generate a single HTML mockup screen.',
      developer: 'Return JSON with key "mockup": {screenName, deviceType, html, notes}. html must be full standalone snippet.',
      user: `Overview:\n${overview}\n\nDesign:\n${design}\n\nTechnical:\n${technical || ''}\n\nScreen:\n${JSON.stringify(screen)}\n\nUse mock data: ${!!useMockData}`
    });

    return res.json({
      mockup: data.mockup || null,
      correlationId: cid,
      meta: { source: 'express-auxiliary' }
    });
  } catch (error) {
    return fail(res, 'MOCKUP_GENERATE_FAILED', error.message || 'Failed to generate mockup', 500, { correlationId: cid });
  }
});

router.post('/prompts/generate', verifyFirebaseToken, rateLimiters.generation, async (req, res) => {
  const cid = correlationId(req);
  try {
    const { prompt, stage } = req.body || {};
    if (!prompt || !prompt.user) {
      return fail(res, 'BAD_REQUEST', 'prompt.user is required', 400, { correlationId: cid });
    }

    const data = await generateJson({
      system: prompt.system || 'You generate structured product prompts.',
      developer: `${prompt.developer || ''}\nReturn valid JSON compatible with the current frontend flow.`,
      user: prompt.user
    });

    return res.json({ ...data, stage, correlationId: cid });
  } catch (error) {
    return fail(res, 'PROMPT_GENERATE_FAILED', error.message || 'Failed to generate prompt', 500, { correlationId: cid });
  }
});

router.post('/prompts/fix-diagram', verifyFirebaseToken, rateLimiters.generation, async (req, res) => {
  const cid = correlationId(req);
  try {
    const { brokenCode, diagramType, overview, technicalSpec } = req.body || {};
    if (!brokenCode) {
      return fail(res, 'BAD_REQUEST', 'brokenCode is required', 400, { correlationId: cid });
    }

    const data = await generateJson({
      system: 'You repair Mermaid diagrams.',
      developer: 'Return JSON: { correctedCode: string } and only Mermaid syntax in correctedCode.',
      user: `Diagram type: ${diagramType || 'generic'}\nBroken code:\n${brokenCode}\n\nOverview:\n${overview || ''}\n\nTechnical:\n${technicalSpec || ''}`
    });

    return res.json({ correctedCode: data.correctedCode || '', correlationId: cid });
  } catch (error) {
    return fail(res, 'DIAGRAM_FIX_FAILED', error.message || 'Failed to fix diagram', 500, { correlationId: cid });
  }
});

router.post('/mindmap/generate', verifyFirebaseToken, rateLimiters.generation, async (req, res) => {
  const cid = correlationId(req);
  try {
    const { overview, technical } = req.body || {};
    if (!overview || !technical) {
      return fail(res, 'BAD_REQUEST', 'overview and technical are required', 400, { correlationId: cid });
    }

    const data = await generateJson({
      system: 'You generate a mind map JSON object.',
      developer: 'Return JSON with key "mindMap" in MindElixir-compatible structure.',
      user: `Overview:\n${overview}\n\nTechnical:\n${technical}`
    });

    return res.json({ mindMap: data.mindMap || data, correlationId: cid });
  } catch (error) {
    return fail(res, 'MINDMAP_GENERATE_FAILED', error.message || 'Failed to generate mind map', 500, { correlationId: cid });
  }
});

router.post('/jira/export', verifyFirebaseToken, rateLimiters.generation, async (req, res) => {
  const cid = correlationId(req);
  try {
    const { spec, projectKey, priority, labels } = req.body || {};
    if (!spec || !projectKey) {
      return fail(res, 'BAD_REQUEST', 'spec and projectKey are required', 400, { correlationId: cid });
    }

    const data = await generateJson({
      system: 'You convert product specs into Jira issue CSV rows.',
      developer: 'Return JSON: { csv: string }. csv must include header row compatible with Jira CSV import.',
      user: `Project key: ${projectKey}\nPriority: ${priority || 'High'}\nLabels: ${(labels || []).join(',')}\nSpec:\n${JSON.stringify(spec)}`
    });

    return res.json({ success: true, csv: data.csv || '', correlationId: cid });
  } catch (error) {
    return fail(res, 'JIRA_EXPORT_FAILED', error.message || 'Failed to generate Jira export', 500, { correlationId: cid });
  }
});

module.exports = router;
