export async function generatePromptStage(payload) {
  if (window.api?.post) {
    return window.api.post('/api/auxiliary/prompts/generate', payload, {
      skipCache: true,
      retryConfig: { maxRetries: 2 }
    });
  }
  const response = await fetch('/api/auxiliary/prompts/generate', {
    method: 'POST',
    headers: await window.getAuxHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || 'Failed to generate prompts');
  return data;
}

export async function fixPromptDiagram(payload) {
  if (window.api?.post) {
    return window.api.post('/api/auxiliary/prompts/fix-diagram', payload, {
      skipCache: true,
      retryConfig: { maxRetries: 2 }
    });
  }
  const response = await fetch('/api/auxiliary/prompts/fix-diagram', {
    method: 'POST',
    headers: await window.getAuxHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || 'Failed to fix diagram');
  return data;
}
