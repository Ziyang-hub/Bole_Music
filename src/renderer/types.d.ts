/**
 * 伯乐模拟器 - 前端类型定义
 */

// ----- 数据模型 -----

interface ChatMessage {
  id: string;
  role: 'user' | 'bole';
  content: string;
  timestamp: string;
  meta?: {
    type?: 'song_detected';
    songTitle?: string;
    songArtist?: string;
    confirmed?: boolean;
  };
}

interface UserSettings {
  persona: 'literary' | 'professional' | 'warm' | 'humorous';
  apiProvider: 'deepseek' | 'qwen' | 'openai' | 'custom';
  apiKeys: Record<string, string>;
  models: Record<string, string>;
  customEndpoint: string;
  autoListen: boolean;
  autoDiary: boolean;
  notifyOnAnalysis: boolean;
  dailyReport: boolean;
  weeklyReport: boolean;
  theme: 'dark' | 'light';
  userAvatar: string;
  recognitionBackend: 'shazam';
}

interface HotComment {
  nickname: string;
  content: string;
  likedCount: number;
}

/** 对话（会话） */
interface Conversation {
  id: string;
  name: string;
  persona: 'literary' | 'professional' | 'warm' | 'humorous';
  messages: ChatMessage[];
  createdAt: string;
  lastActiveAt: string;
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

  // 系统
  showNotification: (title: string, body: string) => Promise<void>;
  getTheme: () => Promise<string>;
  onNavigate: (callback: (view: string) => void) => void;
  onSettingsChanged?: (callback: (settings: UserSettings) => void) => void;

  // 消息
  getMessages: () => Promise<ChatMessage[]>;
  addMessage: (msg: ChatMessage) => Promise<void>;
  clearMessages: () => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;

  // 对话（多会话）
  getConversations: () => Promise<Conversation[]>;
  getActiveConversationId: () => Promise<string>;
  createConversation: (name: string, persona: string) => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<{ success: boolean; error?: string }>;
  switchConversation: (id: string) => Promise<Conversation | null>;
  renameConversation: (id: string, name: string) => Promise<void>;
  getMessagesForConversation: (id: string) => Promise<ChatMessage[]>;
  addMessageToConversation: (id: string, msg: ChatMessage) => Promise<void>;
  deleteMessageFromConversation: (id: string, msgId: string) => Promise<void>;
  getAllMessages: () => Promise<ChatMessage[]>;

  // 设置
  getSettings: () => Promise<UserSettings>;
  updateSettings: (partial: Partial<UserSettings>) => Promise<UserSettings>;

  // AI
  analyzeSong: (songName: string, artist?: string, lyrics?: string, persona?: string) =>
    Promise<{ success: boolean; data?: SongAnalysis; cached?: boolean; error?: string }>;
  analyzePlaylist: (playlistName: string, songs: { name: string; artist: string }[], history?: { role: string; content: string }[]) =>
    Promise<{ success: boolean; data?: string; error?: string }>;
  chat: (history: { role: string; content: string }[], userMessage: string, persona?: string) =>
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

  // 音乐平台
  searchSongs: (keyword: string, limit?: number) =>
    Promise<{ success: boolean; data?: SongInfo[]; error?: string }>;
  getLyrics: (songId: string) =>
    Promise<{ success: boolean; data?: string | null; error?: string }>;
  getSongDetail: (songId: string) =>
    Promise<{ success: boolean; data?: SongInfo | null; error?: string }>;
  getHotComments: (songId: string) =>
    Promise<{ success: boolean; data?: HotComment[]; error?: string }>;
  parseSongUrl: (url: string) =>
    Promise<{ success: boolean; data?: { platform: string; songId: string; song: SongInfo | null; lyrics: string | null }; error?: string }>;
  isSongUrl: (text: string) => Promise<boolean>;
  isPlaylistUrl: (text: string) => Promise<boolean>;
  getPlaylist: (url: string) =>
    Promise<{ success: boolean; data?: { name: string; songs: SongInfo[] }; error?: string }>;
  // 使用统计
  trackUsage: (event: string, data?: any) => Promise<void>;
  getUsageStats: () => Promise<UsageData>;

  // 音频采集
  startAudioCapture: () => Promise<{ success: boolean; native?: boolean }>;
  stopAudioCapture: () => Promise<{ success: boolean }>;
  isAudioCapturing: () => Promise<boolean>;
  checkCaptureCapability: () => Promise<{
    available: boolean;
    platform: string;
    needs: string[];
  }>;
  diagnoseAudio: () => Promise<{ ok: string[]; issues: string[]; ready: boolean }>;
  openScreenRecordingSettings: () => Promise<void>;
  onSongDetected: (callback: (result: RecognitionResult) => void) => void;
  onAudioLevel: (callback: (rms: number) => void) => void;
  fetchImage: (url: string) => Promise<string | null>;
  removeSongDetectedListener?: () => void;

  // macOS 系统音频采集
  getScreenSources: () => Promise<{
    sources: { id: string; name: string }[];
    status: string; // 'granted' | 'denied' | 'restricted' | 'not-determined' | 'error'
  }>;
  relaunchApp: () => Promise<{ success: boolean }>;
  sendAudioChunk: (data: ArrayBuffer) => void;
  notifyCaptureStarted: () => void;
  notifyCaptureStopped: () => void;
  notifyCaptureError: (msg: string) => void;

  // 自动更新
  checkForUpdate: () => Promise<UpdateInfo>;
  downloadUpdate: () => Promise<UpdateInfo>;
  installUpdate: () => Promise<void>;
  getUpdateStatus: () => Promise<UpdateInfo>;
  onUpdateStatusChanged: (callback: (info: UpdateInfo) => void) => void;

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

// ----- 音乐平台类型 -----

interface SongInfo {
  id: string;
  name: string;
  artists: string[];
  album?: { name: string; picUrl?: string };
  duration?: number;
  platform: 'netease' | 'qq' | 'unknown';
}

// ----- 更新类型 -----

interface UsageData {
  totalSessions: number;
  totalAnalyses: number;
  totalChats: number;
  playlistImports: number;
  firstUsed: string;
  lastUsed: string;
  featureCounts: Record<string, number>;
}

interface UpdateInfo {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  releaseDate?: string;
  releaseNotes?: string;
  progress?: number;
  error?: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
