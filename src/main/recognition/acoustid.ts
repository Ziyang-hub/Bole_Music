/**
 * AcoustID / Chromaprint 音乐识别后端
 *
 * 完全免费开源的音频指纹方案，零安装！
 *
 * fpcalc 二进制已内置于应用（resources/fpcalc/），用户无需安装任何软件。
 *
 * 原理：
 * 1. 用内置 fpcalc 从音频提取 Chromaprint 指纹
 * 2. 发送指纹到 AcoustID API
 * 3. 匹配 MusicBrainz 歌曲数据库
 *
 * 用户可选：去 https://acoustid.org 注册免费 Client Key
 * 不填也能用（用默认 key），但有请求频率限制
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { RecognitionBackend, RecognitionResult } from './base';
import { getSettings } from '../store';

const ACOUSTID_API = 'https://api.acoustid.org/v2/lookup';

/** 获取内置 fpcalc 的路径 */
function getFpcalcPath(): string {
  const platform = process.platform;
  const arch = process.arch; // 'x64' or 'arm64'
  const devBase = path.join(__dirname, '../../resources/fpcalc');

  // 打包后：extraResources 解压到 resources/
  const prodBase = path.join(process.resourcesPath || '', 'fpcalc');

  let basePath: string;
  try {
    const fs = require('fs');
    if (fs.existsSync(prodBase)) basePath = prodBase;
    else basePath = devBase;
  } catch {
    basePath = devBase;
  }

  if (platform === 'win32') {
    return path.join(basePath, 'win32-x64', 'fpcalc.exe');
  } else if (platform === 'darwin') {
    const subdir = arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
    return path.join(basePath, subdir, 'fpcalc');
  } else {
    return path.join(basePath, 'linux-x64', 'fpcalc');
  }
}

export class AcoustIDBackend implements RecognitionBackend {
  name = 'AcoustID（开源指纹）';

  async recognize(audioPath: string): Promise<RecognitionResult | null> {
    try {
      // 1. 用内置 fpcalc 提取音频指纹（零安装！）
      const fingerprint = await this.getFingerprint(audioPath);
      if (!fingerprint) return null;

      // 2. 查询 AcoustID API
      const settings = getSettings();
      const clientKey = settings.acoustidClientKey || 'bole-simulator';

      const body =
        `client=${encodeURIComponent(clientKey)}` +
        `&meta=recordings+releases` +
        `&fingerprint=${encodeURIComponent(fingerprint.fingerprint)}` +
        `&duration=${fingerprint.duration}`;

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
    // 检查内置 fpcalc 是否存在
    try {
      const fs = require('fs');
      return fs.existsSync(getFpcalcPath());
    } catch {
      return false;
    }
  }

  /** 使用内置 fpcalc 提取音频指纹 */
  private getFingerprint(
    audioPath: string
  ): Promise<{ fingerprint: string; duration: number } | null> {
    return new Promise((resolve) => {
      try {
        const fpcalcPath = getFpcalcPath();
        const proc = spawn(fpcalcPath, ['-json', audioPath], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (d: Buffer) => {
          stdout += d.toString();
        });

        proc.stderr.on('data', (d: Buffer) => {
          stderr += d.toString();
        });

        proc.on('close', (code: number) => {
          if (code === 0 && stdout.trim()) {
            try {
              const result = JSON.parse(stdout);
              resolve({
                fingerprint: result.fingerprint,
                duration: Math.round(result.duration || 10),
              });
            } catch {
              resolve(null);
            }
          } else {
            if (stderr) console.error('fpcalc error:', stderr.trim());
            resolve(null);
          }
        });

        proc.on('error', (err) => {
          console.error('fpcalc spawn error:', err.message);
          resolve(null);
        });
      } catch (err) {
        console.error('fpcalc 启动失败:', err);
        resolve(null);
      }
    });
  }
}
