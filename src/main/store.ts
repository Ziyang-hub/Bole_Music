/**
 * 伯乐模拟器 - 数据存储服务
 *
 * 使用 electron-store 将数据保存到本地 JSON 文件
 * 数据位置：{用户目录}/.bole-simulator/
 *
 * 存储内容：
 * - 聊天记录
 * - 用户设置
 * - 歌曲分析缓存（避免重复调用 AI）
 * - 听歌日记
 * - 听歌统计数据
 */

import Store from 'electron-store';

// 定义存储的数据结构
interface StoredData {
  /** 聊天消息历史 */
  messages: ChatMessage[];
  /** 用户设置 */
  settings: UserSettings;
  /** 歌曲分析缓存 key=歌曲名, value=分析结果 */
  songCache: Record<string, SongAnalysis>;
  /** 听歌日记 */
  diary: DiaryEntry[];
  /** 听歌统计 */
  stats: ListeningStats;
}

// ----- 子类型 -----

export interface ChatMessage {
  id: string;
  role: 'user' | 'bole';
  content: string;
  timestamp: string; // ISO 字符串，方便 JSON 存储
}

export interface UserSettings {
  /** AI 人格 */
  persona: 'literary' | 'professional' | 'warm' | 'humorous';
  /** AI 服务商 */
  apiProvider: 'deepseek' | 'qwen' | 'openai' | 'custom';
  /** API 密钥 */
  apiKey: string;
  /** 自定义 API 地址 */
  customEndpoint: string;
  /** 自动音频采集 */
  autoListen: boolean;
  /** 分析完成通知 */
  notifyOnAnalysis: boolean;
  /** 每日小结 */
  dailyReport: boolean;
  /** 每周报告 */
  weeklyReport: boolean;
  /** 主题 */
  theme: 'dark' | 'light';
  /** 用户头像 emoji */
  userAvatar: string;
  /** 识别后端（已简化为 Shazam 单一后端） */
  recognitionBackend: 'shazam';
}

export interface SongAnalysis {
  songName: string;
  artist: string;
  lyrics: string;
  emotion: string;
  genre: string;
  story: string;
  personalThought: string;
  analyzedAt: string;
}

export interface DiaryEntry {
  date: string;
  songs: {
    title: string;
    artist: string;
    time: string;
    note: string;
  }[];
  mood: string;
  summary: string;
}

export interface ListeningStats {
  totalSongs: number;
  totalAnalyses: number;
  genreDistribution: Record<string, number>;
  artistCounts: Record<string, number>;
  dailyCounts: Record<string, number>;
  topSongs: { title: string; artist: string; count: number }[];
}

// ----- 默认值 -----

const defaultSettings: UserSettings = {
  persona: 'literary',
  apiProvider: 'deepseek',
  apiKey: '',
  customEndpoint: '',
  autoListen: false,
  notifyOnAnalysis: true,
  dailyReport: true,
  weeklyReport: true,
  theme: 'dark',
  userAvatar: '👤',
  recognitionBackend: 'shazam',
};

const defaultStats: ListeningStats = {
  totalSongs: 0,
  totalAnalyses: 0,
  genreDistribution: {},
  artistCounts: {},
  dailyCounts: {},
  topSongs: [],
};

// ----- 初始化存储 -----

const store = new Store<StoredData>({
  name: 'bole-data',
  defaults: {
    messages: [],
    settings: defaultSettings,
    songCache: {},
    diary: [],
    stats: defaultStats,
  },
});

// ============================================================
// 消息存储
// ============================================================

export function getMessages(): ChatMessage[] {
  return store.get('messages', []);
}

export function addMessage(msg: ChatMessage): void {
  const messages = store.get('messages', []);
  messages.push(msg);
  store.set('messages', messages);
}

export function clearMessages(): void {
  store.set('messages', []);
}

export function deleteMessage(id: string): void {
  const messages = store.get('messages', []);
  store.set('messages', messages.filter(m => m.id !== id));
}

export function deleteMessages(ids: string[]): void {
  const messages = store.get('messages', []);
  const idSet = new Set(ids);
  store.set('messages', messages.filter(m => !idSet.has(m.id)));
}

// ============================================================
// 设置存储
// ============================================================

export function getSettings(): UserSettings {
  return store.get('settings', defaultSettings);
}

export function updateSettings(partial: Partial<UserSettings>): UserSettings {
  const current = getSettings();
  const updated = { ...current, ...partial };
  store.set('settings', updated);
  return updated;
}

// ============================================================
// 歌曲分析缓存
// ============================================================

export function getCachedAnalysis(songName: string): SongAnalysis | null {
  const cache = store.get('songCache', {});
  // 用歌名做 key（忽略大小写和多余空格）
  const key = songName.trim().toLowerCase();
  return cache[key] ?? null;
}

export function cacheAnalysis(songName: string, analysis: SongAnalysis): void {
  const cache = store.get('songCache', {});
  const key = songName.trim().toLowerCase();
  cache[key] = analysis;
  store.set('songCache', cache);
}

export function clearAnalysisCache(): void {
  store.set('songCache', {});
}

// ============================================================
// 听歌日记
// ============================================================

export function getDiary(): DiaryEntry[] {
  return store.get('diary', []);
}

export function addDiaryEntry(entry: DiaryEntry): void {
  const diary = store.get('diary', []);
  // 如果当天已有记录，追加歌曲
  const existing = diary.find((d) => d.date === entry.date);
  if (existing) {
    existing.songs.push(...entry.songs);
    // 更新 mood 和 summary（如果有新内容）
    if (entry.mood && entry.mood !== '未知') existing.mood = entry.mood;
    if (entry.summary) existing.summary = entry.summary;
  } else {
    diary.push(entry);
  }
  store.set('diary', diary);
}

export function updateDiaryEntry(
  date: string,
  partial: Partial<DiaryEntry>
): void {
  const diary = store.get('diary', []);
  const entry = diary.find((d) => d.date === date);
  if (entry) {
    Object.assign(entry, partial);
    store.set('diary', diary);
  }
}

export function deleteDiaryEntry(date: string): void {
  const diary = store.get('diary', []);
  store.set(
    'diary',
    diary.filter((d) => d.date !== date)
  );
}

// ============================================================
// 听歌统计
// ============================================================

export function getStats(): ListeningStats {
  return store.get('stats', defaultStats);
}

export function updateStats(songName: string, artist: string, genre: string): void {
  const stats = getStats();
  stats.totalSongs += 1;

  // 曲风统计
  stats.genreDistribution[genre] = (stats.genreDistribution[genre] || 0) + 1;

  // 歌手统计
  stats.artistCounts[artist] = (stats.artistCounts[artist] || 0) + 1;

  // 每日统计
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  stats.dailyCounts[today] = (stats.dailyCounts[today] || 0) + 1;

  // 热门歌曲
  const existing = stats.topSongs.find(
    (s) => s.title === songName && s.artist === artist
  );
  if (existing) {
    existing.count += 1;
  } else {
    stats.topSongs.push({ title: songName, artist, count: 1 });
  }
  stats.topSongs.sort((a, b) => b.count - a.count);
  stats.topSongs = stats.topSongs.slice(0, 20); // 只保留前20

  store.set('stats', stats);
}

// ============================================================
// 全部数据（用于调试/导出）
// ============================================================

export function getAllData(): StoredData {
  return {
    messages: getMessages(),
    settings: getSettings(),
    songCache: store.get('songCache', {}),
    diary: getDiary(),
    stats: getStats(),
  };
}

// ============================================================
// 使用统计
// ============================================================

interface UsageData {
  totalSessions: number;
  totalAnalyses: number;
  totalChats: number;
  playlistImports: number;
  firstUsed: string;
  lastUsed: string;
  featureCounts: Record<string, number>;
}

export function trackUsage(event: string, data?: any): void {
  const usage: UsageData = (store as any).get('usage') || {
    totalSessions: 0,
    totalAnalyses: 0,
    totalChats: 0,
    playlistImports: 0,
    firstUsed: new Date().toISOString(),
    lastUsed: new Date().toISOString(),
    featureCounts: {},
  };

  usage.lastUsed = new Date().toISOString();
  usage.featureCounts = usage.featureCounts || {};
  usage.featureCounts[event] = (usage.featureCounts[event] || 0) + 1;

  if (event === 'analysis') usage.totalAnalyses = (usage.totalAnalyses || 0) + 1;
  if (event === 'chat') usage.totalChats = (usage.totalChats || 0) + 1;
  if (event === 'playlist_import') usage.playlistImports = (usage.playlistImports || 0) + 1;

  (store as any).set('usage', usage);
}

export function getUsageStats(): UsageData {
  return (store as any).get('usage') || {
    totalSessions: 0,
    totalAnalyses: 0,
    totalChats: 0,
    playlistImports: 0,
    firstUsed: '',
    lastUsed: '',
    featureCounts: {},
  };
}

export function resetAllData(): void {
  store.clear();
  store.set('messages', []);
  store.set('settings', { ...defaultSettings });
  store.set('songCache', {});
  store.set('diary', []);
  store.set('stats', {
    totalSongs: 0,
    totalAnalyses: 0,
    genreDistribution: {},
    artistCounts: {},
    dailyCounts: {},
    topSongs: [],
  });
  store.set('usage', {});
}
