import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-exceljs': ['exceljs'],
          'vendor-bwipjs': ['bwip-js/browser'],
          'vendor-jspdf': ['jspdf'],
          'vendor-pptxgenjs': ['pptxgenjs'],
          'vendor-qrcode': ['qrcode'],
          'vendor-icons': ['lucide-react'],
          'vendor-react': ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    hmr: false,
  },
});
