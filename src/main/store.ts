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
  /** 聊天消息历史（旧版单一数组，迁移后不再使用） */
  messages: ChatMessage[];
  /** 多对话列表 */
  conversations: Conversation[];
  /** 当前活跃对话 ID */
  activeConversationId: string;
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

/** 对话（会话） */
export interface Conversation {
  id: string;
  name: string;
  persona: 'literary' | 'professional' | 'warm' | 'humorous';
  messages: ChatMessage[];
  createdAt: string; // ISO
  lastActiveAt: string; // ISO
}

export interface UserSettings {
  /** AI 人格 */
  persona: 'literary' | 'professional' | 'warm' | 'humorous';
  /** AI 服务商 */
  apiProvider: 'deepseek' | 'qwen' | 'openai' | 'custom';
  /** 各服务商的 API 密钥（一个服务商一个密钥） */
  apiKeys: Record<string, string>;
  /** 各服务商的自定义模型（未配置时使用默认模型） */
  models: Record<string, string>;
  /** 自定义 API 地址 */
  customEndpoint: string;
  /** 自动音频采集 */
  autoListen: boolean;
  /** 自动写入日记 */
  autoDiary: boolean;
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
    genre?: string;  // 曲风（用于时间段曲风分布统计）
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
  apiKeys: {},
  models: {},
  customEndpoint: '',
  autoListen: false,
  autoDiary: false,
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
    conversations: [],
    activeConversationId: '',
    settings: defaultSettings,
    songCache: {},
    diary: [],
    stats: defaultStats,
  },
});

// ============================================================
// 对话（多会话）存储
// ============================================================

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * 获取全部对话；首次使用时迁移旧版单一 messages 数组为默认对话
 */
export function getConversations(): Conversation[] {
  let conversations = store.get('conversations', []);
  if (!conversations || conversations.length === 0) {
    // 旧版迁移：把 messages 里的历史消息导入默认对话
    const legacyMessages = store.get('messages', []);
    const settings = getSettings();
    const defaultConv: Conversation = {
      id: 'default',
      name: '默认对话',
      persona: settings.persona || 'literary',
      messages: legacyMessages,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    conversations = [defaultConv];
    store.set('conversations', conversations);
    store.set('activeConversationId', 'default');
    // 清理旧数据
    store.set('messages', []);
    console.log('[store] migrated legacy messages to default conversation:', legacyMessages.length, 'msgs');
  }
  return conversations;
}

export function getConversation(id: string): Conversation | null {
  const conv = getConversations().find((c) => c.id === id);
  return conv || null;
}

export function createConversation(
  name: string,
  persona: Conversation['persona']
): Conversation {
  const conv: Conversation = {
    id: genId(),
    name: name || '新对话',
    persona: persona || 'literary',
    messages: [],
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };
  const conversations = getConversations();
  conversations.push(conv);
  store.set('conversations', conversations);
  setActiveConversation(conv.id);
  console.log('[store] created conversation:', conv.id, conv.name, conv.persona);
  return conv;
}

export function deleteConversation(id: string): boolean {
  let conversations = getConversations();
  if (conversations.length <= 1) {
    console.warn('[store] cannot delete the last conversation');
    return false;
  }
  conversations = conversations.filter((c) => c.id !== id);
  store.set('conversations', conversations);
  // 如果删除的是当前活跃对话，切换到第一个
  if (getActiveConversationId() === id) {
    setActiveConversation(conversations[0].id);
  }
  console.log('[store] deleted conversation:', id);
  return true;
}

export function updateConversation(id: string, partial: Partial<Conversation>): void {
  const conversations = getConversations();
  const idx = conversations.findIndex((c) => c.id === id);
  if (idx === -1) return;
  conversations[idx] = { ...conversations[idx], ...partial };
  store.set('conversations', conversations);
}

export function getActiveConversationId(): string {
  const id = store.get('activeConversationId', '');
  // 如果无效（例如首次），返回第一个对话
  if (!id || !getConversations().some((c) => c.id === id)) {
    const first = getConversations()[0];
    if (first) {
      store.set('activeConversationId', first.id);
      return first.id;
    }
  }
  return id;
}

export function setActiveConversation(id: string): void {
  store.set('activeConversationId', id);
  const conversations = getConversations();
  const idx = conversations.findIndex((c) => c.id === id);
  if (idx !== -1) {
    conversations[idx].lastActiveAt = new Date().toISOString();
    store.set('conversations', conversations);
  }
}

// ----- 对话内消息操作 -----

export function getMessagesForConversation(convId: string): ChatMessage[] {
  const conv = getConversation(convId);
  return conv ? conv.messages : [];
}

export function addMessageToConversation(convId: string, msg: ChatMessage): void {
  const conversations = getConversations();
  const idx = conversations.findIndex((c) => c.id === convId);
  if (idx === -1) return;
  conversations[idx].messages.push(msg);
  conversations[idx].lastActiveAt = new Date().toISOString();
  store.set('conversations', conversations);
}

export function deleteMessageFromConversation(convId: string, msgId: string): void {
  const conversations = getConversations();
  const idx = conversations.findIndex((c) => c.id === convId);
  if (idx === -1) return;
  conversations[idx].messages = conversations[idx].messages.filter((m) => m.id !== msgId);
  store.set('conversations', conversations);
}

export function clearMessagesInConversation(convId: string): void {
  const conversations = getConversations();
  const idx = conversations.findIndex((c) => c.id === convId);
  if (idx === -1) return;
  conversations[idx].messages = [];
  store.set('conversations', conversations);
}

// ============================================================
// 消息存储（旧版兼容：操作默认对话）
// ============================================================

export function getMessages(): ChatMessage[] {
  return getMessagesForConversation('default');
}

export function addMessage(msg: ChatMessage): void {
  addMessageToConversation('default', msg);
}

export function clearMessages(): void {
  clearMessagesInConversation('default');
}

export function deleteMessage(id: string): void {
  deleteMessageFromConversation('default', id);
}

export function deleteMessages(ids: string[]): void {
  const conversations = getConversations();
  const idx = conversations.findIndex((c) => c.id === 'default');
  if (idx === -1) return;
  const idSet = new Set(ids);
  conversations[idx].messages = conversations[idx].messages.filter((m) => !idSet.has(m.id));
  store.set('conversations', conversations);
}

/** 聚合所有对话的消息（用于日记/报告） */
export function getAllMessages(): ChatMessage[] {
  return getConversations().flatMap((c) => c.messages);
}

// ============================================================
// 设置存储
// ============================================================

export function getSettings(): UserSettings {
  const settings = store.get('settings', defaultSettings);
  // 旧版本兼容：apiKey 是单个字符串，迁移为 apiKeys[deepseek]
  const legacy = (settings as any).apiKey;
  if (typeof legacy === 'string' && legacy) {
    settings.apiKeys = { ...(settings.apiKeys || {}), deepseek: legacy };
    delete (settings as any).apiKey;
    store.set('settings', settings);
    console.log('[store] migrated legacy apiKey to apiKeys.deepseek');
  }
  if (!settings.apiKeys) settings.apiKeys = {};
  if (!settings.models) settings.models = {};
  return settings;
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
  // 防御：空曲风/歌手统一兜底为"未知"，避免产生空字符串统计项
  const g = (genre || '').trim() || '未知';
  const a = (artist || '').trim() || '未知';
  stats.totalSongs += 1;

  // 曲风统计
  stats.genreDistribution[g] = (stats.genreDistribution[g] || 0) + 1;

  // 歌手统计
  stats.artistCounts[a] = (stats.artistCounts[a] || 0) + 1;

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
    conversations: getConversations(),
    activeConversationId: getActiveConversationId(),
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
  store.set('conversations', []);
  store.set('activeConversationId', '');
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
