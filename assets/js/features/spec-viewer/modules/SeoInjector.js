function upsertMeta(attr, key, content) {
  if (!content) return;
  const selector = attr === 'name' ? `meta[name="${key}"]` : `meta[property="${key}"]`;
  let tag = document.querySelector(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

export function injectSpecSeo(specData = {}) {
  const title = specData.title || 'Spec Viewer';
  const fallback = 'AI-generated application specification';
  const description = specData?.overview?.ideaSummary || specData?.overview?.problemStatement || fallback;
  document.title = `${title} | Specifys.ai`;
  upsertMeta('name', 'description', description);
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:type', 'article');

  const scriptId = 'spec-viewer-jsonld';
  let schemaTag = document.getElementById(scriptId);
  if (!schemaTag) {
    schemaTag = document.createElement('script');
    schemaTag.id = scriptId;
    schemaTag.type = 'application/ld+json';
    document.head.appendChild(schemaTag);
  }
  schemaTag.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: title,
    description
  });
}
