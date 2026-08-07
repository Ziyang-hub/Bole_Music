/**
 * 伯乐模拟器 - 自动更新模块
 *
 * 使用 electron-updater 检查 GitHub Releases 上的新版本
 * 支持自动下载和安装更新
 */

import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';

// ----- 配置 -----

// 设置更新源为 GitHub Releases
autoUpdater.autoDownload = false;  // 不自动下载，让用户选择
autoUpdater.autoInstallOnAppQuit = true;  // 退出时安装

// 更新检查间隔（开发模式每 30 分钟，生产模式每 4 小时）
const CHECK_INTERVAL_DEV = 30 * 60 * 1000;
const CHECK_INTERVAL_PROD = 4 * 60 * 60 * 1000;

// ----- 类型 -----

export type UpdateStatus =
  | 'checking'       // 正在检查
  | 'available'      // 有更新可用
  | 'not-available'  // 已是最新
  | 'downloading'    // 正在下载
  | 'downloaded'     // 下载完成，等待安装
  | 'error';         // 出错

interface UpdateInfo {
  status: UpdateStatus;
  version?: string;
  releaseDate?: string;
  releaseNotes?: string;
  progress?: number;  // 下载进度 0-100
  error?: string;
}

// ----- 状态 -----

let currentUpdateInfo: UpdateInfo = { status: 'not-available' };
let mainWindow: BrowserWindow | null = null;

// ----- 初始化 -----

/**
 * 初始化自动更新
 * @param window 主窗口引用，用于发送更新事件
 */
export function initUpdater(window: BrowserWindow): void {
  mainWindow = window;

  // ----- 事件监听 -----

  autoUpdater.on('checking-for-update', () => {
    console.log('正在检查更新...');
    setStatus('checking');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('发现新版本:', info.version);
    setStatus('available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: typeof info.releaseNotes === 'string'
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map((n: any) => n.note || '').join('\n')
          : '',
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('已是最新版本');
    setStatus('not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    setStatus('downloading', { progress: Math.round(progress.percent) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('更新已下载:', info.version);
    setStatus('downloaded', { version: info.version });
  });

  autoUpdater.on('error', (err) => {
    console.error('更新出错:', err.message);
    setStatus('error', { error: err.message });
  });

  // 首次检查
  checkForUpdates();

  // 定时检查
  const interval = process.argv.includes('--dev')
    ? CHECK_INTERVAL_DEV
    : CHECK_INTERVAL_PROD;

  setInterval(() => {
    checkForUpdates();
  }, interval);
}

// ----- 公开 API -----

/**
 * 检查是否有新版本
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  try {
    await autoUpdater.checkForUpdates();
  } catch (err: any) {
    console.error('检查更新失败:', err.message);
    setStatus('error', { error: err.message });
  }
  return { ...currentUpdateInfo };
}

/**
 * 下载更新
 */
export async function downloadUpdate(): Promise<void> {
  try {
    await autoUpdater.downloadUpdate();
  } catch (err: any) {
    console.error('下载更新失败:', err.message);
    setStatus('error', { error: err.message });
  }
}

/**
 * 安装更新并重启
 */
export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true);
}

/**
 * 获取当前更新状态
 */
export function getUpdateStatus(): UpdateInfo {
  return { ...currentUpdateInfo };
}

// ----- 内部函数 -----

function setStatus(status: UpdateStatus, extra?: Partial<UpdateInfo>): void {
  currentUpdateInfo = {
    status,
    version: extra?.version ?? currentUpdateInfo.version,
    releaseDate: extra?.releaseDate ?? currentUpdateInfo.releaseDate,
    releaseNotes: extra?.releaseNotes ?? currentUpdateInfo.releaseNotes,
    progress: extra?.progress,
    error: extra?.error,
  };

  // 通知渲染进程
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:statusChanged', currentUpdateInfo);
  }
}
