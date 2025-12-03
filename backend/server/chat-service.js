/**
 * Chat Service
 * Centralized service for managing chat-related operations
 * Handles Assistant creation, Vector Store management, and spec uploads
 */

const { db, admin } = require('./firebase-admin');
const { logger } = require('./logger');
const { retryWithBackoff, shouldRecreateAssistant, isRetryableError } = require('./retry-handler');

class ChatService {
  constructor(openaiStorage) {
    if (!openaiStorage) {
      throw new Error('OpenAIStorageService is required');
    }
    this.openaiStorage = openaiStorage;
    // In-memory cache for Assistant IDs (key: specId, value: assistantId)
    this.assistantCache = new Map();
    // In-memory cache for Thread IDs (key: `${specId}_${userId}`, value: threadId)
    this.threadCache = new Map();
  }

  /**
   * Verify spec ownership
   * @param {string} specId - Spec ID
   * @param {string} userId - User ID
   * @returns {Promise<object>} Spec document data
   * @throws {Error} If spec not found or user doesn't own it
   */
  async verifySpecOwnership(specId, userId) {
    const specDoc = await db.collection('specs').doc(specId).get();
    if (!specDoc.exists) {
      throw new Error('Spec not found');
    }
    const specData = specDoc.data();
    if (specData.userId !== userId) {
      throw new Error('Unauthorized: User does not own this spec');
    }
    return specData;
  }

  /**
   * Ensure spec is uploaded to OpenAI
   * @param {string} specId - Spec ID
   * @param {object} specData - Spec data
   * @param {string} requestId - Request ID for logging
   * @returns {Promise<string>} File ID
   */
  async ensureSpecUploaded(specId, specData, requestId) {
    // Check if spec needs to be uploaded or re-uploaded
    const uploadTimestamp = specData.openaiUploadTimestamp?.toMillis ? specData.openaiUploadTimestamp.toMillis() : 0;
    const specUpdatedTimestamp = specData.updatedAt?.toMillis ? specData.updatedAt.toMillis() : 0;
    const needsReupload = specData.openaiFileId && (specUpdatedTimestamp > uploadTimestamp);

    if (!specData.openaiFileId || needsReupload) {
      logger.debug({ requestId, specId, needsReupload }, '[chat-service] Uploading or re-uploading spec to OpenAI');

      // Delete old file if re-uploading
      if (needsReupload && specData.openaiFileId) {
        try {
          await this.openaiStorage.deleteFile(specData.openaiFileId);
          logger.debug({ requestId, specId, oldFileId: specData.openaiFileId }, '[chat-service] Deleted old OpenAI file');
        } catch (deleteError) {
          logger.warn({ requestId, specId, error: deleteError.message }, '[chat-service] Failed to delete old file, continuing');
        }

        // Delete old assistant if exists (will be recreated)
        if (specData.openaiAssistantId) {
          try {
            await this.openaiStorage.deleteAssistant(specData.openaiAssistantId);
            this.assistantCache.delete(specId); // Clear cache
            logger.debug({ requestId, specId, oldAssistantId: specData.openaiAssistantId }, '[chat-service] Deleted old assistant');
          } catch (deleteError) {
            logger.warn({ requestId, specId, error: deleteError.message }, '[chat-service] Failed to delete old assistant, continuing');
          }

          // Clear assistant ID from Firebase
          await db.collection('specs').doc(specId).update({
            openaiAssistantId: admin.firestore.FieldValue.delete()
          });
        }
      }

      // Upload spec with retry
      const fileId = await retryWithBackoff(
        () => this.openaiStorage.uploadSpec(specId, specData),
        {
          operationName: 'uploadSpec',
          maxRetries: 3,
          initialDelay: 1000
        }
      );

      // Update Firebase
      await db.collection('specs').doc(specId).update({
        openaiFileId: fileId,
        uploadedToOpenAI: true,
        openaiUploadTimestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      logger.info({ requestId, specId, fileId }, '[chat-service] Spec uploaded to OpenAI');
      return fileId;
    }

    return specData.openaiFileId;
  }

  /**
   * Get or create Assistant for a spec
   * @param {string} specId - Spec ID
   * @param {string} fileId - OpenAI File ID
   * @param {string} requestId - Request ID for logging
   * @returns {Promise<string>} Assistant ID
   */
  async getOrCreateAssistant(specId, fileId, requestId) {
    // Check cache first
    if (this.assistantCache.has(specId)) {
      const cachedAssistantId = this.assistantCache.get(specId);
      logger.debug({ requestId, specId, assistantId: cachedAssistantId }, '[chat-service] Using cached assistant ID');
      
      // Verify assistant still exists and has vector store
      try {
        const assistant = await this.openaiStorage.getAssistant(cachedAssistantId);
        const hasVectorStore = assistant.tool_resources?.file_search?.vector_store_ids?.length > 0;
        if (hasVectorStore) {
          return cachedAssistantId;
        }
        // If no vector store, fall through to recreation
        logger.warn({ requestId, specId, assistantId: cachedAssistantId }, '[chat-service] Cached assistant missing vector store, recreating');
      } catch (error) {
        // Assistant doesn't exist, clear cache and recreate
        logger.warn({ requestId, specId, assistantId: cachedAssistantId, error: error.message }, '[chat-service] Cached assistant not found, recreating');
        this.assistantCache.delete(specId);
      }
    }

    // Get from Firebase
    const specDoc = await db.collection('specs').doc(specId).get();
    const specData = specDoc.data();
    let assistantId = specData?.openaiAssistantId;

    if (assistantId) {
      // Verify assistant has vector store
      try {
        const verifiedAssistant = await this.openaiStorage.ensureAssistantHasVectorStore(assistantId, fileId);
        const hasVectorStore = verifiedAssistant.tool_resources?.file_search?.vector_store_ids?.length > 0;
        
        if (hasVectorStore) {
          this.assistantCache.set(specId, assistantId);
          logger.debug({ requestId, specId, assistantId }, '[chat-service] Using existing assistant with vector store');
          return assistantId;
        }
        
        // No vector store, need to recreate
        logger.warn({ requestId, specId, assistantId }, '[chat-service] Assistant missing vector store, recreating');
      } catch (error) {
        logger.warn({ requestId, specId, assistantId, error: error.message }, '[chat-service] Failed to ensure vector store, recreating assistant');
      }

      // Delete old assistant
      try {
        await this.openaiStorage.deleteAssistant(assistantId);
      } catch (deleteError) {
        logger.warn({ requestId, specId, assistantId, error: deleteError.message }, '[chat-service] Failed to delete old assistant, continuing');
      }
    }

    // Create new assistant with retry
    logger.info({ requestId, specId }, '[chat-service] Creating new assistant');
    const assistant = await retryWithBackoff(
      () => this.openaiStorage.createAssistant(specId, fileId),
      {
        operationName: 'createAssistant',
        maxRetries: 3,
        initialDelay: 2000
      }
    );

    assistantId = assistant.id;

    // Save to Firebase
    await db.collection('specs').doc(specId).update({
      openaiAssistantId: assistantId
    });

    // Update cache
    this.assistantCache.set(specId, assistantId);

    logger.info({ requestId, specId, assistantId }, '[chat-service] Assistant created and cached');
    return assistantId;
  }

  /**
   * Ensure spec is ready for chat (uploaded, assistant exists with vector store)
   * @param {string} specId - Spec ID
   * @param {string} userId - User ID
   * @param {string} requestId - Request ID for logging
   * @returns {Promise<{fileId: string, assistantId: string}>}
   */
  async ensureSpecReadyForChat(specId, userId, requestId) {
    // Verify ownership
    const specData = await this.verifySpecOwnership(specId, userId);

    // Ensure spec is uploaded
    const fileId = await this.ensureSpecUploaded(specId, specData, requestId);

    // Get or create assistant
    const assistantId = await this.getOrCreateAssistant(specId, fileId, requestId);

    return { fileId, assistantId };
  }

  /**
   * Handle Assistant error and recreate if needed
   * @param {Error} error - The error that occurred
   * @param {string} specId - Spec ID
   * @param {string} userId - User ID
   * @param {string} fileId - OpenAI File ID
   * @param {string} requestId - Request ID for logging
   * @returns {Promise<string|null>} New Assistant ID if recreated, null otherwise
   */
  async handleAssistantError(error, specId, userId, fileId, requestId) {
    if (!shouldRecreateAssistant(error)) {
      return null;
    }

    logger.warn({ requestId, specId, error: error.message }, '[chat-service] Assistant error detected, recreating');

    try {
      // Verify ownership
      await this.verifySpecOwnership(specId, userId);

      // Get current assistant ID
      const specDoc = await db.collection('specs').doc(specId).get();
      const specData = specDoc.data();
      const oldAssistantId = specData?.openaiAssistantId;

      if (oldAssistantId) {
        // Delete old assistant
        try {
          await this.openaiStorage.deleteAssistant(oldAssistantId);
          this.assistantCache.delete(specId); // Clear cache
          logger.debug({ requestId, specId, oldAssistantId }, '[chat-service] Deleted corrupted assistant');
          
          // Wait for deletion to propagate
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (deleteError) {
          logger.warn({ requestId, specId, error: deleteError.message }, '[chat-service] Failed to delete old assistant, continuing');
        }
      }

      // Create new assistant
      const newAssistant = await retryWithBackoff(
        () => this.openaiStorage.createAssistant(specId, fileId),
        {
          operationName: 'recreateAssistant',
          maxRetries: 3,
          initialDelay: 2000
        }
      );

      const newAssistantId = newAssistant.id;

      // Ensure vector store is configured
      await this.openaiStorage.ensureAssistantHasVectorStore(newAssistantId, fileId);

      // Wait for configuration to propagate
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Update Firebase
      await db.collection('specs').doc(specId).update({
        openaiAssistantId: newAssistantId
      });

      // Update cache
      this.assistantCache.set(specId, newAssistantId);

      logger.info({ requestId, specId, newAssistantId }, '[chat-service] Assistant recreated successfully');
      return newAssistantId;
    } catch (recreateError) {
      logger.error({ requestId, specId, error: recreateError.message }, '[chat-service] Failed to recreate assistant');
      throw new Error(`Failed to recreate assistant: ${recreateError.message}`);
    }
  }

  /**
   * Create a new thread for chat
   * @param {string} specId - Spec ID
   * @param {string} userId - User ID
   * @param {string} requestId - Request ID for logging
   * @returns {Promise<string>} Thread ID
   */
  async createThread(specId, userId, requestId) {
    const cacheKey = `${specId}_${userId}`;
    
    // Check cache (threads are per-user, so we can cache them)
    // Note: In production, you might want to limit thread cache size or use TTL
    if (this.threadCache.has(cacheKey)) {
      logger.debug({ requestId, specId, userId, threadId: this.threadCache.get(cacheKey) }, '[chat-service] Using cached thread ID');
      return this.threadCache.get(cacheKey);
    }

    const thread = await retryWithBackoff(
      () => this.openaiStorage.createThread(),
      {
        operationName: 'createThread',
        maxRetries: 2,
        initialDelay: 500
      }
    );

    const threadId = thread.id;
    this.threadCache.set(cacheKey, threadId);

    logger.debug({ requestId, specId, userId, threadId }, '[chat-service] Thread created and cached');
    return threadId;
  }

  /**
   * Clear cache for a spec (useful when spec is updated or assistant is deleted)
   * @param {string} specId - Spec ID
   */
  clearCache(specId) {
    this.assistantCache.delete(specId);
    // Clear all thread caches for this spec
    for (const key of this.threadCache.keys()) {
      if (key.startsWith(`${specId}_`)) {
        this.threadCache.delete(key);
      }
    }
    logger.debug({ specId }, '[chat-service] Cache cleared for spec');
  }

  /**
   * Clear all caches (useful for testing or maintenance)
   */
  clearAllCaches() {
    this.assistantCache.clear();
    this.threadCache.clear();
    logger.debug('[chat-service] All caches cleared');
  }
}

module.exports = ChatService;

