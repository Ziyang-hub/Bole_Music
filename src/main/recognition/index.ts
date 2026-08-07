/**
 * 歌曲识别 - 统一服务
 *
 * 使用 st-shazam（基于 Shazam 非官方 API）。
 * 零安装、无需 API Key、识别率远高于 AudD/AcoustID。
 */

import { recognizeSong as shazamRecognize } from 'st-shazam';
import type { RecognitionResult } from './base';

export type { RecognitionResult };

/**
 * 识别音频文件中的歌曲
 */
export async function recognize(audioPath: string): Promise<RecognitionResult | null> {
  try {
    const song = await shazamRecognize(audioPath);
    if (song) {
      return {
        title: song.title || '未知歌曲',
        artist: song.artist || '未知歌手',
        album: song.album,
        confidence: 85,  // Shazam 指纹匹配，置信度固定高值
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
export async function getBackendStatus(): Promise<
  { name: string; available: boolean; description: string }[]
> {
  return [
    {
      name: 'Shazam',
      available: true,
      description: 'Shazam 音乐识别（免费，零配置）',
    },
  ];
}

/**
 * 简易音频质量检测 — 排除静音/噪音
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
      header.startsWith('52494646') ||  // WAV (RIFF)
      header.startsWith('fff3') ||       // MP3
      header.startsWith('4f676753')      // OGG
    );
  } catch {
    return false;
  }
}
