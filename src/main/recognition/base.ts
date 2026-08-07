/**
 * 歌曲识别 - 统一接口
 * 所有识别后端都实现这个接口
 */

export interface RecognitionResult {
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  confidence: number;  // 0-100
  backend: string;      // 用了哪个后端
}

export interface RecognitionBackend {
  name: string;
  recognize(audioPath: string): Promise<RecognitionResult | null>;
  isAvailable(): Promise<boolean>;
}
