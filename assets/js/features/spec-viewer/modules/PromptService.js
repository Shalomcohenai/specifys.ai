export async function generatePromptStage(payload) {
  const response = await fetch('/api/auxiliary/prompts/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message || 'Failed to generate prompts');
  }
  return response.json();
}

export async function fixPromptDiagram(payload) {
  const response = await fetch('/api/auxiliary/prompts/fix-diagram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message || 'Failed to fix diagram');
  }
  return response.json();
}
