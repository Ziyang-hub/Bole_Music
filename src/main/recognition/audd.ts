/**
 * AudD 音乐识别后端
 *
 * 商业音频指纹服务，识别率高
 * 免费额度：300次/月
 * 注册：https://audd.io
 */

import * as fs from 'fs';
import { RecognitionBackend, RecognitionResult } from './base';
import { getSettings } from '../store';

const AUDD_API = 'https://api.audd.io/';

export class AudDBackend implements RecognitionBackend {
  name = 'AudD（商业指纹）';

  async recognize(audioPath: string): Promise<RecognitionResult | null> {
    const settings = getSettings();
    const apiKey = settings.auddApiKey || process.env.AUDD_API_KEY || '';
    if (!apiKey) {
      console.log('AudD: 未设置 API Key（请在设置页面填入）');
      return null;
    }

    try {
      const audioBuffer = fs.readFileSync(audioPath);
      const audioBase64 = audioBuffer.toString('base64');

      const body = JSON.stringify({
        api_token: apiKey,
        audio: audioBase64,
        return: 'apple_music,spotify',
      });

      const response = await fetch(AUDD_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!response.ok) return null;

      const data: any = await response.json();

      if (data.status === 'success' && data.result) {
        return {
          title: data.result.title || '未知',
          artist: data.result.artist || '未知',
          album: data.result.album || undefined,
          confidence: 80,
          backend: this.name,
        };
      }

      return null;
    } catch (err) {
      console.error('AudD 识别失败:', err);
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    const settings = getSettings();
    return !!(settings.auddApiKey || process.env.AUDD_API_KEY);
  }
}
