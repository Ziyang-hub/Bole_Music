/**
 * 伯乐模拟器 - 歌曲识别服务
 *
 * 统一入口，支持 AudD（商业指纹）和 AcoustID（开源指纹）双后端切换
 */

import { recognize, isMusicFile, getBackendStatus } from './recognition/index';
import type { RecognitionResult } from './recognition/base';

// 重新导出类型
export type { RecognitionResult };

/**
 * 识别音频文件中的歌曲
 */
export async function recognizeSong(
  audioPath: string
): Promise<RecognitionResult | null> {
  if (!isMusicFile(audioPath)) return null;
  return recognize(audioPath);
}

/**
 * 获取后端状态
 */
export async function checkBackends(): Promise<
  { name: string; available: boolean; description: string }[]
> {
  return getBackendStatus();
}

// 兼容旧导出
export { isMusicFile as isMaybeMusic, getBackendStatus };
