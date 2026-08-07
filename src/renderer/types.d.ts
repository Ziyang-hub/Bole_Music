/**
 * 伯乐模拟器 - 前端类型定义
 */

// ----- 数据模型 -----

interface ChatMessage {
  id: string;
  role: 'user' | 'bole';
  content: string;
  timestamp: string;
}

interface UserSettings {
  persona: 'literary' | 'professional' | 'warm' | 'humorous';
  apiProvider: 'deepseek' | 'qwen' | 'openai' | 'custom';
  apiKey: string;
  customEndpoint: string;
  autoListen: boolean;
  notifyOnAnalysis: boolean;
  dailyReport: boolean;
  weeklyReport: boolean;
}

interface SongAnalysis {
  songName: string;
  artist: string;
  lyrics: string;
  emotion: string;
  genre: string;
  story: string;
  personalThought: string;
  analyzedAt: string;
}

interface DiaryEntry {
  date: string;
  songs: { title: string; artist: string; time: string; note: string }[];
  mood: string;
  summary: string;
}

interface ListeningStats {
  totalSongs: number;
  totalAnalyses: number;
  genreDistribution: Record<string, number>;
  artistCounts: Record<string, number>;
  dailyCounts: Record<string, number>;
  topSongs: { title: string; artist: string; count: number }[];
}

interface ReportData {
  summary: string;
  mood: string;
  keywords: string[];
  highlights: string[];
}

interface RecommendData {
  recommendations: { songName: string; artist: string; reason: string }[];
  comment: string;
}

// ----- Electron API -----

interface ElectronAPI {
  platform: string;

  getAppInfo: () => Promise<{
    name: string; version: string; platform: string;
    electronVersion: string; nodeVersion: string;
  }>;

  // 消息
  getMessages: () => Promise<ChatMessage[]>;
  addMessage: (msg: ChatMessage) => Promise<void>;
  clearMessages: () => Promise<void>;

  // 设置
  getSettings: () => Promise<UserSettings>;
  updateSettings: (partial: Partial<UserSettings>) => Promise<UserSettings>;

  // AI
  analyzeSong: (songName: string, artist?: string) =>
    Promise<{ success: boolean; data?: SongAnalysis; error?: string }>;
  chat: (history: { role: string; content: string }[]) =>
    Promise<{ success: boolean; data?: string; error?: string }>;
  generateReport: (type: string, songs: any[], stats: any) =>
    Promise<{ success: boolean; data?: ReportData; error?: string }>;
  recommendSongs: (recentSongs: any[], topGenres: string[], topArtists: string[]) =>
    Promise<{ success: boolean; data?: RecommendData; error?: string }>;

  // 日记
  getDiary: () => Promise<DiaryEntry[]>;
  addDiaryEntry: (entry: DiaryEntry) => Promise<void>;
  updateDiaryEntry: (date: string, partial: Partial<DiaryEntry>) => Promise<void>;
  deleteDiaryEntry: (date: string) => Promise<void>;

  // 统计
  getStats: () => Promise<ListeningStats>;
  updateStats: (songName: string, artist: string, genre: string) => Promise<void>;

  // 音频采集
  startAudioCapture: () => Promise<{ success: boolean }>;
  stopAudioCapture: () => Promise<{ success: boolean }>;
  isAudioCapturing: () => Promise<boolean>;
  checkCaptureCapability: () => Promise<{
    available: boolean;
    platform: string;
    needs: string[];
  }>;
  onSongDetected: (callback: (result: RecognitionResult) => void) => void;

  // 数据
  getAllData: () => Promise<any>;
  resetAllData: () => Promise<void>;
}

interface RecognitionResult {
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  duration?: number;
  confidence: number;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
