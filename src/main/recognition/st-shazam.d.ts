declare module 'st-shazam' {
  /** 返回 Shazam /match/v2 的原始 HTTP 响应体 JSON */
  export function recognizeSong(filePath: string): Promise<any>;
  /** 将音频文件转为 Int16Array 样本 */
  export function processAudio(filePath: string): Promise<Int16Array>;
}
