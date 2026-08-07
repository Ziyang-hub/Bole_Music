/**
 * 伯乐模拟器 - Electron 主进程
 *
 * 主进程是 Electron 应用的"大脑"，负责：
 * 1. 创建和管理应用窗口
 * 2. 与操作系统交互（系统音频采集等）
 * 3. 管理应用生命周期
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

// 主窗口引用
let mainWindow: BrowserWindow | null = null;

/**
 * 创建主应用窗口
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '伯乐模拟器',
    // 窗口背景色（在页面加载前显示）
    backgroundColor: '#1a1a2e',
    // 窗口样式
    titleBarStyle: 'hiddenInset', // Mac 上使用内嵌标题栏
    // Web 配置
    webPreferences: {
      // preload 脚本路径
      preload: path.join(__dirname, 'preload.js'),
      // 安全设置
      nodeIntegration: false,      // 不允许渲染进程直接使用 Node.js
      contextIsolation: true,       // 启用上下文隔离（安全）
      sandbox: false,               // 允许 preload 使用 Node API
    },
  });

  // 开发模式：加载 Vite 开发服务器
  // 生产模式：加载打包后的文件
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    // Vite 开发服务器地址
    mainWindow.loadURL('http://localhost:5173');
    // 自动打开开发者工具
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式加载打包后的 HTML
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // 窗口关闭时清除引用
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * 应用准备就绪后创建窗口
 */
app.whenReady().then(() => {
  createWindow();

  // macOS: 点击 Dock 图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * 所有窗口关闭时退出应用
 * macOS 除外：macOS 应用通常保持活跃直到用户按 Cmd+Q
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================================
// IPC 通信处理
// 渲染进程通过 IPC 与主进程通信，主进程可以访问系统资源
// ============================================================

/**
 * 示例：接收渲染进程发来的消息
 * 后续可以在这里添加音频采集、文件操作等功能
 */
ipcMain.handle('greet', async (_event, name: string) => {
  console.log(`渲染进程发来问候：${name}`);
  return `你好，${name}！我是伯乐模拟器的主进程。`;
});

/**
 * 获取应用信息
 */
ipcMain.handle('get-app-info', async () => {
  return {
    name: '伯乐模拟器',
    version: app.getVersion(),
    platform: process.platform,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
  };
});
