import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Enable Fast Refresh
      fastRefresh: true,
      // Use automatic JSX runtime
      jsxRuntime: 'automatic',
    }),
  ],

  // Path resolution
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Development server
  server: {
    port: 3001,
    strictPort: false,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  // Dependency optimization
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      'immer',
      '@xyflow/react',
      'fast-deep-equal',
    ],
  },

  // Build optimizations
  build: {
    // Output directory
    outDir: 'dist',

    // Generate sourcemaps for production debugging (can be disabled for smaller builds)
    sourcemap: false,

    // Minification
    minify: 'terser',

    // Terser options for better compression
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'], // Remove specific console methods
      },
      format: {
        comments: false, // Remove comments
      },
    },

    // Chunk size warning limit (500kb)
    chunkSizeWarningLimit: 500,

    // Rollup options for code splitting
    rollupOptions: {
      output: {
        // Manual chunk splitting strategy
        manualChunks: {
          // Vendor chunk: React and related libraries
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],

          // State management
          'vendor-state': ['zustand', 'immer'],

          // Diagram library (can be large, separate chunk)
          'vendor-diagram': ['@xyflow/react'],

          // Icons (can be large, separate chunk)
          'vendor-icons': ['lucide-react'],

          // Utilities
          'vendor-utils': ['fast-deep-equal'],
        },

        // Asset file naming
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];

          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          if (/woff|woff2|eot|ttf|otf/i.test(ext)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },

        // Chunk file naming
        chunkFileNames: 'js/[name]-[hash].js',

        // Entry file naming
        entryFileNames: 'js/[name]-[hash].js',
      },
    },

    // CSS code splitting
    cssCodeSplit: true,

    // Report compressed size
    reportCompressedSize: true,

    // Target browsers
    target: 'es2015',

    // Polyfills
    cssTarget: 'chrome61',
  },

  // Preview server (for production build preview)
  preview: {
    port: 4173,
    strictPort: false,
    host: true,
  },
});
