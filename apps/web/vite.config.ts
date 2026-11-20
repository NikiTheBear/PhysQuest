import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // GitHub Pages 部署在子路径下（/PhysQuest/），本地开发是 /。
  // 构建时用环境变量 VITE_BASE 指定，CI 里已经设好。
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  // Fieldlab 构建时会把 dist/physquest-assets 的内容内联进 worker，
  // 所以目录名必须是这个。改这里要同步改 platform/scripts/build.mjs。
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
    // 自由搭建的工作台是独立服务（platform/），开发时把相关路径代理过去。
    // 用法：先在仓库根目录 node scripts/run-platform.mjs，再 npm run dev。
    proxy: {
      '/workbench': 'http://127.0.0.1:4317',
      '/api': 'http://127.0.0.1:4317',
      '/mcp': 'http://127.0.0.1:4317',
      '/app.js': 'http://127.0.0.1:4317',
      '/embedded.css': 'http://127.0.0.1:4317',
      '/light.css': 'http://127.0.0.1:4317',
      '/style.css': 'http://127.0.0.1:4317',
      '/favicon.svg': 'http://127.0.0.1:4317',
      '/experiments': 'http://127.0.0.1:4317',
      '/prompts': 'http://127.0.0.1:4317',
    },
    fs: { allow: ['..', '../..'] },
  },
});
