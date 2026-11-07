import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: '0.0.0.0',
    port: 8080,
    hmr: {
      overlay: false,
    },
    watch: {
      ignored: [
        '**/qa-results/**',
        '**/qa-report/**',
        '**/src-tauri/**',
        '**/target/**',
        '**/android/**/build/**',
        '**/.gradle/**',
      ],
    },
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Somente dependencias pesadas de recursos opcionais.
          // Nao separar React, Firebase nem providers globais.
          if (id.includes('/node_modules/recharts/') || id.includes('\\node_modules\\recharts\\')) {
            return 'charts-vendor';
          }
          if (id.includes('/node_modules/@tiptap/') || id.includes('\\node_modules\\@tiptap\\')) {
            return 'editor-vendor';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}));
