// Mermaid.js for diagrams - Initialize only when diagrams are visible.
// Exclude the hero browser-window demo: index.js renderBrowserDiagrams owns that tree (theme + tab timing).
(function initMermaidOnVisible() {
  if (typeof mermaid === 'undefined') return;
  
  const previewRoot = document.getElementById('browserWindowPreview');
  const mermaidElements = Array.prototype.filter.call(
    document.querySelectorAll('.mermaid, pre.mermaid'),
    function (el) {
      return !(previewRoot && previewRoot.contains(el));
    }
  );
  if (mermaidElements.length === 0) return;
  
  let mermaidInitialized = false;
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !mermaidInitialized) {
        mermaidInitialized = true;
        const pending = mermaidElements.filter(function (el) {
          return !el.querySelector('svg');
        });
        if (pending.length === 0) return;
        if (typeof window.sanitizeMermaidSource === 'function') {
          pending.forEach(function (el) {
            var t = el.textContent || '';
            var c = window.sanitizeMermaidSource(t);
            if (c) {
              el.textContent = c;
            }
          });
        }
        if (!window.mermaidInitialized) {
          mermaid.initialize({ startOnLoad: false, theme: 'default' });
          window.mermaidInitialized = true;
        }
        Promise.resolve(
          typeof mermaid.run === 'function' ? mermaid.run({ nodes: pending }) : undefined
        ).catch(function () {});
      }
    });
  }, { rootMargin: '50px' });
  
  mermaidElements.forEach(el => observer.observe(el));
})();
