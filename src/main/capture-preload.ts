/**
 * 伯乐模拟器 - 音频采集窗口 Preload
 *
 * 为隐藏的音频采集窗口提供 IPC 通信和桌面捕获能力。
 * 配合 mac-audio-capture.ts 使用。
 */

import { contextBridge, ipcRenderer, desktopCapturer } from 'electron';

contextBridge.exposeInMainWorld('captureAPI', {
  // 监听主进程的命令
  onStart: (callback: (opts: { chunkSec: number }) => void) => {
    ipcRenderer.on('mac-capture:start', (_e, opts) => callback(opts));
  },
  onStop: (callback: () => void) => {
    ipcRenderer.on('mac-capture:stop', () => callback());
  },

  // 发送音频数据到主进程
  sendChunk: (data: ArrayBuffer) => {
    ipcRenderer.send('mac-capture:chunk', Buffer.from(data));
  },
  sendError: (msg: string) => {
    ipcRenderer.send('mac-capture:error', msg);
  },

  // 获取桌面屏幕源（用于 system audio 捕获）
  getScreenSources: async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1, height: 1 },
      fetchWindowIcons: false,
    });
    return sources.map(s => ({ id: s.id, name: s.name }));
  },
});
