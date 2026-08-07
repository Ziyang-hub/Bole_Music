/**
 * 伯乐模拟器 - Electron 主进程
 *
 * 负责：窗口管理、IPC 通信、调用存储服务和 AI 服务
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

// 导入服务模块
import {
  getMessages,
  addMessage,
  clearMessages,
  getSettings,
  updateSettings,
  getDiary,
  addDiaryEntry,
  getStats,
  getAllData,
  resetAllData,
} from './store';
import { analyzeSong, chat, generateDailySummary } from './ai-service';

// ----- 窗口管理 -----

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '伯乐模拟器',
    backgroundColor: '#1a1a2e',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================================
// IPC 通信处理
// ============================================================

// ----- 应用信息 -----

ipcMain.handle('get-app-info', async () => ({
  name: '伯乐模拟器',
  version: app.getVersion(),
  platform: process.platform,
  electronVersion: process.versions.electron,
  nodeVersion: process.versions.node,
}));

// ----- 消息存储 -----

ipcMain.handle('store:getMessages', async () => getMessages());
ipcMain.handle('store:addMessage', async (_e, msg) => addMessage(msg));
ipcMain.handle('store:clearMessages', async () => clearMessages());

// ----- 设置 -----

ipcMain.handle('store:getSettings', async () => getSettings());
ipcMain.handle('store:updateSettings', async (_e, partial) =>
  updateSettings(partial)
);

// ----- 歌曲分析 -----

ipcMain.handle(
  'ai:analyzeSong',
  async (_e, songName: string, artist?: string) => {
    try {
      const result = await analyzeSong(songName, artist);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle(
  'ai:chat',
  async (_e, history: { role: string; content: string }[]) => {
    try {
      const reply = await chat(history);
      return { success: true, data: reply };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
);

// ----- 听歌日记 -----

ipcMain.handle('store:getDiary', async () => getDiary());
ipcMain.handle('store:addDiaryEntry', async (_e, entry) =>
  addDiaryEntry(entry)
);

// ----- 统计 -----

ipcMain.handle('store:getStats', async () => getStats());

// ----- 数据管理 -----

ipcMain.handle('store:getAllData', async () => getAllData());
ipcMain.handle('store:resetAllData', async () => resetAllData());
