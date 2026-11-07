import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

// Entradas independentes: não alterar vite.config.ts, index.html ou o build web.
const platform = process.env.JAPANFLOW_NATIVE_TARGET === 'android' ? 'android' : 'desktop';
const entry = platform === 'android' ? 'mobile.html' : 'desktop.html';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    host: '127.0.0.1',
    port: 8081,
    strictPort: true,
    watch: {
      ignored: [
        '**/qa-results/**',
        '**/qa-report/**',
        '**/src-tauri/**',
        '**/target/**',
        '**/android/**',
        '**/.gradle/**',
        '**/dist-desktop/**',
        '**/dist-android/**',
      ],
    },
  },
  build: {
    outDir: platform === 'android' ? 'dist-android' : 'dist-desktop',
    emptyOutDir: true,
    rollupOptions: { input: path.resolve(__dirname, entry) },
  },
});
