import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Add Sentry plugin for source maps and releases
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disable: mode === 'development', // Only upload in production builds
    }),
  ],
  server: { 
    port: 5173,
    proxy: {
      // Route /api/* to API Gateway during development
      '/api': {
        target: process.env.VITE_API_BASE || 'https://api.daylight.example.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        headers: {
          'Cache-Control': 'no-cache'
        }
      }
    }
  },
  build: { 
    outDir: 'dist',
    // Source maps for Sentry error tracking
    sourcemap: true,
    // Enable hashed filenames for static assets (long TTL caching)
    rollupOptions: {
      output: {
        // Hash all asset files for cache busting
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name].[hash][extname]`;
          }
          if (/css/i.test(ext)) {
            return `assets/css/[name].[hash][extname]`;
          }
          return `assets/[name].[hash][extname]`;
        },
        // Hash JS chunk files
        chunkFileNames: 'assets/js/[name].[hash].js',
        entryFileNames: 'assets/js/[name].[hash].js'
      }
    },
    // Optimize chunks for better caching
    chunkSizeWarningLimit: 1000,
  },
  // Define environment variables
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __GIT_SHA__: JSON.stringify(process.env.GIT_SHA || 'unknown'),
  }
}))
