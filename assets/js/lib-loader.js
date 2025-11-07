/**
 * Library Loader Module - Specifys.ai
 * Dynamically loads external libraries only when needed
 */

const LibraryLoader = {
  loaded: {},
  loading: {},

  /**
   * Load Mermaid library from CDN
   * @returns {Promise} Resolves when Mermaid is loaded
   */
  async loadMermaid() {
    if (this.loaded.mermaid) {
      return Promise.resolve(window.mermaid);
    }

    if (this.loading.mermaid) {
      return this.loading.mermaid;
    }

    this.loading.mermaid = new Promise((resolve, reject) => {
      if (typeof window.mermaid !== 'undefined') {
        this.loaded.mermaid = true;
        resolve(window.mermaid);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js';
      script.async = true;
      script.onload = () => {
        this.loaded.mermaid = true;
        delete this.loading.mermaid;
        resolve(window.mermaid);
      };
      script.onerror = () => {
        delete this.loading.mermaid;
        reject(new Error('Failed to load Mermaid library'));
      };
      document.head.appendChild(script);
    });

    return this.loading.mermaid;
  },

  /**
   * Load Marked library from CDN
   * @returns {Promise} Resolves when Marked is loaded
   */
  async loadMarked() {
    if (this.loaded.marked) {
      return Promise.resolve(window.marked);
    }

    if (this.loading.marked) {
      return this.loading.marked;
    }

    this.loading.marked = new Promise((resolve, reject) => {
      if (typeof window.marked !== 'undefined') {
        this.loaded.marked = true;
        resolve(window.marked);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js';
      script.async = true;
      script.onload = () => {
        this.loaded.marked = true;
        delete this.loading.marked;
        resolve(window.marked);
      };
      script.onerror = () => {
        delete this.loading.marked;
        reject(new Error('Failed to load Marked library'));
      };
      document.head.appendChild(script);
    });

    return this.loading.marked;
  },

  /**
   * Load Highlight.js library from CDN (both CSS and JS)
   * @returns {Promise} Resolves when Highlight.js is loaded
   */
  async loadHighlight() {
    if (this.loaded.highlight) {
      return Promise.resolve(window.hljs);
    }

    if (this.loading.highlight) {
      return this.loading.highlight;
    }

    this.loading.highlight = new Promise((resolve, reject) => {
      // Load CSS first
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css';
      document.head.appendChild(link);

      // Then load JS
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.loaded.highlight = true;
        delete this.loading.highlight;
        if (typeof window.hljs !== 'undefined' && window.hljs.highlightAll) {
          window.hljs.highlightAll();
        }
        resolve(window.hljs);
      };
      script.onerror = () => {
        delete this.loading.highlight;
        reject(new Error('Failed to load Highlight.js library'));
      };
      document.head.appendChild(script);
    });

    return this.loading.highlight;
  },

  /**
   * Load jsPDF library from CDN
   * @returns {Promise} Resolves when jsPDF is loaded
   */
  async loadJsPDF() {
    if (this.loaded.jspdf) {
      return Promise.resolve(window.jspdf || window.jsPDF);
    }

    if (this.loading.jspdf) {
      return this.loading.jspdf;
    }

    this.loading.jspdf = new Promise((resolve, reject) => {
      // Check if jsPDF is already available
      if (typeof window.jspdf !== 'undefined' || typeof window.jsPDF !== 'undefined') {
        this.loaded.jspdf = true;
        resolve(window.jspdf || window.jsPDF);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.async = true;
      script.onload = () => {
        // Wait a bit for the library to initialize
        setTimeout(() => {
          this.loaded.jspdf = true;
          delete this.loading.jspdf;
          // jsPDF can be available as window.jspdf.jsPDF or window.jsPDF
          const jspdf = window.jspdf?.jsPDF || window.jspdf || window.jsPDF;
          if (jspdf) {
            resolve(jspdf);
          } else {
            reject(new Error('jsPDF library loaded but not found on window object'));
          }
        }, 100);
      };
      script.onerror = () => {
        delete this.loading.jspdf;
        reject(new Error('Failed to load jsPDF library'));
      };
      document.head.appendChild(script);
    });

    return this.loading.jspdf;
  },

  /**
   * Load libraries based on requirements array
   * @param {string[]} libs - Array of library names to load (mermaid, marked, highlight, jspdf)
   * @returns {Promise} Resolves when all libraries are loaded
   */
  async loadLibraries(libs) {
    const promises = [];

    if (libs.includes('mermaid')) {
      promises.push(this.loadMermaid());
    }
    if (libs.includes('marked')) {
      promises.push(this.loadMarked());
    }
    if (libs.includes('highlight')) {
      promises.push(this.loadHighlight());
    }
    if (libs.includes('jspdf')) {
      promises.push(this.loadJsPDF());
    }

    return Promise.all(promises);
  },
};

// Make available globally (no ES6 modules - works with regular script tags)
window.LibraryLoader = LibraryLoader;
