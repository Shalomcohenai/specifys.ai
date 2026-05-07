export async function generateMindMapData(payload) {
  if (window.api?.post) {
    return window.api.post('/api/auxiliary/mindmap/generate', payload, { skipCache: true });
  }
  const response = await fetch('/api/auxiliary/mindmap/generate', {
    method: 'POST',
    headers: await window.getAuxHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || 'Failed to generate mind map');
  return data;
}
