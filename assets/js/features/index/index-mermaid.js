// Mermaid.js for diagrams - Initialize only when diagrams are visible
(function initMermaidOnVisible() {
  if (typeof mermaid === 'undefined') return;
  
  const mermaidElements = document.querySelectorAll('.mermaid, pre.mermaid');
  if (mermaidElements.length === 0) return;
  
  let mermaidInitialized = false;
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !mermaidInitialized) {
        mermaidInitialized = true;
        if (typeof window.sanitizeMermaidSource === 'function') {
          mermaidElements.forEach(function (el) {
            var t = el.textContent || '';
            var c = window.sanitizeMermaidSource(t);
            if (c) {
              el.textContent = c;
            }
          });
        }
        mermaid.initialize({ startOnLoad: false, theme: 'default' });
        Promise.resolve(typeof mermaid.run === 'function' ? mermaid.run() : undefined).catch(function () {});
      }
    });
  }, { rootMargin: '50px' });
  
  mermaidElements.forEach(el => observer.observe(el));
})();
