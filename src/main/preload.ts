/**
 * 伯乐模拟器 - Preload 脚本
 *
 * Preload 脚本是主进程和渲染进程之间的"桥梁"。
 * 它在渲染进程加载前执行，可以安全地暴露
 * 有限的 Node.js/Electron API 给前端使用。
 *
 * contextBridge.exposeInMainWorld() 将 API 暴露到
 * 前端的 window.electronAPI 对象上。
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * 暴露给渲染进程（前端）的安全 API
 *
 * 前端可以通过 window.electronAPI 访问这些方法
 * 例如：window.electronAPI.greet('小明')
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 发送问候并获取回复
   */
  greet: (name: string): Promise<string> => {
    return ipcRenderer.invoke('greet', name);
  },

  /**
   * 获取应用信息
   */
  getAppInfo: (): Promise<{
    name: string;
    version: string;
    platform: string;
    electronVersion: string;
    nodeVersion: string;
  }> => {
    return ipcRenderer.invoke('get-app-info');
  },

  /**
   * 获取当前平台（'win32' | 'darwin' | 'linux'）
   */
  platform: process.platform,
});
