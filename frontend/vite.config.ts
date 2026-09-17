import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    root: __dirname,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@server': path.resolve(__dirname, '../backend/src/server'),
      },
    },
    server: {
      port: 5173,
      allowedHosts: true as const,
      proxy: {
        '/api': 'http://127.0.0.1:3000',
        '/uploads': 'http://127.0.0.1:3000',
        '/healthz': 'http://127.0.0.1:3000',
        '/readyz': 'http://127.0.0.1:3000',
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
