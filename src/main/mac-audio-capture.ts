/**
 * 伯乐模拟器 - macOS 零安装系统音频采集
 *
 * 使用 getDisplayMedia + macOS ScreenCaptureKit 捕获系统音频输出。
 * 无需安装 BlackHole 等第三方虚拟音频设备。
 *
 * 要求 macOS 13+（Ventura）
 *
 * 架构：
 *   1. 主进程通知渲染进程「需要采集」
 *   2. 渲染进程调用 getDisplayMedia → macOS 弹出屏幕选择器
 *   3. 用户选择屏幕 → 权限授予 → 系统音频流开始
 *   4. 渲染进程 MediaRecorder 录制 → IPC → 主进程保存 WAV
 *   5. 已有识别流程处理 WAV 文件
 */

import { ipcMain, systemPreferences } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { cleanupOldChunks } from './audio-capture';

export type AudioChunkCallback = (audioPath: string, createdAt?: number) => void;

const AUDIO_DIR = path.join(os.tmpdir(), 'bole-simulator-audio');
const CHUNK_SEC = 15; // 15 秒足够 Shazam 匹配

let isRunning = false;
let onChunk: AudioChunkCallback | null = null;
let chunkIndex = 0;

// ============================================================
// 公开 API
// ============================================================

export function startCapture(callback: AudioChunkCallback): boolean {
  if (isRunning) return false;
  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

  onChunk = callback;
  isRunning = true;
  chunkIndex = 0;
  // 渲染进程通过 SettingsPage 直接调用 startSystemAudioCapture()
  return true;
}

export function stopCapture(): void {
  isRunning = false;
}

export function isCapturing(): boolean { return isRunning; }

export async function checkCaptureCapability(): Promise<{
  available: boolean; platform: string; needs: string[];
}> {
  const majorVer = await _macosMajorVersion();
  if (majorVer < 13) {
    return {
      available: false,
      platform: 'darwin',
      needs: ['需要 macOS 13 (Ventura) 或更新版本'],
    };
  }

  const perm = systemPreferences.getMediaAccessStatus('screen');
  const needs: string[] = [];

  if (perm !== 'granted') {
    needs.push('需要屏幕录制权限（开启采集时会弹出系统对话框）');
  }

  return { available: true, platform: 'darwin', needs };
}

export async function requestScreenPermission(): Promise<boolean> {
  return systemPreferences.getMediaAccessStatus('screen') === 'granted';
}

export async function diagnose(): Promise<{
  ok: string[]; issues: string[]; ready: boolean;
}> {
  const ok: string[] = [];
  const issues: string[] = [];

  const majorVer = await _macosMajorVersion();
  if (majorVer >= 13) {
    ok.push('macOS ' + majorVer + '（支持 ScreenCaptureKit，零安装）');
  } else {
    issues.push('macOS ' + majorVer + '（需要 BlackHole 虚拟音频设备）');
  }

  const perm = systemPreferences.getMediaAccessStatus('screen');
  if (perm === 'granted') {
    ok.push('屏幕录制权限已授权');
  } else if (perm === 'not-determined') {
    issues.push('屏幕录制权限待授权（点击开启后会弹出系统对话框）');
  } else {
    issues.push('屏幕录制权限被拒绝（请在弹窗中点击「打开系统设置」开启）');
  }

  // 关键修改：ready 只检查 macOS 版本，不检查权限状态
  // 因为 getDisplayMedia() 会自然触发权限对话框
  // 即使之前被拒，也让用户尝试——失败了再引导去系统设置
  return {
    ok,
    issues,
    ready: majorVer >= 13,
  };
}

/**
 * 打开 macOS 屏幕录制权限设置页
 */
export async function openScreenRecordingSettings(): Promise<void> {
  const { shell } = require('electron');
  // macOS 13+ 的隐私设置 URL
  await shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
  );
}

// ============================================================
// IPC：接收渲染进程发来的音频数据 + 捕获状态
// ============================================================

let ipcRegistered = false;

export function registerIpcHandlers(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  // 接收音频数据块（webm/opus 格式）
  ipcMain.on('audio:chunk', (_event, data: Buffer) => {
    if (!isRunning || !onChunk) return;

    const now = Date.now();
    const id = `${now}_${chunkIndex++}`;
    const tmpWebm = path.join(AUDIO_DIR, `chunk_${id}.webm`);
    const tmpWav = path.join(AUDIO_DIR, `chunk_${id}.wav`);

    fs.promises.writeFile(tmpWebm, data).then(() => {
      const { spawn } = require('child_process');
      let ffmpegPath = 'ffmpeg';
      try { ffmpegPath = require('ffmpeg-static'); } catch {}

      const p = spawn(ffmpegPath, [
        '-y', '-i', tmpWebm,
        '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1',
        tmpWav,
      ], { stdio: 'ignore' });

      p.on('close', (code: number) => {
        // 无论成功失败都删除 webm 源文件
        fs.promises.unlink(tmpWebm).catch(() => {});
        if (code === 0) {
          fs.promises.stat(tmpWav).then(s => {
            if (s.size > 1000 && onChunk) {
              console.log('[mac-audio] Chunk ready:', tmpWav, 'size:', s.size);
              // 传入创建时间戳，方便判断是否过期
              onChunk(tmpWav, now);
            }
            cleanupOldChunks();
          }).catch(() => { cleanupOldChunks(); });
        } else {
          console.log('[mac-audio] ffmpeg conversion failed, code:', code);
          // 转换失败也清理 wav 残留
          fs.promises.unlink(tmpWav).catch(() => {});
          cleanupOldChunks();
        }
      });

      p.on('error', (err: any) => {
        console.log('[mac-audio] ffmpeg spawn error:', err.message);
        fs.promises.unlink(tmpWebm).catch(() => {});
        fs.promises.unlink(tmpWav).catch(() => {});
      });
    }).catch((err) => {
      console.log('[mac-audio] writeFile error:', err.message);
    });
  });

  // 接收捕获错误
  ipcMain.on('audio:captureError', (_event, msg: string) => {
    console.error('[mac-audio] Capture error from renderer:', msg);
  });

  // 渲染进程通知捕获已开始
  ipcMain.on('audio:captureStarted', () => {
    console.log('[mac-audio] Renderer capture started');
  });

  // 渲染进程通知捕获已停止
  ipcMain.on('audio:captureStopped', () => {
    console.log('[mac-audio] Renderer capture stopped');
    isRunning = false;
  });
}

export function unregisterIpcHandlers(): void {
  if (!ipcRegistered) return;
  ipcRegistered = false;
  ipcMain.removeAllListeners('audio:chunk');
  ipcMain.removeAllListeners('audio:captureError');
  ipcMain.removeAllListeners('audio:captureStarted');
  ipcMain.removeAllListeners('audio:captureStopped');
}

// macOS 版本缓存（避免每次 spawn sw_vers）
let _cachedMacVersion: number | null = null;

async function _macosMajorVersion(): Promise<number> {
  if (_cachedMacVersion !== null) return _cachedMacVersion;
  try {
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const { stdout } = await promisify(execFile)('sw_vers', ['-productVersion'], { timeout: 3000 });
    _cachedMacVersion = parseInt(stdout.trim().split('.')[0], 10);
    return _cachedMacVersion!;
  } catch {
    return 0;
  }
}
