/**
 * 伯乐模拟器 - Electron 主进程
 *
 * 负责：窗口管理、IPC 通信、调用存储服务和 AI 服务
 */

import { app, BrowserWindow, ipcMain, Tray, Menu, Notification, nativeImage, desktopCapturer } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// 导入服务模块
import {
  getMessages,
  addMessage,
  clearMessages,
  deleteMessage,
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
import { runAgent, generateReport, recommendSongs } from './ai-service';
import {
  startCapture,
  stopCapture,
  isCapturing,
  checkCaptureCapability,
  diagnose,
  registerAudioIpcHandlers,
  openScreenRecordingSettings,
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
  isPlaylistUrl,
  parsePlaylistUrl,
  getPlaylistSongs,
} from './music-platforms';
import { getCachedAnalysis, cacheAnalysis, clearAnalysisCache, trackUsage, getUsageStats } from './store';

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

  // 拦截网易云CDN请求，自动加 Referer 绕过防盗链
  const { session: { defaultSession } } = require('electron');
  defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.music.126.net/*'] },
    (details: any, callback: any) => {
      details.requestHeaders['Referer'] = 'https://music.163.com/';
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  // 注册 macOS 音频采集的 IPC
  registerAudioIpcHandlers();

  // 恢复自动采集（如果用户之前开启过）
  const settings = getSettings();
  if (settings.autoListen) {
    const onChunk = async (audioPath: string, createdAt?: number) => {
      // 跳过超过 60 秒的过期 chunk
      const age = createdAt ? Date.now() - createdAt : 0;
      if (age > 60000) {
        console.log('[audio] Auto-restore: skipped stale chunk (age:', Math.round(age / 1000), 's)');
        return;
      }
      if (!isMaybeMusic(audioPath)) return;
      console.log('[audio] Auto-restore: recognizing:', path.basename(audioPath));
      const result = await recognizeSong(audioPath);
      if (result && result.confidence > 50) {
        const key = `${result.title}|${result.artist}`;
        const now = Date.now();
        if (key === lastDetectedSong && now - lastDetectedTime < 2 * 60 * 1000) {
          console.log('[audio] Auto-restore: dedup skipped:', key);
          return;
        }
        lastDetectedSong = key;
        lastDetectedTime = now;
        if (mainWindow) {
          console.log('[audio] Auto-restore: detected:', result.title);
          mainWindow.webContents.send('audio:songDetected', result);
        }
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

  // 真正退出前清理临时文件
  app.on('before-quit', () => {
    isQuitting = true;
    // 清理音频采集临时目录
    const audioDir = path.join(require('os').tmpdir(), 'bole-simulator-audio');
    try {
      if (fs.existsSync(audioDir)) {
        fs.rmSync(audioDir, { recursive: true, force: true });
        console.log('[app] Cleaned up temp audio directory');
      }
    } catch (e) {
      console.log('[app] Failed to clean temp directory:', e);
    }
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
ipcMain.handle('store:deleteMessage', async (_e, id: string) => deleteMessage(id));

// ----- 设置 -----

ipcMain.handle('store:getSettings', async () => getSettings());
ipcMain.handle('store:updateSettings', async (_e, partial) => {
  const updated = updateSettings(partial);

  // 如果配置了新的 API Key，重置去重状态让下次检测立即生效
  if (partial.apiKey && partial.apiKey.trim()) {
    lastDetectedSong = '';
    lastDetectedTime = 0;
    // 同时清除歌曲分析缓存，让新 API Key 的分析结果生效
    clearAnalysisCache();
    console.log('[app] API key updated, reset dedup + cache');
  }

  // 通知渲染进程设置已变更（主题等需要实时生效）
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings:changed', updated);
  }
  return updated;
});

// ----- 歌曲分析（通过 Agent）-----

ipcMain.handle(
  'ai:analyzeSong',
  async (_e, songName: string, artist?: string, lyricsText?: string) => {
    try {
      console.log('[ipc:analyzeSong] Called:', songName, artist || '(no artist)');

      // 先查缓存
      const cacheKey = `${songName}_${artist || ''}`.trim();
      const cached = getCachedAnalysis(cacheKey);
      if (cached) {
        console.log('[ipc:analyzeSong] Cache HIT, returning cached result');
        return { success: true, data: cached, cached: true };
      }
      console.log('[ipc:analyzeSong] Cache MISS, calling runAgent...');

      // 用 Agent 分析（自然语言，不再强制 JSON）
      const artistHint = artist ? ` — ${artist}` : '';
      const message = `🎧 请帮我分析一下这首歌：《${songName}》${artistHint}\n\n请在回复中自然提及这首歌的音乐风格/流派（如：流行摇滚、民谣、电子、爵士等），并在回复最后一行单独写【曲风：XXX】来标注。`;
      const reply = await runAgent(message, []);

      // 从回复中提取曲风，并清理显示文本
      let genre = '';
      const cleanReply = reply.replace(/【曲风[：:].+?】\s*/g, '').trim();
      const genreMatch = reply.match(/【曲风[：:]\s*(.+?)】/);
      if (genreMatch) {
        genre = genreMatch[1].trim();
      }

      // 将 Agent 的自然语言回复包装为 AnalysisResult
      const result = {
        songName,
        artist: artist || '未知',
        lyrics: '',
        emotion: '',
        genre,
        story: '',
        personalThought: cleanReply || reply,
        analyzedAt: new Date().toISOString(),
      };

      // 缓存结果
      cacheAnalysis(cacheKey, result);

      // 更新统计数据（使用提取到的曲风）
      updateStats(songName, artist || '未知', genre);
      console.log('[ipc:analyzeSong] Stats updated, genre:', genre || '(not found)');

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
  async (_e, history: { role: string; content: string }[], userMessage: string) => {
    try {
      console.log('[ipc:chat] Called, historyLen:', history?.length, 'msg:', userMessage?.slice(0, 30));
      const reply = await runAgent(userMessage, history);
      console.log('[ipc:chat] Reply length:', reply?.length);
      trackUsage('chat');
      return { success: true, data: reply };
    } catch (error: any) {
      console.error('[ipc:chat] ERROR:', error.message);
      console.error('[ipc:chat] STACK:', error.stack);
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
  const onChunk = async (audioPath: string, createdAt?: number) => {
    // 跳过超过 60 秒的过期 chunk，避免识别队列积压
    const age = createdAt ? Date.now() - createdAt : 0;
    if (age > 60000) {
      console.log('[audio] Skipped stale chunk (age:', Math.round(age / 1000), 's):', path.basename(audioPath));
      return;
    }

    if (!isMaybeMusic(audioPath)) {
      console.log('[audio] Skipped non-music:', path.basename(audioPath));
      return;
    }

    console.log('[audio] Recognizing:', path.basename(audioPath), age > 0 ? `(age: ${Math.round(age / 1000)}s)` : '');
    const result = await recognizeSong(audioPath);
    if (result) {
      console.log('[audio] ✅ Matched:', result.title, '-', result.artist);
    } else {
      console.log('[audio] ❌ No match for:', path.basename(audioPath));
      return;
    }

    if (result.confidence > 50) {
      const key = `${result.title}|${result.artist}`;
      const now = Date.now();
      // 2 分钟去重窗口（同一首歌不重复通知）
      if (key === lastDetectedSong && now - lastDetectedTime < 2 * 60 * 1000) {
        console.log('[audio] 🔄 Dedup skipped:', key);
        return;
      }
      lastDetectedSong = key;
      lastDetectedTime = now;

      if (mainWindow) {
        console.log('[audio] 📤 Sending songDetected:', result.title);
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

// 图片代理：绕过网易云防盗链（主进程带 Referer 下载 → data URI）
ipcMain.handle('image:fetch', async (_e, url: string) => {
  try {
    const resp = await fetch(url, {
      headers: {
        'Referer': 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
    if (!resp.ok) return null;
    const buffer = Buffer.from(await resp.arrayBuffer());
    const contentType = resp.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
});

// 哼歌识别：接收音频 Buffer → 保存临时文件 → Shazam 识别
ipcMain.handle('audio:recognizeBlob', async (_e, data: Buffer) => {
  try {
    const tmpPath = path.join(require('os').tmpdir(), `hum_${Date.now()}.webm`);
    await fs.promises.writeFile(tmpPath, data);
    const result = await recognizeSong(tmpPath);
    fs.promises.unlink(tmpPath).catch(() => {});
    return result;
  } catch (err: any) {
    console.error('[audio:recognizeBlob] Error:', err.message);
    return null;
  }
});

ipcMain.handle('desktop-capturer:getSources', async () => {
  try {
    console.log('[main] desktopCapturer type:', typeof desktopCapturer);
    console.log('[main] desktopCapturer.getSources type:', typeof desktopCapturer.getSources);
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1, height: 1 },
    });
    console.log('[main] desktopCapturer sources:', sources.length);
    return sources.map(s => ({ id: s.id, name: s.name }));
  } catch (err: any) {
    console.error('[main] desktopCapturer error type:', typeof err);
    console.error('[main] desktopCapturer error keys:', Object.keys(err || {}));
    console.error('[main] desktopCapturer raw error:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    return [];
  }
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

ipcMain.handle('music:search', async (_e, keyword: string, limit?: number, offset?: number) => {
  try {
    const songs = await searchSongs(keyword, limit || 10, offset || 0);
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
