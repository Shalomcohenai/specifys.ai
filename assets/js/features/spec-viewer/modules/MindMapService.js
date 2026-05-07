export async function generateMindMapData(payload) {
  const response = await fetch('/api/auxiliary/mindmap/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message || 'Failed to generate mind map');
  }
  return response.json();
}
