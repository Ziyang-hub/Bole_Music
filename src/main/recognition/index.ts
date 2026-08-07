/**
 * 歌曲识别 - 统一服务
 *
 * 支持双后端切换：
 * - AudD：商业指纹，识别率高（需 API Key）
 * - AcoustID：开源指纹，完全免费（需安装 fpcalc）
 *
 * 设置中可切换后端，也可自动降级
 */

import { RecognitionBackend, RecognitionResult } from './base';
import { AudDBackend } from './audd';
import { AcoustIDBackend } from './acoustid';
import { getSettings } from '../store';

// 注册所有后端
const backends: RecognitionBackend[] = [
  new AudDBackend(),
  new AcoustIDBackend(),
];

/**
 * 识别歌曲（按设置依次尝试）
 */
export async function recognize(audioPath: string): Promise<RecognitionResult | null> {
  const settings = getSettings();
  const preferred = settings.recognitionBackend || 'auto';

  if (preferred === 'auto') {
    // 自动模式：依次尝试所有可用的后端
    for (const backend of backends) {
      const available = await backend.isAvailable();
      if (!available) continue;

      const result = await backend.recognize(audioPath);
      if (result && result.confidence > 40) {
        return result;
      }
    }
    return null;
  }

  // 指定后端
  const backend = backends.find((b) => b.name.includes(preferred)) || backends[0];
  const available = await backend.isAvailable();
  if (!available) return null;

  return backend.recognize(audioPath);
}

/**
 * 获取所有后端的可用状态
 */
export async function getBackendStatus(): Promise<
  { name: string; available: boolean; description: string }[]
> {
  const result = [];
  for (const b of backends) {
    result.push({
      name: b.name,
      available: await b.isAvailable(),
      description: b.name,
    });
  }
  return result;
}

/**
 * 简易音频质量检测
 */
export function isMusicFile(audioPath: string): boolean {
  try {
    const fs = require('fs');
    const stats = fs.statSync(audioPath);
    if (stats.size < 10000) return false;

    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(audioPath, 'r');
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);

    // 检查常见音频文件头
    const header = buffer.toString('hex');
    return (
      header.startsWith('52494646') || // WAV (RIFF)
      header.startsWith('fff3') ||      // MP3
      header.startsWith('4f676753')     // OGG
    );
  } catch {
    return false;
  }
}
