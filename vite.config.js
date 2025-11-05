import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import legacy from '@vitejs/plugin-legacy';
import path from 'path';

export default defineConfig({
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11'],
    }),
    viteStaticCopy({
      targets: [
        {
          src: 'assets/images/**/*',
          dest: 'images',
        },
      ],
    }),
  ],
  build: {
    outDir: 'assets/dist',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: {
        // CSS bundles
        'critical': path.resolve(__dirname, 'assets/css/bundles/critical.css'),
        'main': path.resolve(__dirname, 'assets/css/main.css'),
        
        // JS bundles
        'core': path.resolve(__dirname, 'assets/js/bundles/core.js'),
        'auth': path.resolve(__dirname, 'assets/js/bundles/auth.js'),
        'admin': path.resolve(__dirname, 'assets/js/bundles/admin.js'),
        'home': path.resolve(__dirname, 'assets/js/bundles/home.js'),
        'utils': path.resolve(__dirname, 'assets/js/bundles/utils.js'),
        'post': path.resolve(__dirname, 'assets/js/bundles/post.js'),
        'blog': path.resolve(__dirname, 'assets/js/bundles/blog.js'),
      },
      output: {
        entryFileNames: 'js/[name]-[hash].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.css')) {
            return 'css/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        manualChunks: {
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
    cssCodeSplit: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging
      },
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
