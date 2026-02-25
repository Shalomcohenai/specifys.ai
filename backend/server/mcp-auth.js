/**
 * MCP API Key authentication for /api/mcp/* routes.
 * Resolves API Key to req.user.uid so MCP routes can use the same ownership checks as Firebase routes.
 */

const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');

const ALLOWED_KEYS = new Set(['overview', 'technical', 'design', 'market', 'title']);
const MAX_FIELD_SIZE = 1024 * 1024; // 1MB per field

/**
 * Get API key from request: Authorization Bearer or X-API-Key header.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function getApiKeyFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const key = authHeader.slice(7).trim();
    if (key) return key;
  }
  const xKey = req.headers['x-api-key'];
  if (xKey && typeof xKey === 'string' && xKey.trim()) return xKey.trim();
  return null;
}

/**
 * Middleware: verify MCP API Key and set req.user.uid.
 * Supports env-based keys: MCP_API_KEY -> MCP_API_USER_ID.
 * Does not verify Firebase token; this is for /api/mcp only.
 */
async function verifyApiKey(req, res, next) {
  const requestId = req.requestId || `mcp-auth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const key = getApiKeyFromRequest(req);

  if (!key) {
    logger.warn({ requestId, path: req.path }, '[mcp-auth] Missing API key');
    return next(createError('API key required. Use Authorization: Bearer <key> or X-API-Key: <key>', ERROR_CODES.UNAUTHORIZED, 401));
  }

  try {
    // Env-based: single key mapped to one user (development / single-user)
    const envKey = process.env.MCP_API_KEY;
    const envUserId = process.env.MCP_API_USER_ID;
    if (envKey && envUserId && key === envKey) {
      req.user = { uid: envUserId };
      logger.debug({ requestId, path: req.path }, '[mcp-auth] API key validated (env)');
      return next();
    }

    // Firestore: lookup user by mcpApiKey (optional)
    const { db } = require('./firebase-admin');
    const usersSnap = await db.collection('users')
      .where('mcpApiKey', '==', key)
      .limit(1)
      .get();

    if (!usersSnap.empty) {
      const uid = usersSnap.docs[0].id;
      req.user = { uid };
      logger.debug({ requestId, path: req.path, uid }, '[mcp-auth] API key validated (Firestore)');
      return next();
    }

    logger.warn({ requestId, path: req.path, keyPrefix: key.slice(0, 8) + '...' }, '[mcp-auth] Invalid API key');
    return next(createError('Invalid API key', ERROR_CODES.INVALID_TOKEN, 401));
  } catch (err) {
    logger.error({ requestId, error: err.message, path: req.path }, '[mcp-auth] Error verifying API key');
    return next(createError('Authentication failed', ERROR_CODES.INTERNAL_ERROR, 500, { details: err.message }));
  }
}

/**
 * Build update payload for PUT /api/mcp/specs/:id from body.
 * Only allows overview, technical, design, market, title. Validates types and size.
 * @param {object} body - req.body
 * @returns {{ updateData: object, error?: string }}
 */
function buildSpecUpdatePayload(body) {
  const updateData = {};
  if (!body || typeof body !== 'object') return { updateData };

  for (const field of ALLOWED_KEYS) {
    if (!(field in body)) continue;
    const value = body[field];
    if (value === null || value === undefined) continue;
    if (typeof value !== 'string') return { updateData, error: `Field "${field}" must be a string` };
    if (value.length > MAX_FIELD_SIZE) return { updateData, error: `Field "${field}" exceeds max size (1MB)` };
    updateData[field] = value;
  }

  return { updateData };
}

module.exports = {
  verifyApiKey,
  getApiKeyFromRequest,
  buildSpecUpdatePayload,
  ALLOWED_KEYS,
  MAX_FIELD_SIZE
};
