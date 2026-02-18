import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Try to use custom certificates for better security, fallback to basic SSL
let httpsOptions = true; // Use basicSsl by default
try {
  httpsOptions = {
    key: readFileSync('./certs/dev.key'),
    cert: readFileSync('./certs/dev.crt')
  };
  console.log('🔒 Using custom SSL certificates for development');
} catch (e) {
  console.log('🔓 Using basic SSL certificates (run ./generate-certs.sh for better security)');
}

export default defineConfig({
  plugins: [
    // HTTPS is required for WebXR
    basicSsl()
  ],
  server: {
    https: httpsOptions,
    host: true,
    port: 3000,
    proxy: {
      // Proxy backend requests during development
      // Backend: https://api.ardemo.co.za
      '/api': {
        target: 'https://api.ardemo.co.za',
        changeOrigin: true,
        secure: true
      },
      // Static files served by backend (models, images, defaults)
      '/uploads': {
        target: 'https://api.ardemo.co.za',
        changeOrigin: true,
        secure: true
      },
      '/defaults': {
        target: 'https://api.ardemo.co.za',
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
