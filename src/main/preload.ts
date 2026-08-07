/**
 * 伯乐模拟器 - Preload 脚本
 *
 * 安全地将主进程 API 暴露给渲染进程（前端）
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // ----- 应用信息 -----
  platform: process.platform,

  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // ----- 消息存储 -----
  getMessages: () => ipcRenderer.invoke('store:getMessages'),
  addMessage: (msg: any) => ipcRenderer.invoke('store:addMessage', msg),
  clearMessages: () => ipcRenderer.invoke('store:clearMessages'),

  // ----- 设置 -----
  getSettings: () => ipcRenderer.invoke('store:getSettings'),
  updateSettings: (partial: any) =>
    ipcRenderer.invoke('store:updateSettings', partial),

  // ----- 歌曲分析 -----
  analyzeSong: (songName: string, artist?: string) =>
    ipcRenderer.invoke('ai:analyzeSong', songName, artist),

  chat: (history: { role: string; content: string }[]) =>
    ipcRenderer.invoke('ai:chat', history),

  // ----- 听歌日记 -----
  getDiary: () => ipcRenderer.invoke('store:getDiary'),
  addDiaryEntry: (entry: any) =>
    ipcRenderer.invoke('store:addDiaryEntry', entry),

  // ----- 统计 -----
  getStats: () => ipcRenderer.invoke('store:getStats'),

  // ----- 数据管理 -----
  getAllData: () => ipcRenderer.invoke('store:getAllData'),
  resetAllData: () => ipcRenderer.invoke('store:resetAllData'),
});
