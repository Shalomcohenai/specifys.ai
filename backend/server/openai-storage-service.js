const fetch = require('node-fetch');
const FormData = require('form-data');

class OpenAIStorageService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.openai.com/v1';
  }

  /**
   * Upload spec content to OpenAI Files API
   * @param {string} specId - Spec ID
   * @param {object} specData - Spec data object
   * @returns {Promise<string>} File ID from OpenAI
   */
  async uploadSpec(specId, specData) {
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
      const formData = new FormData();
      
      formData.append('file', Buffer.from(content), {
        filename: `spec-${specId}.json`,
        contentType: 'application/json'
      });
      formData.append('purpose', 'assistants');
      
      const response = await fetch(`${this.baseURL}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          ...formData.getHeaders()
        },
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI upload failed: ${error}`);
      }
      
      const result = await response.json();
      console.log(`[OpenAI Upload] Spec ${specId} uploaded as file ${result.id}`);
      return result.id;
    } catch (error) {
      console.error('Error uploading to OpenAI:', error);
      throw error;
    }
  }

  /**
   * Delete a file from OpenAI
   * @param {string} fileId - OpenAI File ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(fileId) {
    try {
      const response = await fetch(`${this.baseURL}/files/${fileId}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${this.apiKey}` 
        }
      });
      return response.ok;
    } catch (error) {
      console.error('Error deleting file from OpenAI:', error);
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
      const response = await fetch(`${this.baseURL}/files/${fileId}`, {
        headers: { 
          'Authorization': `Bearer ${this.apiKey}` 
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get file info: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting file info from OpenAI:', error);
      throw error;
    }
  }

  /**
   * List all files uploaded for assistants
   * @returns {Promise<Array>} Array of file objects
   */
  async listFiles() {
    try {
      const response = await fetch(`${this.baseURL}/files?purpose=assistants`, {
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
      console.error('Error listing files from OpenAI:', error);
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
    try {
      const response = await fetch(`${this.baseURL}/assistants`, {
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
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create assistant: ${errorText}`);
      }
      
      const assistant = await response.json();
      
      // Now add the file to the assistant
      const fileSearchResponse = await fetch(`${this.baseURL}/vector_stores`, {
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
      
      if (!fileSearchResponse.ok) {
        console.warn('Failed to create vector store for assistant');
        return assistant;
      }
      
      const vectorStore = await fileSearchResponse.json();
      
      // Wait for vector store to be ready
      console.log(`[Vector Store] Created ${vectorStore.id} for spec ${specId}`);
      const isReady = await this.waitForVectorStoreReady(vectorStore.id);
      if (!isReady) {
        console.warn(`[Vector Store] ${vectorStore.id} not ready after timeout, proceeding anyway`);
      }
      
      // Update assistant with vector store
      const updateResponse = await fetch(`${this.baseURL}/assistants/${assistant.id}`, {
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
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error(`[OpenAI] Failed to update assistant with vector store - Status: ${updateResponse.status}, Response: ${errorText}`);
        throw new Error(`Failed to update assistant with vector store: ${errorText}`);
      }
      
      const updatedAssistant = await updateResponse.json();
      console.log(`[OpenAI] Updated assistant ${assistant.id} with vector store ${vectorStore.id}`);
      
      return updatedAssistant;
    } catch (error) {
      console.error('Error creating assistant:', error);
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
    console.log(`[Vector Store] Waiting for ${vectorStoreId} to be ready...`);
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`${this.baseURL}/vector_stores/${vectorStoreId}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });
        
        if (!response.ok) {
          console.warn(`[Vector Store] Failed to check status: ${response.status}`);
          return false;
        }
        
        const vectorStore = await response.json();
        
        if (vectorStore.status === 'completed') {
          console.log(`[Vector Store] ${vectorStoreId} is ready`);
          return true;
        }
        
        if (vectorStore.status === 'failed') {
          console.error(`[Vector Store] ${vectorStoreId} failed`);
          return false;
        }
        
        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[Vector Store] Error checking status:`, error);
        return false;
      }
    }
    
    console.warn(`[Vector Store] Timeout waiting for ${vectorStoreId} to be ready`);
    return false;
  }

  /**
   * Create a thread for chat
   * @returns {Promise<object>} Thread object
   */
  async createThread() {
    try {
      const response = await fetch(`${this.baseURL}/threads`, {
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
      console.error('Error creating thread:', error);
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
      const response = await fetch(`${this.baseURL}/assistants/${assistantId}`, {
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
      console.error('Error getting assistant:', error);
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
    try {
      // Get current assistant
      const assistant = await this.getAssistant(assistantId);
      
      // Check if assistant already has vector store
      const currentVectorStoreIds = assistant.tool_resources?.file_search?.vector_store_ids || [];
      
      if (currentVectorStoreIds.length > 0) {
        console.log(`[OpenAI] Assistant ${assistantId} already has vector store(s): ${currentVectorStoreIds.join(', ')}`);
        // Verify all vector stores are ready
        for (const vsId of currentVectorStoreIds) {
          const isReady = await this.waitForVectorStoreReady(vsId, 10); // Quick check
          if (!isReady) {
            console.warn(`[OpenAI] Vector store ${vsId} is not ready, but continuing...`);
          }
        }
        return assistant;
      }
      
      // Create new vector store
      console.log(`[OpenAI] Creating vector store for assistant ${assistantId}`);
      const fileSearchResponse = await fetch(`${this.baseURL}/vector_stores`, {
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
      
      if (!fileSearchResponse.ok) {
        const errorText = await fileSearchResponse.text();
        throw new Error(`Failed to create vector store: ${errorText}`);
      }
      
      const vectorStore = await fileSearchResponse.json();
      console.log(`[Vector Store] Created ${vectorStore.id} for assistant ${assistantId}`);
      
      // Wait for vector store to be ready
      const isReady = await this.waitForVectorStoreReady(vectorStore.id);
      if (!isReady) {
        console.warn(`[Vector Store] ${vectorStore.id} not ready after timeout, proceeding anyway`);
      }
      
      // Update assistant with vector store
      const updateResponse = await fetch(`${this.baseURL}/assistants/${assistantId}`, {
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
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error(`[OpenAI] Failed to update assistant with vector store - Status: ${updateResponse.status}, Response: ${errorText}`);
        throw new Error(`Failed to update assistant with vector store: ${errorText}`);
      }
      
      const updatedAssistant = await updateResponse.json();
      console.log(`[OpenAI] Updated assistant ${assistantId} with vector store ${vectorStore.id}`);
      
      // Wait a bit to ensure OpenAI API has processed the update
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify the update was successful by fetching the assistant again
      let verifiedAssistant = await this.getAssistant(assistantId);
      let verifiedVectorStoreIds = verifiedAssistant.tool_resources?.file_search?.vector_store_ids || [];
      
      // Retry up to 3 times if update didn't stick
      let retries = 0;
      while (verifiedVectorStoreIds.length === 0 && retries < 3) {
        console.warn(`[OpenAI] Assistant ${assistantId} still has no vector store after update, retrying... (attempt ${retries + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Update again
        const retryUpdateResponse = await fetch(`${this.baseURL}/assistants/${assistantId}`, {
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
        console.error(`[OpenAI] ERROR: Assistant ${assistantId} still has no vector store after ${retries} retries`);
        throw new Error(`Failed to configure vector store for assistant after multiple attempts`);
      } else {
        console.log(`[OpenAI] Verified: Assistant ${assistantId} now has vector store(s): ${verifiedVectorStoreIds.join(', ')}`);
        // Ensure vector store is ready before returning
        for (const vsId of verifiedVectorStoreIds) {
          await this.waitForVectorStoreReady(vsId, 30); // Wait up to 30 seconds
        }
      }
      
      return verifiedAssistant;
    } catch (error) {
      console.error('Error ensuring assistant has vector store:', error);
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
      const response = await fetch(`${this.baseURL}/assistants/${assistantId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      return response.ok;
    } catch (error) {
      console.error('Error deleting assistant:', error);
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
    try {
      console.log('[Diagrams][OpenAI] Using Assistant to generate diagrams');
      
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
      
      while (retryCount < maxRetries) {
        try {
          thread = await this.createThread();
          console.log('[Diagrams][OpenAI] Created thread:', thread.id);
          
          // Send message using Assistant
          response = await this.sendMessage(thread.id, assistantId, prompt);
          console.log('[Diagrams][OpenAI] Received response from assistant. length:', response.length);
          
          // Success - break out of retry loop
          break;
        } catch (error) {
          retryCount++;
          const isServerError = error.message && (
            error.message.includes('server_error') || 
            error.message.includes('rate_limit') ||
            error.message.includes('timeout')
          );
          
          // Preserve corrupted assistant flag if present
          if (error.isCorruptedAssistant) {
            // Don't retry if assistant is corrupted - let caller handle recreation
            throw error;
          }
          
          if (retryCount >= maxRetries || !isServerError) {
            // If it's not a retryable error or we've exhausted retries, throw
            throw error;
          }
          
          console.warn(`[Diagrams][OpenAI] Attempt ${retryCount} failed, retrying... Error: ${error.message}`);
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      // Parse JSON response robustly
      let parsed;
      try {
        parsed = JSON.parse(response);
      } catch (e) {
        console.warn('[Diagrams][OpenAI] JSON.parse failed. Trying fenced extraction. error:', e && e.message);
        // Fallback: try to extract JSON if model returned fenced code
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || response.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1]);
        } else {
          const snippet = response.slice(0, 200);
          throw new Error(`Failed to parse diagrams JSON. Preview: ${snippet}`);
        }
      }

      if (parsed && Array.isArray(parsed.diagrams)) {
        console.log('[Diagrams][OpenAI] Parsed diagrams count:', parsed.diagrams.length);
        return parsed.diagrams;
      }

      throw new Error('Invalid diagrams structure returned from API (missing diagrams array)');
    } catch (error) {
      console.error('[Diagrams][OpenAI] Error generating diagrams:', error && (error.stack || error));
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
      console.log('[Repair][OpenAI] Using Assistant to repair diagram');
      if (errorMessage) {
        console.log('[Repair][OpenAI] Error message provided:', errorMessage.substring(0, 200));
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
      console.log('[Repair][OpenAI] Created thread:', thread.id);
      
      // Send message using Assistant
      const response = await this.sendMessage(thread.id, assistantId, prompt);
      console.log('[Repair][OpenAI] Received response from assistant. length:', response.length);

      // Clean up the response (remove any markdown code blocks)
      let cleanedCode = response.trim();
      if (cleanedCode.startsWith('```mermaid')) {
        cleanedCode = cleanedCode.replace(/^```mermaid\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedCode.startsWith('```')) {
        cleanedCode = cleanedCode.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      return cleanedCode;
    } catch (error) {
      console.error('[Repair][OpenAI] Error repairing diagram:', error && (error.stack || error));
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
    try {
      // Verify assistant has tool_resources configured before sending
      const assistantCheck = await this.getAssistant(assistantId);
      const hasVectorStore = assistantCheck.tool_resources?.file_search?.vector_store_ids?.length > 0;
      
      if (!hasVectorStore) {
        console.error(`[OpenAI] sendMessage: Assistant ${assistantId} has no vector store configured!`);
        console.error(`[OpenAI] Assistant tool_resources:`, JSON.stringify(assistantCheck.tool_resources, null, 2));
        throw new Error(`Assistant ${assistantId} has no vector store configured. Cannot send message.`);
      }
      
      console.log(`[OpenAI] sendMessage: Assistant ${assistantId} verified with vector store(s): ${assistantCheck.tool_resources.file_search.vector_store_ids.join(', ')}`);
      
      // Add message to thread
      const messageResponse = await fetch(`${this.baseURL}/threads/${threadId}/messages`, {
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
      
      if (!messageResponse.ok) {
        const errorText = await messageResponse.text();
        console.error(`[OpenAI] Failed to add message - Status: ${messageResponse.status}, Response: ${errorText}`);
        throw new Error(`Failed to add message to thread: ${errorText}`);
      }
      
      // Run assistant - include tool_resources in run to ensure they're used
      // Get fresh assistant info right before run to ensure we have latest config
      const assistantBeforeRun = await this.getAssistant(assistantId);
      const runVectorStoreIds = assistantBeforeRun.tool_resources?.file_search?.vector_store_ids || [];
      
      console.log(`[OpenAI] Running assistant ${assistantId} with vector stores: ${runVectorStoreIds.join(', ') || 'NONE'}`);
      
      if (runVectorStoreIds.length === 0) {
        console.error(`[OpenAI] CRITICAL: Assistant ${assistantId} has no vector stores when creating run!`);
        throw new Error(`Assistant ${assistantId} has no vector stores configured. Cannot proceed with run.`);
      }
      
      const runResponse = await fetch(`${this.baseURL}/threads/${threadId}/runs`, {
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
      
      if (!runResponse.ok) {
        const errorText = await runResponse.text();
        console.error(`[OpenAI] Failed to create run - Status: ${runResponse.status}, Response: ${errorText}`);
        throw new Error(`Failed to create run: ${errorText}`);
      }
      
      const run = await runResponse.json();
      
      // Wait for completion
      let runStatus = run;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds timeout
      
      while ((runStatus.status === 'queued' || runStatus.status === 'in_progress') && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const statusResponse = await fetch(`${this.baseURL}/threads/${threadId}/runs/${run.id}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        });
        
        if (!statusResponse.ok) {
          const errorText = await statusResponse.text();
          console.error(`[OpenAI] Failed to check run status - Status: ${statusResponse.status}, Response: ${errorText}`);
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
        console.error(`[OpenAI] Run timeout after ${maxAttempts} attempts - Final status: ${runStatus.status}`);
        throw new Error(`Run timeout: Still in status ${runStatus.status} after ${maxAttempts} seconds`);
      }
      
      if (runStatus.status !== 'completed') {
        // Log detailed error information
        const errorDetails = runStatus.last_error || {};
        const errorMessage = errorDetails.message || 'Unknown error';
        const errorCode = errorDetails.code || 'unknown';
        const runToolResources = runStatus.tool_resources || {};
        const runVectorStoreIds = runToolResources.file_search?.vector_store_ids || [];
        
        console.error(`[OpenAI] Run failed - Status: ${runStatus.status}, Code: ${errorCode}, Message: ${errorMessage}`);
        console.error(`[OpenAI] Run tool_resources:`, JSON.stringify(runToolResources, null, 2));
        console.error(`[OpenAI] Run vector stores: ${runVectorStoreIds.length > 0 ? runVectorStoreIds.join(', ') : 'NONE'}`);
        console.error(`[OpenAI] Full run status:`, JSON.stringify(runStatus, null, 2));
        
        // If tool_resources is empty in run but assistant has them, this is a known OpenAI API bug
        if (runVectorStoreIds.length === 0 && errorCode === 'server_error') {
          // Create a custom error with metadata to help caller recreate the assistant
          const customError = new Error(`Assistant run failed: Vector store configuration not propagated to run. This may indicate the assistant ${assistantId} is corrupted. Please try recreating the assistant. (Original error: ${errorMessage})`);
          customError.isCorruptedAssistant = true;
          customError.assistantId = assistantId;
          throw customError;
        }
        
        throw new Error(`Assistant run failed: ${errorMessage} (code: ${errorCode})`);
      }
      
      // Get messages
      const messagesResponse = await fetch(`${this.baseURL}/threads/${threadId}/messages`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      
      if (!messagesResponse.ok) {
        const errorText = await messagesResponse.text();
        console.error(`[OpenAI] Failed to get messages - Status: ${messagesResponse.status}, Response: ${errorText}`);
        throw new Error(`Failed to get messages: ${errorText}`);
      }
      
      const messages = await messagesResponse.json();
      
      if (messages.data && messages.data.length > 0 && messages.data[0].content) {
        // Find the first assistant message
        const assistantMessage = messages.data.find(msg => msg.role === 'assistant');
        if (assistantMessage && assistantMessage.content && assistantMessage.content.length > 0) {
          return assistantMessage.content[0].text.value;
        }
      }
      
      throw new Error('No response from assistant');
    } catch (error) {
      console.error('Error sending message:', error);

      // If it's an assistant corruption error, try Chat Completions fallback
      if (error.message && error.message.includes('Vector store configuration not propagated')) {
        console.log('[OpenAI] Assistants API failed due to vector store issue, trying Chat Completions fallback...');
        try {
          return await this.sendMessageWithChatCompletions(threadId, assistantId, message);
        } catch (fallbackError) {
          console.error('[OpenAI] Chat Completions fallback also failed:', fallbackError);
          throw error; // Throw original error
        }
      }

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
      const response = await fetch(`${this.baseURL}/vector_stores/${vectorStoreId}`, {
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
      console.error('Error getting vector store:', error);
      throw error;
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
      console.log('[OpenAI] Using Chat Completions fallback for assistant:', assistantId);

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
          console.warn('[OpenAI] Could not access vector store content:', fileError.message);
        }
      }

      // Build system prompt from assistant instructions
      const systemPrompt = `${assistant.instructions || 'You are a helpful assistant.'}

${contextContent}

IMPORTANT: Answer based on the context and knowledge you have about this specific application specification.`;

      // Use Chat Completions API
      const chatResponse = await fetch(`${this.baseURL}/chat/completions`, {
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
        console.error(`[OpenAI] Chat Completions failed - Status: ${chatResponse.status}, Response: ${errorText}`);
        throw new Error(`Chat Completions API failed: ${errorText}`);
      }

      const chatData = await chatResponse.json();
      if (chatData.choices && chatData.choices.length > 0 && chatData.choices[0].message) {
        console.log('[OpenAI] Chat Completions fallback successful');
        return chatData.choices[0].message.content;
      }

      throw new Error('No response from Chat Completions API');

    } catch (error) {
      console.error('[OpenAI] Chat Completions fallback failed:', error);
      throw error;
    }
  }
}

module.exports = OpenAIStorageService;

