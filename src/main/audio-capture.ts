/**
 * 伯乐模拟器 - 系统音频采集模块
 *
 * 捕获电脑系统音频输出（"听到"电脑正在播放什么）
 *
 * 技术方案：
 * - Windows: 使用 WASAPI Loopback 模式录制系统音频
 * - macOS: 使用 BlackHole 虚拟音频设备
 * - Linux: 使用 PulseAudio monitor
 *
 * 工作流程：
 * 1. 启动音频监听
 * 2. 持续录制音频片段（每 10 秒一段）
 * 3. 检测是否为音乐（简易音量检测）
 * 4. 如果是音乐，将音频片段发送给歌曲识别服务
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// ----- 类型定义 -----

export type AudioChunkCallback = (audioPath: string) => void;

interface CaptureState {
  process: ChildProcess | null;
  isCapturing: boolean;
  callback: AudioChunkCallback | null;
  currentChunk: string;
}

// ----- 状态管理 -----

const state: CaptureState = {
  process: null,
  isCapturing: false,
  callback: null,
  currentChunk: '',
};

// 临时音频文件目录
const AUDIO_DIR = path.join(os.tmpdir(), 'bole-simulator-audio');

// ----- 平台检测 -----

function getPlatform(): 'win32' | 'darwin' | 'linux' {
  const p = process.platform;
  if (p === 'win32') return 'win32';
  if (p === 'darwin') return 'darwin';
  return 'linux';
}

// ============================================================
// 启动音频采集
// ============================================================

/**
 * 开始监听系统音频
 * @param onAudioChunk 收到音频片段时的回调，参数为音频文件路径
 * @returns 是否成功启动
 */
export function startCapture(onAudioChunk: AudioChunkCallback): boolean {
  if (state.isCapturing) {
    console.log('音频采集已在运行中');
    return false;
  }

  // 确保临时目录存在
  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
  }

  state.callback = onAudioChunk;
  state.isCapturing = true;

  const platform = getPlatform();

  try {
    switch (platform) {
      case 'win32':
        startWindowsCapture();
        break;
      case 'darwin':
        startMacCapture();
        break;
      case 'linux':
        startLinuxCapture();
        break;
    }
    console.log(`音频采集已启动 (平台: ${platform})`);
    return true;
  } catch (err) {
    console.error('启动音频采集失败:', err);
    stopCapture();
    return false;
  }
}

/**
 * 停止音频采集
 */
export function stopCapture(): void {
  state.isCapturing = false;

  if (state.process) {
    try {
      state.process.kill();
    } catch {
      // 进程可能已退出
    }
    state.process = null;
  }

  // 清理临时文件
  if (state.currentChunk && fs.existsSync(state.currentChunk)) {
    try {
      fs.unlinkSync(state.currentChunk);
    } catch {
      // 忽略清理错误
    }
  }

  console.log('音频采集已停止');
}

/**
 * 检查是否正在采集
 */
export function isCapturing(): boolean {
  return state.isCapturing;
}

// ============================================================
// Windows: WASAPI Loopback
// ============================================================

function startWindowsCapture(): void {
  // Windows 使用 PowerShell 脚本通过 WASAPI 录制系统音频
  // 使用 ffmpeg（如果已安装）或 Windows 内置的 AudioDeviceCmdlets

  const chunkDuration = 10; // 每段 10 秒
  const outputPattern = path.join(AUDIO_DIR, 'chunk_%d.wav');

  // 方法1：使用 ffmpeg（推荐，需要用户安装 ffmpeg）
  // ffmpeg -f dshow -i audio="Stereo Mix" -t 10 chunk.wav
  // 或使用 WASAPI loopback:
  // ffmpeg -f dshow -i audio="virtual-audio-capturer" ...

  // 方法2：使用 PowerShell + Windows Audio API
  // 这里使用一个轮询方案：定期录制短片段

  console.log('Windows 音频采集：请确保已安装 ffmpeg (https://ffmpeg.org)');
  console.log('或安装 VB-Cable (https://vb-audio.com/Cable/) 虚拟音频设备');

  // 简易实现：提示用户配置
  // 实际录制在后续版本中完善
  startPollingCapture(chunkDuration, outputPattern);
}

// ============================================================
// macOS: BlackHole 虚拟音频设备
// ============================================================

function startMacCapture(): void {
  // macOS 需要安装 BlackHole 虚拟音频设备
  // brew install blackhole-2ch
  // 然后使用 ffmpeg 或 sox 录制

  const chunkDuration = 10;
  const outputPattern = path.join(AUDIO_DIR, 'chunk_%d.wav');

  console.log('macOS 音频采集：请确保已安装 BlackHole (brew install blackhole-2ch)');
  console.log('并在 音频MIDI设置 中创建多输出设备');

  startPollingCapture(chunkDuration, outputPattern);
}

// ============================================================
// Linux: PulseAudio Monitor
// ============================================================

function startLinuxCapture(): void {
  const chunkDuration = 10;
  const outputPattern = path.join(AUDIO_DIR, 'chunk_%d.wav');

  // Linux: 使用 parec (PulseAudio) 录制
  // parec -d <monitor_source> --file-format=wav output.wav
  const monitorSource = getPulseAudioMonitor();

  if (monitorSource) {
    // 使用 PulseAudio 录制
    const cmd = 'parec';
    const args = [
      '-d', monitorSource,
      '--file-format=wav',
      path.join(AUDIO_DIR, 'capture.wav'),
    ];

    try {
      const proc = spawn(cmd, args);
      state.process = proc;

      proc.stderr.on('data', (data) => {
        console.log(`音频采集: ${data.toString()}`);
      });

      proc.on('error', (err) => {
        console.error('音频采集进程错误:', err);
        stopCapture();
      });

      proc.on('exit', (code) => {
        if (state.isCapturing) {
          console.log(`音频采集进程退出 (code: ${code})，尝试重启...`);
        }
      });

      // 定期切割文件并发送
      startChunkScheduler(chunkDuration, outputPattern);
    } catch (err) {
      console.error('Linux 音频采集启动失败:', err);
      startPollingCapture(chunkDuration, outputPattern);
    }
  } else {
    console.log('未找到 PulseAudio monitor，使用轮询模式');
    startPollingCapture(chunkDuration, outputPattern);
  }
}

// ============================================================
// 通用轮询采集（备用方案）
// ============================================================

function startPollingCapture(durationSec: number, outputPattern: string): void {
  console.log('使用轮询模式采集音频（功能受限）');

  // 在没有原生音频采集能力时，提供一个提示
  // 实际使用时需要用户配置音频路由

  // 定时器：模拟音频片段检测
  // 实际版本中这里会调用 ffmpeg/sox 录制真实音频
  let chunkIndex = 0;

  const interval = setInterval(() => {
    if (!state.isCapturing) {
      clearInterval(interval);
      return;
    }

    // 尝试录制一个音频片段
    const outputPath = outputPattern.replace('%d', String(chunkIndex));
    captureChunk(durationSec, outputPath, () => {
      if (state.callback) {
        state.callback(outputPath);
      }
      chunkIndex++;
    });
  }, durationSec * 1000);

  // 保存 interval 引用以便清理
  state.process = { kill: () => clearInterval(interval) } as any;
}

/**
 * 尝试录制一段音频
 */
function captureChunk(
  durationSec: number,
  outputPath: string,
  onComplete: () => void
): void {
  const platform = getPlatform();

  // 尝试使用 ffmpeg（跨平台）
  const args: string[] = [];

  if (platform === 'win32') {
    // Windows: 尝试录制系统音频
    args.push(
      '-f', 'dshow',
      '-i', 'audio=@device_cm_{33D9A762-90C8-11D0-BD43-00A0C911CE86}\\wave_{0.0.1.00000000}.{GUID}',
      '-t', String(durationSec),
      '-y', outputPath
    );
    // 注意：上面的设备ID需要根据实际系统调整
    // 简化方案：提示用户手动配置
  } else if (platform === 'darwin') {
    args.push(
      '-f', 'avfoundation',
      '-i', ':BlackHole',
      '-t', String(durationSec),
      '-y', outputPath
    );
  } else {
    args.push(
      '-f', 'pulse',
      '-i', 'default',
      '-t', String(durationSec),
      '-y', outputPath
    );
  }

  try {
    const ffmpeg = spawn('ffmpeg', args, { stdio: 'ignore' });

    ffmpeg.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        onComplete();
      }
      // 如果 ffmpeg 失败，静默处理
    });

    ffmpeg.on('error', () => {
      // ffmpeg 不可用，跳过
    });
  } catch {
    // 系统中没有 ffmpeg
  }
}

// ============================================================
// 音频片段调度
// ============================================================

function startChunkScheduler(durationSec: number, outputPattern: string): void {
  let chunkIndex = 0;

  const interval = setInterval(() => {
    if (!state.isCapturing) {
      clearInterval(interval);
      return;
    }

    const outputPath = outputPattern.replace('%d', String(chunkIndex));
    state.currentChunk = outputPath;

    // 检测音频文件是否存在且有足够大小
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      if (stats.size > 1000) {
        // 大于 1KB，认为是有效音频
        if (state.callback) {
          state.callback(outputPath);
        }
      }
    }

    chunkIndex++;
  }, durationSec * 1000);

  state.process = { kill: () => clearInterval(interval) } as any;
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 获取 PulseAudio 的 monitor 源（Linux）
 */
function getPulseAudioMonitor(): string | null {
  try {
    // 尝试获取默认输出设备的 monitor
    const result = require('child_process').execSync(
      'pactl list short sources | grep monitor | head -1 | awk \'{print $2}\'',
      { encoding: 'utf-8', timeout: 5000 }
    );
    return result.trim() || null;
  } catch {
    return null;
  }
}

/**
 * 检查系统是否具备音频采集的条件
 */
export function checkCaptureCapability(): {
  available: boolean;
  platform: string;
  needs: string[];
} {
  const platform = getPlatform();
  const needs: string[] = [];

  // 检查 ffmpeg
  try {
    require('child_process').execSync('ffmpeg -version', { stdio: 'ignore', timeout: 3000 });
  } catch {
    needs.push('ffmpeg (https://ffmpeg.org)');
  }

  // 平台特定需求
  if (platform === 'win32') {
    needs.push('VB-Cable 虚拟音频设备 (https://vb-audio.com/Cable/)');
  } else if (platform === 'darwin') {
    needs.push('BlackHole 虚拟音频设备 (brew install blackhole-2ch)');
  }

  return {
    available: needs.length === 0,
    platform,
    needs,
  };
}
