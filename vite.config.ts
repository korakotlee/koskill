import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: 'src/client',
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './src/core'),
      '@client': path.resolve(__dirname, './src/client/src'),
      '@server': path.resolve(__dirname, './src/server')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3900',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    passWithNoTests: true,
    root: path.resolve(__dirname, '.'),
    include: ['src/**/*.{test,spec}.{ts,tsx}']
  }
} as any);
