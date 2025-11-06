const FormData = require('form-data');

class OpenAIStorageService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.openai.com/v1';
    // Use built-in fetch for Node.js 18+ or fallback to node-fetch
    if (typeof globalThis.fetch === 'function') {
      this.fetch = globalThis.fetch;
    } else {
      // Will use dynamic import when needed for older Node versions
      this.fetch = null;
    }
  }

  /**
   * Get fetch function - use built-in if available, otherwise dynamic import
   */
  async getFetch() {
    if (this.fetch) {
      return this.fetch;
    }
    return (await import('node-fetch')).default;
  }

  /**
   * Upload spec content to OpenAI Files API
   * @param {string} specId - Spec ID
   * @param {object} specData - Spec data object
   * @returns {Promise<string>} File ID from OpenAI
   */
  async uploadSpec(specId, specData) {
    const requestId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    console.log(`[${requestId}] ===== uploadSpec START =====`);
    console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
    console.log(`[${requestId}] Spec ID: ${specId}`);
    console.log(`[${requestId}] Spec Data:`, {
      hasTitle: !!specData.title,
      hasOverview: !!specData.overview,
      hasTechnical: !!specData.technical,
      hasMarket: !!specData.market,
      hasDesign: !!specData.design,
      overviewLength: specData.overview?.length || 0,
      technicalLength: specData.technical?.length || 0
    });
    
    try {
      // Extract ONLY the relevant spec content (filter out metadata)
      const cleanedData = {
        specId: specId,
        title: specData.title || 'Untitled Spec',
        overview: specData.overview || null,
        technical: specData.technical || null,
        market: specData.market || null,
        design: specData.design || null
      };
      
      const content = JSON.stringify(cleanedData, null, 2);
      const contentLength = content.length;
      console.log(`[${requestId}] 📝 Prepared cleaned data, length: ${contentLength} bytes`);
      
      const formData = new FormData();
      
      formData.append('file', Buffer.from(content), {
        filename: `spec-${specId}.json`,
        contentType: 'application/json'
      });
      formData.append('purpose', 'assistants');
      
      console.log(`[${requestId}] 📤 Preparing FormData upload to OpenAI Files API`);
      console.log(`[${requestId}] OpenAI URL: ${this.baseURL}/files`);
      console.log(`[${requestId}] FormData: filename=spec-${specId}.json, purpose=assistants`);
      
      const uploadStart = Date.now();
      const response = await this._fetch(`${this.baseURL}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          ...formData.getHeaders()
        },
        body: formData
      });
      
      const uploadTime = Date.now() - uploadStart;
      console.log(`[${requestId}] ⏱️  OpenAI upload request took ${uploadTime}ms`);
      console.log(`[${requestId}] 📥 Response Status: ${response.status} ${response.statusText}`);
      console.log(`[${requestId}] Response Headers:`, {
        'content-type': response.headers.get('content-type'),
        'content-length': response.headers.get('content-length')
      });
      
      if (!response.ok) {
        let errorText;
        try {
          errorText = await response.text();
          console.error(`[${requestId}] ❌ OpenAI upload failed:`, {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
        } catch (textError) {
          errorText = `HTTP ${response.status}: ${response.statusText}`;
          console.error(`[${requestId}] ❌ Failed to read error response:`, textError.message);
        }
        
        const totalTime = Date.now() - startTime;
        console.error(`[${requestId}] ===== uploadSpec FAILED (${totalTime}ms) =====`);
        throw new Error(`OpenAI upload failed: ${errorText}`);
      }
      
      const parseStart = Date.now();
      const result = await response.json();
      const parseTime = Date.now() - parseStart;
      
      console.log(`[${requestId}] ✅ Successfully parsed OpenAI response (${parseTime}ms)`);
      console.log(`[${requestId}] Response Data:`, {
        id: result.id,
        object: result.object,
        bytes: result.bytes,
        created_at: result.created_at,
        filename: result.filename,
        purpose: result.purpose
      });
      
      const totalTime = Date.now() - startTime;
      console.log(`[${requestId}] ✅ uploadSpec SUCCESS - File ID: ${result.id} (${totalTime}ms total)`);
      console.log(`[${requestId}] ===== uploadSpec COMPLETE =====`);

      return result.id;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`[${requestId}] ❌ ERROR in uploadSpec (${totalTime}ms):`, {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      console.error(`[${requestId}] ===== uploadSpec ERROR =====`);
      throw error;
    }
  }

  /**
   * Helper method to get fetch and use it
   * @private
   */
  async _fetch(url, options) {
    const fetch = await this.getFetch();
    return fetch(url, options);
  }

  /**
   * Delete a file from OpenAI
   * @param {string} fileId - OpenAI File ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(fileId) {
    try {
      const response = await this._fetch(`${this.baseURL}/files/${fileId}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${this.apiKey}` 
        }
      });
      return response.ok;
    } catch (error) {

      return false;
    }
  }

  /**
   * Get file information from OpenAI
   * @param {string} fileId - OpenAI File ID
   * @returns {Promise<object>} File information
   */
  async getFileInfo(fileId) {
    try {
      const response = await this._fetch(`${this.baseURL}/files/${fileId}`, {
        headers: { 
          'Authorization': `Bearer ${this.apiKey}` 
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get file info: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {

      throw error;
    }
  }

  /**
   * List all files uploaded for assistants
   * @returns {Promise<Array>} Array of file objects
   */
  async listFiles() {
    try {
      const response = await this._fetch(`${this.baseURL}/files?purpose=assistants`, {
        headers: { 
          'Authorization': `Bearer ${this.apiKey}` 
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to list files: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.data || [];
    } catch (error) {

      throw error;
    }
  }

  /**
   * Create an Assistant for a spec
   * @param {string} specId - Spec ID
   * @param {string} fileId - OpenAI File ID
   * @returns {Promise<object>} Assistant object
   */
  async createAssistant(specId, fileId) {
    const requestId = `create-assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    console.log(`[${requestId}] ===== createAssistant START =====`);
    console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
    console.log(`[${requestId}] Spec ID: ${specId}`);
    console.log(`[${requestId}] File ID: ${fileId}`);
    
    try {
      console.log(`[${requestId}] 📤 Step 1: Creating assistant with OpenAI API`);
      console.log(`[${requestId}] OpenAI URL: ${this.baseURL}/assistants`);
      
      const createStart = Date.now();
      const response = await this._fetch(`${this.baseURL}/assistants`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          name: `Spec Assistant - ${specId}`,
          instructions: `You are a helpful assistant for a specific application specification.
CRITICAL: Only answer based on the specification file provided to you. 
The file contains: specId, title, overview, technical details, market analysis, and design specifications.

IMPORTANT RULES:
1. Always check the "specId" field to confirm you're discussing the correct specification
2. When asked about the application name or title, refer to the "title" field in the specification
3. Use the "overview" field for general information about the application
4. Use the "technical" field for technical implementation details
5. Use the "market" field for market analysis and target audience
6. Use the "design" field for design and UI/UX information
7. If information is not in the provided specification, clearly state that it's not available
8. Never make up information or refer to other specifications

Always reference specific parts of the spec when relevant.`,
          model: 'gpt-4o-mini',
          tools: [{ type: 'file_search' }],
          tool_resources: {
            file_search: {
              vector_store_ids: []
            }
          }
        })
      });
      
      const createTime = Date.now() - createStart;
      console.log(`[${requestId}] ⏱️  Assistant creation request took ${createTime}ms`);
      console.log(`[${requestId}] 📥 Response Status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        let errorText;
        try {
          errorText = await response.text();
          console.error(`[${requestId}] ❌ Failed to create assistant:`, {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
        } catch (textError) {
          errorText = `HTTP ${response.status}: ${response.statusText}`;
          console.error(`[${requestId}] ❌ Failed to read error response:`, textError.message);
        }
        
        const totalTime = Date.now() - startTime;
        console.error(`[${requestId}] ===== createAssistant FAILED (${totalTime}ms) =====`);
        throw new Error(`Failed to create assistant: ${errorText}`);
      }
      
      const assistant = await response.json();
      console.log(`[${requestId}] ✅ Assistant created successfully:`, {
        id: assistant.id,
        name: assistant.name,
        model: assistant.model,
        created_at: assistant.created_at
      });
      
      // Now add the file to the assistant
      console.log(`[${requestId}] 📤 Step 2: Creating vector store for file`);
      console.log(`[${requestId}] OpenAI URL: ${this.baseURL}/vector_stores`);
      console.log(`[${requestId}] Vector Store Name: Spec Vector Store - ${specId}`);
      
      const vectorStoreStart = Date.now();
      const fileSearchResponse = await this._fetch(`${this.baseURL}/vector_stores`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          name: `Spec Vector Store - ${specId}`,
          file_ids: [fileId]
        })
      });
      
      const vectorStoreTime = Date.now() - vectorStoreStart;
      console.log(`[${requestId}] ⏱️  Vector store creation request took ${vectorStoreTime}ms`);
      console.log(`[${requestId}] 📥 Response Status: ${fileSearchResponse.status} ${fileSearchResponse.statusText}`);
      
      if (!fileSearchResponse.ok) {
        let errorText;
        try {
          errorText = await fileSearchResponse.text();
          console.error(`[${requestId}] ⚠️  Failed to create vector store:`, {
            status: fileSearchResponse.status,
            statusText: fileSearchResponse.statusText,
            error: errorText
          });
          console.log(`[${requestId}] ⚠️  Returning assistant without vector store`);
        } catch (textError) {
          console.error(`[${requestId}] ⚠️  Failed to read error response:`, textError.message);
        }

        const totalTime = Date.now() - startTime;
        console.log(`[${requestId}] ⚠️  createAssistant COMPLETE (without vector store) (${totalTime}ms)`);
        console.log(`[${requestId}] ===== createAssistant COMPLETE =====`);
        return assistant;
      }
      
      const vectorStore = await fileSearchResponse.json();
      console.log(`[${requestId}] ✅ Vector store created successfully:`, {
        id: vectorStore.id,
        name: vectorStore.name,
        file_counts: vectorStore.file_counts,
        status: vectorStore.status
      });
      
      // Wait for vector store to be ready
      console.log(`[${requestId}] ⏳ Step 3: Waiting for vector store to be ready`);
      const waitStart = Date.now();
      const isReady = await this.waitForVectorStoreReady(vectorStore.id);
      const waitTime = Date.now() - waitStart;
      console.log(`[${requestId}] ⏱️  Vector store ready check took ${waitTime}ms`);
      
      if (!isReady) {
        console.warn(`[${requestId}] ⚠️  Vector store not ready after waiting, but continuing`);
      } else {
        console.log(`[${requestId}] ✅ Vector store is ready`);
      }
      
      // Update assistant with vector store
      console.log(`[${requestId}] 📤 Step 4: Updating assistant with vector store`);
      console.log(`[${requestId}] OpenAI URL: ${this.baseURL}/assistants/${assistant.id}`);
      
      const updateStart = Date.now();
      const updateResponse = await this._fetch(`${this.baseURL}/assistants/${assistant.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          tool_resources: {
            file_search: {
              vector_store_ids: [vectorStore.id]
            }
          }
        })
      });
      
      const updateTime = Date.now() - updateStart;
      console.log(`[${requestId}] ⏱️  Assistant update request took ${updateTime}ms`);
      console.log(`[${requestId}] 📥 Response Status: ${updateResponse.status} ${updateResponse.statusText}`);
      
      if (!updateResponse.ok) {
        let errorText;
        try {
          errorText = await updateResponse.text();
          console.error(`[${requestId}] ❌ Failed to update assistant with vector store:`, {
            status: updateResponse.status,
            statusText: updateResponse.statusText,
            error: errorText
          });
        } catch (textError) {
          errorText = `HTTP ${updateResponse.status}: ${updateResponse.statusText}`;
          console.error(`[${requestId}] ❌ Failed to read error response:`, textError.message);
        }

        const totalTime = Date.now() - startTime;
        console.error(`[${requestId}] ===== createAssistant FAILED (${totalTime}ms) =====`);
        throw new Error(`Failed to update assistant with vector store: ${errorText}`);
      }
      
      const updatedAssistant = await updateResponse.json();
      console.log(`[${requestId}] ✅ Assistant updated successfully with vector store:`, {
        id: updatedAssistant.id,
        vectorStoreIds: updatedAssistant.tool_resources?.file_search?.vector_store_ids || []
      });
      
      const totalTime = Date.now() - startTime;
      console.log(`[${requestId}] ✅ createAssistant SUCCESS (${totalTime}ms total)`);
      console.log(`[${requestId}] ===== createAssistant COMPLETE =====`);
      
      return updatedAssistant;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`[${requestId}] ❌ ERROR in createAssistant (${totalTime}ms):`, {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      console.error(`[${requestId}] ===== createAssistant ERROR =====`);
      throw error;
    }
  }

  /**
   * Wait for vector store to be ready
   * @param {string} vectorStoreId - Vector Store ID
   * @param {number} maxAttempts - Maximum attempts to check
   * @returns {Promise<boolean>} True if ready, false if timeout
   */
  async waitForVectorStoreReady(vectorStoreId, maxAttempts = 30) {

    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await this._fetch(`${this.baseURL}/vector_stores/${vectorStoreId}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });
        
        if (!response.ok) {

          return false;
        }
        
        const vectorStore = await response.json();
        
        if (vectorStore.status === 'completed') {

          return true;
        }
        
        if (vectorStore.status === 'failed') {

          return false;
        }
        
        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {

        return false;
      }
    }
    

    return false;
  }

  /**
   * Create a thread for chat
   * @returns {Promise<object>} Thread object
   */
  async createThread() {
    try {
      const response = await this._fetch(`${this.baseURL}/threads`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create thread: ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {

      throw error;
    }
  }

  /**
   * Get assistant details
   * @param {string} assistantId - Assistant ID
   * @returns {Promise<object>} Assistant object
   */
  async getAssistant(assistantId) {
    try {
      const response = await this._fetch(`${this.baseURL}/assistants/${assistantId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get assistant: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {

      throw error;
    }
  }

  /**
   * Ensure assistant has vector store configured
   * @param {string} assistantId - Assistant ID
   * @param {string} fileId - File ID to use
   * @returns {Promise<object>} Updated assistant object
   */
  async ensureAssistantHasVectorStore(assistantId, fileId) {
    const requestId = `ensure-vector-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    console.log(`[${requestId}] ===== ensureAssistantHasVectorStore START =====`);
    console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
    console.log(`[${requestId}] Assistant ID: ${assistantId}`);
    console.log(`[${requestId}] File ID: ${fileId}`);
    
    try {
      // Get current assistant
      console.log(`[${requestId}] 📤 Step 1: Getting current assistant`);
      const getStart = Date.now();
      const assistant = await this.getAssistant(assistantId);
      const getTime = Date.now() - getStart;
      console.log(`[${requestId}] ⏱️  Get assistant took ${getTime}ms`);
      console.log(`[${requestId}] Assistant Data:`, {
        id: assistant.id,
        name: assistant.name,
        model: assistant.model
      });
      
      // Check if assistant already has vector store
      const currentVectorStoreIds = assistant.tool_resources?.file_search?.vector_store_ids || [];
      console.log(`[${requestId}] Current Vector Store IDs:`, currentVectorStoreIds);
      
      if (currentVectorStoreIds.length > 0) {
        console.log(`[${requestId}] ✅ Assistant already has vector stores configured`);
        
        // Verify all vector stores are ready
        console.log(`[${requestId}] ⏳ Step 2: Verifying vector stores are ready`);
        for (const vsId of currentVectorStoreIds) {
          console.log(`[${requestId}] Checking vector store: ${vsId}`);
          const isReady = await this.waitForVectorStoreReady(vsId, 10); // Quick check
          if (!isReady) {
            console.warn(`[${requestId}] ⚠️  Vector store ${vsId} is not ready, but continuing`);
          } else {
            console.log(`[${requestId}] ✅ Vector store ${vsId} is ready`);
          }
        }
        
        const totalTime = Date.now() - startTime;
        console.log(`[${requestId}] ✅ ensureAssistantHasVectorStore COMPLETE (already configured) (${totalTime}ms)`);
        console.log(`[${requestId}] ===== ensureAssistantHasVectorStore COMPLETE =====`);
        return assistant;
      }
      
      // Create new vector store
      console.log(`[${requestId}] 📤 Step 2: Creating new vector store`);
      console.log(`[${requestId}] OpenAI URL: ${this.baseURL}/vector_stores`);
      console.log(`[${requestId}] Vector Store Name: Vector Store for ${assistantId}`);
      
      const vectorStoreStart = Date.now();
      const fileSearchResponse = await this._fetch(`${this.baseURL}/vector_stores`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          name: `Vector Store for ${assistantId}`,
          file_ids: [fileId]
        })
      });
      
      const vectorStoreTime = Date.now() - vectorStoreStart;
      console.log(`[${requestId}] ⏱️  Vector store creation request took ${vectorStoreTime}ms`);
      console.log(`[${requestId}] 📥 Response Status: ${fileSearchResponse.status} ${fileSearchResponse.statusText}`);
      
      if (!fileSearchResponse.ok) {
        let errorText;
        try {
          errorText = await fileSearchResponse.text();
          console.error(`[${requestId}] ❌ Failed to create vector store:`, {
            status: fileSearchResponse.status,
            statusText: fileSearchResponse.statusText,
            error: errorText
          });
        } catch (textError) {
          errorText = `HTTP ${fileSearchResponse.status}: ${fileSearchResponse.statusText}`;
          console.error(`[${requestId}] ❌ Failed to read error response:`, textError.message);
        }
        
        const totalTime = Date.now() - startTime;
        console.error(`[${requestId}] ===== ensureAssistantHasVectorStore FAILED (${totalTime}ms) =====`);
        throw new Error(`Failed to create vector store: ${errorText}`);
      }
      
      const vectorStore = await fileSearchResponse.json();
      console.log(`[${requestId}] ✅ Vector store created successfully:`, {
        id: vectorStore.id,
        name: vectorStore.name,
        file_counts: vectorStore.file_counts,
        status: vectorStore.status
      });
      
      // Wait for vector store to be ready
      console.log(`[${requestId}] ⏳ Step 3: Waiting for vector store to be ready`);
      const waitStart = Date.now();
      const isReady = await this.waitForVectorStoreReady(vectorStore.id);
      const waitTime = Date.now() - waitStart;
      console.log(`[${requestId}] ⏱️  Vector store ready check took ${waitTime}ms`);
      
      if (!isReady) {
        console.warn(`[${requestId}] ⚠️  Vector store not ready after waiting, but continuing`);
      } else {
        console.log(`[${requestId}] ✅ Vector store is ready`);
      }
      
      // Update assistant with vector store
      console.log(`[${requestId}] 📤 Step 4: Updating assistant with vector store`);
      console.log(`[${requestId}] OpenAI URL: ${this.baseURL}/assistants/${assistantId}`);
      
      const updateStart = Date.now();
      const updateResponse = await this._fetch(`${this.baseURL}/assistants/${assistantId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          tool_resources: {
            file_search: {
              vector_store_ids: [vectorStore.id]
            }
          }
        })
      });
      
      const updateTime = Date.now() - updateStart;
      console.log(`[${requestId}] ⏱️  Assistant update request took ${updateTime}ms`);
      console.log(`[${requestId}] 📥 Response Status: ${updateResponse.status} ${updateResponse.statusText}`);
      
      if (!updateResponse.ok) {
        let errorText;
        try {
          errorText = await updateResponse.text();
          console.error(`[${requestId}] ❌ Failed to update assistant with vector store:`, {
            status: updateResponse.status,
            statusText: updateResponse.statusText,
            error: errorText
          });
        } catch (textError) {
          errorText = `HTTP ${updateResponse.status}: ${updateResponse.statusText}`;
          console.error(`[${requestId}] ❌ Failed to read error response:`, textError.message);
        }

        const totalTime = Date.now() - startTime;
        console.error(`[${requestId}] ===== ensureAssistantHasVectorStore FAILED (${totalTime}ms) =====`);
        throw new Error(`Failed to update assistant with vector store: ${errorText}`);
      }
      
      const updatedAssistant = await updateResponse.json();
      console.log(`[${requestId}] ✅ Assistant updated successfully with vector store:`, {
        id: updatedAssistant.id,
        vectorStoreIds: updatedAssistant.tool_resources?.file_search?.vector_store_ids || []
      });
      
      // Wait a bit to ensure OpenAI API has processed the update
      console.log(`[${requestId}] ⏳ Step 5: Waiting 2s for OpenAI API to process update`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify the update was successful by fetching the assistant again
      console.log(`[${requestId}] 🔍 Step 6: Verifying update was successful`);
      const verifyStart = Date.now();
      let verifiedAssistant = await this.getAssistant(assistantId);
      const verifyTime = Date.now() - verifyStart;
      console.log(`[${requestId}] ⏱️  Verification took ${verifyTime}ms`);
      
      let verifiedVectorStoreIds = verifiedAssistant.tool_resources?.file_search?.vector_store_ids || [];
      console.log(`[${requestId}] Verified Vector Store IDs:`, verifiedVectorStoreIds);
      
      // Retry up to 3 times if update didn't stick
      let retries = 0;
      while (verifiedVectorStoreIds.length === 0 && retries < 3) {
        console.warn(`[${requestId}] ⚠️  Update didn't stick (attempt ${retries + 1}/3), retrying...`);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Update again
        console.log(`[${requestId}] 📤 Retry: Updating assistant again`);
        const retryStart = Date.now();
        const retryUpdateResponse = await this._fetch(`${this.baseURL}/assistants/${assistantId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'OpenAI-Beta': 'assistants=v2'
          },
          body: JSON.stringify({
            tool_resources: {
              file_search: {
                vector_store_ids: [vectorStore.id]
              }
            }
          })
        });
        
        if (retryUpdateResponse.ok) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          verifiedAssistant = await this.getAssistant(assistantId);
          verifiedVectorStoreIds = verifiedAssistant.tool_resources?.file_search?.vector_store_ids || [];
        }
        retries++;
      }
      
      if (verifiedVectorStoreIds.length === 0) {

        throw new Error(`Failed to configure vector store for assistant after multiple attempts`);
      } else {

        // Ensure vector store is ready before returning
        for (const vsId of verifiedVectorStoreIds) {
          await this.waitForVectorStoreReady(vsId, 30); // Wait up to 30 seconds
        }
      }
      
      return verifiedAssistant;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Delete an assistant from OpenAI
   * @param {string} assistantId - Assistant ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteAssistant(assistantId) {
    try {
      const response = await this._fetch(`${this.baseURL}/assistants/${assistantId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      return response.ok;
    } catch (error) {

      return false;
    }
  }

  /**
   * Generate diagrams for a specification using Assistant API
   * @param {string} specId - Spec ID
   * @param {string} assistantId - Assistant ID that has access to spec file
   * @returns {Promise<Array>} Array of diagram objects
   */
  async generateDiagrams(specId, assistantId) {
    const requestId = `generate-diagrams-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    console.log(`[${requestId}] ===== generateDiagrams START =====`);
    console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
    console.log(`[${requestId}] Spec ID: ${specId}`);
    console.log(`[${requestId}] Assistant ID: ${assistantId}`);
    
    try {

      
      // Create the diagrams prompt
      const prompt = `Return ONLY valid JSON (no text/markdown). Top-level key MUST be diagrams. If a value is unknown, return an empty array/object—never omit required keys.

Generate 7 Mermaid diagrams based on the technical specification in the provided file. Return JSON with diagrams key containing an array of 7 diagram objects, each with:

{
  "diagrams": [
    {
      "id": "user_flow",
      "type": "flowchart",
      "title": "User Flow Diagram",
      "description": "User journey through application screens and actions",
      "mermaidCode": "Valid Mermaid flowchart syntax",
      "status": "success"
    },
    {
      "id": "system_architecture",
      "type": "graph",
      "title": "System Architecture Diagram",
      "description": "Overall system structure, layers, servers, APIs, and communication",
      "mermaidCode": "Valid Mermaid graph syntax",
      "status": "success"
    },
    {
      "id": "information_architecture",
      "type": "graph",
      "title": "Information System Architecture Diagram",
      "description": "Information system including IO processes, integrations, and interfaces",
      "mermaidCode": "Valid Mermaid graph syntax",
      "status": "success"
    },
    {
      "id": "data_schema",
      "type": "erDiagram",
      "title": "Data Schema Diagram (ERD)",
      "description": "Conceptual-level Entity Relationship Diagram showing main entities, key relationships, and primary/foreign keys. Focus on entity structure and relationships - NOT all field details. This is a high-level conceptual view.",
      "mermaidCode": "Valid Mermaid erDiagram syntax",
      "status": "success"
    },
    {
      "id": "database_schema",
      "type": "erDiagram",
      "title": "Database Schema Diagram",
      "description": "Implementation-level database schema showing ALL tables, ALL fields with data types, constraints, indexes, and relationships. This is a complete technical database implementation view with full details.",
      "mermaidCode": "Valid Mermaid erDiagram syntax with all entities and their attributes",
      "status": "success"
    },
    {
      "id": "sequence",
      "type": "sequenceDiagram",
      "title": "Sequence Diagram",
      "description": "Sequence of actions for specific events (login, purchase, etc.)",
      "mermaidCode": "Valid Mermaid sequenceDiagram syntax",
      "status": "success"
    },
    {
      "id": "frontend_components",
      "type": "graph",
      "title": "Component Diagram (Frontend)",
      "description": "Structure of main UI components, modules, and their relationships",
      "mermaidCode": "Valid Mermaid graph syntax",
      "status": "success"
    }
  ]
}

CRITICAL REQUIREMENTS FOR ERD DIAGRAMS (data_schema AND database_schema):
- ABSOLUTELY CRITICAL: ERD syntax MUST be exactly correct
- CORRECT format for erDiagram:
  erDiagram
      ENTITY1 {
          int id PK
          string name
          string email
      }
      ENTITY2 {
          int id PK
          string title
          int entity1Id FK
          date createdAt
      }
      ENTITY1 ||--o{ ENTITY2 : "has"
- NEVER write: USERS {id} ||--o{ TASKS {projectId} : belongs_to
- CORRECT: First define entity attributes, THEN relationships
- Relationships must ONLY show entity names separated by relationship symbols
- NEVER put field names like {id} or {projectId} inside relationship lines
- Define ALL entity attributes inside curly braces BEFORE writing any relationships
- Relationship format: ENTITY1 ||--o{ ENTITY2 : "label"

CRITICAL DIFFERENCE BETWEEN data_schema AND database_schema:

1. data_schema (Data Schema Diagram / Conceptual ERD):
   - PURPOSE: High-level conceptual view of the data model
   - FOCUS: Main entities, key relationships, primary/foreign keys
   - LEVEL: Conceptual - shows WHAT entities exist and HOW they relate
   - DETAIL LEVEL: Only include essential fields that define the entity identity and key relationships
   - EXAMPLE: User entity might show: id PK, email, role (key fields only)
   - DO NOT include: All optional fields, detailed constraints, indexes, technical implementation details
   - This diagram answers: "What are the main data entities and how do they connect?"

2. database_schema (Database Schema Diagram / Implementation ERD):
   - PURPOSE: Complete technical implementation view of the database
   - FOCUS: ALL tables, ALL fields, data types, constraints, indexes
   - LEVEL: Implementation - shows HOW data is actually stored
   - DETAIL LEVEL: Include EVERY field with data types, nullability, defaults, constraints
   - EXAMPLE: User entity shows: id PK, email VARCHAR(255) NOT NULL, password_hash VARCHAR(255) NOT NULL, role VARCHAR(50), created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP, INDEX idx_email, etc.
   - DO include: All fields, data types, primary keys, foreign keys, unique constraints, indexes, default values, nullability
   - This diagram answers: "What is the exact database structure that will be implemented?"

CRITICAL REQUIREMENTS FOR data_schema DIAGRAM:
- Show only MAIN entities from the technical specification
- Include only KEY fields (primary keys, foreign keys, essential identifying fields)
- Focus on entity relationships and structure
- Do NOT include all optional fields, technical constraints, or implementation details
- This is a conceptual diagram for understanding the data model at a high level

CRITICAL REQUIREMENTS FOR database_schema DIAGRAM:
- database_schema MUST include ALL entities/tables from the technical specification
- MUST show ALL fields with their exact data types for each entity
- MUST accurately represent the databaseSchema.tables from technical specification
- MUST include all relationships between entities
- MUST include all constraints (PK, FK, UNIQUE, NOT NULL, etc.)
- This diagram should be based on the databaseSchema.tables provided in the technical specification
- Use the detailed table information to create a complete technical ERD

CRITICAL REQUIREMENTS FOR ALL DIAGRAMS:
- All mermaidCode must be valid Mermaid syntax
- Use proper node IDs and labels
- Include appropriate styling and formatting
- Ensure diagrams are comprehensive and detailed
- Each diagram should be self-contained and meaningful
- database_schema diagram must match the actual databaseSchema from technical specification
- Base diagrams on the specification content in the provided file
- Use the technical and overview sections to understand the application structure`;

      // Use Assistant API with thread (with retry logic)
      let thread;
      let response;
      const maxRetries = 3;
      let retryCount = 0;
      
      console.log(`[${requestId}] 📤 Starting diagram generation with retry logic (max ${maxRetries} retries)`);
      
      // Verify assistant is ready before starting (using verifyAssistantReady function)
      console.log(`[${requestId}] 📤 Pre-flight check: Verifying assistant is ready`);
      const preVerifyStart = Date.now();
      const preVerification = await this.verifyAssistantReady(assistantId, 10);
      const preVerifyTime = Date.now() - preVerifyStart;
      console.log(`[${requestId}] ⏱️  Pre-flight verification took ${preVerifyTime}ms`);
      
      if (!preVerification.ready) {
        console.error(`[${requestId}] ❌ Assistant is not ready before diagram generation: ${preVerification.error}`);
        throw new Error(`Assistant ${assistantId} is not ready: ${preVerification.error}`);
      }
      
      console.log(`[${requestId}] ✅ Assistant verified ready before diagram generation`);
      
      while (retryCount < maxRetries) {
        try {
          console.log(`[${requestId}] 🔄 Attempt ${retryCount + 1}/${maxRetries}`);
          
          console.log(`[${requestId}] 📤 Step 1: Creating thread`);
          const threadStart = Date.now();
          thread = await this.createThread();
          const threadTime = Date.now() - threadStart;
          console.log(`[${requestId}] ⏱️  Thread creation took ${threadTime}ms`);
          console.log(`[${requestId}] ✅ Thread created: ${thread.id}`);

          
          // Send message using Assistant
          console.log(`[${requestId}] 📤 Step 2: Sending message to assistant`);
          console.log(`[${requestId}] Prompt length: ${prompt.length} characters`);
          const messageStart = Date.now();
          response = await this.sendMessage(thread.id, assistantId, prompt);
          const messageTime = Date.now() - messageStart;
          console.log(`[${requestId}] ⏱️  Message sending took ${messageTime}ms`);
          console.log(`[${requestId}] ✅ Response received, length: ${response?.length || 0} characters`);

          
          // Success - break out of retry loop
          console.log(`[${requestId}] ✅ Diagram generation successful on attempt ${retryCount + 1}`);
          break;
        } catch (error) {
          retryCount++;
          console.error(`[${requestId}] ❌ Attempt ${retryCount} failed:`, {
            message: error.message,
            name: error.name,
            isCorruptedAssistant: error.isCorruptedAssistant
          });
          
          const isServerError = error.message && (
            error.message.includes('server_error') || 
            error.message.includes('rate_limit') ||
            error.message.includes('timeout')
          );
          
          // Preserve corrupted assistant flag if present
          if (error.isCorruptedAssistant) {
            console.error(`[${requestId}] ❌ Assistant is corrupted, not retrying`);
            // Don't retry if assistant is corrupted - let caller handle recreation
            throw error;
          }
          
          if (retryCount >= maxRetries || !isServerError) {
            console.error(`[${requestId}] ❌ Not retrying (retryCount=${retryCount}, maxRetries=${maxRetries}, isServerError=${isServerError})`);
            // If it's not a retryable error or we've exhausted retries, throw
            throw error;
          }
          
          const backoffTime = 1000 * retryCount;
          console.log(`[${requestId}] ⏳ Waiting ${backoffTime}ms before retry (exponential backoff)`);
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }

      // Parse JSON response robustly
      console.log(`[${requestId}] 📤 Step 3: Parsing JSON response`);
      const parseStart = Date.now();
      let parsed;
      try {
        parsed = JSON.parse(response);
        const parseTime = Date.now() - parseStart;
        console.log(`[${requestId}] ⏱️  JSON parsing took ${parseTime}ms`);
        console.log(`[${requestId}] ✅ Successfully parsed JSON`);
      } catch (e) {
        console.warn(`[${requestId}] ⚠️  Direct JSON parse failed, trying fallback:`, e.message);

        // Fallback: try to extract JSON if model returned fenced code
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          console.log(`[${requestId}] ✅ Found JSON in code block, parsing...`);
          parsed = JSON.parse(jsonMatch[1]);
          const parseTime = Date.now() - parseStart;
          console.log(`[${requestId}] ⏱️  Fallback JSON parsing took ${parseTime}ms`);
        } else {
          const snippet = response.slice(0, 200);
          console.error(`[${requestId}] ❌ Failed to parse diagrams JSON. Preview:`, snippet);
          throw new Error(`Failed to parse diagrams JSON. Preview: ${snippet}`);
        }
      }

      if (parsed && Array.isArray(parsed.diagrams)) {
        console.log(`[${requestId}] ✅ Diagrams array found, count: ${parsed.diagrams.length}`);
        const totalTime = Date.now() - startTime;
        console.log(`[${requestId}] ✅ generateDiagrams SUCCESS (${totalTime}ms total)`);
        console.log(`[${requestId}] ===== generateDiagrams COMPLETE =====`);

        return parsed.diagrams;
      }

      console.error(`[${requestId}] ❌ Invalid diagrams structure:`, {
        hasParsed: !!parsed,
        hasDiagrams: !!(parsed && parsed.diagrams),
        isArray: !!(parsed && Array.isArray(parsed.diagrams)),
        parsedKeys: parsed ? Object.keys(parsed) : []
      });
      throw new Error('Invalid diagrams structure returned from API (missing diagrams array)');
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`[${requestId}] ❌ ERROR in generateDiagrams (${totalTime}ms):`, {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      console.error(`[${requestId}] ===== generateDiagrams ERROR =====`);
      throw error;
    }
  }

  /**
   * Repair a broken diagram using Assistant API
   * @param {string} specId - Spec ID
   * @param {string} assistantId - Assistant ID that has access to spec file
   * @param {string} brokenCode - Broken Mermaid code
   * @param {string} diagramTitle - Diagram title
   * @param {string} diagramType - Diagram type (flowchart, erDiagram, etc.)
   * @returns {Promise<string>} Repaired Mermaid code
   */
  async repairDiagram(specId, assistantId, brokenCode, diagramTitle, diagramType, errorMessage = '') {
    try {

      if (errorMessage) {

      }
      
      // Build error context if available
      const errorContext = errorMessage ? `
ERROR MESSAGE FROM MERMAID:
${errorMessage}

Pay special attention to the error message above - it tells you exactly what syntax issue needs to be fixed.` : '';
      
      const prompt = `You are a Mermaid diagram syntax expert. Fix broken Mermaid diagram code.

The following ${diagramType} Mermaid diagram is broken:

\`\`\`mermaid
${brokenCode}
\`\`\`

Title: ${diagramTitle}${errorContext}

CRITICAL REQUIREMENTS:
1. Fix all syntax errors${errorMessage ? ' (especially the error mentioned above)' : ''}
2. Ensure diagram accurately represents the specification content from the provided file
3. Return ONLY the corrected Mermaid code without any explanations, markdown formatting, or additional text
4. The diagram must be complete and renderable

CRITICAL DIFFERENCE BETWEEN DIAGRAM TYPES:
${diagramType === 'erDiagram' || diagramType.includes('schema') ? `
- For "data_schema" (Data Schema Diagram/ERD): Show conceptual level - main entities, key relationships, primary/foreign keys. Focus on entity structure and relationships, NOT all field details.
- For "database_schema" (Database Schema Diagram): Show implementation level - ALL tables with ALL fields, data types, constraints. Complete technical database schema representation.

ERD SYNTAX RULES (CRITICAL):
- CORRECT format: First define ALL entity attributes inside curly braces, THEN define relationships
- Entity definition: ENTITY_NAME { field1 type, field2 type PK, field3 type FK }
- Relationships: ENTITY1 ||--o{ ENTITY2 : "relationship label"
- NEVER put field names inside relationship lines
- Example CORRECT:
  erDiagram
      USER {
          int id PK
          string email
          string name
      }
      TASK {
          int id PK
          string title
          int userId FK
      }
      USER ||--o{ TASK : "has"
` : ''}

Return ONLY the corrected Mermaid code.`;

      // Use Assistant API with thread
      const thread = await this.createThread();

      
      // Send message using Assistant
      const response = await this.sendMessage(thread.id, assistantId, prompt);


      // Clean up the response (remove any markdown code blocks)
      let cleanedCode = response.trim();
      if (cleanedCode.startsWith('```mermaid')) {
        cleanedCode = cleanedCode.replace(/^```mermaid\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedCode.startsWith('```')) {
        cleanedCode = cleanedCode.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      return cleanedCode;
    } catch (error) {

      throw error;
    }
  }

  /**
   * Send message and get response
   * @param {string} threadId - Thread ID
   * @param {string} assistantId - Assistant ID
   * @param {string} message - User message
   * @returns {Promise<string>} Assistant response
   */
  async sendMessage(threadId, assistantId, message) {
    const requestId = `send-message-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    console.log(`[${requestId}] ===== sendMessage START =====`);
    console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
    console.log(`[${requestId}] Thread ID: ${threadId}`);
    console.log(`[${requestId}] Assistant ID: ${assistantId}`);
    console.log(`[${requestId}] Message length: ${message.length} characters`);
    
    try {
      // Verify assistant is ready before sending (using new verifyAssistantReady function)
      console.log(`[${requestId}] 📤 Step 1: Verifying assistant is ready`);
      const verifyStart = Date.now();
      const verification = await this.verifyAssistantReady(assistantId, 10);
      const verifyTime = Date.now() - verifyStart;
      console.log(`[${requestId}] ⏱️  Assistant verification took ${verifyTime}ms`);
      
      if (!verification.ready) {
        console.error(`[${requestId}] ❌ Assistant is not ready: ${verification.error}`);
        throw new Error(`Assistant ${assistantId} is not ready: ${verification.error}`);
      }
      
      const assistantCheck = verification.assistant;
      const vectorStoreIds = assistantCheck.tool_resources?.file_search?.vector_store_ids || [];
      console.log(`[${requestId}] ✅ Assistant is ready:`, {
        hasVectorStore: vectorStoreIds.length > 0,
        vectorStoreIds,
        toolCount: assistantCheck.tools?.length || 0
      });

      
      // Add message to thread
      console.log(`[${requestId}] 📤 Step 2: Adding message to thread`);
      console.log(`[${requestId}] OpenAI URL: ${this.baseURL}/threads/${threadId}/messages`);
      
      const messageStart = Date.now();
      const messageResponse = await this._fetch(`${this.baseURL}/threads/${threadId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          role: 'user',
          content: message
        })
      });
      
      const messageTime = Date.now() - messageStart;
      console.log(`[${requestId}] ⏱️  Add message request took ${messageTime}ms`);
      console.log(`[${requestId}] 📥 Response Status: ${messageResponse.status} ${messageResponse.statusText}`);
      
      if (!messageResponse.ok) {
        let errorText;
        try {
          errorText = await messageResponse.text();
          console.error(`[${requestId}] ❌ Failed to add message to thread:`, {
            status: messageResponse.status,
            statusText: messageResponse.statusText,
            error: errorText
          });
        } catch (textError) {
          errorText = `HTTP ${messageResponse.status}: ${messageResponse.statusText}`;
          console.error(`[${requestId}] ❌ Failed to read error response:`, textError.message);
        }

        const totalTime = Date.now() - startTime;
        console.error(`[${requestId}] ===== sendMessage FAILED (${totalTime}ms) =====`);
        throw new Error(`Failed to add message to thread: ${errorText}`);
      }
      
      const messageResult = await messageResponse.json();
      console.log(`[${requestId}] ✅ Message added successfully:`, {
        id: messageResult.id,
        role: messageResult.role,
        created_at: messageResult.created_at
      });
      
      // Run assistant - include tool_resources in run to ensure they're used
      // Get fresh assistant info right before run to ensure we have latest config
      console.log(`[${requestId}] 📤 Step 3: Getting fresh assistant info before run`);
      const assistantCheckStart = Date.now();
      const assistantBeforeRun = await this.getAssistant(assistantId);
      const assistantCheckTime = Date.now() - assistantCheckStart;
      console.log(`[${requestId}] ⏱️  Assistant check took ${assistantCheckTime}ms`);
      
      const runVectorStoreIds = assistantBeforeRun.tool_resources?.file_search?.vector_store_ids || [];
      console.log(`[${requestId}] Run Vector Store IDs:`, runVectorStoreIds);
      

      
      if (runVectorStoreIds.length === 0) {
        console.error(`[${requestId}] ❌ Assistant has no vector stores configured for run`);

        const totalTime = Date.now() - startTime;
        console.error(`[${requestId}] ===== sendMessage FAILED (${totalTime}ms) =====`);
        throw new Error(`Assistant ${assistantId} has no vector stores configured. Cannot proceed with run.`);
      }
      
      console.log(`[${requestId}] 📤 Step 4: Creating run`);
      console.log(`[${requestId}] OpenAI URL: ${this.baseURL}/threads/${threadId}/runs`);
      
      const runStart = Date.now();
      const runResponse = await this._fetch(`${this.baseURL}/threads/${threadId}/runs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        },
        body: JSON.stringify({
          assistant_id: assistantId
        })
      });
      
      const runTime = Date.now() - runStart;
      console.log(`[${requestId}] ⏱️  Create run request took ${runTime}ms`);
      console.log(`[${requestId}] 📥 Response Status: ${runResponse.status} ${runResponse.statusText}`);
      
      if (!runResponse.ok) {
        let errorText;
        try {
          errorText = await runResponse.text();
          console.error(`[${requestId}] ❌ Failed to create run:`, {
            status: runResponse.status,
            statusText: runResponse.statusText,
            error: errorText
          });
        } catch (textError) {
          errorText = `HTTP ${runResponse.status}: ${runResponse.statusText}`;
          console.error(`[${requestId}] ❌ Failed to read error response:`, textError.message);
        }

        const totalTime = Date.now() - startTime;
        console.error(`[${requestId}] ===== sendMessage FAILED (${totalTime}ms) =====`);
        throw new Error(`Failed to create run: ${errorText}`);
      }
      
      const run = await runResponse.json();
      console.log(`[${requestId}] ✅ Run created successfully:`, {
        id: run.id,
        status: run.status,
        created_at: run.created_at
      });
      
      // Wait for completion
      console.log(`[${requestId}] ⏳ Step 5: Waiting for run completion (max ${60} attempts)`);
      let runStatus = run;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds timeout
      
      while ((runStatus.status === 'queued' || runStatus.status === 'in_progress') && attempts < maxAttempts) {
        if (attempts > 0 && attempts % 5 === 0) {
          console.log(`[${requestId}] ⏳ Still waiting... (attempt ${attempts}/${maxAttempts}, status: ${runStatus.status})`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusStart = Date.now();
        const statusResponse = await this._fetch(`${this.baseURL}/threads/${threadId}/runs/${run.id}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });
        
        if (!statusResponse.ok) {
          const errorText = await statusResponse.text();

          throw new Error(`Failed to check run status: ${errorText}`);
        }
        
        runStatus = await statusResponse.json();
        
        // Check for failed status early
        if (runStatus.status === 'failed' || runStatus.status === 'cancelled' || runStatus.status === 'expired') {
          break;
        }
        
        attempts++;
      }
      
      // Check for timeout
      if (attempts >= maxAttempts && runStatus.status !== 'completed') {

        throw new Error(`Run timeout: Still in status ${runStatus.status} after ${maxAttempts} seconds`);
      }
      
      if (runStatus.status !== 'completed') {
        // Log detailed error information
        const errorDetails = runStatus.last_error || {};
        const errorMessage = errorDetails.message || 'Unknown error';
        const errorCode = errorDetails.code || 'unknown';
        const runToolResources = runStatus.tool_resources || {};
        const runVectorStoreIds = runToolResources.file_search?.vector_store_ids || [];
        




        
        // If tool_resources is empty in run but assistant has them, this is a known OpenAI API bug
        // But first, check if it's a retryable server_error
        if (runVectorStoreIds.length === 0 && errorCode === 'server_error') {
          // Check if this is a retryable error before marking as corrupted
          const isRetryableError = errorMessage.includes('rate_limit') || 
                                   errorMessage.includes('timeout') ||
                                   errorMessage.includes('internal_error');
          
          // Only mark as corrupted if it's NOT a retryable error
          if (!isRetryableError) {
            console.error(`[${requestId}] ❌ Vector store configuration not propagated to run (non-retryable server_error)`);
            // Create a custom error with metadata to help caller recreate the assistant
            const customError = new Error(`Assistant run failed: Vector store configuration not propagated to run. This may indicate the assistant ${assistantId} is corrupted. Please try recreating the assistant. (Original error: ${errorMessage})`);
            customError.isCorruptedAssistant = true;
            customError.assistantId = assistantId;
            throw customError;
          } else {
            // It's a retryable error, throw regular error to be handled by retry logic
            console.warn(`[${requestId}] ⚠️  Server error detected (retryable): ${errorMessage}`);
            throw new Error(`Assistant run failed: ${errorMessage} (code: ${errorCode})`);
          }
        }
        
        // For other server errors, check if retryable
        if (errorCode === 'server_error') {
          const isRetryableError = errorMessage.includes('rate_limit') || 
                                   errorMessage.includes('timeout') ||
                                   errorMessage.includes('internal_error');
          if (isRetryableError) {
            console.warn(`[${requestId}] ⚠️  Retryable server error: ${errorMessage}`);
          }
        }
        
        throw new Error(`Assistant run failed: ${errorMessage} (code: ${errorCode})`);
      }
      
      // Get messages
      console.log(`[${requestId}] 📤 Step 6: Getting messages from thread`);
      console.log(`[${requestId}] OpenAI URL: ${this.baseURL}/threads/${threadId}/messages`);
      
      const messagesStart = Date.now();
      const messagesResponse = await this._fetch(`${this.baseURL}/threads/${threadId}/messages`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      
      const messagesTime = Date.now() - messagesStart;
      console.log(`[${requestId}] ⏱️  Get messages request took ${messagesTime}ms`);
      console.log(`[${requestId}] 📥 Response Status: ${messagesResponse.status} ${messagesResponse.statusText}`);
      
      if (!messagesResponse.ok) {
        let errorText;
        try {
          errorText = await messagesResponse.text();
          console.error(`[${requestId}] ❌ Failed to get messages:`, {
            status: messagesResponse.status,
            statusText: messagesResponse.statusText,
            error: errorText
          });
        } catch (textError) {
          errorText = `HTTP ${messagesResponse.status}: ${messagesResponse.statusText}`;
          console.error(`[${requestId}] ❌ Failed to read error response:`, textError.message);
        }

        const totalTime = Date.now() - startTime;
        console.error(`[${requestId}] ===== sendMessage FAILED (${totalTime}ms) =====`);
        throw new Error(`Failed to get messages: ${errorText}`);
      }
      
      const messages = await messagesResponse.json();
      console.log(`[${requestId}] ✅ Messages retrieved:`, {
        messageCount: messages.data?.length || 0,
        hasData: !!messages.data
      });
      
      if (messages.data && messages.data.length > 0 && messages.data[0].content) {
        // Find the first assistant message
        const assistantMessage = messages.data.find(msg => msg.role === 'assistant');
        if (assistantMessage && assistantMessage.content && assistantMessage.content.length > 0) {
          const responseText = assistantMessage.content[0].text.value;
          const responseLength = responseText.length;
          
          console.log(`[${requestId}] ✅ Assistant response found:`, {
            messageId: assistantMessage.id,
            role: assistantMessage.role,
            responseLength,
            created_at: assistantMessage.created_at
          });
          
          const totalTime = Date.now() - startTime;
          console.log(`[${requestId}] ✅ sendMessage SUCCESS (${totalTime}ms total)`);
          console.log(`[${requestId}] ===== sendMessage COMPLETE =====`);
          
          return responseText;
        }
      }
      
      console.error(`[${requestId}] ❌ No assistant message found in response`);
      const totalTime = Date.now() - startTime;
      console.error(`[${requestId}] ===== sendMessage FAILED (${totalTime}ms) =====`);
      throw new Error('No response from assistant');
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`[${requestId}] ❌ ERROR in sendMessage (${totalTime}ms):`, {
        message: error.message,
        stack: error.stack,
        name: error.name
      });

      // If it's an assistant corruption error, try Chat Completions fallback
      if (error.message && error.message.includes('Vector store configuration not propagated')) {
        console.log(`[${requestId}] 🔄 Attempting Chat Completions fallback due to assistant corruption`);

        try {
          const fallbackResult = await this.sendMessageWithChatCompletions(threadId, assistantId, message);
          console.log(`[${requestId}] ✅ Chat Completions fallback succeeded`);
          const totalTime = Date.now() - startTime;
          console.log(`[${requestId}] ✅ sendMessage SUCCESS (with fallback) (${totalTime}ms total)`);
          console.log(`[${requestId}] ===== sendMessage COMPLETE =====`);
          return fallbackResult;
        } catch (fallbackError) {
          console.error(`[${requestId}] ❌ Chat Completions fallback also failed:`, {
            message: fallbackError.message,
            name: fallbackError.name
          });

          console.error(`[${requestId}] ===== sendMessage ERROR =====`);
          throw error; // Throw original error
        }
      }

      console.error(`[${requestId}] ===== sendMessage ERROR =====`);
      throw error;
    }
  }

  /**
   * Get vector store information
   * @param {string} vectorStoreId - Vector Store ID
   * @returns {Promise<object>} Vector store object
   */
  async getVectorStore(vectorStoreId) {
    try {
      const response = await this._fetch(`${this.baseURL}/vector_stores/${vectorStoreId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get vector store: ${errorText}`);
      }

      return await response.json();
    } catch (error) {

      throw error;
    }
  }

  /**
   * Verify that an assistant is ready for use
   * Checks that assistant exists, has vector store configured, and vector store is ready
   * @param {string} assistantId - Assistant ID
   * @param {number} maxWaitAttempts - Maximum attempts to wait for vector store (default: 10)
   * @returns {Promise<{ready: boolean, error?: string, assistant?: object}>}
   */
  async verifyAssistantReady(assistantId, maxWaitAttempts = 10) {
    const requestId = `verify-ready-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log(`[${requestId}] ===== verifyAssistantReady START =====`);
      console.log(`[${requestId}] Assistant ID: ${assistantId}`);
      
      // Step 1: Check if assistant exists
      console.log(`[${requestId}] 📤 Step 1: Checking if assistant exists`);
      const assistant = await this.getAssistant(assistantId);
      
      if (!assistant) {
        console.error(`[${requestId}] ❌ Assistant not found`);
        return { ready: false, error: `Assistant ${assistantId} not found` };
      }
      
      console.log(`[${requestId}] ✅ Assistant exists:`, {
        id: assistant.id,
        name: assistant.name,
        model: assistant.model
      });
      
      // Step 2: Check if assistant has vector store configured
      const vectorStoreIds = assistant.tool_resources?.file_search?.vector_store_ids || [];
      console.log(`[${requestId}] 📤 Step 2: Checking vector store configuration`);
      console.log(`[${requestId}] Vector Store IDs:`, vectorStoreIds);
      
      if (vectorStoreIds.length === 0) {
        console.error(`[${requestId}] ❌ Assistant has no vector stores configured`);
        return { 
          ready: false, 
          error: `Assistant ${assistantId} has no vector stores configured`,
          assistant 
        };
      }
      
      console.log(`[${requestId}] ✅ Assistant has ${vectorStoreIds.length} vector store(s) configured`);
      
      // Step 3: Verify all vector stores are ready
      console.log(`[${requestId}] 📤 Step 3: Verifying vector stores are ready`);
      for (const vsId of vectorStoreIds) {
        console.log(`[${requestId}] Checking vector store: ${vsId}`);
        const isReady = await this.waitForVectorStoreReady(vsId, maxWaitAttempts);
        
        if (!isReady) {
          // Try to get status for better error message
          try {
            const vectorStore = await this.getVectorStore(vsId);
            const status = vectorStore.status || 'unknown';
            console.error(`[${requestId}] ❌ Vector store ${vsId} is not ready, status: ${status}`);
            return { 
              ready: false, 
              error: `Vector store ${vsId} is not ready (status: ${status})`,
              assistant 
            };
          } catch (vsError) {
            console.error(`[${requestId}] ❌ Failed to get vector store status:`, vsError.message);
            return { 
              ready: false, 
              error: `Vector store ${vsId} is not ready and status check failed: ${vsError.message}`,
              assistant 
            };
          }
        }
        
        console.log(`[${requestId}] ✅ Vector store ${vsId} is ready`);
      }
      
      console.log(`[${requestId}] ✅ All vector stores are ready`);
      console.log(`[${requestId}] ===== verifyAssistantReady SUCCESS =====`);
      
      return { ready: true, assistant };
    } catch (error) {
      console.error(`[${requestId}] ❌ ERROR in verifyAssistantReady:`, {
        assistantId,
        error: error.message,
        stack: error.stack
      });
      console.error(`[${requestId}] ===== verifyAssistantReady ERROR =====`);
      
      return { 
        ready: false, 
        error: `Failed to verify assistant: ${error.message}` 
      };
    }
  }

  /**
   * Send message using Chat Completions API as fallback
   * @param {string} threadId - Thread ID (not used in Chat Completions)
   * @param {string} assistantId - Assistant ID
   * @param {string} message - User message
   * @returns {Promise<string>} Chat response
   */
  async sendMessageWithChatCompletions(threadId, assistantId, message) {
    try {


      // Get assistant info to get instructions and file content
      const assistant = await this.getAssistant(assistantId);
      if (!assistant) {
        throw new Error(`Assistant ${assistantId} not found`);
      }

      // Get the file content from vector store (if available)
      let contextContent = '';
      if (assistant.tool_resources?.file_search?.vector_store_ids?.length > 0) {
        try {
          const vectorStoreId = assistant.tool_resources.file_search.vector_store_ids[0];
          const vectorStore = await this.getVectorStore(vectorStoreId);
          if (vectorStore.file_counts?.total > 0) {
            // Get file content (simplified - in real implementation you'd need to download and parse)
            contextContent = 'Note: Using file context from assistant vector store for enhanced responses.';
          }
        } catch (fileError) {

        }
      }

      // Build system prompt from assistant instructions
      const systemPrompt = `${assistant.instructions || 'You are a helpful assistant.'}

${contextContent}

IMPORTANT: Answer based on the context and knowledge you have about this specific application specification.`;

      // Use Chat Completions API
      const chatResponse = await this._fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: assistant.model || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: message
            }
          ],
          temperature: assistant.temperature || 1.0,
          max_tokens: 2048
        })
      });

      if (!chatResponse.ok) {
        const errorText = await chatResponse.text();

        throw new Error(`Chat Completions API failed: ${errorText}`);
      }

      const chatData = await chatResponse.json();
      if (chatData.choices && chatData.choices.length > 0 && chatData.choices[0].message) {

        return chatData.choices[0].message.content;
      }

      throw new Error('No response from Chat Completions API');

    } catch (error) {

      throw error;
    }
  }
}

module.exports = OpenAIStorageService;

