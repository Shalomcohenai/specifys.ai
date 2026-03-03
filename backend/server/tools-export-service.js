/**
 * Tools Export Service
 * Exports tools from Firestore to tools/map/tools.json.
 * Firestore is the source of truth; this file is a derived export for static build and fallback.
 */

const fs = require('fs');
const path = require('path');
const { getAllTools } = require('./tools-migration-service');
const { logger } = require('./logger');

const TOOLS_JSON_PATH = path.join(__dirname, '../../tools/map/tools.json');

/**
 * Fields to include in the exported JSON (matches existing tools.json format).
 * Excludes internal fields: migratedAt, lastUpdated, source, createdAt, Firestore doc id.
 */
const EXPORT_FIELDS = ['id', 'name', 'category', 'description', 'link', 'rating', 'pros', 'cons', 'special', 'stats', 'added'];

/**
 * Convert a Firestore tool document to the public JSON shape.
 * @param {Object} tool - Tool from getAllTools()
 * @returns {Object} Tool object for tools.json
 */
function toolToExportShape(tool) {
  const out = {};
  for (const key of EXPORT_FIELDS) {
    if (tool[key] !== undefined && tool[key] !== null) {
      out[key] = tool[key];
    }
  }
  // Ensure id is numeric for compatibility with existing tools.json
  if (typeof out.id !== 'number' && out.id != null) {
    out.id = typeof out.id === 'string' ? parseInt(out.id, 10) || out.id : out.id;
  }
  return out;
}

/**
 * Export all tools from Firestore to tools/map/tools.json.
 * @param {Object} options - Export options
 * @param {boolean} options.dryRun - If true, return the array without writing to disk
 * @returns {Promise<{ success: boolean, count: number, path?: string, error?: string }>}
 */
async function exportToolsToJson(options = {}) {
  const { dryRun = false } = options;
  const requestId = `tools-export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  logger.info({ requestId, dryRun }, '[tools-export] Starting export');

  try {
    const tools = await getAllTools();
    const payload = tools.map(toolToExportShape);

    if (dryRun) {
      logger.info({ requestId, count: payload.length }, '[tools-export] Dry run - no file written');
      return { success: true, count: payload.length, dryRun: true };
    }

    const dir = path.dirname(TOOLS_JSON_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(TOOLS_JSON_PATH, JSON.stringify(payload, null, 2), 'utf8');

    logger.info({ requestId, count: payload.length, path: TOOLS_JSON_PATH }, '[tools-export] Export completed');

    return { success: true, count: payload.length, path: TOOLS_JSON_PATH };
  } catch (error) {
    logger.error({ requestId, error: error.message, stack: error.stack }, '[tools-export] Export failed');
    return {
      success: false,
      count: 0,
      error: error.message
    };
  }
}

module.exports = {
  exportToolsToJson,
  TOOLS_JSON_PATH
};
