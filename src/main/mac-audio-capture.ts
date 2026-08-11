/**
 * 伯乐模拟器 - macOS 系统音频采集（ScreenCaptureKit 原生）
 *
 * 主进程 spawn 预编译的 Swift helper（ScreenCaptureKit 捕获系统音频），
 * 直接产出 16kHz mono WAV 分块 → onChunk 喂给识别管道。
 *
 * 关键优势：ScreenCaptureKit 捕获系统输出流，不激活录音会话
 * → 蓝牙耳机保持 A2DP 高音质，任何输出设备音质零影响。
 *
 * 降级策略：helper 缺失/spawn 失败 → startCapture 返回 false，
 * 渲染进程回退到 getUserMedia 方案（旧行为）。
 *
 * 要求 macOS 13+（Ventura）
 */

import { ipcMain, systemPreferences } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';
import { cleanupOldChunks } from './audio-capture';
import { log, logErr } from './log';

export type AudioChunkCallback = (audioPath: string, createdAt?: number) => void;

const AUDIO_DIR = path.join(os.tmpdir(), 'bole-simulator-audio');

let isRunning = false;
let onChunk: AudioChunkCallback | null = null;
let helperProc: ChildProcess | null = null;
let fallbackMode = false; // true = helper 缺失，走 getUserMedia 降级路径
// 实时音量回调（0~1 RMS），用于 UI 可视化
let onLevel: ((rms: number) => void) | null = null;

/** 注册实时音量回调（渲染进程音量条） */
export function setLevelCallback(cb: (rms: number) => void): void {
  onLevel = cb;
}

// ============================================================
// helper 二进制定位（缺失时自动编译，用户无感）
// ============================================================

function findHelperBinary(): string | null {
  const archName = process.arch === 'arm64' ? 'arm64' : 'x64';
  const binName = `bole-capture-${archName}`;

  // 候选路径：打包后（resources/）> 开发模式（项目 resources/）
  const candidates = [
    path.join(process.resourcesPath || '', 'mac-helper', binName),
    path.join(__dirname, '../../resources/mac-helper', binName),
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        fs.accessSync(p, fs.constants.X_OK);
        return p;
      }
    } catch {}
  }
  return null;
}

/** 用 swiftc 编译 helper（含 ad-hoc 签名） */
function compileHelper(srcPath: string, outPath: string): string | null {
  try {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    console.log('[mac-audio] Compiling helper with swiftc...');
    const { execFileSync } = require('child_process');
    execFileSync('swiftc', ['-O', srcPath, '-o', outPath], {
      timeout: 120000,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    // ad-hoc 签名：无签名二进制无法被 TCC 识别（屏幕录制权限），
    // 签名后系统设置里会出现 bole-capture-arm64，可单独授权
    try {
      execFileSync('codesign', ['-s', '-', outPath], { stdio: ['ignore', 'ignore', 'pipe'] });
      console.log('[mac-audio] ✅ Helper ad-hoc signed');
    } catch (e: any) {
      console.warn('[mac-audio] codesign failed (non-fatal):', e?.message || e);
    }
    fs.chmodSync(outPath, 0o755);
    console.log('[mac-audio] ✅ Helper compiled:', outPath);
    return outPath;
  } catch (err: any) {
    console.warn('[mac-audio] Compile failed:', err?.message || err);
    return null;
  }
}

/**
 * 确保 helper 存在且是最新版：
 * 已有二进制且比源码新 → 直接复用；缺失或源码更新 → swiftc 自动编译（开发模式）。
 * 打包后的安装包自带二进制（extraResources），不会走到编译。
 */
function ensureHelperBinary(): string | null {
  const srcPath = path.join(__dirname, '../../src/main/mac-helper/BoleCapture.swift');
  const hasSource = fs.existsSync(srcPath);

  const existing = findHelperBinary();
  if (existing) {
    if (hasSource) {
      // 源码比二进制新 → 重新编译（开发时改了 Swift 生效）
      const srcMtime = fs.statSync(srcPath).mtimeMs;
      const binMtime = fs.statSync(existing).mtimeMs;
      if (binMtime < srcMtime) {
        console.log('[mac-audio] Helper outdated (source newer), recompiling...');
        return compileHelper(srcPath, existing);
      }
    }
    return existing;
  }

  // 缺失：开发模式自动编译；打包后 src 不在 asar 中，走降级
  if (!hasSource) {
    console.warn('[mac-audio] Helper source not found, cannot auto-compile');
    return null;
  }
  const archName = process.arch === 'arm64' ? 'arm64' : 'x64';
  const outPath = path.join(__dirname, '../../resources/mac-helper', `bole-capture-${archName}`);
  return compileHelper(srcPath, outPath);
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 启动 ScreenCaptureKit 原生采集。
 * @returns true = helper 启动成功（原生模式）；false = 需要降级到 getUserMedia
 */
export function startCapture(callback: AudioChunkCallback): boolean {
  if (isRunning) return !fallbackMode;
  helperReady = false;

  const bin = ensureHelperBinary();
  if (!bin) {
    // 降级模式：注册 chunk 管道（getUserMedia 路径会通过 audio:chunk 发数据），
    // 但返回 false，让渲染进程继续启动 getUserMedia
    _setLastError('音频采集组件缺失或不可执行（将尝试自动编译/降级）');
    console.warn('[mac-audio] Helper unavailable, falling back to getUserMedia');
    fallbackMode = true;
    onChunk = callback;
    isRunning = true;
    return false;
  }

  try {
    if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

    helperProc = spawn(bin, ['--out', AUDIO_DIR, '--sec', '15'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const helperStartTime = Date.now();

    fallbackMode = false;
    onChunk = callback;
    isRunning = true;

    // stdout：READY 表示启动成功；CHUNK:<path> 表示一块音频就绪；LVL:0.xxxx 实时音量
    const rl = readline.createInterface({ input: helperProc.stdout! });
    rl.on('line', (line: string) => {
      line = line.trim();
      if (line.startsWith('CHUNK:')) {
        const p = line.slice(6);
        if (onChunk && fs.existsSync(p)) {
          log('[mac-audio] Chunk ready: ' + p);
          onChunk(p, Date.now());
          cleanupOldChunks();
        }
      } else if (line.startsWith('LVL:')) {
        const rms = parseFloat(line.slice(4));
        if (!isNaN(rms) && onLevel) onLevel(rms);
      } else if (line === 'READY') {
        log('[mac-audio] Helper READY');
        _notifyReady(true);
      } else {
        log('[mac-audio] Helper stdout: ' + line);
      }
    });

    // stderr：helper 诊断日志（AUDIO cb/CHUNK 能量等正常信息，也有真错误）
    helperProc.stderr?.on('data', (d: Buffer) => {
      const msg = d.toString().trim();
      if (msg) log('[mac-audio] Helper stderr: ' + msg);
    });

    helperProc.on('error', (err) => {
      logErr('[mac-audio] Helper spawn error: ' + err.message);
      _setLastError('采集组件启动失败：' + err.message);
      isRunning = false;
      helperProc = null;
    });

    helperProc.on('exit', (code, signal) => {
      log(`[mac-audio] Helper exited code=${code} signal=${signal} after ${Date.now() - helperStartTime}ms`);
      if (!helperReady) {
        _setLastError('采集组件异常退出（code=' + code + ' signal=' + signal + '）——' +
          '很可能是屏幕录制权限未生效，请检查系统设置中的授权并重启应用');
      }
      helperProc = null;
      isRunning = false;
      _notifyReady(false);
    });

    return true;
  } catch (err: any) {
    console.error('[mac-audio] startCapture error:', err.message);
    _setLastError('采集启动异常：' + err.message);
    isRunning = false;
    helperProc = null;
    return false;
  }
}

export function stopCapture(): void {
  console.log('[mac-audio] stopCapture called');
  console.trace('[mac-audio] stopCapture trace');
  isRunning = false;
  fallbackMode = false;
  if (helperProc) {
    console.log('[mac-audio] stopCapture: killing helper');
    try {
      helperProc.kill('SIGTERM');
    } catch {}
    helperProc = null;
  }
}

/**
 * helper 启动失败时切换到降级模式：
 * 保持 isRunning/onChunk（getUserMedia 路径的 chunk 管道继续可用），
 * 但返回的 native 语义为 false（渲染进程启动 getUserMedia）。
 */
export function switchToFallback(): void {
  if (helperProc) {
    try { helperProc.kill('SIGTERM'); } catch {}
    helperProc = null;
  }
  fallbackMode = true;
  isRunning = true;
  console.log('[mac-audio] Switched to getUserMedia fallback mode');
}

// ============================================================
// 等待 helper 就绪（READY）——避免渲染进程误判原生启动成功
// ============================================================

let readyWaiters: ((ok: boolean) => void)[] = [];
let helperReady = false;

// 最近一次原生采集启动失败的原因（供上层 IPC 带回渲染进程显示，便于定位）
let lastStartError = '';
export function getLastStartError(): string { return lastStartError; }
function _setLastError(msg: string): void {
  lastStartError = msg;
  console.warn('[mac-audio] start error:', msg);
}

/**
 * 等待 helper 发出 READY（或超时/退出）。
 * @returns true = 原生采集真正启动；false = 需要降级
 */
export function waitHelperReady(timeoutMs = 8000): Promise<boolean> {
  if (helperReady) return Promise.resolve(true);
  if (!isRunning || !helperProc) {
    _setLastError('helper 未运行（可能二进制缺失或启动失败）');
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      readyWaiters = readyWaiters.filter((w) => w !== onReady);
      _setLastError('等待采集组件就绪超时（' + (timeoutMs / 1000) + 's）——' +
        '若系统弹出过权限请求，可能未点击允许；' +
        '若已授权，请在系统设置中确认勾选的是正在运行的「伯乐模拟器」并重启应用');
      resolve(false);
    }, timeoutMs);
    const onReady = (ok: boolean) => {
      clearTimeout(timer);
      resolve(ok);
    };
    readyWaiters.push(onReady);
  });
}

// 在 stdout READY 处理和 exit 处理中通知 waiter
function _notifyReady(ok: boolean): void {
  helperReady = ok;
  readyWaiters.forEach((w) => w(ok));
  readyWaiters = [];
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

  const needs: string[] = [];
  if (!findHelperBinary()) {
    needs.push('音频捕获组件将首次开启时自动编译');
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
    ok.push('macOS ' + majorVer + '（支持 ScreenCaptureKit 原生采集）');
  } else {
    issues.push('macOS ' + majorVer + '（需要 BlackHole 虚拟音频设备）');
  }

  if (findHelperBinary()) {
    ok.push('音频捕获组件已就绪');
  } else {
    issues.push('音频捕获组件缺失（首次开启采集时会自动编译）');
  }

  const perm = systemPreferences.getMediaAccessStatus('screen');
  if (perm === 'granted') {
    ok.push('屏幕录制权限已授权');
  } else if (perm === 'not-determined') {
    issues.push('屏幕录制权限待授权（点击开启后会弹出系统对话框）');
  } else {
    issues.push('屏幕录制权限被拒绝（请在弹窗中点击「打开系统设置」开启）');
  }

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
  await shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
  );
}

// ============================================================
// IPC：兼容旧链路（getUserMedia 降级路径仍会用到）
// ============================================================

let ipcRegistered = false;

export function registerIpcHandlers(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  // 接收音频数据块（webm/opus 格式）——降级路径使用
  ipcMain.on('audio:chunk', (_event, data: Buffer) => {
    if (!isRunning || !onChunk) return;

    const now = Date.now();
    const id = `${now}_${Date.now().toString(36)}${Math.floor(Math.random() * 10000)}`;
    const tmpWebm = path.join(AUDIO_DIR, `chunk_${id}.webm`);
    const tmpWav = path.join(AUDIO_DIR, `chunk_${id}.wav`);

    fs.promises.writeFile(tmpWebm, data).then(() => {
      const webmSize = fs.statSync(tmpWebm).size;
      if (webmSize < 1000) {
        console.log('[mac-audio] webm too small, skipping:', webmSize, 'bytes');
        fs.promises.unlink(tmpWebm).catch(() => {});
        return;
      }

      const { spawn: spawnFfmpeg } = require('child_process');
      let ffmpegPath = 'ffmpeg';
      try { ffmpegPath = require('ffmpeg-static'); } catch {}

      let stderr = '';
      const p = spawnFfmpeg(ffmpegPath, [
        '-y', '-i', tmpWebm,
        '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1',
        tmpWav,
      ], { stdio: ['ignore', 'ignore', 'pipe'] });

      p.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      p.on('close', (code: number) => {
        fs.promises.unlink(tmpWebm).catch(() => {});
        if (code === 0) {
          fs.promises.stat(tmpWav).then(s => {
            if (s.size > 1000 && onChunk) {
              console.log('[mac-audio] (fallback) Chunk ready:', tmpWav);
              onChunk(tmpWav, now);
            }
            cleanupOldChunks();
          }).catch(() => { cleanupOldChunks(); });
        } else {
          console.log('[mac-audio] (fallback) ffmpeg failed, code:', code);
          console.log('[mac-audio] (fallback) ffmpeg stderr:', stderr.slice(-300));
          fs.promises.unlink(tmpWav).catch(() => {});
          cleanupOldChunks();
        }
      });

      p.on('error', (err: any) => {
        console.log('[mac-audio] (fallback) ffmpeg spawn error:', err.message);
        fs.promises.unlink(tmpWebm).catch(() => {});
        fs.promises.unlink(tmpWav).catch(() => {});
      });
    }).catch((err) => {
      console.log('[mac-audio] (fallback) writeFile error:', err.message);
    });
  });

  // 接收捕获错误
  ipcMain.on('audio:captureError', (_event, msg: string) => {
    console.error('[mac-audio] (fallback) Capture error from renderer:', msg);
  });

  // 渲染进程通知捕获已开始
  ipcMain.on('audio:captureStarted', () => {
    console.log('[mac-audio] (fallback) Renderer capture started');
  });

  // 渲染进程通知捕获已停止
  ipcMain.on('audio:captureStopped', () => {
    console.log('[mac-audio] (fallback) Renderer capture stopped');
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

// macOS 版本缓存
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
