/**
 * 伯乐模拟器 - 系统音频采集
 *
 * 采集系统音频输出，每10秒生成一段音频文件
 *
 * 方案：
 * - Linux: PulseAudio monitor（parec 录制）
 * - Windows: ffmpeg dshow 录制系统音频
 * - macOS: ffmpeg avfoundation 录制（BlackHole 虚拟设备）
 * - 通用回退: 定期用 ffmpeg 录制短片段
 */

import { spawn, ChildProcess, execSync } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export type AudioChunkCallback = (audioPath: string) => void;

const AUDIO_DIR = path.join(os.tmpdir(), 'bole-simulator-audio');
const CHUNK_SEC = 10; // 每段10秒

let captureProc: ChildProcess | null = null;
let isRunning = false;
let onChunk: AudioChunkCallback | null = null;
let chunkIndex = 0;

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

  const platform = process.platform;

  if (platform === 'linux') {
    startLinuxCapture();
  } else if (platform === 'win32') {
    startWindowsCapture();
  } else if (platform === 'darwin') {
    startMacCapture();
  } else {
    startPollingCapture();
  }

  console.log(`音频采集已启动 (${platform})`);
  return true;
}

export function stopCapture(): void {
  isRunning = false;
  if (captureProc) {
    try { captureProc.kill(); } catch {}
    captureProc = null;
  }
  console.log('音频采集已停止');
}

export function isCapturing(): boolean {
  return isRunning;
}

/** 检查采集能力 */
export function checkCaptureCapability(): {
  available: boolean; platform: string; needs: string[];
} {
  const platform = process.platform;
  const needs: string[] = [];
  let hasFfmpeg = false;

  try {
    execSync('ffmpeg -version', { stdio: 'ignore', timeout: 3000 });
    hasFfmpeg = true;
  } catch {}

  if (!hasFfmpeg) needs.push('ffmpeg (https://ffmpeg.org/download.html)');

  if (platform === 'win32') {
    needs.push('VB-Cable 虚拟音频 (https://vb-audio.com/Cable/)');
  } else if (platform === 'darwin') {
    needs.push('BlackHole (终端运行: brew install blackhole-2ch)');
  } else if (platform === 'linux') {
    if (!hasPulseAudio()) needs.push('PulseAudio (sudo apt install pulseaudio-utils)');
  }

  return {
    available: needs.length === 0,
    platform,
    needs,
  };
}

// ============================================================
// 平台实现
// ============================================================

/** Linux: PulseAudio monitor → parec 持续录制 → 定期切分 */
function startLinuxCapture(): void {
  const monitor = getPulseMonitor();
  if (!monitor) {
    console.log('未找到 PulseAudio monitor，使用轮询模式');
    startPollingCapture();
    return;
  }

  // parec 持续录制到单个文件
  const rawFile = path.join(AUDIO_DIR, 'capture.raw');
  const proc = spawn('parec', ['-d', monitor, '--file-format=wav', rawFile]);
  captureProc = proc;

  proc.on('error', (err) => {
    console.error('parec 启动失败:', err.message);
    startPollingCapture();
  });

  // 定期切分文件：每隔 CHUNK_SEC 秒，用 ffmpeg 切最后一段
  const interval = setInterval(() => {
    if (!isRunning) { clearInterval(interval); return; }
    splitLatestChunk(rawFile);
  }, CHUNK_SEC * 1000);
}

/** 切分最近录制的片段 */
function splitLatestChunk(rawFile: string): void {
  if (!fs.existsSync(rawFile)) return;

  const outFile = path.join(AUDIO_DIR, `chunk_${chunkIndex++}.wav`);
  try {
    // 截取最后 CHUNK_SEC 秒
    execSync(
      `ffmpeg -y -sseof -${CHUNK_SEC} -i "${rawFile}" -t ${CHUNK_SEC} -acodec copy "${outFile}" 2>/dev/null`,
      { timeout: 5000 }
    );
    emitIfValid(outFile);
  } catch {
    // 切分失败，跳过
  }
}

/** Windows: ffmpeg + dshow 周期性录制 */
function startWindowsCapture(): void {
  // 尝试常见音频设备名
  const deviceNames = [
    '立体声混音', 'Stereo Mix', 'What U Hear',
    'virtual-audio-capturer', 'CABLE Output',
  ];

  // 检测可用设备
  let device: string | null = null;
  try {
    const devices = execSync('ffmpeg -list_devices true -f dshow -i dummy 2>&1', {
      encoding: 'utf-8', timeout: 5000,
    });
    for (const name of deviceNames) {
      if (devices.includes(name)) {
        device = name;
        break;
      }
    }
  } catch {
    // 无法列出设备，使用轮询
  }

  if (device) {
    console.log(`Windows 音频设备: ${device}`);
    startFfmpegLoop(`audio=${device}`, 'dshow');
  } else {
    console.log('未检测到音频设备，使用轮询模式');
    startPollingCapture();
  }
}

/** macOS: ffmpeg + avfoundation */
function startMacCapture(): void {
  // 尝试 BlackHole 虚拟设备
  try {
    const devices = execSync(
      'ffmpeg -f avfoundation -list_devices true -i "" 2>&1 | grep -i blackhole',
      { encoding: 'utf-8', timeout: 5000 }
    );
    if (devices.includes('BlackHole')) {
      console.log('检测到 BlackHole 设备');
      startFfmpegLoop(':BlackHole', 'avfoundation');
      return;
    }
  } catch {}

  console.log('未检测到 BlackHole，使用轮询模式');
  startPollingCapture();
}

/** 通用: ffmpeg 周期性录制 */
function startFfmpegLoop(inputDevice: string, format: string): void {
  const loop = () => {
    if (!isRunning) return;

    const outFile = path.join(AUDIO_DIR, `chunk_${chunkIndex++}.wav`);
    const args = [
      '-y', '-f', format, '-i', inputDevice,
      '-t', String(CHUNK_SEC), '-acodec', 'pcm_s16le',
      '-ar', '16000', '-ac', '1', outFile,
    ];

    const proc = spawn('ffmpeg', args, { stdio: 'ignore' });
    proc.on('close', (code) => {
      if (code === 0) emitIfValid(outFile);
      if (isRunning) setTimeout(loop, 500);
    });
    proc.on('error', () => {
      if (isRunning) setTimeout(loop, 2000);
    });
  };

  loop();
}

/** 轮询备用方案: 尝试用 ffmpeg 默认设备录制 */
function startPollingCapture(): void {
  console.log('使用轮询模式采集音频');
  const platform = process.platform;
  const input = platform === 'darwin' ? ':0' : platform === 'win32' ? 'audio=@default' : 'default';
  const format = platform === 'darwin' ? 'avfoundation' : platform === 'win32' ? 'dshow' : 'pulse';

  startFfmpegLoop(input, format);
}

// ============================================================
// 工具函数
// ============================================================

function getPulseMonitor(): string | null {
  try {
    const result = execSync(
      "pactl list short sources | grep monitor | head -1 | awk '{print $2}'",
      { encoding: 'utf-8', timeout: 3000 }
    );
    return result.trim() || null;
  } catch {
    return null;
  }
}

function emitIfValid(path: string): void {
  if (fs.existsSync(path) && fs.statSync(path).size > 1000 && onChunk) {
    onChunk(path);
  }
}

function hasPulseAudio(): boolean {
  try {
    execSync('pactl info', { stdio: 'ignore', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}
