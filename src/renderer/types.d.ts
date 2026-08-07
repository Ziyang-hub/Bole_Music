/**
 * 伯乐模拟器 - 前端类型定义
 *
 * 声明 window.electronAPI 的类型，
 * 让 TypeScript 知道这个全局对象存在
 */

interface ElectronAPI {
  /** 发送问候 */
  greet: (name: string) => Promise<string>;
  /** 获取应用信息 */
  getAppInfo: () => Promise<{
    name: string;
    version: string;
    platform: string;
    electronVersion: string;
    nodeVersion: string;
  }>;
  /** 当前平台 */
  platform: string;
}

// 扩展 Window 接口
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
