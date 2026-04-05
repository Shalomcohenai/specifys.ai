const express = require('express');
const multer = require('multer');
const router = express.Router();
const { auth } = require('./firebase-admin');
const { createError, ERROR_CODES, asyncHandler } = require('./error-handler');
const { logger } = require('./logger');
const { rateLimiters } = require('./security');

let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  fetch = require('node-fetch');
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_INSTRUCTION_LENGTH = 2000;

const uploadMw = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype && /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    if (!ok) {
      return cb(new Error('PLANNING_INVALID_IMAGE_TYPE'));
    }
    cb(null, true);
  }
}).single('image');

async function verifyFirebaseToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(createError('No valid authorization header', ERROR_CODES.UNAUTHORIZED, 401));
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    logger.warn({ path: req.path, message: error.message }, '[planning-routes] Token verification failed');
    next(createError('Invalid token', ERROR_CODES.INVALID_TOKEN, 401));
  }
}

function runUpload(req, res, next) {
  uploadMw(req, res, (err) => {
    if (err) {
      if (err.message === 'PLANNING_INVALID_IMAGE_TYPE') {
        return next(createError('Only JPEG, PNG, GIF, or WebP images are allowed', ERROR_CODES.INVALID_INPUT, 400));
      }
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(createError('Image must be 5MB or smaller', ERROR_CODES.INVALID_INPUT, 400));
      }
      return next(err);
    }
    next();
  });
}

const VISION_SYSTEM_PROMPT = `You are a senior product designer and business analyst. The user uploads a UI screenshot and a short instruction (any language).

Your task:
1) Examine the screenshot: layout, screen type (e.g. dashboard, settings, landing), main components (cards, tables, charts, nav, forms), data visualizations, hierarchy, spacing, and identifiable typography.
2) Identify colors concretely (e.g. primary orange #..., dark background, accent colors). If exact hex is unclear, describe precisely (e.g. "vibrant orange headers on near-black panels").
3) Combine this visual analysis with the user's instruction into ONE cohesive English paragraph (or 2–4 short paragraphs if needed) that can be pasted into an app specification / PRD.
4) Write in clear, imperative spec language (e.g. "Include a dashboard that…", "Use…", "Show…"). Be detailed and actionable.
5) Output plain text only — no markdown, no bullet labels, no JSON.`;

/**
 * POST /api/planning/analyze-screenshot
 * multipart: image (file), userInstruction (string)
 */
router.post(
  '/analyze-screenshot',
  rateLimiters.general,
  verifyFirebaseToken,
  runUpload,
  asyncHandler(async (req, res) => {
    const requestId = req.requestId || `plan-shot-${Date.now()}`;
    if (!req.file || !req.file.buffer) {
      throw createError('Image file is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400);
    }

    let userInstruction = (req.body && req.body.userInstruction) || '';
    if (typeof userInstruction !== 'string') {
      userInstruction = String(userInstruction || '');
    }
    userInstruction = userInstruction.trim();
    if (!userInstruction) {
      throw createError('userInstruction is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400);
    }
    if (userInstruction.length > MAX_INSTRUCTION_LENGTH) {
      throw createError(`userInstruction must be at most ${MAX_INSTRUCTION_LENGTH} characters`, ERROR_CODES.INVALID_INPUT, 400);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw createError('Screenshot analysis is not configured', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 503);
    }

    const base64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/png';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const started = Date.now();
    logger.info({ requestId, userId: req.user?.uid, imageBytes: req.file.size }, '[planning-routes] Vision request start');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1200,
        temperature: 0.4,
        messages: [
          { role: 'system', content: VISION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `User instruction:\n${userInstruction}\n\nProduce the English specification text as described in your system instructions.`
              },
              {
                type: 'image_url',
                image_url: { url: dataUrl, detail: 'high' }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error({ requestId, status: response.status, errText: errText.slice(0, 500) }, '[planning-routes] OpenAI vision error');
      throw createError('Failed to analyze screenshot', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 502, { status: response.status });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw createError('Empty response from vision model', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 502);
    }

    logger.info({ requestId, ms: Date.now() - started, outLen: text.length }, '[planning-routes] Vision request ok');

    res.json({
      success: true,
      description: text
    });
  })
);

module.exports = router;
