/**
 * 歌曲识别 - 统一服务
 *
 * 使用 node-shazam，零配置。
 */

import { Shazam } from 'node-shazam';
import type { RecognitionResult } from './base';

export type { RecognitionResult };

const shazam = new Shazam();

// 串行队列：fromFilePath 写固定临时文件 node_shazam_temp.pcm，并发会冲突
let _pending: Promise<any> = Promise.resolve();

/**
 * 识别音频文件中的歌曲
 */
export async function recognize(audioPath: string): Promise<RecognitionResult | null> {
  const prev = _pending;
  let resolveOuter: (v: any) => void = () => {};
  _pending = new Promise(r => { resolveOuter = r; });

  try {
    await Promise.race([prev, new Promise<void>(r => setTimeout(r, 35000))]);

    console.log('[Shazam] Calling fromFilePath:', require('path').basename(audioPath));
    const raw = await Promise.race([
      shazam.fromFilePath(audioPath, false, 'zh-CN'),
      new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('Shazam timeout')), 30000)
      ),
    ]);

    if (!raw) {
      console.log('[Shazam] No raw response');
      return null;
    }

    // node-shazam 返回格式: { track: { title, subtitle, sections: [...] } }
    const track = raw.track;
    if (track && track.title) {
      const mainSection = track.sections?.find((s: any) => s.type === 'SONG');
      const album = mainSection?.metadata?.find((m: any) => m.title === 'Album')?.text;

      console.log('[Shazam] Match found:', track.title, '-', track.subtitle || '未知歌手');
      return {
        title: track.title,
        artist: track.subtitle || '未知歌手',
        album: album || undefined,
        confidence: 85,
        backend: 'Shazam',
      };
    }
    console.log('[Shazam] No track in response, raw keys:', Object.keys(raw || {}));
    return null;
  } catch (err: any) {
    console.error('[Shazam] 识别失败:', err.message);
    return null;
  } finally {
    resolveOuter(null);
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
      header.startsWith('52494646') ||  // RIFF/WAV
      header.startsWith('fff3') ||      // MP3
      header.startsWith('4f676753') ||  // Ogg
      header.startsWith('1a45dfa3')     // EBML/WebM（哼歌识曲的麦克风录制格式）
    );
  } catch {
    return false;
  }
}
