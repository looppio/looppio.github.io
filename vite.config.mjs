import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  build: {
    outDir: 'dist/client',
    rollupOptions: {
      output: {
        // Stable vendor files keep case content edits from invalidating the renderer cache.
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'graphics';
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor';
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom/client'],
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['terminal.local'],
    warmup: {
      clientFiles: ['./src/main.jsx'],
    },
  },
  plugins: [react()],
});
