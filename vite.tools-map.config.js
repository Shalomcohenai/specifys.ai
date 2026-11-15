import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// One production IIFE. The page loads this file; it does not compile JSX in the browser.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'tools/map',
    emptyOutDir: false,
    minify: 'esbuild',
    rollupOptions: {
      input: resolve('tools/map/tools-map-app.jsx'),
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'tools-map.bundle.js',
        name: 'SpecifysToolsMap'
      }
    }
  }
});
