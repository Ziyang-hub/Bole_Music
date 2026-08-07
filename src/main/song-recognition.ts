/**
 * 伯乐模拟器 - 歌曲识别服务
 *
 * 使用 Shazam 识别引擎（st-shazam），免费且无需 API Key
 */

import { recognize, isMusicFile, getBackendStatus } from './recognition/index';
import type { RecognitionResult } from './recognition/index';

export type { RecognitionResult };

/** 识别音频文件中的歌曲 */
export async function recognizeSong(audioPath: string): Promise<RecognitionResult | null> {
  if (!isMusicFile(audioPath)) return null;
  return recognize(audioPath);
}

/** 获取后端状态 */
export async function checkBackends() {
  return getBackendStatus();
}

/** 简易音频质量检测 */
export { isMusicFile as isMaybeMusic };
