import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    // HTTPS is required for WebXR
    basicSsl()
  ],
  server: {
    https: true,
    host: true,
    port: 3000,
    proxy: {
      // Proxy backend requests during development
      // Backend: https://ardemo.co.za
      '/api': {
        target: 'https://ardemo.co.za',
        changeOrigin: true,
        secure: true
      },
      // Static files served by backend (models, images, defaults)
      '/uploads': {
        target: 'https://ardemo.co.za',
        changeOrigin: true,
        secure: true
      },
      '/defaults': {
        target: 'https://ardemo.co.za',
        changeOrigin: true,
        secure: true
      }
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js'
      }
    }
  }
});
