/**
 * 伯乐模拟器 - Preload 脚本
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  // ----- 应用信息 -----
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // ----- 系统功能 -----
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke('app:showNotification', title, body),
  getTheme: () => ipcRenderer.invoke('app:getTheme'),
  onNavigate: (callback: (view: string) => void) => {
    ipcRenderer.on('navigate', (_e, view) => callback(view));
  },
  onSettingsChanged: (callback: (settings: any) => void) => {
    ipcRenderer.on('settings:changed', (_e, s) => callback(s));
  },

  // ----- 消息存储 -----
  getMessages: () => ipcRenderer.invoke('store:getMessages'),
  addMessage: (msg: any) => ipcRenderer.invoke('store:addMessage', msg),
  clearMessages: () => ipcRenderer.invoke('store:clearMessages'),

  // ----- 设置 -----
  getSettings: () => ipcRenderer.invoke('store:getSettings'),
  updateSettings: (partial: any) =>
    ipcRenderer.invoke('store:updateSettings', partial),

  // ----- AI 分析 -----
  analyzeSong: (songName: string, artist?: string, lyrics?: string) =>
    ipcRenderer.invoke('ai:analyzeSong', songName, artist, lyrics),

  chat: (history: { role: string; content: string }[]) =>
    ipcRenderer.invoke('ai:chat', history),

  generateReport: (type: string, songs: any[], stats: any) =>
    ipcRenderer.invoke('ai:generateReport', type, songs, stats),

  recommendSongs: (
    recentSongs: any[],
    topGenres: string[],
    topArtists: string[]
  ) => ipcRenderer.invoke('ai:recommendSongs', recentSongs, topGenres, topArtists),

  // ----- 听歌日记 -----
  getDiary: () => ipcRenderer.invoke('store:getDiary'),
  addDiaryEntry: (entry: any) =>
    ipcRenderer.invoke('store:addDiaryEntry', entry),
  updateDiaryEntry: (date: string, partial: any) =>
    ipcRenderer.invoke('store:updateDiaryEntry', date, partial),
  deleteDiaryEntry: (date: string) =>
    ipcRenderer.invoke('store:deleteDiaryEntry', date),

  // ----- 统计 -----
  getStats: () => ipcRenderer.invoke('store:getStats'),
  updateStats: (songName: string, artist: string, genre: string) =>
    ipcRenderer.invoke('store:updateStats', songName, artist, genre),

  // ----- 音频采集 -----
  startAudioCapture: () => ipcRenderer.invoke('audio:startCapture'),
  stopAudioCapture: () => ipcRenderer.invoke('audio:stopCapture'),
  isAudioCapturing: () => ipcRenderer.invoke('audio:isCapturing'),
  checkCaptureCapability: () => ipcRenderer.invoke('audio:checkCapability'),
  checkBackends: () => ipcRenderer.invoke('audio:checkBackends'),
  diagnoseAudio: () => ipcRenderer.invoke('audio:diagnose'),

  // ----- 音乐平台 -----
  searchSongs: (keyword: string, limit?: number) =>
    ipcRenderer.invoke('music:search', keyword, limit),
  getLyrics: (songId: string) =>
    ipcRenderer.invoke('music:getLyrics', songId),
  getSongDetail: (songId: string) =>
    ipcRenderer.invoke('music:getSongDetail', songId),
  parseSongUrl: (url: string) =>
    ipcRenderer.invoke('music:parseUrl', url),
  isSongUrl: (text: string) =>
    ipcRenderer.invoke('music:isSongUrl', text),
  isPlaylistUrl: (text: string) =>
    ipcRenderer.invoke('music:isPlaylistUrl', text),
  getPlaylist: (url: string) =>
    ipcRenderer.invoke('music:getPlaylist', url),

  // ----- 使用统计 -----
  trackUsage: (event: string, data?: any) =>
    ipcRenderer.invoke('stats:track', event, data),
  getUsageStats: () => ipcRenderer.invoke('stats:getUsage'),

  // 监听歌曲检测事件
  onSongDetected: (callback: (result: any) => void) => {
    ipcRenderer.on('audio:songDetected', (_event, result) => callback(result));
  },

  // ----- 自动更新 -----
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  getUpdateStatus: () => ipcRenderer.invoke('update:getStatus'),
  onUpdateStatusChanged: (callback: (info: any) => void) => {
    ipcRenderer.on('update:statusChanged', (_event, info) => callback(info));
  },

  // ----- 数据管理 -----
  getAllData: () => ipcRenderer.invoke('store:getAllData'),
  resetAllData: () => ipcRenderer.invoke('store:resetAllData'),
});
