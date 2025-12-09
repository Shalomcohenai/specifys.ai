/**
 * Prompts API
 * Handles prompt generation for development tools
 */

import { apiClient } from './client';

export interface PromptsResponse {
  success: boolean;
  fullPrompt?: string;
  thirdPartyIntegrations?: Array<{
    service: string;
    description: string;
    instructions: string[];
  }>;
  message?: string;
}

/**
 * Generate prompts for a spec
 * Calls external API: https://promtmaker.shalom-cohen-111.workers.dev/generate
 */
export async function generatePrompts(specId: string): Promise<PromptsResponse> {
  // First, get the spec data
    const specResponse = await apiClient.get(`/api/specs/${specId}`) as any;
  
  if (!specResponse.success || !specResponse.spec) {
    throw new Error('Failed to load spec data');
  }

  const spec = specResponse.spec;
  
  // Parse content if needed
  let overviewContent = spec.overview;
  let technicalContent = spec.technical;
  let designContent = spec.design;

  // If content is JSON string, stringify it properly
  if (typeof overviewContent === 'object') {
    overviewContent = JSON.stringify(overviewContent, null, 2);
  }
  if (typeof technicalContent === 'object') {
    technicalContent = JSON.stringify(technicalContent, null, 2);
  }
  if (typeof designContent === 'object') {
    designContent = JSON.stringify(designContent, null, 2);
  }

  // Call external API with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes

  try {
    const response = await fetch('https://promtmaker.shalom-cohen-111.workers.dev/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        overview: overviewContent,
        technical: technicalContent,
        design: designContent
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to generate prompts: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Save to Firebase directly (no API endpoint exists for this)
    const { getFirebaseFirestore } = await import('@/lib/firebase/init');
    const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
    const db = getFirebaseFirestore();
    
    await updateDoc(doc(db, 'specs', specId), {
      prompts: {
        generated: true,
        fullPrompt: data.fullPrompt || data.prompt || '',
        thirdPartyIntegrations: data.thirdPartyIntegrations || [],
        generatedAt: new Date().toISOString()
      },
      'status.prompts': 'ready',
      updatedAt: serverTimestamp()
    });

    return {
      success: true,
      fullPrompt: data.fullPrompt || data.prompt || '',
      thirdPartyIntegrations: data.thirdPartyIntegrations || []
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Prompt generation timed out after 3 minutes');
    }
    
    throw error;
  }
}

