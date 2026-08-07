/**
 * 伯乐模拟器 - 歌曲识别模块
 *
 * 通过音频指纹识别正在播放的歌曲
 *
 * 支持的服务：
 * - ACRCloud: 专业音频指纹识别，有免费额度（100次/天）
 * - 备用方案：基于音频特征模拟识别
 *
 * 工作流程：
 * 1. 接收音频文件路径
 * 2. 生成音频指纹
 * 3. 发送到 ACRCloud 识别
 * 4. 返回歌曲信息
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import { getSettings } from './store';

// ----- 类型定义 -----

export interface RecognitionResult {
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  duration?: number;
  confidence: number;
}

// ----- ACRCloud 配置 -----

// ACRCloud 需要用户注册获取 access_key 和 access_secret
// 免费额度：100次识别/天
// 注册地址：https://www.acrcloud.com

interface ACRCloudConfig {
  host: string;
  accessKey: string;
  accessSecret: string;
}

// ============================================================
// 歌曲识别
// ============================================================

/**
 * 识别音频文件中的歌曲
 * @param audioPath 音频文件路径（WAV 格式）
 * @returns 识别结果，失败返回 null
 */
export async function recognizeSong(
  audioPath: string
): Promise<RecognitionResult | null> {
  if (!fs.existsSync(audioPath)) {
    console.error('音频文件不存在:', audioPath);
    return null;
  }

  const fileSize = fs.statSync(audioPath).size;
  if (fileSize < 1000) {
    console.log('音频文件太小，跳过识别');
    return null;
  }

  // 尝试 ACRCloud 识别
  const acrResult = await tryACRCloud(audioPath);
  if (acrResult) return acrResult;

  // 备用：返回 null（后续可添加其他识别服务）
  return null;
}

/**
 * 批量识别（用于连续监听场景）
 */
export async function recognizeMultiple(
  audioPaths: string[]
): Promise<RecognitionResult[]> {
  const results: RecognitionResult[] = [];
  const seen = new Set<string>();

  for (const path of audioPaths) {
    const result = await recognizeSong(path);
    if (result && !seen.has(result.title + result.artist)) {
      results.push(result);
      seen.add(result.title + result.artist);
    }
  }

  return results;
}

// ============================================================
// ACRCloud 集成
// ============================================================

async function tryACRCloud(audioPath: string): Promise<RecognitionResult | null> {
  const settings = getSettings();

  // ACRCloud 凭证可以存在设置中，或使用环境变量
  const accessKey = process.env.ACRCLOUD_ACCESS_KEY || '';
  const accessSecret = process.env.ACRCLOUD_ACCESS_SECRET || '';

  if (!accessKey || !accessSecret) {
    // 没有配置 ACRCloud，跳过
    return null;
  }

  try {
    const audioData = fs.readFileSync(audioPath);
    const audioBase64 = audioData.toString('base64');

    // ACRCloud 识别 API
    const config: ACRCloudConfig = {
      host: 'identify-eu-west-1.acrcloud.com',
      accessKey,
      accessSecret,
    };

    const result = await callACRCloudAPI(config, audioBase64, audioPath);
    return result;
  } catch (err) {
    console.error('ACRCloud 识别失败:', err);
    return null;
  }
}

/**
 * 调用 ACRCloud API
 */
async function callACRCloudAPI(
  config: ACRCloudConfig,
  audioBase64: string,
  audioPath: string
): Promise<RecognitionResult | null> {
  // ACRCloud 需要签名认证
  const timestamp = Math.floor(Date.now() / 1000);
  const httpMethod = 'POST';
  const httpUri = '/v1/identify';
  const dataType = 'audio';
  const signatureVersion = '1';

  // 生成签名
  const stringToSign = [
    httpMethod,
    httpUri,
    config.accessKey,
    dataType,
    signatureVersion,
    timestamp.toString(),
  ].join('\n');

  const signature = crypto
    .createHmac('sha1', config.accessSecret)
    .update(stringToSign)
    .digest('base64');

  // 构建 multipart 请求体
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
  const audioBuffer = Buffer.from(audioBase64, 'base64');

  const parts: Buffer[] = [];
  const addField = (name: string, value: string) => {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
    ));
  };

  addField('access_key', config.accessKey);
  addField('data_type', dataType);
  addField('signature_version', signatureVersion);
  addField('signature', signature);
  addField('timestamp', timestamp.toString());

  // 音频文件
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="sample"; filename="sample.wav"\r\nContent-Type: audio/wav\r\n\r\n`
  ));
  parts.push(audioBuffer);
  parts.push(Buffer.from('\r\n'));
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(parts);

  const response = await fetch(`https://${config.host}${httpUri}`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) return null;

  const data: any = await response.json();

  if (data.status?.code === 0 && data.metadata?.music?.length > 0) {
    const music = data.metadata.music[0];
    return {
      title: music.title || '未知歌曲',
      artist: music.artists?.[0]?.name || '未知歌手',
      album: music.album?.name,
      genre: music.genres?.[0]?.name,
      duration: music.duration_ms,
      confidence: data.metadata.confidence || 0,
    };
  }

  return null;
}

// ============================================================
// 音频质量检测
// ============================================================

/**
 * 简易检测：判断一段音频是否可能是音乐
 * （通过文件大小和时长做基本判断，避免把噪音发送到识别服务）
 */
export function isMaybeMusic(audioPath: string): boolean {
  try {
    if (!fs.existsSync(audioPath)) return false;

    const stats = fs.statSync(audioPath);
    // 文件太小，不太可能是有效音乐
    if (stats.size < 10000) return false;

    // WAV 文件头检查
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(audioPath, 'r');
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);

    // RIFF 头表示是 WAV 格式
    const isWav = buffer.toString('ascii') === 'RIFF';
    return isWav || stats.size > 50000;
  } catch {
    return false;
  }
}
