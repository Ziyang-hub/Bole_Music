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
  updateDiaryEntry,
  deleteDiaryEntry,
  getStats,
  updateStats,
  getAllData,
  resetAllData,
} from './store';
import { analyzeSong, chat, generateReport, recommendSongs } from './ai-service';
import {
  startCapture,
  stopCapture,
  isCapturing,
  checkCaptureCapability,
} from './audio-capture';
import { recognizeSong, isMaybeMusic } from './song-recognition';
import {
  initUpdater,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  getUpdateStatus,
} from './updater';
import {
  searchSongs,
  getLyrics,
  getSongDetail,
  parseSongUrl,
  isSongUrl,
  getSongFullInfo,
} from './music-platforms';
import { getCachedAnalysis, cacheAnalysis } from './store';

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
    // 生产模式下启用自动更新
    initUpdater(mainWindow);
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
  async (_e, songName: string, artist?: string, lyricsText?: string) => {
    try {
      // 先查缓存
      const cacheKey = `${songName}_${artist || ''}`.trim();
      const cached = getCachedAnalysis(cacheKey);
      if (cached) {
        return { success: true, data: cached, cached: true };
      }

      // AI 分析（传入真实歌词）
      const rawResult = await analyzeSong(songName, artist, lyricsText);

      // 添加 analyzedAt 时间戳
      const result = { ...rawResult, analyzedAt: new Date().toISOString() };

      // 缓存结果
      cacheAnalysis(cacheKey, result);

      // 更新统计数据
      updateStats(songName, artist || result.artist || '未知', result.genre || '未知');

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
ipcMain.handle('store:updateDiaryEntry', async (_e, date, entry) =>
  updateDiaryEntry(date, entry)
);
ipcMain.handle('store:deleteDiaryEntry', async (_e, date) =>
  deleteDiaryEntry(date)
);

// ----- 统计 -----

ipcMain.handle('store:getStats', async () => getStats());
ipcMain.handle('store:updateStats', async (_e, songName, artist, genre) =>
  updateStats(songName, artist, genre)
);

// ----- AI 报告和推荐 -----

ipcMain.handle(
  'ai:generateReport',
  async (_e, type, songs, stats) => {
    try {
      const result = await generateReport(type, songs, stats);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
);

ipcMain.handle(
  'ai:recommendSongs',
  async (_e, recentSongs, topGenres, topArtists) => {
    try {
      const result = await recommendSongs(recentSongs, topGenres, topArtists);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
);

// ----- 音频采集 -----

ipcMain.handle('audio:startCapture', async () => {
  const onChunk = async (audioPath: string) => {
    // 检测是否为音乐
    if (!isMaybeMusic(audioPath)) return;

    // 尝试识别歌曲
    const result = await recognizeSong(audioPath);
    if (result && result.confidence > 50) {
      // 通知渲染进程
      if (mainWindow) {
        mainWindow.webContents.send('audio:songDetected', result);
      }
    }
  };

  startCapture(onChunk);
  return { success: true };
});

ipcMain.handle('audio:stopCapture', async () => {
  stopCapture();
  return { success: true };
});

ipcMain.handle('audio:isCapturing', async () => {
  return isCapturing();
});

ipcMain.handle('audio:checkCapability', async () => {
  return checkCaptureCapability();
});

ipcMain.handle('audio:recognizeFile', async (_e, audioPath: string) => {
  const result = await recognizeSong(audioPath);
  return result;
});

// ----- 音乐平台 -----

ipcMain.handle('music:search', async (_e, keyword: string, limit?: number) => {
  try {
    const songs = await searchSongs(keyword, limit || 10);
    return { success: true, data: songs };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('music:getLyrics', async (_e, songId: string) => {
  try {
    const lyrics = await getLyrics(songId);
    return { success: true, data: lyrics };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('music:getSongDetail', async (_e, songId: string) => {
  try {
    const detail = await getSongDetail(songId);
    return { success: true, data: detail };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('music:parseUrl', async (_e, url: string) => {
  const parsed = parseSongUrl(url);
  if (!parsed) return { success: false, error: '无法识别该链接' };

  const info = await getSongFullInfo(parsed.songId);
  return {
    success: true,
    data: {
      platform: parsed.platform,
      songId: parsed.songId,
      song: info.song,
      lyrics: info.lyrics,
    },
  };
});

ipcMain.handle('music:isSongUrl', async (_e, text: string) => {
  return isSongUrl(text);
});

// ----- 自动更新 -----

ipcMain.handle('update:check', async () => {
  return await checkForUpdates();
});

ipcMain.handle('update:download', async () => {
  await downloadUpdate();
  return getUpdateStatus();
});

ipcMain.handle('update:install', async () => {
  installUpdate();
});

ipcMain.handle('update:getStatus', async () => {
  return getUpdateStatus();
});

// ----- 数据管理 -----

ipcMain.handle('store:getAllData', async () => getAllData());
ipcMain.handle('store:resetAllData', async () => resetAllData());
