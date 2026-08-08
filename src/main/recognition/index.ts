/**
 * 歌曲识别 - 统一服务
 *
 * 使用 st-shazam（基于 Shazam 非官方 API）。
 * 零安装、无需 API Key。
 */

import { recognizeSong as shazamRecognize } from 'st-shazam';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import type { RecognitionResult } from './base';

export type { RecognitionResult };

// st-shazam 内部使用固定临时文件路径（./temp_audio.raw），
// 并发调用会互相覆盖。用串行队列保证同一时刻只运行一个识别。
let _pending: Promise<any> = Promise.resolve();

/**
 * 解析 Shazam API 返回的原始响应
 * 格式: { matches: [...], results: [{ matches: [{ properties: { title, subtitle } }] }] }
 */
/**
 * 解析 Shazam API v2 响应格式:
 * {
 *   results: { matches: [{ id: "xxx", type: "shazam-songs" }] },
 *   resources: { "shazam-songs": { "xxx": { attributes: { title, artist } } } }
 * }
 */
function parseShazamResponse(data: any): { title: string; artist: string; album?: string } | null {
  try {
    const songMatches = data?.results?.matches;
    if (!songMatches || !Array.isArray(songMatches) || songMatches.length === 0) return null;

    const songId = songMatches[0].id;
    const songData = data?.resources?.["shazam-songs"]?.[songId]?.attributes;
    if (!songData) return null;

    return {
      title: songData.title || '未知歌曲',
      artist: songData.artist || '未知歌手',
      album: songData.album || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * 识别音频文件中的歌曲（串行化以避免 st-shazam 内部临时文件竞争）
 */
export async function recognize(audioPath: string): Promise<RecognitionResult | null> {
  const prev = _pending;
  let resolveOuter: (v: RecognitionResult | null) => void;
  _pending = new Promise(r => { resolveOuter = r; });

  try {
    await prev; // 等待前一个识别完成
    const raw = await shazamRecognize(audioPath);
    const song = parseShazamResponse(raw);
    if (song) {
      return {
        title: song.title,
        artist: song.artist,
        album: song.album,
        confidence: 85,
        backend: 'Shazam',
      };
    }
    return null;
  } catch (err: any) {
    console.error('[Shazam] 识别失败:', err.message);
    return null;
  } finally {
    resolveOuter!(null);
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
