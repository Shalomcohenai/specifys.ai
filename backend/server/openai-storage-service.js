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
      const content = JSON.stringify(specData, null, 2);
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
          instructions: `You are a helpful assistant that answers questions about an app specification. 
Use the provided specification file to give accurate, detailed answers. 
Always reference specific parts of the spec when relevant.
If something is not in the spec, say so clearly.`,
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
      
      // Update assistant with vector store
      await fetch(`${this.baseURL}/assistants/${assistant.id}`, {
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
      
      return assistant;
    } catch (error) {
      console.error('Error creating assistant:', error);
      throw error;
    }
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
   * Generate diagrams for a specification
   * @param {string} specData - Full spec data object
   * @returns {Promise<Array>} Array of diagram objects
   */
  async generateDiagrams(specData) {
    try {
      // Extract technical and overview data
      const technical = specData.technical || '';
      const overview = specData.overview || '';
      
      // Create the diagrams prompt
      const prompt = `Return ONLY valid JSON (no text/markdown). Top-level key MUST be diagrams. If a value is unknown, return an empty array/object—never omit required keys.

Generate 6 Mermaid diagrams based on the technical specification. Return JSON with diagrams key containing an array of 6 diagram objects, each with:

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
      "description": "Entity structure, relationships, primary/foreign keys",
      "mermaidCode": "Valid Mermaid erDiagram syntax",
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

CRITICAL REQUIREMENTS:
- All mermaidCode must be valid Mermaid syntax
- Use proper node IDs and labels
- Include appropriate styling and formatting
- Ensure diagrams are comprehensive and detailed
- Each diagram should be self-contained and meaningful

Technical Specification:
${technical}

Application Overview:
${overview}`;

      // Call OpenAI API to generate diagrams
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a highly experienced software architect and technical diagram specialist. Generate detailed Mermaid diagrams.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      // Parse JSON response
      let diagrams;
      try {
        // Try to parse as JSON
        diagrams = JSON.parse(content);
      } catch {
        // If that fails, try to extract JSON from markdown code blocks
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          diagrams = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error('Failed to parse diagrams JSON');
        }
      }

      // Validate structure and return diagrams array
      if (diagrams.diagrams && Array.isArray(diagrams.diagrams)) {
        return diagrams.diagrams;
      } else {
        throw new Error('Invalid diagrams structure returned from API');
      }
    } catch (error) {
      console.error('Error generating diagrams:', error);
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
      // Add message to thread
      await fetch(`${this.baseURL}/threads/${threadId}/messages`, {
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
      
      // Run assistant
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
        throw new Error('Failed to create run');
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
        runStatus = await statusResponse.json();
        attempts++;
      }
      
      if (runStatus.status !== 'completed') {
        throw new Error(`Run failed with status: ${runStatus.status}`);
      }
      
      // Get messages
      const messagesResponse = await fetch(`${this.baseURL}/threads/${threadId}/messages`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      
      const messages = await messagesResponse.json();
      
      if (messages.data && messages.data.length > 0 && messages.data[0].content) {
        return messages.data[0].content[0].text.value;
      }
      
      throw new Error('No response from assistant');
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }
}

module.exports = OpenAIStorageService;

