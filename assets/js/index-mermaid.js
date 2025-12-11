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
        mermaid.initialize({ startOnLoad: false, theme: 'default' });
        mermaid.run();
      }
    });
  }, { rootMargin: '50px' });
  
  mermaidElements.forEach(el => observer.observe(el));
})();
