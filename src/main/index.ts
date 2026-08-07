/**
 * 伯乐模拟器 - Electron 主进程
 *
 * 负责：窗口管理、IPC 通信、调用存储服务和 AI 服务
 */

import { app, BrowserWindow, ipcMain, Tray, Menu, Notification, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

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
  diagnose,
  registerAudioIpcHandlers,
  requestScreenPermission,
  setMainWindow as setAudioMainWindow,
  openScreenRecordingSettings,
} from './audio-capture';
import { recognizeSong, isMaybeMusic, checkBackends } from './song-recognition';
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
  isPlaylistUrl,
  parsePlaylistUrl,
  getPlaylistSongs,
} from './music-platforms';
import { getCachedAnalysis, cacheAnalysis, trackUsage, getUsageStats } from './store';

// ----- 窗口管理 -----

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

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
    initUpdater(mainWindow);
  }

  // 关闭窗口 → 隐藏到托盘（而不是退出）
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ----- 系统托盘 -----

function createTray(): void {
  // 尝试多个路径找到图标
  const possiblePaths = [
    path.join(__dirname, '../../resources/icon-256.png'),
    path.join(process.resourcesPath || '', 'icon-256.png'),
    path.join(app.getAppPath(), 'resources', 'icon-256.png'),
  ];
  let trayIcon: Electron.NativeImage = nativeImage.createEmpty();

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      trayIcon = nativeImage.createFromPath(p).resize({ width: 16, height: 16 });
      break;
    }
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('伯乐模拟器');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: '知音对话',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
        mainWindow?.webContents.send('navigate', 'chat');
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // 点击托盘图标显示窗口
  tray.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

// ----- 系统通知 -----

function showNotification(title: string, body: string): void {
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title,
    body,
    icon: path.join(__dirname, '../../resources/icon-256.png'),
  });

  notification.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  notification.show();
}

// ----- 应用生命周期 -----

app.whenReady().then(() => {
  createWindow();
  createTray();

  // macOS 音频采集需要主窗口引用
  if (mainWindow) setAudioMainWindow(mainWindow);

  // 注册 macOS 音频采集的 IPC
  registerAudioIpcHandlers();

  // 恢复自动采集（如果用户之前开启过）
  const settings = getSettings();
  if (settings.autoListen) {
    const onChunk = async (audioPath: string) => {
      if (!isMaybeMusic(audioPath)) return;
      const result = await recognizeSong(audioPath);
      if (result && result.confidence > 50) {
        const key = `${result.title}|${result.artist}`;
        const now = Date.now();
        if (key === lastDetectedSong && now - lastDetectedTime < 5 * 60 * 1000) return;
        lastDetectedSong = key;
        lastDetectedTime = now;
        if (mainWindow) mainWindow.webContents.send('audio:songDetected', result);
      }
    };
    startCapture(onChunk);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });

  // 所有窗口关闭时隐藏到托盘（不退出）
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      // Windows/Linux: 不退出，留在托盘
    }
  });

  // 真正退出前清理
  app.on('before-quit', () => {
    isQuitting = true;
  });
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

// ----- 系统功能 -----

ipcMain.handle('app:showNotification', async (_e, title: string, body: string) => {
  showNotification(title, body);
});

ipcMain.handle('app:getTheme', async () => {
  return getSettings().theme || 'dark';
});

// ----- 消息存储 -----

ipcMain.handle('store:getMessages', async () => getMessages());
ipcMain.handle('store:addMessage', async (_e, msg) => addMessage(msg));
ipcMain.handle('store:clearMessages', async () => clearMessages());

// ----- 设置 -----

ipcMain.handle('store:getSettings', async () => getSettings());
ipcMain.handle('store:updateSettings', async (_e, partial) => {
  const updated = updateSettings(partial);
  // 通知渲染进程设置已变更（主题等需要实时生效）
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings:changed', updated);
  }
  return updated;
});

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

      // 追踪使用
      trackUsage('analysis');

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
      trackUsage('chat');
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

let lastDetectedSong = '';
let lastDetectedTime = 0;

ipcMain.handle('audio:startCapture', async () => {
  const onChunk = async (audioPath: string) => {
    if (!isMaybeMusic(audioPath)) return;

    const result = await recognizeSong(audioPath);
    if (result && result.confidence > 50) {
      // 去重：同一首歌5分钟内不重复通知
      const key = `${result.title}|${result.artist}`;
      const now = Date.now();
      if (key === lastDetectedSong && now - lastDetectedTime < 5 * 60 * 1000) {
        return;
      }
      lastDetectedSong = key;
      lastDetectedTime = now;

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

ipcMain.handle('audio:checkBackends', async () => {
  return await checkBackends();
});

ipcMain.handle('audio:openScreenSettings', async () => {
  await openScreenRecordingSettings();
});

ipcMain.handle('audio:diagnose', async () => {
  // 获取平台特定的音频诊断
  const audioDiag = await diagnose();

  const ok: string[] = [];
  const issues: string[] = [];

  // 1. ffmpeg（非 macOS 平台显示）
  if (process.platform !== 'darwin') {
    ok.push('ffmpeg 已内置');
  }

  // 2. 音频设备/权限诊断
  ok.push(...audioDiag.ok);
  issues.push(...audioDiag.issues);

  // 3. 检查识别后端（Shazam 始终可用）
  ok.push('歌曲识别: Shazam（免费，零配置）');

  // 4. 检查 AI 服务
  const settings = getSettings();
  if (settings.apiKey) {
    ok.push('AI 服务已配置');
  } else {
    issues.push('未配置 AI 服务（去设置页填 DeepSeek API Key）');
  }

  return { ok, issues, ready: issues.length === 0 };
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

ipcMain.handle('music:isPlaylistUrl', async (_e, text: string) => {
  return isPlaylistUrl(text);
});

ipcMain.handle('music:getPlaylist', async (_e, url: string) => {
  try {
    const playlistId = parsePlaylistUrl(url);
    if (!playlistId) return { success: false, error: '无法识别歌单链接' };
    const data = await getPlaylistSongs(playlistId);
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// 使用统计 IPC
ipcMain.handle('stats:track', async (_e, event: string, data?: any) => {
  trackUsage(event, data);
});

ipcMain.handle('stats:getUsage', async () => {
  return getUsageStats();
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
