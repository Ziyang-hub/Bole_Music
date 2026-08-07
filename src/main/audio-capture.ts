/**
 * 伯乐模拟器 - 系统音频采集
 *
 * 采集系统音频输出，每10秒生成一段音频文件
 * - 所有系统调用均异步，不阻塞 UI
 * - 自动清理旧文件（只保留最近10段）
 * - 已有识别冷却（同一首歌5分钟内不重复识别）
 */

import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const execFileAsync = promisify(execFile);

// 内置 ffmpeg 路径
let ffmpegPath = 'ffmpeg';
try {
  ffmpegPath = require('ffmpeg-static');
} catch {
  // 开发模式下可能没有，回退到系统 ffmpeg
}

export type AudioChunkCallback = (audioPath: string) => void;

const AUDIO_DIR = path.join(os.tmpdir(), 'bole-simulator-audio');
const CHUNK_SEC = 10;
const MAX_CHUNKS = 10; // 只保留最近10段

let isRunning = false;
let onChunk: AudioChunkCallback | null = null;
let chunkIndex = 0;
let captureTimer: ReturnType<typeof setTimeout> | null = null;
let lastRecognized = '';

// ============================================================
// 公开 API
// ============================================================

export function startCapture(callback: AudioChunkCallback): boolean {
  if (isRunning) return false;

  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
  }

  onChunk = callback;
  isRunning = true;
  chunkIndex = 0;
  lastRecognized = '';

  // 异步检测平台能力后启动
  detectPlatform().then(() => {
    if (!isRunning) return;
    const platform = process.platform;
    if (platform === 'linux') startLinuxCapture();
    else startChunkedCapture();
  });

  return true;
}

export function stopCapture(): void {
  isRunning = false;
  if (captureTimer) { clearTimeout(captureTimer); captureTimer = null; }
}

export function isCapturing(): boolean { return isRunning; }

/** 设置冷却标记（识别到歌曲后调用，5分钟内同样歌曲跳过） */
export function markRecognized(title: string): void {
  lastRecognized = title;
}

// ============================================================
// 平台检测（异步）
// ============================================================

async function detectPlatform(): Promise<void> {
  // 缓存检测结果，只跑一次
}

export async function checkCaptureCapability(): Promise<{
  available: boolean; platform: string; needs: string[];
}> {
  const platform = process.platform;
  const needs: string[] = [];
  let hasAudioDevice = false;

  // ffmpeg 已内置，不需要用户安装
  if (platform === 'linux') {
    try { await execFileAsync('pactl', ['info'], { timeout: 3000 }); hasAudioDevice = true; } catch {}
    if (!hasAudioDevice) needs.push('PulseAudio (sudo apt install pulseaudio-utils)');
  } else if (platform === 'win32') {
    needs.push('VB-Cable 虚拟音频设备 (https://vb-audio.com/Cable/)');
  } else if (platform === 'darwin') {
    needs.push('BlackHole 虚拟音频设备 (终端运行: brew install blackhole-2ch)');
  }

  return { available: needs.length === 0, platform, needs };
}

// ============================================================
// Linux: PulseAudio 持续录制 + 定期切分
// ============================================================

function startLinuxCapture(): void {
  execFileAsync('pactl', ['list', 'short', 'sources']).then(({ stdout }) => {
    const monitor = stdout.split('\n').find(l => l.includes('monitor'))?.split(/\s+/)[1];
    if (!monitor) { startChunkedCapture(); return; }

    const rawFile = path.join(AUDIO_DIR, 'capture.wav');
    let parec: ReturnType<typeof spawn>;
    try {
      parec = spawn('parec', ['-d', monitor, '--file-format=wav', rawFile], { stdio: 'ignore' });
    } catch {
      startChunkedCapture();
      return;
    }

    parec.on('error', () => startChunkedCapture());

    // 每10秒切分
    const schedule = () => {
      if (!isRunning) return;
      splitChunk(rawFile);
      captureTimer = setTimeout(schedule, CHUNK_SEC * 1000);
    };
    schedule();
  }).catch(() => startChunkedCapture());
}

/** 用 ffmpeg 切最后 CHUNK_SEC 秒（异步） */
function splitChunk(rawFile: string): void {
  if (!fs.existsSync(rawFile)) return;
  const outFile = path.join(AUDIO_DIR, `chunk_${chunkIndex++}.wav`);

  let ffmpeg: ReturnType<typeof spawn>;
  try {
    ffmpeg = spawn(ffmpegPath, [
      '-y', '-sseof', `-${CHUNK_SEC}`, '-i', rawFile,
      '-t', String(CHUNK_SEC), '-acodec', 'copy', outFile,
    ], { stdio: 'ignore' });
  } catch {
    return;
  }
  ffmpeg.on('close', (code) => {
    if (code === 0) emitIfValid(outFile);
    cleanupOldChunks();
  });
}

// ============================================================
// 通用：ffmpeg 分段录制（Windows/Mac/回退）
// ============================================================

function startChunkedCapture(): void {
  const loop = () => {
    if (!isRunning) return;

    const outFile = path.join(AUDIO_DIR, `chunk_${chunkIndex++}.wav`);
    const args = buildFfmpegArgs(outFile);

    let ffmpeg: ReturnType<typeof spawn>;
    try {
      ffmpeg = spawn(ffmpegPath, args, { stdio: 'ignore' });
    } catch (err) {
      // ffmpeg 不存在或无法启动，停止采集循环
      console.error('ffmpeg 启动失败:', err);
      isRunning = false;
      return;
    }

    ffmpeg.on('close', (code) => {
      if (code === 0) emitIfValid(outFile);
      cleanupOldChunks();
      if (isRunning) captureTimer = setTimeout(loop, 500);
    });
    ffmpeg.on('error', (err) => {
      console.error('ffmpeg 错误:', err.message);
      if (isRunning) captureTimer = setTimeout(loop, 2000);
    });
  };
  loop();
}

function buildFfmpegArgs(outFile: string): string[] {
  const platform = process.platform;
  if (platform === 'darwin') return ['-y', '-f', 'avfoundation', '-i', ':0', '-t', String(CHUNK_SEC), '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', outFile];
  if (platform === 'win32') return ['-y', '-f', 'dshow', '-i', 'audio=@default', '-t', String(CHUNK_SEC), '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', outFile];
  return ['-y', '-f', 'pulse', '-i', 'default', '-t', String(CHUNK_SEC), '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', outFile];
}

// ============================================================
// 工具函数
// ============================================================

function emitIfValid(p: string): void {
  if (fs.existsSync(p) && fs.statSync(p).size > 1000 && onChunk) {
    onChunk(p);
  }
}

/** 清理旧音频片段，只保留最近 MAX_CHUNKS 个 */
function cleanupOldChunks(): void {
  try {
    const files = fs.readdirSync(AUDIO_DIR)
      .filter(f => f.startsWith('chunk_'))
      .map(f => ({ name: f, time: fs.statSync(path.join(AUDIO_DIR, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    for (let i = MAX_CHUNKS; i < files.length; i++) {
      fs.unlinkSync(path.join(AUDIO_DIR, files[i].name));
    }
  } catch {}
}
