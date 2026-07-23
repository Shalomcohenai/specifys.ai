// Mermaid.js for diagrams — load CDN on demand, then init when diagrams are visible.
// Exclude the hero browser-window demo: index.js renderBrowserDiagrams owns that tree.
(function initMermaidOnVisible() {
  var MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
  var mermaidLoadPromise = null;

  function loadMermaid() {
    if (typeof mermaid !== 'undefined') {
      return Promise.resolve(mermaid);
    }
    if (mermaidLoadPromise) return mermaidLoadPromise;
    mermaidLoadPromise = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-mermaid-cdn="1"]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.mermaid); });
        existing.addEventListener('error', reject);
        return;
      }
      var s = document.createElement('script');
      s.src = MERMAID_CDN;
      s.async = true;
      s.setAttribute('data-mermaid-cdn', '1');
      s.onload = function () { resolve(window.mermaid); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return mermaidLoadPromise;
  }

  window.__specifysEnsureMermaid = loadMermaid;

  var previewRoot = document.getElementById('browserWindowPreview');
  var mermaidElements = Array.prototype.filter.call(
    document.querySelectorAll('.mermaid, pre.mermaid'),
    function (el) {
      return !(previewRoot && previewRoot.contains(el));
    }
  );
  if (mermaidElements.length === 0) return;

  var mermaidInitialized = false;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting && !mermaidInitialized) {
        mermaidInitialized = true;
        loadMermaid().then(function (m) {
          if (!m) return;
          var pending = mermaidElements.filter(function (el) {
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
            m.initialize({ startOnLoad: false, theme: 'default' });
            window.mermaidInitialized = true;
          }
          return Promise.resolve(
            typeof m.run === 'function' ? m.run({ nodes: pending }) : undefined
          );
        }).catch(function () {});
      }
    });
  }, { rootMargin: '50px' });

  mermaidElements.forEach(function (el) { observer.observe(el); });
})();
