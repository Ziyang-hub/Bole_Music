/**
 * AcoustID / Chromaprint 音乐识别后端
 *
 * 完全免费开源的音频指纹方案
 * 需要：系统安装 chromaprint（fpcalc 命令行工具）
 * 注册 AcoustID：https://acoustid.org （免费）
 *
 * 工作原理：
 * 1. 用 fpcalc 从音频提取指纹
 * 2. 发送指纹到 AcoustID API
 * 3. 匹配 MusicBrainz 歌曲数据库
 */

import { execSync, spawn } from 'child_process';
import { RecognitionBackend, RecognitionResult } from './base';
import { getSettings } from '../store';

const ACOUSTID_API = 'https://api.acoustid.org/v2/lookup';

export class AcoustIDBackend implements RecognitionBackend {
  name = 'AcoustID（开源指纹）';

  async recognize(audioPath: string): Promise<RecognitionResult | null> {
    try {
      // 1. 用 fpcalc 提取音频指纹
      const fingerprint = await this.getFingerprint(audioPath);
      if (!fingerprint) return null;

      // 2. 查询 AcoustID
      const settings = getSettings();
      const clientKey = settings.acoustidClientKey || 'bole-simulator';
      const duration = this.getAudioDuration(audioPath);

      const body = `client=${clientKey}&meta=recordings+releases&fingerprint=${encodeURIComponent(fingerprint.fingerprint)}&duration=${fingerprint.duration}`;

      const response = await fetch(ACOUSTID_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      if (!response.ok) return null;

      const data: any = await response.json();

      if (data.status === 'ok' && data.results?.length > 0) {
        const best = data.results[0];
        const recording = best.recordings?.[0];

        if (recording) {
          return {
            title: recording.title || '未知',
            artist: recording.artists?.[0]?.name || '未知',
            confidence: Math.round(best.score * 100) || 60,
            backend: this.name,
          };
        }
      }

      return null;
    } catch (err) {
      console.error('AcoustID 识别失败:', err);
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      execSync('fpcalc -version', { stdio: 'ignore', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /** 使用 fpcalc 提取音频指纹 */
  private getFingerprint(
    audioPath: string
  ): Promise<{ fingerprint: string; duration: number } | null> {
    return new Promise((resolve) => {
      try {
        const proc = spawn('fpcalc', ['-json', audioPath]);
        let stdout = '';

        proc.stdout.on('data', (d: Buffer) => {
          stdout += d.toString();
        });

        proc.on('close', (code: number) => {
          if (code === 0) {
            try {
              const result = JSON.parse(stdout);
              resolve({
                fingerprint: result.fingerprint,
                duration: result.duration,
              });
            } catch {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        });

        proc.on('error', () => resolve(null));
      } catch {
        resolve(null);
      }
    });
  }

  /** 获取音频时长（秒） */
  private getAudioDuration(audioPath: string): number {
    try {
      const result = execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
        { encoding: 'utf-8', timeout: 5000 }
      );
      return Math.round(parseFloat(result.trim()) || 10);
    } catch {
      return 10;
    }
  }
}
