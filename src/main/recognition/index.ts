/**
 * 歌曲识别 - 统一服务
 *
 * 使用 node-shazam，零配置。
 */

import { Shazam } from 'node-shazam';
import type { RecognitionResult } from './base';

export type { RecognitionResult };

const shazam = new Shazam();

/**
 * 识别音频文件中的歌曲
 */
export async function recognize(audioPath: string): Promise<RecognitionResult | null> {
  try {
    const raw = await Promise.race([
      shazam.recognise(audioPath),
      new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('Shazam timeout')), 30000)
      ),
    ]);

    // node-shazam 返回格式: { track: { title, subtitle, ... } }
    const track = raw?.track || raw;
    if (track && track.title) {
      return {
        title: track.title,
        artist: track.subtitle || track.artist || '未知歌手',
        confidence: 85,
        backend: 'Shazam',
      };
    }
    return null;
  } catch (err: any) {
    console.error('[Shazam] 识别失败:', err.message);
    return null;
  }
}

/**
 * 获取后端状态
 */
export async function getBackendStatus() {
  return [
    { name: 'Shazam', available: true, description: 'Shazam 音乐识别（免费，零配置）' },
  ];
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

    const header = buffer.toString('hex');
    return (
      header.startsWith('52494646') ||
      header.startsWith('fff3') ||
      header.startsWith('4f676753')
    );
  } catch {
    return false;
  }
}
