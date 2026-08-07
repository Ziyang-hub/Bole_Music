/**
 * 伯乐模拟器 - 系统音频采集（零安装版）
 *
 * 采集系统音频输出，每10秒生成一段音频文件。
 * ffmpeg 已内置，Windows/Linux 零额外安装。
 * macOS 需要 BlackHole（系统限制），但会自动检测。
 */

import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const execFileAsync = promisify(execFile);

// 内置 ffmpeg
let ffmpegPath = 'ffmpeg';
try { ffmpegPath = require('ffmpeg-static'); } catch {}

export type AudioChunkCallback = (audioPath: string) => void;

const AUDIO_DIR = path.join(os.tmpdir(), 'bole-simulator-audio');
const CHUNK_SEC = 10;
const MAX_CHUNKS = 10;

let isRunning = false;
let onChunk: AudioChunkCallback | null = null;
let chunkIndex = 0;
let captureTimer: ReturnType<typeof setTimeout> | null = null;

// ============================================================
// 公开 API
// ============================================================

export function startCapture(callback: AudioChunkCallback): boolean {
  if (isRunning) return false;
  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

  onChunk = callback;
  isRunning = true;
  chunkIndex = 0;

  const platform = process.platform;
  if (platform === 'linux') startLinuxCapture();
  else if (platform === 'win32') startWindowsCapture();
  else if (platform === 'darwin') startMacCapture();
  else startPollLoop();

  return true;
}

export function stopCapture(): void {
  isRunning = false;
  if (captureTimer) { clearTimeout(captureTimer); captureTimer = null; }
}

export function isCapturing(): boolean { return isRunning; }

export async function checkCaptureCapability(): Promise<{
  available: boolean; platform: string; needs: string[];
}> {
  const platform = process.platform;
  const needs: string[] = [];

  if (platform === 'linux') {
    try { await execFileAsync('pactl', ['info'], { timeout: 3000 }); } catch {
      needs.push('PulseAudio (sudo apt install pulseaudio-utils)');
    }
  } else if (platform === 'darwin') {
    // macOS 检测 BlackHole
    try {
      const { stdout } = await execFileAsync(ffmpegPath, [
        '-f', 'avfoundation', '-list_devices', 'true', '-i', '""',
      ], { timeout: 5000 });
      if (!/BlackHole/i.test(stdout)) {
        needs.push('BlackHole (终端运行: brew install blackhole-2ch)');
      }
    } catch {
      needs.push('BlackHole (终端运行: brew install blackhole-2ch)');
    }
  }
  // Windows: WASAPI loopback 内置，无需任何安装

  return { available: needs.length === 0, platform, needs };
}

// ============================================================
// Linux: PulseAudio 持续录制（零安装）
// ============================================================

function startLinuxCapture(): void {
  execFileAsync('pactl', ['list', 'short', 'sources']).then(({ stdout }) => {
    const monitor = stdout.split('\n').find(l => l.includes('monitor'))?.split(/\s+/)[1];
    if (!monitor) { startPollLoop(); return; }

    const raw = path.join(AUDIO_DIR, 'capture.wav');
    try {
      const p = spawn('parec', ['-d', monitor, '--file-format=wav', raw], { stdio: 'ignore' });
      p.on('error', () => startPollLoop());
      const sched = () => { if (!isRunning) return; splitChunk(raw); captureTimer = setTimeout(sched, CHUNK_SEC * 1000); };
      sched();
    } catch { startPollLoop(); }
  }).catch(() => startPollLoop());
}

function splitChunk(raw: string): void {
  if (!fs.existsSync(raw)) return;
  const out = path.join(AUDIO_DIR, `chunk_${chunkIndex++}.wav`);
  try {
    const p = spawn(ffmpegPath, ['-y','-sseof',`-${CHUNK_SEC}`,'-i',raw,'-t',String(CHUNK_SEC),'-acodec','copy',out], { stdio: 'ignore' });
    p.on('close', (c) => { if (c === 0) emitIfValid(out); cleanupOldChunks(); });
  } catch {}
}

// ============================================================
// Windows: WASAPI Loopback（内置，零安装）
// ============================================================

function startWindowsCapture(): void {
  // 自动检测可用设备，优先 Stereo Mix（内置）
  execFileAsync(ffmpegPath, ['-list_devices','true','-f','dshow','-i','dummy'], { timeout: 5000 })
    .then(({ stdout }) => {
      let device = 'audio=@default';
      for (const name of ['立体声混音', 'Stereo Mix', 'CABLE Output', 'VB-Audio']) {
        if (stdout.includes(name)) { device = `audio=${name}`; break; }
      }
      startFfmpegLoop(device, 'dshow');
    })
    .catch(() => startFfmpegLoop('audio=@default', 'dshow'));
}

// ============================================================
// macOS: 自动检测 BlackHole，否则用默认设备
// ============================================================

function startMacCapture(): void {
  execFileAsync(ffmpegPath, ['-f','avfoundation','-list_devices','true','-i','""'], { timeout: 5000 })
    .then(({ stdout }) => {
      const input = /BlackHole/i.test(stdout) ? ':BlackHole' : ':0';
      startFfmpegLoop(input, 'avfoundation');
    })
    .catch(() => startFfmpegLoop(':0', 'avfoundation'));
}

// ============================================================
// 通用录制循环
// ============================================================

function startFfmpegLoop(input: string, format: string): void {
  const loop = () => {
    if (!isRunning) return;
    const out = path.join(AUDIO_DIR, `chunk_${chunkIndex++}.wav`);
    try {
      const p = spawn(ffmpegPath, [
        '-y','-f',format,'-i',input,
        '-t',String(CHUNK_SEC),'-acodec','pcm_s16le',
        '-ar','16000','-ac','1',out,
      ], { stdio: 'ignore' });
      p.on('close', (c) => {
        if (c === 0) emitIfValid(out);
        cleanupOldChunks();
        if (isRunning) captureTimer = setTimeout(loop, 500);
      });
      p.on('error', () => { if (isRunning) captureTimer = setTimeout(loop, 2000); });
    } catch {
      if (isRunning) captureTimer = setTimeout(loop, 2000);
    }
  };
  loop();
}

function startPollLoop(): void {
  const p = process.platform;
  startFfmpegLoop(
    p === 'darwin' ? ':0' : p === 'win32' ? 'audio=@default' : 'default',
    p === 'darwin' ? 'avfoundation' : p === 'win32' ? 'dshow' : 'pulse'
  );
}

// ============================================================
// 工具
// ============================================================

function emitIfValid(p: string): void {
  if (fs.existsSync(p) && fs.statSync(p).size > 1000 && onChunk) onChunk(p);
}

function cleanupOldChunks(): void {
  try {
    const files = fs.readdirSync(AUDIO_DIR)
      .filter(f => f.startsWith('chunk_'))
      .map(f => ({ n: f, t: fs.statSync(path.join(AUDIO_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (let i = MAX_CHUNKS; i < files.length; i++) fs.unlinkSync(path.join(AUDIO_DIR, files[i].n));
  } catch {}
}
