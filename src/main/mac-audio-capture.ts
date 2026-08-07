/**
 * 伯乐模拟器 - macOS 零安装系统音频采集
 *
 * 使用 Electron 内置的 desktopCapturer + macOS ScreenCaptureKit
 * 捕获系统音频输出，无需安装 BlackHole 等第三方虚拟音频设备。
 *
 * 要求 macOS 13+（Ventura），因为 SCK 的系统音频捕获是 Ventura 引入的。
 * 旧版 macOS 降级到 BlackHole 提示。
 *
 * 原理：
 *   1. 创建隐藏 BrowserWindow
 *   2. 窗口内用 getUserMedia(chromeMediaSource:'system') 获取系统音频流
 *   3. MediaRecorder 录制音频 → IPC → 主进程保存 WAV
 *   4. 已有识别流程处理 WAV 文件
 */

import { BrowserWindow, ipcMain, systemPreferences } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export type AudioChunkCallback = (audioPath: string) => void;

const AUDIO_DIR = path.join(os.tmpdir(), 'bole-simulator-audio');
const CHUNK_SEC = 10;
const MAX_CHUNKS = 10;

let isRunning = false;
let onChunk: AudioChunkCallback | null = null;
let captureWindow: BrowserWindow | null = null;
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

  _ensureCaptureWindow();
  return true;
}

export function stopCapture(): void {
  isRunning = false;
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.webContents.send('mac-capture:stop');
  }
}

export function isCapturing(): boolean { return isRunning; }

export async function checkCaptureCapability(): Promise<{
  available: boolean; platform: string; needs: string[];
}> {
  const platform = process.platform;

  // macOS 13+ 才支持 ScreenCaptureKit 系统音频
  const majorVer = await _macosMajorVersion();
  if (majorVer < 13) {
    return {
      available: false,
      platform: 'darwin',
      needs: ['BlackHole (macOS < 13 不支持 ScreenCaptureKit)'],
    };
  }

  // 检查屏幕录制权限
  const permission = systemPreferences.getMediaAccessStatus('screen');
  const needs: string[] = [];

  if (permission !== 'granted') {
    needs.push('屏幕录制权限（首次使用时会弹出系统对话框，请点击"允许"）');
  }

  return { available: true, platform: 'darwin', needs };
}

/**
 * 请求屏幕录制权限
 * 注意：screen 权限无法通过 askForMediaAccess 发起（Electron 不支持），
 * 需要通过实际尝试捕获来触发 macOS 系统对话框。
 * 返回当前权限状态。
 */
export async function requestScreenPermission(): Promise<boolean> {
  const status = systemPreferences.getMediaAccessStatus('screen');
  return status === 'granted';
}

/**
 * 诊断：返回可用的音频捕获情况
 */
export async function diagnose(): Promise<{
  ok: string[]; issues: string[]; ready: boolean;
}> {
  const ok: string[] = [];
  const issues: string[] = [];

  const majorVer = await _macosMajorVersion();
  if (majorVer >= 13) {
    ok.push('macOS ' + majorVer + '（支持 ScreenCaptureKit）');
  } else {
    issues.push('macOS ' + majorVer + '（需 BlackHole 虚拟音频设备）');
  }

  const perm = systemPreferences.getMediaAccessStatus('screen');
  if (perm === 'granted') {
    ok.push('屏幕录制权限已授权');
  } else if (perm === 'not-determined') {
    issues.push('屏幕录制权限待授权（首次启动采集时会弹出对话框）');
  } else {
    issues.push('屏幕录制权限被拒绝（请在 系统设置 > 隐私与安全性 > 屏幕录制 中开启）');
  }

  return {
    ok,
    issues,
    ready: majorVer >= 13 && perm !== 'denied',
  };
}

// ============================================================
// 隐藏窗口管理
// ============================================================

function _ensureCaptureWindow(): void {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.webContents.send('mac-capture:start', { chunkSec: CHUNK_SEC });
    return;
  }

  captureWindow = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    skipTaskbar: true,
    transparent: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'capture-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 加载音频采集页面（DOM 中通过 window.captureAPI 调用 IPC）
  captureWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(_capturePageHTML())}`);

  captureWindow.on('closed', () => {
    captureWindow = null;
    isRunning = false;
  });

  // 窗口准备好后开始采集
  captureWindow.webContents.on('did-finish-load', () => {
    if (isRunning && captureWindow && !captureWindow.isDestroyed()) {
      captureWindow.webContents.send('mac-capture:start', { chunkSec: CHUNK_SEC });
    }
  });
}

// ============================================================
// 音频采集页面（内嵌 HTML + JS）
// ============================================================

function _capturePageHTML(): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Audio Capture</title></head>
<body>
<script>
// 通过 capture-preload.js 暴露的 API:
// window.captureAPI: { onStart, onStop, sendChunk, sendError, getScreenSources }

var mediaRecorder = null;
var stream = null;
var running = false;
var chunkSec = 10;

window.captureAPI.onStart(function(opts) {
  chunkSec = opts.chunkSec || 10;
  if (running) return;
  running = true;
  startCaptureLoop();
});

window.captureAPI.onStop(function() {
  cleanup();
});

async function startCaptureLoop() {
  try {
    // 方法1：尝试直接捕获系统音频（macOS 13+ ScreenCaptureKit）
    var sources = await window.captureAPI.getScreenSources();
    if (sources.length === 0) {
      throw new Error('No screen sources found');
    }

    // 使用第一个屏幕源捕获（包含系统音频）
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sources[0].id,
        }
      },
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sources[0].id,
          minWidth: 1,
          maxWidth: 1,
          minHeight: 1,
          maxHeight: 1,
          minFrameRate: 1,
          maxFrameRate: 1,
        }
      }
    });

    // 只保留音频轨道，停止视频轨道
    var audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error('No system audio track available');
    }

    // 停止所有视频轨道（不需要画面）
    stream.getVideoTracks().forEach(function(t) { t.stop(); });

    // 创建仅音频的流
    var audioStream = new MediaStream(audioTracks);
    stream = audioStream;

    // MediaRecorder 录制音频
    var mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });

    mediaRecorder.ondataavailable = function(event) {
      if (event.data.size > 0) {
        event.data.arrayBuffer().then(function(buf) {
          window.captureAPI.sendChunk(buf);
        }).catch(function() {});
      }
    };

    mediaRecorder.onerror = function(event) {
      window.captureAPI.sendError('MediaRecorder error: ' + JSON.stringify(event));
    };

    // 每 chunkSec 秒切一片
    mediaRecorder.start(chunkSec * 1000);
    console.log('[mac-capture] MediaRecorder started, chunkSec=' + chunkSec);

  } catch (err) {
    console.error('[mac-capture] Failed to start:', err.message);
    window.captureAPI.sendError(err.message);
    running = false;
  }
}

function cleanup() {
  running = false;
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop(); } catch(e) {}
    mediaRecorder = null;
  }
  if (stream) {
    stream.getTracks().forEach(function(t) { t.stop(); });
    stream = null;
  }
}
</script>
</body>
</html>`;
}

// ============================================================
// IPC：接收隐藏窗口发来的音频数据
// ============================================================

// 注册/注销 IPC 处理器（由 index.ts 调用以确保只注册一次）
let ipcRegistered = false;

export function registerIpcHandlers(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.on('mac-capture:chunk', (_event, data: Buffer) => {
    if (!isRunning || !onChunk) return;

    try {
      // data 是 webm/opus 格式，需要转成 WAV
      // 直接用 ffmpeg 转码
      const tmpWebm = path.join(AUDIO_DIR, `chunk_${chunkIndex}.webm`);
      const tmpWav = path.join(AUDIO_DIR, `chunk_${chunkIndex}.wav`);
      chunkIndex++;

      fs.writeFileSync(tmpWebm, data);

      // 异步转码（使用 child_process）
      const { spawn } = require('child_process');
      let ffmpegPath = 'ffmpeg';
      try { ffmpegPath = require('ffmpeg-static'); } catch {}

      const p = spawn(ffmpegPath, [
        '-y', '-i', tmpWebm,
        '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1',
        tmpWav,
      ], { stdio: 'ignore' });

      p.on('close', (code: number) => {
        // 清理 webm 临时文件
        try { fs.unlinkSync(tmpWebm); } catch {}

        if (code === 0 && fs.existsSync(tmpWav) && fs.statSync(tmpWav).size > 1000) {
          if (onChunk) onChunk(tmpWav);
        }
        _cleanupOldChunks();
      });

      p.on('error', () => {
        try { fs.unlinkSync(tmpWebm); } catch {}
      });
    } catch (err) {
      // 静默处理
    }
  });

  ipcMain.on('mac-capture:error', (_event, msg: string) => {
    console.error('[mac-audio-capture] Capture error:', msg);
  });
}

export function unregisterIpcHandlers(): void {
  if (!ipcRegistered) return;
  ipcRegistered = false;
  ipcMain.removeAllListeners('mac-capture:chunk');
  ipcMain.removeAllListeners('mac-capture:error');
}

// ============================================================
// 工具
// ============================================================

function _cleanupOldChunks(): void {
  try {
    const files = fs.readdirSync(AUDIO_DIR)
      .filter(f => f.startsWith('chunk_'))
      .map(f => ({ n: f, t: fs.statSync(path.join(AUDIO_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (let i = MAX_CHUNKS; i < files.length; i++) {
      fs.unlinkSync(path.join(AUDIO_DIR, files[i].n));
    }
  } catch {}
}

async function _macosMajorVersion(): Promise<number> {
  try {
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const { stdout } = await promisify(execFile)('sw_vers', ['-productVersion'], { timeout: 3000 });
    return parseInt(stdout.trim().split('.')[0], 10);
  } catch {
    return 0;
  }
}
