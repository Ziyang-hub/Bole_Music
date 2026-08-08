/**
 * 浏览器模式 Mock API
 *
 * 在没有 Electron 的浏览器中模拟 window.electronAPI
 * 用于开发测试，数据存 localStorage
 */

import type { ChatMessage, UserSettings, DiaryEntry, ListeningStats, SongAnalysis } from './types';

// 用 localStorage 模拟持久化
function lsGet<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function lsSet(key: string, val: any) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

let msgId = 0;

export function installMockAPI() {
  if ((window as any).electronAPI) return; // 已在 Electron 中，不需要 mock

  const api = {
    platform: 'browser',
    getAppInfo: async () => ({ name: '伯乐模拟器(测试)', version: 'dev', platform: 'browser', electronVersion: 'mock', nodeVersion: 'mock' }),

    // 消息
    getMessages: async () => lsGet<ChatMessage[]>('msgs', [{
      id: 'w1', role: 'bole' as const, content: '你好！我是伯乐 🎵\n\n这是浏览器测试模式，所有功能都可以交互。\n\n💡 试试输入歌名，点击🔍搜索，或者粘贴网易云链接～', timestamp: new Date().toISOString(),
    }]),
    addMessage: async (m: ChatMessage) => { const ms = lsGet<ChatMessage[]>('msgs', []); ms.push(m); lsSet('msgs', ms); },
    clearMessages: async () => { lsSet('msgs', []); },

    // 设置
    getSettings: async () => lsGet<UserSettings>('settings', {
      persona: 'literary', apiProvider: 'deepseek', apiKey: '', customEndpoint: '',
      autoListen: false, notifyOnAnalysis: true, dailyReport: true, weeklyReport: true,
      theme: 'dark', recognitionBackend: 'shazam',
    }),
    updateSettings: async (p: any) => {
      const s = lsGet<UserSettings>('settings', {} as any);
      Object.assign(s, p); lsSet('settings', s); return s;
    },

    // AI（Mock 回复）
    analyzeSong: async (name: string, artist?: string) => ({
      success: true,
      data: {
        songName: name, artist: artist || '未知',
        lyrics: `这是关于「${name}」的歌词分析。歌曲讲述了深刻的情感和人生故事，歌词意境优美，值得细细品味。`,
        emotion: '温暖而深情',
        genre: '华语流行',
        story: '这首歌创作于灵感迸发的时刻，成为了经典之作。',
        personalThought: `听到「${name}」这首歌，我不禁想起了那些美好的时光。音乐就是有这样的魔力，能够穿越时空，触动心灵。`,
        analyzedAt: new Date().toISOString(),
      } as SongAnalysis,
    }),
    chat: async (_history: any, _userMessage: string) => ({ success: true, data: '你好！我是伯乐。在浏览器测试模式下，我会尽量回复你的问题。输入歌名我会尝试分析，也可以随便聊聊音乐～' }),
    generateReport: async () => ({ success: true, data: { summary: '测试报告', mood: '愉快', keywords: ['测试'], highlights: ['这是测试模式'] } }),
    recommendSongs: async () => ({ success: true, data: { recommendations: [{ songName: '晴天', artist: '周杰伦', reason: '经典华语流行' }], comment: '这是测试推荐' } }),

    // 音乐平台（Mock）
    searchSongs: async () => ({ success: true, data: [] }),
    getLyrics: async () => ({ success: true, data: null }),
    getSongDetail: async () => ({ success: true, data: null }),
    parseSongUrl: async () => ({ success: false, error: 'Browser mock' }),
    isSongUrl: async () => false,
    isPlaylistUrl: async () => false,
    getPlaylist: async () => ({ success: false, error: 'Browser mock' }),

    // 音频（Mock）
    startAudioCapture: async () => ({ success: true }),
    stopAudioCapture: async () => ({ success: true }),
    isAudioCapturing: async () => false,
    checkCaptureCapability: async () => ({ available: false, platform: 'browser', needs: [] }),
    diagnoseAudio: async () => ({ ok: ['浏览器测试模式'], issues: [], ready: true }),
    openScreenRecordingSettings: async () => {},
    onSongDetected: () => {},
    removeSongDetectedListener: () => {},
    getScreenSources: async () => [],
    sendAudioChunk: () => {},
    notifyCaptureStarted: () => {},
    notifyCaptureStopped: () => {},
    notifyCaptureError: () => {},

    // 使用统计
    trackUsage: async () => {},
    getUsageStats: async () => lsGet('usage', {}),

    // 系统
    showNotification: async () => {},
    getTheme: async () => lsGet<string>('theme', 'dark'),
    onNavigate: () => {},
    onSettingsChanged: () => {},

    // 数据
    getAllData: async () => ({}),
    resetAllData: async () => { localStorage.clear(); },
  };

  (window as any).electronAPI = api;
  console.log('🎭 Browser mock API installed');
}
