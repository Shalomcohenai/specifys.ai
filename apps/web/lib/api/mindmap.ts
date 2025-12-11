/**
 * Mindmap API
 * Handles mindmap generation using Cloudflare Worker
 */

const MINDMAP_WORKER_URL = 'https://generate-mindmap.shalom-cohen-111.workers.dev/';

export interface MindmapData {
  mermaidCode?: string;
  title?: string;
  nodes?: any[];
  edges?: any[];
}

export interface GenerateMindmapResponse {
  success: boolean;
  mindMap?: MindmapData;
  error?: {
    message: string;
  };
}

/**
 * Generate mindmap for a spec
 */
export async function generateMindmap(
  overview: any,
  technical: any
): Promise<GenerateMindmapResponse> {
  try {
    const response = await fetch(MINDMAP_WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        overview,
        technical,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Worker returned ${response.status}: ${errorText || response.statusText}`
      );
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message || 'Failed to generate mind map');
    }

    if (!result.mindMap) {
      throw new Error('Invalid mind map data received - no mindMap field');
    }

    return {
      success: true,
      mindMap: result.mindMap,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'Failed to generate mind map',
      },
    };
  }
}




