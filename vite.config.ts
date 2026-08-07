/**
 * 伯乐模拟器 - Vite 配置
 *
 * Vite 负责构建前端（渲染进程）代码
 * 开发时提供热更新开发服务器
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  // 开发服务器配置
  server: {
    port: 5173,
    strictPort: true, // 端口被占用时报错，而不是自动换端口
  },

  // 构建配置
  build: {
    // 输出到 dist/renderer
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },

  // 路径别名
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },

  // 基础路径（Electron 加载文件时使用相对路径）
  base: './',
});
