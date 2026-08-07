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

// ----- Electron API -----

interface ElectronAPI {
  platform: string;

  getAppInfo: () => Promise<{ name: string; version: string; platform: string; electronVersion: string; nodeVersion: string }>;

  // 消息存储
  getMessages: () => Promise<ChatMessage[]>;
  addMessage: (msg: ChatMessage) => Promise<void>;
  clearMessages: () => Promise<void>;

  // 设置
  getSettings: () => Promise<UserSettings>;
  updateSettings: (partial: Partial<UserSettings>) => Promise<UserSettings>;

  // AI
  analyzeSong: (songName: string, artist?: string) => Promise<{ success: boolean; data?: SongAnalysis; error?: string }>;
  chat: (history: { role: string; content: string }[]) => Promise<{ success: boolean; data?: string; error?: string }>;

  // 日记
  getDiary: () => Promise<DiaryEntry[]>;
  addDiaryEntry: (entry: DiaryEntry) => Promise<void>;

  // 统计
  getStats: () => Promise<ListeningStats>;

  // 数据管理
  getAllData: () => Promise<any>;
  resetAllData: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
