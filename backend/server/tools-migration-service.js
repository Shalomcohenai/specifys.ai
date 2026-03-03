/**
 * Tools Migration Service
 * Migrates tools from JSON file to Firestore.
 * Source of truth: Firestore (collection `tools`). The file tools/map/tools.json
 * is a derived export only; use tools-export-service to sync Firestore → JSON.
 */

const fs = require('fs');
const path = require('path');
const { db, admin } = require('./firebase-admin');
const { logger } = require('./logger');

const TOOLS_COLLECTION = 'tools';
const TOOLS_JSON_PATH = path.join(__dirname, '../../tools/map/tools.json');

/**
 * Validate tool data structure
 * @param {Object} tool - Tool object
 * @returns {Object} Validation result
 */
function validateTool(tool) {
  const errors = [];
  
  if (!tool.name || typeof tool.name !== 'string' || tool.name.trim() === '') {
    errors.push('name is required and must be a non-empty string');
  }
  
  if (!tool.category || typeof tool.category !== 'string' || tool.category.trim() === '') {
    errors.push('category is required and must be a non-empty string');
  }
  
  if (!tool.description || typeof tool.description !== 'string' || tool.description.trim() === '') {
    errors.push('description is required and must be a non-empty string');
  }
  
  if (!tool.link || typeof tool.link !== 'string' || tool.link.trim() === '') {
    errors.push('link is required and must be a non-empty string');
  }
  
  // Validate URL format
  try {
    new URL(tool.link);
  } catch (e) {
    errors.push('link must be a valid URL');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Normalize tool data for Firestore
 * @param {Object} tool - Tool object from JSON
 * @param {number} index - Tool index
 * @returns {Object} Normalized tool data
 */
function normalizeTool(tool, index) {
  return {
    // Original fields
    id: tool.id || index + 1,
    name: tool.name.trim(),
    category: tool.category.trim(),
    description: tool.description.trim(),
    link: tool.link.trim(),
    rating: tool.rating || null,
    pros: Array.isArray(tool.pros) ? tool.pros : [],
    cons: Array.isArray(tool.cons) ? tool.cons : [],
    special: tool.special || null,
    stats: tool.stats || null,
    added: tool.added || null,
    
    // Migration metadata
    migratedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    source: 'json_migration'
  };
}

/**
 * Check if tool already exists in Firestore
 * @param {string} name - Tool name
 * @param {string} link - Tool link
 * @returns {Promise<Object|null>} Existing tool document or null
 */
async function findExistingTool(name, link) {
  try {
    // Check by name
    const byNameSnapshot = await db.collection(TOOLS_COLLECTION)
      .where('name', '==', name)
      .limit(1)
      .get();
    
    if (!byNameSnapshot.empty) {
      return byNameSnapshot.docs[0];
    }
    
    // Check by link
    const byLinkSnapshot = await db.collection(TOOLS_COLLECTION)
      .where('link', '==', link)
      .limit(1)
      .get();
    
    if (!byLinkSnapshot.empty) {
      return byLinkSnapshot.docs[0];
    }
    
    return null;
  } catch (error) {
    logger.error({ error: error.message, name, link }, '[tools-migration] Error checking existing tool');
    return null;
  }
}

/**
 * Migrate tools from JSON to Firestore
 * @param {Object} options - Migration options
 * @param {boolean} options.dryRun - If true, don't save to Firestore
 * @param {boolean} options.skipExisting - If true, skip tools that already exist
 * @returns {Promise<Object>} Migration result
 */
async function migrateTools(options = {}) {
  const { dryRun = false, skipExisting = true } = options;
  const requestId = `migration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  logger.info({ requestId, dryRun, skipExisting }, '[tools-migration] Starting tools migration');
  
  try {
    // Read JSON file
    if (!fs.existsSync(TOOLS_JSON_PATH)) {
      throw new Error(`Tools JSON file not found: ${TOOLS_JSON_PATH}`);
    }
    
    const jsonContent = fs.readFileSync(TOOLS_JSON_PATH, 'utf8');
    const tools = JSON.parse(jsonContent);
    
    if (!Array.isArray(tools)) {
      throw new Error('Tools JSON must be an array');
    }
    
    logger.info({ requestId, toolCount: tools.length }, '[tools-migration] Loaded tools from JSON');
    
    const results = {
      total: tools.length,
      validated: 0,
      skipped: 0,
      created: 0,
      updated: 0,
      errors: []
    };
    
    // Process each tool
    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      const toolIndex = i + 1;
      
      try {
        // Validate tool
        const validation = validateTool(tool);
        
        if (!validation.valid) {
          results.errors.push({
            index: toolIndex,
            name: tool.name || 'Unknown',
            errors: validation.errors
          });
          logger.warn({ requestId, index: toolIndex, name: tool.name, errors: validation.errors }, '[tools-migration] Tool validation failed');
          continue;
        }
        
        results.validated++;
        
        // Normalize tool data
        const normalizedTool = normalizeTool(tool, i);
        
        // Check if tool already exists
        if (skipExisting) {
          const existing = await findExistingTool(normalizedTool.name, normalizedTool.link);
          
          if (existing) {
            results.skipped++;
            logger.debug({ requestId, index: toolIndex, name: normalizedTool.name, existingId: existing.id }, '[tools-migration] Tool already exists, skipping');
            continue;
          }
        }
        
        // Save to Firestore (unless dry run)
        if (!dryRun) {
          // Check again right before saving (race condition protection)
          const existing = await findExistingTool(normalizedTool.name, normalizedTool.link);
          
          if (existing) {
            // Update existing tool
            await existing.ref.update({
              ...normalizedTool,
              lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
              source: 'json_migration'
            });
            results.updated++;
            logger.info({ requestId, index: toolIndex, name: normalizedTool.name, id: existing.id }, '[tools-migration] Tool updated');
          } else {
            // Create new tool
            const docRef = await db.collection(TOOLS_COLLECTION).add(normalizedTool);
            results.created++;
            logger.info({ requestId, index: toolIndex, name: normalizedTool.name, id: docRef.id }, '[tools-migration] Tool created');
          }
        } else {
          // Dry run - just count
          results.created++;
          logger.debug({ requestId, index: toolIndex, name: normalizedTool.name }, '[tools-migration] Tool would be created (dry run)');
        }
      } catch (error) {
        results.errors.push({
          index: toolIndex,
          name: tool.name || 'Unknown',
          error: error.message
        });
        logger.error({ requestId, index: toolIndex, name: tool.name, error: error.message }, '[tools-migration] Error processing tool');
      }
    }
    
    logger.info({ 
      requestId, 
      results,
      dryRun 
    }, '[tools-migration] Migration completed');
    
    return {
      success: true,
      requestId,
      results,
      dryRun
    };
  } catch (error) {
    logger.error({ 
      requestId, 
      error: { 
        message: error.message, 
        stack: error.stack 
      } 
    }, '[tools-migration] Migration failed');
    
    return {
      success: false,
      requestId,
      error: {
        message: error.message,
        stack: error.stack
      }
    };
  }
}

/**
 * Get all tools from Firestore
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of tools
 */
async function getAllTools(options = {}) {
  const { category = null, limit = null } = options;
  const requestId = `get-tools-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    let query = db.collection(TOOLS_COLLECTION);
    
    if (category) {
      query = query.where('category', '==', category);
    }
    
    query = query.orderBy('id', 'asc');
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const snapshot = await query.get();
    
    const tools = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        migratedAt: data.migratedAt?.toDate ? data.migratedAt.toDate() : data.migratedAt,
        lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate() : data.lastUpdated
      };
    });
    
    logger.debug({ requestId, count: tools.length, category }, '[tools-migration] Retrieved tools from Firestore');
    
    return tools;
  } catch (error) {
    logger.error({ requestId, error: error.message }, '[tools-migration] Error retrieving tools');
    throw error;
  }
}

/**
 * Get tool by ID
 * @param {string} toolId - Tool document ID
 * @returns {Promise<Object|null>} Tool object or null
 */
async function getToolById(toolId) {
  const requestId = `get-tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const doc = await db.collection(TOOLS_COLLECTION).doc(toolId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      migratedAt: data.migratedAt?.toDate ? data.migratedAt.toDate() : data.migratedAt,
      lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate() : data.lastUpdated
    };
  } catch (error) {
    logger.error({ requestId, toolId, error: error.message }, '[tools-migration] Error retrieving tool');
    throw error;
  }
}

module.exports = {
  migrateTools,
  getAllTools,
  getToolById,
  validateTool,
  normalizeTool,
  TOOLS_COLLECTION
};

