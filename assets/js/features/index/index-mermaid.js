// Mermaid.js for diagrams - load CDN on demand (with mirrors), then init when visible.
// Exclude the hero browser-window demo: index.js renderBrowserDiagrams owns that tree.
(function initMermaidOnVisible() {
  var MERMAID_CDNS = [
    'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js',
    'https://unpkg.com/mermaid@10.9.1/dist/mermaid.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js'
  ];
  var mermaidLoadPromise = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-mermaid-cdn="1"][src="' + src + '"]');
      if (existing) {
        if (typeof window.mermaid !== 'undefined') {
          resolve(window.mermaid);
          return;
        }
        existing.addEventListener('load', function () {
          if (typeof window.mermaid !== 'undefined') resolve(window.mermaid);
          else reject(new Error('Mermaid missing after load'));
        });
        existing.addEventListener('error', function () {
          reject(new Error('Mermaid script error'));
        });
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.setAttribute('data-mermaid-cdn', '1');
      s.onload = function () {
        if (typeof window.mermaid !== 'undefined') resolve(window.mermaid);
        else reject(new Error('Mermaid missing after load'));
      };
      s.onerror = function () {
        reject(new Error('Failed to load ' + src));
      };
      document.head.appendChild(s);
    });
  }

  function loadMermaid() {
    if (typeof window.mermaid !== 'undefined') {
      return Promise.resolve(window.mermaid);
    }
    if (mermaidLoadPromise) return mermaidLoadPromise;

    function tryNext(i) {
      if (i >= MERMAID_CDNS.length) {
        mermaidLoadPromise = null;
        return Promise.resolve(null);
      }
      return loadScript(MERMAID_CDNS[i]).catch(function () {
        return tryNext(i + 1);
      });
    }

    mermaidLoadPromise = tryNext(0);
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
