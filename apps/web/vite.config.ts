import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // GitHub Pages 部署在子路径下（/PhysQuest/），本地开发是 /。
  // 构建时用环境变量 VITE_BASE 指定，CI 里已经设好。
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  build: { assetsDir: 'physquest-assets' },
  resolve: {
    alias: {
      '@knowledge': fileURLToPath(new URL('../../shared/knowledge-data', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5180,
    open: false,
    proxy: { '/workbench': 'http://127.0.0.1:4317', '/api': 'http://127.0.0.1:4317', '/mcp': 'http://127.0.0.1:4317', '/app.js': 'http://127.0.0.1:4317', '/light.css': 'http://127.0.0.1:4317', '/style.css': 'http://127.0.0.1:4317', '/favicon.svg': 'http://127.0.0.1:4317' },
    fs: { allow: ['..', '../..'] },
  },
});
