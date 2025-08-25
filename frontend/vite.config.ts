/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: { 
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React and React ecosystem
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
            return 'react-vendor'
          }
          
          // AWS Amplify and authentication
          if (id.includes('@aws-amplify') || id.includes('aws-sdk')) {
            return 'auth-vendor'
          }
          
          // Mapbox and map-related libraries
          if (id.includes('mapbox') || id.includes('map')) {
            return 'map-vendor'
          }
          
          // State management
          if (id.includes('zustand')) {
            return 'state-vendor'
          }
          
          // Other large vendor libraries
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        }
      }
    },
    // Increase chunk size warning limit to 2MB for map libraries (Mapbox is inherently large)
    chunkSizeWarningLimit: 2000,
    // Enable tree shaking
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log in production
        drop_debugger: true
      }
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: ['@aws-amplify/auth', '@aws-amplify/core'] // These will be code-split
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts']
  }
})
